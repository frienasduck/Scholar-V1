import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const querySchema = z.object({
  profileId: z.string().regex(/^class-(9|11)$/),
}).strict();

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  try { await enforceRateLimit(user.id, "live-tutor-session-read", 60, 60_000); }
  catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof RateLimitError ? "Too many session requests. Please wait and retry." : "Session history is temporarily unavailable." },
      { status: error instanceof RateLimitError ? 429 : 503 },
    );
  }

  const parsed = querySchema.safeParse({ profileId: request.nextUrl.searchParams.get("profileId") });
  if (!parsed.success) return NextResponse.json({ ok: false, error: "A valid Scholar profile is required." }, { status: 400 });

  const sessions = await db.liveTutorSession.findMany({
    where: { userId: user.id, profileId: parsed.data.profileId },
    orderBy: { lastActivityAt: "desc" },
    take: 30,
    include: { messages: { orderBy: { createdAt: "asc" }, take: 100 } },
  });

  return NextResponse.json({
    ok: true,
    sessions: sessions.map((session) => ({
      id: session.id,
      title: session.title,
      personality: session.personality,
      provider: session.provider,
      mode: session.mode,
      createdAt: session.createdAt.toISOString(),
      lastActivityAt: session.lastActivityAt.toISOString(),
      messages: session.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        inputMode: message.inputMode,
        provider: message.provider,
        model: message.model,
        createdAt: message.createdAt.toISOString(),
      })),
    })),
  });
}
