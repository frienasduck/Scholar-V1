import { z } from "zod";

const allowedViews = ["dashboard", "study", "ebook", "quiz", "flashcards", "notes", "planner", "focus", "exam-prep", "mock-exam", "answer-lab", "lab", "files", "assignments", "downloads", "toolbox", "settings", "python", "analytics"] as const;

export const lamActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("navigate"), view: z.enum(allowedViews) }).strict(),
  z.object({ type: z.literal("create-note"), title: z.string().trim().min(1).max(120), content: z.string().trim().min(1).max(8_000) }).strict(),
  z.object({ type: z.literal("start-focus"), minutes: z.number().int().min(1).max(180) }).strict(),
  z.object({ type: z.literal("open-ebook-page"), bookId: z.string().trim().min(1).max(80), page: z.number().int().min(1).max(2_000) }).strict(),
  z.object({ type: z.literal("open-file"), fileId: z.string().trim().min(1).max(160) }).strict(),
  z.object({ type: z.literal("create-quiz"), subject: z.string().trim().max(100).optional(), chapter: z.string().trim().max(180).optional() }).strict(),
  z.object({ type: z.literal("create-slideshow"), subject: z.string().trim().max(100).optional(), chapter: z.string().trim().max(180).optional() }).strict(),
]);
export type LamAction = z.infer<typeof lamActionSchema>;

export function parseLocalCommand(input: string): LamAction | null {
  const value = input.toLowerCase().trim();
  const routes: Array<[RegExp, typeof allowedViews[number]]> = [
    [/\b(open|show|go to|return to) (the )?dashboard\b/, "dashboard"],
    [/\b(open|show|go to) (my )?notes\b/, "notes"],
    [/\b(open|show|go to) (the )?(e-?books?|ebook)\b/, "ebook"],
    [/\b(open|show|go to) (the )?flashcards?\b/, "flashcards"],
    [/\b(open|show|go to) (the )?quiz(zes)?\b/, "quiz"],
    [/\b(open|show|go to) (the )?assignments?\b/, "assignments"],
    [/\b(open|show|go to) (the )?settings\b/, "settings"],
    [/\b(open|show|go to) (the )?(study|subjects?)\b/, "study"],
  ];
  for (const [pattern, view] of routes) if (pattern.test(value)) return { type: "navigate", view };
  const timer = value.match(/\bstart (?:a )?(\d{1,3})[ -]?minute (?:focus )?(?:timer|session)\b/);
  if (timer) return { type: "start-focus", minutes: Math.min(180, Math.max(1, Number(timer[1]))) };
  return null;
}
