import { expect, test, type Page } from "@playwright/test";

const executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

test.use({
  baseURL: "http://127.0.0.1:3000",
  launchOptions: { executablePath },
});
test.setTimeout(45_000);

async function installYouTubeMock(page: Page) {
  await page.addInitScript(() => {
    const calls: Array<Record<string, unknown>> = [];
    Object.defineProperty(window, "__transitionAudioCalls", { value: calls, writable: false });
    class MockPlayer {
      private current = 25;
      private timer: number | null = null;
      private options: Record<string, any>;

      constructor(_host: HTMLElement, options: Record<string, any>) {
        this.options = options;
        calls.push({ type: "create", videoId: options.videoId });
        setTimeout(() => options.events?.onReady?.({ target: this }), 0);
      }

      loadVideoById(options: Record<string, unknown>) {
        calls.push({ type: "load", ...options });
        this.current = Number(options.startSeconds ?? 25);
      }

      playVideo() {
        calls.push({ type: "play" });
        this.options.events?.onStateChange?.({ data: 1 });
        if (this.timer === null) this.timer = window.setInterval(() => { this.current += 0.1; }, 100);
      }

      stopVideo() { calls.push({ type: "stop", at: this.current }); }
      destroy() {
        calls.push({ type: "destroy" });
        if (this.timer !== null) window.clearInterval(this.timer);
        this.timer = null;
      }
      getCurrentTime() { return this.current; }
      setVolume(volume: number) { calls.push({ type: "volume", volume }); }
    }
    Object.defineProperty(window, "YT", {
      configurable: true,
      value: { Player: MockPlayer, PlayerState: { PLAYING: 1 } },
    });
  });
}

async function openSignup(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Start Your Journey" }).click();
}

async function createClass9Profile(page: Page) {
  await openSignup(page);
  await page.getByPlaceholder("Neha Salah").fill("Neha");
  await page.getByPlaceholder("you@scholar.app").fill("transition@scholar.app");
  await page.locator('input[type="password"]').fill("local-test");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.getByRole("button", { name: "Skip intro" })).toBeVisible();
}

test("successful login uses only 25–41 and leaving the intro destroys the player", async ({ page }) => {
  await installYouTubeMock(page);
  await createClass9Profile(page);

  await expect.poll(() => page.evaluate(() => (window as any).__transitionAudioCalls.filter((call: any) => call.type === "load").length)).toBe(1);
  const load = await page.evaluate(() => (window as any).__transitionAudioCalls.find((call: any) => call.type === "load"));
  expect(load).toMatchObject({ videoId: "WJ2d0SzOMXc", startSeconds: 25, endSeconds: 41 });

  await page.getByRole("button", { name: "Skip intro" }).click();
  await expect(page.getByText("Neha's Scholar", { exact: true }).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__transitionAudioCalls.some((call: any) => call.type === "destroy"))).toBe(true);
});

test("invalid login stays silent", async ({ page }) => {
  await installYouTubeMock(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Start Your Journey" }).click();
  await page.getByRole("button", { name: "Already have an account? Sign in" }).click();
  await page.getByPlaceholder("you@scholar.app").fill("invalid@scholar.app");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__transitionAudioCalls.length)).toBe(0);
});

test("academic switch is deduplicated, skippable, responsive, and respects saved sound settings", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installYouTubeMock(page);
  await createClass9Profile(page);
  await page.getByRole("button", { name: "Skip intro" }).click();

  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Academic" }).click();
  await page.getByRole("button", { name: /Class 11/ }).click();
  const overlay = page.getByTestId("academic-transition");
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveAttribute("aria-label", "Switching to Class 11");
  const box = await overlay.boundingBox();
  expect(box?.width).toBe(390);
  expect(box?.height).toBe(844);

  await page.evaluate(() => window.dispatchEvent(new CustomEvent("scholar:class-switch", { detail: { newClass: 11 } })));
  await expect.poll(() => page.evaluate(() => (window as any).__transitionAudioCalls.filter((call: any) => call.type === "create").length)).toBe(1);
  await overlay.getByRole("button", { name: "Skip transition" }).click();
  await expect(overlay).toBeHidden();
  await expect(page.getByText("Class 11 CBSE", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Appearance" }).click();
  const volume = page.getByRole("slider", { name: "Transition volume" });
  await expect(volume).toHaveAttribute("aria-valuenow", "65");
  await page.getByRole("switch", { name: "Transition music" }).click();
  await page.getByRole("tab", { name: "Academic" }).click();
  await page.getByRole("button", { name: /Class 9/ }).click();
  await expect(overlay).toBeVisible();
  await overlay.getByRole("button", { name: "Skip transition" }).click();
  await expect(overlay).toBeHidden();
  expect(await page.evaluate(() => (window as any).__transitionAudioCalls.filter((call: any) => call.type === "create").length)).toBe(1);
});

test("unskipped academic transition keeps two silent reveal seconds after the music", async ({ page }) => {
  await installYouTubeMock(page);
  await createClass9Profile(page);
  await page.getByRole("button", { name: "Skip intro" }).click();
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Academic" }).click();

  const startedAt = Date.now();
  await page.getByRole("button", { name: /Class 11/ }).click();
  const overlay = page.getByTestId("academic-transition");
  await expect(overlay).toBeVisible();
  await expect(overlay).toBeHidden({ timeout: 20_000 });
  const elapsed = Date.now() - startedAt;
  expect(elapsed).toBeGreaterThanOrEqual(17_500);
  expect(elapsed).toBeLessThan(20_000);
  await expect(page.getByText("Class 11 CBSE", { exact: true })).toBeVisible();

  const stoppedAt = await page.evaluate(() => {
    const stops = (window as any).__transitionAudioCalls.filter((call: any) => call.type === "stop");
    return stops.at(-1)?.at as number;
  });
  expect(stoppedAt).toBeGreaterThanOrEqual(40.4);
  expect(stoppedAt).toBeLessThanOrEqual(41.1);
});
