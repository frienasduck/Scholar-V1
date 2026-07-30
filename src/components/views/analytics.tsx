"use client";

import { useStore, getLevelInfo } from "@/lib/store";
import { CURRICULUM } from "@/lib/curriculum";
import { useCurriculum } from "@/lib/use-curriculum";
import { navigateTo } from "@/lib/nav-event";
import { exportPDF, mdToHtml } from "@/lib/pdf";
import { motion } from "framer-motion";
import {
  Area, AreaChart, Radar, RadarChart, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import {
  Flame, Zap, Target, TrendingUp, TrendingDown, Download, Trophy, Clock, Award,
  Globe, BookOpen, GraduationCap, Brain, ArrowRight, Sparkles, Calendar,
  Layers, FileQuestion, NotebookPen, Timer, Star, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";

// ===== helpers =====
function dayKey(offset: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function dayShortLabel(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-IN", { weekday: "short" });
}

function intensityForDay(sessions: { completedAt: number }[], dateKey: string) {
  const dayStart = new Date(dateKey).getTime();
  const dayEnd = dayStart + 86_400_000;
  const count = sessions.filter((s) => s.completedAt >= dayStart && s.completedAt < dayEnd).length;
  return Math.min(4, count);
}

const HEATMAP_OPACITY = [0.08, 0.25, 0.45, 0.7, 1];
const AXIS_STYLE = { fontSize: 11, fill: "rgba(255,255,255,0.5)" } as const;
const GRID_PROPS = { stroke: "rgba(255,255,255,0.08)", strokeDasharray: "3 3" } as const;

// ===== Cinematic video background =====
function CinematicVideoBg() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fadeAnimRef = useRef<number | null>(null);
  const fadingOutRef = useRef(false);

  const cancelFade = () => {
    if (fadeAnimRef.current !== null) {
      cancelAnimationFrame(fadeAnimRef.current);
      fadeAnimRef.current = null;
    }
  };

  const animateFade = (target: number, duration: number, onDone?: () => void) => {
    cancelFade();
    const video = videoRef.current;
    if (!video) return;
    const startOpacity = video.style.opacity ? parseFloat(video.style.opacity) : 1;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = progress * (2 - progress);
      video.style.opacity = String(startOpacity + (target - startOpacity) * eased);
      if (progress < 1) {
        fadeAnimRef.current = requestAnimationFrame(step);
      } else {
        fadeAnimRef.current = null;
        onDone?.();
      }
    };
    fadeAnimRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (!video.duration || fadingOutRef.current) return;
      const remaining = video.duration - video.currentTime;
      if (remaining < 0.55) {
        fadingOutRef.current = true;
        animateFade(0, 500);
      }
    };

    const handleEnded = () => {
      video.style.opacity = "0";
      fadingOutRef.current = false;
      setTimeout(() => {
        video.currentTime = 0;
        video.play().catch(() => {});
        animateFade(1, 500);
      }, 100);
    };

    const handlePlay = () => {
      fadingOutRef.current = false;
      animateFade(1, 500);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("play", handlePlay);

    return () => {
      cancelFade();
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("play", handlePlay);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      poster="/backgrounds/scholar-poster.svg"
      preload="metadata"
      className="absolute inset-0 w-full h-full object-cover translate-y-[17%] z-0"
      style={{ opacity: 0 }}
    >
      <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4" type="video/mp4" />
    </video>
  );
}

// ===== Stat pill for the nav bar =====
function NavStat({ icon: Icon, label, value }: { icon: typeof Zap; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 text-white/80 text-sm">
      <Icon className="h-3.5 w-3.5" />
      <span className="font-medium tabular-nums">{value}</span>
      <span className="text-white/40 text-xs hidden sm:inline">{label}</span>
    </div>
  );
}

// ===== Glass card wrapper =====
function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`asme-glass rounded-3xl p-5 ${className}`}>
      {children}
    </div>
  );
}

// ===== Main component =====
export function AnalyticsView({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const CURRICULUM = useCurriculum();
  const xp = useStore((s) => s.xp);
  const streak = useStore((s) => s.streak);
  const coins = useStore((s) => s.coins);
  const mastery = useStore((s) => s.mastery);
  const scholarClass = useStore((s) => s.user.scholarClass);
  const sessions = useStore((s) => s.sessions);
  const quizAttempts = useStore((s) => s.quizAttempts);
  const tasks = useStore((s) => s.tasks);
  const notes = useStore((s) => s.notes);
  const flashcards = useStore((s) => s.flashcards);
  const level = getLevelInfo(xp);

  const [activeTab, setActiveTab] = useState<"overview" | "subjects" | "history">("overview");

  // === Top stats ===
  const totalMinutes = Math.round(sessions.reduce((sum, s) => sum + s.duration, 0) / 60);
  const avgScore = quizAttempts.length === 0 ? 0 : Math.round(quizAttempts.reduce((sum, q) => sum + (q.score / q.total) * 100, 0) / quizAttempts.length);
  const masteryAvg = Math.round(CURRICULUM.reduce((sum, s) => sum + (mastery[s.id] ?? 0), 0) / (CURRICULUM.length || 1));
  const completedTasks = tasks.filter((t) => t.done).length;
  const totalTasks = tasks.length;

  // === Area chart: study hours last 7 days ===
  const areaData = Array.from({ length: 7 }, (_, i) => {
    const offset = -6 + i;
    const key = dayKey(offset);
    const daySessions = sessions.filter((s) => {
      const start = new Date(key).getTime();
      return s.completedAt >= start && s.completedAt < start + 86_400_000;
    });
    return { day: dayShortLabel(offset), minutes: Math.round(daySessions.reduce((sum, s) => sum + s.duration, 0) / 60) };
  });

  // === Radar: topic mastery ===
  const radarData = CURRICULUM.map((s) => ({ subject: s.name.split(" ")[0], mastery: mastery[s.id] ?? 0 }));

  // === Bar: subject performance from quiz attempts ===
  const barData = CURRICULUM.map((s) => {
    const subjAttempts = quizAttempts.filter((q) => q.subject === s.id);
    const avg = subjAttempts.length === 0 ? 0 : Math.round(subjAttempts.reduce((sum, q) => sum + (q.score / q.total) * 100, 0) / subjAttempts.length);
    return { subject: s.name.split(" ")[0], score: avg, accent: s.accent };
  });

  // === Strengths & weaknesses ===
  const sortedByMastery = [...CURRICULUM].sort((a, b) => (mastery[b.id] ?? 0) - (mastery[a.id] ?? 0));
  const strengths = sortedByMastery.slice(0, 2);
  const weaknesses = sortedByMastery.slice(-2).reverse();

  // === Heatmap: 12 weeks × 7 days ===
  const heatmapWeeks = Array.from({ length: 12 }, (_, weekIdx) => {
    return Array.from({ length: 7 }, (_, dayIdx) => {
      const offset = -((11 - weekIdx) * 7 + (6 - dayIdx));
      const key = dayKey(offset);
      return { key, level: intensityForDay(sessions, key), offset };
    });
  });
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function handleRevise(subjectName: string) {
    if (onNavigate) onNavigate("flashcards");
    else navigateTo("flashcards");
    toast.info(`Opening revisions for ${subjectName}`, { description: "Loading flashcards…" });
  }

  function handleExportReport() {
    const md = `## Learning Analytics Report\n\n**Generated:** ${new Date().toLocaleString("en-IN")}\n\n### Overall Stats\n\n- **Total study time:** ${totalMinutes} minutes\n- **Total focus sessions:** ${sessions.length}\n- **Quizzes taken:** ${quizAttempts.length}\n- **Average quiz score:** ${avgScore}%\n- **Current streak:** ${streak} days\n- **Average mastery:** ${masteryAvg}%\n- **Level:** ${level.level} (${xp.toLocaleString()} XP)\n- **Coins:** ${coins}\n\n### Subject Mastery\n\n| Subject | Mastery | Quiz Avg |\n|---|---|---|\n${CURRICULUM.map((s) => `| ${s.name} | ${mastery[s.id] ?? 0}% | ${barData.find((b) => b.subject === s.name.split(" ")[0])?.score ?? 0}% |`).join("\n")}\n\n### Last 7 Days (study minutes)\n\n${areaData.map((d) => `- ${d.day}: ${d.minutes} min`).join("\n")}\n\n### Insights\n\n- **Strongest:** ${strengths.map((s) => s.name).join(", ")}\n- **Needs work:** ${weaknesses.map((s) => s.name).join(", ")}\n`;
    exportPDF({ title: "Learning Analytics", subtitle: "Full stats summary", bodyHtml: mdToHtml(md), accent: "#14b8a6", scholarClass });
    toast.success("Opening PDF…", { description: "Analytics report ready" });
  }

  // Quick action items for the "more features" section
  const quickActions = [
    { icon: NotebookPen, label: "Notes", count: notes.length, view: "notes", color: "rgba(255,255,255,0.8)" },
    { icon: Layers, label: "Flashcards", count: flashcards.length, view: "flashcards", color: "rgba(255,255,255,0.8)" },
    { icon: FileQuestion, label: "Quizzes", count: quizAttempts.length, view: "quiz", color: "rgba(255,255,255,0.8)" },
    { icon: Timer, label: "Focus", count: sessions.length, view: "focus", color: "rgba(255,255,255,0.8)" },
    { icon: Calendar, label: "Tasks", count: `${completedTasks}/${totalTasks}`, view: "planner", color: "rgba(255,255,255,0.8)" },
    { icon: Brain, label: "AI Tutor", count: "5", view: "ai-tutor", color: "rgba(255,255,255,0.8)" },
  ];

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">
      {/* Liquid glass + font CSS */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');
        .asme-glass {
          background: rgba(255,255,255,0.01);
          background-blend-mode: luminosity;
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          border: none;
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.1);
          position: relative;
          overflow: hidden;
        }
        .asme-glass::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1.4px;
          background: linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 20%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.15) 80%, rgba(255,255,255,0.45) 100%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .asme-glass-strong {
          background: rgba(255,255,255,0.01);
          background-blend-mode: luminosity;
          backdrop-filter: blur(50px);
          -webkit-backdrop-filter: blur(50px);
          border: none;
          box-shadow: 4px 4px 4px rgba(0,0,0,0.05), inset 0 1px 1px rgba(255,255,255,0.15);
          position: relative;
          overflow: hidden;
        }
        .asme-glass-strong::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1.4px;
          background: linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.2) 20%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.2) 80%, rgba(255,255,255,0.5) 100%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .asme-serif { font-family: 'Instrument Serif', serif; }
      `}</style>

      {/* Video background */}
      <CinematicVideoBg />
      <div className="absolute inset-0 z-0 bg-black/50" />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-[calc(100vh-4rem)]">
        {/* Navigation bar */}
        <nav className="relative z-20 pl-6 pr-6 py-6">
          <div className="asme-glass rounded-full px-6 py-3 flex items-center justify-between max-w-5xl mx-auto">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-white" />
                <span className="text-white font-semibold text-lg">Analytics</span>
              </div>
              <div className="hidden md:flex items-center gap-6">
                <button onClick={() => setActiveTab("overview")} className={`text-sm font-medium transition-colors ${activeTab === "overview" ? "text-white" : "text-white/60 hover:text-white"}`}>Overview</button>
                <button onClick={() => setActiveTab("subjects")} className={`text-sm font-medium transition-colors ${activeTab === "subjects" ? "text-white" : "text-white/60 hover:text-white"}`}>Subjects</button>
                <button onClick={() => setActiveTab("history")} className={`text-sm font-medium transition-colors ${activeTab === "history" ? "text-white" : "text-white/60 hover:text-white"}`}>History</button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-4">
                <NavStat icon={Flame} label="streak" value={`${streak}`} />
                <NavStat icon={Zap} label="lvl" value={`${level.level}`} />
              </div>
              <button onClick={handleExportReport} className="asme-glass rounded-full px-6 py-2 text-white text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-1.5">
                <Download className="h-3.5 w-3.5" /> Export
              </button>
            </div>
          </div>
        </nav>

        {/* Hero heading */}
        <div className="relative z-10 flex flex-col items-center justify-center px-6 pt-2 pb-6 text-center">
          <h1
            className="asme-serif text-5xl md:text-6xl lg:text-7xl text-white mb-3 tracking-tight"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Built for the <span className="italic text-white/80">curious</span>
          </h1>
          <p className="text-white/60 text-sm max-w-xl">
            Track your study patterns, spot where to focus next, and watch your mastery grow.
          </p>
        </div>

        {/* Stat row — glass pills */}
        <div className="relative z-10 px-4 max-w-5xl mx-auto w-full grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { icon: Clock, label: "Study time", value: `${totalMinutes}m`, sub: `${sessions.length} sessions`, accent: "rgba(255,255,255,0.8)" },
            { icon: Target, label: "Avg score", value: `${avgScore}%`, sub: `${quizAttempts.length} quizzes`, accent: "rgba(255,255,255,0.8)" },
            { icon: Flame, label: "Streak", value: `${streak}d`, sub: "Keep going!", accent: "rgba(255,255,255,0.8)" },
            { icon: Award, label: "Mastery", value: `${masteryAvg}%`, sub: `${CURRICULUM.length} subjects`, accent: "rgba(255,255,255,0.8)" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <div className="asme-glass rounded-2xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="grid place-items-center h-9 w-9 rounded-xl bg-white/5">
                    <s.icon className="h-4 w-4 text-white/80" />
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-white/40">{s.label}</span>
                </div>
                <p className="text-2xl font-semibold text-white tabular-nums">{s.value}</p>
                <p className="text-[11px] text-white/50 mt-0.5">{s.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Charts row 1: area + radar */}
        <div className="relative z-10 px-4 max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-white font-medium text-sm">Study Hours Trend</h3>
                <p className="text-white/40 text-xs">Minutes per day · last 7 days</p>
              </div>
              <span className="asme-glass rounded-full px-2.5 py-1 text-[10px] text-white/60 flex items-center gap-1">
                <TrendingUp className="h-2.5 w-2.5" /> 7d
              </span>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={areaData} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                  <defs>
                    <linearGradient id="aGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...GRID_PROPS} vertical={false} />
                  <XAxis dataKey="day" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={40} />
                  <Tooltip contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12, color: "white" }} formatter={(v: number) => [`${v} min`, "Studied"]} />
                  <Area type="monotone" dataKey="minutes" stroke="white" strokeWidth={2} fill="url(#aGradient)" dot={{ r: 3, fill: "white", strokeWidth: 0 }} activeDot={{ r: 5, fill: "white", strokeWidth: 2, stroke: "rgba(0,0,0,0.5)" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-white font-medium text-sm">Topic Mastery</h3>
                <p className="text-white/40 text-xs">Mastery % across all subjects</p>
              </div>
              <span className="asme-glass rounded-full px-2.5 py-1 text-[10px] text-white/60 flex items-center gap-1">
                <Target className="h-2.5 w-2.5" /> {masteryAvg}% avg
              </span>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="rgba(255,255,255,0.12)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }} />
                  <Radar name="Mastery" dataKey="mastery" stroke="white" strokeWidth={2} fill="white" fillOpacity={0.25} />
                  <Tooltip contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12, color: "white" }} formatter={(v: number) => [`${v}%`, "Mastery"]} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

        {/* Bar chart: subject performance */}
        <div className="relative z-10 px-4 max-w-5xl mx-auto w-full mb-6">
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-white font-medium text-sm">Subject Performance</h3>
                <p className="text-white/40 text-xs">Average quiz score per subject</p>
              </div>
              <span className="asme-glass rounded-full px-2.5 py-1 text-[10px] text-white/60 flex items-center gap-1">
                <Award className="h-2.5 w-2.5" /> {quizAttempts.length} quizzes
              </span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                  <CartesianGrid {...GRID_PROPS} vertical={false} />
                  <XAxis dataKey="subject" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={40} domain={[0, 100]} />
                  <Tooltip cursor={{ fill: "rgba(255,255,255,0.05)" }} contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12, color: "white" }} formatter={(v: number) => [`${v}%`, "Avg score"]} />
                  <Bar dataKey="score" fill="rgba(255,255,255,0.7)" radius={[8, 8, 0, 0]} maxBarSize={64} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

        {/* Strengths & weaknesses */}
        <div className="relative z-10 px-4 max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-white font-medium text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-white/60" /> Your Strengths
                </h3>
                <p className="text-white/40 text-xs">Top subjects by mastery</p>
              </div>
              <span className="text-[10px] text-white/40 uppercase tracking-widest">Strong</span>
            </div>
            <div className="space-y-3">
              {strengths.map((s, i) => (
                <motion.div key={s.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                  <div className="grid place-items-center h-10 w-10 rounded-xl bg-white/10 text-base shrink-0">{s.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white truncate">{s.name}</p>
                      <span className="text-sm font-mono tabular-nums text-white/70">{mastery[s.id] ?? 0}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/10 mt-1.5 overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${mastery[s.id] ?? 0}%` }} transition={{ duration: 0.7, delay: i * 0.1 }} className="h-full rounded-full bg-white/60" />
                    </div>
                  </div>
                  <button onClick={() => handleRevise(s.name)} className="asme-glass rounded-full px-3 py-1.5 text-xs text-white hover:bg-white/5 transition-colors shrink-0">Revise</button>
                </motion.div>
              ))}
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-white font-medium text-sm flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-white/60" /> Focus Areas
                </h3>
                <p className="text-white/40 text-xs">Subjects needing attention</p>
              </div>
              <span className="text-[10px] text-white/40 uppercase tracking-widest">Weak</span>
            </div>
            <div className="space-y-3">
              {weaknesses.map((s, i) => (
                <motion.div key={s.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                  <div className="grid place-items-center h-10 w-10 rounded-xl bg-white/10 text-base shrink-0">{s.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white truncate">{s.name}</p>
                      <span className="text-sm font-mono tabular-nums text-white/70">{mastery[s.id] ?? 0}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/10 mt-1.5 overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${mastery[s.id] ?? 0}%` }} transition={{ duration: 0.7, delay: i * 0.1 }} className="h-full rounded-full bg-white/40" />
                    </div>
                  </div>
                  <button onClick={() => handleRevise(s.name)} className="asme-glass rounded-full px-3 py-1.5 text-xs text-white hover:bg-white/5 transition-colors shrink-0">Revise</button>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Heatmap */}
        <div className="relative z-10 px-4 max-w-5xl mx-auto w-full mb-6">
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-white font-medium text-sm">Study Heatmap</h3>
                <p className="text-white/40 text-xs">Last 12 weeks of focus sessions</p>
              </div>
              <span className="asme-glass rounded-full px-2.5 py-1 text-[10px] text-white/60 flex items-center gap-1">
                <Flame className="h-2.5 w-2.5" /> {sessions.length} sessions
              </span>
            </div>
            <div className="overflow-x-auto no-scrollbar pb-1">
              <div className="flex gap-2 min-w-max">
                <div className="flex flex-col gap-1.5 pt-0.5 pr-1">
                  {daysOfWeek.map((d, i) => (
                    <div key={d} className={`h-3.5 text-[10px] leading-3.5 text-white/40 ${i % 2 === 0 ? "opacity-100" : "opacity-0"}`}>{d}</div>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  {heatmapWeeks.map((week, wIdx) => (
                    <div key={wIdx} className="flex flex-col gap-1.5">
                      {week.map((cell, dIdx) => (
                        <motion.div
                          key={cell.key}
                          initial={{ opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.2, delay: (wIdx * 7 + dIdx) * 0.004 }}
                          whileHover={{ scale: 1.25 }}
                          title={`${cell.key} · ${cell.level} session${cell.level === 1 ? "" : "s"}`}
                          className="h-3.5 w-3.5 rounded-sm"
                          style={{ background: `rgba(255,255,255,${HEATMAP_OPACITY[cell.level]})` }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-4">
              <p className="text-[11px] text-white/40">{heatmapWeeks.flat().filter((c) => c.level > 0).length} active days out of 84</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-white/40 mr-1">Less</span>
                {HEATMAP_OPACITY.map((o, i) => (
                  <span key={i} className="h-2.5 w-2.5 rounded-sm" style={{ background: `rgba(255,255,255,${o})` }} />
                ))}
                <span className="text-[10px] text-white/40 ml-1">More</span>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Quick actions — study-related (replacing social icons) */}
        <div className="relative z-10 px-4 max-w-5xl mx-auto w-full mb-6">
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium text-sm">Quick Access</h3>
              <span className="text-[10px] text-white/40 uppercase tracking-widest">Jump to</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {quickActions.map((a, i) => (
                <motion.button
                  key={a.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => { if (onNavigate) onNavigate(a.view); else navigateTo(a.view); }}
                  className="asme-glass rounded-2xl p-3 flex flex-col items-center gap-2 hover:bg-white/5 transition-colors group"
                >
                  <div className="grid place-items-center h-10 w-10 rounded-full bg-white/10 group-hover:bg-white/20 transition-colors">
                    <a.icon className="h-4 w-4 text-white/80" />
                  </div>
                  <span className="text-[11px] text-white/70 font-medium">{a.label}</span>
                  <span className="text-[10px] text-white/40 tabular-nums">{a.count}</span>
                </motion.button>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Level progress + insights */}
        <div className="relative z-10 px-4 max-w-5xl mx-auto w-full mb-6">
          <GlassCard>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <h3 className="text-white font-medium text-sm mb-3 flex items-center gap-2">
                  <Star className="h-4 w-4 text-white/60" /> Level Progress
                </h3>
                <div className="flex items-center gap-3 mb-3">
                  <div className="grid place-items-center h-12 w-12 rounded-full bg-white/10 text-white font-semibold">
                    {level.level}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs text-white/60 mb-1">
                      <span>Level {level.level}</span>
                      <span>{level.intoLevel} / {level.needed} XP</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(level.intoLevel / level.needed) * 100}%` }}
                        transition={{ duration: 0.7 }}
                        className="h-full rounded-full bg-white/60"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-white/40">{xp.toLocaleString()} total XP · {coins} coins</p>
              </div>
              <div>
                <h3 className="text-white font-medium text-sm mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-white/60" /> AI Insights
                </h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-white/5">
                    <TrendingUp className="h-3.5 w-3.5 text-white/60 shrink-0 mt-0.5" />
                    <p className="text-xs text-white/70">Strongest: <span className="text-white">{strengths[0]?.name}</span> at {mastery[strengths[0]?.id ?? ""] ?? 0}%</p>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-white/5">
                    <TrendingDown className="h-3.5 w-3.5 text-white/60 shrink-0 mt-0.5" />
                    <p className="text-xs text-white/70">Focus on: <span className="text-white">{weaknesses[0]?.name}</span> at {mastery[weaknesses[0]?.id ?? ""] ?? 0}%</p>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-white/5">
                    <Flame className="h-3.5 w-3.5 text-white/60 shrink-0 mt-0.5" />
                    <p className="text-xs text-white/70">{streak}-day streak — {streak >= 7 ? "on fire! 🔥" : "keep building!"}</p>
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Study icons footer (replacing social media icons) */}
        <div className="relative z-10 flex justify-center gap-4 pb-12">
          {[
            { Icon: BookOpen, label: "Resources" },
            { Icon: GraduationCap, label: "Study" },
            { Icon: Brain, label: "AI Tutor" },
          ].map(({ Icon, label }) => (
            <button
              key={label}
              aria-label={label}
              onClick={() => {
                const view = label.toLowerCase().replace("ai tutor", "ai-tutor");
                if (onNavigate) onNavigate(view); else navigateTo(view);
              }}
              className="asme-glass rounded-full p-4 text-white/80 hover:text-white hover:bg-white/5 transition-all"
            >
              <Icon size={20} className="h-5 w-5" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AnalyticsView;
