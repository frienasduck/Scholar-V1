"use client";

import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { animateLaunchWordmark, launchFillY, liquidWordmarkPath, type LaunchWordmarkController } from "@/lib/animation/launch-wordmark";

type LaunchSplashProps = {
  overlay?: boolean;
  visible?: boolean;
  reducedMotion?: boolean;
  progress?: number;
  message?: string;
  modeLabel?: string;
  children?: ReactNode;
  /** The dynamic-import fallback holds the same opening pose; no second intro. */
  passive?: boolean;
  repeatVisit?: boolean;
  onExitComplete?: () => void;
};

/** Vector-only wordmark from the supplied 5.17 s reference, on requested full black.
 * Its timing is intentionally NOT copied: readiness owns completion. */
export function LaunchSplash({
  overlay = false, visible = true, reducedMotion = false, progress,
  message = "Loading Scholar…", modeLabel, children, passive = false,
  repeatVisit = false, onExitComplete,
}: LaunchSplashProps) {
  const id = useId().replace(/:/g, "");
  const maskId = "scholar-wordmark-" + id;
  const root = useRef<HTMLDivElement>(null);
  const controller = useRef<LaunchWordmarkController | null>(null);
  const exit = useRef(onExitComplete);
  useEffect(() => { exit.current = onExitComplete; }, [onExitComplete]);
  useEffect(() => {
    const element = root.current;
    if (!element || passive) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let current: LaunchWordmarkController | null = null;
    const create = () => {
      current?.destroy();
      current = animateLaunchWordmark(element, { reduced: reducedMotion || media.matches, repeat: repeatVisit, onExit: () => exit.current?.() });
      controller.current = current;
      current.progress(element.dataset.startupProgress === undefined ? undefined : Number(element.dataset.startupProgress) / 100);
      // A preference change must not replay or delay an already-ready exit.
      if (element.dataset.visible === "false") current.complete();
    };
    const visibility = () => current?.visibility(document.hidden);
    create();
    media.addEventListener("change", create);
    document.addEventListener("visibilitychange", visibility);
    return () => { current?.destroy(); controller.current = null; media.removeEventListener("change", create); document.removeEventListener("visibilitychange", visibility); };
  }, [passive, reducedMotion, repeatVisit]);
  useLayoutEffect(() => {
    if (!visible) controller.current?.complete();
    else controller.current?.progress(progress);
  }, [progress, visible, reducedMotion, repeatVisit]);

  const percentage = progress === undefined || !Number.isFinite(progress) ? undefined : Math.round(Math.max(0, Math.min(visible ? 0.92 : 1, progress)) * 100);
  const word = { x: 500, y: 220, textAnchor: "middle" as const, fontSize: 224, fontWeight: 900, letterSpacing: -9, textLength: 840, lengthAdjust: "spacingAndGlyphs" as const };
  return (
    <div ref={root}
      className={"scholar-launch" + (overlay ? " scholar-launch-overlay" : "") + (repeatVisit ? " scholar-launch-reload-cover" : "") + (reducedMotion ? " scholar-launch-reduced" : "")}
      style={overlay ? { pointerEvents: visible ? "auto" : "none" } : undefined}
      aria-label="Scholar startup" aria-busy={visible} aria-hidden={!visible}
      data-visible={visible} data-startup-progress={percentage} data-startup-mode={modeLabel?.toLowerCase()}
      data-startup-repeat={repeatVisit ? "true" : undefined} data-passive={passive ? "true" : undefined}
    >
      <div className="scholar-launch-panel">
        <h1 className="sr-only">Scholar</h1>
        <div className="scholar-launch-wordmark-wrap">
            <svg className="scholar-launch-wordmark" viewBox="0 0 1000 280" aria-hidden="true">
              <defs><clipPath id={maskId}><text {...word}>Scholar</text></clipPath></defs>
              <text {...word} fill="#383838">Scholar</text>
              <g clipPath={"url(#" + maskId + ")"}>
                <g data-liquid-carrier transform={"translate(0 " + launchFillY(0) + ")"}>
                  <path data-liquid-wave d={liquidWordmarkPath()} fill="#fdfdfd" />
                </g>
              </g>
            </svg>
          <p className="scholar-launch-status" role="status" aria-live="polite" aria-atomic="true">{message}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
