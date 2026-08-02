import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createAuthSession } from "@/lib/auth/session";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

const schema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(80),
});

export async function POST(request: NextRequest) {
  try {
    const input = schema.safeParse(await request.json());
    if (!input.success) return NextResponse.json({ error: "Enter a valid name, email, and password of at least 8 characters." }, { status: 400 });
    const email = input.data.email.toLowerCase();
    await enforceRateLimit(`register:${email}`, "register", 5, 60 * 60 * 1000);
    if (await db.user.findUnique({ where: { email } })) {
      return NextResponse.json({ error: "An account already exists for this email." }, { status: 409 });
    }
    const user = await db.user.create({ data: {
      email,
      name: input.data.name,
      passwordHash: hashPassword(input.data.password),
    } });
    await createAuthSession(user);
    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: error.message }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
    return NextResponse.json({ error: "Scholar could not create the account. Please retry." }, { status: 500 });
  }
}
