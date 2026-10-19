import { describe, expect, mock, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createSession } from "../src/lib/exam-ready/planner";
import { chapterManifest } from "../src/lib/exam-ready/coverage";
import type { Setup } from "../src/lib/exam-ready/model";

// Only the compile-time server marker is adapted for Bun. Auth, database,
// entitlements and providers are NOT mocked or bypassed. This is a provider-
// only integration test, not an authenticated product journey.
mock.module("server-only", () => ({}));
const { generateScholarGroqJSON, getScholarGroqConfig } = await import("../src/lib/ai/scholar-groq");
const { teacherContext, assembleTeacherLesson } = await import("../src/lib/exam-ready/teacher");
const budgetPath = ".sepb-staging/exam-ready-live-budget.json";
async function reserve() {
    const budget = JSON.parse(await readFile(budgetPath, "utf8").catch(() => '{"used":0,"cap":2}')) as { used: number; cap: number };
    if (budget.used >= Math.min(5, budget.cap)) throw new Error("The approved academic probe budget is exhausted. No provider call made.");
    await mkdir(".sepb-staging", { recursive: true });
    budget.used++;
    await writeFile(budgetPath, JSON.stringify(budget));
}
describe.skipIf(process.env.SCHOLAR_EXAM_LIVE_AI !== "1")("bounded actual configured Scholar Groq teaching adapter", () => {
    for (const [subjectId, chapterId, topicMatch, request] of [
        ["physics", "p5", "Friction (static", "Teach friction on an incline and give a harder multi-step force problem. State assumptions and check units."],
        ["maths", "m8", "General and middle", "Teach general and middle terms, then give a harder coefficient problem with a full correct worked solution."],
    ] as const) test(`${subjectId}/${chapterId}: real structured teaching and academic boundary`, async () => {
        const setup: Setup = { exam: "Synthetic academic provider probe", grade: 11, board: "CBSE", examAt: Date.now() + 86400000, minutes: 180, format: "mixed", style: "step-by-step", chapters: [{ subjectId, chapterId, confidence: 4 }], materials: "scholar", resourceIds: [], blocks: [], diagnostic: false };
        const s = createSession("provider-probe", setup), objective = chapterManifest(11, subjectId, chapterId).objectives.find(o => o.topic.startsWith(topicMatch))!;
        s.tasks.forEach(t => { t.status = "pending"; });
        const task = s.tasks.find(t => t.kind === "recall")!;
        Object.assign(task, { status: "active", kind: "learn", topic: objective.topic, topics: [objective.topic], objectiveIds: [objective.id] });
        getScholarGroqConfig(); // Fail configuration before reserving a provider call.
        await reserve();
        const started = performance.now();
        const raw = await generateScholarGroqJSON({ messages: [{ role: "system", content: teacherContext(s, "deeper", request, false) }, { role: "user", content: "Return the requested complete JSON lesson now, not the schema." }], temperature: .35, maxTokens: 5000, signal: AbortSignal.timeout(50000) });
        await writeFile(`test-artifacts/exam-ready-3-live-${subjectId}-raw.json`, JSON.stringify({ kind: "actual public synthetic provider output; no private student data", elapsedMs: Math.round(performance.now() - started), raw }, null, 2));
        const lesson = assembleTeacherLesson(s, "deeper", request, false, [], raw);
        await writeFile(`test-artifacts/exam-ready-3-live-${subjectId}.json`, JSON.stringify({ kind: "real provider-only sample; not authenticated end-to-end", elapsedMs: Math.round(performance.now() - started), lesson }, null, 2));
        expect(lesson.quality?.status).toBe("validated-structure");
        expect(lesson.example?.steps.length).toBeGreaterThanOrEqual(3);
        expect(lesson.questions.some(q => (q.difficulty ?? 0) >= 4)).toBe(true);
        console.info(JSON.stringify({ probe: `${subjectId}/${chapterId}`, elapsedMs: Math.round(performance.now() - started), questions: lesson.questions.length, quality: lesson.quality?.status }));
    }, 55000);
});
