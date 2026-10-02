import { navigateTo } from "@/lib/nav-event";
import { currentTask, remainingSeconds, type ExamSession } from "./model";
export interface MockHandoff {
    id: string;
    owner?: string;
    grade: 9 | 11;
    subjectId: string;
    chapterIds: string[];
    duration: number;
    numQuestions: number;
    pattern: "mcq-only" | "mixed" | "subjective";
    at: number;
}
export function mockConfiguration(s: ExamSession, now = Date.now()): MockHandoff {
    const task = currentTask(s), seconds = Math.max(60, Math.min(remainingSeconds(s, now), task?.kind === "mock" ? task.seconds : remainingSeconds(s, now) * .2));
    return { id: s.id, grade: s.setup.grade, subjectId: task?.subjectId ?? s.setup.chapters[0].subjectId, chapterIds: s.setup.chapters.map(c => c.chapterId), duration: Math.max(1, Math.floor(seconds / 60)), numQuestions: Math.max(2, Math.min(20, Math.floor(seconds / 90))), pattern: s.setup.format === "mcq" || seconds <= 600 ? "mcq-only" : s.setup.format === "short-answer" ? "subjective" : "mixed", at: now };
}
const KEY = "scholar:exam-ready:mock";
const runKey = (handoff: MockHandoff) => `${KEY}:run:${handoff.owner}:${handoff.grade}:${handoff.id}`;
export function readExamReadyRun<T>(handoff: MockHandoff): T | null { try {
    if (!handoff.owner)
        return null;
    const raw = sessionStorage.getItem(runKey(handoff));
    if (!raw || raw.length > 400000)
        return null;
    return JSON.parse(raw) as T;
}
catch {
    return null;
} }
export function saveExamReadyRun(handoff: MockHandoff, value: unknown) { try {
    if (!handoff.owner)
        return;
    const raw = JSON.stringify(value);
    if (raw.length <= 400000)
        sessionStorage.setItem(runKey(handoff), raw);
}
catch { /* The server-owned paper and preparation remain durable. */ } }
export function openExamReadyMock(s: ExamSession, owner: string) { sessionStorage.setItem(KEY, JSON.stringify({ ...mockConfiguration(s), owner })); navigateTo("mock-exam"); }
export function readExamReadyMock(grade: 9 | 11, owner: string | undefined): MockHandoff | null { try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as MockHandoff | null;
    return v && owner && v.owner === owner && v.grade === grade && Date.now() - v.at < 6 * 60 * 60000 ? v : null;
}
catch {
    return null;
} }
export function returnFromExamReadyMock(id: string) { sessionStorage.removeItem(KEY); sessionStorage.setItem("scholar:exam-ready:resume", id); navigateTo("exam-prep"); }
