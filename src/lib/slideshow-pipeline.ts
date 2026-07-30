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
  type SlideshowQualityIssue,
  type SlideshowQualityReport,
} from "./slideshow";

export type NormalizedSlideshowIntent = {
  title: string;
  subtitle?: string;
  subject?: string;
  classLevel?: string;
  chapter?: string;
  presentationGoal: string;
  requestedModes: string[];
};

const instructionLeakage = /\b(?:create|make|generate|prepare|build)\s+(?:me\s+)?(?:a\s+)?(?:presentation|slideshow|slide deck)\b|\bi want (?:a\s+)?(?:presentation|slideshow)\b|\bexplain (?:the )?chapter\b/i;

export function containsInstructionLeakage(value: string): boolean {
  return instructionLeakage.test(cleanText(value));
}

export function normalizeSlideshowIntent(options: {
  userInstruction?: string;
  subject?: string;
  classLevel?: string;
  chapter?: string;
  sourceTitle?: string;
}): NormalizedSlideshowIntent {
  const instruction = cleanText(options.userInstruction);
  let inferred = cleanText(options.chapter || options.sourceTitle);
  if (!inferred && instruction) {
    const chapterMatch = instruction.match(/(?:chapter\s*:?\s*)?["“]?([A-Z][\w\s,'’()\-]{3,80})["”]?\s*$/i);
    inferred = cleanText(chapterMatch?.[1] || instruction)
      .replace(/^(?:create|make|generate|prepare|build)\s+(?:me\s+)?(?:a\s+)?(?:presentation|slideshow|slide deck)\s+(?:on|about|for)\s+/i, "")
      .replace(/^class\s*\d+\s+(?:chemistry|physics|mathematics|computer science)\s*[-—:]\s*/i, "");
  }
  const title = shorten(inferred || options.subject || "Study Presentation", 90);
  const classLevel = cleanText(options.classLevel);
  const subject = cleanText(options.subject);
  return {
    title,
    subtitle: [classLevel, subject].filter(Boolean).join(" ") || undefined,
    subject: subject || undefined,
    classLevel: classLevel || undefined,
    chapter: cleanText(options.chapter) || undefined,
    presentationGoal: "Teach the selected source completely in source order",
    requestedModes: [],
  };
}

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
  targetWordCount?: number;
  layoutHint?: string;
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

function isCredibleSourceFormula(value: string): boolean {
  const formula = cleanText(value);
  return formula.length >= 3 && formula.length <= 180 && wordCount(formula) <= 24 && !/^(?:answer|solution|given|therefore|hence)\s*:/i.test(formula) && /(?:=|→|⇌|≥|≤|×|\^|\d\s*[A-Za-z]+\s*[+→])/u.test(formula);
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
          .filter(isCredibleSourceFormula),
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
        segments: sections.map((section) => ({ type: section.type ?? "paragraph", text: cleanText(section.text) })).filter((section) => section.text),
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
    (value) => value.length >= 4 && value.length <= 82 && wordCount(value) <= 10 && !/^(?:day\s*\d+|page\s*\d+|keep it in mind|board question|homework|try yourself|space for keynotes|know your heroes)$/i.test(value),
  );
  if (heading) return heading;
  const firstSentence = page.text
    .split(/(?<=[.!?])\s+|\n/)
    .find((value) => value.trim().length >= 5);
  if (firstSentence) return shorten(firstSentence.replace(/[.!?]+$/, ""), 72);
  if (page.chapterTitle) return `${page.chapterTitle} — Page ${page.pageNumber}`;
  return `Source page ${page.pageNumber}`;
}

export function analyseSourcePages(
  pages: SlideshowSourcePage[],
): SlideshowOutlineItem[] {
  const outline: SlideshowOutlineItem[] = [];
  const ignoredHeading = /^(?:day\s*\d+|page\s*\d+|keep it in mind|board question|homework|try yourself|space for keynotes|know your heroes|structure of atom)$/i;
  const credibleHeading = (value: string) => {
    const text = cleanText(value).replace(/^\[Figure\]\s*/i, "");
    const words = wordCount(text);
    const upper = text === text.toUpperCase() && /[A-Z]{3}/.test(text);
    return text.length >= 4 && text.length <= 82 && words <= 10 && !genericHeading.test(text) && !ignoredHeading.test(text) && !/^\d+[.)]/.test(text) && (upper || /^(?:discovery|properties|rutherford|thomson|bohr|radioactivity|electromagnetic|quantum|atomic|electronic|limitations|observations|conclusions)/i.test(text));
  };
  const titleCase = (value: string) => cleanText(value).toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()).replace(/\b(Of|The|And|In|To|For)\b/g, (word) => word.toLowerCase());

  pages.forEach((page) => {
    const segments = page.segments?.length ? page.segments : [{ type: "paragraph", text: page.text }];
    const groups: Array<{ title: string; parts: string[]; formulas: string[]; figures: string[] }> = [];
    let current: { title: string; parts: string[]; formulas: string[]; figures: string[] } | null = null;
    const fallbackTitle = bestPageTitle(page);
    const start = (title: string) => {
      if (current?.parts.length) groups.push(current);
      current = { title: titleCase(title), parts: [], formulas: [], figures: [] };
    };
    for (const segment of segments) {
      if (segment.type === "subheading" && credibleHeading(segment.text)) {
        start(segment.text);
        continue;
      }
      if (!current) current = { title: fallbackTitle, parts: [], formulas: [], figures: [] };
      if (!ignoredHeading.test(segment.text) && !genericHeading.test(segment.text)) current.parts.push(segment.text);
      if (segment.type === "formula" && isCredibleSourceFormula(segment.text)) current.formulas.push(segment.text);
      if (segment.type === "diagram") current.figures.push(...page.figures.map((figure) => figure.imageUrl).filter((value): value is string => Boolean(value)));
    }
    if (current?.parts.length) groups.push(current);
    if (!groups.length) groups.push({ title: fallbackTitle, parts: [page.text], formulas: page.formulas, figures: page.figures.map((figure) => figure.imageUrl).filter((value): value is string => Boolean(value)) });

    groups.forEach((group, groupIndex) => {
      const sourceText = cleanText(group.parts.join("\n"));
      if (wordCount(sourceText) < 4) return;
      const subtopics = unique(group.parts.filter((part) => part.length >= 4 && part.length <= 130)).slice(0, 10);
      const formulas = unique([...group.formulas, ...page.formulas.filter((formula) => sourceText.includes(formula))]);
      const figures = unique(group.figures);
      outline.push({
        id: `topic-page-${page.pageNumber}-${groupIndex + 1}`,
        title: shorten(group.title, 82),
        sourcePages: [page.pageNumber],
        subtopics: subtopics.length ? subtopics : [group.title],
        importance: formulas.length || figures.length || /experiment|model|principle|discovery|conclusion/i.test(group.title) ? "core" : wordCount(sourceText) > 100 ? "important" : "supporting",
        included: true,
        sourceText,
        formulas,
        figureReferences: figures,
      });
    });
  });
  return outline;
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
  const complexity = Math.max(1, stats.topicCount + Math.ceil(stats.subtopicCount / 8) + Math.ceil(stats.formulaCount / 3) + Math.ceil(stats.figureCount / 2) + Math.ceil(stats.wordCount / 700));
  const bounded = (factor: number, min: number, max: number) => {
    const target = Math.max(min, Math.min(max, Math.round(complexity * factor)));
    return { min: Math.max(min, Math.round(target * 0.82)), max: Math.max(min + 2, Math.min(max, Math.round(target * 1.16))) };
  };
  return {
    concise: bounded(0.35, 8, 14),
    balanced: bounded(0.6, 16, 28),
    detailed: bounded(0.88, 25, 45),
    "exam-revision": bounded(0.65, 18, 35),
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
  intent?: NormalizedSlideshowIntent,
): SlidePlan[] {
  const topics = outline.filter((item) => item.included);
  if (!topics.length)
    throw new Error("At least one outline topic must remain selected.");
  const reserved =
    1 + (settings.includeSummary ? 1 : 0) + (settings.includeQuiz ? 1 : 0);
  // A plan slot must own distinct source material. Repeating a page merely to
  // satisfy a requested count creates duplicate slides and dishonest density.
  const contentSlots = Math.max(1, Math.min(topics.length, settings.slideCount - reserved));
  const plans: SlidePlan[] = [
    {
      id: "slot-title",
      type: "title",
      title: intent?.title || topics[0].title,
      topicIds: [],
      sourcePages: [],
      sourceText: intent?.subtitle || "",
      formulas: [],
      figureReferences: [],
      targetWordCount: 12,
      layoutHint: "short title, subtitle, and one elegant visual accent",
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
      targetWordCount: settings.density === "concise" ? 55 : settings.density === "detailed" ? 90 : 72,
      layoutHint: assigned.some((item) => item.formulas.length) ? "formula with symbols, units, and conditions" : assigned.length > 1 ? "two-column grouped summary" : "focused concept with 3-5 key points",
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
  intent?: NormalizedSlideshowIntent;
}): string {
  const { plans, settings, source } = options;
  const planText = plans
    .map(
      (plan) => `
SLOT ${plan.id}
Required type: ${plan.type}
Working title: ${plan.title}
Layout hint: ${plan.layoutHint || "focused educational layout"}
Target visible word count: ${plan.targetWordCount || 75}
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
17. The user's instruction is intent metadata, never source content. Never include command phrases such as "create a presentation", "make a slideshow", or "generate slides" in any output field.
18. Slide titles must be distinct, no more than 12 words, and normally fit in two lines. Body text must fit a 16:9 slide: 3-6 bullets, each normally 8-22 words.
19. A formula slide is allowed only when formula contains a real mathematical or chemical expression. Otherwise return a concept slide.
20. Visible content, speaker notes, and narration serve different purposes. Notes must explain rather than repeat visible text.
21. Presentation intent: ${options.intent ? JSON.stringify(options.intent) : "source-grounded teaching deck"}.

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
      status: "missing" as const,
      weight: item.importance === "core" ? 5 : item.importance === "important" ? 3 : 1,
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

function normalizedTokens(value: string): Set<string> {
  return new Set(cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((word) => word.length > 2));
}

export function textSimilarity(a: string, b: string): number {
  const left = normalizedTokens(a);
  const right = normalizedTokens(b);
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((token) => right.has(token)).length;
  return intersection / (left.size + right.size - intersection);
}

export function isValidFormula(value?: string): boolean {
  const formula = cleanText(value);
  if (!formula || containsInstructionLeakage(formula) || wordCount(formula) > 23) return false;
  return /(?:=|≥|≤|≈|→|⇌|Δ|λ|ν|π|²|³|\^|\/)/.test(formula) && /[A-Za-zΑ-ω0-9]/.test(formula);
}

export type SlideFitResult = {
  fits: boolean;
  overflowScore: number;
  reasons: string[];
  suggestedAction: "none" | "shorten" | "two-column" | "split" | "change-layout";
};

export function validateSlideFit(slide: Slide): SlideFitResult {
  const reasons: string[] = [];
  const titleWords = wordCount(slide.title);
  const contentWords = wordCount(slide.content || "");
  const bullets = slide.bullets ?? [];
  if (titleWords > 12 || slide.title.length > 90) reasons.push("Title exceeds the two-line safe limit");
  if (contentWords > 85) reasons.push("Body paragraph is too long");
  if (bullets.length > 6) reasons.push("More than six bullets");
  if (bullets.some((bullet) => wordCount(bullet) > 24)) reasons.push("A bullet is too long");
  if (slide.type === "formula" && !isValidFormula(slide.formula)) reasons.push("Formula slide has no valid expression");
  const overflowScore = Math.min(100, reasons.length * 22 + Math.max(0, contentWords - 70) + Math.max(0, bullets.length - 5) * 8);
  return { fits: reasons.length === 0, overflowScore, reasons, suggestedAction: !reasons.length ? "none" : bullets.length > 6 || contentWords > 100 ? "split" : titleWords > 12 ? "shorten" : "two-column" };
}

function cleanInstructionText(value: string): string {
  if (!containsInstructionLeakage(value)) return cleanText(value);
  return cleanText(value)
    .replace(/(?:create|make|generate|prepare|build)\s+(?:me\s+)?(?:a\s+)?(?:presentation|slideshow|slide deck)\s+(?:on|about|for)\s+/gi, "")
    .replace(/\bi want (?:a\s+)?(?:presentation|slideshow)\s+(?:on|about|for)?\s*/gi, "");
}

function collapseRepeatedTitle(value: string): string {
  const parts = cleanInstructionText(value).split(/\s+[—–]\s+/).map(cleanText).filter(Boolean);
  const kept: string[] = [];
  for (const part of parts) {
    if (!kept.some((existing) => existing.toLowerCase() === part.toLowerCase() || textSimilarity(existing, part) > 0.92)) kept.push(part);
  }
  return shorten(kept.join(" — ") || cleanInstructionText(value), 90);
}

function shortenByWords(value: string, maxWords: number, maxChars: number): string {
  const cleaned = cleanText(value);
  const words = cleaned.split(/\s+/).filter(Boolean);
  const wordSafe =
    words.length > maxWords ? `${words.slice(0, maxWords).join(" ")}…` : cleaned;
  return shorten(wordSafe, maxChars);
}

function fitSlide(slide: Slide): Slide {
  const title = shortenByWords(collapseRepeatedTitle(slide.title), 12, 88);
  const content = shortenByWords(
    cleanInstructionText(slide.content || ""),
    82,
    500,
  );
  const bullets = unique(
    (slide.bullets ?? [])
      .map((bullet) =>
        shortenByWords(cleanInstructionText(bullet), 23, 155),
      )
      .filter(Boolean),
  ).slice(0, 6);
  const formulaValid = isValidFormula(slide.formula);
  const type = slide.type === "formula" && !formulaValid ? "concept" : slide.type;
  const notes = cleanInstructionText(slide.speakerNotes || "");
  return {
    ...slide,
    type,
    title,
    content: content.toLowerCase().startsWith(title.toLowerCase()) ? cleanText(content.slice(title.length).replace(/^\s*[:—-]\s*/, "")) : content,
    bullets,
    formula: formulaValid ? cleanText(slide.formula) : undefined,
    speakerNotes: notes && textSimilarity(notes, [content, ...bullets].join(" ")) < 0.86 ? notes : `Explain the idea in source order, connect it to the previous slide, and clarify why it matters.`,
    layout: bullets.length > 4 && !slide.layout ? "two-column" : slide.layout,
  };
}

export function finalizeSlides(slides: Slide[], intent?: NormalizedSlideshowIntent): Slide[] {
  const usedTitles: string[] = [];
  return slides.map((raw, index) => {
    let slide = fitSlide(raw);
    if (index === 0 && intent) {
      slide = { ...slide, type: "title", title: intent.title, content: intent.subtitle || slide.content, bullets: undefined, formula: undefined };
    }
    if (usedTitles.some((title) => textSimilarity(title, slide.title) > 0.82)) {
      const page = slide.sourcePages?.[0];
      slide = {
        ...slide,
        title: shortenByWords(
          `${slide.title.replace(/\s*\(Part \d+\)$/i, "")} — ${page ? `Page ${page}` : `Part ${index + 1}`}`,
          12,
          88,
        ),
      };
    }
    usedTitles.push(slide.title);
    return slide;
  });
}

export function repairSlideQuality(slides: Slide[], intent?: NormalizedSlideshowIntent): Slide[] {
  const fitted = finalizeSlides(slides, intent);
  const kept: Slide[] = [];
  for (const slide of fitted) {
    if (slide.type === "title") {
      if (!kept.some((item) => item.type === "title")) kept.push(slide);
      continue;
    }
    const duplicate = kept.some((previous) => {
      if (["summary", "recap", "quiz"].includes(slide.type) || ["summary", "recap", "quiz"].includes(previous.type)) return false;
      const sameMapping = Boolean(slide.topicIds?.some((id) => previous.topicIds?.includes(id))) || Boolean(slide.sourcePages?.some((page) => previous.sourcePages?.includes(page)));
      return sameMapping && (textSimilarity(previous.title, slide.title) > 0.82 || textSimilarity(slideText(previous), slideText(slide)) > 0.82);
    });
    if (!duplicate) kept.push(slide);
  }
  return finalizeSlides(kept, intent);
}

export function assessSlideshowQuality(slides: Slide[], coveragePercentage = 0): SlideshowQualityReport {
  const issues: SlideshowQualityIssue[] = [];
  slides.forEach((slide, index) => {
    const text = slideText(slide);
    if (containsInstructionLeakage(text)) issues.push({ slideId: slide.id, severity: "critical", category: "instruction", message: `Slide ${index + 1} contains generation instructions.` });
    const fit = validateSlideFit(slide);
    if (!fit.fits) issues.push({ slideId: slide.id, severity: "warning", category: "overflow", message: `Slide ${index + 1}: ${fit.reasons.join("; ")}.` });
    if (slide.type !== "title" && wordCount(text) < 16) issues.push({ slideId: slide.id, severity: "warning", category: "content", message: `Slide ${index + 1} is too thin to teach its topic.` });
    if (!(slide.sourcePages?.length || slide.topicIds?.length) && slide.type !== "title") issues.push({ slideId: slide.id, severity: "warning", category: "source", message: `Slide ${index + 1} has no source mapping.` });
    for (let previous = 0; previous < index; previous += 1) {
      if (textSimilarity(slides[previous].title, slide.title) > 0.82 || textSimilarity(slideText(slides[previous]), text) > 0.86) {
        issues.push({ slideId: slide.id, severity: "warning", category: "duplicate", message: `Slide ${index + 1} substantially repeats slide ${previous + 1}.` });
        break;
      }
    }
  });
  const critical = issues.filter((issue) => issue.severity === "critical").length;
  const overflowCount = issues.filter((issue) => issue.category === "overflow").length;
  const duplicateCount = issues.filter((issue) => issue.category === "duplicate").length;
  const readability = Math.max(0, 100 - overflowCount * 8);
  const groundingIssues = issues.filter((issue) => issue.category === "source" || issue.category === "instruction").length;
  const sourceGrounding = Math.max(0, 100 - groundingIssues * 12);
  const score = Math.max(0, Math.round(coveragePercentage * 0.35 + readability * 0.3 + sourceGrounding * 0.25 + Math.max(0, 100 - duplicateCount * 12) * 0.1));
  return { passed: critical === 0 && overflowCount === 0 && score >= 80, score, contentCoverage: coveragePercentage, readability, sourceGrounding, duplicateContent: duplicateCount, overflowCount, issues };
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
    .map((value) => value.replace(/^\[[^\]]+\]\s*/, ""))
    .filter((value) => value.length >= 12 && !genericHeading.test(value) && textSimilarity(value, plan.title) < 0.78 && !/^(?:keep it in mind|board question|homework|try yourself|page\s*\d+)/i.test(value));
  const bullets = unique([
    ...plan.formulas.filter(isValidFormula).slice(0, 2).map((formula) => `Formula: ${formula}`),
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
    formula: plan.formulas.find(isValidFormula),
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
    status: topicIds.has(item.id) ? "covered" as const : "missing" as const,
  }));
  // OCR can misclassify complete prose lines as equations. Only expressions
  // that the slide renderer accepts should affect formula coverage.
  const allFormulas = unique(
    ledger.flatMap((item) => item.formulas).filter(isValidFormula),
  );
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
  const totalTopicWeight = ledger.reduce((sum, item) => sum + (item.weight ?? (item.importance === "core" ? 5 : item.importance === "important" ? 3 : 1)), 0);
  const coveredTopicWeight = nextLedger.filter((item) => item.covered).reduce((sum, item) => sum + (item.weight ?? (item.importance === "core" ? 5 : item.importance === "important" ? 3 : 1)), 0);
  const topicCoverage = totalTopicWeight
    ? coveredTopicWeight / totalTopicWeight
    : 1;
  const pageCoverage = allPages.length
    ? (allPages.length - missingPages.length) / allPages.length
    : 1;
  const formulaCoverage = allFormulas.length
    ? includedFormulas.length / allFormulas.length
    : 1;
  const figureCoverage = allFigures.length ? includedFigures.length / allFigures.length : 1;
  const percentage = Math.round(Math.min(1, topicCoverage * 0.5 + pageCoverage * 0.25 + formulaCoverage * 0.15 + figureCoverage * 0.1) * 100);
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
  const next: Slide[] = slides.map((slide) => ({
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
    const formulas = report.missingFormulas
      .slice(index, index + 5)
      .filter(isValidFormula);
    if (!formulas.length) continue;
    const relatedTopicIds = outline
      .filter((item) =>
        formulas.some((formula) => item.formulas.includes(formula)),
      )
      .map((item) => item.id);
    const relatedIndex = editableIndices.find((slideIndex) =>
      next[slideIndex].topicIds?.some((topicId) =>
        relatedTopicIds.includes(topicId),
      ),
    );
    const targetIndex =
      relatedIndex ??
      editableIndices[(index / 5) % editableIndices.length];
    const target = next[targetIndex];
    target.bullets = unique([...(target.bullets ?? []), ...formulas]).slice(
      0,
      6,
    );
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
