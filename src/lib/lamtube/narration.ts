import "server-only";
import { createHash, randomUUID } from "node:crypto";
import Groq from "groq-sdk";
import { db } from "@/lib/db";
import { AIProviderError } from "@/lib/ai/errors";
import { lockAccount, ProfileError } from "@/lib/personalization/server";
import { resolveUserEntitlements } from "@/lib/subscriptions/entitlements";
import { readBoundedBytes } from "@/lib/security/request-body";
import { wavInfo } from "./wav";
import type { NarrationClip, VideoSettings } from "./model";
export const TTS_MODEL = "canopylabs/orpheus-v1-english";
export async function narration(
  userId: string,
  videoId: string,
  token: string,
  text: string,
  settings: VideoSettings,
  signal: AbortSignal
): Promise<NarrationClip> {
  const digest = createHash("sha256")
    .update(JSON.stringify([TTS_MODEL, settings.voice, text]))
    .digest("hex");
  const cached = await db.$queryRaw<
    { id: string; duration: number }[]
  >`SELECT a."id",a."duration" FROM "AIVideoAudio" a JOIN "AIVideo" v ON v."id"=a."videoId" WHERE v."userId"=${userId} AND v."id"=${videoId} AND v."deletedAt" IS NULL AND a."digest"=${digest}`;
  if (cached[0]) return { ...cached[0], text };
  const apiKey =
    process.env.GROQ_TTS_API_KEY?.trim() || process.env.GROQ_API_KEY?.trim();
  if (!apiKey)
    throw new AIProviderError(
      "Seekable narration is not configured. Configure Groq TTS; your saved lesson can be resumed and no generation credit is consumed.",
      503,
      "TTS_NOT_CONFIGURED"
    );
  if (text.length > 200)
    throw new ProfileError(
      "Narration phrase exceeds the speech provider limit.",
      422
    );
  const client = new Groq({ apiKey, timeout: 25000, maxRetries: 0 });
  let bytes: Buffer;
  try {
    const response = await client.audio.speech.create(
      {
        model: TTS_MODEL,
        voice: settings.voice,
        input: text,
        response_format: "wav",
      },
      { signal }
    );
    if (Number(response.headers.get("content-length")) > 8_000_000)
      throw new Error("Audio too large");
    bytes = Buffer.from(
      await readBoundedBytes(
        new Request("http://lamtube.local/narration", {
          method: "POST",
          headers: response.headers,
          body: response.body,
          duplex: "half",
        } as RequestInit),
        8_000_000
      )
    );
  } catch {
    throw new AIProviderError(
      "The narration provider could not finish this phrase. Retry to reuse completed work without another full-generation charge.",
      502,
      "TTS_FAILED"
    );
  }
  const info = wavInfo(bytes);
  const id = randomUUID();
  const access = await resolveUserEntitlements(userId);
  return db.$transaction(async (tx) => {
    await lockAccount(tx, userId);
    // Fence cancellation/deletion and expired workers before writing bytes.
    const owned = await tx.$queryRaw<
      { id: string }[]
    >`SELECT "id" FROM "AIVideo" WHERE "id"=${videoId} AND "userId"=${userId} AND "leaseToken"=${token} AND "leaseUntil">NOW() AND "deletedAt" IS NULL FOR UPDATE`;
    if (!owned[0])
      throw new ProfileError(
        "Generation was cancelled or ownership changed.",
        409
      );
    const existing = await tx.$queryRaw<
      { id: string; duration: number }[]
    >`SELECT "id","duration" FROM "AIVideoAudio" WHERE "videoId"=${videoId} AND "digest"=${digest}`;
    if (existing[0]) return { ...existing[0], text };
    const used = await tx.storedFile.aggregate({
      where: { userId, deletedAt: null },
      _sum: { sizeBytes: true },
    });
    if (
      (used._sum.sizeBytes ?? 0) + bytes.byteLength >
      access.storageLimitBytes
    )
      throw new ProfileError(
        "Narration exceeds your account storage allowance. Delete unused videos or files, then resume.",
        413
      );
    await tx.$executeRaw`INSERT INTO "AIVideoAudio" ("id","videoId","digest","bytes","duration") VALUES (${id},${videoId},${digest},${bytes},${info.duration})`;
    await tx.storedFile.create({
      data: {
        userId,
        clientId: `lamtube:${videoId}:${id}`,
        name: "Private LAMTube narration",
        mimeType: "audio/wav",
        sizeBytes: bytes.byteLength,
      },
    });
    return { id, duration: info.duration, text };
  });
}
