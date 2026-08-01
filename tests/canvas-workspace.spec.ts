import { expect, test, type Page } from "@playwright/test";

const executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

test.use({
  baseURL: "http://127.0.0.1:3000",
  launchOptions: { executablePath },
});
test.setTimeout(90_000);

async function enterClassEleven(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Start Your Journey" })).toBeVisible({ timeout: 25_000 });
  await page.getByRole("button", { name: "Start Your Journey" }).click();
  await page.getByRole("button", { name: /Class 11/ }).last().click();
  await page.getByPlaceholder("Ishan").fill("Ishan");
  await page.getByPlaceholder("you@scholar.app").fill(`canvas-${Date.now()}@scholar.app`);
  await page.locator('input[type="password"]').fill("canvas-workspace-test");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.getByRole("button", { name: "Skip intro" })).toBeVisible();
  await page.getByRole("button", { name: "Skip intro" }).click();
}

test("Canvas supports editable templates, pages, persistence, and a clean desktop layout", async ({ page }) => {
  const fatal: string[] = [];
  page.on("pageerror", (error) => fatal.push(error.message));
  await enterClassEleven(page);
  await page.goto("/canvas", { waitUntil: "domcontentloaded" });

  const workspace = page.getByLabel(/infinite visual workspace/);
  await expect(workspace).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("Canvas project controls")).toBeVisible();
  await page.getByRole("button", { name: "More Canvas actions" }).click();
  await page.getByText("Chemistry Reaction Board", { exact: true }).click();
  await expect(workspace).toHaveAttribute("aria-label", /objects/);
  await expect(page.locator(".katex").first()).toBeVisible();

  await page.getByLabel("Add page").click();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save Canvas" }).click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  const openNow = page.getByRole("button", { name: "Open now" });
  if (await openNow.isVisible().catch(() => false)) await openNow.click();
  await page.getByText("Nucleophilic Substitution", { exact: true }).click();
  await expect(page.locator(".katex").first()).toBeVisible();

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
  expect(fatal).toEqual([]);
  await page.screenshot({ path: "test-results/canvas-desktop.png", fullPage: true });
});

test("Canvas mobile layout keeps the workspace usable and the inspector dismissible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterClassEleven(page);
  await page.goto("/canvas", { waitUntil: "domcontentloaded" });

  await expect(page.getByLabel(/infinite visual workspace/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("Canvas project controls")).toBeVisible();
  await expect(page.getByRole("button", { name: "Close Canvas inspector" })).toHaveCount(0);
  await page.getByRole("button", { name: "Toggle Canvas inspector" }).click();
  await expect(page.getByRole("button", { name: "Close Canvas inspector" })).toBeVisible();
  await page.getByRole("button", { name: "Close Canvas inspector" }).click();
  await expect(page.getByRole("button", { name: "Close Canvas inspector" })).toHaveCount(0);

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "test-results/canvas-mobile.png", fullPage: true });
});
