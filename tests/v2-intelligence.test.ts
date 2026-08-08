import { describe, expect, test } from "bun:test";
import {
  DAY_MS,
  type EvidenceEvent,
  type MistakeRecord,
  type MistakeType,
  type ReviewSchedule,
} from "../src/lib/v2/intelligence/types";
import {
  estimateMastery,
  estimateAllMastery,
  aggregateEvidence,
  levelFromAggregate,
  applyDecay,
  ratingToOutcome,
  MASTERY_LEVEL_LABELS,
} from "../src/lib/v2/intelligence/mastery";
import {
  nextReview,
  INITIAL_SCHEDULE,
  isDue,
  dueLabel,
  stateLabel,
} from "../src/lib/v2/intelligence/spaced-repetition";
import {
  classifyMistake,
  detectPatterns,
  MISTAKE_TYPES,
} from "../src/lib/v2/intelligence/mistakes";
import { findWeakTopics } from "../src/lib/v2/intelligence/weak-topics";
import { buildRevisionQueue } from "../src/lib/v2/intelligence/revision-queue";
import { examIntelligence } from "../src/lib/v2/intelligence/exam-intelligence";
import { buildDailyBrief, buildWeeklyReport } from "../src/lib/v2/intelligence/brief";
import { ingestEventsSchema, ingestMistakesSchema, reviewUpdateSchema } from "../src/lib/v2/intelligence/schemas";

const NOW = Date.UTC(2026, 7, 8, 12, 0, 0); // 8 Aug 2026 12:00 UTC

function event(partial: Partial<EvidenceEvent> & Pick<EvidenceEvent, "id" | "kind" | "subject">): EvidenceEvent {
  return { at: NOW, source: "quiz", ...partial };
}

// ============================================================================
// Mastery engine
// ============================================================================

describe("mastery engine", () => {
  test("no evidence → UNKNOWN", () => {
    const estimate = estimateMastery({ subject: "physics" }, [], NOW);
    expect(estimate.level).toBe("UNKNOWN");
    expect(estimate.score).toBe(0);
    expect(estimate.accuracy).toBeNull();
  });

  test("low accuracy → LEARNING", () => {
    const events: EvidenceEvent[] = [];
    for (let i = 0; i < 4; i++) {
      events.push(event({ id: `q${i}`, kind: "question_result", subject: "physics", chapter: "kinematics", correct: false }));
    }
    const estimate = estimateMastery({ subject: "physics", chapter: "kinematics" }, events, NOW);
    expect(estimate.level).toBe("LEARNING");
    expect(estimate.accuracy).toBeLessThan(0.6);
  });

  test("high accuracy with enough volume → MASTERED", () => {
    const events: EvidenceEvent[] = [];
    for (let i = 0; i < 10; i++) {
      events.push(event({ id: `q${i}`, kind: "question_result", subject: "maths", chapter: "algebra", correct: true }));
    }
    const estimate = estimateMastery({ subject: "maths", chapter: "algebra" }, events, NOW);
    expect(estimate.level).toBe("MASTERED");
    expect(estimate.score).toBeGreaterThan(0.9);
  });

  test("evidence-count guard: a few correct answers stay STRONG, not MASTERED", () => {
    const events: EvidenceEvent[] = [];
    for (let i = 0; i < 5; i++) {
      events.push(event({ id: `q${i}`, kind: "question_result", subject: "english", correct: true }));
    }
    const estimate = estimateMastery({ subject: "english" }, events, NOW);
    expect(estimate.level).toBe("STRONG");
  });

  test("conservative decay: strong topic unrevised → DECAYING, score kept", () => {
    const revisedAt = NOW - 20 * DAY_MS;
    const events: EvidenceEvent[] = [];
    for (let i = 0; i < 6; i++) {
      events.push(event({ id: `q${i}`, kind: "question_result", subject: "physics", correct: true, at: revisedAt }));
    }
    events.push(event({ id: "rev1", kind: "revision", subject: "physics", at: revisedAt }));
    const estimate = estimateMastery({ subject: "physics" }, events, NOW);
    expect(estimate.level).toBe("DECAYING");
    expect(estimate.needsRefresh).toBe(true);
    expect(estimate.decayed).toBe(true);
    expect(estimate.daysSinceRevision).toBeGreaterThanOrEqual(19);
    expect(estimate.score).toBeGreaterThan(0.7); // score not destroyed
  });

  test("a fresh revision restores a decayed topic immediately", () => {
    const revisedAt = NOW - 20 * DAY_MS;
    const events: EvidenceEvent[] = [];
    for (let i = 0; i < 6; i++) {
      events.push(event({ id: `q${i}`, kind: "question_result", subject: "physics", correct: true, at: revisedAt }));
    }
    events.push(event({ id: "rev1", kind: "revision", subject: "physics", at: revisedAt }));
    events.push(event({ id: "rev2", kind: "revision", subject: "physics", at: NOW - DAY_MS }));
    const estimate = estimateMastery({ subject: "physics" }, events, NOW);
    expect(estimate.level).toBe("MASTERED");
    expect(estimate.needsRefresh).toBe(false);
  });

  test("applyDecay keeps STRONG/MASTERED when revised recently", () => {
    expect(applyDecay("STRONG", NOW - 2 * DAY_MS, NOW).level).toBe("STRONG");
    expect(applyDecay("MASTERED", NOW - 5 * DAY_MS, NOW).level).toBe("MASTERED");
    expect(applyDecay("DEVELOPING", NOW - 60 * DAY_MS, NOW).level).toBe("DEVELOPING");
  });

  test("confidence ratings map to outcomes", () => {
    expect(ratingToOutcome("again")).toBe(0);
    expect(ratingToOutcome(2)).toBe(0.4);
    expect(ratingToOutcome("good")).toBe(0.85);
    expect(ratingToOutcome(4)).toBe(1);
  });

  test("difficulty weighting: a hard correct outweighs an easy wrong", () => {
    const easy = estimateMastery(
      { subject: "maths" },
      [
        event({ id: "e1", kind: "practice", subject: "maths", correct: true, difficulty: "foundation" }),
        event({ id: "e2", kind: "practice", subject: "maths", correct: false, difficulty: "standard" }),
      ],
      NOW,
    );
    const hard = estimateMastery(
      { subject: "maths" },
      [
        event({ id: "h1", kind: "practice", subject: "maths", correct: true, difficulty: "challenge" }),
        event({ id: "h2", kind: "practice", subject: "maths", correct: false, difficulty: "standard" }),
      ],
      NOW,
    );
    expect(hard.score).toBeGreaterThan(easy.score);
  });

  test("estimateAllMastery groups per subject|chapter|topic", () => {
    const estimates = estimateAllMastery([
      event({ id: "a1", kind: "question_result", subject: "physics", chapter: "kinematics", correct: true }),
      event({ id: "a2", kind: "question_result", subject: "physics", chapter: "optics", correct: false }),
      event({ id: "a3", kind: "question_result", subject: "chemistry", chapter: "moles", correct: true }),
    ], NOW);
    expect(estimates.size).toBe(3);
  });

  test("level labels are human friendly", () => {
    expect(MASTERY_LEVEL_LABELS.DECAYING).toBe("Needs refresh");
  });

  test("aggregateEvidence handles quiz_attempt scores", () => {
    const agg = aggregateEvidence([
      event({ id: "z1", kind: "quiz_attempt", subject: "science", score: 0.8, total: 10 }),
    ], NOW);
    expect(agg.score).toBeCloseTo(0.8, 5);
    expect(agg.correctCount).toBe(8);
  });
});

// ============================================================================
// Spaced repetition
// ============================================================================

describe("spaced repetition", () => {
  test("NEW + good → REVIEW, 1 day", () => {
    const next = nextReview(INITIAL_SCHEDULE, "good", NOW);
    expect(next.state).toBe("REVIEW");
    expect(next.intervalDays).toBe(1);
    expect(next.dueAt).toBe(NOW + DAY_MS);
  });

  test("repeated good reviews grow intervals and eventually mature", () => {
    let schedule: ReviewSchedule = { ...INITIAL_SCHEDULE, dueAt: NOW };
    for (let i = 0; i < 8; i++) {
      schedule = nextReview(schedule, "good", NOW + i * DAY_MS);
    }
    expect(schedule.intervalDays).toBeGreaterThan(1);
    expect(schedule.reviewCount).toBe(8);
  });

  test("again on a mature item → RELEARNING, due in 10 minutes, lapse counted", () => {
    const mature: ReviewSchedule = { state: "MATURE", intervalDays: 30, ease: 2.5, dueAt: NOW, reviewCount: 12, lapses: 0 };
    const next = nextReview(mature, "again", NOW);
    expect(next.state).toBe("RELEARNING");
    expect(next.intervalDays).toBe(0);
    expect(next.dueAt - NOW).toBeLessThan(DAY_MS);
    expect(next.lapses).toBe(1);
    expect(next.ease).toBeLessThan(2.5);
  });

  test("again on a NEW item → LEARNING (not relearning)", () => {
    const next = nextReview(INITIAL_SCHEDULE, "again", NOW);
    expect(next.state).toBe("LEARNING");
  });

  test("easy accelerates, hard decelerates", () => {
    const review: ReviewSchedule = { state: "REVIEW", intervalDays: 5, ease: 2.5, dueAt: NOW, reviewCount: 3, lapses: 0 };
    const easy = nextReview(review, "easy", NOW);
    const hard = nextReview(review, "hard", NOW);
    expect(easy.intervalDays).toBeGreaterThan(hard.intervalDays);
    expect(easy.ease).toBeGreaterThan(hard.ease);
  });

  test("ease never drops below the floor", () => {
    let schedule: ReviewSchedule = { ...INITIAL_SCHEDULE, dueAt: NOW };
    for (let i = 0; i < 20; i++) schedule = nextReview(schedule, "again", NOW);
    expect(schedule.ease).toBeGreaterThanOrEqual(1.3);
  });

  test("isDue and dueLabel helpers", () => {
    expect(isDue(INITIAL_SCHEDULE, NOW)).toBe(true);
    const future = nextReview(INITIAL_SCHEDULE, "good", NOW);
    expect(isDue(future, NOW)).toBe(false);
    expect(dueLabel({ ...INITIAL_SCHEDULE, dueAt: NOW }, NOW)).toBe("due now");
    expect(stateLabel("RELEARNING")).toBe("Relearning");
  });
});

// ============================================================================
// Mistake book + patterns
// ============================================================================

describe("mistake book", () => {
  test("taxonomy covers the blueprint's types", () => {
    const expected: MistakeType[] = ["Concept Error", "Formula Error", "Calculation Error", "Reading Error", "Guess", "Memory Error"];
    for (const type of expected) {
      expect(MISTAKE_TYPES).toContain(type);
    }
  });

  test("classifyMistake detects guess / formula / calculation / memory", () => {
    expect(classifyMistake({ question: "What is the unit of force?", userAnswer: "", subject: "physics" })).toBe("Guess");
    expect(classifyMistake({ question: "Calculate the value of x", userAnswer: "12", subject: "maths" })).toBe("Calculation Error");
    expect(classifyMistake({ question: "Using the formula v = u + at", userAnswer: "3", subject: "physics" })).toBe("Formula Error");
    expect(classifyMistake({ question: "Name the author of X", userAnswer: "Shakespeare", subject: "english" })).toBe("Memory Error");
  });

  test("patterns are hedged and never overclaim", () => {
    const mistakes: MistakeRecord[] = [
      { id: "m1", subject: "chemistry", question: "Convert 250 cm3 to dm3", mistakeType: "Calculation Error", source: "quiz", resolved: false, at: NOW - DAY_MS },
      { id: "m2", subject: "chemistry", question: "How many moles in 9 g of water?", mistakeType: "Calculation Error", source: "quiz", resolved: false, at: NOW - 2 * DAY_MS },
      { id: "m3", subject: "chemistry", question: "Balance the equation", mistakeType: "Formula Error", source: "quiz", resolved: false, at: NOW - 3 * DAY_MS },
    ];
    const patterns = detectPatterns(mistakes, NOW);
    const calc = patterns.find((pattern) => pattern.mistakeType === "Calculation Error");
    expect(calc).toBeDefined();
    expect(calc!.insight).toContain("possible pattern");
    expect(calc!.count).toBe(2);
  });

  test("recurring question errors are flagged", () => {
    const mistakes: MistakeRecord[] = [
      { id: "r1", subject: "maths", question: "What is the derivative of x²?", mistakeType: "Concept Error", source: "quiz", resolved: false, at: NOW - DAY_MS },
      { id: "r2", subject: "maths", question: "What is the derivative of x²?", mistakeType: "Concept Error", source: "quiz", resolved: false, at: NOW - 2 * DAY_MS },
    ];
    const patterns = detectPatterns(mistakes, NOW);
    expect(patterns.some((pattern) => pattern.id.startsWith("pattern-recurring-"))).toBe(true);
  });

  test("resolved mistakes are excluded from patterns", () => {
    const mistakes: MistakeRecord[] = [
      { id: "x1", subject: "physics", question: "Question A", mistakeType: "Calculation Error", source: "quiz", resolved: true, resolvedAt: NOW, at: NOW - DAY_MS },
      { id: "x2", subject: "physics", question: "Question B", mistakeType: "Calculation Error", source: "quiz", resolved: true, resolvedAt: NOW, at: NOW - DAY_MS },
    ];
    expect(detectPatterns(mistakes, NOW)).toHaveLength(0);
  });
});

// ============================================================================
// Weak topic radar
// ============================================================================

describe("weak topic radar", () => {
  test("repeated recent wrongs surface a weak topic", () => {
    const events: EvidenceEvent[] = [
      event({ id: "w1", kind: "question_result", subject: "physics", chapter: "kinematics", topic: "Projectile motion", correct: false, at: NOW - DAY_MS }),
      event({ id: "w2", kind: "question_result", subject: "physics", chapter: "kinematics", topic: "Projectile motion", correct: false, at: NOW - 2 * DAY_MS }),
      event({ id: "w3", kind: "question_result", subject: "physics", chapter: "kinematics", topic: "Projectile motion", correct: true, at: NOW - 3 * DAY_MS }),
    ];
    const weak = findWeakTopics({ events, mistakes: [], now: NOW });
    const topic = weak.find((item) => item.topic === "Projectile motion");
    expect(topic).toBeDefined();
    // accuracy 1/3 < 0.4 → severe; severe radar suggests a reminder first.
    expect(topic!.severity).toBe("severe");
    expect(topic!.accuracy).toBeCloseTo(1 / 3, 5);
    expect(topic!.suggestion).toBe("create-reminder");
  });

  test("decayed mastery counts as weak with a revise suggestion", () => {
    const revisedAt = NOW - 30 * DAY_MS;
    const events: EvidenceEvent[] = [];
    for (let i = 0; i < 6; i++) {
      events.push(event({ id: `d${i}`, kind: "question_result", subject: "maths", chapter: "algebra", correct: true, at: revisedAt }));
    }
    events.push(event({ id: "drev", kind: "revision", subject: "maths", chapter: "algebra", at: revisedAt }));
    const weak = findWeakTopics({ events, mistakes: [], now: NOW });
    const topic = weak.find((item) => item.chapter === "algebra");
    expect(topic).toBeDefined();
    expect(topic!.suggestion).toBe("revise");
    expect(topic!.masteryLevel).toBe("DECAYING");
  });

  test("consistent correct answers are not flagged", () => {
    const events: EvidenceEvent[] = [];
    for (let i = 0; i < 8; i++) {
      events.push(event({ id: `s${i}`, kind: "question_result", subject: "english", correct: true }));
    }
    expect(findWeakTopics({ events, mistakes: [], now: NOW })).toHaveLength(0);
  });
});

// ============================================================================
// Revision queue
// ============================================================================

describe("revision queue", () => {
  const weak = findWeakTopics({
    events: [
      event({ id: "q1", kind: "question_result", subject: "physics", chapter: "kinematics", correct: false, at: NOW - DAY_MS }),
      event({ id: "q2", kind: "question_result", subject: "physics", chapter: "kinematics", correct: false, at: NOW - 2 * DAY_MS }),
    ],
    mistakes: [],
    now: NOW,
  });

  const mistakes: MistakeRecord[] = [
    { id: "mm1", subject: "chemistry", question: "Convert 250 cm3 to dm3", mistakeType: "Calculation Error", source: "quiz", resolved: false, at: NOW - DAY_MS },
  ];

  test("queue includes weak topics and unresolved mistakes", () => {
    const queue = buildRevisionQueue({ mastery: [], weakTopics: weak, mistakes, exams: [], schedules: {}, now: NOW });
    expect(queue.some((item) => item.kind === "concept")).toBe(true);
    expect(queue.some((item) => item.kind === "mistake")).toBe(true);
  });

  test("manual order always wins over priority", () => {
    const queue = buildRevisionQueue({
      mastery: [],
      weakTopics: weak,
      mistakes,
      exams: [],
      schedules: {},
      now: NOW,
    });
    const ids = queue.map((item) => item.id);
    const reversed = [...ids].reverse();
    const reordered = buildRevisionQueue({
      mastery: [],
      weakTopics: weak,
      mistakes,
      exams: [],
      schedules: {},
      manualOrder: reversed,
      now: NOW,
    });
    expect(reordered.map((item) => item.id)).toEqual(reversed);
  });

  test("resolved mistakes leave the queue", () => {
    const queue = buildRevisionQueue({
      mastery: [],
      weakTopics: [],
      mistakes: [{ ...mistakes[0], resolved: true }],
      exams: [],
      schedules: {},
      now: NOW,
    });
    expect(queue.some((item) => item.kind === "mistake")).toBe(false);
  });

  test("decayed mastery produces refresh items with reasons", () => {
    const revisedAt = NOW - 30 * DAY_MS;
    const events: EvidenceEvent[] = [];
    for (let i = 0; i < 6; i++) {
      events.push(event({ id: `d${i}`, kind: "question_result", subject: "maths", chapter: "algebra", correct: true, at: revisedAt }));
    }
    events.push(event({ id: "drev", kind: "revision", subject: "maths", chapter: "algebra", at: revisedAt }));
    const mastery = [...estimateAllMastery(events, NOW).values()];
    const queue = buildRevisionQueue({ mastery, weakTopics: [], mistakes: [], exams: [], schedules: {}, now: NOW });
    const refresh = queue.find((item) => item.reasons.some((reason) => reason.includes("Not revised")));
    expect(refresh).toBeDefined();
  });
});

// ============================================================================
// Exam intelligence
// ============================================================================

describe("exam intelligence", () => {
  test("computes days remaining and preparedness from real data", () => {
    const events: EvidenceEvent[] = [];
    for (let i = 0; i < 10; i++) {
      events.push(event({ id: `e${i}`, kind: "question_result", subject: "physics", correct: true, at: NOW - DAY_MS }));
    }
    const mastery = [...estimateAllMastery(events, NOW).values()];
    const insights = examIntelligence({
      exams: [{ id: "ex1", title: "Physics Term Exam", subject: "physics", date: NOW + 5 * DAY_MS }],
      mastery,
      studyProgress: { ch1: 80, ch2: 90 },
      evidence: events,
      now: NOW,
    });
    expect(insights).toHaveLength(1);
    expect(insights[0].daysRemaining).toBe(5);
    expect(insights[0].preparedness).not.toBeNull();
    expect(insights[0].preparedness!).toBeGreaterThanOrEqual(0);
    expect(insights[0].preparedness!).toBeLessThanOrEqual(100);
    expect(insights[0].crashMode).toBeUndefined();
  });

  test("preparedness is null without enough evidence (no fake scores)", () => {
    const insights = examIntelligence({
      exams: [{ id: "ex2", title: "Chemistry Exam", subject: "chemistry", date: NOW + DAY_MS }],
      mastery: [],
      studyProgress: {},
      evidence: [],
      now: NOW,
    });
    expect(insights[0].preparedness).toBeNull();
  });

  test("crash mode activates for near exams with must/should/optional", () => {
    const events: EvidenceEvent[] = [];
    for (let i = 0; i < 4; i++) {
      events.push(event({ id: `c${i}`, kind: "question_result", subject: "maths", chapter: "algebra", correct: false, at: NOW - DAY_MS }));
    }
    const mastery = [...estimateAllMastery(events, NOW).values()];
    const insights = examIntelligence({
      exams: [{ id: "ex3", title: "Maths Mock", subject: "maths", date: NOW + 2 * DAY_MS }],
      mastery,
      studyProgress: { algebra: 40 },
      evidence: events,
      now: NOW,
    });
    const insight = insights[0];
    expect(insight.crashMode).toBeDefined();
    expect(insight.crashMode!.active).toBe(true);
    expect(insight.crashMode!.mustDo.length).toBeGreaterThan(0);
    expect(insight.crashMode!.shouldDo.length + insight.crashMode!.optional.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Daily brief + weekly report
// ============================================================================

describe("daily brief", () => {
  test("builds items from assignments, exams, weak topics and focus", () => {
    const brief = buildDailyBrief({
      assignments: [{ title: "Maths HW", dueAt: NOW + 2 * 3_600_000 }],
      exams: [{ title: "Physics Exam", date: NOW + 4 * DAY_MS }],
      weakTopics: [
        { subject: "physics", title: "Projectile motion", attempts: 2, correct: 0, accuracy: 0, recentWrong: 2, masteryLevel: "LEARNING", severity: "mild", suggestion: "practice", suggestionLabel: "Practice" },
      ],
      revisionQueue: [],
      studyMinutesToday: 0,
      now: NOW,
    });
    expect(brief.items.some((item) => item.kind === "assignment")).toBe(true);
    expect(brief.items.some((item) => item.kind === "exam")).toBe(true);
    expect(brief.items.some((item) => item.kind === "weak")).toBe(true);
    expect(brief.items.some((item) => item.kind === "focus")).toBe(true);
  });

  test("calm day produces a reassuring item", () => {
    const brief = buildDailyBrief({
      assignments: [],
      exams: [],
      weakTopics: [],
      revisionQueue: [],
      studyMinutesToday: 60,
      now: NOW,
    });
    expect(brief.items.some((item) => item.kind === "stats")).toBe(true);
  });
});

describe("weekly report", () => {
  test("computes study minutes, accuracy, movement and consistency", () => {
    const events: EvidenceEvent[] = [];
    for (let i = 0; i < 5; i++) {
      events.push(event({ id: `w${i}`, kind: "question_result", subject: "science", correct: true, at: NOW - DAY_MS * 2 }));
    }
    events.push(event({ id: "wr1", kind: "revision", subject: "science", at: NOW - DAY_MS * 1 }));
    events.push(event({ id: "wr2", kind: "revision", subject: "science", at: NOW - DAY_MS * 2 }));
    const mastery = [...estimateAllMastery(events, NOW).values()];
    const report = buildWeeklyReport({
      evidence: events,
      mistakes: [],
      mastery,
      baseline: { science: 40 },
      weekStart: NOW - 7 * DAY_MS,
      now: NOW,
    });
    expect(report.questionsAttempted).toBe(5);
    expect(report.accuracy).toBe(1);
    expect(report.revisionDays).toBeGreaterThanOrEqual(2);
    expect(report.hasBaseline).toBe(true);
    expect(report.masteryMovement.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// API schemas
// ============================================================================

describe("intelligence API schemas", () => {
  test("valid evidence ingest passes and is bounded", () => {
    const result = ingestEventsSchema.safeParse({
      events: Array.from({ length: 200 }, (_, i) => ({
        id: `ev-${i}`,
        kind: "question_result",
        subject: "physics",
        chapter: "kinematics",
        correct: true,
        at: NOW,
        source: "quiz",
      })),
    });
    expect(result.success).toBe(true);
    const tooMany = ingestEventsSchema.safeParse({ events: Array.from({ length: 201 }, (_, i) => ({ id: `ev-${i}`, kind: "revision", subject: "maths", at: NOW })) });
    expect(tooMany.success).toBe(false);
  });

  test("rejects malformed events", () => {
    expect(ingestEventsSchema.safeParse({ events: [{ id: "", kind: "question_result", subject: "maths", at: NOW }] }).success).toBe(false);
    expect(ingestEventsSchema.safeParse({ events: [{ id: "x", kind: "delete_everything", subject: "maths", at: NOW }] }).success).toBe(false);
    expect(ingestEventsSchema.safeParse({ events: [{ id: "x", kind: "practice", subject: "maths", score: 5, at: NOW }] }).success).toBe(false);
  });

  test("mistake records validate with bounded counts", () => {
    const result = ingestMistakesSchema.safeParse({
      mistakes: [{ id: "m1", subject: "chemistry", question: "Q", mistakeType: "Calculation Error", source: "quiz", at: NOW }],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.mistakes[0].mistakeType).toBe("Calculation Error");
  });

  test("review updates validate rating enum", () => {
    expect(reviewUpdateSchema.safeParse({ itemId: "concept-1", rating: "good", at: NOW }).success).toBe(true);
    expect(reviewUpdateSchema.safeParse({ itemId: "concept-1", rating: "excellent", at: NOW }).success).toBe(false);
  });
});
