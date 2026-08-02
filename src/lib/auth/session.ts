import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const AUTH_COOKIE = "scholar_session";
const DEV_COOKIE = "scholar_developer_session";
const AUTH_MAX_AGE = 60 * 60 * 24 * 7;
const DEV_MAX_AGE = 60 * 60 * 8;

type SignedDeveloperSession = {
  purpose: "developer";
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

function signDeveloperSession(payload: SignedDeveloperSession) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifyDeveloperSession(token: string | undefined) {
  if (!token) return null;
  const [body, supplied] = token.split(".");
  if (!body || !supplied) return null;
  const expected = createHmac("sha256", sessionSecret()).update(body).digest();
  const suppliedBytes = Buffer.from(supplied, "base64url");
  if (expected.length !== suppliedBytes.length || !timingSafeEqual(expected, suppliedBytes)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SignedDeveloperSession;
    if (payload.purpose !== "developer" || payload.exp <= Date.now() || !payload.userId) return null;
    return payload;
  } catch {
    return null;
  }
}

function hashSessionToken(token: string): string {
  return createHmac("sha256", sessionSecret()).update(token).digest("base64url");
}

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

async function revokeCurrentAuthSession() {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
}

export async function createAuthSession(user: { id: string }) {
  await revokeCurrentAuthSession();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + AUTH_MAX_AGE * 1000);
  await db.session.create({ data: { tokenHash: hashSessionToken(token), userId: user.id, expiresAt } });
  const store = await cookies();
  store.set(AUTH_COOKIE, token, cookieOptions(AUTH_MAX_AGE));
}

export async function clearAuthSession() {
  const store = await cookies();
  try {
    await revokeCurrentAuthSession();
  } finally {
    store.set(AUTH_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
    store.set(DEV_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  }
}

export async function getSessionUser() {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          sessionVersion: true,
          timezone: true,
          coins: true,
          plusBonusGrantedAt: true,
          currentScholarClass: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });
  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return session.user;
}

export async function createDeveloperSession(user: { id: string; sessionVersion: number }) {
  const store = await cookies();
  store.set(
    DEV_COOKIE,
    signDeveloperSession({ purpose: "developer", userId: user.id, version: user.sessionVersion, exp: Date.now() + DEV_MAX_AGE * 1000 }),
    cookieOptions(DEV_MAX_AGE),
  );
}

export async function clearDeveloperSession() {
  const store = await cookies();
  store.set(DEV_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
}

export async function hasDeveloperSession(userId?: string) {
  if (process.env.DEV_MODE_ENABLED?.toLowerCase() !== "true") return false;
  const store = await cookies();
  const payload = verifyDeveloperSession(store.get(DEV_COOKIE)?.value);
  if (!payload || (userId && payload.userId !== userId)) return false;
  const user = await db.user.findUnique({ where: { id: payload.userId }, select: { sessionVersion: true } });
  return Boolean(user && user.sessionVersion === payload.version);
}
