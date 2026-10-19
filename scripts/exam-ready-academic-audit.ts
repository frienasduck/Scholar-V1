import { mkdir, writeFile } from "node:fs/promises";
import { getCurriculum } from "../src/lib/curriculum-helper";
import { loadSubjectQuizzes } from "../src/lib/quizzes-loader";
import { createSession } from "../src/lib/exam-ready/planner";
import { localMissionLesson } from "../src/lib/exam-ready/preview";
import { lessonSchema, type Setup } from "../src/lib/exam-ready/model";
import { validateLesson } from "../src/lib/exam-ready/quality";
import { curriculumInventory } from "../src/lib/exam-ready/coverage";
import catalog from "../src/lib/resources/catalog.json";
import snapshots from "../src/lib/resources/snapshots.json";

// Offline inventory, not a live-provider or academic certification claim.
interface AuditRow { grade: number; subject: string; chapter: string; title: string; topics: number; summaryCharacters: number; bankQuestions: number; sourceLinks: number; indexedSources: number; offlineWorkedExample: boolean; offlineLessonCharacters: number; planSeconds: number }
const now = Date.UTC(2026, 9, 12, 12), rows: AuditRow[] = [];
for (const grade of [9, 11] as const) for (const subject of getCurriculum(grade)) {
    const bank = grade === 11 && ["physics", "chemistry", "maths", "cs"].includes(subject.id) ? loadSubjectQuizzes(subject.id) : [];
    for (const chapter of subject.chapters) {
        const setup: Setup = { exam: "Academic audit", grade, board: "CBSE", examAt: now + 86400000, minutes: 120, format: "mixed", style: "step-by-step", chapters: [{ subjectId: subject.id, chapterId: chapter.id, confidence: 1 }], materials: "all", resourceIds: [], blocks: [], diagnostic: false };
        const session = createSession("audit", setup, now), lesson = localMissionLesson(session);
        const resources = catalog.filter(r => r.mappings.some(m => m.grade === grade && m.subjectId === subject.id && m.chapterId === chapter.id));
        const readable = resources.filter(r => r.canStoreCopy && r.canGenerateDerivatives && snapshots.some(s => s.resourceId === r.id && s.sections.some(t => t.text.trim())));
        rows.push({ grade, subject: subject.id, chapter: chapter.id, title: chapter.title, topics: chapter.concepts.length, summaryCharacters: chapter.summary.length, bankQuestions: bank.filter(q => q.chapterId === chapter.id).length, sourceLinks: resources.length, indexedSources: readable.length, offlineWorkedExample: !!lesson?.example, offlineLessonCharacters: lesson?.text.length ?? 0, planSeconds: session.tasks.reduce((n, t) => n + t.seconds, 0) });
    }
}
const performanceStart = performance.now();
for (let i = 0; i < 1000; i++) createSession("benchmark", { exam: "Physics", grade: 11, board: "CBSE", examAt: now + 86400000, minutes: 120, format: "mixed", style: "examples", chapters: [{ subjectId: "physics", chapterId: "p5", confidence: 1 }, { subjectId: "physics", chapterId: "p6", confidence: 1 }], materials: "all", resourceIds: [], blocks: [], diagnostic: false }, now);
const planMeanMs = (performance.now() - performanceStart) / 1000;
let shallowLessonAccepted = false;
try { const fixture = createSession("quality-probe", { exam: "Probe", grade: 11, board: "CBSE", examAt: now + 86400000, minutes: 120, format: "mixed", style: "examples", chapters: [{ subjectId: "physics", chapterId: "p5", confidence: 1 }], materials: "all", resourceIds: [], blocks: [], diagnostic: false }, now); validateLesson({ text: "Twenty characters are enough.", formulas: [], questions: [], citations: [], grounding: "general AI explanation" }, fixture, "normal"); shallowLessonAccepted = true; } catch { /* Expected rejection by the real teaching-quality boundary. */ }
const report = { generatedAt: new Date().toISOString(), kind: "deterministic inventory; not live academic certification", chapters: rows.length, manifests: curriculumInventory().length, objectives: curriculumInventory().reduce((n, c) => n + c.objectives.length, 0), chaptersWithBank: rows.filter(r => r.bankQuestions > 0).length, chaptersWithIndexedSources: rows.filter(r => r.indexedSources > 0).length, chaptersWithOfflineWorkedExample: rows.filter(r => r.offlineWorkedExample).length, shallowLessonAccepted, legacyPersistenceSchemaAllowsSmallLesson: lessonSchema.safeParse({ text: "Twenty characters are enough.", questions: [] }).success, planMeanMs, rows };
const target = process.argv[2] ?? "test-artifacts/exam-ready-3-baseline.json";
await mkdir("test-artifacts", { recursive: true });
await writeFile(target, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, rows: undefined, artifact: target }));
