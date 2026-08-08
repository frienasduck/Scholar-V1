import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { reviewUpdateSchema, manualOrderSchema } from "@/lib/v2/intelligence/schemas";
import { nextReview } from "@/lib/v2/intelligence/spaced-repetition";
import type { ReviewSchedule } from "@/lib/v2/intelligence/types";
import { recordAudit } from "@/lib/subscriptions/audit";

/**
 * GET /api/v2/intelligence/revision — due revision items for the session user.
 * POST — apply a review rating (spaced-repetition update) or a manual order.
 * Ownership is enforced: items are always scoped to the session user.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
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
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const payload = body as { action?: string };
  if (payload.action === "review") {
    const parsed = reviewUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION_FAILED", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
    }
    const { itemId, rating, at } = parsed.data;

    const item = await db.revisionItem.findFirst({ where: { id: itemId, userId: user.id } });
    if (!item) {
      return NextResponse.json({ error: "ITEM_NOT_FOUND" }, { status: 404 });
    }

    const schedule: ReviewSchedule = {
      state: item.state as ReviewSchedule["state"],
      intervalDays: item.intervalDays,
      ease: item.ease,
      dueAt: item.dueAt.getTime(),
      reviewCount: item.reviewCount,
      lapses: item.lapses,
    };
    const next = nextReview(schedule, rating, at);

    const updated = await db.revisionItem.update({
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
    let written = 0;
    for (let index = 0; index < order.length; index++) {
      const result = await db.revisionItem.updateMany({
        where: { id: order[index], userId: user.id },
        data: { priority: 1000 - index },
      });
      written += result.count;
    }
    return NextResponse.json({ ok: true, written });
  }

  return NextResponse.json({ error: "UNKNOWN_ACTION" }, { status: 400 });
}
