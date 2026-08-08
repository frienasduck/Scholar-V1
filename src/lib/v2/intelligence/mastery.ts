/**
 * Scholar Intelligence — Mastery Engine.
 *
 * Tracks mastery at Subject → Chapter → Topic → Concept using evidence:
 * quiz results, practice attempts, mistakes, revision recency, confidence
 * ratings and difficulty.
 *
 * Design principles:
 *  - Mastery is an ESTIMATE, never an exact number. `score` is a
 *    recency-weighted correctness estimate in 0..1 and is always shown with
 *    hedging language in the UI.
 *  - Level changes are conservative: a topic needs enough evidence before it
 *    can be STRONG/MASTERED, and decay never destroys a score dramatically —
 *    a strong topic becomes DECAYING ("needs refresh") rather than dropping
 *    straight back to LEARNING.
 *  - Revision recency is part of the model so decay awareness works without
 *    an AI "guessing" at knowledge.
 */

import {
  DAY_MS,
  type DifficultyLevel,
  type EvidenceEvent,
  type MasteryEstimate,
  type MasteryLevel,
  type ReviewRating,
  type TopicKey,
} from "./types";

// ============================================================================
// Level ordering + thresholds
// ============================================================================

export const MASTERY_LEVELS: MasteryLevel[] = [
  "UNKNOWN",
  "INTRODUCED",
  "LEARNING",
  "DEVELOPING",
  "STRONG",
  "MASTERED",
  "DECAYING",
];

export const MASTERY_LEVEL_LABELS: Record<MasteryLevel, string> = {
  UNKNOWN: "Unknown",
  INTRODUCED: "Introduced",
  LEARNING: "Learning",
  DEVELOPING: "Developing",
  STRONG: "Strong",
  MASTERED: "Mastered",
  DECAYING: "Needs refresh",
};

/** Minimum evidence (scored items) before a topic may reach a level. */
const MIN_EVIDENCE: Record<Exclude<MasteryLevel, "DECAYING" | "UNKNOWN">, number> = {
  INTRODUCED: 0,
  LEARNING: 1,
  DEVELOPING: 2,
  STRONG: 5,
  MASTERED: 8,
};

/** Conservative decay windows (days without revision before a level flags). */
const DECAY_AFTER_DAYS: Partial<Record<MasteryLevel, number>> = {
  STRONG: 10,
  MASTERED: 14,
};

/** Difficulty weighting — harder corrects prove more, harder wrongs hurt more. */
const DIFFICULTY_WEIGHT: Record<DifficultyLevel, number> = {
  foundation: 0.8,
  standard: 1.0,
  advanced: 1.2,
  challenge: 1.4,
};

const RECENCY_WINDOW_30D = 30 * DAY_MS;
const RECENCY_WINDOW_7D = 7 * DAY_MS;

/** Confidence/recall rating mapped onto a correctness proxy (1..4). */
export function ratingToOutcome(rating: ReviewRating | number): number {
  if (rating === 1 || rating === "again") return 0;
  if (rating === 2 || rating === "hard") return 0.4;
  if (rating === 3 || rating === "good") return 0.85;
  if (rating === 4 || rating === "easy") return 1;
  return 0.5; // unknown rating → neutral
}

// ============================================================================
// Evidence aggregation
// ============================================================================

export interface EvidenceAggregate {
  evidenceCount: number;
  correctCount: number;
  scoredItems: number;
  /** Weighted average correctness 0..1 (null when no scored items). */
  score: number | null;
  lastAttemptAt?: number;
  lastRevisedAt?: number;
  lastEventAt?: number;
  exposed: boolean;
}

/** Fold an evidence event into a running weighted aggregate (chronological). */
function foldEvent(agg: EvidenceAggregate, event: EvidenceEvent, now: number): EvidenceAggregate {
  const next: EvidenceAggregate = {
    ...agg,
    evidenceCount: agg.evidenceCount + 1,
    lastEventAt: Math.max(agg.lastEventAt ?? 0, event.at),
  };

  let outcome: number | null = null;
  let weight = 1;

  if (event.kind === "quiz_attempt" && typeof event.score === "number") {
    const total = event.total && event.total > 0 ? event.total : 10;
    const score = Math.min(1, Math.max(0, event.score));
    outcome = score;
    next.correctCount += Math.round(score * total);
    weight = total / 10;
    next.lastAttemptAt = Math.max(agg.lastAttemptAt ?? 0, event.at);
  } else if (event.kind === "question_result" || event.kind === "practice") {
    outcome = event.correct ? 1 : 0;
    if (event.correct) next.correctCount += 1;
    next.lastAttemptAt = Math.max(agg.lastAttemptAt ?? 0, event.at);
  } else if (event.kind === "mistake") {
    outcome = 0;
    next.lastAttemptAt = Math.max(agg.lastAttemptAt ?? 0, event.at);
  } else if (event.kind === "confidence" && event.rating) {
    outcome = ratingToOutcome(event.rating);
    next.lastAttemptAt = Math.max(agg.lastAttemptAt ?? 0, event.at);
  } else if (event.kind === "revision") {
    outcome = 1; // a completed revision refreshes knowledge
    next.lastRevisedAt = Math.max(agg.lastRevisedAt ?? 0, event.at);
    next.exposed = true;
  } else if (event.kind === "study") {
    outcome = 0.5; // introduction is partial knowledge
    next.exposed = true;
  }

  if (outcome === null) return next;

  const difficultyWeight = event.difficulty ? DIFFICULTY_WEIGHT[event.difficulty] : 1;
  const age = Math.max(0, now - event.at);
  const recencyWeight = age > RECENCY_WINDOW_30D ? 0.5 : age > RECENCY_WINDOW_7D ? 0.8 : 1;
  weight *= difficultyWeight * recencyWeight;

  const scored = (next.scoredItems ?? 0) + weight;
  const prior = (next.score ?? 0) * (next.scoredItems ?? 0);
  next.scoredItems = scored;
  next.score = (prior + outcome * weight) / scored;

  return next;
}

export function aggregateEvidence(events: EvidenceEvent[], now = Date.now()): EvidenceAggregate {
  const empty: EvidenceAggregate = {
    evidenceCount: 0,
    correctCount: 0,
    scoredItems: 0,
    score: null,
    exposed: false,
  };
  const sorted = [...events].sort((a, b) => a.at - b.at);
  return sorted.reduce((agg, event) => foldEvent(agg, event, now), empty);
}

// ============================================================================
// Level derivation
// ============================================================================

export function levelFromAggregate(agg: EvidenceAggregate): Exclude<MasteryLevel, "DECAYING"> {
  if (!agg.exposed && agg.evidenceCount === 0) return "UNKNOWN";
  if (agg.score === null) return agg.evidenceCount > 0 ? "INTRODUCED" : "UNKNOWN";

  const score = agg.score;
  if (score >= 0.9 && agg.evidenceCount >= MIN_EVIDENCE.MASTERED) return "MASTERED";
  if (score >= 0.8 && agg.evidenceCount >= MIN_EVIDENCE.STRONG) return "STRONG";
  if (score >= 0.6 && agg.evidenceCount >= MIN_EVIDENCE.DEVELOPING) return "DEVELOPING";
  if (agg.evidenceCount >= MIN_EVIDENCE.LEARNING) return "LEARNING";
  return "INTRODUCED";
}

/** Apply conservative decay: strong/mastered topics that haven't been revised
 *  recently become DECAYING ("needs refresh"). The underlying score is kept. */
export function applyDecay(
  level: Exclude<MasteryLevel, "DECAYING">,
  lastRevisedAt: number | undefined,
  now = Date.now(),
): { level: MasteryLevel; decayed: boolean; needsRefresh: boolean } {
  if ((level === "STRONG" || level === "MASTERED") && lastRevisedAt !== undefined) {
    const threshold = DECAY_AFTER_DAYS[level] ?? 14;
    const days = Math.max(0, Math.floor((now - lastRevisedAt) / DAY_MS));
    if (days >= threshold) {
      return { level: "DECAYING", decayed: true, needsRefresh: true };
    }
  }
  return { level, decayed: false, needsRefresh: false };
}

// ============================================================================
// Public API
// ============================================================================

export function estimateMastery(
  key: TopicKey,
  events: EvidenceEvent[],
  now = Date.now(),
): MasteryEstimate {
  const agg = aggregateEvidence(events, now);
  const base = levelFromAggregate(agg);
  const { level, decayed, needsRefresh } = applyDecay(base, agg.lastRevisedAt, now);

  return {
    subject: key.subject,
    chapter: key.chapter,
    topic: key.topic,
    level,
    score: agg.score ?? 0,
    evidenceCount: agg.evidenceCount,
    correctCount: agg.correctCount,
    accuracy: agg.scoredItems > 0 && agg.score !== null ? Math.min(1, Math.max(0, agg.score)) : null,
    lastAttemptAt: agg.lastAttemptAt,
    lastRevisedAt: agg.lastRevisedAt,
    daysSinceRevision:
      agg.lastRevisedAt !== undefined ? Math.max(0, Math.floor((now - agg.lastRevisedAt) / DAY_MS)) : null,
    decayed,
    needsRefresh,
  };
}

/**
 * Compute mastery for every distinct topic key present in the evidence.
 * Returns a map keyed by topicId (subject|chapter|topic).
 */
export function estimateAllMastery(
  events: EvidenceEvent[],
  now = Date.now(),
): Map<string, MasteryEstimate> {
  const byKey = new Map<string, EvidenceEvent[]>();
  for (const event of events) {
    const id = [event.subject, event.chapter ?? "", event.topic ?? ""].join("|").toLowerCase().replace(/\s+/g, "-");
    const list = byKey.get(id) ?? [];
    list.push(event);
    byKey.set(id, list);
  }
  const out = new Map<string, MasteryEstimate>();
  for (const [id, list] of byKey) {
    const first = list[0];
    out.set(id, estimateMastery({ subject: first.subject, chapter: first.chapter, topic: first.topic }, list, now));
  }
  return out;
}

/** Roll subject-level estimates up from chapter/topic estimates (subject only). */
export function subjectMastery(estimates: MasteryEstimate[], subject: string): MasteryEstimate | null {
  const relevant = estimates.filter((estimate) => estimate.subject === subject);
  if (!relevant.length) return null;
  const max = (a: MasteryEstimate, b: MasteryEstimate) =>
    (a.evidenceCount >= b.evidenceCount ? a : b);
  return relevant.reduce(max);
}
