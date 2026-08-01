import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_APPEARANCE, migrateAppearance } from "../src/lib/appearance/appearance-defaults";
import { APPEARANCE_PRESETS, applyPreset } from "../src/lib/appearance/appearance-presets";
import { appearanceCore } from "../src/lib/appearance/appearance-schema";
import { contrastRatio, improveAccentContrast } from "../src/lib/appearance/appearance-tokens";

test.use({
  baseURL: "http://127.0.0.1:3000",
  launchOptions: { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" },
  viewport: { width: 1440, height: 1000 },
});
test.setTimeout(90_000);

async function enterClass11(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Start Your Journey" }).click();
  await page.getByRole("button", { name: /Class 11/ }).last().click();
  await page.getByPlaceholder("Ishan").fill("Ishan");
  await page.getByPlaceholder("you@scholar.app").fill("appearance@scholar.app");
  await page.locator('input[type="password"]').fill("local-test");
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.getByRole("button", { name: "Skip intro" }).click();
}

test("appearance schema migrates partial saved settings and presets safely", () => {
  const migrated = migrateAppearance({ themeMode: "light", colors: { primary: "#123456" } });
  expect(migrated.themeMode).toBe("light");
  expect(migrated.colors.primary).toBe("#123456");
  expect(migrated.colors.focus).toBe(DEFAULT_APPEARANCE.colors.focus);
  expect(migrated.wallpaper.pauseWhenHidden).toBe(true);
  expect(migrated.schemaVersion).toBe(1);

  const midnight = APPEARANCE_PRESETS.find((preset) => preset.id === "midnight-glass");
  expect(midnight).toBeTruthy();
  expect(applyPreset(appearanceCore(DEFAULT_APPEARANCE), midnight!).preset).toBe("midnight-glass");
  const improved = improveAccentContrast("#111111", true);
  expect(contrastRatio(improved, "#0a0a0b")).toBeGreaterThanOrEqual(3);
});

test("appearance controls live-apply, preview, persist and fit mobile", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await enterClass11(page);
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Appearance" }).click();
  await expect(page.getByRole("heading", { name: "Display & Personalization" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Scholar Default The current/ })).toBeVisible();
  await page.screenshot({ path: "test-results/appearance-desktop.png", fullPage: true });

  await page.getByRole("button", { name: /Midnight Glass/ }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.appearancePreset)).toBe("midnight-glass");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.appearancePreset)).toBe("midnight-glass");

  await page.getByRole("tab", { name: "Appearance" }).click();
  await page.getByRole("radio", { name: "Preview First" }).click();
  await page.getByRole("radio", { name: "light" }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.appearanceTheme)).not.toBe("light");
  await page.getByRole("button", { name: "Apply to Scholar" }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.appearanceTheme)).toBe("light");

  await page.setViewportSize({ width: 390, height: 844 });
  const centre = page.locator(".appearance-control-center");
  await expect(centre).toBeVisible();
  const overflow = await centre.evaluate((node) => node.scrollWidth - node.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  await page.screenshot({ path: "test-results/appearance-mobile.png", fullPage: true });
  expect(errors).toEqual([]);
});
