import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/v2/entitlements";
import { intelligenceSnapshot } from "@/lib/v2/intelligence/server";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

/**
 * GET /api/v2/intelligence/state
 *
 * Server-authoritative Scholar Intelligence snapshot: recomputed mastery,
 * mistake book, weak-topic radar and mistake patterns. All derived from
 * stored evidence with the shared pure engine. Client state is a rendering
 * convenience only.
 */
export async function GET() {
  const access = await requireCapability("scholar_intelligence");
  if (!access.ok) return access.response;
  const user = access.user;
  try {
    await enforceRateLimit(`intelligence-state:${user.id}`, "intelligence-state", 12, 60_000);
    const snapshot = await intelligenceSnapshot(user.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: "RATE_LIMITED", message: error.message }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
    console.error("[Scholar intelligence] state computation failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json(
      { error: "INTELLIGENCE_UNAVAILABLE", message: "Scholar could not compute your intelligence snapshot right now. Please try again." },
      { status: 503 },
    );
  }
}
