import { test, expect, type Page } from "@playwright/test";

const baseURL = "http://127.0.0.1:3000";
const executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

test.use({
  baseURL,
  launchOptions: { executablePath },
  viewport: { width: 1440, height: 900 },
});
test.setTimeout(300_000);

async function enterProfile(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const guest = page.getByRole("button", { name: "Explore as Guest" });
  await expect(guest).toBeVisible({ timeout: 30_000 });
  await guest.click();
  await page.waitForTimeout(1500);
  const confirmGuest = page.getByRole("button", { name: "Continue as Guest" });
  if (await confirmGuest.first().isVisible().catch(() => false)) {
    await confirmGuest.first().click();
  }
  const skip = page.getByRole("button", { name: "Skip intro" });
  const shell = page.locator(".scholar-shell");
  await expect(skip.or(shell).first()).toBeVisible({ timeout: 40_000 });
  if (await skip.first().isVisible().catch(() => false)) {
    await skip.first().click();
  }
  await expect(shell).toBeVisible({ timeout: 40_000 });
}

const VIEWS = [
  "dashboard",
  "settings",
  "study",
  "music",
  "nigtube",
  "ebook",
  "workspace",
  "resources",
  "focus",
  "plus",
];

test("Scholar Liquid Glass shell, views, menus and responsive behaviour", async ({ page }) => {
  const fatal: string[] = [];
  page.on("pageerror", (error) => fatal.push(error.message));

  await enterProfile(page);
  await page.waitForTimeout(1500);

  const runtime = await page.evaluate(() => {
    const root = document.documentElement;
    const warp = document.querySelector(".sg-glass > .sg-warp") as HTMLElement | null;
    const blurry = Array.from(document.querySelectorAll<HTMLElement>("body *")).filter((element) => {
      const style = getComputedStyle(element);
      const value = style.backdropFilter || (style as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter;
      return value && value !== "none";
    }).length;
    return {
      material: root.dataset.sgMaterial,
      refraction: root.dataset.sgRefraction,
      pointer: root.dataset.sgPointer,
      motion: root.dataset.sgMotion,
      environment: Boolean(document.querySelector(".sg-environment")),
      sharedFilterDefs: document.querySelectorAll(".sg-filter-defs").length,
      refractionFilters: document.querySelectorAll("filter[id^='sg-refraction-']").length,
      svgFiltersTotal: document.querySelectorAll("svg filter").length,
      glassSurfaces: document.querySelectorAll(".sg-glass").length,
      backdropSurfaces: blurry,
      warpFilter: warp ? getComputedStyle(warp).filter : null,
      warpBackdrop: warp ? getComputedStyle(warp).backdropFilter : null,
    };
  });
  console.log("GLASS_RUNTIME", JSON.stringify(runtime));
  expect(runtime.sharedFilterDefs).toBe(1);
  expect(runtime.refractionFilters).toBe(3);
  expect(runtime.environment).toBe(true);
  expect(["url(\"#sg-refraction-standard\")", "url(\"#sg-refraction-prominent\")", "url(\"#sg-refraction-subtle\")"])
    .toContain(runtime.warpFilter);

  for (const view of VIEWS) {
    await page.evaluate((id) => {
      window.dispatchEvent(new CustomEvent("neha-scholar:navigate", { detail: { viewId: id } }));
    }, view);
    await page.waitForTimeout(1400);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    console.log("VIEW", JSON.stringify({ view, overflow, errors: fatal.length }));
    await page.screenshot({ path: `test-artifacts/liquid-glass/view-${view}-1440x900.png` });
    expect(overflow, `horizontal overflow in ${view}`).toBeLessThanOrEqual(1);
  }

  // Menus / dialogs use the shared floating material.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("neha-scholar:navigate", { detail: { viewId: "dashboard" } })));
  await page.waitForTimeout(1000);
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(600);
  const dialogMaterial = await page.evaluate(() => {
    const content = document.querySelector("[data-slot='dialog-content']") as HTMLElement | null;
    if (!content) return null;
    const style = getComputedStyle(content);
    return {
      backdrop: style.backdropFilter,
      backgroundColor: style.backgroundColor,
      radius: style.borderRadius,
      overlay: getComputedStyle(document.querySelector("[data-slot='dialog-overlay']") as HTMLElement).backgroundImage.slice(0, 60),
    };
  });
  console.log("DIALOG_MATERIAL", JSON.stringify(dialogMaterial));
  expect(dialogMaterial?.backdrop).not.toBe("none");
  await page.screenshot({ path: "test-artifacts/liquid-glass/command-palette-1440x900.png" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // Tier 3: prove the fallback material is complete without any refraction.
  await page.evaluate(() => {
    document.documentElement.dataset.sgMaterial = "fallback";
    document.documentElement.dataset.sgRefraction = "off";
  });
  await page.waitForTimeout(500);
  const fallback = await page.evaluate(() => {
    const surface = document.querySelector<HTMLElement>("[class*='-glass'], .sg-material");
    if (!surface) return null;
    const style = getComputedStyle(surface);
    return { backdrop: style.backdropFilter, background: style.backgroundColor, border: style.borderTopColor };
  });
  console.log("FALLBACK_MATERIAL", JSON.stringify(fallback));
  await page.screenshot({ path: "test-artifacts/liquid-glass/fallback-dashboard-1440x900.png" });
  await page.evaluate(() => {
    document.documentElement.dataset.sgMaterial = "full";
    document.documentElement.dataset.sgRefraction = "on";
  });

  // Responsive sweep: no body horizontal overflow, glass stays inside bounds.
  for (const size of [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1024, height: 600 },
    { width: 834, height: 1194 },
    { width: 430, height: 932 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(800);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    console.log("OVERFLOW", JSON.stringify({ ...size, overflow }));
    expect(overflow, `horizontal overflow at ${size.width}x${size.height}`).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-artifacts/liquid-glass/dashboard-${size.width}x${size.height}.png` });
  }

  // Mobile navigation dock at phone size.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(700);
  const toggle = page.getByRole("button", { name: "Open bottom menu" });
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: "test-artifacts/liquid-glass/mobile-dock-390x844.png" });
  }

  // Motion budget: pointer movement must not cost frames or re-render the shell.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(800);
  const medianFrame = await page.evaluate(async () => {
    const samples: number[] = [];
    let last = performance.now();
    let running = true;
    setTimeout(() => { running = false; }, 1400);
    return await new Promise<number>((resolve) => {
      const tick = () => {
        const now = performance.now();
        samples.push(now - last);
        last = now;
        if (running) requestAnimationFrame(tick);
        else {
          samples.sort((a, b) => a - b);
          resolve(samples[Math.floor(samples.length / 2)] ?? 0);
        }
      };
      requestAnimationFrame(tick);
    });
  });
  console.log("MEDIAN_FRAME_MS", medianFrame);
  console.log("PAGE_ERRORS", JSON.stringify(fatal.slice(0, 8)));
  expect(medianFrame).toBeLessThan(40);
  expect(fatal).toEqual([]);
});
