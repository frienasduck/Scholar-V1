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

/** Audited families only. Never a blanket `main button` rule: answer text,
 * calendar grids, flip cards and Framer-owned choices retain their ownership. */
export const VELOCITY_CONTROL_SELECTOR = [
  '[data-slot="button"]', '.sg-button', '[data-velocity-control]',
  '.scholar-bottom-nav > button', '[data-slot="tabs-trigger"]',
  '[data-slot="dialog-close"]', '[data-slot="dropdown-menu-trigger"]',
  '[data-slot="accordion-trigger"]', '[data-slot="collapsible-trigger"]',
  '.ccc-primary', '.ccc-secondary', '.ccc-mode', '.ccc-mode-arrow', '.ccc-action', '.ccc-text-action',
  '.er-primary', '.er-secondary-toolbar', '.er-icon-button', '.er-mobile-context-action',
  '.er-segments > button', '.er-quick-actions > button', '.er-tools-tabs > button',
  '.eb-reader-tools > button', '.lam-mini-composer > button',
].join(', ');

/** Stable degradation: require two bad windows; never upgrade in the same mount. */
export function nextVelocityQuality(current: "high" | "balanced" | "lightweight", badWindows: number) {
  return badWindows < 2 ? current : current === "high" ? "balanced" : "lightweight";
}
