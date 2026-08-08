import { z } from "zod";
import type { ReminderLamAction } from "@/lib/reminders/lam-actions";

const allowedViews = ["dashboard", "study", "ebook", "quiz", "flashcards", "notes", "planner", "focus", "exam-prep", "mock-exam", "answer-lab", "lab", "files", "assignments", "downloads", "toolbox", "settings", "python", "analytics", "reminders", "chapter-command"] as const;

const recurrenceRuleSchema = z.object({
  frequency: z.enum(["daily", "weekdays", "weekly", "monthly", "custom"]),
  interval: z.number().int().min(1).max(365).optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  customDays: z.number().int().min(1).max(365).optional(),
  anchorAt: z.string().optional(),
}).optional();

const reminderAlertSchema = z.object({
  id: z.string().min(1).max(80).optional(),
  offsetMinutes: z.number().int().min(0).max(10_080),
  label: z.string().max(120).optional(),
});

/**
 * Whitelisted reminder actions — LAM and custom commands may only execute
 * these operations. There is no free-form code execution.
 */
const reminderActionSchema = z.object({
  type: z.literal("reminder"),
  op: z.enum([
    "create", "update", "delete", "complete", "snooze", "reschedule",
    "list", "find", "create-series", "exam-plan", "create-template",
    "apply-template", "enable-talk", "disable-talk", "change-voice", "custom",
  ]),
  reminderId: z.string().max(160).optional(),
  query: z.string().max(200).optional(),
  payload: z.object({
    title: z.string().trim().min(1).max(120).optional(),
    dueAt: z.string().max(60).optional(),
    subject: z.string().trim().max(80).optional(),
    chapter: z.string().trim().max(180).optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    durationMin: z.number().int().min(1).max(600).optional(),
    recurrence: recurrenceRuleSchema,
    alerts: z.array(reminderAlertSchema).max(8).optional(),
    talkEnabled: z.boolean().optional(),
    voiceURI: z.string().max(300).optional(),
    voiceLanguage: z.string().max(40).optional(),
    time: z.string().max(40).optional(),
    templateName: z.string().max(80).optional(),
    series: z.object({
      examTitle: z.string().max(120).optional(),
      examDate: z.string().max(60).optional(),
      subject: z.string().max(80).optional(),
      chapters: z.array(z.string().max(180)).max(16).optional(),
    }).optional(),
  }).optional(),
  userCommand: z.string().max(1_000).optional(),
}).strict();

export const lamActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("navigate"), view: z.enum(allowedViews) }).strict(),
  z.object({ type: z.literal("create-note"), title: z.string().trim().min(1).max(120), content: z.string().trim().min(1).max(8_000) }).strict(),
  z.object({ type: z.literal("start-focus"), minutes: z.number().int().min(1).max(180) }).strict(),
  z.object({ type: z.literal("open-ebook-page"), bookId: z.string().trim().min(1).max(80), page: z.number().int().min(1).max(2_000) }).strict(),
  z.object({ type: z.literal("open-file"), fileId: z.string().trim().min(1).max(160) }).strict(),
  z.object({ type: z.literal("create-quiz"), subject: z.string().trim().max(100).optional(), chapter: z.string().trim().max(180).optional() }).strict(),
  z.object({ type: z.literal("create-slideshow"), subject: z.string().trim().max(100).optional(), chapter: z.string().trim().max(180).optional() }).strict(),
  reminderActionSchema,
]);

/**
 * Canonical action union the LAM widget executes. The reminder variant is
 * the typed `ReminderLamAction` from the reminders module so the executor
 * receives exact payload shapes.
 */
export type LamAction =
  | { type: "navigate"; view: typeof allowedViews[number] }
  | { type: "create-note"; title: string; content: string }
  | { type: "start-focus"; minutes: number }
  | { type: "open-ebook-page"; bookId: string; page: number }
  | { type: "open-file"; fileId: string }
  | { type: "create-quiz"; subject?: string; chapter?: string }
  | { type: "create-slideshow"; subject?: string; chapter?: string }
  | ReminderLamAction;

export function parseLocalCommand(input: string): LamAction | null {
  const value = input.toLowerCase().trim();
  const routes: Array<[RegExp, typeof allowedViews[number]]> = [
    [/^\s*(open|show|go to|return to) (the )?dashboard\b/, "dashboard"],
    [/^\s*(open|show|go to) (my )?notes\b/, "notes"],
    [/^\s*(open|show|go to) (the )?(e-?books?|ebook)\b/, "ebook"],
    [/^\s*(open|show|go to) (the )?flashcards?\b/, "flashcards"],
    [/^\s*(open|show|go to) (the )?quiz(zes)?\b/, "quiz"],
    [/^\s*(open|show|go to) (the )?assignments?\b/, "assignments"],
    [/^\s*(open|show|go to) (the )?settings\b/, "settings"],
    [/^\s*(open|show|go to) (the )?(study|subjects?)\b/, "study"],
    [/^\s*(open|show|go to) (the )?(smart )?reminders?\b/, "reminders"],
    [/^\s*(open|show|go to) (the )?(chapter )?(command (center|centre)|command center|command centre)\b/, "chapter-command"],
    [/^\s*(open|show|go to) (the )?(focus|timer)\b/, "focus"],
  ];
  for (const [pattern, view] of routes) if (pattern.test(value)) return { type: "navigate", view };
  const timer = value.match(/\bstart (?:a )?(\d{1,3})[ -]?minute (?:focus )?(?:timer|session)\b/);
  if (timer) return { type: "start-focus", minutes: Math.min(180, Math.max(1, Number(timer[1]))) };
  return null;
}
