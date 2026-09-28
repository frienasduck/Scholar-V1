import { expect, test } from "@playwright/test";

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
