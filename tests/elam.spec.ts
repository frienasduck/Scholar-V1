import { expect, test, type Page } from "@playwright/test";

test.use({
  baseURL: "http://127.0.0.1:3000",
  launchOptions: { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" },
  viewport: { width: 390, height: 844 },
});
test.setTimeout(60_000);

async function enterClass11(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Start Your Journey" }).click();
  await page.getByRole("button", { name: /Class 11/ }).last().click();
  await page.getByPlaceholder("Ishan").fill("Ishan");
  await page.getByPlaceholder("you@scholar.app").fill("elam@scholar.app");
  await page.locator('input[type="password"]').fill("local-test");
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.getByRole("button", { name: "Skip intro" }).click();
}

test("ELAM is page-scoped in the ebook and replaces global LAM", async ({ page }) => {
  const requests: Array<Record<string, any>> = [];
  await page.route("**/api/ai", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, text: "ELAM answer grounded in the current page." }),
    });
  });
  await enterClass11(page);
  await page.goto("/ebook", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Chemistry Part 1/ }).click();
  await page.getByText("Some Basic Concepts of Chemistry", { exact: true }).last().click();

  await expect(page.getByRole("button", { name: "LAM", exact: true })).toHaveCount(0);
  const orb = page.getByRole("button", { name: /Open ELAM for page 1/ });
  await expect(orb).toBeVisible();
  await orb.click();
  const dialog = page.getByRole("dialog", { name: /ELAM assistant for Chemistry Part 1 page 1/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Explain this page simply" }).click();
  await expect(dialog.getByText("ELAM answer grounded in the current page.")).toBeVisible();
  expect(requests).toHaveLength(1);
  const prompt = requests[0].messages.at(-1).content as string;
  expect(prompt).toContain("CURRENT PAGE TEXT:");
  expect(prompt).toContain("Chemistry Part 1");
  expect(prompt).toContain("page 1");
  expect(prompt).toContain("A question printed on the page is valid page context");

  await dialog.getByRole("button", { name: "Close ELAM" }).click();
  const pageNumber = page.getByRole("spinbutton");
  await pageNumber.fill("2");
  await expect(pageNumber).toHaveValue("2");
  await expect(page.getByRole("button", { name: /Open ELAM for page 2/ })).toBeVisible();
  await page.getByRole("button", { name: /Open ELAM for page 2/ }).click();
  const nextDialog = page.getByRole("dialog", { name: /ELAM assistant for Chemistry Part 1 page 2/ });
  await expect(nextDialog.getByText("ELAM answer grounded in the current page.")).toHaveCount(0);
  await expect(nextDialog.getByText("Grounded only in page 2")).toBeVisible();
});
