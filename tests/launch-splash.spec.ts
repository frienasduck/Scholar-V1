import { expect, test } from "@playwright/test";
import { DEFAULT_PREFERENCES } from "../src/lib/personalization/schema";

test.use({
  baseURL: "http://127.0.0.1:3000",
  launchOptions: { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" },
});

test("initial splash is branded, bounded, and dissolves after readiness", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.clear();
    const timing = { shown: 0, hidden: 0 };
    Object.assign(window, { __scholarSplashTiming: timing });
    const observer = new MutationObserver(() => {
      const splash = document.querySelector('.scholar-launch-overlay');
      if (!splash) return;
      if (!timing.shown) timing.shown = performance.now();
      if (splash.getAttribute('data-visible') === 'false' && !timing.hidden) timing.hidden = performance.now();
    });
    observer.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-visible'] });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const splash = page.locator(".scholar-launch-overlay");
  await expect(splash).toBeVisible();
  await expect(splash.getByRole("heading", { name: "Scholar" })).toBeVisible();
  await expect(splash.getByRole("progressbar", { name: "Scholar startup progress" })).toBeVisible();
  expect(parseFloat(await splash.evaluate((element) => getComputedStyle(element).transitionDuration))).toBeGreaterThanOrEqual(0.5);
  await expect(splash).toBeHidden({ timeout: 20_000 });
  const timing = await page.evaluate(() => (window as Window & { __scholarSplashTiming?: { shown: number; hidden: number } }).__scholarSplashTiming);
  expect(timing?.hidden && timing.hidden - timing.shown).toBeGreaterThanOrEqual(1750);
  expect(errors).toEqual([]);
});

test("mobile reduced-motion splash remains readable without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const splash = page.locator(".scholar-launch-overlay");
  await expect(splash).toBeVisible();
  const metrics = await splash.evaluate((element) => ({
    animation: getComputedStyle(element.querySelector(".scholar-launch-emblem")!).animationDuration,
    width: element.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(parseFloat(metrics.animation)).toBeLessThan(0.01);
  expect(metrics.width).toBeLessThanOrEqual(metrics.viewport);
  await expect(splash).toBeHidden({ timeout: 20_000 });
});

test("slow session check stays within the branded splash", async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.route("**/api/auth/session", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await route.fulfill({ json: { authenticated: false, developerMode: false } });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const splash = page.locator(".scholar-launch-overlay");
  await expect(splash).toBeVisible();
  await page.waitForTimeout(2200);
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
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await route.fulfill({ json: { required: false, status: "SKIPPED", stage: 0, revision: 0, preferences: DEFAULT_PREFERENCES, result: null, bonus: { total: 0, used: 0, closed: true }, jobStartedAt: null } });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const splash = page.locator(".scholar-launch-overlay");
  await expect(splash).toBeVisible();
  await page.waitForTimeout(2200);
  await expect(splash).toBeVisible();
  await expect(splash).toContainText("Opening your Scholar");
  await expect(splash).toBeHidden({ timeout: 15_000 });
  await expect(page.locator(".scholar-shell")).toBeVisible();
  await expect(page.getByText("Opening your Scholar…", { exact: true })).toHaveCount(0);
});
