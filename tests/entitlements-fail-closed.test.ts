import { beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

let userFailure = false;
let developerFailure = false;
let subscriptionFailure = false;
let developer = false;
let subscription: { id: string; status: string; endsAt: Date | null } | null = null;

mock.module("../src/lib/db", () => ({
  db: {
    user: {
      findUnique: async () => {
        if (userFailure) throw new Error("database unavailable");
        return { role: "USER" };
      },
    },
    scholarSubscription: {
      findFirst: async () => {
        if (subscriptionFailure) throw new Error("database unavailable");
        return subscription;
      },
    },
  },
}));

mock.module("../src/lib/auth/session", () => ({
  getSessionUser: async () => null,
  hasDeveloperSession: async () => {
    if (developerFailure) throw new Error("session lookup unavailable");
    return developer;
  },
}));

const { resolveUserEntitlements } = await import("../src/lib/subscriptions/entitlements");

beforeEach(() => {
  userFailure = developerFailure = subscriptionFailure = developer = false;
  subscription = null;
});

describe("entitlement resolution fails closed", () => {
  test.each([
    ["user lookup", () => { userFailure = true; }],
    ["developer-session lookup", () => { developerFailure = true; }],
    ["subscription lookup", () => { subscriptionFailure = true; }],
  ])("a failed %s cannot leave elevated entitlements populated", async (_label, arrange) => {
    developer = true;
    subscription = { id: "plus-1", status: "active", endsAt: null };
    arrange();

    const access = await resolveUserEntitlements("user-1");

    expect(access.entitlementsLoaded).toBe(false);
    expect(access.plan).toBe("FREE");
    expect(access.source).toBe("free");
    // LAM is a free capability; no paid entitlement survives a failed lookup.
    expect(access.entitlements).toEqual(["lam_ai"]);
    expect(access.subscriptionId).toBeNull();
  });

  test("fully verified plans retain their server-authoritative access", async () => {
    subscription = { id: "plus-1", status: "active", endsAt: null };
    const plus = await resolveUserEntitlements("user-1");
    expect(plus.entitlementsLoaded).toBe(true);
    expect(plus.plan).toBe("PLUS");
    expect(plus.entitlements.length).toBeGreaterThan(0);

    developer = true;
    const elevated = await resolveUserEntitlements("user-1");
    expect(elevated.plan).toBe("DEVELOPER");
  });
});
