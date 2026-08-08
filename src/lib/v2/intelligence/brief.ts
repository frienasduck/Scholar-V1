/**
 * Scholar Intelligence — Daily Academic Brief ("Today with Scholar") and
 * Weekly Learning Report. Both are generated from REAL Scholar data only —
 * never invented. All figures are hedged estimates where they are estimates.
 */

import { DAY_MS, type DailyBrief, type DailyBriefItem, type EvidenceEvent, type MasteryEstimate, type MistakeRecord, type RevisionQueueItem, type WeeklyReport, type WeakTopic } from "./types";
import { subjectDisplayName } from "./mistakes";

// ============================================================================
// Daily brief
// ============================================================================

export interface BriefInput {
  /** Due/undone assignments with dates (epoch ms). */
  assignments: Array<{ title: string; dueAt: number }>;
  /** Upcoming exams (epoch ms). */
  exams: Array<{ title: string; date: number }>;
  weakTopics: WeakTopic[];
  revisionQueue: RevisionQueueItem[];
  /** Focus sessions completed today (minutes). */
  studyMinutesToday: number;
  now?: number;
}

export function buildDailyBrief(input: BriefInput): DailyBrief {
  const now = input.now ?? Date.now();
  const items: DailyBriefItem[] = [];
  const todayStart = startOfDay(now);

  const assignmentsToday = input.assignments.filter((assignment) => assignment.dueAt >= todayStart && assignment.dueAt < todayStart + DAY_MS);
  const assignmentsSoon = input.assignments.filter((assignment) => assignment.dueAt >= todayStart && assignment.dueAt < todayStart + 2 * DAY_MS);

  if (assignmentsToday.length) {
    items.push({
      kind: "assignment",
      severity: "urgent",
      text: `${assignmentsToday.length} assignment${assignmentsToday.length > 1 ? "s" : ""} due today${assignmentsToday.length === 1 ? `: ${assignmentsToday[0].title}` : ""}`,
      action: { view: "assignments", label: "Open" },
    });
  } else if (assignmentsSoon.length) {
    items.push({
      kind: "assignment",
      severity: "warning",
      text: `${assignmentsSoon.length} assignment${assignmentsSoon.length > 1 ? "s" : ""} due by tomorrow`,
      action: { view: "assignments", label: "Open" },
    });
  }

  const nextExam = input.exams
    .filter((exam) => exam.date >= todayStart)
    .sort((a, b) => a.date - b.date)[0];
  if (nextExam) {
    const days = Math.max(0, Math.ceil((nextExam.date - now) / DAY_MS));
    items.push({
      kind: "exam",
      severity: days <= 3 ? "urgent" : "warning",
      text: days === 0
        ? `${nextExam.title} is today`
        : days === 1
          ? `${nextExam.title} is tomorrow`
          : `${nextExam.title} is in ${days} days`,
      action: { view: "exam-prep", label: "Prepare" },
    });
  }

  const weak = input.weakTopics.slice(0, 3);
  if (weak.length) {
    items.push({
      kind: "weak",
      severity: "warning",
      text: `${weak.length} weak topic${weak.length > 1 ? "s" : ""} need${weak.length > 1 ? "" : "s"} revision: ${weak.map((topic) => topic.title).join(", ")}`,
      action: { view: "revision-hub", label: "Revise" },
    });
  }

  const dueNow = input.revisionQueue.filter((item) => item.dueAt <= now);
  if (dueNow.length) {
    items.push({
      kind: "revision-due",
      severity: "info",
      text: `${dueNow.length} revision item${dueNow.length > 1 ? "s" : ""} due today`,
      action: { view: "revision-hub", label: "Review" },
    });
  }

  if (input.studyMinutesToday === 0 && (dueNow.length || weak.length)) {
    items.push({
      kind: "focus",
      severity: "info",
      text: "No focus time yet today — a 45-minute session is recommended",
      action: { view: "focus", label: "Start" },
    });
  }

  if (!items.length) {
    items.push({
      kind: "stats",
      severity: "info",
      text: "A calm day — everything is on track. Enjoy the space or get ahead.",
    });
  }

  return { date: new Date(todayStart).toISOString(), items };
}

function startOfDay(date: number): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ============================================================================
// Weekly report
// ============================================================================

export interface WeeklyReportInput {
  evidence: EvidenceEvent[];
  mistakes: MistakeRecord[];
  mastery: MasteryEstimate[];
  /** Subject-level snapshot from 7 days ago (null when no baseline yet). */
  baseline: Record<string, number> | null;
  weekStart: number;
  now?: number;
}

export function buildWeeklyReport(input: WeeklyReportInput): WeeklyReport {
  const now = input.now ?? Date.now();
  const weekStart = input.weekStart;
  const weekAgo = now - 7 * DAY_MS;

  const weekEvidence = input.evidence.filter((event) => event.at >= weekAgo);
  const weekMistakes = input.mistakes.filter((mistake) => mistake.at >= weekAgo);

  const sessionEvents = weekEvidence.filter((event) => event.kind === "study" || event.kind === "revision");
  const studyMinutes = sessionEvents.length * 25; // conservative proxy: one block ≈ one session

  const subjects = new Set(weekEvidence.map((event) => event.subject));
  const mostImproved: { title: string; delta: number } | null = null;

  let questions = 0;
  let correct = 0;
  for (const event of weekEvidence) {
    if (event.kind === "question_result" || event.kind === "practice") {
      questions += 1;
      if (event.correct) correct += 1;
    } else if (event.kind === "quiz_attempt" && typeof event.score === "number") {
      const total = event.total && event.total > 0 ? event.total : 10;
      questions += total;
      correct += Math.round(Math.min(1, Math.max(0, event.score)) * total);
    }
  }

  // Mastery movement vs baseline (subjectScores rolled from current estimates).
  const subjectScores = input.mastery.reduce<Record<string, number>>((acc, estimate) => {
    acc[estimate.subject] = Math.max(acc[estimate.subject] ?? 0, Math.round(estimate.score * 100));
    return acc;
  }, {});
  const movement = input.mastery
    .filter((estimate) => subjects.has(estimate.subject))
    .map((estimate) => ({
      subject: estimate.subject,
      from: input.baseline ? input.baseline[estimate.subject] ?? null : null,
      to: subjectScores[estimate.subject] ?? null,
    }))
    .filter((entry) => entry.from !== null && entry.to !== null);

  const improved = movement
    .map((entry) => ({ subject: entry.subject, delta: (entry.to ?? 0) - (entry.from ?? 0) }))
    .sort((a, b) => b.delta - a.delta)[0];

  const weakest = input.mastery
    .filter((estimate) => estimate.evidenceCount >= 2)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];

  const revisionDays = new Set(
    input.evidence
      .filter((event) => event.kind === "revision" && event.at >= weekAgo)
      .map((event) => new Date(event.at).toDateString()),
  ).size;

  return {
    weekStart: new Date(weekStart).toISOString(),
    studyMinutes,
    subjectsStudied: [...subjects].sort(),
    questionsAttempted: questions,
    accuracy: questions ? correct / questions : null,
    masteryMovement: movement.slice(0, 6),
    mostImprovedChapter: improved && improved.delta > 0 ? improved.subject : null,
    weakestTopic: weakest ? weakest.topic ?? weakest.chapter ?? weakest.subject : null,
    revisionDays,
    consistency: Math.min(1, revisionDays / 7),
    hasBaseline: input.baseline !== null,
  };
}

export function briefText(item: DailyBriefItem): string {
  return item.text;
}

export function subjectName(subject: string): string {
  return subjectDisplayName(subject);
}
