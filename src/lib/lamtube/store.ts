import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ProfileError, lockAccount } from "@/lib/personalization/server";
import {
  commitMonthlyUsage,
  releaseMonthlyUsage,
  reserveMonthlyUsage,
} from "@/lib/subscriptions/monthly-usage";
import { resolveUserEntitlements } from "@/lib/subscriptions/entitlements";
import { usageMonth } from "@/lib/subscriptions/usage-month";
import { initialVideo } from "./model";
import type { VideoSettings, VideoState } from "./model";
type Row = { state: Prisma.JsonValue; revision: number };
const decode = (row: Row): VideoState => ({
  ...((row.state as unknown) as VideoState),
  revision: row.revision,
});
export function publicVideo(v: VideoState): VideoState {
  return {
    ...v,
    quotaKey: null,
    sources: v.sources.map((s) => ({ citation: s.citation, text: "" })),
  };
}
export async function readVideo(
  userId: string,
  id: string,
  tx: Prisma.TransactionClient = db
) {
  const rows = await tx.$queryRaw<
    Row[]
  >`SELECT "state","revision" FROM "AIVideo" WHERE "id"=${id} AND "userId"=${userId} AND "deletedAt" IS NULL`;
  if (!rows[0])
    throw new ProfileError("This private AI video was not found.", 404);
  return decode(rows[0]);
}
export async function listVideos(userId: string) {
  const rows = await db.$queryRaw<
    Row[]
  >`SELECT "state","revision" FROM "AIVideo" WHERE "userId"=${userId} AND "deletedAt" IS NULL ORDER BY "createdAt" DESC LIMIT 100`;
  return rows.map((r) => publicVideo(decode(r)));
}
export async function insertVideo(
  userId: string,
  settings: VideoSettings,
  requestKey: string
) {
  return db.$transaction(async (tx) => {
    await lockAccount(tx, userId);
    const replay = await tx.$queryRaw<
      Row[]
    >`SELECT "state","revision" FROM "AIVideo" WHERE "userId"=${userId} AND "requestKey"=${`${userId}:${requestKey}`} AND "deletedAt" IS NULL`;
    if (replay[0]) return decode(replay[0]);
    const pending = await tx.$queryRaw<
      { count: bigint }[]
    >`SELECT COUNT(*) AS count FROM "AIVideo" WHERE "userId"=${userId} AND "deletedAt" IS NULL AND "state"->>'status' IN ('generating','draft')`;
    if (Number(pending[0]?.count) >= 5)
      throw new ProfileError(
        "Finish or delete an unfinished draft before creating another (5 active drafts maximum).",
        409
      );
    const video = initialVideo(randomUUID(), settings);
    await tx.$executeRaw`INSERT INTO "AIVideo" ("id","userId","requestKey","state") VALUES (${
      video.id
    },${userId},${`${userId}:${requestKey}`},${JSON.stringify(video)}::jsonb)`;
    return video;
  });
}
export async function claimVideo(userId: string, id: string) {
  const token = randomUUID();
  const changed = await db.$executeRaw`UPDATE "AIVideo" SET "leaseToken"=${token},"leaseUntil"=NOW()+INTERVAL '65 seconds' WHERE "id"=${id} AND "userId"=${userId} AND "deletedAt" IS NULL AND ("leaseUntil" IS NULL OR "leaseUntil"<NOW())`;
  if (changed !== 1)
    throw new ProfileError(
      "This video is already processing. Wait a moment, then refresh its progress.",
      409
    );
  return token;
}
export async function saveVideo(
  userId: string,
  state: VideoState,
  token: string,
  complete = false
) {
  const next = {
    ...state,
    charged: state.charged || complete,
    revision: state.revision + 1,
    updatedAt: Date.now(),
  };
  if (JSON.stringify(next).length > 1_500_000)
    throw new ProfileError(
      "This lesson exceeds its storage safety limit.",
      413
    );
  await db.$transaction(async (tx) => {
    const changed = await tx.$executeRaw`UPDATE "AIVideo" SET "state"=${JSON.stringify(
      next
    )}::jsonb,"revision"="revision"+1,"leaseToken"=NULL,"leaseUntil"=NULL,"updatedAt"=NOW() WHERE "id"=${
      state.id
    } AND "userId"=${userId} AND "revision"=${
      state.revision
    } AND "leaseToken"=${token} AND "leaseUntil">NOW() AND "deletedAt" IS NULL`;
    if (changed !== 1)
      throw new ProfileError(
        "Generation ownership changed. Reload this video to resume safely.",
        409
      );
    if (complete && !state.charged) {
      if (!state.quotaKey) throw new Error("Missing quota reservation");
      await commitMonthlyUsage(userId, state.quotaKey, tx);
    }
    if (["failed", "cancelled"].includes(state.status) && state.quotaKey)
      await tx.usageEvent.updateMany({
        where: { userId, idempotencyKey: state.quotaKey, status: "reserved" },
        data: { status: "released" },
      });
  });
  return next;
}
export async function releaseLease(userId: string, id: string, token: string) {
  await db.$executeRaw`UPDATE "AIVideo" SET "leaseToken"=NULL,"leaseUntil"=NULL WHERE "id"=${id} AND "userId"=${userId} AND "leaseToken"=${token}`;
}
export async function ensureReservation(userId: string, v: VideoState) {
  if (v.charged) return;
  if (v.quotaKey) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const kept = await db.usageEvent.updateMany({
      where: {
        userId,
        idempotencyKey: v.quotaKey,
        status: "reserved",
        periodDay: usageMonth(user?.timezone ?? "Asia/Kolkata"),
        createdAt: { gte: new Date(Date.now() - 15 * 60000) },
      },
      data: { createdAt: new Date() },
    });
    if (kept.count) return;
    await releaseMonthlyUsage(userId, v.quotaKey);
  }
  const key = `lamtube:${v.id}:${randomUUID()}`;
  await reserveMonthlyUsage({
    userId,
    feature: "ai_video_generation",
    idempotencyKey: key,
    access: await resolveUserEntitlements(userId),
  });
  v.quotaKey = key;
}
export async function deleteVideo(userId: string, id: string) {
  await db.$transaction(async (tx) => {
    await lockAccount(tx, userId);
    const v = await readVideo(userId, id, tx);
    await tx.$executeRaw`UPDATE "AIVideo" SET "deletedAt"=NOW(),"state"='{}'::jsonb,"leaseToken"=NULL,"leaseUntil"=NULL WHERE "id"=${id} AND "userId"=${userId}`;
    await tx.$executeRaw`DELETE FROM "AIVideoAudio" WHERE "videoId"=${id}`;
    await tx.storedFile.updateMany({
      where: {
        userId,
        clientId: { startsWith: `lamtube:${id}:` },
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });
    if (v.quotaKey)
      await tx.usageEvent.updateMany({
        where: { userId, idempotencyKey: v.quotaKey, status: "reserved" },
        data: { status: "released" },
      });
  });
}
export async function cancelVideo(userId: string, id: string) {
  // Cancellation fences a running worker immediately; its stale token cannot publish.
  return db.$transaction(async (tx) => {
    await lockAccount(tx, userId);
    const rows = await tx.$queryRaw<
      Row[]
    >`SELECT "state","revision" FROM "AIVideo" WHERE "id"=${id} AND "userId"=${userId} AND "deletedAt" IS NULL FOR UPDATE`;
    if (!rows[0])
      throw new ProfileError("This private AI video was not found.", 404);
    const v = decode(rows[0]);
    if (v.status === "ready" && !v.repair) return v;
    if (v.quotaKey)
      await tx.usageEvent.updateMany({
        where: { userId, idempotencyKey: v.quotaKey, status: "reserved" },
        data: { status: "released" },
      });
    v.status = v.repair ? "ready" : "cancelled";
    v.timeline = v.repair?.previousTimeline ?? v.timeline;
    v.repair = null;
    const next = { ...v, revision: v.revision + 1, updatedAt: Date.now() };
    await tx.$executeRaw`UPDATE "AIVideo" SET "state"=${JSON.stringify(
      next
    )}::jsonb,"revision"="revision"+1,"leaseToken"=NULL,"leaseUntil"=NULL,"updatedAt"=NOW() WHERE "id"=${id} AND "userId"=${userId} AND "deletedAt" IS NULL`;
    return next;
  });
}
export async function refundOrphan(userId: string, key: string | null) {
  if (key) await releaseMonthlyUsage(userId, key);
}
