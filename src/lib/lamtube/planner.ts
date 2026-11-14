import "server-only";
import { GoogleGenAI } from "@google/genai";
import { generateScholarGroqJSON, parseJSONObject } from "@/lib/ai/scholar-groq";
import { completeJSON } from "@/lib/ai/structured";
import { AIProviderError } from "@/lib/ai/errors";
import { z } from "zod";
import type { Outline, ScenePlan, VideoState } from "./model";
import { isLocalLamtubeDevMode } from "./local-dev-store";

const DEFAULT_PLANNER_MODEL = "gemini-3-flash-preview";

function levelLabel(v: VideoState) {
  const raw = v.settings.academicLevel ?? (v.settings.grade === 9 ? "class-9" : "class-11");
  return raw.replace("class-", "Class ");
}

function languageInstruction(v: VideoState) {
  if (v.settings.language === "hi-en") {
    return "LANGUAGE: Deliver narration phrases in natural, classroom-friendly Hinglish (conversational Hindi + English scientific terms written cleanly in Latin/Roman script for clear text-to-speech, e.g. 'Jab ball ko angle theta par throw karte hain...'). Keep all visual labels, KaTeX equations, and graph axes in crisp standard English notation.";
  }
  return "LANGUAGE: Clear, engaging, precise English spoken narration and concise visual labels.";
}

export function buildOutlinePrompt(policy: string, v: VideoState, targetScenes: number, schema: Record<string, unknown>) {
  return `${policy}
TARGET LEVEL: ${levelLabel(v)} CBSE/NCERT & competitive clarity (${v.settings.depth} depth, purpose: ${v.settings.purpose}).
${languageInstruction(v)}
TOPIC FOCUS: ${v.settings.topic || v.settings.title}.
${v.settings.prompt ? `STUDENT INSTRUCTIONS: ${v.settings.prompt}` : ""}

Build a tightly structured, progression-driven animated video lesson covering ALL selected chapters (${v.settings.chapters.map((c) => `${c.id}: ${c.title}`).join("; ")}).
Order scenes logically:
1. Hook & Core Intuition (real-world phenomenon or motivating question)
2. Formal Concept / Visual Mechanism / Law + Equation
3. Worked Graphical / Quantitative Example
4. Synthesis, Edge Case, or Exam Check & Recap

Target ${targetScenes} distinct scenes (minimum 2, maximum 24; for 1-min videos aim for 3 scenes, 3-min videos aim for 4-5 scenes). Each scene teaches ONE clear idea with real moving diagrams, graphs, vectors, or atomic visuals.
Return ONLY valid JSON matching this JSON schema:
${JSON.stringify(schema)}`;
}

export function buildScenePrompt(
  policy: string,
  v: VideoState,
  target: Outline["scenes"][number],
  index: number,
  total: number,
  schema: Record<string, unknown>
) {
  const aspectHint =
    v.settings.aspect === "9:16"
      ? "Aspect is vertical 9:16: stack diagrams cleanly inside x=100..900, y=130..820 with generous vertical spacing."
      : "Use safe world canvas coordinates: keep all elements inside x=60..920, y=100..820 so nothing touches edges or overlaps bottom subtitles.";

  return `${policy}
OUTLINE SUMMARY: ${v.outline?.summary ?? ""}
CURRENT SCENE (${index + 1} of ${total}): ${JSON.stringify(target)}
PREVIOUSLY TAUGHT GOALS: ${JSON.stringify(v.plans.slice(0, index).map((p) => p.goal))}
TARGET LEVEL: ${levelLabel(v)} | STYLE: ${v.settings.style} | ${languageInstruction(v)}

DESIGN RULES FOR TRUE EDUCATIONAL VIDEO MOTION (NOT A STATIC SLIDE):
1. ${aspectHint}
2. Narration ("phrases"): 4 to 8 crisp non-empty spoken sentences, EACH 10..190 characters, total ~50-115 words. NEVER output empty strings "" in phrases. Every phrase drives a visual step!
3. Visual Elements (4 to 14 well-spaced elements, NO overlapping text boxes):
   - Use "latex" for crisp formulas (set "latex" to valid KaTeX like "R = \\\\frac{u^2 \\\\sin 2\\\\theta}{g}" and concise fallback "text").
   - Use "plot" for accurate mathematical/scientific coordinate curves: provide "axisX", "axisY", "xRange": [minX, maxX], "yRange": [minY, maxY], and "curve": 12-40 mathematically accurate {x, y} points!
   - Use "atom" for atomic/ionic electron shells (provide "symbol", "protons", "shells": [2,8,1], "charge": "+1").
   - Use "arrow" (x,y start; w,h signed delta vector), "circle", "rect", "graph", "sketch", "highlight", "table", and short "label" (<= 45 chars, never paragraphs!).
   - Optional: at most ONE "illustration" element per scene (x, y, w, h, unique "assetKey": "scene${index + 1}_plate", and "illustrationPrompt" describing a clean scientific visual scene with ZERO text/numbers/labels). Do NOT rely on "illustration" alone for diagrams.
4. Synchronized Cues:
   - Reveal/draw/animate elements progressively across >= 3 distinct phrases. Never dump every element at phrase 0.
   - Include at least 2 dynamic motion cues ("draw", "move", "followPath" with target="plot_or_graph_id", "orbit", or "scaleVector").
   - Use "followPath" on a moving ball/particle/electron targeting a "plot" or "graph" element id so motion follows the exact mathematical curve!
5. Interactive checkpoint ("question"): include one crisp 4-choice conceptual check when interactive is true (never reveal its answer in narration); set null when interactive is false.
6. Grounding: sourceIds must cite actual supplied S1..Sn IDs supporting this scene, or [] if general knowledge (when strictSources is false).
7. Keep "title" <= 80 characters and "goal" <= 180 characters (concise 1-sentence learning objective). Every cue "duration" MUST be between 0.1 and 1.0 (fractional share of that phrase, never > 1) and "offset" between 0.0 and 0.85. Omit unused optional element/cue fields rather than emitting empty strings.

Return ONLY valid JSON matching this JSON schema:
${JSON.stringify(schema)}`;
}

async function generateWithGeminiJSON(
  prompt: string,
  signal: AbortSignal,
  maxTokens = 6000
): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new AIProviderError("Gemini planner is not configured.", 503, "GEMINI_NOT_CONFIGURED");
  }
  const preferred = process.env.LAMTUBE_PLANNER_MODEL?.trim() || DEFAULT_PLANNER_MODEL;
  const models = [...new Set([preferred, "gemini-3-flash-preview", "gemini-flash-latest"])];
  const ai = new GoogleGenAI({ apiKey });
  let lastError: unknown;
  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          temperature: 0.35,
          maxOutputTokens: maxTokens,
          responseMimeType: "application/json",
          abortSignal: AbortSignal.any([signal, AbortSignal.timeout(16000)]),
        },
      });
      const text = response.text?.trim() ?? "";
      if (!text) throw new Error(`Gemini (${model}) returned an empty JSON response.`);
      return parseJSONObject(text);
    } catch (err) {
      if (signal.aborted) throw err;
      lastError = err;
    }
  }
  throw lastError;
}

/**
 * Generates structured outline/scene JSON using Gemini (`gemini-3.8-flash` -> `gemini-2.5-flash`) first
 * and falls back cleanly to Scholar's unified `completeJSON` (or direct `generateScholarGroqJSON` when outside cookie request scope / local dev).
 * When mocked in pipeline unit tests (`allowDirectGemini === false`), routes exclusively via `completeJSON`.
 */
export async function generateStructuredPlan<T extends z.ZodTypeAny>(opts: {
  userId: string;
  prompt: string;
  schema: T;
  signal: AbortSignal;
  allowDirectGemini: boolean;
  completeJsonFn?: typeof completeJSON;
}): Promise<unknown> {
  const fallbackFn = opts.completeJsonFn ?? completeJSON;
  const jsonSchema = z.toJSONSchema(opts.schema) as Record<string, unknown>;

  if (opts.allowDirectGemini && process.env.GEMINI_API_KEY?.trim()) {
    try {
      return await generateWithGeminiJSON(opts.prompt, opts.signal, 6000);
    } catch (error) {
      if (opts.signal.aborted) throw error;
      console.warn(
        "[LAMTube] Gemini planner fallback to Scholar structured JSON:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  if (opts.allowDirectGemini && isLocalLamtubeDevMode()) {
    return generateScholarGroqJSON({
      messages: [
        { role: "system", content: opts.prompt },
        { role: "user", content: "Generate the requested JSON result now. Return only valid JSON with zero empty phrases." },
      ],
      temperature: 0.35,
      maxTokens: 6500,
      signal: opts.signal,
    });
  }

  try {
    return await fallbackFn(opts.userId, opts.prompt, opts.signal, jsonSchema, {
      maxTokens: 6500,
    });
  } catch (err) {
    if (opts.signal.aborted) throw err;
    const msg = err instanceof Error ? err.message : "";
    if (opts.allowDirectGemini && /outside a request scope|cookies/i.test(msg)) {
      return generateScholarGroqJSON({
        messages: [
          { role: "system", content: opts.prompt },
          { role: "user", content: "Generate the requested JSON result now. Return only valid JSON with zero empty phrases." },
        ],
        temperature: 0.35,
        maxTokens: 6500,
        signal: opts.signal,
      });
    }
    throw err;
  }
}

export function defaultChapterFallback(v: VideoState): ScenePlan["chapterId"] {
  return v.settings.chapters[0]?.id ?? "general";
}
