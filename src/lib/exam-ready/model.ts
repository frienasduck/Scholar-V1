import { z } from "zod";
import { getCurriculum } from "@/lib/curriculum-helper";
import { sessionCoverage } from "./coverage";
import { numericSchema, rubricSchema, type ErrorCategory } from "./assessment";
export const materialModes = ["all", "scholar-web", "scholar", "personal-scholar", "personal", "custom", "verified"] as const;
export const setupSchema = z.object({
    exam: z.string().trim().min(2).max(120), grade: z.union([z.literal(9), z.literal(11)]), board: z.string().trim().min(1).max(60).default("CBSE"),
    examAt: z.number().int().positive(), minutes: z.number().int().min(15).max(43200),
    format: z.enum(["school", "mcq", "mixed", "short-answer"]), style: z.enum(["step-by-step", "concise", "examples"]),
    chapters: z.array(z.object({ subjectId: z.string().max(40), chapterId: z.string().max(60), confidence: z.number().int().min(1).max(5) })).min(1).max(16),
    materials: z.enum(materialModes), resourceIds: z.array(z.string().min(1).max(180)).max(12).default([]), excludedResourceIds: z.array(z.string().min(1).max(180)).max(100).optional(),
    blocks: z.array(z.object({ start: z.number().int().positive(), minutes: z.number().int().min(5).max(480) })).max(60).default([]),
    diagnostic: z.boolean().default(false),
    preferences: z.object({questionLevel:z.enum(["adaptive","easier","challenging","exam"]),revision:z.enum(["light","balanced","intense"]),recall:z.enum(["balanced","frequent"]),hints:z.enum(["minimal","gentle","detailed"])}).optional(),
}).superRefine((v, ctx) => {
    if (v.board.toUpperCase() !== "CBSE") ctx.addIssue({ code: "custom", path: ["board"], message: "Scholar's current chapter registry supports CBSE. Select CBSE and put a school/JEE practice goal in the exam name; another board's coverage cannot be assumed." });
    const curriculum = getCurriculum(v.grade), seen = new Set<string>();
    for (const c of v.chapters) {
        const key = `${c.subjectId}:${c.chapterId}`;
        if (seen.has(key) || !curriculum.find(s => s.id === c.subjectId)?.chapters.some(ch => ch.id === c.chapterId))
            ctx.addIssue({ code: "custom", path: ["chapters"], message: "Choose unique chapters from the current curriculum." });
        seen.add(key);
    }
    if (v.materials === "custom" && !v.resourceIds.length)
        ctx.addIssue({ code: "custom", path: ["resourceIds"], message: "Choose at least one source for custom materials." });
    const blocks = [...v.blocks].sort((a, b) => a.start - b.start);
    if (blocks.some((b, i) => b.start + b.minutes * 60000 > v.examAt || i > 0 && b.start < blocks[i - 1].start + blocks[i - 1].minutes * 60000))
        ctx.addIssue({ code: "custom", path: ["blocks"], message: "Study blocks must not overlap or extend past your exam." });
});
export type Setup = z.infer<typeof setupSchema>;
// New preparations start at fifteen minutes; an existing one may be compressed
// below that threshold or bounded by an imminent exam deadline.
export const storedSetupSchema = setupSchema.safeExtend({ minutes: z.number().int().min(1).max(43200) });
export type TaskKind = "diagnostic" | "learn" | "repair" | "revise" | "practice" | "recall" | "mistakes" | "mock" | "break";
export interface Task {
    id: string;
    subjectId: string;
    chapterId: string;
    topic: string;
    topics?: string[];
    objectiveIds?: string[];
    kind: TaskKind;
    title: string;
    objective: string;
    reason: string;
    seconds: number;
    priority: "critical" | "high" | "medium" | "optional";
    status: "pending" | "active" | "done" | "skipped";
    prerequisite?: string;
    scheduledAt?: number;
    checkpoint: string;
}
export interface Question {
    id: string;
    subjectId: string;
    chapterId: string;
    topic: string;
    kind: "mcq" | "short";
    question: string;
    options?: string[];
    answer: string;
    explanation: string;
    source: "Scholar question bank" | "Scholar AI-generated";
    citationIds?: string[];
    objectiveId?: string;
    difficulty?: number;
    marks?: number;
    estimatedSeconds?: number;
    rubric?: { id: string; criterion: string; points: number }[];
    numeric?: { value: number; unit: string; tolerance: number; expression: string };
    validation?: "schema-checked" | "calculation-checked";
    hints?: string[];
    algebraic?: {expression:string;variable:string};
    assistance?: "hint" | "solution";
}
export interface Attempt {
    id: string;
    taskId?: string;
    questionId: string;
    question?: string;
    subjectId: string;
    chapterId: string;
    topic: string;
    correct: boolean;
    answer: string;
    expected: string;
    explanation: string;
    at: number;
    kind: "diagnostic" | "practice" | "recall" | "mock";
    mistake?: string;
    evaluation: "objective" | "AI-assessed" | "self-reviewed";
    objectiveId?: string;
    difficulty?: number;
    score?: number;
    maxScore?: number;
    errorCategory?: ErrorCategory;
    assistance?: "hint" | "solution";
}
export interface Lesson {
    materialTrace?: import("./knowledge/types").MaterialTrace;
    recovery?: { pace: string; question: string };
    delivery?: {mode:"authored"|"live"|"support"|"offline-fallback";reason?:string;retryAt?:number};
    text: string;
    formulas: string[];
    questions: Question[];
    citations: import("@/lib/resources/types").Citation[];
    grounding: "source-grounded" | "general AI explanation" | "material gap" | "saved session evidence" | "offline curriculum guidance";
    concept?: { title: string; explanation: string; formula?: string; symbols?: string; conditions?: string };
    example?: { title: string; problem: string; steps: string[]; result: string; calculations?: { expression: string; value: number; unit: string; tolerance: number }[] };
    takeaway?: string;
    quality?: { version: string; objectiveIds: string[]; checks: string[]; status: "validated-structure" | "partial"; limitations: string[] };
}
export interface ExamSession {
    id: string;
    revision: number;
    setup: Setup;
    status: "active" | "paused" | "completed";
    createdAt: number;
    updatedAt: number;
    clock: {
        elapsedMs: number;
        runningSince: number | null;
        budgetMs?: number;
    };
    taskSince: number;
    taskElapsedMs: number;
    tasks: Task[];
    attempts: Attempt[];
    notes: string;
    important: boolean;
    history: {
        at: number;
        reason: string;
        version: number;
    }[];
    planVersion: number;
    lessons: Record<string, Lesson>;
    revisionItems?: Record<string, { objectiveId: string; topic: string; summary: string; formulas: string[]; example?: string; citations: import("@/lib/resources/types").Citation[];sourceVersions?:{sourceId:string;version:string}[] }>;
    mock?: {
        score: number;
        total: number;
        at: number;
        verified: boolean;
    };
    chat: {
        role: "user" | "assistant";
        content: string;
    }[];
}
export const lessonSchema = z.object({ text: z.string().min(20).max(16000), formulas: z.array(z.string().max(500)).max(12).default([]),
    concept: z.object({ title: z.string().min(1).max(160), explanation: z.string().min(1).max(2400), formula: z.string().max(500).optional(), symbols: z.string().max(1200).optional(), conditions: z.string().max(1200).optional() }).optional(),
    example: z.object({ title: z.string().min(1).max(160), problem: z.string().min(1).max(1800), steps: z.array(z.string().min(1).max(1000)).min(1).max(8), result: z.string().min(1).max(1000), calculations: z.array(numericSchema).min(1).max(8).optional() }).optional(),
    takeaway: z.string().max(1200).optional(),
    questions: z.array(z.object({ question: z.string().min(8).max(1800), topic: z.string().max(240), kind: z.enum(["mcq", "short"]), options: z.array(z.string().min(1).max(700)).length(4).optional(), answer: z.string().min(1).max(2000), explanation: z.string().min(5).max(3000), citationIds: z.array(z.string().regex(/^S\d+$/)).max(6).default([]), objectiveId: z.string().max(120).optional(), difficulty: z.number().int().min(1).max(5).optional(), marks: z.number().int().min(1).max(20).optional(), estimatedSeconds: z.number().int().min(15).max(1800).optional(), rubric: rubricSchema.optional(), numeric: numericSchema.optional() })).max(5) }).superRefine((v, ctx) => { for (const q of v.questions)
    if (q.kind === "mcq" && (!q.options?.includes(q.answer) || new Set(q.options).size !== 4))
        ctx.addIssue({ code: "custom", message: "MCQ answer must match one of four distinct options." }); });
export const actionSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("pause") }), z.object({ type: z.literal("resume") }), z.object({ type: z.literal("next") }), z.object({ type: z.literal("skip") }),
    z.object({ type: z.literal("replan"), minutes: z.number().int().min(1).max(43200), reason: z.string().max(120) }),
    z.object({ type: z.literal("notes"), text: z.string().max(20000), important: z.boolean() }),
    z.object({ type: z.literal("answer"), questionId: z.string().max(200), answer: z.string().trim().min(1).max(3000) }),
    z.object({ type: z.literal("settings"), setup: storedSetupSchema }),
    z.object({ type: z.literal("complete") }),
]);
export type Action = z.infer<typeof actionSchema>;
export const elapsedMs = (s: ExamSession, now = Date.now()) => s.clock.elapsedMs + (s.clock.runningSince === null ? 0 : Math.max(0, now - s.clock.runningSince));
export const remainingSeconds = (s: ExamSession, now = Date.now()) => Math.max(0, Math.floor(Math.min((s.clock.budgetMs ?? s.setup.minutes * 60000) - elapsedMs(s, now), s.setup.examAt - now) / 1000));
export const currentTask = (s: ExamSession) => s.tasks.find(t => t.status === "active") ?? s.tasks.find(t => t.status === "pending");
export function subjectChapter(setup: Setup, subjectId: string, chapterId: string) { return getCurriculum(setup.grade).find(s => s.id === subjectId)?.chapters.find(c => c.id === chapterId); }
/** Repair the old first-concept-only metadata without erasing saved progress. */
export function restoreMissionCoverage(session: ExamSession): ExamSession {
    const changed = new Set<string>();
    const tasks = session.tasks.map(task => {
        if (task.topics?.length || task.status === "done" || task.status === "skipped" || task.kind === "break" || task.kind === "mock") return task;
        const chapter = subjectChapter(session.setup, task.subjectId, task.chapterId);
        if (!chapter) return task;
        changed.add(task.id);
        return { ...task, topics: chapter.concepts.length ? chapter.concepts : [chapter.title], topic: `${chapter.title} · chapter coverage` };
    });
    if (!changed.size) return session;
    // A cached first-concept lesson cannot stand in for the repaired coverage.
    const lessons = Object.fromEntries(Object.entries(session.lessons).filter(([key]) => ![...changed].some(id => key.startsWith(`${id}:`))));
    return { ...session, tasks, lessons };
}
export function evidence(s: ExamSession) {
    const attempts = s.attempts.filter(a => a.evaluation !== "self-reviewed"&&!a.assistance), unique = new Map(attempts.map(a => [a.questionId, a]));
    const values = [...unique.values()], correct = values.filter(a => a.correct).length;
    const coverage = sessionCoverage(s), testedObjectives = coverage.reduce((n, c) => n + c.objectives.filter(o=>o.independentTested).length, 0), totalObjectives = coverage.reduce((n, c) => n + c.objectives.length, 0);
    const covered = coverage.filter(c => c.objectives.every(o=>o.independentTested) && c.tested > 0).length;
    const accuracy = values.length ? Math.round(values.reduce((n, a) => n + (a.score ?? Number(a.correct)) / Math.max(1, a.maxScore ?? 1), 0) / values.length * 100) : null;
    // No evidence means no score; confidence and checked boxes cannot manufacture mastery.
    const demonstrated = coverage.reduce((n, c) => n + c.demonstrated, 0);
    const readiness = values.length >= 5 && testedObjectives >= 2 ? Math.round(Math.min(accuracy! * Math.min(1, values.length / 15), totalObjectives ? testedObjectives / totalObjectives * 100 : 0)) : null;
    return { accuracy, readiness, questions: values.length, correct, covered, totalChapters: s.setup.chapters.length, testedObjectives, totalObjectives, demonstratedObjectives: demonstrated, assistedAnswers:s.attempts.filter(a=>a.assistance).length,mistakes: attempts.filter(a => !a.correct), label: readiness === null ? "Not enough objective-level evidence yet" : values.length < 15 ? "Early estimate · limited evidence" : "Preparation estimate · tested coverage, not a predicted exam score" };
}
