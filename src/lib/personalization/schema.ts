import { z } from "zod";
import { getCurriculum } from "@/lib/curriculum-helper";
import { LIVE_TUTOR_PERSONALITIES } from "@/lib/live-tutor/types";

export const BONUS_BYTES = 50 * 1024 * 1024;
export const GOALS = ["School exams", "CBSE Boards", "JEE Main", "JEE Advanced", "NEET", "CUET", "Concept mastery", "Better grades", "Study consistency"] as const;
export const CHALLENGES = ["Understanding concepts", "Remembering", "Calculations", "Long problems", "Writing answers", "Focus", "Time management", "Procrastination", "Exam anxiety", "What to study next", "Revision", "Consistency"] as const;
export const STYLES = ["Short and direct", "Step-by-step", "Detailed", "Examples first", "Visual explanations", "Practice first", "Teach me simply", "Exam-focused"] as const;
export const REASONS = ["Next-action guidance", "Difficult concepts", "Practice", "Exam preparation", "Consistency", "My PDFs", "Track progress", "Study with friends", "Weak topics", "AI tutor", "Organize material"] as const;
const selection = <T extends readonly [string, ...string[]]>(values: T) => z.array(z.enum(values)).max(values.length).refine(v => new Set(v).size === v.length);
const subjectIds = z.array(z.string().min(1).max(80)).max(12).refine(v => new Set(v).size === v.length);
export const savedPreferencesSchema = z.object({
  grade: z.union([z.literal(9), z.literal(11)]).default(11),
  board: z.enum(["CBSE", "State", "Other"]).default("CBSE"),
  subjects: subjectIds.default([]), goals: selection(GOALS).default([]),
  strong: subjectIds.default([]), weak: subjectIds.default([]),
  challenges: selection(CHALLENGES).default([]), style: z.enum(STYLES).default("Step-by-step"),
  secondaryStyles: selection(STYLES).default([]),
  personality: z.enum(LIVE_TUTOR_PERSONALITIES).default("calm"),
  guidance: z.enum(["gentle", "balanced", "strict"]).default("balanced"),
  studyWindow: z.enum(["Morning", "Afternoon", "Evening", "Late night", "Varies"]).default("Varies"),
  minutes: z.number().int().min(5).max(240).default(30),
  days: z.array(z.number().int().min(0).max(6)).max(7).refine(v => new Set(v).size === v.length).default([]),
  dailyGoal: z.number().int().min(5).max(240).default(30),
  exam: z.object({ name: z.string().trim().min(1).max(80), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), subjects: subjectIds }).strict().nullable().default(null),
  reasons: selection(REASONS).default([]),
}).strict().superRefine((p, ctx) => {
  const ids = new Set(getCurriculum(p.grade).map(s => s.id));
  for (const key of ["subjects", "strong", "weak"] as const) if (p[key].some(id => !ids.has(id))) ctx.addIssue({ code: "custom", path: [key], message: "Choose subjects in your current class." });
  if ([...p.strong, ...p.weak, ...(p.exam?.subjects ?? [])].some(id => !p.subjects.includes(id))) ctx.addIssue({ code: "custom", path: ["subjects"], message: "Priority and exam subjects must be selected study subjects." });
  if (p.strong.some(id => p.weak.includes(id))) ctx.addIssue({ code: "custom", path: ["weak"], message: "A subject cannot be both strongest and priority." });
  if (p.exam) {
    const date = new Date(`${p.exam.date}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== p.exam.date || date.getTime() > Date.now() + 2 * 366 * 86400000) ctx.addIssue({ code: "custom", path: ["exam", "date"], message: "Choose a real date within two years." });
  }
});
export const preferencesSchema = savedPreferencesSchema.superRefine((p,ctx)=>{
  if(p.exam && p.exam.date < new Date().toISOString().slice(0,10))ctx.addIssue({code:"custom",path:["exam","date"],message:"Choose an upcoming exam date."});
});
export type Preferences = z.infer<typeof preferencesSchema>;
/** Keep historical preferences readable; only clear an expired exam in a new editable draft. */
export function editablePreferences(p:Preferences):Preferences {
  return p.exam && p.exam.date < new Date().toISOString().slice(0,10) ? {...p,exam:null} : p;
}
export const DEFAULT_PREFERENCES: Preferences = preferencesSchema.parse({});
export type SetupStatus = "NOT_STARTED" | "IN_PROGRESS" | "ANALYZING" | "COMPLETED" | "SKIPPED" | "FAILED_RETRYABLE";
export function entryMode(authenticated: boolean, required: boolean, status: SetupStatus) {
  if (!authenticated || status === "COMPLETED" || status === "SKIPPED") return "bypass";
  if (status !== "NOT_STARTED" || required) return "setup";
  return "invite";
}
export function bonusRemaining(used: number, closed: boolean) { return closed ? 0 : Math.max(0, BONUS_BYTES - used); }
export function mayImport(status: string, closed: boolean, used: number, bytes: number) {
  return status === "IN_PROGRESS" && !closed && Number.isSafeInteger(bytes) && bytes > 0 && bytes <= 4 * 1024 * 1024 && bytes <= BONUS_BYTES - used;
}
