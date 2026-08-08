import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { intelligenceSnapshot } from "@/lib/v2/intelligence/server";

/**
 * GET /api/v2/intelligence/state
 *
 * Server-authoritative Scholar Intelligence snapshot: recomputed mastery,
 * mistake book, weak-topic radar and mistake patterns. All derived from
 * stored evidence with the shared pure engine. Client state is a rendering
 * convenience only.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }
  try {
    const snapshot = await intelligenceSnapshot(user.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("[Scholar intelligence] state computation failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json(
      { error: "INTELLIGENCE_UNAVAILABLE", message: "Scholar could not compute your intelligence snapshot right now. Please try again." },
      { status: 503 },
    );
  }
}
