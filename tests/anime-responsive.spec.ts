import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

test.use({ baseURL: "http://127.0.0.1:3000", launchOptions: { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" } });
test.setTimeout(180_000);

async function enterClass11(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Start Your Journey" }).click({ timeout: 90_000 });
  await page.getByRole("button", { name: /Class 11/ }).last().click();
  await page.getByPlaceholder("Ishan").fill("Ishan");
  await page.getByPlaceholder("you@scholar.app").fill("anime-responsive@scholar.app");
  await page.locator('input[type="password"]').fill("local-test");
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.getByRole("button", { name: "Skip intro" }).click();
  await page.getByRole("button", { name: "LAM", exact: true }).click();
  if (await page.getByRole("heading", { name: "Meet LAM" }).isVisible().catch(() => false)) {
    const lam = page.getByLabel("LAM personal assistant");
    for (const label of ["Continue", "Continue", "Continue", "Start using LAM"]) await lam.getByRole("button", { name: label }).click();
  }
  await page.getByLabel("Close LAM").click();
}

test("LAM stays fixed, contained, and non-overlapping at acceptance viewports", async ({ page }) => {
  mkdirSync("test-artifacts", { recursive: true });
  await enterClass11(page);
  const sizes = [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 768, height: 1024 },
    { width: 430, height: 932 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
  ];

  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.waitForTimeout(120);
    const trigger = page.getByRole("button", { name: "LAM", exact: true });
    const closed = await trigger.boundingBox();
    expect(closed).not.toBeNull();
    expect(closed!.x).toBeGreaterThanOrEqual(0);
    expect(closed!.y).toBeGreaterThanOrEqual(0);
    expect(closed!.x + closed!.width).toBeLessThanOrEqual(size.width + 1);
    expect(closed!.y + closed!.height).toBeLessThanOrEqual(size.height + 1);

    if (size.width <= 767) {
      const controls = await page.locator(".scholar-mobile-topbar > div").boundingBox();
      expect(controls).not.toBeNull();
      expect(closed!.y + closed!.height).toBeLessThanOrEqual(controls!.y + 1);
    }

    await trigger.click();
    const panel = page.locator(".lam-premium-panel");
    await expect(panel).toBeVisible();
    const open = await panel.boundingBox();
    expect(open).not.toBeNull();
    expect(open!.x).toBeGreaterThanOrEqual(0);
    expect(open!.y).toBeGreaterThanOrEqual(0);
    expect(open!.x + open!.width).toBeLessThanOrEqual(size.width + 1);
    expect(open!.y + open!.height).toBeLessThanOrEqual(size.height + 1);
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    await page.getByLabel("Close LAM").click();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
    await page.waitForTimeout(500);

    if (size.width === 390 || size.width === 1440) {
      await page.screenshot({ path: `test-artifacts/anime-responsive-${size.width}x${size.height}.png`, fullPage: false });
    }
  }
});

test("reduced motion keeps LAM functional without decorative loops", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enterClass11(page);
  await page.getByRole("button", { name: "LAM", exact: true }).click();
  await expect(page.locator(".lam-premium-panel")).toBeVisible();
  await page.getByLabel("LAM mode").click();
  await expect(page.getByRole("listbox", { name: "Choose LAM mode" })).toBeVisible();
  await page.getByRole("option", { name: "Tutor", exact: true }).click();
  await expect(page.getByRole("button", { name: "LAM mode" })).toContainText("Tutor");
});

test("mobile mode options remain clickable above the answer surface", async ({ page }) => {
  await enterClass11(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "LAM", exact: true }).click();
  await page.getByRole("button", { name: "LAM mode" }).click();
  await expect(page.getByRole("listbox", { name: "Choose LAM mode" })).toBeVisible();
  await page.waitForTimeout(350);
  mkdirSync("test-artifacts", { recursive: true });
  await page.screenshot({ path: "test-artifacts/anime-mobile-mode-menu.png", fullPage: false });
  await page.getByRole("option", { name: "Tutor", exact: true }).click();
  await expect(page.getByRole("button", { name: "LAM mode" })).toContainText("Tutor");
});
