import { after, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/auth/identity";
import { authEmailConfigured } from "@/lib/auth/config";
import { issueAuthEmail, queueAuthEmail, consumeAuthEmail } from "@/lib/auth/recovery";
import { assertAuthMutation } from "@/lib/auth/request-security";
import { AuthFlowError, authFlowErrorResponse } from "@/lib/auth/flow-errors";
import { enforceRateLimit, requestRateLimitKey, opaqueRateLimitKey } from "@/lib/security/rate-limit";
import { readBoundedJson } from "@/lib/security/request-body";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("request-reset"), email: z.string().trim().email().max(254) }).strict(),
  z.object({ action: z.literal("request-verify") }).strict(),
  z.object({ action: z.literal("verify"), token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict(),
  z.object({ action: z.literal("reset"), token: z.string().regex(/^[A-Za-z0-9_-]{43}$/), password: z.string().min(8).max(128), confirmPassword: z.string().max(128) }).strict(),
]);
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertAuthMutation(request);
    const input = schema.safeParse(await readBoundedJson(request, 4096));
    if (!input.success) throw new AuthFlowError("VALIDATION_ERROR", "Check the email, link and password fields.");
    await enforceRateLimit(requestRateLimitKey(request, "auth-recovery"), "auth-recovery", 15, 15 * 60 * 1000);
    const data = input.data;
    if (data.action === "reset" || data.action === "verify") {
      await enforceRateLimit(opaqueRateLimitKey("auth-link", data.token), "auth-link", 5, 15 * 60 * 1000);
      if (data.action === "reset" && data.password !== data.confirmPassword) throw new AuthFlowError("VALIDATION_ERROR", "The passwords do not match.");
      await consumeAuthEmail(data.token, data.action, data.action === "reset" ? data.password : undefined);
      return NextResponse.json({ ok: true, message: data.action === "reset" ? "Password updated. Sign in with your new password." : "Your email is verified. You can continue to Scholar." }, { headers: { "Cache-Control": "no-store" } });
    }
    if (!authEmailConfigured()) throw new AuthFlowError("EMAIL_NOT_CONFIGURED", "Email recovery is not configured on this Scholar instance. You can still sign in or use Guest Mode.", 503);
    if (data.action === "request-reset") {
      const email = normalizeEmail(data.email);
      await enforceRateLimit(opaqueRateLimitKey("reset-email", email), "reset-email", 3, 60 * 60 * 1000);
      // Identical response path/timing regardless of identity or sender latency.
      after(async () => {
        try { const user = await db.user.findUnique({ where: { email } }); if (user) await issueAuthEmail(user, "reset"); } catch { /* No credentials/provider diagnostics in logs. */ }
      });
      // Same response for absent account or failed email delivery.
      return NextResponse.json({ ok: true, message: "If an account uses this email, a reset link will be sent. Check your inbox and spam folder." }, { headers: { "Cache-Control": "no-store" } });
    }
    const user = await getSessionUser();
    if (!user) throw new AuthFlowError("SIGN_IN_REQUIRED", "Sign in before requesting email verification.", 401);
    await enforceRateLimit(opaqueRateLimitKey("verify-user", user.id), "verify-user", 3, 60 * 60 * 1000);
    queueAuthEmail(user, "verify");
    return NextResponse.json({ ok: true, message: "A verification link will be sent if your email can receive it." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return authFlowErrorResponse(error); }
}
