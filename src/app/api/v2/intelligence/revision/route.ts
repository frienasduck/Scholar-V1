import { NextRequest, NextResponse } from "next/server";
import { requireCapability } from "@/lib/v2/entitlements";
import { db } from "@/lib/db";
import { reviewUpdateSchema, manualOrderSchema } from "@/lib/v2/intelligence/schemas";
import { nextReview } from "@/lib/v2/intelligence/spaced-repetition";
import type { ReviewSchedule } from "@/lib/v2/intelligence/types";
import { recordAudit } from "@/lib/subscriptions/audit";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { readBoundedJson, RequestBodyError } from "@/lib/security/request-body";

/**
 * GET /api/v2/intelligence/revision — due revision items for the session user.
 * POST — apply a review rating (spaced-repetition update) or a manual order.
 * Ownership is enforced: items are always scoped to the session user.
 */
export async function GET() {
  const access = await requireCapability("scholar_intelligence");
  if (!access.ok) return access.response;
  const user = access.user;
  try {
    await enforceRateLimit(`intelligence-revision-read:${user.id}`, "intelligence-revision-read", 60, 60_000);
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: "RATE_LIMITED", message: error.message }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
    return NextResponse.json({ error: "REVISION_UNAVAILABLE" }, { status: 503 });
  }
  const items = await db.revisionItem.findMany({
    where: { userId: user.id },
    orderBy: [{ dueAt: "asc" }, { priority: "desc" }],
    take: 300,
  });
  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      subject: item.subject,
      chapter: item.chapter,
      topic: item.topic,
      kind: item.kind,
      title: item.title,
      state: item.state,
      intervalDays: item.intervalDays,
      ease: item.ease,
      dueAt: item.dueAt.getTime(),
      reviewCount: item.reviewCount,
      lapses: item.lapses,
      priority: item.priority,
    })),
  });
}

export async function POST(request: NextRequest) {
  const access = await requireCapability("scholar_intelligence");
  if (!access.ok) return access.response;
  const user = access.user;

  let body: unknown;
  try {
    await enforceRateLimit(`intelligence-revision-write:${user.id}`, "intelligence-revision-write", 30, 60_000);
    body = await readBoundedJson(request, 256 * 1024);
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: "RATE_LIMITED", message: error.message }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    return NextResponse.json({ error: "REVISION_UNAVAILABLE", message: "Scholar could not update revision right now." }, { status: 503 });
  }

  const payload = body as { action?: string };
  if (payload.action === "review") {
    const parsed = reviewUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION_FAILED", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
    }
    const { itemId, rating, at } = parsed.data;

    const outcome = await db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "RevisionItem" WHERE "id" = ${itemId} AND "userId" = ${user.id} FOR UPDATE
      `;
      if (!locked[0]) return null;
      const item = await tx.revisionItem.findFirst({ where: { id: itemId, userId: user.id } });
      if (!item) return null;
      const schedule: ReviewSchedule = {
        state: item.state as ReviewSchedule["state"],
        intervalDays: item.intervalDays,
        ease: item.ease,
        dueAt: item.dueAt.getTime(),
        reviewCount: item.reviewCount,
        lapses: item.lapses,
      };
      const next = nextReview(schedule, rating, at);
      const updated = await tx.revisionItem.update({
        where: { id: item.id },
        data: {
          state: next.state,
          intervalDays: next.intervalDays,
          ease: next.ease,
          dueAt: new Date(next.dueAt),
          reviewCount: next.reviewCount,
          lapses: next.lapses,
          lastReviewedAt: new Date(at),
        },
      });
      return { updated, next };
    });
    if (!outcome) {
      return NextResponse.json({ error: "ITEM_NOT_FOUND" }, { status: 404 });
    }
    const { updated, next } = outcome;

    await recordAudit("INTELLIGENCE_REVISION_REVIEWED", {
      actorUserId: user.id,
      metadata: { itemId, rating, state: next.state },
    });

    return NextResponse.json({
      ok: true,
      item: {
        id: updated.id,
        state: updated.state,
        intervalDays: updated.intervalDays,
        dueAt: updated.dueAt.getTime(),
        reviewCount: updated.reviewCount,
        lapses: updated.lapses,
      },
    });
  }

  if (payload.action === "manual-order") {
    const parsed = manualOrderSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION_FAILED", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
    }
    // Order is stored per item as a relative priority hint.
    const { order } = parsed.data;
    const results = await db.$transaction(order.map((id, index) =>
      db.revisionItem.updateMany({
        where: { id, userId: user.id },
        data: { priority: 1000 - index },
      }),
    ));
    const written = results.reduce((sum, result) => sum + result.count, 0);
    return NextResponse.json({ ok: true, written });
  }

  return NextResponse.json({ error: "UNKNOWN_ACTION" }, { status: 400 });
}
