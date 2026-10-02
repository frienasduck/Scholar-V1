import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ExamContent } from "../src/components/exam-ready/content";
import { createSession, recordAnswer, transition } from "../src/lib/exam-ready/planner";
import { localMissionLesson } from "../src/lib/exam-ready/preview";
import { recommendStudyBudget } from "../src/lib/exam-ready/experience";
import { currentTask, evidence, restoreMissionCoverage, setupSchema, subjectChapter, type Setup, type Question } from "../src/lib/exam-ready/model";

const now = Date.UTC(2026, 9, 2, 9);
const config = (minutes = 120): Setup => ({ exam: "Physics exam", grade: 11, board: "CBSE", examAt: now + 86400000, minutes, format: "school", style: "step-by-step", chapters: [{ subjectId: "physics", chapterId: "p5", confidence: 1 }], materials: "all", resourceIds: [], blocks: [], diagnostic: true });

test("two-hour mission teaches every concept in curriculum order before application", () => {
    const s = createSession("s", config(), now);
    const learns = s.tasks.filter(t => t.kind === "learn");
    expect(learns.map(t => t.topic)).toEqual(subjectChapter(s.setup, "physics", "p5")!.concepts);
    expect(learns.at(-1)!.id).not.toBe(s.tasks.find(t => t.kind === "practice")!.id);
    expect(s.tasks.findIndex(t => t.kind === "practice")).toBeGreaterThan(s.tasks.findLastIndex(t => t.kind === "learn"));
});
test("rapid completion follows the exact original mission without regenerating stages", () => {
    let s = createSession("s", config(), now);
    const expected = s.tasks.map(t => t.id), visited: string[] = [];
    for (let i = 0; currentTask(s) && i < 40; i++) { visited.push(currentTask(s)!.id); s = transition(s, { type: "next" }, now + i * 1000); }
    expect(visited).toEqual(expected); expect(s.status).toBe("completed"); expect(s.clock.runningSince).toBeNull();
});
test("skipping a checkpoint cannot immediately regenerate it", () => {
    let s = createSession("s", config(), now), first = currentTask(s)!.id, next = s.tasks[1].id;
    s = transition(s, { type: "skip" }, now + 1000);
    expect(currentTask(s)!.id).toBe(next); expect(s.tasks.find(t => t.id === first)!.status).toBe("skipped");
});
test("two wrong answers keep the active lesson and add only one bounded repair on advancement", () => {
    let s = createSession("s", config(60), now);
    const id = currentTask(s)!.id, ids = s.tasks.map(t => t.id);
    const q: Question = { id: "q1", subjectId: "physics", chapterId: "p5", topic: "Inertia", kind: "mcq", question: "An inertia check", options: ["a", "b", "c", "d"], answer: "b", explanation: "Consider acceleration.", source: "Scholar AI-generated" };
    recordAnswer(s, q, "a", false, "objective", now + 1000); recordAnswer(s, { ...q, id: "q2" }, "a", false, "objective", now + 2000);
    expect(currentTask(s)!.id).toBe(id); expect(s.tasks.map(t => t.id)).toEqual(ids);
    s = transition(s, { type: "next" }, now + 3000); expect(currentTask(s)!.title).toStartWith("Targeted repair");
    recordAnswer(s, { ...q, id: "q3" }, "a", false, "objective", now + 4000);
    s = transition(s, { type: "next" }, now + 5000); expect(s.tasks.filter(t => t.title.startsWith("Targeted repair"))).toHaveLength(1);
});
test("changing only sources preserves checkpoint identity and order", () => {
    const s = createSession("s", config(), now), ids = s.tasks.map(t => t.id);
    const changed = transition(s, { type: "settings", setup: { ...s.setup, resourceIds: ["source"] } }, now + 1000);
    expect(changed.tasks.map(t => t.id)).toEqual(ids); expect(currentTask(changed)!.id).toBe(currentTask(s)!.id);
});
test("manual replan does not reteach a finished concept under another teaching label", () => {
    let s = createSession("s", config(), now);
    s = transition(s, { type: "next" }, now); const first = currentTask(s)!.topic;
    s = transition(s, { type: "next" }, now);
    s = transition(s, { type: "replan", minutes: 240, reason: "More time" }, now);
    expect(s.tasks.some(t => ["active", "pending"].includes(t.status) && ["learn", "repair"].includes(t.kind) && t.topic === first)).toBe(false);
});
test("offline guide changes chapter concept rather than repeating Newton's second law", () => {
    let s = createSession("s", config(), now); s = transition(s, { type: "next" }, now);
    const first = localMissionLesson(s)!; s = transition(s, { type: "next" }, now + 1000); const second = localMissionLesson(s)!;
    expect(first.concept!.title).toContain("first law"); expect(second.concept!.title).toContain("second law");
    expect(first.text).not.toBe(second.text); expect(first.questions[0].question).not.toBe(second.questions[0].question);
    expect(evidence(s).questions).toBe(0);
});
test("other chapters never display an unrelated fixed physics demo", () => {
    const s = createSession("s", { ...config(), diagnostic: false, chapters: [{ subjectId: "maths", chapterId: "m1", confidence: 1 }] }, now);
    expect(localMissionLesson(s)!.text).not.toContain("Newton"); expect(localMissionLesson(s)!.questions[0].subjectId).toBe("maths");
});

test("offline calibration, teaching, application and recall have distinct checks", () => {
    const s = createSession("s", config(), now), checks: string[] = [];
    for (const kind of ["diagnostic", "learn", "practice", "recall", "mistakes"] as const) {
        s.tasks.forEach(t => { t.status = "pending"; });
        s.tasks.find(t => t.kind === kind)!.status = "active";
        checks.push(localMissionLesson(s)!.questions[0].question);
    }
    expect(new Set(checks).size).toBe(checks.length);
});

test("finishing a daily-block checkpoint early keeps future checkpoints inside non-overlapping blocks", () => {
    const suggestion = recommendStudyBudget(now + 4 * 86400000, now);
    let s = createSession("s", { ...config(), examAt: now + 4 * 86400000, ...suggestion }, now);
    s = transition(s, { type: "next" }, now + 1000);
    const pending = s.tasks.filter(t => ["active", "pending"].includes(t.status));
    for (let i = 0; i < pending.length; i++) {
        const task = pending[i], block = s.setup.blocks.find(b => task.scheduledAt! >= b.start && task.scheduledAt! < b.start + b.minutes * 60000)!;
        expect(block).toBeDefined();
        expect(task.scheduledAt! + task.seconds * 1000).toBeLessThanOrEqual(block.start + block.minutes * 60000);
        if (i) expect(task.scheduledAt!).toBeGreaterThanOrEqual(pending[i - 1].scheduledAt! + pending[i - 1].seconds * 1000);
    }
    expect(pending.filter(t => t.status === "active")).toHaveLength(1);
});
test("private-material guest mode does not substitute an outside curriculum lesson", () => {
    const s = createSession("s", { ...config(), materials: "personal" }, now);
    expect(localMissionLesson(s)!.grounding).toBe("material gap"); expect(localMissionLesson(s)!.questions).toHaveLength(0);
});

test("saved first-concept-only missions repair coverage without erasing progress or notes", () => {
    const s = createSession("s", config(60), now);
    s.tasks[0].status = "done"; s.tasks[1].status = "active";
    const id = s.tasks[1].id;
    s.tasks.forEach(task => { delete task.topics; });
    s.notes = "Keep my work";
    s.lessons[`${id}:old`] = localMissionLesson(s)!;
    const restored = restoreMissionCoverage(s);
    expect(restored.tasks.map(t => [t.id, t.status])).toEqual(s.tasks.map(t => [t.id, t.status]));
    expect(currentTask(restored)!.topics).toEqual(subjectChapter(s.setup, "physics", "p5")!.concepts);
    expect(restored.notes).toBe(s.notes); expect(restored.clock).toEqual(s.clock);
    expect(restored.lessons[`${id}:old`]).toBeUndefined();
    expect(restoreMissionCoverage(restored)).toBe(restored);
});
test("exam date automatically recommends daily blocks rather than all wall-clock hours", () => {
    const suggestion = recommendStudyBudget(now + 4 * 86400000, now);
    expect(suggestion.minutes).toBe(480); expect(suggestion.blocks).toHaveLength(4);
    expect(setupSchema.safeParse({ ...config(), examAt: now + 4 * 86400000, ...suggestion }).success).toBe(true);
    expect(recommendStudyBudget(now + 20 * 60000, now).minutes).toBe(15);
    expect(recommendStudyBudget(now + 120 * 60000, now).minutes).toBe(60);
});
test("answer prose stays spaced prose while explicit equations still render", () => {
    const html = renderToStaticMarkup(<ExamContent content={"First find the mass: m = 15/3 = 5kg. Then a = 25/5 = 5m/s². Use the same mass in both cases."}/>);
    expect(html).toContain("First find the mass:"); expect(html).not.toContain("katex-display"); expect(html).not.toContain("mathnormal");
    const math = renderToStaticMarkup(<ExamContent content={"First find the mass: $m=15/3=5$. Then check the units."}/>);
    expect(math).toContain("katex"); expect(math).toContain("Then check the units."); expect(math).not.toContain("katex-display");
});
