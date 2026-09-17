import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";

mock.module("server-only", () => ({}));

const configKeys = ["SCHOLAR_PRIVATE_BETA", "SCHOLAR_BETA_ALLOWED_EMAILS", "SCHOLAR_BETA_ALLOWED_USER_IDS", "DEV_MODE_ENABLED"] as const;
const originalConfig = Object.fromEntries(configKeys.map((key) => [key, process.env[key]]));
const now = new Date();
const betaUser = { id: "beta-owner", email: "scholarofficialacc123@gmail.com", name: "Beta owner", role: "USER", sessionVersion: 1, timezone: "UTC", coins: 0, plusBonusGrantedAt: null, currentScholarClass: 11, createdAt: now, updatedAt: now, passwordHash: "" };
type FixtureUser = typeof betaUser;
let users: FixtureUser[] = [];
let restoredUser: FixtureUser | null = null;
let sessionExpired = false;
let userCreates = 0;
let sessionCreates = 0;
let sessionDeletes = 0;
const cookieValues = new Map<string, string>();
const cookieStore = {
  get: (name: string) => cookieValues.has(name) ? { value: cookieValues.get(name)! } : undefined,
  set: (name: string, value: string) => { cookieValues.set(name, value); },
};

mock.module("next/headers", () => ({ cookies: async () => cookieStore, headers: async () => new Headers() }));

const userDb = {
  findUnique: async (args: { where: { email?: string; id?: string } }) => users.find((user) => args.where.email ? user.email === args.where.email : user.id === args.where.id) ?? null,
  create: async (args: { data: Partial<FixtureUser> }) => {
    userCreates += 1;
    const created = { ...betaUser, ...args.data, id: "new-test-account" };
    users.push(created);
    return created;
  },
};
const dbMock = {
  user: userDb,
  session: {
    findUnique: async () => restoredUser ? { id: "restored-session", expiresAt: new Date(Date.now() + (sessionExpired ? -1000 : 60_000)), user: restoredUser } : null,
    create: async () => { sessionCreates += 1; return { id: "new-test-session" }; },
    deleteMany: async () => { sessionDeletes += 1; return { count: 0 }; },
    delete: async () => { sessionDeletes += 1; return { id: "restored-session" }; },
  },
  $transaction: async <T>(callback: (tx: { user: typeof userDb }) => Promise<T>) => callback({ user: userDb }),
};
mock.module("../src/lib/db", () => ({ db: dbMock }));
class TestRateLimitError extends Error { retryAfterSeconds = 60; }
mock.module("../src/lib/security/rate-limit", () => ({ enforceRateLimit: async () => undefined, RateLimitError: TestRateLimitError }));

const { privateBetaEnabled, isBetaAllowed, publicBetaConfig } = await import("../src/lib/auth/beta");
const { hashPassword } = await import("../src/lib/auth/password");
const { getSessionUser, createDeveloperSession, hasDeveloperSession } = await import("../src/lib/auth/session");
const { POST: login } = await import("../src/app/api/auth/login/route");
const { POST: register } = await import("../src/app/api/auth/register/route");
const { GET: sessionStatus } = await import("../src/app/api/auth/session/route");
// Fixture credential belongs only to in-memory test records. No real DB access.
const testPassword = "test-only-beta-password";
const testHash = await hashPassword(testPassword);

beforeEach(() => {
  for (const key of configKeys) delete process.env[key];
  users = [{ ...betaUser, passwordHash: testHash }];
  restoredUser = null;
  sessionExpired = false;
  userCreates = 0;
  sessionCreates = 0;
  sessionDeletes = 0;
  cookieValues.clear();
});
afterAll(() => {
  for (const key of configKeys) {
    if (originalConfig[key] === undefined) delete process.env[key];
    else process.env[key] = originalConfig[key];
  }
});

const request = (path: string, data: unknown) => new NextRequest(`https://scholar.example${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

describe("server-only private beta policy", () => {
  test("defaults on and normalizes only email identity", async () => {
    expect(privateBetaEnabled()).toBe(true);
    expect(await isBetaAllowed({ id: "owner", email: " ScholarOfficialAcc123@GMAIL.com " })).toBe(true);
    expect(await isBetaAllowed({ id: "other", email: "other@example.test" })).toBe(false);
    expect(await isBetaAllowed(null)).toBe(false);
  });

  test("configured emails replace the default and empty configuration fails closed", async () => {
    process.env.SCHOLAR_BETA_ALLOWED_EMAILS = " first@example.test, SECOND@example.test ";
    expect(await isBetaAllowed(betaUser)).toBe(false);
    expect(await isBetaAllowed({ id: "second", email: "second@example.test" })).toBe(true);
    process.env.SCHOLAR_BETA_ALLOWED_EMAILS = "  ";
    expect(await isBetaAllowed(betaUser)).toBe(false);
  });

  test("account ID configuration takes precedence over email and is exact", async () => {
    process.env.SCHOLAR_BETA_ALLOWED_EMAILS = betaUser.email;
    process.env.SCHOLAR_BETA_ALLOWED_USER_IDS = " permitted-id ";
    expect(await isBetaAllowed(betaUser)).toBe(false);
    expect(await isBetaAllowed({ id: "permitted-id", email: "changed@example.test" })).toBe(true);
    expect(await isBetaAllowed({ id: "PERMITTED-ID", email: betaUser.email })).toBe(false);
    process.env.SCHOLAR_BETA_ALLOWED_USER_IDS = "";
    expect(await isBetaAllowed(betaUser)).toBe(false);
  });

  test("explicitly disabling beta restores normal policy; invalid values stay closed", async () => {
    for (const value of ["false", "0", "OFF", " no "]) {
      process.env.SCHOLAR_PRIVATE_BETA = value;
      expect(privateBetaEnabled()).toBe(false);
      expect(await isBetaAllowed({ id: "ordinary", email: "ordinary@example.test" })).toBe(true);
      expect(publicBetaConfig().registrationEnabled).toBe(true);
    }
    process.env.SCHOLAR_PRIVATE_BETA = "typo";
    expect(privateBetaEnabled()).toBe(true);
  });

  test("public config contains no configured allowlist or account identifiers", async () => {
    process.env.SCHOLAR_BETA_ALLOWED_EMAILS = "hidden@example.test";
    process.env.SCHOLAR_BETA_ALLOWED_USER_IDS = "internal-id";
    expect(publicBetaConfig()).toEqual({ privateBeta: true, registrationEnabled: false, contactEmail: "scholarofficialacc123@gmail.com" });
  });
});

describe("private beta account API behavior", () => {
  test("blocks all anonymous registrations without looking up or creating an account", async () => {
    for (const email of [betaUser.email, "other@example.test"]) {
      const response = await register(request("/api/auth/register", { email, password: testPassword, name: "Test" }));
      expect(response.status).toBe(403);
      expect((await response.json()).error).toBe("PRIVATE_BETA_REGISTRATION_CLOSED");
    }
    expect(userCreates).toBe(0);
    expect(sessionCreates).toBe(0);
  });

  test("an allowed account still needs its correct existing password", async () => {
    const denied = await login(request("/api/auth/login", { email: betaUser.email, password: "incorrect" }));
    expect(denied.status).toBe(401);
    expect(sessionCreates).toBe(0);
    const accepted = await login(request("/api/auth/login", { email: betaUser.email.toUpperCase(), password: testPassword }));
    expect(accepted.status).toBe(200);
    const result = await accepted.json();
    expect(result.user.id).toBe(betaUser.id);
    expect(result.user.passwordHash).toBeUndefined();
    expect(sessionCreates).toBe(1);
    expect(cookieValues.has("scholar_session")).toBe(true);
  });

  test("unknown, incorrect, and blocked valid credentials share one negative response", async () => {
    users.push({ ...betaUser, id: "ordinary-account", email: "ordinary@example.test", passwordHash: testHash });
    const responses: ReturnType<typeof Object>[] = [];
    for (const [email, password] of [["missing@example.test", testPassword], [betaUser.email, "wrong"], ["ordinary@example.test", testPassword]]) {
      const response = await login(request("/api/auth/login", { email, password }));
      expect(response.status).toBe(401);
      responses.push(await response.json());
    }
    expect(responses[0]).toEqual(responses[1]);
    expect(responses[1]).toEqual(responses[2]);
    expect(sessionCreates).toBe(0);
  });

  test("normal registration and login remain available when beta is explicitly disabled", async () => {
    process.env.SCHOLAR_PRIVATE_BETA = "false";
    const created = await register(request("/api/auth/register", { email: "ordinary@example.test", password: testPassword, name: "Ordinary" }));
    expect(created.status).toBe(200);
    expect(userCreates).toBe(1);
    const accepted = await login(request("/api/auth/login", { email: "ordinary@example.test", password: testPassword }));
    expect(accepted.status).toBe(200);
    const denied = await login(request("/api/auth/login", { email: "ordinary@example.test", password: "wrong" }));
    expect((await denied.json()).error).toBe("INVALID_CREDENTIALS");
  });

  test("malformed login JSON is a controlled validation response", async () => {
    const response = await login(new NextRequest("https://scholar.example/api/auth/login", { method: "POST", body: "{" }));
    expect(response.status).toBe(400);
  });
});

describe("private beta restored-session enforcement", () => {
  test("pre-beta sessions lose access without deleting the account or its session", async () => {
    cookieValues.set("scholar_session", "opaque-test-session");
    restoredUser = { ...betaUser, id: "other-account", email: "other@example.test" };
    expect(await getSessionUser()).toBeNull();
    expect(sessionDeletes).toBe(0);
    const response = await sessionStatus();
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.authenticated).toBe(false);
    expect(payload.beta).toEqual(publicBetaConfig());
    expect(payload.user).toBeUndefined();
    process.env.SCHOLAR_PRIVATE_BETA = "false";
    expect((await getSessionUser())?.id).toBe("other-account");
  });

  test("allowed sessions restore but expired sessions remain invalid", async () => {
    cookieValues.set("scholar_session", "opaque-test-session");
    restoredUser = betaUser;
    expect((await getSessionUser())?.id).toBe(betaUser.id);
    sessionExpired = true;
    expect(await getSessionUser()).toBeNull();
  });

  test("developer cookies cannot bypass a changed beta allowlist", async () => {
    process.env.DEV_MODE_ENABLED = "true";
    await createDeveloperSession(betaUser);
    expect(await hasDeveloperSession(betaUser.id)).toBe(true);
    process.env.SCHOLAR_BETA_ALLOWED_USER_IDS = "different-account";
    expect(await hasDeveloperSession(betaUser.id)).toBe(false);
  });
});
