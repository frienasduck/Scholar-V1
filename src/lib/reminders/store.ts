"use client";

// ============================================================================
// Smart Reminders 2.0 — unified per-profile store
// One source of truth used by Smart Reminders, Chapter Command Center, LAM,
// Focus Mode, dashboard widgets and the scheduler. Persisted per profile
// (Class 9 / Class 11) with cross-tab synchronisation.
// ============================================================================

import { create } from "zustand";
import { profileGetJSON, profileSetJSON } from "@/lib/profile-storage";
import {
  DEFAULT_TEMPLATES,
  cloneProfileState,
  createReminderFromTemplate,
  migrateLegacyReminders,
} from "./engine";
import {
  createEmptyReminderProfileState,
  DEFAULT_LAM_COMMANDS,
  DEFAULT_REMINDER_SETTINGS,
  type LamCommand,
  type ReminderActivityEntry,
  type ReminderProfileState,
  type ReminderSettings,
  type ReminderTemplate,
  type SmartReminder,
} from "./types";

export const REMINDERS_STORAGE_KEY = "smart-reminders-v2";
export const REMINDERS_CHANGED_EVENT = "scholar:reminders-changed";
export const REMINDERS_MIGRATION_KEY = "smart-reminders-migrated-v2";

export function remindersStorageKey(scholarClass: 9 | 11): string {
  return `scholar:${scholarClass === 11 ? "class11" : "class9"}:${REMINDERS_STORAGE_KEY}`;
}

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `rem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

function defaultTemplateSeed(): ReminderTemplate[] {
  const stamp = nowISO();
  return DEFAULT_TEMPLATES.map((t) => ({ ...t, createdAt: stamp, updatedAt: stamp }));
}

function defaultCommandSeed(): LamCommand[] {
  const stamp = nowISO();
  return DEFAULT_LAM_COMMANDS.map((c) => ({ ...c, triggers: [...c.triggers], createdAt: stamp, updatedAt: stamp }));
}

interface ReminderStoreState {
  byProfile: Record<number, ReminderProfileState>;

  ensureProfile: (scholarClass: 9 | 11) => ReminderProfileState;
  /** Load from storage (runs legacy migration on first load). */
  hydrate: (scholarClass: 9 | 11) => void;
  persist: (scholarClass: 9 | 11, state: ReminderProfileState) => void;
  resetProfile: (scholarClass: 9 | 11) => void;

  // --- Reminders -----------------------------------------------------------
  createReminder: (scholarClass: 9 | 11, input: Partial<SmartReminder> & { title: string }, opts?: { source?: SmartReminder["source"]; activityActor?: ReminderActivityEntry["actor"]; detail?: string }) => SmartReminder;
  createRemindersBulk: (scholarClass: 9 | 11, items: Array<Partial<SmartReminder> & { title: string }>, opts?: { source?: SmartReminder["source"]; actor?: ReminderActivityEntry["actor"]; detail?: string }) => SmartReminder[];
  updateReminder: (scholarClass: 9 | 11, id: string, patch: Partial<SmartReminder>, opts?: { activityActor?: ReminderActivityEntry["actor"]; detail?: string }) => SmartReminder | undefined;
  removeReminder: (scholarClass: 9 | 11, id: string, opts?: { actor?: ReminderActivityEntry["actor"] }) => void;
  completeReminder: (scholarClass: 9 | 11, id: string, opts?: { actor?: ReminderActivityEntry["actor"] }) => void;
  undoComplete: (scholarClass: 9 | 11, id: string) => void;
  snoozeReminder: (scholarClass: 9 | 11, id: string, untilISO: string, opts?: { actor?: ReminderActivityEntry["actor"] }) => void;
  rescheduleReminder: (scholarClass: 9 | 11, id: string, dueAtISO: string, opts?: { actor?: ReminderActivityEntry["actor"]; detail?: string }) => void;
  markFired: (scholarClass: 9 | 11, id: string, firedAlertIds: string[], lastTriggeredAt: string, nextTriggerAt?: string) => void;
  advanceOccurrence: (scholarClass: 9 | 11, id: string, nextDueAt: string, occurrence: number) => void;
  markMissed: (scholarClass: 9 | 11, id: string) => void;
  restoreReminder: (scholarClass: 9 | 11, id: string) => void;

  // --- Templates -----------------------------------------------------------
  createTemplate: (scholarClass: 9 | 11, input: Partial<ReminderTemplate> & { name: string }) => ReminderTemplate;
  updateTemplate: (scholarClass: 9 | 11, id: string, patch: Partial<ReminderTemplate>) => void;
  removeTemplate: (scholarClass: 9 | 11, id: string) => void;
  duplicateTemplate: (scholarClass: 9 | 11, id: string) => ReminderTemplate | undefined;
  pinTemplate: (scholarClass: 9 | 11, id: string, pinned: boolean) => void;
  applyTemplate: (scholarClass: 9 | 11, templateId: string, overrides?: Partial<SmartReminder>) => SmartReminder | undefined;

  // --- Settings ------------------------------------------------------------
  updateSettings: (scholarClass: 9 | 11, patch: Partial<ReminderSettings>) => void;

  // --- Commands ------------------------------------------------------------
  createCommand: (scholarClass: 9 | 11, input: Partial<LamCommand> & { name: string; triggers: string[] }) => LamCommand;
  updateCommand: (scholarClass: 9 | 11, id: string, patch: Partial<LamCommand>) => void;
  removeCommand: (scholarClass: 9 | 11, id: string) => void;
  duplicateCommand: (scholarClass: 9 | 11, id: string) => LamCommand | undefined;
  bumpCommandUsage: (scholarClass: 9 | 11, id: string) => void;

  // --- Activity ------------------------------------------------------------
  addActivity: (scholarClass: 9 | 11, entry: Omit<ReminderActivityEntry, "id" | "at">) => void;
  clearActivity: (scholarClass: 9 | 11) => void;
}

function persistProfile(scholarClass: 9 | 11, state: ReminderProfileState) {
  profileSetJSON(scholarClass, REMINDERS_STORAGE_KEY, state);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(REMINDERS_CHANGED_EVENT, { detail: { scholarClass } }));
  }
}

export const useReminderStore = create<ReminderStoreState>()((set, get) => ({
  byProfile: {},

  ensureProfile: (scholarClass) => {
    let profile = get().byProfile[scholarClass];
    if (!profile) {
      get().hydrate(scholarClass);
      profile = get().byProfile[scholarClass];
    }
    return profile;
  },

  hydrate: (scholarClass) => {
    const loaded = profileGetJSON<ReminderProfileState | null>(scholarClass, REMINDERS_STORAGE_KEY, null);
    const persistedMigration = profileGetJSON<boolean>(scholarClass, REMINDERS_MIGRATION_KEY, false);
    if (loaded && loaded.version === 2 && Array.isArray(loaded.reminders)) {
      // Backfill templates if the profile predates template seeding.
      if (!Array.isArray(loaded.templates) || !loaded.templates.length) loaded.templates = defaultTemplateSeed();
      if (!loaded.settings || typeof loaded.settings !== "object") loaded.settings = { ...DEFAULT_REMINDER_SETTINGS };
      else loaded.settings = { ...DEFAULT_REMINDER_SETTINGS, ...loaded.settings, quietHours: { ...DEFAULT_REMINDER_SETTINGS.quietHours, ...(loaded.settings.quietHours ?? {}) }, digest: { ...DEFAULT_REMINDER_SETTINGS.digest, ...(loaded.settings.digest ?? {}) } };
      if (!Array.isArray(loaded.activity)) loaded.activity = [];
      if (!Array.isArray(loaded.commands)) loaded.commands = [];
      const next = cloneProfileState({ ...createEmptyReminderProfileState(), ...loaded, version: 2 });
      next.migrationDone = loaded.migrationDone || persistedMigration;
      get().persist(scholarClass, next);
      return;
    }

    // --- Legacy migration (v1 profile keys + unscoped legacy keys) ---------
    const legacyCustom = profileGetJSON<unknown[]>(scholarClass, "smart-reminders-custom", []);
    const unscoped = typeof window !== "undefined"
      ? (() => { try { const raw = window.localStorage.getItem("smart-reminders"); return raw ? JSON.parse(raw) : []; } catch { return []; } })()
      : [];
    const migrated = migrateLegacyReminders(scholarClass, [Array.isArray(legacyCustom) ? legacyCustom : [], Array.isArray(unscoped) ? unscoped : []]);
    const next: ReminderProfileState = {
      version: 2,
      reminders: migrated,
      templates: defaultTemplateSeed(),
      settings: { ...DEFAULT_REMINDER_SETTINGS },
      commands: defaultCommandSeed(),
      activity: migrated.length
        ? [{ id: uid(), kind: "restored", actor: "automatic", detail: `${migrated.length} legacy reminder${migrated.length === 1 ? "" : "s"} migrated to Smart Reminders 2.0`, at: nowISO() }]
        : [],
      migrationDone: true,
    };
    persistProfile(scholarClass, next);
    profileSetJSON(scholarClass, REMINDERS_MIGRATION_KEY, true);
    set((state) => ({ byProfile: { ...state.byProfile, [scholarClass]: next } }));
  },

  persist: (scholarClass, state) => {
    persistProfile(scholarClass, state);
    set((current) => ({ byProfile: { ...current.byProfile, [scholarClass]: state } }));
  },

  resetProfile: (scholarClass) => {
    const fresh = { ...createEmptyReminderProfileState(), templates: defaultTemplateSeed(), commands: defaultCommandSeed() };
    persistProfile(scholarClass, fresh);
    set((state) => ({ byProfile: { ...state.byProfile, [scholarClass]: fresh } }));
  },

  // --- Reminders -----------------------------------------------------------

  createReminder: (scholarClass, input, opts) => {
    const profile = get().ensureProfile(scholarClass);
    const now = nowISO();
    const reminder: SmartReminder = {
      id: uid(),
      profileClass: scholarClass,
      title: input.title.trim().slice(0, 120) || "Untitled reminder",
      description: input.description,
      type: input.type ?? "general",
      subject: input.subject,
      chapter: input.chapter,
      tags: input.tags ?? [],
      priority: input.priority ?? "medium",
      startsAt: input.startsAt,
      dueAt: input.dueAt ?? new Date(Date.now() + 86_400_000).toISOString(),
      timezone: input.timezone ?? (Intl.DateTimeFormat().resolvedOptions().timeZone || "local"),
      allDay: input.allDay ?? false,
      durationMin: input.durationMin,
      recurrence: input.recurrence,
      recurrenceEndAt: input.recurrenceEndAt,
      recurrenceCount: input.recurrenceCount,
      occurrencesFired: input.occurrencesFired ?? 0,
      alerts: input.alerts ?? [],
      firedAlertIds: [],
      talkEnabled: input.talkEnabled ?? false,
      voiceURI: input.voiceURI,
      voiceLanguage: input.voiceLanguage,
      speechRate: input.speechRate ?? 1,
      speechPitch: input.speechPitch ?? 1,
      speechVolume: input.speechVolume ?? 1,
      spokenContentMode: input.spokenContentMode ?? "title",
      customSpokenMessage: input.customSpokenMessage,
      speakDetails: input.speakDetails ?? false,
      checklist: input.checklist ?? [],
      linkedEntity: input.linkedEntity,
      openViewOnStart: input.openViewOnStart,
      autoStartFocus: input.autoStartFocus ?? false,
      important: input.important ?? false,
      allowSmartReschedule: input.allowSmartReschedule ?? true,
      requireCompletionConfirmation: input.requireCompletionConfirmation ?? false,
      followUpReminderMinutes: input.followUpReminderMinutes,
      status: input.status ?? "scheduled",
      source: opts?.source ?? input.source ?? "manual",
      createdAt: now,
      updatedAt: now,
      legacyId: input.legacyId,
    };
    const next = cloneProfileState(profile);
    next.reminders = [reminder, ...next.reminders];
    get().addActivity(scholarClass, {
      kind: opts?.source === "lam" ? "lam-created" : opts?.source === "fica" ? "fica-created" : "created",
      reminderId: reminder.id,
      reminderTitle: reminder.title,
      actor: opts?.activityActor ?? (opts?.source === "lam" ? "lam" : opts?.source === "fica" ? "fica" : "manual"),
      detail: opts?.detail,
    });
    get().persist(scholarClass, next);
    return reminder;
  },

  createRemindersBulk: (scholarClass, items, opts) => {
    const profile = get().ensureProfile(scholarClass);
    const now = nowISO();
    const created: SmartReminder[] = items.map((input) => {
      const reminder: SmartReminder = {
        id: uid(),
        profileClass: scholarClass,
        title: input.title.trim().slice(0, 120) || "Untitled reminder",
        description: input.description,
        type: input.type ?? "general",
        subject: input.subject,
        chapter: input.chapter,
        tags: input.tags ?? [],
        priority: input.priority ?? "medium",
        dueAt: input.dueAt ?? new Date(Date.now() + 86_400_000).toISOString(),
        timezone: input.timezone ?? (Intl.DateTimeFormat().resolvedOptions().timeZone || "local"),
        allDay: input.allDay ?? false,
        durationMin: input.durationMin,
        recurrence: input.recurrence,
        recurrenceEndAt: input.recurrenceEndAt,
        recurrenceCount: input.recurrenceCount,
        occurrencesFired: 0,
        alerts: input.alerts ?? [],
        firedAlertIds: [],
        talkEnabled: input.talkEnabled ?? false,
        speechRate: 1, speechPitch: 1, speechVolume: 1,
        spokenContentMode: "title",
        speakDetails: false,
        checklist: [],
        important: input.important ?? false,
        allowSmartReschedule: true,
        requireCompletionConfirmation: false,
        status: "scheduled",
        source: opts?.source ?? "manual",
        createdAt: now,
        updatedAt: now,
      };
      return reminder;
    });
    const next = cloneProfileState(profile);
    next.reminders = [...created, ...next.reminders];
    next.activity = [{
      id: uid(),
      kind: opts?.source === "lam" ? "lam-created" : opts?.source === "fica" ? "fica-created" : "created",
      actor: opts?.actor ?? (opts?.source === "lam" ? "lam" : opts?.source === "fica" ? "fica" : "manual"),
      detail: opts?.detail ?? `Created ${created.length} reminder${created.length === 1 ? "" : "s"}`,
      at: now,
    } as ReminderActivityEntry, ...next.activity].slice(0, 400);
    get().persist(scholarClass, next);
    return created;
  },

  updateReminder: (scholarClass, id, patch, opts) => {
    const profile = get().ensureProfile(scholarClass);
    const existing = profile.reminders.find((r) => r.id === id);
    if (!existing) return undefined;
    const next = cloneProfileState(profile);
    next.reminders = next.reminders.map((r) => r.id === id ? {
      ...r, ...patch, id, updatedAt: nowISO(),
      // A new due time invalidates fired pre-alerts for the old occurrence.
      ...(patch.dueAt && patch.dueAt !== r.dueAt ? { firedAlertIds: [], nextTriggerAt: undefined, snoozeUntil: undefined, status: "scheduled" } : {}),
    } : r);
    if (opts?.activityActor) {
      next.activity = [{
        id: uid(),
        kind: "edited",
        reminderId: id,
        reminderTitle: existing.title,
        actor: opts.activityActor,
        detail: opts.detail,
        at: nowISO(),
      } as ReminderActivityEntry, ...next.activity].slice(0, 400);
    }
    get().persist(scholarClass, next);
    return next.reminders.find((r) => r.id === id);
  },

  removeReminder: (scholarClass, id, opts) => {
    const profile = get().ensureProfile(scholarClass);
    const existing = profile.reminders.find((r) => r.id === id);
    const next = cloneProfileState(profile);
    next.reminders = next.reminders.filter((r) => r.id !== id);
    if (existing) {
      next.activity = [{
        id: uid(), kind: "deleted", reminderId: id, reminderTitle: existing.title,
        actor: opts?.actor ?? "manual", at: nowISO(),
      } as ReminderActivityEntry, ...next.activity].slice(0, 400);
    }
    get().persist(scholarClass, next);
  },

  completeReminder: (scholarClass, id, opts) => {
    const profile = get().ensureProfile(scholarClass);
    const existing = profile.reminders.find((r) => r.id === id);
    if (!existing) return;
    const next = cloneProfileState(profile);
    next.reminders = next.reminders.map((r) => r.id === id ? {
      ...r, status: "completed", completedAt: nowISO(), snoozeUntil: undefined, firedAlertIds: [], updatedAt: nowISO(),
    } : r);
    next.activity = [{
      id: uid(), kind: "completed", reminderId: id, reminderTitle: existing.title,
      actor: opts?.actor ?? "manual", at: nowISO(),
    } as ReminderActivityEntry, ...next.activity].slice(0, 400);
    get().persist(scholarClass, next);
  },

  undoComplete: (scholarClass, id) => {
    const profile = get().ensureProfile(scholarClass);
    const existing = profile.reminders.find((r) => r.id === id);
    if (!existing) return;
    const next = cloneProfileState(profile);
    next.reminders = next.reminders.map((r) => r.id === id ? {
      ...r, status: "scheduled", completedAt: undefined, updatedAt: nowISO(),
    } : r);
    next.activity = [{
      id: uid(), kind: "restored", reminderId: id, reminderTitle: existing.title, actor: "manual", at: nowISO(),
    } as ReminderActivityEntry, ...next.activity].slice(0, 400);
    get().persist(scholarClass, next);
  },

  snoozeReminder: (scholarClass, id, untilISO, opts) => {
    const profile = get().ensureProfile(scholarClass);
    const existing = profile.reminders.find((r) => r.id === id);
    if (!existing) return;
    const next = cloneProfileState(profile);
    next.reminders = next.reminders.map((r) => r.id === id ? {
      ...r, snoozeUntil: untilISO, status: "scheduled", firedAlertIds: [], updatedAt: nowISO(),
    } : r);
    next.activity = [{
      id: uid(), kind: "snoozed", reminderId: id, reminderTitle: existing.title,
      actor: opts?.actor ?? "manual", detail: `Snoozed until ${new Date(untilISO).toLocaleString()}`, at: nowISO(),
    } as ReminderActivityEntry, ...next.activity].slice(0, 400);
    get().persist(scholarClass, next);
  },

  rescheduleReminder: (scholarClass, id, dueAtISO, opts) => {
    const profile = get().ensureProfile(scholarClass);
    const existing = profile.reminders.find((r) => r.id === id);
    if (!existing) return;
    const next = cloneProfileState(profile);
    next.reminders = next.reminders.map((r) => r.id === id ? {
      ...r, dueAt: dueAtISO, status: "scheduled", snoozeUntil: undefined, firedAlertIds: [], updatedAt: nowISO(),
    } : r);
    next.activity = [{
      id: uid(), kind: "rescheduled", reminderId: id, reminderTitle: existing.title,
      actor: opts?.actor ?? "manual", detail: opts?.detail ?? `Moved to ${new Date(dueAtISO).toLocaleString()}`, at: nowISO(),
    } as ReminderActivityEntry, ...next.activity].slice(0, 400);
    get().persist(scholarClass, next);
  },

  markFired: (scholarClass, id, firedAlertIds, lastTriggeredAt, nextTriggerAt) => {
    const profile = get().ensureProfile(scholarClass);
    const existing = profile.reminders.find((r) => r.id === id);
    if (!existing) return;
    const next = cloneProfileState(profile);
    next.reminders = next.reminders.map((r) => r.id === id ? {
      ...r, firedAlertIds, lastTriggeredAt, nextTriggerAt, status: "active", updatedAt: nowISO(),
    } : r);
    get().persist(scholarClass, next);
  },

  advanceOccurrence: (scholarClass, id, nextDueAt, occurrence) => {
    const profile = get().ensureProfile(scholarClass);
    const existing = profile.reminders.find((r) => r.id === id);
    if (!existing) return;
    const next = cloneProfileState(profile);
    next.reminders = next.reminders.map((r) => r.id === id ? {
      ...r, dueAt: nextDueAt, occurrencesFired: occurrence, firedAlertIds: [], status: "scheduled", snoozeUntil: undefined, updatedAt: nowISO(),
    } : r);
    get().persist(scholarClass, next);
  },

  markMissed: (scholarClass, id) => {
    const profile = get().ensureProfile(scholarClass);
    const existing = profile.reminders.find((r) => r.id === id);
    if (!existing) return;
    const next = cloneProfileState(profile);
    next.reminders = next.reminders.map((r) => r.id === id ? { ...r, status: "missed", updatedAt: nowISO() } : r);
    next.activity = [{
      id: uid(), kind: "missed", reminderId: id, reminderTitle: existing.title, actor: "automatic", at: nowISO(),
    } as ReminderActivityEntry, ...next.activity].slice(0, 400);
    get().persist(scholarClass, next);
  },

  restoreReminder: (scholarClass, id) => {
    const profile = get().ensureProfile(scholarClass);
    const existing = profile.reminders.find((r) => r.id === id);
    if (!existing) return;
    const next = cloneProfileState(profile);
    next.reminders = next.reminders.map((r) => r.id === id ? { ...r, status: "scheduled", updatedAt: nowISO() } : r);
    next.activity = [{
      id: uid(), kind: "restored", reminderId: id, reminderTitle: existing.title, actor: "manual", at: nowISO(),
    } as ReminderActivityEntry, ...next.activity].slice(0, 400);
    get().persist(scholarClass, next);
  },

  // --- Templates -----------------------------------------------------------

  createTemplate: (scholarClass, input) => {
    const profile = get().ensureProfile(scholarClass);
    const now = nowISO();
    const template: ReminderTemplate = {
      id: uid(),
      name: input.name.trim().slice(0, 60) || "Untitled template",
      description: input.description,
      icon: input.icon ?? "📌",
      pinned: input.pinned ?? false,
      type: input.type ?? "general",
      subject: input.subject,
      priority: input.priority ?? "medium",
      durationMin: input.durationMin,
      talkEnabled: input.talkEnabled,
      tags: input.tags ?? [],
      dueOffsetDays: input.dueOffsetDays ?? 0,
      dueTime: input.dueTime ?? "18:00",
      recurrence: input.recurrence,
      preAlertMinutes: input.preAlertMinutes,
      builtIn: false,
      createdAt: now,
      updatedAt: now,
    };
    const next = cloneProfileState(profile);
    next.templates = [template, ...next.templates];
    get().persist(scholarClass, next);
    return template;
  },

  updateTemplate: (scholarClass, id, patch) => {
    const profile = get().ensureProfile(scholarClass);
    const next = cloneProfileState(profile);
    next.templates = next.templates.map((t) => t.id === id ? { ...t, ...patch, updatedAt: nowISO() } : t);
    get().persist(scholarClass, next);
  },

  removeTemplate: (scholarClass, id) => {
    const profile = get().ensureProfile(scholarClass);
    const next = cloneProfileState(profile);
    next.templates = next.templates.filter((t) => t.id !== id);
    get().persist(scholarClass, next);
  },

  duplicateTemplate: (scholarClass, id) => {
    const profile = get().ensureProfile(scholarClass);
    const source = profile.templates.find((t) => t.id === id);
    if (!source) return undefined;
    const now = nowISO();
    const copy: ReminderTemplate = { ...source, id: uid(), name: `${source.name} (copy)`, pinned: false, builtIn: false, createdAt: now, updatedAt: now };
    const next = cloneProfileState(profile);
    next.templates = [copy, ...next.templates];
    get().persist(scholarClass, next);
    return copy;
  },

  pinTemplate: (scholarClass, id, pinned) => {
    const profile = get().ensureProfile(scholarClass);
    const next = cloneProfileState(profile);
    next.templates = next.templates.map((t) => t.id === id ? { ...t, pinned, updatedAt: nowISO() } : t);
    get().persist(scholarClass, next);
  },

  applyTemplate: (scholarClass, templateId, overrides) => {
    const profile = get().ensureProfile(scholarClass);
    const template = profile.templates.find((t) => t.id === templateId);
    if (!template) return undefined;
    const base = createReminderFromTemplate(template);
    const reminder = get().createReminder(scholarClass, {
      title: overrides?.title ?? template.name === "Daily Revision" ? "Daily revision block" : overrides?.title ?? `${template.name}`,
      ...base,
      ...overrides,
    }, { source: "template", activityActor: "manual", detail: `Created from template “${template.name}”` });
    return reminder;
  },

  // --- Settings ------------------------------------------------------------

  updateSettings: (scholarClass, patch) => {
    const profile = get().ensureProfile(scholarClass);
    const next = cloneProfileState(profile);
    next.settings = {
      ...next.settings,
      ...patch,
      quietHours: { ...next.settings.quietHours, ...(patch.quietHours ?? {}) },
      digest: { ...next.settings.digest, ...(patch.digest ?? {}) },
    };
    get().persist(scholarClass, next);
  },

  // --- Commands ------------------------------------------------------------

  createCommand: (scholarClass, input) => {
    const profile = get().ensureProfile(scholarClass);
    const now = nowISO();
    const command: LamCommand = {
      id: uid(),
      name: input.name.trim().slice(0, 60) || "Custom command",
      description: input.description,
      triggers: (input.triggers ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean),
      action: input.action ?? { type: "start-focus", minutes: 25 },
      params: input.params ?? [],
      confirmRequired: input.confirmRequired ?? false,
      enabled: input.enabled ?? true,
      builtIn: false,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    const next = cloneProfileState(profile);
    next.commands = [command, ...next.commands];
    get().persist(scholarClass, next);
    return command;
  },

  updateCommand: (scholarClass, id, patch) => {
    const profile = get().ensureProfile(scholarClass);
    const next = cloneProfileState(profile);
    next.commands = next.commands.map((c) => c.id === id ? { ...c, ...patch, triggers: patch.triggers ? patch.triggers.map((t) => t.trim().toLowerCase()).filter(Boolean) : c.triggers, updatedAt: nowISO() } : c);
    get().persist(scholarClass, next);
  },

  removeCommand: (scholarClass, id) => {
    const profile = get().ensureProfile(scholarClass);
    const next = cloneProfileState(profile);
    next.commands = next.commands.filter((c) => c.id !== id);
    get().persist(scholarClass, next);
  },

  duplicateCommand: (scholarClass, id) => {
    const profile = get().ensureProfile(scholarClass);
    const source = profile.commands.find((c) => c.id === id);
    if (!source) return undefined;
    const now = nowISO();
    const copy: LamCommand = { ...source, id: uid(), name: `${source.name} (copy)`, triggers: [...source.triggers], builtIn: false, usageCount: 0, createdAt: now, updatedAt: now };
    const next = cloneProfileState(profile);
    next.commands = [copy, ...next.commands];
    get().persist(scholarClass, next);
    return copy;
  },

  bumpCommandUsage: (scholarClass, id) => {
    const profile = get().ensureProfile(scholarClass);
    const next = cloneProfileState(profile);
    next.commands = next.commands.map((c) => c.id === id ? { ...c, usageCount: c.usageCount + 1 } : c);
    get().persist(scholarClass, next);
  },

  // --- Activity ------------------------------------------------------------

  addActivity: (scholarClass, entry) => {
    const profile = get().ensureProfile(scholarClass);
    const next = cloneProfileState(profile);
    next.activity = [{ id: uid(), ...entry, at: nowISO() } as ReminderActivityEntry, ...next.activity].slice(0, 400);
    get().persist(scholarClass, next);
  },

  clearActivity: (scholarClass) => {
    const profile = get().ensureProfile(scholarClass);
    const next = cloneProfileState(profile);
    next.activity = [];
    get().persist(scholarClass, next);
  },
}));

// ============================================================================
// Cross-tab synchronisation + hydration on startup
// ============================================================================

export function initReminderStoreSync(): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (!event.key) return;
    const match = event.key.match(/^scholar:(class9|class11):smart-reminders-v2$/);
    if (!match) return;
    const scholarClass: 9 | 11 = match[1] === "class11" ? 11 : 9;
    const state = useReminderStore.getState();
    const reloaded = profileGetJSON<ReminderProfileState | null>(scholarClass, REMINDERS_STORAGE_KEY, null);
    if (reloaded && reloaded.version === 2) {
      state.persist(scholarClass, cloneProfileState(reloaded));
    }
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

export function hydrateRemindersForProfile(scholarClass: 9 | 11): void {
  useReminderStore.getState().ensureProfile(scholarClass);
}

/**
 * React hook: hydrates the profile on mount and returns its current state.
 * Safe to use anywhere (Smart Reminders, Chapter Command Center, LAM).
 */
import { useEffect } from "react";

export const EMPTY_REMINDER_PROFILE: ReminderProfileState = {
  version: 2,
  reminders: [],
  templates: [],
  settings: { ...DEFAULT_REMINDER_SETTINGS },
  commands: [],
  activity: [],
  migrationDone: false,
};

export function useReminderProfile(scholarClass: 9 | 11): ReminderProfileState {
  const hydrate = useReminderStore((s) => s.hydrate);
  const ensure = useReminderStore((s) => s.ensureProfile);
  useEffect(() => {
    ensure(scholarClass);
    hydrate(scholarClass);
  }, [scholarClass, ensure, hydrate]);
  return useReminderStore((s) => s.byProfile[scholarClass] ?? EMPTY_REMINDER_PROFILE);
}
