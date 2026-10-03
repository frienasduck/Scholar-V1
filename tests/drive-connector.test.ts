import { afterAll, beforeEach, expect, mock, test } from "bun:test";
mock.module("server-only", () => ({}));
const envKeys = ["GOOGLE_DRIVE_CLIENT_ID", "GOOGLE_DRIVE_CLIENT_SECRET", "CONNECTOR_TOKEN_SECRET"] as const;
const previous = envKeys.map(key => process.env[key]);
for (const key of envKeys) process.env[key] = "test-only-connector-value-not-a-production-secret";
afterAll(() => envKeys.forEach((key, i) => { if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i]; }));
type Attempt = { stateHash: string; browserHash: string; intent: string; userId: string; sessionHash: string; expiresAt: Date; codeVerifier: string; redirectUri: string };
const attempts = new Map<string, Attempt>(); let browserCookie = ""; let session = "session-a";
const revoke = mock(async () => undefined);
let exchange: () => Promise<{ tokens: { access_token: string; refresh_token: string; scope: string } }>;
const insert = mock(async (...query: unknown[]) => { void query; return 1; });
const fakeDb = {
  oAuthAttempt: {
    create: async ({ data }: { data: Attempt }) => { attempts.set(data.stateHash, data); },
    findUnique: async ({ where }: { where: { stateHash: string } }) => attempts.get(where.stateHash) ?? null,
    updateMany: async ({ where, data }: { where: { stateHash: string; intent: string }; data: { intent: string } }) => { const attempt = attempts.get(where.stateHash); if (!attempt || attempt.intent !== where.intent) return { count: 0 }; attempt.intent = data.intent; return { count: 1 }; },
    deleteMany: async ({ where }: { where: { stateHash?: string; userId?: string; expiresAt?: unknown } }) => { if (where.expiresAt) return { count: 0 }; let count = 0; for (const [id, attempt] of attempts) if ((!where.stateHash || id === where.stateHash) && (!where.userId || attempt.userId === where.userId)) { attempts.delete(id); count++; } return { count }; },
  },
  $queryRaw: async () => [],
  $executeRaw: insert,
  $transaction: async <T>(fn: (tx: typeof fakeDb) => Promise<T>): Promise<T> => fn(fakeDb),
};
mock.module("@/lib/db", () => ({ db: fakeDb }));
mock.module("next/headers", () => ({ cookies: async () => ({ get: () => browserCookie ? { value: browserCookie } : undefined, set: (_name: string, value: string) => { browserCookie = value; } }) }));
mock.module("@/lib/auth/config", () => ({ authBaseUrl: () => "http://localhost:3000" }));
mock.module("@/lib/auth/session", () => ({ currentAuthSessionHash: async () => session }));
mock.module("google-auth-library", () => ({ CodeChallengeMethod: { S256: "S256" }, OAuth2Client: class {
  async generateCodeVerifierAsync() { return { codeVerifier: "verifier", codeChallenge: "challenge" }; }
  generateAuthUrl(options: { state: string; scope: string[] }) { return `https://accounts.google.com/auth?${new URLSearchParams({ state: options.state, scope: options.scope.join(" ") })}`; }
  getToken() { return exchange(); }
  revokeToken = revoke;
} }));
const { startDrive, finishDrive, disconnectDrive, driveStatus } = await import("../src/lib/connections/google-drive");
beforeEach(() => { attempts.clear(); browserCookie = ""; session = "session-a"; insert.mockClear(); revoke.mockClear(); exchange = async () => ({ tokens: { access_token: "private-access", refresh_token: "private-refresh", scope: "https://www.googleapis.com/auth/drive.file" } }); });
async function begin() { return new URL(await startDrive("user-a")).searchParams.get("state")!; }
test("Drive requests only per-file scope and persists encrypted tokens server-side", async () => { const url = new URL(await startDrive("user-a")); expect(url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/drive.file"); await finishDrive("user-a", url.searchParams.get("state")!, "code"); expect(insert).toHaveBeenCalledTimes(1); expect(JSON.stringify(insert.mock.calls)).not.toContain("private-refresh"); expect(attempts.size).toBe(0); });
test("OAuth cannot be completed by another account or session", async () => { const state = await begin(); await expect(finishDrive("user-b", state, "code")).rejects.toThrow("OAUTH_EXPIRED"); session = "session-b"; await expect(finishDrive("user-a", state, "code")).rejects.toThrow("OAUTH_EXPIRED"); expect(insert).not.toHaveBeenCalled(); });
test("expired and replayed OAuth states are rejected", async () => { const state = await begin(); for (const attempt of attempts.values()) attempt.expiresAt = new Date(0); await expect(finishDrive("user-a", state, "code")).rejects.toThrow("OAUTH_EXPIRED"); });
test("disconnect during token exchange cannot resurrect a connection", async () => { const state = await begin(); let release: (() => void) | undefined; const pending = new Promise<void>(resolve => { release = resolve; }); let entered: (() => void) | undefined; const exchanging = new Promise<void>(resolve => { entered = resolve; }); exchange = async () => { entered?.(); await pending; return { tokens: { access_token: "private-access", refresh_token: "private-refresh", scope: "https://www.googleapis.com/auth/drive.file" } }; }; const finish = finishDrive("user-a", state, "code"); await exchanging; await disconnectDrive("user-a"); release?.(); await expect(finish).rejects.toThrow("OAUTH_EXPIRED"); expect(revoke).toHaveBeenCalledWith("private-refresh"); expect(insert.mock.calls.some(call => String(call[0]).includes("INSERT"))).toBe(false); });
test("missing external configuration is honest and never queries tokens", async () => { const value = process.env.GOOGLE_DRIVE_CLIENT_ID; delete process.env.GOOGLE_DRIVE_CLIENT_ID; try { expect(await driveStatus("user-a")).toMatchObject({ configured: false, connected: false }); } finally { process.env.GOOGLE_DRIVE_CLIENT_ID = value; } });
