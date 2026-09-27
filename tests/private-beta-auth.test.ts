// Regression coverage for retiring the ordinary beta gate (in-memory database only).
import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";
mock.module("server-only", () => ({}));
const keys = ["SCHOLAR_PRIVATE_BETA", "SCHOLAR_BETA_ALLOWED_EMAILS", "SCHOLAR_BETA_ALLOWED_USER_IDS", "DEV_MODE_ENABLED"] as const;
const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
const now = new Date();
const ordinary = { id: "ordinary", email: "ordinary@example.test", name: "Learner", role: "USER", sessionVersion: 1, timezone: "UTC", coins: 0, plusBonusGrantedAt: null, currentScholarClass: 11, createdAt: now, updatedAt: now, passwordHash: "" };
type FixtureUser = typeof ordinary;
let users: FixtureUser[] = [], restored: FixtureUser | null = null, expired = false, created = 0, deleted = 0, limited = false, broken = false;
const values = new Map<string, string>();
const cookieOptions: Record<string, unknown>[] = [];
mock.module("next/headers", () => ({ cookies: async () => ({ get: (key: string) => values.has(key) ? { value: values.get(key) } : undefined, set: (key: string, value: string, options: Record<string, unknown>) => { values.set(key, value); cookieOptions.push(options); } }), headers: async () => new Headers() }));
const user = {
  findUnique: async ({ where }: { where: { id?: string; email?: string } }) => { if (broken) throw new Error("private database failure"); return users.find((u) => where.id ? u.id === where.id : u.email === where.email) ?? null; },
  create: async ({ data }: { data: Partial<FixtureUser> }) => { const row = { ...ordinary, ...data, id: `new-${users.length}` }; users.push(row); return row; },
};
const session = {
  findUnique: async () => restored ? { id: "session", expiresAt: new Date(Date.now() + (expired ? -1000 : 60000)), user: restored } : null,
  create: async () => { created++; return { id: "session" }; },
  deleteMany: async () => { deleted++; return { count: 1 }; }, delete: async () => { deleted++; return {}; },
};
const tx = { user, session, $queryRaw: async () => [] };
mock.module("../src/lib/db", () => ({ db: { ...tx, $transaction: async <T>(fn: (t: typeof tx) => Promise<T>) => fn(tx) } }));
mock.module("../src/lib/auth/recovery", () => ({ queueAuthEmail: () => false }));
class Limit extends Error { retryAfterSeconds = 60; }
mock.module("../src/lib/security/rate-limit", () => ({ enforceRateLimit: async () => { if (limited) throw new Limit("Please retry later."); }, opaqueRateLimitKey: (n: string) => n, requestRateLimitKey: (_r: Request, n: string) => n, RateLimitError: Limit }));
const { hashPassword, verifyPassword } = await import("../src/lib/auth/password");
const { privateBetaEnabled, isBetaAllowed, publicBetaConfig } = await import("../src/lib/auth/beta");
const { getSessionUser, createDeveloperSession, hasDeveloperSession, createAuthSession } = await import("../src/lib/auth/session");
const { POST: login } = await import("../src/app/api/auth/login/route");
const { POST: register } = await import("../src/app/api/auth/register/route");
const { POST: logout } = await import("../src/app/api/auth/logout/route");
const password = "unit-fixture-password-only", passwordHash = await hashPassword(password);
beforeEach(() => { keys.forEach((key) => delete process.env[key]); users = [{ ...ordinary, passwordHash }]; restored = null; expired = false; created = deleted = 0; limited = broken = false; values.clear(); cookieOptions.length = 0; });
afterAll(() => { for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } });
const request = (path: string, data: unknown, origin = "https://scholar.example") => new NextRequest(`https://scholar.example/api/auth/${path}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(data) });
describe("public account policy", () => {
  test("ordinary accounts are public; anonymous identities are still unauthenticated", async () => { expect(privateBetaEnabled()).toBe(false); expect(await isBetaAllowed(ordinary)).toBe(true); expect(await isBetaAllowed(null)).toBe(false); });
  test("stale, empty and invalid beta configurations cannot close public access", async () => { for (const value of ["true", "typo", "false"]) { process.env.SCHOLAR_PRIVATE_BETA = value; process.env.SCHOLAR_BETA_ALLOWED_EMAILS = ""; process.env.SCHOLAR_BETA_ALLOWED_USER_IDS = "different"; expect(privateBetaEnabled()).toBe(false); expect(await isBetaAllowed(ordinary)).toBe(true); expect(publicBetaConfig().registrationEnabled).toBe(true); } });
  test("public config never contains an allowlist", () => { process.env.SCHOLAR_BETA_ALLOWED_EMAILS = "hidden@example.test"; expect(JSON.stringify(publicBetaConfig())).not.toContain("hidden"); });
  test("public registration normalizes email and stores a strong hash, never privileges", async () => { process.env.SCHOLAR_PRIVATE_BETA = "true"; const response = await register(request("register", { email: " NEW@Example.test ", name: "New Learner", password, confirmPassword: password })); expect(response.status).toBe(200); const row = users.at(-1)!; expect(row.email).toBe("new@example.test"); expect(row.role).toBe("USER"); expect(row.coins).toBe(0); expect(await verifyPassword(password, row.passwordHash)).toBe(true); expect(JSON.stringify(await response.json())).not.toContain("scrypt:"); expect(created).toBe(1); });
  test("duplicate normalized email is rejected without creating another identity", async () => { const r = await register(request("register", { email: " ORDINARY@EXAMPLE.TEST ", name: "Test", password })); expect(r.status).toBe(409); expect(users).toHaveLength(1); expect(created).toBe(0); });
  test("the service bootstrap email cannot be pre-hijacked through public signup", async () => { const r = await register(request("register", { email: "scholarofficialacc123@gmail.com", name: "Not the service owner", password })); expect(r.status).toBe(409); expect(created).toBe(0); });
  test("signup rejects weak/mismatched passwords and forged privileges", async () => { for (const input of [{ password: "short" }, { confirmPassword: "different" }, { role: "ADMIN" }, { coins: 1000 }]) { const r = await register(request("register", { email: "new@example.test", name: "New", password, ...input })); expect(r.status).toBe(400); } expect(created).toBe(0); });
  test("ordinary non-allowlisted password login works", async () => { process.env.SCHOLAR_BETA_ALLOWED_USER_IDS = "other"; const r = await login(request("login", { email: " ORDINARY@EXAMPLE.TEST ", password })); expect(r.status).toBe(200); expect((await r.json()).user.id).toBe(ordinary.id); expect(created).toBe(1); });
  test("unknown identity and wrong password have the same generic negative response", async () => { const a = await login(request("login", { email: "missing@example.test", password })); const b = await login(request("login", { email: ordinary.email, password: "wrong" })); expect(a.status).toBe(401); expect(await a.json()).toEqual(await b.json()); expect(created).toBe(0); });
  test("login rejects forged identity attributes", async () => { expect((await login(request("login", { email: ordinary.email, password, role: "ADMIN" }))).status).toBe(400); });
  test("malformed/oversized JSON is bounded", async () => { expect((await login(new NextRequest("https://scholar.example/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }))).status).toBe(400); expect((await register(request("register", { name: "a".repeat(5000) }))).status).toBe(413); });
  test("cross-origin mutations are rejected", async () => { expect((await login(request("login", { email: ordinary.email, password }, "https://attacker.example"))).status).toBe(403); expect(created).toBe(0); });
  test("rate limits return retry information", async () => { limited = true; const r = await login(request("login", { email: ordinary.email, password })); expect(r.status).toBe(429); expect(r.headers.get("Retry-After")).toBe("60"); });
  test("database failures stay safe", async () => { broken = true; const r = await login(request("login", { email: ordinary.email, password })); expect(r.status).toBe(503); expect(JSON.stringify(await r.json())).not.toContain("private database"); });
  test("restored ordinary sessions are allowed despite stale beta env; expiration still rejects", async () => { values.set("scholar_session", "opaque-fixture-session"); restored = users[0]; process.env.SCHOLAR_BETA_ALLOWED_USER_IDS = "different"; expect((await getSessionUser())?.id).toBe(ordinary.id); expired = true; expect(await getSessionUser()).toBeNull(); expect(deleted).toBe(1); });
  test("logout revokes the server session and clears privileged cookies", async () => { values.set("scholar_session", "opaque-fixture-session"); values.set("scholar_developer_access", "old"); const r = await logout(request("logout", {})); expect(r.status).toBe(200); expect(values.get("scholar_session")).toBe(""); expect(values.get("scholar_developer_access")).toBe(""); expect(deleted).toBe(1); });
  test("session creation rotates opaque cookies and removes old Developer Access", async () => { values.set("scholar_session", "old"); values.set("scholar_developer_access", "old"); await createAuthSession(users[0]); expect(values.get("scholar_session")).toMatch(/^[A-Za-z0-9_-]{43}$/); expect(values.get("scholar_developer_access")).toBe(""); expect(cookieOptions.some((o) => o.httpOnly && o.sameSite === "lax")).toBe(true); expect(deleted).toBe(1); });
  test("a stale credential version cannot create a session after reset", async () => { await expect(createAuthSession({ id: ordinary.id, sessionVersion: 0 })).rejects.toThrow("credentials changed"); expect(created).toBe(0); });
  test("developer cookies remain bound to account and current version, not beta env", async () => { process.env.DEV_MODE_ENABLED = "true"; await createDeveloperSession(users[0]); expect(await hasDeveloperSession(ordinary.id)).toBe(true); process.env.SCHOLAR_BETA_ALLOWED_USER_IDS = "different"; expect(await hasDeveloperSession(ordinary.id)).toBe(true); users[0].sessionVersion++; expect(await hasDeveloperSession(ordinary.id)).toBe(false); });
});
