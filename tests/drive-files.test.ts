import { afterAll, beforeEach, expect, mock, test } from "bun:test";
mock.module("server-only", () => ({}));
const keys = ["GOOGLE_DRIVE_CLIENT_ID", "GOOGLE_DRIVE_CLIENT_SECRET", "CONNECTOR_TOKEN_SECRET"] as const;
const oldEnv = keys.map(key => process.env[key]);
keys.forEach(key => { process.env[key] = "test-only-drive-files-encryption-value-not-real"; });
const originalFetch = globalThis.fetch;
afterAll(() => {
  globalThis.fetch = originalFetch;
  keys.forEach((key, i) => { if (oldEnv[i] === undefined) delete process.env[key]; else process.env[key] = oldEnv[i]; });
});
type Connection = { userId: string; provider: string; encryptedTokens: string; status: string };
const connections = new Map<string, Connection>();
let changed = true;
const fakeDb = {
  oAuthAttempt: { deleteMany: async () => ({ count: 0 }) },
  $queryRaw: async (sql: TemplateStringsArray, ...values: unknown[]) => sql.join("").includes("PluginConnection") ? [connections.get(String(values[0]))].filter(Boolean) : [],
  $executeRaw: async (sql: TemplateStringsArray, ...values: unknown[]) => {
    const query = sql.join("");
    const userId = String(values[query.includes('SET "encryptedTokens"') ? 1 : 0]);
    const connection = connections.get(userId);
    if (!connection) return 0;
    if (query.includes('SET "encryptedTokens"')) {
      if (!changed || connection.status !== "CONNECTED" || values[2] !== connection.encryptedTokens) return 0;
      connection.encryptedTokens = String(values[0]);
    } else if (query.includes("DELETE")) connections.delete(userId);
    else connection.status = "DISCONNECTING";
    return 1;
  },
  $transaction: async <T>(fn: (tx: typeof fakeDb) => Promise<T>): Promise<T> => fn(fakeDb),
};
mock.module("@/lib/db", () => ({ db: fakeDb }));
mock.module("next/headers", () => ({ cookies: async () => ({}) }));
mock.module("@/lib/auth/config", () => ({ authBaseUrl: () => "http://localhost:3000" }));
mock.module("@/lib/auth/session", () => ({ currentAuthSessionHash: async () => "session" }));
mock.module("google-auth-library", () => ({ CodeChallengeMethod: {}, OAuth2Client: class {
  credentials: { access_token?: string; refresh_token?: string; expiry_date?: number } = {};
  setCredentials(value: typeof this.credentials) { this.credentials = value; }
  async getAccessToken() { this.credentials = { ...this.credentials, access_token: "refreshed-private-access", expiry_date: Date.now() + 3600_000 }; return { token: this.credentials.access_token }; }
} }));
const { sealConnection, openConnection } = await import("../src/lib/connections/crypto");
const { listDriveFiles, importDrivePdf, disconnectDrive } = await import("../src/lib/connections/google-drive");
const calls: { url: string; headers: Headers }[] = [];
let respond: (url: string) => Response;
beforeEach(() => {
  connections.clear(); calls.length = 0; changed = true;
  connections.set("user-a", { userId: "user-a", provider: "google-drive", status: "CONNECTED", encryptedTokens: sealConnection("user-a", "google-drive", { access_token: "expired-private-access", refresh_token: "private-refresh", expiry_date: 0 }) });
  respond = url => url.includes("alt=media") || url.includes("/export?") ? new Response("%PDF-1.7\nfixture") : Response.json({ id: "pdf-a", name: "Class notes.pdf", mimeType: "application/pdf", size: "18", capabilities: { canDownload: true } });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => { const url = String(input); calls.push({ url, headers: new Headers(init?.headers) }); return respond(url); }) as typeof fetch;
});
test("file listing refreshes credentials and persists only an encrypted envelope", async () => {
  respond = () => Response.json({ files: [{ id: "pdf-a", name: "Notes", mimeType: "application/pdf" }] });
  const files = await listDriveFiles("user-a", "Newton's", "page-2");
  expect(files.files).toHaveLength(1);
  expect(new URL(calls[0].url).searchParams.get("pageToken")).toBe("page-2");
  expect(new URL(calls[0].url).searchParams.get("q")).toContain("Newton\\'s");
  expect(calls[0].headers.get("Authorization")).toBe("Bearer refreshed-private-access");
  const envelope = connections.get("user-a")!.encryptedTokens;
  expect(envelope).not.toContain("private-refresh");
  expect(openConnection<{ expiry_date: number }>("user-a", "google-drive", envelope).expiry_date).toBeGreaterThan(Date.now());
});
test("another user's connection cannot be used", async () => {
  await expect(listDriveFiles("user-b", "")).rejects.toThrow("DRIVE_CONNECT_REQUIRED");
  expect(calls).toHaveLength(0);
});
test("a granted PDF is imported as bounded bytes for the shared pipeline", async () => {
  const imported = await importDrivePdf("user-a", "pdf-a");
  expect(imported.name).toBe("Class notes.pdf");
  expect(new TextDecoder().decode(imported.bytes)).toContain("%PDF");
  expect(calls[1].url).toContain("alt=media");
});
test("Google Docs are exported as PDF, not stored in an isolated viewer", async () => {
  respond = url => url.includes("/export?") ? new Response("%PDF-1.7\nfixture") : Response.json({ id: "doc-a", name: "Revision", mimeType: "application/vnd.google-apps.document" });
  expect((await importDrivePdf("user-a", "doc-a")).name).toBe("Revision.pdf");
  expect(calls[1].url).toContain("export?mimeType=application%2Fpdf");
});
test("unsupported metadata, oversize files and invalid IDs are rejected", async () => {
  await expect(importDrivePdf("user-a", "../../other")).rejects.toThrow("INVALID_FILE_ID");
  respond = () => Response.json({ id: "file-a", name: "App", mimeType: "application/octet-stream" });
  await expect(importDrivePdf("user-a", "file-a")).rejects.toThrow("DRIVE_FILE_UNSUPPORTED");
  respond = () => Response.json({ id: "file-a", name: "Large.pdf", mimeType: "application/pdf", size: String(5 * 1024 * 1024) });
  await expect(importDrivePdf("user-a", "file-a")).rejects.toThrow("PDF_SIZE");
});
test("a cancelled refresh cannot resurrect or access a disconnected connection", async () => {
  changed = false;
  await expect(listDriveFiles("user-a", "")).rejects.toThrow("DRIVE_CONNECTION_CHANGED");
  expect(calls).toHaveLength(0);
});
test("upstream unauthorized access requests reconnection, not empty fake files", async () => {
  respond = () => new Response(null, { status: 401 });
  await expect(listDriveFiles("user-a", "")).rejects.toThrow("DRIVE_RECONNECT_REQUIRED");
});
test("disconnect revokes the private token and deletes local credentials", async () => {
  respond = () => new Response(null, { status: 200 });
  await disconnectDrive("user-a");
  expect(calls[0].url).toBe("https://oauth2.googleapis.com/revoke");
  expect(connections.has("user-a")).toBe(false);
});
test("a revocation failure retains encrypted credentials for retry and blocks use", async () => {
  respond = () => new Response(null, { status: 503 });
  await expect(disconnectDrive("user-a")).rejects.toThrow("DRIVE_REVOCATION_PENDING");
  expect(connections.get("user-a")?.status).toBe("DISCONNECTING");
  await expect(listDriveFiles("user-a", "")).rejects.toThrow("DRIVE_CONNECT_REQUIRED");
});
