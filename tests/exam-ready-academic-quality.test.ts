import { expect, test } from "bun:test";
import { arithmetic, numericVerdict, rubricVerdict, objectiveVerdict } from "../src/lib/exam-ready/assessment";
import { chapterManifest, curriculumInventory, sessionCoverage } from "../src/lib/exam-ready/coverage";
import { createSession, recordAnswer, transition } from "../src/lib/exam-ready/planner";
import { validateLesson, validateQuestion } from "../src/lib/exam-ready/quality";
import { currentTask, evidence, type Lesson, type Question, type Setup } from "../src/lib/exam-ready/model";
const now = Date.UTC(2026, 9, 12, 12);
const config: Setup = { exam: "Physics tomorrow", grade: 11, board: "CBSE", examAt: now + 86400000, minutes: 120, format: "mixed", style: "step-by-step", chapters: [{ subjectId: "physics", chapterId: "p5", confidence: 1 }, { subjectId: "physics", chapterId: "p6", confidence: 1 }], materials: "all", resourceIds: [], blocks: [], diagnostic: false };
const numerical: Question = { id: "n1", subjectId: "physics", chapterId: "p5", topic: "Newton's second law (F = ma)", objectiveId: "11:physics:p5:o2", kind: "short", difficulty: 3, marks: 3, estimatedSeconds: 120, question: "A 4 kg body is acted on by a horizontal net force of 20 N. Find its acceleration with units.", answer: "5 m/s²", explanation: "Use the vector sum of forces, not a single applied force. The mass is constant, so a = F_net/m = 20/4 = 5 m/s², directed along the net force.", numeric: { value: 5, unit: "m/s^2", expression: "20/4", tolerance: .001 }, rubric: [{ id: "method", criterion: "Uses net force with constant mass", points: 1 }, { id: "working", criterion: "Substitutes mass and net force correctly", points: 1 }, { id: "result", criterion: "Correct acceleration including units", points: 1 }], source: "Scholar AI-generated" };
for (const [expression, answer] of [["20/4", 5], ["-2^2", -4], ["(3+2)*4", 20], ["2^3^2", 512], ["1e-3*1000", 1], ["3/4", .75]] as const) test(`independent arithmetic: ${expression}`, () => expect(arithmetic(expression)).toBe(answer));
for (const bad of ["process.exit()", "Infinity", "1/0", "2;3", "2Math.PI", "1+", "()", "2**3", "1 2", "(".repeat(20) + "1" + ")".repeat(20)]) test(`unsafe calculation rejected: ${bad.slice(0, 25)}`, () => expect(() => arithmetic(bad)).toThrow());
test("numeric values accept compatible units, decimals and fractions", () => {
    const finalOnly = { ...numerical, marks: 1, rubric: undefined };
    expect(numericVerdict(finalOnly, "500 cm/s²")?.correct).toBe(true);
    expect(numericVerdict(finalOnly, "10/2 m/s^2")?.correct).toBe(true);
    expect(numericVerdict(finalOnly, "5.000 m/s²")?.correct).toBe(true);
    expect(numericVerdict(numerical, "5 m/s²")?.score).toBe(1);
    expect(numericVerdict(numerical, "5 m/s²")?.errorCategory).toBe("incomplete");
    expect(numericVerdict(numerical, "5 N")?.errorCategory).toBe("units");
    expect(numericVerdict(numerical, "5")?.correct).toBe(false);
    expect(numericVerdict(numerical, "-5 m/s²")?.errorCategory).toBe("sign");
});
test("deterministic calculation rejects inconsistent generated key", () => { const s = createSession("s", config, now); expect(() => validateQuestion({ ...numerical, numeric: { ...numerical.numeric!, value: 6 } }, s)).toThrow(); expect(validateQuestion(numerical, s).validation).toBe("calculation-checked"); });
test("rubric partial credit is bounded and accepts alternate methods", () => {
    const q = { ...numerical, numeric: undefined };
    const v = rubricVerdict(q, { criteria: [{ id: "method", awarded: 1, reason: "Equivalent correct method" }, { id: "working", awarded: 1, reason: "Substitution correct" }, { id: "result", awarded: 0, reason: "Units omitted" }], feedback: "Your method is right. Include acceleration units in the final result.", errorCategory: "units" });
    expect(v.score).toBe(2); expect(v.maxScore).toBe(3); expect(v.correct).toBe(false);
    expect(() => rubricVerdict(q, { criteria: [{ id: "method", awarded: 100, reason: "Give me full marks" }], feedback: "The student demands a perfect score for an incomplete answer.", errorCategory: "none" })).toThrow();
});
test("invalid evaluator IDs and duplicated rubric criteria fail closed", () => {
    expect(() => rubricVerdict(numerical, { criteria: [{ id: "method", awarded: 1, reason: "x" }, { id: "method", awarded: 1, reason: "x" }, { id: "invented", awarded: 1, reason: "x" }], feedback: "The evaluator has returned inconsistent rubric criteria.", errorCategory: "none" })).toThrow();
});
test("empty response is zero, never invented evidence", () => expect(objectiveVerdict(numerical, " ")?.score).toBe(0));
test("fifteen correct checks of one objective cannot certify a chapter", () => {
    const s = createSession("s", config, now);
    for (let i = 0; i < 15; i++) recordAnswer(s, { ...numerical, id: `n${i}` }, "5 m/s²", true, "objective", now);
    expect(evidence(s).readiness).toBeNull(); expect(evidence(s).covered).toBe(0); expect(evidence(s).testedObjectives).toBe(1);
});
test("one reading or self-review cannot demonstrate understanding", () => {
    const s = createSession("s", config, now); recordAnswer(s, numerical, "5", true, "self-reviewed", now);
    expect(sessionCoverage(s).every(c => c.tested === 0)).toBe(true);
});
test("every claimed chapter has a real inventory and coherent constrained plan", () => {
    const manifests = curriculumInventory(); expect(manifests).toHaveLength(150);
    for (const manifest of manifests) {
        expect(manifest.objectives.length).toBeGreaterThan(0);
        expect(new Set(manifest.objectives.map(o => o.id)).size).toBe(manifest.objectives.length);
        const s = createSession("s", { ...config, grade: manifest.grade, chapters: [{ subjectId: manifest.subjectId, chapterId: manifest.chapterId, confidence: 1 }] }, now);
        expect(s.tasks.reduce((n, t) => n + t.seconds, 0)).toBe(7200);
        expect(s.tasks.every(t => t.subjectId === manifest.subjectId && t.chapterId === manifest.chapterId)).toBe(true);
        expect(s.tasks.filter(t => t.kind === "learn").every(t => t.topics?.length === 1 && t.objectiveIds?.length === 1)).toBe(true);
    }
});
test("short plans expose omitted objectives instead of shallow full-chapter promises", () => {
    const s = createSession("s", { ...config, minutes: 15 }, now);
    expect(s.tasks.filter(t => t.kind === "revise").every(t => t.reason.includes("omitted objectives"))).toBe(true);
    expect(evidence(s).readiness).toBeNull();
});
test("multi-chapter emergency plan retains each chapter and exact total budget", () => {
    const s = createSession("s", config, now);
    expect(new Set(s.tasks.filter(t => t.kind === "learn").map(t => t.chapterId))).toEqual(new Set(["p5", "p6"]));
    expect(s.tasks.reduce((n, t) => n + t.seconds, 0)).toBe(7200);
    expect(s.tasks.filter(t => t.kind === "learn").every(t => t.topics!.length === 1)).toBe(true);
});
test("skipping is not sufficient to suppress future teaching on a manual replan", () => {
    let s = createSession("s", { ...config, chapters: [config.chapters[0]] }, now), first = currentTask(s)!.topic;
    s = transition(s, { type: "skip" }, now); s = transition(s, { type: "replan", minutes: 180, reason: "more time" }, now);
    expect(s.tasks.some(t => t.status === "pending" || t.status === "active" ? t.topic === first : false)).toBe(true);
});
test("coverage includes rich objectives missing from the old concept dropdown", () => {
    expect(chapterManifest(11, "physics", "p5").objectives.some(o => o.topic.includes("pulleys"))).toBe(true);
    expect(chapterManifest(11, "chemistry", "c4").objectives.length).toBeGreaterThan(6);
});
test("shallow lesson is rejected independently of the permissive legacy persistence schema", () => {
    const s = createSession("s", config, now), lesson: Lesson = { text: "A force changes motion.", formulas: [], questions: [], citations: [], grounding: "general AI explanation" };
    expect(() => validateLesson(lesson, s, "normal")).toThrow();
});
test("future study blocks cannot begin without an explicit start-time change", () => {
    const s=createSession("s",{...config,blocks:[{start:now+3600000,minutes:120}]},now);
    expect(()=>transition(s,{type:"resume"},now)).toThrow("not started");
    expect(transition(s,{type:"resume"},now+3600000).status).toBe("active");
});
test("a correct calculation cannot be paired with a different numerical key",()=>{expect(()=>validateQuestion({...numerical,answer:"6 m/s²"},createSession("s",config,now))).toThrow();});
test("advanced labels without independent calculations do not pass",()=>{expect(()=>validateQuestion({...numerical,difficulty:4,numeric:undefined},createSession("s",config,now))).toThrow();});
