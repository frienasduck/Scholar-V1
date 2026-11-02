/** Shared, synchronous motion policy. It is safe before provider hydration. */
export function velocityMotionAllowed(kind: "page" | "interaction" | "panel" = "interaction"): boolean {
  if (typeof window === "undefined" || document.hidden) return false;
  const data = document.documentElement.dataset;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || data.reduceMotion === "true" || data.sgMotion === "reduced" || data.appearanceMotion === "off") return false;
  if (kind === "page" && (data.appearancePageTransitions === "false" || data.pageTransitions === "false")) return false;
  if (kind === "panel" && data.appearancePanelTransitions === "false") return false;
  return true;
}

export const VELOCITY_TIMING = Object.freeze({ press: 85, release: 200, page: 170, panel: 180, navigation: 310 });

/** Stable degradation: require two bad windows; never upgrade in the same mount. */
export function nextVelocityQuality(current: "high" | "balanced" | "lightweight", badWindows: number) {
  return badWindows < 2 ? current : current === "high" ? "balanced" : "lightweight";
}
