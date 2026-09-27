"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Play, BookOpen, Brain, Trophy, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { motion } from "framer-motion";
import { ReadyBackgroundVideo } from "@/components/ready-background-video";
import { ScholarFooter } from "@/components/scholar-footer";
import { useStore } from "@/lib/store";
const FadingVideo = ReadyBackgroundVideo;

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



type Mode = "login" | "signup" | "forgot" | "reset" | "verify";
type Config = { googleConfigured: boolean; passwordResetConfigured: boolean };
const GOOGLE_ERRORS: Record<string, string> = {
  GOOGLE_LINK_REQUIRED: "An account already uses this email. Sign in with your existing method, then connect Google in Settings.",
  GOOGLE_ALREADY_LINKED: "This Google identity is already connected to a Scholar account.",
  GOOGLE_EXPIRED: "Google sign-in expired or your browser session changed. Please start again.",
  GOOGLE_CANCELLED: "Google sign-in was cancelled. You can try again or sign in with email.",
  GOOGLE_NOT_CONFIGURED: "Google sign-in is not configured on this Scholar instance.",
  GOOGLE_FAILED: "Google sign-in could not be completed. Please retry or sign in with email.",
  SIGN_IN_REQUIRED: "Sign in to your existing Scholar account before connecting Google.",
};
export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [config, setConfig] = useState<Config | null>(null);
  const token = useRef("");
  const notice = useRef<HTMLParagraphElement>(null);
  const startGuestSession = useStore((s) => s.startGuestSession);

  useEffect(() => {
    const url = new URL(window.location.href);
    const fragment = new URLSearchParams(url.hash.slice(1));
    const purpose = fragment.has("reset") ? "reset" : fragment.has("verify") ? "verify" : null;
    const forgot = fragment.has("forgot");
    if (forgot) queueMicrotask(() => setMode("forgot"));
    if (purpose) {
      token.current = fragment.get(purpose) || "";
      queueMicrotask(() => { setMode(purpose); if (!/^[A-Za-z0-9_-]{43}$/.test(token.current)) setError("This link is invalid. Request a new one."); });
    }
    const authError = url.searchParams.get("authError");
    if (authError) queueMicrotask(() => setError(GOOGLE_ERRORS[authError] || GOOGLE_ERRORS.GOOGLE_FAILED));
    if (purpose || forgot || authError) {
      window.history.replaceState(null, "", url.pathname);
      requestAnimationFrame(() => document.getElementById("scholar-auth-form")?.parentElement?.scrollIntoView({ block: "start", behavior: "instant" }));
    }
    const controller = new AbortController();
    void fetch("/api/auth/config", { cache: "no-store", signal: controller.signal }).then((r) => r.json()).then(setConfig).catch(() => undefined);
    // Dedicated recovery page stays open even if a previous session exists.
    if (url.pathname === "/login" && !purpose && !forgot && !authError) {
      void fetch("/api/auth/session", { cache: "no-store", signal: controller.signal }).then((r) => r.json()).then((v) => {
        if (v.authenticated && !controller.signal.aborted) window.location.replace("/");
      }).catch(() => undefined);
    }
    return () => controller.abort();
  }, []);
  useEffect(() => { if (error) notice.current?.focus(); }, [error]);

  function changeMode(next: Mode) { setMode(next); setError(""); setMessage(""); setPassword(""); setConfirmPassword(""); setVisible(false); }
  async function post(path: string, body: object) {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(25_000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Account services are temporarily unavailable. Please retry or use Guest Mode.");
    return data;
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if ((mode === "signup" || mode === "reset") && password !== confirmPassword) { setError("The passwords do not match."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      if (mode === "forgot") {
        const data = await post("/api/auth/recovery", { action: "request-reset", email }); setMessage(data.message); return;
      }
      if (mode === "reset" || mode === "verify") {
        const data = await post("/api/auth/recovery", { action: mode, token: token.current, ...(mode === "reset" ? { password, confirmPassword } : {}) });
        token.current = ""; changeMode("login"); setMessage(data.message); return;
      }
      await post(`/api/auth/${mode === "signup" ? "register" : "login"}`, { email, password, ...(mode === "signup" ? { name, confirmPassword } : {}) });
      // Server session + existing account-workspace/Your Scholar providers own restoration.
      window.location.replace("/");
    } catch (failure) { setError(failure instanceof Error && failure.name !== "TimeoutError" ? failure.message : "The request took too long. Please retry; Guest Mode is still available."); }
    finally { setBusy(false); }
  }
  async function google() {
    if (busy) return;
    setBusy(true); setError("");
    try { const data = await post("/api/auth/google/start", { intent: "signin" }); window.location.assign(data.url); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Google sign-in failed."); setBusy(false); }
  }
  function openSignup() {
    changeMode("signup");
    document.getElementById("scholar-auth-form")?.parentElement?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  function enterGuest() { startGuestSession(); window.location.replace("/"); }
  const accountMode = mode === "login" || mode === "signup";
  const hasPassword = accountMode || mode === "reset";
  const title = { login: "Welcome back", signup: "Create your Scholar account", forgot: "Reset your password", reset: "Choose a new password", verify: "Verify your email" }[mode];
  return (
    <div className="scholar-auth min-h-dvh bg-black overflow-x-clip relative" style={{ borderRadius: 0 }}>
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
        .lg-input:focus { box-shadow: none !important; outline: 2px solid rgba(165,180,252,.8) !important; outline-offset: 3px; }
      `}</style>

      {/* ===== Section 1: Hero (full viewport) ===== */}
      <section className="scholar-auth-hero relative min-h-[100svh] w-full overflow-hidden">
        {/* Background video — 120% width/height, top-aligned */}
        <FadingVideo
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_080021_d598092b-c4c2-4e53-8e46-94cf9064cd50.mp4"
          className="absolute left-1/2 top-0 -translate-x-1/2 object-cover object-top z-0"
          style={{ width: "120%", height: "120%" }}
        />

        {/* Navbar */}
        <nav className="scholar-auth-nav fixed top-4 left-0 right-0 px-8 lg:px-16 z-50">
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
                onClick={openSignup}
                className="bg-white text-black px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap flex items-center gap-1 lg-body hover:scale-105 transition-transform"
              >
                Get Started <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
            <div className="h-12 w-12" />
          </div>
        </nav>

        {/* Hero content */}
        <div className="scholar-auth-content relative z-10 flex min-h-[100svh] flex-col items-center justify-center pt-20 pb-24 px-4 text-center">
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
            className="scholar-auth-cta flex flex-wrap justify-center items-center gap-4 mt-10"
          >
            <button
              onClick={openSignup}
              className="lg-glass-strong rounded-full px-6 py-3 text-sm font-medium text-white flex items-center gap-2 lg-body hover:scale-105 transition-transform"
            >
              Start Your Journey <ArrowUpRight className="h-5 w-5" />
            </button>
            <button
              onClick={enterGuest}
              className="text-white text-sm font-medium flex items-center gap-2 lg-body hover:text-white/80 transition-colors"
            >
              Explore as Guest <Play className="h-4 w-4 fill-white" />
            </button>
            <Link href="/group-study" className="lg-glass-strong rounded-full px-6 py-3 text-sm font-medium text-white flex items-center gap-2 lg-body">
              Group Study <span className="rounded-full border border-white/20 px-2 py-0.5 text-[9px] tracking-widest">BETA</span>
            </Link>
          </motion.div>
        </div>

        {/* Partners */}
        <motion.div
          initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
          animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.4, ease: "easeOut" }}
          className="scholar-auth-partners absolute bottom-0 left-0 right-0 flex flex-col items-center gap-4 pb-8 z-10"
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

          {/* Original Scholar glass card: authentication capabilities only. */}
          <motion.div
            initial={{ filter: "blur(10px)", opacity: 0, y: 30 }}
            whileInView={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="lg-glass-strong rounded-[1.5rem] p-8 max-w-md w-full mx-auto my-8"
            style={{ scrollMarginTop: 96 }}
          >
            <div className="text-center mb-6">
              <h2 className="lg-serif text-white text-3xl mb-2">{title}</h2>
              <p className="text-sm text-white/60 lg-body">{mode === "login" ? "Sign in to continue your Scholar." : mode === "signup" ? "Create your study account." : mode === "verify" ? "Confirm this email belongs to you." : "Keep your saved work. Recover your account."}</p>
            </div>
            {accountMode && <div className="lg-glass rounded-full p-1 flex gap-1 mb-5" role="group" aria-label="Account action">
              {(["login", "signup"] as const).map((value) => <button key={value} type="button" disabled={busy} aria-pressed={mode === value} onClick={() => changeMode(value)} className={`flex-1 rounded-full px-3 py-2 text-xs lg-body transition-colors ${mode === value ? "bg-white/10 text-white" : "text-white/60 hover:text-white"}`}>{value === "login" ? "Sign in" : "Create account"}</button>)}
            </div>}
            <form id="scholar-auth-form" onSubmit={submit} aria-busy={busy} className="auth-form space-y-4">
              {mode === "signup" && <div>
                <label htmlFor="scholar-name" className="text-xs text-white/50 lg-body block mb-1.5">Name</label>
                <input id="scholar-name" name="name" autoComplete="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} disabled={busy} placeholder="Your full name" className="lg-input lg-body w-full px-4 py-3 rounded-xl bg-white/5" />
              </div>}
              {(accountMode || mode === "forgot") && <div>
                <label htmlFor="scholar-email" className="text-xs text-white/50 lg-body block mb-1.5">Email</label>
                <input id="scholar-email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} placeholder="you@scholar.app" className="lg-input lg-body w-full px-4 py-3 rounded-xl bg-white/5" />
              </div>}
              {hasPassword && <div>
                <label htmlFor="scholar-password" className="text-xs text-white/50 lg-body block mb-1.5">{mode === "reset" ? "New password" : "Password"}</label>
                <div className="relative">
                  <input id="scholar-password" name="password" type={visible ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "login" ? 1 : 8} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} className="lg-input lg-body w-full pl-4 pr-12 py-3 rounded-xl bg-white/5" />
                  <button type="button" className="absolute right-0 top-0 grid h-12 w-12 place-items-center rounded-xl text-white/60 hover:text-white" disabled={busy} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                </div>
              </div>}
              {(mode === "signup" || mode === "reset") && <div>
                <label htmlFor="scholar-confirm" className="text-xs text-white/50 lg-body block mb-1.5">Confirm password</label>
                <input id="scholar-confirm" name="confirmPassword" type={visible ? "text" : "password"} autoComplete="new-password" required minLength={8} maxLength={128} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={busy} className="lg-input lg-body w-full px-4 py-3 rounded-xl bg-white/5" />
              </div>}
              {mode === "login" && <div className="text-right"><button type="button" className="text-xs text-white/60 hover:text-white lg-body" disabled={busy} onClick={() => changeMode("forgot")}>Forgot password?</button></div>}
              {mode === "forgot" && config && !config.passwordResetConfigured && <p className="text-xs text-white/50 leading-5 lg-body">Email recovery isn’t available here yet. You can still sign in or continue as Guest.</p>}
              {error && <p ref={notice} tabIndex={-1} role="alert" className="auth-error text-sm text-rose-300 lg-body break-words">{error}</p>}
              {message && <p role="status" className="auth-success text-sm text-emerald-200 lg-body break-words">{message}</p>}
              <button type="submit" disabled={busy || (mode === "forgot" && config?.passwordResetConfigured === false)} className="w-full lg-glass-strong rounded-full px-5 py-3 text-sm font-medium text-white flex items-center justify-center gap-2 lg-body hover:scale-[1.02] transition-transform disabled:opacity-50">
                {busy ? <><LoaderCircle size={17} className="animate-spin motion-reduce:animate-none" />Please wait…</> : <>{{ login: "Sign In", signup: "Create Account", forgot: "Send reset link", reset: "Update password", verify: "Verify email" }[mode]}<ArrowUpRight className="h-4 w-4" /></>}
              </button>
              {accountMode && <>
                <button type="button" disabled={busy || !config?.googleConfigured} onClick={() => void google()} className="w-full rounded-full border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/85 flex items-center justify-center gap-3 transition-colors hover:bg-white/[0.09] lg-body disabled:opacity-50">
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.73-.06-1.42-.19-2.09H12v3.96h5.92a5.07 5.07 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.75 3.28-7.96Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.24 1.06-3.72 1.06-2.87 0-5.3-1.94-6.17-4.55H2.15v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.83 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.15a11 11 0 0 0 0 9.86l3.68-2.84Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.57 10.57 0 0 0 12 1a11 11 0 0 0-9.85 6.07l3.68 2.84C6.7 7.32 9.13 5.38 12 5.38Z"/></svg>
                  Continue with Google
                </button>
                {config && !config.googleConfigured && <p className="text-[11px] text-white/45 text-center lg-body">Google sign-in is not available here yet.</p>}
              </>}
              <button type="button" onClick={enterGuest} disabled={busy} className="w-full rounded-full border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/85 transition-colors hover:bg-white/[0.09] hover:text-white lg-body disabled:opacity-50">Continue as Guest</button>
              <Link href="/group-study" className="w-full rounded-full border border-white/20 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-white/[0.12] flex items-center justify-center gap-3">Group Study <span className="text-[9px] tracking-[0.16em] rounded-full border border-white/20 px-2 py-0.5">BETA</span></Link>
            </form>
            <div className="mt-6 text-center">
              <button type="button" disabled={busy} onClick={() => changeMode(mode === "login" ? "signup" : "login")} className="text-sm text-white/60 hover:text-white lg-body transition-colors">{mode === "login" ? "Don't have an account? Sign up" : mode === "signup" ? "Already have an account? Sign in" : "Back to sign in"}</button>
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
      <ScholarFooter />
    </div>
  );
}
