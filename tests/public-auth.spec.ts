import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_PREFERENCES } from "../src/lib/personalization/schema";
test.use({ baseURL: "http://127.0.0.1:3000", launchOptions: { executablePath: process.env.SCHOLAR_QA_BROWSER || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" } });
test.setTimeout(150_000);
async function fixture(page: Page, options: { signedIn?: boolean; status?: string; google?: boolean; recovery?: boolean } = {}) {
  const state = { signedIn: options.signedIn ?? false, status: options.status || "NOT_STARTED", submits: 0, fail: false, pending: false };
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/**", (route) => route.fulfill({ json: { ok: true, files: [], memories: [], sessions: [], items: [], rooms: [], usage: {}, config: {} } }));
  await page.route("**/api/auth/config", (route) => route.fulfill({ json: { registrationEnabled: true, googleConfigured: options.google ?? false, passwordResetConfigured: options.recovery ?? false } }));
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { authenticated: state.signedIn, developerMode: false, plan: "FREE", entitlementsLoaded: true, user: state.signedIn ? { id: "public-auth-owner", email: "public@example.test", name: "New Learner", role: "USER", coins: 0, currentScholarClass: 11 } : null,
    access: { plan: "FREE", source: "free", entitlementsLoaded: true, entitlements: [], storageLimitBytes: 10485760, dailyQuizLimit: 3, dailySlideshowLimit: 1, monthlyEbookUploadLimit: 3, monthlyMockExamLimit: 3 }, usage: { day: "2026-09-27", quiz: { used: 0, limit: 3 }, slideshow: { used: 0, limit: 1 } }, config: { subscriptionsEnabled: true, checkoutConfigured: false }, beta: { privateBeta: false, registrationEnabled: true } } }));
  await page.route("**/api/personalization", (route) => route.fulfill({ json: { required: true, status: state.status, stage: state.status === "IN_PROGRESS" ? 3 : 0, revision: 0, preferences: DEFAULT_PREFERENCES, result: null, bonus: { total: 52428800, used: 0, closed: state.status === "SKIPPED" }, jobStartedAt: null } }));
  const submit = async (route: Parameters<Parameters<Page["route"]>[1]>[0]) => {
    state.submits++;
    if (state.pending) await new Promise((resolve) => setTimeout(resolve, 150));
    if (state.fail) return route.fulfill({ status: 429, json: { error: "RATE_LIMITED", message: "Too many attempts. Please retry later." } });
    state.signedIn = true; await route.fulfill({ json: { ok: true, user: { id: "public-auth-owner", email: "public@example.test", name: "New Learner", role: "USER", currentScholarClass: 11 } } });
  };
  await page.route("**/api/auth/login", submit); await page.route("**/api/auth/register", submit);
  await page.route("**/api/auth/recovery", (route) => route.fulfill({ json: { ok: true, message: "Password updated. Sign in with your new password." } }));
  await page.addInitScript(() => {
    if (!localStorage.getItem("neha-scholar-v5")) localStorage.setItem("neha-scholar-v5", JSON.stringify({ schema: 6, state: { authed: false, guestMode: false, settings: { startupLoadingMode: "quick", elamEnabled: false, mobileLamMode: "off" } } }));
  });
  return { state, errors };
}
async function open(page: Page) { await page.goto("/login", { waitUntil: "domcontentloaded" }); await page.locator("#scholar-auth-form").evaluate((form) => form.parentElement?.scrollIntoView({block:"start"})); await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible(); }
async function credentials(page: Page) { await page.getByLabel("Email", { exact: true }).fill("public@example.test"); await page.getByLabel("Password", { exact: true }).fill("unit-fixture-password"); }
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); }
test("original landing and glass card survive all 12 requested sizes; both auth modes stay reachable", async ({ page }) => {
  const { errors } = await fixture(page); await open(page);
  const sizes = [[1920,1080],[1440,900],[1366,768],[1280,720],[1024,600],[834,1194],[768,1024],[430,932],[390,844],[360,800],[320,568],[844,390]];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.getByRole("button", { name: "Sign in", exact: true }).first().click(); await noOverflow(page);
    await page.getByLabel("Email", { exact: true }).scrollIntoViewIfNeeded();
    const box = await page.getByLabel("Email", { exact: true }).boundingBox(); expect(box!.y).toBeLessThan(height); expect(box!.width).toBeGreaterThan(190);
    await expect(page.locator(".scholar-auth-nav")).toBeVisible(); expect(await page.locator('p.lg-serif').filter({hasText:/Learning.*evolved/}).count()).toBe(1);
    await expect(page.locator("#scholar-auth-form").locator("..")).toHaveClass(/lg-glass-strong/);
    const assets = await page.locator("video").evaluateAll((videos) => videos.map((video) => video.getAttribute("data-src") || video.getAttribute("src") || video.querySelector("source")?.src || ""));
    expect(assets.some((src) => src.includes("hf_20260418_094631"))).toBe(true);
    if ([1440,1366,1024,390,320,844].includes(width)) {
      await page.evaluate(() => window.scrollTo(0,0)); await page.waitForTimeout(1800);
      await page.screenshot({ path: `test-artifacts/auth-restored-hero-${width}x${height}.png` });
      await page.locator("#scholar-auth-form").evaluate((form) => form.parentElement?.scrollIntoView({block:"start",behavior:"instant"}));
      await page.waitForTimeout(800);
      await page.screenshot({ path: `test-artifacts/auth-restored-card-${width}x${height}.png` });
    }
    await page.getByRole("button", { name: "Create account", exact: true }).first().click(); await noOverflow(page); await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
    await page.getByLabel("Confirm password").scrollIntoViewIfNeeded(); await expect(page.getByLabel("Confirm password")).toBeVisible();
    if (width === 390) await page.screenshot({ path: "test-artifacts/public-auth-signup-mobile.png", fullPage: true });
    await page.evaluate(() => window.scrollTo(0,0));
  }
  expect(errors).toEqual([]);
});
test("keyboard submit, show-hide password, generic rate-limit recovery and no duplicate submission", async ({ page }) => {
  const { state, errors } = await fixture(page); state.fail = true; state.pending = true; await open(page); await credentials(page);
  await page.getByRole("button", { name: "Show password" }).click(); await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text"); await page.getByRole("button", { name: "Hide password" }).click();
  await page.getByLabel("Password", { exact: true }).focus(); await page.keyboard.press("Enter");
  await expect(page.locator(".auth-error")).toContainText("Too many attempts"); expect(state.submits).toBe(1); await expect(page.locator(".auth-error")).toBeFocused(); await expect(page.locator('button[type="submit"]')).toBeEnabled(); expect(errors).toEqual([]);
});
test("signup confirms passwords before calling server; success enters Your Scholar", async ({ page }) => {
  const { state, errors } = await fixture(page); await open(page); await page.getByRole("button", { name: "Create account", exact: true }).first().click();
  await page.getByLabel("Name", { exact: true }).fill("New Learner"); await credentials(page); await page.getByLabel("Confirm password").fill("different-password"); await page.locator('button[type="submit"]').click(); await expect(page.locator(".auth-error")).toContainText("do not match"); expect(state.submits).toBe(0);
  await page.getByLabel("Confirm password").fill("unit-fixture-password"); await page.locator('button[type="submit"]').click(); await expect(page.locator(".your-scholar")).toBeVisible({ timeout: 30000 }); expect(state.submits).toBe(1); expect(errors).toEqual([]);
});
test("email login resumes the existing personalized setup", async ({ page }) => {
  const { errors } = await fixture(page, { status: "IN_PROGRESS" }); await open(page); await credentials(page); await page.locator('button[type="submit"]').click(); await expect(page.locator(".your-scholar")).toHaveAttribute("data-setup-stage", "3", { timeout: 30000 }); expect(errors).toEqual([]);
});
test("restored completed/skipped profile goes to dashboard without a fresh signup", async ({ page }) => {
  const { errors } = await fixture(page, { signedIn: true, status: "SKIPPED" }); await page.goto("/", { waitUntil: "domcontentloaded" }); await expect(page.locator(".scholar-shell")).toBeVisible({ timeout: 30000 }); await expect(page.getByRole("heading", { name: "WITNESS YOUR GROWTH UNFOLD" })).toBeVisible(); await expect(page.locator(".your-scholar")).toBeHidden(); expect(errors).toEqual([]);
});
test("missing Google/email configuration is honest; guest entry and private-feature guard work", async ({ page }) => {
  const { errors } = await fixture(page); await open(page); await expect(page.getByRole("button", { name: "Continue with Google" })).toBeDisabled(); await expect(page.getByText("Google sign-in is not available here yet.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Forgot password?" }).click(); await expect(page.getByText("Email recovery isn’t available here yet.", { exact: false })).toBeVisible(); await expect(page.getByRole("button", { name: "Send reset link" })).toBeDisabled();
  await page.getByRole("button", { name: "Continue as Guest", exact: true }).click(); await expect(page.getByText("Guest session", { exact: true })).toBeVisible({ timeout: 30000 }); await page.goto("/files", { waitUntil: "domcontentloaded" }); await expect(page.getByRole("heading", { name: "Sign in to use this private feature" })).toBeVisible(); expect(errors).toEqual([]);
});
test("reset fragment is cleared and submitted only in bounded POST body; invalid Google return is controlled", async ({ page }) => {
  await fixture(page, { recovery: true }); let tokenSent = "";
  await page.route("**/api/auth/recovery", (route) => { tokenSent = route.request().postDataJSON().token; return route.fulfill({ json: { ok: true, message: "Password updated. Sign in with your new password." } }); });
  await page.goto(`/login#reset=${"a".repeat(43)}`); await expect(page.getByRole("heading", { name: "Choose a new password", exact: true })).toBeVisible(); expect(page.url()).not.toContain("#"); await page.getByLabel("New password", { exact: true }).fill("unit-new-password"); await page.getByLabel("Confirm password").fill("unit-new-password"); await page.getByRole("button", { name: "Update password" }).click(); await expect(page.locator(".auth-success")).toContainText("Password updated"); expect(tokenSent).toBe("a".repeat(43));
  await page.goto("/login?authError=GOOGLE_LINK_REQUIRED"); await expect(page.locator(".auth-error")).toContainText("connect Google in Settings"); expect(page.url()).not.toContain("authError");
});
test("Google UI starts server authorization and Settings linking is explicit", async ({ page }) => {
  const { state } = await fixture(page, { google: true }); let intent = "";
  await page.route("**/api/auth/google/start", (route) => { intent = route.request().postDataJSON().intent; return route.fulfill({ status: 503, json: { message: "Provider fixture unavailable; no external OAuth call." } }); });
  await open(page); await page.getByRole("button", { name: "Continue with Google" }).click(); await expect(page.locator(".auth-error")).toContainText("Provider fixture unavailable"); expect(intent).toBe("signin");
  state.signedIn = true; state.status = "SKIPPED"; await page.route("**/api/auth/account", (route) => route.fulfill({ json: { googleConfigured: true, googleConnected: false, emailVerified: true, emailVerificationConfigured: false } }));
  await page.goto("/settings"); await page.getByRole("button", { name: "Connect Google", exact: true }).click(); expect(intent).toBe("link"); await expect(page.getByRole("status").filter({ hasText: "Provider fixture unavailable" })).toBeVisible();
});
