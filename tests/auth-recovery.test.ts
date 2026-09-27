import { beforeEach, describe, expect, mock, test } from "bun:test";
mock.module("server-only", () => ({}));
let configured = true, sendOkay = true, sentLink = "", sessionsDeleted = false, changed = false;
mock.module("../src/lib/auth/config", () => ({ authEmailConfigured: () => configured, authBaseUrl: () => "https://scholar.example" }));
mock.module("../src/lib/subscriptions/email", () => ({ sendScholarEmail: async (input: { html: string }) => { sentLink = input.html; return { sent: sendOkay }; } }));
type ActionToken = { tokenHash: string; userId: string; purpose: string; email: string; sessionVersion: number; expiresAt: Date; usedAt: Date | null };
let user = { id: "owner", email: "owner@example.test", sessionVersion: 1, passwordHash: "original", emailVerifiedAt: null as Date | null };
let tokens: ActionToken[] = [];
const authActionToken = {
  findUnique: async ({ where }: { where: { tokenHash: string } }) => tokens.find((t) => t.tokenHash === where.tokenHash) ?? null,
  create: async ({ data }: { data: ActionToken }) => { tokens.push({ ...data, usedAt: null }); return data; },
  updateMany: async ({ where, data }: { where: { tokenHash: string; purpose: string; expiresAt: { gt: Date } }; data: { usedAt: Date } }) => { const found = tokens.find((t) => t.tokenHash === where.tokenHash && t.purpose === where.purpose && !t.usedAt && t.expiresAt > where.expiresAt.gt); if (!found) return { count: 0 }; found.usedAt = data.usedAt; return { count: 1 }; },
  deleteMany: async ({ where }: { where: { userId?: string; purpose?: string; tokenHash?: string; expiresAt?: { lte: Date } } }) => { const before = tokens.length; tokens = tokens.filter((t) => !(where.tokenHash ? t.tokenHash === where.tokenHash : where.expiresAt ? t.expiresAt <= where.expiresAt.lte : t.userId === where.userId && (!where.purpose || t.purpose === where.purpose))); return { count: before - tokens.length }; },
};
const tx = { authActionToken, user: { findUnique: async () => user, update: async ({ data }: { data: { passwordHash?: string; sessionVersion?: { increment: number }; emailVerifiedAt?: Date } }) => { changed = true; if (data.passwordHash) user.passwordHash = data.passwordHash; if (data.sessionVersion) user.sessionVersion += data.sessionVersion.increment; if (data.emailVerifiedAt) user.emailVerifiedAt = data.emailVerifiedAt; return user; } },
  session: { deleteMany: async () => { sessionsDeleted = true; return { count: 2 }; } }, oAuthAttempt: { deleteMany: async () => ({ count: 0 }) }, $queryRaw: async () => [] };
// Serial transaction fixture models the credential row lock; no live database.
let queue = Promise.resolve();
mock.module("../src/lib/db", () => ({ db: { ...tx, $transaction: <T>(fn: (t: typeof tx) => Promise<T>) => { const result = queue.then(() => fn(tx)); queue = result.then(() => undefined, () => undefined); return result; } } }));
const { issueAuthEmail, consumeAuthEmail, recoveryTokenHash } = await import("../src/lib/auth/recovery");
const { verifyPassword } = await import("../src/lib/auth/password");
beforeEach(() => { configured = sendOkay = true; sentLink = ""; sessionsDeleted = changed = false; tokens = []; user = { id: "owner", email: "owner@example.test", sessionVersion: 1, passwordHash: "original", emailVerifiedAt: null }; queue = Promise.resolve(); });
const rawToken = "a".repeat(43);
function seed(purpose = "reset") { tokens = [{ tokenHash: recoveryTokenHash(rawToken), userId: user.id, email: user.email, purpose, sessionVersion: 1, expiresAt: new Date(Date.now() + 60000), usedAt: null }]; }
describe("email recovery and verification", () => {
  test("missing sender does not issue fake links or block registration", async () => { configured = false; expect(await issueAuthEmail(user, "verify")).toBe(false); expect(tokens).toHaveLength(0); expect(sentLink).toBe(""); });
  test("links use fragments; only hashes are stored with short reset expiration", async () => { expect(await issueAuthEmail(user, "reset")).toBe(true); expect(sentLink).toContain("https://scholar.example/login#reset="); const token = sentLink.match(/#reset=([A-Za-z0-9_-]{43})/)![1]; expect(tokens[0].tokenHash).toBe(recoveryTokenHash(token)); expect(JSON.stringify(tokens)).not.toContain(token); expect(tokens[0].expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(15 * 60 * 1000); });
  test("resend replaces the old same-purpose token", async () => { await issueAuthEmail(user, "reset"); const old = tokens[0].tokenHash; await issueAuthEmail(user, "reset"); expect(tokens).toHaveLength(1); expect(tokens[0].tokenHash).not.toBe(old); });
  test("failed delivery removes its token", async () => { sendOkay = false; expect(await issueAuthEmail(user, "reset")).toBe(false); expect(tokens).toHaveLength(0); });
  test("password reset saves a scrypt hash and invalidates all sessions and signed privilege versions", async () => { seed(); await consumeAuthEmail(rawToken, "reset", "unit-new-password"); expect(await verifyPassword("unit-new-password", user.passwordHash)).toBe(true); expect(user.sessionVersion).toBe(2); expect(user.emailVerifiedAt).not.toBeNull(); expect(sessionsDeleted).toBe(true); expect(tokens).toHaveLength(0); });
  test("reset token is single use", async () => { seed(); await consumeAuthEmail(rawToken, "reset", "unit-new-password"); await expect(consumeAuthEmail(rawToken, "reset", "another-password")).rejects.toThrow(); });
  test("concurrent consumption has exactly one winner", async () => { seed("verify"); const results = await Promise.allSettled([consumeAuthEmail(rawToken, "verify"), consumeAuthEmail(rawToken, "verify")]); expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1); });
  test("expired token rejects without changing the account", async () => { seed(); tokens[0].expiresAt = new Date(0); await expect(consumeAuthEmail(rawToken, "reset", "unit-new-password")).rejects.toThrow(); expect(changed).toBe(false); });
  test("wrong token purpose rejects", async () => { seed("verify"); await expect(consumeAuthEmail(rawToken, "reset", "unit-new-password")).rejects.toThrow(); });
  test("changed email or revoked credential version rejects", async () => { seed(); user.email = "changed@example.test"; await expect(consumeAuthEmail(rawToken, "reset", "unit-new-password")).rejects.toThrow(); user.email = "owner@example.test"; user.sessionVersion = 2; await expect(consumeAuthEmail(rawToken, "reset", "unit-new-password")).rejects.toThrow(); expect(changed).toBe(false); });
  test("verification proves email ownership without replacing credentials or sessions", async () => { seed("verify"); await consumeAuthEmail(rawToken, "verify"); expect(user.emailVerifiedAt).not.toBeNull(); expect(user.passwordHash).toBe("original"); expect(user.sessionVersion).toBe(1); expect(sessionsDeleted).toBe(false); });
  test("malformed tokens are rejected before lookup", async () => { await expect(consumeAuthEmail("invalid", "verify")).rejects.toThrow(); });
});
