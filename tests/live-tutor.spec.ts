import { expect, test, type Page } from "@playwright/test";

test.use({
  baseURL: process.env.SCHOLAR_TEST_URL || "http://127.0.0.1:3001",
  launchOptions: { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" },
  viewport: { width: 1440, height: 960 },
});
test.setTimeout(90_000);

const email = "live-tutor@example.test";
const session = {
  authenticated: true, developerMode: false, plan: "FREE", entitlementsLoaded: true,
  user: { id: "live-tutor-user", email, name: "Live Learner", role: "USER", coins: 0, currentScholarClass: 11 },
  access: { plan: "FREE", source: "free", entitlementsLoaded: true, entitlements: [], subscriptionId: null, subscriptionStatus: null, subscriptionEndsAt: null, storageLimitBytes: 10_000_000, dailyQuizLimit: 3, dailySlideshowLimit: 1 },
  usage: { day: "2026-09-21", quiz: { used: 0, limit: 3 }, slideshow: { used: 0, limit: 1 } },
  config: { subscriptionsEnabled: true, checkoutConfigured: false },
};

async function prepare(page: Page) {
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: session }));
  await page.route("**/api/lam/live/providers", (route) => route.fulfill({ json: { ok: true, providers: [
    { id: "auto", label: "Auto", available: true },
    { id: "groq", label: "Groq", available: true, model: "test-model" },
    { id: "gemini", label: "Gemini", available: false },
    { id: "nvidia", label: "NVIDIA", available: false },
  ] } }));
  await page.route("**/api/lam/live/memory**", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { ok: true, memories: [], summary: { relevantMemories: 0, weakTopics: [], unresolvedMistakes: 0, dueRevision: 0 } } });
    return route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/lam/chat", (route) => route.fulfill({
    status: 200,
    contentType: "text/event-stream",
    body: 'data: {"type":"start","provider":"groq","model":"test-model"}\n\ndata: {"type":"text-delta","value":"Force equals mass times acceleration."}\n\ndata: {"type":"finish"}\n\n',
  }));
  await page.addInitScript(({ email }) => {
    localStorage.setItem("scholar-workspace-owner-v1", email);
    localStorage.setItem("neha-scholar-v5", JSON.stringify({ schema: 5, state: {
      authed: true, guestMode: false, onboarded: true,
      user: { email, name: "Live Learner", username: "live", bio: "", school: "", class: "11 - CBSE", avatar: "L", scholarClass: 11, jeeMode: false },
    } }));
    class FakeRecognition {
      lang = ""; continuous = false; interimResults = false;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() { setTimeout(() => this.onresult?.({ results: [{ 0: { transcript: "Explain momentum" }, isFinal: true }] }), 10); }
      stop() { this.onend?.(); }
      abort() { this.onend?.(); }
    }
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: FakeRecognition });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } });
  }, { email });
}

test("Live Tutor preserves the session across personality changes and streams a response", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await prepare(page);
  await page.goto("/live-tutor", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Ready when you are." })).toBeVisible();
  await expect(page.getByLabel("Message LAM Live Tutor")).toBeVisible();
  await page.getByLabel("Message LAM Live Tutor").fill("Explain Newton's second law");
  await page.getByRole("button", { name: "Ask LAM" }).click();
  await expect(page.getByText("Force equals mass times acceleration.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Live Tutor settings" }).click();
  await page.getByRole("button", { name: "Curious", exact: true }).click();
  await expect(page.getByRole("heading", { name: "What shall we discover?" })).toBeVisible();
  await expect(page.getByText("Force equals mass times acceleration.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: "test-artifacts/live-tutor-desktop.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("Live Tutor microphone is explicit and the mobile composer does not overflow", async ({ page }) => {
  await prepare(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/live-tutor", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Talk/ }).click();
  await expect(page.getByLabel("Message LAM Live Tutor")).toHaveValue("Explain momentum");
  await expect(page.getByText("Listening", { exact: true })).toBeVisible();
  const geometry = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(geometry.page).toBeLessThanOrEqual(geometry.viewport + 1);
  expect(geometry.body).toBeLessThanOrEqual(geometry.viewport + 1);
  await page.screenshot({ path: "test-artifacts/live-tutor-mobile.png", fullPage: true });
});

test("Live Tutor asks before executing a Scholar navigation action", async ({ page }) => {
  await prepare(page);
  await page.goto("/live-tutor", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Message LAM Live Tutor").fill("open notes");
  await page.getByRole("button", { name: "Ask LAM" }).click();
  await expect(page.getByText("Open notes", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page).toHaveURL(/\/notes$/);
});
