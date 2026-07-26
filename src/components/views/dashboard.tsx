"use client";

import { useStore, getLevelInfo } from "@/lib/store";
import { useCurriculum } from "@/lib/use-curriculum";
import { CURRICULUM } from "@/lib/curriculum";
import { StatCard, SectionHeader, ProgressRing, EmptyState } from "@/lib/shared";
import { exportPDF, mdToHtml } from "@/lib/pdf";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Flame,
  Coins,
  Zap,
  Target,
  Calendar,
  TrendingUp,
  Sparkles,
  Download,
  Trophy,
  Clock,
  Award,
  CheckCircle2,
  Layers,
  ListChecks,
  FileQuestion,
} from "lucide-react";
import { toast } from "sonner";
import { navigateTo } from "@/lib/nav-event";
import { ReadyBackgroundVideo } from "@/components/ready-background-video";

// ===== Daily Challenge — pending state in localStorage =====
// XP is NOT awarded on click. Instead, the user is redirected to the
// activity; XP is awarded only when the activity is verified complete.
const DAILY_CHALLENGE_PREFIX = "scholar:daily-challenge:";

interface PendingDailyChallenge {
  activity: string;
  label: string;
  view: string;
  startedAt: number;
  completed: boolean;
  completedAt?: number;
}

const CHALLENGES = [
  { id: "practice", label: "Solve 5 practice questions", view: "practice", icon: ListChecks },
  { id: "flashcards", label: "Review 10 flashcards", view: "flashcards", icon: Layers },
  { id: "quiz", label: "Take a quick quiz", view: "quiz", icon: FileQuestion },
] as const;

function getTodayChallenge() {
  const dayIndex = Math.floor(Date.now() / 86400000);
  return CHALLENGES[dayIndex % CHALLENGES.length];
}

function dailyChallengeKey() {
  return DAILY_CHALLENGE_PREFIX + new Date().toISOString().slice(0, 10);
}

function loadPendingDaily(): PendingDailyChallenge | null {
  if (typeof window === "undefined") return null;
  try {
    const v = JSON.parse(localStorage.getItem(dailyChallengeKey()) || "null");
    return v && v.activity ? v : null;
  } catch { return null; }
}

function savePendingDaily(data: PendingDailyChallenge) {
  try { localStorage.setItem(dailyChallengeKey(), JSON.stringify(data)); } catch { /* ignore */ }
}

// ===== helpers =====
const todayStr = () => new Date().toISOString().slice(0, 10);

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Burning the midnight oil";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

function fmtDate() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function relTime(at: number) {
  const diff = Date.now() - at;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function dayKey(offset: number) {
  // offset = days from today (0 = today, negative = past)
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

// Streak heatmap intensity from sessions for a given day
function intensityForDay(sessions: { completedAt: number }[], dateKey: string) {
  const dayStart = new Date(dateKey).getTime();
  const dayEnd = dayStart + 86_400_000;
  const count = sessions.filter(
    (s) => s.completedAt >= dayStart && s.completedAt < dayEnd
  ).length;
  return Math.min(4, count);
}

const HEATMAP_COLORS = [
  "bg-muted/50",
  "bg-teal-500/25",
  "bg-teal-500/45",
  "bg-teal-500/70",
  "bg-teal-400",
];

const HEATMAP_OPACITY = [0.08, 0.25, 0.45, 0.7, 1];

// ===== DashboardView =====
export function DashboardView() {
  const user = useStore((s) => s.user);
  const CURRICULUM = useCurriculum();
  const xp = useStore((s) => s.xp);
  const coins = useStore((s) => s.coins);
  const streak = useStore((s) => s.streak);
  const mastery = useStore((s) => s.mastery);
  const tasks = useStore((s) => s.tasks);
  const sessions = useStore((s) => s.sessions);
  const quizAttempts = useStore((s) => s.quizAttempts);
  const flashcards = useStore((s) => s.flashcards);
  const activity = useStore((s) => s.activity);
  const dailyChallenge = useStore((s) => s.dailyChallenge);
  const addXP = useStore((s) => s.addXP);
  const toggleTask = useStore((s) => s.toggleTask);
  const completeDailyChallenge = useStore((s) => s.completeDailyChallenge);
  const pushActivity = useStore((s) => s.pushActivity);

  // Pending daily challenge state (localStorage-backed).
  const [pendingDaily, setPendingDaily] = useState<PendingDailyChallenge | null>(() => loadPendingDaily());
  const todayChallenge = getTodayChallenge();
  const TodayIcon = todayChallenge.icon;

  // ===== Verify pending daily challenge on mount + activity changes =====
  // XP is only awarded when the redirected activity is verified complete.
  useEffect(() => {
    const pending = loadPendingDaily();
    if (!pending || pending.completed) return;

    // Verify the activity was actually completed after `startedAt`.
    let verified = false;
    if (pending.activity === "flashcards") {
      verified = flashcards.some((c) => c.lastReviewed > pending.startedAt);
    } else if (pending.activity === "practice" || pending.activity === "quiz") {
      verified = quizAttempts.some((q) => q.finishedAt > pending.startedAt);
    }

    if (!verified) return;

    // Mark complete in localStorage FIRST to prevent duplicate awards on re-renders.
    const completed: PendingDailyChallenge = { ...pending, completed: true, completedAt: Date.now() };
    savePendingDaily(completed);

    // Award XP/coins/streak via the store action (it has its own duplicate guard).
    // The store update triggers the UI to switch to the "Completed today ✓" state.
    completeDailyChallenge();
    toast.success("Daily Challenge complete! 🎉", {
      description: "+30 XP · +15 coins",
    });
    pushActivity({
      type: "daily-challenge",
      text: `Completed today's daily challenge: ${pending.label} (+30 XP)`,
      icon: "🏆",
    });
  }, [flashcards, quizAttempts, completeDailyChallenge, pushActivity]);

  const level = getLevelInfo(xp);
  const overallMastery = Math.round(
    CURRICULUM.reduce((sum, s) => sum + (mastery[s.id] ?? 0), 0) /
      (CURRICULUM.length || 1)
  );

  // Today's tasks
  const todayTasks = tasks
    .filter((t) => t.date === todayStr())
    .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
  const todayDone = todayTasks.filter((t) => t.done).length;
  const todayPct =
    todayTasks.length === 0 ? 0 : Math.round((todayDone / todayTasks.length) * 100);

  // Upcoming deadlines
  const upcoming = tasks
    .filter((t) => !t.done && t.date >= todayStr())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  // Recent activity (last 5)
  const recent = [...activity].sort((a, b) => b.at - a.at).slice(0, 5);

  // Streak heatmap (last 14 days, oldest → newest)
  const heatDays = Array.from({ length: 14 }, (_, i) => {
    const offset = -13 + i;
    const key = dayKey(offset);
    return { key, offset, level: intensityForDay(sessions, key) };
  });

  // Weekly report (last 7 days)
  const weekStart = Date.now() - 7 * 86_400_000;
  const weekSessions = sessions.filter((s) => s.completedAt >= weekStart);
  const weekMinutes = Math.round(
    weekSessions.reduce((sum, s) => sum + s.duration, 0) / 60
  );
  const weekQuizzes = quizAttempts.filter((q) => q.finishedAt >= weekStart);
  const weekAvgScore =
    weekQuizzes.length === 0
      ? 0
      : Math.round(
          (weekQuizzes.reduce((sum, q) => sum + (q.score / q.total) * 100, 0) /
            weekQuizzes.length)
        );

  // Insights
  const bestSubject = CURRICULUM.reduce(
    (best, s) => ((mastery[s.id] ?? 0) > (mastery[best.id] ?? 0) ? s : best),
    CURRICULUM[0]
  );
  const weakestSubject = CURRICULUM.reduce(
    (worst, s) => ((mastery[s.id] ?? 100) < (mastery[worst.id] ?? 100) ? s : worst),
    CURRICULUM[0]
  );
  const insights = [
    `Strongest subject: ${bestSubject.name} (${mastery[bestSubject.id] ?? 0}%). Keep the momentum going!`,
    weekMinutes > 0
      ? `You studied ${weekMinutes} min across ${weekSessions.length} sessions this week — aim for 200+ next week.`
      : `No focus sessions logged this week. Start a 25-min pomodoro to build your streak.`,
  ];

  function handleToggleTask(id: string, done: boolean) {
    toggleTask(id);
    if (!done) {
      addXP(5);
      toast.success("+5 XP", { description: "Goal completed — great job!" });
      pushActivity({ type: "task", text: "Completed a study goal", icon: "✅" });
    }
  }

  function handleDailyChallenge() {
    // Do NOT award XP here — that happens only after activity verification.
    const pending = loadPendingDaily();

    // Already completed today — duplicate guard.
    if (pending?.completed || dailyChallenge.completed) {
      toast.info("Already completed today's challenge", {
        description: "Come back tomorrow for a new one!",
      });
      return;
    }

    // Already started but not completed — resume the activity.
    if (pending && !pending.completed) {
      navigateTo(pending.view);
      toast.info("Continue your challenge", { description: pending.label });
      return;
    }

    // Start a fresh challenge — record pending state and redirect.
    const fresh: PendingDailyChallenge = {
      activity: todayChallenge.id,
      label: todayChallenge.label,
      view: todayChallenge.view,
      startedAt: Date.now(),
      completed: false,
    };
    savePendingDaily(fresh);
    setPendingDaily(fresh);
    navigateTo(todayChallenge.view);
    toast.success("Challenge started! 🎯", {
      description: `${todayChallenge.label} · complete it to earn +30 XP`,
    });
  }

  function handleExportReport() {
    const md = `## Weekly Report — Last 7 Days

- **Total study time:** ${weekMinutes} minutes
- **Focus sessions:** ${weekSessions.length}
- **Quizzes taken:** ${weekQuizzes.length}
- **Average quiz score:** ${weekAvgScore}%
- **Current streak:** ${streak} days
- **Overall mastery:** ${overallMastery}%

### Insights
${insights.map((i) => `- ${i}`).join("\n")}

### Subject Mastery
${CURRICULUM.map((s) => `- ${s.name}: ${mastery[s.id] ?? 0}%`).join("\n")}
`;
    exportPDF({
      title: "Weekly Report",
      subtitle: "Last 7 days",
      bodyHtml: mdToHtml(md),
      scholarClass: user.scholarClass,
    });
    toast.success("Opening PDF…", { description: "Weekly report ready to print" });
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-[#010101] overflow-hidden -m-4 lg:-m-6">
      <style>{`
        @import url('https://db.onlinewebfonts.com/c/2bf40ab72ea4897a3fd9b6e48b233a19?family=Garamond');
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500&display=swap');
        .dash-glass {
          background: rgba(255,255,255,0.01);
          background-blend-mode: luminosity;
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          border: none;
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.1);
          position: relative;
          overflow: hidden;
        }
        .dash-glass::before {
          content: '';
          position: absolute; inset: 0;
          border-radius: inherit;
          padding: 1.4px;
          background: linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 20%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.15) 80%, rgba(255,255,255,0.45) 100%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .dash-glass-strong {
          background: rgba(255,255,255,0.01);
          backdrop-filter: blur(50px);
          -webkit-backdrop-filter: blur(50px);
          border: none;
          box-shadow: 4px 4px 4px rgba(0,0,0,0.05), inset 0 1px 1px rgba(255,255,255,0.15);
          position: relative;
          overflow: hidden;
        }
        .dash-glass-strong::before {
          content: '';
          position: absolute; inset: 0;
          border-radius: inherit;
          padding: 1.4px;
          background: linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.2) 20%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.2) 80%, rgba(255,255,255,0.5) 100%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .font-garamond { font-family: 'Garamond', 'Times New Roman', serif; }
        .font-geist { font-family: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif; }
        .dash-glass:hover { background: rgba(255,255,255,0.04); }
      `}</style>

      {/* Background video */}
      <ReadyBackgroundVideo
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260619_191346_9d19d66e-86a4-47f7-8dc6-712c1788c3b2.mp4"
        className="z-0"
        readinessId="dashboard"
      />
      <div className="absolute inset-0 z-0 bg-black/40" />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-[calc(100vh-4rem)]">
        {/* Navbar */}
        <nav className="relative z-20 px-5 sm:px-8 py-6 flex items-center justify-between">
          <span className="font-geist text-white font-light uppercase tracking-[0.25em] sm:tracking-[0.3em] text-sm">
            {user.scholarClass === 11 ? "Ishan's Scholar" : "Neha's Scholar"}
          </span>
          <div className="hidden md:flex items-center gap-8">
            {[
              { label: "Dashboard", view: "dashboard" },
              { label: "Analytics", view: "analytics" },
              { label: "Community", view: "community" },
              { label: "Settings", view: "settings" },
            ].map((link) => (
              <button
                key={link.label}
                type="button"
                onClick={() => navigateTo(link.view)}
                className="font-geist text-white/80 text-sm uppercase tracking-[0.2em] font-light hover:text-white hover:opacity-100 transition-colors duration-300 cursor-pointer focus:outline-none focus:text-white"
              >
                {link.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Hero content */}
        <div className="relative z-10 flex flex-col items-center text-center px-5 sm:px-8 pt-4 sm:pt-8 pb-6">
          {/* Greeting + date */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex items-center gap-3 mb-4"
          >
            <span className="dash-glass rounded-full px-4 py-1.5 text-xs text-white/80 font-geist uppercase tracking-widest">
              {greeting()}, {user.name.split(" ")[0]} · Class {user.scholarClass} CBSE{user.jeeMode ? " · JEE" : ""}
            </span>
            <span className="text-xs text-white/50 font-geist hidden sm:inline">{fmtDate()}</span>
          </motion.div>

          {/* Heading */}
          <h1 className="font-garamond font-normal text-white text-4xl sm:text-6xl md:text-7xl lg:text-8xl leading-[1.08] tracking-tight mb-4 sm:mb-6">
            <span className="block">WITNESS YOUR</span>
            <span className="block">GROWTH UNFOLD</span>
          </h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.6 }}
            className="font-geist font-light text-white/70 text-sm sm:text-base lg:text-lg leading-relaxed max-w-xs sm:max-w-md mb-6 sm:mb-8"
          >
            An odyssey through your study journey, revealed by data and curiosity.
          </motion.p>

          {/* Level ring + badges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 2.0 }}
            className="flex items-center gap-4 mb-6"
          >
            <div className="dash-glass rounded-full px-4 py-2 flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5 text-white/70" />
              <span className="text-sm text-white font-geist">Level {level.level}</span>
            </div>
            <div className="dash-glass rounded-full px-4 py-2 flex items-center gap-2">
              <Flame className="h-3.5 w-3.5 text-white/70" />
              <span className="text-sm text-white font-geist">{streak}-day streak</span>
            </div>
            <div className="dash-glass rounded-full px-4 py-2 flex items-center gap-2">
              <Target className="h-3.5 w-3.5 text-white/70" />
              <span className="text-sm text-white font-geist">{overallMastery}% mastery</span>
            </div>
          </motion.div>
        </div>

        {/* Stats row */}
        <div className="relative z-10 px-4 sm:px-8 max-w-5xl mx-auto w-full grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { icon: Flame, label: "Streak", value: `${streak} days`, sub: "Keep it alive!" },
            { icon: Zap, label: "XP", value: xp.toLocaleString(), sub: `${level.intoLevel}/${level.needed} to Lv ${level.level + 1}` },
            { icon: Coins, label: "Coins", value: coins.toLocaleString(), sub: "Spend in store" },
            { icon: Target, label: "Mastery", value: `${overallMastery}%`, sub: "All subjects" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.2 + i * 0.1 }}>
              <div className="dash-glass rounded-2xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="grid place-items-center h-9 w-9 rounded-xl bg-white/5">
                    <s.icon className="h-4 w-4 text-white/80" />
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-white/40 font-geist">{s.label}</span>
                </div>
                <p className="text-2xl font-garamond text-white tabular-nums">{s.value}</p>
                <p className="text-[11px] text-white/50 mt-0.5 font-geist">{s.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Daily challenge */}
        <div className="relative z-10 px-4 sm:px-8 max-w-5xl mx-auto w-full mb-6">
          {!dailyChallenge.completed ? (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 2.6 }}>
              <div className="dash-glass-strong rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="grid place-items-center h-11 w-11 rounded-2xl bg-white/10 text-white shrink-0">
                    <TodayIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-geist font-medium text-white">Today's Daily Challenge</h3>
                    <p className="text-sm text-white/50 mt-1 font-geist">
                      {todayChallenge.label} · +30 XP · +15 coins
                    </p>
                    {pendingDaily && !pendingDaily.completed && (
                      <p className="text-[11px] text-amber-300/80 mt-1 font-geist">In progress — complete the activity to earn XP</p>
                    )}
                  </div>
                </div>
                <button onClick={handleDailyChallenge} className="dash-glass rounded-full px-6 py-2.5 text-sm text-white font-geist uppercase tracking-[0.18em] hover:bg-white/5 transition-colors shrink-0">
                  {pendingDaily && !pendingDaily.completed ? "Continue Challenge" : "Start Challenge"}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="dash-glass rounded-3xl p-5 flex items-center gap-3">
                <div className="grid place-items-center h-10 w-10 rounded-2xl bg-white/10 text-white shrink-0">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-geist font-medium text-white">Daily challenge completed ✓</p>
                  <p className="text-xs text-white/50 mt-0.5 font-geist">Streak: {dailyChallenge.streak} days — come back tomorrow!</p>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Main grid */}
        <div className="relative z-10 px-4 sm:px-8 max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 mb-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-4 lg:space-y-6">
            {/* Today's goals */}
            <div className="dash-glass rounded-3xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-garamond text-xl text-white">Today's Goals</h3>
                  <p className="text-xs text-white/50 font-geist">{todayDone}/{todayTasks.length} completed</p>
                </div>
                <span className="dash-glass rounded-full px-3 py-1 text-xs text-white font-geist">{todayPct}%</span>
              </div>
              {todayTasks.length === 0 ? (
                <p className="text-sm text-white/50 font-geist py-6 text-center">No goals for today. Add tasks in the Planner.</p>
              ) : (
                <div className="space-y-2.5">
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-3">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${todayPct}%` }} transition={{ duration: 0.7 }} className="h-full rounded-full bg-white/60" />
                  </div>
                  {todayTasks.map((task) => {
                    const subj = CURRICULUM.find((s) => s.id === task.subject);
                    return (
                      <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors">
                        <Checkbox checked={task.done} onCheckedChange={() => handleToggleTask(task.id, task.done)} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-geist truncate ${task.done ? "line-through text-white/40" : "text-white"}`}>{task.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {subj && (
                              <span className="flex items-center gap-1 text-[11px] text-white/50 font-geist">
                                <span className="h-1.5 w-1.5 rounded-full" style={{ background: subj.accent }} />
                                {subj.name}
                              </span>
                            )}
                            {task.time && <span className="text-[11px] text-white/40 font-mono">{task.time}</span>}
                          </div>
                        </div>
                        {task.priority === "high" && (
                          <span className="dash-glass rounded-full px-2 py-0.5 text-[10px] text-white/60 font-geist">High</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Subject mastery */}
            <div className="dash-glass rounded-3xl p-5">
              <div className="mb-4">
                <h3 className="font-garamond text-xl text-white">Subject Mastery</h3>
                <p className="text-xs text-white/50 font-geist">Across your 5 CBSE subjects</p>
              </div>
              <div className="space-y-3.5">
                {CURRICULUM.map((subject) => {
                  const v = mastery[subject.id] ?? 0;
                  return (
                    <div key={subject.id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{subject.icon}</span>
                          <span className="text-sm font-geist text-white">{subject.name}</span>
                        </div>
                        <span className="text-xs font-mono text-white/50 tabular-nums">{v}%</span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${v}%` }}
                          transition={{ duration: 0.7, ease: "easeOut" }}
                          className="h-full rounded-full"
                          style={{ background: `linear-gradient(90deg, ${subject.accent}, ${subject.accent}cc)`, boxShadow: `0 0 12px ${subject.accent}66` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Streak heatmap */}
            <div className="dash-glass rounded-3xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-garamond text-xl text-white">14-Day Heatmap</h3>
                  <p className="text-xs text-white/50 font-geist">Study intensity</p>
                </div>
                <span className="dash-glass rounded-full px-3 py-1 text-xs text-white font-geist flex items-center gap-1">
                  <Flame className="h-3 w-3 text-white/60" /> {streak}-day streak
                </span>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {heatDays.map((d, i) => (
                  <motion.div
                    key={d.key}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25, delay: i * 0.02 }}
                    whileHover={{ scale: 1.1 }}
                    title={`${d.key} · ${d.level} sessions`}
                    className="aspect-square rounded-md"
                    style={{ background: `rgba(255,255,255,${HEATMAP_OPACITY[d.level]})` }}
                  />
                ))}
              </div>
              <div className="flex items-center justify-end gap-1.5 mt-3">
                <span className="text-[10px] text-white/40 font-geist mr-1">Less</span>
                {HEATMAP_OPACITY.map((o, i) => (
                  <span key={i} className="h-2.5 w-2.5 rounded-sm" style={{ background: `rgba(255,255,255,${o})` }} />
                ))}
                <span className="text-[10px] text-white/40 font-geist ml-1">More</span>
              </div>
            </div>

            {/* Recent activity + Upcoming deadlines */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="dash-glass rounded-3xl p-5">
                <h3 className="font-garamond text-lg text-white mb-3">Recent Activity</h3>
                {recent.length === 0 ? (
                  <p className="text-sm text-white/50 font-geist py-4 text-center">Nothing yet</p>
                ) : (
                  <ul className="space-y-3 max-h-60 overflow-y-auto no-scrollbar">
                    {recent.map((a) => (
                      <li key={a.id} className="flex items-start gap-3">
                        <div className="grid place-items-center h-8 w-8 rounded-lg bg-white/5 text-sm shrink-0">{a.icon ?? "•"}</div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-geist text-white leading-snug">{a.text}</p>
                          <p className="text-[11px] text-white/40 mt-0.5 font-geist">{relTime(a.at)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="dash-glass rounded-3xl p-5">
                <h3 className="font-garamond text-lg text-white mb-3">Upcoming Deadlines</h3>
                {upcoming.length === 0 ? (
                  <p className="text-sm text-white/50 font-geist py-4 text-center">All caught up!</p>
                ) : (
                  <ul className="space-y-2.5 max-h-60 overflow-y-auto no-scrollbar">
                    {upcoming.map((task) => {
                      const subj = CURRICULUM.find((s) => s.id === task.subject);
                      const daysAway = Math.ceil((new Date(task.date).getTime() - Date.now()) / 86_400_000);
                      return (
                        <li key={task.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: subj?.accent ?? "#fff" }} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-geist text-white truncate">{task.title}</p>
                            <p className="text-[11px] text-white/40 font-geist">{subj?.name ?? "General"} · {new Date(task.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                          </div>
                          <span className="dash-glass rounded-full px-2 py-0.5 text-[10px] text-white/60 font-geist">
                            {daysAway === 0 ? "Today" : daysAway === 1 ? "Tomorrow" : `${daysAway}d`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Right column — Weekly report */}
          <div>
            <div className="dash-glass-strong rounded-3xl p-5 sticky top-20">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-garamond text-xl text-white">Weekly Report</h3>
                  <p className="text-xs text-white/50 font-geist">Last 7 days</p>
                </div>
                <button onClick={handleExportReport} className="dash-glass rounded-full px-3 py-1.5 text-xs text-white font-geist flex items-center gap-1 hover:bg-white/5 transition-colors">
                  <Download className="h-3 w-3" /> Export
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { icon: Clock, label: "Study time", value: weekMinutes, unit: "min" },
                  { icon: TrendingUp, label: "Avg score", value: weekAvgScore, unit: "%" },
                  { icon: Target, label: "Sessions", value: weekSessions.length, unit: "" },
                  { icon: Award, label: "Quizzes", value: weekQuizzes.length, unit: "" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-white/5 p-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-white/50 font-geist">
                      <s.icon className="h-3 w-3" /> {s.label}
                    </div>
                    <p className="text-xl font-garamond text-white mt-1 tabular-nums">{s.value}<span className="text-xs text-white/40 ml-1 font-geist">{s.unit}</span></p>
                  </div>
                ))}
              </div>

              <div className="space-y-2 mb-4">
                <p className="text-[11px] uppercase tracking-wider text-white/40 font-geist font-medium">Insights</p>
                {insights.map((ins, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs leading-relaxed text-white/60 font-geist">
                    <Sparkles className="h-3 w-3 mt-0.5 text-white/40 shrink-0" />
                    <span>{ins}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-white/10">
                <p className="text-[11px] uppercase tracking-wider text-white/40 font-geist font-medium mb-3">Subject Recap</p>
                <div className="space-y-2">
                  {CURRICULUM.slice(0, 3).map((s) => (
                    <div key={s.id} className="flex items-center gap-2">
                      <span className="text-sm">{s.icon}</span>
                      <span className="text-xs text-white/50 font-geist flex-1 truncate">{s.name}</span>
                      <span className="text-xs font-mono tabular-nums text-white/60">{mastery[s.id] ?? 0}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardView;
