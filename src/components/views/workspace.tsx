"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { askAI } from "@/lib/ai";
import { useStore } from "@/lib/store";
import { CURRICULUM } from "@/lib/curriculum";
import { useCurriculum } from "@/lib/use-curriculum";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus, RefreshCw, Pencil, Check, Timer as TimerIcon, StickyNote, Brain,
  Calculator, PenTool, MessageSquare, Sigma, ListChecks, CalendarDays,
  BarChart3, Music, Trash2, ChevronUp, ChevronDown, X, Play, Pause,
  RotateCcw, Send, Sparkles, Eraser, Square, Circle, Minus, Save, Zap,
  Flame, Coins, TrendingUp, Layers, ArrowUp, ArrowDown,
} from "lucide-react";

// ============================================================================
// Study Workspace
// ============================================================================

type WidgetType =
  | "timer" | "notes" | "aichat" | "stats" | "todo"
  | "flashcards" | "calculator" | "whiteboard" | "formulas" | "calendar"
  | "music" | "sticky";

interface WidgetDef {
  type: WidgetType;
  name: string;
  icon: any;
  color: string;
  description: string;
}

const WIDGETS: WidgetDef[] = [
  { type: "timer",      name: "Pomodoro Timer",   icon: TimerIcon,    color: "#f43f5e", description: "25-min focus sessions with +5 XP per completion." },
  { type: "notes",      name: "Quick Notes",      icon: StickyNote,   color: "#f59e0b", description: "Autosaved scratch notes for fleeting thoughts." },
  { type: "aichat",     name: "AI Chat",          icon: MessageSquare,color: "#d946ef", description: "Quick questions to your AI tutor." },
  { type: "stats",      name: "Quick Stats",      icon: BarChart3,    color: "#10b981", description: "Live XP, streak, coins and level." },
  { type: "todo",       name: "To-Do List",       icon: ListChecks,   color: "#14b8a6", description: "Today's tasks with check-off." },
  { type: "flashcards", name: "Flashcards",       icon: Layers,       color: "#6366f1", description: "Flip-card review from your decks." },
  { type: "calculator", name: "Calculator",       icon: Calculator,   color: "#0ea5e9", description: "Working ±×÷ calculator." },
  { type: "whiteboard", name: "Whiteboard",       icon: PenTool,      color: "#8b5cf6", description: "Canvas with mouse/touch drawing, autosaved." },
  { type: "formulas",   name: "Formula Sheet",    icon: Sigma,        color: "#d946ef", description: "Shuffle through CBSE formulas." },
  { type: "calendar",   name: "Calendar",         icon: CalendarDays, color: "#f59e0b", description: "Month view with task dots." },
  { type: "music",      name: "Lo-fi Music",      icon: Music,        color: "#14b8a6", description: "Mock equalizer for study vibes." },
  { type: "sticky",     name: "Sticky Notes",     icon: StickyNote,   color: "#f59e0b", description: "Colored sticky notes board." },
];

const DEFAULT_LAYOUT: WidgetType[] = ["timer", "notes", "aichat", "stats", "todo"];
const STORAGE_LAYOUT = "ws-layout";
const STORAGE_NOTES = "ws-notes";
const STORAGE_TODO = "ws-todo";
const STORAGE_STICKY = "ws-sticky";
const STORAGE_WB = "ws-whiteboard";

function loadLayout(): WidgetType[] {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;
  try { const r = localStorage.getItem(STORAGE_LAYOUT); return r ? JSON.parse(r) : DEFAULT_LAYOUT; } catch { return DEFAULT_LAYOUT; }
}
function saveLayout(l: WidgetType[]) { try { localStorage.setItem(STORAGE_LAYOUT, JSON.stringify(l)); } catch {} }

// ============================================================================
// Main Component
// ============================================================================
export function WorkspaceView() {
  const CURRICULUM = useCurriculum();
  const [layout, setLayout] = useState<WidgetType[]>(() => loadLayout());
  const [editMode, setEditMode] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const updateLayout = (next: WidgetType[]) => { setLayout(next); saveLayout(next); };

  const removeWidget = (type: WidgetType) => updateLayout(layout.filter((t) => t !== type));
  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...layout]; [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    updateLayout(next);
  };
  const moveDown = (idx: number) => {
    if (idx === layout.length - 1) return;
    const next = [...layout]; [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    updateLayout(next);
  };
  const addWidget = (type: WidgetType) => {
    if (layout.includes(type)) { toast.error("Already in workspace"); return; }
    updateLayout([...layout, type]);
    toast.success(`${WIDGETS.find((w) => w.type === type)?.name} added`);
    setAddOpen(false);
  };
  const resetLayout = () => { updateLayout(DEFAULT_LAYOUT); toast.success("Layout reset to default"); };

  // Responsive column count
  const colsClass = "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&display=swap');
        .ws-font-serif { font-family: 'Instrument Serif', serif; }
        .ws-font-body { font-family: 'Inter', sans-serif; }
        .ws-glass { background: rgba(255,255,255,0.04); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.12); box-shadow: inset 0 1px 1px rgba(255,255,255,0.08); color: white; }
        .ws-glass-strong { background: rgba(255,255,255,0.07); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.16); box-shadow: inset 0 1px 1px rgba(255,255,255,0.1); color: white; }
        .ws-glass input, .ws-glass textarea, .ws-glass select { background: rgba(255,255,255,0.05) !important; border-color: rgba(255,255,255,0.15) !important; color: white !important; }
        .ws-glass input::placeholder, .ws-glass textarea::placeholder { color: rgba(255,255,255,0.4) !important; }
      `}</style>

      <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover z-0">
        <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_204221_5339e40b-e73d-4ab0-9c65-79c18c66fd50.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 z-0 bg-black/55" />

      <div className="relative z-10 ws-font-body p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
        {/* COMPACT HERO + TOOLBAR */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="mb-5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 text-indigo-300 border border-white/10">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h1 className="ws-font-serif text-3xl md:text-4xl text-white leading-tight">
                Study <em className="text-indigo-300">Workspace</em>
              </h1>
              <p className="text-white/60 text-xs mt-0.5">12 widgets • customizable canvas • {layout.length} active</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" className="ws-glass bg-white/5 border-white/15 text-white hover:bg-white/10"
              onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Widget
            </Button>
            <Button size="sm" variant="outline" className="ws-glass bg-white/5 border-white/15 text-white hover:bg-white/10"
              onClick={resetLayout}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Reset
            </Button>
            <Button size="sm"
              className={editMode ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-indigo-500 hover:bg-indigo-600 text-white"}
              onClick={() => setEditMode(!editMode)}>
              {editMode ? <><Check className="h-3.5 w-3.5 mr-1.5" />Done</> : <><Pencil className="h-3.5 w-3.5 mr-1.5" />Edit</>}
            </Button>
          </div>
        </motion.div>

        {/* WIDGET GRID */}
        <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
          className={cn("grid gap-3", colsClass)}>
          <AnimatePresence mode="popLayout">
            {layout.map((type, idx) => {
              const def = WIDGETS.find((w) => w.type === type)!;
              return (
                <motion.div key={type}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.25 }}
                  layout
                  className="ws-glass rounded-2xl p-4 relative overflow-hidden"
                  style={{ borderLeftColor: def.color, borderLeftWidth: 2 }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="grid place-items-center h-7 w-7 rounded-lg" style={{ background: `${def.color}22`, color: def.color }}>
                        <def.icon className="h-3.5 w-3.5" />
                      </div>
                      <h3 className="text-white text-sm font-semibold">{def.name}</h3>
                    </div>
                    {editMode && (
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => moveUp(idx)} disabled={idx === 0} className="p-1 rounded hover:bg-white/10 text-white/60 disabled:opacity-30">
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => moveDown(idx)} disabled={idx === layout.length - 1} className="p-1 rounded hover:bg-white/10 text-white/60 disabled:opacity-30">
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => removeWidget(type)} className="p-1 rounded hover:bg-rose-500/15 text-rose-300">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Widget body */}
                  <WidgetRenderer type={type} color={def.color} />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>

        {layout.length === 0 && (
          <div className="ws-glass rounded-2xl p-12 text-center mt-6">
            <Layers className="h-12 w-12 mx-auto text-white/30 mb-3" />
            <h3 className="text-white font-semibold mb-1">Empty workspace</h3>
            <p className="text-white/60 text-sm mb-4">Add widgets to build your personalised study canvas.</p>
            <Button className="bg-indigo-500 hover:bg-indigo-600 text-white" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Add your first widget
            </Button>
          </div>
        )}

        {/* ADD WIDGET DIALOG */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="ws-glass-strong !bg-black/60 !border-white/20 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="ws-font-serif text-2xl text-white flex items-center gap-2">
                <Plus className="h-5 w-5 text-indigo-300" /> Add Widget
              </DialogTitle>
              <DialogDescription className="text-white/70">Pick from 12 widgets to add to your workspace.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
              {WIDGETS.map((w) => {
                const inLayout = layout.includes(w.type);
                return (
                  <button key={w.type} disabled={inLayout}
                    onClick={() => addWidget(w.type)}
                    className={cn("p-3 rounded-xl border text-left transition-all",
                      inLayout ? "border-white/5 bg-white/[0.02] opacity-50 cursor-not-allowed" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/25")}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="grid place-items-center h-8 w-8 rounded-lg" style={{ background: `${w.color}22`, color: w.color }}>
                        <w.icon className="h-4 w-4" />
                      </div>
                      {inLayout && <Check className="h-3.5 w-3.5 text-emerald-300 ml-auto" />}
                    </div>
                    <p className="text-sm text-white font-medium">{w.name}</p>
                    <p className="text-[10px] text-white/50 mt-0.5 leading-tight">{w.description}</p>
                  </button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// ============================================================================
// Widget Renderer
// ============================================================================
function WidgetRenderer({ type, color }: { type: WidgetType; color: string }) {
  switch (type) {
    case "timer":      return <TimerWidget color={color} />;
    case "notes":      return <NotesWidget color={color} />;
    case "aichat":     return <AIChatWidget color={color} />;
    case "stats":      return <StatsWidget color={color} />;
    case "todo":       return <TodoWidget color={color} />;
    case "flashcards": return <FlashcardsWidget color={color} />;
    case "calculator": return <CalculatorWidget color={color} />;
    case "whiteboard": return <WhiteboardWidget color={color} />;
    case "formulas":   return <FormulasWidget color={color} />;
    case "calendar":   return <CalendarWidget color={color} />;
    case "music":      return <MusicWidget color={color} />;
    case "sticky":     return <StickyWidget color={color} />;
    default:           return null;
  }
}

// ============================================================================
// 1. Pomodoro Timer
// ============================================================================
function TimerWidget({ color }: { color: string }) {
  const addXP = useStore((s) => s.addXP);
  const addCoins = useStore((s) => s.addCoins);
  const pushActivity = useStore((s) => s.pushActivity);
  const addSession = useStore((s) => s.addSession);
  const bumpStreak = useStore((s) => s.bumpStreak);
  const [mode, setMode] = useState<"focus" | "short" | "long">("focus");
  const durations = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
  const [secondsLeft, setSecondsLeft] = useState(durations.focus);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastModeRef = useRef(mode);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          // Complete
          clearInterval(intervalRef.current!);
          setRunning(false);
          if (mode === "focus") {
            addXP(5); addCoins(2); bumpStreak();
            addSession({ id: "s-" + Date.now(), type: "pomodoro", duration: durations.focus, completedAt: Date.now(), subject: undefined });
            pushActivity({ type: "focus", text: "Pomodoro completed (+5 XP)", icon: "🍅" });
            toast.success("Pomodoro complete! +5 XP", { description: "Take a short break." });
          } else {
            toast.success("Break over — back to focus!");
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, mode, addXP, addCoins, addSession, pushActivity, bumpStreak]);

  const switchMode = (m: typeof mode) => {
    lastModeRef.current = m;
    setMode(m);
    setSecondsLeft(durations[m]);
    setRunning(false);
  };
  const reset = () => { setSecondsLeft(durations[mode]); setRunning(false); };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const progress = ((durations[mode] - secondsLeft) / durations[mode]) * 100;

  return (
    <div className="flex flex-col items-center">
      <div className="flex gap-1 mb-3">
        {(["focus", "short", "long"] as const).map((m) => (
          <button key={m} onClick={() => switchMode(m)}
            className={cn("px-2 py-0.5 rounded-md text-[10px] font-medium transition-all",
              mode === m ? "text-white" : "bg-white/5 text-white/50 hover:bg-white/10")}
            style={mode === m ? { background: color } : undefined}>
            {m === "focus" ? "Focus" : m === "short" ? "Short" : "Long"}
          </button>
        ))}
      </div>
      <div className="relative w-32 h-32 grid place-items-center mb-3">
        <svg className="absolute inset-0 -rotate-90" width="128" height="128">
          <circle cx="64" cy="64" r="58" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
          <circle cx="64" cy="64" r="58" fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={2 * Math.PI * 58} strokeDashoffset={(2 * Math.PI * 58) * (1 - progress / 100)}
            strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s linear" }} />
        </svg>
        <div className="text-center">
          <p className="text-3xl font-bold text-white tabular-nums leading-none">{mm}:{ss}</p>
          <p className="text-[10px] text-white/40 mt-1">{mode === "focus" ? "Focus time" : "Break"}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" className="text-white" style={{ background: color }} onClick={() => setRunning(!running)}>
          {running ? <><Pause className="h-3.5 w-3.5 mr-1" />Pause</> : <><Play className="h-3.5 w-3.5 mr-1" />Start</>}
        </Button>
        <Button size="sm" variant="outline" className="bg-white/5 border-white/15 text-white hover:bg-white/10" onClick={reset}>
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// 2. Quick Notes (autosave)
// ============================================================================
function NotesWidget({ color }: { color: string }) {
  const [text, setText] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try { return localStorage.getItem(STORAGE_NOTES) ?? ""; } catch { return ""; }
  });
  const [saved, setSaved] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onChange = (val: string) => {
    setText(val); setSaved(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      try { localStorage.setItem(STORAGE_NOTES, val); setSaved(true); } catch {}
    }, 600);
  };

  return (
    <div>
      <Textarea value={text} onChange={(e) => onChange(e.target.value)}
        placeholder="Jot down anything… autosaves as you type."
        rows={6}
        className="bg-white/5 border-white/15 text-white text-sm resize-none" />
      <div className="flex items-center justify-between mt-2 text-[10px]">
        <span className="text-white/40">{text.length} chars</span>
        <span className={cn("flex items-center gap-1", saved ? "text-emerald-300" : "text-amber-300")}>
          {saved ? <><Check className="h-2.5 w-2.5" />Saved</> : <><Save className="h-2.5 w-2.5" />Saving…</>}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// 3. AI Chat
// ============================================================================
function AIChatWidget({ color }: { color: string }) {
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: "Hi! Ask me anything — concepts, doubts, formulas." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const q = input.trim();
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput(""); setLoading(true);
    try {
      const res = await askAI(q, "default");
      setMessages((m) => [...m, { role: "ai", text: res }]);
    } catch {
      setMessages((m) => [...m, { role: "ai", text: "Sorry, I couldn't reach the AI service. Try again in a moment." }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col h-64">
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 pr-1" style={{ scrollbarWidth: "thin" }}>
        {messages.map((m, i) => (
          <div key={i} className={cn("text-xs p-2 rounded-lg leading-relaxed",
            m.role === "user" ? "bg-white/10 text-white ml-6" : "bg-white/[0.04] text-white/85 mr-6 border-l-2")}
            style={m.role === "ai" ? { borderLeftColor: color } : undefined}>
            {m.text}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-1 text-white/40 text-xs ml-2">
            <motion.div className="h-1.5 w-1.5 rounded-full" style={{ background: color }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity }} />
            <motion.div className="h-1.5 w-1.5 rounded-full" style={{ background: color }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.2 }} />
            <motion.div className="h-1.5 w-1.5 rounded-full" style={{ background: color }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.4 }} />
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask anything…"
          className="bg-white/5 border-white/15 text-white text-xs h-8" />
        <Button size="sm" className="h-8 px-2 text-white" style={{ background: color }} disabled={loading} onClick={send}>
          <Send className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// 4. Quick Stats
// ============================================================================
function StatsWidget({ color }: { color: string }) {
  const xp = useStore((s) => s.xp);
  const streak = useStore((s) => s.streak);
  const coins = useStore((s) => s.coins);
  const level = useStore((s) => s.level);
  const mastery = useStore((s) => s.mastery);

  const avgMastery = useMemo(() => {
    const vals = Object.values(mastery);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  }, [mastery]);

  const stats = [
    { icon: Zap, label: "XP", value: xp, color: "#f59e0b" },
    { icon: TrendingUp, label: "Level", value: level, color: color },
    { icon: Flame, label: "Streak", value: `${streak}d`, color: "#f43f5e" },
    { icon: Coins, label: "Coins", value: coins, color: "#f59e0b" },
  ];
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {stats.map((s, i) => (
          <div key={i} className="bg-white/[0.04] rounded-lg p-2.5 border border-white/10">
            <div className="flex items-center gap-1.5 mb-0.5">
              <s.icon className="h-3 w-3" style={{ color: s.color }} />
              <span className="text-[10px] text-white/50 uppercase tracking-wider">{s.label}</span>
            </div>
            <p className="text-xl font-bold text-white tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>
      <div>
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-white/60">Avg Mastery</span>
          <span className="text-white font-medium">{avgMastery}%</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div className="h-full rounded-full" style={{ background: color }}
            initial={{ width: 0 }} animate={{ width: `${avgMastery}%` }} transition={{ duration: 0.8 }} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 5. To-Do List
// ============================================================================
function TodoWidget({ color }: { color: string }) {
  const tasks = useStore((s) => s.tasks);
  const toggleTask = useStore((s) => s.toggleTask);
  const addTask = useStore((s) => s.addTask);
  const [newTask, setNewTask] = useState("");

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTasks = tasks.filter((t) => t.date === todayStr);
  const [localTodos, setLocalTodos] = useState<{ id: string; text: string; done: boolean }[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(STORAGE_TODO) ?? "[]"); } catch { return []; }
  });

  const persist = (next: typeof localTodos) => {
    setLocalTodos(next);
    try { localStorage.setItem(STORAGE_TODO, JSON.stringify(next)); } catch {}
  };

  const add = () => {
    if (!newTask.trim()) return;
    persist([{ id: "ws-" + Date.now(), text: newTask.trim(), done: false }, ...localTodos]);
    setNewTask("");
  };
  const toggle = (id: string) => persist(localTodos.map((t) => t.id === id ? { ...t, done: !t.done } : t));
  const remove = (id: string) => persist(localTodos.filter((t) => t.id !== id));

  const allTodos = [
    ...todayTasks.map((t) => ({ id: t.id, text: t.title, done: t.done, isStore: true })),
    ...localTodos.map((t) => ({ ...t, isStore: false })),
  ];

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Input value={newTask} onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          placeholder="Add a task…"
          className="bg-white/5 border-white/15 text-white text-xs h-8" />
        <Button size="sm" className="h-8 px-2 text-white" style={{ background: color }} onClick={add}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
        {allTodos.length === 0 && <p className="text-xs text-white/40 text-center py-3">No tasks today. Add one above ↑</p>}
        {allTodos.map((t) => (
          <div key={t.id} className="flex items-center gap-2 group">
            <button onClick={() => t.isStore ? toggleTask(t.id) : toggle(t.id)}
              className={cn("h-4 w-4 rounded border grid place-items-center shrink-0 transition-all",
                t.done ? "border-transparent text-white" : "border-white/30 hover:border-white/60")}
              style={t.done ? { background: color } : undefined}>
              {t.done && <Check className="h-2.5 w-2.5" />}
            </button>
            <span className={cn("text-xs flex-1 truncate", t.done ? "text-white/40 line-through" : "text-white/85")}>{t.text}</span>
            {!t.isStore && (
              <button onClick={() => remove(t.id)} className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-rose-300 transition-opacity">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 6. Flashcards (flip)
// ============================================================================
function FlashcardsWidget({ color }: { color: string }) {
  const flashcards = useStore((s) => s.flashcards);
  const decks = useStore((s) => s.decks);
  const reviewFlashcard = useStore((s) => s.reviewFlashcard);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const cards = flashcards.slice(0, 20);

  const next = () => { setFlipped(false); setIdx((i) => (i + 1) % Math.max(1, cards.length)); };
  const prev = () => { setFlipped(false); setIdx((i) => (i - 1 + Math.max(1, cards.length)) % Math.max(1, cards.length)); };

  const rate = (q: "again" | "hard" | "good" | "easy") => {
    if (cards[idx]) {
      reviewFlashcard(cards[idx].id, q);
      toast.success(`Marked ${q} • next card`);
      next();
    }
  };

  if (cards.length === 0) {
    return (
      <div className="text-center py-6">
        <Layers className="h-8 w-8 mx-auto text-white/30 mb-2" />
        <p className="text-xs text-white/50">No flashcards yet. Add some from the Flashcards view.</p>
        <p className="text-[10px] text-white/30 mt-1">{decks.length} decks available</p>
      </div>
    );
  }

  const card = cards[idx];
  return (
    <div>
      <div className="relative h-32 mb-3" style={{ perspective: "1000px" }}>
        <motion.div className="absolute inset-0 cursor-pointer"
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.5 }}
          style={{ transformStyle: "preserve-3d" }}
          onClick={() => setFlipped(!flipped)}>
          <div className="absolute inset-0 rounded-xl p-3 flex flex-col items-center justify-center text-center"
            style={{ background: `${color}15`, border: `1px solid ${color}40`, backfaceVisibility: "hidden" }}>
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Question {idx + 1}/{cards.length}</p>
            <p className="text-sm text-white font-medium leading-snug">{card.front}</p>
            <p className="text-[10px] text-white/40 mt-2">Tap to flip</p>
          </div>
          <div className="absolute inset-0 rounded-xl p-3 flex flex-col items-center justify-center text-center"
            style={{ background: `${color}25`, border: `1px solid ${color}60`, backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Answer</p>
            <p className="text-sm text-white leading-snug overflow-y-auto">{card.back}</p>
          </div>
        </motion.div>
      </div>
      {flipped ? (
        <div className="grid grid-cols-4 gap-1">
          <button onClick={() => rate("again")} className="text-[10px] py-1 rounded-md bg-rose-500/20 text-rose-200 hover:bg-rose-500/30">Again</button>
          <button onClick={() => rate("hard")} className="text-[10px] py-1 rounded-md bg-amber-500/20 text-amber-200 hover:bg-amber-500/30">Hard</button>
          <button onClick={() => rate("good")} className="text-[10px] py-1 rounded-md bg-teal-500/20 text-teal-200 hover:bg-teal-500/30">Good</button>
          <button onClick={() => rate("easy")} className="text-[10px] py-1 rounded-md bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30">Easy</button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <Button size="sm" variant="outline" className="h-7 text-xs bg-white/5 border-white/15 text-white hover:bg-white/10" onClick={prev}>
            <ChevronUp className="h-3 w-3 rotate-[-90deg]" />
          </Button>
          <span className="text-[10px] text-white/40">Box {card.box}/5</span>
          <Button size="sm" variant="outline" className="h-7 text-xs bg-white/5 border-white/15 text-white hover:bg-white/10" onClick={next}>
            <ChevronDown className="h-3 w-3 rotate-[-90deg]" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 7. Calculator
// ============================================================================
function CalculatorWidget({ color }: { color: string }) {
  const [display, setDisplay] = useState("0");
  const [expr, setExpr] = useState("");

  const press = (key: string) => {
    if (key === "C") { setDisplay("0"); setExpr(""); return; }
    if (key === "←") { setExpr((e) => e.slice(0, -1)); setDisplay((d) => d.length > 1 ? d.slice(0, -1) : "0"); return; }
    if (key === "=") {
      try {
        // Sanitize: replace × and ÷ with * and /
        const safe = expr.replace(/×/g, "*").replace(/÷/g, "/");
        const result = Function(`"use strict";return (${safe})`)();
        if (typeof result === "number" && isFinite(result)) {
          setDisplay(String(result));
          setExpr(String(result));
        } else { setDisplay("Error"); }
      } catch { setDisplay("Error"); }
      return;
    }
    const newExpr = (expr === "0" || display === "Error" ? "" : expr) + key;
    setExpr(newExpr);
    setDisplay(newExpr);
  };

  const keys = [
    ["C", "←", "÷", "×"],
    ["7", "8", "9", "−"],
    ["4", "5", "6", "+"],
    ["1", "2", "3", "="],
    ["0", ".", "(", ")"],
  ];

  return (
    <div>
      <div className="rounded-lg p-2.5 mb-2 text-right" style={{ background: `${color}10`, border: `1px solid ${color}30` }}>
        <p className="text-[10px] text-white/40 truncate font-mono">{expr || "0"}</p>
        <p className="text-2xl font-bold text-white font-mono truncate">{display}</p>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {keys.flat().map((k) => {
          const isOp = ["÷", "×", "−", "+", "="].includes(k);
          const isFn = ["C", "←"].includes(k);
          return (
            <button key={k} onClick={() => press(k === "−" ? "-" : k)}
              className={cn("h-9 rounded-md text-sm font-medium transition-all",
                k === "=" ? "col-span-1 text-white" : isFn ? "bg-rose-500/15 text-rose-200 hover:bg-rose-500/25" : isOp ? "bg-white/10 text-white hover:bg-white/15" : "bg-white/[0.04] text-white hover:bg-white/10")}
              style={k === "=" ? { background: color } : undefined}>
              {k}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 8. Whiteboard (canvas)
// ============================================================================
function WhiteboardWidget({ color }: { color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [penColor, setPenColor] = useState("#ffffff");
  const [penSize, setPenSize] = useState(3);

  const colors = ["#ffffff", "#f43f5e", "#f59e0b", "#10b981", "#0ea5e9", "#8b5cf6"];

  // Restore saved
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const parent = c.parentElement!;
    const setupCanvas = () => {
      c.width = parent.clientWidth;
      c.height = 200;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      try {
        const saved = localStorage.getItem(STORAGE_WB);
        if (saved) {
          const img = new Image();
          img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height);
          img.src = saved;
        }
      } catch {}
    };
    setupCanvas();
    const obs = new ResizeObserver(setupCanvas);
    obs.observe(parent);
    return () => obs.disconnect();
  }, []);

  const getPos = (e: React.PointerEvent) => {
    const c = canvasRef.current!; const rect = c.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (c.width / rect.width), y: (e.clientY - rect.top) * (c.height / rect.height) };
  };

  const start = (e: React.PointerEvent) => {
    drawing.current = true; last.current = getPos(e);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const c = canvasRef.current!; const ctx = c.getContext("2d")!;
    const pos = getPos(e);
    ctx.strokeStyle = penColor; ctx.lineWidth = penSize;
    ctx.beginPath();
    ctx.moveTo(last.current!.x, last.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    last.current = pos;
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false; last.current = null;
    // Autosave
    try { localStorage.setItem(STORAGE_WB, canvasRef.current!.toDataURL("image/png")); } catch {}
  };

  const clear = () => {
    const c = canvasRef.current!; const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    try { localStorage.removeItem(STORAGE_WB); } catch {}
    toast.success("Whiteboard cleared");
  };

  return (
    <div>
      <div className="rounded-lg overflow-hidden border border-white/10 mb-2" style={{ background: "rgba(0,0,0,0.4)" }}>
        <canvas ref={canvasRef}
          onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end}
          className="w-full block touch-none cursor-crosshair" style={{ height: 200 }} />
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="flex gap-1">
          {colors.map((c) => (
            <button key={c} onClick={() => setPenColor(c)}
              className={cn("h-5 w-5 rounded-full border transition-all", penColor === c ? "border-white scale-110" : "border-white/30")}
              style={{ background: c }} />
          ))}
        </div>
        <input type="range" min={1} max={10} value={penSize} onChange={(e) => setPenSize(Number(e.target.value))}
          className="w-12 h-1 accent-white" />
        <Button size="sm" variant="outline" className="h-7 text-xs bg-white/5 border-white/15 text-white hover:bg-white/10 ml-auto" onClick={clear}>
          <Eraser className="h-3 w-3 mr-1" />Clear
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// 9. Formula Sheet (shuffle)
// ============================================================================
function FormulasWidget({ color }: { color: string }) {
  const allFormulas = useMemo(() => {
    return CURRICULUM.flatMap((s) => (s.chapters.flatMap((c) => (c.formulas ?? []).map((f) => ({ formula: f, subject: s.id, chapter: c.title, accent: s.accent })))));
  }, []);
  const [idx, setIdx] = useState(0);
  const [shuffled, setShuffled] = useState(allFormulas);

  const shuffle = () => {
    const arr = [...allFormulas];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setShuffled(arr); setIdx(0);
    toast.success("Formulas shuffled");
  };

  if (shuffled.length === 0) return <p className="text-xs text-white/50 text-center py-6">No formulas available.</p>;
  const f = shuffled[idx % shuffled.length];
  return (
    <div>
      <div className="rounded-lg p-4 mb-2 text-center" style={{ background: `${f.accent}15`, border: `1px solid ${f.accent}40` }}>
        <p className="text-[10px] text-white/40 mb-2 uppercase tracking-wider">{f.chapter}</p>
        <p className="text-lg text-white font-mono leading-relaxed">{f.formula}</p>
      </div>
      <div className="flex items-center justify-between">
        <Button size="sm" variant="outline" className="h-7 text-xs bg-white/5 border-white/15 text-white hover:bg-white/10"
          onClick={() => setIdx((i) => (i - 1 + shuffled.length) % shuffled.length)}>
          <ChevronUp className="h-3 w-3 rotate-[-90deg]" />
        </Button>
        <span className="text-[10px] text-white/40 tabular-nums">{(idx % shuffled.length) + 1} / {shuffled.length}</span>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-7 text-xs bg-white/5 border-white/15 text-white hover:bg-white/10" onClick={shuffle}>
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs bg-white/5 border-white/15 text-white hover:bg-white/10"
            onClick={() => setIdx((i) => (i + 1) % shuffled.length)}>
            <ChevronDown className="h-3 w-3 rotate-[-90deg]" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 10. Calendar (month grid)
// ============================================================================
function CalendarWidget({ color }: { color: string }) {
  const tasks = useStore((s) => s.tasks);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const tasksByDate = useMemo(() => {
    const map: Record<string, number> = {};
    tasks.forEach((t) => { (map[t.date] ??= 0); map[t.date]++; });
    return map;
  }, [tasks]);

  const first = new Date(month);
  const startDay = first.getDay();
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const isToday = (d: number) => today.getDate() === d && today.getMonth() === month.getMonth() && today.getFullYear() === month.getFullYear();

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="text-white/50 hover:text-white p-0.5">
          <ChevronUp className="h-3.5 w-3.5 rotate-[-90deg]" />
        </button>
        <p className="text-xs text-white font-medium">{month.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</p>
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="text-white/50 hover:text-white p-0.5">
          <ChevronDown className="h-3.5 w-3.5 rotate-[-90deg]" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="text-[9px] text-white/40">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const dateStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const count = tasksByDate[dateStr] ?? 0;
          return (
            <div key={i} className={cn("h-6 rounded grid place-items-center text-[10px] relative",
              isToday(d) ? "text-white font-bold" : "text-white/70")}
              style={isToday(d) ? { background: color } : count > 0 ? { background: `${color}22` } : undefined}>
              {d}
              {count > 0 && !isToday(d) && <div className="absolute bottom-0.5 h-0.5 w-0.5 rounded-full" style={{ background: color }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 11. Music (lofi mock equalizer)
// ============================================================================
function MusicWidget({ color }: { color: string }) {
  const [playing, setPlaying] = useState(false);
  const [track, setTrack] = useState(0);
  const tracks = ["Late Night Study", "Rainy Library", "Coffee Shop", "Lo-fi Beats"];
  const bars = 16;

  return (
    <div>
      <div className="rounded-lg p-3 mb-3 text-center" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
        <div className="flex items-end justify-center gap-0.5 h-12 mb-2">
          {Array.from({ length: bars }).map((_, i) => (
            <motion.div key={i}
              className="flex-1 rounded-sm"
              style={{ background: color, maxWidth: 4 }}
              animate={playing ? { height: [4, 8 + Math.random() * 36, 4] } : { height: 4 }}
              transition={playing ? { duration: 0.5 + Math.random() * 0.4, repeat: Infinity, delay: i * 0.04 } : { duration: 0.3 }}
            />
          ))}
        </div>
        <p className="text-sm text-white font-medium">{tracks[track]}</p>
        <p className="text-[10px] text-white/50">{playing ? "Now playing" : "Paused"}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" className="h-7 text-xs bg-white/5 border-white/15 text-white hover:bg-white/10"
          onClick={() => setTrack((t) => (t - 1 + tracks.length) % tracks.length)}>
          <ChevronUp className="h-3 w-3 rotate-[-90deg]" />
        </Button>
        <Button size="sm" className="flex-1 h-7 text-xs text-white" style={{ background: color }}
          onClick={() => setPlaying(!playing)}>
          {playing ? <><Pause className="h-3 w-3 mr-1" />Pause</> : <><Play className="h-3 w-3 mr-1" />Play</>}
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs bg-white/5 border-white/15 text-white hover:bg-white/10"
          onClick={() => setTrack((t) => (t + 1) % tracks.length)}>
          <ChevronDown className="h-3 w-3 rotate-[-90deg]" />
        </Button>
      </div>
      <p className="text-[10px] text-white/30 text-center mt-2">Mock equalizer — for vibe check</p>
    </div>
  );
}

// ============================================================================
// 12. Sticky Notes (colored)
// ============================================================================
function StickyWidget({ color }: { color: string }) {
  const [notes, setNotes] = useState<{ id: string; text: string; color: string }[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(STORAGE_STICKY) ?? "[]"); } catch { return []; }
  });
  const palette = ["#f59e0b", "#10b981", "#0ea5e9", "#f43f5e", "#8b5cf6", "#14b8a6"];

  const persist = (next: typeof notes) => {
    setNotes(next);
    try { localStorage.setItem(STORAGE_STICKY, JSON.stringify(next)); } catch {}
  };
  const add = () => persist([{ id: "st-" + Date.now(), text: "", color: palette[notes.length % palette.length] }, ...notes]);
  const update = (id: string, text: string) => persist(notes.map((n) => n.id === id ? { ...n, text } : n));
  const remove = (id: string) => persist(notes.filter((n) => n.id !== id));

  return (
    <div>
      <Button size="sm" className="w-full h-7 text-xs mb-2 text-white" style={{ background: color }} onClick={add}>
        <Plus className="h-3 w-3 mr-1" />Add sticky
      </Button>
      <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
        {notes.length === 0 && <p className="text-xs text-white/40 text-center py-3 col-span-2">Tap "Add sticky" to start.</p>}
        {notes.map((n) => (
          <div key={n.id} className="rounded-md p-2 relative group" style={{ background: `${n.color}30`, border: `1px solid ${n.color}50` }}>
            <textarea value={n.text} onChange={(e) => update(n.id, e.target.value)}
              placeholder="Note…"
              rows={3}
              className="w-full bg-transparent text-[11px] text-white resize-none focus:outline-none placeholder:text-white/40" />
            <button onClick={() => remove(n.id)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-white/60 hover:text-rose-300">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WorkspaceView;
