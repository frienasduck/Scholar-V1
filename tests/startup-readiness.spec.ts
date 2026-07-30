import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("startup modes are persisted with Long as the default", () => {
  const store = read("src/lib/store.ts");
  const modes = read("src/lib/startup/startup-modes.ts");
  const settings = read("src/components/views/settings.tsx");

  expect(store).toContain('startupLoadingMode: "long" as const');
  expect(modes).toContain('label: "Quick"');
  expect(modes).toContain('badge: "Current"');
  expect(modes).toContain('badge: "Default"');
  expect(modes).toContain('badge: "Recommended"');
  expect(settings).toContain('data-testid="startup-loading-settings"');
  expect(settings).toContain('role="radiogroup"');
});

test("readiness is task-based, bounded, cancellable and truthful", () => {
  const controller = read("src/lib/startup/startup-controller.ts");
  const tasks = read("src/lib/startup/startup-tasks.ts");
  const gate = read("src/components/launch-readiness-gate.tsx");

  expect(controller).toContain("prepareScholarStartup");
  expect(controller).toContain("hardLimitMs");
  expect(controller).toContain("withTaskTimeout");
  expect(controller).toContain("completedWeight / totalWeight");
  expect(gate).toContain("Open now");
  expect(gate).toContain("progress.canOpenNow");
  expect(gate).not.toMatch(/setTimeout\(\(\)\s*=>\s*setVisible/);
  expect(tasks).toContain("prefetchRoute");
  expect(tasks).toContain("warmCurrentScrollSurface");
  expect(tasks).toContain("preloadVideoFirstFrame");
});

test("startup warm-up has no AI, microphone, audio, analytics or progress side effects", () => {
  const startupSource = fs
    .readdirSync(path.join(root, "src/lib/startup"))
    .filter((name) => name.endsWith(".ts"))
    .map((name) => read(`src/lib/startup/${name}`))
    .join("\n");

  for (const forbidden of [
    "/api/ai",
    "GROQ_API_KEY",
    "NVIDIA_API_KEY",
    "GEMINI_API_KEY",
    "getUserMedia",
    "SpeechRecognition",
    "AudioContext",
    "speechSynthesis",
    "addXP(",
    "setStudyProgress(",
    "WebSocket",
  ]) {
    expect(startupSource).not.toContain(forbidden);
  }
  expect(startupSource).not.toMatch(/\.(play|scrollTo)\(/);
  expect(startupSource).toContain("scrollRoot.scrollTop = 0");

  const shell = read("src/components/app-shell.tsx");
  expect(shell).toContain("useScholarStartupReady");
  expect(shell).toContain("startupReady ? <LamWidget");
});

test("background videos retain a poster until usable playback", () => {
  const readyVideo = read("src/components/ready-background-video.tsx");
  expect(readyVideo).toContain('poster = "/backgrounds/scholar-poster.svg"');
  expect(readyVideo).toContain("onPlaying");
  expect(readyVideo).toContain("onStalled");
  expect(readyVideo).toContain('announceReady("poster")');

  const viewDir = path.join(root, "src/components/views");
  const missingPosters: string[] = [];
  for (const file of fs.readdirSync(viewDir).filter((name) => name.endsWith(".tsx"))) {
    const source = fs.readFileSync(path.join(viewDir, file), "utf8");
    for (const match of source.matchAll(/<video[\s\S]*?>/g)) {
      if (match[0].includes("absolute inset-0") && !match[0].includes("poster=")) {
        missingPosters.push(file);
      }
    }
  }
  expect(missingPosters).toEqual([]);
});

test("startup cache is versioned and route warm-up is mode-specific", () => {
  const cache = read("src/lib/startup/startup-cache.ts");
  const modes = read("src/lib/startup/startup-modes.ts");
  expect(cache).toContain("appBuildId");
  expect(cache).toContain("warmedRoutes");
  expect(cache).toContain("warmedAssets");
  expect(cache).toContain("MAX_CACHE_AGE_MS");
  expect(modes).toContain('quick: []');
  expect(modes).toContain('"/files"');
  expect(modes).toContain('"/ebook"');
  expect(modes).toContain('"/ai-tools"');
  expect(modes).toContain('"/mock-exam"');
});
