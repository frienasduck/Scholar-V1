import { animate, createScope, createTimeline, waapi } from "animejs";

export const WORDMARK_FILL_DURATION = 5_000;
export const WORDMARK_EXIT = Object.freeze({ fill: 90, fade: 160, fallback: 380 });

/** Five seconds of steady physical rise. Readiness may hold the last cap, but
 * preparation updates can never rush the liquid or certify an unready page. */
export function launchTimedFill(elapsedMs: number, contentReady: boolean): number {
  const travel = Math.max(0, Math.min(1, elapsedMs / WORDMARK_FILL_DURATION)) * 216;
  const value = travel <= 160 ? travel / 160 * .92 : .92 + (travel - 160) / 56 * .08;
  return Math.min(contentReady ? 1 : .92, value);
}

/** Preparation is only one boundary; session/shell and profile own the rest.
 * This is visual weighting, never an assertion of exact backend percent. */
export function launchReadinessProgress(tasks: number, shellReady: boolean, requiresProfile: boolean, profileReady: boolean): number {
  return Math.min(.92, Math.max(0, Math.min(1, tasks)) * .70 + (shellReady ? .18 : 0) + (shellReady && (!requiresProfile || profileReady) ? .04 : 0));
}

/** Task progress is not whole-app readiness: leave a visible unfilled rim. */
export function launchFillTarget(progress: number | undefined, ready = false): number | null {
  if (ready) return 1;
  if (progress === undefined || !Number.isFinite(progress)) return null;
  return Math.max(0, Math.min(0.92, progress));
}

export function launchFillY(fill: number): number {
  const value = Math.max(0, Math.min(1, fill));
  // SVG viewBox space includes air above the glyphs. A naive 0–100% translation
  // would clear the letters at ~90%, incorrectly looking complete during auth.
  // Reserve a visible cap above the wave's highest crest until real readiness.
  return value <= 0.92 ? 240 - value / 0.92 * 160 : 80 - (value - 0.92) / 0.08 * 56;
}

/** One connected surface across all letters. Smooth cubic Hermite segments,
 * two restrained harmonics; no turbulence filter, texture or canvas. */
export function liquidWordmarkPath(phase = 0, amplitude = 16): string {
  const wave = (x: number) => amplitude * (Math.sin(x * Math.PI / 330 + phase) * 0.7 + Math.sin(x * Math.PI / 170 - phase * 2) * 0.3);
  const slope = (x: number) => amplitude * (Math.cos(x * Math.PI / 330 + phase) * Math.PI / 330 * 0.7 + Math.cos(x * Math.PI / 170 - phase * 2) * Math.PI / 170 * 0.3);
  let path = `M -40 ${wave(-40).toFixed(2)}`;
  for (let x = -40; x < 1040; x += 90) {
    const end = x + 90;
    path += ` C ${x + 30} ${(wave(x) + slope(x) * 30).toFixed(2)} ${end - 30} ${(wave(end) - slope(end) * 30).toFixed(2)} ${end} ${wave(end).toFixed(2)}`;
  }
  return `${path} L 1040 560 L -40 560 Z`;
}

export interface LaunchWordmarkController {
  progress: (value: number | undefined) => void;
  readiness: (ready: boolean) => void;
  complete: () => void;
  visibility: (hidden: boolean) => void;
  destroy: () => void;
}

export function animateLaunchWordmark(root: HTMLElement, options: { reduced: boolean; repeat: boolean; onExit: () => void }): LaunchWordmarkController {
  const panel = root.querySelector<HTMLElement>(".scholar-launch-panel")!;
  const carrier = root.querySelector<SVGGElement>("[data-liquid-carrier]")!;
  const path = root.querySelector<SVGPathElement>("[data-liquid-wave]")!;
  const status = root.querySelector<HTMLElement>(".scholar-launch-status")!;
  const scope = createScope({ root });
  const fill = { value: 0 }, water = { phase: 0 }, clock = { elapsed: 0 };
  let contentReady = false;
  let disposed = false, completing = false, exited = false;
  let level: ReturnType<typeof animate> | undefined;
  let waves: ReturnType<typeof animate> | undefined;
  let entrance: ReturnType<typeof animate> | undefined;
  let exit: ReturnType<typeof createTimeline> | undefined;
  let fade: ReturnType<typeof waapi.animate> | ReturnType<typeof animate> | undefined;
  // The requested five-second reveal also runs on reloads. Reduced motion is
  // the sole static/immediate-exit exception.
  const still = options.reduced;
  root.dataset.fillStartedAt = performance.now().toFixed(2);
  const drawFill = () => {
    if (disposed) return;
    carrier.setAttribute("transform", `translate(0 ${launchFillY(fill.value).toFixed(2)})`);
    root.dataset.liquidFill = fill.value.toFixed(3);
  };
  const drawWave = () => { if (!disposed) path.setAttribute("d", liquidWordmarkPath(water.phase, completing && fill.value > 0.98 ? 0 : 16)); };
  const finish = () => {
    if (disposed || exited) return;
    exited = true; waves?.cancel(); level?.cancel(); entrance?.cancel(); fade?.cancel();
    root.dataset.phase = "done"; root.style.opacity = "0";
    panel.style.willChange = root.style.willChange = "";
    options.onExit();
  };
  drawFill(); drawWave();
  const fadeOut = (delay: number, duration: number) => {
    // Native opacity keeps progressing while React mounts non-critical UI.
    // Older WebViews retain the JS path and the gate's independent safety cap.
    const parameters = { opacity: [1, 0], delay, duration, ease: "cubic-bezier(.2, 0, .2, 1)", onComplete: finish };
    fade = scope.execute(() => typeof root.animate === "function" ? waapi.animate(root, parameters) : animate(root, parameters));
  };
  root.dataset.phase = still ? "static" : "filling";
  if (still) carrier.setAttribute("transform", `translate(0 ${launchFillY(1)})`);
  else scope.execute(() => {
    entrance = animate(panel, { opacity: [0.85, 1], duration: 160, ease: "out(3)" });
    waves = animate(water, { phase: [0, Math.PI * 2], duration: 3300, ease: "linear", loop: true, onUpdate: drawWave });
    level = animate(clock, { elapsed: WORDMARK_FILL_DURATION, duration: WORDMARK_FILL_DURATION, ease: "linear", onUpdate: () => {
      fill.value = launchTimedFill(clock.elapsed, contentReady); drawFill();
    } });
  });

  return {
    progress(value) {
      if (disposed || completing || still) return;
      const target = launchFillTarget(value);
      // Retain actual preparation diagnostics; visual timing is intentionally
      // separate and never restarts when a task/session message changes.
      if (target === null) delete root.dataset.preparationProgress;
      else root.dataset.preparationProgress = target.toFixed(3);
    },
    readiness(ready) { contentReady = ready; },
    complete() {
      if (disposed || completing) return;
      completing = true; entrance?.cancel(); level?.cancel();
      panel.style.opacity = "1"; panel.style.transform = "none";
      root.style.pointerEvents = "none";
      if (options.reduced || document.hidden) { fill.value = 1; drawFill(); finish(); return; }
      root.dataset.phase = "completing";
      root.style.willChange = "opacity";
      exit = scope.execute(() => {
        const timeline = createTimeline();
        timeline.add(fill, { value: 1, duration: WORDMARK_EXIT.fill, ease: "out(2)", onUpdate: drawFill }, 0);
        timeline.add(status, { opacity: 0, duration: 75 }, 0);
        timeline.call(() => { fill.value = 1; drawFill(); waves?.cancel(); drawWave(); root.dataset.phase = "fading"; }, WORDMARK_EXIT.fill);
        return timeline;
      });
      fadeOut(WORDMARK_EXIT.fill, WORDMARK_EXIT.fade);
    },
    visibility(hidden) {
      if (disposed) return;
      if (hidden && completing) { exit?.cancel(); fade?.cancel(); finish(); return; }
      for (const instance of [waves, level, entrance]) { if (hidden) instance?.pause(); else instance?.resume(); }
    },
    destroy() {
      disposed = true; exit?.cancel(); fade?.cancel(); level?.cancel(); waves?.cancel(); entrance?.cancel(); scope.revert();
      panel.style.willChange = root.style.willChange = "";
    },
  };
}
