export type StartupLoadingMode = "quick" | "short" | "long" | "full";

export type StartupTaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "timed-out";

export type StartupTaskPriority = "critical" | "high" | "normal" | "optional";

export interface StartupModeDefinition {
  id: StartupLoadingMode;
  label: string;
  badge?: "Current" | "Default" | "Recommended";
  description: string;
  hardLimitMs: number;
  routeLimit: number;
}

export const STARTUP_MODE_DEFINITIONS: Record<StartupLoadingMode, StartupModeDefinition> = {
  quick: {
    id: "quick",
    label: "Quick",
    description:
      "Open Scholar as quickly as possible. Only essential interface data and the active page are prepared.",
    hardLimitMs: 3_000,
    routeLimit: 1,
  },
  short: {
    id: "short",
    label: "Short",
    badge: "Current",
    description:
      "Uses Scholar's current startup loading behaviour with basic asset and page preparation.",
    hardLimitMs: 5_000,
    routeLimit: 2,
  },
  long: {
    id: "long",
    label: "Long",
    badge: "Default",
    description:
      "Preloads the active workspace, key backgrounds, common routes, and below-the-fold content for smoother use.",
    hardLimitMs: 10_000,
    routeLimit: 7,
  },
  full: {
    id: "full",
    label: "Full Loading",
    badge: "Recommended",
    description:
      "Thoroughly prepares Scholar's routes, background media, major tools, and scroll-heavy sections before opening.",
    hardLimitMs: 18_000,
    routeLimit: 15,
  },
};

export const STARTUP_ROUTE_GROUPS: Record<StartupLoadingMode, string[]> = {
  quick: [],
  short: ["/dashboard"],
  long: [
    "/dashboard",
    "/files",
    "/ebook",
    "/ai-tools",
    "/settings",
    "/quiz",
    "/mock-exam",
  ],
  full: [
    "/dashboard",
    "/files",
    "/ebook",
    "/ai-tools",
    "/notes",
    "/flashcards",
    "/quiz",
    "/mock-exam",
    "/community",
    "/resources",
    "/downloads",
    "/settings",
    "/workspace",
    "/exam-prep",
    "/revision-hub",
  ],
};

export function normaliseStartupMode(value: unknown): StartupLoadingMode {
  return value === "quick" || value === "short" || value === "long" || value === "full"
    ? value
    : "long";
}

/** Optional idle work honors the selected mode, current route and bandwidth.
 * In particular, a repeat visit's Quick mode must not secretly warm Full mode. */
export function startupIdleRoutes(mode: StartupLoadingMode, currentRoute: string, warmed: readonly string[] = [], profile: { mobile?: boolean; saveData?: boolean; slowConnection?: boolean } = {}): string[] {
  if (mode === "quick" || profile.saveData || profile.slowConnection) return [];
  const current = currentRoute === "/" ? "/dashboard" : currentRoute;
  const limit = profile.mobile ? 1 : mode === "full" ? 4 : mode === "long" ? 2 : 1;
  return STARTUP_ROUTE_GROUPS[mode].filter(route => route !== current && !warmed.includes(route)).slice(0, limit);
}

export function startupModuleTargets(mode: StartupLoadingMode, route: string): string[] {
  // Full is a deliberate opt-in. Other modes prepare the active feature, not
  // unrelated PDF, quiz and presentation implementations before first use.
  if (mode === "full") return ["academic", "files", "ebook", "quiz", "mock", "slides", "notes", "community", "lam"];
  const view = route.split("/").filter(Boolean)[0] ?? "dashboard";
  const targets: string[] = [];
  if (["live-tutor", "ai-tutor", "ai-tools", "chapter-command", "exam-prep", "study", "practice", "quiz", "mock-exam", "ebook", "notes", "canvas"].includes(view)) targets.push("academic");
  if (view === "files") targets.push("files");
  if (view === "ebook") targets.push("ebook");
  if (view === "quiz") targets.push("quiz");
  if (view === "mock-exam") targets.push("mock");
  return targets;
}

export function startupModeRank(mode: StartupLoadingMode): number {
  return ["quick", "short", "long", "full"].indexOf(mode);
}

export function modeIncludes(
  selectedMode: StartupLoadingMode,
  requiredMode: StartupLoadingMode,
): boolean {
  return startupModeRank(selectedMode) >= startupModeRank(requiredMode);
}
