import type {
  StartupLoadingMode,
  StartupTaskPriority,
  StartupTaskStatus,
} from "./startup-modes";
import {
  STARTUP_ROUTE_GROUPS,
  modeIncludes,
} from "./startup-modes";
import {
  getBrowserStartupProfile,
  preloadAndDecodeImage,
  preloadVideoFirstFrame,
  runWithConcurrency,
  waitForAnimationFrames,
  warmCurrentScrollSurface,
} from "./startup-performance";
import { isAssetWarm, isRouteWarm } from "./startup-cache";

export interface StartupContext {
  mode: StartupLoadingMode;
  currentRoute: string;
  prefetchRoute: (route: string) => void | Promise<void>;
  getLocalState: () => unknown;
  warmedRoutes: Set<string>;
  warmedAssets: Set<string>;
}

export interface StartupTask {
  id: string;
  label: string;
  minimumMode: StartupLoadingMode;
  priority: StartupTaskPriority;
  timeoutMs: number;
  weight: number;
  run: (context: StartupContext, signal: AbortSignal) => Promise<void>;
}

export interface StartupTaskRuntime extends StartupTask {
  status: StartupTaskStatus;
  durationMs?: number;
  error?: string;
}

const EBOOK_PAGE_DIRECTORIES = {
  "physics-pt1": "ebook-pages",
  "maths-pt1": "ebook-pages-maths",
  "chemistry-pt1": "ebook-pages-chemistry",
} as const;

const BACKGROUND_VIDEOS: Record<string, string> = {
  dashboard:
    "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260619_191346_9d19d66e-86a4-47f7-8dc6-712c1788c3b2.mp4",
  ebook:
    "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_064122_c4750c0e-7476-4b44-94a2-a85a65c63bf2.mp4",
  workspace:
    "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_204221_5339e40b-e73d-4ab0-9c65-79c18c66fd50.mp4",
};

function currentViewId(route: string): string {
  return route.split("/").filter(Boolean)[0] || "dashboard";
}

function persistedEbookAssets(mode: StartupLoadingMode): string[] {
  const assets = new Set<string>();
  const pageUrl = (directory: string, page: number) =>
    `/${directory}/page-${String(page).padStart(3, "0")}.png`;
  try {
    const selected =
      (localStorage.getItem("scholar:ebook:last-book") as keyof typeof EBOOK_PAGE_DIRECTORIES | null) ??
      "physics-pt1";
    const persisted = JSON.parse(localStorage.getItem("eb-reader-data") ?? "{}") as {
      lastPage?: number;
    };
    const directory = EBOOK_PAGE_DIRECTORIES[selected] ?? EBOOK_PAGE_DIRECTORIES["physics-pt1"];
    const lastPage =
      Number.isInteger(persisted.lastPage) && (persisted.lastPage ?? 0) > 0
        ? persisted.lastPage!
        : 1;
    assets.add(pageUrl(directory, lastPage));
    if (modeIncludes(mode, "long")) {
      assets.add(pageUrl("ebook-pages", 1));
      assets.add(pageUrl("ebook-pages-maths-clean", 1));
      assets.add(pageUrl("ebook-pages-chemistry-clean", 1));
    }
  } catch {
    assets.add(pageUrl("ebook-pages", 1));
  }
  return [...assets];
}

async function warmHeavyModules(mode: StartupLoadingMode): Promise<void> {
  const common = [
    () => import("@/components/ai/scholar-ai-content"),
    () => import("@/components/files/file-preview-modal"),
  ];
  const long = [
    () => import("@/components/views/ebook"),
    () => import("@/components/views/quiz"),
    () => import("@/components/views/mock-exam"),
  ];
  const full = [
    () => import("@/components/views/slideshow-maker"),
    () => import("@/components/views/notes"),
    () => import("@/components/views/community"),
    () => import("@/components/lam-widget"),
  ];
  const loaders = [
    ...common,
    ...(modeIncludes(mode, "long") ? long : []),
    ...(mode === "full" ? full : []),
  ];
  await Promise.all(loaders.map((load) => load().then(() => undefined)));
}

export function createStartupTasks(mode: StartupLoadingMode): StartupTaskRuntime[] {
  const tasks: StartupTask[] = [
    {
      id: "core-state",
      label: "Restoring your Scholar workspace",
      minimumMode: "quick",
      priority: "critical",
      timeoutMs: 4_000,
      weight: 4,
      run: async (context, signal) => {
        const state = context.getLocalState();
        if (!state || typeof state !== "object") throw new Error("Scholar state is unavailable");
        await waitForAnimationFrames(2, signal);
      },
    },
    {
      id: "interface",
      label: "Loading your academic profile",
      minimumMode: "quick",
      priority: "critical",
      timeoutMs: 2_500,
      weight: 3,
      run: async (_context, signal) => {
        await waitForAnimationFrames(2, signal);
        if (!document.documentElement || !document.body) {
          throw new Error("Scholar interface is unavailable");
        }
      },
    },
    {
      id: "poster",
      label: "Preparing the active workspace",
      minimumMode: "quick",
      priority: "critical",
      timeoutMs: 3_000,
      weight: 3,
      run: async (context, signal) => {
        const poster = "/backgrounds/scholar-poster.svg";
        if (!isAssetWarm(poster)) await preloadAndDecodeImage(poster, signal);
        context.warmedAssets.add(poster);
      },
    },
    {
      id: "fonts",
      label: "Preparing fonts and icons",
      minimumMode: "short",
      priority: "high",
      timeoutMs: 3_000,
      weight: 2,
      run: async () => {
        if ("fonts" in document) await document.fonts.ready;
      },
    },
    {
      id: "active-background",
      label: "Loading background media",
      minimumMode: "short",
      priority: "high",
      timeoutMs: 5_000,
      weight: 3,
      run: async (context, signal) => {
        const profile = getBrowserStartupProfile();
        const video = BACKGROUND_VIDEOS[currentViewId(context.currentRoute)];
        if (!video || profile.saveData || profile.slowConnection) return;
        if (!isAssetWarm(video)) await preloadVideoFirstFrame(video, signal);
        context.warmedAssets.add(video);
      },
    },
    {
      id: "ebook-current-page",
      label: "Preparing ebooks",
      minimumMode: "short",
      priority: "high",
      timeoutMs: 6_000,
      weight: 3,
      run: async (context, signal) => {
        const profile = getBrowserStartupProfile();
        const assets = persistedEbookAssets(context.mode);
        await runWithConcurrency(
          assets,
          profile.concurrency,
          async (asset) => {
            if (!isAssetWarm(asset)) await preloadAndDecodeImage(asset, signal);
            context.warmedAssets.add(asset);
          },
          signal,
        );
      },
    },
    {
      id: "route-shells",
      label: "Warming up study tools",
      minimumMode: "short",
      priority: "normal",
      timeoutMs: mode === "full" ? 7_000 : 4_500,
      weight: mode === "full" ? 5 : 4,
      run: async (context, signal) => {
        const profile = getBrowserStartupProfile();
        const current = context.currentRoute === "/" ? "/dashboard" : context.currentRoute;
        const routes = [...new Set([current, ...STARTUP_ROUTE_GROUPS[context.mode]])];
        const pending = routes.filter((route) => !isRouteWarm(route));
        await runWithConcurrency(
          pending,
          profile.concurrency,
          async (route) => {
            if (signal.aborted || document.hidden) return;
            await context.prefetchRoute(route);
            context.warmedRoutes.add(route);
          },
          signal,
        );
        routes.forEach((route) => context.warmedRoutes.add(route));
      },
    },
    {
      id: "heavy-renderers",
      label: mode === "full" ? "Warming up AI and file tools" : "Preparing common tools",
      minimumMode: "long",
      priority: "normal",
      timeoutMs: mode === "full" ? 7_000 : 4_000,
      weight: 4,
      run: async (context) => {
        // Module imports only: no AI requests, media playback, microphone or component side effects.
        await warmHeavyModules(context.mode);
      },
    },
    {
      id: "scroll-surface",
      label: "Preparing smooth scrolling",
      minimumMode: "long",
      priority: "normal",
      timeoutMs: 4_500,
      weight: 4,
      run: async (_context, signal) => {
        await warmCurrentScrollSurface(signal);
      },
    },
    {
      id: "optional-media",
      label: "Optimising your workspace",
      minimumMode: "full",
      priority: "optional",
      timeoutMs: 6_000,
      weight: 2,
      run: async (context, signal) => {
        const profile = getBrowserStartupProfile();
        if (profile.mobile || profile.saveData || profile.slowConnection) return;
        const active = currentViewId(context.currentRoute);
        const candidates = Object.entries(BACKGROUND_VIDEOS)
          .filter(([id]) => id !== active)
          .slice(0, 1);
        for (const [, video] of candidates) {
          if (!isAssetWarm(video)) await preloadVideoFirstFrame(video, signal);
          context.warmedAssets.add(video);
        }
      },
    },
  ];

  return tasks
    .filter((task) => modeIncludes(mode, task.minimumMode))
    .map((task) => ({ ...task, status: "pending" }));
}
