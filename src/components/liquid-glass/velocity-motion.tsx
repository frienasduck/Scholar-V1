"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject, type Ref } from "react";
import { animate, createScope, createTimeline, spring, stagger } from "animejs";
import { waapi } from "animejs/waapi";
import { velocityMotionAllowed, VELOCITY_TIMING, VELOCITY_CONTROL_SELECTOR } from "@/lib/animation/velocity-policy";
import { registerGlassSurface } from "./glass-runtime";

function observeMotionStop(revert: () => void, kind: "page" | "panel") {
  const stop = () => { if (!velocityMotionAllowed(kind)) revert(); };
  const preferences = new MutationObserver(stop);
  preferences.observe(document.documentElement, { attributes: true, attributeFilter: ["data-sg-motion", "data-reduce-motion", "data-appearance-motion", "data-appearance-page-transitions", "data-appearance-panel-transitions", "data-appearance-content-reveal"] });
  document.addEventListener("visibilitychange", stop);
  return () => { preferences.disconnect(); document.removeEventListener("visibilitychange", stop); };
}

export function connectVelocityRef(ref: Ref<HTMLDivElement> | undefined, node: HTMLDivElement | null) {
  const cleanup = typeof ref === "function" ? ref(node) : undefined;
  if (ref && typeof ref === "object") ref.current = node;
  return () => {
    if (typeof cleanup === "function") cleanup();
    else if (typeof ref === "function") ref(null);
    else if (ref) ref.current = null;
  };
}

/** A single bounded entry per workspace, not per-card scroll observers. */
export function useVelocityReveal() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = root.current;
    if (!node || !velocityMotionAllowed("page") || document.documentElement.dataset.appearanceContentReveal === "false") return;
    const scope = createScope({ root: node }).add(() => {
      animate([...node.querySelectorAll<HTMLElement>('[data-velocity-reveal]')].slice(0, 10), {
        opacity: [0.8, 1], y: [5, 0], duration: 180, delay: stagger(18), ease: "out(3)",
      });
    });
    const stop = observeMotionStop(() => scope.revert(), "page");
    return () => { stop(); scope.revert(); };
  }, []);
  return root;
}

/** One persistent lens. React selects; Anime owns geometry; no state per frame. */
export type NavigationLensBox = { x: number; y: number; width: number; height: number };
export type NavigationLensControl = { track: (box: NavigationLensBox) => void; settle: (target?: HTMLElement) => void };

export function useNavigationLens(root: RefObject<HTMLElement | null>, selected: string, axis: "x" | "y", interactionRef?: RefObject<NavigationLensControl | null>) {
  const lens = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const host = root.current, node = lens.current;
    if (!host || !node) return;
    let pending = 0, initialized = false, tracking = false;
    let animation: ReturnType<typeof animate> | undefined;
    const scope = createScope({ root: host });
    const place = (smooth: boolean, override?: HTMLElement) => {
      if (tracking) return;
      const target = override ?? host.querySelector<HTMLElement>('[aria-current="page"], [data-state="active"]');
      if (!target) { node.style.opacity = "0"; return; }
      // Complete all geometry reads before writes. Resize/scroll is one RAF.
      const a = host.getBoundingClientRect(), b = target.getBoundingClientRect();
      const x = b.left - a.left + host.scrollLeft, y = b.top - a.top + host.scrollTop;
      animation?.cancel();
      node.style.opacity = "1";
      if (!smooth || !initialized || !velocityMotionAllowed()) {
        node.style.willChange = "";
        Object.assign(node.style, { transform: `translate(${x}px, ${y}px)`, width: `${b.width}px`, height: `${b.height}px` });
      } else {
        node.style.willChange = "transform";
        animation = scope.execute(() => animate(node, {
          x, y, width: b.width, height: b.height,
          duration: VELOCITY_TIMING.navigation, ease: "out(4)",
          onComplete: () => { node.style.willChange = ""; },
        }));
      }
      initialized = true;
    };
    // The same geometry owner handles direct manipulation and release. A drag
    // never fights a second transform/CSS-offset animation or updates React.
    const interaction: NavigationLensControl = {
      track: ({ x, y, width, height }) => {
        tracking = true; animation?.cancel();
        node.style.willChange = "transform";
        Object.assign(node.style, { opacity: "1", transform: `translate(${x}px, ${y}px)`, width: `${width}px`, height: `${height}px` });
      },
      settle: (target) => { tracking = false; place(true, target); },
    };
    if (interactionRef) interactionRef.current = interaction;
    const schedule = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(() => place(false)); };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(host);
    host.querySelectorAll<HTMLElement>('[aria-current="page"], [data-state="active"]').forEach(el => observer?.observe(el));
    const mutations = new MutationObserver(() => place(true));
    mutations.observe(host, { subtree: true, attributes: true, attributeFilter: ["aria-current", "data-state"] });
    const preferences = new MutationObserver(schedule);
    preferences.observe(document.documentElement, { attributes: true, attributeFilter: ["data-sg-motion", "data-reduce-motion", "data-font-scale"] });
    const stop = () => { if (document.hidden) { animation?.cancel(); node.style.willChange = ""; } else schedule(); };
    host.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    document.addEventListener("visibilitychange", stop);
    const off = registerGlassSurface(node, { elasticity: 0, pointer: false, priority: axis === "x" ? 100 : 80 });
    place(false);
    return () => { if (interactionRef?.current === interaction) interactionRef.current = null; cancelAnimationFrame(pending); animation?.cancel(); scope.revert(); observer?.disconnect(); mutations.disconnect(); preferences.disconnect(); off(); host.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); document.removeEventListener("visibilitychange", stop); node.style.willChange = ""; };
    // Selection is observed on the stable DOM; this effect must not rebuild the lens on each selection.
  }, [root, axis, interactionRef]);
  // selected intentionally stays a render-level dependency of the parent only.
  void selected;
  return lens;
}

export function NavigationLens({ lensRef, axis }: { lensRef: RefObject<HTMLSpanElement | null>; axis: "x" | "y" }) {
  return <span ref={lensRef} className="sg-velocity-lens" data-axis={axis} aria-hidden="true"><span className="sg-velocity-lens-optic" /></span>;
}

/** Anime alone owns sidebar width; the rail stays mounted so selection and
 * keyboard focus survive collapse. No app-wide FLIP measurements are needed. */
export function VelocitySidebar({ expanded, reduced, children }: { expanded: boolean; reduced: boolean; children: ReactNode }) {
  const root = useRef<HTMLElement>(null);
  const [initialWidth] = useState(expanded ? 256 : 76);
  const mounted = useRef(false);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const width = expanded ? 256 : 76;
    const scope = createScope({ root: node });
    const immediate = () => { scope.revert(); node.style.width = `${width}px`; node.style.willChange = ""; };
    if (!mounted.current || reduced || !velocityMotionAllowed("panel")) immediate();
    else {
      node.style.willChange = "width";
      scope.execute(() => animate(node, { width, duration: 300, ease: "out(3)", onComplete: () => { node.style.willChange = ""; } }));
    }
    mounted.current = true;
    const off = observeMotionStop(immediate, "panel");
    return () => {
      const currentWidth = node.getBoundingClientRect().width;
      off(); scope.revert(); node.style.width = `${currentWidth}px`; node.style.willChange = "";
    };
  }, [expanded, reduced]);
  return <aside ref={root} id="scholar-desktop-navigation" data-sg-chrome="sidebar" data-sidebar-expanded={expanded}
    className="scholar-desktop-sidebar sg-navigation-shell hidden lg:flex shrink-0 flex-col sticky top-0 h-dvh overflow-hidden z-30 relative"
    style={{ width: initialWidth }}>{children}</aside>;
}

/** Content is never held for an exit animation or hidden until an observer fires. */
export function VelocityPage({ children, className, enabled = true }: { children: ReactNode; className?: string; enabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled || !velocityMotionAllowed("page")) return;
    const scope = createScope({ root: node }).add(() => {
      const timeline = createTimeline({ defaults: { ease: "out(3)", duration: VELOCITY_TIMING.page } });
      // Only this wrapper is owned here. Existing feature animations retain ownership.
      timeline.add(node, { opacity: [0.72, 1], y: [4, 0] }, 0);
    });
    const stop = observeMotionStop(() => scope.revert(), "page");
    return () => { stop(); scope.revert(); };
  }, [enabled]);
  return <div ref={ref} className={className} data-velocity-page="true">{children}</div>;
}

/** Narrow portal entry, composable with Radix focus management and exit CSS. */
export function useVelocityPanel(forwardedRef?: Ref<HTMLDivElement>) {
  return useCallback((node: HTMLDivElement | null) => {
    const releaseRef = connectVelocityRef(forwardedRef, node);
    if (!node || !velocityMotionAllowed("panel")) return releaseRef;
    const scope = createScope({ root: node }).add(() => {
      // Individual translate/scale preserve Radix's positional transform.
      const entry = waapi.animate(node, { opacity: [0.6, 1], scale: [0.965, 1], duration: VELOCITY_TIMING.panel, ease: "out(3)" });
      const items = [...node.querySelectorAll<HTMLElement>('[role="menuitem"], [data-slot="dialog-header"]')].slice(0, 8);
      if (items.length) animate(items, { opacity: [0.7, 1], duration: 130, delay: stagger(12) });
      return () => entry.revert();
    });
    const stop = () => { if (document.hidden || !velocityMotionAllowed("panel")) scope.revert(); };
    const preferences = new MutationObserver(stop);
    preferences.observe(document.documentElement, { attributes: true, attributeFilter: ["data-sg-motion", "data-reduce-motion", "data-appearance-panel-transitions"] });
    document.addEventListener("visibilitychange", stop);
    return () => { scope.revert(); preferences.disconnect(); document.removeEventListener("visibilitychange", stop); releaseRef(); };
  }, [forwardedRef]);
}

/** One delegated press system, no per-button listeners or React pointer state. */
export function VelocityInteractions() {
  useEffect(() => {
    const running = new Map<HTMLElement, ReturnType<typeof waapi.animate>>();
    let pressed: HTMLElement | null = null;
    const cancel = (node: HTMLElement) => { running.get(node)?.revert(); running.delete(node); node.style.willChange = ""; };
    const reset = () => { pressed = null; [...running.keys()].forEach(cancel); };
    const targetControl = (target: EventTarget | null) => {
      const node = target instanceof Element ? target.closest<HTMLElement>(VELOCITY_CONTROL_SELECTOR) : null;
      return !node || node.matches(':disabled, [aria-disabled="true"], [aria-busy="true"]') || node.closest('[data-velocity-press="off"], [inert]') ? null : node;
    };
    const press = (node: HTMLElement | null) => {
      reset();
      if (!node || !velocityMotionAllowed()) return;
      pressed = node;
      const instance = waapi.animate(node, { scale: 0.965, duration: VELOCITY_TIMING.press, ease: "out(2)" });
      running.set(node, instance);
    };
    const down = (event: PointerEvent) => { if (event.isPrimary && event.button === 0) press(targetControl(event.target)); };
    const up = () => {
      const node = pressed; pressed = null;
      if (!node) return;
      cancel(node);
      if (!node.isConnected || !velocityMotionAllowed()) return;
      const instance = waapi.animate(node, { scale: [0.965, 1], ease: spring({ bounce: 0.08, duration: VELOCITY_TIMING.release }), onComplete: () => { if (running.get(node) === instance) cancel(node); } });
      running.set(node, instance);
    };
    const keydown = (event: KeyboardEvent) => { if (!event.repeat && (event.key === " " || event.key === "Enter")) press(targetControl(event.target)); };
    const keyup = (event: KeyboardEvent) => { if (event.key === " " || event.key === "Enter") up(); };
    const preferences = new MutationObserver(() => { if (!velocityMotionAllowed()) reset(); });
    preferences.observe(document.documentElement, { attributes: true, attributeFilter: ["data-sg-motion", "data-reduce-motion", "data-appearance-motion"] });
    document.addEventListener("pointerdown", down, { passive: true });
    document.addEventListener("pointerup", up, { passive: true });
    document.addEventListener("pointercancel", reset, { passive: true });
    document.addEventListener("keydown", keydown);
    document.addEventListener("keyup", keyup);
    document.addEventListener("visibilitychange", reset);
    window.addEventListener("blur", reset);
    window.addEventListener("scholar:motion-boundary", reset);
    return () => { reset(); preferences.disconnect(); document.removeEventListener("pointerdown", down); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", reset); document.removeEventListener("keydown", keydown); document.removeEventListener("keyup", keyup); document.removeEventListener("visibilitychange", reset); window.removeEventListener("blur", reset); window.removeEventListener("scholar:motion-boundary", reset); };
  }, []);
  return null;
}
