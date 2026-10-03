import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { OAuth2Client, CodeChallengeMethod, type Credentials } from "google-auth-library";
import { db } from "@/lib/db";
import { authBaseUrl } from "@/lib/auth/config";
import { currentAuthSessionHash } from "@/lib/auth/session";
import { sealConnection, openConnection } from "./crypto";
import { connectorProviders } from "./registry";
import { readBoundedBytes } from "@/lib/security/request-body";

const provider = connectorProviders[0]; const COOKIE = "scholar_drive_browser";
const hash = (value: string) => createHash("sha256").update(value).digest("base64url");
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/api/connections/google-drive", maxAge: 600 };
type Row = { userId: string; provider: string; encryptedTokens: string; status: string };
export type DriveFile = { id: string; name: string; mimeType: string; size?: string; modifiedTime?: string };
export function driveConfigured() { return Boolean(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && (process.env.CONNECTOR_TOKEN_SECRET || process.env.AUTH_SESSION_SECRET || "").length >= 32); }
function client() {
  if (!driveConfigured()) throw new Error("DRIVE_NOT_CONFIGURED");
  return new OAuth2Client({ clientId: process.env.GOOGLE_DRIVE_CLIENT_ID, clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET, redirectUri: `${authBaseUrl()}/api/connections/google-drive/callback`, transporterOptions: { timeout: 12_000, retry: false } });
}
async function row(userId: string) { return (await db.$queryRaw<Row[]>`SELECT "userId", "provider", "encryptedTokens", "status" FROM "PluginConnection" WHERE "userId"=${userId} AND "provider"='google-drive'`)[0]; }
export async function driveStatus(userId: string) {
  if (!driveConfigured()) return { configured: false, connected: false, revocationPending: false, scope: provider.scope };
  const connection = await row(userId);
  return { configured: driveConfigured(), connected: connection?.status === "CONNECTED", revocationPending: connection?.status === "DISCONNECTING", scope: provider.scope };
}
export async function startDrive(userId: string) {
  const sessionHash = await currentAuthSessionHash(); if (!sessionHash) throw new Error("AUTH_REQUIRED");
  if ((await row(userId))?.status === "DISCONNECTING") throw new Error("REVOCATION_PENDING");
  const oauth = client(); const state = randomBytes(32).toString("base64url"), browser = randomBytes(32).toString("base64url");
  const { codeVerifier, codeChallenge } = await oauth.generateCodeVerifierAsync();
  await db.oAuthAttempt.deleteMany({ where: { expiresAt: { lte: new Date() }, intent: { in: ["drive-connect", "drive-exchanging"] } } });
  await db.oAuthAttempt.create({ data: { stateHash: hash(state), browserHash: hash(browser), nonce: "drive-connect", codeVerifier, redirectUri: `${authBaseUrl()}/api/connections/google-drive/callback`, intent: "drive-connect", userId, sessionHash, expiresAt: new Date(Date.now() + 600_000) } });
  (await cookies()).set(COOKIE, browser, cookieOptions);
  return oauth.generateAuthUrl({ scope: [provider.scope], state, code_challenge: codeChallenge, code_challenge_method: CodeChallengeMethod.S256, access_type: "offline", prompt: "consent" });
}
export async function finishDrive(userId: string, state: string, code: string) {
  const browser = (await cookies()).get(COOKIE)?.value;
  if (!/^[\w-]{43}$/.test(state) || !browser) throw new Error("OAUTH_EXPIRED");
  const attempt = await db.oAuthAttempt.findUnique({ where: { stateHash: hash(state) } });
  if (!attempt || attempt.intent !== "drive-connect" || attempt.userId !== userId || attempt.browserHash !== hash(browser) || attempt.expiresAt <= new Date() || attempt.sessionHash !== await currentAuthSessionHash() || attempt.redirectUri !== `${authBaseUrl()}/api/connections/google-drive/callback`) throw new Error("OAUTH_EXPIRED");
  const consumed = await db.oAuthAttempt.updateMany({ where: { stateHash: attempt.stateHash, browserHash: attempt.browserHash, intent: "drive-connect", expiresAt: { gt: new Date() } }, data: { intent: "drive-exchanging" } });
  if (consumed.count !== 1) throw new Error("OAUTH_EXPIRED");
  (await cookies()).set(COOKIE, "", { ...cookieOptions, maxAge: 0 });
  const oauth = client(); const { tokens } = await oauth.getToken({ code, codeVerifier: attempt.codeVerifier, redirect_uri: attempt.redirectUri });
  if (!tokens.access_token || !tokens.scope?.split(" ").includes(provider.scope)) throw new Error("DRIVE_PERMISSION_REQUIRED");
  const old = await row(userId);
  if (!tokens.refresh_token && old?.status === "CONNECTED") tokens.refresh_token = openConnection<Credentials>(userId, provider.id, old.encryptedTokens).refresh_token;
  if (!tokens.refresh_token) throw new Error("DRIVE_OFFLINE_PERMISSION_REQUIRED");
  if (attempt.sessionHash !== await currentAuthSessionHash()) { await oauth.revokeToken(tokens.refresh_token).catch(() => undefined); throw new Error("OAUTH_EXPIRED"); }
  const encrypted = sealConnection(userId, provider.id, tokens);
  try {
    await db.$transaction(async (tx) => {
      // Serialize completion with disconnect; never resurrect a cancelled authorization.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${userId} FOR UPDATE`;
      const active = await tx.oAuthAttempt.findUnique({ where: { stateHash: attempt.stateHash } });
      if (!active || active.intent !== "drive-exchanging" || active.userId !== userId || active.expiresAt <= new Date()) throw new Error("OAUTH_EXPIRED");
      await tx.$executeRaw`INSERT INTO "PluginConnection" ("userId", "provider", "encryptedTokens", "status", "updatedAt") VALUES (${userId}, 'google-drive', ${encrypted}, 'CONNECTED', NOW()) ON CONFLICT ("userId", "provider") DO UPDATE SET "encryptedTokens"=EXCLUDED."encryptedTokens", "status"='CONNECTED', "updatedAt"=NOW()`;
      await tx.oAuthAttempt.deleteMany({ where: { stateHash: attempt.stateHash } });
    });
  } catch (error) { await oauth.revokeToken(tokens.refresh_token).catch(() => undefined); throw error; }
}
async function accessToken(userId: string) {
  const connection = await row(userId); if (!connection || connection.status !== "CONNECTED") throw new Error("DRIVE_CONNECT_REQUIRED");
  const oauth = client(); oauth.setCredentials(openConnection<Credentials>(userId, provider.id, connection.encryptedTokens));
  const result = await oauth.getAccessToken(); if (!result.token) throw new Error("DRIVE_RECONNECT_REQUIRED");
  const next = sealConnection(userId, provider.id, oauth.credentials);
  const changed = await db.$executeRaw`UPDATE "PluginConnection" SET "encryptedTokens"=${next}, "updatedAt"=NOW() WHERE "userId"=${userId} AND "provider"='google-drive' AND "status"='CONNECTED' AND "encryptedTokens"=${connection.encryptedTokens}`;
  // Disconnect or reconnect cannot be undone by a concurrent refresh.
  if (!changed) throw new Error("DRIVE_CONNECTION_CHANGED");
  return result.token;
}
async function api(userId: string, path: string) {
  const token = await accessToken(userId);
  const response = await fetch(`https://www.googleapis.com/drive/v3/${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) { await response.body?.cancel(); throw new Error(response.status === 401 ? "DRIVE_RECONNECT_REQUIRED" : "DRIVE_FILE_UNAVAILABLE"); }
  return response;
}
export async function listDriveFiles(userId: string, q: string, pageToken?: string) {
  const query = ["trashed = false", "(mimeType = 'application/pdf' or mimeType = 'application/vnd.google-apps.document')"];
  if (q.trim()) query.push(`name contains '${q.slice(0, 100).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`);
  const params = new URLSearchParams({ q: query.join(" and "), pageSize: "30", fields: "nextPageToken,files(id,name,mimeType,size,modifiedTime)", orderBy: "modifiedTime desc" });
  if (pageToken) params.set("pageToken", pageToken.slice(0, 2000));
  return await (await api(userId, `files?${params}`)).json() as { files: DriveFile[]; nextPageToken?: string };
}
export async function importDrivePdf(userId: string, fileId: string) {
  if (!/^[\w-]{1,200}$/.test(fileId)) throw new Error("INVALID_FILE_ID");
  const file = await (await api(userId, `files/${fileId}?fields=id,name,mimeType,size,trashed,capabilities(canDownload)`)).json() as DriveFile & { trashed?: boolean; capabilities?: { canDownload?: boolean } };
  if (file.trashed || file.capabilities?.canDownload === false || !provider.supportedTypes.includes(file.mimeType as typeof provider.supportedTypes[number])) throw new Error("DRIVE_FILE_UNSUPPORTED");
  if (Number(file.size) > 4 * 1024 * 1024) throw new Error("PDF_SIZE");
  const path = file.mimeType === "application/pdf" ? `files/${fileId}?alt=media` : `files/${fileId}/export?mimeType=application%2Fpdf`;
  const response = await api(userId, path);
  const bytes = await readBoundedBytes(new Request("https://scholar.internal/import", { method: "POST", body: response.body, duplex: "half" } as RequestInit), 4 * 1024 * 1024);
  return { name: `${file.name.replace(/\.pdf$/i, "")}.pdf`, bytes };
}
export async function disconnectDrive(userId: string) {
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${userId} FOR UPDATE`;
    await tx.oAuthAttempt.deleteMany({ where: { userId, intent: { in: ["drive-connect", "drive-exchanging"] } } });
    await tx.$executeRaw`UPDATE "PluginConnection" SET "status"='DISCONNECTING', "updatedAt"=NOW() WHERE "userId"=${userId} AND "provider"='google-drive'`;
  });
  const connection = await row(userId); if (!connection) return;
  const tokens = openConnection<Credentials>(userId, provider.id, connection.encryptedTokens);
  const token = tokens.refresh_token || tokens.access_token;
  if (token) { const response = await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }), signal: AbortSignal.timeout(12_000) }); if (!response.ok && response.status !== 400) throw new Error("DRIVE_REVOCATION_PENDING"); }
  await db.$executeRaw`DELETE FROM "PluginConnection" WHERE "userId"=${userId} AND "provider"='google-drive' AND "status"='DISCONNECTING'`;
}
