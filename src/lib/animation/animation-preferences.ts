export type ScholarAnimationQuality = "desktop-high" | "mobile-optimized" | "reduced-motion";

type AnimationPreferenceOptions = {
  reduceMotion?: boolean;
  forceQuality?: ScholarAnimationQuality;
};

type NavigatorWithHints = Navigator & {
  deviceMemory?: number;
  hardwareConcurrency?: number;
};

export function resolveScholarAnimationQuality(
  options: AnimationPreferenceOptions = {},
): ScholarAnimationQuality {
  if (options.reduceMotion) return "reduced-motion";
  if (typeof window === "undefined") return "desktop-high";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "reduced-motion";
  if (options.forceQuality) return options.forceQuality;

  const navigatorHints = navigator as NavigatorWithHints;
  const narrowViewport = window.matchMedia("(max-width: 767px)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const constrainedMemory = typeof navigatorHints.deviceMemory === "number" && navigatorHints.deviceMemory <= 4;
  const constrainedCpu = typeof navigatorHints.hardwareConcurrency === "number" && navigatorHints.hardwareConcurrency <= 4;

  return narrowViewport || coarsePointer || constrainedMemory || constrainedCpu
    ? "mobile-optimized"
    : "desktop-high";
}

export function animationDuration(
  quality: ScholarAnimationQuality,
  desktopMs: number,
  mobileMs = Math.round(desktopMs * 0.82),
  reducedMs = Math.min(120, Math.round(desktopMs * 0.32)),
) {
  if (quality === "reduced-motion") return reducedMs;
  if (quality === "mobile-optimized") return mobileMs;
  return desktopMs;
}

export function shouldRunDecorativeAnimation(quality: ScholarAnimationQuality) {
  return quality !== "reduced-motion" && typeof document !== "undefined" && document.visibilityState === "visible";
}
