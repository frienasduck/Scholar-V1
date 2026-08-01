"use client";

import { useStore, getLevelInfo } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge as UiBadge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  User,
  Palette,
  Shield,
  Database,
  Code2,
  LogOut,
  Save,
  Upload,
  Download,
  Trash2,
  Zap,
  Coins,
  Flame,
  Star,
  Trophy,
  AlertTriangle,
  RefreshCw,
  Gamepad2,
  Eye,
  MessageCircle,
  Globe,
  Instagram,
  Twitter,
  ArrowRight,
  Lock,
  GraduationCap,
  BookOpen,
  Check,
  Bot,
  Mic,
  Volume2,
  Brain,
  Sparkles,
  History,
  Gauge,
  Bell,
  SlidersHorizontal,
  ListChecks,
} from "lucide-react";
import { toast } from "@/lib/notifications/notification-api";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { clearLamProfile, loadLamState, updateLamPreferences } from "@/lib/lam/storage";
import type { LamPreferences } from "@/lib/lam/types";
import { microphoneErrorMessage, requestMicrophoneStream, stopMediaStream } from "@/lib/lam/microphone";
import {
  STARTUP_MODE_DEFINITIONS,
  type StartupLoadingMode,
} from "@/lib/startup/startup-modes";

const SCHOLAR_UPDATE_LOG = [
  {
    version: "v5.1.0",
    date: "1 Aug 2026",
    title: "Original appearance restoration and usability pass",
    items: [
      "Restored Scholar's original typography and page-specific video backgrounds.",
      "Added developer-gated beta font controls.",
      "Added notification size, position and timeout controls with live preview.",
      "Added expandable Chapter Command AI and optional AI doubt resolution.",
      "Improved the Study Workspace widget picker and repaired inactive controls.",
    ],
  },
  {
    version: "v5.0.0",
    date: "31 Jul 2026",
    title: "Scholar-wide notifications and background work",
    items: [
      "Introduced Scholar liquid-glass notifications.",
      "Added completion indicators for background AI tasks.",
      "Improved file previews, slideshow generation and startup readiness.",
    ],
  },
] as const;

const AVATAR_EMOJIS = [
  "🦋", "🐱", "🐶", "🦁", "🦊", "🐰", "🐻", "🐼",
  "🐨", "🐯", "🦄", "🐸", "🐵", "🦉", "🐧", "🦜",
  "🐙", "🦕", "🌸", "🌟", "🚀", "⚡", "🎨", "📚",
  "🎯", "🏆", "💎", "🔥", "🌈", "🍀", "🦖", "🐳",
  "🦢", "🦌", "🦔",
];

const SUBJECTS = [
  { id: "maths", name: "Mathematics", icon: "📐" },
  { id: "science", name: "Science", icon: "🔬" },
  { id: "english", name: "English", icon: "📚" },
  { id: "sst", name: "Social Science", icon: "🌍" },
  { id: "hindi", name: "Hindi", icon: "🪶" },
];

const RESET_PARTS: { key: "notes" | "flashcards" | "tasks" | "quiz" | "activity" | "sessions" | "files" | "chat"; label: string; icon: string }[] = [
  { key: "notes", label: "Notes", icon: "📝" },
  { key: "flashcards", label: "Flashcards", icon: "⚡" },
  { key: "tasks", label: "Tasks", icon: "✅" },
  { key: "quiz", label: "Quizzes", icon: "🎯" },
  { key: "sessions", label: "Focus", icon: "🍅" },
  { key: "files", label: "Files", icon: "📁" },
  { key: "chat", label: "AI Chats", icon: "🤖" },
  { key: "activity", label: "Activity", icon: "📊" },
];

function xpThresholdForLevel(target: number): number {
  let total = 0;
  for (let lvl = 1; lvl < target; lvl++) total += 100 + (lvl - 1) * 50;
  return total;
}

// ===== Cinematic video background with custom fade system =====
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
      const eased = progress * (2 - progress); // easeOutQuad
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

export function SettingsView() {
  const user = useStore((s) => s.user);
  const settings = useStore((s) => s.settings);
  const updateUser = useStore((s) => s.updateUser);
  const updateSettings = useStore((s) => s.updateSettings);
  const setAuthed = useStore((s) => s.setAuthed);
  const devMode = useStore((s) => s.devMode);
  const setDevMode = useStore((s) => s.setDevMode);
  const coins = useStore((s) => s.coins);
  const xp = useStore((s) => s.xp);
  const streak = useStore((s) => s.streak);
  const mastery = useStore((s) => s.mastery);
  const setMastery = useStore((s) => s.setMastery);
  const addCoins = useStore((s) => s.addCoins);
  const addXP = useStore((s) => s.addXP);
  const setStreak = useStore((s) => s.setStreak);
  const completeDailyChallenge = useStore((s) => s.completeDailyChallenge);
  const resetEverything = useStore((s) => s.resetEverything);
  const resetPart = useStore((s) => s.resetPart);
  const pushActivity = useStore((s) => s.pushActivity);
  const lamProfileId = `class-${user.scholarClass}`;
  const [lamPreferences, setLamPreferences] = useState<LamPreferences>(() => loadLamState(lamProfileId).preferences);
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    setLamPreferences(loadLamState(lamProfileId).preferences);
    const sync = (event: Event) => {
      const profile = (event as CustomEvent<{ profileId?: string }>).detail?.profileId;
      if (!profile || profile === lamProfileId) setLamPreferences(loadLamState(lamProfileId).preferences);
    };
    window.addEventListener("scholar:lam-state", sync);
    return () => window.removeEventListener("scholar:lam-state", sync);
  }, [lamProfileId]);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const refresh = () => setSpeechVoices(window.speechSynthesis.getVoices());
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, []);

  const updateLam = (patch: Partial<LamPreferences>) => {
    updateLamPreferences(lamProfileId, patch);
    setLamPreferences((previous) => ({ ...previous, ...patch }));
  };

  const setHandsFreeLam = async (enabled: boolean) => {
    if (!enabled) {
      updateLam({ wakeWordEnabled: false });
      toast.info("Hands-Free LAM disabled");
      return;
    }
    try {
      // Keep the permission request in this switch's direct user-gesture call chain.
      const stream = await requestMicrophoneStream();
      stopMediaStream(stream);
      updateLam({ wakeWordEnabled: true, voiceInputEnabled: true });
      window.dispatchEvent(new Event("scholar:lam-resume-hands-free"));
      toast.success("Hands-Free LAM enabled", { description: "Say “Hey LAM” or “Okay LAM” while Scholar is open and active." });
    } catch (requestError) {
      updateLam({ wakeWordEnabled: false });
      toast.error(microphoneErrorMessage(requestError));
    }
  };

  const [form, setForm] = useState(user);
  useEffect(() => {
    setForm(user);
  }, [user]);

  // Dev mode password gate
  const DEV_PASSWORD = "inmfs123";
  const [showDevPassword, setShowDevPassword] = useState(false);
  const [devPasswordInput, setDevPasswordInput] = useState("");

  function confirmDevPassword() {
    if (devPasswordInput === DEV_PASSWORD) {
      setDevMode(true);
      setShowDevPassword(false);
      setDevPasswordInput("");
      toast.success("Dev mode enabled");
    } else {
      toast.error("Wrong password", { description: "Dev mode access denied." });
    }
  }

  const lvl = getLevelInfo(xp).level;
  const [coinInput, setCoinInput] = useState(String(coins));
  const [xpInput, setXpInput] = useState(String(xp));
  const [lvlInput, setLvlInput] = useState(String(lvl));
  const [streakInput, setStreakInput] = useState(String(streak));

  useEffect(() => setCoinInput(String(coins)), [coins]);
  useEffect(() => setXpInput(String(xp)), [xp]);
  useEffect(() => setLvlInput(String(getLevelInfo(xp).level)), [xp]);
  useEffect(() => setStreakInput(String(streak)), [streak]);

  const importRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function saveProfile() {
    updateUser(form);
    pushActivity({ type: "settings", text: "Updated profile", icon: "👤" });
    toast.success("Profile saved");
  }

  function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image too large", { description: "Please pick an image under 5 MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setForm((f) => ({ ...f, avatar: dataUrl }));
      updateUser({ avatar: dataUrl });
      toast.success("Profile photo updated!", { description: "Your new photo is now live." });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function exportData() {
    const state = useStore.getState();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `neha-scholar-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup downloaded");
  }

  function importData(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        useStore.setState(parsed);
        toast.success("Data restored");
      } catch {
        toast.error("Invalid backup file");
      }
    };
    reader.readAsText(file);
  }

  function applyCoins(target: number) {
    const t = Math.max(0, Math.min(99999, target));
    const delta = t - coins;
    if (delta !== 0) addCoins(delta);
    toast.success(`Coins set to ${t.toLocaleString()}`);
  }

  function applyXP(target: number) {
    const t = Math.max(0, Math.min(99999, target));
    const delta = t - xp;
    if (delta !== 0) addXP(delta);
    toast.success(`XP set to ${t.toLocaleString()}`);
  }

  function applyLevel(target: number) {
    const t = Math.max(1, Math.min(99, target));
    applyXP(xpThresholdForLevel(t));
    toast.success(`Level set to ${t}`);
  }

  function applyStreak(target: number) {
    const t = Math.max(0, Math.min(999, target));
    setStreak(t);
    toast.success(`Streak set to ${t}`);
  }

  function doCompleteDailyChallenge() {
    completeDailyChallenge();
    toast.success("Daily challenge completed (+30 XP, +15 coins)");
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">
      {/* Liquid glass + cinematic CSS */}
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
        .asme-serif { font-family: 'Instrument Serif', serif; }
        .asme-glass-input {
          background: transparent !important;
          border: none !important;
          color: white !important;
        }
        .asme-glass-input::placeholder { color: rgba(255,255,255,0.4) !important; }
        .asme-glass-input:focus { box-shadow: none !important; }
        .asme-tab {
          background: transparent;
          color: rgba(255,255,255,0.6);
          transition: all 0.2s;
        }
        .asme-tab:hover { color: white; }
        .asme-tab[data-state="active"] {
          background: rgba(255,255,255,0.01);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          color: white;
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.1);
        }
      `}</style>

      {/* Video background */}
      <CinematicVideoBg />
      {/* Dark overlay */}
      <div className="absolute inset-0 z-0 bg-black/50" />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-[calc(100vh-4rem)]">
        {/* Navigation bar */}
        <nav className="relative z-20 pl-6 pr-6 py-6">
          <div className="asme-glass rounded-full px-6 py-3 flex items-center justify-between max-w-5xl mx-auto">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <Globe className="h-6 w-6 text-white" size={24} />
                <span className="text-white font-semibold text-lg">Asme</span>
              </div>
              <div className="hidden md:flex items-center gap-6">
                {["Account", "Appearance", "Data"].map((link) => (
                  <span key={link} className="text-white/80 hover:text-white transition-colors text-sm font-medium cursor-pointer">
                    {link}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-white text-sm font-medium cursor-pointer hidden sm:inline">{user.name}</span>
              <button
                onClick={() => { setAuthed(false); toast.success("Signed out"); }}
                className="asme-glass rounded-full px-6 py-2 text-white text-sm font-medium hover:bg-white/5 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </nav>

        {/* Hero heading */}
        <div className="relative z-10 flex flex-col items-center justify-center px-6 pt-4 pb-8 text-center">
          <h1
            className="asme-serif text-5xl md:text-6xl lg:text-7xl text-white mb-3 tracking-tight whitespace-nowrap"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Built for the curious
          </h1>
          <p className="text-white/60 text-sm max-w-xl">
            Manage your account, appearance, privacy and developer controls.
          </p>
        </div>

        {/* Tabs — liquid glass */}
        <div className="relative z-10 flex-1 px-4 pb-8 max-w-5xl mx-auto w-full">
          <Tabs defaultValue="account" className="w-full">
            <TabsList className="asme-glass flex flex-wrap h-auto w-full sm:w-fit rounded-full p-1.5 gap-1 mb-4">
              <TabsTrigger value="account" className="asme-tab rounded-full gap-1.5 text-xs px-4 py-2">
                <User className="h-3.5 w-3.5" />Account
              </TabsTrigger>
              <TabsTrigger value="academic" className="asme-tab rounded-full gap-1.5 text-xs px-4 py-2">
                <GraduationCap className="h-3.5 w-3.5" />Academic
              </TabsTrigger>
              <TabsTrigger value="appearance" className="asme-tab rounded-full gap-1.5 text-xs px-4 py-2">
                <Palette className="h-3.5 w-3.5" />Appearance
              </TabsTrigger>
              <TabsTrigger value="lam" className="asme-tab rounded-full gap-1.5 text-xs px-4 py-2">
                <Bot className="h-3.5 w-3.5" />LAM
              </TabsTrigger>
              <TabsTrigger value="privacy" className="asme-tab rounded-full gap-1.5 text-xs px-4 py-2">
                <Shield className="h-3.5 w-3.5" />Privacy
              </TabsTrigger>
              <TabsTrigger value="notifications" className="asme-tab rounded-full gap-1.5 text-xs px-4 py-2">
                <Bell className="h-3.5 w-3.5" />Notifications
              </TabsTrigger>
              <TabsTrigger value="updates" className="asme-tab rounded-full gap-1.5 text-xs px-4 py-2">
                <ListChecks className="h-3.5 w-3.5" />Update Logs
              </TabsTrigger>
              <TabsTrigger value="data" className="asme-tab rounded-full gap-1.5 text-xs px-4 py-2">
                <Database className="h-3.5 w-3.5" />Data
              </TabsTrigger>
              <TabsTrigger value="developer" className="asme-tab rounded-full gap-1.5 text-xs px-4 py-2">
                <Code2 className="h-3.5 w-3.5" />Developer
              </TabsTrigger>
            </TabsList>

            {/* ===== Account ===== */}
            <TabsContent value="account" className="mt-2">
              <div className="asme-glass rounded-3xl p-6 space-y-6">
                <div className="flex flex-col sm:flex-row gap-6 items-start">
                  <div className="flex flex-col items-center gap-3 w-full sm:w-auto">
                    <div className="grid place-items-center h-20 w-20 rounded-2xl bg-white/5 text-4xl shadow-lg overflow-hidden ring-1 ring-white/10">
                      {form.avatar.startsWith("data:") ? (
                        <img src={form.avatar} alt="Profile" className="h-full w-full object-cover" />
                      ) : (
                        <span>{form.avatar}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="asme-glass rounded-full px-4 py-1.5 text-xs text-white hover:bg-white/5 transition-colors flex items-center gap-1.5"
                      >
                        <Upload className="h-3 w-3" /> Upload photo
                      </button>
                      {form.avatar.startsWith("data:") && (
                        <button
                          type="button"
                          onClick={() => { setForm({ ...form, avatar: "🦋" }); updateUser({ avatar: "🦋" }); }}
                          className="text-xs text-white/60 hover:text-white px-2 py-1.5"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                    <p className="text-[10px] text-white/40">or pick an emoji</p>
                    <div className="grid grid-cols-8 gap-1 max-w-[280px]">
                      {AVATAR_EMOJIS.map((em) => (
                        <button
                          key={em}
                          onClick={() => { setForm({ ...form, avatar: em }); updateUser({ avatar: em }); }}
                          className={cn(
                            "grid place-items-center h-8 w-8 rounded-lg text-lg transition-all hover:bg-white/10",
                            form.avatar === em ? "bg-white/15 ring-1 ring-white/30" : ""
                          )}
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <GlassField label="Display Name">
                      <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="asme-glass-input" />
                    </GlassField>
                    <GlassField label="Username">
                      <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="asme-glass-input" />
                    </GlassField>
                    <GlassField label="Email">
                      <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="asme-glass-input" />
                    </GlassField>
                    <GlassField label="School">
                      <Input value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} className="asme-glass-input" />
                    </GlassField>
                    <GlassField label="Class">
                      <Input value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })} className="asme-glass-input" />
                    </GlassField>
                    <div className="sm:col-span-2">
                      <GlassField label="Bio">
                        <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={2} className="asme-glass-input" />
                      </GlassField>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-white/10">
                  <button onClick={saveProfile} className="asme-glass rounded-full px-5 py-2 text-white text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-1.5">
                    <Save className="h-3.5 w-3.5" /> Save changes
                  </button>
                  <button onClick={() => setForm(user)} className="text-white/60 hover:text-white text-sm px-3 py-2">Reset</button>
                </div>
              </div>
            </TabsContent>

            {/* ===== Academic Profile ===== */}
            <TabsContent value="academic" className="mt-2 space-y-4">
              <div className="asme-glass rounded-3xl p-6">
                <div className="mb-4">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-white/70" /> Academic Profile
                  </h3>
                  <p className="text-sm text-white/50 mt-1">Choose your class. This switches all educational content, subjects, chapters, quizzes, AI tutors, and resources. Each class has completely separate progress.</p>
                </div>

                {/* Class selection cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  {/* Class 9 */}
                  <button
                    onClick={() => {
                      if (user.scholarClass !== 9) {
                        window.dispatchEvent(new CustomEvent("scholar:class-switch", { detail: { newClass: 9 } }));
                        toast.success("Switching to Class 9…", { description: "Loading Neha's Scholar profile" });
                      }
                    }}
                    className={`rounded-2xl p-5 text-left border-2 transition-all hover:scale-[1.02] ${
                      user.scholarClass === 9
                        ? "border-indigo-400 bg-indigo-500/15"
                        : "border-white/15 bg-white/5 hover:border-white/30"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-3xl">📘</span>
                      <div>
                        <p className="font-bold text-white text-base">Class 9</p>
                        <p className="text-xs text-white/50">Neha's Scholar</p>
                      </div>
                      {user.scholarClass === 9 && <Check className="h-5 w-5 text-indigo-400 ml-auto" />}
                    </div>
                    <p className="text-xs text-white/60 leading-relaxed">Maths, Science, Social Science, English, Hindi — full CBSE Class 9 syllabus with 5 AI tutors.</p>
                  </button>

                  {/* Class 11 */}
                  <button
                    onClick={() => {
                      if (user.scholarClass !== 11) {
                        window.dispatchEvent(new CustomEvent("scholar:class-switch", { detail: { newClass: 11 } }));
                        toast.success("Switching to Class 11…", { description: "Loading Ishan's Scholar profile" });
                      }
                    }}
                    className={`rounded-2xl p-5 text-left border-2 transition-all hover:scale-[1.02] ${
                      user.scholarClass === 11
                        ? "border-blue-400 bg-blue-500/15"
                        : "border-white/15 bg-white/5 hover:border-white/30"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-3xl">⚛️</span>
                      <div>
                        <p className="font-bold text-white text-base">Class 11</p>
                        <p className="text-xs text-white/50">Ishan's Scholar</p>
                      </div>
                      {user.scholarClass === 11 && <Check className="h-5 w-5 text-blue-400 ml-auto" />}
                    </div>
                    <p className="text-xs text-white/60 leading-relaxed">Physics, Chemistry, Maths, Computer Science, English — PCM + CS with practicals, derivations, Python workspace.</p>
                  </button>
                </div>
              </div>

              {/* JEE Mode toggle — only for Class 11 */}
              {user.scholarClass === 11 && (
                <div className="asme-glass rounded-3xl p-6">
                  <div className="flex items-start gap-3">
                    <Zap className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white">JEE Focused Mode</p>
                      <p className="text-sm text-white/50 mt-0.5">Transforms all content to JEE-level: advanced questions, JEE PYQs, competitive strategies, higher difficulty. Affects quizzes, mock exams, AI recommendations, Nightube, and analytics.</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-medium ${user.jeeMode ? "text-orange-400" : "text-white/40"}`}>{user.jeeMode ? "ON" : "OFF"}</span>
                      <Switch
                        checked={user.jeeMode}
                        onCheckedChange={(v) => {
                          if (v !== user.jeeMode) {
                            window.dispatchEvent(new CustomEvent("scholar:class-switch", { detail: { jeeToggle: true } }));
                            toast.success(v ? "Enabling JEE Mode…" : "Disabling JEE Mode…");
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Current profile info */}
              <div className="asme-glass rounded-3xl p-6">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-white/70" /> Current Profile
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-white/40 text-xs">Active Class</p>
                    <p className="text-white font-medium">Class {user.scholarClass} CBSE</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs">Profile Name</p>
                    <p className="text-white font-medium">{user.scholarClass === 11 ? "Ishan's Scholar" : "Neha's Scholar"}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs">JEE Mode</p>
                    <p className={`font-medium ${user.jeeMode ? "text-orange-400" : "text-white/60"}`}>{user.jeeMode ? "Enabled" : "Disabled"}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs">Subjects</p>
                    <p className="text-white font-medium">{user.scholarClass === 11 ? "Physics, Chemistry, Maths, CS, English" : "Maths, Science, SST, English, Hindi"}</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ===== Appearance ===== */}
            <TabsContent value="appearance" className="mt-2 space-y-4">
              <div className="asme-glass rounded-3xl p-6" data-testid="developer-appearance-gate">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <Palette className="h-4 w-4 text-violet-300" />
                      <h3 className="font-semibold text-white">Appearance Lab</h3>
                      <UiBadge className="border-violet-300/30 bg-violet-400/10 text-violet-200">Beta · Developer only</UiBadge>
                    </div>
                    <p className="max-w-2xl text-sm leading-6 text-white/55">
                      Experimental surfaces, wallpapers and reading themes are temporarily disabled. Scholar now uses its original backgrounds, colours and typography by default.
                    </p>
                  </div>
                  {!devMode ? (
                    <Button type="button" variant="outline" className="border-white/15 bg-white/5 text-white" onClick={() => setShowDevPassword(true)}>
                      <Lock className="mr-2 h-4 w-4" />Developer unlock
                    </Button>
                  ) : <UiBadge className="bg-emerald-500/15 text-emerald-200">Unlocked for this developer</UiBadge>}
                </div>
                {devMode ? (
                  <div className="mt-5 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/45">Font size</label>
                      <Select value={settings.fontScale} onValueChange={(value) => {
                        const fontScale = value as "90" | "100" | "110" | "120";
                        updateSettings({ fontScale });
                        document.documentElement.dataset.fontScale = fontScale;
                      }}>
                        <SelectTrigger className="asme-glass-input"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="90">Small</SelectItem><SelectItem value="100">Original</SelectItem><SelectItem value="110">Large</SelectItem><SelectItem value="120">Extra large</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <GlassSettingRow icon={<BookOpen className="h-4 w-4 text-white/70" />} title="Readable font" desc="Developer preview of the accessible sans-serif font.">
                      <Switch checked={settings.readableFont} onCheckedChange={(readableFont) => {
                        updateSettings({ readableFont });
                        document.documentElement.dataset.readableFont = String(readableFont);
                      }} />
                    </GlassSettingRow>
                    <Button type="button" variant="outline" className="sm:col-span-2 border-white/15 bg-white/5 text-white" onClick={() => {
                      updateSettings({ fontScale: "100", readableFont: false });
                      document.documentElement.dataset.fontScale = "100";
                      document.documentElement.dataset.readableFont = "false";
                      toast.success("Original Scholar typography restored");
                    }}>Restore original font</Button>
                  </div>
                ) : null}
              </div>

              <div className="asme-glass rounded-3xl p-6" data-testid="startup-loading-settings">
                <div className="mb-4">
                  <h3 className="flex items-center gap-2 font-semibold text-white">
                    <Gauge className="h-4 w-4 text-cyan-300" />
                    Startup Loading
                  </h3>
                  <p className="mt-1 text-sm text-white/50">
                    Choose how thoroughly Scholar prepares routes, media and study tools before opening.
                  </p>
                </div>
                <div
                  className="grid gap-3 sm:grid-cols-2"
                  role="radiogroup"
                  aria-label="Startup loading mode"
                >
                  {(Object.keys(STARTUP_MODE_DEFINITIONS) as StartupLoadingMode[]).map((mode) => {
                    const option = STARTUP_MODE_DEFINITIONS[mode];
                    const selected = (settings.startupLoadingMode ?? "long") === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          updateSettings({ startupLoadingMode: mode });
                          toast.success(`${option.label} startup selected`, {
                            description: "The change applies the next time Scholar opens.",
                          });
                        }}
                        className={cn(
                          "rounded-2xl border p-4 text-left transition-colors",
                          selected
                            ? "border-cyan-300/45 bg-cyan-300/[0.09] shadow-[inset_0_1px_rgba(255,255,255,.08),0_0_24px_rgba(34,211,238,.08)]"
                            : "border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.06]",
                        )}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-white">{option.label}</span>
                          {option.badge ? (
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                                option.badge === "Recommended"
                                  ? "border-violet-300/30 bg-violet-400/10 text-violet-200"
                                  : option.badge === "Default"
                                    ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-200"
                                    : "border-white/15 bg-white/5 text-white/55",
                              )}
                            >
                              {option.badge}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-2 block text-xs leading-5 text-white/50">
                          {option.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-4 text-xs leading-5 text-white/40">
                  Loading time varies depending on your device, connection and cached content. Full Loading
                  adapts automatically on mobile and data-saving connections.
                </p>
              </div>

              <div className="asme-glass rounded-3xl p-6">
                <h3 className="font-semibold text-white mb-2">General interface behaviour</h3>
                <div className="divide-y divide-white/10">
                <GlassSettingRow icon={<BookOpen className="h-4 w-4 text-white/70" />} title="Sidebar on startup" desc="Remember its last state, or always open or close it.">
                  <Select value={settings.sidebarBehavior ?? "remember"} onValueChange={(v) => updateSettings({ sidebarBehavior: v as "remember" | "open" | "closed" })}>
                    <SelectTrigger aria-label="Sidebar on startup" className="w-32 asme-glass-input"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="remember">Remember</SelectItem>
                      <SelectItem value="open">Always open</SelectItem>
                      <SelectItem value="closed">Always closed</SelectItem>
                    </SelectContent>
                  </Select>
                </GlassSettingRow>
                <GlassSettingRow icon={<Star className="h-4 w-4 text-white/70" />} title="Sound Effects" desc="Play subtle sounds for actions and rewards.">
                  <Switch checked={settings.sound} onCheckedChange={(v) => updateSettings({ sound: v })} />
                </GlassSettingRow>
                <GlassSettingRow icon={<Trophy className="h-4 w-4 text-white/70" />} title="Auto-Archive Completed" desc="Automatically archive finished tasks & quizzes.">
                  <Switch checked={settings.autoArchive} onCheckedChange={(v) => updateSettings({ autoArchive: v })} />
                </GlassSettingRow>
                </div>
              </div>

              <div className="asme-glass rounded-3xl p-6">
                <div className="mb-2">
                  <h3 className="flex items-center gap-2 font-semibold text-white"><Volume2 className="h-4 w-4 text-indigo-300" /> Cinematic transition sound</h3>
                  <p className="mt-1 text-sm text-white/50">Used only for the successful-login introduction and Class 9 ↔ Class 11 academic switch.</p>
                </div>
                <div className="divide-y divide-white/10">
                  <GlassSettingRow icon={<Volume2 className="h-4 w-4 text-white/70" />} title="Transition music" desc="Allow the 16-second cinematic music segment during approved transitions.">
                    <Switch aria-label="Transition music" checked={settings.transitionMusic !== false} onCheckedChange={(value) => updateSettings({ transitionMusic: value })} />
                  </GlassSettingRow>
                  <GlassSettingRow icon={<Volume2 className="h-4 w-4 text-white/70" />} title="Transition volume" desc="Set the music level used for both transition types.">
                    <div className="flex w-48 items-center gap-3">
                      <Slider aria-label="Transition volume" disabled={settings.transitionMusic === false} min={0} max={100} step={5} value={[settings.transitionVolume ?? 65]} onValueChange={([value]) => updateSettings({ transitionVolume: value })} />
                      <span className="w-10 text-right text-xs tabular-nums text-white/60">{settings.transitionVolume ?? 65}%</span>
                    </div>
                  </GlassSettingRow>
                  <GlassSettingRow icon={<Sparkles className="h-4 w-4 text-white/70" />} title="Login-intro music" desc="Play once per session after a successful login, during the Scholar intro.">
                    <Switch aria-label="Login intro music" disabled={settings.transitionMusic === false} checked={settings.loginIntroMusic !== false} onCheckedChange={(value) => updateSettings({ loginIntroMusic: value })} />
                  </GlassSettingRow>
                  <GlassSettingRow icon={<GraduationCap className="h-4 w-4 text-white/70" />} title="Academic-switch music" desc="Play when switching Class 9 and Class 11 from Academic settings.">
                    <Switch aria-label="Academic switch music" disabled={settings.transitionMusic === false} checked={settings.academicSwitchMusic !== false} onCheckedChange={(value) => updateSettings({ academicSwitchMusic: value })} />
                  </GlassSettingRow>
                </div>
              </div>
            </TabsContent>

            {/* ===== Notifications ===== */}
            <TabsContent value="notifications" className="mt-2 space-y-4">
              <div className="asme-glass rounded-3xl p-6">
                <div className="mb-5">
                  <h3 className="flex items-center gap-2 font-semibold text-white"><SlidersHorizontal className="h-4 w-4 text-cyan-300" />Notification customizer</h3>
                  <p className="mt-1 text-sm text-white/50">Adjust Scholar's liquid-glass notification size, desktop position and display time. Mobile notifications always stay at the top.</p>
                </div>
                <div className="space-y-6">
                  <div><div className="mb-2 flex justify-between text-sm text-white/75"><span>Size</span><span>{settings.notificationSize ?? 100}%</span></div><Slider aria-label="Notification size" min={75} max={125} step={5} value={[settings.notificationSize ?? 100]} onValueChange={([notificationSize]) => updateSettings({ notificationSize })} /></div>
                  <div><label className="mb-2 block text-sm text-white/75">Desktop position</label><Select value={settings.notificationPosition ?? "top-left"} onValueChange={(notificationPosition) => updateSettings({ notificationPosition: notificationPosition as typeof settings.notificationPosition })}><SelectTrigger className="asme-glass-input"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="top-left">Top left</SelectItem><SelectItem value="top-right">Top right</SelectItem><SelectItem value="top-center">Top center</SelectItem><SelectItem value="bottom-left">Bottom left</SelectItem><SelectItem value="bottom-right">Bottom right</SelectItem><SelectItem value="bottom-center">Bottom center</SelectItem></SelectContent></Select></div>
                  <div><div className="mb-2 flex justify-between text-sm text-white/75"><span>Timeout</span><span>{((settings.notificationTimeout ?? 2000) / 1000).toFixed(1)} seconds</span></div><Slider aria-label="Notification timeout" min={1500} max={10000} step={500} value={[settings.notificationTimeout ?? 2000]} onValueChange={([notificationTimeout]) => updateSettings({ notificationTimeout })} /></div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-xs text-white/50">Preview uses the current values immediately.</p><Button type="button" className="mt-3 bg-cyan-500 text-slate-950 hover:bg-cyan-400" onClick={() => toast.success("Notification preview", { description: "This is how completion messages will appear across Scholar." })}><Bell className="mr-2 h-4 w-4" />Show preview</Button></div>
                </div>
              </div>
            </TabsContent>

            {/* ===== Update Logs ===== */}
            <TabsContent value="updates" className="mt-2 space-y-4">
              <div className="asme-glass rounded-3xl p-6">
                <div className="mb-5"><h3 className="flex items-center gap-2 font-semibold text-white"><History className="h-4 w-4 text-violet-300" />Scholar update logs</h3><p className="mt-1 text-sm text-white/50">Every Scholar release, including minor fixes, is recorded here from this update onward.</p></div>
                <div className="space-y-4">{SCHOLAR_UPDATE_LOG.map((release) => <article key={release.version} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold text-white">{release.title}</p><p className="text-xs text-white/40">{release.date}</p></div><UiBadge variant="outline" className="border-violet-300/25 text-violet-200">{release.version}</UiBadge></div><ul className="mt-3 space-y-1.5 text-sm text-white/65">{release.items.map((item) => <li key={item} className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />{item}</li>)}</ul></article>)}</div>
              </div>
            </TabsContent>

            {/* ===== LAM ===== */}
            <TabsContent value="lam" className="mt-2 space-y-4">
              <div className="asme-glass rounded-3xl p-6">
                <div className="mb-2"><h3 className="flex items-center gap-2 font-semibold text-white"><BookOpen className="h-4 w-4 text-violet-300" />E-Book ELAM</h3><p className="mt-1 text-sm text-white/50">Control the page-specific assistant shown only inside the immersive e-book reader.</p></div>
                <div className="divide-y divide-white/10">
                  <GlassSettingRow icon={<Bot className="h-4 w-4 text-white/70" />} title="Enable ELAM" desc="Show the glowing ELAM page assistant in e-books.">
                    <Switch aria-label="Enable ELAM" checked={settings.elamEnabled !== false} onCheckedChange={(value) => { updateSettings({ elamEnabled: value }); toast.success(value ? "ELAM enabled" : "ELAM disabled"); }} />
                  </GlassSettingRow>
                  <GlassSettingRow icon={<Sparkles className="h-4 w-4 text-white/70" />} title="Compact ELAM" desc="Use a smaller orb and a more compact page-chat panel.">
                    <Switch aria-label="Compact ELAM" disabled={settings.elamEnabled === false} checked={settings.elamCompact === true} onCheckedChange={(value) => updateSettings({ elamCompact: value })} />
                  </GlassSettingRow>
                </div>
              </div>

              <div className="asme-glass rounded-3xl p-6">
                <GlassSettingRow icon={<Bot className="h-4 w-4 text-cyan-300" />} title="Show LAM" desc="Show the floating LAM capsule. Hands-Free wake listening can remain available while the capsule is hidden.">
                  <Switch aria-label="Enable LAM" checked={lamPreferences.assistantEnabled} onCheckedChange={(value) => {
                    updateLam({ assistantEnabled: value });
                    toast.success(value ? "LAM shown" : "LAM hidden", { description: value ? "The assistant capsule is available again." : lamPreferences.wakeWordEnabled ? "Say “Hey LAM” to reveal it while Scholar is active." : "The assistant capsule is now hidden." });
                  }} />
                </GlassSettingRow>
              </div>

              <div className="asme-glass rounded-3xl p-6">
                <div className="mb-3"><h3 className="font-semibold text-white flex items-center gap-2"><Mic className="h-4 w-4 text-cyan-300" />Voice activation</h3><p className="mt-1 text-sm text-white/50">Voice settings are isolated to {user.name}’s Class {user.scholarClass} profile. Browser permission is requested only when you enable wake activation or press the microphone.</p></div>
                <div className="divide-y divide-white/10">
                  <GlassSettingRow icon={<Mic className="h-4 w-4 text-white/70" />} title="Hands-Free “Hey LAM”" desc="Manually enable foreground wake-phrase listening for Hey LAM and Okay LAM."><Switch aria-label="Hands-Free Hey LAM" disabled={!lamPreferences.voiceInputEnabled} checked={lamPreferences.wakeWordEnabled} onCheckedChange={(value) => void setHandsFreeLam(value)} /></GlassSettingRow>
                  <GlassSettingRow icon={<Mic className="h-4 w-4 text-white/70" />} title="Input device" desc="Speech recognition uses the browser’s selected default microphone."><span className="text-xs text-white/55">Browser default</span></GlassSettingRow>
                  <GlassSettingRow icon={<MessageCircle className="h-4 w-4 text-white/70" />} title="Recognition language" desc="Language and regional accent used for live speech recognition."><Select value={lamPreferences.voiceLanguage} onValueChange={(value) => updateLam({ voiceLanguage: value as LamPreferences["voiceLanguage"] })}><SelectTrigger aria-label="LAM recognition language" className="w-40 asme-glass-input"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en-IN">English (India)</SelectItem><SelectItem value="en-US">English (US)</SelectItem><SelectItem value="en-GB">English (UK)</SelectItem></SelectContent></Select></GlassSettingRow>
                  <div className="rounded-2xl bg-cyan-400/8 p-4 text-xs leading-5 text-cyan-50/75">“Hey LAM” works while Scholar is open and active. Mobile browsers may stop listening when Scholar is backgrounded or the screen is locked.</div>
                </div>
              </div>

              <div className="asme-glass rounded-3xl p-6">
                <h3 className="font-semibold text-white flex items-center gap-2 mb-2"><Volume2 className="h-4 w-4 text-violet-300" />Voice response</h3>
                <div className="divide-y divide-white/10">
                  <GlassSettingRow icon={<Volume2 className="h-4 w-4 text-white/70" />} title="Spoken replies" desc="Read completed LAM answers aloud with browser speech synthesis."><Switch checked={lamPreferences.voiceRepliesEnabled} onCheckedChange={(value) => updateLam({ voiceRepliesEnabled: value })} /></GlassSettingRow>
                  <GlassSettingRow icon={<Volume2 className="h-4 w-4 text-white/70" />} title="Speech speed" desc={`${lamPreferences.speechRate.toFixed(1)}×`}><Slider className="w-32" min={0.6} max={1.6} step={0.1} value={[lamPreferences.speechRate]} onValueChange={([value]) => updateLam({ speechRate: value })} /></GlassSettingRow>
                  <GlassSettingRow icon={<Volume2 className="h-4 w-4 text-white/70" />} title="Speech pitch" desc={lamPreferences.speechPitch.toFixed(1)}><Slider className="w-32" min={0.6} max={1.5} step={0.1} value={[lamPreferences.speechPitch]} onValueChange={([value]) => updateLam({ speechPitch: value })} /></GlassSettingRow>
                  <GlassSettingRow icon={<Volume2 className="h-4 w-4 text-white/70" />} title="Volume" desc={`${Math.round(lamPreferences.speechVolume * 100)}%`}><Slider className="w-32" min={0} max={1} step={0.1} value={[lamPreferences.speechVolume]} onValueChange={([value]) => updateLam({ speechVolume: value })} /></GlassSettingRow>
                  <GlassSettingRow icon={<Volume2 className="h-4 w-4 text-white/70" />} title="Preferred voice" desc="Choose a voice installed by your browser or device."><Select value={lamPreferences.selectedVoice || "system"} onValueChange={(value) => updateLam({ selectedVoice: value === "system" ? "" : value })}><SelectTrigger aria-label="LAM preferred voice" className="w-48 asme-glass-input"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="system">System default</SelectItem>{speechVoices.map((voice) => <SelectItem key={voice.voiceURI} value={voice.name}>{voice.name} · {voice.lang}</SelectItem>)}</SelectContent></Select></GlassSettingRow>
                  <button onClick={() => { if (!("speechSynthesis" in window)) return toast.error("Speech synthesis is unavailable"); window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance("Hi, I’m LAM. Your voice settings are working."); utterance.rate = lamPreferences.speechRate; utterance.pitch = lamPreferences.speechPitch; utterance.volume = lamPreferences.speechVolume; window.speechSynthesis.speak(utterance); }} className="mt-4 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-white hover:bg-white/10">Test voice</button>
                </div>
              </div>

              <div className="asme-glass rounded-3xl p-6">
                <h3 className="font-semibold text-white flex items-center gap-2 mb-2"><Brain className="h-4 w-4 text-emerald-300" />Conversation, memory & appearance</h3>
                <div className="divide-y divide-white/10">
                  <GlassSettingRow icon={<MessageCircle className="h-4 w-4 text-white/70" />} title="Follow-up listening" desc="Allow a visible follow-up listening window after a voice reply."><Switch checked={lamPreferences.followUpListeningEnabled} onCheckedChange={(value) => updateLam({ followUpListeningEnabled: value })} /></GlassSettingRow>
                  <GlassSettingRow icon={<Mic className="h-4 w-4 text-white/70" />} title="Voice input" desc="Allow push-to-talk and browser speech recognition inside LAM."><Switch aria-label="LAM voice input" checked={lamPreferences.voiceInputEnabled} onCheckedChange={(value) => updateLam({ voiceInputEnabled: value, ...(value ? {} : { wakeWordEnabled: false }) })} /></GlassSettingRow>
                  <GlassSettingRow icon={<Brain className="h-4 w-4 text-white/70" />} title="Study memory" desc="Allow explicit learning preferences to be saved for this profile."><Switch checked={lamPreferences.studyMemoryEnabled} onCheckedChange={(value) => updateLam({ studyMemoryEnabled: value })} /></GlassSettingRow>
                  <GlassSettingRow icon={<Eye className="h-4 w-4 text-white/70" />} title="Use current-screen context" desc="Attach only structured information from the active Scholar view—not the whole DOM."><Switch aria-label="Use current-screen context" checked={lamPreferences.currentScreenContext} onCheckedChange={(value) => updateLam({ currentScreenContext: value })} /></GlassSettingRow>
                  <GlassSettingRow icon={<GraduationCap className="h-4 w-4 text-white/70" />} title="Use study progress" desc="Let LAM include stored weak-topic signals when they are relevant."><Switch aria-label="Use study progress" checked={lamPreferences.studyHistoryEnabled} onCheckedChange={(value) => updateLam({ studyHistoryEnabled: value })} /></GlassSettingRow>
                  <GlassSettingRow icon={<Trophy className="h-4 w-4 text-white/70" />} title="Use quiz history" desc="Let LAM include the most recent stored quiz result."><Switch aria-label="Use quiz history" checked={lamPreferences.quizHistoryEnabled} onCheckedChange={(value) => updateLam({ quizHistoryEnabled: value })} /></GlassSettingRow>
                  <GlassSettingRow icon={<History className="h-4 w-4 text-white/70" />} title="Save conversations" desc="Keep LAM conversations for this academic profile. Turn off for session-only chat."><Switch aria-label="Save LAM conversations" checked={lamPreferences.saveConversations} onCheckedChange={(value) => updateLam({ saveConversations: value })} /></GlassSettingRow>
                  <GlassSettingRow icon={<Sparkles className="h-4 w-4 text-white/70" />} title="Compact orb" desc="Show only the floating LAM orb without its text label."><Switch aria-label="Compact orb" checked={lamPreferences.compactOrb} onCheckedChange={(value) => updateLam({ compactOrb: value })} /></GlassSettingRow>
                  <GlassSettingRow icon={<Eye className="h-4 w-4 text-white/70" />} title="Reduce transparency" desc="Use a solid high-legibility panel instead of background blur."><Switch checked={lamPreferences.reduceTransparency} onCheckedChange={(value) => updateLam({ reduceTransparency: value })} /></GlassSettingRow>
                  <GlassSettingRow icon={<Sparkles className="h-4 w-4 text-white/70" />} title="Proactive assistance" desc="Control optional suggestions; LAM never interrupts active exams."><Select value={lamPreferences.proactiveMode} onValueChange={(value) => updateLam({ proactiveMode: value as LamPreferences["proactiveMode"] })}><SelectTrigger className="w-36 asme-glass-input"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="off">Off</SelectItem><SelectItem value="important">Important only</SelectItem><SelectItem value="normal">Normal</SelectItem></SelectContent></Select></GlassSettingRow>
                  <GlassSettingRow icon={<Sparkles className="h-4 w-4 text-white/70" />} title="Animation intensity" desc="Choose how strongly the capsule morphs and reflects light."><Select value={lamPreferences.animationIntensity} onValueChange={(value) => updateLam({ animationIntensity: value as LamPreferences["animationIntensity"] })}><SelectTrigger aria-label="LAM animation intensity" className="w-36 asme-glass-input"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="minimal">Minimal</SelectItem><SelectItem value="balanced">Balanced</SelectItem><SelectItem value="expressive">Expressive</SelectItem></SelectContent></Select></GlassSettingRow>
                  <GlassSettingRow icon={<MessageCircle className="h-4 w-4 text-white/70" />} title="Preferred response detail" desc="Control the default depth of academic answers."><Select value={lamPreferences.responseDetail} onValueChange={(value) => updateLam({ responseDetail: value as LamPreferences["responseDetail"] })}><SelectTrigger aria-label="LAM response detail" className="w-44 asme-glass-input"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="quick">Quick</SelectItem><SelectItem value="balanced">Balanced</SelectItem><SelectItem value="detailed">Detailed</SelectItem><SelectItem value="step-by-step">Teach step by step</SelectItem></SelectContent></Select></GlassSettingRow>
                  <GlassSettingRow icon={<Zap className="h-4 w-4 text-white/70" />} title="Keyboard shortcut" desc="Open LAM without leaving the current screen."><Select value={lamPreferences.keyboardShortcut} onValueChange={(value) => updateLam({ keyboardShortcut: value as LamPreferences["keyboardShortcut"] })}><SelectTrigger aria-label="LAM keyboard shortcut" className="w-44 asme-glass-input"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ctrl-space">Ctrl/⌘ + Space</SelectItem><SelectItem value="alt-space">Alt + Space</SelectItem><SelectItem value="ctrl-shift-l">Ctrl/⌘ + Shift + L</SelectItem></SelectContent></Select></GlassSettingRow>
                </div>
              </div>

              <div className="asme-glass rounded-3xl p-6"><h3 className="font-semibold text-white">Privacy controls</h3><p className="mt-1 text-sm text-white/50">Clearing LAM removes conversations, preferences, memory, and action history for this Class {user.scholarClass} profile only. Scholar notes created through LAM remain in Notes.</p><button onClick={() => { if (!window.confirm(`Clear all LAM data for ${user.name}'s Class ${user.scholarClass} profile?`)) return; clearLamProfile(lamProfileId); setLamPreferences(loadLamState(lamProfileId).preferences); toast.success("LAM profile data cleared"); }} className="mt-4 rounded-full border border-rose-300/25 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/20">Clear this profile’s LAM data</button></div>
            </TabsContent>

            {/* ===== Privacy ===== */}
            <TabsContent value="privacy" className="mt-2 space-y-4">
              <div className="asme-glass rounded-3xl p-6">
                <div className="mb-2"><h3 className="font-semibold text-white flex items-center gap-2"><Globe className="h-4 w-4 text-indigo-300" />Profile & discovery</h3><p className="mt-1 text-sm text-white/50">Choose what other Scholar users may see and how they can find you.</p></div>
                <div className="divide-y divide-white/10">
                <GlassSettingRow icon={<Trophy className="h-4 w-4 text-white/70" />} title="Show me on leaderboards" desc="Let classmates see your XP rank.">
                  <Switch aria-label="Show me on leaderboards" checked={settings.leaderboard ?? true} onCheckedChange={(v) => { updateSettings({ leaderboard: v }); toast.success("Privacy updated"); }} />
                </GlassSettingRow>
                <GlassSettingRow icon={<User className="h-4 w-4 text-white/70" />} title="Show online status" desc="Let friends see when you are active in Scholar.">
                  <Switch aria-label="Show online status" checked={settings.showOnlineStatus ?? true} onCheckedChange={(v) => updateSettings({ showOnlineStatus: v })} />
                </GlassSettingRow>
                <GlassSettingRow icon={<BookOpen className="h-4 w-4 text-white/70" />} title="Share study activity" desc="Show completed lessons and study milestones on your profile.">
                  <Switch aria-label="Share study activity" checked={settings.shareStudyActivity ?? true} onCheckedChange={(v) => updateSettings({ shareStudyActivity: v })} />
                </GlassSettingRow>
                <GlassSettingRow icon={<Eye className="h-4 w-4 text-white/70" />} title="Profile visibility" desc="Who can see your study activity.">
                  <Select value={settings.profileVisibility ?? "friends"} onValueChange={(v) => { updateSettings({ profileVisibility: v as "public" | "friends" | "private" }); toast.success("Privacy updated"); }}>
                    <SelectTrigger aria-label="Profile visibility" className="w-32 asme-glass-input"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="friends">Friends</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </GlassSettingRow>
                </div>
              </div>

              <div className="asme-glass rounded-3xl p-6">
                <div className="mb-2"><h3 className="font-semibold text-white flex items-center gap-2"><MessageCircle className="h-4 w-4 text-pink-300" />Communication</h3><p className="mt-1 text-sm text-white/50">Manage who may contact you through Scholar.</p></div>
                <div className="divide-y divide-white/10">
                  <GlassSettingRow icon={<MessageCircle className="h-4 w-4 text-white/70" />} title="Allow community messages" desc="Send and receive friend messages and community replies.">
                    <Switch aria-label="Allow community messages" checked={settings.communityMessages ?? true} onCheckedChange={(v) => { updateSettings({ communityMessages: v }); toast.success(v ? "Community messages enabled" : "Community messages disabled"); }} />
                  </GlassSettingRow>
                  <GlassSettingRow icon={<User className="h-4 w-4 text-white/70" />} title="Allow friend requests" desc="Let people send you new friend requests.">
                    <Switch aria-label="Allow friend requests" checked={settings.allowFriendRequests ?? true} onCheckedChange={(v) => updateSettings({ allowFriendRequests: v })} />
                  </GlassSettingRow>
                </div>
              </div>

              <div className="asme-glass rounded-3xl p-6">
                <div className="mb-2"><h3 className="font-semibold text-white flex items-center gap-2"><Bot className="h-4 w-4 text-cyan-300" />LAM & AI privacy</h3><p className="mt-1 text-sm text-white/50">Control the information included with requests to the server-side Groq assistant. API keys always remain on the server.</p></div>
                <div className="divide-y divide-white/10">
                  <GlassSettingRow icon={<GraduationCap className="h-4 w-4 text-white/70" />} title="Include profile name in AI" desc="Send your display name and active class so LAM can personalize replies.">
                    <Switch aria-label="Include profile name in AI" checked={settings.includeProfileInAI ?? true} onCheckedChange={(v) => updateSettings({ includeProfileInAI: v })} />
                  </GlassSettingRow>
                  <GlassSettingRow icon={<BookOpen className="h-4 w-4 text-white/70" />} title="Share current page with LAM" desc="Include the active subject, chapter, book, and page with a LAM request.">
                    <Switch aria-label="Share current page with LAM" checked={settings.lamPageContext ?? true} onCheckedChange={(v) => updateSettings({ lamPageContext: v })} />
                  </GlassSettingRow>
                  <GlassSettingRow icon={<Eye className="h-4 w-4 text-white/70" />} title="Share selected text with LAM" desc="Attach text you select on a Scholar page to your next LAM request.">
                    <Switch aria-label="Share selected text with LAM" checked={settings.lamSelectedText ?? true} onCheckedChange={(v) => updateSettings({ lamSelectedText: v })} />
                  </GlassSettingRow>
                </div>
                <div className="mt-4 rounded-2xl border border-cyan-300/10 bg-cyan-300/5 p-4 text-xs leading-5 text-white/55"><Lock className="mr-1.5 inline h-3.5 w-3.5 text-cyan-300" />LAM sends only the current request, recent conversation messages, and context enabled above. It does not send your complete Scholar database.</div>
              </div>
            </TabsContent>

            {/* ===== Data ===== */}
            <TabsContent value="data" className="mt-2 space-y-4">
              <div className="asme-glass rounded-3xl p-6 space-y-4">
                <div>
                  <h3 className="font-semibold flex items-center gap-2 text-white">
                    <Database className="h-4 w-4 text-white/70" /> Backup & Restore
                  </h3>
                  <p className="text-sm text-white/50 mt-1">Export your entire study data as JSON, or restore from a backup file.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button onClick={exportData} className="asme-glass rounded-full px-5 py-2 text-white text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-1.5">
                    <Download className="h-3.5 w-3.5" /> Export all data
                  </button>
                  <button onClick={() => importRef.current?.click()} className="asme-glass rounded-full px-5 py-2 text-white text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-1.5">
                    <Upload className="h-3.5 w-3.5" /> Import data
                  </button>
                  <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = ""; }} />
                </div>
              </div>

              <div className="asme-glass rounded-3xl p-6 space-y-4">
                <div>
                  <h3 className="font-semibold flex items-center gap-2 text-white">
                    <Trash2 className="h-4 w-4 text-white/70" /> Reset Specific Data
                  </h3>
                  <p className="text-sm text-white/50 mt-1">Clear a single module without touching the rest.</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {RESET_PARTS.map((p) => (
                    <button key={p.key} onClick={() => { resetPart(p.key); toast.success(`${p.label} cleared`); }} className="asme-glass rounded-2xl px-3 py-2.5 text-white text-xs font-medium hover:bg-white/5 transition-colors flex items-center justify-center gap-1.5">
                      <span>{p.icon}</span> {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="asme-glass rounded-3xl p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-white">Reset Everything</h3>
                    <p className="text-sm text-white/50 mt-1">Restore Scholar to its initial state to its initial seeded state. This cannot be undone.</p>
                  </div>
                  <ResetEverythingDialog onConfirm={() => { resetEverything(); toast.success("Everything reset"); }} />
                </div>
              </div>
            </TabsContent>

            {/* ===== Developer ===== */}
            <TabsContent value="developer" className="mt-2 space-y-4">
              <div className="asme-glass rounded-3xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-amber-400">Developer Mode Active</p>
                    <p className="text-sm text-white/50 mt-0.5">These controls let you manipulate game state, XP, coins and more. They will affect your real progress — use responsibly.</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-medium text-amber-400 hidden sm:inline">{devMode ? "ON" : "OFF"}</span>
                    <Switch
                      checked={devMode}
                      onCheckedChange={(v) => {
                        if (v) {
                          setShowDevPassword(true);
                        } else {
                          setDevMode(false);
                          toast.success("Dev mode disabled");
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="asme-glass rounded-3xl p-6 space-y-4">
                <h3 className="font-semibold flex items-center gap-2 text-white">
                  <Coins className="h-4 w-4 text-white/70" /> Resource Controls
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <GlassDevNumberInput label="Coins" icon={<Coins className="h-3.5 w-3.5 text-white/70" />} value={coinInput} onChange={setCoinInput} presets={[{ label: "+1,000", onClick: () => applyCoins(coins + 1000) }, { label: "Max 99,999", onClick: () => applyCoins(99999) }, { label: "0", onClick: () => applyCoins(0) }]} onApply={() => applyCoins(Math.max(0, parseInt(coinInput) || 0))} />
                  <GlassDevNumberInput label="XP" icon={<Zap className="h-3.5 w-3.5 text-white/70" />} value={xpInput} onChange={setXpInput} presets={[{ label: "+1,000", onClick: () => applyXP(xp + 1000) }, { label: "Max 99,999", onClick: () => applyXP(99999) }, { label: "0", onClick: () => applyXP(0) }]} onApply={() => applyXP(Math.max(0, parseInt(xpInput) || 0))} />
                  <GlassDevNumberInput label="Level" icon={<Star className="h-3.5 w-3.5 text-white/70" />} value={lvlInput} onChange={setLvlInput} presets={[{ label: "+1", onClick: () => applyLevel(getLevelInfo(xp).level + 1) }, { label: "20", onClick: () => applyLevel(20) }, { label: "1", onClick: () => applyLevel(1) }]} onApply={() => applyLevel(Math.max(1, parseInt(lvlInput) || 1))} />
                  <GlassDevNumberInput label="Streak" icon={<Flame className="h-3.5 w-3.5 text-white/70" />} value={streakInput} onChange={setStreakInput} presets={[{ label: "+7", onClick: () => applyStreak(streak + 7) }, { label: "365", onClick: () => applyStreak(365) }, { label: "0", onClick: () => applyStreak(0) }]} onApply={() => applyStreak(Math.max(0, parseInt(streakInput) || 0))} />
                </div>
              </div>

              <div className="asme-glass rounded-3xl p-6 space-y-4">
                <h3 className="font-semibold flex items-center gap-2 text-white">
                  <Trophy className="h-4 w-4 text-white/70" /> Subject Mastery
                </h3>
                <div className="space-y-5">
                  {SUBJECTS.map((s) => (
                    <div key={s.id}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-white flex items-center gap-2"><span>{s.icon}</span>{s.name}</span>
                        <span className="text-xs font-mono text-white/50 tabular-nums">{mastery[s.id] ?? 0}%</span>
                      </div>
                      <Slider value={[mastery[s.id] ?? 0]} onValueChange={([v]) => setMastery(s.id, v)} max={100} step={1} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="asme-glass rounded-3xl p-6 space-y-4">
                <h3 className="font-semibold flex items-center gap-2 text-white">
                  <Gamepad2 className="h-4 w-4 text-white/70" /> Quick Actions
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <button onClick={doCompleteDailyChallenge} className="asme-glass rounded-2xl px-3 py-2.5 text-white text-xs font-medium hover:bg-white/5 transition-colors flex items-center justify-center gap-1.5"><Trophy className="h-3.5 w-3.5" /> Complete daily</button>
                  <button onClick={() => { addCoins(10000); toast.success("+10,000 coins"); }} className="asme-glass rounded-2xl px-3 py-2.5 text-white text-xs font-medium hover:bg-white/5 transition-colors flex items-center justify-center gap-1.5"><Coins className="h-3.5 w-3.5" /> +10,000 coins</button>
                  <button onClick={() => { addXP(5000); toast.success("+5,000 XP"); }} className="asme-glass rounded-2xl px-3 py-2.5 text-white text-xs font-medium hover:bg-white/5 transition-colors flex items-center justify-center gap-1.5"><Zap className="h-3.5 w-3.5" /> +5,000 XP</button>
                  <button onClick={() => applyLevel(getLevelInfo(xp).level + 5)} className="asme-glass rounded-2xl px-3 py-2.5 text-white text-xs font-medium hover:bg-white/5 transition-colors flex items-center justify-center gap-1.5"><Star className="h-3.5 w-3.5" /> +5 levels</button>
                  <button onClick={() => applyStreak(streak + 30)} className="asme-glass rounded-2xl px-3 py-2.5 text-white text-xs font-medium hover:bg-white/5 transition-colors flex items-center justify-center gap-1.5"><Flame className="h-3.5 w-3.5" /> +30 streak</button>
                </div>
              </div>

              <div className="asme-glass rounded-3xl p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-white">Reset Everything</h3>
                    <p className="text-sm text-white/50 mt-1">Wipe all data and reseed.</p>
                  </div>
                  <ResetEverythingDialog onConfirm={() => { resetEverything(); toast.success("Everything reset"); }} />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Social icons footer */}
        <div className="relative z-10 flex justify-center gap-4 pb-12">
          {[
            { Icon: Instagram, label: "Instagram" },
            { Icon: Twitter, label: "Twitter" },
            { Icon: Globe, label: "Website" },
          ].map(({ Icon, label }) => (
            <button key={label} type="button" aria-label={label} onClick={() => toast.info(`${label} link is not configured yet`, { description: "No page was opened. Scholar will publish verified official links here when available." })} className="asme-glass rounded-full p-4 text-white/80 hover:text-white hover:bg-white/5 transition-all">
              <Icon size={20} className="h-5 w-5" />
            </button>
          ))}
        </div>
      </div>

      {/* Dev Mode Password Dialog */}
      <Dialog open={showDevPassword} onOpenChange={setShowDevPassword}>
        <DialogContent className="asme-glass rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-400" /> Unlock Developer Mode
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-white/60">
            Dev mode lets you manipulate XP, coins, mastery and more. Enter the dev password to continue.
          </p>
          <Input
            type="password"
            value={devPasswordInput}
            onChange={(e) => setDevPasswordInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") confirmDevPassword(); }}
            placeholder="Enter dev password"
            className="asme-glass-input"
            autoFocus
          />
          <DialogFooter>
            <button
              onClick={() => { setShowDevPassword(false); setDevPasswordInput(""); }}
              className="asme-glass rounded-full px-5 py-2 text-white text-sm hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmDevPassword}
              className="rounded-full px-5 py-2 text-white text-sm font-medium bg-amber-500/80 hover:bg-amber-500 transition-colors flex items-center gap-1.5"
            >
              <Lock className="h-3.5 w-3.5" /> Unlock
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GlassField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-white/50">{label}</label>
      {children}
    </div>
  );
}

function GlassSettingRow({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
      <div className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 text-white/70 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-white/50">{desc}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function GlassDevNumberInput({ label, icon, value, onChange, presets, onApply }: { label: string; icon: React.ReactNode; value: string; onChange: (v: string) => void; presets: { label: string; onClick: () => void }[]; onApply: () => void }) {
  return (
    <div className="asme-glass rounded-2xl p-3 space-y-2">
      <span className="text-xs font-medium uppercase tracking-wider text-white/50 flex items-center gap-1.5">{icon}{label}</span>
      <div className="flex gap-2">
        <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} className="asme-glass-input font-mono" />
        <button onClick={onApply} className="asme-glass rounded-full px-4 py-2 text-white text-xs font-medium hover:bg-white/5 transition-colors shrink-0">Apply</button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button key={p.label} onClick={p.onClick} className="px-2 py-1 text-[10px] font-medium rounded-md bg-white/5 hover:bg-white/10 text-white/60 transition">{p.label}</button>
        ))}
      </div>
    </div>
  );
}

function ResetEverythingDialog({ onConfirm }: { onConfirm: () => void }) {
  const [open, setOpen] = useState(false);

  // Body scroll lock while the dialog is open. Radix already locks scroll for
  // the dialog content, but we add a belt-and-braces lock on the root
  // <html> so the page behind cannot scroll either.
  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = prev; };
  }, [open]);

  // Escape to close (Radix already does this, but we add a defensive handler
  // in case the Dialog is rendered inside a portal whose events are blocked).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="asme-glass rounded-full px-5 py-2 text-white text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Reset
        </button>
      </DialogTrigger>
      <DialogContent
        // IMPORTANT: do NOT apply `asme-glass` here — that class sets
        // `position: relative`, which overrides the Dialog's `position: fixed`
        // centering transform and makes the dialog render inline at the bottom
        // of the settings page instead of centered over an overlay. We inline
        // the glass styling instead and bump z-index well above the mobile
        // bottom navigation (which is z-40).
        className="!fixed !left-1/2 !top-1/2 !z-[100] !-translate-x-1/2 !-translate-y-1/2 !w-[calc(100%-2rem)] !max-w-md !rounded-3xl !border !border-white/15 !p-6 !shadow-2xl"
        style={{
          background: "rgba(15, 15, 22, 0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          color: "white",
        }}
      >
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="grid place-items-center h-10 w-10 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-white text-lg font-semibold leading-tight">
                Reset everything?
              </DialogTitle>
              <p className="text-xs text-white/50 mt-1">
                This action cannot be undone.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 text-sm text-white/80 leading-relaxed">
          <p>
            Scholar will be wiped and restored to its initial seeded state. The
            following will be <span className="text-red-300 font-medium">permanently removed</span>:
          </p>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-white/70 bg-white/[0.04] border border-white/10 rounded-xl p-3">
            <li className="flex items-center gap-1.5"><span className="text-red-300">✗</span> Notes & folders</li>
            <li className="flex items-center gap-1.5"><span className="text-red-300">✗</span> Flashcards & decks</li>
            <li className="flex items-center gap-1.5"><span className="text-red-300">✗</span> Tasks & reminders</li>
            <li className="flex items-center gap-1.5"><span className="text-red-300">✗</span> Quiz scores</li>
            <li className="flex items-center gap-1.5"><span className="text-red-300">✗</span> Focus sessions</li>
            <li className="flex items-center gap-1.5"><span className="text-red-300">✗</span> Uploaded files</li>
            <li className="flex items-center gap-1.5"><span className="text-red-300">✗</span> AI chat history</li>
            <li className="flex items-center gap-1.5"><span className="text-red-300">✗</span> Activity feed</li>
            <li className="flex items-center gap-1.5"><span className="text-red-300">✗</span> XP, coins & level</li>
            <li className="flex items-center gap-1.5"><span className="text-red-300">✗</span> Badges & streaks</li>
            <li className="flex items-center gap-1.5"><span className="text-red-300">✗</span> Subject mastery</li>
            <li className="flex items-center gap-1.5"><span className="text-red-300">✗</span> Custom settings</li>
          </ul>
          <p className="text-xs text-amber-300/80 flex items-start gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Consider exporting your data first (Backup &amp; Restore → Export data) if you want to keep a copy.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <button
            onClick={() => setOpen(false)}
            className="rounded-full px-5 py-2 text-white text-sm hover:bg-white/5 border border-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); setOpen(false); }}
            className="rounded-full px-5 py-2 text-white text-sm font-medium bg-red-600 hover:bg-red-500 transition-colors flex items-center gap-1.5 shadow-lg shadow-red-900/40"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reset Everything
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
