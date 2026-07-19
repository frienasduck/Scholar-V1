// AI Narrated Slideshow — data model, AI prompt, validation, persistence.

import type { Slideshow, Slide, SlideType } from "./slideshow";

// ============================================================================
// Types
// ============================================================================

export interface SlideNarration {
  slideId: string;
  script: string;            // what the AI voice will read
  caption: string;           // short caption text (may equal script or be shorter)
  durationSec: number;       // estimated duration in seconds (at 1x speed)
  highlightKeywords: string[]; // keywords to highlight on the slide during narration
  pauseAfter?: boolean;      // for practice slides — pause and wait for user
  pausePrompt?: string;      // what to say before pausing ("Pause and try this…")
}

export interface NarrationSettings {
  voiceURI: string;          // SpeechSynthesisVoice.uri
  rate: number;              // 0.5–2.0
  pitch: number;             // 0–2
  volume: number;            // 0–1
  autoAdvance: boolean;      // auto-advance slides
  showCaptions: boolean;
  highlightText: boolean;
  practicePauses: boolean;   // pause on practice slides
  recapPauses: boolean;      // pause on recap slides
  targetDurationMin?: number; // 2/5/10/15/custom
}

export interface NarratedSlideshow {
  id: string;                // same as slideshow.id
  slideshowId: string;
  title: string;
  narrations: SlideNarration[];
  settings: NarrationSettings;
  totalDurationSec: number;
  createdAt: number;
  updatedAt: number;
  lastPlayedSlideIdx?: number;
  lastPlayedAt?: number;
}

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_NARRATION_SETTINGS: NarrationSettings = {
  voiceURI: "",
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  autoAdvance: true,
  showCaptions: true,
  highlightText: true,
  practicePauses: true,
  recapPauses: false,
  targetDurationMin: 5,
};

// ============================================================================
// AI prompt builder — full (all slides) and chunked (batch of slides)
// ============================================================================

export function buildNarrationPrompt(opts: {
  slideshow: Slideshow;
  scholarClass: 9 | 11;
  jeeMode: boolean;
  targetDurationMin?: number;
}): string {
  return buildChunkedNarrationPrompt({ ...opts, slideIndices: null });
}

export function buildChunkedNarrationPrompt(opts: {
  slideshow: Slideshow;
  scholarClass: 9 | 11;
  jeeMode: boolean;
  targetDurationMin?: number;
  slideIndices: number[] | null; // null = all slides
}): string {
  const { slideshow, scholarClass, jeeMode, targetDurationMin, slideIndices } = opts;

  const allSlides = slideshow.slides;
  const selectedSlides = slideIndices
    ? slideIndices.map((i) => ({ slide: allSlides[i], originalIndex: i })).filter((x) => x.slide)
    : allSlides.map((s, i) => ({ slide: s, originalIndex: i }));

  // Compact JSON — truncate long content to save tokens
  const slidesJSON = selectedSlides.map(({ slide: s, originalIndex: i }) => ({
    index: i + 1,
    id: s.id,
    type: s.type,
    title: s.title,
    content: (s.content || "").slice(0, 200),
    bullets: (s.bullets || []).slice(0, 5).map((b) => b.slice(0, 120)),
    formula: (s.formula || "").slice(0, 100),
    practiceQuestion: (s.practiceQuestion || "").slice(0, 200),
    practiceAnswer: (s.practiceAnswer || "").slice(0, 200),
  }));

  const jeeNote = jeeMode
    ? "JEE Mode is ON — use deeper, problem-solving-oriented explanations with advanced examples and shortcuts."
    : "Stay within CBSE syllabus and difficulty.";

  const targetNote = targetDurationMin
    ? `Target total duration is about ${targetDurationMin} minutes. Distribute time across slides accordingly.`
    : "Use natural pacing — about 15-30 seconds per slide.";

  const batchNote = slideIndices
    ? `You are generating narration for slides ${slideIndices.map((i) => i + 1).join(", ")} (out of ${allSlides.length} total). Generate narration for ONLY these slides.`
    : `You are generating narration for all ${allSlides.length} slides.`;

  return `You are an expert educational narrator for CBSE students. Generate voice narration scripts for slides.

CONTEXT:
- Class: ${scholarClass === 11 ? "Class 11 (CBSE Senior Secondary)" : "Class 9 (CBSE Secondary)"}
- Subject: ${slideshow.subject || "General"}
- Chapter: ${slideshow.chapter || "General"}
- ${jeeNote}
- ${targetNote}
- ${batchNote}

SLIDES TO NARRATE:
${JSON.stringify(slidesJSON, null, 2)}

REQUIREMENTS:
1. Generate a narration \`script\` for EVERY slide listed above. Do NOT skip any.
2. The script should NOT just read the slide word-for-word. Explain it like a teacher would — add context, examples, and intuition.
3. For formula slides: explain what each symbol means, the units, and when to use the formula.
4. For example/numerical slides: walk through the given values, the formula used, the substitution, and the final answer with units.
5. For diagram slides: describe what the diagram shows and the important labels.
6. For practice slides: end with "Pause here and try solving this yourself." and set pauseAfter: true.
7. For summary/recap slides: recap only key takeaways — be concise.
8. For title slides: a brief welcome (5-10 seconds). For thanks slides: a brief closing (5-10 seconds).
9. \`caption\` should be a short version (max 120 chars) of the script.
10. \`durationSec\` should estimate how long the script takes at normal speed (~150 words/min). Range: 5-60 seconds.
11. \`highlightKeywords\` should be 1-4 short phrases from the slide to highlight.
12. Use ${slideshow.language || "English"} for all narration.
13. Keep each script under 100 words to fit within output limits.
14. CRITICAL: Return a SINGLE complete JSON object. Do NOT cut off mid-JSON.

OUTPUT FORMAT — return ONLY a JSON object (no markdown fences, no explanation):
{
  "narrations": [
    {
      "slideId": "<slide id>",
      "script": "Full narration text...",
      "caption": "Short caption",
      "durationSec": 18,
      "highlightKeywords": ["keyword1", "keyword2"],
      "pauseAfter": false,
      "pausePrompt": ""
    }
  ]
}

Return ONLY the JSON object. No markdown fences, no prose before or after.`;
}

// ============================================================================
// Validation & repair
// ============================================================================

export function validateNarrationResponse(
  raw: any,
  slideshow: Slideshow
): SlideNarration[] | null {
  if (!raw || typeof raw !== "object") return null;
  let obj = raw;
  if (typeof raw === "string") {
    try { obj = JSON.parse(raw); } catch { return null; }
  }
  if (!obj || !Array.isArray(obj.narrations)) return null;

  const narrations: SlideNarration[] = [];
  const slideMap = new Map(slideshow.slides.map((s) => [s.id, s]));

  for (const n of obj.narrations) {
    if (!n || !n.slideId || !slideMap.has(n.slideId)) continue;
    const slide = slideMap.get(n.slideId)!;
    narrations.push({
      slideId: n.slideId,
      script: String(n.script ?? buildFallbackScript(slide)).slice(0, 4000),
      caption: String(n.caption ?? slide.title).slice(0, 200),
      durationSec: Math.max(3, Math.min(180, Number(n.durationSec) || 12)),
      highlightKeywords: Array.isArray(n.highlightKeywords)
        ? n.highlightKeywords.map((k: any) => String(k).slice(0, 80)).filter(Boolean).slice(0, 6)
        : [],
      pauseAfter: Boolean(n.pauseAfter) || slide.type === "practice",
      pausePrompt: n.pausePrompt ? String(n.pausePrompt).slice(0, 300) : (slide.type === "practice" ? "Pause here and try solving this yourself." : undefined),
    });
  }

  if (!narrations.length) return null;
  return narrations;
}

// Merge partial narration results (from chunked generation)
export function mergeNarrations(
  existing: SlideNarration[],
  newBatch: SlideNarration[],
  slideshow: Slideshow
): SlideNarration[] {
  const byId = new Map(existing.map((n) => [n.slideId, n]));
  for (const n of newBatch) {
    byId.set(n.slideId, n);
  }
  // Return in slideshow slide order, filling missing ones with fallback
  return slideshow.slides.map((s) => {
    const found = byId.get(s.id);
    if (found) return found;
    return {
      slideId: s.id,
      script: buildFallbackScript(s),
      caption: s.title,
      durationSec: 12,
      highlightKeywords: [],
      pauseAfter: s.type === "practice",
      pausePrompt: s.type === "practice" ? "Pause here and try solving this yourself." : undefined,
    };
  });
}

function buildFallbackScript(slide: Slide): string {
  const parts: string[] = [];
  if (slide.title) parts.push(slide.title + ".");
  if (slide.content) parts.push(slide.content);
  if (slide.bullets?.length) parts.push(slide.bullets.join(". ") + ".");
  if (slide.formula) parts.push(`The formula is: ${slide.formula}.`);
  if (slide.practiceQuestion) parts.push(slide.practiceQuestion);
  return parts.join(" ").slice(0, 2000) || "This slide has no narration.";
}

// ============================================================================
// Persistence (localStorage, separate key from slideshows)
// ============================================================================

const STORAGE_KEY = "scholar-narrated-slideshows";

export function loadNarratedSlideshows(): NarratedSlideshow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter((n) => n && n.id && Array.isArray(n.narrations));
  } catch {
    return [];
  }
}

export function saveNarratedSlideshows(list: NarratedSlideshow[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // quota — silently ignore
  }
}

export function upsertNarratedSlideshow(n: NarratedSlideshow): NarratedSlideshow[] {
  const list = loadNarratedSlideshows();
  const idx = list.findIndex((x) => x.id === n.id);
  n.updatedAt = Date.now();
  if (idx >= 0) list[idx] = n;
  else list.unshift(n);
  saveNarratedSlideshows(list);
  return list;
}

export function deleteNarratedSlideshow(id: string): NarratedSlideshow[] {
  const list = loadNarratedSlideshows().filter((n) => n.id !== id);
  saveNarratedSlideshows(list);
  return list;
}

export function getNarratedSlideshow(slideshowId: string): NarratedSlideshow | null {
  return loadNarratedSlideshows().find((n) => n.slideshowId === slideshowId) ?? null;
}

// ============================================================================
// Factory
// ============================================================================

export function newNarratedSlideshow(
  slideshow: Slideshow,
  narrations: SlideNarration[],
  settings: NarrationSettings
): NarratedSlideshow {
  const now = Date.now();
  const totalDurationSec = narrations.reduce((sum, n) => sum + n.durationSec, 0);
  return {
    id: `narr-${slideshow.id}`,
    slideshowId: slideshow.id,
    title: slideshow.title,
    narrations,
    settings,
    totalDurationSec,
    createdAt: now,
    updatedAt: now,
  };
}

export function recalcDuration(narrations: SlideNarration[]): number {
  return narrations.reduce((sum, n) => sum + n.durationSec, 0);
}

// ============================================================================
// Helpers
// ============================================================================

export function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Estimate words-per-minute for a given rate (1.0 = ~150 wpm)
export function rateToWPM(rate: number): number {
  return Math.round(150 * rate);
}
