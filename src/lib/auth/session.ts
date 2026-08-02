import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const AUTH_COOKIE = "scholar_session";
const DEV_COOKIE = "scholar_developer_session";
const AUTH_MAX_AGE = 60 * 60 * 24 * 7;
const DEV_MAX_AGE = 60 * 60 * 8;

type SignedSession = {
  purpose: "auth" | "developer";
  userId: string;
  version: number;
  exp: number;
};

function sessionSecret() {
  const configured = process.env.AUTH_SESSION_SECRET || process.env.DEV_MODE_SESSION_SECRET;
  if (configured?.length && configured.length >= 32) return configured;
  if (process.env.NODE_ENV !== "production") return "scholar-local-development-session-secret-only";
  throw new Error("AUTH_SESSION_SECRET is not configured securely");
}
function sign(payload: SignedSession) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verify(token: string | undefined, purpose: SignedSession["purpose"]) {
  if (!token) return null;
  const [body, supplied] = token.split(".");
  if (!body || !supplied) return null;
  const expected = createHmac("sha256", sessionSecret()).update(body).digest();
  const suppliedBytes = Buffer.from(supplied, "base64url");
  if (expected.length !== suppliedBytes.length || !timingSafeEqual(expected, suppliedBytes)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SignedSession;
    if (payload.purpose !== purpose || payload.exp <= Date.now() || !payload.userId) return null;
    return payload;
  } catch {
    return null;
  }
}

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

export async function createAuthSession(user: { id: string; sessionVersion: number }) {
  const store = await cookies();
  store.set(AUTH_COOKIE, sign({ purpose: "auth", userId: user.id, version: user.sessionVersion, exp: Date.now() + AUTH_MAX_AGE * 1000 }), cookieOptions(AUTH_MAX_AGE));
}

export async function clearAuthSession() {
  const store = await cookies();
  store.set(AUTH_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  store.set(DEV_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
}

export async function getSessionUser() {
  const store = await cookies();
  const payload = verify(store.get(AUTH_COOKIE)?.value, "auth");
  if (!payload) return null;
  const user = await db.user.findUnique({ where: { id: payload.userId } });
  if (!user || user.sessionVersion !== payload.version) return null;
  return user;
}

export async function createDeveloperSession(user: { id: string; sessionVersion: number }) {
  const store = await cookies();
  store.set(DEV_COOKIE, sign({ purpose: "developer", userId: user.id, version: user.sessionVersion, exp: Date.now() + DEV_MAX_AGE * 1000 }), cookieOptions(DEV_MAX_AGE));
}

export async function clearDeveloperSession() {
  const store = await cookies();
  store.set(DEV_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
}

export async function hasDeveloperSession(userId?: string) {
  if (process.env.DEV_MODE_ENABLED?.toLowerCase() !== "true") return false;
  const store = await cookies();
  const payload = verify(store.get(DEV_COOKIE)?.value, "developer");
  if (!payload || (userId && payload.userId !== userId)) return false;
  const user = await db.user.findUnique({ where: { id: payload.userId }, select: { sessionVersion: true } });
  return Boolean(user && user.sessionVersion === payload.version);
}
