// AI Slideshow Maker — data model, templates, and persistence.

export type SlideType =
  | "title"
  | "agenda"
  | "section"
  | "concept"
  | "formula"
  | "diagram"
  | "example"
  | "practice"
  | "summary"
  | "takeaways"
  | "comparison"
  | "table"
  | "timeline"
  | "thanks"
  | "quiz"
  | "recap"
  | "definitions"
  | "mistakes"
  | "exam-tips";

export interface Slide {
  id: string;
  type: SlideType;
  title: string;
  content: string;          // main text (supports simple markdown: **bold**, *italic*, `code`)
  bullets?: string[];       // for bullet-list slides
  formula?: string;         // for formula slides (raw expression)
  diagramPrompt?: string;   // suggestion for an illustrative diagram
  practiceQuestion?: string;
  practiceAnswer?: string;
  speakerNotes: string;
  background?: string;      // optional CSS background override
}

export type SlideshowTemplate =
  | "scholar-glass"
  | "minimal-white"
  | "blackboard"
  | "science-lab"
  | "space"
  | "notebook"
  | "corporate"
  | "exam-revision";

export type SlideshowMode =
  | "school-project"
  | "chapter-explanation"
  | "revision"
  | "teacher-lesson"
  | "seminar"
  | "viva"
  | "formula-deck"
  | "experiment"
  | "board-revision"
  | "jee-deck";

export type SlideshowDifficulty =
  | "easy"
  | "standard"
  | "advanced"
  | "board"
  | "jee";

export interface Slideshow {
  id: string;
  title: string;
  subject: string;
  chapter: string;
  classProfile: 9 | 11;
  mode: SlideshowMode;
  template: SlideshowTemplate;
  difficulty: SlideshowDifficulty;
  language: string;
  slides: Slide[];
  createdAt: number;
  updatedAt: number;
}

// ===== Templates =====

export interface TemplateMeta {
  id: SlideshowTemplate;
  name: string;
  blurb: string;
  swatch: string;       // CSS gradient for preview chip
  fontFamily: string;
  background: string;   // CSS background
  text: string;         // text color
  accent: string;       // accent color
  cardBg: string;       // card / panel background
  muted: string;        // muted text color
}

export const TEMPLATES: TemplateMeta[] = [
  {
    id: "scholar-glass",
    name: "Scholar Glass",
    blurb: "Dark glassmorphism with neon gradients — Scholar's signature look.",
    swatch: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #312e81 100%)",
    fontFamily: "'Inter', system-ui, sans-serif",
    background: "linear-gradient(135deg, #0a0a0f 0%, #111827 50%, #1e1b4b 100%)",
    text: "#f8fafc",
    accent: "#60a5fa",
    cardBg: "rgba(255,255,255,0.06)",
    muted: "rgba(248,250,252,0.55)",
  },
  {
    id: "minimal-white",
    name: "Minimal White",
    blurb: "Clean, print-friendly, distraction-free academic slides.",
    swatch: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
    fontFamily: "'Inter', system-ui, sans-serif",
    background: "#ffffff",
    text: "#0f172a",
    accent: "#3b82f6",
    cardBg: "#f1f5f9",
    muted: "#64748b",
  },
  {
    id: "blackboard",
    name: "Blackboard",
    blurb: "Dark chalkboard style with chalk-like formulas.",
    swatch: "linear-gradient(135deg, #1a2e1a 0%, #0d1f0d 100%)",
    fontFamily: "'Caveat', 'Comic Sans MS', cursive",
    background: "linear-gradient(135deg, #1a2e1a 0%, #0d1f0d 100%)",
    text: "#f0fff0",
    accent: "#fde047",
    cardBg: "rgba(253,224,71,0.08)",
    muted: "rgba(240,255,240,0.55)",
  },
  {
    id: "science-lab",
    name: "Science Lab",
    blurb: "Physics/Chemistry/Biology-inspired with grid lines.",
    swatch: "linear-gradient(135deg, #0c4a6e 0%, #164e63 100%)",
    fontFamily: "'Inter', system-ui, sans-serif",
    background:
      "linear-gradient(135deg, #0c4a6e 0%, #0f766e 100%), repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.05) 39px, rgba(255,255,255,0.05) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.05) 39px, rgba(255,255,255,0.05) 40px)",
    text: "#ecfeff",
    accent: "#67e8f9",
    cardBg: "rgba(255,255,255,0.08)",
    muted: "rgba(236,254,255,0.55)",
  },
  {
    id: "space",
    name: "Space Theme",
    blurb: "Deep space with starfield — perfect for Physics & Astronomy.",
    swatch: "linear-gradient(135deg, #020617 0%, #1e1b4b 50%, #4c1d95 100%)",
    fontFamily: "'Inter', system-ui, sans-serif",
    background: "radial-gradient(ellipse at top, #1e1b4b 0%, #020617 70%)",
    text: "#e0e7ff",
    accent: "#a78bfa",
    cardBg: "rgba(167,139,250,0.08)",
    muted: "rgba(224,231,255,0.55)",
  },
  {
    id: "notebook",
    name: "Notebook",
    blurb: "Handwritten-notes inspired — lined paper feel.",
    swatch: "linear-gradient(135deg, #fefce8 0%, #fef9c3 100%)",
    fontFamily: "'Caveat', 'Comic Sans MS', cursive",
    background: "linear-gradient(to bottom, #fefce8 0%, #fefce8 100%), repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(0,0,0,0.06) 27px, rgba(0,0,0,0.06) 28px)",
    text: "#1e293b",
    accent: "#b91c1c",
    cardBg: "rgba(255,255,255,0.5)",
    muted: "#475569",
  },
  {
    id: "corporate",
    name: "Corporate",
    blurb: "Professional seminar-style — for formal presentations.",
    swatch: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
    fontFamily: "'Inter', system-ui, sans-serif",
    background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
    text: "#f1f5f9",
    accent: "#38bdf8",
    cardBg: "rgba(255,255,255,0.05)",
    muted: "rgba(241,245,249,0.6)",
  },
  {
    id: "exam-revision",
    name: "Exam Revision",
    blurb: "Highly readable, formula-focused, minimal decoration.",
    swatch: "linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)",
    fontFamily: "'Inter', system-ui, sans-serif",
    background: "#fafafa",
    text: "#171717",
    accent: "#dc2626",
    cardBg: "#ffffff",
    muted: "#525252",
  },
];

export function getTemplate(id: SlideshowTemplate): TemplateMeta {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

// ===== Modes & difficulty (for UI) =====

export const MODES: { id: SlideshowMode; name: string; hint: string }[] = [
  { id: "school-project", name: "School Project", hint: "Polished, structured project deck." },
  { id: "chapter-explanation", name: "Chapter Explanation", hint: "Teach a chapter step-by-step." },
  { id: "revision", name: "Revision Presentation", hint: "Quick recap before tests." },
  { id: "teacher-lesson", name: "Teacher-Style Lesson", hint: "Full lesson with examples & practice." },
  { id: "seminar", name: "Seminar", hint: "Formal talk with deep concept coverage." },
  { id: "viva", name: "Viva Presentation", hint: "Defend concepts under questioning." },
  { id: "formula-deck", name: "Formula Presentation", hint: "Every key formula + worked example." },
  { id: "experiment", name: "Experiment Explanation", hint: "Aim, apparatus, procedure, result." },
  { id: "board-revision", name: "Board Exam Revision", hint: "High-yield points for CBSE boards." },
  { id: "jee-deck", name: "JEE Concept Deck", hint: "Advanced problem-solving orientation." },
];

export const DIFFICULTIES: { id: SlideshowDifficulty; name: string }[] = [
  { id: "easy", name: "Easy" },
  { id: "standard", name: "Standard" },
  { id: "advanced", name: "Advanced" },
  { id: "board", name: "Board Level" },
  { id: "jee", name: "JEE Level" },
];

// ===== Slide type metadata =====

export const SLIDE_TYPES: { id: SlideType; name: string; icon: string }[] = [
  { id: "title", name: "Title Slide", icon: "🎤" },
  { id: "agenda", name: "Agenda", icon: "📋" },
  { id: "section", name: "Section Divider", icon: "🔖" },
  { id: "concept", name: "Concept", icon: "💡" },
  { id: "formula", name: "Formula", icon: "∑" },
  { id: "diagram", name: "Diagram", icon: "📊" },
  { id: "example", name: "Example Problem", icon: "📝" },
  { id: "practice", name: "Practice Question", icon: "✏️" },
  { id: "summary", name: "Summary", icon: "📌" },
  { id: "takeaways", name: "Key Takeaways", icon: "⭐" },
  { id: "comparison", name: "Comparison", icon: "⚖️" },
  { id: "table", name: "Table", icon: "📊" },
  { id: "timeline", name: "Timeline", icon: "⏱️" },
  { id: "definitions", name: "Important Definitions", icon: "📖" },
  { id: "mistakes", name: "Common Mistakes", icon: "⚠️" },
  { id: "exam-tips", name: "Exam Tips", icon: "🎯" },
  { id: "recap", name: "Recap Slide", icon: "🔁" },
  { id: "quiz", name: "Quiz Slide", icon: "❓" },
  { id: "thanks", name: "Thank You", icon: "🙏" },
];

export function getSlideTypeMeta(id: SlideType) {
  return SLIDE_TYPES.find((s) => s.id === id) ?? SLIDE_TYPES[3];
}

// ===== Persistence (localStorage) =====

const STORAGE_KEY = "scholar-slideshows";

export function loadSlideshows(): Slideshow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter((s) => s && s.id && Array.isArray(s.slides));
  } catch {
    return [];
  }
}

export function saveSlideshows(list: Slideshow[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // quota or privacy mode — silently ignore
  }
}

export function upsertSlideshow(slideshow: Slideshow): Slideshow[] {
  const list = loadSlideshows();
  const idx = list.findIndex((s) => s.id === slideshow.id);
  slideshow.updatedAt = Date.now();
  if (idx >= 0) list[idx] = slideshow;
  else list.unshift(slideshow);
  saveSlideshows(list);
  return list;
}

export function deleteSlideshow(id: string): Slideshow[] {
  const list = loadSlideshows().filter((s) => s.id !== id);
  saveSlideshows(list);
  return list;
}

// ===== Helpers =====

export function newSlide(type: SlideType = "concept", partial: Partial<Slide> = {}): Slide {
  return {
    id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    title: partial.title ?? "New Slide",
    content: partial.content ?? "",
    bullets: partial.bullets,
    formula: partial.formula,
    diagramPrompt: partial.diagramPrompt,
    practiceQuestion: partial.practiceQuestion,
    practiceAnswer: partial.practiceAnswer,
    speakerNotes: partial.speakerNotes ?? "",
    background: partial.background,
  };
}

export function newSlideshow(partial: Partial<Slideshow> = {}): Slideshow {
  const now = Date.now();
  return {
    id: `slideshow-${now}-${Math.random().toString(36).slice(2, 7)}`,
    title: partial.title ?? "Untitled Slideshow",
    subject: partial.subject ?? "",
    chapter: partial.chapter ?? "",
    classProfile: partial.classProfile ?? 11,
    mode: partial.mode ?? "chapter-explanation",
    template: partial.template ?? "scholar-glass",
    difficulty: partial.difficulty ?? "standard",
    language: partial.language ?? "English",
    slides: partial.slides ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

// ===== AI generation prompt =====

export function buildSlideshowPrompt(opts: {
  prompt: string;
  scholarClass: 9 | 11;
  jeeMode: boolean;
  subject: string;
  chapter: string;
  mode: SlideshowMode;
  difficulty: SlideshowDifficulty;
  slideCount: number;
  template: SlideshowTemplate;
  includeSpeakerNotes: boolean;
  includeDiagrams: boolean;
  includeExamples: boolean;
  includePractice: boolean;
  includeSummary: boolean;
  includeReferences: boolean;
  language: string;
}): string {
  const jeeNote = opts.jeeMode
    ? "JEE Mode is ON — go deeper than CBSE, include competitive-style worked examples and shortcuts."
    : "Stay strictly within CBSE syllabus and difficulty.";
  const features: string[] = [];
  if (opts.includeDiagrams) features.push("diagram slides with a concrete `diagramPrompt` describing what to draw");
  if (opts.includeExamples) features.push("worked-example slides with step-by-step solutions");
  if (opts.includePractice) features.push("practice-question slides with both `practiceQuestion` and `practiceAnswer`");
  if (opts.includeSummary) features.push("a summary slide near the end");
  if (opts.includeReferences) features.push("a final slide listing NCERT chapter & standard references");
  const featureList = features.length ? features.join("; ") : "no optional features";

  return `You are an expert educational content designer for CBSE students. Generate a COMPLETE, POLISHED slideshow as STRICT JSON.

CONTEXT:
- Class: ${opts.scholarClass === 11 ? "Class 11 (CBSE Senior Secondary)" : "Class 9 (CBSE Secondary)"}
- Subject: ${opts.subject || "General"}
- Chapter: ${opts.chapter || "General"}
- Mode: ${opts.mode}
- Difficulty: ${opts.difficulty}
- ${jeeNote}

USER BRIEF:
"""
${opts.prompt}
"""

REQUIREMENTS:
1. Generate exactly ${opts.slideCount} slides — no more, no less.
2. Start with a "title" slide, then an "agenda" slide, then mix concept / formula / example / practice slides logically, end with a "summary" slide and a "thanks" slide. Use the right \`type\` for each slide.
3. Each slide MUST have a clear, short \`title\`.
4. Use \`bullets\` (3-6 short points) for concept/agenda/summary/takeaways slides — never long paragraphs.
5. Use \`content\` for one-paragraph explanation on concept/example slides.${opts.slideCount > 15 ? " Keep content under 40 words to fit token budget for large decks." : " Keep it under 80 words."}
6. For formula slides, put the LaTeX-style expression in \`formula\` (e.g., "v = u + at", "E = mc^2") and explain when to use it in \`content\`.
7. Include: ${featureList}.
8. ${opts.includeSpeakerNotes ? `Each slide MUST have meaningful \`speakerNotes\` (${opts.slideCount > 15 ? "1-2 sentences" : "2-4 sentences"} explaining what the presenter should say).` : "`speakerNotes` can be empty string."}
9. Use ${opts.language} for all visible content. Speaker notes may also be in ${opts.language}.
10. Do NOT include disclaimers, AI mentions, or filler. Be educationally rigorous.
11. Avoid empty slides. Every slide must teach something.
12. CRITICAL: Return a SINGLE complete JSON object. Do not exceed the output token limit. If you sense you are running long, prefer SHORTER bullets/speakerNotes over cutting off mid-JSON.

OUTPUT FORMAT — return ONLY a JSON object (no markdown fences, no explanation):
{
  "title": "Slideshow title (short, catchy)",
  "slides": [
    {
      "type": "title" | "agenda" | "section" | "concept" | "formula" | "diagram" | "example" | "practice" | "summary" | "takeaways" | "comparison" | "table" | "timeline" | "definitions" | "mistakes" | "exam-tips" | "recap" | "quiz" | "thanks",
      "title": "Slide title",
      "content": "Short paragraph or empty for pure-bullet slides",
      "bullets": ["short bullet 1", "short bullet 2"],
      "formula": "v = u + at",
      "diagramPrompt": "Describe a free-body diagram showing weight and tension on a hanging block",
      "practiceQuestion": "A ball is dropped from 80m. Find time to reach ground (g=10).",
      "practiceAnswer": "t = 4 s",
      "speakerNotes": "What to say while presenting this slide."
    }
  ]
}

Return ONLY the JSON object. No markdown fences, no prose before or after.`;
}

// ===== Validation & repair =====

export function validateAIResponse(raw: any): { title?: string; slides: Slide[]; partial?: boolean } | null {
  if (!raw || typeof raw !== "object") return null;
  let obj = raw;
  // If the model wrapped it in a string, try to parse
  if (typeof raw === "string") {
    try { obj = JSON.parse(raw); } catch { return null; }
  }
  if (!obj || !Array.isArray(obj.slides)) return null;

  const validTypes = new Set(SLIDE_TYPES.map((s) => s.id));
  const slides: Slide[] = obj.slides
    .filter((s: any) => s && typeof s === "object" && (s.title || s.content || (s.bullets && s.bullets.length)))
    .map((s: any, i: number) => {
      const type: SlideType = validTypes.has(s.type) ? s.type : "concept";
      // Accept "content" as a valid type alias for concept (model often uses this)
      let finalType = type;
      if (s.type === "content") finalType = "concept";
      return {
        id: `s-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        type: finalType,
        title: String(s.title ?? "Untitled Slide").slice(0, 200),
        content: String(s.content ?? "").slice(0, 2000),
        bullets: Array.isArray(s.bullets)
          ? s.bullets.map((b: any) => String(b).slice(0, 300)).filter(Boolean).slice(0, 8)
          : undefined,
        formula: s.formula ? String(s.formula).slice(0, 400) : undefined,
        diagramPrompt: s.diagramPrompt ? String(s.diagramPrompt).slice(0, 500) : undefined,
        practiceQuestion: s.practiceQuestion ? String(s.practiceQuestion).slice(0, 800) : undefined,
        practiceAnswer: s.practiceAnswer ? String(s.practiceAnswer).slice(0, 800) : undefined,
        speakerNotes: String(s.speakerNotes ?? "").slice(0, 1500),
      };
    });

  if (!slides.length) return null;
  return {
    title: obj.title ? String(obj.title).slice(0, 200) : undefined,
    slides,
    partial: slides.length < obj.slides.length,
  };
}
