import { z } from "zod";
import {
  newSlide,
  type Slide,
  type SlideType,
  type SlideshowAudience,
  type SlideshowCoverageItem,
  type SlideshowCoverageReport,
  type SlideshowDensity,
  type SlideshowGenerationSettings,
  type SlideshowOutlineItem,
  type SlideshowSourceMeta,
  type SlideshowSourcePage,
} from "./slideshow";

export type EbookSourceDefinition = {
  id: string;
  subject: "Mathematics" | "Chemistry";
  title: string;
  dataUrl: string;
  cleanPdfUrl: string;
  scanPageDir: string;
  pageCount: number;
  chapters: Array<{
    id: string;
    title: string;
    startPage: number;
    endPage: number;
  }>;
};

export const EBOOK_SLIDESHOW_SOURCES: EbookSourceDefinition[] = [
  {
    id: "class11-maths-part1",
    subject: "Mathematics",
    title: "Class 11 Mathematics Part 1",
    dataUrl: "/content/ebooks/class11-maths-part1/book-v1.json",
    cleanPdfUrl: "/content/ebooks/class11-maths-part1/clean-text.pdf",
    scanPageDir: "/ebook-pages-maths",
    pageCount: 35,
    chapters: [
      { id: "sets", title: "Sets", startPage: 2, endPage: 16 },
      {
        id: "relations-and-functions",
        title: "Relations and Functions",
        startPage: 17,
        endPage: 35,
      },
    ],
  },
  {
    id: "class11-chemistry-part1",
    subject: "Chemistry",
    title: "Class 11 Chemistry Part 1",
    dataUrl: "/content/ebooks/class11-chemistry-part1/book-v1.json",
    cleanPdfUrl: "/content/ebooks/class11-chemistry-part1/clean-text.pdf",
    scanPageDir: "/ebook-pages-chemistry",
    pageCount: 80,
    chapters: [
      {
        id: "some-basic-concepts-of-chemistry",
        title: "Some Basic Concepts of Chemistry",
        startPage: 2,
        endPage: 37,
      },
      {
        id: "structure-of-atom",
        title: "Structure of Atom",
        startPage: 38,
        endPage: 80,
      },
    ],
  },
];

type RawSection = {
  id?: string;
  type?: string;
  text?: string;
  sourcePage?: number;
};
type RawEbookPage = {
  id?: string;
  chapterId?: string;
  chapterTitle?: string;
  textPdfPageNumber?: number;
  mappedScannedPages?: number[];
  title?: string;
  sections?: RawSection[];
  rawText?: string;
};
type RawEbook = { book?: { pageCountText?: number }; pages?: RawEbookPage[] };

export interface LoadedEbookSource {
  definition: EbookSourceDefinition;
  pageCount: number;
  raw: RawEbook;
}

export type SlidePlan = {
  id: string;
  type: SlideType;
  title: string;
  topicIds: string[];
  sourcePages: number[];
  sourceText: string;
  formulas: string[];
  figureReferences: string[];
};

const meaningfulSectionTypes = new Set([
  "subheading",
  "paragraph",
  "definition",
  "formula",
  "diagram",
  "example",
  "note",
  "case-study",
  "classwork",
  "homework",
  "try-yourself",
]);

const topicSectionTypes = new Set([
  "subheading",
  "definition",
  "formula",
  "diagram",
  "example",
  "note",
]);
const genericHeading =
  /^(mathematics|chemistry|contents?|classwork|homework|note|example|answer|solution|try yourself|practice workbook|day\s*\d*)$/i;
const placeholderText =
  /^(add content here|image goes here|more information|key point|placeholder|tbd)$/i;

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function shorten(value: string, max: number): string {
  const text = cleanText(value);
  return text.length <= max
    ? text
    : `${text.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

export async function loadEbookSource(
  bookId: string,
  signal?: AbortSignal,
): Promise<LoadedEbookSource> {
  const definition = EBOOK_SLIDESHOW_SOURCES.find((book) => book.id === bookId);
  if (!definition)
    throw new Error(
      "That clean ebook is not available for slideshow generation.",
    );
  const response = await fetch(definition.dataUrl, { signal });
  if (!response.ok)
    throw new Error("The clean ebook text could not be loaded.");
  const raw = (await response.json()) as RawEbook;
  const pages = Array.isArray(raw.pages) ? raw.pages : [];
  const pageCount = Number(raw.book?.pageCountText) || pages.length;
  if (!pages.length || pageCount < 1)
    throw new Error("This ebook does not contain readable clean page text.");
  return { definition, pageCount, raw };
}

export function extractEbookPages(
  ebook: LoadedEbookSource,
  startPage: number,
  endPage: number,
  chapterId?: string,
): SlideshowSourcePage[] {
  if (!Number.isInteger(startPage) || startPage < 1)
    throw new Error("Start page must be at least 1.");
  if (!Number.isInteger(endPage) || endPage < startPage)
    throw new Error("End page cannot be before the start page.");
  if (endPage > ebook.pageCount)
    throw new Error(`End page cannot exceed page ${ebook.pageCount}.`);

  const pages = (ebook.raw.pages ?? [])
    .filter((page) => {
      const pageNumber = Number(page.textPdfPageNumber);
      return (
        pageNumber >= startPage &&
        pageNumber <= endPage &&
        (!chapterId || page.chapterId === chapterId)
      );
    })
    .sort((a, b) => Number(a.textPdfPageNumber) - Number(b.textPdfPageNumber))
    .map((page): SlideshowSourcePage => {
      const pageNumber = Number(page.textPdfPageNumber);
      const sections = (page.sections ?? []).filter((section) =>
        meaningfulSectionTypes.has(section.type ?? ""),
      );
      const sectionText = sections
        .map((section) => cleanText(section.text))
        .filter(Boolean);
      const text = cleanText(page.rawText) || sectionText.join("\n");
      const headings = unique(
        sections
          .filter((section) => topicSectionTypes.has(section.type ?? ""))
          .map((section) => cleanText(section.text))
          .filter(
            (heading) =>
              heading.length >= 3 &&
              heading.length <= 150 &&
              !genericHeading.test(heading),
          ),
      ).slice(0, 18);
      const formulas = unique(
        sections
          .filter((section) => section.type === "formula")
          .map((section) => cleanText(section.text))
          .filter((formula) => formula.length > 1),
      ).slice(0, 30);
      const scannedPage = page.mappedScannedPages?.[0] ?? pageNumber;
      const figures = sections
        .filter((section) => section.type === "diagram")
        .map((section, index) => ({
          id: section.id ?? `figure-${pageNumber}-${index + 1}`,
          caption:
            cleanText(section.text).replace(/^\[Figure\]\s*/i, "") ||
            `Figure on page ${pageNumber}`,
          imageUrl: `${ebook.definition.scanPageDir}/page-${String(scannedPage).padStart(3, "0")}.png`,
        }));
      const tables = sections
        .filter(
          (section) =>
            section.type === "table" || /\|/.test(cleanText(section.text)),
        )
        .map((section, index) => ({
          id: section.id ?? `table-${pageNumber}-${index + 1}`,
          text: cleanText(section.text),
        }));
      return {
        pageNumber,
        text,
        headings,
        formulas,
        figures,
        tables,
        chapterId: page.chapterId,
        chapterTitle: page.chapterTitle,
      };
    });

  if (!pages.length || !pages.some((page) => wordCount(page.text) >= 5)) {
    throw new Error(
      "The selected page range does not contain readable clean text.",
    );
  }
  return pages;
}

function bestPageTitle(page: SlideshowSourcePage): string {
  const heading = page.headings.find(
    (value) => value.length >= 4 && value.length <= 90,
  );
  if (heading) return heading;
  if (page.chapterTitle)
    return `${page.chapterTitle} — Page ${page.pageNumber}`;
  const firstSentence = page.text
    .split(/(?<=[.!?])\s+|\n/)
    .find((value) => value.trim().length >= 5);
  return shorten(firstSentence || `Source page ${page.pageNumber}`, 80);
}

export function analyseSourcePages(
  pages: SlideshowSourcePage[],
): SlideshowOutlineItem[] {
  return pages.map((page, index) => {
    const subtopics = unique(
      page.headings.filter((heading) => !genericHeading.test(heading)),
    ).slice(0, 12);
    const hasCoreMaterial =
      page.formulas.length > 0 ||
      page.figures.length > 0 ||
      /definition|law|theorem|principle/i.test(page.text);
    return {
      id: `topic-page-${page.pageNumber}-${index + 1}`,
      title: bestPageTitle(page),
      sourcePages: [page.pageNumber],
      subtopics: subtopics.length ? subtopics : [bestPageTitle(page)],
      importance: hasCoreMaterial
        ? "core"
        : wordCount(page.text) > 180
          ? "important"
          : "supporting",
      included: true,
      sourceText: page.text,
      formulas: page.formulas,
      figureReferences: page.figures
        .map((figure) => figure.imageUrl)
        .filter((value): value is string => Boolean(value)),
    };
  });
}

export function analysePlainText(text: string): SlideshowOutlineItem[] {
  const normalized = cleanText(text);
  if (wordCount(normalized) < 5)
    throw new Error(
      "The selected source does not contain enough readable text.",
    );
  const blocks = normalized
    .split(/\n\s*\n|(?=^#{1,4}\s+)/m)
    .map(cleanText)
    .filter(Boolean);
  const logicalBlocks =
    blocks.length > 1
      ? blocks
      : (normalized.match(/(?:\S+\s+){1,180}\S+/g) ?? [normalized]);
  return logicalBlocks.map((block, index) => {
    const firstLine = block.split("\n")[0].replace(/^#{1,4}\s*/, "");
    const title = shorten(firstLine || `Topic ${index + 1}`, 80);
    const subtopics = unique(
      block
        .split(/\n|(?<=[.!?])\s+/)
        .map(cleanText)
        .filter((part) => part.length >= 4 && part.length <= 120),
    ).slice(0, 8);
    const formulas = unique(
      block
        .split("\n")
        .filter((line) => /[=→⇌]|\bmol\b|\bkg\b|\bm\/s\b/i.test(line)),
    ).slice(0, 12);
    return {
      id: `topic-text-${index + 1}`,
      title,
      sourcePages: [],
      subtopics: subtopics.length ? subtopics : [title],
      importance: formulas.length || index === 0 ? "core" : "important",
      included: true,
      sourceText: block,
      formulas,
      figureReferences: [],
    };
  });
}

export function sourceStatistics(outline: SlideshowOutlineItem[]) {
  const included = outline.filter((item) => item.included);
  return {
    topicCount: included.length,
    subtopicCount: included.reduce(
      (sum, item) => sum + item.subtopics.length,
      0,
    ),
    formulaCount: unique(included.flatMap((item) => item.formulas)).length,
    figureCount: unique(included.flatMap((item) => item.figureReferences))
      .length,
    wordCount: included.reduce(
      (sum, item) => sum + wordCount(item.sourceText),
      0,
    ),
    pages: unique(included.flatMap((item) => item.sourcePages)).sort(
      (a, b) => a - b,
    ),
  };
}

export function recommendSlideCounts(outline: SlideshowOutlineItem[]) {
  const stats = sourceStatistics(outline);
  const complexity =
    stats.topicCount +
    Math.ceil(stats.subtopicCount / 6) +
    Math.ceil(stats.formulaCount / 4) +
    Math.ceil(stats.figureCount / 3);
  const base = Math.max(4, Math.ceil(stats.wordCount / 260), complexity);
  const range = (factor: number, spread: number) => {
    const low = Math.max(3, Math.round(base * factor));
    return { min: low, max: Math.max(low + 2, Math.round(low * spread)) };
  };
  return {
    concise: range(0.48, 1.35),
    balanced: range(0.72, 1.3),
    detailed: range(1, 1.25),
    "exam-revision": range(0.65, 1.3),
  } satisfies Record<SlideshowDensity, { min: number; max: number }>;
}

function planTypeFor(
  items: SlideshowOutlineItem[],
  index: number,
  settings: SlideshowGenerationSettings,
): SlideType {
  if (
    settings.includeDiagrams &&
    items.some((item) => item.figureReferences.length)
  )
    return "diagram";
  if (items.some((item) => item.formulas.length)) return "formula";
  if (
    settings.includeExamples &&
    items.some((item) => /example|illustration|problem/i.test(item.sourceText))
  )
    return "example";
  if (items.length > 1 && index % 4 === 1) return "comparison";
  if (
    settings.density === "exam-revision" ||
    settings.studyMode === "exam-crash"
  )
    return index % 3 === 2 ? "mistakes" : "exam-tips";
  return "concept";
}

export function allocateSlides(
  outline: SlideshowOutlineItem[],
  settings: SlideshowGenerationSettings,
): SlidePlan[] {
  const topics = outline.filter((item) => item.included);
  if (!topics.length)
    throw new Error("At least one outline topic must remain selected.");
  const reserved =
    1 + (settings.includeSummary ? 1 : 0) + (settings.includeQuiz ? 1 : 0);
  const contentSlots = Math.max(1, settings.slideCount - reserved);
  const plans: SlidePlan[] = [
    {
      id: "slot-title",
      type: "title",
      title: topics[0].title,
      topicIds: [],
      sourcePages: [],
      sourceText: "",
      formulas: [],
      figureReferences: [],
    },
  ];
  for (let slot = 0; slot < contentSlots; slot += 1) {
    const start = Math.floor((slot * topics.length) / contentSlots);
    const end = Math.floor(((slot + 1) * topics.length) / contentSlots);
    const assigned = topics.slice(start, Math.max(start + 1, end));
    if (!assigned.length) continue;
    plans.push({
      id: `slot-content-${slot + 1}`,
      type: planTypeFor(assigned, slot, settings),
      title:
        assigned.length === 1
          ? assigned[0].title
          : `${assigned[0].title} → ${assigned[assigned.length - 1].title}`,
      topicIds: assigned.map((item) => item.id),
      sourcePages: unique(assigned.flatMap((item) => item.sourcePages)).sort(
        (a, b) => a - b,
      ),
      sourceText: assigned
        .map((item) => `[${item.title}]\n${shorten(item.sourceText, 5000)}`)
        .join("\n\n"),
      formulas: unique(assigned.flatMap((item) => item.formulas)),
      figureReferences: unique(
        assigned.flatMap((item) => item.figureReferences),
      ),
    });
  }
  if (settings.includeSummary) {
    plans.push({
      id: "slot-summary",
      type: settings.density === "exam-revision" ? "recap" : "summary",
      title: "Complete source summary",
      topicIds: topics.map((item) => item.id),
      sourcePages: unique(topics.flatMap((item) => item.sourcePages)).sort(
        (a, b) => a - b,
      ),
      sourceText: topics
        .map((item) => `${item.title}: ${item.subtopics.join("; ")}`)
        .join("\n"),
      formulas: unique(topics.flatMap((item) => item.formulas)),
      figureReferences: [],
    });
  }
  if (settings.includeQuiz) {
    plans.push({
      id: "slot-quiz",
      type: "quiz",
      title: "Check your understanding",
      topicIds: topics.map((item) => item.id),
      sourcePages: unique(topics.flatMap((item) => item.sourcePages)).sort(
        (a, b) => a - b,
      ),
      sourceText: topics
        .map((item) => `${item.title}: ${shorten(item.sourceText, 280)}`)
        .join("\n"),
      formulas: unique(topics.flatMap((item) => item.formulas)),
      figureReferences: [],
    });
  }
  return plans.slice(0, settings.slideCount);
}

function densityGuidance(density: SlideshowDensity): string {
  if (density === "concise")
    return "30–60 visible words per content slide; compact but meaningful.";
  if (density === "balanced")
    return "60–110 visible words per content slide with definitions and key formulas.";
  if (density === "exam-revision")
    return "High-yield recall points, formulas, exceptions, common mistakes, and typical questions.";
  return "90–160 visible words per content slide with full explanations, definitions, examples, exceptions, and formula meaning.";
}

function audienceGuidance(audience: SlideshowAudience): string {
  const map: Record<SlideshowAudience, string> = {
    beginner: "Use accessible language and define technical terms.",
    "class-11":
      "Use accurate CBSE Class 11 language and expected prior knowledge.",
    "exam-revision":
      "Prioritise exam recall while retaining every assigned topic.",
    advanced:
      "Include deeper connections and rigorous reasoning grounded in the source.",
    teacher:
      "Use teachable explanations and speaker notes suitable for classroom delivery.",
  };
  return map[audience];
}

export function buildSlideBatchPrompt(options: {
  plans: SlidePlan[];
  settings: SlideshowGenerationSettings;
  source: SlideshowSourceMeta;
  language: string;
  subject: string;
  classProfile: 9 | 11;
}): string {
  const { plans, settings, source } = options;
  const planText = plans
    .map(
      (plan) => `
SLOT ${plan.id}
Required type: ${plan.type}
Working title: ${plan.title}
Topic IDs that MUST be represented: ${plan.topicIds.join(", ") || "none (title slide)"}
Source pages: ${plan.sourcePages.join(", ") || "not page-based"}
Important formulas: ${plan.formulas.join(" | ") || "none detected"}
Available figure references: ${plan.figureReferences.join(" | ") || "none"}
SOURCE MATERIAL:
${shorten(plan.sourceText, 18_000) || source.label}
`,
    )
    .join("\n---\n");
  return `You are generating one controlled batch in a source-grounded Scholar study presentation.

NON-NEGOTIABLE RULES:
1. Return exactly one slide for every supplied SLOT and keep the same slotId order.
2. Read every supplied source section from beginning to end. Represent every topicId assigned to that slot.
3. Never replace later topics with more detail about earlier topics. When space is tight, compress all assigned topics proportionally.
4. Every factual statement must come from the supplied source. Do not invent unrelated facts, formulas, examples, citations, or figures.
5. No blank, title-only (except the explicit title slot), vague, duplicate, or placeholder content.
6. A content slide needs a useful explanation plus 3–7 substantive bullets where the layout supports bullets.
7. Preserve formulas, units, symbols, subscripts, superscripts, chemical equations, and reaction arrows as readable Unicode/plain text. Never emit broken markup.
8. Use meaningful layouts: concept, formula, diagram, example, comparison, table, mistakes, exam-tips, summary, or quiz as requested.
9. For quiz slides, put the question in content, options in bullets, and the hidden answer in practiceAnswer.
10. Copy only an available figure URL into imageReference; otherwise omit it. Do not invent image URLs.
11. sourcePages and topicIds must exactly reflect the SLOT mapping.
12. ${settings.includeSpeakerNotes ? "Provide full teaching notes with narration, formula meaning, and page references." : "speakerNotes must be an empty string."}
13. ${densityGuidance(settings.density)}
14. ${audienceGuidance(settings.audience)}
15. Language: ${options.language}. Class: ${options.classProfile}. Subject: ${options.subject || "General"}.
16. Source: ${source.label}.

Return only this JSON object:
{
  "slides": [
    {
      "slotId": "slot id",
      "type": "title|concept|formula|diagram|example|comparison|table|mistakes|exam-tips|summary|recap|quiz",
      "title": "meaningful title",
      "content": "useful explanation",
      "bullets": ["substantive point"],
      "formula": "optional readable formula",
      "practiceQuestion": "optional question",
      "practiceAnswer": "optional hidden answer",
      "speakerNotes": "notes or empty string",
      "sourcePages": [1],
      "topicIds": ["topic id"],
      "imageReference": "optional URL",
      "layout": "standard|two-column|visual|formula-focus|quiz"
    }
  ]
}

SLOTS AND SOURCE:
${planText}`;
}

const slideTypes = [
  "title",
  "agenda",
  "section",
  "concept",
  "formula",
  "diagram",
  "example",
  "practice",
  "summary",
  "takeaways",
  "comparison",
  "table",
  "timeline",
  "thanks",
  "quiz",
  "recap",
  "definitions",
  "mistakes",
  "exam-tips",
] as const;

const generatedSlideSchema = z.object({
  slotId: z.string().min(1),
  type: z.enum(slideTypes).catch("concept"),
  title: z.string().min(1).max(200),
  content: z.string().max(4000).default(""),
  bullets: z.array(z.string().min(1).max(500)).max(10).default([]),
  formula: z.string().max(800).optional(),
  practiceQuestion: z.string().max(1200).optional(),
  practiceAnswer: z.string().max(1200).optional(),
  speakerNotes: z.string().max(4000).default(""),
  sourcePages: z.array(z.coerce.number().int().positive()).max(100).default([]),
  topicIds: z.array(z.string()).max(100).default([]),
  imageReference: z.string().max(1000).optional(),
  layout: z
    .enum(["standard", "two-column", "visual", "formula-focus", "quiz"])
    .optional(),
});

export const slideBatchSchema = z.object({
  slides: z.array(generatedSlideSchema).min(1).max(8),
});

export function makeCoverageLedger(
  outline: SlideshowOutlineItem[],
  plans: SlidePlan[],
): SlideshowCoverageItem[] {
  return outline
    .filter((item) => item.included)
    .map((item) => ({
      id: item.id,
      title: item.title,
      sourcePages: item.sourcePages,
      importance: item.importance,
      assignedSlideIds: plans
        .filter((plan) => plan.topicIds.includes(item.id))
        .map((plan) => plan.id),
      covered: false,
      formulas: item.formulas,
      figures: item.figureReferences,
    }));
}

function slideText(slide: Slide): string {
  return [
    slide.title,
    slide.content,
    ...(slide.bullets ?? []),
    slide.formula ?? "",
    slide.practiceQuestion ?? "",
    slide.practiceAnswer ?? "",
  ]
    .join(" ")
    .trim();
}

function hasUsefulContent(slide: Slide, density: SlideshowDensity): boolean {
  if (slide.type === "title") return slide.title.trim().length >= 3;
  const text = slideText(slide);
  const minimumWords: Record<SlideshowDensity, number> = {
    concise: 24,
    balanced: 42,
    detailed: 60,
    "exam-revision": 36,
  };
  return (
    wordCount(text) >= minimumWords[density] &&
    !placeholderText.test(text.trim())
  );
}

function fallbackSlide(plan: SlidePlan, includeSpeakerNotes: boolean): Slide {
  const sentences = plan.sourceText
    .split(/\n|(?<=[.!?])\s+/)
    .map(cleanText)
    .filter((value) => value.length >= 12 && !genericHeading.test(value));
  const bullets = unique([
    ...plan.formulas.slice(0, 2).map((formula) => `Formula: ${formula}`),
    ...sentences.slice(0, 6),
  ])
    .map((value) => shorten(value, 230))
    .slice(0, 7);
  const content =
    plan.type === "title"
      ? "A complete, source-grounded study presentation."
      : shorten(sentences[0] || `This slide covers ${plan.title}.`, 600);
  return newSlide(plan.type, {
    title: shorten(plan.title, 160),
    content,
    bullets: plan.type === "title" ? undefined : bullets,
    formula: plan.formulas[0],
    speakerNotes: includeSpeakerNotes
      ? `Explain the visible points in source order. Refer to ${formatPageRange(plan.sourcePages) || "the selected source"}.`
      : "",
    sourcePages: plan.sourcePages,
    topicIds: plan.topicIds,
    imageReference: plan.figureReferences[0],
    layout:
      plan.type === "diagram"
        ? "visual"
        : plan.type === "formula"
          ? "formula-focus"
          : plan.type === "quiz"
            ? "quiz"
            : "standard",
  });
}

export function parseSlideBatch(
  raw: unknown,
  plans: SlidePlan[],
  includeSpeakerNotes: boolean,
  density: SlideshowDensity = "detailed",
): Slide[] {
  const parsed = slideBatchSchema.safeParse(raw);
  const bySlot = new Map(
    parsed.success
      ? parsed.data.slides.map((slide) => [slide.slotId, slide])
      : [],
  );
  return plans.map((plan) => {
    const candidate = bySlot.get(plan.id);
    if (!candidate) return fallbackSlide(plan, includeSpeakerNotes);
    const allowedImage =
      candidate.imageReference &&
      plan.figureReferences.includes(candidate.imageReference)
        ? candidate.imageReference
        : plan.figureReferences[0];
    const slide = newSlide(candidate.type as SlideType, {
      title: cleanText(candidate.title),
      content: cleanText(candidate.content),
      bullets: candidate.bullets.map(cleanText).filter(Boolean),
      formula: cleanText(candidate.formula) || plan.formulas[0],
      practiceQuestion: cleanText(candidate.practiceQuestion),
      practiceAnswer: cleanText(candidate.practiceAnswer),
      speakerNotes: includeSpeakerNotes
        ? cleanText(candidate.speakerNotes)
        : "",
      sourcePages: plan.sourcePages,
      topicIds: plan.topicIds,
      imageReference: allowedImage,
      layout: candidate.layout,
    });
    return hasUsefulContent(slide, density)
      ? slide
      : fallbackSlide(plan, includeSpeakerNotes);
  });
}

export function validateCoverage(
  slides: Slide[],
  ledger: SlideshowCoverageItem[],
  expectedPages?: number[],
): { ledger: SlideshowCoverageItem[]; report: SlideshowCoverageReport } {
  const topicIds = new Set(slides.flatMap((slide) => slide.topicIds ?? []));
  const pagesCovered = unique(
    slides.flatMap((slide) => slide.sourcePages ?? []),
  ).sort((a, b) => a - b);
  const nextLedger = ledger.map((item) => ({
    ...item,
    covered: topicIds.has(item.id),
  }));
  const allFormulas = unique(ledger.flatMap((item) => item.formulas));
  const normalizedPresentation = slides
    .map(slideText)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, "");
  const includedFormulas = allFormulas.filter((formula) => {
    const normalized = formula.toLowerCase().replace(/\s+/g, "");
    return normalized.length > 1 && normalizedPresentation.includes(normalized);
  });
  const includedFigures = unique(
    slides
      .map((slide) => slide.imageReference)
      .filter((value): value is string => Boolean(value)),
  );
  const allFigures = unique(ledger.flatMap((item) => item.figures));
  const missingFormulas = allFormulas.filter(
    (formula) => !includedFormulas.includes(formula),
  );
  const missingFigures = allFigures.filter(
    (figure) => !includedFigures.includes(figure),
  );
  const allPages = expectedPages?.length
    ? unique(expectedPages).sort((a, b) => a - b)
    : unique(ledger.flatMap((item) => item.sourcePages)).sort((a, b) => a - b);
  const missingTopicIds = nextLedger
    .filter((item) => !item.covered)
    .map((item) => item.id);
  const missingPages = allPages.filter((page) => !pagesCovered.includes(page));
  const totalFormulas = allFormulas.length;
  const totalFigures = allFigures.length;
  const topicCoverage = ledger.length
    ? (ledger.length - missingTopicIds.length) / ledger.length
    : 1;
  const pageCoverage = allPages.length
    ? (allPages.length - missingPages.length) / allPages.length
    : 1;
  const formulaCoverage = allFormulas.length
    ? includedFormulas.length / allFormulas.length
    : 1;
  const percentage = Math.round(
    Math.min(topicCoverage, pageCoverage, formulaCoverage) * 100,
  );
  return {
    ledger: nextLedger,
    report: {
      percentage,
      pagesCovered,
      totalPages: allPages,
      topicsCovered: ledger.length - missingTopicIds.length,
      totalTopics: ledger.length,
      formulasIncluded: includedFormulas.length,
      totalFormulas,
      figuresIncluded: includedFigures.length,
      totalFigures,
      missingTopicIds,
      missingPages,
      missingFormulas,
      missingFigures,
    },
  };
}

export function repairMissingCoverage(
  slides: Slide[],
  outline: SlideshowOutlineItem[],
  report: SlideshowCoverageReport,
): Slide[] {
  if (!report.missingTopicIds.length && !report.missingFormulas.length)
    return slides;
  const missing = outline.filter((item) =>
    report.missingTopicIds.includes(item.id),
  );
  const editableIndices = slides
    .map((slide, index) => ({ slide, index }))
    .filter(({ slide }) => !["title", "thanks", "quiz"].includes(slide.type))
    .map(({ index }) => index);
  if (!editableIndices.length) return slides;
  const next = slides.map((slide) => ({
    ...slide,
    bullets: slide.bullets ? [...slide.bullets] : undefined,
  }));
  missing.forEach((item, index) => {
    const targetIndex = editableIndices[index % editableIndices.length];
    const target = next[targetIndex];
    const bullet = `${item.title}: ${shorten(item.subtopics[0] || item.sourceText, 220)}`;
    target.bullets = unique([...(target.bullets ?? []), bullet]).slice(0, 9);
    target.topicIds = unique([...(target.topicIds ?? []), item.id]);
    target.sourcePages = unique([
      ...(target.sourcePages ?? []),
      ...item.sourcePages,
    ]).sort((a, b) => a - b);
    if (!target.formula && item.formulas[0]) target.formula = item.formulas[0];
  });
  for (let index = 0; index < report.missingFormulas.length; index += 5) {
    const formulas = report.missingFormulas.slice(index, index + 5);
    const targetIndex = editableIndices[(index / 5) % editableIndices.length];
    const target = next[targetIndex];
    target.bullets = unique([
      ...(target.bullets ?? []),
      `Formula summary: ${formulas.join("; ")}`,
    ]);
    if (!target.formula) target.formula = formulas[0];
  }
  return next;
}

export function formatPageRange(pages: number[]): string {
  if (!pages.length) return "";
  const sorted = unique(pages).sort((a, b) => a - b);
  return sorted.length === 1
    ? `Page ${sorted[0]}`
    : `Pages ${sorted[0]}–${sorted[sorted.length - 1]}`;
}

export function compactOutlineForStorage(
  outline: SlideshowOutlineItem[],
): SlideshowOutlineItem[] {
  return outline.map((item) => ({
    ...item,
    sourceText: shorten(item.sourceText, 900),
  }));
}
