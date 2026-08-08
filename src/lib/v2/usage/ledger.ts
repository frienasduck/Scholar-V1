import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { ResolvedEntitlements } from "@/lib/subscriptions/entitlements";
import { recordAudit } from "@/lib/subscriptions/audit";
import { usageDay } from "@/lib/subscriptions/usage-day";
import { evaluateQuota } from "@/lib/subscriptions/quota";
import {
  GENERATION_FEATURES,
  GENERATION_POLICIES,
  dailyLimitForFeature,
  usageKeyForFeature,
  type GenerationFeature,
  type GenerationPolicy,
} from "@/lib/v2/usage/policy";

/**
 * Centralized generation ledger (V2). One ledger over the existing
 * UsageCounter table, with UsageEvent rows providing idempotency keys and
 * reservation bookkeeping:
 *
 *   reserve  → create UsageEvent(status=reserved). A reserved unit counts
 *              against the effective quota immediately (multi-tab/device safe
 *              via the unique idempotencyKey + transactions).
 *   commit   → reserved → consumed + increment UsageCounter. Exactly once.
 *   release  → reserved → released (provider/network failure: quota restored).
 *
 * Replayed requests (double-clicks, HTTP retries, refresh) with the same
 * idempotency key never double-consume. Genuine provider failures never burn
 * final quota unless a documented cost policy deliberately says otherwise.
 */

export { GENERATION_FEATURES, GENERATION_POLICIES, dailyLimitForFeature, usageKeyForFeature, type GenerationFeature, type GenerationPolicy };

export class QuotaExceededError extends Error {
  readonly code = "QUOTA_REACHED" as const;
  readonly limit: number;
  constructor(limit: number, feature: GenerationFeature) {
    super(`QUOTA_REACHED:${feature}`);
    this.limit = limit;
  }
}

export class ReservationConflictError extends Error {
  readonly code = "RESERVATION_CONFLICT" as const;
}

export interface ReserveResult {
  idempotencyKey: string;
  feature: GenerationFeature;
  day: string;
  used: number;
  limit: number;
  remaining: number;
  unlimited: boolean;
  /** True when this key was already reserved/consumed (replay). */
  replayed: boolean;
}

export interface AuthoritativeUsage {
  day: string;
  items: Record<string, { used: number; reserved: number; consumed: number; limit: number; remaining: number; unlimited: boolean }>;
}

type Tx = Prisma.TransactionClient;

/**
 * Reservations older than this are treated as abandoned (client crashed,
 * tab closed mid-generation) — they no longer count against quota and are
 * released lazily on the next reservation for the same user/feature/day.
 */
export const RESERVATION_TTL_MINUTES = 10;

function reservationCutoff(): Date {
  return new Date(Date.now() - RESERVATION_TTL_MINUTES * 60_000);
}

async function userTimezone(userId: string): Promise<string> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  return user?.timezone ?? "UTC";
}

export async function reserveGeneration(input: {
  userId: string;
  feature: GenerationFeature;
  idempotencyKey: string;
  access: ResolvedEntitlements;
}): Promise<ReserveResult> {
  const { userId, feature, idempotencyKey, access } = input;
  const timezone = await userTimezone(userId);
  const day = usageDay(timezone);
  const limit = dailyLimitForFeature(feature, access);
  const unlimited = evaluateQuota(limit, 0).kind === "unlimited";

  return db.$transaction(async (tx) => {
    // Lazily expire abandoned reservations so stale rows can never exhaust a
    // day's quota (or grow the table unboundedly).
    await tx.usageEvent.updateMany({
      where: { userId, feature, status: "reserved", periodDay: day, createdAt: { lt: reservationCutoff() } },
      data: { status: "released" },
    });

    const existing = await tx.usageEvent.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.status === "released") throw new ReservationConflictError("This reservation was already released.");
      // Replay (double-click / HTTP retry / refresh): return the true ledger
      // state for this feature/day — never an under-reported count.
      const used = await effectiveUsed(tx, userId, feature, day);
      return {
        idempotencyKey, feature, day, used,
        limit, remaining: unlimited ? -1 : Math.max(0, limit - used),
        unlimited, replayed: true,
      };
    }

    if (!unlimited) {
      // Serialize concurrent reservations for this user/feature/day by locking
      // the UsageCounter row (upsert acquires a row lock; the second writer
      // blocks until the first commits, so check-then-act cannot race).
      const key = usageKeyForFeature(feature);
      await tx.$executeRaw`
        INSERT INTO "UsageCounter" ("id", "userId", "key", "day", "count", "updatedAt")
        VALUES (${randomUUID()}, ${userId}, ${key}, ${day}, 0, ${new Date()})
        ON CONFLICT ("userId", "key", "day") DO UPDATE SET "updatedAt" = EXCLUDED."updatedAt"
      `;
      const used = await effectiveUsed(tx, userId, feature, day);
      if (used >= limit) {
        await recordAudit("QUOTA_LIMIT_REACHED", { actorUserId: userId, targetUserId: userId, metadata: { feature, day, limit } });
        throw new QuotaExceededError(limit, feature);
      }
    }

    await tx.usageEvent.create({ data: { userId, feature, idempotencyKey, units: 1, status: "reserved", periodDay: day } });
    const used = await effectiveUsed(tx, userId, feature, day);
    return {
      idempotencyKey, feature, day, used,
      limit, remaining: unlimited ? -1 : Math.max(0, limit - used),
      unlimited, replayed: false,
    };
  });
}

/** Successful generation: reserved → consumed exactly once (idempotent).
 *  Ownership is enforced by the reservation key itself (only the caller that
 *  received the key can commit it). */
export async function commitGeneration(idempotencyKey: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const event = await tx.usageEvent.findUnique({ where: { idempotencyKey } });
    if (!event || event.status === "released") {
      throw new ReservationConflictError("Cannot commit an unknown or released reservation.");
    }
    if (event.status === "consumed") return; // replay — idempotent no-op
    const key = usageKeyForFeature(event.feature as GenerationFeature);
    await tx.usageCounter.upsert({
      where: { userId_key_day: { userId: event.userId, key, day: event.periodDay } },
      create: { userId: event.userId, key, day: event.periodDay, count: event.units },
      update: { count: { increment: event.units } },
    });
    await tx.usageEvent.update({ where: { id: event.id }, data: { status: "consumed" } });
  });
}

/** Provider/network failure: reservation released, quota restored. */
export async function releaseGeneration(idempotencyKey: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const event = await tx.usageEvent.findUnique({ where: { idempotencyKey } });
    if (!event) return;
    if (event.status === "consumed") return; // too late — already consumed
    await tx.usageEvent.update({ where: { id: event.id }, data: { status: "released" } });
  });
}

async function effectiveUsed(tx: Tx, userId: string, feature: GenerationFeature, day: string): Promise<number> {
  const key = usageKeyForFeature(feature);
  const counter = await tx.usageCounter.findUnique({ where: { userId_key_day: { userId, key, day } } });
  const reserved = await tx.usageEvent.count({
    where: { userId, feature, status: "reserved", periodDay: day, createdAt: { gte: reservationCutoff() } },
  });
  return (counter?.count ?? 0) + reserved;
}

export async function getAuthoritativeUsage(userId: string, access: ResolvedEntitlements): Promise<AuthoritativeUsage> {
  const timezone = await userTimezone(userId);
  const day = usageDay(timezone);
  const [counterRows, reservedRows] = await Promise.all([
    db.usageCounter.findMany({ where: { userId, day } }),
    db.usageEvent.findMany({ where: { userId, status: "reserved", periodDay: day, createdAt: { gte: reservationCutoff() } } }),
  ]);
  const consumedBy = new Map(counterRows.map((row) => [row.key, row.count]));
  const reservedBy = new Map<string, number>();
  for (const row of reservedRows) reservedBy.set(row.feature, (reservedBy.get(row.feature) ?? 0) + row.units);

  const items: AuthoritativeUsage["items"] = {};
  for (const feature of GENERATION_FEATURES) {
    const key = usageKeyForFeature(feature);
    const consumed = consumedBy.get(key) ?? 0;
    const reserved = reservedBy.get(feature) ?? 0;
    const limit = dailyLimitForFeature(feature, access);
    const unlimited = evaluateQuota(limit, 0).kind === "unlimited";
    const used = consumed + reserved;
    items[feature] = { used, reserved, consumed, limit, remaining: unlimited ? -1 : Math.max(0, limit - used), unlimited };
  }
  return { day, items };
}
