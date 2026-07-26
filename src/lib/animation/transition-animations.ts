import { animate, createTimeline, stagger } from "animejs";
import { cleanupAnimeInstance, setTemporaryWillChange, type ScholarAnimationCleanup } from "./animation-cleanup";
import { animationDuration, type ScholarAnimationQuality } from "./animation-preferences";

export function animateScholarIntro(
  root: HTMLElement,
  quality: ScholarAnimationQuality,
): ScholarAnimationCleanup {
  const mark = root.querySelector<HTMLElement>("[data-intro-mark]");
  const wordmark = root.querySelector<HTMLElement>("[data-intro-wordmark]");
  const message = root.querySelector<HTMLElement>("[data-intro-message]");
  const targets = [root, mark, wordmark, message].filter((item): item is HTMLElement => Boolean(item));
  const release = setTemporaryWillChange(targets);
  const timeline = createTimeline({ defaults: { ease: "outCubic" } })
    .add(root, { opacity: [0, 1], duration: animationDuration(quality, 220) }, 0);
  if (mark) timeline.add(mark, { opacity: [0, 1], scale: quality === "reduced-motion" ? 1 : [0.94, 1], duration: animationDuration(quality, 330) }, 60);
  if (wordmark) timeline.add(wordmark, { opacity: [0, 1], translateY: quality === "reduced-motion" ? 0 : [7, 0], duration: animationDuration(quality, 260) }, 150);
  if (message) timeline.add(message, { opacity: [0, 1], duration: animationDuration(quality, 180) }, 235);
  void timeline.then(() => release());
  return () => cleanupAnimeInstance(timeline, release);
}

export function animateAcademicTransition(
  root: HTMLElement,
  quality: ScholarAnimationQuality,
): ScholarAnimationCleanup {
  const identity = root.querySelector<HTMLElement>("[data-transition-identity]");
  const classNumber = root.querySelector<HTMLElement>("[data-transition-class]");
  const messages = Array.from(root.querySelectorAll<HTMLElement>("[data-transition-message]"));
  const targets = [root, identity, classNumber, ...messages].filter((item): item is HTMLElement => Boolean(item));
  const release = setTemporaryWillChange(targets);
  const timeline = createTimeline({ defaults: { ease: "outCubic" } })
    .add(root, { opacity: [0, 1], duration: animationDuration(quality, 180) }, 0);
  if (identity) timeline.add(identity, { opacity: [0, 1], translateY: quality === "reduced-motion" ? 0 : [8, 0], duration: animationDuration(quality, 300) }, 45);
  if (classNumber) timeline.add(classNumber, { opacity: [0, 1], scale: quality === "reduced-motion" ? 1 : [0.92, 1], duration: animationDuration(quality, 340) }, 110);
  if (messages.length) timeline.add(messages, { opacity: [0, 1], translateY: quality === "reduced-motion" ? 0 : [5, 0], duration: animationDuration(quality, 190), delay: quality === "reduced-motion" ? 0 : stagger(34) }, 210);
  void timeline.then(() => release());
  return () => cleanupAnimeInstance(timeline, release);
}

export function animateFilePreviewOpen(
  shell: HTMLElement,
  content: HTMLElement | null,
  quality: ScholarAnimationQuality,
  direction: "open" | "close" = "open",
  onComplete?: () => void,
): ScholarAnimationCleanup {
  const opening = direction === "open";
  const targets = content ? [shell, content] : [shell];
  const release = setTemporaryWillChange(targets);
  const timeline = createTimeline({ defaults: { ease: opening ? "outCubic" : "inCubic" }, onComplete })
    .add(shell, {
      opacity: opening ? [0, 1] : [1, 0],
      scale: quality === "reduced-motion" ? 1 : opening ? [0.992, 1] : [1, 0.994],
      duration: animationDuration(quality, opening ? 240 : 160),
    }, 0);
  if (content) timeline.add(content, {
    opacity: opening ? [0, 1] : [1, 0],
    translateY: quality === "reduced-motion" ? 0 : opening ? [7, 0] : [0, 4],
    duration: animationDuration(quality, opening ? 230 : 130),
  }, opening ? 45 : 0);
  void timeline.then(() => release());
  return () => cleanupAnimeInstance(timeline, release);
}

export type SlideshowTransitionStyle = "fade" | "soft-slide" | "scale-fade" | "section-reveal" | "bullet-reveal";

export function animateSlideshowReveal(
  stage: HTMLElement,
  quality: ScholarAnimationQuality,
  style: SlideshowTransitionStyle = "fade",
  playbackRate = 1,
): ScholarAnimationCleanup {
  const revealItems = Array.from(stage.querySelectorAll<HTMLElement>("[data-slide-reveal-item]"));
  const release = setTemporaryWillChange([stage, ...revealItems]);
  const reduced = quality === "reduced-motion";
  const translateX = reduced ? 0 : style === "soft-slide" ? [14, 0] : 0;
  const translateY = reduced ? 0 : style === "section-reveal" || style === "bullet-reveal" ? [7, 0] : 0;
  const timeline = createTimeline({ defaults: { ease: "outCubic" } })
    .add(stage, {
      opacity: [0, 1],
      translateX,
      scale: reduced || style !== "scale-fade" ? 1 : [0.985, 1],
      duration: animationDuration(quality, Math.round(260 / Math.max(0.5, playbackRate))),
    }, 0);
  if (revealItems.length) timeline.add(revealItems, {
    opacity: [0, 1],
    translateY,
    duration: animationDuration(quality, Math.round(190 / Math.max(0.5, playbackRate))),
    delay: reduced || style === "fade" || style === "scale-fade" ? 0 : stagger(42),
  }, reduced ? 0 : 70);
  void timeline.then(() => release());
  return () => cleanupAnimeInstance(timeline, release);
}
