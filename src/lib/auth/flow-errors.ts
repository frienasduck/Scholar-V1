import "server-only";
import { NextResponse } from "next/server";
import { RequestBodyError } from "@/lib/security/request-body";
import { RateLimitError } from "@/lib/security/rate-limit";

export class AuthFlowError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
export function authFlowErrorResponse(error: unknown) {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (error instanceof RateLimitError) {
    headers["Retry-After"] = String(error.retryAfterSeconds);
    return NextResponse.json({ error: "RATE_LIMITED", message: error.message }, { status: 429, headers });
  }
  if (error instanceof AuthFlowError || error instanceof RequestBodyError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: error.status, headers });
  }
  // Never serialize database/provider errors or OAuth credentials.
  return NextResponse.json({ error: "AUTH_UNAVAILABLE", message: "Account services are temporarily unavailable. Please retry or use Guest Mode." }, { status: 503, headers });
}
