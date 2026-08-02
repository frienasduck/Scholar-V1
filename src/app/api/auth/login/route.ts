import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createAuthSession } from "@/lib/auth/session";
import { isConfiguredAdminEmail } from "@/lib/auth/admin";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

const schema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(128) });

export async function POST(request: NextRequest) {
  try {
    const input = schema.safeParse(await request.json());
    if (!input.success) return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
    const email = input.data.email.toLowerCase();
    await enforceRateLimit(`login:${email}`, "login", 10, 15 * 60 * 1000);
    let user = await db.user.findUnique({ where: { email } });
    if (!user?.passwordHash || !verifyPassword(input.data.password, user.passwordHash)) {
      return NextResponse.json({ error: "The email or password is incorrect." }, { status: 401 });
    }
    const role = isConfiguredAdminEmail(email) ? "admin" : user.role;
    if (role !== user.role) user = await db.user.update({ where: { id: user.id }, data: { role } });
    await createAuthSession(user);
    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: error.message }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
    return NextResponse.json({ error: "Scholar could not sign you in. Please retry." }, { status: 500 });
  }
}
