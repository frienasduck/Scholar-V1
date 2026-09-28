"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useReducedMotion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { LaunchSplash } from "@/components/launch-splash";
import {
  prepareScholarStartup,
  scheduleIdleStartupWork,
  type StartupReadinessProgress,
  type StartupReadinessResult,
} from "@/lib/startup/startup-controller";
import { STARTUP_ROUTE_GROUPS, normaliseStartupMode } from "@/lib/startup/startup-modes";

const INITIAL_PROGRESS: StartupReadinessProgress = {
  mode: "long",
  message: "Restoring your Scholar workspace",
  progress: 0,
  canOpenNow: false,
  tasks: [],
};

const ScholarStartupReadyContext = createContext(true);
const FIRST_LAUNCH_MINIMUM_MS = 1900;
let launchShownInDocument = false;

export function useScholarStartupReady(): boolean {
  return useContext(ScholarStartupReadyContext);
}

export function LaunchReadinessGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const configuredMode = useStore((state) => state.settings.startupLoadingMode);
  const reduceMotionSetting = useStore((state) => state.settings.reduceMotion);
  const systemReducedMotion = useReducedMotion();
  const reduceMotion = reduceMotionSetting || Boolean(systemReducedMotion);
  const devMode = useStore((state) => state.devMode);
  const mode = normaliseStartupMode(configuredMode);
  const [visible, setVisible] = useState(true);
  const [gateMounted, setGateMounted] = useState(true);
  const [progress, setProgress] = useState<StartupReadinessProgress>({
    ...INITIAL_PROGRESS,
    mode,
  });
  const [result, setResult] = useState<StartupReadinessResult | null>(null);
  const openNowRef = useRef(false);
  const canOpenNowRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);

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
    const startedAt = performance.now();
    const minimumDuration = launchShownInDocument ? 0 : FIRST_LAUNCH_MINIMUM_MS;
    let active = true;
    let revealTimer: number | undefined;
    const revealWhenReady = () => {
      const remaining = Math.max(0, minimumDuration - (performance.now() - startedAt));
      revealTimer = window.setTimeout(() => {
        if (!active) return;
        launchShownInDocument = true;
        reveal();
      }, remaining);
    };
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
        revealWhenReady();
      })
      .catch((error) => {
        if (!active) return;
        if (process.env.NODE_ENV === "development") {
          console.warn("[Scholar startup] readiness coordinator recovered", error);
        }
        revealWhenReady();
      });

    return () => {
      active = false;
      window.clearTimeout(revealTimer);
      controller.abort("unmount");
      controllerRef.current = null;
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("pagehide", stopForPageHide);
      document.removeEventListener("visibilitychange", stopOptionalWhenHidden);
    };
    // The startup gate intentionally runs once for the route and persisted mode present at launch.
  }, []);

  useEffect(() => {
    if (visible) return;
    document.body.style.overflow = "";
    return scheduleIdleStartupWork(() => {
      const remainingRoutes = STARTUP_ROUTE_GROUPS.full.filter(
        (route) => !result?.warmedRoutes.includes(route),
      );
      remainingRoutes.slice(0, 4).forEach((route) => router.prefetch(route));
    });
  }, [result, router, visible]);

  useEffect(() => {
    if (visible) return;
    // Readiness is authoritative: a missed motion exit must never hide or
    // intercept the ready workspace. CSS fades independently; removal is bounded.
    const timer = window.setTimeout(() => setGateMounted(false), reduceMotion ? 0 : 600);
    return () => window.clearTimeout(timer);
  }, [visible, reduceMotion]);

  const completedCount = progress.tasks.filter((task) =>
    ["completed", "failed", "skipped", "timed-out"].includes(task.status),
  ).length;

  return (
    <>
      <ScholarStartupReadyContext.Provider value={!visible}>
        {children}
      </ScholarStartupReadyContext.Provider>
      {gateMounted && (
        <LaunchSplash overlay visible={visible} reducedMotion={reduceMotion} progress={progress.progress} message={progress.message} modeLabel={mode}>
          <div className="scholar-launch-controls">
            <span className="text-[11px] text-[#9fbbd9]">{completedCount} of {progress.tasks.length || 1} preparation steps</span>
            <button type="button" onClick={openNow} disabled={!progress.canOpenNow} className="scholar-launch-open">Open now</button>
            {mode === "full" ? <span className="text-[11px] text-[#829ab5]">Preparing the complete Scholar experience…</span> : null}
          </div>
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
