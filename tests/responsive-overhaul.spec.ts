import { expect, test, type Page } from "@playwright/test";

test.use({
  baseURL: process.env.SCHOLAR_TEST_URL || "http://127.0.0.1:3001",
  launchOptions: { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" },
});
test.setTimeout(120_000);

const email = "responsive@example.test";
const session = {
  authenticated: true,
  developerMode: false,
  plan: "FREE",
  entitlementsLoaded: true,
  user: { id: "responsive-user", email, name: "Responsive Learner", role: "USER", coins: 0, currentScholarClass: 11 },
  access: { plan: "FREE", source: "free", entitlementsLoaded: true, entitlements: [], subscriptionId: null, subscriptionStatus: null, subscriptionEndsAt: null, storageLimitBytes: 10_000_000, dailyQuizLimit: 3, dailySlideshowLimit: 1 },
  usage: { day: "2026-09-22", quiz: { used: 0, limit: 3 }, slideshow: { used: 0, limit: 1 } },
  config: { subscriptionsEnabled: true, checkoutConfigured: false },
};

async function prepareAuthenticated(page: Page, mobileLamMode: "off" | "compact" | "full" = "off") {
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: session }));
  await page.route(/\.mp4(?:\?.*)?$/, (route) => route.abort());
  await page.addInitScript(({ email, mobileLamMode }) => {
    localStorage.setItem("scholar-workspace-owner-v1", email);
    localStorage.setItem("neha-scholar-v5", JSON.stringify({ schema: 5, state: {
      authed: true,
      guestMode: false,
      onboarded: true,
      user: { email, name: "Responsive Learner", username: "responsive", bio: "", school: "", class: "11 - CBSE", avatar: "R", scholarClass: 11, jeeMode: false },
      settings: { mobileLamMode },
    } }));
  }, { email, mobileLamMode });
}

async function expectNoPageOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    return document.documentElement.scrollWidth <= viewport + 1 && document.body.scrollWidth <= viewport + 1;
  })).toBe(true);
}

test("public landing remains usable from 320px through desktop", async ({ page }) => {
  await page.route(/\.mp4(?:\?.*)?$/, (route) => route.abort());
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { ...session, authenticated: false, beta: { privateBeta: true, registrationEnabled: false } } }));
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1180, height: 820 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Sign In" }).first()).toBeVisible();
    await expectNoPageOverflow(page);
  }
});

test("critical signed-in routes do not create page-level mobile overflow", async ({ page }) => {
  await prepareAuthenticated(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const routes = ["/", "/live-tutor", "/files", "/ebook", "/quiz", "/flashcards", "/notes", "/focus", "/nigtube", "/music", "/settings"];
  for (const route of routes) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".scholar-shell")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("main")).toHaveAttribute("data-active-view", route === "/" ? "dashboard" : route.slice(1));
    await expectNoPageOverflow(page);
  }
});

test("shell, drawer and fixed navigation adapt across tablet, compact laptop and landscape phone", async ({ page }) => {
  await prepareAuthenticated(page);
  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1180, height: 820 },
    { width: 844, height: 390 },
    { width: 740, height: 360 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".scholar-shell")).toBeVisible({ timeout: 20_000 });
    await expectNoPageOverflow(page);
    if (viewport.width < 1024) {
      const nav = page.locator(".scholar-bottom-nav");
      await expect(nav).toBeVisible();
      const box = await nav.boundingBox();
      expect(box?.width).toBeLessThanOrEqual(viewport.width + 1);
      await page.getByRole("button", { name: "Open navigation menu" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
    }
  }
});

test("mobile LAM opens as a keyboard-safe panel without page overflow", async ({ page }) => {
  await prepareAuthenticated(page, "full");
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/study", { waitUntil: "domcontentloaded" });
  const lamToggle = page.getByRole("button", { name: "LAM", exact: true });
  await expect(lamToggle).toBeVisible({ timeout: 20_000 });
  await lamToggle.click();
  const onboarding = page.getByRole("heading", { name: "Meet LAM" });
  if (await onboarding.isVisible().catch(() => false)) {
    const lam = page.getByLabel("LAM personal assistant");
    for (const label of ["Continue", "Continue", "Continue", "Start using LAM"]) {
      await lam.getByRole("button", { name: label }).click();
    }
  }
  const input = page.getByRole("textbox", { name: "Message LAM" });
  await expect(input).toBeVisible();
  await input.focus();
  await expectNoPageOverflow(page);
});

test("Group Study entry and public What's New stay responsive", async ({ page }) => {
  await prepareAuthenticated(page);
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1180, height: 820 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/group-study", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Group Study", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await expectNoPageOverflow(page);
    await page.goto("/updates", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "What's new" })).toBeVisible();
    await expectNoPageOverflow(page);
  }
});
