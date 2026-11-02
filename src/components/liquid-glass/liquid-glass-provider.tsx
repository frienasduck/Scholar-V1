"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { GlassFilterDefs } from "./glass-filter";
import { setGlassPointerMotionAllowed, setGlassOpticalBudget } from "./glass-runtime";
import { nextVelocityQuality } from "@/lib/animation/velocity-policy";
import { VelocityInteractions } from "./velocity-motion";

export type GlassMaterialMode = "full" | "reduced" | "fallback";
export type GlassPointerMode = "fine" | "coarse";
export type GlassMotionMode = "full" | "reduced";
export type GlassQuality = "high" | "balanced" | "lightweight";

export interface GlassRuntimeState {
  /** How much material fidelity the device can afford. */
  material: GlassMaterialMode;
  /** Whether the shared SVG refraction is drawn through backdrops. */
  refraction: boolean;
  pointer: GlassPointerMode;
  motion: GlassMotionMode;
  quality: GlassQuality;
}

const DEFAULT_STATE: GlassRuntimeState = {
  material: "full",
  refraction: false,
  pointer: "fine",
  motion: "full",
  quality: "balanced",
};

const GlassContext = createContext<GlassRuntimeState>(DEFAULT_STATE);

/**
 * True liquid glass runtime state for the whole product.
 * Components read this when they need to choose between a Tier 1 refractive
 * surface and its Tier 2 equivalent — but visual fallback is handled in CSS,
 * so usability never depends on this hook resolving.
 */
export function useGlassRuntime(): GlassRuntimeState {
  return useContext(GlassContext);
}

function matches(query: string): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia(query).matches;
  } catch {
    return false;
  }
}

function supportsBackdrop(): boolean {
  if (typeof window === "undefined" || typeof CSS === "undefined" || typeof CSS.supports !== "function") return false;
  try {
    return (
      CSS.supports("backdrop-filter", "blur(2px)") ||
      CSS.supports("-webkit-backdrop-filter", "blur(2px)")
    );
  } catch {
    return false;
  }
}

/** CSS.supports checks syntax, not rendering. All iOS browsers use WebKit. */
export function supportsSvgBackdrop(userAgent: string, touchMac = false): boolean {
  return /Chrome|Chromium|Edg\//i.test(userAgent) && !/iPhone|iPad|iPod|FxiOS|Firefox/i.test(userAgent) && !touchMac;
}

/**
 * Chooses the cheapest material profile that still looks like Scholar.
 * This is a local rendering decision only — nothing is measured or reported.
 */
export function detectGlassRuntime(): GlassRuntimeState {
  if (typeof window === "undefined") return DEFAULT_STATE;

  const prefs = document.documentElement.dataset;
  const reducedMotion = matches("(prefers-reduced-motion: reduce)") || prefs.reduceMotion === "true" || prefs.appearanceMotion === "off";
  const reducedTransparency = matches("(prefers-reduced-transparency: reduce)") || prefs.appearanceGlass === "off" || prefs.highContrast === "true";
  const coarse = matches("(pointer: coarse)");
  const noHover = matches("(hover: none)");
  const compact = window.innerWidth < 768;
  const backdrop = supportsBackdrop();

  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const touchMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const nav = typeof navigator === "undefined" ? undefined : (navigator as Navigator & { deviceMemory?: number });
  const lowMemory = typeof nav?.deviceMemory === "number" && nav.deviceMemory <= 4;
  const lowCores = typeof navigator !== "undefined" && navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4;

  // Browser memory hints are deliberately advisory. A 4 GB laptop with a
  // mouse is still capable of the desktop material; only combine those hints
  // with a compact viewport before reducing the compositor budget.
  const constrainedCompactDevice = compact && (lowMemory || lowCores);

  const material: GlassMaterialMode =
    !backdrop || reducedTransparency
      ? "fallback"
      : (coarse && compact) || constrainedCompactDevice
        ? "reduced"
        : "full";

  // Safari and Firefox do not render SVG filters through backdrop-filter.
  // Scholar never makes usability depend on refraction, so we simply stop
  // asking the compositor to do the work.
  const lightweight = prefs.appearancePerformance === "performance" || prefs.appearancePerformance === "battery";
  // One compact lens may refract on capable touch Chromium. Never enable the
  // desktop pointer-following system on touch or infer performance from UA.
  const refraction = material !== "fallback" && !lightweight && supportsSvgBackdrop(ua, touchMac) && !(lowCores && lowMemory);

  return {
    material,
    refraction,
    pointer: coarse || noHover ? "coarse" : "fine",
    motion: reducedMotion ? "reduced" : "full",
    quality: lightweight || reducedTransparency ? "lightweight" : material === "reduced" || reducedMotion || prefs.appearancePerformance === "balanced" ? "balanced" : "high",
  };
}

function applyToDocument(state: GlassRuntimeState): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.sgMaterial = state.material;
  root.dataset.sgRefraction = state.refraction ? "on" : "off";
  root.dataset.sgPointer = state.pointer;
  root.dataset.sgMotion = state.motion;
  root.dataset.sgQuality = state.quality;
  setGlassOpticalBudget(state.refraction, state.quality === "high" ? 6 : state.quality === "balanced" ? (state.pointer === "coarse" ? 1 : 2) : 0);

  setGlassPointerMotionAllowed(
    state.material !== "fallback" && state.quality !== "lightweight" && state.pointer === "fine" && state.motion !== "reduced" && document.documentElement.dataset.appearancePointer !== "off",
  );
}

/**
 * Global glass runtime. Mounted once, at the application shell.
 *
 * Renders the shared SVG filter definitions and publishes device capability
 * flags as `data-sg-*` attributes on `<html>` so the entire CSS material system
 * can degrade in one place instead of per component.
 */
export function ScholarGlassProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GlassRuntimeState>(DEFAULT_STATE);

  useEffect(() => {
    let frame = 0;
    let measuredQuality: GlassQuality = "high";
    let sampleFrame = 0, lastSample = 0, cooldown = 0, samples = 0, slow = 0, badWindows = 0;

    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = detectGlassRuntime();
        const rank = { high: 2, balanced: 1, lightweight: 0 };
        if (rank[measuredQuality] < rank[next.quality]) next.quality = measuredQuality;
        if (next.quality === "lightweight") { next.refraction = false; next.material = next.material === "fallback" ? "fallback" : "reduced"; }
        applyToDocument(next);
        setState((previous) =>
          previous.material === next.material &&
          previous.refraction === next.refraction &&
          previous.pointer === next.pointer &&
          previous.motion === next.motion
          && previous.quality === next.quality
            ? previous
            : next,
        );
      });
    };

    sync();

    // A bounded interaction-triggered sample, never an idle/background FPS loop.
    // Two bad 90-frame windows are required; quality only steps down this mount.
    const tick = (now: number) => {
      sampleFrame = 0;
      if (document.hidden) return;
      if (lastSample) { samples++; if (now - lastSample > 34) slow++; }
      lastSample = now;
      if (samples < 90) { sampleFrame = requestAnimationFrame(tick); return; }
      badWindows = slow / samples > 0.22 ? badWindows + 1 : 0;
      const next = nextVelocityQuality(measuredQuality, badWindows);
      if (next !== measuredQuality) { measuredQuality = next; badWindows = 0; sync(); }
    };
    const sample = () => {
      if (sampleFrame || document.hidden || performance.now() - cooldown < 5000 || measuredQuality === "lightweight") return;
      cooldown = performance.now(); lastSample = 0; samples = 0; slow = 0;
      sampleFrame = requestAnimationFrame(tick);
    };
    document.addEventListener("pointerdown", sample, { passive: true });
    const preferences = new MutationObserver(sync);
    preferences.observe(document.documentElement, { attributes: true, attributeFilter: ["data-reduce-motion", "data-high-contrast", "data-appearance-glass", "data-appearance-motion", "data-appearance-performance", "data-appearance-pointer"] });

    const queries = [
      "(prefers-reduced-motion: reduce)",
      "(prefers-reduced-transparency: reduce)",
      "(pointer: coarse)",
      "(hover: none)",
    ];
    const mediaListeners = queries.flatMap((query) => {
      if (typeof window.matchMedia !== "function") return [];
      const list = window.matchMedia(query);
      if (typeof list.addEventListener === "function") {
        list.addEventListener("change", sync);
        return [() => list.removeEventListener("change", sync)];
      }
      // Older Safari/WebViews expose the legacy listener API only.
      list.addListener(sync);
      return [() => list.removeListener(sync)];
    });

    // One debounced resize listener for the whole product.
    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(sync, 220);
    };
    window.addEventListener("resize", onResize, { passive: true });

    // Pause expensive visuals while the tab is hidden.
    const onVisibility = () => {
      document.documentElement.dataset.sgHidden = document.hidden ? "true" : "false";
      if (document.hidden) { cancelAnimationFrame(sampleFrame); sampleFrame = 0; }
      if (!document.hidden) sync();
    };
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(sampleFrame);
      preferences.disconnect();
      document.removeEventListener("pointerdown", sample);
      window.clearTimeout(resizeTimer);
      mediaListeners.forEach((off) => off());
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      setGlassPointerMotionAllowed(false);
      setGlassOpticalBudget(false, 0);
    };
  }, []);

  const value = useMemo(() => state, [state]);

  return (
    <GlassContext.Provider value={value}>
      <GlassFilterDefs />
      <VelocityInteractions />
      {children}
    </GlassContext.Provider>
  );
}
