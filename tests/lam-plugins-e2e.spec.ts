import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const baseURL = process.env.SCHOLAR_BASE_URL || "http://localhost:3000";
const bridgeURL = process.env.LAM_E2E_BRIDGE_URL || "http://127.0.0.1:3099";
const executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const shotsDir = path.resolve(process.cwd(), "artifacts/lam-ai-plugin-overhaul/screenshots");

test.use({
  baseURL,
  launchOptions: { executablePath },
});
test.setTimeout(900_000);

function shotPath(name: string) {
  fs.mkdirSync(shotsDir, { recursive: true });
  return path.join(shotsDir, name);
}

async function setupScholarSession(
  page: Page,
  options: {
    plan: "FREE" | "PLUS";
    wireLivePluginExecute: boolean;
  },
) {
  const email = `lam-e2e-${options.plan.toLowerCase()}@example.test`;
  const entitlements =
    options.plan === "PLUS"
      ? [
          "lam_ai",
          "workspace_ai",
          "aisig",
          "homework_scanner",
          "slideshow_generation_plus",
          "jee_focused_mode",
          "notes_pdf",
          "advanced_labs",
        ]
      : ["lam_ai", "workspace_ai"];

  const sessionPayload = {
    authenticated: true,
    developerMode: false,
    plan: options.plan,
    entitlementsLoaded: true,
    user: {
      id: `lam-e2e-${options.plan.toLowerCase()}-user`,
      email,
      name: "Alex Learner",
      role: "USER",
      coins: 120,
      currentScholarClass: 11,
    },
    access: {
      plan: options.plan,
      source: options.plan === "PLUS" ? "plus" : "free",
      entitlementsLoaded: true,
      entitlements,
      subscriptionId: options.plan === "PLUS" ? "e2e-plus-sub" : null,
      subscriptionStatus: options.plan === "PLUS" ? "ACTIVE" : "NONE",
      subscriptionEndsAt: null,
      storageLimitBytes: 10_000_000,
      dailyQuizLimit: 30,
      dailySlideshowLimit: 10,
      monthlyEbookUploadLimit: 20,
      monthlyMockExamLimit: 30,
    },
    usage: {
      day: "2026-11-11",
      quiz: { used: 0, limit: 30 },
      slideshow: { used: 0, limit: 10 },
    },
    config: { subscriptionsEnabled: true, checkoutConfigured: false },
  };

  await page.route("**/api/auth/session", (route) => route.fulfill({ json: sessionPayload }));
  await page.route("**/api/lam/live/providers", (route) =>
    route.fulfill({
      json: {
        ok: true,
        providers: [
          { id: "auto", label: "Auto", available: true },
          { id: "groq", label: "Scholar Groq", available: true, model: "openai/gpt-oss-120b" },
        ],
      },
    }),
  );
  await page.route("**/api/lam/live/sessions*", (route) =>
    route.fulfill({ json: { ok: true, sessions: [] } }),
  );
  await page.route("**/api/lam/live/memory*", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        json: {
          ok: true,
          memories: [],
          summary: { relevantMemories: 0, weakTopics: [], unresolvedMistakes: 0, dueRevision: 0 },
        },
      });
    }
    return route.fulfill({ json: { ok: true } });
  });

  if (options.wireLivePluginExecute) {
    await page.route("**/api/lam/plugins/execute", async (route) => {
      const body = route.request().postData() || "{}";
      const upstream = await fetch(`${bridgeURL}/execute`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      const payload = await upstream.text();
      await route.fulfill({
        status: upstream.status,
        contentType: upstream.headers.get("content-type") || "text/event-stream; charset=utf-8",
        body: payload,
      });
    });
  }

  await page.addInitScript(({ addr }) => {
    if (!localStorage.getItem("scholar-workspace-owner-v1")) {
      localStorage.setItem("scholar-workspace-owner-v1", addr);
    }
    if (!localStorage.getItem("neha-scholar-v5")) {
      localStorage.setItem(
        "neha-scholar-v5",
        JSON.stringify({
          schema: 5,
          state: {
            authed: true,
            guestMode: false,
            onboarded: true,
            user: {
              email: addr,
              name: "Alex Learner",
              username: "alex",
              bio: "",
              school: "CBSE Public School",
              class: "11 - CBSE",
              avatar: "A",
              scholarClass: 11,
              jeeMode: false,
            },
          },
        }),
      );
    }
  }, { addr: email });

  await page.goto("/lam-ai", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("region", { name: "LAM AI", exact: true })).toBeVisible({ timeout: 25_000 });
  await expect(page.getByRole("textbox", { name: "Message LAM AI" })).toBeVisible({ timeout: 25_000 });
  const notNow = page.getByRole("button", { name: "Not now" });
  if (await notNow.isVisible({ timeout: 1_200 }).catch(() => false)) {
    await notNow.click();
  }
}

async function createSampleProblemPng(): Promise<string> {
  const tmpFile = path.resolve(process.cwd(), "artifacts/lam-ai-plugin-overhaul/sample-homework-question.png");
  fs.mkdirSync(path.dirname(tmpFile), { recursive: true });
  const svg = `<svg width="720" height="220" xmlns="http://www.w3.org/2000/svg">
    <rect width="720" height="220" fill="#ffffff"/>
    <text x="36" y="84" font-family="Arial, sans-serif" font-size="34" font-weight="bold" fill="#111111">Q1. Solve: 2x + 6 = 14</text>
    <text x="36" y="142" font-family="Arial, sans-serif" font-size="24" fill="#222222">Find x and verify your answer step by step.</text>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(tmpFile);
  return tmpFile;
}

async function selectPluginViaAt(page: Page, pluginName: string) {
  const input = page.getByRole("textbox", { name: "Message LAM AI" });
  await input.fill(`@${pluginName}`);
  const listbox = page.getByRole("listbox", { name: "LAM plugins" });
  await expect(listbox).toBeVisible({ timeout: 5_000 });
  const option = listbox
    .getByRole("option")
    .filter({ has: page.locator("strong").filter({ hasText: new RegExp(`^${pluginName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }) })
    .first();
  await expect(option).toBeVisible({ timeout: 5_000 });
  await option.click();
  await expect(page.getByLabel("Selected plugin")).toBeVisible({ timeout: 5_000 });
}

async function checkNoHorizontalOverflow(page: Page, contextLabel: string) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(overflow.scrollWidth, `${contextLabel} horizontal overflow`).toBeLessThanOrEqual(overflow.innerWidth + 2);
}

const PLUGIN_PROMPTS: Array<{ id: string; name: string; prompt: string }> = [
  { id: "notes-to-quiz", name: "Notes-to-Quiz", prompt: "Generate a 4-question MCQ quiz on Newton's Laws of Motion" },
  { id: "concept-explainer", name: "Concept Explainer", prompt: "Explain Lenz's Law with clear physical intuition" },
  { id: "flashcard-maker", name: "Flashcard Maker", prompt: "Create flashcards for Ideal Gas Law and Kinetic Theory" },
  { id: "ai-pdf-studio", name: "PDF Generator", prompt: "Create a structured revision study pack on Gravitation" },
  { id: "formula-sheet-generator", name: "Formula Sheet Generator", prompt: "Rotational motion and moment of inertia formulas" },
  { id: "diagram-flowchart-builder", name: "Diagram & Flowchart Builder", prompt: "Free Body Diagram steps for pulley-block problems" },
  { id: "pyq-solver", name: "PYQ Solver", prompt: "Solve: A 2 kg body starts from rest with a = 3 m/s^2 for 4 s. Find v and s (3 marks)." },
  { id: "ncert-question-generator", name: "NCERT Question Generator", prompt: "CBSE NCERT mixed questions on Uniform Circular Motion" },
  { id: "answer-evaluator", name: "Answer Evaluator", prompt: "Question: State Newton's second law (3 marks). My answer: F = ma, rate of change of momentum is force in Newtons." },
  { id: "revision-planner", name: "Revision & Study Planner", prompt: "5-day revision schedule for Physics Laws of Motion and Work Power Energy" },
  { id: "mistake-analyzer", name: "Mistake Analyzer", prompt: "I often miss friction direction and pseudo-force signs in non-inertial frames" },
  { id: "memory-predictor", name: "Memory Predictor", prompt: "Prioritize weak Class 11 Physics chapters for review" },
  { id: "academic-coach", name: "Academic Coach", prompt: "Diagnostic strategy to boost Physics and Chemistry accuracy by 15%" },
  { id: "one-night-exam", name: "One-Night Exam Prep", prompt: "I have 4 hours tonight for Work Energy and Power cram" },
  { id: "daily-briefing", name: "Daily Briefing", prompt: "Give me today's focused study briefing" },
  { id: "chapter-builder", name: "Chapter Builder", prompt: "Chapter notes pack for Zeroth & First Law of Thermodynamics" },
  { id: "chapter-summarizer", name: "Chapter Summarizer", prompt: "High-yield summary of Conservation of Linear Momentum" },
  { id: "life-saver", name: "Life Saver Button", prompt: "I feel anxious before my Mechanics test tomorrow, give me a 30-min rescue plan" },
  { id: "study-companion", name: "Study Companion", prompt: "Quick socratic check on Ohm's Law and drift velocity" },
  { id: "mistake-pattern-tracker", name: "Mistake Pattern Tracker", prompt: "Track why vector decomposition errors happen in kinematics" },
  { id: "slideshow-maker", name: "Slideshow Generator", prompt: "Work, Energy & Power 5-slide visual revision deck" },
  { id: "aisig", name: "AISIG", prompt: "Block on inclined plane vector force textbook diagram with labels" },
];

test("1. Unauthenticated API call returns honest auth/session error without fake data or crash", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // Intentional: do NOT intercept /api/lam/plugins/execute so real Next server returns HTTP 401/503 without DB session
  await setupScholarSession(page, { plan: "FREE", wireLivePluginExecute: false });

  await selectPluginViaAt(page, "Concept Explainer");
  await page.getByRole("textbox", { name: "Message LAM AI" }).fill("Explain inertia");
  await page.getByRole("button", { name: "Ask LAM" }).click();

  await expect(
    page.getByText(/Sign in required|AUTH_REQUIRED|Sign in to execute|Scholar could not verify your session|could not complete/i).first(),
  ).toBeVisible({ timeout: 20_000 });
  expect(page.url()).toContain("/lam-ai");
  await page.screenshot({ path: shotPath("guest-auth-honest-error.png"), fullPage: false });
});

test("2. Free user triggers Plus plugin inside chat -> sees Scholar Plus gate without redirect", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setupScholarSession(page, { plan: "FREE", wireLivePluginExecute: true });

  await selectPluginViaAt(page, "AISIG");
  await page.getByRole("textbox", { name: "Message LAM AI" }).fill("Draw a vector diagram");
  await page.getByRole("button", { name: "Ask LAM" }).click();

  await expect(page.getByRole("button", { name: /Upgrade to Scholar Plus/i })).toBeVisible({ timeout: 10_000 });
  expect(page.url()).toContain("/lam-ai");
  await page.screenshot({ path: shotPath("07-plus-paywall-gate.png"), fullPage: false });

  // Verify same Free Plus gate on mobile 390x844
  await page.setViewportSize({ width: 390, height: 844 });
  await checkNoHorizontalOverflow(page, "mobile-390-plus-gate");
  await expect(page.getByRole("button", { name: /Upgrade to Scholar Plus/i })).toBeVisible();
  await page.screenshot({ path: shotPath("16-mobile-plus-gate.png"), fullPage: false });
});

test("3. Desktop & Mobile full journeys, all 23 live plugins in-chat, reload persistence & viewports", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error" && !/status of (401|503)\b|\b(401|503)\b/.test(text)) {
      consoleErrors.push(text);
    }
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));

  await page.setViewportSize({ width: 1440, height: 900 });
  await setupScholarSession(page, { plan: "PLUS", wireLivePluginExecute: true });

  // Screenshot 01: Initial empty LAM AI chat (wait briefly for initial wordmark transition)
  await expect(page.getByRole("heading", { name: "Ready when you are." })).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(450);
  await page.screenshot({ path: shotPath("01-lam-ai-initial-chat.png"), fullPage: false });

  // Screenshot 02: @ Plugin picker open & searchable
  const input = page.getByRole("textbox", { name: "Message LAM AI" });
  await input.fill("@");
  const menu = page.getByRole("listbox", { name: "LAM plugins" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("button", { name: "All (23)" })).toBeVisible();
  await page.screenshot({ path: shotPath("02-at-plugin-picker.png"), fullPage: false });

  // Screenshot 03: Select Notes-to-Quiz chip
  await menu.getByRole("option", { name: /Notes-to-Quiz/i }).click();
  await expect(page.getByLabel("Selected plugin")).toBeVisible();
  await input.fill("Generate a 4-question MCQ quiz on Newton's Laws of Motion");
  await page.screenshot({ path: shotPath("03-selected-plugin-chip.png"), fullPage: false });

  // Screenshot 04: Live executing lifecycle card in-chat
  const sendBtn = page.getByRole("button", { name: "Ask LAM" });
  await sendBtn.click();
  await page.waitForTimeout(150);
  await page.screenshot({ path: shotPath("04-plugin-executing-in-chat.png"), fullPage: false });

  // Screenshot 05: Interactive Quiz result + click option -> check Explanation
  const quizOptionA = page.locator(".lt-bubble-widget").first().locator("button").filter({ hasText: /^A/ }).first();
  await expect(quizOptionA).toBeVisible({ timeout: 120_000 });
  await quizOptionA.click();
  await expect(page.getByText(/Explanation/i).first()).toBeVisible({ timeout: 5_000 });
  expect(page.url()).toContain("/lam-ai");
  await page.screenshot({ path: shotPath("05-quiz-plugin-result.png"), fullPage: false });
  await page.screenshot({ path: shotPath("plugin-notes-to-quiz-result.png"), fullPage: false });

  // Screenshot 08: Multi-turn follow-up refinement inside the same thread
  await page.waitForTimeout(1_500);
  await input.fill("Make it harder with numericals");
  await sendBtn.click();
  const secondWidget = page.locator(".lt-bubble-widget").nth(1);
  await expect(secondWidget.getByText(/Regenerate|Save Note/i).first()).toBeVisible({ timeout: 240_000 });
  await secondWidget.scrollIntoViewIfNeeded();
  expect(page.url()).toContain("/lam-ai");
  await page.screenshot({ path: shotPath("08-conversational-followup.png"), fullPage: false });

  // Homework Scanner (Image Analysis): waiting_input card -> real PNG upload -> OCR solution!
  await selectPluginViaAt(page, "Image Analysis");
  const hwWidgetIndex = await page.locator(".lt-bubble-widget").count();
  await sendBtn.click();
  const hwWidget = page.locator(".lt-bubble-widget").nth(hwWidgetIndex);
  await expect(hwWidget.getByRole("button", { name: /Upload Problem Photo/i })).toBeVisible({ timeout: 15_000 });
  await hwWidget.scrollIntoViewIfNeeded();
  await page.screenshot({ path: shotPath("plugin-homework-scanner-waiting-input.png"), fullPage: false });

  const samplePng = await createSampleProblemPng();
  await hwWidget.locator('input[type="file"][accept*=".png"]').setInputFiles(samplePng);
  await expect(hwWidget.getByText(/Extracted Problem/i)).toBeVisible({ timeout: 240_000 });
  await expect(hwWidget.getByRole("button", { name: /Reveal Full Step-by-Step Solution/i })).toBeVisible();
  await hwWidget.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.screenshot({ path: shotPath("plugin-homework-scanner-result.png"), fullPage: false });

  // Execute all remaining 21 available plugins inside real chat and screenshot EVERY SINGLE ONE
  for (const spec of PLUGIN_PROMPTS.filter((p) => p.id !== "notes-to-quiz")) {
    await page.waitForTimeout(1_200);
    await selectPluginViaAt(page, spec.name);
    await input.fill(spec.prompt);
    const widgetCountBefore = await page.locator(".lt-bubble-widget").count();
    await sendBtn.click();
    const newWidget = page.locator(".lt-bubble-widget").nth(widgetCountBefore);
    await expect(newWidget).toBeVisible({ timeout: 120_000 });
    await expect(newWidget.getByText(/Regenerate/i).first()).toBeVisible({ timeout: 240_000 });
    expect(page.url()).toContain("/lam-ai");
    await newWidget.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await page.screenshot({ path: shotPath(`plugin-${spec.id}-result.png`), fullPage: false });

    if (spec.id === "flashcard-maker") {
      await page.screenshot({ path: shotPath("06-pdf-or-flashcard-result.png"), fullPage: false });
    }
  }

  // Screenshot 09: Sessions & Artifacts Drawer -> Artifacts tab
  await page.getByRole("button", { name: "Sessions" }).click();
  const artifactsTab = page.getByRole("tab", { name: /Artifacts/i });
  await expect(artifactsTab).toBeVisible();
  await artifactsTab.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: shotPath("09-artifacts-and-history-panel.png"), fullPage: false });
  await page.getByRole("button", { name: "Close panel" }).click();

  // Screenshot 10: Full reload persistence check (including AISIG image hydrated from IndexedDB!)
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("Opening Scholar…").waitFor({ state: "detached", timeout: 12_000 }).catch(() => {});
  await expect(page.getByRole("region", { name: "LAM AI", exact: true })).toBeVisible({ timeout: 25_000 });
  await expect(page.locator(".lt-bubble-widget").first()).toBeVisible({ timeout: 15_000 });
  const reloadedImg = page.locator(".lt-bubble-widget img").first();
  await expect(reloadedImg).toBeVisible({ timeout: 15_000 });
  await expect(async () => {
    const w = await reloadedImg.evaluate((el: HTMLImageElement) => (el.complete ? el.naturalWidth : 0));
    expect(w).toBeGreaterThan(0);
  }).toPass({ timeout: 10_000 });
  await reloadedImg.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1_000);
  await page.screenshot({ path: shotPath("10-persisted-after-reload.png"), fullPage: false });

  // Additional Required Responsive Viewports (1280x800, 768x1024, 430x932)
  await page.setViewportSize({ width: 1280, height: 800 });
  await checkNoHorizontalOverflow(page, "desktop-1280");
  await page.screenshot({ path: shotPath("18-viewport-1280x800.png"), fullPage: false });

  await page.setViewportSize({ width: 768, height: 1024 });
  await checkNoHorizontalOverflow(page, "tablet-768");
  await page.screenshot({ path: shotPath("19-viewport-768x1024-tablet.png"), fullPage: false });

  await page.setViewportSize({ width: 430, height: 932 });
  await checkNoHorizontalOverflow(page, "mobile-430");
  await page.screenshot({ path: shotPath("20-viewport-430x932-mobile.png"), fullPage: false });

  // Mobile 390x844 full verification series (11..17) on clean session
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "New conversation" }).click();
  await expect(page.getByRole("heading", { name: "Ready when you are." })).toBeVisible();
  await checkNoHorizontalOverflow(page, "mobile-390-initial");
  await page.screenshot({ path: shotPath("11-mobile-lam-ai-chat.png"), fullPage: false });

  // 12: Mobile @ Picker
  await input.fill("@");
  await expect(page.getByRole("listbox", { name: "LAM plugins" })).toBeVisible();
  await checkNoHorizontalOverflow(page, "mobile-390-at-picker");
  await page.screenshot({ path: shotPath("12-mobile-at-picker.png"), fullPage: false });

  // 13: Mobile selected chip
  await page.getByRole("option", { name: /Notes-to-Quiz/i }).click();
  await input.fill("Quick 3-question quiz on Wave Motion");
  await checkNoHorizontalOverflow(page, "mobile-390-selected-chip");
  await page.screenshot({ path: shotPath("13-mobile-selected-chip-composer.png"), fullPage: false });

  // 17 & 14: Executing card -> Mobile Quiz result
  await sendBtn.click();
  await page.waitForTimeout(150);
  await page.screenshot({ path: shotPath("17-mobile-error-or-loading-state.png"), fullPage: false });
  const mobileWidget = page.locator(".lt-bubble-widget").first();
  await expect(mobileWidget.locator("button").filter({ hasText: /^A/ }).first()).toBeVisible({ timeout: 120_000 });
  await checkNoHorizontalOverflow(page, "mobile-390-quiz");
  await page.screenshot({ path: shotPath("14-mobile-quiz-result.png"), fullPage: false });

  // 15: Mobile PDF Studio result
  await selectPluginViaAt(page, "PDF Generator");
  await input.fill("Compact study pack on Sound Waves");
  await sendBtn.click();
  await expect(page.getByRole("button", { name: /Export PDF/i }).last()).toBeVisible({ timeout: 120_000 });
  await page.locator(".lt-bubble-widget").last().scrollIntoViewIfNeeded();
  await checkNoHorizontalOverflow(page, "mobile-390-pdf");
  await page.screenshot({ path: shotPath("15-mobile-flashcard-or-pdf-result.png"), fullPage: false });

  // 21: Extreme small screen 320x568 with @ menu & widget fit
  await page.setViewportSize({ width: 320, height: 568 });
  await input.fill("@");
  await expect(page.getByRole("listbox", { name: "LAM plugins" })).toBeVisible();
  await checkNoHorizontalOverflow(page, "mobile-320x568");
  await page.screenshot({ path: shotPath("21-viewport-320x568-small-mobile.png"), fullPage: false });

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
