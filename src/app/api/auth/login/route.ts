import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createAuthSession } from "@/lib/auth/session";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { accountError, databaseUnavailableError } from "@/lib/auth/errors";
import { normalizeEmail } from "@/lib/auth/identity";
import { isBetaAllowed, privateBetaEnabled, privateBetaLoginMessage } from "@/lib/auth/beta";

const schema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(128) });
// Unknown identities still perform scrypt work. This is a non-credential
// padding hash; a missing user can never authenticate against it.
const UNKNOWN_ACCOUNT_HASH = `scrypt:scholar-login-padding:${"A".repeat(86)}`;

export async function POST(request: NextRequest) {
  try {
    const input = schema.safeParse(await request.json().catch(() => null));
    if (!input.success) return accountError("VALIDATION_ERROR", "Enter a valid email and password.", 400);
    const email = normalizeEmail(input.data.email);
    await enforceRateLimit(`login:${email}`, "login", 10, 15 * 60 * 1000);
    const user = await db.user.findUnique({ where: { email } });
    const passwordValid = await verifyPassword(input.data.password, user?.passwordHash || UNKNOWN_ACCOUNT_HASH);
    if (!user || !passwordValid || !isBetaAllowed(user)) {
      if (privateBetaEnabled()) {
        return NextResponse.json({ error: "PRIVATE_BETA_ACCESS_REQUIRED", message: privateBetaLoginMessage() }, { status: 401 });
      }
      return accountError("INVALID_CREDENTIALS", "Incorrect email or password.", 401);
    }
    await createAuthSession(user);
    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role, currentScholarClass: user.currentScholarClass } });
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: "RATE_LIMITED", message: error.message }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
    return databaseUnavailableError();
  }
}
