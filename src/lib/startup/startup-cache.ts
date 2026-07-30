import type { StartupLoadingMode } from "./startup-modes";

const CACHE_KEY = "scholar:startup:warm-cache:v2";
const CACHE_VERSION = 2;
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1_000;

export interface StartupCacheMarker {
  version: number;
  appBuildId: string;
  mode: StartupLoadingMode;
  warmedRoutes: string[];
  warmedAssets: string[];
  warmedAt: number;
}

function currentBuildId(): string {
  return (
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_APP_BUILD_ID ||
    "scholar-local-v2"
  );
}

export function readStartupCache(): StartupCacheMarker | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") as StartupCacheMarker | null;
    if (
      !parsed ||
      parsed.version !== CACHE_VERSION ||
      parsed.appBuildId !== currentBuildId() ||
      Date.now() - parsed.warmedAt > MAX_CACHE_AGE_MS
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeStartupCache(input: {
  mode: StartupLoadingMode;
  warmedRoutes: string[];
  warmedAssets: string[];
}): void {
  if (typeof window === "undefined") return;
  try {
    const previous = readStartupCache();
    const marker: StartupCacheMarker = {
      version: CACHE_VERSION,
      appBuildId: currentBuildId(),
      mode: input.mode,
      warmedRoutes: [...new Set([...(previous?.warmedRoutes ?? []), ...input.warmedRoutes])],
      warmedAssets: [...new Set([...(previous?.warmedAssets ?? []), ...input.warmedAssets])],
      warmedAt: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(marker));
  } catch {
    // Cache warm-up is an optional optimisation. Storage restrictions must not block startup.
  }
}

export function isRouteWarm(route: string): boolean {
  return readStartupCache()?.warmedRoutes.includes(route) ?? false;
}

export function isAssetWarm(asset: string): boolean {
  return readStartupCache()?.warmedAssets.includes(asset) ?? false;
}
