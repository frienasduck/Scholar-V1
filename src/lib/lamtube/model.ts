import { z } from "zod";
import type { Citation } from "@/lib/resources/types";

export const VOICES = [
  "autumn",
  "diana",
  "hannah",
  "austin",
  "daniel",
  "troy",
] as const;
export const STYLES = [
  "motion-graphics",
  "whiteboard",
  "diagram",
  "exam-revision",
  "worked-example",
] as const;
const cleanText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((v) => !/[\u0000-\u0008]/.test(v), "Invalid text");
export const settingsSchema = z
  .object({
    title: cleanText(120),
    grade: z.union([z.literal(9), z.literal(11)]),
    subjectId: cleanText(60),
    chapters: z
      .array(z.object({ id: cleanText(90), title: cleanText(150) }).strict())
      .min(1)
      .max(6),
    topic: z.string().trim().max(1000).default(""),
    prompt: z.string().trim().max(2000).default(""),
    resourceIds: z.array(cleanText(150)).max(4).default([]),
    strictSources: z.boolean().default(false),
    minutes: z
      .union([
        z.literal(1),
        z.literal(3),
        z.literal(5),
        z.literal(8),
        z.literal(12),
      ])
      .default(3),
    style: z.enum(STYLES).default("motion-graphics"),
    voice: z.enum(VOICES).default("autumn"),
    depth: z.enum(["beginner", "balanced", "advanced"]).default("balanced"),
    purpose: z.enum(["learn", "revise", "exam", "solve"]).default("learn"),
    pace: z.enum(["calm", "normal", "brisk"]).default("normal"),
    aspect: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
    captions: z.boolean().default(true),
    interactive: z.boolean().default(true),
  })
  .strict()
  .refine(
    (s) => !s.strictSources || s.resourceIds.length > 0,
    "Choose at least one source for source-only teaching"
  );
export type VideoSettings = z.infer<typeof settingsSchema>;
export const palette = {
  white: "#e7efff",
  muted: "#a1b4d2",
  cyan: "#67e8f9",
  blue: "#60a5fa",
  violet: "#a78bfa",
  green: "#6ee7b7",
  amber: "#fcd34d",
  red: "#fb7185",
} as const;
const coordinate = z.number().finite().min(0).max(1000);
const point = z.object({ x: coordinate, y: coordinate }).strict();
export const elementSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/),
    kind: z.enum([
      "label",
      "equation",
      "rect",
      "circle",
      "arrow",
      "graph",
      "sketch",
      "highlight",
      "table",
    ]),
    x: coordinate,
    y: coordinate,
    w: coordinate.default(100),
    h: coordinate.default(70),
    text: z.string().max(100).default(""),
    color: z
      .enum(
        Object.keys(palette) as [
          keyof typeof palette,
          ...(keyof typeof palette)[]
        ]
      )
      .default("cyan"),
    points: z.array(point).max(80).default([]),
    rows: z.array(z.string().max(80)).max(8).default([]),
  })
  .strict();
const cue = z
  .object({
    element: z.string().max(40),
    phrase: z.number().int().min(0).max(39),
    offset: z.number().min(0).max(0.85).default(0),
    duration: z.number().min(0.05).max(1).default(0.6),
    effect: z.enum(["reveal", "draw", "move", "pulse"]).default("reveal"),
    dx: z.number().min(-800).max(800).default(0),
    dy: z.number().min(-800).max(800).default(0),
  })
  .strict();
export const scenePlanSchema = z
  .object({
    title: cleanText(100),
    chapterId: cleanText(90),
    goal: cleanText(240),
    phrases: z.array(cleanText(200)).min(2).max(40),
    elements: z.array(elementSchema).min(3).max(24),
    cues: z.array(cue).min(3).max(80),
    camera: z
      .object({
        x: z.number().min(-150).max(150),
        y: z.number().min(-150).max(150),
        zoom: z.number().min(1).max(1.2),
      })
      .strict()
      .default({ x: 0, y: 0, zoom: 1 }),
    sourceIds: z
      .array(z.string().regex(/^S\d+$/))
      .max(6)
      .default([]),
    question: z
      .object({
        prompt: cleanText(240),
        options: z.array(cleanText(160)).length(4),
        answer: z.number().int().min(0).max(3),
        explanation: cleanText(600),
      })
      .strict()
      .nullable()
      .default(null),
  })
  .strict()
  .superRefine((scene, ctx) => {
    const ids = new Set(scene.elements.map((e) => e.id));
    if (ids.size !== scene.elements.length)
      ctx.addIssue({ code: "custom", message: "Duplicate element IDs" });
    for (const c of scene.cues)
      if (!ids.has(c.element) || c.phrase >= scene.phrases.length)
        ctx.addIssue({ code: "custom", message: "Invalid cue reference" });
    if (
      !scene.elements.some(
        (e) => !["label", "equation", "table"].includes(e.kind)
      ) ||
      !scene.cues.some((c) => ["draw", "move"].includes(c.effect)) ||
      new Set(scene.cues.map((c) => c.phrase)).size < 2
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Scenes must contain evolving explanatory visuals, not text-only slides",
      });
    if (scene.phrases.join(" ").length > 4500)
      ctx.addIssue({ code: "custom", message: "Scene narration is too large" });
  });
export type ScenePlan = z.infer<typeof scenePlanSchema>;
export const outlineSchema = z
  .object({
    summary: cleanText(600),
    scenes: z
      .array(
        z
          .object({
            title: cleanText(100),
            chapterId: cleanText(90),
            goal: cleanText(240),
          })
          .strict()
      )
      .min(2)
      .max(24),
  })
  .strict();
export type Outline = z.infer<typeof outlineSchema>;
export type Source = { citation: Citation; text: string };
export type NarrationClip = { id: string; duration: number; text: string };
export type Scene = ScenePlan & {
  id: string;
  start: number;
  duration: number;
  clips: NarrationClip[];
};
export type LessonTimeline = { version: 1; duration: number; scenes: Scene[] };
export type WatchState = {
  position: number;
  favorite: boolean;
  playlists: string[];
  bookmarks: { time: number; label: string }[];
  notes: string;
  lastWatched: number | null;
};
export type VideoState = {
  id: string;
  revision: number;
  title: string;
  settings: VideoSettings;
  status: "draft" | "generating" | "ready" | "failed" | "cancelled";
  stage:
    | "sources"
    | "outline"
    | "scenes"
    | "narration"
    | "assemble"
    | "complete";
  sources: Source[];
  outline: Outline | null;
  plans: ScenePlan[];
  clips: NarrationClip[][];
  timeline: LessonTimeline | null;
  quotaKey: string | null;
  charged: boolean;
  error: string | null;
  /** Persisted cooldown; old lessons without this field remain compatible. */
  retryAt?: number | null;
  createdAt: number;
  updatedAt: number;
  watch: WatchState;
  provider: string;
  insights: {
    id: string;
    time: number;
    action: string;
    question: string;
    text: string;
    citationIds: string[];
    createdAt: number;
  }[];
  repair: {
    kind: "voice" | "scene";
    scene?: number;
    previousTimeline: LessonTimeline;
  } | null;
};
export function initialVideo(
  id: string,
  settings: VideoSettings,
  now = Date.now()
): VideoState {
  return {
    id,
    revision: 0,
    title: settings.title,
    settings,
    status: "draft",
    stage: "sources",
    sources: [],
    outline: null,
    plans: [],
    clips: [],
    timeline: null,
    quotaKey: null,
    charged: false,
    error: null,
    createdAt: now,
    updatedAt: now,
    watch: {
      position: 0,
      favorite: false,
      playlists: [],
      bookmarks: [],
      notes: "",
      lastWatched: null,
    },
    provider: "Scholar configured AI / generated speech narration",
    insights: [],
    repair: null,
  };
}
export function assembleTimeline(
  plans: ScenePlan[],
  clips: NarrationClip[][]
): LessonTimeline {
  let start = 0;
  const scenes = plans.map((plan, i) => {
    if (
      !clips[i] ||
      clips[i].length !== plan.phrases.length ||
      clips[i].some((c) => !Number.isFinite(c.duration) || c.duration <= 0)
    )
      throw new Error("Narration is incomplete");
    const duration = clips[i].reduce((sum, c) => sum + c.duration, 0);
    const scene = {
      ...plan,
      id: `scene-${i}`,
      start,
      duration,
      clips: clips[i],
    };
    start += duration;
    return scene;
  });
  if (!scenes.length || start > 1800)
    throw new Error("Invalid lesson duration");
  return { version: 1, scenes, duration: start };
}
export function generationProgress(v: VideoState) {
  if (v.status === "ready") return 100;
  if (v.stage === "sources") return 2;
  if (v.stage === "outline") return 8;
  const total = v.outline?.scenes.length || 1;
  if (v.stage === "scenes")
    return 15 + Math.floor((30 * v.plans.length) / total);
  if (v.stage === "narration")
    return (
      45 +
      Math.floor(
        (50 * v.clips.flat().length) /
          Math.max(
            1,
            v.plans.reduce((n, p) => n + p.phrases.length, 0)
          )
      )
    );
  return 98;
}
