import { test, expect } from "@playwright/test";
import { PrismaClient, UserRole } from "@prisma/client";
import { join } from "node:path";

const executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

test.use({
  baseURL: "http://127.0.0.1:3100",
  launchOptions: { executablePath },
});
test.setTimeout(120_000);

test("admin payment review is enforced by the database-backed server role", async ({ page, context }) => {
  const email = `admin-role-${Date.now()}@scholar.test`;
  const password = "admin-role-runtime-password";
  const prisma = new PrismaClient({
    datasources: {
      db: { url: `file:${join(process.cwd(), "prisma", "dev.db").replaceAll("\\", "/")}` },
    },
  });

  try {
    const registration = await context.request.post("/api/auth/register", {
      data: { email, password, name: "Role Test User" },
    });
    expect(registration.status()).toBe(200);

    await page.goto("/admin/subscriptions/payment-requests/nonexistent", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Administrator sign-in required" })).toBeVisible();

    await page.evaluate(() => localStorage.setItem("scholar-role", "ADMIN"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Administrator sign-in required" })).toBeVisible();

    const denied = await context.request.get("/api/admin/subscriptions/payment-requests/nonexistent");
    expect(denied.status()).toBe(403);

    await prisma.user.update({ where: { email }, data: { role: UserRole.ADMIN } });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Administrator sign-in required" })).toHaveCount(0);
    const allowed = await context.request.get("/api/admin/subscriptions/payment-requests/nonexistent");
    expect(allowed.status()).toBe(404);
  } finally {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  }
});
