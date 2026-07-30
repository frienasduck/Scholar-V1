import { writeStartupCache } from "./startup-cache";
import {
  STARTUP_MODE_DEFINITIONS,
  type StartupLoadingMode,
  type StartupTaskStatus,
} from "./startup-modes";
import {
  createStartupTasks,
  type StartupContext,
  type StartupTaskRuntime,
} from "./startup-tasks";
import { withTaskTimeout } from "./startup-performance";

export interface StartupReadinessProgress {
  mode: StartupLoadingMode;
  message: string;
  progress: number;
  canOpenNow: boolean;
  tasks: StartupTaskRuntime[];
}

export interface StartupReadinessResult {
  mode: StartupLoadingMode;
  completedTasks: string[];
  failedTasks: string[];
  skippedTasks: string[];
  timedOutTasks: string[];
  warmedRoutes: string[];
  warmedAssets: string[];
  totalDurationMs: number;
  ready: boolean;
}

export interface StartupPreparationOptions {
  mode: StartupLoadingMode;
  currentRoute: string;
  signal: AbortSignal;
  prefetchRoute: (route: string) => void | Promise<void>;
  getLocalState: () => unknown;
  shouldOpenNow: () => boolean;
  onProgress?: (progress: StartupReadinessProgress) => void;
}

function taskErrorStatus(
  taskSignal: AbortSignal,
  parentSignal: AbortSignal,
): StartupTaskStatus {
  if (parentSignal.aborted) return "skipped";
  return taskSignal.reason === "timeout" ? "timed-out" : "failed";
}

function emitProgress(
  mode: StartupLoadingMode,
  tasks: StartupTaskRuntime[],
  onProgress?: StartupPreparationOptions["onProgress"],
): void {
  const totalWeight = tasks.reduce((sum, task) => sum + task.weight, 0);
  const completedWeight = tasks.reduce((sum, task) => {
    return ["completed", "failed", "skipped", "timed-out"].includes(task.status)
      ? sum + task.weight
      : sum;
  }, 0);
  const running = tasks.find((task) => task.status === "running");
  const criticalReady = tasks
    .filter((task) => task.priority === "critical")
    .every((task) => ["completed", "failed", "timed-out"].includes(task.status));
  onProgress?.({
    mode,
    message: running?.label ?? (criticalReady ? "Finalising Scholar" : "Preparing Scholar"),
    progress: totalWeight === 0 ? 1 : completedWeight / totalWeight,
    canOpenNow: criticalReady,
    tasks: tasks.map((task) => ({ ...task })),
  });
}

export async function prepareScholarStartup(
  options: StartupPreparationOptions,
): Promise<StartupReadinessResult> {
  const startedAt = performance.now();
  const tasks = createStartupTasks(options.mode);
  const warmedRoutes = new Set<string>();
  const warmedAssets = new Set<string>();
  const context: StartupContext = {
    mode: options.mode,
    currentRoute: options.currentRoute,
    prefetchRoute: options.prefetchRoute,
    getLocalState: options.getLocalState,
    warmedRoutes,
    warmedAssets,
  };
  const overallController = new AbortController();
  const relayAbort = () => overallController.abort();
  options.signal.addEventListener("abort", relayAbort, { once: true });
  const hardLimit = window.setTimeout(
    () => overallController.abort("hard-limit"),
    STARTUP_MODE_DEFINITIONS[options.mode].hardLimitMs,
  );

  emitProgress(options.mode, tasks, options.onProgress);
  try {
    const priorities = ["critical", "high", "normal", "optional"] as const;
    for (const priority of priorities) {
      const group = tasks.filter((task) => task.priority === priority);
      if (
        overallController.signal.aborted ||
        (options.shouldOpenNow() && priority !== "critical")
      ) {
        group.forEach((task) => {
          task.status = "skipped";
        });
        emitProgress(options.mode, tasks, options.onProgress);
        continue;
      }

      await Promise.all(group.map(async (task) => {
        task.status = "running";
        emitProgress(options.mode, tasks, options.onProgress);
        const taskStartedAt = performance.now();
        let taskSignal: AbortSignal | null = null;
        try {
          await withTaskTimeout(
            async (signal) => {
              taskSignal = signal;
              await task.run(context, signal);
            },
            task.timeoutMs,
            overallController.signal,
          );
          task.status = "completed";
        } catch (error) {
          task.status = taskErrorStatus(
            taskSignal ?? overallController.signal,
            overallController.signal,
          );
          task.error = error instanceof Error ? error.message : "Task did not complete";
        }
        task.durationMs = Math.round(performance.now() - taskStartedAt);
        emitProgress(options.mode, tasks, options.onProgress);
      }));
    }
  } finally {
    window.clearTimeout(hardLimit);
    options.signal.removeEventListener("abort", relayAbort);
  }

  const result: StartupReadinessResult = {
    mode: options.mode,
    completedTasks: tasks.filter((task) => task.status === "completed").map((task) => task.id),
    failedTasks: tasks.filter((task) => task.status === "failed").map((task) => task.id),
    skippedTasks: tasks.filter((task) => task.status === "skipped").map((task) => task.id),
    timedOutTasks: tasks.filter((task) => task.status === "timed-out").map((task) => task.id),
    warmedRoutes: [...warmedRoutes],
    warmedAssets: [...warmedAssets],
    totalDurationMs: Math.round(performance.now() - startedAt),
    ready: true,
  };
  writeStartupCache(result);

  if (process.env.NODE_ENV === "development") {
    console.info("[Scholar startup]", result);
    console.table(
      tasks.map((task) => ({
        task: task.id,
        status: task.status,
        durationMs: task.durationMs ?? 0,
      })),
    );
  }

  return result;
}

export function scheduleIdleStartupWork(work: () => void): () => void {
  const browserWindow = window as typeof window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (browserWindow.requestIdleCallback) {
    const id = browserWindow.requestIdleCallback(() => work(), { timeout: 4_000 });
    return () => browserWindow.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(work, 1_200);
  return () => window.clearTimeout(id);
}
