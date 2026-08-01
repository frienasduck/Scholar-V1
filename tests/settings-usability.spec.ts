import { test, expect, type Page } from "@playwright/test";

test.use({
  baseURL: "http://127.0.0.1:3000",
  launchOptions: { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" },
  viewport: { width: 1440, height: 900 },
});
test.setTimeout(120_000);

async function enterClass11(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Start Your Journey" }).click();
  await page.getByRole("button", { name: /Class 11/ }).last().click();
  await page.getByPlaceholder("Ishan").fill("Ishan");
  await page.getByPlaceholder("you@scholar.app").fill("settings-check@scholar.app");
  await page.locator('input[type="password"]').fill("local-feature-check");
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.getByRole("button", { name: "Skip intro" }).click();
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

test("developer appearance gate, update log and notification preview are functional", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await enterClass11(page);
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await settleLaunch(page);

  await page.getByRole("tab", { name: "Appearance" }).click();
  await expect(page.getByText("Appearance Lab", { exact: true })).toBeVisible();
  await expect(page.getByText("Beta · Developer only", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Developer unlock" }).click();
  await page.getByPlaceholder("Enter dev password").fill("inmfs123");
  await page.getByRole("button", { name: "Unlock", exact: true }).click();
  await expect(page.getByText("Unlocked for this developer", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Restore original font" })).toBeVisible();

  await page.getByRole("tab", { name: "Update Logs" }).click();
  await expect(page.getByText("Scholar update logs", { exact: true })).toBeVisible();
  await expect(page.getByText("v5.1.0", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Notifications" }).click();
  await expect(page.getByText("Notification customizer", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show preview" }).click();
  const notification = page.getByTestId("scholar-notification").last();
  await expect(notification).toBeVisible();
  const desktopClear = await page.evaluate(() => {
    const toasts = Array.from(document.querySelectorAll('[data-testid="scholar-notification"]'));
    const toast = toasts.at(-1)?.getBoundingClientRect();
    const topbar = document.querySelector(".scholar-mobile-topbar")?.getBoundingClientRect();
    return toast && topbar ? toast.top >= topbar.bottom : false;
  });
  expect(desktopClear).toBe(true);
  await page.screenshot({ path: "test-results/scholar-notification-desktop.png", fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Show preview" }).click();
  await expect(notification).toBeVisible();
  const mobileClear = await page.evaluate(() => {
    const toasts = Array.from(document.querySelectorAll('[data-testid="scholar-notification"]'));
    const toast = toasts.at(-1)?.getBoundingClientRect();
    const topbar = document.querySelector(".scholar-mobile-topbar")?.getBoundingClientRect();
    return toast && topbar ? toast.top >= topbar.bottom : false;
  });
  expect(mobileClear).toBe(true);
  await page.screenshot({ path: "test-results/scholar-notification-mobile.png", fullPage: false });
  expect(errors).toEqual([]);
});
