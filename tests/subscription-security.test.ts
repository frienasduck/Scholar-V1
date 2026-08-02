import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("Scholar Plus security invariants", () => {
  test("subscriptions fail open only through the explicit global switch", () => {
    const config = source("src/lib/subscriptions/config.ts");
    expect(config).toContain('enabled: bool("SUBSCRIPTIONS_ENABLED", false)');
    expect(config).not.toContain('enabled: bool("SUBSCRIPTIONS_ENABLED", true)');
  });

  test("email review links cannot approve subscriptions", () => {
    const email = source("src/lib/subscriptions/email.ts");
    const checkout = source("src/app/api/subscriptions/payment-requests/route.ts");
    expect(checkout).toContain("/admin/subscriptions/payment-requests/");
    expect(email).toContain("This link never approves a payment");
    expect(email).not.toMatch(/approve(Token|Secret)|action=approve/i);
  });

  test("admin mutations require an authenticated admin", () => {
    const route = source("src/app/api/admin/subscriptions/payment-requests/[id]/route.ts");
    expect(route).toContain("requireAdmin");
    expect(route).toContain("getSessionUser");
  });

  test("developer mode uses a server hash and signed HTTP-only cookie", () => {
    const route = source("src/app/api/developer/session/route.ts");
    const session = source("src/lib/auth/session.ts");
    expect(route).toContain("DEV_MODE_PASSWORD_HASH");
    expect(route).toContain("verifyPassword");
    expect(session).toContain("httpOnly: true");
    expect(`${route}\n${session}`).not.toContain("inmfs123");
  });

  test("Class 9 and premium Store items are checked server-side", () => {
    expect(source("src/app/api/academic-class/route.ts")).toContain('requireEntitlement("class_9_access")');
    expect(source("src/app/api/store/purchase/route.ts")).toContain('requireEntitlement("store_plus_items")');
  });

  test("the Plus coin bonus is protected by a unique ledger entry", () => {
    const schema = source("prisma/schema.prisma");
    const review = source("src/app/api/admin/subscriptions/payment-requests/[id]/route.ts");
    expect(schema).toContain("@@unique([userId, type])");
    expect(review).toContain('type: "scholar_plus_activation_bonus"');
    expect(review).toContain("plusBonusGrantedAt");
  });
});
