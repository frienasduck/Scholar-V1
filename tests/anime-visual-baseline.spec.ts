import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

test.use({ baseURL: "http://127.0.0.1:3000", launchOptions: { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" }, viewport: { width: 1440, height: 900 } });
test.setTimeout(120_000);

async function enterClass11(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Start Your Journey" }).click({ timeout: 90_000 });
  await page.getByRole("button", { name: /Class 11/ }).last().click();
  await page.getByPlaceholder("Ishan").fill("Ishan");
  await page.getByPlaceholder("you@scholar.app").fill("animation-baseline@scholar.app");
  await page.locator('input[type="password"]').fill("local-test");
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.getByRole("button", { name: "Skip intro" }).click();
  await page.getByRole("button", { name: "LAM", exact: true }).click();
  if (await page.getByRole("heading", { name: "Meet LAM" }).isVisible().catch(() => false)) {
    const lam = page.getByLabel("LAM personal assistant");
    for (const label of ["Continue", "Continue", "Continue", "Start using LAM"]) await lam.getByRole("button", { name: label }).click();
  }
}

test("capture locked desktop LAM geometry", async ({ page }) => {
  mkdirSync("test-artifacts", { recursive: true });
  await enterClass11(page);
  const lam = page.getByLabel("LAM personal assistant");
  await expect(lam).toBeVisible();
  const box = await lam.boundingBox();
  expect(box).not.toBeNull();
  await page.screenshot({ path: process.env.SCHOLAR_ANIME_AFTER ? "test-artifacts/anime-lam-desktop-after.png" : "test-artifacts/anime-lam-desktop-before.png", fullPage: false });
  await page.evaluate((value) => localStorage.setItem("scholar:anime:desktop-box", JSON.stringify(value)), box);
});
