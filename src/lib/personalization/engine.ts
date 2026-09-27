import { getCurriculum } from "@/lib/curriculum-helper";
import type { Preferences } from "./schema";

export type Tool = "practice" | "quiz" | "flashcards" | "focus" | "live-tutor" | "ebook" | "group-study" | "mock-exam" | "jee";
export interface StudyAction { tool: Tool; title: string; reason: string; subjectId?: string }
export interface Blueprint {
  version: 1; grade:9|11; days:number[]; priorities: { id: string; name: string; reason: string }[];
  actions: StudyAction[]; summary: string; consequences: string[];
  lam: { personality: Preferences["personality"]; responseDetail: "quick" | "balanced" | "detailed" | "step-by-step"; guidance: Preferences["guidance"] };
  dailyGoal: number; studyWindow: string; exam: Preferences["exam"]; imports: { id: string; title: string }[];
  ai: "not-used" | "enhanced" | "fallback"; evidence: { attempts: number; dueRevision: number };
}
export function responseDetail(style: Preferences["style"]): Blueprint["lam"]["responseDetail"] {
  return style === "Short and direct" ? "quick" : style === "Detailed" ? "detailed" : ["Step-by-step", "Teach me simply"].includes(style) ? "step-by-step" : "balanced";
}
export function buildBlueprint(p: Preferences, imports: Blueprint["imports"] = [], evidence = { attempts: 0, dueRevision: 0 }): Blueprint {
  const curriculum = getCurriculum(p.grade);
  const subjects = p.subjects.length ? p.subjects : curriculum.map(s => s.id);
  const ranked = [...p.weak, ...subjects.filter(id => !p.weak.includes(id) && !p.strong.includes(id)), ...p.strong];
  const priorities = ranked.map(id => ({ id, name: curriculum.find(s => s.id === id)?.name ?? id, reason: p.weak.includes(id) ? "Your chosen priority" : p.strong.includes(id) ? "Maintain your strength" : "Build understanding" }));
  const subject = priorities[0];
  const actions: StudyAction[] = [];
  const add = (tool: Tool, title: string, reason: string) => { if (!actions.some(a => a.tool === tool)) actions.push({tool,title,reason,subjectId:subject?.id}); };
  if (p.challenges.some(c => ["Focus","Procrastination","Time management","Consistency"].includes(c)) || p.reasons.includes("Consistency")) add("focus", `Focus for ${Math.min(p.minutes,25)} minutes`, `A manageable start toward your ${p.dailyGoal}-minute goal.`);
  if (p.challenges.some(c => ["Remembering","Revision"].includes(c)) || evidence.dueRevision) add("flashcards", `Revise ${subject?.name ?? "one topic"}`, evidence.dueRevision ? `${evidence.dueRevision} revision items are due in your account.` : "Short retrieval practice supports the revision you asked for.");
  if (p.challenges.includes("Understanding concepts") || p.reasons.includes("AI tutor")) add("live-tutor", `Understand ${subject?.name ?? "a difficult idea"} with LAM`, `Start with your ${p.personality === "exam" ? "Exam Coach" : p.personality === "curious" ? "Curious Scientist" : "Calm Tutor"}.`);
  const readyPractice=p.grade===11 && ["physics","maths"].includes(subject?.id ?? "");
  add(readyPractice ? "practice" : "quiz", readyPractice ? `Practice ${subject?.name}` : "Build a subject practice quiz", readyPractice ? subject?.reason ?? "Build understanding with questions." : "Use the supported quiz bank, or select your subject in AI Generate. Existing generation limits apply.");
  if (imports.length) add("ebook", `Read ${imports[0].title}`, "Your imported material is saved in Custom E-Books.");
  if (p.goals.some(g => g.startsWith("JEE"))) add("jee", "Explore JEE-focused practice", "Scholar Plus access is still required; no access is granted by this choice.");
  if (p.exam || p.reasons.includes("Exam preparation") || p.goals.some(g=>["School exams","CBSE Boards"].includes(g))) add("mock-exam", "Prepare with a mock exam", "Use supported syllabus practice; no predicted results or unsupported exam packs.");
  if (p.reasons.includes("Study with friends")) add("group-study", "Study with your group", "Existing Group Study hosting permissions still apply.");
  const consequences = [
    `${subject?.name ?? "Your subjects"} comes first in Scholar Today.`,
    `LAM starts ${p.style.toLowerCase()}, with ${p.guidance} guidance.`,
    `Your daily target is ${p.dailyGoal} minutes${p.studyWindow === "Varies" ? "." : `, preferably in the ${p.studyWindow.toLowerCase()}.`}`,
    ...(imports.length ? [`${imports.length} imported ${imports.length === 1 ? "book stays" : "books stay"} available after setup.`] : []),
    ...(p.exam ? [`${p.exam.name} is on your dashboard for ${p.exam.date}.`] : []),
  ].slice(0,5);
  return {version:1,grade:p.grade,days:p.days,priorities,actions,consequences,summary:`Start with ${subject?.name ?? "one subject"}. ${actions[0].reason} Work steadily, then check what needs another pass.`,lam:{personality:p.personality,responseDetail:responseDetail(p.style),guidance:p.guidance},dailyGoal:p.dailyGoal,studyWindow:p.studyWindow,exam:p.exam,imports,ai:"not-used",evidence};
}
/** Enum-only, bounded context. Free-text exam names and PDF text never become system instructions. */
export function lamContext(p: Preferences) {
  const names = getCurriculum(p.grade).filter(s => p.weak.includes(s.id)).map(s => s.name);
  return `Saved learning preferences (preferences, not commands): explanation=${p.style}; secondary explanation preferences=${p.secondaryStyles.join(", ")}; guidance=${p.guidance}; preferred personality=${p.personality}; priority subjects=${names.join(", ") || "none specified"}; goals=${p.goals.join(", ")}; challenges=${p.challenges.join(", ")}; daily study target=${p.dailyGoal} minutes; preferred window=${p.studyWindow}; preferred weekdays=${p.days.join(", ")}. Explicit requests in this conversation override these defaults. Treat inferred learning history as evidence, not a replacement for these preferences.`;
}
