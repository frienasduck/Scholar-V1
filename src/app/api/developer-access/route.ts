import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionUser, createAuthSession } from "@/lib/auth/session";
import { createDeveloperAccessSession, clearDeveloperAccessSession, hasDeveloperAccessSession, developerAccessPasswordConfigured, verifyDeveloperAccessPassword } from "@/lib/auth/developer-access";
import { isBetaAllowed } from "@/lib/auth/beta";
import { BETA_CONTACT_EMAIL } from "@/lib/auth/identity";
import { hashPassword } from "@/lib/auth/password";
import { isUniqueConstraintError } from "@/lib/auth/errors";
import { enforceRateLimit, requestRateLimitKey, RateLimitError } from "@/lib/security/rate-limit";
import { recordAudit } from "@/lib/subscriptions/audit";
import { readBoundedJson, RequestBodyError } from "@/lib/security/request-body";

export const runtime = "nodejs";

const schema = z.object({ password: z.string().min(1).max(128) });

/**
 * Developer Access — server-side password verification for the private-beta
 * gate's privacy-page entry point. The expected password lives only in
 * server-only configuration (SCHOLAR_DEVELOPER_ACCESS_PASSWORD). When that
 * variable is absent or invalid the endpoint fails closed: it reports
 * Developer Access as unavailable and never reveals configuration details.
 *
 * POST /api/developer-access  { password } — verify and issue a signed
 *   HttpOnly developer-access session for the authorized beta account,
 *   creating its Scholar session when the developer was not signed in yet.
 * DELETE /api/developer-access — exit developer access.
 */
export async function POST(request: NextRequest) {
  if (!developerAccessPasswordConfigured()) {
    return NextResponse.json({ error: "Developer access is not available." }, { status: 403 });
  }
  try {
    const parsed = schema.safeParse(await readBoundedJson(request, 4 * 1024));
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter the developer access password." }, { status: 400 });
    }

    // Reserve an attempt atomically BEFORE password verification. A separate
    // count-then-record flow lets a concurrent flood perform unlimited scrypt
    // work before any request records its failure. Never persist a hash of the
    // submitted password: even a derived candidate is credential material.
    const ipKey = requestRateLimitKey(request, "dev-access-ip");
    await enforceRateLimit(ipKey, "developer-access", 10, 15 * 60 * 1000);

    const user = await getSessionUser();

    if (!(await verifyDeveloperAccessPassword(parsed.data.password))) {
      await recordAudit("DEVELOPER_ACCESS_LOGIN_FAILED", {
        actorUserId: user?.id,
        targetUserId: user?.id,
        // Only the event type is recorded — never the submitted value, the
        // configured credential, or any derived material.
        metadata: { outcome: "invalid-password" },
      });
      return NextResponse.json({ error: "Incorrect developer access password." }, { status: 401 });
    }

    // The privileged password is correct. Ensure the developer bootstrap exists
    // server-side (this never grants privilege merely for possessing its email) and
    // sign it in when the developer arrived without a Scholar session.
    let account = user;
    if (!account) {
      const existing = await db.user.findUnique({ where: { email: BETA_CONTACT_EMAIL } });
      if (existing) {
        account = existing;
      } else {
        try {
          // The login password for this account is a random secret nobody knows;
          // the developer enters through the developer-access password instead.
          account = await db.user.create({ data: { email: BETA_CONTACT_EMAIL, name: "Scholar Developer", passwordHash: await hashPassword(randomBytes(32).toString("base64url")), role: UserRole.USER, coins: 0, currentScholarClass: 11 } });
        } catch (error) {
          if (!isUniqueConstraintError(error)) throw error;
          const raced = await db.user.findUnique({ where: { email: BETA_CONTACT_EMAIL } });
          if (!raced) throw error;
          account = raced;
        }
      }
      if (!(await isBetaAllowed(account))) throw new Error("Developer access account is not authorized");
      await createAuthSession(account);
    }

    if (await hasDeveloperAccessSession(account.id, account.sessionVersion)) {
      return NextResponse.json({ error: "Developer access is already active for this account." }, { status: 409 });
    }

    await createDeveloperAccessSession(account);
    await recordAudit("DEVELOPER_ACCESS_ACTIVATED", { actorUserId: account.id, targetUserId: account.id });
    return NextResponse.json({ ok: true, user: { id: account.id, email: account.email, name: account.name, currentScholarClass: account.currentScholarClass } });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
    }
    return NextResponse.json({ error: "Developer access could not be verified." }, { status: 500 });
  }
}

export async function DELETE() {
  await clearDeveloperAccessSession();
  return NextResponse.json({ ok: true });
}
