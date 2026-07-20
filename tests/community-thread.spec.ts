import { expect, test, type Page } from "@playwright/test";

test.use({
  baseURL: "http://127.0.0.1:3000",
  launchOptions: { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" },
  viewport: { width: 1100, height: 820 },
});
test.setTimeout(60_000);

async function enterClass11(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Start Your Journey" }).click();
  await page.getByRole("button", { name: /Class 11/ }).last().click();
  await page.getByPlaceholder("Ishan").fill("Ishan");
  await page.getByPlaceholder("you@scholar.app").fill("community@scholar.app");
  await page.locator('input[type="password"]').fill("local-test");
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.getByRole("button", { name: "Skip intro" }).click();
}

test("forum AI receives the live thread and responds to the latest student message", async ({ page }) => {
  const requests: Array<Record<string, any>> = [];
  await page.route("**/api/ai", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, text: "wait what happened? maybe put it in a general thread 😭" }),
    });
  });
  await enterClass11(page);
  await page.goto("/community", { waitUntil: "domcontentloaded" });

  await page.getByRole("heading", { name: "How do you choose the correct equation of motion?" }).click();
  const reply = page.getByPlaceholder("Write a reply…");
  await reply.fill("yo something crazy happened tonight");
  await reply.press("Enter");

  await expect(page.getByText("wait what happened? maybe put it in a general thread 😭")).toBeVisible({ timeout: 15_000 });
  expect(requests).toHaveLength(1);
  const prompt = requests[0].messages.at(-1).content as string;
  expect(prompt).toContain("RECENT THREAD:");
  expect(prompt).toContain("LATEST STUDENT MESSAGE:");
  expect(prompt).toContain("yo something crazy happened tonight");
  expect(prompt).toContain("How do you choose the correct equation of motion?");
});

test("a new Class 11 Q&A question remains visible in the Class 11 profile", async ({ page }) => {
  await page.route("**/api/ai", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, text: "classmate answer" }) });
  });
  await enterClass11(page);
  await page.goto("/community", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Q&A" }).click();
  await page.getByRole("button", { name: "Ask question" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Ask a question" });
  await expect(dialog.getByRole("combobox")).toHaveText("Physics");
  await dialog.getByPlaceholder("What's on your mind?").fill("Why is momentum conserved in a collision?");
  await dialog.getByRole("button", { name: "Ask", exact: true }).click();

  await expect(page.getByText("Why is momentum conserved in a collision?", { exact: true })).toBeVisible();
  await expect(page.getByText("No questions yet")).toHaveCount(0);
});
