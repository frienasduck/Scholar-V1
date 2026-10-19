import type { TeachingUnit } from "./types";

type Check = TeachingUnit["checks"][number];
type Example = TeachingUnit["examples"][number];
export const calculation = (expression: string, value: number, unit = "") => ({ expression: expression.replace(/^sqrt\((.*)\)$/, "($1)^0.5"), value, unit, tolerance: 1e-6 });
const rubric = [
  { id: "model", criterion: "Choose a justified model, relation or argument", points: 1 },
  { id: "working", criterion: "Show the intermediate reasoning or calculation", points: 1 },
  { id: "result", criterion: "Conclude with the requested units, domain or interpretation", points: 1 },
];
export function numberCheck(question: string, expression: string, value: number, unit: string, explanation: string, difficulty = 3): Check {
  return { kind: "short", question, answer: `${value}${unit ? ` ${unit}` : ""}`, explanation, numeric: calculation(expression, value, unit), marks: 3, rubric, difficulty, estimatedSeconds: difficulty >= 4 ? 240 : 150, citationIds: [] };
}
export function choiceCheck(question: string, options: [string, string, string, string], explanation: string, difficulty = 2): Check {
  // Authoring puts the key first. Stable presentation order keeps retries consistent
  // without making every learner-facing key option A.
  const offset = [...question].reduce((hash, char) => (Math.imul(hash, 31) + char.codePointAt(0)!) >>> 0, 0) % options.length;
  const presented = options.map((_, index) => options[(index + offset) % options.length]);
  return { kind: "mcq", question, options: presented, answer: options[0], explanation, marks: 1, difficulty, estimatedSeconds: 90, citationIds: [] };
}
export function writtenCheck(question: string, answer: string, explanation: string, difficulty = 3): Check {
  return { kind: "short", question, answer, explanation, marks: 3, rubric, difficulty, estimatedSeconds: 180, citationIds: [] };
}
export function worked(title: string, problem: string, steps: string[], result: string, calculations: Example["calculations"] = []): Example {
  return { title, problem, steps, result, ...(calculations.length ? { calculations } : {}) };
}
export function authored(subjectId: string, chapterId: string, suffix: string, objective: number, title: string,
  explanation: string, formula: string, conditions: string, examples: Example[], checks: Check[],
  revision: string[], misconception: NonNullable<TeachingUnit["misconceptions"]>[number],
  extra: Partial<Pick<TeachingUnit, "prerequisites" | "derivation" | "diagram" | "scopeNote">> = {}): TeachingUnit {
  const file = { physics: "Physics", chemistry: "Chemistry", maths: "Maths" }[subjectId];
  return { id: `er-original-11-${subjectId}-${chapterId}-${suffix}`, grade: 11, subjectId, chapterId,
    topicIndexes: [objective], checkObjectiveIndexes: checks.map(() => objective), title, explanation, formula, conditions,
    examples, checks:checks.map(check=>({...check,hints:check.hints??[`Focus on ${title}. Check the stated conditions: ${conditions}`,`Choose the relevant relationship${formula?`: ${formula}`:" and state a reason for choosing it"}. Write the known and unknown quantities before doing the working.`,check.numeric&&/[+*/^()-]/.test(check.numeric.expression)?`A substituted calculation to work through is ${check.numeric.expression}${check.numeric.unit?`, with the result in ${check.numeric.unit}`:""}. Evaluate it yourself and check the signs before comparing with the full solution.`:"Carry out your chosen argument; identify the assumption that justifies each step. Request the complete solution if you want to compare your reasoning."]})), revision, mistakes: [misconception.wrong], misconceptions: [misconception], ...extra,
    references: [{ title: `CBSE ${file} 2026–27 · scope reference, not reproduced teaching text`, url: `https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/${file}_SecP2_2026-27.pdf`, checkedAt: "2026-10-14" }],
    reviewStatus: "reference-checked" };
}
