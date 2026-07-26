import { animate, createTimeline, stagger, type JSAnimation, type Timeline } from "animejs";
import { animationDuration, type ScholarAnimationQuality } from "./animation-preferences";
import { cleanupAnimeInstance, setTemporaryWillChange, type ScholarAnimationCleanup } from "./animation-cleanup";

export { animate, createTimeline, stagger };
export type { ScholarAnimationQuality };

export function scopedAnimation(
  targets: HTMLElement | HTMLElement[],
  create: () => JSAnimation | Timeline,
  options: { willChange?: string; revertOnCleanup?: boolean } = {},
): ScholarAnimationCleanup {
  const elements = Array.isArray(targets) ? targets : [targets];
  const release = setTemporaryWillChange(elements, options.willChange);
  const instance = create();
  void instance.then(() => release());
  return () => cleanupAnimeInstance(instance, release, options.revertOnCleanup ?? true);
}

export function animateSurfaceFade(
  target: HTMLElement,
  quality: ScholarAnimationQuality,
  direction: "in" | "out" = "in",
): ScholarAnimationCleanup {
  const entering = direction === "in";
  return scopedAnimation(target, () => animate(target, {
    opacity: entering ? [0, 1] : [1, 0],
    translateY: quality === "reduced-motion" ? 0 : entering ? [8, 0] : [0, 5],
    scale: quality === "reduced-motion" ? 1 : entering ? [0.985, 1] : [1, 0.99],
    duration: animationDuration(quality, entering ? 300 : 210),
    ease: entering ? "outCubic" : "inCubic",
  }));
}
