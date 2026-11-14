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
export const ACADEMIC_LEVELS = [
  "class-8",
  "class-9",
  "class-10",
  "class-11",
  "class-12",
] as const;
export const LANGUAGES = ["en", "hi-en"] as const;
export type AcademicLevel = (typeof ACADEMIC_LEVELS)[number];
export type VideoLanguage = (typeof LANGUAGES)[number];

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
    academicLevel: z.enum(ACADEMIC_LEVELS).optional(),
    language: z.enum(LANGUAGES).optional(),
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
const plotPoint = z
  .object({ x: z.number().finite(), y: z.number().finite() })
  .strict();
export const elementSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/),
    kind: z.enum([
      "label",
      "equation",
      "latex",
      "rect",
      "circle",
      "arrow",
      "graph",
      "plot",
      "sketch",
      "highlight",
      "table",
      "atom",
      "illustration",
    ]),
    x: coordinate,
    y: coordinate,
    // Arrows use a signed displacement, not a CSS box size.
    w: z.number().finite().min(-1000).max(1000).default(100),
    h: z.number().finite().min(-1000).max(1000).default(70),
    text: z.string().max(120).default(""),
    latex: z.string().max(320).optional(),
    expr: z.string().max(120).optional(),
    axisX: z.string().max(40).optional(),
    axisY: z.string().max(40).optional(),
    xRange: z.tuple([z.number().finite(), z.number().finite()]).optional(),
    yRange: z.tuple([z.number().finite(), z.number().finite()]).optional(),
    curve: z.array(plotPoint).max(120).optional(),
    protons: z.number().int().min(1).max(36).optional(),
    shells: z.array(z.number().int().min(0).max(18)).max(5).optional(),
    charge: z.string().max(12).optional(),
    symbol: z.string().max(8).optional(),
    assetKey: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/).optional(),
    illustrationPrompt: z.string().max(400).optional(),
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
  .strict()
  .superRefine((element, ctx) => {
    if (element.kind !== "arrow" && (element.w < 0 || element.h < 0))
      ctx.addIssue({ code: "custom", message: "Only arrows can have signed dimensions" });
  });
const cue = z
  .object({
    element: z.string().max(40),
    phrase: z.number().int().min(0).max(39),
    offset: z.number().min(0).max(0.85).default(0),
    duration: z.number().min(0.05).max(1).default(0.6),
    effect: z
      .enum([
        "reveal",
        "draw",
        "move",
        "pulse",
        "followPath",
        "orbit",
        "highlight",
        "scaleVector",
      ])
      .default("reveal"),
    dx: z.number().min(-800).max(800).default(0),
    dy: z.number().min(-800).max(800).default(0),
    target: z.string().max(40).optional(),
    scaleX: z.number().finite().min(0.1).max(4).optional(),
    scaleY: z.number().finite().min(0.1).max(4).optional(),
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
    keyTakeaway: z.string().trim().max(180).optional(),
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
    for (const c of scene.cues) {
      if (!ids.has(c.element) || c.phrase >= scene.phrases.length)
        ctx.addIssue({ code: "custom", message: "Invalid cue reference" });
      if (c.target && !ids.has(c.target))
        ctx.addIssue({ code: "custom", message: "Invalid cue target reference" });
    }
    if (
      !scene.elements.some(
        (e) => !["label", "equation", "latex", "table"].includes(e.kind)
      ) ||
      !scene.cues.some((c) =>
        ["draw", "move", "followPath", "orbit", "scaleVector"].includes(c.effect)
      ) ||
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
export type RenderArtifactMeta = {
  ready: boolean;
  width: number;
  height: number;
  fps: number;
  duration: number;
  sizeBytes: number;
  codec: string;
  mimeType: string;
  digest: string;
  renderedAt: number;
};

export type AssetArtifactMeta = {
  key: string;
  prompt: string;
  mimeType: string;
  width: number;
  height: number;
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
    | "illustrations"
    | "narration"
    | "assemble"
    | "render"
    | "complete";
  sources: Source[];
  outline: Outline | null;
  plans: ScenePlan[];
  clips: NarrationClip[][];
  timeline: LessonTimeline | null;
  assets?: AssetArtifactMeta[];
  render?: RenderArtifactMeta | null;
  renderProgress?: number;
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
    assets: [],
    render: null,
    renderProgress: 0,
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
  if (v.status === "ready" || v.stage === "complete") return 100;
  if (v.stage === "sources") return 3;
  if (v.stage === "outline") return 10;
  const total = v.outline?.scenes.length || 1;
  if (v.stage === "scenes")
    return 15 + Math.floor((25 * v.plans.length) / total);
  if (v.stage === "illustrations") {
    const requested = v.plans.filter((p) =>
      p.elements.some((e) => e.kind === "illustration" && e.assetKey)
    ).length;
    if (!requested) return 48;
    const done = v.assets?.length ?? 0;
    return 40 + Math.floor((12 * Math.min(requested, done)) / requested);
  }
  if (v.stage === "narration")
    return (
      52 +
      Math.floor(
        (28 * v.clips.flat().length) /
          Math.max(
            1,
            v.plans.reduce((n, p) => n + p.phrases.length, 0)
          )
      )
    );
  if (v.stage === "assemble") return 82;
  if (v.stage === "render") {
    const pct = Math.max(0, Math.min(100, v.renderProgress ?? 0));
    return 84 + Math.floor((14 * pct) / 100);
  }
  return 98;
}
