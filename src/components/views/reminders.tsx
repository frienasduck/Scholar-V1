"use client";

// ============================================================================
// Smart Reminders 2.0 — command centre
// Plan tasks, automate routines and let Scholar keep your day on track.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlarmClock, AlertTriangle, ArrowRight, Bell, BellRing, Bot, Brain,
  Calendar, CalendarDays, Check, CheckCircle2, ChevronRight, Clock,
  Copy, Download, Flame, History, ListChecks, Mic, Pencil,
  Play, Plus, RefreshCw, Repeat, Settings2, Sparkles, Square, Trash2,
  Volume2, Wand2, X, Zap, Timer,
} from "lucide-react";
import { askAIJSON } from "@/lib/ai";
import { useStore } from "@/lib/store";
import { useCurriculum } from "@/lib/use-curriculum";
import { exportPDF, mdToHtml } from "@/lib/pdf";
import { navigateTo } from "@/lib/nav-event";
import { StatCard, EmptyState } from "@/lib/shared";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/lib/notifications/notification-api";
import {
  type ReminderActivityEntry, type ReminderPriority,
  type ReminderSettings, type ReminderTemplate, type ReminderType,
  type SmartReminder,
} from "@/lib/reminders/types";
import {
  DAY_MS, HOUR_MS, MINUTE_MS, buildRevisionSeries,
  detectConflicts, formatSuggestion,
  isDueToday, isOverdue, isUpcoming, parseHHMM,
  parseQuickCommand, recurrenceLabel, smartRescheduleOptions,
} from "@/lib/reminders/engine";
import { useReminderStore, useReminderProfile } from "@/lib/reminders/store";
import {
  browserNotificationPermission, checkRemindersNow, requestBrowserNotifications, sendTestNotification,
} from "@/lib/reminders/scheduler";
import { listVoices, selectTalkVoice, describeVoice, speakSmartReminder, stopTalkSpeech } from "@/lib/reminders/talk";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dayNamesShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TYPE_META: Record<ReminderType, { label: string; icon: any; color: string }> = {
  general:   { label: "Reminder",       icon: BellRing,    color: "#64748b" },
  study:     { label: "Study Session",  icon: BookIcon,    color: "#6366f1" },
  homework:  { label: "Homework",       icon: Pencil,      color: "#f59e0b" },
  assignment:{ label: "Assignment",     icon: ListChecks,  color: "#fb923c" },
  revision:  { label: "Revision",       icon: RefreshCw,   color: "#14b8a6" },
  exam:      { label: "Exam",           icon: AlarmClock,  color: "#f43f5e" },
  practical: { label: "Practical",      icon: FlaskIcon,   color: "#10b981" },
  project:   { label: "Project",        icon: FolderIcon,  color: "#a855f7" },
  focus:     { label: "Focus Session",  icon: Timer,       color: "#06b6d4" },
  break:     { label: "Break",          icon: CoffeeIcon,  color: "#84cc16" },
  habit:     { label: "Habit",          icon: Repeat,      color: "#22d3ee" },
  custom:    { label: "Custom",         icon: Wand2,       color: "#d946ef" },
};

function BookIcon(props: any) { return <Bell {...props} />; }
function FlaskIcon(props: any) { return <Zap {...props} />; }
function FolderIcon(props: any) { return <Bell {...props} />; }
function CoffeeIcon(props: any) { return <Bell {...props} />; }

export const REMINDER_TYPE_OPTIONS: ReminderType[] = [
  "general", "study", "homework", "assignment", "revision", "exam",
  "practical", "project", "focus", "break", "habit", "custom",
];

const PRIORITY_META: Record<ReminderPriority, { label: string; color: string }> = {
  low:      { label: "Low",      color: "#64748b" },
  medium:   { label: "Medium",   color: "#3b82f6" },
  high:     { label: "High",     color: "#f59e0b" },
  critical: { label: "Critical", color: "#f43f5e" },
};

const SOURCE_LABEL: Record<string, string> = {
  manual: "You", lam: "LAM", fica: "FICA", template: "Template", "ai-suggestion": "AI", system: "System",
};

const OPEN_VIEW_OPTIONS = [
  { view: "study", label: "Study / Chapter" },
  { view: "focus", label: "Focus Mode" },
  { view: "quiz", label: "Quiz" },
  { view: "flashcards", label: "Flashcards" },
  { view: "revision-hub", label: "Revision Hub" },
  { view: "chapter-command", label: "Chapter Command Center" },
  { view: "practice", label: "Practice" },
  { view: "notes", label: "Notes" },
  { view: "assignments", label: "Assignments" },
];

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `x-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface SeriesDraft {
  examTitle: string;
  examDate: string;
  subject?: string;
  chapters: string[];
  items: Array<{ title: string; dueAt: Date; durationMin: number; type: ReminderType }>;
}

function stripReminderMeta(r: SmartReminder): Partial<SmartReminder> & { title: string } {
  return {
    title: r.title, description: r.description, type: r.type, subject: r.subject, chapter: r.chapter,
    tags: r.tags, priority: r.priority, startsAt: r.startsAt, dueAt: r.dueAt, timezone: r.timezone,
    allDay: r.allDay, durationMin: r.durationMin, recurrence: r.recurrence, recurrenceEndAt: r.recurrenceEndAt,
    recurrenceCount: r.recurrenceCount, alerts: r.alerts, talkEnabled: r.talkEnabled, voiceURI: r.voiceURI,
    voiceLanguage: r.voiceLanguage, speechRate: r.speechRate, speechPitch: r.speechPitch, speechVolume: r.speechVolume,
    spokenContentMode: r.spokenContentMode, customSpokenMessage: r.customSpokenMessage, speakDetails: r.speakDetails,
    checklist: r.checklist, linkedEntity: r.linkedEntity, openViewOnStart: r.openViewOnStart,
    autoStartFocus: r.autoStartFocus, important: r.important, allowSmartReschedule: r.allowSmartReschedule,
    requireCompletionConfirmation: r.requireCompletionConfirmation, followUpReminderMinutes: r.followUpReminderMinutes,
    profileClass: r.profileClass,
  };
}

function relTime(t: number): string {
  const diff = t - Date.now();
  const abs = Math.abs(diff);
  const past = diff < 0;
  if (abs < HOUR_MS) return `${past ? "" : "in "}${Math.round(abs / MINUTE_MS)}m${past ? " ago" : ""}`;
  if (abs < DAY_MS) return `${past ? "" : "in "}${Math.round(abs / HOUR_MS)}h${past ? " ago" : ""}`;
  const days = Math.round(abs / DAY_MS);
  if (days < 7) return `${past ? "" : "in "}${days}d${past ? " ago" : ""}`;
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function dueLabel(reminder: SmartReminder): string {
  if (reminder.allDay) return new Date(reminder.dueAt).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  return new Date(reminder.dueAt).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

// ============================================================================
// Profile hook (shared — see store.ts)
// ============================================================================

// ============================================================================
// Main view
// ============================================================================

type ReminderTab = "today" | "upcoming" | "calendar" | "all" | "completed" | "templates" | "activity";
type DisplayMode = "timeline" | "compact" | "calendar" | "subject";

export function RemindersView() {
  const scholarClass = useStore((s) => s.user.scholarClass);
  const streak = useStore((s) => s.streak);
  const addXP = useStore((s) => s.addXP);
  const pushActivity = useStore((s) => s.pushActivity);
  const curriculum = useCurriculum();
  const profile = useReminderProfile(scholarClass);
  const store = useReminderStore;

  const [tab, setTab] = useState<ReminderTab>("today");
  const [displayMode, setDisplayMode] = useState<DisplayMode>(profile.settings.displayMode);
  const [quickInput, setQuickInput] = useState("");
  const [quickPreview, setQuickPreview] = useState<ReturnType<typeof parseQuickCommand> | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<SmartReminder | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [talkEditorFor, setTalkEditorFor] = useState<SmartReminder | null>(null);
  const [snoozeFor, setSnoozeFor] = useState<SmartReminder | null>(null);
  const [rescheduleFor, setRescheduleFor] = useState<SmartReminder | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ id: string; title: string; body: string; kind: string; payload?: Record<string, unknown> }>>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<SmartReminder | null>(null);
  const [seriesDraft, setSeriesDraft] = useState<SeriesDraft | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [moveReminderId, setMoveReminderId] = useState<string | null>(null);
  const [activityFilter, setActivityFilter] = useState<"all" | "lam" | "manual" | "automatic" | "spoken" | "missed">("all");
  const quickInputRef = useRef<HTMLInputElement>(null);
  const notifState = useMemo(() => browserNotificationPermission(), [settingsOpen]);

  // Open a reminder from LAM / scheduler payload
  useEffect(() => {
    const onNavigate = (e: Event) => {
      const detail = (e as CustomEvent<{ viewId: string; payload?: Record<string, unknown> }>).detail;
      if (detail?.viewId === "reminders" && detail.payload?.openReminder) {
        setDetailId(String(detail.payload.openReminder));
        setTab("all");
      }
    };
    window.addEventListener("neha-scholar:navigate", onNavigate);
    return () => window.removeEventListener("neha-scholar:navigate", onNavigate);
  }, []);

  useEffect(() => {
    checkRemindersNow(scholarClass);
  }, [scholarClass]);

  useEffect(() => {
    setDisplayMode(profile.settings.displayMode);
  }, [profile.settings.displayMode]);

  const reminders = profile.reminders;
  const activeReminders = useMemo(() => reminders.filter((r) => r.status === "scheduled" || r.status === "active"), [reminders]);
  const now = new Date();

  // Derived buckets
  const dueToday = useMemo(() => activeReminders.filter((r) => isDueToday(r, now)).sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt)), [activeReminders, now]);
  const upcoming = useMemo(() => activeReminders.filter((r) => isUpcoming(r, now) && !isDueToday(r, now)).sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt)), [activeReminders, now]);
  const overdue = useMemo(() => activeReminders.filter((r) => isOverdue(r, now)).sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt)), [activeReminders, now]);
  const completed = useMemo(() => reminders.filter((r) => r.status === "completed").sort((a, b) => +new Date(b.completedAt ?? b.dueAt) - +new Date(a.completedAt ?? a.dueAt)), [reminders]);
  const completedThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * DAY_MS;
    return completed.filter((r) => +new Date(r.completedAt ?? 0) >= weekAgo).length;
  }, [completed]);

  const setDisplayAndSave = useCallback((mode: DisplayMode) => {
    setDisplayMode(mode);
    store.getState().updateSettings(scholarClass, { displayMode: mode });
  }, [scholarClass, store]);

  // ---- Create from quick add -------------------------------------------------
  const handleQuickAdd = useCallback(() => {
    if (!quickInput.trim()) { quickInputRef.current?.focus(); return; }
    const parsed = parseQuickCommand(quickInput);
    setQuickPreview(parsed);
  }, [quickInput]);

  const confirmQuickPreview = useCallback(() => {
    if (!quickPreview) return;
    const parsed = quickPreview;
    const conflicts = detectConflicts({
      id: "new", title: parsed.title, dueAt: parsed.dueAt.toISOString(),
      durationMin: parsed.durationMin, priority: parsed.priority, type: parsed.type,
    }, reminders, profile.settings, now);
    if (conflicts.some((c) => c.kind === "past")) {
      toast.error("That time is in the past. Choose another time.");
      return;
    }
    const created = store.getState().createReminder(scholarClass, {
      title: parsed.title,
      type: parsed.type,
      subject: parsed.subject,
      chapter: parsed.chapter,
      dueAt: parsed.dueAt.toISOString(),
      allDay: parsed.allDay,
      priority: parsed.priority,
      durationMin: parsed.durationMin,
      recurrence: parsed.recurrence,
      recurrenceCount: parsed.recurrenceCount,
      alerts: parsed.preAlertMinutes ? [{ id: `al-${uid()}`, offsetMinutes: parsed.preAlertMinutes, label: `${parsed.preAlertMinutes} minutes before` }] : [],
      talkEnabled: profile.settings.defaultTalkEnabled,
      speechRate: 1, speechPitch: 1, speechVolume: 1,
      spokenContentMode: "title",
      speakDetails: profile.settings.speakReminderDetails,
    }, { source: "manual" });
    addXP(2);
    pushActivity({ type: "note", text: `Created reminder: ${created.title}`, icon: "🔔" });
    toast.success("Reminder created +2 XP", { description: dueLabel(created) });
    setQuickInput("");
    setQuickPreview(null);
    setTab("today");
  }, [quickPreview, reminders, profile.settings, scholarClass, store, addXP, pushActivity, now]);

  // ---- Smart suggestions --------------------------------------------------------
  const runSmartSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    try {
      const tasks = useStore.getState().tasks.filter((t) => !t.done);
      const mastery = useStore.getState().mastery;
      const sessions = useStore.getState().sessions;
      let mistakes: string[] = [];
      try {
        const raw = window.localStorage.getItem("pp-mistakes");
        const parsed = raw ? JSON.parse(raw) : [];
        mistakes = Array.isArray(parsed) ? parsed.slice(0, 5).map((m: any) => m?.chapter ?? m?.question ?? "").filter(Boolean) : [];
      } catch { /* optional */ }
      const exams = tasks.filter((t) => t.type === "exam");
      const weakTopics = Object.entries(mastery).filter(([, v]) => v < 50).map(([k]) => k).slice(0, 5);
      const postponed = reminders.filter((r) => r.status === "scheduled" && r.snoozeUntil && new Date(r.snoozeUntil).getTime() > Date.now()).slice(0, 3).map((r) => r.title);
      const prompt = `You are the academic coach inside Scholar's Smart Suggestions for a CBSE Class ${scholarClass} student.
Data:
- ${exams.length} upcoming exam task(s): ${exams.map((e) => `${e.title} on ${e.date}`).join(", ") || "none"}
- Weak topics: ${weakTopics.join(", ") || "none"}
- Pending tasks: ${tasks.length}
- Study sessions: ${sessions.length}
- Recent mistakes: ${mistakes.join("; ") || "none"}
- Postponed reminders: ${postponed.join("; ") || "none"}
- Current streak: ${streak} days

Suggest 3 concrete, actionable academic reminders. Never invent deadlines. Each suggestion:
Return strict JSON:
{"suggestions":[{"title": string (max 60 chars), "body": string (1 sentence, max 140 chars), "kind": "exam"|"weak-topic"|"mistake"|"postponed"|"routine", "dueInHours": number 1-96, "durationMin": number 10-60, "subject": string|null}]}`;
      const res = await askAIJSON<{ suggestions: Array<{ title: string; body: string; kind: string; dueInHours: number; durationMin: number; subject?: string | null }> }>(prompt, "academic-coach");
      if (!res?.suggestions?.length) throw new Error("no result");
      setSuggestions(res.suggestions.slice(0, 4).map((s, i) => ({
        id: `sug-${Date.now()}-${i}`,
        title: String(s.title).slice(0, 70),
        body: String(s.body).slice(0, 160),
        kind: s.kind,
        payload: { dueInHours: Number(s.dueInHours) || 6, durationMin: Number(s.durationMin) || 25, subject: s.subject ?? undefined },
      })));
    } catch {
      toast.error("Smart suggestions failed. Try again in a moment.");
    } finally { setSuggestionsLoading(false); }
  }, [scholarClass, reminders, streak]);

  const createSuggestion = useCallback((suggestion: { id: string; title: string; body: string; payload?: Record<string, unknown> }) => {
    const due = new Date(Date.now() + (Number(suggestion.payload?.dueInHours) || 6) * HOUR_MS);
    const created = store.getState().createReminder(scholarClass, {
      title: suggestion.title,
      description: suggestion.body,
      type: "revision",
      subject: suggestion.payload?.subject as string | undefined,
      dueAt: due.toISOString(),
      durationMin: Number(suggestion.payload?.durationMin) || 25,
      priority: "medium",
      alerts: [{ id: `al-${uid()}`, offsetMinutes: profile.settings.defaultPreAlertMinutes, label: `${profile.settings.defaultPreAlertMinutes} minutes before` }],
    }, { source: "ai-suggestion", activityActor: "automatic", detail: "Smart Suggestion accepted" });
    addXP(2);
    toast.success(`Scheduled “${created.title}”`, { description: dueLabel(created) });
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
  }, [scholarClass, store, profile.settings.defaultPreAlertMinutes, addXP]);

  // ---- Export ------------------------------------------------------------------
  const exportReminders = useCallback(() => {
    const md = `# Smart Reminders 2.0\nGenerated on ${new Date().toLocaleString()}\n\n## Summary\n- Active: ${activeReminders.length}\n- Due today: ${dueToday.length}\n- Overdue: ${overdue.length}\n- Completed this week: ${completedThisWeek}\n\n## Due today\n${dueToday.length ? dueToday.map((r, i) => `${i + 1}. **${r.title}** — ${dueLabel(r)} (${PRIORITY_META[r.priority].label})`).join("\n") : "_None_"}\n\n## Upcoming\n${upcoming.length ? upcoming.slice(0, 15).map((r, i) => `${i + 1}. ${r.title} — ${dueLabel(r)}`).join("\n") : "_None_"}\n\n## Overdue\n${overdue.length ? overdue.map((r, i) => `${i + 1}. ${r.title} — due ${relTime(+new Date(r.dueAt))}`).join("\n") : "_None_"}\n\n> Powered by Scholar Smart Reminders 2.0`;
    exportPDF({ title: "Smart Reminders Report", subtitle: `${dueToday.length} due today · ${overdue.length} overdue`, bodyHtml: mdToHtml(md), accent: "#d946ef" });
    toast.success("Exporting reminders report…");
  }, [activeReminders, dueToday, overdue, upcoming, completedThisWeek]);

  // ---- Undo helpers --------------------------------------------------------------
  const undoRef = useRef<SmartReminder | null>(null);
  const handleComplete = useCallback((reminder: SmartReminder) => {
    store.getState().completeReminder(scholarClass, reminder.id);
    undoRef.current = reminder;
    toast.success(`Completed “${reminder.title}”`, {
      description: "Nice work. +3 XP",
      action: { label: "Undo", onClick: () => store.getState().undoComplete(scholarClass, reminder.id) },
    });
    addXP(3);
  }, [scholarClass, store, addXP]);

  const handleDelete = useCallback((reminder: SmartReminder) => {
    undoRef.current = reminder;
    store.getState().removeReminder(scholarClass, reminder.id);
    toast.success(`Deleted “${reminder.title}”`, {
      action: { label: "Undo", onClick: () => {
        const previous = undoRef.current;
        if (previous) store.getState().createReminder(scholarClass, { ...stripReminderMeta(previous), status: "scheduled" }, { source: "manual" });
      } },
    });
    setConfirmDelete(null);
    if (detailId === reminder.id) setDetailId(null);
  }, [scholarClass, store, detailId]);

  // ---- Talk preview ---------------------------------------------------------------
  const previewTalk = useCallback((reminder: Partial<SmartReminder>) => {
    const full: SmartReminder = {
      id: "preview", profileClass: scholarClass, title: reminder.title ?? "Preview reminder",
      dueAt: reminder.dueAt ?? new Date().toISOString(), tags: [], priority: "medium",
      alerts: [], firedAlertIds: [], talkEnabled: true,
      speechRate: reminder.speechRate ?? 1, speechPitch: reminder.speechPitch ?? 1, speechVolume: reminder.speechVolume ?? 1,
      spokenContentMode: reminder.spokenContentMode ?? "title", customSpokenMessage: reminder.customSpokenMessage,
      speakDetails: reminder.speakDetails ?? false, checklist: [], important: false,
      allowSmartReschedule: true, requireCompletionConfirmation: false,
      type: "general", status: "scheduled", source: "manual", timezone: "local", allDay: reminder.allDay ?? false,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    speakSmartReminder(full, { requireVisible: false });
  }, [scholarClass]);

  // ============================================================================
  // Render
  // ============================================================================

  const detailReminder = detailId ? reminders.find((r) => r.id === detailId) ?? null : null;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&display=swap');
        .sr-font-serif { font-family: 'Instrument Serif', serif; }
        .sr-font-body { font-family: 'Inter', sans-serif; }
        .sr-glass { background: rgba(255,255,255,0.04); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.12); box-shadow: inset 0 1px 1px rgba(255,255,255,0.08); color: white; }
        .sr-glass-strong { background: rgba(255,255,255,0.07); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.16); box-shadow: inset 0 1px 1px rgba(255,255,255,0.1); color: white; }
        .sr-glass input, .sr-glass textarea, .sr-glass select { background: rgba(255,255,255,0.05) !important; border-color: rgba(255,255,255,0.15) !important; color: white !important; }
        .sr-glass input::placeholder, .sr-glass textarea::placeholder { color: rgba(255,255,255,0.4) !important; }
        .sr-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .sr-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
      `}</style>

      <video autoPlay muted loop playsInline poster="/backgrounds/scholar-poster.svg" preload="metadata" className="absolute inset-0 w-full h-full object-cover z-0">
        <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260511_230229_7c9bc431-46cf-489a-948d-e8144d8eb5d4.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 z-0 bg-black/55" />

      <div className="relative z-10 sr-font-body p-4 md:p-8 lg:p-10 max-w-7xl mx-auto pb-28 md:pb-10">
        {/* ===== Header ===== */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="grid place-items-center h-12 w-12 rounded-2xl bg-gradient-to-br from-fuchsia-500/30 to-pink-500/30 text-fuchsia-300 border border-white/10">
                <BellRing className="h-6 w-6" />
              </div>
              <Badge className="bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40">2.0 • AI • Voice • LAM × FICA</Badge>
            </div>
            <h1 className="sr-font-serif text-4xl md:text-5xl text-white leading-tight">
              Smart <em className="text-fuchsia-300">Reminders</em>
            </h1>
            <p className="text-white/60 mt-2 max-w-2xl text-sm">
              Plan tasks, automate routines and let Scholar keep your day on track. Type a natural command,
              or ask LAM to create, move, snooze and speak your reminders.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" className="sr-glass bg-white/5 border-white/15 text-white hover:bg-white/10"
              onClick={() => window.dispatchEvent(new CustomEvent("scholar:open-lam", { detail: { prompt: "Create a reminder" } }))}>
              <Bot className="h-3.5 w-3.5 mr-1.5" /> Ask LAM
            </Button>
            <Button variant="outline" className="sr-glass bg-white/5 border-white/15 text-white hover:bg-white/10" onClick={exportReminders}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export
            </Button>
            <Button variant="outline" className="sr-glass bg-white/5 border-white/15 text-white hover:bg-white/10" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="h-3.5 w-3.5 mr-1.5" /> Settings
            </Button>
            <Button className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white" onClick={() => { setEditing(null); setEditorOpen(true); }}>
              <Plus className="h-4 w-4 mr-1.5" /> New Reminder
            </Button>
          </div>
        </motion.div>

        {/* ===== Quick Add ===== */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="sr-glass-strong rounded-2xl p-3 mb-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-fuchsia-300 shrink-0 hidden sm:block" />
            <input
              ref={quickInputRef}
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleQuickAdd(); }}
              placeholder="What should Scholar remind you about?  e.g. Revise Laws of Motion tomorrow at 6 PM"
              aria-label="Quick add reminder"
              className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder:text-white/35 outline-none py-2"
            />
            <Button size="sm" className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white shrink-0" onClick={handleQuickAdd}>
              <Wand2 className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </div>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap text-[10px] text-white/40">
            <span>Try:</span>
            {["Remind me every Monday to complete Chemistry homework", "Start a 25-minute Maths focus session after school", "Remind me two days before my Physics exam"].map((example) => (
              <button key={example} onClick={() => { setQuickInput(example); quickInputRef.current?.focus(); }}
                className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/50 hover:text-white hover:bg-white/10 transition-colors">
                {example.length > 46 ? example.slice(0, 44) + "…" : example}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ===== Summary cards ===== */}
        <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
          className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { icon: AlarmClock, label: "Due Today", value: dueToday.length, accent: "#d946ef", onClick: () => setTab("today") },
            { icon: Calendar, label: "Upcoming", value: upcoming.length, accent: "#3b82f6", onClick: () => setTab("upcoming") },
            { icon: AlertTriangle, label: "Overdue", value: overdue.length, accent: "#f43f5e", onClick: () => setTab("all") },
            { icon: CheckCircle2, label: "Done This Week", value: completedThisWeek, accent: "#10b981", onClick: () => setTab("completed") },
            { icon: Flame, label: "Study Streak", value: `${streak}d`, accent: "#f59e0b", onClick: () => setTab("today") },
          ].map((s, i) => (
            <motion.button key={i} variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }} onClick={s.onClick}
              className="text-left">
              <StatCard icon={s.icon} label={s.label} value={s.value} accent={s.accent} />
            </motion.button>
          ))}
        </motion.div>

        {/* ===== Display mode + tabs ===== */}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <Tabs value={tab} onChange={setTab} />
          <div className="flex items-center gap-1 sr-glass rounded-xl p-1" role="group" aria-label="Display mode">
            {([["timeline", "Timeline"], ["compact", "List"], ["calendar", "Calendar"], ["subject", "By Subject"]] as Array<[DisplayMode, string]>).map(([mode, label]) => (
              <button key={mode} onClick={() => setDisplayAndSave(mode)}
                className={cn("px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all", displayMode === mode ? "bg-white/15 text-white" : "text-white/50 hover:text-white")}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ===== Main grid ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_20rem] gap-6">
          <div className="min-w-0 space-y-4">
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                {tab === "today" && <TodayList reminders={dueToday} overdue={overdue} displayMode={displayMode} onComplete={handleComplete} onOpen={(r) => setDetailId(r.id)} onSnooze={setSnoozeFor} onReschedule={setRescheduleFor} />}
                {tab === "upcoming" && <UpcomingList reminders={upcoming} displayMode={displayMode} onComplete={handleComplete} onOpen={(r) => setDetailId(r.id)} onSnooze={setSnoozeFor} onReschedule={setRescheduleFor} />}
                {tab === "calendar" && (
                  <CalendarPanel
                    reminders={activeReminders}
                    month={calendarMonth} onMonthChange={setCalendarMonth}
                    selectedDay={selectedDay} onSelectDay={setSelectedDay}
                    moveReminderId={moveReminderId} onMoveReminder={setMoveReminderId}
                    onMove={(reminderId, dueAt) => {
                      store.getState().rescheduleReminder(scholarClass, reminderId, dueAt, { actor: "manual", detail: "Moved from the calendar" });
                      toast.success("Reminder moved", { description: dueLabel(activeReminders.find((r) => r.id === reminderId)!) });
                      setMoveReminderId(null);
                    }}
                    onOpen={(r) => setDetailId(r.id)}
                  />
                )}
                {tab === "all" && <AllList reminders={[...dueToday, ...upcoming, ...overdue]} displayMode={displayMode} onComplete={handleComplete} onOpen={(r) => setDetailId(r.id)} onSnooze={setSnoozeFor} onReschedule={setRescheduleFor} onDelete={setConfirmDelete} />}
                {tab === "completed" && <CompletedList reminders={completed} onOpen={(r) => setDetailId(r.id)} onRestore={(id) => { store.getState().restoreReminder(scholarClass, id); toast.success("Reminder restored"); }} />}
                {tab === "templates" && <TemplatesPanel scholarClass={scholarClass} />}
                {tab === "activity" && <ActivityPanel scholarClass={scholarClass} filter={activityFilter} onFilter={setActivityFilter} />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ===== Smart Suggestions ===== */}
          <aside className="space-y-4">
            <div className="sr-glass-strong rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="grid place-items-center h-8 w-8 rounded-lg bg-gradient-to-br from-fuchsia-500/30 to-purple-500/30 text-fuchsia-200">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Smart Suggestions</h3>
                    <p className="text-[10px] text-white/40">Based on your exams, weak topics & streak</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-[11px] bg-white/5 border-white/15 text-white hover:bg-white/10" disabled={suggestionsLoading} onClick={runSmartSuggestions}>
                  {suggestionsLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                </Button>
              </div>
              {suggestions.length === 0 ? (
                <p className="text-xs text-white/40 leading-relaxed">
                  Scholar can suggest reminders from your upcoming exams, weak chapters, recent mistakes and
                  repeatedly-postponed tasks. Tap the sparkle to generate suggestions — nothing is created without your approval.
                </p>
              ) : (
                <div className="space-y-2">
                  {suggestions.map((s) => (
                    <div key={s.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-xs font-semibold text-white">{s.title}</p>
                      <p className="text-[11px] text-white/55 mt-1 leading-relaxed">{s.body}</p>
                      <div className="mt-2 flex gap-1.5">
                        <button onClick={() => createSuggestion(s)} className="flex-1 rounded-lg bg-fuchsia-500/20 border border-fuchsia-500/40 px-2 py-1.5 text-[10px] font-medium text-fuchsia-200 hover:bg-fuchsia-500/30 transition-colors">
                          <Plus className="h-2.5 w-2.5 inline mr-0.5 -mt-0.5" /> Schedule
                        </button>
                        <button onClick={() => setSuggestions((prev) => prev.filter((x) => x.id !== s.id))} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] text-white/50 hover:text-white transition-colors">
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setSuggestions([])} className="text-[10px] text-white/40 hover:text-white/70">Clear suggestions</button>
                </div>
              )}
            </div>

            <div className="sr-glass rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
                <Bot className="h-4 w-4 text-cyan-300" /> LAM × FICA
              </h3>
              <p className="text-[11px] text-white/50 leading-relaxed">
                Task automation is powered through FICA. Ask LAM things like
                <span className="text-cyan-200"> “Remind me to revise chemical bonding tomorrow at 6”</span>,
                <span className="text-cyan-200"> “Snooze the homework reminder for 20 minutes”</span>, or
                <span className="text-cyan-200"> “Create a revision schedule for my Physics exam”</span>.
              </p>
              <button onClick={() => window.dispatchEvent(new CustomEvent("scholar:open-lam", { detail: { prompt: "Create a Physics revision reminder every Tuesday and Thursday at 7 PM" } }))}
                className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 px-3 py-2 text-[11px] text-cyan-200 hover:bg-cyan-500/25 transition-colors">
                <Mic className="h-3 w-3" /> Try an example with LAM
              </button>
            </div>
          </aside>
        </div>

        {/* Mobile sticky quick-add */}
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 md:hidden w-[calc(100vw-2rem)]">
          <button onClick={() => quickInputRef.current?.focus()}
            className="sr-glass-strong w-full flex items-center gap-2 rounded-2xl px-4 py-3 text-sm text-white/60">
            <Plus className="h-4 w-4 text-fuchsia-300" /> Add a reminder…
          </button>
        </div>
      </div>

      {/* ===== Quick preview dialog ===== */}
      <QuickPreviewDialog parsed={quickPreview} onCancel={() => setQuickPreview(null)} onEdit={() => setQuickPreview(null)} onConfirm={confirmQuickPreview} />

      {/* ===== Editor dialog ===== */}
      <ReminderEditorDialog
        scholarClass={scholarClass}
        open={editorOpen}
        onOpenChange={(open) => { setEditorOpen(open); if (!open) setEditing(null); }}
        editing={editing}
        curriculum={curriculum}
        onCreated={(reminder) => { setDetailId(reminder.id); setTab("all"); }}
        onSeriesDraft={(draft) => setSeriesDraft(draft)}
      />

      {/* ===== Detail dialog ===== */}
      {detailReminder && (
        <ReminderDetailDialog
          reminder={detailReminder}
          open={!!detailReminder}
          onOpenChange={(open) => { if (!open) setDetailId(null); }}
          onEdit={(r) => { setEditing(r); setEditorOpen(true); setDetailId(null); }}
          onComplete={handleComplete}
          onSnooze={setSnoozeFor}
          onReschedule={setRescheduleFor}
          onDelete={() => setConfirmDelete(detailReminder)}
          onDuplicate={(r) => {
            const created = store.getState().createReminder(scholarClass, { ...stripReminderMeta(r), status: "scheduled" }, { source: "manual" });
            toast.success(`Duplicated “${created.title}”`);
            setDetailId(null);
          }}
          onOpenTalk={() => { setTalkEditorFor(detailReminder); setDetailId(null); }}
        />
      )}

      {/* ===== Talk editor dialog ===== */}
      {talkEditorFor && (
        <TalkEditorDialog reminder={talkEditorFor} scholarClass={scholarClass} onClose={() => setTalkEditorFor(null)} onPreview={previewTalk} />
      )}

      {/* ===== Snooze dialog ===== */}
      {snoozeFor && (
        <SnoozeDialog reminder={snoozeFor} scholarClass={scholarClass} onClose={() => setSnoozeFor(null)}
          onReschedule={() => { setRescheduleFor(snoozeFor); setSnoozeFor(null); }} />
      )}

      {/* ===== Reschedule dialog ===== */}
      {rescheduleFor && (
        <RescheduleDialog reminder={rescheduleFor} scholarClass={scholarClass} onClose={() => setRescheduleFor(null)} />
      )}

      {/* ===== Delete confirm ===== */}
      {confirmDelete && (
        <Dialog open onOpenChange={() => setConfirmDelete(null)}>
          <DialogContent className="sr-glass-strong !bg-black/60 !border-white/20 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2"><Trash2 className="h-5 w-5 text-rose-300" /> Delete reminder?</DialogTitle>
              <DialogDescription className="text-white/70">“{confirmDelete.title}” will be permanently removed. This can be undone immediately after.</DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button variant="ghost" className="text-white/70" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button className="bg-rose-500 hover:bg-rose-600 text-white" onClick={() => handleDelete(confirmDelete)}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ===== Series preview dialog ===== */}
      {seriesDraft && (
        <SeriesPreviewDialog draft={seriesDraft} scholarClass={scholarClass} onClose={() => setSeriesDraft(null)}
          onConfirm={() => {
            const created = store.getState().createRemindersBulk(scholarClass, seriesDraft.items.map((item) => ({
              title: item.title, type: item.type, subject: seriesDraft.subject,
              dueAt: item.dueAt.toISOString(), durationMin: item.durationMin,
              priority: item.type === "exam" ? "high" : "medium",
            })), { source: "manual", actor: "manual", detail: `Revision series for ${seriesDraft.examTitle}` });
            addXP(created.length * 2);
            toast.success(`Revision series created · ${created.length} sessions`);
            setSeriesDraft(null);
            setTab("upcoming");
          }} />
      )}

      {/* ===== Settings dialog ===== */}
      <ReminderSettingsDialog scholarClass={scholarClass} open={settingsOpen} onOpenChange={setSettingsOpen} notifState={notifState} onRequestNotifications={async () => {
        const result = await requestBrowserNotifications();
        toast.success(result === "granted" ? "Notifications enabled" : result === "denied" ? "Notifications were blocked" : "Notification permission is pending");
      }} />
    </div>
  );
}

// ============================================================================
// Tab bar
// ============================================================================

function Tabs({ value, onChange }: { value: ReminderTab; onChange: (tab: ReminderTab) => void }) {
  const tabs: Array<{ id: ReminderTab; label: string }> = [
    { id: "today", label: "Today" },
    { id: "upcoming", label: "Upcoming" },
    { id: "calendar", label: "Calendar" },
    { id: "all", label: "All" },
    { id: "completed", label: "Completed" },
    { id: "templates", label: "Templates" },
    { id: "activity", label: "Activity" },
  ];
  return (
    <div role="tablist" aria-label="Reminder views" className="flex items-center gap-1 overflow-x-auto sr-scroll">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={cn("shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all", value === t.id ? "bg-fuchsia-500/25 text-fuchsia-100 border border-fuchsia-500/40" : "bg-white/5 text-white/55 border border-transparent hover:bg-white/10 hover:text-white")}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Reminder card (shared)
// ============================================================================

function ReminderCard({ reminder, onComplete, onOpen, onSnooze, onReschedule, onDelete, compact }: {
  reminder: SmartReminder;
  onComplete?: (r: SmartReminder) => void;
  onOpen: (r: SmartReminder) => void;
  onSnooze?: (r: SmartReminder) => void;
  onReschedule?: (r: SmartReminder) => void;
  onDelete?: (r: SmartReminder) => void;
  compact?: boolean;
}) {
  const meta = TYPE_META[reminder.type];
  const Icon = meta.icon;
  const overdue = isOverdue(reminder);
  const recLabel = recurrenceLabel(reminder.recurrence);
  const snoozed = !!reminder.snoozeUntil && new Date(reminder.snoozeUntil).getTime() > Date.now();
  const activeAlerts = reminder.alerts.length ? `${Math.min(...reminder.alerts.map((a) => a.offsetMinutes))}m before` : null;

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}
      className={cn("sr-glass rounded-2xl transition-colors hover:bg-white/[0.07] cursor-pointer", compact ? "p-3" : "p-4 border-l-2")}
      style={{ borderLeftColor: meta.color }}
      onClick={() => onOpen(reminder)}
      role="button"
      aria-label={`Open reminder ${reminder.title}`}
    >
      <div className="flex items-start gap-3">
        <div className={cn("grid place-items-center rounded-xl shrink-0", compact ? "h-8 w-8" : "h-10 w-10")} style={{ background: `${meta.color}22`, color: meta.color }}>
          <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className={cn("text-white font-semibold leading-snug", compact ? "text-xs" : "text-sm")}>{reminder.title}</h4>
            <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
              {snoozed && <Badge variant="outline" className="bg-amber-500/15 border-amber-500/40 text-amber-200 text-[9px] px-1.5"><Clock className="h-2 w-2 mr-0.5" />Snoozed</Badge>}
              {reminder.talkEnabled && <Badge variant="outline" className="bg-cyan-500/15 border-cyan-500/40 text-cyan-200 text-[9px] px-1.5"><Volume2 className="h-2 w-2 mr-0.5" />Talk</Badge>}
              {reminder.source !== "manual" && (
                <Badge variant="outline" className="bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-200 text-[9px] px-1.5">
                  <Sparkles className="h-2 w-2 mr-0.5" />{SOURCE_LABEL[reminder.source] ?? "AI"}
                </Badge>
              )}
              <Badge variant="outline" className="text-[9px] px-1.5" style={{ background: `${PRIORITY_META[reminder.priority].color}18`, borderColor: `${PRIORITY_META[reminder.priority].color}55`, color: PRIORITY_META[reminder.priority].color }}>
                {PRIORITY_META[reminder.priority].label}
              </Badge>
            </div>
          </div>
          {reminder.description && !compact && <p className="text-white/60 text-xs leading-relaxed mt-1 line-clamp-2">{reminder.description}</p>}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[11px] text-white/50">
            <span className={cn("flex items-center gap-1", overdue && "text-rose-300 font-medium")}>
              <Clock className="h-3 w-3" />{overdue ? "Overdue · " : ""}{relTime(+new Date(reminder.dueAt))}
            </span>
            {reminder.durationMin && <span>· {reminder.durationMin} min</span>}
            {recLabel && <span className="flex items-center gap-1"><Repeat className="h-3 w-3" />{recLabel}</span>}
            {activeAlerts && <span>· alert {activeAlerts}</span>}
            {reminder.subject && <span className="flex items-center gap-1"><BookIcon className="h-3 w-3" />{reminder.subject}</span>}
          </div>
          {!compact && (reminder.checklist.length > 0) && (
            <div className="mt-2 flex items-center gap-1 text-[10px] text-white/45">
              <ListChecks className="h-3 w-3" />{reminder.checklist.filter((c) => c.done).length}/{reminder.checklist.length} subtasks
            </div>
          )}
          {!compact && (
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              {onComplete && <ActionButton onClick={(e) => { e.stopPropagation(); onComplete(reminder); }}><Check className="h-3 w-3" />Complete</ActionButton>}
              {onSnooze && <ActionButton onClick={(e) => { e.stopPropagation(); onSnooze(reminder); }}><Clock className="h-3 w-3" />Snooze</ActionButton>}
              {onReschedule && <ActionButton onClick={(e) => { e.stopPropagation(); onReschedule(reminder); }}><Calendar className="h-3 w-3" />Move</ActionButton>}
              {onDelete && <ActionButton danger onClick={(e) => { e.stopPropagation(); onDelete(reminder); }}><Trash2 className="h-3 w-3" />Delete</ActionButton>}
              <button className="ml-auto text-white/30 hover:text-white transition-colors" aria-label="Open details" onClick={(e) => { e.stopPropagation(); onOpen(reminder); }}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ActionButton({ children, onClick, danger }: { children: React.ReactNode; onClick: (e: React.MouseEvent) => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={cn("flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium border transition-colors",
        danger ? "border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
          : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white")}>
      {children}
    </button>
  );
}

// ============================================================================
// List views
// ============================================================================

function ListShell({ reminders, empty, emptyIcon, displayMode, subject, onComplete, onOpen, onSnooze, onReschedule, onDelete }: {
  reminders: SmartReminder[];
  empty: { title: string; description: string };
  emptyIcon: any;
  displayMode: DisplayMode;
  subject?: boolean;
  onComplete?: (r: SmartReminder) => void;
  onOpen: (r: SmartReminder) => void;
  onSnooze?: (r: SmartReminder) => void;
  onReschedule?: (r: SmartReminder) => void;
  onDelete?: (r: SmartReminder) => void;
}) {
  if (!reminders.length) return <EmptyState icon={emptyIcon} title={empty.title} description={empty.description} />;

  if (displayMode === "subject") {
    const groups = new Map<string, SmartReminder[]>();
    for (const r of reminders) {
      const key = r.subject ?? "General";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    return (
      <div className="space-y-5">
        {[...groups.entries()].map(([subjectName, items]) => (
          <div key={subjectName}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-2 flex items-center gap-2">
              <BookIcon className="h-3.5 w-3.5 text-fuchsia-300" />{subjectName}
              <span className="text-white/25">{items.length}</span>
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              {items.map((r) => <ReminderCard key={r.id} reminder={r} onComplete={onComplete} onOpen={onOpen} onSnooze={onSnooze} onReschedule={onReschedule} onDelete={onDelete} />)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (displayMode === "compact") {
    return (
      <div className="space-y-1.5">
        {reminders.map((r) => <ReminderCard key={r.id} reminder={r} compact onComplete={onComplete} onOpen={onOpen} onSnooze={onSnooze} onReschedule={onReschedule} onDelete={onDelete} />)}
      </div>
    );
  }

  return (
    <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }} className="grid gap-3 md:grid-cols-2">
      <AnimatePresence mode="popLayout">
        {reminders.map((r) => <ReminderCard key={r.id} reminder={r} onComplete={onComplete} onOpen={onOpen} onSnooze={onSnooze} onReschedule={onReschedule} onDelete={onDelete} />)}
      </AnimatePresence>
    </motion.div>
  );
}

function TodayList({ reminders, overdue, displayMode, onComplete, onOpen, onSnooze, onReschedule }: any) {
  return (
    <div className="space-y-5">
      {overdue.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-300/80 mb-2 flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5" />Overdue <span className="text-white/25">{overdue.length}</span></h3>
          <ListShell reminders={overdue} empty={{ title: "", description: "" }} emptyIcon={AlertTriangle} displayMode={displayMode} onComplete={onComplete} onOpen={onOpen} onSnooze={onSnooze} onReschedule={onReschedule} />
        </div>
      )}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-fuchsia-300/80 mb-2 flex items-center gap-2"><AlarmClock className="h-3.5 w-3.5" />Due Today <span className="text-white/25">{reminders.length}</span></h3>
        <ListShell reminders={reminders} empty={{ title: "All clear for today 🎉", description: "Nothing due today. Scholar will surface new nudges as your study data evolves." }} emptyIcon={CheckCircle2} displayMode={displayMode} onComplete={onComplete} onOpen={onOpen} onSnooze={onSnooze} onReschedule={onReschedule} />
      </div>
    </div>
  );
}

function UpcomingList(props: any) {
  return <ListShell {...props} empty={{ title: "Nothing upcoming", description: "Plan ahead — create a reminder or apply a template to build a routine." }} emptyIcon={Calendar} />;
}

function AllList(props: any) {
  return <ListShell {...props} empty={{ title: "No active reminders", description: "Your reminders will appear here across all statuses." }} emptyIcon={Bell} />;
}

function CompletedList({ reminders, onOpen, onRestore }: { reminders: SmartReminder[]; onOpen: (r: SmartReminder) => void; onRestore: (id: string) => void }) {
  if (!reminders.length) return <EmptyState icon={CheckCircle2} title="Nothing completed yet" description="Completed reminders land here. Great work when they do!" />;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {reminders.slice(0, 60).map((r) => (
        <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="sr-glass rounded-2xl p-4 opacity-70 hover:opacity-100 transition-opacity cursor-pointer" onClick={() => onOpen(r)}>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white/80 line-through decoration-white/30">{r.title}</p>
              <p className="text-[11px] text-white/40 mt-0.5">Completed {r.completedAt ? new Date(r.completedAt).toLocaleString("en-IN", { day: "numeric", month: "short" }) : ""} · {dueLabel(r)}</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onRestore(r.id); }} className="text-[11px] rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-white/60 hover:text-white hover:bg-white/10 transition-colors">
              Restore
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ============================================================================
// Calendar panel
// ============================================================================

function CalendarPanel({ reminders, month, onMonthChange, selectedDay, onSelectDay, moveReminderId, onMoveReminder, onMove, onOpen }: {
  reminders: SmartReminder[];
  month: { y: number; m: number };
  onMonthChange: (m: { y: number; m: number }) => void;
  selectedDay: number | null;
  onSelectDay: (d: number | null) => void;
  moveReminderId: string | null;
  onMoveReminder: (id: string | null) => void;
  onMove: (id: string, dueAt: string) => void;
  onOpen: (r: SmartReminder) => void;
}) {
  const first = new Date(month.y, month.m, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
  const today = new Date();
  const byDay = useMemo(() => {
    const map = new Map<number, SmartReminder[]>();
    for (const r of reminders) {
      const due = new Date(r.dueAt);
      if (due.getFullYear() === month.y && due.getMonth() === month.m) {
        const list = map.get(due.getDate()) ?? [];
        list.push(r);
        map.set(due.getDate(), list);
      }
    }
    return map;
  }, [reminders, month]);

  const moveSource = moveReminderId ? reminders.find((r) => r.id === moveReminderId) : null;
  const dayReminders = selectedDay !== null ? (byDay.get(selectedDay) ?? []) : [];

  return (
    <div className="space-y-4">
      {moveSource && (
        <div className="sr-glass-strong rounded-xl p-3 flex items-center gap-2 text-sm text-cyan-200">
          <ArrowRight className="h-4 w-4" />
          Moving “{moveSource.title}” — tap a day to move it there, or tap a reminder to cancel.
        </div>
      )}
      <div className="sr-glass rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => onMonthChange({ y: month.m === 0 ? month.y - 1 : month.y, m: month.m === 0 ? 11 : month.m - 1 })}
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-white/60 hover:text-white" aria-label="Previous month">‹</button>
          <h3 className="text-sm font-semibold text-white">{first.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</h3>
          <button onClick={() => onMonthChange({ y: month.m === 11 ? month.y + 1 : month.y, m: month.m === 11 ? 0 : month.m + 1 })}
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-white/60 hover:text-white" aria-label="Next month">›</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-white/40 mb-1">
          {dayNamesShort.map((d) => <span key={d} className="py-1">{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startOffset }).map((_, i) => <div key={`empty-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const list = byDay.get(day) ?? [];
            const isToday = today.getFullYear() === month.y && today.getMonth() === month.m && today.getDate() === day;
            const isSelected = selectedDay === day;
            const isMoveTarget = !!moveSource;
            return (
              <button key={day}
                onClick={() => {
                  if (moveSource) {
                    const due = new Date(moveSource.dueAt);
                    due.setFullYear(month.y, month.m, day);
                    onMove(moveSource.id, due.toISOString());
                  } else if (list.length || isToday) {
                    onSelectDay(isSelected ? null : day);
                  }
                }}
                className={cn("relative aspect-square rounded-xl text-xs font-medium transition-all",
                  isSelected ? "bg-fuchsia-500/25 border border-fuchsia-500/50 text-white"
                    : isToday ? "bg-white/10 text-white border border-white/20"
                    : list.length ? "bg-white/[0.04] text-white/80 border border-white/10 hover:bg-white/[0.08]"
                    : isMoveTarget ? "text-white/70 bg-white/[0.03] border border-dashed border-cyan-500/40 hover:bg-cyan-500/10"
                    : "text-white/40 hover:bg-white/[0.06]")}
                aria-label={`${day} ${first.toLocaleDateString("en-IN", { month: "long" })}, ${list.length} reminder${list.length === 1 ? "" : "s"}`}
              >
                {day}
                {list.length > 0 && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">{list.slice(0, 3).map((r) => <span key={r.id} className="h-1 w-1 rounded-full" style={{ background: TYPE_META[r.type].color }} />)}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDay !== null && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">
              {new Date(month.y, month.m, selectedDay).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
            </h3>
            <button className="text-[10px] text-white/40 hover:text-white" onClick={() => onSelectDay(null)}>Close</button>
          </div>
          {dayReminders.length === 0 ? (
            <p className="text-xs text-white/40 sr-glass rounded-xl p-4">No reminders on this day.</p>
          ) : (
            <div className="space-y-2">
              {dayReminders.map((r) => (
                <div key={r.id} className="sr-glass rounded-xl p-3 flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: TYPE_META[r.type].color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{r.title}</p>
                    <p className="text-[11px] text-white/40">{new Date(r.dueAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</p>
                  </div>
                  <button onClick={() => { onMoveReminder(moveReminderId === r.id ? null : r.id); }} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/60 hover:text-white transition-colors">
                    {moveReminderId === r.id ? "Cancel move" : "Move"}
                  </button>
                  <button onClick={() => onOpen(r)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/60 hover:text-white transition-colors">Open</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Templates panel
// ============================================================================

function TemplatesPanel({ scholarClass }: { scholarClass: 9 | 11 }) {
  const profile = useReminderProfile(scholarClass);
  const store = useReminderStore;
  const [creating, setCreating] = useState(false);
  const [tplName, setTplName] = useState("");
  const templates = profile.templates;

  const apply = (t: ReminderTemplate) => {
    const reminder = store.getState().applyTemplate(scholarClass, t.id);
    if (reminder) toast.success(`Applied “${t.name}”`, { description: dueLabel(reminder) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-white/50">Reusable routines for your day. Apply one to create a reminder instantly.</p>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/40 px-3 py-1.5 text-xs font-medium text-fuchsia-200 hover:bg-fuchsia-500/30 transition-colors">
          <Plus className="h-3.5 w-3.5" /> New Template
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <div key={t.id} className={cn("sr-glass rounded-2xl p-4", t.pinned && "border-fuchsia-400/40")}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-2xl">{t.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate flex items-center gap-1.5">
                    {t.name} {t.pinned && <PinIcon />}
                  </p>
                  {t.description && <p className="text-[10px] text-white/45 mt-0.5 line-clamp-1">{t.description}</p>}
                </div>
              </div>
              {t.builtIn && <Badge variant="outline" className="text-[9px] border-white/15 text-white/45 shrink-0">Default</Badge>}
            </div>
            <div className="mt-2 flex items-center gap-2 text-[10px] text-white/45 flex-wrap">
              <span>{TYPE_META[t.type].label}</span>
              <span>·</span>
              <span>{t.dueTime}</span>
              {t.recurrence && <span className="flex items-center gap-0.5"><Repeat className="h-2.5 w-2.5" />{recurrenceLabel(t.recurrence)}</span>}
            </div>
            <div className="mt-3 flex items-center gap-1.5 flex-wrap">
              <button onClick={() => apply(t)} className="flex-1 rounded-lg bg-fuchsia-500/20 border border-fuchsia-500/40 px-2 py-1.5 text-[11px] font-medium text-fuchsia-200 hover:bg-fuchsia-500/30 transition-colors">
                <Play className="h-2.5 w-2.5 inline mr-0.5 -mt-0.5" /> Apply
              </button>
              <button onClick={() => store.getState().pinTemplate(scholarClass, t.id, !t.pinned)} className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/50 hover:text-white transition-colors" aria-label={t.pinned ? "Unpin template" : "Pin template"}>
                <PinIcon filled={t.pinned} />
              </button>
              <button onClick={() => store.getState().duplicateTemplate(scholarClass, t.id) && toast.success("Template duplicated")} className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/50 hover:text-white transition-colors" aria-label="Duplicate template">
                <Copy className="h-3 w-3" />
              </button>
              {!t.builtIn && (
                <button onClick={() => { store.getState().removeTemplate(scholarClass, t.id); toast.success("Template deleted"); }} className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-1.5 text-rose-300/70 hover:text-rose-300 transition-colors" aria-label="Delete template">
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sr-glass-strong !bg-black/60 !border-white/20 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Create a template</DialogTitle>
            <DialogDescription className="text-white/70">Give your routine a name — you can apply it anytime.</DialogDescription>
          </DialogHeader>
          <Input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="e.g. Sunday Revision" className="bg-white/5 border-white/15 text-white" />
          <DialogFooter className="mt-4">
            <Button variant="ghost" className="text-white/70" onClick={() => setCreating(false)}>Cancel</Button>
            <Button className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white" disabled={!tplName.trim()} onClick={() => {
              store.getState().createTemplate(scholarClass, {
                name: tplName, type: "general", priority: "medium", dueTime: "18:00", icon: "📌", tags: [], dueOffsetDays: 0,
              });
              setTplName(""); setCreating(false);
              toast.success("Template created");
            }}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PinIcon({ filled }: { filled?: boolean }) {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M12 17v5M5 17h14v-3l-2-2V7h2V4H5v3h2v5l-2 2v3z" /></svg>;
}

// ============================================================================
// Activity panel
// ============================================================================

const ACTIVITY_META: Record<ReminderActivityEntry["kind"], { label: string; icon: any; color: string }> = {
  created: { label: "Created", icon: Plus, color: "#10b981" },
  edited: { label: "Edited", icon: Pencil, color: "#3b82f6" },
  spoken: { label: "Spoken", icon: Volume2, color: "#06b6d4" },
  triggered: { label: "Triggered", icon: AlarmClock, color: "#f59e0b" },
  snoozed: { label: "Snoozed", icon: Clock, color: "#f59e0b" },
  completed: { label: "Completed", icon: CheckCircle2, color: "#10b981" },
  missed: { label: "Missed", icon: AlertTriangle, color: "#f43f5e" },
  rescheduled: { label: "Rescheduled", icon: Calendar, color: "#6366f1" },
  "lam-created": { label: "Created via LAM", icon: Bot, color: "#22d3ee" },
  "fica-created": { label: "FICA automation", icon: Zap, color: "#a855f7" },
  restored: { label: "Restored", icon: RefreshCw, color: "#14b8a6" },
  deleted: { label: "Deleted", icon: Trash2, color: "#f43f5e" },
  "template-applied": { label: "Template", icon: Copy, color: "#d946ef" },
  "series-created": { label: "Series", icon: CalendarDays, color: "#d946ef" },
  "talk-changed": { label: "Voice changed", icon: Volume2, color: "#06b6d4" },
};

function ActivityPanel({ scholarClass, filter, onFilter }: { scholarClass: 9 | 11; filter: string; onFilter: (f: any) => void }) {
  const profile = useReminderProfile(scholarClass);
  const store = useReminderStore;
  const filtered = profile.activity.filter((a) => {
    if (filter === "all") return true;
    if (filter === "lam") return a.actor === "lam";
    if (filter === "manual") return a.actor === "manual";
    if (filter === "automatic") return a.actor === "automatic" || a.kind === "triggered" || a.kind === "missed";
    if (filter === "spoken") return a.kind === "spoken";
    if (filter === "missed") return a.kind === "missed";
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 flex-wrap">
        {(["all", "lam", "manual", "automatic", "spoken", "missed"] as const).map((f) => (
          <button key={f} onClick={() => onFilter(f)}
            className={cn("px-3 py-1 rounded-full text-[11px] font-medium transition-all", filter === f ? "bg-white/20 text-white" : "bg-white/5 text-white/50 hover:bg-white/10")}>
            {f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
        <button onClick={() => store.getState().clearActivity(scholarClass)} className="ml-auto text-[10px] text-white/40 hover:text-white/70">Clear log</button>
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon={History} title="No activity yet" description="Reminder events — created, spoken, snoozed, completed, missed — will appear here." />
      ) : (
        <div className="space-y-1.5">
          {filtered.slice(0, 80).map((a) => {
            const meta = ACTIVITY_META[a.kind];
            const Icon = meta.icon;
            return (
              <div key={a.id} className="sr-glass rounded-xl p-3 flex items-start gap-3">
                <div className="grid place-items-center h-8 w-8 rounded-lg shrink-0" style={{ background: `${meta.color}1e`, color: meta.color }}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white">{meta.label}{a.reminderTitle ? ` · ${a.reminderTitle}` : ""}</p>
                  {a.detail && <p className="text-[10px] text-white/45 mt-0.5">{a.detail}</p>}
                  <p className="text-[10px] text-white/35 mt-0.5">{new Date(a.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</p>
                </div>
                <Badge variant="outline" className="text-[9px] border-white/15 text-white/45 shrink-0">{a.actor}</Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Quick preview dialog
// ============================================================================

function QuickPreviewDialog({ parsed, onCancel, onEdit, onConfirm }: {
  parsed: ReturnType<typeof parseQuickCommand> | null;
  onCancel: () => void;
  onEdit: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={!!parsed} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sr-glass-strong !bg-black/60 !border-white/20 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2"><Sparkles className="h-5 w-5 text-fuchsia-300" /> Create this reminder?</DialogTitle>
          <DialogDescription className="text-white/70">Scholar's interpretation of your command. Confirm or edit before saving.</DialogDescription>
        </DialogHeader>
        {parsed && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-lg font-semibold text-white">{parsed.title}</p>
              <div className="mt-2 space-y-1 text-sm text-white/70">
                <p>📅 {parsed.dueAt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · {parsed.dueAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</p>
                {parsed.subject && <p>📚 Subject: {parsed.subject}</p>}
                {parsed.chapter && <p>📖 Chapter: {parsed.chapter}</p>}
                <p>🎯 Type: {TYPE_META[parsed.type].label} · Priority: {PRIORITY_META[parsed.priority].label}</p>
                {parsed.recurrence && <p>🔁 {recurrenceLabel(parsed.recurrence)}</p>}
                {parsed.recurrenceCount && <p>🔁 {parsed.recurrenceCount} occurrences</p>}
                {parsed.durationMin && <p>⏱ {parsed.durationMin} minutes</p>}
                {parsed.preAlertMinutes && <p>🔔 Notification {parsed.preAlertMinutes} minutes before</p>}
              </div>
            </div>
            {parsed.ambiguity.length > 0 && (
              <div className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-xs text-amber-100">
                <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Scholar wasn't fully sure</p>
                <ul className="mt-1 space-y-0.5 list-disc list-inside text-amber-100/80">{parsed.ambiguity.map((a, i) => <li key={i}>{a}</li>)}</ul>
              </div>
            )}
          </div>
        )}
        <DialogFooter className="mt-4 flex gap-2">
          <Button variant="ghost" className="text-white/70" onClick={onCancel}>Cancel</Button>
          <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={onEdit}>Edit</Button>
          <Button className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white" onClick={onConfirm}><Check className="h-4 w-4 mr-1.5" />Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Editor dialog
// ============================================================================

function ReminderEditorDialog({ scholarClass, open, onOpenChange, editing, curriculum, onCreated, onSeriesDraft }: {
  scholarClass: 9 | 11;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: SmartReminder | null;
  curriculum: Array<{ id: string; name: string; icon: string; chapters: Array<{ id: string; title: string }> }>;
  onCreated: (reminder: SmartReminder) => void;
  onSeriesDraft: (draft: SeriesDraft) => void;
}) {
  const profile = useReminderProfile(scholarClass);
  const store = useReminderStore;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ReminderType>("general");
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [priority, setPriority] = useState<ReminderPriority>("medium");
  const [dateValue, setDateValue] = useState("");
  const [timeValue, setTimeValue] = useState("18:00");
  const [allDay, setAllDay] = useState(false);
  const [durationMin, setDurationMin] = useState(25);
  const [tags, setTags] = useState("");
  const [recurrenceFreq, setRecurrenceFreq] = useState<"none" | "daily" | "weekdays" | "weekly" | "monthly" | "custom">("none");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [intervalVal, setIntervalVal] = useState(1);
  const [repeatCount, setRepeatCount] = useState("");
  const [preAlert, setPreAlert] = useState(profile.settings.defaultPreAlertMinutes);
  const [extraAlerts, setExtraAlerts] = useState<number[]>([]);
  const [talkEnabled, setTalkEnabled] = useState(profile.settings.defaultTalkEnabled);
  const [important, setImportant] = useState(false);
  const [allowSmartReschedule, setAllowSmartReschedule] = useState(true);
  const [requireConfirmation, setRequireConfirmation] = useState(false);
  const [autoStartFocus, setAutoStartFocus] = useState(false);
  const [openView, setOpenView] = useState("");
  const [checklistText, setChecklistText] = useState("");
  const [followUpMinutes, setFollowUpMinutes] = useState("");
  const [linkedKind, setLinkedKind] = useState<"none" | "chapter" | "exam">("none");
  const [examDate, setExamDate] = useState("");
  const [conflicts, setConflicts] = useState<ReturnType<typeof detectConflicts>>([]);

  // Reset when opened
  useEffect(() => {
    if (!open) return;
    const base = editing;
    setTitle(base?.title ?? "");
    setDescription(base?.description ?? "");
    setType(base?.type ?? "general");
    setSubject(base?.subject ?? "");
    setChapter(base?.chapter ?? "");
    setPriority(base?.priority ?? "medium");
    const due = base ? new Date(base.dueAt) : new Date();
    if (base?.allDay) { setDateValue(due.toISOString().slice(0, 10)); setTimeValue("18:00"); } else {
      setDateValue(due.toISOString().slice(0, 10));
      setTimeValue(`${String(due.getHours()).padStart(2, "0")}:${String(due.getMinutes()).padStart(2, "0")}`);
    }
    setAllDay(base?.allDay ?? false);
    setDurationMin(base?.durationMin ?? profile.settings.defaultDurationMin ?? 25);
    setTags((base?.tags ?? []).join(", "));
    setRecurrenceFreq(base?.recurrence?.frequency ?? "none");
    setWeekdays(base?.recurrence?.weekdays ?? []);
    setIntervalVal(base?.recurrence?.interval ?? 1);
    setRepeatCount(base?.recurrenceCount ? String(base.recurrenceCount) : "");
    setPreAlert(base?.alerts?.length ? Math.min(...base.alerts.map((a) => a.offsetMinutes)) : profile.settings.defaultPreAlertMinutes);
    setExtraAlerts(base?.alerts?.map((a) => a.offsetMinutes).filter((m) => m > 0 && m !== (base?.alerts?.length ? Math.min(...base.alerts.map((x) => x.offsetMinutes)) : 0)) ?? []);
    setTalkEnabled(base?.talkEnabled ?? profile.settings.defaultTalkEnabled);
    setImportant(base?.important ?? false);
    setAllowSmartReschedule(base?.allowSmartReschedule ?? true);
    setRequireConfirmation(base?.requireCompletionConfirmation ?? false);
    setAutoStartFocus(base?.autoStartFocus ?? false);
    setOpenView(base?.openViewOnStart ?? "");
    setChecklistText((base?.checklist ?? []).map((c) => c.text).join("\n"));
    setFollowUpMinutes(base?.followUpReminderMinutes ? String(base.followUpReminderMinutes) : "");
    setLinkedKind(base?.linkedEntity?.kind === "chapter" ? "chapter" : base?.linkedEntity?.kind === "exam" ? "exam" : "none");
    setConflicts([]);
  }, [open, editing]);

  const subjects = curriculum;
  const chapters = subjects.find((s) => s.id === subject)?.chapters ?? [];

  const currentDue = useMemo(() => {
    const d = new Date();
    if (dateValue) {
      const [y, m, day] = dateValue.split("-").map(Number);
      if (y && m && day) d.setFullYear(y, m - 1, day);
    }
    const time = parseHHMM(timeValue);
    if (time && !allDay) d.setHours(time.hour, time.minute, 0, 0);
    return d;
  }, [dateValue, timeValue, allDay]);

  const canSave = title.trim().length > 0 && dateValue.length > 0;

  const buildAlerts = (): SmartReminder["alerts"] => {
    const set = new Set<number>([0]);
    if (preAlert > 0) set.add(preAlert);
    extraAlerts.forEach((a) => set.add(a));
    return [...set].sort((a, b) => a - b).map((offset) => ({
      id: `al-${uid()}`,
      offsetMinutes: offset,
      label: offset === 0 ? "At due time" : `${offset} minutes before`,
    }));
  };

  const save = () => {
    if (!canSave) { toast.error("Give the reminder a title and a date."); return; }
    const recurrence = recurrenceFreq === "none" ? undefined : recurrenceFreq === "weekdays"
      ? { frequency: "weekdays" as const, interval: intervalVal }
      : recurrenceFreq === "weekly"
        ? { frequency: "weekly" as const, interval: intervalVal, weekdays: weekdays.length ? weekdays : [currentDue.getDay()] }
        : recurrenceFreq === "monthly"
          ? { frequency: "monthly" as const, interval: intervalVal, dayOfMonth: currentDue.getDate() }
          : recurrenceFreq === "custom"
            ? { frequency: "custom" as const, interval: intervalVal, customDays: intervalVal }
            : { frequency: "daily" as const, interval: intervalVal };
    const checklist = checklistText.split("\n").map((t) => t.trim()).filter(Boolean).map((text) => ({ id: uid(), text, done: false }));
    const draft = {
      id: editing?.id ?? "new",
      title: title.trim(),
      dueAt: currentDue.toISOString(),
      durationMin,
      priority,
      type,
    };
    const newConflicts = detectConflicts(draft, editing ? profile.reminders.filter((r) => r.id !== editing.id) : profile.reminders, profile.settings, new Date());
    setConflicts(newConflicts);

    const payload: Partial<SmartReminder> & { title: string } = {
      title: title.trim(),
      description: description.trim() || undefined,
      type,
      subject: subject || undefined,
      chapter: chapter || undefined,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      priority,
      dueAt: currentDue.toISOString(),
      allDay,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "local",
      durationMin,
      recurrence,
      recurrenceCount: repeatCount ? Math.max(2, Number(repeatCount)) : undefined,
      alerts: buildAlerts(),
      talkEnabled,
      speechRate: 1, speechPitch: 1, speechVolume: 1,
      spokenContentMode: "title",
      speakDetails: profile.settings.speakReminderDetails,
      checklist,
      linkedEntity: linkedKind === "chapter" && chapter ? { kind: "chapter", id: chapter, label: chapters.find((c) => c.id === chapter)?.title ?? chapter, view: "chapter-command" }
        : linkedKind === "exam" && subject ? { kind: "exam", id: `exam-${uid()}`, label: `${subject} exam`, view: "exam-prep" }
        : undefined,
      openViewOnStart: openView || undefined,
      autoStartFocus,
      important,
      allowSmartReschedule,
      requireCompletionConfirmation: requireConfirmation,
      followUpReminderMinutes: followUpMinutes ? Number(followUpMinutes) : undefined,
    };

    if (editing) {
      const updated = store.getState().updateReminder(scholarClass, editing.id, payload, { activityActor: "manual" });
      if (updated) { toast.success("Reminder updated"); onOpenChange(false); }
    } else {
      const reminder = store.getState().createReminder(scholarClass, payload, { source: "manual" });
      toast.success(`Reminder created · +2 XP`, { description: dueLabel(reminder) });
      onOpenChange(false);
      onCreated(reminder);
    }
  };

  const generateSeries = () => {
    if (!examDate || !subject) { toast.error("Pick a subject and an exam date first."); return; }
    const examTitle = `${subject[0].toUpperCase() + subject.slice(1)} exam`;
    const items = buildRevisionSeries({
      examTitle,
      examDate: new Date(examDate + "T09:00:00"),
      subject,
      chapters: chapters.slice(0, 6).map((c) => c.title),
    });
    onSeriesDraft({
      examTitle,
      examDate: new Date(examDate + "T09:00:00").toISOString(),
      subject,
      chapters: chapters.slice(0, 6).map((c) => c.title),
      items,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sr-glass-strong !bg-black/60 !border-white/20 max-w-2xl max-h-[90vh] overflow-y-auto sr-scroll">
        <DialogHeader>
          <DialogTitle className="sr-font-serif text-2xl text-white">{editing ? "Edit reminder" : "New reminder"}</DialogTitle>
          <DialogDescription className="text-white/70">Set the basics, scheduling, alerts and options. Conflicts are checked automatically.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Basic info */}
          <section className="space-y-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Basic information</h4>
            <div>
              <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Revise Laws of Motion" className="bg-white/5 border-white/15 text-white" />
            </div>
            <div>
              <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What should this nudge you about?" className="bg-white/5 border-white/15 text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Type</Label>
                <select value={type} onChange={(e) => setType(e.target.value as ReminderType)} className="w-full p-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm">
                  {REMINDER_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Priority</Label>
                <select value={priority} onChange={(e) => setPriority(e.target.value as ReminderPriority)} className="w-full p-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm">
                  {(["low", "medium", "high", "critical"] as const).map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Subject</Label>
                <select value={subject} onChange={(e) => { setSubject(e.target.value); setChapter(""); }} className="w-full p-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm">
                  <option value="">— None —</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Chapter</Label>
                <select value={chapter} onChange={(e) => setChapter(e.target.value)} disabled={!subject} className="w-full p-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm disabled:opacity-40">
                  <option value="">— None —</option>
                  {chapters.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Tags (comma separated)</Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="exam, physics, revision" className="bg-white/5 border-white/15 text-white" />
            </div>
          </section>

          {/* Scheduling */}
          <section className="space-y-3 border-t border-white/10 pt-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Scheduling</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Date</Label>
                <Input type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} className="bg-white/5 border-white/15 text-white" />
              </div>
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Time</Label>
                <Input type="time" value={timeValue} onChange={(e) => setTimeValue(e.target.value)} disabled={allDay} className="bg-white/5 border-white/15 text-white disabled:opacity-40" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={allDay} onCheckedChange={setAllDay} aria-label="All day" />
              <span className="text-xs text-white/60">All day</span>
              <span className="ml-4 flex items-center gap-2">
                <Label className="text-white/60 text-xs">Duration (min)</Label>
                <Input type="number" min={5} max={600} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} className="w-20 bg-white/5 border-white/15 text-white" />
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Repeat</Label>
                <select value={recurrenceFreq} onChange={(e) => setRecurrenceFreq(e.target.value as any)} className="w-full p-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm">
                  <option value="none">Does not repeat</option>
                  <option value="daily">Every day</option>
                  <option value="weekdays">Every weekday</option>
                  <option value="weekly">Weekly (choose days)</option>
                  <option value="monthly">Monthly</option>
                  <option value="custom">Every N days</option>
                </select>
              </div>
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Repeat count (optional)</Label>
                <Input type="number" min={2} max={60} value={repeatCount} onChange={(e) => setRepeatCount(e.target.value)} placeholder="e.g. 3 times" className="bg-white/5 border-white/15 text-white" />
              </div>
            </div>
            {(recurrenceFreq === "weekly") && (
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Days of week</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {dayNamesShort.map((d, i) => (
                    <button key={d} onClick={() => setWeekdays((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i])}
                      className={cn("h-9 w-9 rounded-xl text-xs font-medium border transition-all", weekdays.includes(i) ? "bg-fuchsia-500/30 border-fuchsia-500/60 text-white" : "bg-white/5 border-white/10 text-white/50 hover:text-white")}>
                      {d[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {recurrenceFreq === "custom" && (
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Every N days</Label>
                <Input type="number" min={2} max={90} value={intervalVal} onChange={(e) => setIntervalVal(Number(e.target.value))} className="w-24 bg-white/5 border-white/15 text-white" />
              </div>
            )}
          </section>

          {/* Alerts */}
          <section className="space-y-3 border-t border-white/10 pt-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Multiple alerts</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Main pre-alert</Label>
                <select value={preAlert} onChange={(e) => setPreAlert(Number(e.target.value))} className="w-full p-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm">
                  {[0, 5, 10, 30, 60, 180, 1440].map((m) => <option key={m} value={m}>{m === 0 ? "At due time" : m === 60 ? "1 hour before" : m === 180 ? "3 hours before" : m === 1440 ? "1 day before" : `${m} minutes before`}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Extra alerts</Label>
                <select value="" onChange={(e) => { const v = Number(e.target.value); if (v) { setExtraAlerts((prev) => prev.includes(v) ? prev : [...prev, v]); } }} className="w-full p-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm">
                  <option value="">Add another…</option>
                  {[5, 10, 30, 60, 180, 1440].filter((m) => !extraAlerts.includes(m)).map((m) => <option key={m} value={m}>{m === 60 ? "1 hour before" : m === 180 ? "3 hours before" : m === 1440 ? "1 day before" : `${m} minutes before`}</option>)}
                </select>
                {extraAlerts.length > 0 && (
                  <div className="mt-2 flex gap-1.5 flex-wrap">
                    {extraAlerts.map((m) => (
                      <button key={m} onClick={() => setExtraAlerts((prev) => prev.filter((x) => x !== m))} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/70 hover:text-white">
                        {m === 60 ? "1h" : m === 180 ? "3h" : m === 1440 ? "1d" : `${m}m`} ×
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Options */}
          <section className="space-y-2.5 border-t border-white/10 pt-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Options</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
              <ToggleRow label="Talk Reminder" desc="Speak the reminder aloud when due" checked={talkEnabled} onChange={setTalkEnabled} />
              <ToggleRow label="Mark as important" desc="Skip quiet hours for this one" checked={important} onChange={setImportant} />
              <ToggleRow label="Smart rescheduling" desc="Scholar may suggest new times" checked={allowSmartReschedule} onChange={setAllowSmartReschedule} />
              <ToggleRow label="Completion confirmation" desc="Ask before marking done" checked={requireConfirmation} onChange={setRequireConfirmation} />
              <ToggleRow label="Auto-start Focus Mode" desc="Open a focus session when it fires" checked={autoStartFocus} onChange={setAutoStartFocus} />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Open this Scholar section on start</Label>
                <select value={openView} onChange={(e) => setOpenView(e.target.value)} className="w-full p-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm">
                  <option value="">— None —</option>
                  {OPEN_VIEW_OPTIONS.map((o) => <option key={o.view} value={o.view}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Follow-up reminder (minutes)</Label>
                <Input type="number" min={5} max={1440} value={followUpMinutes} onChange={(e) => setFollowUpMinutes(e.target.value)} placeholder="e.g. 15" className="bg-white/5 border-white/15 text-white" />
              </div>
            </div>
            <div>
              <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Checklist (one item per line)</Label>
              <Textarea value={checklistText} onChange={(e) => setChecklistText(e.target.value)} rows={2} placeholder={"Read notes\nSolve 10 problems\nFormula recall"} className="bg-white/5 border-white/15 text-white" />
            </div>
            <div>
              <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Link to Scholar</Label>
              <select value={linkedKind} onChange={(e) => setLinkedKind(e.target.value as any)} className="w-full p-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm">
                <option value="none">No link</option>
                <option value="chapter">Chapter (opens Chapter Command Center)</option>
                <option value="exam">Exam (opens Exam Prep)</option>
              </select>
            </div>
          </section>

          {/* Exam revision series */}
          {type === "exam" && (
            <section className="space-y-3 border-t border-white/10 pt-4">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-fuchsia-300">Exam revision series</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Exam date</Label>
                  <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="bg-white/5 border-white/15 text-white" />
                </div>
                <div className="flex items-end">
                  <Button variant="outline" className="w-full border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200 hover:bg-fuchsia-500/20" disabled={!examDate || !subject} onClick={generateSeries}>
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Generate series
                  </Button>
                </div>
              </div>
              <p className="text-[10px] text-white/40">Scholar builds a spaced revision sequence from your chapters up to the exam — every session is editable before it's saved.</p>
            </section>
          )}
        </div>

        {/* Conflicts */}
        {conflicts.length > 0 && (
          <div className="space-y-2">
            {conflicts.map((c, i) => (
              <div key={i} className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-3">
                <p className="text-xs text-amber-100 flex items-start gap-1.5"><AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{c.message}</p>
                {c.suggestions.length > 0 && (
                  <div className="mt-1.5 flex gap-1.5 flex-wrap">
                    {c.suggestions.map((s) => (
                      <button key={s} onClick={() => { const time = parseHHMM(s); if (time && /^\d/.test(s)) { setTimeValue(`${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`); } else if (/\btomorrow\b/i.test(s)) { const d = new Date(); d.setDate(d.getDate() + 1); setDateValue(d.toISOString().slice(0, 10)); } }} className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[10px] text-amber-100 hover:bg-amber-300/20 transition-colors">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="ghost" className="text-white/70" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white" onClick={save}>
            {editing ? <><Check className="h-4 w-4 mr-1.5" />Save changes</> : <><Plus className="h-4 w-4 mr-1.5" />Create (+2 XP)</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-white/80">{label}</p>
        <p className="text-[10px] text-white/40">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} className="shrink-0" />
    </div>
  );
}

// ============================================================================
// Talk Reminder editor
// ============================================================================

function TalkEditorDialog({ reminder, scholarClass, onClose, onPreview }: {
  reminder: SmartReminder;
  scholarClass: 9 | 11;
  onClose: () => void;
  onPreview: (r: Partial<SmartReminder>) => void;
}) {
  const profile = useReminderProfile(scholarClass);
  const store = useReminderStore;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [enabled, setEnabled] = useState(reminder.talkEnabled);
  const [voiceURI, setVoiceURI] = useState(reminder.voiceURI ?? profile.settings.talkVoiceURI ?? "");
  const [language, setLanguage] = useState(reminder.voiceLanguage ?? profile.settings.talkVoiceLanguage ?? "en-GB");
  const [rate, setRate] = useState(reminder.speechRate ?? 1);
  const [pitch, setPitch] = useState(reminder.speechPitch ?? 1);
  const [volume, setVolume] = useState(reminder.speechVolume ?? 1);
  const [mode, setMode] = useState<SmartReminder["spokenContentMode"]>(reminder.spokenContentMode ?? "title");
  const [customMessage, setCustomMessage] = useState(reminder.customSpokenMessage ?? "");
  const [speakDetails, setSpeakDetails] = useState(reminder.speakDetails ?? profile.settings.speakReminderDetails);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const refresh = () => setVoices(window.speechSynthesis.getVoices());
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, []);

  const suggested = selectTalkVoice(voiceURI, language);
  const selectedLabel = describeVoice(suggested);

  const save = () => {
    store.getState().updateReminder(scholarClass, reminder.id, {
      talkEnabled: enabled,
      voiceURI: voiceURI || undefined,
      voiceLanguage: language,
      speechRate: rate,
      speechPitch: pitch,
      speechVolume: volume,
      spokenContentMode: mode,
      customSpokenMessage: mode === "custom" ? customMessage.trim() : undefined,
      speakDetails,
    }, { activityActor: "manual", detail: "Talk Reminder settings updated" });
    store.getState().updateSettings(scholarClass, { talkVoiceURI: voiceURI || undefined, talkVoiceLanguage: language });
    toast.success("Talk Reminder saved");
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sr-glass-strong !bg-black/60 !border-white/20 max-w-lg max-h-[90vh] overflow-y-auto sr-scroll">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2"><Volume2 className="h-5 w-5 text-cyan-300" /> Talk Reminder</DialogTitle>
          <DialogDescription className="text-white/70">Scholar speaks “{reminder.title}” aloud when it becomes due.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Enabled</p>
              <p className="text-xs text-white/45">Speak this reminder aloud</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Enable Talk Reminder" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Language</Label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full p-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm">
                <option value="en-GB">English (UK)</option>
                <option value="en-IN">English (India)</option>
                <option value="en-US">English (US)</option>
              </select>
            </div>
            <div>
              <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Voice</Label>
              <select value={voiceURI} onChange={(e) => setVoiceURI(e.target.value)} className="w-full p-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm">
                <option value="">Auto (prefers female UK)</option>
                {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
              </select>
            </div>
          </div>
          <p className="text-[10px] text-white/40">Default: Microsoft female English (UK) → any female UK voice → any UK voice → system default.</p>

          <div className="space-y-2">
            {([
              ["Speech rate", rate, (v: number) => setRate(v), 0.5, 1.8, "×"],
              ["Pitch", pitch, (v: number) => setPitch(v), 0.5, 1.6, ""],
              ["Volume", volume, (v: number) => setVolume(v), 0, 1, "%"],
            ] as const).map(([label, value, setter, min, max, suffix]) => (
              <div key={label}>
                <div className="flex justify-between text-xs text-white/70"><span>{label}</span><span>{suffix === "%" ? Math.round(value * 100) + "%" : suffix === "×" ? value.toFixed(1) + suffix : value.toFixed(1)}</span></div>
                <input type="range" min={min} max={max} step={0.05} value={value} onChange={(e) => setter(Number(e.target.value))} className="w-full accent-cyan-400" aria-label={label} />
              </div>
            ))}
          </div>

          <div>
            <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Spoken content</Label>
            <select value={mode} onChange={(e) => setMode(e.target.value as SmartReminder["spokenContentMode"])} className="w-full p-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm">
              <option value="title">Title only</option>
              <option value="title-time">Title and time</option>
              <option value="title-description">Title and description</option>
              <option value="custom">Custom message</option>
            </select>
            {mode === "custom" && (
              <Input value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} placeholder="e.g. Reminder. Your Physics revision session starts now." className="mt-2 bg-white/5 border-white/15 text-white" />
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <p className="text-xs font-semibold text-white">Speak reminder details aloud</p>
                <p className="text-[10px] text-white/45 mt-0.5">When off, Scholar only says “You have a Scholar reminder.” for privacy.</p>
              </div>
              <Switch checked={speakDetails} onCheckedChange={setSpeakDetails} aria-label="Speak reminder details" />
            </div>
          </div>

          <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] p-3 text-xs text-cyan-100/80">
            Voice preview: <span className="text-cyan-100">{selectedLabel}</span>
          </div>
        </div>
        <DialogFooter className="mt-4 flex gap-2">
          <Button variant="ghost" className="text-white/70" onClick={() => stopTalkSpeech()}>
            <Square className="h-3.5 w-3.5 mr-1.5" /> Stop
          </Button>
          <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => onPreview({ title: reminder.title, dueAt: reminder.dueAt, speechRate: rate, speechPitch: pitch, speechVolume: volume, spokenContentMode: mode, customSpokenMessage: customMessage, speakDetails })}>
            <Play className="h-3.5 w-3.5 mr-1.5" /> Preview voice
          </Button>
          <Button className="bg-cyan-500 hover:bg-cyan-600 text-white" onClick={save}><Check className="h-4 w-4 mr-1.5" />Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Snooze + reschedule dialogs
// ============================================================================

function SnoozeDialog({ reminder, scholarClass, onClose, onReschedule }: {
  reminder: SmartReminder;
  scholarClass: 9 | 11;
  onClose: () => void;
  onReschedule: () => void;
}) {
  const store = useReminderStore;
  const options = [
    { label: "5 minutes", minutes: 5 },
    { label: "10 minutes", minutes: 10 },
    { label: "30 minutes", minutes: 30 },
    { label: "1 hour", minutes: 60 },
    { label: "Tonight", minutes: "tonight" },
    { label: "Tomorrow", minutes: "tomorrow" },
  ] as const;
  const snooze = (option: typeof options[number]) => {
    let until: Date;
    if (option.minutes === "tonight") { until = new Date(); until.setHours(20, 0, 0, 0); }
    else if (option.minutes === "tomorrow") { until = new Date(); until.setDate(until.getDate() + 1); until.setHours(9, 0, 0, 0); }
    else until = new Date(Date.now() + option.minutes * 60_000);
    store.getState().snoozeReminder(scholarClass, reminder.id, until.toISOString());
    toast.success(`Snoozed until ${until.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sr-glass-strong !bg-black/60 !border-white/20 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Snooze “{reminder.title}”</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {options.map((o) => (
            <button key={o.label} onClick={() => snooze(o)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-white/80 hover:bg-white/10 hover:text-white transition-colors">
              {o.label}
            </button>
          ))}
          <button onClick={onReschedule} className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-2.5 text-xs text-cyan-200 hover:bg-cyan-500/20 transition-colors col-span-2">
            Smart reschedule
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RescheduleDialog({ reminder, scholarClass, onClose }: { reminder: SmartReminder; scholarClass: 9 | 11; onClose: () => void }) {
  const profile = useReminderProfile(scholarClass);
  const store = useReminderStore;
  const [selected, setSelected] = useState<number>(0);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("18:00");
  const suggestions = useMemo(() => {
    const exams = profile.reminders.filter((r) => r.type === "exam");
    return smartRescheduleOptions(reminder, exams);
  }, [reminder, profile.reminders]);

  const apply = () => {
    if (customDate) {
      const due = new Date(customDate + "T" + customTime);
      store.getState().rescheduleReminder(scholarClass, reminder.id, due.toISOString(), { actor: "manual" });
      toast.success("Reminder rescheduled");
      onClose();
      return;
    }
    const suggestion = suggestions[selected];
    if (suggestion) {
      store.getState().rescheduleReminder(scholarClass, reminder.id, suggestion.dueAt.toISOString(), { actor: "manual", detail: suggestion.reason });
      toast.success(`Moved to ${formatSuggestion(suggestion)}`);
      onClose();
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sr-glass-strong !bg-black/60 !border-white/20 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2"><Calendar className="h-5 w-5 text-cyan-300" /> Smart reschedule</DialogTitle>
          <DialogDescription className="text-white/70">You missed “{reminder.title}”. Scholar suggests:</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => setSelected(i)}
              className={cn("w-full text-left rounded-xl border p-3 transition-all", selected === i ? "border-cyan-400/50 bg-cyan-400/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]")}>
              <p className="text-sm font-semibold text-white">{formatSuggestion(s)}</p>
              <p className="text-[11px] text-white/45 mt-0.5">Reason: {s.reason}</p>
            </button>
          ))}
          <div className="pt-1 flex items-center gap-2">
            <Input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} className="flex-1 bg-white/5 border-white/15 text-white" aria-label="Custom date" />
            <Input type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} className="flex-1 bg-white/5 border-white/15 text-white" aria-label="Custom time" />
          </div>
        </div>
        <DialogFooter className="mt-4 flex gap-2">
          <Button variant="ghost" className="text-white/70" onClick={onClose}>Keep overdue</Button>
          <Button className="bg-cyan-500 hover:bg-cyan-600 text-white" onClick={apply}><Check className="h-4 w-4 mr-1.5" />Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Series preview dialog
// ============================================================================

function SeriesPreviewDialog({ draft, scholarClass, onClose, onConfirm }: {
  draft: SeriesDraft;
  scholarClass: 9 | 11;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [items, setItems] = useState(draft.items);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTime, setEditTime] = useState("18:00");
  const [editDate, setEditDate] = useState("");

  const saveItem = () => {
    if (editingIndex === null) return;
    setItems((prev) => prev.map((item, i) => i === editingIndex ? {
      ...item,
      title: editTitle || item.title,
      dueAt: new Date((editDate || item.dueAt.toISOString().slice(0, 10)) + "T" + (editTime || "18:00")),
    } : item));
    setEditingIndex(null);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sr-glass-strong !bg-black/60 !border-white/20 max-w-lg max-h-[90vh] overflow-y-auto sr-scroll">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2"><Sparkles className="h-5 w-5 text-fuchsia-300" /> Revision series preview</DialogTitle>
          <DialogDescription className="text-white/70">For {draft.examTitle} · {draft.examDate ? new Date(draft.examDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}. Edit any session before creating.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              {editingIndex === i ? (
                <div className="space-y-2">
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="bg-white/5 border-white/15 text-white" />
                  <div className="flex gap-2">
                    <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="flex-1 bg-white/5 border-white/15 text-white" />
                    <Input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className="flex-1 bg-white/5 border-white/15 text-white" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveItem} className="rounded-lg bg-fuchsia-500/20 border border-fuchsia-500/40 px-3 py-1 text-[11px] text-fuchsia-200">Save</button>
                    <button onClick={() => setEditingIndex(null)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/60">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-white/30 w-6">#{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-white">{item.title}</p>
                    <p className="text-[10px] text-white/40">{item.dueAt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · {item.dueAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} · {item.durationMin} min</p>
                  </div>
                  <button onClick={() => { setEditingIndex(i); setEditTitle(item.title); setEditTime(`${String(item.dueAt.getHours()).padStart(2, "0")}:${String(item.dueAt.getMinutes()).padStart(2, "0")}`); setEditDate(item.dueAt.toISOString().slice(0, 10)); }} className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/50 hover:text-white">
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button onClick={() => setItems((prev) => prev.filter((_, x) => x !== i))} className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-1.5 text-rose-300/70 hover:text-rose-300">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        <DialogFooter className="mt-4">
          <Button variant="ghost" className="text-white/70" onClick={onClose}>Cancel</Button>
          <Button className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white" onClick={onConfirm}>Create {items.length} sessions</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Detail dialog
// ============================================================================

function ReminderDetailDialog({ reminder, open, onOpenChange, onEdit, onComplete, onSnooze, onReschedule, onDelete, onDuplicate, onOpenTalk }: {
  reminder: SmartReminder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (r: SmartReminder) => void;
  onComplete: (r: SmartReminder) => void;
  onSnooze: (r: SmartReminder) => void;
  onReschedule: (r: SmartReminder) => void;
  onDelete: (r: SmartReminder) => void;
  onDuplicate: (r: SmartReminder) => void;
  onOpenTalk: (r: SmartReminder) => void;
}) {
  const meta = TYPE_META[reminder.type];
  const Icon = meta.icon;
  const history = [
    { label: "Created", value: new Date(reminder.createdAt).toLocaleString(), at: reminder.createdAt },
    ...(reminder.lastTriggeredAt ? [{ label: "Last triggered", value: new Date(reminder.lastTriggeredAt).toLocaleString(), at: reminder.lastTriggeredAt }] : []),
    ...(reminder.completedAt ? [{ label: "Completed", value: new Date(reminder.completedAt).toLocaleString(), at: reminder.completedAt }] : []),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sr-glass-strong !bg-black/60 !border-white/20 max-w-lg max-h-[90vh] overflow-y-auto sr-scroll">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="grid place-items-center h-11 w-11 rounded-xl" style={{ background: `${meta.color}22`, color: meta.color }}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-white">{reminder.title}</DialogTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className="text-[10px]" style={{ background: `${PRIORITY_META[reminder.priority].color}18`, borderColor: `${PRIORITY_META[reminder.priority].color}55`, color: PRIORITY_META[reminder.priority].color }}>
                  {PRIORITY_META[reminder.priority].label} priority
                </Badge>
                <Badge variant="outline" className="text-[10px] border-white/15 text-white/60">{meta.label}</Badge>
                <Badge variant="outline" className="text-[10px] border-white/15 text-white/60">via {SOURCE_LABEL[reminder.source]}</Badge>
              </div>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <DetailChip icon={Clock} label="When" value={dueLabel(reminder)} />
            <DetailChip icon={Calendar} label="Status" value={reminder.status[0].toUpperCase() + reminder.status.slice(1)} />
            {reminder.durationMin && <DetailChip icon={Timer} label="Duration" value={`${reminder.durationMin} min`} />}
            {recurrenceLabel(reminder.recurrence) && <DetailChip icon={Repeat} label="Repeats" value={recurrenceLabel(reminder.recurrence)!} />}
            {reminder.subject && <DetailChip icon={BookIcon} label="Subject" value={reminder.subject} />}
            {reminder.chapter && <DetailChip icon={Brain} label="Chapter" value={reminder.chapter} />}
          </div>
          {reminder.description && <p className="text-sm text-white/70 leading-relaxed">{reminder.description}</p>}
          {reminder.talkEnabled && (
            <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/[0.07] p-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-cyan-100 flex items-center gap-1.5"><Volume2 className="h-3.5 w-3.5" /> Talk Reminder enabled</p>
                <p className="text-[10px] text-cyan-100/60 mt-0.5">{describeVoice(selectTalkVoice(reminder.voiceURI, reminder.voiceLanguage))}</p>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-[11px] border-cyan-400/40 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20" onClick={() => onOpenTalk(reminder)}>
                <Settings2 className="h-3 w-3 mr-1" /> Configure
              </Button>
            </div>
          )}
          {reminder.checklist.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">Checklist</p>
              <div className="space-y-1">
                {reminder.checklist.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-xs text-white/70">
                    <span className={cn("h-3.5 w-3.5 rounded border grid place-items-center", c.done ? "bg-emerald-500/40 border-emerald-500/60" : "border-white/25")}>
                      {c.done && <Check className="h-2.5 w-2.5 text-white" />}
                    </span>
                    <span className={c.done ? "line-through text-white/40" : ""}>{c.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {reminder.linkedEntity && (
            <button onClick={() => navigateTo(reminder.linkedEntity!.view ?? "study")}
              className="w-full flex items-center justify-between rounded-xl border border-violet-400/25 bg-violet-400/[0.07] px-3 py-2.5 text-xs text-violet-100 hover:bg-violet-400/15 transition-colors">
              <span className="flex items-center gap-1.5"><ArrowRight className="h-3.5 w-3.5" />{reminder.linkedEntity.label}</span>
              <span className="text-violet-100/60">Open →</span>
            </button>
          )}
          {history.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">Reminder history</p>
              <div className="space-y-1">
                {history.map((h, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] text-white/55">
                    <span>{h.label}</span>
                    <span>{h.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="mt-4 flex-wrap gap-2">
          {reminder.status !== "completed" && (
            <Button className="bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => { onComplete(reminder); onOpenChange(false); }}>
              <CheckCircle2 className="h-4 w-4 mr-1.5" />Complete
            </Button>
          )}
          <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => { onOpenChange(false); onEdit(reminder); }}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit
          </Button>
          <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => { onOpenChange(false); onDuplicate(reminder); }}>
            <Copy className="h-3.5 w-3.5 mr-1.5" />Duplicate
          </Button>
          <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => { onOpenChange(false); onSnooze(reminder); }}>
            <Clock className="h-3.5 w-3.5 mr-1.5" />Snooze
          </Button>
          <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => { onOpenChange(false); onReschedule(reminder); }}>
            <Calendar className="h-3.5 w-3.5 mr-1.5" />Move
          </Button>
          {reminder.status !== "completed" && reminder.openViewOnStart && (
            <Button variant="outline" className="border-cyan-400/40 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20" onClick={() => navigateTo(reminder.openViewOnStart!, { source: "reminder" })}>
              <Play className="h-3.5 w-3.5 mr-1.5" />Start task
            </Button>
          )}
          <Button variant="ghost" className="text-rose-300/80 hover:text-rose-300 hover:bg-rose-500/10 ml-auto" onClick={() => onDelete(reminder)}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailChip({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-white/40 mb-0.5"><Icon className="h-2.5 w-2.5" />{label}</p>
      <p className="text-xs font-medium text-white/85">{value}</p>
    </div>
  );
}

// ============================================================================
// Settings dialog
// ============================================================================

function ReminderSettingsDialog({ scholarClass, open, onOpenChange, notifState, onRequestNotifications }: {
  scholarClass: 9 | 11;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notifState: NotificationPermission | "unsupported";
  onRequestNotifications: () => Promise<void>;
}) {
  const profile = useReminderProfile(scholarClass);
  const store = useReminderStore;
  const settings = profile.settings;

  const patch = (p: Partial<ReminderSettings>) => store.getState().updateSettings(scholarClass, p);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sr-glass-strong !bg-black/60 !border-white/20 max-w-lg max-h-[90vh] overflow-y-auto sr-scroll">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2"><Settings2 className="h-5 w-5 text-fuchsia-300" /> Reminder settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {/* Notifications */}
          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-2">Notifications</h4>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-white/85">Browser notifications</p>
                  <p className="text-[10px] text-white/45">Alert you while a Scholar tab is open in the background. Scholar has no push server, so notifications can't reach you when the app is fully closed.</p>
                </div>
                {notifState === "granted" ? (
                  <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-500/40 shrink-0">Enabled</Badge>
                ) : notifState === "denied" ? (
                  <Badge className="bg-rose-500/20 text-rose-200 border-rose-500/40 shrink-0">Blocked</Badge>
                ) : (
                  <Button size="sm" className="h-7 text-[11px] bg-white text-slate-950 hover:bg-white/90 shrink-0" onClick={() => void onRequestNotifications()}>Enable</Button>
                )}
              </div>
              {notifState === "denied" && <p className="text-[10px] text-rose-200/70">Permission was denied. Enable it in your browser's site settings — Scholar won't keep asking.</p>}
              <Button size="sm" variant="outline" className="h-7 text-[11px] border-white/15 bg-white/5 text-white" onClick={sendTestNotification}>
                <Bell className="h-3 w-3 mr-1" /> Test notification
              </Button>
            </div>
          </section>

          {/* Quiet hours */}
          <section className="space-y-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Quiet hours</h4>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-white/85">Enable quiet hours</p>
                <Switch checked={settings.quietHours.enabled} onCheckedChange={(enabled) => patch({ quietHours: { ...settings.quietHours, enabled } })} aria-label="Enable quiet hours" />
              </div>
              {settings.quietHours.enabled && (
                <>
                  <div className="flex gap-2">
                    <Input type="time" value={settings.quietHours.start} onChange={(e) => patch({ quietHours: { ...settings.quietHours, start: e.target.value } })} className="flex-1 bg-white/5 border-white/15 text-white" aria-label="Quiet hours start" />
                    <Input type="time" value={settings.quietHours.end} onChange={(e) => patch({ quietHours: { ...settings.quietHours, end: e.target.value } })} className="flex-1 bg-white/5 border-white/15 text-white" aria-label="Quiet hours end" />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <ToggleRow label="Allow important" desc="High-priority reminders still fire" checked={settings.quietHours.allowImportant} onChange={(allowImportant) => patch({ quietHours: { ...settings.quietHours, allowImportant } })} />
                    <ToggleRow label="Allow exams" desc="Exam reminders still fire" checked={settings.quietHours.allowExams} onChange={(allowExams) => patch({ quietHours: { ...settings.quietHours, allowExams } })} />
                    <ToggleRow label="Silence all speech" desc="No Talk Reminders at all" checked={settings.quietHours.silenceSpeech} onChange={(silenceSpeech) => patch({ quietHours: { ...settings.quietHours, silenceSpeech } })} />
                    <ToggleRow label="Deliver later" desc="Group missed ones into a digest" checked={settings.quietHours.deliverLater} onChange={(deliverLater) => patch({ quietHours: { ...settings.quietHours, deliverLater } })} />
                  </div>
                  <p className="text-[10px] text-white/40">When off, low-priority reminders are skipped silently during quiet hours.</p>
                </>
              )}
            </div>
          </section>

          {/* Digest */}
          <section className="space-y-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Reminder digest</h4>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-white/85">Group low-priority reminders</p>
                <Switch checked={settings.digest.enabled} onCheckedChange={(enabled) => patch({ digest: { ...settings.digest, enabled } })} aria-label="Enable digest" />
              </div>
              {settings.digest.enabled && (
                <select value={settings.digest.mode} onChange={(e) => patch({ digest: { ...settings.digest, mode: e.target.value as any } })} className="w-full p-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm">
                  <option value="morning">Morning digest</option>
                  <option value="after-school">After-school digest</option>
                  <option value="evening">Evening digest</option>
                  <option value="custom">Custom time</option>
                </select>
              )}
              <p className="text-[10px] text-white/40">High-priority and exam reminders always stay separate.</p>
            </div>
          </section>

          {/* Talk defaults */}
          <section className="space-y-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Talk Reminder defaults</h4>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2.5">
              <ToggleRow label="Talk on by default" desc="New reminders speak when due" checked={settings.defaultTalkEnabled} onChange={(defaultTalkEnabled) => patch({ defaultTalkEnabled })} />
              <ToggleRow label="Speak details aloud" desc="Default privacy for descriptions" checked={settings.speakReminderDetails} onChange={(speakReminderDetails) => patch({ speakReminderDetails })} />
              <ToggleRow label="Speak only when open" desc="Skip speech when Scholar is hidden" checked={settings.talk.speakOnlyWhenOpen} onChange={(v) => patch({ talk: { ...settings.talk, speakOnlyWhenOpen: v } })} />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-white/85">Repeat count</p>
                <select value={settings.talk.repeatCount} onChange={(e) => patch({ talk: { ...settings.talk, repeatCount: Number(e.target.value) } })} className="rounded-lg bg-white/5 border border-white/15 text-white text-xs px-2 py-1">
                  {[1, 2, 3].map((n) => <option key={n} value={n}>{n}×</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* AI behaviour */}
          <section className="space-y-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-white/40">AI & LAM behaviour</h4>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-white/85">Smart suggestion mode</p>
                  <p className="text-[10px] text-white/45">How Scholar's suggestions behave</p>
                </div>
                <select value={settings.suggestionMode} onChange={(e) => patch({ suggestionMode: e.target.value as any })} className="rounded-lg bg-white/5 border border-white/15 text-white text-xs px-2 py-1">
                  <option value="suggestions-only">Suggestions only</option>
                  <option value="ask-before-creating">Ask before creating</option>
                  <option value="auto-approve">Auto-create routines</option>
                </select>
              </div>
              <ToggleRow label="Quick LAM actions" desc="Simple commands create reminders immediately" checked={settings.quickLamActions} onChange={(quickLamActions) => patch({ quickLamActions })} />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-white/85">Default pre-alert</p>
                  <p className="text-[10px] text-white/45">Minutes before due</p>
                </div>
                <select value={settings.defaultPreAlertMinutes} onChange={(e) => patch({ defaultPreAlertMinutes: Number(e.target.value) })} className="rounded-lg bg-white/5 border border-white/15 text-white text-xs px-2 py-1">
                  {[0, 5, 10, 30, 60, 180].map((m) => <option key={m} value={m}>{m === 0 ? "At due" : `${m} min`}</option>)}
                </select>
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default RemindersView;
