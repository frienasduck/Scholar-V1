import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createAuthSession } from "@/lib/auth/session";
import { enforceRateLimit, opaqueRateLimitKey, requestRateLimitKey, RateLimitError } from "@/lib/security/rate-limit";
import { accountError, databaseUnavailableError, isUniqueConstraintError } from "@/lib/auth/errors";
import { BETA_CONTACT_EMAIL, normalizeEmail } from "@/lib/auth/identity";
import { UserRole } from "@prisma/client";
import { assertAuthMutation } from "@/lib/auth/request-security";
import { queueAuthEmail } from "@/lib/auth/recovery";
import { readBoundedJson, RequestBodyError } from "@/lib/security/request-body";

const schema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(80),
  confirmPassword: z.string().max(128).optional(),
}).strict().refine((value) => value.confirmPassword === undefined || value.confirmPassword === value.password);

export async function POST(request: NextRequest) {
  try {
    assertAuthMutation(request);
    const input = schema.safeParse(await readBoundedJson(request, 4 * 1024));
    if (!input.success) return accountError("VALIDATION_ERROR", "Enter a valid name, email, and password of at least 8 characters.", 400);
    const email = normalizeEmail(input.data.email);
    await enforceRateLimit(requestRateLimitKey(request, "register-ip"), "register-ip", 10, 60 * 60 * 1000);
    await enforceRateLimit(opaqueRateLimitKey("register-account", email), "register-account", 5, 60 * 60 * 1000);
    // Reserve the existing service bootstrap identity against public pre-hijacking.
    // This confers no privilege and is not an ordinary-account beta allowlist.
    if (email === BETA_CONTACT_EMAIL || await db.user.findUnique({ where: { email } })) {
      return accountError("EMAIL_ALREADY_EXISTS", "An account with this email already exists. Sign in instead.", 409);
    }
    const passwordHash = await hashPassword(input.data.password);
    const user = await db.$transaction((tx) => tx.user.create({ data: {
      email,
      name: input.data.name,
      passwordHash,
      role: UserRole.USER,
      coins: 0,
      currentScholarClass: 11,
    } }));
    await createAuthSession(user);
    // Delivery/configuration failure never blocks a legitimate public registration.
    const verificationScheduled = queueAuthEmail(user, "verify");
    return NextResponse.json({ ok: true, verificationScheduled, user: { id: user.id, email: user.email, name: user.name, role: user.role } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    if (error instanceof RateLimitError) return NextResponse.json({ error: "RATE_LIMITED", message: error.message }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
    if (isUniqueConstraintError(error)) return accountError("EMAIL_ALREADY_EXISTS", "An account with this email already exists. Sign in instead.", 409);
    return databaseUnavailableError();
  }
}
