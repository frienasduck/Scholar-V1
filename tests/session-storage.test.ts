import { beforeEach, expect, mock, test } from "bun:test";
mock.module("server-only", () => ({}));
let signedIn = true, failStorage = false;
const scopes: Record<string, unknown>[] = [];
const user = { id: "owner", email: "owner@example.test", name: "Owner", role: "USER", coins: 0, currentScholarClass: 11 };
const access = { plan: "FREE", entitlementsLoaded: true, entitlements: ["lam_ai"], storageLimitBytes: 100, dailyQuizLimit: 3, dailySlideshowLimit: 1 };
mock.module("../src/lib/auth/session", () => ({ getSessionUser: async () => signedIn ? user : null }));
mock.module("../src/lib/subscriptions/entitlements", () => ({ resolveUserEntitlements: async () => access }));
mock.module("../src/lib/subscriptions/usage", () => ({ getUsage: async () => ({}) }));
mock.module("../src/lib/subscriptions/monthly-usage", () => ({ getMonthlyUsage: async () => ({}) }));
mock.module("../src/lib/subscriptions/config", () => ({ publicSubscriptionConfig: () => ({}) }));
mock.module("../src/lib/auth/beta", () => ({ publicBetaConfig: () => ({}) }));
mock.module("../src/lib/db", () => ({ db: {
  storedFile: { aggregate: async ({ where }: { where: Record<string, unknown> }) => { scopes.push(where); if (failStorage) throw new Error("private database details"); return { _sum: { sizeBytes: 60 } }; } },
  customEbook: { aggregate: async ({ where }: { where: Record<string, unknown> }) => { scopes.push(where); return { _sum: { sizeBytes: 35 } }; } },
  scholarPaymentRequest: { findFirst: async () => null },
} }));
const { GET } = await import("../src/app/api/auth/session/route");
beforeEach(() => { signedIn = true; failStorage = false; scopes.length = 0; });
test("session storage agrees with upload enforcement, including standard E-Books", async () => {
  const response = await GET(); expect(response.status).toBe(200); expect((await response.json()).storage).toEqual({ usedBytes: 95, limitBytes: 100 });
  expect(scopes).toEqual([{ userId: "owner", deletedAt: null }, { userId: "owner", deletedAt: null, allocation: "standard" }]);
});
test("guest session never reads another user's storage", async () => {
  signedIn = false; const response = await GET(); expect(response.status).toBe(200); expect((await response.json()).authenticated).toBe(false); expect(scopes).toHaveLength(0);
});
test("storage failure becomes a safe session error, not a fabricated zero", async () => {
  failStorage = true; const response = await GET(); expect(response.status).toBe(503); const text = await response.text(); expect(text).not.toContain("private database details"); expect(text).not.toContain('"usedBytes":0');
});
