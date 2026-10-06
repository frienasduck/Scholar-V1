import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import sharp from "sharp";
import { LAM_AVATARS } from "../src/lib/lam/identity";
import { serverLamPresence } from "../src/lib/lam/presence";
import { selectLamActivity, selectLamAvatar } from "../src/lib/lam/presentation-selectors";
import { createVisibleClock } from "../src/lib/time/visible-clock";
import { musicDefaults, useMusicStore } from "../src/lib/music-store";
import { dialogMutationRelevant } from "../src/lib/study-music/dialog-mutations";
import { startupIdleRoutes, startupModuleTargets } from "../src/lib/startup/startup-modes";
import { shouldIntentPrefetch } from "../src/lib/navigation/intent-prefetch";

describe("Intent-aware optional startup prefetch", () => {
  test("Long warms actual active teaching but no unrelated Dashboard renderers", () => {
    expect(startupModuleTargets("long", "/")).toEqual([]);
    expect(startupModuleTargets("long", "/exam-prep")).toContain("academic");
    expect(startupModuleTargets("long", "/ebook")).toEqual(["academic", "ebook"]);
  });
  test("the explicit Full Loading preparation feature keeps all its implementations", () => {
    expect(startupModuleTargets("full", "/")).toEqual(["academic", "files", "ebook", "quiz", "mock", "slides", "notes", "community", "lam"]);
  });
  test("footer intent keeps navigation intact without prefetching external, current or metered destinations", () => {
    expect(shouldIntentPrefetch("/ebook", "/")).toBe(true);
    for (const href of ["/", "//elsewhere.test", "https://elsewhere.test"]) expect(shouldIntentPrefetch(href, "/")).toBe(false);
    for (const options of [{ hidden: true }, { saveData: true }, { effectiveType: "3g" }]) expect(shouldIntentPrefetch("/ebook", "/", options)).toBe(false);
  });
  test("Quick opens only the active page and never schedules Full-mode extras", () => {
    expect(startupIdleRoutes("quick", "/")).toEqual([]);
    expect(startupIdleRoutes("short", "/")).toEqual([]);
  });
  test("known routes are not refetched and desktop budgets remain bounded", () => {
    expect(startupIdleRoutes("full", "/", ["/files", "/ebook"]).length).toBe(4);
    expect(startupIdleRoutes("long", "/", []).length).toBe(2);
    expect(startupIdleRoutes("full", "/", ["/files"])).not.toContain("/files");
  });
  test("mobile prefetch is bounded, not a forced visual downgrade", () => {
    expect(startupIdleRoutes("full", "/", [], { mobile: true })).toHaveLength(1);
  });
  test("Data Saver and slow connections avoid optional bandwidth", () => {
    expect(startupIdleRoutes("full", "/", [], { saveData: true })).toEqual([]);
    expect(startupIdleRoutes("full", "/", [], { slowConnection: true })).toEqual([]);
  });
});

function clockFixture() {
  let now = 1000, visible = true, timers = 0, handlers = 0;
  let tick: (() => void) | undefined, change: (() => void) | undefined;
  const clock = createVisibleClock({ now: () => now, visible: () => visible,
    everySecond(fn) { timers++; tick = fn; return () => { timers--; tick = undefined; }; },
    onVisibility(fn) { handlers++; change = fn; return () => { handlers--; change = undefined; }; },
  });
  return { clock, stats: () => ({ timers, handlers }), advance(value: number) { now = value; tick?.(); }, visibility(value: boolean, valueNow: number) { visible = value; now = valueNow; change?.(); } };
}
describe("Display-only clock", () => {
  test("multiple displays share exactly one interval and visibility listener", () => {
    const f = clockFixture(); let calls = 0;
    const off = [1,2,3].map(() => f.clock.subscribe(() => calls++));
    expect(f.stats()).toEqual({ timers: 1, handlers: 1 });
    f.advance(2000); expect(f.clock.getSnapshot()).toBe(2000); expect(calls).toBe(4);
    off.forEach(fn => fn()); expect(f.stats()).toEqual({ timers: 0, handlers: 0 });
  });
  test("hidden tabs stop ticks and returning uses the real timestamp, not drift", () => {
    const f = clockFixture(); const off = f.clock.subscribe(() => {});
    f.visibility(false, 2000); expect(f.stats().timers).toBe(0);
    f.advance(100000); expect(f.clock.getSnapshot()).toBe(1000);
    f.visibility(true, 100000); expect(f.clock.getSnapshot()).toBe(100000); expect(f.stats().timers).toBe(1); off();
  });
  test("a display mounted while hidden starts no timer until visible", () => {
    const f = clockFixture(); f.visibility(false, 0); const off = f.clock.subscribe(() => {});
    expect(f.stats().timers).toBe(0); f.visibility(true, 12000); expect(f.clock.getSnapshot()).toBe(12000); off();
  });
  test("last-unsubscribe cleanup is idempotent and resubscription works", () => {
    const f = clockFixture(); const off = f.clock.subscribe(() => {}); off(); off();
    expect(f.stats()).toEqual({ timers: 0, handlers: 0 });
    const again = f.clock.subscribe(() => {}); expect(f.stats().timers).toBe(1); again();
  });
});
describe("Avatar subscriptions and source-preserving assets", () => {
  test("every derivative is pixel-identical to its approved source crop", async () => {
    for (const a of LAM_AVATARS) {
      const [left, top, width, height] = a.crop;
      const original = await sharp(`public${a.asset}`).extract({ left, top, width, height }).ensureAlpha().raw().toBuffer();
      const derivative = await sharp(`public${a.renderAsset}`).ensureAlpha().raw().toBuffer();
      expect(Buffer.compare(original, derivative)).toBe(0);
    }
  });
  test("only small crop dimensions, never a source sheet, reach the avatar image", async () => {
    for (const a of LAM_AVATARS) {
      const size = await sharp(`public${a.renderAsset}`).metadata();
      expect(size.width).toBe(a.crop[2]); expect(size.height).toBe(a.crop[3]);
      expect(size.width!).toBeLessThanOrEqual(320); expect(size.height!).toBeLessThanOrEqual(291);
    }
  });
  test("other owners and route context cannot invalidate static gallery art", () => {
    const p = serverLamPresence();
    expect(selectLamAvatar(p, "idle", "gallery", false)).toEqual(selectLamAvatar({ ...p, state: "thinking", target: "input", context: "other", activities: { other: "thinking" }, reaction: { owner: "other", state: "thinking", phase: "major", variant: 2 } }, "idle", "gallery", false));
  });
  test("header state, error, reduced motion, urgency and finite reactions remain live", () => {
    const p = { ...serverLamPresence(), state: "wake" as const, hidden: true, reduced: true, urgency: "urgent" as const, reaction: { owner: "wake", state: "wake" as const, phase: "micro", variant: 0 } };
    expect(selectLamAvatar(p, undefined, "header", true)).toMatchObject({ state: "wake", hidden: true, reduced: true, urgency: "urgent", reactionLevel: 0 });
    expect(selectLamAvatar({ ...p, state: "error", reaction: null }, "idle", "header", true).state).toBe("error");
  });
  test("owner feedback still settles while a higher-priority teacher is active", () => {
    const p = { ...serverLamPresence(), state: "teaching" as const, activities: { lesson: "attentive" as const } };
    expect(selectLamActivity(p, "lesson", "happy")).toBe("attentive"); expect(selectLamActivity(p, "header", "idle")).toBe("teaching");
  });
});
describe("Media telemetry and modal inspection", () => {
  test("120 duplicate duration polls emit one update instead of 120", () => {
    useMusicStore.setState(musicDefaults()); let updates = 0;
    const off = useMusicStore.subscribe(() => updates++);
    for (let i = 0; i < 120; i++) useMusicStore.getState().setDuration(180);
    off(); expect(updates).toBe(1); expect(useMusicStore.getState().duration).toBe(180);
  });
  test("changed telemetry and invalid-number protection are preserved", () => {
    const s = useMusicStore.getState(); s.setCurrentTime(21); expect(useMusicStore.getState().currentTime).toBe(21);
    s.setCurrentTime(Infinity); expect(useMusicStore.getState().currentTime).toBe(0);
    s.setDuration(NaN); expect(useMusicStore.getState().duration).toBe(0);
    s.setBuffering(true); s.setPlaying(true); expect(useMusicStore.getState()).toMatchObject({ buffering: true, isPlaying: true });
  });
  test("chat/progress text does not rescan the document for modals", () => {
    const text = { nodeType: 3 } as Node;
    const plain = { nodeType: 1, matches: () => false, querySelector: () => null } as unknown as Element;
    expect(dialogMutationRelevant([{ type: "childList", addedNodes: [text, plain], removedNodes: [], target: plain }] as unknown as MutationRecord[])).toBe(false);
  });
  test("dialog opening, closing and attribute changes remain detected", () => {
    const dialog = { nodeType: 1, matches: () => true, querySelector: () => null } as unknown as Element;
    for (const record of [{ type: "attributes", target: dialog }, { type: "childList", addedNodes: [dialog], removedNodes: [] }, { type: "childList", addedNodes: [], removedNodes: [dialog] }]) expect(dialogMutationRelevant([record] as unknown as MutationRecord[])).toBe(true);
  });
});
function workerFixture() {
  const handlers: Record<string, (e: unknown) => void> = {};
  const puts: string[] = [];
  runInNewContext(readFileSync("public/sw.js", "utf8"), { URL, self: { location: { hostname: "scholar.test" }, clients: { claim() {} }, skipWaiting() {}, addEventListener: (name: string, fn: (e: unknown) => void) => handlers[name] = fn }, fetch: async () => ({ ok: true, type: "basic", clone: () => ({}) }), caches: { match: async () => undefined, open: async () => ({ put: async (request: {url:string}) => puts.push(request.url) }) } });
  return { puts, async fetch(path: string, mode = "cors", method = "GET") { let result: Promise<unknown> | undefined; handlers.fetch({ request: { url: `https://scholar.test${path}`, method, mode }, respondWith: (p: Promise<unknown>) => result = p }); await result; await Promise.resolve(); return !!result; } };
}
describe("Service worker caches public static assets only", () => {
  test("account routes, RSC payloads and APIs are never placed in cache", async () => {
    const f = workerFixture();
    for (const route of ["/settings?_rsc=abc", "/group-study/private?_rsc=xyz", "/api/ebooks/private?file=1", "/api/auth/session", "/_next/image?url=%2Fapi%2Ffiles"]) expect(await f.fetch(route)).toBe(false);
    expect(f.puts).toHaveLength(0);
  });
  test("hashed chunks, approved artwork and public scans retain offline caching", async () => {
    const f = workerFixture();
    for (const asset of ["/_next/static/chunks/example.js", "/lam/identity/avatars/aurora.webp", "/backgrounds/example.mp4", "/ebook-pages/page-1.webp"]) expect(await f.fetch(asset)).toBe(true);
    expect(f.puts).toHaveLength(4);
  });
  test("navigation remains network-only, and POST is ignored", async () => {
    const f = workerFixture(); expect(await f.fetch("/settings", "navigate")).toBe(true); expect(f.puts).toHaveLength(0);
    expect(await f.fetch("/api/lam/chat", "cors", "POST")).toBe(false);
  });
});
