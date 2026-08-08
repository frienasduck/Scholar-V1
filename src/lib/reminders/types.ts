// ============================================================================
// Smart Reminders 2.0 — unified data model
// One reminder entity shared by Smart Reminders, Chapter Command Center,
// LAM, Focus Mode, dashboard widgets and notifications.
// ============================================================================

export type ReminderType =
  | "general" | "study" | "homework" | "assignment" | "revision"
  | "exam" | "practical" | "project" | "focus" | "break" | "habit" | "custom";

export type ReminderStatus = "scheduled" | "active" | "completed" | "missed" | "cancelled";
export type ReminderSource = "manual" | "lam" | "fica" | "template" | "ai-suggestion" | "system";
export type ReminderPriority = "low" | "medium" | "high" | "critical";

export type RecurrenceFrequency = "daily" | "weekdays" | "weekly" | "monthly" | "custom";

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  /** Every N units (days/weeks/months). */
  interval: number;
  /** Days of week (0 = Sunday … 6 = Saturday) for weekly / weekdays. */
  weekdays?: number[];
  /** Day of month (1–31) for monthly. */
  dayOfMonth?: number;
  /** Repeat every N days for custom. */
  customDays?: number;
  /** Anchor ISO date-time used to phase weekly/monthly/custom rules. */
  anchorAt?: string;
}

export interface ReminderAlert {
  id: string;
  /** Minutes before dueAt. 0 = at due time. Negative = after. */
  offsetMinutes: number;
  label: string;
}

export interface ReminderChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface LinkedScholarEntity {
  kind: "chapter" | "assignment" | "exam" | "note" | "file" | "view";
  id: string;
  label: string;
  /** View id to open when the linked entity is a Scholar section. */
  view?: string;
}

export interface SmartReminder {
  id: string;
  profileClass: 9 | 11;
  title: string;
  description?: string;
  type: ReminderType;
  subject?: string;
  chapter?: string;
  tags: string[];
  priority: ReminderPriority;

  /** Optional scheduled start; when set the reminder is actionable from startsAt. */
  startsAt?: string;
  /** ISO date-time when the reminder is due (or the next occurrence is due). */
  dueAt: string;
  timezone: string;
  allDay: boolean;
  /** Estimated duration in minutes (focus/revision sessions). */
  durationMin?: number;

  recurrence?: RecurrenceRule;
  recurrenceEndAt?: string;
  recurrenceCount?: number;
  /** How many occurrences have already fired. */
  occurrencesFired?: number;

  alerts: ReminderAlert[];
  /** Alert ids already fired for the current occurrence. */
  firedAlertIds: string[];
  /** Persisted next trigger so the scheduler can check cheaply. */
  nextTriggerAt?: string;

  talkEnabled: boolean;
  voiceURI?: string;
  voiceLanguage?: string;
  speechRate: number;
  speechPitch: number;
  speechVolume: number;
  spokenContentMode: "title" | "title-time" | "title-description" | "custom";
  customSpokenMessage?: string;
  speakDetails: boolean;

  checklist: ReminderChecklistItem[];
  linkedEntity?: LinkedScholarEntity;
  openViewOnStart?: string;
  autoStartFocus?: boolean;
  important: boolean;
  allowSmartReschedule: boolean;
  requireCompletionConfirmation: boolean;
  followUpReminderMinutes?: number;

  status: ReminderStatus;
  source: ReminderSource;
  snoozeUntil?: string;

  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  lastTriggeredAt?: string;
  /** For legacy migration mapping. */
  legacyId?: string;
  /** For LAM-created reminders, the conversation that created it. */
  lamConversationId?: string;
}

// ============================================================================
// Reminder settings (per profile)
// ============================================================================

export interface QuietHours {
  enabled: boolean;
  /** "HH:MM" 24h */
  start: string;
  end: string;
  /** Empty = every day. */
  days: number[];
  allowImportant: boolean;
  allowExams: boolean;
  allowTalk: boolean;
  silenceSpeech: boolean;
  deliverLater: boolean;
}

export interface ReminderDigest {
  enabled: boolean;
  /** "morning" | "after-school" | "evening" | "custom" */
  mode: "morning" | "after-school" | "evening" | "custom";
  customTime?: string;
}

export interface ReminderTalkSettings {
  repeatCount: number;
  repeatDelayMs: number;
  speakOnlyWhenOpen: boolean;
  allowLockedScreen: boolean;
  respectQuietHours: boolean;
}

export interface ReminderSettings {
  version: 2;
  defaultPreAlertMinutes: number;
  defaultPriority: ReminderPriority;
  defaultDurationMin?: number;
  quickLamActions: boolean;
  speakReminderDetails: boolean;
  defaultTalkEnabled: boolean;
  talk: ReminderTalkSettings;
  quietHours: QuietHours;
  digest: ReminderDigest;
  /** Display mode preference ("timeline" | "compact" | "calendar" | "subject"). */
  displayMode: "timeline" | "compact" | "calendar" | "subject";
  /** Smart Suggestions preference. */
  suggestionMode: "suggestions-only" | "ask-before-creating" | "auto-approve";
  /** Voice used for Talk Reminders (voiceURI). */
  talkVoiceURI?: string;
  talkVoiceLanguage?: string;
  /** When true LAM creates simple reminders immediately without a preview. */
  quickCreate?: boolean;
  notificationPermissionAskedAt?: string;
  notificationPermissionState?: "granted" | "denied" | "default";
  lastDigestSentAt?: string;
  migrationDone?: boolean;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  version: 2,
  defaultPreAlertMinutes: 10,
  defaultPriority: "medium",
  defaultDurationMin: 25,
  quickLamActions: false,
  speakReminderDetails: false,
  defaultTalkEnabled: false,
  talk: {
    repeatCount: 1,
    repeatDelayMs: 2_000,
    speakOnlyWhenOpen: true,
    allowLockedScreen: false,
    respectQuietHours: true,
  },
  quietHours: {
    enabled: false,
    start: "22:00",
    end: "07:00",
    days: [],
    allowImportant: true,
    allowExams: true,
    allowTalk: false,
    silenceSpeech: false,
    deliverLater: true,
  },
  digest: { enabled: false, mode: "morning" },
  displayMode: "timeline",
  suggestionMode: "ask-before-creating",
};

// ============================================================================
// Templates
// ============================================================================

export interface ReminderTemplate {
  id: string;
  name: string;
  description?: string;
  icon: string;
  pinned?: boolean;
  /** Baseline fields applied when a reminder is created from this template. */
  type: ReminderType;
  subject?: string;
  priority: ReminderPriority;
  durationMin?: number;
  talkEnabled?: boolean;
  tags: string[];
  /** Offset days from "today" for due date. */
  dueOffsetDays: number;
  /** Time of day "HH:MM". */
  dueTime: string;
  recurrence?: RecurrenceRule;
  preAlertMinutes?: number;
  builtIn?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Activity history
// ============================================================================

export type ReminderActivityKind =
  | "created" | "edited" | "spoken" | "triggered" | "snoozed" | "completed"
  | "missed" | "rescheduled" | "lam-created" | "fica-created" | "restored"
  | "deleted" | "template-applied" | "series-created" | "talk-changed";

export interface ReminderActivityEntry {
  id: string;
  kind: ReminderActivityKind;
  reminderId?: string;
  reminderTitle?: string;
  /** "lam" | "manual" | "fica" | "automatic" */
  actor: "lam" | "manual" | "fica" | "automatic";
  detail?: string;
  at: string;
}

// ============================================================================
// Custom LAM commands (whitelisted action templates only)
// ============================================================================

export type CommandActionTemplate =
  | { type: "create-reminder"; defaults: Partial<SmartReminder> & { title: string } }
  | { type: "start-focus"; minutes: number }
  | { type: "apply-template"; templateName: string }
  | { type: "exam-rescue" }
  | { type: "navigate"; view: string };

export interface LamCommand {
  id: string;
  name: string;
  description?: string;
  triggers: string[];
  action: CommandActionTemplate;
  /** Parameter definitions surfaced in the UI. */
  params: Array<{ key: string; label: string; required?: boolean; default?: string }>;
  confirmRequired: boolean;
  enabled: boolean;
  builtIn?: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// LAM action history for reminder operations (recorded in LAM action history)
// ============================================================================

export interface LamReminderActionRecord {
  id: string;
  action: string;
  reminderId?: string;
  userCommand: string;
  parsed?: Record<string, unknown>;
  result: "success" | "cancelled" | "failed";
  at: string;
}

// ============================================================================
// Profile state persisted to localStorage
// ============================================================================

export interface ReminderProfileState {
  version: 2;
  reminders: SmartReminder[];
  templates: ReminderTemplate[];
  settings: ReminderSettings;
  commands: LamCommand[];
  activity: ReminderActivityEntry[];
  migrationDone: boolean;
}

/**
 * Editable default LAM commands (§20). Users may change aliases without
 * breaking the underlying action. All map onto approved Scholar actions only.
 */
export const DEFAULT_LAM_COMMANDS: LamCommand[] = [
  {
    id: "cmd-default-remind", name: "Remind Me", description: "Create a reminder from natural language.",
    triggers: ["remind me", "set a reminder"], action: { type: "create-reminder", defaults: { title: "Reminder" } },
    params: [], confirmRequired: false, enabled: true, builtIn: true, usageCount: 0, createdAt: "", updatedAt: "",
  },
  {
    id: "cmd-default-plan-day", name: "Plan My Day", description: "Open the morning study plan routine.",
    triggers: ["plan my day", "plan today"], action: { type: "apply-template", templateName: "Morning Study Plan" },
    params: [], confirmRequired: false, enabled: true, builtIn: true, usageCount: 0, createdAt: "", updatedAt: "",
  },
  {
    id: "cmd-default-revision", name: "Create Revision Plan", description: "Build a revision series for an upcoming exam.",
    triggers: ["create revision plan", "revision plan"], action: { type: "exam-rescue" },
    params: [], confirmRequired: true, enabled: true, builtIn: true, usageCount: 0, createdAt: "", updatedAt: "",
  },
  {
    id: "cmd-default-focus", name: "Start Focus Session", description: "Begin a 25-minute focus sprint.",
    triggers: ["start focus session", "start a focus session"], action: { type: "start-focus", minutes: 25 },
    params: [], confirmRequired: false, enabled: true, builtIn: true, usageCount: 0, createdAt: "", updatedAt: "",
  },
  {
    id: "cmd-default-move", name: "Move My Reminder", description: "Reschedule an existing reminder.",
    triggers: ["move my reminder", "reschedule my reminder"], action: { type: "create-reminder", defaults: { title: "Moved reminder" } },
    params: [], confirmRequired: true, enabled: true, builtIn: true, usageCount: 0, createdAt: "", updatedAt: "",
  },
  {
    id: "cmd-default-due", name: "What Is Due Today?", description: "List today's reminders.",
    triggers: ["what is due today", "what's due today"], action: { type: "create-reminder", defaults: { title: "Due today" } },
    params: [], confirmRequired: false, enabled: true, builtIn: true, usageCount: 0, createdAt: "", updatedAt: "",
  },
  {
    id: "cmd-default-snooze", name: "Snooze This", description: "Snooze the most recent reminder.",
    triggers: ["snooze this"], action: { type: "create-reminder", defaults: { title: "Snoozed reminder" } },
    params: [], confirmRequired: false, enabled: true, builtIn: true, usageCount: 0, createdAt: "", updatedAt: "",
  },
  {
    id: "cmd-default-talk", name: "Enable Talk Reminder", description: "Turn on spoken reminders by default.",
    triggers: ["enable talk reminder"], action: { type: "create-reminder", defaults: { title: "Talk reminder" } },
    params: [], confirmRequired: false, enabled: true, builtIn: true, usageCount: 0, createdAt: "", updatedAt: "",
  },
  {
    id: "cmd-default-exam", name: "Prepare For My Exam", description: "Generate an exam rescue revision plan.",
    triggers: ["prepare for my exam", "exam rescue"], action: { type: "exam-rescue" },
    params: [], confirmRequired: true, enabled: true, builtIn: true, usageCount: 0, createdAt: "", updatedAt: "",
  },
  {
    id: "cmd-default-after-school", name: "Plan After School", description: "Homework at 5 PM, revision at 6 PM, focus when it opens.",
    triggers: ["plan after school", "after school plan"], action: { type: "create-reminder", defaults: { title: "After school routine" } },
    params: [], confirmRequired: false, enabled: true, builtIn: true, usageCount: 0, createdAt: "", updatedAt: "",
  },
];

export function createEmptyReminderProfileState(): ReminderProfileState {
  return {
    version: 2,
    reminders: [],
    templates: [],
    settings: { ...DEFAULT_REMINDER_SETTINGS },
    commands: [],
    activity: [],
    migrationDone: false,
  };
}
