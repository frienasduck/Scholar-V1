"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { LAM_MODES, type LamMode } from "@/lib/lam/types";

export function GlassModeMenu({ value, labels, onChange, reducedMotion = false }: {
  value: LamMode;
  labels: Record<LamMode, string>;
  onChange: (mode: LamMode) => void;
  reducedMotion?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    window.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", close); window.removeEventListener("keydown", key); };
  }, []);

  return <div ref={rootRef} className="relative z-30 shrink-0">
    <button type="button" aria-label="LAM mode" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((shown) => !shown)} className="lam-mode-trigger group flex min-h-9 items-center gap-2 rounded-full px-3 text-xs font-semibold text-white/90 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60">
      <Sparkles className="h-3.5 w-3.5 text-cyan-200 transition-transform duration-300 group-hover:rotate-12" />
      <span>{labels[value]}</span>
      <ChevronDown className={cn("h-3.5 w-3.5 text-white/45 transition-transform duration-300", open && "rotate-180 text-cyan-100")} />
    </button>
    <AnimatePresence>
      {open && <motion.div role="listbox" aria-label="Choose LAM mode" initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -7, scale: .97, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }} exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -5, scale: .98, filter: "blur(6px)" }} transition={{ duration: .22, ease: [0.16, 1, 0.3, 1] }} className="lam-mode-sheet absolute left-0 top-[calc(100%+.55rem)] grid max-h-[min(25rem,65dvh)] w-[min(22rem,calc(100vw-2rem))] grid-cols-1 gap-1 overflow-y-auto rounded-[1.45rem] p-2 sm:grid-cols-2">
        <span className="lam-glass-reflection" aria-hidden="true" />
        {LAM_MODES.map((mode) => <button key={mode} type="button" role="option" aria-selected={mode === value} onClick={() => { onChange(mode); setOpen(false); }} className={cn("lam-mode-option relative flex min-h-12 items-center gap-2 rounded-2xl px-3 text-left text-xs text-white/68 outline-none transition-all duration-200 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-300/50", mode === value && "lam-mode-option--active text-white")}>
          <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/8 bg-white/5", mode === value && "border-cyan-200/25 bg-cyan-300/12 text-cyan-100")}><Sparkles className="h-3.5 w-3.5" /></span>
          <span className="min-w-0 flex-1 font-medium">{labels[mode]}</span>
          {mode === value && <Check className="h-3.5 w-3.5 text-cyan-200" />}
        </button>)}
      </motion.div>}
    </AnimatePresence>
  </div>;
}

