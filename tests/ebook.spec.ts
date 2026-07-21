import { test, expect, type Page } from "@playwright/test";

const baseURL = "http://127.0.0.1:3000";
const executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

test.use({ baseURL, launchOptions: { executablePath }, viewport: { width: 1366, height: 900 } });
test.setTimeout(120_000);

async function enterProfile(page: Page, scholarClass: 9 | 11) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Start Your Journey" }).click();
  await page.getByRole("button", { name: new RegExp(`Class ${scholarClass}`) }).last().click();
  await page.getByPlaceholder(scholarClass === 11 ? "Ishan" : "Neha Salah").fill(scholarClass === 11 ? "Ishan" : "Neha");
  await page.getByPlaceholder("you@scholar.app").fill(`ebook${scholarClass}@scholar.app`);
  await page.locator('input[type="password"]').fill("ebook-runtime-test");
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.getByRole("button", { name: "Skip intro" }).click();
}

async function openMaths(page: Page, destination = "Reader") {
  await page.evaluate((target) => sessionStorage.setItem("scholar:ebook:target", JSON.stringify({ bookId: "maths-pt1", destination: target })), destination);
  await page.goto("/ebook", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Mathematics Part 1", { exact: true }).first()).toBeVisible();
}

test("dual Mathematics reader maps exact PDF pages and exposes all printed questions", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await enterProfile(page, 11);
  await openMaths(page);

  await expect(page.getByRole("button", { name: "Original Scan" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clean Text" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Original scanned Mathematics Part 1 page 1/ })).toBeVisible();
  await page.getByRole("button", { name: "Clean Text" }).click();
  await expect(page.getByRole("img", { name: /Exact clean-text PDF Mathematics Part 1 page 2/ })).toBeVisible();
  await page.getByRole("button", { name: "Original Scan" }).click();
  await expect(page.getByRole("img", { name: /Original scanned Mathematics Part 1 page 1/ })).toBeVisible();

  await page.getByRole("button", { name: "Questions", exact: true }).click();
  await expect(page.getByRole("heading", { name: "140 questions" })).toBeVisible();
  await page.locator("select").nth(1).selectOption("classwork");
  await expect(page.getByRole("heading", { name: "96 questions" })).toBeVisible();
  await page.locator("select").nth(1).selectOption("homework");
  await expect(page.getByRole("heading", { name: "23 questions" })).toBeVisible();
  await page.locator("select").nth(1).selectOption("try-yourself");
  await expect(page.getByRole("heading", { name: "17 questions" })).toBeVisible();
  await page.locator("select").nth(1).selectOption("case-study");
  await expect(page.getByRole("heading", { name: "4 questions" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("Mathematics clean reader has no horizontal overflow at supported mobile sizes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterProfile(page, 11);
  await openMaths(page);
  await page.getByRole("button", { name: "Clean Text" }).click();
  await expect(page.getByRole("img", { name: /Exact clean-text PDF Mathematics Part 1 page/ })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole("button", { name: "Original Scan" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clean Text" })).toBeVisible();
});

test("mobile Book Mode uses a compact two-row toolbar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterProfile(page, 11);
  await openMaths(page);
  await page.getByRole("button", { name: "Enter Book Mode" }).click();
  const reader = page.getByLabel(/immersive book reader/);
  await expect(reader).toBeVisible();
  await expect(reader.getByRole("button", { name: "Exit Book Mode" })).toBeVisible();
  await expect(reader.getByRole("button", { name: "Zoom out" })).toBeVisible();
  await expect(reader.getByRole("button", { name: "Reading settings" })).toBeVisible();
  await expect(reader.getByText("Exit", { exact: true })).toBeHidden();
  const overflow = await reader.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("printed MCQ options give clear wrong and correct glass feedback", async ({ page }) => {
  await enterProfile(page, 11);
  await openMaths(page, "Questions");
  await page.locator("select").nth(2).selectOption("mcq");
  await expect(page.getByRole("heading", { name: "19 questions" })).toBeVisible();
  const firstQuestion = page.locator("article").first();
  const options = firstQuestion.getByRole("radio");
  await expect(options).toHaveCount(4);
  await options.nth(0).click();
  await expect(firstQuestion.getByText(/Incorrect - the correct option is highlighted in green/)).toBeVisible();
  await firstQuestion.getByRole("button", { name: "Retry" }).click();
  await options.nth(1).click();
  await expect(firstQuestion.getByText("Correct", { exact: true })).toBeVisible();
});

test("Class 9 cannot load Class 11 Mathematics personal data", async ({ page }) => {
  await enterProfile(page, 9);
  await page.evaluate(() => sessionStorage.setItem("scholar:ebook:target", JSON.stringify({ bookId: "maths-pt1", destination: "Reader" })));
  await page.goto("/ebook", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Class 11 book" })).toBeVisible();
  await expect(page.locator("mark")).toHaveCount(0);
});
