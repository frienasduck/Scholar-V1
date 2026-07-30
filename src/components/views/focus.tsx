"use client";

import { useStore } from "@/lib/store";
import { CURRICULUM } from "@/lib/curriculum";
import { useCurriculum } from "@/lib/use-curriculum";
import { StatCard, SectionHeader } from "@/lib/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, RotateCcw, SkipForward, Volume2, VolumeX, Target, Flame, Zap, Brain,
  Maximize2, Minimize2, Coffee, Timer as TimerIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";

type Mode = "pomodoro" | "short" | "long" | "stopwatch";

const MODE_CONFIG: Record<Mode, { label: string; duration: number; accent: string }> = {
  pomodoro: { label: "Pomodoro", duration: 25 * 60, accent: "#6366f1" },
  short: { label: "Short Break", duration: 5 * 60, accent: "#14b8a6" },
  long: { label: "Long Break", duration: 15 * 60, accent: "#f59e0b" },
  stopwatch: { label: "Stopwatch", duration: 0, accent: "#d946ef" },
};

const AMBIENT: { id: string; label: string; icon: string; type: "rain" | "forest" | "cafe" }[] = [
  { id: "rain", label: "Rain", icon: "🌧", type: "rain" },
  { id: "forest", label: "Forest", icon: "🌲", type: "forest" },
  { id: "cafe", label: "Café", icon: "☕", type: "cafe" },
];

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

const todayStr = () => new Date().toISOString().slice(0, 10);

export function FocusView() {
  const CURRICULUM = useCurriculum();
  const sessions = useStore((s) => s.sessions);
  const addSession = useStore((s) => s.addSession);
  const addXP = useStore((s) => s.addXP);
  const addCoins = useStore((s) => s.addCoins);
  const bumpStreak = useStore((s) => s.bumpStreak);
  const pushActivity = useStore((s) => s.pushActivity);
  const streak = useStore((s) => s.streak);

  const [mode, setMode] = useState<Mode>("pomodoro");
  const [remaining, setRemaining] = useState(MODE_CONFIG.pomodoro.duration);
  const [running, setRunning] = useState(false);
  const [subject, setSubject] = useState<string>("none");
  const [focusMode, setFocusMode] = useState(false);
  const [ambientId, setAmbientId] = useState<string | null>(null);
  const [volume, setVolume] = useState(40);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const noiseNodesRef = useRef<{ source: AudioBufferSourceNode; gain: GainNode; filters: BiquadFilterNode[] } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Today's pomodoros
  const todayPomos = useMemo(() => {
    const t = todayStr();
    return sessions.filter((s) => s.type === "pomodoro" && new Date(s.completedAt).toISOString().slice(0, 10) === t).length;
  }, [sessions]);

  // Switch mode + reset remaining + pause — no effect needed
  const switchMode = useCallback((m: Mode) => {
    setMode(m);
    setRemaining(MODE_CONFIG[m].duration);
    setRunning(false);
  }, []);

  const handleComplete = useCallback(() => {
    setRunning(false);
    const subj = subject !== "none" ? subject : undefined;
    if (mode === "pomodoro") {
      addSession({ id: Math.random().toString(36).slice(2) + Date.now().toString(36), type: "pomodoro", duration: 1500, completedAt: Date.now(), subject: subj });
      addXP(15);
      addCoins(5);
      bumpStreak();
      pushActivity({ type: "focus", text: "Completed 25-min focus session", icon: "🍅" });
      toast.success("Pomodoro complete! 🍅", { description: "+15 XP · +5 coins · streak bumped" });
      // auto-switch to short break
      setTimeout(() => {
        switchMode("short");
      }, 400);
    } else if (mode === "short" || mode === "long") {
      addSession({ id: Math.random().toString(36).slice(2) + Date.now().toString(36), type: mode, duration: MODE_CONFIG[mode].duration, completedAt: Date.now(), subject: subj });
      pushActivity({ type: "focus", text: `Finished ${MODE_CONFIG[mode].label.toLowerCase()}`, icon: "☕" });
      toast.success("Break finished", { description: "Ready for the next pomodoro?" });
      setTimeout(() => switchMode("pomodoro"), 400);
    }
  }, [mode, subject, addSession, addXP, addCoins, bumpStreak, pushActivity, switchMode]);

  // Ref to the latest handleComplete so the interval can call it without re-creating
  const handleCompleteRef = useRef(handleComplete);
  useEffect(() => {
    handleCompleteRef.current = handleComplete;
  }, [handleComplete]);

  // Tick — detects completion inside the interval callback (no setState-in-effect)
  useEffect(() => {
    if (!running) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (mode === "stopwatch") return r + 1;
        if (r <= 1) {
          // defer completion outside the updater
          setTimeout(() => handleCompleteRef.current(), 0);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, mode]);

  // ===== Web Audio: ambient noise generation =====
  const stopAmbient = useCallback(() => {
    const node = noiseNodesRef.current;
    if (node) {
      try {
        node.source.stop();
      } catch { /* noop */ }
      try { node.source.disconnect(); } catch { /* noop */ }
      node.filters.forEach((f) => f.disconnect());
      node.gain.disconnect();
      noiseNodesRef.current = null;
    }
  }, []);

  const buildNoiseBuffer = (ctx: AudioContext, type: "rain" | "forest" | "cafe") => {
    const seconds = 4;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    // brown noise base
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5;
    }
    if (type === "rain") {
      // sharpen — add high-pass-ish character by overlaying white noise crackle
      for (let i = 0; i < data.length; i++) {
        data[i] = data[i] * 0.6 + (Math.random() * 2 - 1) * 0.15;
      }
    } else if (type === "cafe") {
      // soft murmur — slight amplitude modulation
      for (let i = 0; i < data.length; i++) {
        const mod = 0.85 + 0.15 * Math.sin((i / ctx.sampleRate) * 1.5);
        data[i] = data[i] * mod * 0.8;
      }
    } else if (type === "forest") {
      // gentle wind — slow LFO
      for (let i = 0; i < data.length; i++) {
        const lfo = 0.7 + 0.3 * Math.sin((i / ctx.sampleRate) * 0.4);
        data[i] = data[i] * lfo * 0.9;
      }
    }
    return buffer;
  };

  const startAmbient = useCallback((id: string, vol: number) => {
    if (typeof window === "undefined") return;
    const amb = AMBIENT.find((a) => a.id === id);
    if (!amb) return;
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new Ctx();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume();
    stopAmbient();
    const src = ctx.createBufferSource();
    src.buffer = buildNoiseBuffer(ctx, amb.type);
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = vol / 100;
    // Filters shape the brown noise to taste
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = amb.type === "rain" ? 8000 : amb.type === "cafe" ? 2200 : 1500;
    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = amb.type === "rain" ? 400 : amb.type === "cafe" ? 200 : 100;
    src.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    noiseNodesRef.current = { source: src, gain, filters: [lowpass, highpass] };
  }, [stopAmbient]);

  // Volume changes
  useEffect(() => {
    if (noiseNodesRef.current) {
      noiseNodesRef.current.gain.gain.value = volume / 100;
    }
  }, [volume]);

  // cleanup on unmount
  useEffect(() => () => {
    stopAmbient();
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch { /* noop */ } }
  }, [stopAmbient]);

  const toggleAmbient = (id: string) => {
    if (ambientId === id) {
      stopAmbient();
      setAmbientId(null);
    } else {
      startAmbient(id, volume);
      setAmbientId(id);
    }
  };

  const reset = () => {
    setRunning(false);
    setRemaining(MODE_CONFIG[mode].duration);
  };

  const skip = () => {
    if (mode === "stopwatch") { setRunning(false); setRemaining(0); return; }
    setRunning(false);
    setRemaining(0);
    handleComplete();
  };

  const ringProgress = mode === "stopwatch"
    ? 0
    : MODE_CONFIG[mode].duration > 0
      ? ((MODE_CONFIG[mode].duration - remaining) / MODE_CONFIG[mode].duration) * 100
      : 0;

  const accent = MODE_CONFIG[mode].accent;

  // ===== Render =====
  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Instrument+Serif:ital@0;1&display=swap');
        .cinema-glass {
          background: rgba(255,255,255,0.03);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 25px 80px -12px rgba(0,0,0,0.3);
          color: white;
        }
        .cinema-glass:hover { background: rgba(255,255,255,0.05); }
        .cinema-font-serif { font-family: 'Instrument Serif', serif; }
        .cinema-font-body { font-family: 'Inter', sans-serif; }
        .cinema-glass .text-muted-foreground { color: rgba(255,255,255,0.6) !important; }
        .cinema-glass input, .cinema-glass textarea, .cinema-glass select {
          background: rgba(255,255,255,0.05) !important;
          border-color: rgba(255,255,255,0.15) !important;
          color: white !important;
        }
        .cinema-glass input::placeholder, .cinema-glass textarea::placeholder { color: rgba(255,255,255,0.4) !important; }
        .cinema-glass button { color: white; }
        .cinema-glass .bg-muted { background: rgba(255,255,255,0.05) !important; }
        .cinema-glass .border-border { border-color: rgba(255,255,255,0.1) !important; }
      `}</style>
      <video autoPlay muted loop playsInline poster="/backgrounds/scholar-poster.svg" preload="metadata" className="absolute inset-0 w-full h-full object-cover z-0 opacity-40">
        <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260319_015952_e1deeb12-8fb7-4071-a42a-60779fc64ab6.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 z-0 bg-black/50" />
      <div className="relative z-10 p-4 md:p-8 lg:p-12">
      <h1 className="cinema-font-serif text-4xl text-white mb-6">Focus <em>Deeply</em></h1>
    <div className={`view-enter relative ${focusMode ? "fixed inset-0 z-50 overflow-hidden" : ""}`}>
      {focusMode && (
        <>
          <div className="absolute inset-0 -z-10" style={{ background: "radial-gradient(1200px 600px at 50% 0%, rgba(99,102,241,0.18), transparent), radial-gradient(800px 500px at 100% 100%, rgba(20,184,166,0.16), transparent), var(--background)" }} />
          <div className="ambient-orb" style={{ width: 320, height: 320, top: -80, left: -80, background: "radial-gradient(circle, #6366f1, transparent 70%)" }} />
          <div className="ambient-orb" style={{ width: 280, height: 280, bottom: -60, right: -60, background: "radial-gradient(circle, #14b8a6, transparent 70%)" }} />
        </>
      )}

      <div className={focusMode ? "h-full grid place-items-center px-6" : "space-y-6 pb-10"}>
        {/* Header (hidden in focus mode) */}
        {!focusMode && (
          <>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Focus</h1>
              <p className="text-sm text-muted-foreground mt-1">Deep work, made beautiful. One pomodoro at a time.</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard icon={Target} label="Today" value={`${todayPomos}`} sub="pomodoros" accent="#6366f1" />
              <StatCard icon={Flame} label="Streak" value={streak} sub="days" accent="#f59e0b" />
              <StatCard icon={Zap} label="Total" value={sessions.length} sub="sessions" accent="#14b8a6" />
              <StatCard icon={Brain} label="Focus time" value={`${Math.round(sessions.reduce((a, s) => a + s.duration, 0) / 3600)}h`} sub="all-time" accent="#d946ef" />
            </div>
          </>
        )}

        {/* Timer card */}
        <div className={`cinema-glass rounded-2xl p-6 sm:p-10 ${focusMode ? "bg-transparent border-0 shadow-none" : ""}`}>
          {/* Mode tabs */}
          <div className="flex items-center justify-center mb-6 flex-wrap gap-1">
            {(Object.keys(MODE_CONFIG) as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
                  mode === m ? "text-white shadow-sm" : "bg-muted/60 text-muted-foreground hover:bg-muted"
                }`}
                style={mode === m ? { background: MODE_CONFIG[m].accent } : undefined}
              >
                {MODE_CONFIG[m].label}
              </button>
            ))}
          </div>

          {/* Ring */}
          <div className="grid place-items-center mb-8">
            <div className="relative">
              <svg width={focusMode ? 340 : 280} height={focusMode ? 340 : 280} viewBox="0 0 280 280" className="-rotate-90">
                <defs>
                  <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#14b8a6" />
                  </linearGradient>
                </defs>
                <circle cx="140" cy="140" r="124" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/40" />
                <circle
                  cx="140" cy="140" r="124" fill="none" stroke="url(#ring-grad)" strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 124}
                  strokeDashoffset={2 * Math.PI * 124 * (1 - ringProgress / 100)}
                  style={{ transition: "stroke-dashoffset 1s linear" }}
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <p className={`font-semibold tabular-nums ${focusMode ? "text-6xl" : "text-5xl"}`}>
                    {fmt(remaining)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest">
                    {running ? "in progress" : mode === "stopwatch" ? "tap start" : "ready"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button
              size="lg"
              onClick={() => setRunning((r) => !r)}
              className="h-12 w-12 rounded-full p-0"
              style={{ background: accent }}
            >
              {running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
            </Button>
            <Button size="lg" variant="outline" onClick={reset} className="h-12 w-12 rounded-full p-0 premium-card-hover bg-card/60">
              <RotateCcw className="h-4 w-4" />
            </Button>
            {mode !== "stopwatch" && (
              <Button size="lg" variant="outline" onClick={skip} className="h-12 w-12 rounded-full p-0 premium-card-hover bg-card/60">
                <SkipForward className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="lg"
              variant="ghost"
              onClick={() => setFocusMode((f) => !f)}
              className="h-12 w-12 rounded-full p-0"
              title={focusMode ? "Exit focus mode" : "Enter focus mode"}
            >
              {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>

          {/* Subject tag */}
          {!focusMode && (
            <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Tagging session:</span>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger className="h-8 w-[180px] text-xs">
                  <SelectValue placeholder="No subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No subject</SelectItem>
                  {CURRICULUM.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.icon} {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Ambient sounds (hidden in focus mode compact) */}
        {!focusMode && (
          <div className="cinema-glass rounded-2xl p-5">
            <SectionHeader title="Ambient sounds" subtitle="Generate focus-grade noise with Web Audio" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              {AMBIENT.map((amb) => {
                const active = ambientId === amb.id;
                return (
                  <button
                    key={amb.id}
                    onClick={() => toggleAmbient(amb.id)}
                    className={`group relative rounded-2xl p-4 border transition-all text-left ${
                      active ? "border-indigo-500/50 bg-indigo-500/10" : "border-border/60 hover:border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">{amb.icon}</span>
                      {active ? <Volume2 className="h-4 w-4 text-indigo-400" /> : <VolumeX className="h-4 w-4 text-muted-foreground/40" />}
                    </div>
                    <p className="text-sm font-medium">{amb.label}</p>
                    <p className="text-[11px] text-muted-foreground">{active ? "Playing — tap to stop" : "Tap to play"}</p>
                    {active && (
                      <motion.span
                        layoutId="amb-active"
                        className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-indigo-500"
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ duration: 1.4, repeat: Infinity }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            {ambientId && (
              <div className="flex items-center gap-3">
                <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <Slider value={[volume]} onValueChange={(v) => setVolume(v[0])} max={100} step={1} />
                <span className="text-xs tabular-nums w-9 text-right text-muted-foreground">{volume}</span>
              </div>
            )}
          </div>
        )}

        {/* Recent sessions */}
        {!focusMode && (
          <div className="cinema-glass rounded-2xl p-5">
            <SectionHeader title="Recent sessions" subtitle="Your last few focus blocks" />
            <div className="space-y-1.5 max-h-72 overflow-y-auto scrollbar-thin pr-1">
              {sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No sessions yet. Start your first pomodoro!</p>
              ) : (
                sessions.slice(0, 10).map((s) => {
                  const subj = CURRICULUM.find((c) => c.id === s.subject);
                  const cfg = MODE_CONFIG[s.type];
                  return (
                    <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 px-3 py-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: cfg.accent }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium capitalize">{cfg.label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(s.completedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          {subj ? ` · ${subj.icon} ${subj.name}` : ""}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-[11px] tabular-nums">{Math.round(s.duration / 60)}m</Badge>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Exit button for focus mode */}
        {focusMode && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
            <Button variant="outline" onClick={() => setFocusMode(false)} className="premium-card bg-card/70">
              <Minimize2 className="h-4 w-4 mr-2" /> Exit Focus Mode
            </Button>
          </div>
        )}
      </div>
    </div>
      </div>
      </div>
  );
}

export default FocusView;
