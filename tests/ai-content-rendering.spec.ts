import { expect, test, type Page } from "@playwright/test";
import { hasIncompleteMath, prepareAIContentForRendering } from "../src/lib/ai/content";
import { renderAcademicTextToHtml } from "../src/lib/ai/export";
import { mdToHtml } from "../src/lib/pdf";

test.use({
  baseURL: "http://127.0.0.1:3000",
  launchOptions: { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" },
  viewport: { width: 390, height: 844 },
});
test.setTimeout(120_000);

test("legacy preparation protects code and detects incomplete streamed math", () => {
  const prepared = prepareAIContentForRendering("E_n = -2.18 × 10^(-18) / n^2 J\n\n```js\nconst value = 10 ** 2;\n```\n\nPrice: $25");
  expect(prepared).toContain("E_{n}");
  expect(prepared).toContain("10^{-18}");
  expect(prepared).toContain("const value = 10 ** 2;");
  expect(prepared).toContain("Price: $25");
  expect(hasIncompleteMath(String.raw`The result is \(x^2`)).toBeTruthy();
  expect(hasIncompleteMath(String.raw`The result is \(x^2\)`)).toBeFalsy();
  expect(renderAcademicTextToHtml(String.raw`\[E=mc^2\]`)).toContain("katex-display");
  expect(mdToHtml(String.raw`Result: \(E=mc^2\)`)).toContain("katex");
});

test("markdown export makes unsafe links inert", () => {
  const javascriptLink = mdToHtml("[open](javascript:alert(1))");
  const attributeBreakout = mdToHtml('[open](https://example.com/\" onclick=\"alert(1))');

  expect(javascriptLink).not.toContain("javascript:");
  expect(javascriptLink).not.toContain("href=");
  expect(attributeBreakout).not.toContain(' onclick="');
  expect(attributeBreakout).toContain("&quot;");
});

async function enterClass11(page: Page) {
  const email = "math-rendering@scholar.test";
  await page.route("**/api/auth/session", (route) => route.fulfill({
    json: {
      authenticated: true,
      developerMode: false,
      plan: "PLUS",
      entitlementsLoaded: true,
      user: { id: "math-rendering", email, name: "Alex", role: "USER", coins: 0, currentScholarClass: 11 },
      access: {
        plan: "PLUS", source: "plus", entitlementsLoaded: true, entitlements: ["lam_ai"],
        subscriptionId: "math-plus", subscriptionStatus: "ACTIVE", subscriptionEndsAt: null,
        storageLimitBytes: 100_000_000, dailyQuizLimit: 30, dailySlideshowLimit: 10,
        monthlyEbookUploadLimit: 20, monthlyMockExamLimit: 30,
      },
      usage: { day: "2026-09-27", quiz: { used: 0, limit: 30 }, slideshow: { used: 0, limit: 10 } },
      config: { subscriptionsEnabled: true, checkoutConfigured: false },
    },
  }));
  await page.route(/\.mp4(?:\?.*)?$/, (route) => route.abort());
  await page.addInitScript(({ email }) => {
    localStorage.setItem("scholar-workspace-owner-v1", email);
    localStorage.setItem("neha-scholar-v5", JSON.stringify({ schema: 7, state: {
      authed: true,
      guestMode: false,
      onboarded: true,
      user: { email, name: "Alex", username: "math-rendering", bio: "", school: "", class: "11 - CBSE", avatar: "A", scholarClass: 11, jeeMode: false },
      settings: { mobileLamMode: "full", elamEnabled: false },
    } }));
  }, { email });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".scholar-shell")).toBeVisible();
  const mobileMenu = page.getByRole("button", { name: "Open bottom menu" });
  if (await mobileMenu.isVisible().catch(() => false)) await mobileMenu.click();
  await page.getByRole("button", { name: "LAM", exact: true }).click();
  if (await page.getByRole("heading", { name: "Meet LAM" }).isVisible().catch(() => false)) {
    const lam = page.getByLabel("LAM personal assistant");
    for (const label of ["Continue", "Continue", "Continue", "Start using LAM"]) await lam.getByRole("button", { name: label }).click();
  }
}

test("universal AI renderer typesets academic content safely on mobile", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const answer = String.raw`## Scientific result

The energy is \(E_n=-\frac{2.18\times10^{-18}}{n^2}\,\mathrm{J}\).

\[
\begin{aligned}
E_5&=-\frac{2.18\times10^{-18}}{5^2}\\
&=-8.72\times10^{-20}\,\mathrm{J}
\end{aligned}
\]

Chemistry: \(\mathrm{Ca^{2+}}\), \(\mathrm{SO_4^{2-}}\), and \(2\mathrm{H_2}+\mathrm{O_2}\rightarrow2\mathrm{H_2O}\).

\[
A=\begin{bmatrix}1&2\\3&4\end{bmatrix}
\]

Price: $25

${"```"}js
const value = 10 ** 2;
${"```"}`;
  await page.route("**/api/lam/chat", async (route) => {
    const body = [
      `data: ${JSON.stringify({ type: "start" })}`,
      `data: ${JSON.stringify({ type: "text-delta", value: answer })}`,
      `data: ${JSON.stringify({ type: "finish" })}`,
      "",
    ].join("\n\n");
    await route.fulfill({ status: 200, contentType: "text/event-stream; charset=utf-8", body });
  });
  await enterClass11(page);
  const lam = page.getByLabel("LAM personal assistant");
  await lam.getByRole("textbox", { name: "Message LAM" }).fill("Show the equations");
  await lam.getByRole("button", { name: "Send message" }).click();
  await expect.poll(() => lam.locator(".katex").count()).toBeGreaterThanOrEqual(5);
  await expect(lam.getByText("Price: $25", { exact: true })).toBeVisible();
  await expect(lam.locator("code").filter({ hasText: "const value" })).toBeVisible();
  const overflow = await lam.locator(".scholar-ai-content").last().evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
  expect(overflow).toBeTruthy();
  await page.screenshot({ path: "test-results/universal-ai-math-mobile.png", fullPage: false });
  expect(errors).toEqual([]);
});
