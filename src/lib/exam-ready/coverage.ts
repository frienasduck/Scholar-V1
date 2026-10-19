import { getCurriculum } from "@/lib/curriculum-helper";
import type { Chapter } from "@/lib/curriculum-class11";
import type { ExamSession, Question, Setup } from "./model";
import { sourceGuidance } from "./source-guidance";
import { syllabusAlignment } from "./knowledge/syllabus-alignment";
import { questionPattern } from "./question-pattern";

export const ACADEMIC_VERSION = "exam-ready-3.1.0";
const normal = (text: string) => text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export interface CoverageObjective { id: string; topic: string; order: number; origin: "concept" | "learning-objective" | "syllabus-scope" }
export interface CoverageManifest {
    grade: 9 | 11; board: "CBSE"; subjectId: string; chapterId: string; title: string;
    objectives: CoverageObjective[]; prerequisites: string[]; formulas: string[]; revision: string[]; mistakes: string[];
    scope: "Scholar curriculum registry; current-year syllabus alignment requires review";
    sourceGuidance: ReturnType<typeof sourceGuidance>;
}
const cache = new Map<string, CoverageManifest>();
export function chapterManifest(grade: 9 | 11, subjectId: string, chapterId: string): CoverageManifest {
    const key = `${grade}:${subjectId}:${chapterId}`, cached = cache.get(key);
    if (cached) return cached;
    const chapter = getCurriculum(grade).find(s => s.id === subjectId)?.chapters.find(c => c.id === chapterId) as Chapter | undefined;
    if (!chapter) throw new Error("This chapter is not in the selected Scholar curriculum.");
    const seen = new Set<string>(), objectives: CoverageObjective[] = [];
    const guidance = sourceGuidance(grade, subjectId, chapterId);
    for (const [origin, values] of [["concept", chapter.concepts], ["learning-objective", chapter.learningObjectives ?? []], ["syllabus-scope", guidance.additionalObjectives]] as const) {
        for (const topic of values) {
            const label = normal(topic);
            if (!label || seen.has(label)) continue;
            seen.add(label);
            objectives.push({ id: `${key}:o${objectives.length + 1}`, topic, order: objectives.length, origin });
        }
    }
    const result: CoverageManifest = { grade, board: "CBSE", subjectId, chapterId, title: chapter.title, objectives, prerequisites: chapter.prerequisites ?? [], formulas: chapter.formulas ?? [], revision: chapter.quickSummary ?? [chapter.summary], mistakes: chapter.commonMistakes ?? [], sourceGuidance: guidance, scope: "Scholar curriculum registry; current-year syllabus alignment requires review" };
    cache.set(key, result);
    return result;
}
export function curriculumInventory() {
    return ([9, 11] as const).flatMap(grade => getCurriculum(grade).flatMap(s => s.chapters.map(c => chapterManifest(grade, s.id, c.id))));
}
export function objectiveForQuestion(setup: Setup, q: Pick<Question, "subjectId" | "chapterId" | "topic" | "objectiveId">) {
    const manifest = chapterManifest(setup.grade, q.subjectId, q.chapterId);
    // Never infer several mastered objectives from one broad chapter question.
    return manifest.objectives.find(o => o.id === q.objectiveId) ?? manifest.objectives.find(o => normal(o.topic) === normal(q.topic));
}
export function sessionCoverage(session: ExamSession) {
    const checked = [...new Map(session.attempts.filter(a => a.evaluation !== "self-reviewed").map(a => [a.questionId, a])).values()];
    return session.setup.chapters.map(c => {
        const manifest = chapterManifest(session.setup.grade, c.subjectId, c.chapterId);
        const lessons = Object.values(session.lessons).filter(l => l.quality?.version === ACADEMIC_VERSION);
        const objectives = manifest.objectives.map(o => {
            const attempts = checked.filter(a => a.subjectId === c.subjectId && a.chapterId === c.chapterId && (a.objectiveId === o.id || !a.objectiveId && normal(a.topic) === normal(o.topic)));
            const taught = !!session.revisionItems?.[o.id] || lessons.some(l => l.quality?.objectiveIds.includes(o.id));
            const latest = attempts.at(-1);
            const independent=attempts.filter(a=>!a.assistance);
            const application=independent.filter(a=>a.correct&&(a.difficulty??1)>=3&&["practice","diagnostic"].includes(a.kind));
            const transfer=(first:typeof independent[number],recall:typeof independent[number])=>first.questionId!==recall.questionId&&!!first.question&&!!recall.question&&questionPattern(first.question)!==questionPattern(recall.question);
            const recalledLater=independent.some(recall=>recall.correct&&["recall","mock"].includes(recall.kind)&&application.some(first=>transfer(first,recall)&&recall.at-first.at>=15*60000));
            const retainedAcrossDays=independent.some(recall=>recall.correct&&["recall","mock"].includes(recall.kind)&&application.some(first=>transfer(first,recall)&&recall.at-first.at>=86400000));
            const demonstrated = independent.length >= 2 && latest?.correct === true && !latest.assistance && recalledLater;
            return { ...o, taught, tested: attempts.length > 0, independentTested:independent.length>0,recalledLater,retainedAcrossDays,demonstrated, attempts: attempts.length, accuracy: attempts.length ? attempts.reduce((n, a) => n + (a.score ?? Number(a.correct)) / (a.maxScore ?? 1), 0) / attempts.length : null, needsRepair: latest?.correct === false };
        });
        return { ...manifest, objectives, taught: objectives.filter(o => o.taught).length, tested: objectives.filter(o => o.tested).length, demonstrated: objectives.filter(o => o.demonstrated).length };
    });
}

/** Select a bounded chunk of work; the manifest still records omitted topics. */
export function focusTopics(manifest: CoverageManifest, seconds: number, confidence: number, attempts: ExamSession["attempts"]) {
    const alignment=syllabusAlignment(manifest.grade,manifest.subjectId,manifest.chapterId);
    const core=manifest.objectives.filter(o=>!alignment.extensionObjectiveIndexes.includes(o.order));
    const gaps = core.filter(o => attempts.some(a => !a.correct && a.evaluation !== "self-reviewed" && a.subjectId === manifest.subjectId && a.chapterId === manifest.chapterId && (a.objectiveId === o.id || normal(a.topic) === normal(o.topic))));
    const available = Math.max(1, Math.floor(seconds / (confidence >= 4 ? 180 : 360)));
    const chosen = [...new Map([...gaps, ...core].map(o => [o.id, o])).values()].slice(0, available);
    // Prerequisites precede applications for a novice; evidence changes allocation,
    // not the underlying curriculum dependency order.
    return confidence <= 2 ? chosen.sort((a, b) => a.order - b.order) : chosen;
}
