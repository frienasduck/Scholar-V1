import { expect, test, type Page } from "@playwright/test";

test.use({ baseURL: "http://127.0.0.1:3000", launchOptions: { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" }, viewport: { width: 390, height: 844 } });
test.setTimeout(120_000);

async function enterScholar(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Start Your Journey" }).click({ timeout: 90_000 });
  await page.getByRole("button", { name: /Class 11/ }).last().click();
  await page.getByPlaceholder("Ishan").fill("Ishan");
  await page.getByPlaceholder("you@scholar.app").fill(`voice-${Date.now()}@scholar.app`);
  await page.locator('input[type="password"]').fill("local-test");
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.getByRole("button", { name: "Skip intro" }).click();
  await page.getByRole("button", { name: "LAM", exact: true }).click();
  const lam = page.getByLabel("LAM personal assistant");
  if (await lam.getByRole("heading", { name: "Meet LAM" }).isVisible().catch(() => false)) {
    for (const label of ["Continue", "Continue", "Continue", "Start using LAM"]) await lam.getByRole("button", { name: label }).click();
  }
}

test("microphone tap requests a real stream, starts truthful listening, and cleans up", async ({ page }) => {
  await page.addInitScript(() => {
    const state = { requested: 0, stopped: 0, recognitionStarts: 0 };
    Object.assign(window, { __lamVoiceTest: state });
    const track = { stop: () => state.stopped++ };
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => { state.requested++; return { getTracks: () => [track] }; } } });
    Object.defineProperty(navigator, "permissions", { configurable: true, value: { query: async () => ({ state: "prompt", addEventListener() {}, removeEventListener() {} }) } });
    class Recognition {
      continuous = false; interimResults = false; lang = "";
      onstart: (() => void) | null = null; onend: (() => void) | null = null;
      start() { state.recognitionStarts++; queueMicrotask(() => this.onstart?.()); }
      stop() { queueMicrotask(() => this.onend?.()); }
      abort() { queueMicrotask(() => this.onend?.()); }
    }
    Object.assign(window, { SpeechRecognition: Recognition, webkitSpeechRecognition: Recognition });
  });
  await enterScholar(page);
  const lam = page.getByLabel("LAM personal assistant");
  await lam.getByRole("button", { name: "Talk to LAM" }).click();
  await expect(lam.getByText("Listening…", { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __lamVoiceTest: { requested: number } }).__lamVoiceTest.requested)).toBe(1);
  expect(await page.evaluate(() => (window as unknown as { __lamVoiceTest: { recognitionStarts: number } }).__lamVoiceTest.recognitionStarts)).toBe(1);
  expect(await page.evaluate(() => (window as unknown as { __lamVoiceTest: { stopped: number } }).__lamVoiceTest.stopped)).toBe(1);
  await lam.getByRole("button", { name: "Stop listening" }).first().click();
  await expect(lam.getByText("Listening…", { exact: true })).toHaveCount(0);
});

