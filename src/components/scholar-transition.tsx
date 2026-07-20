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
import { AnimatePresence, motion } from "framer-motion";
import { GraduationCap, Volume2, Zap } from "lucide-react";
import { useStore } from "@/lib/store";
import { transitionAudio, type TransitionAudioStatus } from "@/lib/transition-audio";

export type ScholarTransitionState =
  | "idle"
  | "preparing"
  | "playing"
  | "switching"
  | "finishing"
  | "completed"
  | "failed";

export type ScholarTransitionConfig = {
  type: "login-intro" | "academic-switch";
  fromClass?: 9 | 11;
  toClass?: 9 | 11;
  durationMs?: number;
  prepare?: () => void | Promise<void>;
  commit?: () => void;
};

type ActiveTransition = ScholarTransitionConfig & {
  state: ScholarTransitionState;
  progress: number;
  dataReady: boolean;
  error?: string;
};

type Operation = {
  id: number;
  skip: () => void;
  cancel: () => void;
  promise: Promise<void>;
};

type TransitionContextValue = {
  transition: ActiveTransition | null;
  audioStatus: TransitionAudioStatus | "idle";
  startTransition: (config: ScholarTransitionConfig) => Promise<void>;
  skipTransition: () => void;
  stopTransition: () => void;
  retrySound: () => void;
};

const TransitionContext = createContext<TransitionContextValue | null>(null);
const LOGIN_SESSION_KEY = "scholar-login-intro-played";
const ROSELYN_SEGMENT = { type: "youtube" as const, videoId: "WJ2d0SzOMXc", start: 25, end: 41 };

function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function ScholarTransitionProvider({ children }: { children: ReactNode }) {
  const settings = useStore((state) => state.settings);
  const [transition, setTransition] = useState<ActiveTransition | null>(null);
  const [audioStatus, setAudioStatus] = useState<TransitionAudioStatus | "idle">("idle");
  const operationRef = useRef<Operation | null>(null);
  const operationIdRef = useRef(0);

  const stopTransition = useCallback(() => {
    operationRef.current?.cancel();
    transitionAudio.stop(220);
    operationRef.current = null;
    setAudioStatus("idle");
    setTransition(null);
  }, []);

  const startTransition = useCallback((config: ScholarTransitionConfig): Promise<void> => {
    if (operationRef.current) return operationRef.current.promise;

    const id = ++operationIdRef.current;
    const durationMs = config.durationMs ?? 16_000;
    let cancelled = false;
    let committed = false;
    let resolveSkip: () => void = () => undefined;
    let resolveOperation: () => void = () => undefined;
    const skipSignal = new Promise<void>((resolve) => { resolveSkip = resolve; });
    const promise = new Promise<void>((resolve) => { resolveOperation = resolve; });
    const update = (patch: Partial<ActiveTransition>) => {
      if (operationRef.current?.id !== id || cancelled) return;
      setTransition((current) => current ? { ...current, ...patch } : current);
    };
    const commit = () => {
      if (committed || cancelled) return;
      committed = true;
      update({ state: "switching" });
      config.commit?.();
    };

    operationRef.current = {
      id,
      promise,
      skip: resolveSkip,
      cancel: () => {
        cancelled = true;
        resolveSkip();
        resolveOperation();
      },
    };
    setTransition({ ...config, durationMs, state: "preparing", progress: 0, dataReady: false });

    const musicAllowed = settings.transitionMusic !== false
      && (config.type === "login-intro" ? settings.loginIntroMusic !== false : settings.academicSwitchMusic !== false);
    if (musicAllowed) {
      setAudioStatus("loading");
      void transitionAudio.play({
        source: ROSELYN_SEGMENT,
        volume: settings.transitionVolume ?? 65,
        fadeInMs: 700,
        fadeOutMs: 1_000,
        onStatus: (status) => setAudioStatus(status),
      });
    } else {
      setAudioStatus("idle");
    }

    const preparation = Promise.resolve()
      .then(() => config.prepare?.())
      .then(() => update({ dataReady: true }))
      .catch((error: unknown) => {
        update({ state: "failed", error: error instanceof Error ? error.message : "Academic data could not be prepared" });
        throw error;
      });

    const startedAt = performance.now();
    const progressTimer = window.setInterval(() => {
      const progress = Math.min(100, ((performance.now() - startedAt) / durationMs) * 100);
      update({ state: progress < 30 ? "playing" : progress < 88 ? "switching" : "finishing", progress });
    }, 100);
    const commitTimer = window.setTimeout(commit, Math.min(5_000, durationMs * 0.32));

    void (async () => {
      const skipped = await Promise.race([
        waitFor(durationMs).then(() => false),
        skipSignal.then(() => true),
      ]);
      if (cancelled) return;
      commit();
      if (!skipped) update({ progress: 100, state: "finishing" });
      transitionAudio.stop(skipped ? 220 : 0);
      try {
        await preparation;
      } catch {
        if (!cancelled) await waitFor(1_200);
      }
      if (cancelled) return;
      window.clearInterval(progressTimer);
      window.clearTimeout(commitTimer);
      update({ state: "completed", progress: 100 });
      await waitFor(settings.reduceMotion ? 80 : skipped ? 220 : 500);
      if (operationRef.current?.id === id) {
        operationRef.current = null;
        setTransition(null);
        setAudioStatus("idle");
      }
      resolveOperation();
    })();

    return promise;
  }, [settings]);

  const skipTransition = useCallback(() => operationRef.current?.skip(), []);
  const retrySound = useCallback(() => transitionAudio.retryAfterGesture(), []);

  useEffect(() => () => {
    operationRef.current?.cancel();
    transitionAudio.stop(0);
  }, []);

  const value = useMemo<TransitionContextValue>(() => ({
    transition,
    audioStatus,
    startTransition,
    skipTransition,
    stopTransition,
    retrySound,
  }), [audioStatus, retrySound, skipTransition, startTransition, stopTransition, transition]);

  return (
    <TransitionContext.Provider value={value}>
      {children}
      <AcademicTransitionOverlay
        transition={transition?.type === "academic-switch" ? transition : null}
        audioStatus={audioStatus}
        onSkip={skipTransition}
        onRetrySound={retrySound}
        reduceMotion={settings.reduceMotion}
      />
    </TransitionContext.Provider>
  );
}

export function useScholarTransition(): TransitionContextValue {
  const value = useContext(TransitionContext);
  if (!value) throw new Error("useScholarTransition must be used inside ScholarTransitionProvider");
  return value;
}

export function markLoginIntroPlayed(): boolean {
  try {
    if (sessionStorage.getItem(LOGIN_SESSION_KEY) === "true") return false;
    sessionStorage.setItem(LOGIN_SESSION_KEY, "true");
    return true;
  } catch {
    return true;
  }
}

function AcademicTransitionOverlay({
  transition,
  audioStatus,
  onSkip,
  onRetrySound,
  reduceMotion,
}: {
  transition: ActiveTransition | null;
  audioStatus: TransitionAudioStatus | "idle";
  onSkip: () => void;
  onRetrySound: () => void;
  reduceMotion: boolean;
}) {
  const toClass = transition?.toClass;
  const message = transition?.error
    ? "The new workspace could not be prepared. Returning safely…"
    : !transition?.dataReady && (transition?.progress ?? 0) >= 100
      ? "Still loading your real academic data…"
      : toClass === 11
        ? "Loading your subjects, ebooks and progress…"
        : "Preparing your academic workspace…";

  return (
    <AnimatePresence>
      {transition && (
        <motion.div
          data-testid="academic-transition"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.08 : 0.55 }}
          className="fixed inset-0 z-[120] overflow-hidden bg-black text-white"
          style={{ minHeight: "100vh", height: "100dvh" }}
          role="dialog"
          aria-modal="true"
          aria-label={`Switching to Class ${toClass}`}
        >
          <video autoPlay muted playsInline className="absolute inset-0 h-full w-full object-cover" aria-hidden="true">
            <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260514_102933_4e8f73b5-775a-4179-b2fb-472f59063dcd.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(99,102,241,0.2),transparent_42%),linear-gradient(to_bottom,rgba(0,0,0,.48),rgba(0,0,0,.72))]" />
          {!reduceMotion && (
            <div className="absolute inset-0 opacity-30" aria-hidden="true">
              {[18, 32, 47, 61, 76, 88].map((left, index) => (
                <motion.span key={left} className="absolute h-1 w-1 rounded-full bg-white" style={{ left: `${left}%`, bottom: "12%" }} animate={{ y: [0, -500], opacity: [0, 0.8, 0] }} transition={{ duration: 5 + index * 0.45, repeat: Infinity, delay: index * 0.4 }} />
              ))}
            </div>
          )}

          <div className="relative z-10 flex h-full min-h-0 flex-col items-center justify-center px-5 text-center">
            <motion.div animate={reduceMotion ? undefined : { y: [0, -5, 0] }} transition={{ duration: 3, repeat: Infinity }} className="mb-6 grid h-16 w-16 place-items-center rounded-2xl border border-white/25 bg-white/10 shadow-[0_0_60px_rgba(99,102,241,.4)] backdrop-blur-xl">
              <GraduationCap className="h-8 w-8" />
            </motion.div>
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.32em] text-white/60">Scholar academic transition</p>
            <div className="mb-5 flex items-center justify-center gap-4 sm:gap-7" aria-label={`Class ${transition.fromClass} to Class ${toClass}`}>
              <span className="text-2xl font-medium text-white/45 sm:text-3xl">Class {transition.fromClass}</span>
              <motion.span animate={reduceMotion ? undefined : { x: [0, 5, 0], opacity: [0.55, 1, 0.55] }} transition={{ duration: 1.6, repeat: Infinity }} aria-hidden="true">→</motion.span>
              <span className="font-serif text-4xl italic sm:text-6xl">Class {toClass}</span>
            </div>
            <h2 className="mb-3 text-2xl font-semibold sm:text-3xl">Switching to Class {toClass}</h2>
            <p className="min-h-6 max-w-lg text-sm text-white/70 sm:text-base" role="status" aria-live="polite">{message}</p>

            <div className="mt-8 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label="Academic workspace loading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(transition.progress)}>
              <motion.div className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-white to-cyan-300" animate={{ width: `${transition.progress}%` }} transition={{ duration: 0.12, ease: "linear" }} />
            </div>
            <div className="mt-5 flex min-h-9 items-center gap-3">
              {audioStatus === "blocked" && (
                <button onClick={onRetrySound} className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs backdrop-blur-md hover:bg-white/15" aria-label="Tap to enable transition sound">
                  <Volume2 className="mr-1.5 inline h-3.5 w-3.5" /> Tap for sound
                </button>
              )}
              <button onClick={onSkip} className="rounded-full px-4 py-2 text-xs text-white/65 hover:bg-white/10 hover:text-white" aria-label="Skip transition">
                Skip Transition
              </button>
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 text-[10px] uppercase tracking-[0.24em] text-white/35"><Zap className="h-3 w-3" /> Scholar</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

