import "server-only";
import { db } from "@/lib/db";
import type { ResolvedEntitlements } from "@/lib/subscriptions/entitlements";
import { recordAudit } from "@/lib/subscriptions/audit";

export type UsageKey = "quiz_generation" | "slideshow_generation";

export function usageDay(timezone = "Asia/Kolkata", now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export async function consumeGeneration(userId: string, key: UsageKey, access: ResolvedEntitlements) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const day = usageDay(user?.timezone);
  const limit = key === "quiz_generation" ? access.dailyQuizLimit : access.dailySlideshowLimit;
  if (limit < 0) return { count: 0, limit, remaining: -1, day };

  try {
    return await db.$transaction(async (tx) => {
      const existing = await tx.usageCounter.findUnique({ where: { userId_key_day: { userId, key, day } } });
      const count = existing?.count ?? 0;
      if (count >= limit) {
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
