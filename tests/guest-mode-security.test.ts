import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("temporary Guest Mode security", () => {
  test("guest state uses separate, preference-only browser persistence", () => {
    const store = source("src/lib/store.ts");
    expect(store).toContain('GUEST_STORAGE_KEY = "scholar-guest-session-v1"');
    expect(store).toContain("settings: state.settings");
    expect(store).toContain("devMode: false");
    expect(store).toContain('name: "Guest"');
    expect(store).not.toMatch(/GUEST_STORAGE_KEY[\s\S]{0,900}(notes|files|chatThreads|coins): state\./);
  });

  test("guest sessions cannot satisfy server entitlements", () => {
    const entitlements = source("src/lib/subscriptions/entitlements.ts");
    expect(entitlements).toContain('if (!user) {');
    expect(entitlements).toContain('error: "AUTH_REQUIRED"');
  });

  test("admin, payments, developer mode and purchases still require a server session", () => {
    const protectedRoutes = [
      "src/app/api/admin/subscriptions/payment-requests/[id]/route.ts",
      "src/app/api/subscriptions/payment-requests/route.ts",
      "src/app/api/developer/session/route.ts",
      "src/app/api/store/purchase/route.ts",
    ].map(source).join("\n");
    expect(protectedRoutes).toContain("requireAdminUser");
    expect(protectedRoutes.match(/getSessionUser/g)?.length).toBeGreaterThanOrEqual(3);
    expect(protectedRoutes).not.toContain("guestMode");
  });
});
