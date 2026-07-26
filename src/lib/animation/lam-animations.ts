import { animate, createTimeline, stagger } from "animejs";
import { combineAnimationCleanups, cleanupAnimeInstance, setTemporaryWillChange, type ScholarAnimationCleanup } from "./animation-cleanup";
import { animationDuration, shouldRunDecorativeAnimation, type ScholarAnimationQuality } from "./animation-preferences";

export function animateLamWakeReveal(
  mark: HTMLElement,
  details: HTMLElement[],
  quality: ScholarAnimationQuality,
): ScholarAnimationCleanup {
  const targets = [mark, ...details];
  const release = setTemporaryWillChange(targets);
  const timeline = createTimeline({ defaults: { ease: "outCubic" } });
  timeline.add(mark, {
    opacity: [0, 1],
    scale: quality === "reduced-motion" ? 1 : [0.88, 1],
    duration: animationDuration(quality, 280),
  }, 0);
  if (details.length) {
    timeline.add(details, {
      opacity: [0, 1],
      translateX: quality === "reduced-motion" ? 0 : [-7, 0],
      duration: animationDuration(quality, 230),
      delay: quality === "reduced-motion" ? 0 : stagger(28),
    }, quality === "reduced-motion" ? 0 : 105);
  }
  void timeline.then(() => release());
  return () => cleanupAnimeInstance(timeline, release);
}

export function animateLamListeningEnter(
  surface: HTMLElement,
  glyph: HTMLElement,
  energyPoints: HTMLElement[],
  quality: ScholarAnimationQuality,
): ScholarAnimationCleanup {
  const release = setTemporaryWillChange([surface, glyph, ...energyPoints]);
  const enter = createTimeline({ defaults: { ease: "outCubic" } })
    .add(surface, {
      opacity: [0, 1],
      translateY: quality === "reduced-motion" ? 0 : [-8, 0],
      scale: quality === "reduced-motion" ? 1 : [quality === "mobile-optimized" ? 0.96 : 0.92, 1],
      duration: animationDuration(quality, 280),
    }, 0)
    .add([glyph, ...energyPoints], {
      opacity: [0, 1],
      scale: quality === "reduced-motion" ? 1 : [0.82, 1],
      duration: animationDuration(quality, 190),
      delay: quality === "reduced-motion" ? 0 : stagger(24),
    }, quality === "reduced-motion" ? 0 : 90);

  const loops = shouldRunDecorativeAnimation(quality)
    ? [
        animate(glyph, {
          scale: [1, quality === "mobile-optimized" ? 1.035 : 1.055],
          opacity: [0.82, 1],
          duration: quality === "mobile-optimized" ? 1_200 : 950,
          alternate: true,
          loop: true,
          ease: "inOutSine",
        }),
        animate(energyPoints.slice(0, quality === "mobile-optimized" ? 3 : 5), {
          scaleY: [0.55, 1],
          opacity: [0.45, 0.95],
          duration: quality === "mobile-optimized" ? 860 : 620,
          delay: stagger(70),
          alternate: true,
          loop: true,
          ease: "inOutSine",
        }),
      ]
    : [];
  void enter.then(() => release());
  return combineAnimationCleanups(
    () => cleanupAnimeInstance(enter, release),
    ...loops.map((loop) => () => loop.revert()),
  );
}

export function animateLamThinkingEnter(
  surface: HTMLElement,
  glyph: HTMLElement,
  points: HTMLElement[],
  quality: ScholarAnimationQuality,
): ScholarAnimationCleanup {
  const release = setTemporaryWillChange([surface, glyph, ...points]);
  const enter = createTimeline({ defaults: { ease: "outCubic" } })
    .add(surface, {
      opacity: [0, 1],
      translateY: quality === "reduced-motion" ? 0 : [6, 0],
      scale: quality === "reduced-motion" ? 1 : [0.975, 1],
      duration: animationDuration(quality, 250),
    })
    .add([glyph, ...points], {
      opacity: [0, 1],
      duration: animationDuration(quality, 170),
      delay: quality === "reduced-motion" ? 0 : stagger(35),
    }, quality === "reduced-motion" ? 0 : 70);

  const loops = shouldRunDecorativeAnimation(quality)
    ? [
        animate(glyph, {
          rotate: quality === "mobile-optimized" ? [0, 180] : [0, 360],
          duration: quality === "mobile-optimized" ? 1_800 : 1_350,
          loop: true,
          ease: "linear",
        }),
        animate(points.slice(0, quality === "mobile-optimized" ? 2 : 3), {
          translateY: [0, -3],
          opacity: [0.35, 1],
          duration: quality === "mobile-optimized" ? 760 : 560,
          delay: stagger(90),
          alternate: true,
          loop: true,
          ease: "inOutSine",
        }),
      ]
    : [];
  void enter.then(() => release());
  return combineAnimationCleanups(
    () => cleanupAnimeInstance(enter, release),
    ...loops.map((loop) => () => loop.revert()),
  );
}

export function animateLamResponseReveal(
  root: HTMLElement,
  quality: ScholarAnimationQuality,
): ScholarAnimationCleanup {
  const heading = root.querySelector<HTMLElement>("[data-lam-reveal='heading']");
  const blocks = Array.from(root.querySelectorAll<HTMLElement>("[data-lam-reveal='block']"));
  const equations = Array.from(root.querySelectorAll<HTMLElement>("[data-lam-reveal='equation']"));
  const actions = Array.from(root.querySelectorAll<HTMLElement>("[data-lam-reveal='actions']"));
  const revealTargets = [heading, ...blocks, ...equations, ...actions].filter((item): item is HTMLElement => Boolean(item));
  const release = setTemporaryWillChange([root, ...revealTargets]);
  const timeline = createTimeline({ defaults: { ease: "outCubic" } }).add(root, {
    opacity: [0, 1],
    translateY: quality === "reduced-motion" ? 0 : [6, 0],
    duration: animationDuration(quality, 220),
  }, 0);
  if (heading) timeline.add(heading, { opacity: [0, 1], translateY: quality === "reduced-motion" ? 0 : [4, 0], duration: animationDuration(quality, 180) }, 40);
  if (blocks.length) timeline.add(blocks, { opacity: [0, 1], translateY: quality === "reduced-motion" ? 0 : [4, 0], duration: animationDuration(quality, 180), delay: quality === "reduced-motion" ? 0 : stagger(25) }, 80);
  if (equations.length) timeline.add(equations, { opacity: [0, 1], duration: animationDuration(quality, 150) }, 105);
  if (actions.length) timeline.add(actions, { opacity: [0, 1], translateY: quality === "reduced-motion" ? 0 : [3, 0], duration: animationDuration(quality, 150) }, 130);
  void timeline.then(() => release());
  return () => cleanupAnimeInstance(timeline, release);
}

export function animateGlassDropdown(
  menu: HTMLElement,
  items: HTMLElement[],
  direction: "open" | "close",
  quality: ScholarAnimationQuality,
  onComplete?: () => void,
): ScholarAnimationCleanup {
  const opening = direction === "open";
  const targets = [menu, ...items];
  const release = setTemporaryWillChange(targets);
  const timeline = createTimeline({ defaults: { ease: opening ? "outCubic" : "inCubic" }, onComplete })
    .add(menu, {
      opacity: opening ? [0, 1] : [1, 0],
      translateY: quality === "reduced-motion" ? 0 : opening ? [-6, 0] : [0, -4],
      scale: quality === "reduced-motion" ? 1 : opening ? [0.98, 1] : [1, 0.985],
      duration: animationDuration(quality, opening ? 210 : 150),
    }, 0);
  if (items.length) {
    timeline.add(items, {
      opacity: opening ? [0, 1] : [1, 0],
      translateY: quality === "reduced-motion" ? 0 : opening ? [-3, 0] : [0, -2],
      duration: animationDuration(quality, opening ? 150 : 100),
      delay: quality === "reduced-motion" || !opening ? 0 : stagger(16),
    }, opening ? 35 : 0);
  }
  void timeline.then(() => release());
  return () => cleanupAnimeInstance(timeline, release);
}

export function animateLamModeSelection(
  target: HTMLElement,
  quality: ScholarAnimationQuality,
): ScholarAnimationCleanup {
  const release = setTemporaryWillChange([target]);
  const animation = animate(target, {
    opacity: [0.78, 1],
    scale: quality === "reduced-motion" ? 1 : [0.985, 1],
    duration: animationDuration(quality, 180),
    ease: "outCubic",
  });
  void animation.then(() => release());
  return () => cleanupAnimeInstance(animation, release);
}
