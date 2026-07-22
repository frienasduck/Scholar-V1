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

async function enterClass11(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Start Your Journey" }).click({ timeout: 90_000 });
  await page.getByRole("button", { name: /Class 11/ }).last().click();
  await page.getByPlaceholder("Ishan").fill("Ishan");
  await page.getByPlaceholder("you@scholar.app").fill("math-rendering@scholar.app");
  await page.locator('input[type="password"]').fill("local-test");
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.getByRole("button", { name: "Skip intro" }).click();
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
