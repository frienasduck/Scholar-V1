import "server-only";
import { db } from "@/lib/db";
import type { EvidenceEvent, MasteryEstimate, MistakeRecord } from "./types";
import { estimateAllMastery, estimateMastery } from "./mastery";
import { findWeakTopics } from "./weak-topics";
import { detectPatterns } from "./mistakes";

/**
 * Server-side Scholar Intelligence persistence.
 *
 * The client sends raw evidence events; the server stores them and recomputes
 * mastery with the same pure engine used everywhere. Mastery is derived
 * server-side — the client can never write a mastery level directly.
 */

export async function storeEvidence(userId: string, events: EvidenceEvent[]): Promise<number> {
  let stored = 0;
  for (const event of events) {
    try {
      await db.practiceAttempt.upsert({
        where: { id: event.id },
        create: {
          id: event.id,
          userId,
          kind: event.kind,
          subject: event.subject,
          chapter: event.chapter,
          topic: event.topic,
          correct: event.correct ?? null,
          score: event.score ?? null,
          total: event.total ?? null,
          difficulty: event.difficulty ?? null,
          rating: event.rating ?? null,
          source: event.source ?? "quiz",
          occurredAt: new Date(event.at),
        },
        update: {
          correct: event.correct ?? null,
          score: event.score ?? null,
          occurredAt: new Date(event.at),
        },
      });
      stored += 1;
    } catch (error) {
      console.error("[Scholar intelligence] failed to store evidence", error instanceof Error ? error.message : "unknown");
    }
  }
  return stored;
}

export async function storeMistakes(userId: string, mistakes: MistakeRecord[]): Promise<number> {
  let stored = 0;
  for (const mistake of mistakes) {
    try {
      await db.mistakeRecord.upsert({
        where: { id: mistake.id },
        create: {
          id: mistake.id,
          userId,
          subject: mistake.subject,
          chapter: mistake.chapter,
          topic: mistake.topic,
          question: mistake.question,
          userAnswer: mistake.userAnswer,
          correctAnswer: mistake.correctAnswer,
          explanation: mistake.explanation,
          mistakeType: mistake.mistakeType,
          originalType: mistake.originalType,
          source: mistake.source,
          resolved: mistake.resolved,
          resolvedAt: mistake.resolvedAt ? new Date(mistake.resolvedAt) : null,
          occurredAt: new Date(mistake.at),
        },
        update: {
          resolved: mistake.resolved,
          resolvedAt: mistake.resolvedAt ? new Date(mistake.resolvedAt) : null,
        },
      });
      stored += 1;
    } catch (error) {
      console.error("[Scholar intelligence] failed to store mistake", error instanceof Error ? error.message : "unknown");
    }
  }
  return stored;
}

export async function recomputeMastery(userId: string): Promise<number> {
  const attempts = await db.practiceAttempt.findMany({ where: { userId }, select: { id: true, kind: true, subject: true, chapter: true, topic: true, correct: true, score: true, total: true, difficulty: true, rating: true, source: true, occurredAt: true } });
  const events: EvidenceEvent[] = attempts.map((attempt) => ({
    id: attempt.id,
    kind: attempt.kind as EvidenceEvent["kind"],
    subject: attempt.subject,
    chapter: attempt.chapter ?? undefined,
    topic: attempt.topic ?? undefined,
    correct: attempt.correct ?? undefined,
    score: attempt.score ?? undefined,
    total: attempt.total ?? undefined,
    difficulty: (attempt.difficulty as EvidenceEvent["difficulty"]) ?? undefined,
    rating: (attempt.rating as EvidenceEvent["rating"]) ?? undefined,
    at: attempt.occurredAt.getTime(),
    source: (attempt.source as EvidenceEvent["source"]) ?? "quiz",
  }));

  const estimates = [...estimateAllMastery(events).values()];
  let written = 0;
  for (const estimate of estimates) {
    // Nullable chapter/topic can't use Prisma's compound-unique upsert (the
    // generated where type requires non-null strings), so resolve by lookup.
    const existing = await db.masteryRecord.findFirst({
      where: {
        userId,
        subject: estimate.subject,
        chapter: estimate.chapter ?? null,
        topic: estimate.topic ?? null,
      },
      select: { id: true },
    });
    const data = {
      level: estimate.level,
      score: estimate.score,
      accuracy: estimate.accuracy,
      evidenceCount: estimate.evidenceCount,
      decayed: estimate.decayed,
      lastAttemptAt: estimate.lastAttemptAt ? new Date(estimate.lastAttemptAt) : null,
      lastRevisedAt: estimate.lastRevisedAt ? new Date(estimate.lastRevisedAt) : null,
    };
    if (existing) {
      await db.masteryRecord.update({ where: { id: existing.id }, data });
    } else {
      await db.masteryRecord.create({
        data: {
          userId,
          subject: estimate.subject,
          chapter: estimate.chapter ?? null,
          topic: estimate.topic ?? null,
          ...data,
        },
      });
    }
    written += 1;
  }
  return written;
}

export async function loadMastery(userId: string): Promise<MasteryEstimate[]> {
  const rows = await db.masteryRecord.findMany({ where: { userId } });
  return rows.map((row) => ({
    subject: row.subject,
    chapter: row.chapter ?? undefined,
    topic: row.topic ?? undefined,
    level: row.level as MasteryEstimate["level"],
    score: row.score,
    evidenceCount: row.evidenceCount,
    correctCount: Math.round(row.evidenceCount * (row.accuracy ?? 0)),
    accuracy: row.accuracy,
    lastAttemptAt: row.lastAttemptAt?.getTime(),
    lastRevisedAt: row.lastRevisedAt?.getTime(),
    daysSinceRevision: row.lastRevisedAt ? Math.max(0, Math.floor((Date.now() - row.lastRevisedAt.getTime()) / 86_400_000)) : null,
    decayed: row.decayed,
    needsRefresh: row.decayed || row.level === "DECAYING",
  }));
}

export async function loadMistakes(userId: string, limit = 200): Promise<MistakeRecord[]> {
  const rows = await db.mistakeRecord.findMany({
    where: { userId },
    orderBy: { occurredAt: "desc" },
    take: limit,
  });
  return rows.map((row) => ({
    id: row.id,
    subject: row.subject,
    chapter: row.chapter ?? undefined,
    topic: row.topic ?? undefined,
    question: row.question,
    userAnswer: row.userAnswer ?? undefined,
    correctAnswer: row.correctAnswer ?? undefined,
    explanation: row.explanation ?? undefined,
    mistakeType: row.mistakeType as MistakeRecord["mistakeType"],
    originalType: row.originalType ?? undefined,
    source: row.source as MistakeRecord["source"],
    resolved: row.resolved,
    resolvedAt: row.resolvedAt?.getTime(),
    at: row.occurredAt.getTime(),
  }));
}

/** Server-computed intelligence snapshot for a user. */
export async function intelligenceSnapshot(userId: string) {
  await recomputeMastery(userId);
  const [mastery, mistakes] = await Promise.all([loadMastery(userId), loadMistakes(userId)]);
  const attempts = await db.practiceAttempt.findMany({ where: { userId }, orderBy: { occurredAt: "desc" }, take: 500 });
  const events: EvidenceEvent[] = attempts.map((attempt) => ({
    id: attempt.id,
    kind: attempt.kind as EvidenceEvent["kind"],
    subject: attempt.subject,
    chapter: attempt.chapter ?? undefined,
    topic: attempt.topic ?? undefined,
    correct: attempt.correct ?? undefined,
    score: attempt.score ?? undefined,
    total: attempt.total ?? undefined,
    difficulty: (attempt.difficulty as EvidenceEvent["difficulty"]) ?? undefined,
    rating: (attempt.rating as EvidenceEvent["rating"]) ?? undefined,
    at: attempt.occurredAt.getTime(),
    source: (attempt.source as EvidenceEvent["source"]) ?? "quiz",
  }));

  return {
    mastery,
    mistakes,
    weakTopics: findWeakTopics({ events, mistakes }),
    patterns: detectPatterns(mistakes),
    evidenceCount: events.length,
    updatedAt: Date.now(),
  };
}

export { estimateMastery };
