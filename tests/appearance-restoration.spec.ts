import { test, expect, type Page } from "@playwright/test";

const executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

test.use({ baseURL: "http://127.0.0.1:3000", launchOptions: { executablePath } });
test.setTimeout(120_000);

async function enterClass11(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Start Your Journey" }).click();
  await page.getByRole("button", { name: /Class 11/ }).last().click();
  await page.getByPlaceholder("Ishan").fill("Ishan");
  await page.getByPlaceholder("you@scholar.app").fill("appearance-check@scholar.app");
  await page.locator('input[type="password"]').fill("local-visual-check");
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.getByRole("button", { name: "Skip intro" }).click();
  await expect(page.getByText("Ishan's Scholar", { exact: true }).first()).toBeVisible();
}

async function expectFullBleed(page: Page) {
  const result = await page.evaluate(() => {
    const main = document.getElementById("main-scroll")?.getBoundingClientRect();
    const video = document.querySelector("main video")?.getBoundingClientRect();
    if (!main || !video) return null;
    return {
      left: Math.abs(video.left - main.left),
      right: Math.abs(video.right - main.right),
    };
  });
  expect(result).not.toBeNull();
  expect(result!.left).toBeLessThanOrEqual(1);
  expect(result!.right).toBeLessThanOrEqual(1);
}

async function settleLaunch(page: Page) {
  const gate = page.locator("[data-startup-mode]");
  await gate.waitFor({ state: "visible", timeout: 5_000 }).catch(() => undefined);
  const openNow = page.getByRole("button", { name: "Open now" });
  if (await openNow.isVisible().catch(() => false)) {
    await expect(openNow).toBeEnabled({ timeout: 20_000 });
    await openNow.click();
  }
  await expect(gate).toBeHidden({ timeout: 20_000 });
}

test("restores full-bleed page media, transparent AI text and a non-overlapping footer", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await enterClass11(page);

  for (const route of ["/ai-tools", "/ai-tutor", "/files", "/store"]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await settleLaunch(page);
    await expect(page.locator("main video").first()).toBeVisible({ timeout: 20_000 });
    await expectFullBleed(page);
    if (route === "/ai-tools") await page.screenshot({ path: "test-results/scholar-desktop-background-restored.png", fullPage: false });
  }

  await page.goto("/flashcards", { waitUntil: "domcontentloaded" });
  const style = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.className = "scholar-ai-content";
    probe.textContent = "Formula rendering probe";
    document.body.appendChild(probe);
    const computed = getComputedStyle(probe);
    const result = { background: computed.backgroundColor, font: computed.fontFamily };
    probe.remove();
    return result;
  });
  expect(style.background).toBe("rgba(0, 0, 0, 0)");
  expect(style.font.toLowerCase()).not.toContain("source serif");

  const main = page.locator("#main-scroll");
  await main.evaluate((element) => element.scrollTo(0, element.scrollHeight));
  const footerSafety = await page.evaluate(() => {
    const footerText = document.querySelector("footer span")?.getBoundingClientRect();
    const bottomNav = document.querySelector(".scholar-bottom-nav")?.getBoundingClientRect();
    return footerText && bottomNav && bottomNav.height > 0 ? footerText.bottom <= bottomNav.top : true;
  });
  expect(footerSafety).toBe(true);
  await page.screenshot({ path: "test-results/scholar-desktop-restored.png", fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ai-tools", { waitUntil: "domcontentloaded" });
  await settleLaunch(page);
  await expect(page.locator("main video").first()).toBeVisible({ timeout: 20_000 });
  await expectFullBleed(page);
  await page.screenshot({ path: "test-results/scholar-mobile-background-restored.png", fullPage: false });
  await page.locator("#main-scroll").evaluate((element) => element.scrollTo(0, element.scrollHeight));
  const mobileFooterSafety = await page.evaluate(() => {
    const footerText = document.querySelector("footer span")?.getBoundingClientRect();
    const bottomNav = document.querySelector(".scholar-bottom-nav")?.getBoundingClientRect();
    return footerText && bottomNav && bottomNav.height > 0 ? footerText.bottom <= bottomNav.top : true;
  });
  expect(mobileFooterSafety).toBe(true);
  await page.screenshot({ path: "test-results/scholar-mobile-restored.png", fullPage: false });
  expect(errors).toEqual([]);
});
