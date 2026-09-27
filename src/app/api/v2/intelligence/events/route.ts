import { NextRequest, NextResponse } from "next/server";
import { requireCapability } from "@/lib/v2/entitlements";
import { ingestEventsSchema, ingestMistakesSchema, toMistakeRecord } from "@/lib/v2/intelligence/schemas";
import { storeEvidence, storeMistakes } from "@/lib/v2/intelligence/server";
import { recordAudit } from "@/lib/subscriptions/audit";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { readBoundedJson, RequestBodyError } from "@/lib/security/request-body";

/**
 * POST /api/v2/intelligence/events
 *
 * Ingests raw evidence events (quiz results, practice, revisions, mistakes).
 * Validation is server-side via zod; ownership is bound to the session user.
 * The server stores evidence and recomputes mastery — client-computed mastery
 * is never accepted. Idempotent by event id (upsert).
 *
 * Body: { events?: EvidenceEventInput[], mistakes?: MistakeRecordInput[] }
 */
export async function POST(request: NextRequest) {
  const access = await requireCapability("scholar_intelligence");
  if (!access.ok) return access.response;
  const user = access.user;

  let body: unknown;
  try {
    await enforceRateLimit(`intelligence-ingest:${user.id}`, "intelligence-ingest", 12, 60_000);
    body = await readBoundedJson(request, 2 * 1024 * 1024);
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: "RATE_LIMITED", message: error.message }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    return NextResponse.json({ error: "INTELLIGENCE_UNAVAILABLE", message: "Scholar could not accept study evidence right now." }, { status: 503 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const payload = body as { events?: unknown; mistakes?: unknown };
  if ((payload.events !== undefined && !Array.isArray(payload.events)) || (payload.mistakes !== undefined && !Array.isArray(payload.mistakes))) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const hasEvents = Array.isArray(payload.events) && payload.events.length > 0;
  const hasMistakes = Array.isArray(payload.mistakes) && payload.mistakes.length > 0;

  // An empty sync is a valid no-op (nothing new to store), not an error.
  if (!hasEvents && !hasMistakes) {
    return NextResponse.json({ storedEvents: 0, storedMistakes: 0 });
  }

  const eventsResult = hasEvents ? ingestEventsSchema.safeParse({ events: payload.events }) : { success: true as const, data: { events: [] } };
  const mistakesResult = hasMistakes ? ingestMistakesSchema.safeParse({ mistakes: payload.mistakes }) : { success: true as const, data: { mistakes: [] } };

  if (!eventsResult.success || !mistakesResult.success) {
    return NextResponse.json(
      {
        error: "VALIDATION_FAILED",
        issues: [
          ...(eventsResult.success ? [] : eventsResult.error.issues),
          ...(mistakesResult.success ? [] : mistakesResult.error.issues),
        ].slice(0, 10),
      },
      { status: 400 },
    );
  }

  const events = eventsResult.data.events;
  const mistakes = mistakesResult.data.mistakes.map(toMistakeRecord);

  let storedEvents = 0;
  let storedMistakes = 0;
  try {
    storedEvents = events.length ? await storeEvidence(user.id, events) : 0;
    storedMistakes = mistakes.length ? await storeMistakes(user.id, mistakes) : 0;
  } catch {
    return NextResponse.json(
      { error: "INTELLIGENCE_UNAVAILABLE", message: "Scholar could not store this study evidence right now. Please retry." },
      { status: 503 },
    );
  }

  await recordAudit("INTELLIGENCE_EVIDENCE_INGESTED", {
    actorUserId: user.id,
    metadata: { events: storedEvents, mistakes: storedMistakes },
  });

  return NextResponse.json({ storedEvents, storedMistakes });
}
