import { expect, test } from "@playwright/test";
import { DEFAULT_PREFERENCES } from "../src/lib/personalization/schema";

test.use({
  baseURL: process.env.SCHOLAR_QA_URL || "http://127.0.0.1:3000",
  launchOptions: { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" },
});
test.setTimeout(90_000);
test.beforeEach(async ({ page }) => {
  // Synthetic network fixtures only; never a production account/database.
  await page.route("**/api/**", route => route.abort("blockedbyclient"));
  await page.route("**/api/auth/config", route => route.fulfill({ json: { registrationEnabled: true, googleConfigured: false, passwordResetConfigured: false } }));
  await page.route("**/api/auth/session", route => route.fulfill({ json: { authenticated: false, developerMode: false } }));
  await page.addInitScript(() => localStorage.setItem("neha-scholar-v5", JSON.stringify({ schema: 6, state: { authed: false, guestMode: false, settings: { startupLoadingMode: "quick" } } })));
});

test("liquid wordmark follows readiness, then fades and releases the prepared page", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.route("**/api/auth/session", async route => {
    await new Promise(resolve => setTimeout(resolve, 1400));
    await route.fulfill({ json: { authenticated: false, developerMode: false } });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const splash = page.locator(".scholar-launch-overlay");
  await expect(splash).toBeVisible();
  expect(await splash.evaluate(el => getComputedStyle(el).backgroundColor)).toBe("rgb(0, 0, 0)");
  const panel = splash.locator(".scholar-launch-panel");
  expect(await panel.evaluate(el => ({ width: el.clientWidth, height: el.clientHeight }))).toEqual(page.viewportSize());
  await expect(splash.locator(".scholar-launch-background")).toHaveCount(0);
  await expect(splash.locator("clipPath text")).toHaveText("Scholar");
  await expect(splash.locator("video, canvas, [role=progressbar]")).toHaveCount(0);
  const path = splash.locator("[data-liquid-wave]");
  const initial = await path.getAttribute("d"); await page.waitForTimeout(100);
  expect(await path.getAttribute("d")).not.toBe(initial);
  expect(Number(await splash.getAttribute("data-startup-progress"))).toBeLessThan(100);
  // The real page is ready well before this, but the requested fluid reveal
  // must continue gradually instead of chasing completed tasks in 520 ms.
  await page.waitForTimeout(1900);
  await expect(splash).toBeVisible();
  const halfway = Number(await splash.getAttribute("data-liquid-fill"));
  expect(halfway).toBeGreaterThan(.15); expect(halfway).toBeLessThan(.85);
  await expect(splash).toHaveAttribute("data-content-ready", "true");
  const started = Number(await splash.getAttribute("data-fill-started-at"));
  await page.waitForFunction(() => document.querySelector<HTMLElement>(".scholar-launch-overlay")?.dataset.visible === "false");
  expect(await page.evaluate(time => performance.now() - time, started)).toBeGreaterThanOrEqual(4950);
  await expect(splash).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByRole("button", { name: "Continue as Guest", exact: true })).toBeVisible();
  expect(await page.locator(".scholar-auth-cta").evaluate(el => ({ opacity: getComputedStyle(el).opacity, filter: getComputedStyle(el).filter }))).toEqual({ opacity: "1", filter: "none" });
  expect(await page.locator(".scholar-auth-content h1 > span").first().evaluate(el => getComputedStyle(el).filter)).toBe("none");
  expect(errors).toEqual([]);
});

test("mobile reduced-motion wordmark stays static and never overflows", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/auth/session", async route => {
    await new Promise(resolve => setTimeout(resolve, 1000)); await route.fulfill({ json: { authenticated: false, developerMode: false } });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const splash = page.locator(".scholar-launch-overlay");
  await expect(splash).toHaveAttribute("data-phase", "static");
  const path = splash.locator("[data-liquid-wave]"), before = await path.getAttribute("d");
  await page.waitForTimeout(100); expect(await path.getAttribute("d")).toBe(before);
  expect(await splash.evaluate(element => element.scrollWidth <= innerWidth)).toBe(true);
  await expect(splash).toHaveCount(0, { timeout: 15000 });
});

test("reloads also use the requested five-second liquid reveal, without zoom", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("scholar:launch-seen:v1", "1"));
  await page.route("**/api/auth/session", async route => {
    await new Promise(resolve => setTimeout(resolve, 1000)); await route.fulfill({ json: { authenticated: false, developerMode: false } });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const splash = page.locator(".scholar-launch-overlay");
  await expect(splash).toHaveAttribute("data-startup-repeat", "true");
  await expect(splash).toHaveAttribute("data-phase", "filling");
  await page.waitForTimeout(3000);
  await expect(splash).toBeVisible();
  expect(Number(await splash.getAttribute("data-liquid-fill"))).toBeLessThan(1);
  await expect(splash).toHaveCount(0, { timeout: 15000 });
});

test("liquid pauses on a hidden-tab event and stops updating after cleanup", async ({ page }) => {
  await page.route("**/api/auth/session", async route => {
    await new Promise(resolve => setTimeout(resolve, 3000));
    await route.fulfill({ json: { authenticated: false, developerMode: false } });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const splash = page.locator(".scholar-launch-overlay");
  await expect(splash).toBeVisible();
  // Synthetic visibility events exercise the real controller, without assuming
  // that a headless browser can put a native OS window into the background.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const path = splash.locator("[data-liquid-wave]"), paused = await path.getAttribute("d");
  await page.waitForTimeout(150); expect(await path.getAttribute("d")).toBe(paused);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(100); expect(await path.getAttribute("d")).not.toBe(paused);
  await splash.evaluate(element => {
    const state = { mutations: 0 };
    (window as unknown as { loaderCleanup: typeof state }).loaderCleanup = state;
    new MutationObserver(list => { state.mutations += list.length; }).observe(element, { subtree: true, attributes: true, attributeFilter: ["d", "transform", "data-liquid-fill"] });
  });
  await expect(splash).toHaveCount(0, { timeout: 15000 });
  await page.waitForTimeout(50);
  const before = await page.evaluate(() => (window as unknown as { loaderCleanup: { mutations: number } }).loaderCleanup.mutations);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => (window as unknown as { loaderCleanup: { mutations: number } }).loaderCleanup.mutations)).toBe(before);
});

test("slow session check stays within the branded splash", async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.route("**/api/auth/session", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 7000));
    await route.fulfill({ json: { authenticated: false, developerMode: false } });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const splash = page.locator(".scholar-launch-overlay");
  await expect(splash).toBeVisible();
  await page.waitForTimeout(5500);
  await expect(splash).toBeVisible();
  await expect(splash).toContainText("Checking your Scholar session");
  await expect(splash).toBeHidden({ timeout: 15_000 });
  await expect(page.getByText("Checking your Scholar session…", { exact: true })).toHaveCount(0);
});

test("slow personalization load stays within the branded splash", async ({ page }) => {
  const email = "splash@example.test";
  await page.addInitScript((accountEmail) => {
    localStorage.setItem("scholar-workspace-owner-v1", accountEmail);
    localStorage.setItem("neha-scholar-v5", JSON.stringify({ schema: 6, state: {
      authed: true, guestMode: false, onboarded: true,
      user: { email: accountEmail, name: "Splash Tester", scholarClass: 11 },
      settings: { startupLoadingMode: "quick", reduceMotion: false },
    } }));
  }, email);
  await page.route("**/api/**", (route) => route.fulfill({ json: { ok: true, items: [], files: [], ebooks: [] } }));
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: {
    authenticated: true, developerMode: false, entitlementsLoaded: true,
    user: { id: "splash-owner", email, name: "Splash Tester", role: "USER", coins: 0, currentScholarClass: 11 },
    access: { plan: "FREE", source: "free", entitlementsLoaded: true, entitlements: [] },
  } }));
  await page.route("**/api/personalization", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 7000));
    await route.fulfill({ json: { required: false, status: "SKIPPED", stage: 0, revision: 0, preferences: DEFAULT_PREFERENCES, result: null, bonus: { total: 0, used: 0, closed: true }, jobStartedAt: null } });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const splash = page.locator(".scholar-launch-overlay");
  await expect(splash).toBeVisible();
  await page.waitForTimeout(5500);
  await expect(splash).toBeVisible();
  await expect(splash).toContainText("Opening your Scholar");
  await expect(splash).toBeHidden({ timeout: 15_000 });
  await expect(page.locator(".scholar-shell")).toBeVisible();
  await expect(page.getByText("Opening your Scholar…", { exact: true })).toHaveCount(0);
});
