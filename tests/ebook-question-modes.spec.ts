import { expect, test, type Page } from "@playwright/test";

test.use({
  baseURL: "http://127.0.0.1:3000",
  launchOptions: { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" },
  viewport: { width: 1280, height: 900 },
});
test.setTimeout(60_000);

async function enterClass11(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Start Your Journey" }).click();
  await page.getByRole("button", { name: /Class 11/ }).last().click();
  await page.getByPlaceholder("Your name").fill("Alex");
  await page.getByPlaceholder("you@scholar.app").fill("ebook-modes@scholar.app");
  await page.locator('input[type="password"]').fill("local-test");
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.getByRole("button", { name: "Skip intro" }).click();
}

test("LAM settings and exact ebook question modes are available", async ({ page }) => {
  await enterClass11(page);

  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "LAM" }).click();
  await expect(page.getByLabel("Mobile LAM mode")).toContainText("Compact");
  await expect(page.getByRole("switch", { name: "Enable ELAM" })).toHaveCount(0);

  await page.goto("/ebook", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Mathematics Part 1/ }).click();
  await page.getByText("Sets", { exact: true }).last().click();
  await expect(page.getByRole("button", { name: "LAM", exact: true })).toBeVisible();

  await page.goto("/quiz", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("E-Book Question Quiz", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start E-Book Quiz" }).click();
  await expect(page.getByText(/Q 1\//)).toBeVisible();

  await page.goto("/mock-exam", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("E-Book Question Mock Test", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Create E-Book Paper" }).click();
  await expect(page.getByText("Exact e-book questions", { exact: false })).toBeVisible();
});
