import { test, expect } from "@playwright/test";

const baseURL = "http://127.0.0.1:3000";
const executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

test.use({ baseURL, launchOptions: { executablePath }, viewport: { width: 1440, height: 1000 } });
test.setTimeout(90_000);

async function enterProfile(page: import("@playwright/test").Page, scholarClass: 9 | 11) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Start Your Journey" })).toBeVisible();
  await page.getByRole("button", { name: "Start Your Journey" }).click();
  await page.getByRole("button", { name: new RegExp(`Class ${scholarClass}`) }).last().click();
  await page.getByPlaceholder(scholarClass === 11 ? "Ishan" : "Neha Salah").fill(scholarClass === 11 ? "Ishan" : "Neha");
  await page.getByPlaceholder("you@scholar.app").fill(`smoke${scholarClass}@scholar.app`);
  await page.locator('input[type="password"]').fill("local-smoke-test");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.getByRole("button", { name: "Skip intro" })).toBeVisible();
  await page.getByRole("button", { name: "Skip intro" }).click();
  await expect(page.getByText(scholarClass === 11 ? "Ishan's Scholar" : "Neha's Scholar", { exact: true }).first()).toBeVisible();
}

test("Class 9 app shell, Study/LAM, Levels, Store, Canvas, and deep links load", async ({ page }) => {
  const fatal: string[] = [];
  page.on("pageerror", (error) => fatal.push(error.message));
  await enterProfile(page, 9);

  await page.goto("/study", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /LAM/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Science/ }).first()).toBeVisible();

  await page.goto("/levels", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Your Learning Journey", { exact: false })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /Continue/ }).click();
  const start = page.getByRole("button", { name: /^Start / });
  await expect(start).toBeVisible();
  await start.click();
  await expect(page.getByText(/Preparing your lesson|AI lesson generation is unavailable|Local fallback lesson/)).toBeVisible({ timeout: 20_000 });

  await page.goto("/store", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Useful upgrades/ })).toBeVisible();
  await expect(page.getByText("Aurora", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Preview" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.goto("/canvas", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("img", { name: /editable study canvas/ })).toBeVisible();
  expect(fatal).toEqual([]);
});

test("Class 11 stays on the Class 11 curriculum", async ({ page }) => {
  await enterProfile(page, 11);
  await page.goto("/study", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /Physics/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Chemistry/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Computer Science/ }).first()).toBeVisible();
  await expect(page.getByText("Matter in Our Surroundings", { exact: true })).toHaveCount(0);

  const lamToggle = page.getByRole("button", { name: "LAM", exact: true });
  await lamToggle.click();
  if (await page.getByRole("heading", { name: "Meet LAM" }).isVisible().catch(() => false)) {
    const lam = page.getByLabel("LAM personal assistant");
    for (const label of ["Continue", "Continue", "Continue", "Start using LAM"]) await lam.getByRole("button", { name: label }).click();
  }
  const lamInput = page.getByRole("textbox", { name: "Message LAM" });
  await lamInput.fill("temporary chapter question");
  await page.getByRole("button", { name: "New LAM chat" }).click();
  await expect(lamInput).toHaveValue("");
  await lamInput.fill("conversation follows me into Chemistry");
  await page.getByRole("button", { name: /Chemistry/ }).first().click();
  await expect(page.getByRole("textbox", { name: "Message LAM" })).toHaveValue("conversation follows me into Chemistry");
  await expect(page.getByText("Chemistry", { exact: true }).last()).toBeVisible();
});

test("mobile menu closes and restores focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterProfile(page, 9);
  const menu = page.getByRole("button", { name: "Open navigation menu" });
  await menu.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
});
