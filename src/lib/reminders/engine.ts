// ============================================================================
// Smart Reminders 2.0 — pure engine logic
// Recurrence, conflicts, quiet hours, smart reschedule suggestions,
// natural-language quick parsing, legacy migration, templates and revision
// series. Kept free of React/browser side effects so it can be unit tested.
// ============================================================================

import {
  DEFAULT_REMINDER_SETTINGS,
  type ReminderPriority,
  type ReminderProfileState,
  type ReminderSettings,
  type ReminderTemplate,
  type RecurrenceRule,
  type SmartReminder,
} from "./types";

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;
export const MINUTE_MS = 60_000;

export const SUBJECT_IDS = [
  "physics", "chemistry", "maths", "cs", "english", "hindi", "sst", "science", "biology", "economics",
] as const;

export const SUBJECT_ALIASES: Record<string, string> = {
  physics: "physics", phy: "physics", physical: "physics",
  chemistry: "chemistry", chem: "chemistry", "physical chemistry": "chemistry", "organic chemistry": "chemistry", "inorganic chemistry": "chemistry",
  maths: "maths", math: "maths", mathematics: "maths", "mathematical": "maths",
  cs: "cs", "computer science": "cs", "computer": "cs", "computers": "cs", "programming": "cs", python: "cs",
  english: "english", "english literature": "english",
  hindi: "hindi",
  sst: "sst", "social science": "sst", "social studies": "sst", history: "sst", civics: "sst", geography: "sst", economics: "sst",
  science: "science", biology: "science", bio: "science",
};

export function detectSubject(text: string): { subject?: string; matched?: string } {
  const value = text.toLowerCase();
  const found: Array<{ alias: string; subject: string }> = [];
  for (const [alias, subject] of Object.entries(SUBJECT_ALIASES)) {
    if (alias.length < 3) continue;
    if (new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(value)) {
      found.push({ alias, subject });
    }
  }
  if (!found.length) return {};
  // Prefer the longest matched alias (more specific).
  found.sort((a, b) => b.alias.length - a.alias.length);
  return { subject: found[0].subject, matched: found[0].alias };
}

// ============================================================================
// Time helpers
// ============================================================================

export function parseHHMM(value: string): { hour: number; minute: number } | null {
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]m)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3]?.toLowerCase();
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return { hour, minute };
}

export function formatHHMM(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function toISODate(date: Date): string {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * MINUTE_MS);
  return d.toISOString().slice(0, 10);
}

export function startOfDay(date: Date): Date {
  const out = new Date(date);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);
}

// ============================================================================
// Recurrence
// ============================================================================

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

export function nextOccurrenceAfter(rule: RecurrenceRule, after: Date): Date | null {
  const cursor = new Date(after);
  cursor.setSeconds(0, 0);
  for (let i = 0; i < 2_000; i++) {
    cursor.setDate(cursor.getDate() + 1);
    if (!matchesRule(rule, cursor)) continue;
    return cursor;
  }
  return null;
}

export function matchesRule(rule: RecurrenceRule, date: Date): boolean {
  switch (rule.frequency) {
    case "daily":
      return true;
    case "weekdays": {
      const weekday = date.getDay();
      return weekday >= 1 && weekday <= 5;
    }
    case "weekly": {
      const weekdays = rule.weekdays && rule.weekdays.length ? rule.weekdays : [date.getDay()];
      if (!weekdays.includes(date.getDay())) return false;
      const anchor = startOfDay(new Date(rule.anchorAt ?? date.getTime()));
      const diffDays = daysBetween(anchor, date);
      return diffDays % Math.max(1, rule.interval) === 0;
    }
    case "monthly": {
      if (rule.dayOfMonth && date.getDate() !== rule.dayOfMonth) return false;
      const anchor = startOfDay(new Date(rule.anchorAt ?? date.getTime()));
      const months = (date.getFullYear() - anchor.getFullYear()) * 12 + (date.getMonth() - anchor.getMonth());
      return months % Math.max(1, rule.interval) === 0;
    }
    case "custom": {
      const anchor = startOfDay(new Date(rule.anchorAt ?? date.getTime()));
      const diffDays = daysBetween(anchor, date);
      if (diffDays < 0) return false;
      return diffDays % Math.max(1, rule.customDays ?? rule.interval) === 0;
    }
  }
}

/** Serialize a recurrence rule for the reminder. */
export function ruleForInput(input: {
  frequency?: RecurrenceRule["frequency"];
  interval?: number;
  weekdays?: number[];
  dayOfMonth?: number;
  customDays?: number;
  anchorAt?: string;
}): RecurrenceRule | undefined {
  if (!input.frequency || input.frequency === "custom" && !input.customDays) {
    return undefined;
  }
  return {
    frequency: input.frequency,
    interval: Math.max(1, Math.round(input.interval ?? 1)),
    weekdays: input.weekdays?.length ? input.weekdays : undefined,
    dayOfMonth: input.dayOfMonth,
    customDays: input.customDays,
    anchorAt: input.anchorAt,
  };
}

export function recurrenceLabel(rule?: RecurrenceRule): string | null {
  if (!rule) return null;
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  switch (rule.frequency) {
    case "daily": return rule.interval > 1 ? `Every ${rule.interval} days` : "Every day";
    case "weekdays": return "Every weekday";
    case "weekly": {
      const days = rule.weekdays?.length ? rule.weekdays.map((d) => dayNames[d].slice(0, 3)).join(", ") : "weekly";
      return rule.interval > 1 ? `Every ${rule.interval} weeks on ${days}` : `Every ${days}`;
    }
    case "monthly": return rule.interval > 1 ? `Every ${rule.interval} months` : "Every month";
    case "custom": return rule.customDays ? `Every ${rule.customDays} days` : "Custom";
  }
}

// ============================================================================
// Quiet hours
// ============================================================================

export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** True when `date` falls inside the quiet-hours window (supports overnight windows). */
export function inQuietHours(date: Date, quiet: ReminderSettings["quietHours"]): boolean {
  if (!quiet.enabled) return false;
  if (quiet.days.length && !quiet.days.includes(date.getDay())) return false;
  const start = parseHHMM(quiet.start);
  const end = parseHHMM(quiet.end);
  if (!start || !end) return false;
  const now = minutesOfDay(date);
  if (start.hour * 60 + start.minute === end.hour * 60 + end.minute) return false;
  if (start.hour * 60 + start.minute < end.hour * 60 + end.minute) {
    return now >= start.hour * 60 + start.minute && now < end.hour * 60 + end.minute;
  }
  // Overnight window
  return now >= start.hour * 60 + start.minute || now < end.hour * 60 + end.minute;
}

/** Decide whether a reminder may notify right now given quiet hours. */
export function mayFireNow(reminder: Pick<SmartReminder, "priority" | "type" | "important" | "talkEnabled">, settings: ReminderSettings, now: Date): { allow: boolean; allowSpeech: boolean } {
  const quiet = settings.quietHours;
  const inQuiet = inQuietHours(now, quiet);
  if (!inQuiet) return { allow: true, allowSpeech: !quiet.silenceSpeech };
  const isExam = reminder.type === "exam";
  const isImportant = reminder.priority === "high" || reminder.priority === "critical" || reminder.important;
  if (isExam && quiet.allowExams) return { allow: true, allowSpeech: !quiet.silenceSpeech };
  if (isImportant && quiet.allowImportant) return { allow: true, allowSpeech: !quiet.silenceSpeech };
  // Talk reminders are gated separately.
  const allowSpeech = reminder.talkEnabled && quiet.allowTalk ? !quiet.silenceSpeech : false;
  return { allow: false, allowSpeech };
}

// ============================================================================
// Conflict detection
// ============================================================================

export interface ConflictWarning {
  kind: "overlap" | "exam" | "consecutive" | "quiet-hours" | "deadline-before" | "duplicate" | "past";
  message: string;
  suggestions: string[];
}

export function detectConflicts(reminder: Pick<SmartReminder, "id" | "title" | "dueAt" | "durationMin" | "priority" | "type">, others: SmartReminder[], settings: ReminderSettings, now = new Date()): ConflictWarning[] {
  const warnings: ConflictWarning[] = [];
  const due = new Date(reminder.dueAt);
  const end = new Date(due.getTime() + (reminder.durationMin ?? 0) * MINUTE_MS);

  if (due.getTime() < now.getTime()) {
    warnings.push({
      kind: "past",
      message: "This time is in the past.",
      suggestions: ["Tomorrow at 9:00 AM", "Tomorrow at 6:00 PM", "In 1 hour"],
    });
  }

  const dupe = others.find((o) => o.id !== reminder.id && o.title.trim().toLowerCase() === reminder.title.trim().toLowerCase() && Math.abs(new Date(o.dueAt).getTime() - due.getTime()) < 15 * MINUTE_MS);
  if (dupe) {
    warnings.push({ kind: "duplicate", message: `This looks like a duplicate of “${dupe.title}”.`, suggestions: ["Keep it anyway", "Edit the title"] });
  }

  const overlaps = others.filter((o) => o.id !== reminder.id && o.status !== "completed" && o.status !== "cancelled").filter((o) => {
    const oStart = new Date(o.dueAt).getTime();
    const oEnd = oStart + (o.durationMin ?? 0) * MINUTE_MS;
    return due.getTime() < oEnd && end.getTime() > oStart;
  });
  if (overlaps.length) {
    const names = overlaps.slice(0, 2).map((o) => o.title).join(" and ");
    warnings.push({
      kind: "overlap",
      message: `This overlaps with “${names}”.`,
      suggestions: ["6:30 PM", "7:15 PM", "Tomorrow at 5:30 PM"],
    });
  }

  const sameWindow = others.filter((o) => o.id !== reminder.id && o.status !== "completed" && o.status !== "cancelled").filter((o) => {
    const delta = Math.abs(new Date(o.dueAt).getTime() - due.getTime());
    return delta > 0 && delta <= 30 * MINUTE_MS;
  });
  if (sameWindow.length >= 2) {
    warnings.push({
      kind: "consecutive",
      message: `${sameWindow.length + 1} study sessions are scheduled back-to-back. Consider spacing them out.`,
      suggestions: ["Move this to 30 minutes later", "Shorten to 15 minutes"],
    });
  }

  const examConflict = others.find((o) => o.id !== reminder.id && o.type === "exam" && o.status !== "completed" && new Date(o.dueAt).getTime() >= end.getTime() && new Date(o.dueAt).getTime() - end.getTime() < DAY_MS);
  if (examConflict) {
    warnings.push({
      kind: "exam",
      message: `This session ends less than a day before “${examConflict.title}”. Keep a clear break before the exam.`,
      suggestions: ["Finish earlier", "Keep it — I'll rest after"],
    });
  }

  const deadlineBefore = others.find((o) => o.id !== reminder.id && o.type === "exam" && o.status !== "completed" && new Date(o.dueAt).getTime() < due.getTime());
  if (deadlineBefore) {
    warnings.push({
      kind: "deadline-before",
      message: `This is scheduled after the deadline of “${deadlineBefore.title}”.`,
      suggestions: ["Move before the deadline", "Keep it — it's preparation after the mock"],
    });
  }

  if (inQuietHours(due, settings.quietHours)) {
    warnings.push({
      kind: "quiet-hours",
      message: `This falls inside your quiet hours (${settings.quietHours.start} – ${settings.quietHours.end}).`,
      suggestions: ["8:00 AM", "6:00 PM", "Keep it — mark as important"],
    });
  }

  return warnings;
}

// ============================================================================
// Smart snooze / reschedule suggestions
// ============================================================================

export interface RescheduleSuggestion {
  dueAt: Date;
  durationMin?: number;
  reason: string;
}

export function smartRescheduleOptions(reminder: Pick<SmartReminder, "dueAt" | "durationMin" | "type" | "priority">, exams: SmartReminder[], now = new Date()): RescheduleSuggestion[] {
  const suggestions: RescheduleSuggestion[] = [];
  const original = new Date(reminder.dueAt);
  const duration = reminder.durationMin ?? 25;

  // 1. Next available study block — round to the next 10 minutes in the evening window.
  const evening = new Date(now);
  evening.setHours(19, 0, 0, 0);
  if (evening.getTime() <= now.getTime()) { evening.setDate(evening.getDate() + 1); evening.setHours(19, 0, 0, 0); }
  const rounded = new Date(evening);
  rounded.setMinutes(Math.ceil(rounded.getMinutes() / 10) * 10);
  suggestions.push({ dueAt: rounded, durationMin: duration, reason: "Next available study block" });

  // 2. Before the linked exam/deadline (one day before the next exam).
  const nextExam = exams.filter((e) => new Date(e.dueAt).getTime() > now.getTime()).sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())[0];
  if (nextExam) {
    const before = new Date(new Date(nextExam.dueAt).getTime() - DAY_MS);
    before.setHours(original.getHours(), original.getMinutes(), 0, 0);
    suggestions.push({ dueAt: before, durationMin: duration, reason: `Your ${nextExam.title} is in ${Math.max(1, daysBetween(now, new Date(nextExam.dueAt)))} days` });
  }

  // 3. Reduced session duration — same day, shorter.
  suggestions.push({ dueAt: original, durationMin: Math.max(10, Math.round(duration / 2)), reason: "Split into a shorter session (half the duration)" });

  // 4. Same time tomorrow.
  const tomorrow = new Date(original);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (tomorrow.getTime() >= now.getTime()) {
    suggestions.push({ dueAt: tomorrow, durationMin: duration, reason: "Move to the same time tomorrow" });
  }

  // 5. This evening (tonight at 8 PM) if the original was daytime.
  const tonight = new Date(now);
  tonight.setHours(20, 0, 0, 0);
  if (tonight.getTime() > now.getTime() && original.getHours() < 18) {
    suggestions.push({ dueAt: tonight, durationMin: Math.min(duration, 30), reason: "A shorter session tonight" });
  }

  return suggestions.slice(0, 4);
}

export function formatSuggestion(suggestion: RescheduleSuggestion): string {
  const date = suggestion.dueAt;
  const sameDay = daysBetween(new Date(), date) === 0;
  const label = sameDay ? "Today" : daysBetween(new Date(), date) === 1 ? "Tomorrow" : date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const time = date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return `${label} · ${time}${suggestion.durationMin ? ` · ${suggestion.durationMin} minutes` : ""}`;
}

// ============================================================================
// Natural-language quick parsing
// ============================================================================

export interface QuickParseResult {
  title: string;
  description?: string;
  type: SmartReminder["type"];
  subject?: string;
  chapter?: string;
  dueAt: Date;
  allDay: boolean;
  priority: ReminderPriority;
  recurrence?: RecurrenceRule;
  recurrenceCount?: number;
  durationMin?: number;
  preAlertMinutes?: number;
  talkEnabled?: boolean;
  confidence: "high" | "medium" | "low";
  ambiguity: string[];
  matchedTime?: boolean;
}

const DAY_NAMES: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

export function parseQuickCommand(text: string, now = new Date()): QuickParseResult {
  const raw = text.trim();
  const ambiguity: string[] = [];
  const value = raw.toLowerCase();

  // --- Type detection -----------------------------------------------------
  let type: SmartReminder["type"] = "general";
  if (/\b(homework|h\.w\.)\b/.test(value)) type = "homework";
  else if (/\bassignment\b/.test(value)) type = "assignment";
  else if (/\b(exam|test|pre-?board|mock|paper)\b/.test(value)) type = "exam";
  else if (/\b(revise|revision|revise for|revise about|revision for)\b/.test(value)) type = "revision";
  else if (/\bpractical\b/.test(value)) type = "practical";
  else if (/\bproject\b/.test(value)) type = "project";
  else if (/\b(focus session|pomodoro|focus timer|focus)\b/.test(value)) type = "focus";
  else if (/\b(break|rest)\b/.test(value)) type = "break";
  else if (/\bhabit\b/.test(value)) type = "habit";
  else if (/\bstudy session\b/.test(value)) type = "study";

  // --- Priority -----------------------------------------------------------
  let priority: ReminderPriority = "medium";
  if (/\b(urgent|critical|very important|high priority|priority high)\b/.test(value)) priority = "critical";
  else if (/\b(high|important|important reminder|priority)\b/.test(value)) priority = "high";
  else if (/\b(low priority|gentle|whenever)\b/.test(value)) priority = "low";

  // --- Subject ------------------------------------------------------------
  const { subject } = detectSubject(raw);

  // --- Recurrence ---------------------------------------------------------
  let recurrence: RecurrenceRule | undefined;
  let recurrenceCount: number | undefined;
  const everyMatch = value.match(/\bevery\s+([a-z]+)\b/);
  if (everyMatch) {
    const token = everyMatch[1];
    if (token in DAY_NAMES) {
      recurrence = { frequency: "weekly", interval: 1, weekdays: [DAY_NAMES[token]], anchorAt: now.toISOString() };
    } else if (token === "weekday" || token === "weekday") {
      recurrence = { frequency: "weekdays", interval: 1 };
    } else if (token === "week") {
      recurrence = { frequency: "weekly", interval: 1, weekdays: [now.getDay()], anchorAt: now.toISOString() };
    } else if (token === "day" || token === "daily") {
      recurrence = { frequency: "daily", interval: 1 };
    } else if (token === "month") {
      recurrence = { frequency: "monthly", interval: 1, dayOfMonth: now.getDate() };
    }
  } else if (/\b(weekdays?|on weekdays)\b/.test(value)) {
    recurrence = { frequency: "weekdays", interval: 1 };
  } else if (/\bdaily\b/.test(value)) {
    recurrence = { frequency: "daily", interval: 1 };
  }
  const timesMatch = value.match(/\bevery\s+(\d+)\s+times?\b/);
  if (timesMatch) recurrenceCount = Math.min(60, Math.max(2, Number(timesMatch[1])));
  if (/three times before|twice before|3 times before|2 times before/.test(value)) {
    recurrenceCount = /\bthree|3 times\b/.test(value) ? 3 : 2;
    if (!recurrence) recurrence = { frequency: "daily", interval: 1 };
  }

  // --- Pre-alert ----------------------------------------------------------
  let preAlertMinutes: number | undefined;
  const preAlert = value.match(/(\d+)\s*(?:min(?:ute)?s?|hours?|days?)?\s*before/i);
  if (preAlert) {
    const unit = preAlert[0].match(/hour/) ? 60 : preAlert[0].match(/day/) ? 24 * 60 : 1;
    preAlertMinutes = Number(preAlert[1]) * unit;
  }

  // --- Date detection -----------------------------------------------------
  const dueAt = new Date(now);
  dueAt.setSeconds(0, 0);
  let matchedTime = false;
  let dateFound = false;
  let allDay = false;

  const tomorrow = /\btomorrow\b/.test(value);
  const todayWord = /\btoday\b/.test(value);
  const tonight = /\btonight\b/.test(value);
  const inMatch = value.match(/\bin\s+(\d+)\s*(minutes?|mins?|hours?|hrs?|days?)\b/);
  const nextWeekday = value.match(/\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  const onMatch = value.match(/\bon\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+([a-z]+))?\b/);

  if (inMatch) {
    const amount = Number(inMatch[1]);
    const unit = inMatch[2];
    const ms = unit.startsWith("min") ? amount * MINUTE_MS : unit.startsWith("hour") || unit.startsWith("hr") ? amount * HOUR_MS : amount * DAY_MS;
    dueAt.setTime(now.getTime() + ms);
    dateFound = true;
    matchedTime = true; // a relative offset is an explicit time
    allDay = false;
  } else if (nextWeekday) {
    const target = DAY_NAMES[nextWeekday[1]];
    let daysAhead = (target - now.getDay() + 7) % 7;
    if (daysAhead === 0) daysAhead = 7;
    dueAt.setDate(now.getDate() + daysAhead);
    dateFound = true;
  } else if (tomorrow) {
    dueAt.setDate(now.getDate() + 1);
    dateFound = true;
  } else if (tonight) {
    dueAt.setHours(20, 0, 0, 0);
    dateFound = true;
    matchedTime = true;
  } else if (todayWord) {
    dateFound = true;
  } else if (onMatch && Number(onMatch[1]) >= 1 && Number(onMatch[1]) <= 31) {
    const day = Number(onMatch[1]);
    let month = now.getMonth();
    if (onMatch[2]) {
      const monthNames: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
      const foundMonth = Object.entries(monthNames).find(([key]) => onMatch![2]!.startsWith(key));
      if (foundMonth) month = foundMonth[1];
    }
    dueAt.setMonth(month);
    dueAt.setDate(day);
    if (dueAt.getTime() < now.getTime()) dueAt.setFullYear(now.getFullYear() + 1);
    dateFound = true;
    allDay = true;
  } else if (/\b(this )?(morning)\b/.test(value)) {
    dueAt.setHours(9, 0, 0, 0);
    dateFound = true; matchedTime = true;
  } else if (/\b(afternoon)\b/.test(value)) {
    dueAt.setHours(15, 0, 0, 0);
    dateFound = true; matchedTime = true;
  } else if (/\b(evening)\b/.test(value)) {
    dueAt.setHours(18, 0, 0, 0);
    dateFound = true; matchedTime = true;
  }

  // --- Time detection -----------------------------------------------------
  const timeMatch = value.match(/(?:^|\s|at|by|around|@)\s*(\d{1,2}(?::\d{2})?\s*[ap]m\b)|(?:at|by|around|@)\s*(\d{1,2}(?::\d{2})?)\b/);
  if (timeMatch) {
    const token = (timeMatch[1] ?? timeMatch[2]).trim();
    const parsed = parseHHMM(token);
    if (parsed) {
      dueAt.setHours(parsed.hour, parsed.minute, 0, 0);
      matchedTime = true;
      allDay = false;
      // If the parsed time is earlier than now on the same day, assume tomorrow
      // only when the phrase named a future day.
      if (dueAt.getTime() < now.getTime() && (tomorrow || todayWord || nextWeekday)) {
        dueAt.setDate(dueAt.getDate() + 1);
      }
    }
  }

  // --- Default time when a date but no time ---------------------------------
  if (dateFound && !matchedTime) {
    dueAt.setHours(9, 0, 0, 0);
    allDay = true;
  }
  if (!dateFound && !matchedTime) {
    // Default: tonight at 7 PM
    dueAt.setHours(19, 0, 0, 0);
    if (dueAt.getTime() <= now.getTime()) dueAt.setDate(dueAt.getDate() + 1);
    ambiguity.push("No time given — scheduled for the next available evening slot.");
  }

  // --- Duration -------------------------------------------------------------
  let durationMin: number | undefined;
  const durationMatch = value.match(/(\d{1,3})\s*-?\s*(?:min(?:ute)?s?|minutes?|m)\b/);
  if (durationMatch && type !== "general") {
    durationMin = Math.min(240, Math.max(5, Number(durationMatch[1])));
  } else if (/\bfocus session\b/.test(value)) {
    durationMin = 25;
  }

  // --- Title ----------------------------------------------------------------
  let title = raw;
  title = title.replace(/\b(remind me (to|about|for)?|please|kindly)\b/gi, " ").trim();
  title = title.replace(/\b(every\s+[a-z]+\s*,?\s*|\bevery\s+weekday\b|\bdaily\b|\btwice|thrice|three times|two times|twice before|three times before)/gi, " ").trim();
  title = title.replace(/\b(tomorrow|today|tonight|this morning|this afternoon|this evening|next\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday))\b/gi, " ").trim();
  title = title.replace(/\b(at|by|around|@)\s*\d{1,2}(?::\d{2})?\s*[ap]m\b/gi, " ").trim();
  title = title.replace(/\b(at|by|around|@)\s*\d{1,2}(?::\d{2})?\b/gi, " ").trim();
  title = title.replace(/\bin\s+\d+\s*(minutes?|mins?|hours?|hrs?|days?)\b/gi, " ").trim();
  title = title.replace(/\b\d{1,3}\s*-?\s*min(?:ute)?s?\b/gi, " ").trim();
  title = title.replace(/\bon\s+\d{1,2}(?:st|nd|rd|th)?(?:\s+[a-z]+)?\b/gi, " ").trim();
  title = title.replace(/\s{2,}/g, " ").replace(/^[,:\s-]+|[,:\s-]+$/g, "").trim();
  if (!title) title = "Untitled reminder";
  if (title.length > 90) title = title.slice(0, 90).trim() + "…";

  // --- Chapter capture ------------------------------------------------------
  let chapter: string | undefined;
  const reviseMatch = raw.match(/\brevise\s+([A-Z][a-zA-Z0-9&'’\- ]{2,60})/);
  if (reviseMatch) {
    const candidate = reviseMatch[1].trim();
    if (!/\b(at|by|on|in|tomorrow|today|every|for|before)\b/.test(candidate)) chapter = candidate;
  }

  const confidence: QuickParseResult["confidence"] = matchedTime ? "high" : dateFound ? "medium" : "low";

  return {
    title: title || "Untitled reminder",
    type,
    subject,
    chapter,
    dueAt,
    allDay,
    priority,
    recurrence,
    recurrenceCount,
    durationMin,
    preAlertMinutes,
    talkEnabled: undefined,
    confidence,
    ambiguity,
    matchedTime,
  };
}

// ============================================================================
// Legacy migration
// ============================================================================

export interface LegacyReminder {
  id?: string;
  type?: string;
  title?: string;
  text?: string;
  body?: string;
  subject?: string;
  chapter?: string;
  dueAt?: number | string;
  at?: number | string;
  priority?: string;
  status?: string;
  snoozeUntil?: number | string;
  createdAt?: number | string;
  source?: string;
}

export function migrateLegacyReminders(scholarClass: 9 | 11, legacyLists: LegacyReminder[][], now = new Date()): SmartReminder[] {
  const seen = new Set<string>();
  const out: SmartReminder[] = [];
  const nowMs = now.getTime();

  for (const list of legacyLists) {
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      if (!raw || typeof raw !== "object") continue;
      const title = String(raw.title ?? raw.text ?? "").trim() || "Untitled reminder";
      const rawDue = raw.dueAt ?? raw.at;
      let dueAt: Date;
      if (typeof rawDue === "number" && rawDue > 0) dueAt = new Date(rawDue);
      else if (typeof rawDue === "string" && rawDue.trim()) {
        const parsed = Date.parse(rawDue);
        dueAt = Number.isNaN(parsed) ? new Date(nowMs + DAY_MS) : new Date(parsed);
      } else dueAt = new Date(nowMs + DAY_MS);
      if (Number.isNaN(dueAt.getTime())) dueAt = new Date(nowMs + DAY_MS);

      let status: SmartReminder["status"] = "scheduled";
      if (raw.status === "dismissed" || raw.status === "cancelled") status = "cancelled";
      else if (raw.status === "completed") status = "completed";
      else if (raw.status === "snoozed") status = "scheduled";
      else if (dueAt.getTime() < nowMs && raw.status !== "snoozed") status = "missed";

      const legacyId = raw.id ? String(raw.id) : undefined;
      const dedupeKey = `${title.toLowerCase()}|${Math.floor(dueAt.getTime() / 60_000)}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      let type: SmartReminder["type"] = "general";
      const rawType = String(raw.type ?? "").toLowerCase();
      if (["revision"].includes(rawType)) type = "revision";
      else if (["exam"].includes(rawType)) type = "exam";
      else if (["homework"].includes(rawType)) type = "homework";
      else if (["assignment"].includes(rawType)) type = "assignment";
      else if (["custom"].includes(rawType)) type = "custom";
      else if (["focus"].includes(rawType)) type = "focus";

      const snoozeUntil = typeof raw.snoozeUntil === "number" && raw.snoozeUntil > nowMs ? new Date(raw.snoozeUntil).toISOString() : undefined;

      out.push({
        id: `mig-${legacyId ?? `${title.slice(0, 12).replace(/\W/g, "")}-${out.length}`}-${Math.random().toString(36).slice(2, 6)}`,
        profileClass: scholarClass,
        title,
        description: raw.body ? String(raw.body).slice(0, 400) : undefined,
        type,
        subject: raw.subject ? String(raw.subject) : undefined,
        chapter: raw.chapter ? String(raw.chapter) : undefined,
        tags: [],
        priority: (["low", "medium", "high", "critical"].includes(String(raw.priority)) ? String(raw.priority) : "medium") as ReminderPriority,
        dueAt: dueAt.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "local",
        allDay: false,
        alerts: [],
        firedAlertIds: [],
        talkEnabled: false,
        speechRate: 1, speechPitch: 1, speechVolume: 1,
        spokenContentMode: "title",
        speakDetails: false,
        checklist: [],
        important: status === "missed" && dueAt.getTime() < nowMs,
        allowSmartReschedule: true,
        requireCompletionConfirmation: false,
        status,
        source: raw.source === "ai" ? "ai-suggestion" : raw.source === "system" ? "system" : "manual",
        snoozeUntil,
        createdAt: typeof raw.createdAt === "number" ? new Date(raw.createdAt).toISOString() : new Date(nowMs).toISOString(),
        updatedAt: new Date(nowMs).toISOString(),
        completedAt: status === "completed" ? new Date(nowMs).toISOString() : undefined,
        legacyId,
      });
    }
  }
  return out;
}

// ============================================================================
// Templates
// ============================================================================

export const DEFAULT_TEMPLATES: ReminderTemplate[] = [
  { id: "tpl-daily-revision", name: "Daily Revision", description: "A focused daily revision block for one chapter.", icon: "📖", type: "revision", priority: "medium", durationMin: 30, tags: ["revision"], dueOffsetDays: 0, dueTime: "18:00", recurrence: { frequency: "daily", interval: 1 }, preAlertMinutes: 10, builtIn: true, createdAt: "", updatedAt: "" },
  { id: "tpl-homework", name: "Homework Session", description: "Get homework done before it's due.", icon: "📝", type: "homework", priority: "high", durationMin: 40, tags: ["homework"], dueOffsetDays: 0, dueTime: "17:00", preAlertMinutes: 15, builtIn: true, createdAt: "", updatedAt: "" },
  { id: "tpl-exam-countdown", name: "Exam Countdown", description: "Daily countdown sessions until an exam.", icon: "⏳", type: "exam", priority: "high", durationMin: 60, tags: ["exam"], dueOffsetDays: 0, dueTime: "19:00", recurrence: { frequency: "daily", interval: 1 }, preAlertMinutes: 30, builtIn: true, createdAt: "", updatedAt: "" },
  { id: "tpl-formula-review", name: "Weekly Formula Review", description: "Weekly formula and concept review.", icon: "🧮", type: "revision", priority: "medium", durationMin: 20, tags: ["formulas"], dueOffsetDays: 0, dueTime: "18:30", recurrence: { frequency: "weekly", interval: 1, weekdays: [6] }, preAlertMinutes: 10, builtIn: true, createdAt: "", updatedAt: "" },
  { id: "tpl-focus-sprint", name: "Focus Sprint", description: "A 25-minute Pomodoro focus sprint.", icon: "🍅", type: "focus", priority: "medium", durationMin: 25, tags: ["focus"], dueOffsetDays: 0, dueTime: "16:00", preAlertMinutes: 5, builtIn: true, createdAt: "", updatedAt: "" },
  { id: "tpl-assignment", name: "Assignment Deadline", description: "Finish an assignment before the deadline.", icon: "🗂️", type: "assignment", priority: "high", durationMin: 45, tags: ["assignment"], dueOffsetDays: 1, dueTime: "20:00", preAlertMinutes: 60, builtIn: true, createdAt: "", updatedAt: "" },
  { id: "tpl-practical", name: "Practical Preparation", description: "Prepare for a lab practical.", icon: "🧪", type: "practical", priority: "medium", durationMin: 30, tags: ["practical"], dueOffsetDays: 1, dueTime: "17:30", preAlertMinutes: 30, builtIn: true, createdAt: "", updatedAt: "" },
  { id: "tpl-morning-plan", name: "Morning Study Plan", description: "Plan the day every morning.", icon: "🌅", type: "study", priority: "low", durationMin: 15, tags: ["planning"], dueOffsetDays: 0, dueTime: "08:00", recurrence: { frequency: "daily", interval: 1 }, preAlertMinutes: 0, builtIn: true, createdAt: "", updatedAt: "" },
  { id: "tpl-evening-review", name: "Evening Review", description: "Review what you studied today.", icon: "🌙", type: "revision", priority: "low", durationMin: 20, tags: ["review"], dueOffsetDays: 0, dueTime: "21:00", recurrence: { frequency: "daily", interval: 1 }, preAlertMinutes: 5, builtIn: true, createdAt: "", updatedAt: "" },
];

export function createReminderFromTemplate(template: ReminderTemplate, now = new Date()): Partial<SmartReminder> {
  const dueAt = new Date(now);
  dueAt.setDate(dueAt.getDate() + template.dueOffsetDays);
  const parsedTime = parseHHMM(template.dueTime);
  if (parsedTime) dueAt.setHours(parsedTime.hour, parsedTime.minute, 0, 0);
  const alerts = template.preAlertMinutes && template.preAlertMinutes > 0
    ? [{ id: `al-${Date.now()}`, offsetMinutes: template.preAlertMinutes, label: `${template.preAlertMinutes} minutes before` }]
    : [];
  return {
    type: template.type,
    subject: template.subject,
    priority: template.priority,
    durationMin: template.durationMin,
    tags: [...template.tags],
    dueAt: dueAt.toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "local",
    allDay: false,
    recurrence: template.recurrence ? { ...template.recurrence } : undefined,
    alerts,
    talkEnabled: template.talkEnabled ?? false,
  };
}

// ============================================================================
// Exam revision series
// ============================================================================

export interface RevisionSeriesItem {
  title: string;
  type: SmartReminder["type"];
  dueAt: Date;
  durationMin: number;
  chapter?: string;
}

export function buildRevisionSeries(input: { examTitle: string; examDate: Date; subject?: string; chapters: string[]; frequencyDays?: number; now?: Date }): RevisionSeriesItem[] {
  const now = input.now ?? new Date();
  const daysToExam = Math.max(0, daysBetween(now, input.examDate));
  const chapters = input.chapters.filter(Boolean);
  const frequency = input.frequencyDays ?? Math.max(2, Math.ceil(daysToExam / Math.max(1, chapters.length || 1)));
  const items: RevisionSeriesItem[] = [];

  chapters.slice(0, 8).forEach((chapter, index) => {
    const offset = Math.min(daysToExam - 1, Math.max(1, (index + 1) * frequency));
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    date.setHours(18, 0, 0, 0);
    items.push({ title: `Revise ${chapter}`, type: "revision", dueAt: date, durationMin: 45, chapter });
  });

  if (daysToExam >= 2) {
    const practice = new Date(now);
    practice.setDate(practice.getDate() + Math.max(1, daysToExam - 2));
    practice.setHours(19, 0, 0, 0);
    items.push({ title: `${input.examTitle} — mixed practice`, type: "revision", dueAt: practice, durationMin: 60 });
  }
  if (daysToExam >= 1) {
    const formulas = new Date(now);
    formulas.setDate(formulas.getDate() + Math.max(1, daysToExam - 1));
    formulas.setHours(20, 0, 0, 0);
    items.push({ title: `${input.examTitle} — formula review`, type: "revision", dueAt: formulas, durationMin: 30 });
    const nightBefore = new Date(input.examDate);
    nightBefore.setDate(nightBefore.getDate() - 1);
    nightBefore.setHours(20, 0, 0, 0);
    if (nightBefore.getTime() > now.getTime()) {
      items.push({ title: `${input.examTitle} — night-before recap`, type: "revision", dueAt: nightBefore, durationMin: 25 });
    }
    const mock = new Date(input.examDate);
    mock.setDate(mock.getDate() - Math.min(3, Math.max(1, Math.floor(daysToExam / 2))));
    mock.setHours(17, 0, 0, 0);
    if (mock.getTime() > now.getTime()) {
      items.push({ title: `${input.examTitle} — mock test`, type: "exam", dueAt: mock, durationMin: 90 });
    }
  }

  return items.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}

// ============================================================================
// Status helpers
// ============================================================================

export function isOverdue(reminder: SmartReminder, now = new Date()): boolean {
  if (reminder.status === "completed" || reminder.status === "cancelled") return false;
  return new Date(reminder.dueAt).getTime() < now.getTime() && !reminder.snoozeUntil;
}

export function isDueToday(reminder: SmartReminder, now = new Date()): boolean {
  const due = new Date(reminder.dueAt);
  return daysBetween(now, due) === 0;
}

export function isUpcoming(reminder: SmartReminder, now = new Date()): boolean {
  if (reminder.status === "completed" || reminder.status === "cancelled") return false;
  return new Date(reminder.dueAt).getTime() >= now.getTime();
}

export function defaultSettings(): ReminderSettings {
  return {
    ...DEFAULT_REMINDER_SETTINGS,
    quietHours: { ...DEFAULT_REMINDER_SETTINGS.quietHours },
    digest: { ...DEFAULT_REMINDER_SETTINGS.digest },
  };
}

export function cloneProfileState(state: ReminderProfileState): ReminderProfileState {
  return {
    version: state.version,
    reminders: state.reminders.map((r) => ({ ...r, alerts: r.alerts.map((a) => ({ ...a })), checklist: r.checklist.map((c) => ({ ...c })), tags: [...r.tags], firedAlertIds: [...r.firedAlertIds] })),
    templates: state.templates.map((t) => ({ ...t, tags: [...t.tags], recurrence: t.recurrence ? { ...t.recurrence } : undefined })),
    settings: {
      ...state.settings,
      quietHours: { ...state.settings.quietHours },
      digest: { ...state.settings.digest },
    },
    commands: state.commands.map((c) => ({ ...c, triggers: [...c.triggers], params: c.params.map((p) => ({ ...p })), action: { ...c.action } })),
    activity: state.activity.map((a) => ({ ...a })),
    migrationDone: state.migrationDone,
  };
}
