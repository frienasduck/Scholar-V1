import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { OAuth2Client, CodeChallengeMethod } from "google-auth-library";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { authBaseUrl, googleConfigured } from "./config";
import { AuthFlowError } from "./flow-errors";
import { validatedGoogleIdentity } from "./google-claims";
import { currentAuthSessionHash, getSessionUser } from "./session";

const COOKIE = "scholar_google_browser";
const AGE = 10 * 60;
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/api/auth/google", maxAge: AGE };
export const authTokenHash = (value: string) => createHash("sha256").update(value).digest("base64url");
const randomToken = () => randomBytes(32).toString("base64url");

function client(redirectUri: string) {
  if (!googleConfigured()) throw new AuthFlowError("GOOGLE_NOT_CONFIGURED", "Google sign-in is not configured on this Scholar instance.", 503);
  return new OAuth2Client({ clientId: process.env.GOOGLE_CLIENT_ID!.trim(), clientSecret: process.env.GOOGLE_CLIENT_SECRET!.trim(), redirectUri,
    transporterOptions: { timeout: 12_000, retry: false } });
}

export async function startGoogleAuth(intent: "signin" | "link") {
  const redirectUri = `${authBaseUrl()}/api/auth/google/callback`;
  const oauth = client(redirectUri);
  const user = await getSessionUser();
  if (intent === "link" && !user) throw new AuthFlowError("SIGN_IN_REQUIRED", "Sign in to your existing Scholar account before connecting Google.", 401);
  const state = randomToken(), browser = randomToken(), nonce = randomToken();
  const { codeVerifier, codeChallenge } = await oauth.generateCodeVerifierAsync();
  await db.oAuthAttempt.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  await db.oAuthAttempt.create({ data: {
    stateHash: authTokenHash(state), browserHash: authTokenHash(browser), nonce, codeVerifier, redirectUri, intent,
    userId: intent === "link" ? user!.id : null,
    sessionHash: intent === "link" ? await currentAuthSessionHash() : null,
    expiresAt: new Date(Date.now() + AGE * 1000),
  } });
  (await cookies()).set(COOKIE, browser, cookieOptions);
  return oauth.generateAuthUrl({ scope: ["openid", "email", "profile"], state, nonce,
    code_challenge: codeChallenge, code_challenge_method: CodeChallengeMethod.S256,
    prompt: "select_account", access_type: "online" });
}

export async function consumeGoogleAttempt(state: string) {
  const browser = (await cookies()).get(COOKIE)?.value;
  if (!/^[A-Za-z0-9_-]{43}$/.test(state) || !browser || !/^[A-Za-z0-9_-]{43}$/.test(browser)) {
    throw new AuthFlowError("GOOGLE_EXPIRED", "Google sign-in expired. Please start again.");
  }
  const stateHash = authTokenHash(state), browserHash = authTokenHash(browser);
  const attempt = await db.oAuthAttempt.findUnique({ where: { stateHash } });
  if (!attempt || attempt.browserHash !== browserHash || attempt.expiresAt <= new Date() || attempt.redirectUri !== `${authBaseUrl()}/api/auth/google/callback`) {
    throw new AuthFlowError("GOOGLE_EXPIRED", "Google sign-in expired. Please start again.");
  }
  if (attempt.intent === "link") {
    const user = await getSessionUser();
    if (!user || user.id !== attempt.userId || !attempt.sessionHash || await currentAuthSessionHash() !== attempt.sessionHash) {
      throw new AuthFlowError("GOOGLE_EXPIRED", "Your account session changed. Start account linking again.");
    }
  } else if (attempt.intent !== "signin") throw new AuthFlowError("GOOGLE_EXPIRED", "Invalid Google sign-in attempt.");
  // Delete atomically BEFORE exchange. Concurrent/replayed callbacks cannot win twice.
  const consumed = await db.oAuthAttempt.deleteMany({ where: { stateHash, browserHash, expiresAt: { gt: new Date() } } });
  if (consumed.count !== 1) throw new AuthFlowError("GOOGLE_EXPIRED", "Google sign-in expired. Please start again.");
  (await cookies()).set(COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return attempt;
}

export async function exchangeGoogleIdentity(code: string, attempt: { redirectUri: string; codeVerifier: string; nonce: string }) {
  const oauth = client(attempt.redirectUri);
  const { tokens } = await oauth.getToken({ code, codeVerifier: attempt.codeVerifier, redirect_uri: attempt.redirectUri });
  if (!tokens.id_token) throw new AuthFlowError("GOOGLE_FAILED", "Google did not return a valid identity.");
  const ticket = await oauth.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID!.trim() });
  return validatedGoogleIdentity(ticket.getPayload(), { audience: process.env.GOOGLE_CLIENT_ID!.trim(), nonce: attempt.nonce });
}

export async function resolveGoogleAccount(identity: { subject: string; email: string; name: string }, linkUserId: string | null, linkSessionHash: string | null = null) {
  // Unique keys remain the ultimate arbiter for parallel first sign-ins/link attempts.
  for (let retry = 0; retry < 2; retry++) {
    try {
      return await db.$transaction(async (tx) => {
        if (linkUserId) {
          await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${linkUserId} FOR UPDATE`;
          const owner = await tx.user.findUnique({ where: { id: linkUserId } });
          if (!owner) throw new AuthFlowError("SIGN_IN_REQUIRED", "Sign in before connecting Google.", 401);
          const session = linkSessionHash ? await tx.session.findUnique({ where: { tokenHash: linkSessionHash } }) : null;
          if (!session || session.userId !== linkUserId || session.expiresAt <= new Date()) throw new AuthFlowError("GOOGLE_EXPIRED", "Your account session changed. Start account linking again.");
        }
        const existing = await tx.oAuthAccount.findUnique({ where: { provider_providerAccountId: { provider: "google", providerAccountId: identity.subject } } });
        if (existing) {
          if (linkUserId && existing.userId !== linkUserId) throw new AuthFlowError("GOOGLE_ALREADY_LINKED", "This Google identity is already connected to another Scholar account.", 409);
          return { id: existing.userId };
        }
        const emailOwner = await tx.user.findUnique({ where: { email: identity.email } });
        if (!linkUserId && emailOwner) throw new AuthFlowError("GOOGLE_LINK_REQUIRED", "An account already uses this email. Sign in with your existing method, then connect Google in Settings.", 409);
        if (linkUserId) {
          if (emailOwner && emailOwner.id !== linkUserId) throw new AuthFlowError("GOOGLE_LINK_REQUIRED", "This email belongs to another Scholar account. Use a different Google account.", 409);
          const connected = await tx.oAuthAccount.findUnique({ where: { userId_provider: { userId: linkUserId, provider: "google" } } });
          if (connected) throw new AuthFlowError("GOOGLE_ALREADY_LINKED", "Your Scholar account already has a connected Google identity.", 409);
          await tx.oAuthAccount.create({ data: { provider: "google", providerAccountId: identity.subject, userId: linkUserId } });
          if (emailOwner?.id === linkUserId) await tx.user.update({ where: { id: linkUserId }, data: { emailVerifiedAt: new Date() } });
          return { id: linkUserId };
        }
        return tx.user.create({ data: { email: identity.email, name: identity.name, passwordHash: null,
          emailVerifiedAt: new Date(), role: "USER", coins: 0, currentScholarClass: 11,
          oauthAccounts: { create: { provider: "google", providerAccountId: identity.subject } } }, select: { id: true } });
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002" && retry === 0) continue;
      throw error;
    }
  }
  throw new AuthFlowError("GOOGLE_FAILED", "Could not connect Google. Please retry.", 503);
}
