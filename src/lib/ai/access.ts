import "server-only";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

/** LAM and voice share the existing session and database-backed abuse guard. */
export async function checkAssistantAccess(action: "lam-chat" | "lam-transcribe") {
  try {
    const user = await getSessionUser();
    if (!user) return { ok: false as const, response: NextResponse.json({ ok: false, error: "Sign in to use Scholar AI." }, { status: 401 }) };
    await enforceRateLimit(user.id, action, action === "lam-chat" ? 30 : 10, 60_000);
    return { ok: true as const, user };
  } catch (error) {
    const limited = error instanceof RateLimitError;
    console.warn("[Scholar assistant access]", { action, code: limited ? "RATE_LIMITED" : "ACCESS_CHECK_FAILED" });
    return { ok: false as const, response: NextResponse.json({ ok: false, error: limited ? "Too many requests. Please wait a minute and retry." : "Scholar could not verify your session. Please retry." }, { status: limited ? 429 : 503 }) };
  }
}
