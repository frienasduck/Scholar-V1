import { expect, test, type Page } from "@playwright/test";

test.use({ baseURL: "http://127.0.0.1:3000", launchOptions: { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" }, viewport: { width: 390, height: 844 } });
test.setTimeout(120_000);

async function enterClass11(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Start Your Journey" }).click({ timeout: 90_000 });
  await page.getByRole("button", { name: /Class 11/ }).last().click();
  await page.getByPlaceholder("Ishan").fill("Ishan");
  await page.getByPlaceholder("you@scholar.app").fill("lam-system@scholar.app");
  await page.locator('input[type="password"]').fill("local-test");
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.getByRole("button", { name: "Skip intro" }).click();
}

async function finishLamOnboarding(page: Page) {
  await page.getByRole("button", { name: "LAM", exact: true }).click();
  if (await page.getByRole("heading", { name: "Meet LAM" }).isVisible().catch(() => false)) {
    const lam = page.getByLabel("LAM personal assistant");
    for (const label of ["Continue", "Continue", "Continue", "Start using LAM"]) await lam.getByRole("button", { name: label }).click();
  }
}

test("top liquid capsule morphs, supports history and keyboard invocation", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await enterClass11(page);
  const trigger = page.getByRole("button", { name: "LAM", exact: true });
  const box = await trigger.boundingBox();
  expect(box?.y).toBeLessThan(40);
  expect(box?.width).toBeGreaterThan(200);
  await page.locator("#main-scroll").evaluate((element) => { element.scrollTop = Math.min(900, element.scrollHeight); });
  await page.waitForTimeout(100);
  const scrolledBox = await trigger.boundingBox();
  expect(Math.abs((scrolledBox?.y ?? 0) - (box?.y ?? 0))).toBeLessThan(1);
  await finishLamOnboarding(page);
  const lam = page.getByLabel("LAM personal assistant");
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await expect(lam.getByPlaceholder("Ask about anything in Scholar")).toBeVisible();
  await page.screenshot({ path: "test-results/lam-redesign-mobile.png", fullPage: false });
  await lam.getByRole("button", { name: "Conversation history" }).click();
  await expect(lam.getByPlaceholder("Search conversations")).toBeVisible();
  await lam.getByRole("button", { name: "Conversation history" }).click();
  await lam.getByRole("button", { name: "Close LAM" }).click();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
  await page.keyboard.press("Control+Space");
  await expect(lam.getByRole("button", { name: "Close LAM" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("uploaded file context opens the same global LAM", async ({ page }) => {
  await enterClass11(page);
  await finishLamOnboarding(page);
  await page.getByLabel("LAM personal assistant").getByRole("button", { name: "Close LAM" }).click();
  await page.goto("/files", { waitUntil: "domcontentloaded" });
  await page.locator('input[type="file"]').setInputFiles({ name: "lam-context.txt", mimeType: "text/plain", buffer: Buffer.from("The de Broglie relation is lambda equals h by p.") });
  await page.getByText("lam-context.txt", { exact: true }).click();
  await page.getByRole("button", { name: "Ask LAM about this file" }).click();
  const lam = page.getByLabel("LAM personal assistant");
  await expect(lam.getByText("lam-context.txt", { exact: true })).toBeVisible();
  await expect(lam.getByPlaceholder("Ask about lam-context.txt")).toBeVisible();
});

test("new context, history, voice and presentation preferences are exposed", async ({ page }) => {
  await enterClass11(page);
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "LAM", exact: true }).click();
  await expect(page.getByRole("switch", { name: "LAM voice input" })).toBeChecked();
  await expect(page.getByRole("switch", { name: "Use current-screen context" })).toBeChecked();
  await expect(page.getByRole("switch", { name: "Use study progress" })).toBeChecked();
  await expect(page.getByRole("switch", { name: "Use quiz history" })).toBeChecked();
  await expect(page.getByRole("switch", { name: "Save LAM conversations" })).toBeChecked();
  await expect(page.getByRole("combobox", { name: "LAM animation intensity" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "LAM response detail" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "LAM keyboard shortcut" })).toBeVisible();
});
