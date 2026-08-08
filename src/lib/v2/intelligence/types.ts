/**
 * Scholar V2.1 — Scholar Intelligence shared types.
 *
 * The intelligence layer is a pure, evidence-based academic model:
 *   evidence events (quiz results, practice, mistakes, revisions,
 *   confidence ratings) → mastery estimates, weak topics, mistake
 *   patterns, revision queue, exam intelligence, daily briefs.
 *
 * Nothing here imports React or server-only modules so the whole core is
 * unit-testable and usable from both client (local derivation) and server
 * (authoritative computation over DB rows).
 */

export type MasteryLevel =
  | "UNKNOWN"
  | "INTRODUCED"
  | "LEARNING"
  | "DEVELOPING"
  | "STRONG"
  | "MASTERED"
  | "DECAYING";

export type SpacedState = "NEW" | "LEARNING" | "REVIEW" | "MATURE" | "RELEARNING";

/** Active Recall / review rating (Again, Hard, Good, Easy). */
export type ReviewRating = "again" | "hard" | "good" | "easy";

export type MistakeType =
  | "Concept Error"
  | "Formula Error"
  | "Calculation Error"
  | "Reading Error"
  | "Guess"
  | "Memory Error"
  | "Other";

export type EvidenceKind =
  | "quiz_attempt" // whole-quiz result (score, total)
  | "question_result" // single-question correctness
  | "practice" // single practice attempt (correct/incorrect)
  | "mistake" // a mistake was recorded
  | "revision" // a topic/chapter was revised
  | "confidence" // confidence/recall rating 1..4
  | "study"; // chapter studied (introduction)

export type DifficultyLevel = "foundation" | "standard" | "advanced" | "challenge";

export type EvidenceSource =
  | "quiz"
  | "practice"
  | "ai-tutor"
  | "assignment"
  | "exam-sim"
  | "revision-hub"
  | "flashcards"
  | "notes"
  | "manual";

export interface EvidenceEvent {
  id: string;
  kind: EvidenceKind;
  subject: string;
  chapter?: string;
  topic?: string;
  /** Correctness for question_result / practice. */
  correct?: boolean;
  /** 0..1 normalized score for quiz_attempt. */
  score?: number;
  /** Question count for quiz_attempt. */
  total?: number;
  difficulty?: DifficultyLevel;
  /** 1=again … 4=easy for confidence/recall ratings. */
  rating?: 1 | 2 | 3 | 4;
  /** Epoch ms. */
  at: number;
  source?: EvidenceSource;
}

/** A topic identity — subject is required, chapter/topic optional (subject-level rollup). */
export interface TopicKey {
  subject: string;
  chapter?: string;
  topic?: string;
}

export interface MasteryEstimate {
  subject: string;
  chapter?: string;
  topic?: string;
  level: MasteryLevel;
  /** 0..1 recency-weighted estimate. Never presented as exact. */
  score: number;
  evidenceCount: number;
  correctCount: number;
  accuracy: number | null;
  lastAttemptAt?: number;
  lastRevisedAt?: number;
  daysSinceRevision: number | null;
  decayed: boolean;
  needsRefresh: boolean;
}

export interface MistakeRecord {
  id: string;
  subject: string;
  chapter?: string;
  topic?: string;
  question: string;
  userAnswer?: string;
  correctAnswer?: string;
  explanation?: string;
  mistakeType: MistakeType;
  /** Original label from the source (e.g. "Unit mistake"). */
  originalType?: string;
  source: EvidenceSource;
  resolved: boolean;
  resolvedAt?: number;
  at: number;
}

export interface MistakePattern {
  id: string;
  subject: string;
  mistakeType: MistakeType;
  count: number;
  windowDays: number;
  detail: string;
  insight: string;
  severity: "mild" | "moderate" | "severe";
}

export interface WeakTopic {
  subject: string;
  chapter?: string;
  topic?: string;
  title: string;
  attempts: number;
  correct: number;
  accuracy: number;
  recentWrong: number;
  lastAttemptAt?: number;
  lastRevisedAt?: number;
  masteryLevel: MasteryLevel;
  severity: "mild" | "moderate" | "severe";
  /** Suggested first action from the radar. */
  suggestion: "revise" | "practice" | "watch" | "ask-tutor" | "create-reminder";
  suggestionLabel: string;
}

export interface ReviewSchedule {
  state: SpacedState;
  intervalDays: number;
  ease: number;
  dueAt: number;
  reviewCount: number;
  lapses: number;
}

export interface RevisionQueueItem {
  id: string;
  subject: string;
  chapter?: string;
  topic?: string;
  title: string;
  kind: "concept" | "mistake" | "flashcard" | "formula" | "question";
  dueAt: number;
  state: SpacedState;
  intervalDays: number;
  ease: number;
  reviewCount: number;
  lapses: number;
  /** 0..100 priority score. */
  priority: number;
  reasons: string[];
  /** Link to an underlying mistake when kind === "mistake". */
  mistakeId?: string;
}

export interface ExamInsight {
  id: string;
  title: string;
  subject?: string;
  date: number;
  daysRemaining: number;
  /** 0..1 fraction of the subject syllabus covered. */
  syllabusCoverage: number | null;
  /** 0..1 fraction of chapters revised recently. */
  revisionCompletion: number | null;
  weakChapters: string[];
  practice: { attempts: number; questions: number; accuracy: number | null };
  /** 0..100 estimate — labelled as an estimate, never a guarantee. */
  preparedness: number | null;
  crashMode?: CrashModePlan;
}

export interface CrashModePlan {
  active: boolean;
  mustDo: string[];
  shouldDo: string[];
  optional: string[];
  availableDays: number;
}

export interface DailyBriefItem {
  kind: "assignment" | "exam" | "weak" | "revision-due" | "focus" | "stats";
  text: string;
  severity?: "info" | "warning" | "urgent";
  action?: { view: string; label: string };
}

export interface DailyBrief {
  date: string;
  items: DailyBriefItem[];
}

export interface WeeklyReport {
  weekStart: string;
  studyMinutes: number;
  subjectsStudied: string[];
  questionsAttempted: number;
  accuracy: number | null;
  masteryMovement: Array<{ subject: string; from: number | null; to: number | null }>;
  mostImprovedChapter: string | null;
  weakestTopic: string | null;
  revisionDays: number;
  consistency: number; // 0..1 days with revision/study ÷ 7
  hasBaseline: boolean;
}

/** Week snapshot stored per profile so movement can be measured. */
export interface MasterySnapshot {
  weekStart: string;
  subjectScores: Record<string, number>;
  takenAt: number;
}

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;
export const MINUTE_MS = 60_000;

export function topicLabel(key: TopicKey): string {
  return key.topic ?? key.chapter ?? key.subject;
}

export function topicId(key: TopicKey): string {
  return [key.subject, key.chapter ?? "", key.topic ?? ""].join("|").toLowerCase().replace(/\s+/g, "-");
}
