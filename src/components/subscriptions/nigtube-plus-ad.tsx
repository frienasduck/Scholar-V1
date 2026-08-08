"use client";

import { motion } from "framer-motion";
import { Sparkles, Crown, ArrowRight, Volume2, Brain, Loader2 } from "lucide-react";
import type { NigtubeAdMachine } from "@/lib/subscriptions/nigtube-ad";
import { canSkip } from "@/lib/subscriptions/nigtube-ad";
import { openScholarPlus } from "@/lib/subscriptions/promo";
import { useStore } from "@/lib/store";

const BENEFITS = [
  { icon: Volume2, label: "Ad-free Nigtube & Study Music" },
  { icon: Brain, label: "Higher AI generation limits" },
  { icon: Crown, label: "Advanced Scholar Plus tools" },
];

interface NigtubePlusAdProps {
  machine: NigtubeAdMachine;
  onSkip: () => void;
}

export function NigtubePlusAd({ machine, onSkip }: NigtubePlusAdProps) {
  const reduceMotion = useStore((s) => s.settings.reduceMotion);
  const ready = canSkip(machine);

  if (machine.state === "checking" || machine.state === "idle") {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3 text-white/55">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-200/70" />
          <p className="text-xs">Preparing your video…</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-slate-950"
      role="dialog"
      aria-label="Scholar Plus promotion"
      aria-live="polite"
    >
      {/* Premium ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 15% 10%, rgba(120,110,255,0.16), transparent 55%), radial-gradient(110% 80% at 90% 90%, rgba(56,189,248,0.12), transparent 55%)",
        }}
      />
      {/* Gentle shimmer */}
      {!reduceMotion && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          animate={{ x: ["-60%", "60%"] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
          style={{
            background:
              "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.05) 50%, transparent 60%)",
          }}
        />
      )}

      {/* Frosted promotional panel */}
      <div className="relative z-10 mx-auto w-[min(30rem,calc(100%-2rem))] rounded-[1.75rem] border border-white/12 bg-white/[0.06] p-6 backdrop-blur-2xl sm:p-8">
        <div className="flex items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/25 bg-gradient-to-r from-amber-300/15 to-violet-400/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-100 shadow-[0_0_18px_rgba(252,211,77,0.12)]">
            <Sparkles className="h-3 w-3" /> Scholar Plus
          </span>
        </div>

        <h3 className="mt-4 text-center text-2xl font-semibold leading-tight text-white sm:text-3xl">
          Study without interruptions.
        </h3>
        <p className="mt-2 text-center text-sm leading-6 text-white/60">
          Upgrade to Scholar Plus for an ad-free Scholar experience and more
          powerful learning tools.
        </p>

        <ul className="mt-5 space-y-2.5">
          {BENEFITS.map((benefit) => (
            <li key={benefit.label} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.04] px-3.5 py-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-300/20 to-violet-400/20 text-cyan-100">
                <benefit.icon className="h-4 w-4" />
              </span>
              <span className="text-sm text-white/85">{benefit.label}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col-reverse items-stretch justify-between gap-2 sm:flex-row sm:items-center">
          <button
            onClick={() => openScholarPlus({ source: "nigtube-ad" })}
            className="flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-300 to-violet-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-violet-500/20 transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
          >
            Upgrade to Plus <ArrowRight className="h-4 w-4" />
          </button>

          {ready ? (
            <button
              onClick={onSkip}
              autoFocus
              className="rounded-full border border-white/15 bg-white/8 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Skip Ad
            </button>
          ) : (
            <span
              className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm text-white/55"
              aria-label={`Skip available in ${machine.countdown} seconds`}
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Skip in {machine.countdown}
            </span>
          )}
        </div>

        {/* Progress bar representing the promotional period */}
        <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-white/10" aria-hidden>
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-cyan-300/80 to-violet-400/80"
            initial={false}
            animate={{ width: `${((machine.total - machine.countdown) / machine.total) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>
    </motion.div>
  );
}
