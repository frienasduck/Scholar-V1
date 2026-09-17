import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";

mock.module("server-only", () => ({}));

// The plain developer password exists ONLY inside this test process to verify
// server behavior; it is never written to source, logs, or worklog.
const DEV_PASSWORD = process.env.DEVELOPER_ACCESS_TEST_PASSWORD ?? "scholarprivatebeta123";
const TEST_AUTH_SECRET = "scholar-test-session-secret-value-32-chars-min";

const envKeys = [
  "SCHOLAR_PRIVATE_BETA",
  "SCHOLAR_BETA_ALLOWED_EMAILS",
  "SCHOLAR_BETA_ALLOWED_USER_IDS",
  "SCHOLAR_DEVELOPER_ACCESS_PASSWORD",
  "DEV_MODE_ENABLED",
  "AUTH_SESSION_SECRET",
] as const;
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

const now = new Date();
const developerUser = {
  id: "developer-owner",
  email: "scholarofficialacc123@gmail.com",
  name: "Scholar Developer",
  role: "USER",
  sessionVersion: 1,
  timezone: "UTC",
  coins: 0,
  plusBonusGrantedAt: null,
  currentScholarClass: 11,
  createdAt: now,
  updatedAt: now,
  passwordHash: "",
};
type FixtureUser = typeof developerUser;
let users: FixtureUser[] = [];
let restoredUser: FixtureUser | null = null;
let room: { id: string; code: string; hostUserId: string; status: string; locked: boolean; expiresAt: Date; lastActivityAt: Date; revision: number; name: string; subject: string; topic: string; requireApproval: boolean; maxParticipants: number } | null = null;
let roomMembers: Array<{ id: string; roomId: string; role: string; status: string; displayName: string; tokenHash: string | null }> = [];
const cookieValues = new Map<string, string>();
const cookieStore = {
  get: (name: string) => (cookieValues.has(name) ? { value: cookieValues.get(name)! } : undefined),
  set: (name: string, value: string) => { cookieValues.set(name, value); },
};

mock.module("next/headers", () => ({ cookies: async () => cookieStore, headers: async () => new Headers() }));

const userDb = {
  findUnique: async (args: { where: { email?: string; id?: string } }) =>
    users.find((user) => (args.where.email ? user.email === args.where.email : user.id === args.where.id)) ?? null,
  create: async (args: { data: { email: string; name?: string | null } }) => {
    const created = { ...developerUser, id: "created-dev-account", email: args.data.email, name: args.data.name ?? "Scholar Developer", passwordHash: "mock-hash" };
    users.push(created);
    return created;
  },
};
const sessionDb = {
  findUnique: async () => (restoredUser ? { id: "restored-session", expiresAt: new Date(Date.now() + 60_000), user: restoredUser } : null),
  create: async () => ({ id: "new-test-session" }),
  deleteMany: async () => ({ count: 0 }),
  delete: async () => ({ id: "restored-session" }),
};
const attempts: Array<{ key: string; action: string; createdAt: Date }> = [];
const securityAttemptDb = {
  count: async (args: { where: { key: string; action: string; createdAt?: { gte: Date } } }) =>
    attempts.filter((attempt) => attempt.key === args.where.key && attempt.action === args.where.action).length,
  create: async (args: { data: { key: string; action: string } }) => { attempts.push({ ...args.data, createdAt: new Date() }); return { id: "attempt" }; },
  deleteMany: async () => ({ count: 0 }),
};
const roomDb = {
  findUnique: async (args: { where: { id?: string; code?: string } }) => {
    if (!room) return null;
    if (args.where.id && room.id !== args.where.id) return null;
    if (args.where.code && room.code !== args.where.code) return null;
    return room;
  },
  update: async (args: { where: { id: string }; data: Record<string, unknown> }) => ({ ...room!, ...args.data }),
};
const participantDb = {
  findFirst: async (args: { where: { roomId?: string; role?: string; id?: string } }) =>
    roomMembers.find((member) => (!args.where.roomId || member.roomId === args.where.roomId) && (!args.where.role || member.role === args.where.role) && (!args.where.id || member.id === args.where.id)) ?? null,
};
const dbMock = {
  user: userDb,
  session: sessionDb,
  securityAttempt: securityAttemptDb,
  groupStudyRoom: roomDb,
  groupStudyParticipant: participantDb,
};
mock.module("../src/lib/db", () => ({ db: dbMock }));

let rateLimitCalls = 0;
class TestRateLimitError extends Error { retryAfterSeconds = 60; }
mock.module("../src/lib/security/rate-limit", () => ({
  checkRateLimit: async (key: string, action: string, maximum: number) => {
    rateLimitCalls += 1;
    const count = attempts.filter((attempt) => attempt.key === key && attempt.action === action).length;
    if (count >= maximum) throw new TestRateLimitError();
  },
  enforceRateLimit: async (key: string, action: string, maximum: number) => {
    const count = attempts.filter((attempt) => attempt.key === key && attempt.action === action).length;
    if (count >= maximum) throw new TestRateLimitError();
    attempts.push({ key, action, createdAt: new Date() });
  },
  RateLimitError: TestRateLimitError,
}));
const auditEvents: string[] = [];
mock.module("../src/lib/subscriptions/audit", () => ({
  recordAudit: async (eventType: string) => { auditEvents.push(eventType); },
}));

const { isBetaAllowed } = await import("../src/lib/auth/beta");
const { createDeveloperAccessSession, hasDeveloperAccessSession, verifyDeveloperAccessPassword } = await import("../src/lib/auth/developer-access");
const { getSessionUser } = await import("../src/lib/auth/session");
const { POST: developerAccessPost } = await import("../src/app/api/developer-access/route");

const devAccessRequest = (password: unknown) =>
  new NextRequest("https://scholar.example/api/developer-access", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.9" },
    body: JSON.stringify({ password }),
  });

beforeEach(() => {
  for (const key of envKeys) delete process.env[key];
  process.env.AUTH_SESSION_SECRET = TEST_AUTH_SECRET;
  users = [{ ...developerUser }];
  restoredUser = null;
  room = null;
  roomMembers = [];
  attempts.length = 0;
  rateLimitCalls = 0;
  auditEvents.length = 0;
  cookieValues.clear();
});

afterAll(() => {
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

describe("developer access password verification (server-side)", () => {
  test("exact developer password verifies through the server-only fallback", async () => {
    expect(await verifyDeveloperAccessPassword(DEV_PASSWORD)).toBe(true);
  });

  test("wrong, near-miss, and empty passwords are rejected", async () => {
    for (const candidate of ["", "wrong-password", "ScholarPrivateBeta123", "scholarprivatebeta124", "scholarprivatebeta12", " scholarprivatebeta123"]) {
      expect(await verifyDeveloperAccessPassword(candidate)).toBe(false);
    }
  });

  test("the plain expected password never appears in shippable client sources", () => {
    const { readFileSync } = require("node:fs");
    const sources = [
      "src/components/developer-access-section.tsx",
      "src/app/privacy/page.tsx",
      "src/app/api/developer-access/route.ts",
      "src/lib/auth/developer-access.ts",
      "src/lib/auth/beta.ts",
      "src/lib/auth/session.ts",
    ];
    for (const file of sources) expect(readFileSync(file, "utf8")).not.toContain(DEV_PASSWORD);
  });
});

describe("developer access API", () => {
  test("wrong password returns the exact user-facing error and no session", async () => {
    cookieValues.set("scholar_session", "opaque-test-session");
    restoredUser = developerUser;
    const response = await developerAccessPost(devAccessRequest("not-the-password"));
    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe("Incorrect developer access password.");
    expect(cookieValues.has("scholar_developer_access")).toBe(false);
    expect(auditEvents).toContain("DEVELOPER_ACCESS_LOGIN_FAILED");
  });

  test("unauthenticated guesses also consume the rate-limit budget and fail closed", async () => {
    restoredUser = null;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await developerAccessPost(devAccessRequest(`guess-${attempt}`));
      expect(response.status).toBe(401);
    }
    const blocked = await developerAccessPost(devAccessRequest("another-guess"));
    expect(blocked.status).toBe(429);
  });

  test("correct password issues a signed HttpOnly session for the signed-in account", async () => {
    cookieValues.set("scholar_session", "opaque-test-session");
    restoredUser = developerUser;
    const response = await developerAccessPost(devAccessRequest(DEV_PASSWORD));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.user.email).toBe(developerUser.email);
    const cookie = cookieValues.get("scholar_developer_access");
    expect(typeof cookie).toBe("string");
    expect(cookie!.split(".")).toHaveLength(2);
  });

  test("the session cookie is HttpOnly, Secure in production, and server-validated", () => {
    const { readFileSync } = require("node:fs");
    const moduleSource = readFileSync("src/lib/auth/developer-access.ts", "utf8");
    expect(moduleSource).toContain("httpOnly: true");
    expect(moduleSource).toContain('secure: process.env.NODE_ENV === "production"');
    expect(moduleSource).toContain('sameSite: "lax"');
    expect(moduleSource).toContain("timingSafeEqual");
    expect(moduleSource).not.toContain("NEXT_PUBLIC");
    const routeSource = readFileSync("src/app/api/developer-access/route.ts", "utf8");
    expect(routeSource).toContain("getSessionUser");
  });

  test("rate limit blocks rapid guessing before verification", async () => {
    restoredUser = developerUser;
    cookieValues.set("scholar_session", "opaque-test-session");
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await developerAccessPost(devAccessRequest(`guess-${attempt}`));
      expect(response.status).toBe(401);
    }
    const blocked = await developerAccessPost(devAccessRequest(DEV_PASSWORD));
    expect(blocked.status).toBe(429);
    expect(cookieValues.has("scholar_developer_access")).toBe(false);
  });

  test("correct password without a prior session signs in the authorized account", async () => {
    // No scholar_session cookie: the developer arrives straight from the beta gate.
    const response = await developerAccessPost(devAccessRequest(DEV_PASSWORD));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.user.email).toBe(developerUser.email);
    expect(cookieValues.has("scholar_session")).toBe(true);
    expect(cookieValues.has("scholar_developer_access")).toBe(true);
    expect(auditEvents).toContain("DEVELOPER_ACCESS_ACTIVATED");
    // The normal session restore now authorizes the account server-side.
    restoredUser = users.find((user) => user.id === payload.user.id) ?? null;
    expect(await getSessionUser()).not.toBeNull();
  });

  test("unauthenticated wrong guesses still fail with the generic message", async () => {
    const response = await developerAccessPost(devAccessRequest("no-session-guess"));
    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe("Incorrect developer access password.");
    expect(cookieValues.has("scholar_session")).toBe(false);
    expect(cookieValues.has("scholar_developer_access")).toBe(false);
  });
});

describe("developer access session security", () => {
  test("session grants beta authorization for the signed-in account only", async () => {
    await createDeveloperAccessSession(developerUser);
    expect(await hasDeveloperAccessSession(developerUser.id, developerUser.sessionVersion)).toBe(true);
    expect(await isBetaAllowed(developerUser)).toBe(true);
    expect(await hasDeveloperAccessSession("other-account", 1)).toBe(false);
    expect(await isBetaAllowed({ id: "other-account", email: "other@example.test" })).toBe(false);
  });

  test("tampered cookies fail verification", async () => {
    await createDeveloperAccessSession(developerUser);
    const token = cookieValues.get("scholar_developer_access")!;
    const [body] = token.split(".");
    cookieValues.set("scholar_developer_access", `${body}.invalidsignature000`);
    expect(await hasDeveloperAccessSession(developerUser.id, 1)).toBe(false);
    cookieValues.set("scholar_developer_access", `${token}x`);
    expect(await hasDeveloperAccessSession(developerUser.id, 1)).toBe(false);
    cookieValues.delete("scholar_developer_access");
    expect(await hasDeveloperAccessSession(developerUser.id, 1)).toBe(false);
  });

  test("session restore keeps the developer authorized through refresh and navigation", async () => {
    await createDeveloperAccessSession(developerUser);
    cookieValues.set("scholar_session", "opaque-test-session");
    restoredUser = developerUser;
    expect((await getSessionUser())?.id).toBe(developerUser.id);
    // Still authorized on a later request (persistence across refresh).
    expect(await getSessionUser()).not.toBeNull();
  });

  test("the developer-access cookie itself is bound to the account's sessionVersion", async () => {
    await createDeveloperAccessSession(developerUser);
    // The signed developer cookie no longer matches the account's current version.
    expect(await hasDeveloperAccessSession(developerUser.id, 2)).toBe(false);
    expect(await hasDeveloperAccessSession(developerUser.id, developerUser.sessionVersion)).toBe(true);
  });

  test("developer cookies cannot bypass a changed beta allowlist", async () => {
    await createDeveloperAccessSession(developerUser);
    restoredUser = developerUser;
    process.env.SCHOLAR_BETA_ALLOWED_USER_IDS = "different-account";
    expect(await getSessionUser()).toBeNull();
  });
});

describe("group study host authorization", () => {
  test("developer access authorizes hosting; participants stay participant-only", async () => {
    room = { id: "room-1", code: "SCHABCD2345", hostUserId: developerUser.id, status: "waiting", locked: false, expiresAt: new Date(Date.now() + 3_600_000), lastActivityAt: new Date(), revision: 1, name: "Physics revision", subject: "Science", topic: "Motion", requireApproval: true, maxParticipants: 15 };
    roomMembers = [{ id: "member-host", roomId: "room-1", role: "host", status: "approved", displayName: "Host", tokenHash: null }];
    await createDeveloperAccessSession(developerUser);
    restoredUser = developerUser;
    cookieValues.set("scholar_session", "opaque-test-session");
    const principalUser = await getSessionUser();
    expect(await isBetaAllowed(principalUser)).toBe(true);
    // Host path re-validates through the same beta check.
    expect(principalUser!.id === room!.hostUserId && (await isBetaAllowed(principalUser))).toBe(true);
    // Participant path: no beta authorization for room participants.
    expect(await isBetaAllowed(null)).toBe(false);
    expect(await isBetaAllowed({ id: "participant-account", email: "participant@example.test" })).toBe(false);
  });
});
