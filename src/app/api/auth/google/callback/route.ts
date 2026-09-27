import { NextResponse } from "next/server";
import { consumeGoogleAttempt, exchangeGoogleIdentity, resolveGoogleAccount } from "@/lib/auth/google";
import { createAuthSession } from "@/lib/auth/session";
import { authBaseUrl } from "@/lib/auth/config";
import { AuthFlowError } from "@/lib/auth/flow-errors";
import { enforceRateLimit, requestRateLimitKey } from "@/lib/security/rate-limit";
export const runtime = "nodejs";
export const maxDuration = 30;
const publicErrors = new Set(["GOOGLE_EXPIRED", "GOOGLE_CANCELLED", "GOOGLE_NOT_CONFIGURED", "GOOGLE_LINK_REQUIRED", "GOOGLE_ALREADY_LINKED", "SIGN_IN_REQUIRED"]);
export async function GET(request: Request) {
  let linking = false;
  try {
    await enforceRateLimit(requestRateLimitKey(request, "google-callback"), "google-callback", 30, 15 * 60 * 1000);
    const query = new URL(request.url).searchParams;
    if (query.getAll("state").length !== 1 || query.getAll("code").length > 1 || query.getAll("error").length > 1) throw new AuthFlowError("GOOGLE_EXPIRED", "Invalid callback.");
    const attempt = await consumeGoogleAttempt(query.get("state") || "");
    linking = attempt.intent === "link";
    if (query.has("error")) throw new AuthFlowError("GOOGLE_CANCELLED", "Google sign-in was cancelled.");
    const code = query.get("code");
    if (!code || code.length > 2048 || /[\s\x00-\x1f]/.test(code)) throw new AuthFlowError("GOOGLE_FAILED", "Invalid authorization code.");
    const identity = await exchangeGoogleIdentity(code, attempt);
    const user = await resolveGoogleAccount(identity, linking ? attempt.userId : null, linking ? attempt.sessionHash : null);
    if (!linking) await createAuthSession(user);
    // Fixed local destinations only. The existing Your Scholar provider owns onboarding.
    const response = NextResponse.redirect(new URL(linking ? "/settings?google=connected" : "/", authBaseUrl()), 303);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    const code = error instanceof AuthFlowError && publicErrors.has(error.code) ? error.code : "GOOGLE_FAILED";
    const response = NextResponse.redirect(new URL(`${linking ? "/settings" : "/login"}?authError=${code}`, authBaseUrl()), 303);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }
}
