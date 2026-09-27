import { NextResponse } from "next/server";
import { z } from "zod";
import { startGoogleAuth } from "@/lib/auth/google";
import { googleConfigured } from "@/lib/auth/config";
import { assertAuthMutation } from "@/lib/auth/request-security";
import { readBoundedJson } from "@/lib/security/request-body";
import { enforceRateLimit, requestRateLimitKey } from "@/lib/security/rate-limit";
import { AuthFlowError, authFlowErrorResponse } from "@/lib/auth/flow-errors";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertAuthMutation(request);
    const input = z.object({ intent: z.enum(["signin", "link"]) }).strict().safeParse(await readBoundedJson(request, 1024));
    if (!input.success) throw new AuthFlowError("VALIDATION_ERROR", "Invalid Google sign-in request.");
    if (!googleConfigured()) throw new AuthFlowError("GOOGLE_NOT_CONFIGURED", "Google sign-in is not configured on this Scholar instance.", 503);
    await enforceRateLimit(requestRateLimitKey(request, "google-start"), "google-start", 20, 15 * 60 * 1000);
    return NextResponse.json({ url: await startGoogleAuth(input.data.intent) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return authFlowErrorResponse(error); }
}
