import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

test.use({
  baseURL: "http://127.0.0.1:3000",
  launchOptions: { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" },
  viewport: { width: 390, height: 844 },
});
test.setTimeout(120_000);

async function enterClass11(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Start Your Journey" }).click({ timeout: 90_000 });
  await page.getByRole("button", { name: /Class 11/ }).last().click();
  await page.getByPlaceholder("Ishan").fill("Ishan");
  await page.getByPlaceholder("you@scholar.app").fill("animation-performance@scholar.app");
  await page.locator('input[type="password"]').fill("local-test");
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.getByRole("button", { name: "Skip intro" }).click();
  await page.getByRole("button", { name: "LAM", exact: true }).click();
  if (await page.getByRole("heading", { name: "Meet LAM" }).isVisible().catch(() => false)) {
    const lam = page.getByLabel("LAM personal assistant");
    for (const label of ["Continue", "Continue", "Continue", "Start using LAM"]) {
      await lam.getByRole("button", { name: label }).click();
    }
  }
}

test("measure mobile LAM open and close", async ({ page }) => {
  await enterClass11(page);
  await page.getByLabel("Close LAM").click();
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    const measurements = {
      frameDeltas: [] as number[],
      longTasks: [] as number[],
      layoutShifts: [] as number[],
      startedAt: performance.now(),
    };
    let previous = performance.now();
    const sample = (now: number) => {
      measurements.frameDeltas.push(now - previous);
      previous = now;
      if (now - measurements.startedAt < 1_500) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) measurements.longTasks.push(entry.duration);
      }).observe({ type: "longtask", buffered: false });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
          if (!shift.hadRecentInput) measurements.layoutShifts.push(shift.value ?? 0);
        }
      }).observe({ type: "layout-shift", buffered: false });
    } catch {
      // Older engines may not expose these performance entry types.
    }
    (window as typeof window & { __scholarAnimeMeasurements?: typeof measurements }).__scholarAnimeMeasurements = measurements;
  });

  await page.getByLabel("LAM", { exact: true }).click();
  await page.waitForTimeout(900);
  const activeWhileOpen = await page.evaluate(() =>
    document.querySelector('[aria-label="LAM personal assistant"]')?.getAnimations({ subtree: true }).filter((animation) => animation.playState === "running").length ?? 0,
  );
  await page.getByLabel("Close LAM").click();
  await page.waitForTimeout(650);

  const result = await page.evaluate((openAnimations) => {
    const measurements = (window as typeof window & {
      __scholarAnimeMeasurements?: {
        frameDeltas: number[];
        longTasks: number[];
        layoutShifts: number[];
      };
    }).__scholarAnimeMeasurements;
    const frames = measurements?.frameDeltas ?? [];
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      sampleFrames: frames.length,
      averageFrameDeltaMs: frames.length ? frames.reduce((sum, value) => sum + value, 0) / frames.length : 0,
      maxFrameDeltaMs: frames.length ? Math.max(...frames) : 0,
      framesOver32Ms: frames.filter((value) => value > 32).length,
      longTaskCount: measurements?.longTasks.length ?? 0,
      totalLongTaskMs: measurements?.longTasks.reduce((sum, value) => sum + value, 0) ?? 0,
      cumulativeLayoutShift: measurements?.layoutShifts.reduce((sum, value) => sum + value, 0) ?? 0,
      activeAnimationsWhileOpen: openAnimations,
      activeLamAnimationsAfterClose:
        document.querySelector('[aria-label="LAM personal assistant"]')?.getAnimations({ subtree: true }).filter((animation) => animation.playState === "running").length ?? 0,
      lamElementsRetainingWillChangeAfterClose:
        document.querySelector('[aria-label="LAM personal assistant"]')?.querySelectorAll<HTMLElement>('[style*="will-change"]')
          .length ?? 0,
    };
  }, activeWhileOpen);

  const suffix = process.env.SCHOLAR_ANIME_AFTER ? "after" : "before";
  mkdirSync("test-artifacts", { recursive: true });
  writeFileSync(`test-artifacts/anime-performance-${suffix}.json`, `${JSON.stringify(result, null, 2)}\n`, "utf8");
});

test("mobile LAM remains responsive with 4x CPU throttling", async ({ page, context }) => {
  const session = await context.newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  try {
    await enterClass11(page);
    await page.getByLabel("Close LAM").click();
    await page.waitForTimeout(300);
    const startedAt = await page.evaluate(() => performance.now());
    await page.getByLabel("LAM", { exact: true }).click();
    await expect(page.locator(".lam-premium-panel")).toBeVisible({ timeout: 5_000 });
    const openLatencyMs = await page.evaluate((started) => performance.now() - started, startedAt);
    await page.getByRole("button", { name: "LAM mode" }).click();
    await expect(page.getByRole("listbox", { name: "Choose LAM mode" })).toBeVisible();
    await page.getByRole("option", { name: "Tutor", exact: true }).click();
    await expect(page.getByRole("button", { name: "LAM mode" })).toContainText("Tutor");
    await page.getByLabel("Close LAM").click();
    await page.waitForTimeout(500);
    const retainedWillChange = await page.locator('[aria-label="LAM personal assistant"] [style*="will-change"]').count();
    expect(openLatencyMs).toBeLessThan(2_500);
    expect(retainedWillChange).toBe(0);
    mkdirSync("test-artifacts", { recursive: true });
    writeFileSync("test-artifacts/anime-performance-4x-throttled.json", `${JSON.stringify({ viewport: { width: 390, height: 844 }, cpuThrottleRate: 4, openLatencyMs, retainedWillChange }, null, 2)}\n`, "utf8");
  } finally {
    await session.send("Emulation.setCPUThrottlingRate", { rate: 1 }).catch(() => undefined);
    await session.detach().catch(() => undefined);
  }
});
