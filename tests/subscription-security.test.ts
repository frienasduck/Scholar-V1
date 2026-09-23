import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("Scholar Plus security invariants", () => {
  test("subscriptions fail closed unless the global unlock is explicit", () => {
    const config = source("src/lib/subscriptions/config.ts");
    expect(config).toContain('return bool("SUBSCRIPTIONS_ENABLED", true)');
    expect(config).toContain("enabled: areSubscriptionsEnabled()");
    expect(config).toContain('["false", "0", "off", "no"]');
  });

  test("new accounts are explicitly free users in Class 11", () => {
    const register = source("src/app/api/auth/register/route.ts");
    expect(register).toContain("role: UserRole.USER");
    expect(register).toContain("coins: 0");
    expect(register).toContain("currentScholarClass: 11");
    expect(register).not.toContain("scholarSubscription.create");
  });

  test("one central resolver exposes fail-closed plans and limits", () => {
    const entitlements = source("src/lib/subscriptions/entitlements.ts");
    const session = source("src/app/api/auth/session/route.ts");
    expect(entitlements).toContain('type ScholarPlan = "FREE" | "PLUS" | "DEVELOPER" | "UNLOCKED"');
    expect(entitlements).toContain("export async function resolveScholarPlan");
    expect(entitlements).toContain("Promise.allSettled");
    expect(session).toContain("entitlementsLoaded: access.entitlementsLoaded");
    expect(session).toContain("dailyQuiz: access.dailyQuizLimit");
    expect(session).toContain("dailySlideshow: access.dailySlideshowLimit");
  });

  test("client access clears stale privileges during account changes", () => {
    const provider = source("src/components/subscriptions/subscription-provider.tsx");
    const store = source("src/lib/store.ts");
    expect(provider).toContain("refreshSequence");
    expect(provider).toContain('reason === "switch"');
    expect(provider).toContain("authenticated: false");
    expect(provider).toContain("user: undefined");
    expect(provider).toContain("access: undefined");
    expect(provider).toContain("state.entitlementsLoaded === true");
    expect(store).toContain("guestMode: false, devMode: false");
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
    const guard = source("src/lib/auth/admin.ts");
    expect(route).toContain("requireAdminUser");
    expect(guard).toContain("getSessionUser");
    expect(guard).toContain("UserRole.ADMIN");
  });

  test("registration and login cannot promote an email address", () => {
    const login = source("src/app/api/auth/login/route.ts");
    const register = source("src/app/api/auth/register/route.ts");
    expect(`${login}\n${register}`).not.toContain("isConfiguredAdminEmail");
    expect(`${login}\n${register}`).not.toMatch(/role:\s*["']admin["']/i);
  });

  test("the server session returns the database-backed role", () => {
    const session = source("src/lib/auth/session.ts");
    expect(session).toContain("role: true");
    expect(session).toContain("sessionVersion: true");
  });

  test("admin pages and APIs share the server-side role guard", () => {
    const page = source("src/app/admin/subscriptions/payment-requests/[id]/page.tsx");
    const route = source("src/app/api/admin/subscriptions/payment-requests/[id]/route.ts");
    expect(page).toContain("getAdminUser");
    expect(route).toContain("requireAdminUser");
    expect(`${page}\n${route}`).not.toContain("localStorage");
  });

  test("administrator assignment is an explicit one-time script", () => {
    const grant = source("scripts/grant-scholar-admin.ts");
    expect(grant).toContain("ishansalah123@gmail.com");
    expect(grant).toContain("UserRole.ADMIN");
    expect(source("package.json")).toContain('"admin:grant"');
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

  test("new Plus capabilities are enforced by their server routes", () => {
    expect(source("src/app/api/lam/chat/route.ts")).toContain('checkAssistantAccess("lam-chat")');
    expect(source("src/lib/ai/access.ts")).toContain('requireCapability("lam_ai")');
    expect(source("src/app/api/v2/intelligence/state/route.ts")).toContain('requireCapability("scholar_intelligence")');
    expect(source("src/app/api/group-study/rooms/route.ts")).toContain('hasEntitlement(access, "group_study_beta")');
    expect(source("src/app/api/ai/route.ts")).toContain('requireEntitlement("jee_focused_mode")');
  });

  test("custom E-Books are owner-scoped, PDF-only and quota-reserved server-side", () => {
    const collection = source("src/app/api/ebooks/route.ts");
    const item = source("src/app/api/ebooks/[ebookId]/route.ts");
    expect(collection).toContain('signature !== "%PDF-"');
    expect(collection).toContain('feature: "custom_ebook_upload"');
    expect(collection).toContain("commitMonthlyUsage");
    expect(collection).toContain("releaseMonthlyUsage");
    expect(item).toContain("userId: user.id");
  });

  test("Settings never treats its local developer toggle as authorization", () => {
    const settings = source("src/components/views/settings.tsx");
    expect(settings).toContain('access.developerMode === true && access.access?.source === "developer"');
    expect(settings).not.toContain("setDevMode(!devMode)");
  });

  test("the Plus coin bonus is protected by a unique ledger entry", () => {
    const schema = source("prisma/schema.prisma");
    const review = source("src/app/api/admin/subscriptions/payment-requests/[id]/route.ts");
    expect(schema).toContain("@@unique([userId, type])");
    expect(review).toContain('type: "scholar_plus_activation_bonus"');
    expect(review).toContain("plusBonusGrantedAt");
  });
});
