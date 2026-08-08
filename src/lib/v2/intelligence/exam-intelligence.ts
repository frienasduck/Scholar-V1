/**
 * Scholar Intelligence — Exam Intelligence.
 *
 * For every upcoming exam: days remaining, syllabus coverage, revision
 * completion, weak chapters, practice completed and a Preparedness ESTIMATE.
 *
 * Hard rules:
 *  - No fake guarantees ("95% guaranteed score" is forbidden).
 *  - Preparedness is a labelled estimate derived from real Scholar data and
 *    is null until there is enough evidence to say something honest.
 *  - CRASH MODE compresses revision into Must Do / Should Do / Optional for
 *    exams very soon.
 */

import { DAY_MS, type CrashModePlan, type EvidenceEvent, type ExamInsight, type MasteryEstimate } from "./types";

export interface ExamInput {
  /** Exams with epoch-ms dates. */
  exams: Array<{ id: string; title: string; subject?: string; date: number }>;
  mastery: MasteryEstimate[];
  /** chapterId → 0..100 progress. */
  studyProgress: Record<string, number>;
  evidence: EvidenceEvent[];
  now?: number;
  /** CRASH MODE activation window in days (default 3). */
  crashWindowDays?: number;
}

const COVERAGE_WEIGHT = 0.4;
const REVISION_WEIGHT = 0.3;
const PRACTICE_WEIGHT = 0.2;
const WEAK_WEIGHT = 0.1;
const PRACTICE_TARGET_QUESTIONS = 50;

export function examIntelligence(input: ExamInput): ExamInsight[] {
  const now = input.now ?? Date.now();
  const crashWindow = input.crashWindowDays ?? 3;

  return input.exams
    .map((exam) => buildInsight(exam, input, now, crashWindow))
    .sort((a, b) => a.date - b.date);
}

function buildInsight(exam: ExamInput["exams"][number], input: ExamInput, now: number, crashWindow: number): ExamInsight {
  const daysRemaining = Math.max(0, Math.ceil((exam.date - now) / DAY_MS));

  const subjectEvidence = input.evidence.filter((event) =>
    !exam.subject || event.subject.toLowerCase() === (exam.subject ?? "").toLowerCase()
  );
  const subjectMastery = input.mastery.filter((estimate) =>
    !exam.subject || estimate.subject.toLowerCase() === (exam.subject ?? "").toLowerCase()
  );

  // Syllabus coverage — mean chapter progress for the subject.
  const progressValues = Object.values(input.studyProgress);
  const syllabusCoverage = progressValues.length
    ? progressValues.reduce((sum, value) => sum + clamp01(value / 100), 0) / progressValues.length
    : null;

  // Revision completion — fraction of subject topics revised recently (≤14d) or strong+.
  const revised = subjectMastery.filter((estimate) => {
    if (estimate.lastRevisedAt !== undefined && now - estimate.lastRevisedAt <= 14 * DAY_MS) return true;
    return estimate.level === "STRONG" || estimate.level === "MASTERED";
  });
  const revisionCompletion = subjectMastery.length ? revised.length / subjectMastery.length : null;

  const weakChapters = [...new Set(subjectMastery
    .filter((estimate) => estimate.needsRefresh || (estimate.accuracy !== null && estimate.accuracy < 0.6))
    .map((estimate) => estimate.chapter ?? estimate.topic ?? estimate.subject)
    .filter(Boolean))];

  const practice = practiceStats(subjectEvidence);

  const preparedness = estimatePreparedness({
    syllabusCoverage,
    revisionCompletion,
    practice,
    weakChapters,
    evidenceCount: subjectEvidence.length,
  });

  const crashMode = daysRemaining <= crashWindow
    ? crashPlan({ daysRemaining, weakChapters, syllabusCoverage, revisionCompletion, subjectMastery, subjectEvidence, now })
    : undefined;

  return {
    id: exam.id,
    title: exam.title,
    subject: exam.subject,
    date: exam.date,
    daysRemaining,
    syllabusCoverage,
    revisionCompletion,
    weakChapters: weakChapters.slice(0, 5),
    practice,
    preparedness,
    crashMode,
  };
}

function practiceStats(evidence: EvidenceEvent[]) {
  let attempts = 0;
  let questions = 0;
  let correct = 0;
  for (const event of evidence) {
    if (event.kind === "question_result" || event.kind === "practice") {
      attempts += 1;
      questions += 1;
      if (event.correct) correct += 1;
    } else if (event.kind === "quiz_attempt" && typeof event.score === "number") {
      const total = event.total && event.total > 0 ? event.total : 10;
      attempts += 1;
      questions += total;
      correct += Math.round(Math.min(1, Math.max(0, event.score)) * total);
    }
  }
  return {
    attempts,
    questions,
    accuracy: attempts ? correct / questions : null,
  };
}

function estimatePreparedness(input: {
  syllabusCoverage: number | null;
  revisionCompletion: number | null;
  practice: { questions: number; accuracy: number | null };
  weakChapters: string[];
  evidenceCount: number;
}): number | null {
  if (input.evidenceCount < 3) return null;
  const coverage = input.syllabusCoverage ?? 0;
  const revision = input.revisionCompletion ?? 0;
  const practice = Math.min(1, input.practice.questions / PRACTICE_TARGET_QUESTIONS);
  const weakPenalty = input.weakChapters.length ? Math.min(0.5, input.weakChapters.length * 0.1) : 0;
  const raw =
    coverage * COVERAGE_WEIGHT
    + revision * REVISION_WEIGHT
    + practice * PRACTICE_WEIGHT
    + (1 - weakPenalty) * WEAK_WEIGHT;
  return Math.min(100, Math.max(0, Math.round(raw * 100 / 5) * 5));
}

function crashPlan(input: {
  daysRemaining: number;
  weakChapters: string[];
  syllabusCoverage: number | null;
  revisionCompletion: number | null;
  subjectMastery: MasteryEstimate[];
  subjectEvidence: EvidenceEvent[];
  now: number;
}): CrashModePlan {
  const mustDo: string[] = [];
  const shouldDo: string[] = [];
  const optional: string[] = [];

  const decaying = input.subjectMastery.filter((estimate) => estimate.needsRefresh);
  mustDo.push(...input.weakChapters.slice(0, 3));
  mustDo.push(...decaying.slice(0, 2).map((estimate) => `Refresh ${estimate.chapter ?? estimate.topic ?? estimate.subject}`));

  const unrevised = input.subjectMastery
    .filter((estimate) => !estimate.needsRefresh && estimate.lastRevisedAt !== undefined)
    .filter((estimate) => estimate.lastRevisedAt !== undefined && input.now - estimate.lastRevisedAt! > input.daysRemaining * DAY_MS)
    .map((estimate) => estimate.chapter ?? estimate.topic ?? estimate.subject)
    .filter(Boolean);
  shouldDo.push(...unrevised.slice(0, 4));

  if (input.syllabusCoverage !== null && input.syllabusCoverage < 0.5) {
    shouldDo.push("Cover remaining syllabus with a skim-read + notes");
  }

  optional.push("Review formulas and key definitions (20 min)");
  optional.push("One past-paper question set under exam timing");
  optional.push(input.daysRemaining <= 1 ? "Sleep well — rest is part of preparation" : "Light practice on your strongest chapter");

  return {
    active: true,
    mustDo: dedupe(mustDo).slice(0, 5),
    shouldDo: dedupe(shouldDo).slice(0, 4),
    optional: dedupe(optional).slice(0, 3),
    availableDays: input.daysRemaining,
  };
}

function dedupe(list: string[]): string[] {
  return [...new Set(list.filter(Boolean))];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
