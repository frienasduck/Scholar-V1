import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { completeJSON } from "@/lib/ai/structured";
import { checkGrade, ProfileError } from "@/lib/personalization/server";
import { settingsSchema, VOICES } from "./model";
import type { VideoState } from "./model";
import {
  claimVideo,
  readVideo,
  saveVideo,
  releaseLease,
  insertVideo,
  cancelVideo,
} from "./store";
import { processVideo, teachingPolicy } from "./generate";
import { contextAt, clamp } from "./timeline";
import { validateSettings } from "./settings";
export const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }).strict(),
  z.object({ action: z.literal("step") }).strict(),
  z.object({ action: z.literal("retry") }).strict(),
  z.object({ action: z.literal("cancel") }).strict(),
  z
    .object({ action: z.literal("duplicate"), requestKey: z.string().uuid() })
    .strict(),
  z.object({ action: z.literal("voice"), voice: z.enum(VOICES) }).strict(),
  z
    .object({
      action: z.literal("scene"),
      scene: z.number().int().min(0).max(23),
      instruction: z.string().trim().max(1000),
    })
    .strict(),
  z
    .object({
      action: z.literal("edit"),
      title: z.string().trim().min(1).max(120).optional(),
      settings: settingsSchema.optional(),
      watch: z
        .object({
          position: z.number().finite().min(0).max(1800).optional(),
          favorite: z.boolean().optional(),
          playlists: z
            .array(z.string().trim().min(1).max(60))
            .max(12)
            .optional(),
          bookmarks: z
            .array(
              z
                .object({
                  time: z.number().finite().min(0).max(1800),
                  label: z.string().trim().min(1).max(160),
                })
                .strict()
            )
            .max(100)
            .optional(),
          notes: z.string().max(20000).optional(),
        })
        .strict()
        .optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("ask"),
      time: z.number().finite().min(0).max(1800),
      mode: z.enum(["ask", "simpler", "example", "quiz", "notes"]),
      question: z.string().trim().max(2000),
    })
    .strict(),
]);
export type VideoAction = z.infer<typeof actionSchema>;
export async function act(userId: string, id: string, action: VideoAction) {
  if (action.action === "start") {
    const { queueVideo } = await import("./jobs");
    return queueVideo(userId, id);
  }
  if (action.action === "cancel") return cancelVideo(userId, id);
  if (action.action === "step" || action.action === "retry") {
    const v = await readVideo(userId, id);
    if (action.action === "step" && ["cancelled", "failed"].includes(v.status))
      return v;
    if (v.status === "cancelled" || v.status === "failed") {
      const token = await claimVideo(userId, id);
      try {
        const fresh = await readVideo(userId, id);
        fresh.status = "draft";
        await saveVideo(userId, fresh, token);
      } finally {
        await releaseLease(userId, id, token);
      }
    }
    return processVideo(userId, id);
  }
  if (action.action === "duplicate") {
    const v = await readVideo(userId, id);
    return insertVideo(
      userId,
      { ...v.settings, title: `${v.title.slice(0, 109)} (copy)` },
      action.requestKey
    );
  }
  const token = await claimVideo(userId, id);
  try {
    const v = await readVideo(userId, id);
    if (action.action === "edit") {
      if (action.title) v.title = action.title;
      if (action.settings) {
        if (v.status !== "draft" || v.outline)
          throw new ProfileError(
            "Full settings can only change before generation. Duplicate this lesson for a different topic or style.",
            409
          );
        v.settings = await validateSettings(userId, action.settings);
        v.title = v.settings.title;
      }
      if (action.watch) {
        v.watch = {
          ...v.watch,
          ...action.watch,
          position: clamp(
            action.watch.position ?? v.watch.position,
            0,
            v.timeline?.duration ?? 0
          ),
        };
        if (action.watch.position !== undefined)
          v.watch.lastWatched = Date.now();
      }
    } else if (action.action === "voice" || action.action === "scene") {
      if (v.status !== "ready" || !v.timeline)
        throw new ProfileError(
          "Complete the lesson before editing narration or a scene.",
          409
        );
      v.repair = {
        kind: action.action,
        previousTimeline: v.timeline,
        ...(action.action === "scene" ? { scene: action.scene } : {}),
      };
      v.status = "draft";
      v.error = null;
      if (action.action === "voice") {
        v.settings.voice = action.voice;
        v.clips = [];
        v.stage = "narration";
      } else {
        if (!v.plans[action.scene])
          throw new ProfileError("Scene not found.", 404);
        v.settings.prompt = `Scene refinement: ${action.instruction}`;
        v.stage = "scenes";
      }
    } else if (action.action === "ask") {
      await checkGrade(userId, v.settings.grade);
      if (!v.timeline || v.status !== "ready")
        throw new ProfileError(
          "Wait for the playable lesson before asking about a moment.",
          409
        );
      const context = contextAt(v.timeline, action.time);
      const digest = createHash("sha256")
        .update(JSON.stringify([context, action.mode, action.question]))
        .digest("hex");
      const existing = v.insights.find((x) => x.id === digest);
      if (existing) return { video: v, insight: existing };
      const schema = z
        .object({
          text: z
            .string()
            .min(1)
            .max(12000)
            .refine(
              (text) => !/!\[|<(?:img|iframe|svg)\b/i.test(text),
              "Tutor answers cannot embed external media"
            ),
          citationIds: z.array(z.string().regex(/^S\d+$/)).max(12),
        })
        .strict();
      const answer = schema.parse(
        await completeJSON(
          userId,
          `${teachingPolicy(v)}
Explain the CURRENT VIDEO MOMENT, not a generic chapter answer. Use plain Markdown with dollar-delimited equations only, not entire paragraphs. Mode: ${
            action.mode
          }; notes: produce revision notes; quiz: ask one attempt-first question; simpler: different simple analogy; example: a different verified worked example. Do not claim official questions. If source-only, stay within source passages; do not invent examples. Answer JSON {text,citationIds}.
CURRENT_MOMENT_DATA ${JSON.stringify(context)}
STUDENT_QUESTION_DATA ${JSON.stringify(action.question)}`,
          AbortSignal.timeout(48000)
        )
      );
      if (
        answer.citationIds.some(
          (s) => !v.sources.some((c) => c.citation.id === s)
        )
      )
        throw new ProfileError(
          "The tutor returned an unsupported citation. Retry this answer.",
          422
        );
      const insight = {
        ...answer,
        id: digest,
        time: context.time,
        action: action.mode,
        question: action.question,
        createdAt: Date.now(),
      };
      v.insights = [...v.insights.slice(-29), insight];
      const updated = await saveVideo(userId, v, token);
      return { video: updated, insight };
    }
    // Keep the lease until the asynchronous write has committed; finally would
    // otherwise release it before saveVideo's ownership check completes.
    return await saveVideo(userId, v, token);
  } finally {
    await releaseLease(userId, id, token);
  }
}
export function isInsightResult(
  value:
    | VideoState
    | { video: VideoState; insight: VideoState["insights"][number] }
): value is { video: VideoState; insight: VideoState["insights"][number] } {
  return "video" in value;
}
