"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { askAIJSON } from "@/lib/ai";
import { useStore } from "@/lib/store";
import { CURRICULUM } from "@/lib/curriculum";
import { useCurriculum } from "@/lib/use-curriculum";
import { useUserName } from "@/lib/use-user-name";
import { exportPDF, mdToHtml } from "@/lib/pdf";
import { profileGetJSON, profileSetJSON, profileGetItem, profileSetItem, profileRemoveItem, profileKey } from "@/lib/profile-storage";
import { StatCard, EmptyState, ProgressRing } from "@/lib/shared";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  RefreshCw, Clock, Flame, Brain, Sparkles, BookOpen, AlertTriangle,
  Download, Play, CheckCircle2, XCircle, Target, Zap, TrendingDown,
  History, Lightbulb, ArrowRight, Calendar, Layers, ListChecks, FileQuestion,
} from "lucide-react";
import { navigateTo } from "@/lib/nav-event";

// ============================================================================
// Revision Hub — Scholar (Class 9 / Class 11 aware)
// ============================================================================

// Deterministic hash → stable per-chapter "due day" without time-of-day issues.
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Spaced repetition schedule: based on chapter mastery, last "review day index"
interface DueTopic {
  chapterId: string;
  subjectId: string;
  subjectName: string;
  chapterTitle: string;
  summary: string;
  mastery: number;
  progress: number;
  interval: number;   // days until due again
  dueToday: boolean;
  lastReviewedAgo: number; // days
  priority: number;
}

interface SessionRecord {
  id: string;
  chapterId: string;
  chapterTitle: string;
  subjectName: string;
  remembered: number;
  review: number;
  xp: number;
  at: number;
}
function loadSessions(scholarClass: 9 | 11): SessionRecord[] {
  if (typeof window === "undefined") return [];
  return profileGetJSON<SessionRecord[]>(scholarClass, "revision-hub-history", []);
}
function saveSessions(scholarClass: 9 | 11, list: SessionRecord[]) {
  profileSetJSON(scholarClass, "revision-hub-history", list);
}

// ===== Pending Revision XP (deferred until activity completion) =====
// Each evaluation creates a pending record. XP is awarded only when an
// actual revision activity (flashcards / practice / quiz) is completed
// AFTER the evaluation was submitted — preventing instant XP farming.
interface PendingXP {
  chapterId: string;
  chapterTitle: string;
  subjectName: string;
  startedAt: number;
  weakTerms: string[];
  partialTerms: string[];
  strongTerms: string[];
}
function loadAllPendingXP(scholarClass: 9 | 11): PendingXP[] {
  if (typeof window === "undefined") return [];
  const out: PendingXP[] = [];
  try {
    const prefix = profileKey(scholarClass, "revision-pending:");
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const chapterId = key.slice(prefix.length);
        const raw = profileGetItem(scholarClass, "revision-pending:" + chapterId);
        if (raw) {
          const data = JSON.parse(raw);
          if (data && data.chapterId) out.push(data);
        }
      }
    }
  } catch { /* ignore */ }
  return out;
}
function savePendingXP(scholarClass: 9 | 11, p: PendingXP) {
  profileSetItem(scholarClass, "revision-pending:" + p.chapterId, JSON.stringify(p));
}
function clearPendingXP(scholarClass: 9 | 11, chapterId: string) {
  profileRemoveItem(scholarClass, "revision-pending:" + chapterId);
}

// Type for term self-evaluation: weak / partial / strong recall.
type TermStatus = "weak" | "partial" | "strong" | null;

// ============================================================================
// Component
// ============================================================================
export function RevisionHubView() {
  const CURRICULUM = useCurriculum();
  const { appName } = useUserName();
  const scholarClass = useStore((s) => s.user.scholarClass);
  const studyProgress = useStore((s) => s.studyProgress);
  const mastery = useStore((s) => s.mastery);
  const sessions = useStore((s) => s.sessions);
  const streak = useStore((s) => s.streak);
  const flashcards = useStore((s) => s.flashcards);
  const quizAttempts = useStore((s) => s.quizAttempts);
  const addXP = useStore((s) => s.addXP);
  const addCoins = useStore((s) => s.addCoins);
  const setStudyProgress = useStore((s) => s.setStudyProgress);
  const setMastery = useStore((s) => s.setMastery);
  const bumpStreak = useStore((s) => s.bumpStreak);
  const pushActivity = useStore((s) => s.pushActivity);

  // Session dialog state
  const [activeTopic, setActiveTopic] = useState<DueTopic | null>(null);
  const [sessionStep, setSessionStep] = useState<"loading" | "summary" | "review" | "overview">("loading");
  const [aiSummary, setAiSummary] = useState<string>("");
  const [keyTerms, setKeyTerms] = useState<string[]>([]);
  const [reviewItems, setReviewItems] = useState<{ term: string; status: TermStatus }[]>([]);
  const [forgottenTopics, setForgottenTopics] = useState<{ chapterId: string; chapterTitle: string; subjectName: string; concept: string; reason: string }[] | null>(null);
  const [forgottenLoading, setForgottenLoading] = useState(false);

  const [history, setHistory] = useState<SessionRecord[]>(() => loadSessions(scholarClass));
  const [pendingXPCount, setPendingXPCount] = useState<number>(() => loadAllPendingXP(scholarClass).length);

  // Reload history + pending XP when the active profile changes.
  useEffect(() => {
    setHistory(loadSessions(scholarClass));
    setPendingXPCount(loadAllPendingXP(scholarClass).length);
  }, [scholarClass]);

  // ===== Verify pending revision XP on mount + whenever activities change =====
  // XP is only awarded when an actual revision activity (flashcards / practice /
  // quiz) is completed AFTER the evaluation was submitted. One activity clears
  // exactly one pending record (oldest first) to prevent XP farming.
  useEffect(() => {
    const pending = loadAllPendingXP(scholarClass).sort((a, b) => a.startedAt - b.startedAt);
    if (pending.length === 0) return;

    const activityTimestamps = [
      ...flashcards.map((c) => c.lastReviewed),
      ...quizAttempts.map((q) => q.finishedAt),
    ].filter((ts) => ts > 0).sort((a, b) => a - b);

    if (activityTimestamps.length === 0) return;

    const usedTimestamps = new Set<number>();
    let awardedCount = 0;

    for (const p of pending) {
      const matchingTs = activityTimestamps.find(
        (ts) => ts > p.startedAt && !usedTimestamps.has(ts),
      );
      if (matchingTs === undefined) continue;
      usedTimestamps.add(matchingTs);
      addXP(10);
      addCoins(2);
      bumpStreak();
      clearPendingXP(scholarClass, p.chapterId);
      pushActivity({
        type: "session",
        text: `Revision XP awarded: ${p.chapterTitle} (+10 XP)`,
        icon: "✅",
      });
      awardedCount++;
    }

    if (awardedCount > 0) {
      // Refresh the pending-XP banner. This setState is intentional: it
      // reflects an external state change (localStorage) back into React.
      setPendingXPCount(loadAllPendingXP(scholarClass).length);
      toast.success(`Revision XP awarded! +${awardedCount * 10} XP`, {
        description: `${awardedCount} activity-verified session${awardedCount > 1 ? "s" : ""} completed`,
      });
    }
  }, [flashcards, quizAttempts, addXP, addCoins, bumpStreak, pushActivity, scholarClass]);

  // ===== Compute "Topics Due Today" — deterministic + spaced repetition =====
  const dueTopics = useMemo<DueTopic[]>(() => {
    const dayIndex = Math.floor(Date.now() / 86400000);
    const allSessions = sessions;
    const out: DueTopic[] = [];
    for (const sub of CURRICULUM) {
      const subMastery = mastery[sub.id] ?? 0;
      for (const ch of sub.chapters) {
        const progress = studyProgress[ch.id] ?? 0;
        if (progress === 0) continue; // not yet studied — skip
        const h = hashString(ch.id);
        // Spaced repetition interval depends on mastery:
        // low mastery → 1 day; medium → 3 days; high → 7 days; mastered → 14 days
        const baseInterval = subMastery < 40 ? 1 : subMastery < 60 ? 3 : subMastery < 80 ? 7 : 14;
        const lastReviewedTs = allSessions
          .filter((s) => s.subject === sub.id)
          .sort((a, b) => b.completedAt - a.completedAt)[0]?.completedAt ?? 0;
        const lastReviewedDay = Math.floor(lastReviewedTs / 86400000);
        const lastReviewedAgo = dayIndex - lastReviewedDay;
        // Deterministic due-today calc: chapter was last due N days ago; due today if (dayIndex - h) % interval === 0
        const dueToday = ((dayIndex + (h % baseInterval)) % baseInterval) === 0 || lastReviewedAgo >= baseInterval;
        const priority = (100 - subMastery) + (progress > 80 ? 5 : 15) + (dueToday ? 20 : 0);
        out.push({
          chapterId: ch.id, subjectId: sub.id, subjectName: sub.name, chapterTitle: ch.title,
          summary: ch.summary, mastery: subMastery, progress, interval: baseInterval,
          dueToday, lastReviewedAgo, priority,
        });
      }
    }
    return out.sort((a, b) => b.priority - a.priority);
  }, [studyProgress, mastery, sessions]);

  const dueTodayList = dueTopics.filter((t) => t.dueToday);
  const weakChapters = dueTopics.filter((t) => t.mastery < 50).slice(0, 12);
  const reviewedToday = history.filter((h) => Date.now() - h.at < 86400000).length;

  // ===== 14-day streak grid =====
  const streakGrid = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 14 }).map((_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (13 - i));
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 86400000;
      const count = sessions.filter((s) => s.completedAt >= dayStart && s.completedAt < dayEnd).length
                  + history.filter((h) => h.at >= dayStart && h.at < dayEnd).length;
      const isToday = i === 13;
      return { date: d, count, isToday };
    });
  }, [sessions, history]);

  // ===== One-Click Revision Session =====
  const startSession = async (topic: DueTopic) => {
    setActiveTopic(topic);
    setSessionStep("loading");
    setAiSummary(""); setKeyTerms([]); setReviewItems([]);
    try {
      const subject = CURRICULUM.find((s) => s.id === topic.subjectId);
      const chapter = subject?.chapters.find((c) => c.id === topic.chapterId);
      const prompt = `You are an academic revision coach. CBSE Class ${scholarClass} ${topic.subjectName} — Chapter: ${topic.chapterTitle}.
Summary: ${topic.summary}
Concepts: ${chapter?.concepts.join(", ") ?? "—"}
Formulas: ${chapter?.formulas?.join(", ") ?? "—"}

Provide:
1. A concise 4-5 sentence REVISION SUMMARY that recaps the chapter's core ideas, perfect for a 60-second refresher.
2. Exactly 8 KEY TERMS (single words or short phrases) that the student must remember — one per line.

Return strict JSON: {"summary":string,"keyTerms":[string,string,string,string,string,string,string,string]}.`;
      const result = await askAIJSON<{ summary: string; keyTerms: string[] }>(prompt, "default");
      if (!result) throw new Error("no result");
      setAiSummary(result.summary);
      setKeyTerms(result.keyTerms.slice(0, 8));
      setReviewItems(result.keyTerms.slice(0, 8).map((term) => ({ term, status: null })));
      setSessionStep("summary");
    } catch {
      toast.error("Could not start session. Please try again.");
      setActiveTopic(null);
    }
  };

  const markTerm = (idx: number, status: "weak" | "partial" | "strong") => {
    setReviewItems((items) => items.map((it, i) => i === idx ? { ...it, status } : it));
  };

  // ===== Submit evaluation → Revision Overview (NO instant XP) =====
  // XP is deferred until an actual revision activity is completed.
  const submitEvaluation = () => {
    if (!activeTopic) return;
    const weakTerms = reviewItems.filter((r) => r.status === "weak").map((r) => r.term);
    const partialTerms = reviewItems.filter((r) => r.status === "partial").map((r) => r.term);
    const strongTerms = reviewItems.filter((r) => r.status === "strong").map((r) => r.term);
    const remembered = strongTerms.length;
    const review = weakTerms.length + partialTerms.length;

    // Update mastery based on self-reported recall accuracy.
    // (Mastery reflects recall state — not a reward — so it stays here.)
    const delta = remembered > review ? 2 : review > remembered ? -1 : 0;
    const newMastery = Math.max(0, Math.min(100, (mastery[activeTopic.subjectId] ?? 0) + delta));
    setMastery(activeTopic.subjectId, newMastery);
    setStudyProgress(activeTopic.chapterId, Math.min(100, (studyProgress[activeTopic.chapterId] ?? 0) + 2));

    // Save session record with xp: 0 (XP is deferred until activity completion).
    const rec: SessionRecord = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      chapterId: activeTopic.chapterId, chapterTitle: activeTopic.chapterTitle,
      subjectName: activeTopic.subjectName, remembered, review, xp: 0, at: Date.now(),
    };
    const next = [rec, ...history].slice(0, 50);
    setHistory(next); saveSessions(scholarClass, next);

    // Save pending XP record — verified on next Revision Hub mount.
    savePendingXP(scholarClass, {
      chapterId: activeTopic.chapterId,
      chapterTitle: activeTopic.chapterTitle,
      subjectName: activeTopic.subjectName,
      startedAt: Date.now(),
      weakTerms, partialTerms, strongTerms,
    });
    setPendingXPCount(loadAllPendingXP(scholarClass).length);

    pushActivity({
      type: "session",
      text: `Revision evaluation: ${activeTopic.chapterTitle} (${strongTerms.length} strong · ${partialTerms.length} partial · ${weakTerms.length} weak)`,
      icon: "🔁",
    });
    toast.success("Revision overview ready", {
      description: "Complete a recommended activity to earn XP",
    });
    setSessionStep("overview");
  };

  // Deep-link to a recommended revision activity. Closes the dialog so the
  // destination view is visible; the pending XP record is verified on next mount.
  const goToActivity = (view: "flashcards" | "practice" | "quiz") => {
    setActiveTopic(null);
    navigateTo(view);
  };

  // ===== Forgotten Concepts (AI) =====
  const loadForgotten = async () => {
    setForgottenLoading(true);
    setForgottenTopics(null);
    try {
      // Pick the chapters with lowest mastery
      const weakest = [...dueTopics].sort((a, b) => a.mastery - b.mastery).slice(0, 5);
      const prompt = `You are a spaced-repetition tutor. Based on a CBSE Class ${scholarClass} student's data, identify concepts that are likely FORGOTTEN — i.e., chapters last reviewed long ago or with low mastery.

Student data:
${weakest.map((t) => `- ${t.subjectName}: "${t.chapterTitle}" (mastery ${t.mastery}%, last reviewed ${t.lastReviewedAgo}d ago)`).join("\n")}

Return JSON: {"forgotten":[{"chapterTitle":string,"subjectName":string,"concept":string,"reason":string}]}. Provide 5-8 items. Each "concept" should be a single topic the student should revisit; each "reason" should explain why it's likely forgotten (e.g., "Last reviewed 12 days ago — well past the 7-day retention window").`;
      const result = await askAIJSON<{ forgotten: { chapterTitle: string; subjectName: string; concept: string; reason: string }[] }>(prompt, "default");
      if (!result?.forgotten?.length) throw new Error("no result");
      // Cross-reference each forgotten topic back to its chapterId using the weakest list.
      setForgottenTopics(result.forgotten.map((f) => ({
        chapterId: weakest.find((w) => w.chapterTitle === f.chapterTitle && w.subjectName === f.subjectName)?.chapterId ?? "",
        chapterTitle: f.chapterTitle,
        subjectName: f.subjectName,
        concept: f.concept,
        reason: f.reason,
      })));
    } catch {
      toast.error("Could not load forgotten concepts.");
    } finally { setForgottenLoading(false); }
  };

  // ===== Export =====
  const exportRevision = () => {
    const bodyHtml = mdToHtml(`# Revision Hub — Daily Plan
Generated on ${new Date().toLocaleString()}.

## Topics Due Today (${dueTodayList.length})
${dueTodayList.length ? dueTodayList.map((t, i) => `${i + 1}. **${t.subjectName} → ${t.chapterTitle}** (mastery ${t.mastery}%, interval ${t.interval}d)\n   _${t.summary}_`).join("\n") : "_All caught up — nothing due today!_"}

## Weak Chapters (mastery < 50%)
${weakChapters.length ? weakChapters.map((t, i) => `${i + 1}. ${t.subjectName} → ${t.chapterTitle} — ${t.mastery}% mastery`).join("\n") : "_No weak chapters — great going!_"}

## 14-Day Streak Grid
${streakGrid.map((s, i) => `- ${s.date.toLocaleDateString()}: ${s.count} session(s)${s.isToday ? " (today)" : ""}`).join("\n")}

## Recent Sessions
${history.slice(0, 10).map((h, i) => `${i + 1}. ${h.subjectName} — ${h.chapterTitle}: ${h.remembered} remembered, ${h.review} to review (+${h.xp} XP) on ${new Date(h.at).toLocaleString()}`).join("\n") || "_No sessions yet_"}

> Generated by ${appName} Revision Hub.`);
    exportPDF({ title: "Revision Hub — Daily Plan", subtitle: `Streak: ${streak} days • ${reviewedToday} sessions today`, bodyHtml, accent: "#14b8a6", scholarClass });
    toast.success("Exporting revision plan…");
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&display=swap');
        .rh-font-serif { font-family: 'Instrument Serif', serif; }
        .rh-font-body { font-family: 'Inter', sans-serif; }
        .rh-glass { background: rgba(255,255,255,0.04); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.12); box-shadow: inset 0 1px 1px rgba(255,255,255,0.08); color: white; }
        .rh-glass-strong { background: rgba(255,255,255,0.07); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.16); box-shadow: inset 0 1px 1px rgba(255,255,255,0.1); color: white; }
        .rh-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .rh-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
      `}</style>

      <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover z-0">
        <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260511_230229_7c9bc431-46cf-489a-948d-e8144d8eb5d4.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 z-0 bg-black/55" />

      <div className="relative z-10 rh-font-body p-4 md:p-8 lg:p-12 max-w-7xl mx-auto">
        {/* HERO */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="grid place-items-center h-12 w-12 rounded-2xl bg-gradient-to-br from-teal-500/30 to-cyan-500/30 text-teal-300 border border-white/10">
              <RefreshCw className="h-6 w-6" />
            </div>
            <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/40">Spaced Repetition • CBSE Class ${scholarClass}</Badge>
          </div>
          <h1 className="rh-font-serif text-5xl md:text-6xl text-white leading-tight">
            Revision <em className="text-teal-300">Hub</em>
          </h1>
          <p className="text-white/70 mt-3 max-w-2xl">
            Smart spaced-repetition scheduling. Topics due today, weak chapters, AI-flagged forgotten
            concepts and a 14-day streak grid — everything you need to retain what you learn.
          </p>
          {pendingXPCount > 0 && (
            <div className="mt-4 rh-glass rounded-2xl p-4 flex items-center gap-3 border-l-2 border-amber-400/60">
              <div className="grid place-items-center h-9 w-9 rounded-xl bg-amber-500/15 text-amber-300 shrink-0">
                <Zap className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-white font-medium">{pendingXPCount} pending revision {pendingXPCount === 1 ? "session" : "sessions"}</p>
                <p className="text-xs text-white/60">Complete a flashcard review, practice set, or quiz to earn +10 XP per session.</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* STAT PILLS */}
        <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { icon: Clock, label: "Due Today", value: dueTodayList.length, accent: "#14b8a6" },
            { icon: TrendingDown, label: "Weak Chapters", value: weakChapters.length, accent: "#f43f5e" },
            { icon: Flame, label: "Streak", value: `${streak}d`, accent: "#f59e0b" },
            { icon: CheckCircle2, label: "Reviewed Today", value: reviewedToday, accent: "#6366f1" },
          ].map((s, i) => (
            <motion.div key={i} variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
              <StatCard icon={s.icon} label={s.label} value={s.value} accent={s.accent} />
            </motion.div>
          ))}
        </motion.div>

        <Tabs defaultValue="due" className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <TabsList className="rh-glass bg-transparent h-auto p-1 flex flex-wrap gap-1">
              <TabsTrigger value="due" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">Due Today {dueTodayList.length > 0 && <span className="ml-1.5 text-xs bg-teal-500/30 text-teal-200 rounded-full px-1.5">{dueTodayList.length}</span>}</TabsTrigger>
              <TabsTrigger value="weak" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">Weak</TabsTrigger>
              <TabsTrigger value="forgotten" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">Forgotten</TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">History</TabsTrigger>
            </TabsList>
            <Button variant="outline" size="sm" className="rh-glass bg-white/5 border-white/15 text-white hover:bg-white/10" onClick={exportRevision}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export plan
            </Button>
          </div>

          {/* ===== DUE TODAY ===== */}
          <TabsContent value="due" className="space-y-6">
            {/* Streak grid */}
            <div className="rh-glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold flex items-center gap-2"><Flame className="h-4 w-4 text-amber-400" /> 14-Day Streak Grid</h3>
                <span className="text-xs text-white/50">{streak} day streak</span>
              </div>
              <div className="grid grid-cols-7 md:grid-cols-14 gap-1.5">
                {streakGrid.map((s, i) => {
                  const intensity = Math.min(4, s.count);
                  const bg = s.count === 0 ? "rgba(255,255,255,0.05)" : `rgba(20,184,166,${0.25 + intensity * 0.18})`;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.03 }}
                      title={`${s.date.toLocaleDateString()} — ${s.count} session(s)`}
                      className="aspect-square rounded-md border border-white/10 flex items-center justify-center text-[10px] text-white/60 relative"
                      style={{ background: bg }}
                    >
                      {s.isToday && <span className="absolute inset-0 rounded-md ring-2 ring-amber-400/70" />}
                      <span className="relative">{s.date.getDate()}</span>
                    </motion.div>
                  );
                })}
              </div>
              <div className="flex items-center gap-3 mt-3 text-xs text-white/50">
                <span>Less</span>
                {[0.05, 0.43, 0.61, 0.79, 0.97].map((o, i) => (
                  <span key={i} className="h-3 w-3 rounded-sm" style={{ background: `rgba(20,184,166,${o})` }} />
                ))}
                <span>More</span>
              </div>
            </div>

            {/* Due today list */}
            <div>
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><Clock className="h-4 w-4 text-teal-300" /> Topics Due Today ({dueTodayList.length})</h3>
              {dueTodayList.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="All caught up!" description="No chapters are due for revision today. Come back tomorrow or check the Weak tab." />
              ) : (
                <div className="space-y-3">
                  {dueTodayList.map((t, i) => {
                    const sub = CURRICULUM.find((s) => s.id === t.subjectId)!;
                    return (
                      <motion.div key={t.chapterId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.05, 0.4) }}
                        className="rh-glass rounded-2xl p-5 flex items-center gap-4 flex-wrap">
                        <ProgressRing value={t.progress} size={56} stroke={5} color={sub.accent} label={<span className="text-[10px] text-white/80">{t.progress}%</span>} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge style={{ background: `${sub.accent}22`, color: sub.accent, border: `${sub.accent}55` }}>{t.subjectName}</Badge>
                            <span className="text-xs text-white/50">Mastery {t.mastery}% • Interval {t.interval}d • Last reviewed {t.lastReviewedAgo}d ago</span>
                          </div>
                          <h4 className="text-white font-medium">{t.chapterTitle}</h4>
                          <p className="text-sm text-white/60 line-clamp-1 mt-0.5">{t.summary}</p>
                        </div>
                        <Button className="bg-teal-500 hover:bg-teal-600 text-white" onClick={() => startSession(t)}>
                          <Play className="h-3.5 w-3.5 mr-1.5" /> Revise now
                        </Button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ===== WEAK ===== */}
          <TabsContent value="weak" className="space-y-6">
            <div className="rh-glass rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-white font-semibold">Weak Chapters (mastery &lt; 50%)</h3>
                <p className="text-sm text-white/70 mt-0.5">These chapters need urgent revision. Click any to start a 60-second AI revision session.</p>
              </div>
            </div>

            {weakChapters.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="No weak chapters!" description="All your subjects are above 50% mastery. Keep up the great work." />
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {weakChapters.map((t, i) => {
                  const sub = CURRICULUM.find((s) => s.id === t.subjectId)!;
                  return (
                    <motion.div key={t.chapterId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}
                      className="rh-glass rounded-2xl p-5 border-l-2" style={{ borderLeftColor: sub.accent }}>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <Badge style={{ background: `${sub.accent}22`, color: sub.accent, border: `${sub.accent}55` }}>{t.subjectName}</Badge>
                          <h4 className="text-white font-medium mt-2">{t.chapterTitle}</h4>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-rose-300 tabular-nums">{t.mastery}%</p>
                          <p className="text-xs text-white/50">mastery</p>
                        </div>
                      </div>
                      <p className="text-sm text-white/60 line-clamp-2 mb-3">{t.summary}</p>
                      <Progress value={t.mastery} className="bg-white/10 h-1.5 mb-3" />
                      <Button size="sm" className="bg-teal-500 hover:bg-teal-600 text-white w-full" onClick={() => startSession(t)}>
                        <Play className="h-3.5 w-3.5 mr-1.5" /> Start revision session
                      </Button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ===== FORGOTTEN ===== */}
          <TabsContent value="forgotten" className="space-y-6">
            <div className="rh-glass rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3">
                  <div className="grid place-items-center h-10 w-10 rounded-xl bg-fuchsia-500/20 text-fuchsia-300 shrink-0">
                    <Brain className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">AI-Forgotten Concepts</h3>
                    <p className="text-sm text-white/70 mt-0.5">The AI analyses your mastery and review history to flag concepts likely slipping from memory.</p>
                  </div>
                </div>
                <Button className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white" onClick={loadForgotten} disabled={forgottenLoading}>
                  {forgottenLoading ? (
                    <><motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="inline-block"><RefreshCw className="h-3.5 w-3.5 mr-1.5" /></motion.span> Analysing…</>
                  ) : (
                    <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> {forgottenTopics ? "Re-analyse" : "Run AI analysis"}</>
                  )}
                </Button>
              </div>
            </div>

            {!forgottenTopics && !forgottenLoading && (
              <EmptyState icon={Brain} title="No analysis yet" description="Click 'Run AI analysis' to detect concepts you might be forgetting based on your study history." />
            )}

            {forgottenLoading && (
              <div className="rh-glass rounded-2xl p-12 text-center">
                <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>
                  <Brain className="h-10 w-10 text-fuchsia-300 mx-auto" />
                </motion.div>
                <p className="text-white/70 mt-3 text-sm">AI is reviewing your study history…</p>
              </div>
            )}

            {forgottenTopics && !forgottenLoading && (
              <div className="space-y-3">
                {forgottenTopics.map((f, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                    className="rh-glass rounded-2xl p-5 border-l-2 border-fuchsia-500/50">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge className="bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40">{f.subjectName}</Badge>
                      <span className="text-xs text-white/50">{f.chapterTitle}</span>
                    </div>
                    <h4 className="text-white font-medium mb-1.5">{f.concept}</h4>
                    <p className="text-sm text-white/60">{f.reason}</p>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ===== HISTORY ===== */}
          <TabsContent value="history" className="space-y-4">
            <div className="rh-glass rounded-2xl p-4">
              <h3 className="text-white font-semibold flex items-center gap-2"><History className="h-4 w-4 text-teal-300" /> Revision Sessions</h3>
              <p className="text-xs text-white/60 mt-0.5">{history.length} sessions logged locally.</p>
            </div>
            {history.length === 0 ? (
              <EmptyState icon={History} title="No sessions yet" description="Start a revision session from any topic — your progress will appear here." />
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto rh-scroll pr-2">
                {history.map((h, i) => (
                  <motion.div key={h.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}
                    className="rh-glass rounded-xl p-4 flex items-center gap-3">
                    <div className="grid place-items-center h-10 w-10 rounded-xl bg-teal-500/15 text-teal-300 shrink-0">
                      <RefreshCw className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{h.chapterTitle}</p>
                      <p className="text-xs text-white/50">{h.subjectName} • {new Date(h.at).toLocaleString()}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm text-white">
                        <span className="text-emerald-300">{h.remembered}</span> / <span className="text-amber-300">{h.review}</span>
                      </p>
                      <p className="text-xs text-white/50">{h.xp > 0 ? `+${h.xp} XP` : "Pending"}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* SESSION DIALOG */}
        <Dialog open={!!activeTopic} onOpenChange={(o) => { if (!o) setActiveTopic(null); }}>
          <DialogContent className="rh-glass-strong !bg-black/60 !border-white/20 max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="rh-font-serif text-2xl text-white flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-teal-300" /> Revision Session
              </DialogTitle>
              <DialogDescription className="text-white/70">
                {activeTopic?.subjectName} • {activeTopic?.chapterTitle}
              </DialogDescription>
            </DialogHeader>

            <AnimatePresence mode="wait">
              {sessionStep === "loading" && (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="py-12 text-center">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} className="inline-block">
                    <Brain className="h-10 w-10 text-teal-300" />
                  </motion.div>
                  <p className="text-white/70 mt-3 text-sm">AI is preparing your revision summary…</p>
                </motion.div>
              )}

              {sessionStep === "summary" && (
                <motion.div key="summary" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                  <div className="rh-glass rounded-xl p-4">
                    <h4 className="text-white font-semibold mb-2 flex items-center gap-2"><BookOpen className="h-4 w-4 text-teal-300" /> Revision Summary</h4>
                    <p className="text-sm text-white/80 leading-relaxed">{aiSummary}</p>
                  </div>
                  <div className="rh-glass rounded-xl p-4">
                    <h4 className="text-white font-semibold mb-2 flex items-center gap-2"><Target className="h-4 w-4 text-amber-300" /> Key Terms to Recall ({keyTerms.length})</h4>
                    <div className="flex flex-wrap gap-2">
                      {keyTerms.map((t, i) => (
                        <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-white/[0.06] text-white/80 border border-white/10">{t}</span>
                      ))}
                    </div>
                  </div>
                  <DialogFooter className="gap-2">
                    <Button variant="ghost" className="text-white/70" onClick={() => setActiveTopic(null)}>Skip</Button>
                    <Button className="bg-teal-500 hover:bg-teal-600 text-white" onClick={() => setSessionStep("review")}>
                      <ArrowRight className="h-3.5 w-3.5 mr-1.5" /> Test recall
                    </Button>
                  </DialogFooter>
                </motion.div>
              )}

              {sessionStep === "review" && (
                <motion.div key="review" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                  <p className="text-sm text-white/70">For each term, rate your recall as <strong className="text-rose-300">weak</strong>, <strong className="text-amber-300">partial</strong>, or <strong className="text-emerald-300">strong</strong>.</p>
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto rh-scroll pr-1">
                    {reviewItems.map((r, i) => (
                      <div key={i} className="rh-glass rounded-xl p-3 flex items-center gap-2 flex-wrap">
                        <span className="text-white text-sm flex-1 min-w-[8rem]">{r.term}</span>
                        <button onClick={() => markTerm(i, "weak")}
                          className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                            r.status === "weak" ? "bg-rose-500/30 border-rose-500/50 text-rose-200" : "bg-white/5 border-white/15 text-white/70 hover:bg-white/10")}>
                          <XCircle className="h-3 w-3 inline mr-1" /> Weak
                        </button>
                        <button onClick={() => markTerm(i, "partial")}
                          className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                            r.status === "partial" ? "bg-amber-500/30 border-amber-500/50 text-amber-200" : "bg-white/5 border-white/15 text-white/70 hover:bg-white/10")}>
                          <Lightbulb className="h-3 w-3 inline mr-1" /> Partial
                        </button>
                        <button onClick={() => markTerm(i, "strong")}
                          className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                            r.status === "strong" ? "bg-emerald-500/30 border-emerald-500/50 text-emerald-200" : "bg-white/5 border-white/15 text-white/70 hover:bg-white/10")}>
                          <CheckCircle2 className="h-3 w-3 inline mr-1" /> Strong
                        </button>
                      </div>
                    ))}
                  </div>
                  <DialogFooter>
                    <Button className="bg-teal-500 hover:bg-teal-600 text-white"
                      disabled={reviewItems.some((r) => r.status === null)}
                      onClick={submitEvaluation}>
                      <ArrowRight className="h-3.5 w-3.5 mr-1.5" /> Generate Revision Overview
                    </Button>
                  </DialogFooter>
                </motion.div>
              )}

              {sessionStep === "overview" && activeTopic && (() => {
                const weakTerms = reviewItems.filter((r) => r.status === "weak").map((r) => r.term);
                const partialTerms = reviewItems.filter((r) => r.status === "partial").map((r) => r.term);
                const strongTerms = reviewItems.filter((r) => r.status === "strong").map((r) => r.term);
                // Suggested revision order: weak → partial → strong (lowest confidence first)
                const revisionOrder = [
                  ...weakTerms.map((t) => ({ term: t, tier: "weak" as const })),
                  ...partialTerms.map((t) => ({ term: t, tier: "partial" as const })),
                  ...strongTerms.map((t) => ({ term: t, tier: "strong" as const })),
                ];
                // Estimated time: weak 5min, partial 3min, strong 1min each.
                const estMinutes = weakTerms.length * 5 + partialTerms.length * 3 + strongTerms.length * 1;
                const tierColor = { weak: "text-rose-300", partial: "text-amber-300", strong: "text-emerald-300" };
                const tierBg = { weak: "bg-rose-500/15 border-rose-500/40", partial: "bg-amber-500/15 border-amber-500/40", strong: "bg-emerald-500/15 border-emerald-500/40" };
                return (
                  <motion.div key="overview" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                    <div className="rh-glass rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                        <h4 className="text-white font-semibold flex items-center gap-2"><Target className="h-4 w-4 text-teal-300" /> Revision Overview</h4>
                        <span className="text-xs text-white/60 flex items-center gap-1"><Clock className="h-3 w-3" /> Est. {estMinutes} min</span>
                      </div>
                      <p className="text-xs text-white/60">Complete any recommended activity below to earn <strong className="text-teal-300">+10 XP</strong>. XP is awarded automatically when you return.</p>
                    </div>

                    {/* Categorized terms */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className={cn("rh-glass rounded-xl p-3 border", tierBg.weak)}>
                        <p className={cn("text-xs uppercase tracking-wider font-semibold mb-2", tierColor.weak)}>Weak · {weakTerms.length}</p>
                        {weakTerms.length === 0 ? <p className="text-[11px] text-white/40">None</p> : (
                          <ul className="space-y-1">{weakTerms.map((t, i) => <li key={i} className="text-xs text-white/80">• {t}</li>)}</ul>
                        )}
                      </div>
                      <div className={cn("rh-glass rounded-xl p-3 border", tierBg.partial)}>
                        <p className={cn("text-xs uppercase tracking-wider font-semibold mb-2", tierColor.partial)}>Partial · {partialTerms.length}</p>
                        {partialTerms.length === 0 ? <p className="text-[11px] text-white/40">None</p> : (
                          <ul className="space-y-1">{partialTerms.map((t, i) => <li key={i} className="text-xs text-white/80">• {t}</li>)}</ul>
                        )}
                      </div>
                      <div className={cn("rh-glass rounded-xl p-3 border", tierBg.strong)}>
                        <p className={cn("text-xs uppercase tracking-wider font-semibold mb-2", tierColor.strong)}>Strong · {strongTerms.length}</p>
                        {strongTerms.length === 0 ? <p className="text-[11px] text-white/40">None</p> : (
                          <ul className="space-y-1">{strongTerms.map((t, i) => <li key={i} className="text-xs text-white/80">• {t}</li>)}</ul>
                        )}
                      </div>
                    </div>

                    {/* Suggested revision order */}
                    <div className="rh-glass rounded-xl p-4">
                      <h5 className="text-white text-sm font-semibold mb-2 flex items-center gap-2"><RefreshCw className="h-3.5 w-3.5 text-teal-300" /> Suggested Revision Order</h5>
                      {revisionOrder.length === 0 ? <p className="text-xs text-white/40">No terms yet.</p> : (
                        <ol className="space-y-1">{revisionOrder.map((item, i) => (
                          <li key={i} className="text-xs text-white/80 flex items-center gap-2">
                            <span className="text-white/40 font-mono w-5">{i + 1}.</span>
                            <span className={cn("px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider", tierBg[item.tier], tierColor[item.tier])}>{item.tier}</span>
                            <span className="flex-1">{item.term}</span>
                          </li>
                        ))}</ol>
                      )}
                    </div>

                    {/* Recommended actions (deep links) */}
                    <div className="rh-glass rounded-xl p-4">
                      <h5 className="text-white text-sm font-semibold mb-3 flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-fuchsia-300" /> Recommended Actions</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button onClick={() => goToActivity("flashcards")}
                          className="flex flex-col items-start gap-1 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-left">
                          <Layers className="h-4 w-4 text-amber-300" />
                          <span className="text-xs font-medium text-white">Review 10 flashcards</span>
                          <span className="text-[10px] text-white/40">Spaced repetition</span>
                        </button>
                        <button onClick={() => goToActivity("practice")}
                          className="flex flex-col items-start gap-1 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-left">
                          <ListChecks className="h-4 w-4 text-cyan-300" />
                          <span className="text-xs font-medium text-white">Solve 5 practice questions</span>
                          <span className="text-[10px] text-white/40">Active recall</span>
                        </button>
                        <button onClick={() => goToActivity("quiz")}
                          className="flex flex-col items-start gap-1 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-left">
                          <FileQuestion className="h-4 w-4 text-rose-300" />
                          <span className="text-xs font-medium text-white">Take a quick quiz</span>
                          <span className="text-[10px] text-white/40">Test yourself</span>
                        </button>
                      </div>
                    </div>

                    <DialogFooter className="gap-2">
                      <Button variant="ghost" className="text-white/70" onClick={() => setActiveTopic(null)}>Close</Button>
                    </DialogFooter>
                  </motion.div>
                );
              })()}
            </AnimatePresence>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export default RevisionHubView;
