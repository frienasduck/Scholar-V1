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
import type { RenderArtifactMeta, VideoSettings, VideoState } from "./model";
import {
  devCancelVideo,
  devClaimVideo,
  devDeleteVideo,
  devInsertVideo,
  devListVideos,
  devReadAsset,
  devReadAudioBytes,
  devReadRender,
  devReadVideo,
  devReleaseLease,
  devSaveAsset,
  devSaveRender,
  devSaveVideo,
  isLocalLamtubeDevMode,
} from "./local-dev-store";

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
  if (isLocalLamtubeDevMode()) return devReadVideo(userId, id);
  const rows = await tx.$queryRaw<
    Row[]
  >`SELECT "state","revision" FROM "AIVideo" WHERE "id"=${id} AND "userId"=${userId} AND "deletedAt" IS NULL`;
  if (!rows[0])
    throw new ProfileError("This private AI video was not found.", 404);
  return decode(rows[0]);
}

export async function listVideos(userId: string) {
  if (isLocalLamtubeDevMode()) {
    return (await devListVideos(userId)).map((v) => publicVideo(v));
  }
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
  if (isLocalLamtubeDevMode()) return devInsertVideo(userId, settings, requestKey);
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
  if (isLocalLamtubeDevMode()) return devClaimVideo(userId, id);
  const token = randomUUID();
  const changed = await db.$executeRaw`UPDATE "AIVideo" SET "leaseToken"=${token},"leaseUntil"=NOW()+INTERVAL '480 seconds' WHERE "id"=${id} AND "userId"=${userId} AND "deletedAt" IS NULL AND ("leaseUntil" IS NULL OR "leaseUntil"<NOW())`;
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
  if (isLocalLamtubeDevMode()) return devSaveVideo(userId, state, token, complete);
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
  if (isLocalLamtubeDevMode()) return devReleaseLease(userId, id, token);
  await db.$executeRaw`UPDATE "AIVideo" SET "leaseToken"=NULL,"leaseUntil"=NULL WHERE "id"=${id} AND "userId"=${userId} AND "leaseToken"=${token}`;
}

export async function ensureReservation(userId: string, v: VideoState) {
  if (v.charged) return;
  if (isLocalLamtubeDevMode()) {
    v.quotaKey ??= `lamtube-dev:${v.id}`;
    return;
  }
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
  if (isLocalLamtubeDevMode()) return devDeleteVideo(userId, id);
  await db.$transaction(async (tx) => {
    await lockAccount(tx, userId);
    const v = await readVideo(userId, id, tx);
    await tx.$executeRaw`UPDATE "AIVideo" SET "deletedAt"=NOW(),"state"='{}'::jsonb,"leaseToken"=NULL,"leaseUntil"=NULL WHERE "id"=${id} AND "userId"=${userId}`;
    await tx.$executeRaw`DELETE FROM "AIVideoAudio" WHERE "videoId"=${id}`;
    await tx.$executeRaw`DELETE FROM "AIVideoRender" WHERE "videoId"=${id}`;
    await tx.$executeRaw`DELETE FROM "AIVideoAsset" WHERE "videoId"=${id}`;
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
  if (isLocalLamtubeDevMode()) return devCancelVideo(userId, id);
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
  if (isLocalLamtubeDevMode()) return;
  if (key) await releaseMonthlyUsage(userId, key);
}

export async function readAudioClipBytes(
  userId: string,
  videoId: string,
  clipId: string,
  requireReadyOrCharged = true
): Promise<Buffer> {
  if (isLocalLamtubeDevMode()) {
    return devReadAudioBytes(userId, videoId, clipId);
  }
  const rows = await db.$queryRaw<
    { bytes: Uint8Array }[]
  >`SELECT a."bytes" FROM "AIVideoAudio" a JOIN "AIVideo" v ON v."id"=a."videoId" WHERE a."id"=${clipId} AND v."id"=${videoId} AND v."userId"=${userId} AND v."deletedAt" IS NULL AND (${!requireReadyOrCharged} OR v."state"->>'status'='ready' OR v."state"->>'charged'='true')`;
  if (!rows[0]) throw new ProfileError("Private narration was not found.", 404);
  return Buffer.from(rows[0].bytes);
}

export async function saveAsset(
  userId: string,
  videoId: string,
  token: string,
  meta: { key: string; digest: string; mimeType: string; width: number; height: number; prompt: string },
  bytes: Buffer
) {
  if (isLocalLamtubeDevMode()) {
    return devSaveAsset(userId, videoId, meta.key, meta, bytes);
  }
  await db.$transaction(async (tx) => {
    await lockAccount(tx, userId);
    const owned = await tx.$queryRaw<
      { id: string }[]
    >`SELECT "id" FROM "AIVideo" WHERE "id"=${videoId} AND "userId"=${userId} AND "leaseToken"=${token} AND "leaseUntil">NOW() AND "deletedAt" IS NULL FOR UPDATE`;
    if (!owned[0]) throw new ProfileError("Generation was cancelled or ownership changed.", 409);
    await tx.$executeRaw`INSERT INTO "AIVideoAsset" ("id","videoId","assetKey","digest","bytes","mimeType","width","height","prompt") VALUES (${randomUUID()},${videoId},${meta.key},${meta.digest},${bytes},${meta.mimeType},${meta.width},${meta.height},${meta.prompt}) ON CONFLICT ("videoId","assetKey") DO UPDATE SET "digest"=EXCLUDED."digest","bytes"=EXCLUDED."bytes","width"=EXCLUDED."width","height"=EXCLUDED."height","prompt"=EXCLUDED."prompt"`;
  });
}

export async function readAsset(userId: string, videoId: string, assetKey: string) {
  if (isLocalLamtubeDevMode()) return devReadAsset(userId, videoId, assetKey);
  const rows = await db.$queryRaw<
    { assetKey: string; digest: string; mimeType: string; width: number; height: number; prompt: string; bytes: Uint8Array }[]
  >`SELECT a."assetKey",a."digest",a."mimeType",a."width",a."height",a."prompt",a."bytes" FROM "AIVideoAsset" a JOIN "AIVideo" v ON v."id"=a."videoId" WHERE v."id"=${videoId} AND v."userId"=${userId} AND v."deletedAt" IS NULL AND a."assetKey"=${assetKey}`;
  if (!rows[0]) return null;
  const r = rows[0];
  return { key: r.assetKey, digest: r.digest, mimeType: r.mimeType, width: r.width, height: r.height, prompt: r.prompt, bytes: Buffer.from(r.bytes) };
}

export async function saveRender(
  userId: string,
  videoId: string,
  token: string,
  meta: RenderArtifactMeta,
  mp4Bytes: Buffer,
  captionsVtt: string
) {
  if (isLocalLamtubeDevMode()) {
    return devSaveRender(userId, videoId, meta, mp4Bytes, captionsVtt);
  }
  await db.$transaction(async (tx) => {
    await lockAccount(tx, userId);
    const owned = await tx.$queryRaw<
      { id: string }[]
    >`SELECT "id" FROM "AIVideo" WHERE "id"=${videoId} AND "userId"=${userId} AND "leaseToken"=${token} AND "leaseUntil">NOW() AND "deletedAt" IS NULL FOR UPDATE`;
    if (!owned[0]) throw new ProfileError("Generation was cancelled or ownership changed.", 409);
    await tx.$executeRaw`DELETE FROM "AIVideoRender" WHERE "videoId"=${videoId}`;
    await tx.$executeRaw`INSERT INTO "AIVideoRender" ("id","videoId","digest","bytes","captionsVtt","width","height","fps","duration","sizeBytes","codec","mimeType") VALUES (${randomUUID()},${videoId},${meta.digest},${mp4Bytes},${captionsVtt},${meta.width},${meta.height},${meta.fps},${meta.duration},${meta.sizeBytes},${meta.codec},${meta.mimeType})`;
  });
}

export async function readRender(
  userId: string,
  videoId: string
): Promise<{ meta: RenderArtifactMeta; bytes: Buffer; captionsVtt: string } | null> {
  if (isLocalLamtubeDevMode()) return devReadRender(userId, videoId);
  const rows = await db.$queryRaw<
    { digest: string; bytes: Uint8Array; captionsVtt: string; width: number; height: number; fps: number; duration: number; sizeBytes: number; codec: string; mimeType: string; createdAt: Date }[]
  >`SELECT r."digest",r."bytes",r."captionsVtt",r."width",r."height",r."fps",r."duration",r."sizeBytes",r."codec",r."mimeType",r."createdAt" FROM "AIVideoRender" r JOIN "AIVideo" v ON v."id"=r."videoId" WHERE v."id"=${videoId} AND v."userId"=${userId} AND v."deletedAt" IS NULL ORDER BY r."createdAt" DESC LIMIT 1`;
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    meta: {
      ready: true,
      width: r.width,
      height: r.height,
      fps: r.fps,
      duration: r.duration,
      sizeBytes: r.sizeBytes,
      codec: r.codec,
      mimeType: r.mimeType,
      digest: r.digest,
      renderedAt: r.createdAt.getTime(),
    },
    bytes: Buffer.from(r.bytes),
    captionsVtt: r.captionsVtt,
  };
}
