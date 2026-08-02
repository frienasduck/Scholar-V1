import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, createDeveloperSession, clearDeveloperSession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { recordAudit } from "@/lib/subscriptions/audit";

const schema = z.object({ password: z.string().min(1).max(128) });

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in before enabling Developer Mode." }, { status: 401 });
  if (process.env.DEV_MODE_ENABLED?.toLowerCase() !== "true") {
    return NextResponse.json({ error: "Developer Mode is disabled on this deployment." }, { status: 403 });
  }
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Enter the Developer Mode password." }, { status: 400 });
    const identifier = createHash("sha256").update(user.id).digest("hex").slice(0, 20);
    await enforceRateLimit(identifier, "developer-password", 5, 15 * 60 * 1000);
    const passwordHash = process.env.DEV_MODE_PASSWORD_HASH;
    if (!passwordHash || !verifyPassword(parsed.data.password, passwordHash)) {
      return NextResponse.json({ error: "Developer Mode access was denied." }, { status: 401 });
    }
    await createDeveloperSession(user);
    await recordAudit("DEVELOPER_MODE_ACTIVATED", { actorUserId: user.id, targetUserId: user.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
    return NextResponse.json({ error: "Developer Mode could not be enabled." }, { status: 500 });
  }
}

export async function DELETE() {
  const user = await getSessionUser();
  await clearDeveloperSession();
  if (user) await recordAudit("DEVELOPER_MODE_ENDED", { actorUserId: user.id, targetUserId: user.id });
  return NextResponse.json({ ok: true });
}
