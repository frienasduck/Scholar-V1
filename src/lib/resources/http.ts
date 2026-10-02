import { NextResponse } from "next/server";
import { RequestBodyError } from "@/lib/security/request-body";
import { RateLimitError } from "@/lib/security/rate-limit";
import { ProfileError } from "@/lib/personalization/server";
export function mutationOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  return !origin || origin === new URL(request.url).origin;
}
export function resourceError(error: unknown) {
  if (error instanceof RequestBodyError) return NextResponse.json({ message: error.message }, { status: error.status });
  if (error instanceof RateLimitError) return NextResponse.json({ message: "Too many attempts. Please wait." }, { status: 429 });
  if (error instanceof ProfileError) return NextResponse.json({ message: error.message }, { status: error.status });
  return NextResponse.json({ message: "The private resource index is unavailable. Check the resource migration and retry." }, { status: 503 });
}
