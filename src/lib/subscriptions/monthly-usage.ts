import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { ResolvedEntitlements } from "@/lib/subscriptions/entitlements";
import { usageMonth } from "@/lib/subscriptions/usage-month";
import { aiVideoMonthlyLimit } from "@/lib/lamtube/access";

export { usageMonth } from "@/lib/subscriptions/usage-month";

export type MonthlyFeature = "custom_ebook_upload" | "mock_exam_generation" | "ai_video_generation";
const RESERVATION_TTL_MS = 15 * 60 * 1000;

export class MonthlyQuotaError extends Error {
  readonly code = "MONTHLY_QUOTA_REACHED";
  constructor(readonly feature: MonthlyFeature, readonly limit: number) {
    super(`MONTHLY_QUOTA_REACHED:${feature}`);
  }
}

function limitFor(feature: MonthlyFeature, access: ResolvedEntitlements) {
  if (feature === "ai_video_generation") return aiVideoMonthlyLimit(access);
  return feature === "custom_ebook_upload" ? access.monthlyEbookUploadLimit : access.monthlyMockExamLimit;
}

function counterKey(feature: MonthlyFeature) {
  if (feature === "ai_video_generation") return "ai_video_generation_monthly";
  return feature === "custom_ebook_upload" ? "custom_ebook_upload_monthly" : "mock_exam_generation_monthly";
}

async function effectiveUsed(tx: Prisma.TransactionClient, userId: string, feature: MonthlyFeature, period: string) {
  const [counter, reserved] = await Promise.all([
    tx.usageCounter.findUnique({ where: { userId_key_day: { userId, key: counterKey(feature), day: period } } }),
    tx.usageEvent.count({ where: { userId, feature, periodDay: period, status: "reserved", createdAt: { gte: new Date(Date.now() - RESERVATION_TTL_MS) } } }),
  ]);
  return (counter?.count ?? 0) + reserved;
}

export async function reserveMonthlyUsage(input: { userId: string; feature: MonthlyFeature; idempotencyKey: string; access: ResolvedEntitlements }) {
  const user = await db.user.findUnique({ where: { id: input.userId }, select: { timezone: true } });
  const timezone = user?.timezone ?? "Asia/Kolkata";
  const period = usageMonth(timezone);
  const limit = limitFor(input.feature, input.access);
  return db.$transaction(async (tx) => {
    await tx.usageEvent.updateMany({
      where: { userId: input.userId, feature: input.feature, periodDay: period, status: "reserved", createdAt: { lt: new Date(Date.now() - RESERVATION_TTL_MS) } },
      data: { status: "released" },
    });
    const replay = await tx.usageEvent.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (replay) {
      if (replay.userId !== input.userId || replay.feature !== input.feature || replay.periodDay !== period) throw new Error("MONTHLY_RESERVATION_CONFLICT");
      if (input.feature !== "custom_ebook_upload" || replay.status !== "released") return { period, timezone, limit, used: await effectiveUsed(tx, input.userId, input.feature, period), replayed: true };
    }
    const key = counterKey(input.feature);
    await tx.$executeRaw`
      INSERT INTO "UsageCounter" ("id", "userId", "key", "day", "count", "updatedAt")
      VALUES (${randomUUID()}, ${input.userId}, ${key}, ${period}, 0, ${new Date()})
      ON CONFLICT ("userId", "key", "day") DO UPDATE SET "updatedAt" = EXCLUDED."updatedAt"
    `;
    const used = await effectiveUsed(tx, input.userId, input.feature, period);
    if (used >= limit) throw new MonthlyQuotaError(input.feature, limit);
    if (replay) {
      const reopened = await tx.usageEvent.updateMany({ where: { id: replay.id, userId: input.userId, status: "released" }, data: { status: "reserved", createdAt: new Date() } });
      if (!reopened.count) return { period, timezone, limit, used, replayed: true };
    } else await tx.usageEvent.create({ data: { userId: input.userId, feature: input.feature, idempotencyKey: input.idempotencyKey, periodDay: period, status: "reserved" } });
    return { period, timezone, limit, used: used + 1, replayed: false };
  });
}

export async function commitMonthlyUsage(userId: string, idempotencyKey: string, transaction?: Prisma.TransactionClient) {
  const commit = async (tx: Prisma.TransactionClient) => {
    const event = await tx.usageEvent.findUnique({ where: { idempotencyKey } });
    if (!event || event.userId !== userId || event.status === "released") throw new Error("MONTHLY_RESERVATION_INVALID");
    if (event.status === "consumed") return;
    const claimed = await tx.usageEvent.updateMany({ where: { id: event.id, userId, status: "reserved" }, data: { status: "consumed" } });
    if (claimed.count !== 1) throw new Error("MONTHLY_RESERVATION_CHANGED");
    await tx.usageCounter.upsert({
      where: { userId_key_day: { userId, key: counterKey(event.feature as MonthlyFeature), day: event.periodDay } },
      create: { userId, key: counterKey(event.feature as MonthlyFeature), day: event.periodDay, count: event.units },
      update: { count: { increment: event.units } },
    });
  };
  if (transaction) await commit(transaction);
  else await db.$transaction(commit);
}

export async function getAIVideoUsage(userId: string, access: ResolvedEntitlements) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const timezone = user?.timezone ?? "Asia/Kolkata";
  const period = usageMonth(timezone);
  const used = await db.$transaction(tx => effectiveUsed(tx, userId, "ai_video_generation", period));
  const limit = aiVideoMonthlyLimit(access);
  return { period, timezone, used, limit: Number.isFinite(limit) ? limit : null, remaining: Number.isFinite(limit) ? Math.max(0, limit - used) : null };
}

export async function releaseMonthlyUsage(userId: string, idempotencyKey: string) {
  await db.usageEvent.updateMany({ where: { userId, idempotencyKey, status: "reserved" }, data: { status: "released" } });
}

export async function getMonthlyUsage(userId: string, access: ResolvedEntitlements) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const timezone = user?.timezone ?? "Asia/Kolkata";
  const period = usageMonth(timezone);
  const rows = await db.usageCounter.findMany({ where: { userId, day: period, key: { in: [counterKey("custom_ebook_upload"), counterKey("mock_exam_generation")] } } });
  const values = new Map(rows.map((row) => [row.key, row.count]));
  const item = (feature: MonthlyFeature) => {
    const used = values.get(counterKey(feature)) ?? 0;
    const limit = limitFor(feature, access);
    return { used, limit, remaining: Math.max(0, limit - used) };
  };
  return { period, timezone, ebookUploads: item("custom_ebook_upload"), mockExams: item("mock_exam_generation") };
}
