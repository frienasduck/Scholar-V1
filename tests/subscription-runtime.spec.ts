import { test, expect } from "@playwright/test";

const executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

test.use({
  baseURL: "http://127.0.0.1:3000",
  launchOptions: { executablePath },
  viewport: { width: 390, height: 844 },
});
test.setTimeout(120_000);

test("Scholar Plus disabled mode, PWA instructions, mobile LAM, and direct routes are safe", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).not.toHaveText("");
  await expect(page.locator("[data-nextjs-dialog]")) .toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Don't have an account/i }).click();
  await page.getByPlaceholder("Ishan").fill("Runtime Scholar");
  await page.getByPlaceholder("you@scholar.app").fill(`runtime-${Date.now()}@scholar.app`);
  await page.locator('input[type="password"]').fill("runtime-test-password");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.getByRole("button", { name: "Skip intro" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Skip intro" }).click();
  await expect(page.getByText("Ishan's Scholar", { exact: true }).first()).toBeVisible({ timeout: 30_000 });

  await expect(page.locator('[aria-label="LAM personal assistant"]')).toHaveCount(0);
  const bottomNav = page.locator(".scholar-bottom-nav");
  await expect(bottomNav).toBeVisible();
  const navBox = await bottomNav.boundingBox();
  expect(navBox).not.toBeNull();
  expect((navBox?.y ?? 0) + (navBox?.height ?? 0)).toBeLessThanOrEqual(846);
  await page.screenshot({ path: "test-results/scholar-plus-mobile-dashboard.png" });
  await page.locator("#main-scroll").evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  await expect(page.locator(".scholar-info-footer")).toBeVisible();
  const footerLabelBox = await page.locator(".scholar-footer-label").boundingBox();
  expect(footerLabelBox).not.toBeNull();
  expect((footerLabelBox?.y ?? 0) + (footerLabelBox?.height ?? 0)).toBeLessThanOrEqual(navBox?.y ?? 0);
  await page.screenshot({ path: "test-results/scholar-plus-mobile-footer.png" });

  await page.goto("/achievements", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Achievements" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Coming soon", { exact: true })).toBeVisible();

  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("tab", { name: "Subscription" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("tab", { name: "Subscription" }).click();
  await expect(page.getByRole("heading", { name: "All Scholar features unlocked" })).toBeVisible();
  await page.getByRole("button", { name: "Install Scholar App" }).click();
  await expect(page.getByRole("heading", { name: "Install Scholar" })).toBeVisible();
  await page.getByRole("button", { name: "Got it" }).click();

  await page.goto("/plus", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "All Scholar features are unlocked" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Subscribe" })).toHaveCount(0);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[aria-label="LAM personal assistant"]')).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: "test-results/scholar-plus-desktop-dashboard.png" });

  expect(pageErrors).toEqual([]);
  expect(consoleErrors.filter((message) => !/favicon|Failed to load resource.*cloudfront/i.test(message))).toEqual([]);
});
