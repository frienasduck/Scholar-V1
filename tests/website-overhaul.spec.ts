import { test, expect, type Page } from "@playwright/test";

// UI/session contract tests use synthetic server responses, never production
// credentials. Real provider checks are separate in ai-live.test.ts.
test.use({ baseURL: process.env.SCHOLAR_TEST_URL || "http://127.0.0.1:3100", launchOptions: { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" }, viewport: { width: 390, height: 844 } });
test.setTimeout(180_000);
const widths = [320, 360, 375, 390, 412, 430, 480, 600, 768, 820, 1024, 1280, 1440, 1920];
const email = "ui-audit@example.test";
const entitlements = ["levels", "aisig", "homework_scanner", "exam_prep", "assignments", "practical_lab", "derivation_library", "store_plus_items", "expanded_file_storage", "appearance_lab", "class_9_access", "nigtube_ad_free", "study_music_ad_free", "quiz_generation_plus", "slideshow_generation_plus", "formula_explorer", "plus_coin_bonus", "python_workspace"];
const session = {
  authenticated: true, developerMode: false, plan: "PLUS", entitlementsLoaded: true,
  user: { id: "ui-audit", email, name: "Audit Student", role: "USER", coins: 0, currentScholarClass: 11 },
  access: { plan: "PLUS", source: "plus", entitlementsLoaded: true, entitlements, subscriptionId: "audit", subscriptionStatus: "active", subscriptionEndsAt: null, storageLimitBytes: 100000000, dailyQuizLimit: -1, dailySlideshowLimit: -1 },
  usage: { day: "2026-09-10", quiz: { used: 0, limit: -1 }, slideshow: { used: 0, limit: -1 } },
  config: { subscriptionsEnabled: true, regularPriceInr: 300, offerPriceInr: 100, offerEnabled: true, offerLabel: "Offer", checkoutConfigured: true },
};

async function setupAccount(page: Page, authed = true) {
  await page.route("**/api/auth/session", route => route.fulfill({ json: session }));
  await page.route("**/api/files/quota", route => route.fulfill({ json: { ok: true, usedBytes: 0, limitBytes: 100000000 } }));
  await page.addInitScript(({ email, authed }) => {
    if (localStorage.getItem("overhaul-test-seeded")) return;
    localStorage.setItem("overhaul-test-seeded", "1");
    localStorage.setItem("scholar-workspace-owner-v1", email);
    localStorage.setItem("neha-scholar-v5", JSON.stringify({ schema: 5, state: {
      authed, guestMode: false, onboarded: true,
      user: { email, name: "Audit Student", username: "audit", bio: "", school: "", class: "11 - CBSE", avatar: "S", scholarClass: 11, jeeMode: false },
      notes: [{ id: "audit-note", title: "Photosynthesis is valid study content", content: "Keep this real note across refreshes.", folder: "", tags: [], color: "indigo", pinned: false, createdAt: Date.now(), updatedAt: Date.now(), versions: [] }],
    } }));
  }, { email, authed });
}

async function noOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(geometry.document, JSON.stringify(geometry)).toBeLessThanOrEqual(geometry.width + 1);
  expect(geometry.body, JSON.stringify(geometry)).toBeLessThanOrEqual(geometry.width + 1);
}

test("AI Tutor displays a completed stream and recovers from provider failure", async ({ page }) => {
  await setupAccount(page);
  let calls = 0;
  await page.route("**/api/ai?stream=1", route => {
    calls++;
    return calls === 1
      ? route.fulfill({ contentType: "text/event-stream", body: 'data: {"delta":"Force equals mass times acceleration."}\n\ndata: {"done":true}\n\n' })
      : route.fulfill({ status: 503, json: { ok: false, error: { message: "AI provider temporarily unavailable. Please retry." } } });
  });
  await page.goto("/ai-tutor");
  const composer = page.getByPlaceholder(/^Ask .* anything/).first();
  await composer.fill("Explain Newton's second law.");
  await page.getByRole("button", { name: "Send message", exact: true }).first().click();
  await expect(page.getByText("Force equals mass times acceleration.", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Stop response", exact: true })).toHaveCount(0);
  await composer.fill("Explain acceleration.");
  await page.getByRole("button", { name: "Send message", exact: true }).first().click();
  await expect(page.getByText("AI couldn't respond", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Stop response", exact: true })).toHaveCount(0);
  expect(calls).toBe(2);
  await page.reload();
  await expect(page.getByText("Force equals mass times acceleration.", { exact: true }).first()).toBeVisible();
});

test("stopping AI Tutor prevents a late answer from being saved", async ({ page }) => {
  await setupAccount(page);
  let release: (() => void) | undefined;
  await page.route("**/api/ai?stream=1", async route => {
    await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ contentType: "text/event-stream", body: 'data: {"delta":"This late reply must not be saved."}\n\ndata: {"done":true}\n\n' }).catch(() => undefined);
  });
  await page.goto("/ai-tutor");
  await page.getByPlaceholder(/^Ask .* anything/).first().fill("Explain force slowly.");
  await page.getByRole("button", { name: "Send message", exact: true }).first().click();
  await expect.poll(() => !!release).toBe(true);
  await page.getByRole("button", { name: "Stop response", exact: true }).first().click();
  release!();
  await expect(page.getByRole("button", { name: "Stop response", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Explain force slowly.", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("This late reply must not be saved.", { exact: true })).toHaveCount(0);
});

test("public landing and footer work at every requested width", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  for (const width of widths) { await page.setViewportSize({ width, height: 900 }); await noOverflow(page); }
  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Privacy");
  expect((await page.request.get("/not-a-scholar-route")).status()).toBe(404);
});

test("server session restores local auth, retains notes, and files survive reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => { errors.push(error.stack || error.message || String(error)); });
  await setupAccount(page, false);
  await page.goto("/notes");
  await expect(page.getByText("Photosynthesis is valid study content").first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("Photosynthesis is valid study content").first()).toBeVisible();
  await page.goto("/files");
  await page.locator('input[type="file"]').setInputFiles({ name: "durable-study-note.txt", mimeType: "text/plain", buffer: Buffer.from("Momentum is conserved. File content survives reload.") });
  await expect(page.getByText("durable-study-note.txt", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByText("durable-study-note.txt", { exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "Preview durable-study-note.txt" });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByText("Momentum is conserved. File content survives reload.")).toBeVisible();
  await viewer.getByRole("button", { name: "Close file preview" }).click();
  await page.screenshot({ path: "test-artifacts/overhaul-files-verified.png" });
  expect(errors).toEqual([]);
});

test("important routes render without page crashes or horizontal page overflow", async ({ page }) => {
  test.setTimeout(480_000);
  const errors: string[] = [];
  page.on("pageerror", error => { errors.push(error.stack || error.message || String(error)); console.error(error.stack || String(error)); });
  await setupAccount(page);
  page.on("console", message => { if (message.type() === "error") console.error(message.text()); });
  page.on("response", response => { if (response.status() >= 400) console.info(`HTTP ${response.status()}: ${response.url().split("?")[0]}`); });
  const routes = ["dashboard", "study", "notes", "files", "settings", "ai-tutor", "ai-tools", "quiz", "flashcards", "planner", "focus", "nigtube", "music", "lab", "reminders", "intelligence", "plus"];
  for (const route of routes) {
    await page.goto(`/${route}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#main-scroll")).toBeVisible();
    await expect(page.getByText("Opening your workspace…", { exact: true })).toBeHidden({ timeout: 30_000 });
    await expect(page.getByText("We couldn't open this page", { exact: true })).toBeHidden();
    await expect(page.getByText("This view encountered an error", { exact: true })).toBeHidden();
    await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
    for (const width of [390, 1440]) { await page.setViewportSize({ width, height: 900 }); await noOverflow(page); }
    console.info(`Route UI checked: ${route}`);
  }
  await page.goto("/settings");
  await expect(page.getByRole("tab", { name: "Account", exact: true })).toBeVisible();
  for (const width of widths) { await page.setViewportSize({ width, height: 900 }); await noOverflow(page); }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-artifacts/overhaul-settings-verified.png" });
  expect(errors).toEqual([]);
});
