import { arithmetic } from "./assessment";
import { ACADEMIC_VERSION, chapterManifest } from "./coverage";
import { currentTask, type ExamSession, type Lesson, type Question } from "./model";
import { equivalentPolynomials } from "./algebra";
export class AcademicQualityError extends Error {
    constructor(public issues: string[]) { super("The lesson was incomplete or failed academic checks. Your last validated lesson is preserved. Retry this checkpoint."); }
}
export function targetDifficulty(s: ExamSession) {
    const task = currentTask(s), chapter = s.setup.chapters.find(c => c.subjectId === task?.subjectId && c.chapterId === task?.chapterId);
    const attempts = s.attempts.filter(a => a.evaluation !== "self-reviewed" && a.subjectId === task?.subjectId && a.chapterId === task?.chapterId).slice(-6);
    const accuracy = attempts.length ? attempts.filter(a => a.correct).length / attempts.length : null;
    const independent=attempts.filter(a=>!a.assistance), varied=new Set(independent.map(a=>a.questionId)).size;
    return accuracy !== null ? accuracy < .4 ? 2 : accuracy >= .8 && varied>=3 && independent.some(a=>a.correct&&(a.difficulty??1)>=3) ? 4 : accuracy>=.6 ? 3 : 2 : (chapter?.confidence ?? 1) >= 4 ? 4 : (chapter?.confidence ?? 1) >= 3 ? 3 : 2;
}
export function requestedDifficulty(s: ExamSession, question: string) {
    const configured=s.setup.preferences?.questionLevel;
    const base=configured==="easier"?2:configured==="challenging"?Math.max(4,targetDifficulty(s)):configured==="exam"?4:targetDifficulty(s);
    return /\b(expert|jee advanced)\b/i.test(question)?5:/\b(harder|difficult|challenge|advanced|jee)\b/i.test(question) ? Math.max(4, base) : /\b(easier|simpler|beginner|from the beginning)\b/i.test(question) ? 2 : base;
}
export function validateQuestion(q: Question, s: ExamSession, requireMetadata = true) {
    const issues: string[] = [], manifest = chapterManifest(s.setup.grade, q.subjectId, q.chapterId);
    if (!s.setup.chapters.some(c => c.subjectId === q.subjectId && c.chapterId === q.chapterId)) issues.push("question outside selected chapter");
    if (requireMetadata && (!q.objectiveId || !manifest.objectives.some(o => o.id === q.objectiveId))) issues.push("question missing a valid coverage objective");
    if (requireMetadata && (!q.difficulty || !q.marks || !q.estimatedSeconds)) issues.push("question missing difficulty, marks or estimated time");
    if (q.kind === "mcq" && (!q.options?.includes(q.answer) || new Set(q.options.map(x => x.trim().toLowerCase())).size !== 4)) issues.push("ambiguous MCQ options");
    if (q.explanation.trim().length < (requireMetadata ? 80 : 5)) issues.push("question has no meaningful worked reasoning");
    if (q.rubric && (new Set(q.rubric.map(r => r.id)).size !== q.rubric.length || Math.abs(q.rubric.reduce((n, r) => n + r.points, 0) - (q.marks ?? 1)) > .001)) issues.push("rubric points do not match marks");
    if (requireMetadata && q.kind === "short" && !q.rubric) issues.push("written answer has no scoring rubric");
    if (q.numeric) {
        try { const recalculated = arithmetic(q.numeric.expression); if (Math.abs(recalculated - q.numeric.value) > Math.max(1e-9, Math.abs(q.numeric.value) * q.numeric.tolerance)) issues.push("numerical key contradicts calculation"); }
        catch { issues.push("unverifiable numerical calculation"); }
        const stated = q.answer.trim().replace(/^\$+|^\\\(/g, "").match(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)/);
        if (!stated || Math.abs(Number(stated[0]) - q.numeric.value) > Math.max(1e-9, Math.abs(q.numeric.value) * q.numeric.tolerance)) issues.push("answer key does not match the verified numerical result");
    }
    if(q.algebraic&&equivalentPolynomials(q.algebraic.expression,q.answer,q.algebraic.variable)!==true)issues.push("symbolic key is unsupported or contradicts its polynomial contract");
    if(/solid cylinder/i.test(q.question)&&/inclined|angle|\d+\s*°/.test(q.question)&&/perpendicular[\s‑-]*axis theorem/i.test(q.explanation)&&!/thin (?:disc|disk|lamina)/i.test(q.question))issues.push("perpendicular-axis theorem applied to a three-dimensional solid without valid planar assumptions");
    const numericalTask = /\d[\s\u202f]*(?:kg|g\b|N\b|m\/s|mol|M\b|cm|m\b|°)/.test(q.question) || /\b(coefficient|\d(?:st|nd|rd|th) term)\b/i.test(q.question);
    if (requireMetadata && numericalTask && !q.numeric) issues.push("numerical problem lacks an independent calculation contract");
    if (/\b(wait,?\s*(?:check|actually)|correct answer:|actually,?\s*(?:the (?:correct )?(?:answer|result) is|use .* instead))\b/i.test(q.explanation)) issues.push("solution contains an unresolved answer correction");
    if ((q.difficulty ?? 1) >= 4 && q.question.length < 90) issues.push("challenge label unsupported by problem context");
    if ((q.difficulty ?? 1) >= 4 && q.numeric && (q.numeric.expression.match(/[+*/^()-]/g)?.length ?? 0) < 2) issues.push("multi-step label has only a single arithmetic operation");
    if ((q.difficulty ?? 1) >= 4 && !q.numeric && q.explanation.length < 200) issues.push("challenge has insufficient developed reasoning");
    if (issues.length) throw new AcademicQualityError(issues);
    return { ...q, validation: q.numeric ? "calculation-checked" as const : "schema-checked" as const };
}
export function validateLesson(l: Lesson, s: ExamSession, pace: string, request = ""): Lesson {
    const task = currentTask(s); if (!task) throw new AcademicQualityError(["no active checkpoint"]);
    if (l.grounding === "material gap") return { ...l, quality: { version: ACADEMIC_VERSION, status: "partial", objectiveIds: [], checks: [], limitations: ["Selected source material does not support a complete lesson."] } };
    if (["notes summary", "notes flashcards"].includes(pace)) {
        if (l.text.trim().length < 140) throw new AcademicQualityError(["incomplete notes artifact"]);
        return { ...l, questions: [], quality: { version: ACADEMIC_VERSION, status: "partial", objectiveIds: [], checks: ["notes artifact structure"], limitations: ["Revision and note summaries are not evidence of mastery."] } };
    }
    const teaching = ["learn", "repair", "revise"].includes(task.kind), quiz = ["quiz","notes quiz"].includes(pace) || ["diagnostic", "practice", "recall"].includes(task.kind);
    const issues: string[] = [];
    const developed = l.text.length + (l.concept?.explanation.length ?? 0) + (l.example?.steps.join(" ").length ?? 0);
    if (l.text.trim().length < (quiz ? 60 : 100) || !quiz && developed < (pace === "faster" ? 300 : 800)) issues.push("shallow or truncated teaching");
    if (teaching && !quiz && (!l.concept || l.concept.explanation.length < 120)) issues.push("missing concept explanation");
    if (teaching && !quiz && pace !== "faster" && (!l.example || l.example.steps.length < 3 || l.example.steps.join(" ").length < 140)) issues.push("missing complete worked example");
    if (l.example && (/\d[\s\u202f]*(?:kg|N\b|mol|m\b|°)/.test(l.example.problem) || /\bcoefficient\b/i.test(l.example.problem))) {
        if (!l.example.calculations?.length) issues.push("worked numerical has no independent calculation trace");
        else for (const row of l.example.calculations) { try { if (Math.abs(arithmetic(row.expression) - row.value) > Math.max(1e-9, Math.abs(row.value) * row.tolerance)) issues.push("worked example arithmetic contradicts result"); } catch { issues.push("unverifiable worked calculation"); } }
    }
    if (!l.questions.length) issues.push("no usable learning checkpoint");
    const questions = l.questions.map(q => validateQuestion(q, s));
    if (requestedDifficulty(s, request) >= 4 && !questions.some(q => (q.difficulty ?? 1) >= 4)) issues.push("advanced preparation returned only basic questions");
    const activeObjectives = task.objectiveIds ?? chapterManifest(s.setup.grade, task.subjectId, task.chapterId).objectives.filter(o => (task.topics ?? [task.topic]).includes(o.topic)).map(o => o.id);
    if (questions.some(q => !activeObjectives.includes(q.objectiveId!))) issues.push("question is unrelated to this checkpoint");
    if (!quiz && task.kind !== "mistakes" && questions.some(q => l.text.includes(q.answer) && q.answer.length > 8)) issues.push("teaching reveals the checkpoint answer");
    if (issues.length) throw new AcademicQualityError(issues);
    return { ...l, questions, quality: { version: ACADEMIC_VERSION, status: "validated-structure", objectiveIds: teaching && !quiz ? [...new Set(questions.map(q => q.objectiveId!))] : [], checks: ["topic scope", "teaching depth", "worked reasoning", "question contract", "calculation when supplied"], limitations: ["Structural and calculation checks are not independent certification of every scientific claim."] } };
}
