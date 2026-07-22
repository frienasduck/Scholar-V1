"use client";

import { motion } from "framer-motion";
import { Mic, Square } from "lucide-react";
import { LamMark } from "@/components/lam/lam-mark";
import { cn } from "@/lib/utils";

export function GlassWaveListening({ transcript, onStop }: { transcript?: string; onStop: () => void }) {
  return <motion.section initial={{ opacity: 0, scale: .88, y: -12, filter: "blur(12px)" }} animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }} transition={{ type: "spring", stiffness: 360, damping: 28 }} className="lam-listening-capsule mx-auto w-full max-w-xl rounded-[1.65rem] p-3">
    <span className="lam-glass-reflection" aria-hidden="true" />
    <div className="flex items-center gap-3">
      <span className="lam-listening-orb grid h-11 w-11 shrink-0 place-items-center rounded-full"><Mic className="h-4 w-4 text-white" /></span>
      <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-cyan-100/70">LAM is listening</p><p className="mt-0.5 truncate text-sm text-white/85">{transcript || "Speak naturally, or type below"}</p></div>
      <div className="lam-wave flex h-7 items-center gap-1" aria-hidden="true">{[.55, 1, .72, .9, .45].map((scale, index) => <i key={index} style={{ "--wave-scale": scale, animationDelay: `${index * 85}ms` } as React.CSSProperties} />)}</div>
      <button type="button" onClick={onStop} aria-label="Stop listening" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/7 text-white/65 transition hover:bg-rose-300/15 hover:text-rose-100"><Square className="h-3.5 w-3.5" /></button>
    </div>
  </motion.section>;
}

export function LamThinkingState({ request, transcribing = false, onStop }: { request?: string; transcribing?: boolean; onStop?: () => void }) {
  return <motion.section layout initial={{ opacity: 0, scaleX: .72, y: -6 }} animate={{ opacity: 1, scaleX: 1, y: 0 }} transition={{ type: "spring", stiffness: 310, damping: 30 }} className="lam-thinking-capsule mx-auto w-full max-w-2xl rounded-full px-3 py-2.5">
    <span className="lam-glass-reflection" aria-hidden="true" />
    <div className="flex items-center gap-3">
      <span className="lam-thinking-glyph grid h-10 w-10 shrink-0 place-items-center rounded-full"><LamMark active className="text-violet-100" /></span>
      <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-violet-100/60">{transcribing ? "Transcribing" : "LAM is thinking"}</p><p className="truncate text-sm font-medium text-white/88">{request || (transcribing ? "Turning your voice into text…" : "Preparing your answer…")}</p></div>
      <span className="lam-thinking-dots flex items-center gap-1" aria-label="Processing"><i /><i /><i /></span>
      {onStop && <button type="button" onClick={onStop} className="rounded-full px-2 py-1 text-[10px] text-white/45 transition hover:bg-white/8 hover:text-white">Stop</button>}
    </div>
  </motion.section>;
}

export function LamQuickActionChip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <motion.button type="button" whileHover={{ y: -1, scale: 1.015 }} whileTap={{ scale: .97 }} onClick={onClick} className={cn("lam-quick-chip whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-medium text-white/72 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-300/50")}>{children}</motion.button>;
}

