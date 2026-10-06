"use client";
import { useRef, type PointerEvent } from "react";
import { useStore } from "@/lib/store";
/** Local to the capsule, at most ten tiny CSS writes per second. No global tracking. */
export function useLamCursorAwareness() {
  const prefs = useStore(s => s.settings.lamIdentity);
  const last = useRef(0);
  const pointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!prefs.cursorAwareness || !prefs.animations || prefs.reducedMotion || event.pointerType !== "mouse" || window.innerWidth < 1024 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const now = performance.now(); if (now - last.current < 100) return; last.current = now;
    const avatar = event.currentTarget.querySelector<HTMLElement>("[data-lam-avatar]"); if (!avatar || avatar.dataset.still === "true") return;
    const box = event.currentTarget.getBoundingClientRect();
    avatar.style.setProperty("--lam-look-x", `${Math.max(-1.2, Math.min(1.2,(event.clientX - box.left - box.width / 2) / box.width * 2.4))}px`);
    avatar.style.setProperty("--lam-look-y", `${Math.max(-.8, Math.min(.8,(event.clientY - box.top - box.height / 2) / box.height * 1.6))}px`);
  };
  const pointerLeave = (event: PointerEvent<HTMLElement>) => { const avatar = event.currentTarget.querySelector<HTMLElement>("[data-lam-avatar]"); avatar?.style.removeProperty("--lam-look-x"); avatar?.style.removeProperty("--lam-look-y"); };
  return { pointerMove, pointerLeave };
}
