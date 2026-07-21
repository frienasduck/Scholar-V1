import { expect, test, type Page } from "@playwright/test";

test.use({ baseURL: "http://127.0.0.1:3000", launchOptions: { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" }, viewport: { width: 1440, height: 900 } });
test.setTimeout(120_000);

async function enterClass11(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Start Your Journey" }).click();
  await page.getByRole("button", { name: /Class 11/ }).last().click();
  await page.getByPlaceholder("Ishan").fill("Ishan");
  await page.getByPlaceholder("you@scholar.app").fill("slideshow-acceptance@scholar.app");
  await page.locator('input[type="password"]').fill("local-test");
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.getByRole("button", { name: "Skip intro" }).click();
}

test("Structure of Atom detailed deck uses the complete ebook source and shared renderer", async ({ page }) => {
  await page.route("**/api/ai", (route) => {
    const body = route.request().postDataJSON() as { messages?: Array<{ content?: string }> };
    const content = body.messages?.[0]?.content ?? "";
    if (content.includes('"narrations"')) {
      const ids = [...new Set([...content.matchAll(/"id"\s*:\s*"([^"]+)"/g)].map((match) => match[1]))];
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { narrations: ids.map((slideId) => ({ slideId, script: "This explanation connects the source evidence to the current concept without repeating the visible slide.", caption: "Source-grounded explanation", durationSec: 18, highlightKeywords: [], pauseAfter: false })) } }) });
    }
    return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, error: "offline test" }) });
  });
  await enterClass11(page);
  await page.goto("/ai-tools", { waitUntil: "domcontentloaded" });
  await page.locator('[role="button"]:visible').filter({ hasText: "AI Slideshow Maker" }).click();
  const maker = page.getByTestId("slideshow-maker");
  await expect(maker).toBeVisible();
  await maker.getByRole("button", { name: /Clean E.Book Pages/ }).click();
  const selects = maker.locator("select");
  await selects.nth(0).selectOption({ label: "Chemistry" });
  await selects.nth(2).selectOption("structure-of-atom");
  await expect(maker.getByLabel("Starting page")).toHaveValue("38");
  await expect(maker.getByLabel("Ending page")).toHaveValue("80");
  await maker.getByRole("button", { name: /Analyse source/ }).click();
  await expect(maker.getByTestId("slideshow-outline")).toBeVisible();
  await expect(maker.getByText(/Recommended for detailed:/)).toBeVisible();
  await maker.getByRole("button", { name: /Generate \d+-slide source-complete presentation/ }).click();

  await expect(page.getByText("Structure of Atom", { exact: true }).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("coverage-panel")).toBeVisible();
  await expect(page.getByTestId("slideshow-quality-panel")).toBeVisible();
  await expect(page.locator('[data-slide-renderer="shared"]')).toBeVisible();
  await expect(page.getByText(/Create a presentation on/i)).toHaveCount(0);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("scholar-slideshows:class-11:v2") || "[]"));
  const deck = stored.find((item: any) => item.title === "Structure of Atom");
  expect(deck).toBeTruthy();
  expect(deck.slides.length).toBeGreaterThanOrEqual(25);
  expect(deck.slides.some((slide: any) => slide.sourcePages?.includes(38))).toBeTruthy();
  expect(deck.slides.some((slide: any) => slide.sourcePages?.includes(80))).toBeTruthy();

  await page.getByRole("button", { name: "Auto-Lecture" }).click();
  await page.getByRole("button", { name: /Generate narration for/ }).click();
  await expect(page.getByRole("button", { name: "Play Auto-Lecture" })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Play Auto-Lecture" }).click();
  const player = page.getByTestId("auto-lecture-player");
  const canvas = page.getByTestId("auto-lecture-slide-canvas");
  await expect(player).toBeVisible();
  await expect(player.getByRole("button", { name: "Enter Auto-Lecture fullscreen" })).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  expect(Math.abs(box!.width / box!.height - 16 / 9)).toBeLessThan(0.03);
  expect(box!.y + box!.height).toBeLessThanOrEqual(900 - 100);
  await player.getByRole("button", { name: "Enter Auto-Lecture fullscreen" }).click();
  await expect(player.getByRole("button", { name: "Exit Auto-Lecture fullscreen" })).toBeVisible();
});
