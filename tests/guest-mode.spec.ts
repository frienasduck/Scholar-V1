import { test, expect } from "@playwright/test";

test.use({
  baseURL: process.env.SCHOLAR_TEST_URL || "http://127.0.0.1:3000",
  launchOptions: { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" },
  viewport: { width: 390, height: 844 },
});
test.setTimeout(120_000);

test("guest entry, local-only warning, restrictions, and account fallback work", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: "Continue as Guest", exact: true }).evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.getByText("Guest session", { exact: true })).toBeVisible();
  await expect(page.getByText("Your progress is saved only on this device until you create an account.")).toBeVisible();
  await expect(page.getByText("Guest", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Dismiss guest session banner" }).click();
  await expect(page.getByLabel("Guest session information")).toBeHidden();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Guest session information")).toBeVisible();
  await expect(page.getByLabel("Guest session information")).toBeHidden({ timeout: 7_000 });

  await page.goto("/files", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Sign in to use this private feature" })).toBeVisible();

  await page.getByRole("button", { name: "Create account or Sign in" }).last().click();
  await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible();

  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "temporary failure" }) });
  });
  await page.getByLabel("Email", { exact: true }).fill("guest@example.com");
  await page.locator('input[type="password"]').fill("guest-test-password");
  await page.locator(".auth-form").getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".auth-error")).toContainText("Account services are temporarily unavailable.");
  await expect(page.locator('.auth-form button[type="submit"]')).toBeEnabled();
});
