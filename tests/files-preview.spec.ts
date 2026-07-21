import { expect, test, type Page } from "@playwright/test";

test.use({
  baseURL: "http://127.0.0.1:3000",
  launchOptions: { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" },
  viewport: { width: 390, height: 844 },
});
test.setTimeout(120_000);

async function enterClass11(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Start Your Journey" }).click({ timeout: 90_000 });
  await page.getByRole("button", { name: /Class 11/ }).last().click();
  await page.getByPlaceholder("Ishan").fill("Ishan");
  await page.getByPlaceholder("you@scholar.app").fill("files-preview@scholar.app");
  await page.locator('input[type="password"]').fill("local-test");
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.getByRole("button", { name: "Skip intro" }).click();
}

test("uploaded text opens in the full viewer with close and file AI", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await enterClass11(page);
  await page.goto("/files", { waitUntil: "domcontentloaded" });
  await page.locator('input[type="file"]').setInputFiles({
    name: "preview-check.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Scholar file preview works. Momentum is conserved."),
  });
  await page.getByText("preview-check.txt", { exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "Preview preview-check.txt" });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByRole("button", { name: "Close file preview" })).toBeVisible();
  await expect(viewer.getByRole("button", { name: "Open file AI assistant" })).toBeVisible();
  await expect(viewer.getByText("Scholar file preview works. Momentum is conserved.")).toBeVisible();
  await viewer.getByRole("button", { name: "Open file AI assistant" }).click();
  await expect(page.getByLabel("AI assistant for preview-check.txt")).toBeVisible();
  await viewer.getByRole("button", { name: "Close file preview" }).click();
  await expect(viewer).toHaveCount(0);
  expect(errors).toEqual([]);
});
