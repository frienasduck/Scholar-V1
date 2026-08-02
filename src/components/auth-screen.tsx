"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { ArrowUpRight, Play, BookOpen, Brain, Trophy } from "lucide-react";
import { markLoginIntroPlayed, useScholarTransition } from "@/components/scholar-transition";

// ===== FadingVideo component (custom JS crossfade, no CSS transitions) =====
function FadingVideo({ src, className, style }: { src: string; className?: string; style?: React.CSSProperties }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);
  const fadingOutRef = useRef(false);
  const FADE_MS = 500;
  const FADE_OUT_LEAD = 0.55;

  const fadeTo = (target: number, duration: number) => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const video = videoRef.current;
    if (!video) return;
    const startOpacity = video.style.opacity ? parseFloat(video.style.opacity) : 0;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = progress * (2 - progress);
      video.style.opacity = String(startOpacity + (target - startOpacity) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedData = () => {
      video.style.opacity = "0";
      video.play().catch(() => {});
      fadeTo(1, FADE_MS);
    };

    const handleTimeUpdate = () => {
      if (!video.duration || fadingOutRef.current) return;
      const remaining = video.duration - video.currentTime;
      if (remaining <= FADE_OUT_LEAD && remaining > 0) {
        fadingOutRef.current = true;
        fadeTo(0, FADE_MS);
      }
    };

    const handleEnded = () => {
      video.style.opacity = "0";
      setTimeout(() => {
        video.currentTime = 0;
        video.play().catch(() => {});
        fadingOutRef.current = false;
        fadeTo(1, FADE_MS);
      }, 100);
    };

    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      preload="auto"
      className={className}
      style={{ opacity: 0, ...style }}
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}

// ===== BlurText component (word-by-word blur-in) =====
function BlurText({ text, className }: { text: string; className?: string }) {
  const words = text.split(" ");
  return (
    <p
      className={className}
      style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", rowGap: "0.1em" }}
    >
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ filter: "blur(10px)", opacity: 0, y: 50 }}
          whileInView={{
            filter: ["blur(10px)", "blur(5px)", "blur(0px)"],
            opacity: [0, 0.5, 1],
            y: [50, -5, 0],
          }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{
            duration: 0.7,
            times: [0, 0.5, 1],
            ease: "easeOut",
            delay: (i * 100) / 1000,
          }}
          style={{ display: "inline-block", marginRight: "0.28em" }}
        >
          {word}
        </motion.span>
      ))}
    </p>
  );
}

// ===== Auth Screen =====
export function AuthScreen() {
  const setAuthed = useStore((s) => s.setAuthed);
  const updateUser = useStore((s) => s.updateUser);
  const switchClass = useStore((s) => s.switchClass);
  const user = useStore((s) => s.user);
  const onboarded = useStore((s) => s.onboarded);
  const { startTransition } = useScholarTransition();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [name, setName] = useState(user.name);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [selectedClass, setSelectedClass] = useState<9 | 11>(11);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setAuthError("Enter both your email and password to continue.");
      return;
    }
    setAuthError("");
    setLoading(true);
    try {
      const resolvedName = name.trim() || "Ishan";
      const response = await fetch(`/api/auth/${mode === "signup" ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, name: resolvedName }),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "Sign-in failed.");
      switchClass(11);
      updateUser({
        email: value.user?.email || email,
        name: value.user?.name || resolvedName,
        username: (value.user?.name || resolvedName).toLowerCase().replace(/[^a-z0-9]+/g, "_"),
        scholarClass: 11,
        jeeMode: false,
      });
      if (!onboarded && markLoginIntroPlayed()) {
        void startTransition({ type: "login-intro", durationMs: 16_000 });
      }
      setAuthed(true);
      window.dispatchEvent(new Event("scholar:session-changed"));
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black overflow-hidden relative" style={{ borderRadius: 0 }}>
      {/* Liquid glass CSS */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Barlow:wght@300;400;500;600&display=swap');
        .lg-glass {
          background: rgba(255,255,255,0.01);
          background-blend-mode: luminosity;
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          border: none;
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.1);
          position: relative;
          overflow: hidden;
        }
        .lg-glass::before {
          content: "";
          position: absolute; inset: 0;
          border-radius: inherit;
          padding: 1.4px;
          background: linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 20%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.15) 80%, rgba(255,255,255,0.45) 100%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .lg-glass-strong {
          background: rgba(255,255,255,0.01);
          background-blend-mode: luminosity;
          backdrop-filter: blur(50px);
          -webkit-backdrop-filter: blur(50px);
          border: none;
          box-shadow: 4px 4px 4px rgba(0,0,0,0.05), inset 0 1px 1px rgba(255,255,255,0.15);
          position: relative;
          overflow: hidden;
        }
        .lg-glass-strong::before {
          content: "";
          position: absolute; inset: 0;
          border-radius: inherit;
          padding: 1.4px;
          background: linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.2) 20%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.2) 80%, rgba(255,255,255,0.5) 100%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .lg-serif { font-family: 'Instrument Serif', serif; font-style: italic; }
        .lg-body { font-family: 'Barlow', sans-serif; }
        .lg-input {
          background: transparent !important;
          border: none !important;
          color: white !important;
          box-shadow: none !important;
        }
        .lg-input::placeholder { color: rgba(255,255,255,0.4) !important; }
        .lg-input:focus { box-shadow: none !important; outline: none !important; }
      `}</style>

      {/* ===== Section 1: Hero (full viewport) ===== */}
      <section className="relative h-screen w-full overflow-hidden">
        {/* Background video — 120% width/height, top-aligned */}
        <FadingVideo
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_080021_d598092b-c4c2-4e53-8e46-94cf9064cd50.mp4"
          className="absolute left-1/2 top-0 -translate-x-1/2 object-cover object-top z-0"
          style={{ width: "120%", height: "120%" }}
        />

        {/* Navbar */}
        <nav className="fixed top-4 left-0 right-0 px-8 lg:px-16 z-50">
          <div className="flex items-center justify-between">
            <div className="lg-glass grid place-items-center h-12 w-12 rounded-full">
              <span className="lg-serif text-white text-2xl">n</span>
            </div>
            <div className="hidden md:flex lg-glass rounded-full items-center gap-1 px-1.5 py-1.5">
              {["Dashboard", "AI Tutor", "Notes", "Resources"].map((link) => (
                <span key={link} className="px-3 py-2 text-sm font-medium text-white/90 lg-body cursor-default">
                  {link}
                </span>
              ))}
              <button
                onClick={() => setMode("signup")}
                className="bg-white text-black px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap flex items-center gap-1 lg-body hover:scale-105 transition-transform"
              >
                Get Started <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
            <div className="h-12 w-12" />
          </div>
        </nav>

        {/* Hero content */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full pt-20 pb-24 px-4 text-center">
          {/* Badge */}
          <motion.div
            initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
            className="lg-glass rounded-full flex items-center gap-2 px-1 py-1 mb-8"
          >
            <span className="bg-white text-black px-3 py-1 text-xs font-semibold rounded-full lg-body">New</span>
            <span className="text-sm text-white/90 pr-3 lg-body">AI-Powered Study OS for CBSE Class 9 & Class 11</span>
          </motion.div>

          {/* Headline */}
          <BlurText
            text="Learn Past Your Limits Across the Syllabus"
            className="lg-serif text-white text-5xl md:text-6xl lg:text-[5rem] leading-[0.8] max-w-2xl tracking-[-4px] mb-8"
          />

          {/* Subheading */}
          <motion.p
            initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8, ease: "easeOut" }}
            className="text-sm md:text-base text-white/80 max-w-xl lg-body font-light leading-relaxed"
          >
            Discover your subjects in ways once unimaginable. AI tutors, smart notes, and breakthrough flashcards bring deep learning within reach.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.1, ease: "easeOut" }}
            className="flex items-center gap-6 mt-10"
          >
            <button
              onClick={() => setMode("signup")}
              className="lg-glass-strong rounded-full px-6 py-3 text-sm font-medium text-white flex items-center gap-2 lg-body hover:scale-105 transition-transform"
            >
              Start Your Journey <ArrowUpRight className="h-5 w-5" />
            </button>
            <button
              onClick={() => setMode("login")}
              className="text-white text-sm font-medium flex items-center gap-2 lg-body hover:text-white/80 transition-colors"
            >
              View Demo <Play className="h-4 w-4 fill-white" />
            </button>
          </motion.div>
        </div>

        {/* Partners */}
        <motion.div
          initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
          animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.4, ease: "easeOut" }}
          className="absolute bottom-0 left-0 right-0 flex flex-col items-center gap-4 pb-8 z-10"
        >
          <div className="lg-glass rounded-full px-3.5 py-1 text-xs font-medium text-white lg-body">
            Powered by advanced AI · Crafted for CBSE excellence
          </div>
          <div className="flex gap-12 md:gap-16">
            {["NCERT", "CBSE", "AI", "CBSE", "Smart"].map((name, i) => (
              <span key={i} className="lg-serif text-white text-2xl md:text-3xl tracking-tight">{name}</span>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ===== Section 2: Capabilities (min-h-screen) ===== */}
      <section className="relative min-h-screen w-full overflow-hidden">
        {/* Background video — full-bleed */}
        <FadingVideo
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_094631_d30ab262-45ee-4b7d-99f3-5d5848c8ef13.mp4"
          className="absolute inset-0 w-full h-full object-cover z-0"
        />

        {/* Content */}
        <div className="relative z-10 px-8 md:px-16 lg:px-20 pt-24 pb-10 flex flex-col min-h-screen">
          {/* Header */}
          <div className="mb-auto">
            <p className="text-sm lg-body text-white/80 mb-6">{"// Features"}</p>
            <BlurText
              text="Learning evolved"
              className="lg-serif text-white text-6xl md:text-7xl lg:text-[6rem] leading-[0.9] tracking-[-3px]"
            />
          </div>

          {/* Auth form — liquid glass card */}
          <motion.div
            initial={{ filter: "blur(10px)", opacity: 0, y: 30 }}
            whileInView={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="lg-glass-strong rounded-[1.5rem] p-8 max-w-md w-full mx-auto my-8"
          >
            <div className="text-center mb-6">
              <h2 className="lg-serif text-white text-3xl mb-2">
                {mode === "login" ? "Welcome back" : "Begin your journey"}
              </h2>
              <p className="text-sm text-white/60 lg-body">
                {mode === "login" ? "Sign in to continue learning" : "Create your study account"}
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" && (
                <div>
                  <label className="text-xs text-white/50 lg-body block mb-1.5">Full Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={selectedClass === 11 ? "Ishan" : "Neha Salah"}
                    className="lg-input lg-body w-full px-4 py-3 rounded-xl bg-white/5"
                  />
                </div>
              )}
              <div>
                <label className="text-xs text-white/50 lg-body block mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setAuthError(""); }}
                  placeholder="you@scholar.app"
                  className="lg-input lg-body w-full px-4 py-3 rounded-xl bg-white/5"
                />
              </div>
              <div>
                <label className="text-xs text-white/50 lg-body block mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setAuthError(""); }}
                  className="lg-input lg-body w-full px-4 py-3 rounded-xl bg-white/5"
                />
              </div>

              {/* Class Selection — Dual Login */}
              <div>
                <label className="text-xs text-white/60 lg-body mb-2 block">Select Class</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { setSelectedClass(11); setAuthError("Class 9 is available with Scholar Plus after sign-in."); }}
                    className={`rounded-xl px-4 py-3 text-sm font-medium transition-all flex flex-col items-center gap-1 ${
                      selectedClass === 9
                        ? "lg-glass-strong text-white ring-2 ring-indigo-400"
                        : "lg-glass text-white/60 hover:text-white"
                    }`}
                  >
                    <span className="text-2xl">📘</span>
                    <span className="lg-body font-medium">Class 9</span>
                    <span className="text-[10px] text-amber-200">Scholar Plus</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedClass(11); setAuthError(""); }}
                    className={`rounded-xl px-4 py-3 text-sm font-medium transition-all flex flex-col items-center gap-1 ${
                      selectedClass === 11
                        ? "lg-glass-strong text-white ring-2 ring-blue-400"
                        : "lg-glass text-white/60 hover:text-white"
                    }`}
                  >
                    <span className="text-2xl">⚛️</span>
                    <span className="lg-body font-medium">Class 11</span>
                    <span className="text-[10px] text-white/50">PCM + CS</span>
                  </button>
                </div>
              </div>

              {authError && <p role="alert" className="text-sm text-rose-300 lg-body">{authError}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full lg-glass-strong rounded-full px-5 py-3 text-sm font-medium text-white flex items-center justify-center gap-2 lg-body hover:scale-[1.02] transition-transform disabled:opacity-50"
              >
                {loading ? "Signing in…" : (
                  <>
                    {mode === "login" ? "Sign In" : "Create Account"}
                    <ArrowUpRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
                className="text-sm text-white/60 hover:text-white lg-body transition-colors"
              >
                {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>

            <div className="mt-4 text-center text-xs text-white/40 lg-body">
              <p>Your Scholar account is protected by a secure server session.</p>
            </div>
          </motion.div>

          {/* Three feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            {[
              {
                title: "AI Tutors",
                body: "Five AI teacher personas — Dr. Meera, Mr. Raj, Sara, Arjun, and slayra — who explain concepts, solve problems, and chat like real mentors.",
                tags: ["Science", "Maths", "English", "SST"],
                icon: Brain,
              },
              {
                title: "Smart Notes",
                body: "Notion-level note-taking with markdown, live preview, AI summaries, voice notes, version history, and PDF export. Organized by subject.",
                tags: ["Markdown", "AI Summary", "Voice", "PDF Export"],
                icon: BookOpen,
              },
              {
                title: "Mastery Tracking",
                body: "Beautiful analytics with study heatmaps, subject mastery radar, quiz performance bars, and AI-powered insights that find your weak spots.",
                tags: ["Heatmaps", "Radar Charts", "Insights", "Progress"],
                icon: Trophy,
              },
            ].map((card, i) => (
              <motion.div
                key={i}
                initial={{ filter: "blur(10px)", opacity: 0, y: 30 }}
                whileInView={{ filter: "blur(0px)", opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: i * 0.15, ease: "easeOut" }}
                className="lg-glass rounded-[1.25rem] p-6 min-h-[360px] flex flex-col"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="lg-glass grid place-items-center h-11 w-11 rounded-[0.75rem]">
                    <card.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5 max-w-[70%]">
                    {card.tags.map((tag) => (
                      <span key={tag} className="lg-glass rounded-full px-3 py-1 text-[11px] text-white/90 lg-body whitespace-nowrap">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex-1" />
                <div className="mt-6">
                  <h3 className="lg-serif text-white text-3xl md:text-4xl tracking-[-1px] leading-none">
                    {card.title}
                  </h3>
                  <p className="mt-3 text-sm text-white/90 lg-body font-light leading-snug max-w-[32ch]">
                    {card.body}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
