import { expect, test } from "@playwright/test";
import { cleanSpeechText, containsWakePhrase, isSleepPhrase, normalizeWakePhrase } from "../src/lib/lam/speech";
import { lamActionSchema, parseLocalCommand } from "../src/lib/lam/commands";

const baseURL = "http://127.0.0.1:3000";
const executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
test.use({ baseURL, launchOptions: { executablePath }, viewport: { width: 1366, height: 768 } });
test.setTimeout(120_000);

async function enterProfile(page: import("@playwright/test").Page, scholarClass: 9 | 11) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Start Your Journey" }).click();
  await page.getByRole("button", { name: new RegExp(`Class ${scholarClass}`) }).last().click();
  await page.getByPlaceholder(scholarClass === 11 ? "Ishan" : "Neha Salah").fill(scholarClass === 11 ? "Ishan" : "Neha");
  await page.getByPlaceholder("you@scholar.app").fill(`lam${scholarClass}@scholar.app`);
  await page.locator('input[type="password"]').fill("local-lam-test");
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.getByRole("button", { name: "Skip intro" }).click();
}

async function openAndOnboardLam(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: /LAM/ }).last().click();
  if (await page.getByRole("heading", { name: "Meet LAM" }).isVisible().catch(() => false)) {
    const lam = page.getByLabel("LAM personal assistant");
    for (const label of ["Continue", "Continue", "Continue", "Start using LAM"]) await lam.getByRole("button", { name: label }).click();
  }
}

test("wake phrases, speech cleanup, and action validation", () => {
  expect(normalizeWakePhrase(" Hey, LAM!! ")).toBe("hey lam");
  expect(containsWakePhrase("Okay Lam, explain this")).toBeTruthy();
  expect(containsWakePhrase("the laminate is blue")).toBeFalsy();
  expect(isSleepPhrase("Thanks Lam, that's all")).toBeTruthy();
  expect(cleanSpeechText("**x^2** and $A \\cup B$")).toContain("x squared");
  expect(parseLocalCommand("Open my notes")).toEqual({ type: "navigate", view: "notes" });
  expect(lamActionSchema.safeParse({ type: "navigate", view: "secrets" }).success).toBeFalsy();
});

test("global LAM onboards, persists a chat, and executes safe local navigation", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await enterProfile(page, 11);
  await expect(page.getByRole("button", { name: /LAM/ }).last()).toBeVisible();
  await page.getByRole("button", { name: /LAM/ }).last().click();
  await expect(page.getByRole("heading", { name: "Meet LAM" })).toBeVisible();
  const lam = page.getByLabel("LAM personal assistant");
  for (const label of ["Continue", "Continue", "Continue", "Start using LAM"]) await lam.getByRole("button", { name: label }).click();
  const composer = page.getByRole("textbox", { name: "Message LAM" });
  await composer.fill("Open my notes");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page).toHaveURL(/\/notes$/);
  await expect(page.getByText("Opened notes.")).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /LAM/ }).last().click();
  await expect(page.getByText("Open my notes", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("LAM storage remains profile scoped", async ({ page }) => {
  await enterProfile(page, 9);
  await page.getByRole("button", { name: /LAM/ }).last().click();
  for (const label of ["Continue", "Continue", "Continue", "Start using LAM"]) await page.getByRole("button", { name: label }).click();
  await page.getByRole("textbox", { name: "Message LAM" }).fill("Open my notes");
  await page.getByRole("button", { name: "Send message" }).click();
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("scholar-lam-v1-")));
  expect(keys).toContain("scholar-lam-v1-class-9");
  expect(keys).not.toContain("scholar-lam-v1-class-11");
});

test("LAM panel fits mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterProfile(page, 11);
  await page.getByRole("button", { name: /LAM/ }).last().click();
  const panel = page.getByText("Meet LAM").locator("..").locator("..");
  const box = await panel.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.height).toBeLessThanOrEqual(844 * 0.64);
});

test("typed Tutor mode streams a real Groq response with Study context", async ({ page }) => {
  await enterProfile(page, 11);
  await page.goto("/study", { waitUntil: "domcontentloaded" });
  await openAndOnboardLam(page);
  await page.getByLabel("LAM mode").selectOption("tutor");
  await page.getByRole("textbox", { name: "Message LAM" }).fill("Explain the basic idea of this chapter in two short sentences.");
  const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/lam/chat") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Send message" }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  await expect(page.getByLabel("LAM personal assistant").getByRole("button", { name: "Still don’t understand?" })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByLabel("LAM personal assistant").getByText("Physics", { exact: true })).toBeVisible();
});

test("LAM preferences are exposed in Settings and persist", async ({ page }) => {
  await enterProfile(page, 11);
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "LAM" }).click();
  await expect(page.getByText("Voice activation", { exact: true })).toBeVisible();
  await page.getByRole("switch", { name: "Compact orb" }).click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "LAM" }).click();
  await expect(page.getByRole("switch", { name: "Compact orb" })).toBeChecked();
  await page.getByRole("switch", { name: "Enable LAM" }).click();
  await expect(page.getByRole("button", { name: "LAM", exact: true })).toHaveCount(0);
  await expect(page.getByRole("switch", { name: "Enable LAM" })).not.toBeChecked();
  await page.getByRole("switch", { name: "Enable LAM" }).click();
  await expect(page.getByRole("button", { name: "LAM", exact: true })).toBeVisible();
});

test("Privacy controls persist and remove personal page context from LAM requests", async ({ page }) => {
  await enterProfile(page, 11);
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Privacy" }).click();
  await expect(page.getByText("LAM & AI privacy", { exact: true })).toBeVisible();
  await page.getByRole("switch", { name: "Include profile name in AI" }).click();
  await page.getByRole("switch", { name: "Share current page with LAM" }).click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Privacy" }).click();
  await expect(page.getByRole("switch", { name: "Include profile name in AI" })).not.toBeChecked();
  await expect(page.getByRole("switch", { name: "Share current page with LAM" })).not.toBeChecked();

  await page.goto("/study", { waitUntil: "domcontentloaded" });
  await openAndOnboardLam(page);
  const captured: { body?: { pageContext?: { profileName?: string; subjectTitle?: string; chapterTitle?: string } } } = {};
  page.on("request", (request) => {
    if (request.url().endsWith("/api/lam/chat")) captured.body = request.postDataJSON();
  });
  await page.getByRole("textbox", { name: "Message LAM" }).fill("Say hello briefly.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByLabel("LAM personal assistant").getByRole("button", { name: "Still don’t understand?" })).toBeVisible({ timeout: 45_000 });
  expect(captured.body?.pageContext?.profileName).toBe("Class 11 student");
  expect(captured.body?.pageContext?.subjectTitle).toBeUndefined();
  expect(captured.body?.pageContext?.chapterTitle).toBeUndefined();
});
