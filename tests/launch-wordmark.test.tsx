import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LaunchSplash } from "../src/components/launch-splash";
import { launchFillTarget, launchFillY, launchReadinessProgress, launchTimedFill, liquidWordmarkPath, WORDMARK_EXIT, WORDMARK_FILL_DURATION } from "../src/lib/animation/launch-wordmark";
import { readFileSync } from "node:fs";

test("task progress can never visually certify whole-app readiness", () => {
  for (const progress of [0, .25, .5, .75, .92, 1, 100]) expect(launchFillTarget(progress)!).toBeLessThanOrEqual(.92);
  expect(launchFillTarget(undefined)).toBeNull(); expect(launchFillTarget(NaN)).toBeNull();
  expect(launchFillTarget(Infinity)).toBeNull(); expect(launchFillTarget(-1)).toBe(0);
  expect(launchFillTarget(.1, true)).toBe(1);
  expect(launchFillY(0)).toBeGreaterThan(220 + 16);
  expect(launchFillY(.92) - 16).toBeGreaterThan(55); // visible charcoal cap, even at the wave crest
  expect(launchFillY(1)).toBeLessThan(45 - 16);
});

test("one smooth connected wave loops without a seam", () => {
  const a = liquidWordmarkPath(0), b = liquidWordmarkPath(Math.PI * 2);
  expect(a.match(/ C /g)).toHaveLength(12); expect(a).toEndWith("L 1040 560 L -40 560 Z");
  const numbers = (path: string) => path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  numbers(a).forEach((value, index) => expect(Math.abs(value - numbers(b)[index])).toBeLessThan(.01));
  expect(liquidWordmarkPath(.8)).not.toBe(a); expect(a).not.toContain("NaN");
});

test("the requested reveal takes five seconds with steady bottom-to-top travel", () => {
  expect(WORDMARK_FILL_DURATION).toBe(5000);
  for (const time of [0, 1000, 2000, 3000, 4000, 5000]) {
    expect(launchFillY(launchTimedFill(time, true))).toBeCloseTo(240 - time / 5000 * 216, 5);
    if (time < 5000) expect(launchTimedFill(time, true)).toBeLessThan(1);
  }
  expect(launchTimedFill(9000, false)).toBe(.92);
  expect(launchTimedFill(9000, true)).toBe(1);
});

test("session and profile boundaries reserve visible liquid headroom", () => {
  expect(launchReadinessProgress(0, false, false, false)).toBe(0);
  expect(launchReadinessProgress(1, false, false, false)).toBeCloseTo(.70);
  expect(launchReadinessProgress(1, true, true, false)).toBeCloseTo(.88);
  expect(launchReadinessProgress(1, true, true, true)).toBeCloseTo(.92);
  expect(launchReadinessProgress(1, true, false, false)).toBeCloseTo(.92);
  expect(readFileSync("src/lib/animation/launch-wordmark.ts", "utf8")).toContain("waapi.animate(root");
});

test("real launch markup is vector Scholar lettering, not a video/spinner/progress bar", () => {
  const html = renderToStaticMarkup(<LaunchSplash overlay progress={1} message="Checking your Scholar session…" />);
  expect(html).toContain("clipPath"); expect(html).toContain("data-liquid-wave"); expect(html).toContain("data-startup-progress=\"92\"");
  expect(html).toContain('fill="#383838"'); expect(html).toContain('fill="#fdfdfd"');
  expect(html).toContain('aria-live="polite"'); expect(html).toContain("Checking your Scholar session");
  expect(html).not.toMatch(/<video|<canvas|progressbar|NeoLeaf|scholar-launch-planet|feTurbulence|scholar-launch-background|radialGradient|linearGradient|wordmark-zoom/);
  expect(renderToStaticMarkup(<LaunchSplash overlay visible={false} />)).toContain("pointer-events:none");
  expect(renderToStaticMarkup(<LaunchSplash passive />)).toContain('data-passive="true"');
});

test("completion is short and the real shell/profile readiness guards remain", () => {
  expect(WORDMARK_EXIT.fill + WORDMARK_EXIT.fade).toBeLessThan(WORDMARK_EXIT.fallback);
  expect(readFileSync("src/lib/animation/launch-wordmark.ts", "utf8")).not.toContain("scale:");
  expect(WORDMARK_EXIT.fallback).toBeLessThan(400);
  const gate = readFileSync("src/components/launch-readiness-gate.tsx", "utf8");
  expect(gate).toContain("!startupSettled || !shellReady || (requiresProfile && !profileReady)");
  expect(gate).not.toContain("FIRST_LAUNCH_MINIMUM_MS"); expect(gate).not.toContain("1900");
  expect(gate).toContain("|| !minimumElapsed");
  expect(gate).toContain("WORDMARK_FILL_DURATION - (performance.now()");
  expect(gate).toContain("WORDMARK_EXIT.fallback");
  expect(gate.match(/<LaunchSplash /g)).toHaveLength(1);
});

test("the requested pure-black surface fills the viewport without an outer backdrop", () => {
  const css = readFileSync("src/components/launch-splash.css", "utf8");
  expect(css).toContain("background: #000;");
  expect(css).toContain("width: 100%; height: 100%;");
  expect(css).not.toContain("scholar-launch-background");
  expect(css).not.toMatch(/#111\b|gradient\(/);
});
