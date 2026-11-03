"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useReducedMotion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { startupIdleRoutes } from "@/lib/startup/startup-modes";
import { getBrowserStartupProfile } from "@/lib/startup/startup-performance";
import { LaunchSplash } from "@/components/launch-splash";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import {
  prepareScholarStartup,
  scheduleIdleStartupWork,
  type StartupReadinessProgress,
  type StartupReadinessResult,
} from "@/lib/startup/startup-controller";
import { normaliseStartupMode } from "@/lib/startup/startup-modes";
import { launchReadinessProgress, WORDMARK_EXIT, WORDMARK_FILL_DURATION } from "@/lib/animation/launch-wordmark";

const INITIAL_PROGRESS: StartupReadinessProgress = {
  mode: "long",
  message: "Restoring your Scholar workspace",
  progress: 0,
  canOpenNow: false,
  tasks: [],
};

const ScholarStartupReadyContext = createContext(true);
const LaunchContentReadinessContext = createContext({
  reportShellReady: (_ready: boolean) => {},
  reportProfileReady: (_ready: boolean) => {},
});
const LAUNCH_SEEN_KEY = "scholar:launch-seen:v1";
let launchShownInDocument = false;

function hasShownLaunchInTab(): boolean {
  if (typeof window === "undefined") return false;
  try { return window.sessionStorage.getItem(LAUNCH_SEEN_KEY) === "1"; } catch { return false; }
}

export function useScholarStartupReady(): boolean {
  return useContext(ScholarStartupReadyContext);
}

export function useLaunchContentReadiness() {
  return useContext(LaunchContentReadinessContext);
}

export function LaunchReadinessGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const configuredMode = useStore((state) => state.settings.startupLoadingMode);
  const reduceMotionSetting = useStore((state) => state.settings.reduceMotion);
  const systemReducedMotion = useReducedMotion();
  const reduceMotion = reduceMotionSetting || Boolean(systemReducedMotion);
  const devMode = useStore((state) => state.devMode);
  const session = useScholarAccess();
  const [repeatVisit] = useState(() => launchShownInDocument || hasShownLaunchInTab());
  const mode = repeatVisit ? "quick" : normaliseStartupMode(configuredMode);
  const [visible, setVisible] = useState(true);
  const [gateMounted, setGateMounted] = useState(true);
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const presentationStartedAt = useRef<number | null>(null);
  const [progress, setProgress] = useState<StartupReadinessProgress>({
    ...INITIAL_PROGRESS,
    mode,
  });
  const [result, setResult] = useState<StartupReadinessResult | null>(null);
  const [startupSettled, setStartupSettled] = useState(false);
  const [startupError, setStartupError] = useState(false);
  const [shellReady, setShellReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const readinessReport = useMemo(() => ({ reportShellReady: setShellReady, reportProfileReady: setProfileReady }), []);
  const requiresProfile = session.authenticated && Boolean(session.user);
  const contentReady = startupSettled && shellReady && (!requiresProfile || profileReady);
  const openNowRef = useRef(false);
  const canOpenNowRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const finishExit = useCallback(() => setGateMounted(false), []);

  const reveal = useCallback(() => {
    setVisible(false);
  }, []);

  const openNow = useCallback(() => {
    if (!progress.canOpenNow) return;
    openNowRef.current = true;
    controllerRef.current?.abort("open-now");
  }, [progress.canOpenNow]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    controllerRef.current = controller;
    openNowRef.current = false;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const stopForPageHide = () => controller.abort("page-hidden");
    const stopOptionalWhenHidden = () => {
      if (document.hidden && canOpenNowRef.current) controller.abort("page-hidden");
    };
    window.addEventListener("pagehide", stopForPageHide, { once: true });
    document.addEventListener("visibilitychange", stopOptionalWhenHidden);

    void prepareScholarStartup({
      mode,
      currentRoute: pathname || "/",
      signal: controller.signal,
      prefetchRoute: (route) => router.prefetch(route),
      getLocalState: () => useStore.getState(),
      shouldOpenNow: () => openNowRef.current,
      onProgress: (nextProgress) => {
        canOpenNowRef.current = nextProgress.canOpenNow;
        setProgress(nextProgress);
      },
    })
      .then((readiness) => {
        if (!active) return;
        setResult(readiness);
        setStartupSettled(true);
      })
      .catch((error) => {
        if (!active) return;
        setStartupError(true);
        if (process.env.NODE_ENV === "development") {
          console.warn("[Scholar startup] readiness coordinator recovered", error);
        }
        setStartupSettled(true);
      });

    return () => {
      active = false;
      controller.abort("unmount");
      controllerRef.current = null;
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("pagehide", stopForPageHide);
      document.removeEventListener("visibilitychange", stopOptionalWhenHidden);
    };
    // The startup gate intentionally runs once for the route and persisted mode present at launch.
  }, []);

  useEffect(() => {
    if (presentationStartedAt.current === null) presentationStartedAt.current = performance.now();
    const reduced = reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const remaining = reduced ? 0 : Math.max(0, WORDMARK_FILL_DURATION - (performance.now() - presentationStartedAt.current));
    const timer = window.setTimeout(() => setMinimumElapsed(true), remaining);
    return () => window.clearTimeout(timer);
  }, [reduceMotion]);

  useEffect(() => {
    if (!visible || !startupSettled || !shellReady || (requiresProfile && !profileReady) || !minimumElapsed) return;
    let cancelled = false;
    // Both real readiness and the explicitly requested five-second reveal are
    // required. The presentation minimum never substitutes for auth/profile.
    queueMicrotask(() => {
      if (cancelled) return;
      launchShownInDocument = true;
      if (!repeatVisit) {
        try { window.sessionStorage.setItem(LAUNCH_SEEN_KEY, "1"); } catch { /* Private storage may be unavailable. */ }
        document.documentElement.dataset.scholarLaunchSeen = "true";
      }
      reveal();
    });
    return () => { cancelled = true; };
  }, [visible, startupSettled, shellReady, profileReady, requiresProfile, repeatVisit, minimumElapsed, reveal]);

  useEffect(() => {
    if (visible) return;
    document.body.style.overflow = "";
    return scheduleIdleStartupWork(() => {
      if (document.hidden) return;
      startupIdleRoutes(mode, pathname || "/", result?.warmedRoutes, getBrowserStartupProfile()).forEach(route => router.prefetch(route));
    });
  }, [mode, pathname, result, router, visible]);

  useEffect(() => {
    if (visible) return;
    // Anime's completion removes the overlay first. This independent, short
    // safety cap still works if an animation callback is interrupted.
    const timer = window.setTimeout(finishExit, reduceMotion ? 0 : WORDMARK_EXIT.fallback);
    return () => window.clearTimeout(timer);
  }, [visible, reduceMotion, repeatVisit, finishExit]);

  const message = !startupSettled ? progress.message : !shellReady ? session.loading ? "Checking your Scholar session…" : "Opening your account’s workspace…" : requiresProfile && !profileReady ? "Opening your Scholar…" : "Opening Scholar…";
  const visualProgress = launchReadinessProgress(progress.progress, shellReady, requiresProfile, profileReady);

  return (
    <>
      <ScholarStartupReadyContext.Provider value={!gateMounted}>
        <LaunchContentReadinessContext.Provider value={readinessReport}>
          {children}
        </LaunchContentReadinessContext.Provider>
      </ScholarStartupReadyContext.Provider>
      {gateMounted && (
        <LaunchSplash overlay visible={visible} contentReady={contentReady} repeatVisit={repeatVisit} onExitComplete={finishExit} reducedMotion={reduceMotion} progress={visualProgress} message={message} modeLabel={mode}>
          <div className="scholar-launch-controls">
            {mode !== "quick" && progress.canOpenNow ? <button type="button" onClick={openNow} className="scholar-launch-open">Open now</button> : null}
          </div>
          {startupError && visible ? <div className="scholar-launch-recovery" role="alert">Some startup tools could not load. Your saved work is unchanged. <button type="button" className="scholar-launch-open" onClick={() => window.location.reload()}>Retry safely</button></div> : null}
          {devMode && progress.tasks.length ? (
            <details className="mt-4 w-full rounded-2xl border border-white/15 bg-black/25 p-3 text-left text-[10px] text-white/60">
              <summary className="cursor-pointer font-semibold text-white/75">Startup diagnostics</summary>
              <div className="mt-2 grid gap-1.5">
                {progress.tasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between gap-3">
                    <span className="truncate">{task.label}</span>
                    <span className="tabular-nums">{task.status}{task.durationMs !== undefined ? ` · ${task.durationMs} ms` : ""}</span>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </LaunchSplash>
      )}
    </>
  );
}
