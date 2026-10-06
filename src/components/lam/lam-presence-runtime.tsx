"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { canLamPeek, getLamPresence, getLamSession, recordLamPeek, setLamEnvironment, LAM_PEEK_COOLDOWN, configureLamBehavior, startLamSession, stopLamSession, tickLamBehavior, noteLamInteraction, setLamContext, reactLam } from "@/lib/lam/presence";
import { LamAvatar } from "./lam-avatar";
import styles from "./lam-identity.module.css";

/** Exactly one session scheduler. Pointer awareness stays on the Ask LAM trigger. */
export function LamPresenceRuntime({ page }: { page: string }) {
  const prefs = useStore(s => s.settings.lamIdentity);
  const reduce = useStore(s => s.settings.reduceMotion || s.settings.appearance.accessibility.reduceMotion || s.settings.appearance.performance === "battery");
  const [peek, setPeek] = useState<{ top: number; side: "left" | "right"; variant: number } | null>(null);
  const lastPeek = useRef(Date.now());
  const lastInteraction = useRef(Date.now());
  const lastPublishedInteraction = useRef(0);
  const visiblePeek = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { startLamSession(); return stopLamSession; }, []);
  useEffect(() => { configureLamBehavior(prefs); }, [prefs]);
  useEffect(() => { setLamContext(page); }, [page]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/lam/identity", { signal: controller.signal }).then(r => r.ok ? r.json() : null).then(v => { if (!controller.signal.aborted && typeof v?.enabled === "boolean") setLamEnvironment({ enabled: v.enabled }); }).catch(() => undefined);
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      const hidden = document.hidden;
      setLamEnvironment({ hidden, reduced: reduce || prefs.reducedMotion || query.matches });
      if (hidden || reduce || prefs.reducedMotion || query.matches) setPeek(null);
      else noteLamInteraction();
    };
    update(); document.addEventListener("visibilitychange", update);
    query.addEventListener?.("change", update);
    return () => { document.removeEventListener("visibilitychange", update); query.removeEventListener?.("change", update); };
  }, [reduce, prefs.reducedMotion]);
  useEffect(() => {
    setPeek(null); visiblePeek.current = false;
    const interact = (event?: Event) => {
      if ((event?.target as Element | null)?.closest?.("[data-lam-peek]")) return;
      const now = Date.now();
      lastInteraction.current = now;
      // Preserve the latest quiet-time boundary, but don't sort every owner on
      // each nested scroll event. Direct input remains immediate.
      if (event?.type !== "scroll" || now - lastPublishedInteraction.current >= 200) {
        lastPublishedInteraction.current = now; noteLamInteraction(now);
      }
      if (visiblePeek.current) setPeek(null);
      visiblePeek.current = false;
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
    const editing = () => document.activeElement?.matches("input,textarea,select,[contenteditable='true'],[role='textbox']") ?? false;
    const attempt = (test = false) => {
      const p = getLamPresence(), now = Date.now(), session = getLamSession();
      // Eligibility first: on mobile, during a cooldown or while busy there is
      // no reason to query dialogs, focus, hit-test margins or read geometry.
      const context = { enabled: p.enabled && !p.sessionMuted && prefs.animations && prefs.ambient && prefs.peeks, hidden: p.hidden, reduced: p.reduced, busy: p.busy, blocked: p.blocked, typing: false, dialog: false, fullscreen: false, width: window.innerWidth, height: window.innerHeight, page, quietFor: test ? 20_000 : now - lastInteraction.current, sincePeek: test ? LAM_PEEK_COOLDOWN : now - Math.max(lastPeek.current,session.lastPeek), count: session.peekCount, presence: prefs.presence, urgency: p.urgency };
      if (visiblePeek.current || !canLamPeek(context) || editing() || document.fullscreenElement || document.querySelector("[role='dialog'],[aria-modal='true'],[data-scholar-notifications],.music-mini-player")) return;
      // Only use a real empty margin, never a card or a control.
      const sides = session.peekCount % 2 ? ["left", "right"] as const : ["right", "left"] as const;
      for (const side of sides) {
        const y = [window.innerHeight * .45, window.innerHeight * .6, window.innerHeight * .3].find(y => {
          for (const px of side === "right" ? [window.innerWidth - 76, window.innerWidth - 30] : [30,76]) for (const py of [y - 40,y,y + 40]) {
            if (document.elementsFromPoint(px, py).some(el => el.matches("button,a,input,textarea,select,nav,header,footer,article,canvas,iframe,[role='dialog'],[role='alert'],[role='status'],[data-lam-scene]") || /(?:card|plate|toast|notification|player|sidebar)/i.test(el.className?.toString() ?? ""))) return false;
          }
          return true;
        });
        if (y === undefined) continue;
        lastPeek.current = now; visiblePeek.current = true; recordLamPeek(now); setPeek({ top: y - 41, side, variant: session.peekCount % 3 });
        hideTimer.current = setTimeout(() => { visiblePeek.current = false; setPeek(null); }, 4800); break;
      }
    };
    const testPeek = () => attempt(true);
    let checks = 0;
    const timer = setInterval(() => { if (!document.hidden) { tickLamBehavior(); if (++checks % 3 === 0) attempt(); } }, 5000);
    const debug = (event: Event) => { const state = (event as CustomEvent<string>).detail; if (["sleeping", "sleepy", "wake", "success", "thinking"].includes(state)) reactLam("debug", state as "sleeping", "normal"); };
    window.addEventListener("pointerdown", interact, { passive: true });
    window.addEventListener("keydown", interact);
    // Scholar scrolls inside #main-scroll. Capture catches nested scrolling too.
    window.addEventListener("scroll", interact, { passive: true, capture: true });
    if (process.env.NODE_ENV === "development") { window.addEventListener("scholar:lam-test-peek", testPeek); window.addEventListener("scholar:lam-test-state", debug); }
    return () => { clearInterval(timer); if (hideTimer.current) clearTimeout(hideTimer.current); window.removeEventListener("pointerdown", interact); window.removeEventListener("keydown", interact); window.removeEventListener("scroll", interact, true); window.removeEventListener("scholar:lam-test-peek", testPeek); window.removeEventListener("scholar:lam-test-state", debug); };
  }, [page, prefs.animations, prefs.ambient, prefs.peeks, prefs.presence]);
  return peek === null ? null : <button type="button" className={styles.peek} data-lam-peek data-side={peek.side} data-variant={peek.variant} style={{ top: peek.top }} aria-label="Open Ask LAM from the edge" onPointerEnter={() => { if (peek.variant === 0) { visiblePeek.current = false; setPeek(null); } }} onClick={() => { noteLamInteraction(Date.now(), true); visiblePeek.current = false; setPeek(null); window.dispatchEvent(new CustomEvent("scholar:open-lam", { detail: {} })); }}><LamAvatar size={82} placement="ambient" state={peek.variant === 2 ? "wave" : peek.side === "left" ? "peek_left" : "peek_right"}/></button>;
}
