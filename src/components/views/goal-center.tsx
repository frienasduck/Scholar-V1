"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { askAIJSON } from "@/lib/ai";
import { useStore } from "@/lib/store";
import { exportPDF, mdToHtml } from "@/lib/pdf";
import { profileGetJSON, profileSetJSON } from "@/lib/profile-storage";
import { StatCard, EmptyState, ProgressRing } from "@/lib/shared";
import { ScholarAIContent } from "@/components/ai/scholar-ai-content";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/lib/notifications/notification-api";
import {
  Flag, Target, Trophy, Calendar, Sparkles, Plus, Download, CheckCircle2,
  Clock, Brain, Zap, TrendingUp, Award, Crown, Flame, Star, BookOpen,
  Dumbbell, CalendarDays, CalendarRange, ListChecks, X, ChevronRight, AlertCircle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";

// ============================================================================
// Goal Center
// ============================================================================

type GoalType = "marks" | "exam" | "daily" | "weekly" | "monthly";

interface Goal {
  id: string;
  type: GoalType;
  title: string;
  description?: string;
  subject?: string;
  target: number;     // numeric target (marks, count, minutes)
  current: number;    // current progress
  unit: string;       // "%", "min", "sessions", etc.
  deadline: string;   // ISO date
  createdAt: number;
  achieved: boolean;
  achievedAt?: number;
  milestones: { label: string; value: number; done: boolean }[];
}

interface AICheckIn {
  summary: string;
  onTrack: boolean;
  suggestions: string[];
  motivation: string;
  predictedSuccess: number; // 0-100
}

const GOAL_TYPES: { id: GoalType; name: string; icon: any; color: string; desc: string; unit: string; defaultTarget: number }[] = [
  { id: "marks", name: "Marks Goal", icon: Target, color: "#f43f5e", desc: "Achieve a target score in a subject", unit: "%", defaultTarget: 85 },
  { id: "exam", name: "Exam Goal", icon: Trophy, color: "#f59e0b", desc: "Ace a specific upcoming exam", unit: "%", defaultTarget: 90 },
  { id: "daily", name: "Daily Goal", icon: Flame, color: "#10b981", desc: "Study/streak target for the day", unit: "min", defaultTarget: 120 },
  { id: "weekly", name: "Weekly Goal", icon: CalendarDays, color: "#6366f1", desc: "Sessions or hours this week", unit: "sessions", defaultTarget: 14 },
  { id: "monthly", name: "Monthly Goal", icon: CalendarRange, color: "#d946ef", desc: "Big-picture target for the month", unit: "sessions", defaultTarget: 50 },
];

function loadGoals(scholarClass: 9 | 11): Goal[] {
  if (typeof window === "undefined") return [];
  return profileGetJSON<Goal[]>(scholarClass, "goal-center", []);
}
function saveGoals(scholarClass: 9 | 11, list: Goal[]) {
  profileSetJSON(scholarClass, "goal-center", list);
}

// Confetti burst (CSS-based)
function Confetti({ show }: { show: boolean }) {
  const pieces = useMemo(() => Array.from({ length: 80 }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.3,
    duration: 2 + Math.random() * 2,
    color: ["#f43f5e", "#f59e0b", "#10b981", "#6366f1", "#d946ef", "#14b8a6"][i % 6],
    rotate: Math.random() * 360,
    size: 6 + Math.random() * 8,
  })), []);
  if (!show) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {pieces.map((p) => (
        <motion.div key={p.id}
          initial={{ top: "-10%", opacity: 1, rotate: 0 }}
          animate={{ top: "110%", opacity: [1, 1, 0], rotate: p.rotate + 720 }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeOut" }}
          style={{ left: `${p.left}%`, position: "absolute", width: p.size, height: p.size, background: p.color, borderRadius: 2 }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================
export function GoalCenterView() {
  const xp = useStore((s) => s.xp);
  const jeeMode = useStore((s) => s.user.jeeMode);
  const scholarClass = useStore((s) => s.user.scholarClass);
  const studentName = scholarClass === 11 ? "Ishan" : "Neha";
  const coins = useStore((s) => s.coins);
  const streak = useStore((s) => s.streak);
  const mastery = useStore((s) => s.mastery);
  const sessions = useStore((s) => s.sessions);
  const addXP = useStore((s) => s.addXP);
  const addCoins = useStore((s) => s.addCoins);
  const pushActivity = useStore((s) => s.pushActivity);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [confettiShow, setConfettiShow] = useState(false);
  const [aiCheckinFor, setAiCheckinFor] = useState<Goal | null>(null);
  const [aiCheckin, setAiCheckin] = useState<AICheckIn | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => { setGoals(loadGoals(scholarClass)); }, [scholarClass]);

  // Create form state
  const [formType, setFormType] = useState<GoalType>("marks");
  const [formTitle, setFormTitle] = useState("");
  const [formTarget, setFormTarget] = useState(85);
  const [formDeadline, setFormDeadline] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [formSubject, setFormSubject] = useState<string>("");

  const updateGoals = (next: Goal[]) => { setGoals(next); saveGoals(scholarClass, next); };

  const createGoal = () => {
    if (!formTitle.trim()) { toast.error("Give your goal a title."); return; }
    const type = GOAL_TYPES.find((t) => t.id === formType)!;
    const milestonesRaw = [25, 50, 75, 100];
    const goal: Goal = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      type: formType, title: formTitle.trim(),
      description: type.desc, subject: formSubject || undefined,
      target: formTarget, current: 0, unit: type.unit,
      deadline: formDeadline, createdAt: Date.now(),
      achieved: false,
      milestones: milestonesRaw.map((m) => ({ label: `${m}%`, value: Math.round(formTarget * m / 100), done: false })),
    };
    updateGoals([goal, ...goals]);
    addXP(5);
    pushActivity({ type: "achievement", text: `Created goal: ${goal.title}`, icon: "🎯" });
    toast.success("Goal created! +5 XP", { description: `${type.name} • target ${formTarget}${type.unit}` });
    // Reset form
    setFormTitle(""); setFormTarget(85);
    setCreateOpen(false);
  };

  const updateProgress = (id: string, delta: number) => {
    const next = goals.map((g) => {
      if (g.id !== id) return g;
      const newCurrent = Math.max(0, Math.min(g.target, g.current + delta));
      const pct = (newCurrent / g.target) * 100;
      const newMilestones = g.milestones.map((m) => ({ ...m, done: pct >= Number(m.label.replace("%", "")) }));
      const justAchieved = !g.achieved && newCurrent >= g.target;
      if (justAchieved) {
        addCoins(20);
        addXP(10);
        pushActivity({ type: "achievement", text: `Goal achieved: ${g.title} (+20 coins)`, icon: "🏆" });
        toast.success(`Goal achieved! 🎉 +20 coins`, { description: g.title });
        triggerConfetti();
      }
      return { ...g, current: newCurrent, milestones: newMilestones, achieved: g.achieved || justAchieved, achievedAt: justAchieved ? Date.now() : g.achievedAt };
    });
    updateGoals(next);
  };

  const deleteGoal = (id: string) => {
    updateGoals(goals.filter((g) => g.id !== id));
    toast.success("Goal deleted.");
  };

  const triggerConfetti = () => {
    setConfettiShow(true);
    setTimeout(() => setConfettiShow(false), 4000);
  };

  // ===== Derived stats =====
  const activeGoals = goals.filter((g) => !g.achieved);
  const achievedGoals = goals.filter((g) => g.achieved);
  const totalProgress = goals.length > 0
    ? Math.round(goals.reduce((a, g) => a + Math.min(100, (g.current / g.target) * 100), 0) / goals.length)
    : 0;
  const dueThisWeek = activeGoals.filter((g) => {
    const d = new Date(g.deadline).getTime();
    return d - Date.now() < 7 * 86400000;
  }).length;

  // Weekly chart (sessions over last 7 days)
  const weeklyData = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(today); d.setDate(today.getDate() - (6 - i));
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 86400000;
      const count = sessions.filter((s) => s.completedAt >= dayStart && s.completedAt < dayEnd).length;
      return { day: d.toLocaleDateString("en-US", { weekday: "short" }), sessions: count };
    });
  }, [sessions]);

  // Days countdown
  const daysLeft = (deadline: string) => {
    const d = new Date(deadline).getTime() - Date.now();
    return Math.max(0, Math.ceil(d / 86400000));
  };

  // AI check-in
  const runCheckIn = async (g: Goal) => {
    setAiCheckinFor(g); setAiCheckin(null); setAiLoading(true);
    try {
      const progress = Math.round((g.current / g.target) * 100);
      const days = daysLeft(g.deadline);
      const subjectLine = g.subject ? `Subject: ${g.subject} (current mastery ${mastery[g.subject] ?? "?"}%)` : "Subject: General";
      const prompt = `You are an academic coach for a CBSE Class ${scholarClass} student named ${studentName}. She has set the following goal:

Title: ${g.title}
Type: ${g.type}
Target: ${g.target} ${g.unit}
Current progress: ${g.current} ${g.unit} (${progress}%)
Deadline: ${g.deadline} (${days} days remaining)
${subjectLine}
Student context: XP ${xp}, ${streak}-day streak, ${coins} coins.

Return strict JSON:
{
  "summary": string (2-3 sentence assessment of where she stands),
  "onTrack": boolean,
  "suggestions": [string] (3-4 specific, actionable suggestions),
  "motivation": string (one-line encouragement, warm but not patronising),
  "predictedSuccess": number (0-100, probability of achieving the goal on time)
}`;
      const res = await askAIJSON<AICheckIn>(prompt, "default");
      if (!res) throw new Error("no result");
      setAiCheckin(res);
    } catch {
      toast.error("AI check-in failed.");
    } finally { setAiLoading(false); }
  };

  // ===== Export =====
  const exportGoals = () => {
    const bodyHtml = mdToHtml(`# Goal Center
Generated on ${new Date().toLocaleString()}.

## Summary
- Active goals: ${activeGoals.length}
- Achieved goals: ${achievedGoals.length}
- Average progress: ${totalProgress}%
- Due this week: ${dueThisWeek}

## Active Goals
${activeGoals.length ? activeGoals.map((g, i) => `${i + 1}. **${g.title}** (${g.type})
   - Target: ${g.target} ${g.unit} • Current: ${g.current} ${g.unit} (${Math.round((g.current / g.target) * 100)}%)
   - Deadline: ${g.deadline} (${daysLeft(g.deadline)} days left)
   - Milestones: ${g.milestones.map((m) => `${m.label} ${m.done ? "✓" : "○"}`).join(", ")}`).join("\n") : "_None_"}

## Achieved Goals
${achievedGoals.length ? achievedGoals.map((g, i) => `${i + 1}. ${g.title} — achieved ${g.achievedAt ? new Date(g.achievedAt).toLocaleDateString() : ""}`).join("\n") : "_None yet_"}

> Generated by Scholar Goal Center.`);
    exportPDF({ title: "Goal Center Report", subtitle: `${activeGoals.length} active • ${achievedGoals.length} achieved`, bodyHtml, accent: "#f59e0b", scholarClass });
    toast.success("Exporting goal report…");
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&display=swap');
        .gc-font-serif { font-family: 'Instrument Serif', serif; }
        .gc-font-body { font-family: 'Inter', sans-serif; }
        .gc-glass { background: rgba(255,255,255,0.04); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.12); box-shadow: inset 0 1px 1px rgba(255,255,255,0.08); color: white; }
        .gc-glass-strong { background: rgba(255,255,255,0.07); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.16); box-shadow: inset 0 1px 1px rgba(255,255,255,0.1); color: white; }
        .gc-glass input, .gc-glass textarea, .gc-glass select { background: rgba(255,255,255,0.05) !important; border-color: rgba(255,255,255,0.15) !important; color: white !important; }
        .gc-glass input::placeholder, .gc-glass textarea::placeholder { color: rgba(255,255,255,0.4) !important; }
        .gc-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .gc-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
      `}</style>

      <video autoPlay muted loop playsInline poster="/backgrounds/scholar-poster.svg" preload="metadata" className="absolute inset-0 w-full h-full object-cover z-0">
        <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_204103_f607742e-09da-4cf5-bb06-4e67b0a531de.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 z-0 bg-black/55" />

      <Confetti show={confettiShow} />

      <div className="relative z-10 gc-font-body p-4 md:p-8 lg:p-12 max-w-7xl mx-auto">
        {/* HERO */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="grid place-items-center h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 text-amber-300 border border-white/10">
                <Flag className="h-6 w-6" />
              </div>
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">Goals • Milestones • AI Coach</Badge>
            </div>
            <h1 className="gc-font-serif text-5xl md:text-6xl text-white leading-tight">
              Goal <em className="text-amber-300">Center</em>
            </h1>
            <p className="text-white/70 mt-3 max-w-2xl">
              Set targets, track milestones, get AI check-ins and celebrate achievements with confetti.
              Five goal types covering marks, exams, daily habits, weekly volume and monthly milestones.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gc-glass bg-white/5 border-white/15 text-white hover:bg-white/10" onClick={exportGoals}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export
            </Button>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> New Goal
            </Button>
          </div>
        </motion.div>

        {/* STAT PILLS */}
        <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { icon: Target, label: "Active Goals", value: activeGoals.length, accent: "#6366f1" },
            { icon: Trophy, label: "Achieved", value: achievedGoals.length, accent: "#f59e0b" },
            { icon: TrendingUp, label: "Avg Progress", value: `${totalProgress}%`, accent: "#10b981" },
            { icon: Clock, label: "Due This Week", value: dueThisWeek, accent: "#f43f5e" },
          ].map((s, i) => (
            <motion.div key={i} variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
              <StatCard icon={s.icon} label={s.label} value={s.value} accent={s.accent} />
            </motion.div>
          ))}
        </motion.div>

        {/* WEEKLY CHART */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="gc-glass rounded-2xl p-5 mb-8">
          <h3 className="text-white font-semibold flex items-center gap-2 mb-4"><TrendingUp className="h-4 w-4 text-amber-300" /> This Week's Study Sessions</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.5)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.5)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <RTooltip cursor={{ fill: "rgba(255,255,255,0.05)" }} contentStyle={{ background: "rgba(15,15,25,0.95)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, color: "white" }} />
                <Bar dataKey="sessions" radius={[6, 6, 0, 0]}>
                  {weeklyData.map((_, i) => <Cell key={i} fill={i === 6 ? "#f59e0b" : "#6366f1"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <Tabs defaultValue="active" className="space-y-6">
          <TabsList className="gc-glass bg-transparent h-auto p-1 flex flex-wrap gap-1">
            <TabsTrigger value="active" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">Active {activeGoals.length > 0 && <span className="ml-1.5 text-xs bg-amber-500/30 text-amber-200 rounded-full px-1.5">{activeGoals.length}</span>}</TabsTrigger>
            <TabsTrigger value="achieved" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">Achieved</TabsTrigger>
            <TabsTrigger value="ai" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">AI Insights</TabsTrigger>
          </TabsList>

          {/* ===== ACTIVE ===== */}
          <TabsContent value="active" className="space-y-4">
            {activeGoals.length === 0 ? (
              <EmptyState icon={Flag} title="No active goals yet" description="Click 'New Goal' to set your first target. AI check-ins become available once you have at least one goal."
                action={<Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> Create your first goal</Button>} />
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {activeGoals.map((g, i) => {
                  const type = GOAL_TYPES.find((t) => t.id === g.type)!;
                  const pct = Math.min(100, Math.round((g.current / g.target) * 100));
                  const dLeft = daysLeft(g.deadline);
                  const urgent = dLeft <= 3 && pct < 80;
                  return (
                    <motion.div key={g.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.06, 0.4) }}
                      className="gc-glass rounded-2xl p-5 border-l-2" style={{ borderLeftColor: type.color }}>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="grid place-items-center h-10 w-10 rounded-xl shrink-0" style={{ background: `${type.color}22`, color: type.color }}>
                            <type.icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-white font-semibold truncate">{g.title}</h4>
                            <p className="text-xs text-white/50">{type.name}{g.subject ? ` • ${g.subject}` : ""}</p>
                          </div>
                        </div>
                        <button onClick={() => deleteGoal(g.id)} className="text-white/30 hover:text-rose-300 shrink-0">
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between mb-2 text-sm">
                        <span className="text-white/70">{g.current} / {g.target} {g.unit}</span>
                        <Badge variant="outline" className={cn("border", urgent ? "bg-rose-500/15 border-rose-500/40 text-rose-300" : "border-white/20 text-white/70")}>
                          <Clock className="h-3 w-3 mr-1" /> {dLeft}d left
                        </Badge>
                      </div>
                      <Progress value={pct} className="bg-white/10 h-2 mb-3" />

                      {/* Milestones */}
                      <div className="flex items-center justify-between gap-1 mb-4">
                        {g.milestones.map((m, mi) => (
                          <div key={mi} className="flex-1 flex flex-col items-center gap-1">
                            <div className={cn("h-7 w-7 rounded-full grid place-items-center text-[10px] font-medium border transition-all",
                              m.done ? "bg-emerald-500/30 border-emerald-500/50 text-emerald-200" : "bg-white/5 border-white/15 text-white/40")}>
                              {m.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : m.label.replace("%", "")}
                            </div>
                            <span className={cn("text-[10px]", m.done ? "text-emerald-300" : "text-white/40")}>{m.label}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Button size="sm" variant="outline" className="bg-white/5 border-white/15 text-white hover:bg-white/10"
                          onClick={() => updateProgress(g.id, -Math.max(1, Math.round(g.target / 10)))}>
                          −
                        </Button>
                        <Button size="sm" className="bg-white/10 hover:bg-white/15 text-white border border-white/15"
                          onClick={() => updateProgress(g.id, Math.max(1, Math.round(g.target / 10)))}>
                          + Log progress
                        </Button>
                        <Button size="sm" variant="ghost" className="text-white/70 ml-auto" onClick={() => runCheckIn(g)}>
                          <Sparkles className="h-3.5 w-3.5 mr-1.5" /> AI check-in
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ===== ACHIEVED ===== */}
          <TabsContent value="achieved" className="space-y-4">
            {achievedGoals.length === 0 ? (
              <EmptyState icon={Trophy} title="No achievements yet" description="Achieved goals will appear here with confetti celebrations. Keep pushing — your first trophy is one update away!" />
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {achievedGoals.map((g, i) => {
                  const type = GOAL_TYPES.find((t) => t.id === g.type)!;
                  return (
                    <motion.div key={g.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                      className="gc-glass rounded-2xl p-5 text-center relative overflow-hidden">
                      <div className="absolute -top-6 -right-6 text-amber-500/10"><Trophy className="h-20 w-20" /></div>
                      <div className="grid place-items-center h-12 w-12 rounded-2xl mx-auto mb-3" style={{ background: `${type.color}22`, color: type.color }}>
                        <type.icon className="h-6 w-6" />
                      </div>
                      <h4 className="text-white font-semibold mb-1">{g.title}</h4>
                      <p className="text-xs text-white/50 mb-3">{type.name}</p>
                      <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-500/10">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Achieved
                      </Badge>
                      {g.achievedAt && (
                        <p className="text-xs text-white/40 mt-2">{new Date(g.achievedAt).toLocaleDateString()}</p>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ===== AI INSIGHTS ===== */}
          <TabsContent value="ai" className="space-y-4">
            <div className="gc-glass rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <div className="grid place-items-center h-10 w-10 rounded-xl bg-fuchsia-500/20 text-fuchsia-300 shrink-0">
                  <Brain className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">AI Goal Insights</h3>
                  <p className="text-sm text-white/70 mt-0.5">Open any active goal and click "AI check-in" to get a personalised assessment, suggestions and success probability from your AI coach.</p>
                </div>
              </div>
            </div>

            {!aiCheckinFor && !aiLoading && (
              <EmptyState icon={Sparkles} title="No AI check-in yet" description="Click 'AI check-in' on any active goal to receive tailored guidance and a predicted success probability." />
            )}

            {aiLoading && (
              <div className="gc-glass rounded-2xl p-12 text-center">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} className="inline-block">
                  <Brain className="h-10 w-10 text-fuchsia-300" />
                </motion.div>
                <p className="text-white/70 mt-3 text-sm">AI is analysing your goal…</p>
              </div>
            )}

            {aiCheckin && aiCheckinFor && !aiLoading && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="gc-glass rounded-xl p-4 text-xs text-white/60 flex items-center gap-2">
                  <ChevronRight className="h-3.5 w-3.5 text-amber-300" /> For: <span className="text-white">{aiCheckinFor.title}</span>
                </div>

                {/* Predicted success ring */}
                <div className="gc-glass-strong rounded-2xl p-6 flex items-center gap-6 flex-wrap">
                  <ProgressRing value={aiCheckin.predictedSuccess} size={120} stroke={10}
                    color={aiCheckin.predictedSuccess >= 70 ? "#10b981" : aiCheckin.predictedSuccess >= 40 ? "#f59e0b" : "#f43f5e"}
                    label={<div className="text-center"><p className="text-2xl font-bold text-white">{aiCheckin.predictedSuccess}%</p><p className="text-[10px] text-white/50">success</p></div>} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className={cn("border",
                        aiCheckin.onTrack ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300" : "bg-rose-500/15 border-rose-500/40 text-rose-300")}>
                        {aiCheckin.onTrack ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
                        {aiCheckin.onTrack ? "On Track" : "Off Track"}
                      </Badge>
                    </div>
                    <ScholarAIContent content={aiCheckin.summary} className="text-sm text-white/80" />
                  </div>
                </div>

                {/* Suggestions */}
                <div className="gc-glass rounded-2xl p-5">
                  <h4 className="text-white font-semibold mb-3 flex items-center gap-2"><ListChecks className="h-4 w-4 text-amber-300" /> AI Suggestions</h4>
                  <ul className="space-y-2">
                    {aiCheckin.suggestions.map((s, i) => (
                      <li key={i} className="text-sm text-white/80 flex items-start gap-2">
                        <ChevronRight className="h-3.5 w-3.5 text-amber-300 mt-0.5 shrink-0" /> {s}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Motivation */}
                <div className="gc-glass rounded-2xl p-5 border-l-2 border-fuchsia-500/50">
                  <h4 className="text-white font-semibold mb-1 flex items-center gap-2"><Crown className="h-4 w-4 text-amber-300" /> Coach's Note</h4>
                  <ScholarAIContent content={aiCheckin.motivation} mode="compact" className="text-sm italic text-white/80" />
                </div>
              </motion.div>
            )}
          </TabsContent>
        </Tabs>

        {/* ===== CREATE GOAL DIALOG ===== */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="gc-glass-strong !bg-black/60 !border-white/20 max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="gc-font-serif text-2xl text-white flex items-center gap-2">
                <Flag className="h-5 w-5 text-amber-300" /> Create New Goal
              </DialogTitle>
              <DialogDescription className="text-white/70">Choose a goal type, set a target and deadline. +5 XP for creating.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Goal type */}
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-wider mb-2 block">Goal Type</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {GOAL_TYPES.map((t) => (
                    <button key={t.id} onClick={() => { setFormType(t.id); setFormTarget(t.defaultTarget); }}
                      className={cn("p-2.5 rounded-lg border text-left transition-all",
                        formType === t.id ? "border-white/40 bg-white/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]")}>
                      <t.icon className="h-4 w-4 mb-1" style={{ color: t.color }} />
                      <p className="text-xs text-white font-medium leading-tight">{t.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Title</Label>
                <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Score 90% in Science Term 2"
                  className="bg-white/5 border-white/15 text-white" />
              </div>

              {/* Target */}
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">
                  Target: {formTarget} {GOAL_TYPES.find((t) => t.id === formType)?.unit}
                </Label>
                <input type="range" min={1} max={formType === "daily" ? 480 : formType === "weekly" ? 30 : formType === "monthly" ? 100 : 100} step={1}
                  value={formTarget}
                  onChange={(e) => setFormTarget(Number(e.target.value))}
                  className="w-full accent-amber-400" />
              </div>

              {/* Subject (only for marks/exam) */}
              {(formType === "marks" || formType === "exam") && (
                <div>
                  <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Subject (optional)</Label>
                  <select value={formSubject} onChange={(e) => setFormSubject(e.target.value)}
                    className="w-full p-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm">
                    <option value="">Any subject</option>
                    <option value="maths">Mathematics</option>
                    <option value="science">Science</option>
                    <option value="sst">Social Science</option>
                    <option value="english">English</option>
                    <option value="hindi">Hindi</option>
                  </select>
                </div>
              )}

              {/* Deadline */}
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Deadline</Label>
                <Input type="date" value={formDeadline} onChange={(e) => setFormDeadline(e.target.value)}
                  className="bg-white/5 border-white/15 text-white" />
              </div>

              {/* Preview */}
              <div className="bg-white/[0.04] rounded-xl p-3 border border-white/10">
                <p className="text-xs text-white/50 mb-1">Preview</p>
                <div className="flex items-center gap-2">
                  {(() => {
                    const t = GOAL_TYPES.find((t) => t.id === formType)!;
                    return <t.icon className="h-4 w-4" style={{ color: t.color }} />;
                  })()}
                  <span className="text-white text-sm font-medium">{formTitle || "Your goal title"}</span>
                </div>
                <p className="text-xs text-white/60 mt-1">Target {formTarget} {GOAL_TYPES.find((t) => t.id === formType)?.unit} by {formDeadline}</p>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="ghost" className="text-white/70" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={createGoal}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Create goal (+5 XP)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export default GoalCenterView;
