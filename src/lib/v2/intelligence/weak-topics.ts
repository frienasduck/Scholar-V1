/**
 * Scholar Intelligence — Weak Topic Radar.
 *
 * Automatically identifies concepts where the student repeatedly struggles,
 * using recency-weighted evidence: recent wrong answers, low accuracy, decay
 * and mistake-book volume. Each weak topic carries a severity and a suggested
 * first action (Revise / Practice / Watch / Ask Tutor / Create Reminder).
 */

import { DAY_MS, type EvidenceEvent, type MistakeRecord, type TopicKey, type WeakTopic } from "./types";
import { aggregateEvidence, estimateMastery } from "./mastery";
import { subjectDisplayName } from "./mistakes";

const RECENT_WINDOW_DAYS = 14;
const WEAK_RECENT_WRONG = 2;
const WEAK_ACCURACY = 0.7;

export interface WeakTopicInput {
  events: EvidenceEvent[];
  mistakes: MistakeRecord[];
  now?: number;
}

export function findWeakTopics(input: WeakTopicInput): WeakTopic[] {
  const now = input.now ?? Date.now();
  const windowStart = now - RECENT_WINDOW_DAYS * DAY_MS;

  // Group attempts per topic key.
  const groups = new Map<string, { key: TopicKey; attempts: number; correct: number; recentWrong: number; lastAttemptAt?: number; lastRevisedAt?: number }>();
  const recentMistakeCount = new Map<string, number>();

  for (const event of input.events) {
    const id = [event.subject, event.chapter ?? "", event.topic ?? ""].join("|").toLowerCase().replace(/\s+/g, "-");
    const group = groups.get(id) ?? {
      key: { subject: event.subject, chapter: event.chapter, topic: event.topic },
      attempts: 0,
      correct: 0,
      recentWrong: 0,
    };
    if (event.kind === "question_result" || event.kind === "practice") {
      group.attempts += 1;
      if (event.correct) group.correct += 1;
      else if (event.at >= windowStart) group.recentWrong += 1;
      if (event.at >= (group.lastAttemptAt ?? 0)) group.lastAttemptAt = event.at;
    } else if (event.kind === "quiz_attempt" && typeof event.score === "number") {
      const total = event.total && event.total > 0 ? event.total : 10;
      const correct = Math.round(Math.min(1, Math.max(0, event.score)) * total);
      group.attempts += total;
      group.correct += correct;
      const wrong = total - correct;
      if (event.at >= windowStart) group.recentWrong += wrong;
      if (event.at >= (group.lastAttemptAt ?? 0)) group.lastAttemptAt = event.at;
    } else if (event.kind === "revision" || event.kind === "study") {
      if (event.at >= (group.lastRevisedAt ?? 0)) group.lastRevisedAt = event.at;
    }
    groups.set(id, group);
  }

  for (const mistake of input.mistakes) {
    if (mistake.resolved || mistake.at < windowStart) continue;
    const id = [mistake.subject, mistake.chapter ?? "", mistake.topic ?? ""].join("|").toLowerCase().replace(/\s+/g, "-");
    recentMistakeCount.set(id, (recentMistakeCount.get(id) ?? 0) + 1);
    const group = groups.get(id);
    if (group) {
      group.recentWrong += 1;
      group.attempts += 1;
      if (!group.lastAttemptAt || mistake.at > group.lastAttemptAt) group.lastAttemptAt = mistake.at;
    } else {
      groups.set(id, {
        key: { subject: mistake.subject, chapter: mistake.chapter, topic: mistake.topic },
        attempts: 1,
        correct: 0,
        recentWrong: 1,
        lastAttemptAt: mistake.at,
      });
    }
  }

  const out: WeakTopic[] = [];
  for (const group of groups.values()) {
    const { key, attempts, correct, recentWrong, lastAttemptAt, lastRevisedAt } = group;
    if (attempts === 0) continue;
    const accuracy = correct / attempts;

    const mastery = estimateMastery(key, input.events, now);

    const isWeak =
      (recentWrong >= WEAK_RECENT_WRONG && accuracy < WEAK_ACCURACY) ||
      (accuracy < 0.5 && attempts >= 2) ||
      mastery.needsRefresh;

    if (!isWeak) continue;

    const severity = recentWrong >= 4 || accuracy < 0.4 ? "severe" : recentWrong >= 3 || accuracy < 0.55 ? "moderate" : "mild";
    const suggestion = suggestAction({ masteryLevel: mastery.level, accuracy, attempts, recentWrong, severity });
    const title = key.topic ?? key.chapter ?? key.subject;

    out.push({
      ...key,
      title,
      attempts,
      correct,
      accuracy,
      recentWrong,
      lastAttemptAt,
      lastRevisedAt,
      masteryLevel: mastery.level,
      severity,
      suggestion,
      suggestionLabel: SUGGESTION_LABELS[suggestion],
    });
  }

  return out.sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.recentWrong - a.recentWrong);
}

const SUGGESTION_LABELS = {
  revise: "Revise",
  practice: "Practice",
  watch: "Watch",
  "ask-tutor": "Ask Tutor",
  "create-reminder": "Create Reminder",
} as const;

function severityRank(severity: WeakTopic["severity"]): number {
  return severity === "severe" ? 3 : severity === "moderate" ? 2 : 1;
}

function suggestAction(input: {
  masteryLevel: string;
  accuracy: number;
  attempts: number;
  recentWrong: number;
  severity: WeakTopic["severity"];
}): WeakTopic["suggestion"] {
  if (input.masteryLevel === "DECAYING") return "revise";
  if (input.severity === "severe") return "create-reminder";
  if (input.attempts < 4) return "watch";
  if (input.accuracy < 0.45) return "ask-tutor";
  return "practice";
}

/** Lightweight derivation used by other engines (mastery rollups, queue). */
export function aggregateForTopic(events: EvidenceEvent[], key: TopicKey, now = Date.now()) {
  return aggregateEvidence(events.filter((event) =>
    event.subject === key.subject
    && (!key.chapter || event.chapter === key.chapter)
    && (!key.topic || event.topic === key.topic)
  ), now);
}

export function topicTitle(key: TopicKey): string {
  return key.topic ?? key.chapter ?? subjectDisplayName(key.subject);
}
