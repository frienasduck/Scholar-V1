"use client";

// ============================================================================
// Smart Reminders 2.0 — LAM × FICA task automation
// Whitelisted reminder actions that LAM (and custom commands) may trigger.
// No arbitrary code execution: every command maps onto approved operations.
// ============================================================================

import { nextOccurrenceAfter, parseQuickCommand, parseHHMM, detectSubject, daysBetween, buildRevisionSeries } from "./engine";
import { useReminderStore } from "./store";
import { speakSmartReminder } from "./talk";
import { navigateTo } from "@/lib/nav-event";
import type { LamCommand, SmartReminder } from "./types";

export const REMINDER_LAM_OPS = [
  "create", "update", "delete", "complete", "snooze", "reschedule",
  "list", "find", "create-series", "exam-plan", "create-template",
  "apply-template", "enable-talk", "disable-talk", "change-voice", "custom",
] as const;
export type ReminderLamOp = typeof REMINDER_LAM_OPS[number];

export interface ReminderLamAction {
  type: "reminder";
  op: ReminderLamOp;
  reminderId?: string;
  query?: string;
  payload?: {
    title?: string;
    dueAt?: string;
    subject?: string;
    chapter?: string;
    priority?: SmartReminder["priority"];
    recurrence?: SmartReminder["recurrence"];
    durationMin?: number;
    alerts?: SmartReminder["alerts"];
    talkEnabled?: boolean;
    voiceURI?: string;
    voiceLanguage?: string;
    series?: { examTitle?: string; examDate?: string; subject?: string; chapters?: string[] };
    templateName?: string;
    time?: string;
    date?: string;
  };
  userCommand: string;
}

// ============================================================================
// Intent parsing
// ============================================================================

export interface ReminderIntentContext {
  scholarClass: 9 | 11;
  reminders: SmartReminder[];
  templates: Array<{ id: string; name: string }>;
  commands: LamCommand[];
  lastCreatedReminderId?: string;
  pendingDraft?: Partial<SmartReminder> | null;
}

export type ReminderIntent =
  | { kind: "action"; action: ReminderLamAction }
  | { kind: "ambiguous"; matches: SmartReminder[]; query: string }
  | { kind: "confirm-create"; action: ReminderLamAction; preview: QuickCreatePreview };

export interface QuickCreatePreview {
  title: string;
  dueLabel: string;
  subject?: string;
  priority: string;
  recurrenceLabel: string | null;
  preAlertLabel: string | null;
  talkLabel: string | null;
  confidence: string;
  ambiguity: string[];
}

export function buildQuickPreview(action: ReminderLamAction, now = new Date()): QuickCreatePreview {
  const p = action.payload ?? {};
  const due = new Date(p.dueAt ?? Date.now());
  const sameDay = daysBetween(new Date(), due) === 0;
  const dueLabel = `${sameDay ? "Today" : daysBetween(new Date(), due) === 1 ? "Tomorrow" : due.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · ${due.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`;
  const recurrenceLabel = p.recurrence
    ? (() => {
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        if (p.recurrence!.frequency === "weekdays") return "Every weekday";
        if (p.recurrence!.frequency === "weekly" && p.recurrence!.weekdays?.length) return `Every ${p.recurrence!.weekdays.map((d) => dayNames[d].slice(0, 3)).join(" and ")}`;
        if (p.recurrence!.frequency === "daily") return "Every day";
        return p.recurrence!.frequency;
      })()
    : null;
  const preAlertLabel = p.alerts?.length ? `${Math.min(...p.alerts.map((a) => a.offsetMinutes))} minutes before` : null;
  return {
    title: p.title ?? "Reminder",
    dueLabel,
    subject: p.subject,
    priority: p.priority ?? "medium",
    recurrenceLabel,
    preAlertLabel,
    talkLabel: p.talkEnabled ? "Enabled" : null,
    confidence: "medium",
    ambiguity: [],
  };
}

function findReminders(query: string, reminders: SmartReminder[], now = new Date()): SmartReminder[] {
  const value = query.toLowerCase();
  const { subject } = detectSubject(query);
  const statusActive = (r: SmartReminder) => r.status === "scheduled" || r.status === "active";
  return reminders
    .filter(statusActive)
    .filter((r) => {
      const haystack = `${r.title} ${r.subject ?? ""} ${r.chapter ?? ""} ${r.type} ${r.tags.join(" ")}`.toLowerCase();
      if (subject && r.subject === subject) return true;
      return value.split(/\s+/).filter((w) => w.length > 2).some((w) => haystack.includes(w));
    })
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}

function resolveMatch(matches: SmartReminder[], ctx: ReminderIntentContext): ReminderIntent {
  if (matches.length === 0) return { kind: "action", action: { type: "reminder", op: "find", query: "", userCommand: "" } };
  if (matches.length === 1) return { kind: "action", action: { type: "reminder", op: "find", reminderId: matches[0].id, userCommand: "" } };
  return { kind: "ambiguous", matches: matches.slice(0, 6), query: "" };
}

const TIME_TOKEN = /(?:at|by|around|@)\s*\d{1,2}(?::\d{2})?\s*[ap]m\b|(?:at|by|around|@)\s*\d{1,2}(?::\d{2})?\b/;
const DATE_TOKEN = /\b(tomorrow|today|tonight|this (morning|afternoon|evening)|next (sunday|monday|tuesday|wednesday|thursday|friday|saturday)|on \d{1,2}(?:st|nd|rd|th)?(?:\s+[a-z]+)?)\b/i;

export function parseReminderIntent(content: string, ctx: ReminderIntentContext, now = new Date()): ReminderIntent | null {
  const raw = content.trim();
  const value = raw.toLowerCase();

  // ---- Exam revision plan ------------------------------------------------
  const examPlan = value.match(/\b(create|make|generate|set up)\b.*\b(revision (schedule|plan|series)|exam (rescue )?plan|prepare (me )?for (my )?exam)\b/);
  const examDateHint = value.match(/\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/) ?? value.match(/\bon\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+([a-z]+))?\b/);
  if (examPlan) {
    const { subject } = detectSubject(raw);
    const date = new Date(now);
    if (value.match(/\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/)) {
      const dayNames: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
      const target = dayNames[value.match(/\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/)![1]];
      let ahead = (target - now.getDay() + 7) % 7;
      if (ahead === 0) ahead = 7;
      date.setDate(now.getDate() + ahead);
    } else if (examDateHint && examDateHint[1]) {
      date.setDate(Number(examDateHint[1]));
      if (date.getTime() < now.getTime()) date.setFullYear(now.getFullYear() + 1);
    } else {
      date.setDate(now.getDate() + 7);
    }
    const examTitle = `${subject ? subject[0].toUpperCase() + subject.slice(1) : "Subject"} exam`;
    return {
      kind: "confirm-create",
      action: { type: "reminder", op: "exam-plan", payload: { series: { examTitle, examDate: date.toISOString(), subject, chapters: [] } }, userCommand: raw },
      preview: { title: examTitle, dueLabel: date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }), subject, priority: "high", recurrenceLabel: null, preAlertLabel: null, talkLabel: null, confidence: "medium", ambiguity: ["A revision sequence will be created up to the exam date — review it before confirming."] },
    };
  }

  // ---- Apply template ------------------------------------------------------
  const templateMatch = value.match(/\b(apply|use|start)\b.*\b(template|routine)\b\s*[:`]?\s*"?([a-z0-9 \-]+)"?/);
  if (templateMatch) {
    const name = templateMatch[3].trim();
    const template = ctx.templates.find((t) => t.name.toLowerCase() === name || name.includes(t.name.toLowerCase()) || t.name.toLowerCase().includes(name));
    if (template) {
      return { kind: "action", action: { type: "reminder", op: "apply-template", payload: { templateName: template.name }, userCommand: raw } };
    }
  }

  // ---- Change voice --------------------------------------------------------
  const voiceMatch = value.match(/(use|switch to|change(?: the)? (?:reminder )?voice to|talk voice to)\s+(.+)/);
  if (voiceMatch) {
    const target = voiceMatch[2];
    let voiceLanguage = "en-GB";
    if (/\bbritish|uk|english \(uk\)|en-gb\b/.test(target)) voiceLanguage = "en-GB";
    else if (/\bamerican|us|english \(us\)|en-us\b/.test(target)) voiceLanguage = "en-US";
    else if (/\bindian|english \(india\)|en-in\b/.test(target)) voiceLanguage = "en-IN";
    const female = /\bfemale|woman|her\b/.test(target);
    return { kind: "action", action: { type: "reminder", op: "change-voice", payload: { voiceLanguage, voiceURI: female ? "female" : undefined }, userCommand: raw } };
  }

  // ---- Enable / disable talk -----------------------------------------------
  const talkEnable = value.match(/\b(enable|turn on|activate)\b.*\b(talk reminder|voice reminder|speak)\b(?:\s+(?:for|on|about)\s+(.+))?/);
  const talkDisable = value.match(/\b(disable|turn off|stop)\b.*\b(talk reminder|voice reminder|speaking)\b(?:\s+(?:for|on|about)\s+(.+))?/);
  if (talkEnable) {
    const target = talkEnable[3]?.trim();
    const matches = target ? findReminders(target, ctx.reminders, now) : [];
    if (target && matches.length === 1) {
      return { kind: "action", action: { type: "reminder", op: "enable-talk", reminderId: matches[0].id, userCommand: raw } };
    }
    if (target && matches.length > 1) return { kind: "ambiguous", matches, query: target };
    return { kind: "action", action: { type: "reminder", op: "enable-talk", userCommand: raw } };
  }
  if (talkDisable) {
    const target = talkDisable[3]?.trim();
    const matches = target ? findReminders(target, ctx.reminders, now) : [];
    if (target && matches.length === 1) {
      return { kind: "action", action: { type: "reminder", op: "disable-talk", reminderId: matches[0].id, userCommand: raw } };
    }
    if (target && matches.length > 1) return { kind: "ambiguous", matches, query: target };
    return { kind: "action", action: { type: "reminder", op: "disable-talk", userCommand: raw } };
  }

  // ---- Snooze ----------------------------------------------------------------
  const snooze = value.match(/\b(snooze|nap)\b(?:\s+(.+?))?(?:\s+(?:for|by)\s+(\d+|a|an)\s*(minutes?|mins?|hours?|hrs?))?(?:\s+(until|till)\s+(.+))?/);
  if (snooze && /\bsnooze\b/.test(value)) {
    const target = (snooze[2] ?? "").replace(/\s+(?:for|by)\s+(\d+)\s*(?:min(?:ute)?s?|hours?|hrs?)$/, "").trim();
    let minutes: number | undefined;
    const amount = snooze[3];
    const unit = snooze[4];
    if (amount && unit) {
      const n = amount === "a" || amount === "an" ? 1 : Number(amount);
      minutes = unit.startsWith("hour") || unit.startsWith("hr") ? n * 60 : n;
    }
    const matches = target ? findReminders(target, ctx.reminders, now) : ctx.lastCreatedReminderId ? [ctx.reminders.find((r) => r.id === ctx.lastCreatedReminderId)!].filter(Boolean) : ctx.reminders.filter((r) => r.status === "scheduled" || r.status === "active").slice(0, 1);
    if (matches.length === 0) return null;
    if (matches.length > 1) return { kind: "ambiguous", matches, query: target };
    return { kind: "action", action: { type: "reminder", op: "snooze", reminderId: matches[0].id, payload: { time: minutes ? `${minutes}` : undefined }, userCommand: raw } };
  }

  // ---- Complete ----------------------------------------------------------------
  if (/\b(complete|mark .* done|mark done|finish|check off)\b/.test(value) && /\b(reminder|task|homework|revision)\b/.test(value)) {
    const target = value.replace(/\b(complete|mark|done|finish|check off|the|reminder|task)\b/g, "").trim();
    const matches = findReminders(target || "a", ctx.reminders, now);
    if (matches.length === 0) return null;
    if (matches.length > 1) return { kind: "ambiguous", matches, query: target };
    return { kind: "action", action: { type: "reminder", op: "complete", reminderId: matches[0].id, userCommand: raw } };
  }

  // ---- Delete ----------------------------------------------------------------
  if (/\b(delete|remove|cancel|clear)\b.*\b(reminder|reminders)\b/.test(value)) {
    const target = value.replace(/\b(delete|remove|cancel|clear|the|reminder|reminders)\b/g, "").trim();
    const matches = findReminders(target || "a", ctx.reminders, now);
    if (matches.length === 0) return null;
    if (matches.length > 1) return { kind: "ambiguous", matches, query: target };
    return { kind: "action", action: { type: "reminder", op: "delete", reminderId: matches[0].id, userCommand: raw } };
  }

  // ---- List / find ----------------------------------------------------------------
  if (/\bwhat('s| is)? (due|reminder|reminders|up|on).*(today|tonight|this week|tomorrow)?\b/.test(value) || /\b(list|show|tell me)\b.*\b(reminders?|due)\b/.test(value)) {
    const scope = /\btomorrow\b/.test(value) ? "tomorrow" : /\bthis week\b/.test(value) ? "week" : /\btonight\b/.test(value) ? "tonight" : "today";
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
    const matches = ctx.reminders.filter((r) => {
      if (r.status === "completed" || r.status === "cancelled") return false;
      const due = new Date(r.dueAt);
      if (scope === "today") return due.getTime() >= today.getTime() && due.getTime() < tomorrow.getTime();
      if (scope === "tomorrow") return due.getTime() >= tomorrow.getTime() && due.getTime() < new Date(tomorrow.getTime() + 86_400_000).getTime();
      if (scope === "week") return due.getTime() >= today.getTime() && due.getTime() < weekEnd.getTime();
      return due.getTime() >= today.getTime();
    }).sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
    return { kind: "action", action: { type: "reminder", op: "list", query: scope, userCommand: raw } };
  }

  // ---- Reschedule / move --------------------------------------------------------
  const move = value.match(/\b(move|reschedule|postpone|push)\b(?:\s+(.+?))?\s+(?:to|until)\s+(.+)/);
  if (move) {
    const target = move[2]?.replace(/^(the|my) /, "").trim() ?? "it";
    const targetPhrase = move[3];
    const matches = findReminders(target, ctx.reminders, now);
    if (matches.length === 0 && target === "it") {
      const fallback = ctx.lastCreatedReminderId ? [ctx.reminders.find((r) => r.id === ctx.lastCreatedReminderId)!].filter(Boolean) : [];
      if (fallback.length) {
        const parsed = parseQuickCommand(`remind me ${targetPhrase}`, now);
        return { kind: "action", action: { type: "reminder", op: "reschedule", reminderId: fallback[0].id, payload: { dueAt: parsed.dueAt.toISOString() }, userCommand: raw } };
      }
      return null;
    }
    if (matches.length > 1) return { kind: "ambiguous", matches, query: target };
    if (matches.length === 0) return null;
    const parsed = parseQuickCommand(`remind me ${targetPhrase}`, now);
    return { kind: "action", action: { type: "reminder", op: "reschedule", reminderId: matches[0].id, payload: { dueAt: parsed.dueAt.toISOString() }, userCommand: raw } };
  }

  // ---- Follow-up edits (operate on the last LAM-created reminder) ---------------
  const lastReminder = ctx.lastCreatedReminderId ? ctx.reminders.find((r) => r.id === ctx.lastCreatedReminderId) : undefined;
  if (lastReminder) {
    const timeFollow = value.match(/\b(make it|set it (?:to|at)|schedule it (?:at|for))\s+(.+)/);
    if (timeFollow) {
      const parsed = parseQuickCommand(`remind me ${timeFollow[2]}`, now);
      return { kind: "action", action: { type: "reminder", op: "update", reminderId: lastReminder.id, payload: { dueAt: parsed.dueAt.toISOString() }, userCommand: raw } };
    }
    if (/\brepeat it every weekday\b/.test(value)) {
      return { kind: "action", action: { type: "reminder", op: "update", reminderId: lastReminder.id, payload: { recurrence: { frequency: "weekdays", interval: 1 } }, userCommand: raw } };
    }
    const addAlert = value.match(/\badd a (reminder|pre-?alert|alert)\s+(\d+)\s*(min(?:ute)?s?|hours?|days?)?\s*before\b/);
    if (addAlert) {
      const unit = addAlert[3]?.match(/hour/) ? 60 : addAlert[3]?.match(/day/) ? 1440 : 1;
      const offset = Number(addAlert[2]) * unit;
      return { kind: "action", action: { type: "reminder", op: "update", reminderId: lastReminder.id, payload: { alerts: [...lastReminder.alerts, { id: `al-${Date.now()}`, offsetMinutes: offset, label: `${addAlert[2]} ${addAlert[3] ?? "minutes"} before` }] }, userCommand: raw } };
    }
  }

  // ---- Create ----------------------------------------------------------------
  const create = /(?:remind me|set a reminder|create a reminder|add a reminder|make a reminder|remind|set reminder|schedule)\b/.test(value) && !/\b(what|how|why|list|show)\b/.test(value);
  if (create) {
    const parsed = parseQuickCommand(raw, now);
    if (parsed.ambiguity.length && parsed.confidence === "low") {
      // Still build the preview so the student can confirm the interpretation.
    }
    const action: ReminderLamAction = {
      type: "reminder",
      op: "create",
      payload: {
        title: parsed.title,
        dueAt: parsed.dueAt.toISOString(),
        subject: parsed.subject,
        chapter: parsed.chapter,
        priority: parsed.priority,
        durationMin: parsed.durationMin,
        recurrence: parsed.recurrence,
        alerts: parsed.preAlertMinutes ? [{ id: `al-${Date.now()}`, offsetMinutes: parsed.preAlertMinutes, label: `${parsed.preAlertMinutes} minutes before` }] : [],
      },
      userCommand: raw,
    };
    const simple = parsed.confidence === "high" && !parsed.recurrence && !parsed.preAlertMinutes && !parsed.ambiguity.length;
    if (simple && ctx.commands.length === 0 && false) {
      return { kind: "action", action };
    }
    return {
      kind: "confirm-create",
      action,
      preview: {
        title: parsed.title,
        dueLabel: `${parsed.dueAt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · ${parsed.dueAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`,
        subject: parsed.subject,
        priority: parsed.priority,
        recurrenceLabel: parsed.recurrence ? "Yes" : null,
        preAlertLabel: parsed.preAlertMinutes ? `${parsed.preAlertMinutes} minutes before` : null,
        talkLabel: null,
        confidence: parsed.confidence,
        ambiguity: parsed.ambiguity,
      },
    };
  }

  // ---- Custom commands (distinctive phrases only). Checked after the create
  // branch so defaults like “remind me” never shadow the structured preview —
  // custom commands only match when no create phrase was used. ---------------
  for (const command of ctx.commands) {
    if (!command.enabled) continue;
    const matched = command.triggers.find((t) => t.length > 3 && (value.includes(t) || t.includes(value)));
    if (matched) {
      return {
        kind: "action",
        action: { type: "reminder", op: "custom", payload: { title: command.name }, userCommand: raw },
      };
    }
  }

  return null;
}

// ============================================================================
// Executor
// ============================================================================

export function executeReminderLamAction(scholarClass: 9 | 11, action: ReminderLamAction): { ok: boolean; message: string; reminderId?: string; reminderIds?: string[] } {
  const store = useReminderStore.getState();
  const profile = store.ensureProfile(scholarClass);
  const p = action.payload ?? {};
  const actor = "lam" as const;

  switch (action.op) {
    case "create": {
      const reminder = store.createReminder(scholarClass, {
        title: p.title ?? "Reminder",
        dueAt: p.dueAt,
        subject: p.subject,
        chapter: p.chapter,
        priority: p.priority,
        durationMin: p.durationMin,
        recurrence: p.recurrence,
        alerts: p.alerts,
        talkEnabled: p.talkEnabled ?? profile.settings.defaultTalkEnabled,
        speechRate: 1, speechPitch: 1, speechVolume: 1,
        spokenContentMode: "title",
        speakDetails: profile.settings.speakReminderDetails,
      }, { source: "lam", activityActor: actor, detail: `Created by LAM${action.userCommand ? ` · “${action.userCommand.slice(0, 80)}”` : ""}` });
      return { ok: true, message: `Created “${reminder.title}”.`, reminderId: reminder.id };
    }
    case "update": {
      if (!action.reminderId) return { ok: false, message: "I need to know which reminder to update." };
      const updated = store.updateReminder(scholarClass, action.reminderId, p as Partial<SmartReminder>, { activityActor: actor, detail: "Edited through LAM" });
      if (!updated) return { ok: false, message: "That reminder no longer exists." };
      return { ok: true, message: `Updated “${updated.title}”.` };
    }
    case "delete": {
      if (!action.reminderId) return { ok: false, message: "I need to know which reminder to delete." };
      const target = profile.reminders.find((r) => r.id === action.reminderId);
      store.removeReminder(scholarClass, action.reminderId, { actor });
      return { ok: true, message: `Deleted “${target?.title ?? "reminder"}”.` };
    }
    case "complete": {
      if (!action.reminderId) return { ok: false, message: "I need to know which reminder to complete." };
      const target = profile.reminders.find((r) => r.id === action.reminderId);
      store.completeReminder(scholarClass, action.reminderId, { actor });
      return { ok: true, message: `Completed “${target?.title ?? "reminder"}”.` };
    }
    case "snooze": {
      if (!action.reminderId) return { ok: false, message: "I need to know which reminder to snooze." };
      const minutes = p.time ? Math.max(1, Math.min(240, Number(p.time) || 10)) : 10;
      const until = new Date(Date.now() + minutes * 60_000).toISOString();
      store.snoozeReminder(scholarClass, action.reminderId, until, { actor });
      return { ok: true, message: `Snoozed for ${minutes} minute${minutes === 1 ? "" : "s"}.` };
    }
    case "reschedule": {
      if (!action.reminderId || !p.dueAt) return { ok: false, message: "I need a reminder and a new time." };
      const target = profile.reminders.find((r) => r.id === action.reminderId);
      store.rescheduleReminder(scholarClass, action.reminderId, p.dueAt, { actor });
      return { ok: true, message: `Moved “${target?.title ?? "reminder"}” to ${new Date(p.dueAt).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}.` };
    }
    case "list": {
      const scope = action.query ?? "today";
      const now = new Date();
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      if (scope === "tomorrow") { start.setDate(start.getDate() + 1); end.setDate(end.getDate() + 2); }
      else if (scope === "week") end.setDate(end.getDate() + 7);
      else if (scope === "tonight") { start.setHours(18, 0, 0, 0); end.setHours(23, 59, 0, 0); }
      else end.setDate(end.getDate() + 1);
      const matches = profile.reminders
        .filter((r) => r.status !== "completed" && r.status !== "cancelled")
        .filter((r) => {
          const due = new Date(r.dueAt);
          return due.getTime() >= start.getTime() && due.getTime() < end.getTime();
        })
        .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
      if (!matches.length) return { ok: true, message: `You have nothing scheduled ${scope === "today" ? "today" : scope === "tomorrow" ? "tomorrow" : scope === "week" ? "this week" : "tonight"}.` };
      const lines = matches.map((r, i) => `${i + 1}. ${r.title} — ${new Date(r.dueAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}${r.subject ? ` (${r.subject})` : ""}`).join("\n");
      return { ok: true, message: `Here's what's ${scope === "today" ? "due today" : scope === "tomorrow" ? "due tomorrow" : scope === "week" ? "coming up this week" : "due tonight"}:\n${lines}` };
    }
    case "find": {
      if (!action.reminderId) return { ok: false, message: "I couldn't find a matching reminder." };
      const target = profile.reminders.find((r) => r.id === action.reminderId);
      if (!target) return { ok: false, message: "That reminder no longer exists." };
      const status = target.status;
      const when = target.snoozeUntil ? `snoozed until ${new Date(target.snoozeUntil).toLocaleString()}` : `due ${new Date(target.dueAt).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`;
      return { ok: true, message: `“${target.title}” is ${status}, ${when}${target.subject ? ` (${target.subject})` : ""}.` };
    }
    case "create-series":
    case "exam-plan": {
      const series = p.series;
      if (!series?.examDate) return { ok: false, message: "I need an exam date to plan revision." };
      const chapters = series.chapters?.length ? series.chapters : [];
      const items = buildRevisionSeries({
        examTitle: series.examTitle ?? "Exam",
        examDate: new Date(series.examDate),
        subject: series.subject,
        chapters,
      });
      const created = store.createRemindersBulk(scholarClass, items.map((item) => ({
        title: item.title,
        type: item.type,
        subject: series.subject,
        chapter: item.chapter,
        dueAt: item.dueAt.toISOString(),
        durationMin: item.durationMin,
        priority: item.type === "exam" ? "high" : "medium",
        source: "lam",
      })), { source: "lam", actor, detail: `Revision series for ${series.examTitle}` });
      return { ok: true, message: `Created a revision series with ${created.length} sessions up to ${new Date(series.examDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}.`, reminderIds: created.map((c) => c.id) };
    }
    case "create-template": {
      if (!p.title) return { ok: false, message: "I need a template name." };
      const template = store.createTemplate(scholarClass, {
        name: p.title,
        description: `Template created by LAM (${action.userCommand.slice(0, 60)})`,
        type: "general",
        priority: "medium",
        dueTime: p.time ?? "18:00",
        recurrence: p.recurrence,
        tags: ["lam"],
      });
      return { ok: true, message: `Saved “${template.name}” as a reusable template.` };
    }
    case "apply-template": {
      if (!p.templateName) return { ok: false, message: "I need a template to apply." };
      const template = profile.templates.find((t) => t.name.toLowerCase() === p.templateName!.toLowerCase() || t.name.toLowerCase().includes(p.templateName!.toLowerCase()));
      if (!template) return { ok: false, message: `I couldn't find a template called “${p.templateName}”.` };
      const reminder = store.applyTemplate(scholarClass, template.id, { source: "lam" });
      if (!reminder) return { ok: false, message: "The template couldn't be applied." };
      return { ok: true, message: `Applied “${template.name}” — created “${reminder.title}”.` };
    }
    case "enable-talk": {
      if (action.reminderId) {
        const target = profile.reminders.find((r) => r.id === action.reminderId);
        if (!target) return { ok: false, message: "That reminder no longer exists." };
        store.updateReminder(scholarClass, action.reminderId, { talkEnabled: true, speakDetails: profile.settings.speakReminderDetails, spokenContentMode: "title" }, { activityActor: actor, detail: "Talk Reminder enabled by LAM" });
        return { ok: true, message: `Talk Reminder enabled for “${target.title}”.` };
      }
      store.updateSettings(scholarClass, { defaultTalkEnabled: true });
      return { ok: true, message: "Talk Reminders are now on by default for new reminders." };
    }
    case "disable-talk": {
      if (action.reminderId) {
        const target = profile.reminders.find((r) => r.id === action.reminderId);
        store.updateReminder(scholarClass, action.reminderId, { talkEnabled: false }, { activityActor: actor, detail: "Talk Reminder disabled by LAM" });
        return { ok: true, message: `Talk Reminder disabled for “${target?.title ?? "reminder"}”.` };
      }
      store.updateSettings(scholarClass, { defaultTalkEnabled: false });
      return { ok: true, message: "Talk Reminders are off by default for new reminders." };
    }
    case "change-voice": {
      const patch: { talkVoiceURI?: string; talkVoiceLanguage?: string } = {};
      if (p.voiceLanguage) patch.talkVoiceLanguage = p.voiceLanguage;
      if (p.voiceURI) patch.talkVoiceURI = p.voiceURI === "female" ? "female-preference" : p.voiceURI;
      store.updateSettings(scholarClass, patch);
      const label = p.voiceLanguage === "en-GB" ? "British" : p.voiceLanguage === "en-US" ? "American" : p.voiceLanguage === "en-IN" ? "Indian English" : "the requested";
      const female = p.voiceURI === "female" ? " female" : "";
      return { ok: true, message: `Talk Reminders will prefer a${female} ${label} voice where available.` };
    }
    case "custom": {
      const command = profile.commands.find((c) => c.name === p.title);
      if (!command) return { ok: false, message: "That custom command isn't configured." };
      const result = executeCustomCommand(scholarClass, command, action.userCommand);
      store.bumpCommandUsage(scholarClass, command.id);
      return result;
    }
  }
}

// ============================================================================
// Custom command execution — maps onto approved Scholar actions only.
// ============================================================================

export function executeCustomCommand(scholarClass: 9 | 11, command: LamCommand, userCommand: string): { ok: boolean; message: string; reminderIds?: string[] } {
  const store = useReminderStore.getState();
  const profile = store.ensureProfile(scholarClass);
  const parsed = parseQuickCommand(userCommand || command.name, new Date());

  switch (command.action.type) {
    case "create-reminder": {
      const reminder = store.createReminder(scholarClass, {
        title: parsed.title === "Untitled reminder" ? command.action.defaults.title : parsed.title,
        dueAt: parsed.dueAt.toISOString(),
        subject: command.action.defaults.subject ?? parsed.subject,
        type: command.action.defaults.type ?? "general",
        priority: command.action.defaults.priority ?? parsed.priority,
        durationMin: command.action.defaults.durationMin ?? parsed.durationMin,
        talkEnabled: command.action.defaults.talkEnabled,
        recurrence: parsed.recurrence ?? command.action.defaults.recurrence,
        alerts: parsed.preAlertMinutes ? [{ id: `al-${Date.now()}`, offsetMinutes: parsed.preAlertMinutes, label: `${parsed.preAlertMinutes} minutes before` }] : [],
      }, { source: "lam", activityActor: "lam", detail: `Custom command “${command.name}”` });
      return { ok: true, message: `“${command.name}” created “${reminder.title}”.` };
    }
    case "start-focus": {
      if (typeof window !== "undefined") {
        navigateTo("focus", { minutes: command.action.minutes, source: "lam" });
      }
      return { ok: true, message: `Opened a ${command.action.minutes}-minute focus session.` };
    }
    case "apply-template": {
      // Extract before the callback — property narrowing is lost inside closures.
      const templateName = command.action.templateName;
      const template = profile.templates.find((t) => t.name.toLowerCase() === templateName.toLowerCase());
      if (!template) return { ok: false, message: `Template “${templateName}” not found.` };
      const reminder = store.applyTemplate(scholarClass, template.id, { source: "lam" });
      return reminder ? { ok: true, message: `Applied “${template.name}” — created “${reminder.title}”.` } : { ok: false, message: "Could not apply the template." };
    }
    case "exam-rescue": {
      const exams = profile.reminders.filter((r) => r.type === "exam" && r.status !== "completed").sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
      const exam = exams[0];
      if (!exam) return { ok: false, message: "No upcoming exam found to rescue. Add an exam reminder first." };
      const items = buildRevisionSeries({ examTitle: exam.title, examDate: new Date(exam.dueAt), subject: exam.subject, chapters: [] });
      const created = store.createRemindersBulk(scholarClass, items.map((item) => ({ title: item.title, type: item.type, subject: exam.subject, chapter: item.chapter, dueAt: item.dueAt.toISOString(), durationMin: item.durationMin, priority: item.type === "exam" ? "high" : "medium", source: "lam" })), { source: "lam", actor: "lam", detail: `Exam Rescue for ${exam.title}` });
      return { ok: true, message: `Exam Rescue created ${created.length} revision sessions for “${exam.title}”.`, reminderIds: created.map((c) => c.id) };
    }
    case "navigate": {
      if (typeof window !== "undefined") {
        navigateTo(command.action.view);
      }
      return { ok: true, message: `Opened ${command.action.view}.` };
    }
  }
}

// ============================================================================
// Helpers for the LAM widget
// ============================================================================

export function summaryForLAM(reminders: SmartReminder[], scholarClass: 9 | 11): string {
  const now = new Date();
  const active = reminders.filter((r) => r.status === "scheduled" || r.status === "active");
  const today = active.filter((r) => {
    const due = new Date(r.dueAt);
    return due.toDateString() === now.toDateString();
  });
  const upcoming = active.filter((r) => {
    const due = new Date(r.dueAt);
    return due.toDateString() !== now.toDateString() && due.getTime() > now.getTime();
  }).slice(0, 6);
  const lines: string[] = [`Class ${scholarClass} — ${active.length} active reminder(s).`];
  if (today.length) lines.push(`Today: ${today.map((r) => `${r.title} (${new Date(r.dueAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })})`).join("; ")}.`);
  if (upcoming.length) lines.push(`Upcoming: ${upcoming.map((r) => `${r.title} (${new Date(r.dueAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })})`).join("; ")}.`);
  lines.push("Reminder changes are executed locally by Scholar; do not claim you performed an action.");
  return lines.join(" ");
}

export function buildCustomCommandAction(command: LamCommand, scholarClass: 9 | 11, userCommand: string): ReminderLamAction {
  return { type: "reminder", op: "custom", payload: { title: command.name }, userCommand };
}

export function testCommandAction(command: LamCommand, scholarClass: 9 | 11): { ok: boolean; message: string } {
  const preview = parseQuickCommand(`remind me ${command.triggers[0] ?? ""}`, new Date());
  switch (command.action.type) {
    case "create-reminder":
      return { ok: true, message: `Test: would create “${preview.title}” · ${preview.dueAt.toLocaleString()} · priority ${preview.priority}.` };
    case "start-focus":
      return { ok: true, message: `Test: would open a ${command.action.minutes}-minute focus session.` };
    case "apply-template":
      return { ok: true, message: `Test: would apply template “${command.action.templateName}”.` };
    case "exam-rescue":
      return { ok: true, message: "Test: would find the next exam and build a revision series." };
    case "navigate":
      return { ok: true, message: `Test: would open ${command.action.view}.` };
  }
}
