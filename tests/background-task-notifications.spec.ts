import { expect, test, type Page } from "@playwright/test";

const baseURL = "http://127.0.0.1:3000";
const executablePath =
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

test.use({
  baseURL,
  launchOptions: { executablePath },
  viewport: { width: 1440, height: 900 },
});
test.setTimeout(90_000);

async function enterClass11(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Start Your Journey" }).click();
  await page.getByRole("button", { name: /Class 11/ }).last().click();
  await page.getByPlaceholder("Ishan").fill("Ishan");
  await page
    .getByPlaceholder("you@scholar.app")
    .fill(`task-visual-${Date.now()}@scholar.app`);
  await page.locator('input[type="password"]').fill("local-visual-test");
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.getByRole("button", { name: "Skip intro" }).click();
  await expect(page.locator("#main-scroll")).toBeVisible({ timeout: 20_000 });
}

async function showCompletion(page: Page) {
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("scholar:background-task:finished", {
        detail: {
          kind: "slideshow",
          title: "Your slideshow is ready",
          message: "18 source-grounded slides are ready to open.",
          viewId: "ai-tools",
        },
      }),
    );
  });
  return page.getByTestId("background-task-notification");
}

test("completion capsule reserves its own lane on desktop and mobile", async ({
  page,
}) => {
  await enterClass11(page);

  let notification = await showCompletion(page);
  await expect(notification).toBeVisible();
  await page.waitForTimeout(300);
  let noticeBox = await notification.boundingBox();
  let mainBox = await page.locator("#main-scroll").boundingBox();
  expect(noticeBox).not.toBeNull();
  expect(mainBox).not.toBeNull();
  expect(noticeBox!.y + noticeBox!.height).toBeLessThanOrEqual(mainBox!.y + 1);
  await page.screenshot({
    path: "test-artifacts/background-task-desktop.png",
    fullPage: false,
  });

  await expect(notification).toBeHidden({ timeout: 3_000 });
  await page.setViewportSize({ width: 390, height: 844 });
  notification = await showCompletion(page);
  await expect(notification).toBeVisible();
  await page.waitForTimeout(80);
  noticeBox = await notification.boundingBox();
  mainBox = await page.locator("#main-scroll").boundingBox();
  expect(noticeBox).not.toBeNull();
  expect(mainBox).not.toBeNull();
  expect(noticeBox!.x).toBeGreaterThanOrEqual(10);
  expect(noticeBox!.x + noticeBox!.width).toBeLessThanOrEqual(380);
  expect(noticeBox!.y + noticeBox!.height).toBeLessThanOrEqual(mainBox!.y + 1);
  await page.screenshot({
    path: "test-artifacts/background-task-mobile.png",
    fullPage: false,
  });
});
