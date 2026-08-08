import { describe, expect, test } from "bun:test";
import {
  buildRevisionSeries,
  detectConflicts,
  inQuietHours,
  mayFireNow,
  migrateLegacyReminders,
  nextOccurrenceAfter,
  parseQuickCommand,
  recurrenceLabel,
  smartRescheduleOptions,
} from "../src/lib/reminders/engine";
import { isFemaleVoice } from "../src/lib/reminders/talk";
import { DEFAULT_REMINDER_SETTINGS } from "../src/lib/reminders/types";

describe("parseQuickCommand — natural language", () => {
  const now = new Date("2026-08-07T12:00:00");

  test("parses title, tomorrow and an explicit time", () => {
    const parsed = parseQuickCommand("Revise Laws of Motion tomorrow at 6 PM", now);
    expect(parsed.title).toContain("Revise Laws of Motion");
    expect(parsed.dueAt.getDate()).toBe(now.getDate() + 1);
    expect(parsed.dueAt.getHours()).toBe(18);
    expect(parsed.matchedTime).toBe(true);
    expect(parsed.confidence).toBe("high");
  });

  test("detects subject and type", () => {
    const parsed = parseQuickCommand("Remind me to complete Chemistry homework every Monday", now);
    expect(parsed.subject).toBe("chemistry");
    expect(parsed.type).toBe("homework");
    expect(parsed.recurrence?.frequency).toBe("weekly");
    expect(parsed.recurrence?.weekdays).toEqual([1]);
  });

  test("detects duration and pre-alert", () => {
    const parsed = parseQuickCommand("Start a 25-minute Maths focus session at 5 PM", now);
    expect(parsed.type).toBe("focus");
    expect(parsed.durationMin).toBe(25);
    expect(parsed.subject).toBe("maths");
    expect(parsed.dueAt.getHours()).toBe(17);
  });

  test("handles 'in N hours' and 'every weekday'", () => {
    const inHours = parseQuickCommand("Remind me in 3 hours to revise", now);
    expect(inHours.dueAt.getTime()).toBe(now.getTime() + 3 * 3_600_000);

    const weekdays = parseQuickCommand("Remind me every weekday to study", now);
    expect(weekdays.recurrence?.frequency).toBe("weekdays");
  });

  test("flags ambiguity when no time is given", () => {
    const parsed = parseQuickCommand("Read chapter 3", now);
    expect(parsed.ambiguity.length).toBeGreaterThan(0);
    expect(parsed.confidence).toBe("low");
  });

  test("repeat count from 'three times before'", () => {
    const parsed = parseQuickCommand("Revise Structure of Atom three times before Friday", now);
    expect(parsed.recurrenceCount).toBe(3);
  });
});

describe("recurrence calculation", () => {
  const saturday = new Date("2026-08-08T10:00:00"); // Saturday

  test("daily next occurrence", () => {
    const next = nextOccurrenceAfter({ frequency: "daily", interval: 1 }, saturday);
    expect(next!.getDay()).toBe(0);
  });

  test("weekdays skips Saturday and Sunday", () => {
    const next = nextOccurrenceAfter({ frequency: "weekdays", interval: 1 }, saturday);
    expect(next!.getDay()).toBe(1); // Monday
  });

  test("weekly on Tuesday and Thursday", () => {
    const next = nextOccurrenceAfter({ frequency: "weekly", interval: 1, weekdays: [2, 4], anchorAt: saturday.toISOString() }, saturday);
    expect(next!.getDay()).toBe(2); // Tuesday
  });

  test("recurrence labels", () => {
    expect(recurrenceLabel({ frequency: "weekdays", interval: 1 })).toBe("Every weekday");
    expect(recurrenceLabel({ frequency: "weekly", interval: 1, weekdays: [2, 4] })).toContain("Tue");
  });
});

describe("quiet hours", () => {
  const quiet = { ...DEFAULT_REMINDER_SETTINGS.quietHours, enabled: true, start: "22:00", end: "07:00", days: [] };

  test("blocks at night, allows during the day", () => {
    expect(inQuietHours(new Date("2026-08-07T23:30:00"), quiet)).toBe(true);
    expect(inQuietHours(new Date("2026-08-07T06:30:00"), quiet)).toBe(true);
    expect(inQuietHours(new Date("2026-08-07T12:00:00"), quiet)).toBe(false);
  });

  test("allows important and exam reminders", () => {
    const settings = { ...DEFAULT_REMINDER_SETTINGS, quietHours: { ...quiet, allowImportant: true, allowExams: true } };
    const night = new Date("2026-08-07T23:30:00");
    expect(mayFireNow({ priority: "high", type: "revision", important: false, talkEnabled: false }, settings, night).allow).toBe(true);
    expect(mayFireNow({ priority: "medium", type: "exam", important: false, talkEnabled: false }, settings, night).allow).toBe(true);
    expect(mayFireNow({ priority: "low", type: "general", important: false, talkEnabled: false }, settings, night).allow).toBe(false);
  });

  test("silence speech flag suppresses talk", () => {
    const settings = { ...DEFAULT_REMINDER_SETTINGS, quietHours: { ...quiet, silenceSpeech: true } };
    const night = new Date("2026-08-07T23:30:00");
    expect(mayFireNow({ priority: "low", type: "general", important: false, talkEnabled: true }, settings, night).allowSpeech).toBe(false);
  });
});

describe("legacy migration", () => {
  test("converts old shapes and preserves statuses", () => {
    const now = new Date("2026-08-07T12:00:00");
    const migrated = migrateLegacyReminders(11, [
      [
        { id: "cus-1", title: "Revise Chemistry", body: "chapter 2", subject: "chemistry", dueAt: now.getTime() + 86_400_000, priority: "high", status: "active", createdAt: now.getTime(), source: "custom" },
        { id: "cus-2", title: "Homework", dueAt: now.getTime() - 3_600_000, status: "snoozed", snoozeUntil: now.getTime() + 3_600_000, source: "custom" },
        { text: "Legacy bare reminder", at: now.getTime() + 86_400_000 },
      ],
    ], now);
    expect(migrated.length).toBe(3);
    expect(migrated[0].title).toBe("Revise Chemistry");
    expect(migrated[0].subject).toBe("chemistry");
    expect(migrated[0].priority).toBe("high");
    expect(migrated[1].snoozeUntil).toBeDefined();
    expect(migrated[2].title).toBe("Legacy bare reminder");
  });

  test("deduplicates by title and minute and survives malformed entries", () => {
    const now = new Date("2026-08-07T12:00:00");
    const migrated = migrateLegacyReminders(9, [
      [
        { title: "Same", dueAt: now.getTime() + 3_600_000 },
        { title: "Same", dueAt: now.getTime() + 3_600_000 },
        null as unknown as Record<string, unknown>,
        "garbage" as unknown as Record<string, unknown>,
      ],
    ], now);
    expect(migrated.length).toBe(1);
  });

  test("marks past non-snoozed reminders as missed", () => {
    const now = new Date("2026-08-07T12:00:00");
    const migrated = migrateLegacyReminders(11, [[{ title: "Old task", dueAt: now.getTime() - 86_400_000, status: "active" }]], now);
    expect(migrated[0].status).toBe("missed");
  });
});

describe("conflict detection", () => {
  const now = new Date("2026-08-07T12:00:00");
  const base = { title: "Physics revision", dueAt: new Date("2026-08-07T18:00:00").toISOString(), durationMin: 30, priority: "medium" as const, type: "revision" as const };

  test("detects past times", () => {
    const warnings = detectConflicts({ ...base, id: "x", dueAt: new Date("2026-08-07T10:00:00").toISOString() }, [], DEFAULT_REMINDER_SETTINGS, now);
    expect(warnings.some((w) => w.kind === "past")).toBe(true);
  });

  test("detects overlaps and duplicates", () => {
    const others = [
      { ...base, id: "a", title: "Chemistry Homework", dueAt: new Date("2026-08-07T18:15:00").toISOString() },
      { ...base, id: "b", title: "Physics revision", dueAt: new Date("2026-08-07T18:00:00").toISOString() },
    ];
    const warnings = detectConflicts({ ...base, id: "x" }, others as never[], DEFAULT_REMINDER_SETTINGS, now);
    expect(warnings.some((w) => w.kind === "overlap")).toBe(true);
    expect(warnings.some((w) => w.kind === "duplicate")).toBe(true);
  });

  test("flags quiet-hours conflicts", () => {
    const settings = { ...DEFAULT_REMINDER_SETTINGS, quietHours: { ...DEFAULT_REMINDER_SETTINGS.quietHours, enabled: true, start: "22:00", end: "07:00", days: [] } };
    const warnings = detectConflicts({ ...base, id: "x", dueAt: new Date("2026-08-07T23:00:00").toISOString() }, [], settings, now);
    expect(warnings.some((w) => w.kind === "quiet-hours")).toBe(true);
  });
});

describe("smart reschedule", () => {
  test("suggests the next study block and time before the next exam", () => {
    const now = new Date("2026-08-07T12:00:00");
    const reminder = { dueAt: new Date("2026-08-07T08:00:00").toISOString(), durationMin: 30, type: "revision" as const, priority: "medium" as const };
    const exam = [{ id: "e1", title: "Physics test", dueAt: new Date("2026-08-10T09:00:00").toISOString(), status: "scheduled" as const }];
    const options = smartRescheduleOptions(reminder, exam as never[], now);
    expect(options.length).toBeGreaterThan(0);
    expect(options.some((o) => o.reason.toLowerCase().includes("physics test"))).toBe(true);
  });
});

describe("revision series", () => {
  test("builds sessions up to the exam date", () => {
    const now = new Date("2026-08-07T12:00:00");
    const examDate = new Date("2026-08-19T09:00:00");
    const items = buildRevisionSeries({ examTitle: "Physics exam", examDate, subject: "physics", chapters: ["Motion in a Straight Line", "Laws of Motion"], now });
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(items.every((i) => i.dueAt.getTime() < examDate.getTime())).toBe(true);
    const sorted = [...items].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
    expect(items.map((i) => i.dueAt.getTime())).toEqual(sorted.map((i) => i.dueAt.getTime()));
    expect(items.some((i) => i.title.includes("formula review"))).toBe(true);
  });
});

describe("talk voice helpers", () => {
  test("female-voice hint detection", () => {
    expect(isFemaleVoice({ name: "Microsoft Zira - English (United Kingdom)" })).toBe(true);
    expect(isFemaleVoice({ name: "Google UK English Male" })).toBe(false);
  });
});
