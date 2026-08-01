import { expect, test, type Page } from "@playwright/test";

test.use({
  baseURL: "http://127.0.0.1:3000",
  launchOptions: { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" },
  viewport: { width: 1440, height: 900 },
});
test.setTimeout(90_000);

async function enterClass11(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Start Your Journey" }).click();
  await page.getByRole("button", { name: /Class 11/ }).last().click();
  await page.getByPlaceholder("Ishan").fill("Ishan");
  await page.getByPlaceholder("you@scholar.app").fill(`notifications-${Date.now()}@scholar.app`);
  await page.locator('input[type="password"]').fill("local-visual-test");
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.getByRole("button", { name: "Skip intro" }).click();
  await expect(page.locator("#main-scroll")).toBeVisible({ timeout: 20_000 });
}

async function announce(page: Page, detail: Record<string, unknown>) {
  await page.evaluate((notification) => {
    window.dispatchEvent(new CustomEvent("scholar:notification", { detail: notification }));
  }, detail);
}

async function dismissAll(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll<HTMLButtonElement>('[aria-label="Dismiss notification"]').forEach((button) => button.click());
  });
  await page.waitForTimeout(350);
}

test("startup mode uses the shared success notification and can be closed", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await enterClass11(page);
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Appearance" }).click();

  for (const mode of ["Quick", "Short", "Long"]) {
    await page.getByRole("radio", { name: new RegExp(`^${mode}`) }).click();
    const modeNotification = page.getByTestId("scholar-notification").filter({ hasText: `${mode} startup selected` });
    await expect(modeNotification).toBeVisible();
    await expect(modeNotification.getByText("The change applies the next time Scholar opens.", { exact: true })).toBeVisible();
    await modeNotification.getByRole("button", { name: "Dismiss notification" }).click();
  }

  await page.getByRole("radio", { name: /Full Loading/ }).click();

  const notification = page.getByTestId("scholar-notification");
  await expect(notification).toBeVisible();
  await expect(notification).toHaveAttribute("data-notification-type", "success");
  await expect(notification.getByText("Full Loading startup selected", { exact: true })).toBeVisible();
  await expect(notification.getByText("The change applies the next time Scholar opens.", { exact: true })).toBeVisible();
  await expect(notification).toHaveAttribute("role", "status");

  await page.waitForTimeout(450);
  const surface = await notification.boundingBox();
  const close = notification.getByRole("button", { name: "Dismiss notification" });
  const closeBox = await close.boundingBox();
  expect(surface).not.toBeNull();
  expect(closeBox).not.toBeNull();
  expect(closeBox!.y).toBeLessThan(surface!.y + 2);
  await page.screenshot({ path: "artifacts/liquid-notification-startup-desktop.png" });
  await close.click();
  await expect(notification).toBeHidden();
  expect(pageErrors).toEqual([]);
});

test("variants, updates, progress, deduplication and pause behavior work", async ({ page }) => {
  await enterClass11(page);

  await announce(page, { id: "stateful", type: "loading", title: "Preparing revision pack", message: "Reading selected chapters." });
  let stateful = page.getByTestId("scholar-notification").filter({ hasText: "Preparing revision pack" });
  await expect(stateful).toHaveAttribute("data-notification-type", "loading");
  await announce(page, { id: "stateful", type: "success", title: "Revision pack ready", message: "12 questions are ready.", duration: 5000 });
  stateful = page.getByTestId("scholar-notification").filter({ hasText: "Revision pack ready" });
  await expect(stateful).toHaveAttribute("data-notification-type", "success");

  await announce(page, { id: "progress", type: "progress", title: "Uploading notes", message: "Keeping the original quality.", progress: 64 });
  await expect(page.getByLabel("64 percent complete")).toBeVisible();
  await announce(page, { id: "progress", type: "progress", title: "Uploading notes", message: "Keeping the original quality.", progress: 82 });
  await expect(page.getByLabel("82 percent complete")).toBeVisible();

  await announce(page, { type: "warning", title: "Storage almost full", message: "Remove an offline download to continue.", duration: 5000 });
  await expect(page.getByTestId("scholar-notification").filter({ hasText: "Storage almost full" })).toHaveAttribute("data-notification-type", "warning");
  await announce(page, { type: "error", title: "Upload failed", message: "The original file was not changed.", duration: 5000 });
  await expect(page.getByTestId("scholar-notification").filter({ hasText: "Upload failed" })).toHaveAttribute("role", "alert");

  await announce(page, { type: "info", title: "Duplicate check", message: "Only one should remain.", duration: 5000 });
  await announce(page, { type: "info", title: "Duplicate check", message: "Only one should remain.", duration: 5000 });
  await expect(page.getByTestId("scholar-notification").filter({ hasText: "Duplicate check" })).toHaveCount(1);

  await dismissAll(page);
  await announce(page, { id: "pause", type: "info", title: "Hover pause", duration: 900 });
  const hovered = page.getByTestId("scholar-notification").filter({ hasText: "Hover pause" });
  await hovered.dispatchEvent("mouseover");
  await page.waitForTimeout(1100);
  await expect(hovered).toBeVisible();
  await hovered.dispatchEvent("mouseout");
  await expect(hovered).toBeHidden({ timeout: 1800 });

  await announce(page, { id: "focus-pause", type: "info", title: "Keyboard pause", duration: 900 });
  const focused = page.getByTestId("scholar-notification").filter({ hasText: "Keyboard pause" });
  await focused.getByRole("button", { name: "Dismiss notification" }).evaluate((button) => (button as HTMLElement).focus());
  await page.waitForTimeout(1100);
  await expect(focused).toBeVisible();
  await page.evaluate(() => {
    document.body.tabIndex = -1;
    document.body.focus();
  });
  await expect(focused).toBeHidden({ timeout: 1800 });
});

test("background completion stacks safely and mobile placement clears top controls", async ({ page }) => {
  await enterClass11(page);
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("scholar:background-task:finished", {
      detail: {
        kind: "slideshow",
        title: "Generation ready",
        message: "16 source-grounded slides are ready to open.",
        viewId: "ai-tools",
      },
    }));
  });

  const notifications = page.getByTestId("scholar-notification");
  await expect(notifications.first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Open" }).first()).toBeVisible();
  await expect(page.getByLabel("Background task finished").first()).toBeVisible();
  await page.getByRole("button", { name: "Open" }).first().click();
  await expect(page).toHaveURL(/\/ai-tools$/);
  await expect(page.getByLabel("Background task finished")).toHaveCount(0);

  for (let index = 1; index <= 4; index += 1) {
    await announce(page, {
      id: `stack-${index}`,
      type: index === 2 ? "warning" : "info",
      title: `Queued notice ${index}`,
      message: "Notification stacking remains compact.",
      duration: 15_000,
    });
  }
  await expect(page.locator('[data-sonner-toast][data-visible="true"]')).toHaveCount(3);
  await expect(page.locator('[data-sonner-toast][data-visible="false"]')).toHaveCount(1);
  await expect(notifications.filter({ hasText: "Queued notice 4" })).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "artifacts/liquid-notification-stack-desktop.png" });

  await page.setViewportSize({ width: 390, height: 844 });
  await dismissAll(page);
  await announce(page, { type: "success", title: "Mobile notification", message: "Safe-area positioning verified.", duration: 15_000 });
  const mobile = page.getByTestId("scholar-notification").filter({ hasText: "Mobile notification" });
  await expect(mobile).toBeVisible();
  await page.waitForTimeout(500);
  const noticeBox = await mobile.boundingBox();
  const topbarBox = await page.locator(".scholar-mobile-topbar").boundingBox();
  expect(noticeBox).not.toBeNull();
  expect(topbarBox).not.toBeNull();
  expect(noticeBox!.x).toBeGreaterThanOrEqual(10);
  expect(noticeBox!.x + noticeBox!.width).toBeLessThanOrEqual(380);
  expect(noticeBox!.y).toBeGreaterThanOrEqual(topbarBox!.y + topbarBox!.height);
  await page.screenshot({ path: "artifacts/liquid-notification-mobile.png" });

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 768, height: 1024 },
    { width: 430, height: 932 },
    { width: 360, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(100);
    const box = await mobile.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  }
});

test("theme, transparency, contrast and reduced-motion preferences are respected", async ({ page }) => {
  await enterClass11(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => {
    const root = document.documentElement;
    root.dataset.appearanceTheme = "light";
    root.dataset.appearanceGlass = "off";
    root.dataset.highContrast = "true";
  });
  await announce(page, { type: "info", title: "Accessible appearance", message: "Preference-aware notification.", duration: 5000 });

  const notification = page.getByTestId("scholar-notification").filter({ hasText: "Accessible appearance" });
  await expect(notification).toBeVisible();
  const styles = await notification.evaluate((element) => {
    const glass = element.querySelector<HTMLElement>(".scholar-notification-glass")!;
    const title = element.querySelector<HTMLElement>("strong")!;
    return {
      animationDuration: getComputedStyle(element).animationDuration,
      backdropFilter: getComputedStyle(glass).backdropFilter,
      borderWidth: getComputedStyle(glass).borderTopWidth,
      titleColor: getComputedStyle(title).color,
    };
  });
  expect(Number.parseFloat(styles.animationDuration)).toBeLessThanOrEqual(0.12);
  expect(styles.backdropFilter).toBe("none");
  expect(styles.borderWidth).toBe("2px");
  expect(styles.titleColor).toBe("rgb(15, 23, 42)");

  await page.evaluate(() => {
    const root = document.documentElement;
    root.dataset.appearanceTheme = "dark";
    root.dataset.appearancePreset = "oled";
  });
  await expect(notification.locator("strong")).toHaveCSS("color", "rgb(248, 250, 252)");
});
