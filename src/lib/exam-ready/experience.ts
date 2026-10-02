import { currentTask, remainingSeconds, subjectChapter, type ExamSession, type Lesson, type TaskKind } from "./model";

export const stageLabels: Record<TaskKind, string> = { diagnostic: "Calibrate", learn: "Learn", repair: "Repair", revise: "Final review", practice: "Apply", recall: "Recall", mistakes: "Repair mistakes", mock: "Mock test", break: "Reset" };
export function formatTime(seconds: number) {
    const n = Math.max(0, Math.floor(seconds));
    return n >= 86400 ? `${Math.floor(n / 86400)}d ${Math.floor(n % 86400 / 3600)}h` : n >= 3600 ? `${Math.floor(n / 3600)}h ${Math.floor(n % 3600 / 60)}m` : `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
}
export function chapterSignals(s: ExamSession) {
    return s.setup.chapters.map(c => {
        const attempts = [...new Map(s.attempts.filter(a => a.subjectId === c.subjectId && a.chapterId === c.chapterId && a.evaluation !== "self-reviewed").map(a => [a.questionId, a])).values()];
        const accuracy = attempts.length ? Math.round(attempts.filter(a => a.correct).length / attempts.length * 100) : null;
        const tasks = s.tasks.filter(t => t.subjectId === c.subjectId && t.chapterId === c.chapterId && t.kind !== "break");
        return { ...c, title: subjectChapter(s.setup, c.subjectId, c.chapterId)?.title ?? c.chapterId, accuracy, questions: attempts.length, completed: tasks.filter(t => t.status === "done").length, total: tasks.length, priority: accuracy !== null ? accuracy < 65 ? "Repair first" : "Keep practising" : c.confidence <= 2 ? "Start here" : "Verify understanding" };
    }).sort((a, b) => (a.accuracy ?? a.confidence * 20) - (b.accuracy ?? b.confidence * 20));
}
export function adaptiveMinutes(s: ExamSession, direction: "behind" | "more", now = Date.now()) {
    const remaining = Math.max(1, Math.ceil(remainingSeconds(s, now) / 60));
    const untilExam = Math.max(1, Math.floor((s.setup.examAt - now) / 60000));
    return Math.min(43200, untilExam, direction === "behind" ? Math.max(1, Math.floor(remaining * .65)) : remaining + Math.max(15, Math.ceil(remaining * .5)));
}
export function isShortSprint(s: ExamSession, now = Date.now()) {
    return remainingSeconds(s, now) <= 1800;
}
/** A realistic suggestion, not the entire wall-clock time until the exam. */
export function recommendStudyBudget(examAt: number, now: number, dailyHours = 2) {
    const horizon = Math.max(0, Math.floor((examAt - now) / 60000));
    if (horizon < 2880) return { minutes: Math.max(15, Math.min(horizon, horizon <= 30 ? 15 : horizon <= 360 ? 60 : 120)), blocks: [] as ExamSession["setup"]["blocks"] };
    const dailyMinutes = Math.max(15, Math.min(480, Math.round((Number.isFinite(dailyHours) && dailyHours > 0 ? dailyHours : 2) * 60)));
    const blocks = Array.from({ length: Math.min(30, Math.ceil(horizon / 1440)) }, (_, i) => ({ start: now + i * 86400000, minutes: Math.min(dailyMinutes, Math.floor((examAt - now - i * 86400000) / 60000)) })).filter(b => b.minutes >= 15);
    return { minutes: blocks.reduce((sum, b) => sum + b.minutes, 0), blocks };
}
// An explicit offline demonstration, never a generated lesson or readiness evidence.
// It is separate from stored lessons, sources, attempts and the account AI pipeline.
export function previewLesson(): Lesson {
    return {
        text: "A force changes motion. For a fixed mass, increasing the net force increases acceleration. Let's connect the idea to an equation, work through an example, then check it yourself.",
        concept: { title: "Newton’s Second Law", explanation: "Acceleration depends on the net external force and the mass. Its direction is the direction of that net force.", formula: "$$\\vec F_{net} = m\\vec a$$", symbols: "F: net force in newtons (N) · m: mass in kilograms (kg) · a: acceleration in metres per second squared (m/s²).", conditions: "Constant mass, in an inertial reference frame. Add forces as vectors before substituting." },
        example: { title: "From force to acceleration", problem: "A 4 kg object has a net horizontal force of 20 N. Find its acceleration.", steps: ["Use the net force, not just one of the applied forces.", "a = F / m = 20 / 4"], result: "Acceleration is 5 m/s² in the direction of the net force." },
        takeaway: "A force in the opposite direction gives an acceleration in the opposite direction. Do not lose the vector direction.",
        formulas: ["F = ma · F in N, m in kg, a in m/s² · constant mass, inertial frame", "p = mv · momentum in kg·m/s; momentum and velocity are vectors"],
        questions: [{ id: "preview:newton-2", subjectId: "physics", chapterId: "p5", topic: "Newton’s Second Law", kind: "mcq", question: "A net force of 15 N gives a body an acceleration of 3 m/s². What acceleration will 25 N give the same body?", options: ["3 m/s²", "5 m/s²", "6 m/s²", "9 m/s²"], answer: "5 m/s²", explanation: "First find the mass: $m = 15 / 3 = 5\\,\\mathrm{kg}$. Then $a = 25 / 5 = 5\\,\\mathrm{m/s^2}$. Use the same mass in both cases.", source: "Scholar question bank" }],
        citations: [], grounding: "general AI explanation",
    };
}
export function activeLesson(s: ExamSession, key = "") {
    const task = currentTask(s);
    if (!task) return undefined;
    if (key.startsWith(`${task.id}:`) && s.lessons[key]) return s.lessons[key];
    return Object.entries(s.lessons).filter(([k]) => k.startsWith(`${task.id}:`)).at(-1)?.[1];
}
