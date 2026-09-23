import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { verifyPassword } from "@/lib/auth/password";

/**
 * Server-only Developer Access configuration and session helpers.
 *
 * The expected password lives ONLY in the server-only environment variable
 * SCHOLAR_DEVELOPER_ACCESS_PASSWORD. There is deliberately no built-in or
 * fallback credential: when that variable is absent or too short, Developer
 * Access fails closed and the API reports it as unavailable. The value is
 * never stored in client code, HTML, public bundles, or logs, and it is never
 * echoed back in an API response.
 *
 * Sessions are signed HMAC tokens in an HttpOnly, Secure (production),
 * SameSite=Lax cookie. Frontend state alone can never grant access: every
 * server-side check re-verifies the signature, expiry, and binding to the
 * current Scholar account session.
 */

const DEV_ACCESS_COOKIE = "scholar_developer_access";
const DEV_ACCESS_MAX_AGE = 60 * 60 * 12; // 12h, independent of the 7d auth session.
type DeveloperAccessSession = {
  purpose: "developer-access";
  userId: string;
  sessionVersion: number;
  exp: number;
};

function constantTimeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    // Same amount of hash work regardless of length mismatch.
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

/**
 * The configured credential, or null when Developer Access must fail closed.
 * Accepts either a plain password or a supported password encoding (see
 * verifyPassword), mirroring the other password-based gates in Scholar.
 * Values shorter than 8 characters are treated as invalid configuration.
 */
function configuredDeveloperAccessPassword(): string | null {
  const configured = process.env.SCHOLAR_DEVELOPER_ACCESS_PASSWORD;
  return configured && configured.length >= 8 ? configured : null;
}

export function developerAccessPasswordConfigured(): boolean {
  return configuredDeveloperAccessPassword() !== null;
}

export async function verifyDeveloperAccessPassword(password: string): Promise<boolean> {
  const configured = configuredDeveloperAccessPassword();
  if (!configured) return false;
  // The configured value may be an scrypt-encoded password hash or a plain
  // password; both are compared timing-safely. A failed hash check never
  // falls back to any other stored credential.
  if (await verifyPassword(password, configured)) return true;
  return constantTimeEqual(password, configured);
}

function sessionSecret() {
  const configured = process.env.AUTH_SESSION_SECRET || process.env.DEV_MODE_SESSION_SECRET;
  if (configured?.length && configured.length >= 32) return configured;
  if (process.env.NODE_ENV !== "production") return "scholar-local-development-session-secret-only";
  throw new Error("AUTH_SESSION_SECRET is not configured securely");
}

function signSession(payload: DeveloperAccessSession) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifySessionToken(token: string | undefined): DeveloperAccessSession | null {
  if (!token) return null;
  const [body, supplied] = token.split(".");
  if (!body || !supplied) return null;
  const expected = createHmac("sha256", sessionSecret()).update(body).digest();
  const suppliedBytes = Buffer.from(supplied, "base64url");
  if (expected.length !== suppliedBytes.length || !timingSafeEqual(expected, suppliedBytes)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as DeveloperAccessSession;
    if (payload.purpose !== "developer-access" || payload.exp <= Date.now() || typeof payload.userId !== "string" || !payload.userId) return null;
    return payload;
  } catch {
    return null;
  }
}

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function createDeveloperAccessSession(user: { id: string; sessionVersion: number }) {
  const store = await cookies();
  store.set(
    DEV_ACCESS_COOKIE,
    signSession({ purpose: "developer-access", userId: user.id, sessionVersion: user.sessionVersion, exp: Date.now() + DEV_ACCESS_MAX_AGE * 1000 }),
    { ...cookieOptions, maxAge: DEV_ACCESS_MAX_AGE },
  );
}

export async function clearDeveloperAccessSession() {
  const store = await cookies();
  store.set(DEV_ACCESS_COOKIE, "", { ...cookieOptions, maxAge: 0 });
}

/**
 * True when the current request carries a valid Developer Access session bound
 * to the given Scholar account. Re-checked on every call; frontend state alone
 * can never grant access.
 */
export async function hasDeveloperAccessSession(userId: string, sessionVersion?: number) {
  const store = await cookies();
  const payload = verifySessionToken(store.get(DEV_ACCESS_COOKIE)?.value);
  if (!payload || payload.userId !== userId) return false;
  if (typeof sessionVersion === "number" && payload.sessionVersion !== sessionVersion) return false;
  return true;
}
