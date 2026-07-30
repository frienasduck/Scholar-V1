import { expect, test, type Page } from "@playwright/test";

test.use({
  baseURL: "http://127.0.0.1:3000",
  viewport: { width: 1440, height: 1000 },
  launchOptions: {
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  },
});
test.setTimeout(120_000);

async function waitForGate(page: Page) {
  const gate = page.locator("[data-startup-mode]");
  await expect(gate).toBeVisible({ timeout: 30_000 });
  return gate;
}

async function createClass11Profile(page: Page) {
  await expect(page.getByRole("button", { name: "Start Your Journey" })).toBeVisible({
    timeout: 25_000,
  });
  await page.getByRole("button", { name: "Start Your Journey" }).click();
  await page.getByRole("button", { name: /Class 11/ }).last().click();
  await page.getByPlaceholder("Ishan").fill("Ishan");
  await page.getByPlaceholder("you@scholar.app").fill("startup-test@scholar.app");
  await page.locator('input[type="password"]').fill("local-startup-test");
  await page.getByRole("button", { name: "Create Account" }).click();
  const skip = page.getByRole("button", { name: "Skip intro" });
  await expect(skip).toBeVisible({ timeout: 20_000 });
  await skip.click({ force: true });
  await page.waitForFunction(() => {
    try {
      const persisted = JSON.parse(localStorage.getItem("neha-scholar-v5") ?? "null");
      return persisted?.state?.authed === true && persisted?.state?.onboarded === true;
    } catch {
      return false;
    }
  });
}

test("desktop startup performs real preparation and exposes persisted mode settings", async ({
  page,
}) => {
  const fatalErrors: string[] = [];
  const forbiddenStartupRequests: string[] = [];
  let startupFinished = false;
  page.on("pageerror", (error) => fatalErrors.push(error.message));
  page.on("request", (request) => {
    if (
      !startupFinished &&
      /\/api\/(?:ai|lam|ai-image)(?:\/|$)/.test(new URL(request.url()).pathname)
    ) {
      forbiddenStartupRequests.push(request.url());
    }
  });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("startup-browser-initialised")) {
      localStorage.clear();
      sessionStorage.setItem("startup-browser-initialised", "true");
    }
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const startupStartedAt = Date.now();
  const gate = await waitForGate(page);
  await expect(gate).toHaveAttribute("data-startup-mode", "long");
  await expect(page.getByRole("button", { name: "Open now" })).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  expect(await page.evaluate(() => document.getElementById("main-scroll")?.scrollTop ?? 0)).toBe(0);
  await page.screenshot({
    path: "test-artifacts/startup-long-desktop.png",
  });

  await expect(gate).toBeHidden({ timeout: 20_000 });
  console.log(`[startup-browser] desktop long startup: ${Date.now() - startupStartedAt} ms`);
  startupFinished = true;
  expect(forbiddenStartupRequests).toEqual([]);
  expect(fatalErrors).toEqual([]);

  await createClass11Profile(page);
  const cachedStartupStartedAt = Date.now();
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  const cachedGate = await waitForGate(page);
  await expect(cachedGate).toBeHidden({ timeout: 20_000 });
  console.log(
    `[startup-browser] cached settings startup: ${Date.now() - cachedStartupStartedAt} ms`,
  );
  await page.getByRole("tab", { name: "Appearance" }).click();
  const startupSettings = page.getByTestId("startup-loading-settings");
  await expect(startupSettings).toBeVisible();
  await expect(
    startupSettings.getByRole("radio", { name: /Long/ }),
  ).toHaveAttribute("aria-checked", "true");
  await startupSettings.getByRole("radio", { name: /Full Loading/ }).click();
  await expect(
    startupSettings.getByRole("radio", { name: /Full Loading/ }),
  ).toHaveAttribute("aria-checked", "true");
  await startupSettings.screenshot({
    path: "test-artifacts/startup-settings-desktop.png",
  });
  const firstScrollFrameMs = await page.evaluate(async () => {
    const scroller = document.getElementById("main-scroll");
    if (!scroller) return -1;
    const startedAt = performance.now();
    scroller.scrollTop = Math.min(600, scroller.scrollHeight - scroller.clientHeight);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const duration = performance.now() - startedAt;
    scroller.scrollTop = 0;
    return duration;
  });
  console.log(`[startup-browser] first scroll two-frame latency: ${firstScrollFrameMs.toFixed(1)} ms`);
  expect(fatalErrors).toEqual([]);
});

test("mobile startup remains bounded, stationary and manually skippable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fatalErrors: string[] = [];
  page.on("pageerror", (error) => fatalErrors.push(error.message));
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const startupStartedAt = Date.now();
  const gate = await waitForGate(page);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await page.screenshot({
    path: "test-artifacts/startup-long-mobile.png",
  });

  const openNow = page.getByRole("button", { name: "Open now" });
  await expect(openNow).toBeEnabled({ timeout: 8_000 });
  await openNow.click();
  await expect(gate).toBeHidden({ timeout: 8_000 });
  console.log(`[startup-browser] mobile open-now startup: ${Date.now() - startupStartedAt} ms`);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(fatalErrors).toEqual([]);
});
