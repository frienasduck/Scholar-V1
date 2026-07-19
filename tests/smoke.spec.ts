import { test, expect } from "@playwright/test";

const baseURL = "http://127.0.0.1:3000";
const executablePath =
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

test.use({
  baseURL,
  launchOptions: { executablePath },
  viewport: { width: 1440, height: 1000 },
});
test.setTimeout(90_000);

async function enterProfile(
  page: import("@playwright/test").Page,
  scholarClass: 9 | 11,
) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("button", { name: "Start Your Journey" }),
  ).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Start Your Journey" }).click();
  await page
    .getByRole("button", { name: new RegExp(`Class ${scholarClass}`) })
    .last()
    .click();
  await page
    .getByPlaceholder(scholarClass === 11 ? "Ishan" : "Neha Salah")
    .fill(scholarClass === 11 ? "Ishan" : "Neha");
  await page
    .getByPlaceholder("you@scholar.app")
    .fill(`smoke${scholarClass}@scholar.app`);
  await page.locator('input[type="password"]').fill("local-smoke-test");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.getByRole("button", { name: "Skip intro" })).toBeVisible();
  await page.getByRole("button", { name: "Skip intro" }).click();
  await expect(
    page
      .getByText(scholarClass === 11 ? "Ishan's Scholar" : "Neha's Scholar", {
        exact: true,
      })
      .first(),
  ).toBeVisible();
}

test("Class 9 app shell, Study/LAM, Levels, Store, Canvas, and deep links load", async ({
  page,
}) => {
  const fatal: string[] = [];
  page.on("pageerror", (error) => fatal.push(error.message));
  await enterProfile(page, 9);

  await page.goto("/study", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /LAM/ })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Science/ }).first(),
  ).toBeVisible();

  await page.goto("/levels", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByText("Your Learning Journey", { exact: false }),
  ).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /Continue/ }).click();
  const start = page.getByRole("button", { name: /^Start / });
  await expect(start).toBeVisible();
  await start.click();
  await expect(
    page.getByText(
      /Preparing your lesson|AI lesson generation is unavailable|Local fallback lesson/,
    ),
  ).toBeVisible({ timeout: 20_000 });

  await page.goto("/store", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: /Useful upgrades/ }),
  ).toBeVisible();
  await expect(page.getByText("Aurora", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Preview" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.goto("/canvas", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("img", { name: /editable study canvas/ }),
  ).toBeVisible();
  expect(fatal).toEqual([]);
});

test("Class 11 stays on the Class 11 curriculum", async ({ page }) => {
  await enterProfile(page, 11);
  await page.goto("/study", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("button", { name: /Physics/ }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Chemistry/ }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Computer Science/ }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Matter in Our Surroundings", { exact: true }),
  ).toHaveCount(0);

  const lamToggle = page.getByRole("button", { name: "LAM", exact: true });
  await lamToggle.click();
  if (
    await page
      .getByRole("heading", { name: "Meet LAM" })
      .isVisible()
      .catch(() => false)
  ) {
    const lam = page.getByLabel("LAM personal assistant");
    for (const label of ["Continue", "Continue", "Continue", "Start using LAM"])
      await lam.getByRole("button", { name: label }).click();
  }
  const lamInput = page.getByRole("textbox", { name: "Message LAM" });
  await lamInput.fill("temporary chapter question");
  await page.getByRole("button", { name: "New LAM chat" }).click();
  await expect(lamInput).toHaveValue("");
  await lamInput.fill("conversation follows me into Chemistry");
  await page
    .getByRole("button", { name: /Chemistry/ })
    .first()
    .click();
  await expect(page.getByRole("textbox", { name: "Message LAM" })).toHaveValue(
    "conversation follows me into Chemistry",
  );
  await expect(
    page.getByText("Chemistry", { exact: true }).last(),
  ).toBeVisible();
});

test("Chemistry reader, inline AI answers, Book Mode, and responsive layout work", async ({
  page,
}) => {
  const fatal: string[] = [];
  page.on("pageerror", (error) => fatal.push(error.message));
  await page.route("**/api/ai", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        text: "Mock inline explanation with a clear final answer.",
      }),
    });
  });
  await enterProfile(page, 11);
  await page.goto("/ebook", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Chemistry Part 1/ }).click();
  await page
    .getByText("Some Basic Concepts of Chemistry", { exact: true })
    .last()
    .click();

  await expect(
    page.getByText("Chemistry Part 1", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Clean Text" })).toHaveClass(
    /bg-indigo-500/,
  );
  await expect(
    page.locator('img[src="/ebook-pages-chemistry-clean/page-001.png"]'),
  ).toBeVisible();
  await expect(
    page.locator('a[download][href$="clean-text.pdf"]'),
  ).toBeVisible();

  await page.getByRole("button", { name: "Original Scan" }).click();
  await expect(
    page.locator('img[src="/ebook-pages-chemistry/page-001.png"]'),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clean Text" }).click();

  await page.getByRole("button", { name: "Enter Book Mode" }).click();
  const immersive = page.getByLabel("Chemistry Part 1 immersive book reader");
  await expect(immersive).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(
    immersive.getByRole("img", { name: "Chemistry Part 1 page 2" }),
  ).toBeVisible({ timeout: 3_000 });
  await page.mouse.move(20, 20);
  await immersive
    .getByRole("button", { name: "Open table of contents" })
    .click();
  await expect(
    immersive.getByRole("heading", { name: "Table of contents" }),
  ).toBeVisible();
  await immersive.getByRole("button", { name: "Close panel" }).click();
  await immersive.getByRole("button", { name: "Search inside book" }).click();
  await immersive.getByPlaceholder("Find words or phrases…").fill("matter");
  await expect(immersive.getByText(/matching pages/)).toBeVisible();
  await immersive.getByRole("button", { name: "Close panel" }).click();
  await page.keyboard.press("b");
  await immersive.getByRole("button", { name: "View page bookmarks" }).click();
  await expect(immersive.getByRole("button", { name: "Page 2" })).toBeVisible();
  await immersive.getByRole("button", { name: "Close panel" }).click();
  await immersive.getByRole("button", { name: "Exit Book Mode" }).click();
  await expect(immersive).toBeHidden();

  await page.getByRole("button", { name: "Questions" }).click();
  const firstQuestion = page.locator("article").first();
  await firstQuestion
    .getByRole("button", { name: "Generate AI Answer" })
    .click();
  await expect(
    firstQuestion.getByText(
      "Mock inline explanation with a clear final answer.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("dialog", { name: /AI Answer/ })).toHaveCount(0);
  await firstQuestion.getByRole("button", { name: "Save Answer" }).click();
  await expect(
    firstQuestion.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
  await firstQuestion.getByRole("button", { name: "Hide" }).click();
  await expect(
    firstQuestion.getByRole("button", { name: "Show AI Answer" }),
  ).toBeVisible();
  await firstQuestion.getByRole("button", { name: "Show AI Answer" }).click();
  await page.getByRole("button", { name: "Reader", exact: true }).click();

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(
      page.getByRole("button", { name: "Clean Text" }),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);
  }
  await page.goto("/ebook", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Select Book", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Chemistry E-Book" }),
  ).toBeVisible();
  await page
    .getByText("Some Basic Concepts of Chemistry", { exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Questions" }).click();
  await expect(
    page
      .locator("article")
      .first()
      .getByText("Saved AI Answer", { exact: true }),
  ).toBeVisible();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Back to E-Book library" }).click();
  await page.getByRole("button", { name: /Mathematics Part 1/ }).click();
  await page.getByText("Sets", { exact: true }).last().click();
  await page.getByRole("button", { name: "Enter Book Mode" }).click();
  await expect(page.getByLabel("Mathematics Part 1 immersive book reader")).toBeVisible();
  await page.getByRole("button", { name: "Exit Book Mode" }).click();
  await page.getByRole("button", { name: "Back to E-Book library" }).click();
  await page.getByRole("button", { name: /Physics Part 1/ }).click();
  await page.getByText("Units and Measurement", { exact: true }).last().click();
  await page.getByRole("button", { name: "Enter Book Mode" }).click();
  await expect(page.getByLabel("Physics Part 1 immersive book reader")).toBeVisible();
  await page.getByRole("button", { name: "Exit Book Mode" }).click();
  expect(fatal).toEqual([]);
});

test("mobile menu closes and restores focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterProfile(page, 9);
  const menu = page.getByRole("button", { name: "Open navigation menu" });
  await menu.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
});
