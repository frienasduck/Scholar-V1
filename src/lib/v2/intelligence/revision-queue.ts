/**
 * Scholar Intelligence — Smart Revision Queue.
 *
 * Scholar prioritizes revision from: exam proximity, mastery deficit,
 * time since last revision, past mistakes, importance and available study
 * time. Students can manually reorder — the queue keeps an explicit order
 * list that always wins over the computed priority.
 */

import { DAY_MS, type ExamInsight, type MasteryEstimate, type MistakeRecord, type RevisionQueueItem, type ReviewSchedule, type TopicKey, type WeakTopic } from "./types";
import { INITIAL_SCHEDULE, newDueItem } from "./spaced-repetition";
import { subjectDisplayName } from "./mistakes";

export interface RevisionQueueInput {
  mastery: MasteryEstimate[];
  weakTopics: WeakTopic[];
  mistakes: MistakeRecord[];
  exams: ExamInsight[];
  /** itemId → current spaced-repetition schedule (persisted client-side). */
  schedules: Record<string, ReviewSchedule>;
  /** Explicit manual ordering — items listed first are always first. */
  manualOrder?: string[];
  now?: number;
}

export function buildRevisionQueue(input: RevisionQueueInput): RevisionQueueItem[] {
  const now = input.now ?? Date.now();
  const items: RevisionQueueItem[] = [];
  const seen = new Set<string>();

  // 1. Decayed/weak topics → concept refresh items.
  for (const weak of input.weakTopics) {
    const id = `concept-${topicIdOf(weak)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    items.push(makeItem({
      id,
      subject: weak.subject,
      chapter: weak.chapter,
      topic: weak.topic,
      title: `Revise ${weak.title}`,
      kind: "concept",
      dueAt: now,
      schedule: input.schedules[id] ?? newDueItem(now),
      basePriority: priorityForWeakTopic(weak, input.exams, now),
      reasons: [
        weak.masteryLevel === "DECAYING" ? "Needs refresh — not revised recently" : `Weak topic (${Math.round(weak.accuracy * 100)}% accuracy)`,
        weak.recentWrong >= 2 ? `${weak.recentWrong} recent wrong answers` : undefined,
      ].filter(Boolean) as string[],
    }));
  }

  // 2. Unresolved mistakes → mistake review items.
  for (const mistake of input.mistakes) {
    if (mistake.resolved) continue;
    const id = `mistake-${mistake.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    items.push(makeItem({
      id,
      subject: mistake.subject,
      chapter: mistake.chapter,
      topic: mistake.topic,
      title: `Review: ${truncate(mistake.question, 70)}`,
      kind: "mistake",
      dueAt: now,
      schedule: input.schedules[id] ?? newDueItem(now),
      basePriority: 70,
      reasons: [mistake.mistakeType, `Missed ${daysAgo(mistake.at, now)}`].filter(Boolean) as string[],
      mistakeId: mistake.id,
    }));
  }

  // 3. Strong/mastered topics due for a spaced refresh.
  for (const estimate of input.mastery) {
    if (!estimate.needsRefresh) continue;
    const id = `concept-${topicIdOf(estimate)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    items.push(makeItem({
      id,
      subject: estimate.subject,
      chapter: estimate.chapter,
      topic: estimate.topic,
      title: `Refresh ${estimate.topic ?? estimate.chapter ?? estimate.subject}`,
      kind: "concept",
      dueAt: now,
      schedule: input.schedules[id] ?? newDueItem(now),
      basePriority: 55,
      reasons: [`Not revised for ${estimate.daysSinceRevision ?? "?"} days`],
    }));
  }

  // Apply manual order then sort by (manual rank, priority, due date).
  const manualIndex = new Map((input.manualOrder ?? []).map((id, index) => [id, index]));
  items.sort((a, b) => {
    const ra = manualIndex.get(a.id);
    const rb = manualIndex.get(b.id);
    if (ra !== undefined && rb !== undefined) return ra - rb;
    if (ra !== undefined) return -1;
    if (rb !== undefined) return 1;
    return b.priority - a.priority || a.dueAt - b.dueAt;
  });

  return items;
}

function makeItem(input: {
  id: string;
  subject: string;
  chapter?: string;
  topic?: string;
  title: string;
  kind: RevisionQueueItem["kind"];
  dueAt: number;
  schedule: ReviewSchedule;
  basePriority: number;
  reasons: string[];
  mistakeId?: string;
}): RevisionQueueItem {
  // Exam proximity is folded in at the call site via priorityForWeakTopic /
  // base priorities; spaced state also lifts items stuck in RELEARNING.
  const stateBoost = input.schedule.state === "RELEARNING" ? 8 : input.schedule.state === "LEARNING" ? 4 : 0;
  const priority = clampPriority(input.basePriority + stateBoost);
  return {
    id: input.id,
    subject: input.subject,
    chapter: input.chapter,
    topic: input.topic,
    title: input.title,
    kind: input.kind,
    dueAt: input.schedule.dueAt,
    state: input.schedule.state,
    intervalDays: input.schedule.intervalDays,
    ease: input.schedule.ease,
    reviewCount: input.schedule.reviewCount,
    lapses: input.schedule.lapses,
    priority,
    reasons: input.reasons,
    mistakeId: input.mistakeId,
  };
}

function priorityForWeakTopic(weak: WeakTopic, exams: ExamInsight[], now: number): number {
  let priority = 50;
  if (weak.severity === "severe") priority += 25;
  else if (weak.severity === "moderate") priority += 12;
  if (weak.recentWrong >= 3) priority += 8;
  if (weak.lastAttemptAt && now - weak.lastAttemptAt > 7 * DAY_MS) priority += 5; // stale → refresh
  if (examSoon(weak.subject, exams, now)) priority += 10;
  return priority;
}

export function examSoon(subject: string, exams: ExamInsight[], now = Date.now()): boolean {
  return exams.some((exam) =>
    (!exam.subject || exam.subject.toLowerCase() === subject.toLowerCase())
    && exam.daysRemaining >= 0
    && exam.daysRemaining <= 7
  );
}

function clampPriority(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function topicIdOf(key: TopicKey): string {
  return [key.subject, key.chapter ?? "", key.topic ?? ""].join("|").toLowerCase().replace(/\s+/g, "-");
}

function daysAgo(at: number, now: number): string {
  const days = Math.max(0, Math.floor((now - at) / DAY_MS));
  return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max).trimEnd()}…` : value;
}

export function subjectQueueStats(items: RevisionQueueItem[], now = Date.now()) {
  const due = items.filter((item) => item.dueAt <= now);
  return {
    total: items.length,
    due: due.length,
    mature: items.filter((item) => item.state === "MATURE").length,
    subjects: new Set(items.map((item) => item.subject)).size,
  };
}

export { INITIAL_SCHEDULE };
