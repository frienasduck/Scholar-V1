"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import { animateGlassDropdown, animateLamModeSelection } from "@/lib/animation/lam-animations";
import { resolveScholarAnimationQuality } from "@/lib/animation/animation-preferences";
import { cn } from "@/lib/utils";
import { LAM_MODES, type LamMode } from "@/lib/lam/types";

type MenuPosition = { left: number; top: number; width: number };

export function GlassModeMenu({ value, labels, onChange, reducedMotion = false }: {
  value: LamMode;
  labels: Record<LamMode, string>;
  onChange: (mode: LamMode) => void;
  reducedMotion?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ left: 12, top: 72, width: 352 });
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const quality = useMemo(() => resolveScholarAnimationQuality({ reduceMotion: reducedMotion }), [reducedMotion]);

  const updatePosition = useCallback(() => {
    const trigger = rootRef.current?.getBoundingClientRect();
    if (!trigger) return;
    const mobile = window.innerWidth <= 640;
    const width = mobile ? Math.max(0, window.innerWidth - 24) : Math.min(352, window.innerWidth - 24);
    const left = mobile ? 12 : Math.min(Math.max(12, trigger.left), Math.max(12, window.innerWidth - width - 12));
    const top = Math.min(trigger.bottom + 9, Math.max(12, window.innerHeight - Math.min(400, window.innerHeight * 0.65) - 12));
    setPosition({ left, top, width });
  }, []);

  const showMenu = useCallback(() => {
    updatePosition();
    setMounted(true);
    setOpen(true);
  }, [updatePosition]);
  const hideMenu = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) hideMenu();
    };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") hideMenu(); };
    document.addEventListener("pointerdown", close);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", key);
    };
  }, [hideMenu]);

  useEffect(() => {
    if (!mounted) return;
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [mounted, updatePosition]);

  useLayoutEffect(() => {
    if (!mounted || !menuRef.current) return;
    return animateGlassDropdown(
      menuRef.current,
      optionRefs.current.filter((item): item is HTMLButtonElement => Boolean(item)),
      open ? "open" : "close",
      quality,
      open ? undefined : () => setMounted(false),
    );
  }, [mounted, open, quality]);

  useEffect(() => {
    if (!mounted) return;
    const selected = optionRefs.current[LAM_MODES.indexOf(value)];
    if (!selected) return;
    return animateLamModeSelection(selected, quality);
  }, [mounted, quality, value]);

  const focusOption = (index: number) => {
    const next = (index + LAM_MODES.length) % LAM_MODES.length;
    optionRefs.current[next]?.focus();
  };

  const menu = mounted && typeof document !== "undefined"
    ? createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-label="Choose LAM mode"
          data-quality={quality}
          onKeyDown={(event) => {
            const current = optionRefs.current.findIndex((item) => item === document.activeElement);
            if (event.key === "ArrowDown" || event.key === "ArrowRight") { event.preventDefault(); focusOption(current + 1); }
            else if (event.key === "ArrowUp" || event.key === "ArrowLeft") { event.preventDefault(); focusOption(current - 1); }
            else if (event.key === "Home") { event.preventDefault(); focusOption(0); }
            else if (event.key === "End") { event.preventDefault(); focusOption(LAM_MODES.length - 1); }
          }}
          className="lam-mode-sheet fixed z-[10050] grid max-h-[min(25rem,65dvh)] grid-cols-1 gap-1 overflow-y-auto rounded-[1.45rem] p-2 sm:grid-cols-2"
          style={{
            left: position.left,
            top: position.top,
            width: position.width,
            ...(quality === "mobile-optimized" ? {
              background: "radial-gradient(80% 70% at 5% 0%, rgb(34 211 238 / .1), transparent 48%), rgb(8 12 22 / .98)",
              backdropFilter: "none",
              WebkitBackdropFilter: "none",
              boxShadow: "inset 0 1px 0 rgb(255 255 255 / .13), 0 18px 45px rgb(0 0 0 / .46)",
            } : {}),
          }}
        >
          <span className="lam-glass-reflection" aria-hidden="true" />
          {LAM_MODES.map((mode, index) => <button ref={(node) => { optionRefs.current[index] = node; }} key={mode} type="button" role="option" aria-selected={mode === value} onClick={() => { onChange(mode); hideMenu(); }} className={cn("lam-mode-option relative flex min-h-12 items-center gap-2 rounded-2xl px-3 text-left text-xs text-white/68 outline-none transition-all duration-200 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-300/50", mode === value && "lam-mode-option--active text-white")}>
            <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/8 bg-white/5", mode === value && "border-cyan-200/25 bg-cyan-300/12 text-cyan-100")}><Sparkles className="h-3.5 w-3.5" /></span>
            <span className="min-w-0 flex-1 font-medium">{labels[mode]}</span>
            {mode === value && <Check className="h-3.5 w-3.5 text-cyan-200" />}
          </button>)}
        </div>,
        document.body,
      )
    : null;

  return <div ref={rootRef} className="relative z-30 shrink-0">
    <button type="button" aria-label="LAM mode" aria-haspopup="listbox" aria-expanded={open} onClick={() => open ? hideMenu() : showMenu()} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); showMenu(); window.setTimeout(() => focusOption(Math.max(0, LAM_MODES.indexOf(value))), 0); } }} className="lam-mode-trigger group flex min-h-9 items-center gap-2 rounded-full px-3 text-xs font-semibold text-white/90 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60">
      <Sparkles className="h-3.5 w-3.5 text-cyan-200 transition-transform duration-300 group-hover:rotate-12" />
      <span>{labels[value]}</span>
      <ChevronDown className={cn("h-3.5 w-3.5 text-white/45 transition-transform duration-300", open && "rotate-180 text-cyan-100")} />
    </button>
    {menu}
  </div>;
}
