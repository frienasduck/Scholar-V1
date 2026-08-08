/**
 * Scholar Intelligence — Personal Mistake Book.
 *
 * Collects wrong answers from quizzes, practice, AI Tutor, assignments and
 * exam-prep sessions. Classifies each mistake into a conservative taxonomy
 * and analyzes patterns with hedged language ("Scholar noticed a possible
 * pattern…") — never overclaims certainty.
 */

import { DAY_MS, type EvidenceEvent, type MistakePattern, type MistakeRecord, type MistakeType } from "./types";

export const MISTAKE_TYPES: MistakeType[] = [
  "Concept Error",
  "Formula Error",
  "Calculation Error",
  "Reading Error",
  "Guess",
  "Memory Error",
  "Other",
];

const PATTERN_WINDOW_DAYS = 14;

/** Keyword-based, per-subject mistake classification. Falls back to Other. */
export function classifyMistake(input: {
  subject?: string;
  question: string;
  userAnswer?: string;
  correctAnswer?: string;
}): MistakeType {
  const subject = (input.subject ?? "").toLowerCase();
  const question = (input.question ?? "").toLowerCase();
  const userAnswer = (input.userAnswer ?? "").trim().toLowerCase();

  if (!userAnswer || userAnswer === "guess" || userAnswer === "random" || userAnswer === "i don't know" || userAnswer === "idk") {
    return "Guess";
  }

  if (/^(true|false)$/.test(userAnswer) && /^(true|false)$/.test((input.correctAnswer ?? "").trim().toLowerCase())) {
    // A true/false misread is a Reading Error only when negation phrases appear.
    if (/\b(not|except|incorrect|wrong|false about)\b/.test(question)) return "Reading Error";
    return "Concept Error";
  }

  if (subject === "physics") {
    if (/\b(unit|si unit|dimension)\b|\[[a-z]+\]/.test(question)) return "Formula Error";
    if (/\b(sign|direction|positive|negative|towards|away)\b/.test(question)) return "Concept Error";
    if (/\b(formula|equation|=\s*[a-z(])/.test(question)) return "Formula Error";
    if (/\b(calculate|compute|find the value|solve|numerical)\b/.test(question)) return "Calculation Error";
    if (/\b(define|state|name|what is|who)\b/.test(question)) return "Memory Error";
    return "Concept Error";
  }
  if (subject === "chemistry") {
    if (/\b(mole|molar|stoichio|concentration|n =|mol)\b/.test(question)) return "Calculation Error";
    if (/\b(unit conversion|convert|cm3|dm3|litre|liter)\b/.test(question)) return "Calculation Error";
    if (/\b(formula|equation|balanced|reactants?|products?)\b/.test(question)) return "Formula Error";
    if (/\b(trend|periodic|electronegativ|ionisation|atomic radius)\b/.test(question)) return "Memory Error";
    return "Concept Error";
  }
  if (subject === "maths") {
    if (/\b(formula|identity|theorem|property)\b/.test(question)) return "Formula Error";
    if (/\b(calculate|solve|find|evaluate|compute|simplify|value of)\b/.test(question)) return "Calculation Error";
    if (/\b(domain|range|condition|if and only if|when)\b/.test(question)) return "Concept Error";
    if (/\b(define|state|prove|write)\b/.test(question)) return "Memory Error";
    return "Calculation Error";
  }
  if (subject === "cs" || subject === "computer science") {
    if (/\b(output|print|trace)\b/.test(question)) return "Reading Error";
    if (/\b(operator|==|!=|<=|>=|\+\+|--)\b/.test(question)) return "Formula Error";
    if (/\b(loop|for|while|range|recursion)\b/.test(question)) return "Concept Error";
    if (/\b(type|int|str|float|list|dict|tuple)\b/.test(question)) return "Memory Error";
    return "Concept Error";
  }
  if (subject === "english" || subject === "hindi") {
    if (/\b(meaning|synonym|antonym|word|vocab)\b/.test(question)) return "Memory Error";
    if (/\b(poet|author|writer|character)\b/.test(question)) return "Memory Error";
    return "Reading Error";
  }
  if (subject === "sst" || subject === "science" || subject === "biology") {
    if (/\b(define|state|name|who|when|where|what is|list)\b/.test(question)) return "Memory Error";
    if (/\b(calculate|formula|equation)\b/.test(question)) return "Formula Error";
    return "Concept Error";
  }

  if (/\b(calculate|solve|compute|evaluate|value of|find)\b/.test(question)) return "Calculation Error";
  if (/\b(formula|equation|identity|law of)\b/.test(question)) return "Formula Error";
  if (/\b(define|state|name|who|when|list|what is)\b/.test(question)) return "Memory Error";
  return "Concept Error";
}

/** Convert a mistake-shaped evidence event into a MistakeRecord (client/server agnostic). */
export function mistakeFromEvent(event: EvidenceEvent): MistakeRecord | null {
  if (event.kind !== "mistake") return null;
  return {
    id: event.id,
    subject: event.subject,
    chapter: event.chapter,
    topic: event.topic,
    question: event.topic ?? event.chapter ?? event.subject,
    mistakeType: "Concept Error",
    source: event.source ?? "quiz",
    resolved: false,
    at: event.at,
  };
}

/** Detect hedged, evidence-backed mistake patterns over the recent window. */
export function detectPatterns(mistakes: MistakeRecord[], now = Date.now()): MistakePattern[] {
  const windowStart = now - PATTERN_WINDOW_DAYS * DAY_MS;
  const recent = mistakes.filter((mistake) => !mistake.resolved && mistake.at >= windowStart);
  const groups = new Map<string, { subject: string; mistakeType: MistakeType; items: MistakeRecord[] }>();

  for (const mistake of recent) {
    const key = `${mistake.subject}|${mistake.mistakeType}`.toLowerCase();
    const group = groups.get(key) ?? { subject: mistake.subject, mistakeType: mistake.mistakeType, items: [] };
    group.items.push(mistake);
    groups.set(key, group);
  }

  const patterns: MistakePattern[] = [];
  for (const group of groups.values()) {
    if (group.items.length < 2) continue;
    const count = group.items.length;
    const severity = count >= 4 ? "severe" : count >= 3 ? "moderate" : "mild";
    const subjectName = subjectDisplayName(group.subject);
    patterns.push({
      id: `pattern-${group.subject}-${group.mistakeType}`.toLowerCase().replace(/\s+/g, "-"),
      subject: group.subject,
      mistakeType: group.mistakeType,
      count,
      windowDays: PATTERN_WINDOW_DAYS,
      detail: `${count} ${group.mistakeType.toLowerCase()} in ${subjectName} over the last ${PATTERN_WINDOW_DAYS} days`,
      insight: `Scholar noticed a possible pattern: most of your ${subjectName} mistakes recently were ${mistakeTypeLabel(group.mistakeType)}. Focus there first — this is a hunch from your practice data, not a guarantee.`,
      severity,
    });
  }

  // Recurring question errors (same question wrong more than once).
  const byQuestion = new Map<string, MistakeRecord[]>();
  for (const mistake of recent) {
    const key = mistake.question.trim().toLowerCase().slice(0, 120);
    if (!key) continue;
    const list = byQuestion.get(key) ?? [];
    list.push(mistake);
    byQuestion.set(key, list);
  }
  for (const [question, items] of byQuestion) {
    if (items.length < 2) continue;
    const first = items[0];
    patterns.push({
      id: `pattern-recurring-${first.id}`,
      subject: first.subject,
      mistakeType: first.mistakeType,
      count: items.length,
      windowDays: PATTERN_WINDOW_DAYS,
      detail: `You got the same question wrong ${items.length} times recently`,
      insight: `Scholar noticed you keep stumbling on the same kind of question: “${truncate(question, 90)}”. A quick review of this topic may clear it up permanently.`,
      severity: "moderate",
    });
  }

  return patterns.sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.count - a.count);
}

function severityRank(severity: MistakePattern["severity"]): number {
  return severity === "severe" ? 3 : severity === "moderate" ? 2 : 1;
}

function mistakeTypeLabel(type: MistakeType): string {
  return type.toLowerCase().replace(" error", "");
}

export function subjectDisplayName(subject: string): string {
  const names: Record<string, string> = {
    maths: "Maths",
    math: "Maths",
    physics: "Physics",
    chemistry: "Chemistry",
    chem: "Chemistry",
    cs: "Computer Science",
    science: "Science",
    biology: "Biology",
    english: "English",
    hindi: "Hindi",
    sst: "Social Science",
    economics: "Economics",
  };
  return names[subject.toLowerCase()] ?? subject;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max).trimEnd()}…` : value;
}
