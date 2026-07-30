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
import { AnimatePresence, motion } from "framer-motion";
import { Check, GraduationCap } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import {
  prepareScholarStartup,
  scheduleIdleStartupWork,
  type StartupReadinessProgress,
  type StartupReadinessResult,
} from "@/lib/startup/startup-controller";
import {
  STARTUP_MODE_DEFINITIONS,
  STARTUP_ROUTE_GROUPS,
  normaliseStartupMode,
} from "@/lib/startup/startup-modes";

const INITIAL_PROGRESS: StartupReadinessProgress = {
  mode: "long",
  message: "Restoring your Scholar workspace",
  progress: 0,
  canOpenNow: false,
  tasks: [],
};

const ScholarStartupReadyContext = createContext(true);

export function useScholarStartupReady(): boolean {
  return useContext(ScholarStartupReadyContext);
}

export function LaunchReadinessGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const configuredMode = useStore((state) => state.settings.startupLoadingMode);
  const reduceMotion = useStore((state) => state.settings.reduceMotion);
  const devMode = useStore((state) => state.devMode);
  const mode = normaliseStartupMode(configuredMode);
  const [visible, setVisible] = useState(true);
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
        setResult(readiness);
        reveal();
      })
      .catch((error) => {
        if (process.env.NODE_ENV === "development") {
          console.warn("[Scholar startup] readiness coordinator recovered", error);
        }
        reveal();
      });

    return () => {
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

  const modeDefinition = STARTUP_MODE_DEFINITIONS[mode];
  const completedCount = progress.tasks.filter((task) =>
    ["completed", "failed", "skipped", "timed-out"].includes(task.status),
  ).length;

  return (
    <>
      <ScholarStartupReadyContext.Provider value={!visible}>
        {children}
      </ScholarStartupReadyContext.Provider>
      <AnimatePresence>
        {visible && (
          <motion.div
            key="scholar-launch-gate"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[10000] grid place-items-center overflow-hidden bg-[#03050a]"
            role="status"
            aria-live="polite"
            aria-label={progress.message}
            data-startup-mode={mode}
            data-startup-progress={Math.round(progress.progress * 100)}
          >
            <img
              src="/backgrounds/scholar-poster.svg"
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-65"
            />
            <div className="absolute inset-0 bg-black/35" />
            <div className="relative flex w-full max-w-md flex-col items-center px-6 text-center">
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: reduceMotion ? 0 : 0.5 }}
                className="grid h-16 w-16 place-items-center rounded-2xl border border-white/15 bg-white/10 text-white shadow-2xl backdrop-blur-xl"
              >
                <GraduationCap className="h-8 w-8" />
              </motion.div>
              <motion.h1
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-5 text-2xl font-semibold tracking-tight text-white"
              >
                Scholar
              </motion.h1>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/50">
                {modeDefinition.label}
                {modeDefinition.badge ? ` · ${modeDefinition.badge}` : ""}
              </p>
              <p className="mt-3 min-h-5 text-sm text-white/65">{progress.message}</p>
              <div
                className="mt-5 h-1.5 w-full max-w-72 overflow-hidden rounded-full bg-white/10"
                aria-hidden="true"
              >
                <motion.div
                  className="h-full origin-left rounded-full bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-300"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: Math.max(0.02, progress.progress) }}
                  transition={{ duration: reduceMotion ? 0.05 : 0.3, ease: "easeOut" }}
                />
              </div>
              <div className="mt-3 flex min-h-5 items-center gap-2 text-[11px] text-white/40">
                {progress.progress >= 1 ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : null}
                <span>
                  {completedCount} of {progress.tasks.length || 1} preparation steps
                </span>
              </div>
              <button
                type="button"
                onClick={openNow}
                disabled={!progress.canOpenNow}
                className="mt-5 rounded-full border border-white/15 bg-white/[0.07] px-5 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Open now
              </button>
              {mode === "full" ? (
                <p className="mt-3 text-[11px] text-white/35">
                  Preparing the complete Scholar experience…
                </p>
              ) : null}
              {devMode && progress.tasks.length ? (
                <details className="mt-5 w-full rounded-2xl border border-white/10 bg-black/25 p-3 text-left text-[10px] text-white/45">
                  <summary className="cursor-pointer font-semibold text-white/60">
                    Startup diagnostics
                  </summary>
                  <div className="mt-2 grid gap-1.5">
                    {progress.tasks.map((task) => (
                      <div key={task.id} className="flex items-center justify-between gap-3">
                        <span className="truncate">{task.label}</span>
                        <span className="tabular-nums">
                          {task.status}
                          {task.durationMs !== undefined ? ` · ${task.durationMs} ms` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
