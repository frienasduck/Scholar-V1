import "server-only";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { localGuestEnabled, localGuestRequest } from "@/lib/exam-ready/dev-guest-policy";
import { ProfileError } from "@/lib/personalization/server";
import { initialVideo } from "./model";
import type { RenderArtifactMeta, VideoSettings, VideoState } from "./model";

const ROOT = path.join(process.cwd(), ".next", "lamtube-dev-store");
const LEASE_MS = 480_000;

type LocalVideoRecord = {
  id: string;
  userId: string;
  requestKey: string;
  leaseToken: string | null;
  leaseUntil: number | null;
  deleted: boolean;
  state: VideoState;
};

type LocalAudioMeta = {
  id: string;
  videoId: string;
  digest: string;
  duration: number;
};

type LocalAssetMeta = {
  key: string;
  digest: string;
  mimeType: string;
  width: number;
  height: number;
  prompt: string;
};

/** Strictly isolated loopback-only local dev storage when DB_DATABASE_URL is absent. */
export function isLocalLamtubeDevMode(): boolean {
  return localGuestEnabled(process.env) && !process.env.DB_DATABASE_URL?.trim();
}

export function isAuthorizedLocalLamtubeRequest(request: Request): boolean {
  return isLocalLamtubeDevMode() && localGuestRequest(request, process.env);
}

export function resolveLocalDevUserId(request: Request): string {
  const header = request.headers.get("x-scholar-dev-user")?.trim();
  if (header && /^[a-zA-Z0-9_-]{3,40}$/.test(header)) return header;
  const cookieHeader = request.headers.get("cookie") || "";
  const match = /(?:^|;\s*)scholar_dev_user=([a-zA-Z0-9_-]{3,40})/.exec(cookieHeader);
  return match ? match[1] : "dev-guest-user";
}

function safeSeg(v: string): string {
  return v.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

function videoPath(userId: string, id: string) {
  return path.join(ROOT, "videos", safeSeg(userId), `${safeSeg(id)}.json`);
}

async function readRecord(userId: string, id: string): Promise<LocalVideoRecord> {
  try {
    const raw = await fs.readFile(videoPath(userId, id), "utf8");
    const rec = JSON.parse(raw) as LocalVideoRecord;
    if (rec.deleted || rec.userId !== userId) {
      throw new ProfileError("This private AI video was not found.", 404);
    }
    return rec;
  } catch (err) {
    if (err instanceof ProfileError) throw err;
    throw new ProfileError("This private AI video was not found.", 404);
  }
}

async function writeRecord(rec: LocalVideoRecord) {
  const target = videoPath(rec.userId, rec.id);
  await ensureDir(path.dirname(target));
  const tmp = `${target}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(rec), "utf8");
  await fs.rename(tmp, target);
}

async function listRecords(userId: string): Promise<LocalVideoRecord[]> {
  const dir = path.join(ROOT, "videos", safeSeg(userId));
  try {
    const files = await fs.readdir(dir);
    const out: LocalVideoRecord[] = [];
    for (const f of files) {
      if (!f.endsWith(".json") || f.endsWith(".tmp")) continue;
      try {
        const rec = JSON.parse(await fs.readFile(path.join(dir, f), "utf8")) as LocalVideoRecord;
        if (!rec.deleted && rec.userId === userId) out.push(rec);
      } catch {
        // ignore corrupt temp
      }
    }
    return out.sort((a, b) => b.state.createdAt - a.state.createdAt);
  } catch {
    return [];
  }
}

export async function devReadVideo(userId: string, id: string): Promise<VideoState> {
  return (await readRecord(userId, id)).state;
}

export async function devListVideos(userId: string): Promise<VideoState[]> {
  return (await listRecords(userId)).map((r) => r.state);
}

export async function devUsage(userId: string) {
  const records = await listRecords(userId);
  const used = records.filter((r) => r.state.charged).length;
  const limit = 10;
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    period: new Date().toISOString().slice(0, 7),
    timezone: "Asia/Kolkata",
  };
}

export async function devInsertVideo(userId: string, settings: VideoSettings, requestKey: string) {
  const all = await listRecords(userId);
  const fullKey = `${userId}:${requestKey}`;
  const replay = all.find((r) => r.requestKey === fullKey);
  if (replay) return replay.state;
  const pending = all.filter((r) => ["generating", "draft"].includes(r.state.status));
  if (pending.length >= 5) {
    throw new ProfileError(
      "Finish or delete an unfinished draft before creating another (5 active drafts maximum).",
      409
    );
  }
  const video = initialVideo(randomUUID(), settings);
  await writeRecord({
    id: video.id,
    userId,
    requestKey: fullKey,
    leaseToken: null,
    leaseUntil: null,
    deleted: false,
    state: video,
  });
  return video;
}

export async function devClaimVideo(userId: string, id: string): Promise<string> {
  const rec = await readRecord(userId, id);
  const now = Date.now();
  if (rec.leaseUntil && rec.leaseUntil > now) {
    throw new ProfileError("This video is already processing. Wait a moment, then refresh its progress.", 409);
  }
  const token = randomUUID();
  rec.leaseToken = token;
  rec.leaseUntil = now + LEASE_MS;
  await writeRecord(rec);
  return token;
}

export async function devSaveVideo(
  userId: string,
  state: VideoState,
  token: string,
  complete = false
): Promise<VideoState> {
  const rec = await readRecord(userId, state.id);
  const now = Date.now();
  if (
    rec.state.revision !== state.revision ||
    rec.leaseToken !== token ||
    !rec.leaseUntil ||
    rec.leaseUntil <= now
  ) {
    throw new ProfileError("Generation ownership changed. Reload this video to resume safely.", 409);
  }
  const next: VideoState = {
    ...state,
    charged: state.charged || complete,
    revision: state.revision + 1,
    updatedAt: now,
  };
  rec.state = next;
  rec.leaseToken = null;
  rec.leaseUntil = null;
  await writeRecord(rec);
  return next;
}

export async function devReleaseLease(userId: string, id: string, token: string) {
  try {
    const rec = await readRecord(userId, id);
    if (rec.leaseToken === token) {
      rec.leaseToken = null;
      rec.leaseUntil = null;
      await writeRecord(rec);
    }
  } catch {
    // ignore missing
  }
}

export async function devCancelVideo(userId: string, id: string): Promise<VideoState> {
  const rec = await readRecord(userId, id);
  const v = rec.state;
  if (v.status === "ready" && !v.repair) return v;
  const next: VideoState = {
    ...v,
    status: v.repair ? "ready" : "cancelled",
    timeline: v.repair?.previousTimeline ?? v.timeline,
    repair: null,
    revision: v.revision + 1,
    updatedAt: Date.now(),
  };
  rec.state = next;
  rec.leaseToken = null;
  rec.leaseUntil = null;
  await writeRecord(rec);
  return next;
}

export async function devDeleteVideo(userId: string, id: string) {
  const rec = await readRecord(userId, id);
  rec.deleted = true;
  rec.leaseToken = null;
  rec.leaseUntil = null;
  await writeRecord(rec);
  await fs.rm(path.join(ROOT, "audio", safeSeg(id)), { recursive: true, force: true }).catch(() => {});
  await fs.rm(path.join(ROOT, "assets", safeSeg(id)), { recursive: true, force: true }).catch(() => {});
  await fs.rm(path.join(ROOT, "renders", safeSeg(id)), { recursive: true, force: true }).catch(() => {});
}

export async function devFindCachedAudio(userId: string, videoId: string, digest: string): Promise<LocalAudioMeta | null> {
  await readRecord(userId, videoId);
  const dir = path.join(ROOT, "audio", safeSeg(videoId));
  try {
    const files = await fs.readdir(dir);
    for (const f of files) {
      if (!f.endsWith(".meta.json")) continue;
      const meta = JSON.parse(await fs.readFile(path.join(dir, f), "utf8")) as LocalAudioMeta;
      if (meta.digest === digest) return meta;
    }
  } catch {
    return null;
  }
  return null;
}

export async function devSaveAudioClip(
  userId: string,
  videoId: string,
  token: string,
  digest: string,
  bytes: Buffer,
  duration: number
): Promise<string> {
  const rec = await readRecord(userId, videoId);
  if (rec.leaseToken !== token || !rec.leaseUntil || rec.leaseUntil <= Date.now()) {
    throw new ProfileError("Generation was cancelled or ownership changed.", 409);
  }
  const id = randomUUID();
  const dir = path.join(ROOT, "audio", safeSeg(videoId));
  await ensureDir(dir);
  await fs.writeFile(path.join(dir, `${id}.wav`), bytes);
  await fs.writeFile(
    path.join(dir, `${id}.meta.json`),
    JSON.stringify({ id, videoId, digest, duration } satisfies LocalAudioMeta),
    "utf8"
  );
  return id;
}

export async function devReadAudioBytes(userId: string, videoId: string, clipId: string): Promise<Buffer> {
  await readRecord(userId, videoId);
  const p = path.join(ROOT, "audio", safeSeg(videoId), `${safeSeg(clipId)}.wav`);
  try {
    return await fs.readFile(p);
  } catch {
    throw new ProfileError("Private narration was not found.", 404);
  }
}

export async function devSaveAsset(
  userId: string,
  videoId: string,
  assetKey: string,
  meta: LocalAssetMeta,
  bytes: Buffer
) {
  await readRecord(userId, videoId);
  const dir = path.join(ROOT, "assets", safeSeg(videoId));
  await ensureDir(dir);
  await fs.writeFile(path.join(dir, `${safeSeg(assetKey)}.bin`), bytes);
  await fs.writeFile(path.join(dir, `${safeSeg(assetKey)}.meta.json`), JSON.stringify(meta), "utf8");
}

export async function devReadAsset(
  userId: string,
  videoId: string,
  assetKey: string
): Promise<(LocalAssetMeta & { bytes: Buffer }) | null> {
  await readRecord(userId, videoId);
  const dir = path.join(ROOT, "assets", safeSeg(videoId));
  try {
    const meta = JSON.parse(await fs.readFile(path.join(dir, `${safeSeg(assetKey)}.meta.json`), "utf8")) as LocalAssetMeta;
    const bytes = await fs.readFile(path.join(dir, `${safeSeg(assetKey)}.bin`));
    return { ...meta, bytes };
  } catch {
    return null;
  }
}

export async function devSaveRender(
  userId: string,
  videoId: string,
  meta: RenderArtifactMeta,
  mp4Bytes: Buffer,
  captionsVtt: string
) {
  await readRecord(userId, videoId);
  const dir = path.join(ROOT, "renders", safeSeg(videoId));
  await ensureDir(dir);
  await fs.writeFile(path.join(dir, "video.mp4"), mp4Bytes);
  await fs.writeFile(path.join(dir, "captions.vtt"), captionsVtt, "utf8");
  await fs.writeFile(path.join(dir, "meta.json"), JSON.stringify(meta), "utf8");
}

export async function devReadRender(
  userId: string,
  videoId: string
): Promise<{ meta: RenderArtifactMeta; bytes: Buffer; captionsVtt: string } | null> {
  await readRecord(userId, videoId);
  const dir = path.join(ROOT, "renders", safeSeg(videoId));
  try {
    const meta = JSON.parse(await fs.readFile(path.join(dir, "meta.json"), "utf8")) as RenderArtifactMeta;
    const bytes = await fs.readFile(path.join(dir, "video.mp4"));
    const captionsVtt = await fs.readFile(path.join(dir, "captions.vtt"), "utf8");
    return { meta, bytes, captionsVtt };
  } catch {
    return null;
  }
}
