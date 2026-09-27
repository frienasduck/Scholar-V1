"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { GlassFilterDefs } from "./glass-filter";
import { setGlassPointerMotionAllowed } from "./glass-runtime";

export type GlassMaterialMode = "full" | "reduced" | "fallback";
export type GlassPointerMode = "fine" | "coarse";
export type GlassMotionMode = "full" | "reduced";

export interface GlassRuntimeState {
  /** How much material fidelity the device can afford. */
  material: GlassMaterialMode;
  /** Whether the shared SVG refraction is drawn through backdrops. */
  refraction: boolean;
  pointer: GlassPointerMode;
  motion: GlassMotionMode;
}

const DEFAULT_STATE: GlassRuntimeState = {
  material: "full",
  refraction: false,
  pointer: "fine",
  motion: "full",
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

/**
 * Chooses the cheapest material profile that still looks like Scholar.
 * This is a local rendering decision only — nothing is measured or reported.
 */
export function detectGlassRuntime(): GlassRuntimeState {
  if (typeof window === "undefined") return DEFAULT_STATE;

  const reducedMotion = matches("(prefers-reduced-motion: reduce)");
  const reducedTransparency = matches("(prefers-reduced-transparency: reduce)");
  const coarse = matches("(pointer: coarse)");
  const noHover = matches("(hover: none)");
  const compact = window.innerWidth < 768;
  const backdrop = supportsBackdrop();

  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const isFirefox = /firefox|fxios/i.test(ua);
  const isWebKitOnly = /safari/i.test(ua) && !/chrome|chromium|crios|edg|opr/i.test(ua);
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
  const refraction = material === "full" && !coarse && !noHover && !isFirefox && !isWebKitOnly && !(lowCores && compact);

  return {
    material,
    refraction,
    pointer: coarse || noHover ? "coarse" : "fine",
    motion: reducedMotion ? "reduced" : "full",
  };
}

function applyToDocument(state: GlassRuntimeState): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.sgMaterial = state.material;
  root.dataset.sgRefraction = state.refraction ? "on" : "off";
  root.dataset.sgPointer = state.pointer;
  root.dataset.sgMotion = state.motion;

  setGlassPointerMotionAllowed(
    state.material !== "fallback" && state.pointer === "fine" && state.motion !== "reduced",
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

    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = detectGlassRuntime();
        applyToDocument(next);
        setState((previous) =>
          previous.material === next.material &&
          previous.refraction === next.refraction &&
          previous.pointer === next.pointer &&
          previous.motion === next.motion
            ? previous
            : next,
        );
      });
    };

    sync();

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
      if (!document.hidden) sync();
    };
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(resizeTimer);
      mediaListeners.forEach((off) => off());
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      setGlassPointerMotionAllowed(false);
    };
  }, []);

  const value = useMemo(() => state, [state]);

  return (
    <GlassContext.Provider value={value}>
      <GlassFilterDefs />
      {children}
    </GlassContext.Provider>
  );
}
