import { expect, test } from "bun:test";
import { activeLesson, adaptiveMinutes, chapterSignals, formatTime, isShortSprint, previewLesson } from "../src/lib/exam-ready/experience";
import { currentTask, evidence, lessonSchema, type Setup } from "../src/lib/exam-ready/model";
import { createSession, transition } from "../src/lib/exam-ready/planner";
const now = 1800000000000;
const setup: Setup = { exam: "Physics exam", grade: 11, board: "CBSE", examAt: now + 86400000, minutes: 120, format: "mixed", style: "step-by-step", chapters: [{ subjectId: "physics", chapterId: "p5", confidence: 1 }, { subjectId: "physics", chapterId: "p3", confidence: 4 }], materials: "all", resourceIds: [], blocks: [], diagnostic: true };
test("behind and more-time presets are distinct and deadline bounded", () => {
    const s = createSession("s", setup, now);
    expect(adaptiveMinutes(s, "behind", now)).toBe(78);
    expect(adaptiveMinutes(s, "more", now)).toBe(180);
    s.setup.examAt = now + 600000;
    expect(adaptiveMinutes(s, "more", now)).toBe(10);
});
test("adaptive controls use remaining time, not the original budget", () => {
    const s = createSession("s", setup, now); s.clock.elapsedMs = 90 * 60000;
    expect(adaptiveMinutes(s, "behind", now)).toBe(19);
    expect(adaptiveMinutes(s, "more", now)).toBe(45);
});

test("short-sprint presentation uses remaining budget after a long session is compressed", () => {
    const s = createSession("s", setup, now); s.clock.elapsedMs = 45 * 60000;
    const adjusted = transition(s, { type: "replan", minutes: 15, reason: "Falling behind" }, now);
    expect(adjusted.setup.minutes).toBe(60);
    expect(isShortSprint(adjusted, now)).toBe(true);
    expect(isShortSprint(createSession("long", setup, now), now)).toBe(false);
});
test("chapter signals never treat confidence as measured accuracy", () => {
    const s = createSession("s", setup, now), signals = chapterSignals(s);
    expect(signals[0].chapterId).toBe("p5");
    expect(signals.every(c => c.accuracy === null && c.questions === 0)).toBe(true);
});
test("chapter evidence is unique, owner-session local and excludes self review", () => {
    const s = createSession("s", setup, now);
    const a = { id: "a", questionId: "q", subjectId: "physics", chapterId: "p5", topic: "force", correct: false, answer: "a", expected: "b", explanation: "because", at: now, kind: "practice" as const, evaluation: "objective" as const };
    s.attempts = [a, { ...a, id: "b", correct: true }, { ...a, id: "c", questionId: "self", evaluation: "self-reviewed" }];
    const signal = chapterSignals(s).find(c => c.chapterId === "p5")!;
    expect(signal.questions).toBe(1); expect(signal.accuracy).toBe(100);
    expect(chapterSignals(createSession("other", setup, now)).every(c => !c.questions)).toBe(true);
});
test("offline demonstration is schema-valid but never stored as readiness evidence", () => {
    const s = createSession("s", setup, now), demo = previewLesson();
    expect(lessonSchema.safeParse(demo).success).toBe(true);
    expect(demo.questions[0].id).toStartWith("preview:");
    expect(s.lessons).toEqual({}); expect(evidence(s).readiness).toBeNull(); expect(evidence(s).questions).toBe(0);
});
test("old lessons remain valid without structured blocks", () => {
    expect(lessonSchema.safeParse({ text: "A previous saved explanation remains supported.", formulas: [], questions: [] }).success).toBe(true);
});
test("structured blocks reject oversized or empty generated data", () => {
    const demo = previewLesson();
    expect(lessonSchema.safeParse({ ...demo, example: { ...demo.example, steps: [] } }).success).toBe(false);
    expect(lessonSchema.safeParse({ ...demo, concept: { ...demo.concept, explanation: "x".repeat(2401) } }).success).toBe(false);
});
test("current lesson selection never renders a stale task or mock", () => {
    const s = createSession("s", setup, now), first = currentTask(s)!;
    s.lessons[`${first.id}:normal`] = previewLesson();
    expect(activeLesson(s)?.concept?.title).toBe("Newton’s Second Law");
    const next = transition(s, { type: "next" }, now);
    expect(activeLesson(next, `${first.id}:normal`)).toBeUndefined();
    next.lessons["exam-ready-mock"] = previewLesson();
    expect(activeLesson(next)).toBeUndefined();
});
test("replanning preserves completed work and changes the actual mission", () => {
    let s = createSession("s", setup, now); s = transition(s, { type: "next" }, now);
    const completed = s.tasks.filter(t => t.status === "done").map(t => t.id);
    s = transition(s, { type: "replan", minutes: 15, reason: "Falling behind" }, now);
    expect(s.tasks.filter(t => t.status === "done").map(t => t.id)).toEqual(completed);
    expect(s.tasks.filter(t => t.status === "pending" || t.status === "active").some(t => t.kind === "break")).toBe(false);
});
test("display timing clamps negative durations and represents days", () => {
    expect(formatTime(-1)).toBe("0:00"); expect(formatTime(45 * 60)).toBe("45:00");
    expect(formatTime(90061)).toBe("1d 1h");
});
