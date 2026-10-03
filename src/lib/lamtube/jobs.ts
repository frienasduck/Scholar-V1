import "server-only";
import { ProfileError, checkGrade } from "@/lib/personalization/server";
import { claimVideo, readVideo, saveVideo, releaseLease, ensureReservation } from "./store";
import { processVideo } from "./generate";
import { RateLimitError } from "@/lib/security/rate-limit";

/** A resume ping never restarts a cancelled/failed job. Only an explicit retry can. */
export async function queueVideo(userId: string, id: string, retry = false) {
  const current = await readVideo(userId, id);
  if (current.status === "ready" || current.status === "generating") return current;
  if (["failed", "cancelled"].includes(current.status) && !retry) return current;
  await checkGrade(userId, current.settings.grade);
  const token = await claimVideo(userId, id);
  let saved = false;
  try {
    const video = await readVideo(userId, id);
    // Re-read under the lease: cancellation or completion may have raced the request.
    if (video.status === "ready" || (["failed", "cancelled"].includes(video.status) && !retry)) return video;
    await ensureReservation(userId, video);
    video.status = "generating";
    video.error = null;
    video.retryAt = null;
    const next = await saveVideo(userId, video, token);
    saved = true;
    return next;
  } finally {
    if (!saved) await releaseLease(userId, id, token);
  }
}

/** Bounded server work survives UI navigation. A later app heartbeat resumes saved stages. */
export async function runVideoBatch(userId: string, id: string, budgetMs = 45000) {
  const deadline = Date.now() + budgetMs;
  for (let step = 0; step < 80 && Date.now() < deadline - 1000; step++) {
    try {
      const video = await readVideo(userId, id);
      if (video.status !== "generating" || (video.retryAt && video.retryAt > Date.now())) return;
      // Do not start an AI/TTS call with only a few seconds left in this batch.
      if (["outline", "scenes", "narration"].includes(video.stage) && deadline - Date.now() < 28000) return;
      await processVideo(userId, id, Math.min(48000, deadline - Date.now()));
    } catch (error) {
      // A competing tab/worker owns the lease, or a stage already persisted its failure.
      if (!(error instanceof ProfileError && error.status === 409) && !(error instanceof RateLimitError))
        console.warn("[LAMTube] background batch stopped", { videoId: id });
      return;
    }
  }
}
