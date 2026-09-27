import { expect, test, type Page } from "@playwright/test";

const browserExecutable = process.env.SCHOLAR_TEST_BROWSER_EXECUTABLE
  ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

test.use({
  baseURL: "http://127.0.0.1:3000",
  viewport: { width: 1440, height: 900 },
  launchOptions: { executablePath: browserExecutable },
});
test.setTimeout(120_000);

const email = "client-runtime@example.test";
const session = {
  authenticated: true,
  developerMode: false,
  plan: "PLUS",
  entitlementsLoaded: true,
  user: { id: "client-runtime-user", email, name: "Runtime Learner", role: "USER", coins: 0, currentScholarClass: 11 },
  access: {
    plan: "PLUS",
    source: "plus",
    entitlementsLoaded: true,
    entitlements: ["lam_ai"],
    subscriptionId: "client-runtime-plus",
    subscriptionStatus: "ACTIVE",
    subscriptionEndsAt: null,
    storageLimitBytes: 100_000_000,
    dailyQuizLimit: 30,
    dailySlideshowLimit: 10,
    monthlyEbookUploadLimit: 20,
    monthlyMockExamLimit: 30,
  },
  usage: { day: "2026-09-26", quiz: { used: 0, limit: 30 }, slideshow: { used: 0, limit: 10 } },
  config: { subscriptionsEnabled: true, checkoutConfigured: false },
};

async function prepareAuthenticated(page: Page, options: { noIntersectionObserver?: boolean; abortVideo?: boolean } = {}) {
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: session }));
  if (options.abortVideo !== false) await page.route(/\.mp4(?:\?.*)?$/, (route) => route.abort());
  await page.addInitScript(({ email, noIntersectionObserver }) => {
    Object.defineProperty(navigator, "deviceMemory", { configurable: true, get: () => 4 });
    Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, get: () => 4 });
    if (noIntersectionObserver) {
      Object.defineProperty(window, "IntersectionObserver", { configurable: true, value: undefined });
    }
    localStorage.setItem("scholar-workspace-owner-v1", email);
    localStorage.setItem("neha-scholar-v5", JSON.stringify({ schema: 7, state: {
      authed: true,
      guestMode: false,
      onboarded: true,
      user: { email, name: "Runtime Learner", username: "runtime", bio: "", school: "", class: "11 - CBSE", avatar: "R", scholarClass: 11, jeeMode: false },
      settings: { reduceMotion: false, sidebarBehavior: "open", mobileLamMode: "off", elamEnabled: false },
    } }));
  }, { email, noIntersectionObserver: Boolean(options.noIntersectionObserver) });
}

test("desktop keeps full glass material and animates one clean navigation selection", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await prepareAuthenticated(page, { abortVideo: false });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".scholar-shell")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("html")).toHaveAttribute("data-sg-material", "full");
  await expect(page.locator("html")).toHaveAttribute("data-sg-pointer", "fine");

  const sidebar = page.locator(".scholar-desktop-sidebar");
  await expect(sidebar).toBeVisible();
  await expect(sidebar.locator(".sg-nav-pill-motion")).toHaveCount(1);
  await expect(sidebar.locator(".scholar-nav-item > .absolute.left-0")).toHaveCount(0);
  await expect(sidebar.getByRole("button", { name: /^Dashboard$/ })).toHaveAttribute("aria-current", "page");

  await sidebar.getByRole("button", { name: /^Study$/ }).click();
  await expect(page.locator("#main-scroll")).toHaveAttribute("data-active-view", "study");
  await expect(sidebar.getByRole("button", { name: /^Study$/ })).toHaveAttribute("aria-current", "page");
  await expect(sidebar.getByRole("button", { name: /^Dashboard$/ })).not.toHaveAttribute("aria-current", "page");
  await expect(sidebar.getByRole("button", { name: /^Study$/ }).locator(".sg-nav-pill-motion")).toBeVisible();
  await expect(sidebar.locator(".sg-nav-pill-motion")).toHaveCount(1);
  expect(consoleErrors).toEqual([]);
});

test("install guide traps focus, closes with Escape, and returns focus", async ({ page }) => {
  await prepareAuthenticated(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".scholar-shell")).toBeVisible({ timeout: 30_000 });

  const search = page.getByRole("button", { name: /Search or jump to/i });
  await search.focus();
  await page.evaluate(() => window.dispatchEvent(new Event("scholar:install-app")));
  const dialog = page.getByRole("dialog", { name: "Install Scholar" });
  await expect(dialog).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest("[role='dialog']")))).toBe(true);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(search).toBeFocused();
});

test("background video falls back safely without IntersectionObserver on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareAuthenticated(page, { noIntersectionObserver: true });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".scholar-shell")).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});

test("touch devices use the optimized glass fallback and keep mobile navigation accessible", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await prepareAuthenticated(page);

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".scholar-shell")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("html")).toHaveAttribute("data-sg-material", "reduced");
  await expect(page.locator("html")).toHaveAttribute("data-sg-refraction", "off");
  await expect(page.locator("html")).toHaveAttribute("data-sg-pointer", "coarse");

  const toggle = page.getByRole("button", { name: "Open bottom menu" });
  await expect(toggle).toBeVisible();
  const toggleBox = await toggle.boundingBox();
  expect(toggleBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  await toggle.click();

  const mobileNav = page.getByRole("navigation", { name: "Primary mobile navigation" });
  await expect(mobileNav).toBeVisible();
  await expect(mobileNav.getByRole("button", { name: "Home" })).toHaveAttribute("aria-current", "page");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);

  await context.close();
});

test("authenticated shell exposes named controls and unique element ids", async ({ page }) => {
  await prepareAuthenticated(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".scholar-shell")).toBeVisible({ timeout: 30_000 });

  const audit = await page.evaluate(() => {
    const visible = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && box.width > 0 && box.height > 0;
    };
    const nameFor = (element: HTMLElement) => {
      const labelledBy = element.getAttribute("aria-labelledby");
      const labelledText = labelledBy
        ?.split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" ")
        .trim();
      return (
        element.getAttribute("aria-label")
        || labelledText
        || element.textContent?.trim()
        || element.getAttribute("title")
        || element.getAttribute("placeholder")
        || ""
      );
    };
    const controls = Array.from(document.querySelectorAll<HTMLElement>("button, [role='button'], a[href], input, select, textarea"));
    const unnamed = controls
      .filter(visible)
      .filter((element) => !nameFor(element))
      .map((element) => `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}.${element.className}`);
    const ids = Array.from(document.querySelectorAll<HTMLElement>("[id]"), (element) => element.id);
    const duplicateIds = ids.filter((id, index) => id && ids.indexOf(id) !== index);
    return { unnamed, duplicateIds: [...new Set(duplicateIds)] };
  });

  expect(audit.unnamed).toEqual([]);
  expect(audit.duplicateIds).toEqual([]);
});
