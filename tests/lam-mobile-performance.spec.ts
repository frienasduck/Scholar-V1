import { expect, test, type Page } from "@playwright/test";

test.use({ baseURL: "http://127.0.0.1:3000", launchOptions: { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" } });
test.setTimeout(90_000);

async function enterClass11(page: Page) {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Start Your Journey" }).click({ timeout: 90_000 });
  await page.getByRole("button", { name: /Class 11/ }).last().click();
  await page.getByPlaceholder("Ishan").fill("Ishan");
  await page.getByPlaceholder("you@scholar.app").fill(`lam-perf-${Date.now()}@scholar.app`);
  await page.locator('input[type="password"]').fill("local-test");
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.getByRole("button", { name: "Skip intro" }).click();
}

async function onboard(page: Page) {
  await page.getByRole("button", { name: "LAM", exact: true }).click();
  const lam = page.getByLabel("LAM personal assistant");
  if (await lam.getByRole("heading", { name: "Meet LAM" }).isVisible().catch(() => false)) {
    for (const label of ["Continue", "Continue", "Continue", "Start using LAM"]) await lam.getByRole("button", { name: label }).click();
  }
}

test("mobile uses the optimized compositor path while desktop retains high quality", async ({ page }) => {
  await enterClass11(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const dockedLam = page.getByRole("button", { name: "LAM", exact: true });
  await expect(dockedLam).toBeVisible();
  const dockBox = await dockedLam.boundingBox();
  const headerButtons = page.locator(".scholar-mobile-topbar button:visible");
  for (let index = 0; index < await headerButtons.count(); index++) {
    const headerBox = await headerButtons.nth(index).boundingBox();
    if (!dockBox || !headerBox) continue;
    const overlaps = dockBox.x < headerBox.x + headerBox.width && dockBox.x + dockBox.width > headerBox.x && dockBox.y < headerBox.y + headerBox.height && dockBox.y + dockBox.height > headerBox.y;
    expect(overlaps, `LAM overlaps mobile header control ${index}`).toBe(false);
  }
  await page.screenshot({ path: "test-results/lam-mobile-docked-390x844.png" });
  await onboard(page);
  const lam = page.getByLabel("LAM personal assistant");
  const mobileSizes = [[430, 932], [412, 915], [390, 844], [375, 812], [360, 800]] as const;
  for (const [width, height] of mobileSizes) {
    await page.setViewportSize({ width, height });
    await expect(lam).toHaveAttribute("data-quality", "mobile-optimized");
    const blur = await lam.locator(".lam-premium-panel").evaluate((element) => getComputedStyle(element).backdropFilter);
    expect(blur).toContain("blur(16px)");
    await page.screenshot({ path: `test-results/lam-mobile-${width}x${height}.png` });
  }
  await lam.getByLabel("LAM mode").click();
  await expect(page.getByRole("listbox", { name: "Choose LAM mode" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox", { name: "Choose LAM mode" })).toHaveCount(0);
  if (!await lam.locator(".lam-premium-panel").isVisible().catch(() => false)) await page.getByRole("button", { name: "LAM", exact: true }).click();

  for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 768]] as const) {
    await page.setViewportSize({ width, height });
    await expect(lam).toHaveAttribute("data-quality", "desktop-high");
    const blur = await lam.locator(".lam-premium-panel").evaluate((element) => getComputedStyle(element).backdropFilter);
    expect(blur).toContain("blur(34px)");
    await page.screenshot({ path: `test-results/lam-desktop-${width}x${height}.png` });
  }
});
