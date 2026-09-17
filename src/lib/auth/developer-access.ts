import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { verifyPassword } from "@/lib/auth/password";

/**
 * Server-only Developer Access configuration and session helpers.
 *
 * The expected password is never stored in client code, HTML, public bundles,
 * or logs: it is read from a server-only environment variable, with a stored
 * scrypt-encoding fallback so the feature works without extra deployment
 * configuration. The fallback keeps the plain beta password out of this
 * repository while still allowing exact server-side verification.
 *
 * Sessions are signed HMAC tokens in an HttpOnly, Secure (production),
 * SameSite=Lax cookie. Frontend state alone can never grant access: every
 * server-side check re-verifies the signature, expiry, and binding to the
 * current Scholar account session.
 */

const DEV_ACCESS_COOKIE = "scholar_developer_access";
const DEV_ACCESS_MAX_AGE = 60 * 60 * 12; // 12h, independent of the 7d auth session.
// Salted scrypt encoding of the built-in private-beta developer password.
// The plain value is never committed; an scrypt hash cannot be entered back
// into the login box, keeping the raw password out of this repository.
const FALLBACK_PASSWORD_ENCODED = "scrypt:wXWDcmwGIIc6Qa_Pco9YPw:foCyZ9Kqdsn_KFg6_QPKD2voVrj-dOneXkYtdpLbRQwt-icwLnnqaTIKm-OhnWrCULkcURx1IO2oa4TPT0lIIA";

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

async function fallbackPasswordMatches(password: string) {
  // No result caching: every attempt is verified against the stored encoding.
  return verifyPassword(password, FALLBACK_PASSWORD_ENCODED);
}

export function developerAccessPasswordConfigured(): "config" | "fallback" | null {
  const configured = process.env.SCHOLAR_DEVELOPER_ACCESS_PASSWORD;
  if (configured && configured.length >= 8) return "config";
  return FALLBACK_PASSWORD_ENCODED ? "fallback" : null;
}

export async function verifyDeveloperAccessPassword(password: string): Promise<boolean> {
  const configured = process.env.SCHOLAR_DEVELOPER_ACCESS_PASSWORD;
  if (configured && configured.length >= 8) {
    if (await verifyPassword(password, configured)) return true;
    // A configured value may also be provided as the plain beta password.
    return constantTimeEqual(password, configured);
  }
  return fallbackPasswordMatches(password);
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
