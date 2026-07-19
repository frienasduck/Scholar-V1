"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { askAIJSON } from "@/lib/ai";
import { useStore } from "@/lib/store";
import { useCurriculum } from "@/lib/use-curriculum";
import { CURRICULUM } from "@/lib/curriculum";
import { exportPDF, mdToHtml } from "@/lib/pdf";
import { profileGetJSON, profileSetJSON } from "@/lib/profile-storage";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Bell, BellOff, BellRing, Clock, AlertTriangle, Flame, Brain, Layers,
  Sparkles, Plus, Download, CheckCircle2, X, Calendar, AlarmClock,
  Zap, TrendingUp, Moon, Sun, ListChecks, RefreshCw,
} from "lucide-react";

// ============================================================================
// Smart Reminders
// ============================================================================

type ReminderType =
  | "revision" | "exam" | "forgetting" | "streak" | "flashcards"
  | "custom" | "general";

type ReminderStatus = "active" | "snoozed" | "dismissed";

interface Reminder {
  id: string;
  type: ReminderType;
  title: string;
  body: string;
  subject?: string;
  chapter?: string;
  dueAt: number;          // ms timestamp
  priority: "low" | "medium" | "high";
  status: ReminderStatus;
  snoozeUntil?: number;
  createdAt: number;
  source: "system" | "ai" | "custom";
  aiSuggestion?: string;
}

const TYPE_META: Record<ReminderType, { label: string; icon: any; color: string }> = {
  revision:  { label: "Revision Due",   icon: RefreshCw,   color: "#14b8a6" },
  exam:      { label: "Exam Deadline",  icon: AlarmClock,  color: "#f43f5e" },
  forgetting:{ label: "Forgetting Curve", icon: Brain,     color: "#d946ef" },
  streak:    { label: "Streak Risk",    icon: Flame,       color: "#f59e0b" },
  flashcards:{ label: "Flashcards Due", icon: Layers,      color: "#6366f1" },
  custom:    { label: "Custom",         icon: Bell,        color: "#10b981" },
  general:   { label: "Reminder",       icon: BellRing,    color: "#64748b" },
};

// ============================================================================
// Helpers
// ============================================================================
function loadCustom(scholarClass: 9 | 11): Reminder[] {
  if (typeof window === "undefined") return [];
  return profileGetJSON<Reminder[]>(scholarClass, "smart-reminders-custom", []);
}
function saveCustom(scholarClass: 9 | 11, list: Reminder[]) {
  profileSetJSON(scholarClass, "smart-reminders-custom", list);
}
function loadState(scholarClass: 9 | 11): Record<string, ReminderStatus> {
  if (typeof window === "undefined") return {};
  return profileGetJSON<Record<string, ReminderStatus>>(scholarClass, "smart-reminders-state", {});
}
function saveState(scholarClass: 9 | 11, map: Record<string, ReminderStatus>) {
  profileSetJSON(scholarClass, "smart-reminders-state", map);
}

const dayMs = 86_400_000;
const hourMs = 3_600_000;

function relativeTime(t: number): string {
  const diff = t - Date.now();
  const abs = Math.abs(diff);
  const past = diff < 0;
  if (abs < hourMs) return `${past ? "" : "in "}${Math.round(abs / 60_000)}m${past ? " ago" : ""}`;
  if (abs < dayMs)  return `${past ? "" : "in "}${Math.round(abs / hourMs)}h${past ? " ago" : ""}`;
  const days = Math.round(abs / dayMs);
  if (days < 7)     return `${past ? "" : "in "}${days}d${past ? " ago" : ""}`;
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ============================================================================
// Smart-feed generation — derives system reminders from store data
// ============================================================================
function buildSystemReminders(
  tasks: any[], sessions: any[], flashcards: any[],
  mastery: Record<string, number>, studyProgress: Record<string, number>,
  streak: number, lastStudyDay: string | null,
  curriculum: { id: string; name: string; icon: string; chapters: { id: string; title: string }[] }[]
): Reminder[] {
  const now = Date.now();
  const out: Reminder[] = [];

  // 1. Revision overdue — chapters studied but not reviewed in 3+ days
  curriculum.forEach((subj) => {
    subj.chapters.forEach((ch) => {
      const prog = studyProgress[ch.id] ?? 0;
      if (prog < 30) return;
      // deterministic lastReviewed: hash of chapter id → 1..12 days ago
      let h = 0;
      for (let i = 0; i < ch.id.length; i++) h = (h * 31 + ch.id.charCodeAt(i)) & 0xfffff;
      const daysAgo = 1 + (h % 12);
      const lastAt = now - daysAgo * dayMs;
      const dueAt = lastAt + 3 * dayMs;
      if (dueAt < now + dayMs) {
        out.push({
          id: `sys-rev-${ch.id}`,
          type: "revision",
          title: `Revise: ${ch.title}`,
          body: `It's been ${daysAgo}d since you studied ${subj.name} • ${ch.title}. Spaced repetition works best when you revisit before forgetting sets in.`,
          subject: subj.id,
          chapter: ch.id,
          dueAt,
          priority: daysAgo > 6 ? "high" : "medium",
          status: "active",
          createdAt: lastAt,
          source: "system",
        });
      }
    });
  });

  // 2. Exam deadlines — upcoming tasks of type exam
  tasks.filter((t) => t.type === "exam" && !t.done).forEach((t) => {
    const due = new Date(t.date + "T" + (t.time ?? "09:00")).getTime();
    const daysLeft = Math.ceil((due - now) / dayMs);
    if (daysLeft < 14) {
      out.push({
        id: `sys-exam-${t.id}`,
        type: "exam",
        title: `Exam: ${t.title}`,
        body: `${t.subject ?? "General"} exam in ${daysLeft} day${daysLeft === 1 ? "" : "s"}${t.priority === "high" ? " — marked high priority." : "."} Block 90-min revision slots this week.`,
        subject: t.subject,
        dueAt: due,
        priority: daysLeft <= 3 ? "high" : "medium",
        status: "active",
        createdAt: now,
        source: "system",
      });
    }
  });

  // 3. Forgetting curve — low mastery chapters where last study was 2-5 days ago
  curriculum.forEach((subj) => {
    subj.chapters.forEach((ch) => {
      const m = mastery[subj.id] ?? 0;
      const prog = studyProgress[ch.id] ?? 0;
      if (m < 50 && prog > 40) {
        let h = 0;
        for (let i = 0; i < ch.id.length; i++) h = (h * 17 + ch.id.charCodeAt(i)) & 0xfffff;
        const daysAgo = 2 + (h % 4);
        out.push({
          id: `sys-fgt-${ch.id}`,
          type: "forgetting",
          title: `Forgetting curve: ${ch.title}`,
          body: `Your ${subj.name} mastery is ${m}%. Concepts from "${ch.title}" are likely fading — a quick 15-min recall session will restore ~80% retention.`,
          subject: subj.id,
          chapter: ch.id,
          dueAt: now + daysAgo * dayMs,
          priority: "medium",
          status: "active",
          createdAt: now,
          source: "system",
        });
      }
    });
  });

  // 4. Streak risk — no session in last 24h
  const todayStr = new Date().toISOString().slice(0, 10);
  const studiedToday = lastStudyDay === todayStr || sessions.some((s) => {
    const sd = new Date(s.completedAt).toISOString().slice(0, 10);
    return sd === todayStr;
  });
  if (!studiedToday && streak > 0) {
    const hoursSinceMidnight = (now - new Date(todayStr + "T00:00").getTime()) / hourMs;
    const hoursLeft = 24 - hoursSinceMidnight;
    out.push({
      id: "sys-streak-risk",
      type: "streak",
      title: `Don't break your ${streak}-day streak!`,
      body: `You haven't studied today. Just one Pomodoro (25 min) before midnight keeps your streak alive.${hoursLeft < 6 ? " ⏰ Only " + Math.floor(hoursLeft) + "h left!" : ""}`,
      dueAt: now,
      priority: hoursLeft < 6 ? "high" : "medium",
      status: "active",
      createdAt: now,
      source: "system",
    });
  }

  // 5. Flashcards due — Leitner box 1-2 cards reviewed >1 day ago
  const dueCards = flashcards.filter((c) => {
    const ageH = (now - (c.lastReviewed ?? 0)) / hourMs;
    return (c.box ?? 1) <= 2 && ageH > 24;
  });
  if (dueCards.length > 0) {
    out.push({
      id: "sys-flash-due",
      type: "flashcards",
      title: `${dueCards.length} flashcard${dueCards.length === 1 ? "" : "s"} due for review`,
      body: `Your Leitner box 1-2 cards are due. A 10-min review session now boosts recall by ~65%.`,
      dueAt: now,
      priority: dueCards.length > 8 ? "high" : "medium",
      status: "active",
      createdAt: now,
      source: "system",
    });
  }

  return out;
}

// ============================================================================
// Component
// ============================================================================
export function RemindersView() {
  const tasks = useStore((s) => s.tasks);
  const scholarClass = useStore((s) => s.user.scholarClass);
  const CURRICULUM = useCurriculum();
  const sessions = useStore((s) => s.sessions);
  const flashcards = useStore((s) => s.flashcards);
  const mastery = useStore((s) => s.mastery);
  const studyProgress = useStore((s) => s.studyProgress);
  const streak = useStore((s) => s.streak);
  const lastStudyDay = useStore((s) => s.lastStudyDay);
  const addXP = useStore((s) => s.addXP);
  const pushActivity = useStore((s) => s.pushActivity);

  const [custom, setCustom] = useState<Reminder[]>([]);
  const [stateMap, setStateMap] = useState<Record<string, ReminderStatus>>({});
  const [activeFilter, setActiveFilter] = useState<ReminderType | "all">("all");
  const [dnd, setDnd] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReminders, setAiReminders] = useState<Reminder[]>([]);
  const [tab, setTab] = useState("active");

  // Form state
  const [fTitle, setFTitle] = useState("");
  const [fBody, setFBody] = useState("");
  const [fType, setFType] = useState<ReminderType>("custom");
  const [fSubject, setFSubject] = useState("");
  const [fWhen, setFWhen] = useState("1h"); // 1h | 3h | today | tomorrow | date

  useEffect(() => {
    setCustom(loadCustom(scholarClass));
    setStateMap(loadState(scholarClass));
  }, [scholarClass]);

  // Build system reminders
  const systemReminders = useMemo(
    () => buildSystemReminders(tasks, sessions, flashcards, mastery, studyProgress, streak, lastStudyDay, CURRICULUM),
    [tasks, sessions, flashcards, mastery, studyProgress, streak, lastStudyDay, CURRICULUM]
  );

  // Merge all + apply persisted status overrides
  const allReminders = useMemo(() => {
    const merged = [...systemReminders, ...custom, ...aiReminders];
    const seen = new Set<string>();
    return merged.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    }).map((r) => {
      const override = stateMap[r.id];
      if (override && override !== r.status) {
        return { ...r, status: override };
      }
      // Auto-reactivate snoozed reminders whose snoozeUntil has passed
      if (r.status === "snoozed" && r.snoozeUntil && r.snoozeUntil <= Date.now()) {
        return { ...r, status: "active" as ReminderStatus, snoozeUntil: undefined };
      }
      return r;
    });
  }, [systemReminders, custom, aiReminders, stateMap]);

  const persistStatus = useCallback((id: string, status: ReminderStatus, snoozeUntil?: number) => {
    setStateMap((prev) => {
      const next = { ...prev, [id]: status };
      saveState(scholarClass, next);
      return next;
    });
    if (snoozeUntil) {
      // snoozeUntil stored on the custom list or as part of system override is fine — we apply at read time
      // For custom reminders, also persist snoozeUntil so it survives reload
      setCustom((prev) => {
        const updated = prev.map((c) => c.id === id ? { ...c, status, snoozeUntil } : c);
        saveCustom(scholarClass, updated);
        return updated;
      });
    }
  }, [scholarClass]);

  const snooze = (id: string, hours: number) => {
    const until = Date.now() + hours * hourMs;
    persistStatus(id, "snoozed", until);
    toast.success(`Snoozed for ${hours}h`, { description: `Will resurface ${relativeTime(until)}` });
  };

  const snoozeUntilTomorrow = (id: string) => {
    const t = new Date(); t.setHours(9, 0, 0, 0); t.setDate(t.getDate() + 1);
    persistStatus(id, "snoozed", t.getTime());
    toast.success("Snoozed until tomorrow 9 AM");
  };

  const dismiss = (id: string) => {
    persistStatus(id, "dismissed");
    toast.success("Reminder dismissed");
  };

  const reactivate = (id: string) => {
    persistStatus(id, "active");
    toast.success("Reminder re-activated");
  };

  const createCustom = () => {
    if (!fTitle.trim()) { toast.error("Give your reminder a title."); return; }
    let dueAt = Date.now() + hourMs;
    if (fWhen === "3h") dueAt = Date.now() + 3 * hourMs;
    else if (fWhen === "today") dueAt = Date.now() + 6 * hourMs;
    else if (fWhen === "tomorrow") { const t = new Date(); t.setDate(t.getDate() + 1); t.setHours(9, 0, 0, 0); dueAt = t.getTime(); }
    const rem: Reminder = {
      id: "cus-" + Math.random().toString(36).slice(2) + Date.now().toString(36),
      type: fType, title: fTitle.trim(),
      body: fBody.trim() || "Custom reminder",
      subject: fSubject || undefined,
      dueAt, priority: "medium",
      status: "active", createdAt: Date.now(), source: "custom",
    };
    const next = [rem, ...custom];
    setCustom(next); saveCustom(scholarClass, next);
    addXP(2);
    pushActivity({ type: "note", text: `Created reminder: ${rem.title}`, icon: "🔔" });
    toast.success("Custom reminder added +2 XP");
    setFTitle(""); setFBody(""); setFSubject(""); setFWhen("1h");
    setCreateOpen(false);
  };

  // ===== AI Refresh =====
  const runAIRefresh = async () => {
    setAiLoading(true);
    try {
      const prompt = `You are a smart academic reminder engine for a CBSE Class ${scholarClass} student.
Current context:
- ${streak}-day streak
- Subjects mastery: ${Object.entries(mastery).map(([k, v]) => `${k}=${v}%`).join(", ")}
- ${tasks.filter(t => !t.done).length} pending tasks
- ${flashcards.length} flashcards
- Last study day: ${lastStudyDay ?? "unknown"}

Generate 3-5 SHORT, personalised, actionable reminders that go beyond the obvious system reminders. Each should feel like a thoughtful nudge from a study coach. Vary types: revision, exam-prep, forgetting-curve, streak, flashcards, or general wellness.

Return strict JSON:
{
  "reminders": [
    {
      "type": "revision" | "exam" | "forgetting" | "streak" | "flashcards" | "general",
      "title": string (max 60 chars),
      "body": string (1-2 sentences, max 200 chars),
      "priority": "low" | "medium" | "high",
      "dueInHours": number (1-72)
    }
  ]
}`;
      const res = await askAIJSON<{ reminders: any[] }>(prompt, "academic-coach");
      if (!res?.reminders?.length) throw new Error("no result");
      const now = Date.now();
      const mapped: Reminder[] = res.reminders.map((r, i) => ({
        id: `ai-${Date.now()}-${i}`,
        type: (r.type as ReminderType) ?? "general",
        title: String(r.title).slice(0, 80),
        body: String(r.body).slice(0, 240),
        dueAt: now + (Number(r.dueInHours) || 6) * hourMs,
        priority: (r.priority as Reminder["priority"]) ?? "medium",
        status: "active",
        createdAt: now,
        source: "ai",
        aiSuggestion: "Generated by AI Coach",
      }));
      setAiReminders(mapped);
      addXP(3);
      toast.success(`AI refreshed ${mapped.length} smart reminders`, { description: "+3 XP" });
    } catch {
      toast.error("AI refresh failed. Try again in a moment.");
    } finally { setAiLoading(false); }
  };

  // ===== Filtering =====
  const filterByTab = (list: Reminder[], tab: string): Reminder[] => {
    if (tab === "active") return list.filter((r) => r.status === "active");
    if (tab === "snoozed") return list.filter((r) => r.status === "snoozed");
    if (tab === "dismissed") return list.filter((r) => r.status === "dismissed");
    if (tab === "custom") return list.filter((r) => r.source === "custom");
    return list;
  };

  const filterByCategory = (list: Reminder[]) =>
    activeFilter === "all" ? list : list.filter((r) => r.type === activeFilter);

  const sorted = (list: Reminder[]) => {
    const pOrder = { high: 0, medium: 1, low: 2 };
    return [...list].sort((a, b) => {
      if (a.status !== b.status) return 0;
      if (a.priority !== b.priority) return pOrder[a.priority] - pOrder[b.priority];
      return a.dueAt - b.dueAt;
    });
  };

  const activeList = sorted(filterByCategory(filterByTab(allReminders, "active")));
  const snoozedList = sorted(filterByCategory(filterByTab(allReminders, "snoozed")));
  const dismissedList = sorted(filterByCategory(filterByTab(allReminders, "dismissed")));
  const customList = sorted(filterByCategory(filterByTab(allReminders, "custom")));

  // ===== Stats =====
  const activeCount = allReminders.filter((r) => r.status === "active").length;
  const highCount = allReminders.filter((r) => r.status === "active" && r.priority === "high").length;
  const snoozedCount = allReminders.filter((r) => r.status === "snoozed").length;
  const dismissedCount = allReminders.filter((r) => r.status === "dismissed").length;

  const exportReminders = () => {
    const md = `# Smart Reminders
Generated on ${new Date().toLocaleString()}

## Summary
- Active: ${activeCount}
- High priority: ${highCount}
- Snoozed: ${snoozedCount}
- Dismissed: ${dismissedCount}
- Do-Not-Disturb: ${dnd ? "ON" : "OFF"}

## Active Reminders
${activeList.length ? activeList.map((r, i) => `${i + 1}. **${r.title}** [${TYPE_META[r.type].label}]
   - Priority: ${r.priority}
   - Due: ${relativeTime(r.dueAt)}
   - ${r.body}`).join("\n") : "_None_"}

## Snoozed
${snoozedList.length ? snoozedList.map((r, i) => `${i + 1}. ${r.title} — until ${r.snoozeUntil ? relativeTime(r.snoozeUntil) : "later"}`).join("\n") : "_None_"}

## Custom Reminders
${customList.length ? customList.map((r, i) => `${i + 1}. ${r.title} — ${r.body}`).join("\n") : "_None_"}

> Generated by Scholar Smart Reminders.`;
    exportPDF({ title: "Smart Reminders Report", subtitle: `${activeCount} active • ${snoozedCount} snoozed`, bodyHtml: mdToHtml(md), accent: "#d946ef" });
    toast.success("Exporting reminders report…");
  };

  // ===== Card =====
  const ReminderCard = ({ r }: { r: Reminder }) => {
    const meta = TYPE_META[r.type];
    const Icon = meta.icon;
    const overdue = r.status === "active" && r.dueAt < Date.now();
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.25 }}
        className="sr-glass rounded-2xl p-4 border-l-2"
        style={{ borderLeftColor: meta.color }}
      >
        <div className="flex items-start gap-3">
          <div className="grid place-items-center h-10 w-10 rounded-xl shrink-0" style={{ background: `${meta.color}22`, color: meta.color }}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="text-white font-semibold text-sm leading-snug">{r.title}</h4>
              <div className="flex items-center gap-1 shrink-0">
                {r.source === "ai" && (
                  <Badge variant="outline" className="bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-200 text-[10px] px-1.5">
                    <Sparkles className="h-2.5 w-2.5 mr-0.5" />AI
                  </Badge>
                )}
                {r.source === "custom" && (
                  <Badge variant="outline" className="bg-emerald-500/15 border-emerald-500/40 text-emerald-200 text-[10px] px-1.5">
                    <Bell className="h-2.5 w-2.5 mr-0.5" />You
                  </Badge>
                )}
                {r.priority === "high" && (
                  <Badge variant="outline" className="bg-rose-500/15 border-rose-500/40 text-rose-200 text-[10px] px-1.5">
                    <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />High
                  </Badge>
                )}
              </div>
            </div>
            <p className="text-white/70 text-xs leading-relaxed mb-2">{r.body}</p>
            <div className="flex items-center gap-3 text-[11px] text-white/50">
              <span className={cn("flex items-center gap-1", overdue && "text-rose-300")}>
                <Clock className="h-3 w-3" />{overdue ? "Overdue · " : ""}{relativeTime(r.dueAt)}
              </span>
              <span className="text-white/30">•</span>
              <span>{meta.label}</span>
              {r.snoozeUntil && r.status === "snoozed" && (
                <>
                  <span className="text-white/30">•</span>
                  <span className="text-amber-300">Returns {relativeTime(r.snoozeUntil)}</span>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              {r.status === "active" && (
                <>
                  <Button size="sm" variant="outline" className="h-7 text-xs bg-white/5 border-white/15 text-white hover:bg-white/10"
                    onClick={() => snooze(r.id, 1)}>
                    <Clock className="h-3 w-3 mr-1" />1h
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs bg-white/5 border-white/15 text-white hover:bg-white/10"
                    onClick={() => snooze(r.id, 3)}>
                    <Clock className="h-3 w-3 mr-1" />3h
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs bg-white/5 border-white/15 text-white hover:bg-white/10"
                    onClick={() => snoozeUntilTomorrow(r.id)}>
                    <Calendar className="h-3 w-3 mr-1" />Tomorrow
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-white/50 hover:text-rose-300 hover:bg-rose-500/10"
                    onClick={() => dismiss(r.id)}>
                    <X className="h-3 w-3 mr-1" />Dismiss
                  </Button>
                </>
              )}
              {(r.status === "snoozed" || r.status === "dismissed") && (
                <Button size="sm" variant="outline" className="h-7 text-xs bg-emerald-500/10 border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/20"
                  onClick={() => reactivate(r.id)}>
                  <CheckCircle2 className="h-3 w-3 mr-1" />Reactivate
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const tabContent = (list: Reminder[], emptyTitle: string, emptyDesc: string, icon: any) => {
    if (list.length === 0) return <EmptyState icon={icon} title={emptyTitle} description={emptyDesc} />;
    return (
      <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
        className="grid gap-3 md:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {list.map((r) => <ReminderCard key={r.id} r={r} />)}
        </AnimatePresence>
      </motion.div>
    );
  };

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

      <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover z-0">
        <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260511_230229_7c9bc431-46cf-489a-948d-e8144d8eb5d4.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 z-0 bg-black/55" />

      <div className="relative z-10 sr-font-body p-4 md:p-8 lg:p-12 max-w-7xl mx-auto">
        {/* HERO */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="grid place-items-center h-12 w-12 rounded-2xl bg-gradient-to-br from-fuchsia-500/30 to-pink-500/30 text-fuchsia-300 border border-white/10">
                <BellRing className="h-6 w-6" />
              </div>
              <Badge className="bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40">Smart • AI-powered • Spaced</Badge>
            </div>
            <h1 className="sr-font-serif text-5xl md:text-6xl text-white leading-tight">
              Smart <em className="text-fuchsia-300">Reminders</em>
            </h1>
            <p className="text-white/70 mt-3 max-w-2xl">
              Your study OS auto-surfaces what matters — revision overdue, exam deadlines, forgetting curve triggers,
              streak risks, and flashcards due. Snooze, dismiss, or add your own. AI refreshes the feed in one click.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="sr-glass rounded-xl px-3 py-2 flex items-center gap-2">
              {dnd ? <Moon className="h-4 w-4 text-fuchsia-300" /> : <Sun className="h-4 w-4 text-amber-300" />}
              <span className="text-xs text-white/70 font-medium">DND</span>
              <Switch checked={dnd} onCheckedChange={(v) => { setDnd(v); toast.success(v ? "Do-Not-Disturb ON until 8 AM" : "DND off"); }} />
            </div>
            <Button variant="outline" className="sr-glass bg-white/5 border-white/15 text-white hover:bg-white/10" onClick={exportReminders}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export
            </Button>
            <Button className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> New Reminder
            </Button>
          </div>
        </motion.div>

        {/* STAT PILLS */}
        <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { icon: BellRing, label: "Active", value: activeCount, accent: "#d946ef" },
            { icon: AlertTriangle, label: "High Priority", value: highCount, accent: "#f43f5e" },
            { icon: Clock, label: "Snoozed", value: snoozedCount, accent: "#f59e0b" },
            { icon: CheckCircle2, label: "Dismissed", value: dismissedCount, accent: "#10b981" },
          ].map((s, i) => (
            <motion.div key={i} variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
              <StatCard icon={s.icon} label={s.label} value={s.value} accent={s.accent} />
            </motion.div>
          ))}
        </motion.div>

        {/* AI REFRESH BANNER */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="sr-glass-strong rounded-2xl p-5 mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-fuchsia-500/30 to-purple-500/30 text-fuchsia-200 border border-white/10 shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-white font-semibold flex items-center gap-2">
                AI Smart Refresh
                {aiReminders.length > 0 && <Badge className="bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/40 text-[10px]">+{aiReminders.length} AI-generated</Badge>}
              </h3>
              <p className="text-xs text-white/60 mt-0.5">Generate personalised nudges based on your current mastery, streak & tasks. +3 XP per refresh.</p>
            </div>
          </div>
          <Button className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white" disabled={aiLoading} onClick={runAIRefresh}>
            {aiLoading ? (
              <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><RefreshCw className="h-4 w-4 mr-1.5" /></motion.div>Generating…</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-1.5" />Refresh feed</>
            )}
          </Button>
        </motion.div>

        {/* CATEGORY CHIPS */}
        <div className="flex items-center gap-2 flex-wrap mb-6">
          <button
            onClick={() => setActiveFilter("all")}
            className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-all",
              activeFilter === "all" ? "bg-white/20 text-white" : "bg-white/5 text-white/60 hover:bg-white/10")}
          >
            All types
          </button>
          {(Object.keys(TYPE_META) as ReminderType[]).map((t) => {
            const m = TYPE_META[t];
            const cnt = allReminders.filter((r) => r.type === t && r.status === "active").length;
            if (cnt === 0 && t !== "custom") return null;
            return (
              <button key={t} onClick={() => setActiveFilter(t)}
                className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5",
                  activeFilter === t ? "text-white shadow-sm" : "bg-white/5 text-white/60 hover:bg-white/10")}
                style={activeFilter === t ? { background: m.color } : undefined}>
                <m.icon className="h-3 w-3" />{m.label}
                {cnt > 0 && <span className="bg-black/20 rounded-full px-1.5 text-[10px]">{cnt}</span>}
              </button>
            );
          })}
          {activeFilter !== "all" && (
            <button onClick={() => setActiveFilter("all")} className="text-xs text-white/40 hover:text-white/70 ml-1">Clear filter</button>
          )}
        </div>

        {/* TABS */}
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="sr-glass bg-transparent h-auto p-1 flex flex-wrap gap-1">
            <TabsTrigger value="active" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">
              Active {activeCount > 0 && <span className="ml-1.5 text-xs bg-fuchsia-500/30 text-fuchsia-200 rounded-full px-1.5">{activeCount}</span>}
            </TabsTrigger>
            <TabsTrigger value="snoozed" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">
              Snoozed {snoozedCount > 0 && <span className="ml-1.5 text-xs bg-amber-500/30 text-amber-200 rounded-full px-1.5">{snoozedCount}</span>}
            </TabsTrigger>
            <TabsTrigger value="dismissed" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">Dismissed</TabsTrigger>
            <TabsTrigger value="custom" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">
              Custom {customList.length > 0 && <span className="ml-1.5 text-xs bg-emerald-500/30 text-emerald-200 rounded-full px-1.5">{customList.length}</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-3">
            {dnd && (
              <div className="sr-glass rounded-xl p-3 flex items-center gap-2 text-sm text-fuchsia-200 mb-3">
                <Moon className="h-4 w-4" /> Do-Not-Disturb is ON — non-critical reminders are muted. High-priority alerts still surface.
              </div>
            )}
            {tabContent(
              activeList,
              "All caught up 🎉",
              "No active reminders right now. The system will surface new nudges as your study data evolves, or hit 'Refresh feed' for AI-generated suggestions.",
              CheckCircle2
            )}
          </TabsContent>

          <TabsContent value="snoozed" className="space-y-3">
            {tabContent(snoozedList, "Nothing snoozed", "Snoozed reminders will appear here. Use the 1h / 3h / Tomorrow buttons on any reminder to push it back.", Clock)}
          </TabsContent>

          <TabsContent value="dismissed" className="space-y-3">
            {tabContent(dismissedList, "Nothing dismissed", "Dismissed reminders land here. You can reactivate any of them — they won't auto-resurface.", BellOff)}
          </TabsContent>

          <TabsContent value="custom" className="space-y-3">
            {tabContent(customList, "No custom reminders yet", "Create your own reminders — for tuition classes, homework due dates, water breaks, anything. +2 XP each.", Bell)}
          </TabsContent>
        </Tabs>

        {/* CREATE DIALOG */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sr-glass-strong !bg-black/60 !border-white/20 max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="sr-font-serif text-2xl text-white flex items-center gap-2">
                <Bell className="h-5 w-5 text-fuchsia-300" /> Create Custom Reminder
              </DialogTitle>
              <DialogDescription className="text-white/70">Set a personal reminder. +2 XP for creating.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Type</Label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                  {(Object.keys(TYPE_META) as ReminderType[]).filter((t) => t !== "general").map((t) => {
                    const m = TYPE_META[t];
                    return (
                      <button key={t} onClick={() => setFType(t)}
                        className={cn("p-2 rounded-lg border text-left transition-all",
                          fType === t ? "border-white/40 bg-white/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]")}>
                        <m.icon className="h-3.5 w-3.5 mb-1" style={{ color: m.color }} />
                        <p className="text-[10px] text-white font-medium leading-tight">{m.label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Title</Label>
                <Input value={fTitle} onChange={(e) => setFTitle(e.target.value)}
                  placeholder="e.g. Tuition homework due"
                  className="bg-white/5 border-white/15 text-white" />
              </div>
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Description</Label>
                <Textarea value={fBody} onChange={(e) => setFBody(e.target.value)}
                  placeholder="What should this reminder nudge you about?" rows={2}
                  className="bg-white/5 border-white/15 text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Subject (optional)</Label>
                  <select value={fSubject} onChange={(e) => setFSubject(e.target.value)}
                    className="w-full p-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm">
                    <option value="">— None —</option>
                    <option value="maths">Mathematics</option>
                    <option value="science">Science</option>
                    <option value="sst">Social Science</option>
                    <option value="english">English</option>
                    <option value="hindi">Hindi</option>
                  </select>
                </div>
                <div>
                  <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">When</Label>
                  <select value={fWhen} onChange={(e) => setFWhen(e.target.value)}
                    className="w-full p-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm">
                    <option value="1h">In 1 hour</option>
                    <option value="3h">In 3 hours</option>
                    <option value="today">Later today (6h)</option>
                    <option value="tomorrow">Tomorrow 9 AM</option>
                  </select>
                </div>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="ghost" className="text-white/70" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white" onClick={createCustom}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Create (+2 XP)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export default RemindersView;
