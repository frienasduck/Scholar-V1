import "server-only";
import { db } from "@/lib/db";
import type { ResolvedEntitlements } from "@/lib/subscriptions/entitlements";
import { recordAudit } from "@/lib/subscriptions/audit";
import { usageDay } from "@/lib/subscriptions/usage-day";
import { evaluateQuota } from "@/lib/subscriptions/quota";

export type UsageKey = "quiz_generation" | "slideshow_generation";

export { usageDay };

export async function consumeGeneration(userId: string, key: UsageKey, access: ResolvedEntitlements) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const day = usageDay(user?.timezone);
  const limit = key === "quiz_generation" ? access.dailyQuizLimit : access.dailySlideshowLimit;
  if (evaluateQuota(limit, 0).kind === "unlimited") return { count: 0, limit, remaining: -1, day };

  try {
    return await db.$transaction(async (tx) => {
      const existing = await tx.usageCounter.findUnique({ where: { userId_key_day: { userId, key, day } } });
      const count = existing?.count ?? 0;
      const status = evaluateQuota(limit, count);
      if (status.kind === "exhausted") {
        const error = new Error("QUOTA_REACHED") as Error & { code?: string; limit?: number };
        error.code = "QUOTA_REACHED";
        error.limit = limit;
        throw error;
      }
      const next = await tx.usageCounter.upsert({
        where: { userId_key_day: { userId, key, day } },
        create: { userId, key, day, count: 1 },
        update: { count: { increment: 1 } },
      });
      return { count: next.count, limit, remaining: Math.max(0, limit - next.count), day };
    });
  } catch (error) {
    if (error instanceof Error && (error as Error & { code?: string }).code === "QUOTA_REACHED") {
      await recordAudit("QUOTA_LIMIT_REACHED", { actorUserId: userId, targetUserId: userId, metadata: { key, day, limit } });
    }
    throw error;
  }
}

/**
 * Non-destructive quota check — rejects when the user is already at the
 * limit, but does NOT increment. Used to gate a generation BEFORE the
 * provider call; the atomic `consumeGeneration` records usage only after a
 * successful generation, so genuine provider failures never burn quota.
 */
export async function checkGenerationQuota(userId: string, key: UsageKey, access: ResolvedEntitlements) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const day = usageDay(user?.timezone);
  const limit = key === "quiz_generation" ? access.dailyQuizLimit : access.dailySlideshowLimit;
  const status = evaluateQuota(limit, 0);
  if (status.kind === "unlimited") return { used: 0, limit, remaining: -1, day };
  const existing = await db.usageCounter.findUnique({ where: { userId_key_day: { userId, key, day } } });
  const used = existing?.count ?? 0;
  const quota = evaluateQuota(limit, used);
  if (quota.kind === "exhausted") {
    const error = new Error("QUOTA_REACHED") as Error & { code?: string; limit?: number };
    error.code = "QUOTA_REACHED";
    error.limit = limit;
    throw error;
  }
  return { used, limit, remaining: quota.remaining, day };
}

export async function getUsage(userId: string, access: ResolvedEntitlements) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const day = usageDay(user?.timezone);
  const rows = await db.usageCounter.findMany({ where: { userId, day, key: { in: ["quiz_generation", "slideshow_generation"] } } });
  const map = new Map(rows.map((row) => [row.key, row.count]));
  return {
    day,
    quiz: { used: map.get("quiz_generation") ?? 0, limit: access.dailyQuizLimit },
    slideshow: { used: map.get("slideshow_generation") ?? 0, limit: access.dailySlideshowLimit },
  };
}
