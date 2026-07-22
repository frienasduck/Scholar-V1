import { expect, test, type Page } from "@playwright/test";

test.use({ baseURL: "http://127.0.0.1:3000", launchOptions: { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" }, viewport: { width: 390, height: 844 } });
test.setTimeout(90_000);

async function enterClass11(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Start Your Journey" }).click();
  await page.getByRole("button", { name: /Class 11/ }).last().click();
  await page.getByPlaceholder("Ishan").fill("Ishan");
  await page.getByPlaceholder("you@scholar.app").fill("elam-global@scholar.app");
  await page.locator('input[type="password"]').fill("local-test");
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.getByRole("button", { name: "Skip intro" }).click();
}

test("ebook page action feeds the single global LAM system", async ({ page }) => {
  await enterClass11(page);
  await page.goto("/ebook", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Chemistry Part 1/ }).click();
  await page.getByText("Some Basic Concepts of Chemistry", { exact: true }).last().click();
  const entry = page.getByRole("button", { name: /Ask LAM about Chemistry Part 1 page 1/ });
  await expect(entry).toBeVisible();
  await entry.click();
  const lam = page.getByLabel("LAM personal assistant");
  if (await lam.getByRole("heading", { name: "Meet LAM" }).isVisible().catch(() => false)) {
    for (const label of ["Continue", "Continue", "Continue", "Start using LAM"]) await lam.getByRole("button", { name: label }).click();
  }
  await expect(lam.getByText(/Chemistry Part 1/).first()).toBeVisible();
  await expect(lam.getByPlaceholder("Ask about this ebook page")).toBeVisible();
  await lam.getByRole("button", { name: "Close LAM" }).click();
  const pageNumber = page.getByRole("spinbutton");
  await pageNumber.fill("2");
  await expect(page.getByRole("button", { name: /Ask LAM about Chemistry Part 1 page 2/ })).toBeVisible();
});
