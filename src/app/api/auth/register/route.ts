import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createAuthSession } from "@/lib/auth/session";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { accountError, databaseUnavailableError, isUniqueConstraintError } from "@/lib/auth/errors";
import { normalizeEmail } from "@/lib/auth/identity";
import { UserRole } from "@prisma/client";

const schema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(80),
});

export async function POST(request: NextRequest) {
  try {
    const input = schema.safeParse(await request.json());
    if (!input.success) return accountError("VALIDATION_ERROR", "Enter a valid name, email, and password of at least 8 characters.", 400);
    const email = normalizeEmail(input.data.email);
    await enforceRateLimit(`register:${email}`, "register", 5, 60 * 60 * 1000);
    if (await db.user.findUnique({ where: { email } })) {
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
    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: "RATE_LIMITED", message: error.message }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
    if (isUniqueConstraintError(error)) return accountError("EMAIL_ALREADY_EXISTS", "An account with this email already exists. Sign in instead.", 409);
    return databaseUnavailableError();
  }
}
