/**
 * Scholar Intelligence — client profile.
 *
 * Derives evidence events from the existing Scholar stores (quiz attempts,
 * revision-hub sessions, quiz mistake book, exam tasks), persists small
 * per-profile intelligence state (resolved mistakes, revision schedules,
 * manual order, weekly baselines) and mirrors evidence to the server
 * (best-effort; the server recomputes authoritatively).
 *
 * This module is client-safe — it never imports server-only code.
 */

import { profileGetJSON, profileSetJSON, type ProfileId } from "@/lib/profile-storage";
import { loadQuizMistakes, type SavedQuizMistake } from "@/lib/quiz-mistakes";
import { useStore, type QuizAttempt, type Task } from "@/lib/store";
import type {
  EvidenceEvent,
  EvidenceSource,
  MistakeRecord,
  MistakeType,
  ReviewRating,
  ReviewSchedule,
} from "./types";
import { classifyMistake } from "./mistakes";
import { nextReview } from "./spaced-repetition";
import { subjectDisplayName } from "./mistakes";

const KEY_EVIDENCE_SYNCED = "intelligence-evidence-synced";
const KEY_RESOLVED_MISTAKES = "intelligence-resolved-mistakes";
const KEY_SCHEDULES = "intelligence-revision-schedules";
const KEY_MANUAL_ORDER = "intelligence-revision-order";
const KEY_WEEK_BASELINE = "intelligence-week-baseline";
const KEY_SYNC_STATE = "intelligence-sync-state";
const KEY_REVIEW_EVENTS = "intelligence-review-events";

// ============================================================================
// Subject normalization (display names → ids)
// ============================================================================

const SUBJECT_ID_BY_NAME: Record<string, string> = {
  physics: "physics",
  chemistry: "chemistry",
  maths: "maths",
  math: "maths",
  mathematics: "maths",
  cs: "cs",
  "computer science": "cs",
  english: "english",
  hindi: "hindi",
  sst: "sst",
  "social science": "sst",
  "social studies": "sst",
  science: "science",
  biology: "science",
  economics: "sst",
};

export function normalizeSubjectId(value: string): string {
  const key = value.trim().toLowerCase();
  return SUBJECT_ID_BY_NAME[key] ?? key;
}

export function subjectIdToName(subject: string): string {
  return subjectDisplayName(subject);
}

// ============================================================================
// Evidence derivation from existing app stores
// ============================================================================

function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ").replace(/[–—]/g, "-").replace(/²/g, "^2");
}

function difficultyFromQuiz(difficulty: QuizAttempt["questions"][number]["difficulty"]): EvidenceEvent["difficulty"] {
  return difficulty === "easy" ? "foundation" : difficulty === "hard" ? "advanced" : "standard";
}

export function quizAttemptToEvents(attempt: QuizAttempt): EvidenceEvent[] {
  const subject = normalizeSubjectId(attempt.subject ?? "general");
  const events: EvidenceEvent[] = [];
  for (const question of attempt.questions) {
    const response = attempt.responses?.[question.id];
    const answered = response !== undefined && response !== null && response !== "";
    const correct = answered && normalizeAnswer(response) === normalizeAnswer(question.answer);
    events.push({
      id: `qa-${attempt.id}-${question.id}`,
      kind: "question_result",
      subject: normalizeSubjectId(question.subject ?? attempt.subject ?? "general"),
      chapter: question.chapter,
      correct,
      difficulty: difficultyFromQuiz(question.difficulty),
      at: attempt.finishedAt || attempt.startedAt,
      source: "quiz",
    });
  }
  if (!events.length && typeof attempt.score === "number") {
    // Attempts without per-question detail (older data) still count as aggregate evidence.
    events.push({
      id: `qa-${attempt.id}`,
      kind: "quiz_attempt",
      subject,
      score: attempt.total > 0 ? attempt.score / attempt.total : 0,
      total: attempt.total,
      at: attempt.finishedAt || attempt.startedAt,
      source: "quiz",
    });
  }
  return events;
}

interface RevisionHubSessionRecord {
  id: string;
  chapterId: string;
  chapterTitle: string;
  subjectName: string;
  remembered: number;
  review: number;
  xp: number;
  at: number;
}

/** Revision-hub completion sessions become "revision" evidence (recency-aware). */
export function revisionSessionsToEvents(records: RevisionHubSessionRecord[]): EvidenceEvent[] {
  return records.map((record) => ({
    id: `rev-${record.id}`,
    kind: "revision",
    subject: normalizeSubjectId(record.subjectName),
    chapter: record.chapterId,
    topic: record.chapterTitle,
    at: record.at,
    source: "revision-hub",
  }));
}

export function deriveEvidence(scholarClass: 9 | 11): EvidenceEvent[] {
  if (typeof window === "undefined") return [];
  const state = useStore.getState();
  const events: EvidenceEvent[] = [];
  for (const attempt of state.quizAttempts ?? []) {
    events.push(...quizAttemptToEvents(attempt));
  }
  const hubRecords = profileGetJSON<RevisionHubSessionRecord[]>(scholarClass, "revision-hub-history", []);
  events.push(...revisionSessionsToEvents(Array.isArray(hubRecords) ? hubRecords : []));
  events.push(...loadReviewEvents(scholarClass));
  return events;
}

// ============================================================================
// Review-confidence events (Active Recall ratings feed mastery evidence)
// ============================================================================

export function loadReviewEvents(scholarClass: 9 | 11): EvidenceEvent[] {
  return profileGetJSON<EvidenceEvent[]>(scholarClass, KEY_REVIEW_EVENTS, []);
}

export function appendReviewEvent(scholarClass: 9 | 11, event: EvidenceEvent): void {
  const events = loadReviewEvents(scholarClass);
  events.push(event);
  profileSetJSON(scholarClass, KEY_REVIEW_EVENTS, events.slice(-400));
}

// ============================================================================
// Mistake book
// ============================================================================

const MISTAKE_TYPE_MAP: Record<string, MistakeType> = {
  "concept mistake": "Concept Error",
  "unit mistake": "Formula Error",
  "sign convention mistake": "Concept Error",
  "graph interpretation mistake": "Reading Error",
  "formula mistake": "Formula Error",
  "mole calculation mistake": "Calculation Error",
  "trend mistake": "Memory Error",
  "calculation mistake": "Calculation Error",
  "condition mistake": "Concept Error",
  "output prediction mistake": "Reading Error",
  "operator mistake": "Formula Error",
  "loop logic mistake": "Concept Error",
  "data type mistake": "Memory Error",
  "syntax mistake": "Concept Error",
};

export function canonicalizeMistakeType(raw: string, fallback: { subject?: string; question?: string; userAnswer?: string; correctAnswer?: string } = {}): MistakeType {
  const key = raw.trim().toLowerCase();
  if (MISTAKE_TYPE_MAP[key]) return MISTAKE_TYPE_MAP[key];
  const known: MistakeType[] = ["Concept Error", "Formula Error", "Calculation Error", "Reading Error", "Guess", "Memory Error", "Other"];
  if (known.includes(raw as MistakeType)) return raw as MistakeType;
  return classifyMistake({
    subject: fallback.subject,
    question: fallback.question ?? "",
    userAnswer: fallback.userAnswer,
    correctAnswer: fallback.correctAnswer,
  });
}

export function quizMistakesToRecords(list: SavedQuizMistake[]): MistakeRecord[] {
  return list.map((mistake) => ({
    id: `qm-${mistake.id}`,
    subject: normalizeSubjectId(mistake.subject),
    chapter: mistake.chapter,
    question: mistake.question,
    userAnswer: mistake.userAnswer,
    correctAnswer: mistake.correctAnswer,
    explanation: mistake.explanation,
    mistakeType: canonicalizeMistakeType(mistake.mistakeType, {
      subject: mistake.subject,
      question: mistake.question,
      userAnswer: mistake.userAnswer,
      correctAnswer: mistake.correctAnswer,
    }),
    originalType: mistake.mistakeType,
    source: (mistake.source as EvidenceSource) ?? "quiz",
    resolved: false,
    at: mistake.savedAt,
  }));
}

export function deriveMistakes(scholarClass: 9 | 11): MistakeRecord[] {
  if (typeof window === "undefined") return [];
  const records = quizMistakesToRecords(loadQuizMistakes(scholarClass));
  const resolvedIds = new Set(loadResolvedMistakeIds(scholarClass));
  return records.map((record) => ({
    ...record,
    resolved: resolvedIds.has(record.id),
    resolvedAt: resolvedIds.has(record.id) ? record.at : undefined,
  }));
}

export function loadResolvedMistakeIds(scholarClass: 9 | 11): string[] {
  return profileGetJSON<string[]>(scholarClass, KEY_RESOLVED_MISTAKES, []);
}

export function resolveMistake(scholarClass: 9 | 11, mistakeId: string, resolved: boolean): string[] {
  const ids = new Set(loadResolvedMistakeIds(scholarClass));
  if (resolved) ids.add(mistakeId);
  else ids.delete(mistakeId);
  const next = [...ids];
  profileSetJSON(scholarClass, KEY_RESOLVED_MISTAKES, next);
  return next;
}

// ============================================================================
// Exams (from planner tasks + exam reminders)
// ============================================================================

export interface ExamDraft {
  id: string;
  title: string;
  subject?: string;
  date: number;
}

export function deriveExams(scholarClass: 9 | 11, now = Date.now()): ExamDraft[] {
  if (typeof window === "undefined") return [];
  const state = useStore.getState();
  const exams: ExamDraft[] = [];
  for (const task of state.tasks ?? []) {
    if (task.type !== "exam" || task.done) continue;
    const date = parseDate(task.date);
    if (!date || date < now - 86_400_000) continue;
    exams.push({
      id: `task-${task.id}`,
      title: task.title,
      subject: task.subject ? normalizeSubjectId(task.subject) : undefined,
      date,
    });
  }
  return exams;
}

function parseDate(value: string): number | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

// ============================================================================
// Study progress (for exam syllabus coverage)
// ============================================================================

export function deriveStudyProgress(): Record<string, number> {
  if (typeof window === "undefined") return {};
  return useStore.getState().studyProgress ?? {};
}

// ============================================================================
// Revision schedules + manual order (persisted per profile)
// ============================================================================

export type ScheduleMap = Record<string, ReviewSchedule>;

export function loadSchedules(scholarClass: 9 | 11): ScheduleMap {
  return profileGetJSON<ScheduleMap>(scholarClass, KEY_SCHEDULES, {});
}

export function saveSchedules(scholarClass: 9 | 11, schedules: ScheduleMap): void {
  profileSetJSON(scholarClass, KEY_SCHEDULES, schedules);
}

export function recordReview(
  scholarClass: 9 | 11,
  itemId: string,
  rating: ReviewRating,
  now = Date.now(),
): ReviewSchedule {
  const schedules = loadSchedules(scholarClass);
  const current: ReviewSchedule = schedules[itemId] ?? {
    state: "NEW",
    intervalDays: 0,
    ease: 2.5,
    dueAt: now,
    reviewCount: 0,
    lapses: 0,
  };
  const next = nextReview(current, rating, now);
  schedules[itemId] = next;
  saveSchedules(scholarClass, schedules);
  return next;
}

/** Record a review rating AND feed a confidence evidence event into mastery. */
export function recordReviewWithEvidence(
  scholarClass: 9 | 11,
  input: { itemId: string; rating: ReviewRating; subject: string; chapter?: string; topic?: string },
  now = Date.now(),
): ReviewSchedule {
  const next = recordReview(scholarClass, input.itemId, input.rating, now);
  const ratingValue: 1 | 2 | 3 | 4 = input.rating === "again" ? 1 : input.rating === "hard" ? 2 : input.rating === "good" ? 3 : 4;
  appendReviewEvent(scholarClass, {
    id: `conf-${input.itemId}-${now}`,
    kind: "confidence",
    subject: normalizeSubjectId(input.subject),
    chapter: input.chapter,
    topic: input.topic,
    rating: ratingValue,
    at: now,
    source: "revision-hub",
  });
  return next;
}

export function loadManualOrder(scholarClass: 9 | 11): string[] {
  return profileGetJSON<string[]>(scholarClass, KEY_MANUAL_ORDER, []);
}

export function saveManualOrder(scholarClass: 9 | 11, order: string[]): void {
  profileSetJSON(scholarClass, KEY_MANUAL_ORDER, order);
}

// ============================================================================
// Weekly baselines (for mastery movement)
// ============================================================================

export interface WeekBaseline {
  weekStart: string;
  subjectScores: Record<string, number>;
  takenAt: number;
}

export function weekStartFor(now = Date.now()): string {
  const date = new Date(now);
  const day = date.getDay();
  const diff = (day + 6) % 7; // Monday start
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - diff);
  return date.toISOString();
}

export function loadWeekBaseline(scholarClass: 9 | 11): WeekBaseline | null {
  const baseline = profileGetJSON<WeekBaseline | null>(scholarClass, KEY_WEEK_BASELINE, null);
  return baseline && typeof baseline === "object" && baseline.weekStart ? baseline : null;
}

export function saveWeekBaseline(scholarClass: 9 | 11, baseline: WeekBaseline): void {
  profileSetJSON(scholarClass, KEY_WEEK_BASELINE, baseline);
}

/** Roll subject-level scores from mastery estimates for snapshotting. */
export function subjectScoresFromMastery(estimates: Array<{ subject: string; score: number }>): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const estimate of estimates) {
    scores[estimate.subject] = Math.max(scores[estimate.subject] ?? 0, Math.round(estimate.score * 100));
  }
  return scores;
}

// ============================================================================
// Server sync (best-effort)
// ============================================================================

export type SyncState = "idle" | "syncing" | "synced" | "offline" | "guest";

export function loadSyncState(scholarClass: 9 | 11): SyncState {
  return profileGetJSON<SyncState>(scholarClass, KEY_SYNC_STATE, "idle");
}

export function saveSyncState(scholarClass: 9 | 11, state: SyncState): void {
  profileSetJSON(scholarClass, KEY_SYNC_STATE, state);
}

/** Returns true when a Scholar account session exists (server-checked). */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const response = await fetch("/api/v2/entitlements", { cache: "no-store" });
    if (!response.ok) return false;
    const data = (await response.json()) as { authenticated?: boolean };
    return Boolean(data.authenticated);
  } catch {
    return false;
  }
}

/**
 * Mirror derived evidence + mistakes to the server. Never blocks the UI;
 * failures degrade to the local (offline) experience.
 */
export async function syncEvidence(scholarClass: 9 | 11): Promise<SyncState> {
  saveSyncState(scholarClass, "syncing");
  try {
    const authed = await isAuthenticated();
    if (!authed) {
      saveSyncState(scholarClass, "guest");
      return "guest";
    }
    const events = deriveEvidence(scholarClass).slice(-200);
    const mistakes = deriveMistakes(scholarClass).slice(0, 200);
    const response = await fetch("/api/v2/intelligence/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events, mistakes }),
    });
    if (!response.ok) {
      saveSyncState(scholarClass, "offline");
      return "offline";
    }
    profileSetJSON(scholarClass, KEY_EVIDENCE_SYNCED, { at: Date.now(), events: events.length, mistakes: mistakes.length });
    saveSyncState(scholarClass, "synced");
    return "synced";
  } catch {
    saveSyncState(scholarClass, "offline");
    return "offline";
  }
}

export function loadLastSync(scholarClass: 9 | 11): { at: number; events: number; mistakes: number } | null {
  return profileGetJSON(scholarClass, KEY_EVIDENCE_SYNCED, null);
}

/** Derive a profile id for storage keys. */
export function profileIdFor(scholarClass: 9 | 11): ProfileId {
  return scholarClass === 11 ? "class11" : "class9";
}
