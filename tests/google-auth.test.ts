import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
const priorId = process.env.GOOGLE_CLIENT_ID, priorSecret = process.env.GOOGLE_CLIENT_SECRET;
process.env.GOOGLE_CLIENT_ID = "unit-test-audience";
process.env.GOOGLE_CLIENT_SECRET = "unit-test-only-not-a-provider-secret";
afterAll(() => { if (priorId === undefined) delete process.env.GOOGLE_CLIENT_ID; else process.env.GOOGLE_CLIENT_ID = priorId; if (priorSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET; else process.env.GOOGLE_CLIENT_SECRET = priorSecret; });
mock.module("server-only", () => ({}));
let signedIn: { id: string } | null = null, sessionHash: string | null = null;
const cookie = new Map<string, string>();
mock.module("next/headers", () => ({ cookies: async () => ({ get: (n: string) => cookie.has(n) ? { value: cookie.get(n) } : undefined, set: (n: string, v: string) => cookie.set(n, v) }) }));
mock.module("../src/lib/auth/config", () => ({ googleConfigured: () => true, authBaseUrl: () => "https://scholar.example" }));
mock.module("../src/lib/auth/session", () => ({ getSessionUser: async () => signedIn, currentAuthSessionHash: async () => sessionHash }));
let verifyCalled = false, exchangeCalled = false;
mock.module("google-auth-library", () => ({ CodeChallengeMethod: { S256: "S256" }, OAuth2Client: class {
  async generateCodeVerifierAsync() { return { codeVerifier: "unit-pkce-verifier", codeChallenge: "unit-pkce-challenge" }; }
  generateAuthUrl(args: Record<string, unknown>) { return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams(Object.entries(args).map(([k, v]) => [k, Array.isArray(v) ? v.join(" ") : String(v)]))}`; }
  async getToken(args: { codeVerifier: string; redirect_uri: string }) { expect(args.codeVerifier).toBe("unit-pkce-verifier"); expect(args.redirect_uri).toBe("https://scholar.example/api/auth/google/callback"); exchangeCalled = true; return { tokens: { id_token: "unit-token-not-a-real-credential" } }; }
  async verifyIdToken() { verifyCalled = true; throw new Error("Invalid signature fixture"); }
} }));
type User = { id: string; email: string; sessionVersion?: number };
type Identity = { userId: string; provider: string; providerAccountId: string };
type Attempt = { stateHash: string; browserHash: string; nonce: string; codeVerifier: string; redirectUri: string; intent: string; userId: string | null; sessionHash: string | null; expiresAt: Date };
let users: User[] = [], identities: Identity[] = [], attempts: Attempt[] = [], revoked = false, createData: Record<string, unknown> | null = null;
const user = { findUnique: async ({ where }: { where: { id?: string; email?: string } }) => users.find((u) => where.id ? u.id === where.id : u.email === where.email) ?? null,
  create: async ({ data }: { data: Record<string, unknown> }) => { createData = data; const row = { id: "new-google-user", email: String(data.email) }; users.push(row); identities.push({ userId: row.id, provider: "google", providerAccountId: "google-subject" }); return row; },
  update: async () => ({ id: "local-user" }) };
const oAuthAccount = { findUnique: async ({ where }: { where: { provider_providerAccountId?: { provider: string; providerAccountId: string }; userId_provider?: { userId: string; provider: string } } }) => identities.find((v) => where.provider_providerAccountId ? v.providerAccountId === where.provider_providerAccountId.providerAccountId : v.userId === where.userId_provider?.userId) ?? null,
  create: async ({ data }: { data: Identity }) => { identities.push(data); return data; } };
const oAuthAttempt = { create: async ({ data }: { data: Attempt }) => { attempts.push(data); return data; }, findUnique: async ({ where }: { where: { stateHash: string } }) => attempts.find((a) => a.stateHash === where.stateHash) ?? null,
  deleteMany: async ({ where }: { where: { stateHash?: string; browserHash?: string; expiresAt?: { gt?: Date; lte?: Date } } }) => { const before = attempts.length; attempts = attempts.filter((a) => !(where.stateHash ? a.stateHash === where.stateHash && a.browserHash === where.browserHash && a.expiresAt > where.expiresAt!.gt! : a.expiresAt <= where.expiresAt!.lte!)); return { count: before - attempts.length }; } };
const tx = { user, oAuthAccount, oAuthAttempt, $queryRaw: async () => [], session: { findUnique: async () => revoked ? null : { userId: "local-user", expiresAt: new Date(Date.now() + 60000) } } };
mock.module("../src/lib/db", () => ({ db: { ...tx, $transaction: async <T>(fn: (value: typeof tx) => Promise<T>) => fn(tx) } }));
const { startGoogleAuth, consumeGoogleAttempt, resolveGoogleAccount, exchangeGoogleIdentity } = await import("../src/lib/auth/google");
beforeEach(() => { signedIn = null; sessionHash = null; cookie.clear(); users = []; identities = []; attempts = []; createData = null; revoked = false; verifyCalled = exchangeCalled = false; });
const identity = { subject: "google-subject", email: "owner@example.test", name: "Owner" };
async function started(intent: "signin" | "link" = "signin") { return new URL(await startGoogleAuth(intent)); }
describe("Google authorization-code flow", () => {
  test("start uses minimal scopes, nonce, state, PKCE and exact callback", async () => { const url = await started(); expect(url.searchParams.get("scope")).toBe("openid email profile"); expect(url.searchParams.get("code_challenge_method")).toBe("S256"); expect(url.searchParams.get("state")).toMatch(/^[A-Za-z0-9_-]{43}$/); expect(attempts[0].redirectUri).toBe("https://scholar.example/api/auth/google/callback"); expect(attempts[0].nonce).toBe(url.searchParams.get("nonce")!); expect(attempts[0].stateHash).not.toBe(url.searchParams.get("state")!); });
  test("callbacks are browser bound", async () => { const url = await started(); cookie.set("scholar_google_browser", "x".repeat(43)); await expect(consumeGoogleAttempt(url.searchParams.get("state")!)).rejects.toThrow("expired"); expect(attempts).toHaveLength(1); });
  test("wrong state and missing browser cookies reject", async () => { await started(); await expect(consumeGoogleAttempt("y".repeat(43))).rejects.toThrow(); cookie.clear(); await expect(consumeGoogleAttempt("y".repeat(43))).rejects.toThrow(); });
  test("expired callbacks reject", async () => { const url = await started(); attempts[0].expiresAt = new Date(0); await expect(consumeGoogleAttempt(url.searchParams.get("state")!)).rejects.toThrow(); });
  test("callback consumes atomically and cannot be replayed", async () => { const url = await started(); const state = url.searchParams.get("state")!; const results = await Promise.allSettled([consumeGoogleAttempt(state), consumeGoogleAttempt(state)]); expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1); await expect(consumeGoogleAttempt(state)).rejects.toThrow(); });
  test("linking requires an existing server session", async () => { await expect(started("link")).rejects.toThrow("Sign in"); });
  test("link callback rejects a changed user or exact session", async () => { signedIn = { id: "local-user" }; sessionHash = "original-session"; const url = await started("link"); sessionHash = "different-session"; await expect(consumeGoogleAttempt(url.searchParams.get("state")!)).rejects.toThrow("session changed"); });
  test("exchange passes the verifier and delegates signature verification to Google's library", async () => { await expect(exchangeGoogleIdentity("unit-code", { redirectUri: "https://scholar.example/api/auth/google/callback", codeVerifier: "unit-pkce-verifier", nonce: "unit-nonce" })).rejects.toThrow("Invalid signature"); expect(exchangeCalled).toBe(true); expect(verifyCalled).toBe(true); });
});
describe("Google identity ownership", () => {
  test("a new identity creates one ordinary user, not a subscription or credential token record", async () => { expect((await resolveGoogleAccount(identity, null)).id).toBe("new-google-user"); expect(createData).toMatchObject({ role: "USER", coins: 0, passwordHash: null }); expect(createData).not.toHaveProperty("subscriptions"); expect(JSON.stringify(createData)).not.toContain("access_token"); });
  test("a returning subject maps to the original UID despite email changes", async () => { identities = [{ provider: "google", providerAccountId: identity.subject, userId: "original-user" }]; expect((await resolveGoogleAccount({ ...identity, email: "changed@example.test" }, null)).id).toBe("original-user"); expect(createData).toBeNull(); });
  test("signed-out matching email never silently merges even a verified account", async () => { users = [{ id: "local-user", email: identity.email }]; await expect(resolveGoogleAccount(identity, null)).rejects.toThrow("Sign in with your existing method"); expect(identities).toHaveLength(0); });
  test("explicit linking keeps existing UID", async () => { users = [{ id: "local-user", email: identity.email }]; expect((await resolveGoogleAccount(identity, "local-user", "live-session")).id).toBe("local-user"); expect(identities[0].userId).toBe("local-user"); expect(createData).toBeNull(); });
  test("a revoked session cannot complete linking after provider exchange", async () => { users = [{ id: "local-user", email: identity.email }]; revoked = true; await expect(resolveGoogleAccount(identity, "local-user", "old-session")).rejects.toThrow("session changed"); expect(identities).toHaveLength(0); });
  test("an existing subject cannot be reassigned to a different account", async () => { users = [{ id: "local-user", email: identity.email }]; identities = [{ provider: "google", providerAccountId: identity.subject, userId: "other-user" }]; await expect(resolveGoogleAccount(identity, "local-user", "live-session")).rejects.toThrow("another Scholar account"); expect(identities[0].userId).toBe("other-user"); });
  test("linking cannot claim another account's email", async () => { users = [{ id: "local-user", email: "local@example.test" }, { id: "other-user", email: identity.email }]; await expect(resolveGoogleAccount(identity, "local-user", "live-session")).rejects.toThrow("another Scholar account"); });
  test("one user cannot accumulate conflicting Google identities", async () => { users = [{ id: "local-user", email: identity.email }]; identities = [{ provider: "google", providerAccountId: "old-subject", userId: "local-user" }]; await expect(resolveGoogleAccount(identity, "local-user", "live-session")).rejects.toThrow("already has"); });
});
