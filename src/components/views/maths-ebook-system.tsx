"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookMarked,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  Eye,
  FileQuestion,
  FileText,
  Filter,
  FlaskConical,
  Highlighter,
  Library,
  List,
  Loader2,
  Maximize2,
  MessageSquareText,
  Minus,
  Moon,
  MoreHorizontal,
  NotebookPen,
  Pause,
  Play,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Sun,
  Volume2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Markdown } from "@/lib/shared";
import { askAI } from "@/lib/ai";
import { profileGetItem, profileSetItem } from "@/lib/profile-storage";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  InlineAIAnswer,
  type InlineAIStatus,
} from "@/components/ebook/inline-ai-answer";
import {
  BookModeReader,
  type BookModeBookmark,
} from "@/components/ebook/book-mode-reader";

type SectionType =
  | "heading"
  | "subheading"
  | "paragraph"
  | "definition"
  | "note"
  | "formula"
  | "example"
  | "classwork"
  | "homework"
  | "try-yourself"
  | "case-study"
  | "mcq"
  | "question"
  | "diagram"
  | "table"
  | "keynote-space";
type EbookSection = {
  id: string;
  type: SectionType;
  text: string;
  sourcePage: number;
  order: number;
  questionIds?: string[];
};
type EbookPage = {
  id: string;
  chapterId: string;
  chapterTitle: string;
  day?: number | null;
  originalPageNumber: number;
  textPdfPageNumber: number;
  mappedScannedPages: number[];
  title?: string;
  sections: EbookSection[];
  rawText: string;
};
type EbookQuestion = {
  id: string;
  chapterId: string;
  chapterTitle: string;
  sourcePage: number;
  textPage: number;
  section: "classwork" | "homework" | "try-yourself" | "case-study";
  questionNumber: string;
  questionType: string;
  prompt: string;
  options?: string[];
  correctOption?: number | null;
  answerExplanation?: string;
  diagramRef?: string | null;
  sourceLabel?: string | null;
  difficulty: "easy" | "medium" | "hard";
  topicTags: string[];
};
type EbookData = {
  dataVersion: number;
  book: {
    id: string;
    title: string;
    subject: string;
    pageCountScanned: number;
    pageCountText: number;
    scannedPdfPath: string;
    textPdfPath: string;
    version: number;
  };
  pageMap: Array<{
    scannedPage: number;
    textPage: number;
    chapterId: string;
    sectionIds: string[];
  }>;
  pages: EbookPage[];
  questions: EbookQuestion[];
  counts: Record<string, number>;
  uncertainExtractionItems: string[];
};

type Highlight = {
  id: string;
  pageId: string;
  sectionId: string;
  selectedText: string;
  startOffset: number;
  endOffset: number;
  color: string;
  createdAt: string;
  note?: string;
};
type BookNote = {
  id: string;
  pageId: string;
  sectionId?: string;
  text: string;
  createdAt: string;
};
type Attempt = {
  id: string;
  questionId: string;
  answer: string;
  status: "draft" | "submitted" | "correct" | "partially-correct" | "incorrect";
  selectedOption?: number;
  feedback?: string;
  attemptedAt: string;
  aiAnswer?: string;
  deeperAnswer?: string;
};
type SavedAIAnswer = {
  id: string;
  subjectId: string;
  ebookId: string;
  chapterId: string;
  questionId: string;
  questionText: string;
  answer: string;
  createdAt: string;
  updatedAt: string;
};
type InlineAIEntry = {
  status: InlineAIStatus;
  answer?: string;
  error?: string;
};
type ReaderState = {
  source: "scan" | "text";
  scannedPage: number;
  textPage: number;
  bookmarks: string[];
  highlights: Highlight[];
  notes: BookNote[];
  attempts: Record<string, Attempt>;
  revision: string[];
  completedQuestions: string[];
  studiedPages: number[];
  readingSeconds: number;
  aiHistory: Array<{
    id: string;
    label: string;
    content: string;
    page: number;
    createdAt: string;
  }>;
  savedAIAnswers: Record<string, SavedAIAnswer>;
  pageBookmarks: BookModeBookmark[];
};

type EbookSystemConfig = {
  bookKey: string;
  dataUrl: string;
  title: string;
  subject: string;
  subtitle: string;
  description: string;
  coverImage: string;
  scanPageDir?: string;
  cleanPageDir?: string;
  renderPdfDirectly?: boolean;
  defaultSource: "scan" | "text";
  defaultScanPage: number;
  defaultTextPage: number;
  chapters: Array<{
    id: string;
    title: string;
    textPage: number;
    scanPage: number;
  }>;
};

const MATHS_CONFIG: EbookSystemConfig = {
  bookKey: "ebook:class11-maths-part1:v1",
  dataUrl: "/content/ebooks/class11-maths-part1/book-v1.json",
  title: "Mathematics Part 1",
  subject: "Mathematics",
  subtitle: "Sets · Relations and Functions",
  description:
    "A synchronized intelligent textbook for Sets and Relations and Functions. Printed text comes from the clean PDF; handwriting remains visible only in Original Scan.",
  coverImage: "/ebook-pages-maths/page-001.png",
  scanPageDir: "ebook-pages-maths",
  cleanPageDir: "ebook-pages-maths-clean",
  defaultSource: "scan",
  defaultScanPage: 1,
  defaultTextPage: 2,
  chapters: [
    { id: "sets", title: "Sets", textPage: 2, scanPage: 1 },
    {
      id: "relations-and-functions",
      title: "Relations and Functions",
      textPage: 17,
      scanPage: 17,
    },
  ],
};

const CHEMISTRY_CONFIG: EbookSystemConfig = {
  bookKey: "ebook:class11-chemistry-part1:v1",
  dataUrl: "/content/ebooks/class11-chemistry-part1/book-v1.json",
  title: "Chemistry Part 1",
  subject: "Chemistry",
  subtitle: "Some Basic Concepts of Chemistry · Structure of Atom",
  description:
    "The complete Chemistry Part 1 book with its selectable reconstructed edition as the default reader and the untouched original scan available for reference.",
  coverImage: "/ebook-pages-chemistry/page-001.png",
  scanPageDir: "ebook-pages-chemistry",
  cleanPageDir: "ebook-pages-chemistry-clean",
  defaultSource: "text",
  defaultScanPage: 1,
  defaultTextPage: 1,
  chapters: [
    {
      id: "some-basic-concepts-of-chemistry",
      title: "Some Basic Concepts of Chemistry",
      textPage: 2,
      scanPage: 1,
    },
    {
      id: "structure-of-atom",
      title: "Structure of Atom",
      textPage: 38,
      scanPage: 27,
    },
  ],
};

function createDefaultState(config: EbookSystemConfig): ReaderState {
  return {
    source: config.defaultSource,
    scannedPage: config.defaultScanPage,
    textPage: config.defaultTextPage,
    bookmarks: [],
    highlights: [],
    notes: [],
    attempts: {},
    revision: [],
    completedQuestions: [],
    studiedPages: [],
    readingSeconds: 0,
    aiHistory: [],
    savedAIAnswers: {},
    pageBookmarks: [],
  };
}
const NAV = [
  "Library",
  "Reader",
  "Questions",
  "Book Notes",
  "Highlights",
  "Bookmarks",
  "AI Study",
  "Reading Progress",
] as const;
type Nav = (typeof NAV)[number];

function readState(config: EbookSystemConfig): ReaderState {
  const defaults = createDefaultState(config);
  try {
    return {
      ...defaults,
      ...JSON.parse(profileGetItem(11, config.bookKey) ?? "{}"),
    };
  } catch {
    return defaults;
  }
}

function ScanPage({
  page,
  zoom,
  pageDir = "ebook-pages-maths",
  label = "Original scanned",
  bookTitle = "Mathematics Part 1",
}: {
  page: number;
  zoom: number;
  pageDir?: string;
  label?: string;
  bookTitle?: string;
}) {
  return (
    <div
      className="mx-auto overflow-auto rounded-2xl bg-black/30 p-2 shadow-2xl"
      style={{ maxWidth: `${Math.max(60, zoom * 100)}%` }}
    >
      {/* The scanned image is deliberately displayed without OCR overlays so handwritten marks stay visual-only. */}
      <img
        loading="lazy"
        decoding="async"
        src={`/${pageDir}/page-${String(page).padStart(3, "0")}.png`}
        alt={`${label} ${bookTitle} page ${page}`}
        className="h-auto w-full rounded-xl bg-white"
        draggable={false}
      />
    </div>
  );
}

function PdfDocument({
  src,
  page,
  zoom,
  title,
}: {
  src: string;
  page: number;
  zoom: number;
  title: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const viewerUrl = `${src}#page=${page}&zoom=${Math.round(zoom * 100)}`;
  return (
    <div className="relative h-[calc(100dvh-14.5rem)] min-h-[420px] w-full overflow-hidden bg-white">
      {!loaded && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-[#101522] text-sm text-white/60">
          <span className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-400" /> Loading
            PDF…
          </span>
        </div>
      )}
      <iframe
        key={viewerUrl}
        src={viewerUrl}
        title={`${title}, page ${page}`}
        onLoad={() => setLoaded(true)}
        className="h-full w-full border-0"
      />
      <noscript>
        <a href={viewerUrl}>Open {title}</a>
      </noscript>
    </div>
  );
}

function labelForSection(type: SectionType) {
  return (
    {
      "try-yourself": "Try Yourself",
      "case-study": "Case Study",
      classwork: "Classwork",
      homework: "Homework",
      definition: "Definition",
      formula: "Formula",
      note: "Note",
      example: "Example",
    } as Partial<Record<SectionType, string>>
  )[type];
}

function MathsSection({
  section,
  highlights,
  onAction,
}: {
  section: EbookSection;
  highlights: Highlight[];
  onAction: (action: string, section: EbookSection) => void;
}) {
  const saved = highlights.filter(
    (highlight) => highlight.sectionId === section.id,
  );
  const text = section.text;
  const parts: Array<{ text: string; color?: string }> = [];
  let cursor = 0;
  for (const item of [...saved].sort((a, b) => a.startOffset - b.startOffset)) {
    const start = text.indexOf(
      item.selectedText,
      Math.max(0, item.startOffset - 4),
    );
    if (start < cursor || start < 0) continue;
    if (start > cursor) parts.push({ text: text.slice(cursor, start) });
    parts.push({
      text: text.slice(start, start + item.selectedText.length),
      color: item.color,
    });
    cursor = start + item.selectedText.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  const label = labelForSection(section.type);
  const emphasized = [
    "definition",
    "formula",
    "note",
    "example",
    "classwork",
    "homework",
    "try-yourself",
    "case-study",
  ].includes(section.type);
  return (
    <section
      data-section-id={section.id}
      className={cn(
        "group relative rounded-2xl border px-4 py-3 transition",
        emphasized
          ? "border-indigo-400/20 bg-indigo-500/[0.045]"
          : "border-transparent hover:border-slate-300/40 hover:bg-slate-500/[0.035]",
      )}
    >
      {label && (
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-500 dark:text-indigo-300">
          {label}
        </p>
      )}
      <p
        className={cn(
          "whitespace-pre-wrap text-[1em] leading-[inherit]",
          section.type === "subheading" && "text-lg font-bold",
          section.type === "formula" &&
            "overflow-x-auto font-mono text-[0.95em]",
        )}
      >
        {(parts.length ? parts : [{ text }]).map((part, index) =>
          part.color ? (
            <mark
              key={index}
              style={{ backgroundColor: part.color }}
              className="rounded px-0.5 text-inherit"
            >
              {part.text}
            </mark>
          ) : (
            <span key={index}>{part.text}</span>
          ),
        )}
      </p>
      <div className="mt-2 flex flex-wrap gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        {[
          "Explain",
          "Simplify",
          "Add to Notes",
          "Create flashcard",
          "Bookmark",
        ].map((action) => (
          <button
            key={action}
            onClick={() => onAction(action, section)}
            className="rounded-full border border-slate-400/20 px-2 py-1 text-[10px] hover:bg-indigo-500/10"
          >
            {action}
          </button>
        ))}
      </div>
    </section>
  );
}

function McqOptions({
  question,
  attempt,
  onSelect,
  onRetry,
}: {
  question: EbookQuestion;
  attempt?: Attempt;
  onSelect: (index: number) => void;
  onRetry: () => void;
}) {
  if (!question.options?.length) return null;
  const answered = attempt?.selectedOption !== undefined;
  const ambiguous = answered && question.correctOption == null;
  return (
    <div className="mt-4">
      <div
        className="grid gap-2 sm:grid-cols-2"
        role="radiogroup"
        aria-label={`Options for ${question.section} ${question.questionNumber}`}
      >
        {question.options.map((option, index) => {
          const selected = attempt?.selectedOption === index;
          const correct = answered && question.correctOption === index;
          const wrong =
            answered &&
            selected &&
            question.correctOption !== null &&
            question.correctOption !== index;
          return (
            <button
              key={`${question.id}-option-${index}`}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={answered}
              onClick={() => onSelect(index)}
              className={cn(
                "group flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm shadow-lg backdrop-blur-xl transition-all",
                !answered &&
                  "border-white/12 bg-white/[0.055] hover:-translate-y-0.5 hover:border-indigo-300/40 hover:bg-indigo-500/10 hover:shadow-indigo-500/10",
                correct &&
                  "border-emerald-300/70 bg-emerald-500/20 text-emerald-50 shadow-emerald-500/15",
                wrong &&
                  "border-rose-300/70 bg-rose-500/20 text-rose-50 shadow-rose-500/15",
                answered &&
                  !correct &&
                  !wrong &&
                  "border-white/8 bg-white/[0.025] text-white/35",
                ambiguous &&
                  selected &&
                  "border-amber-300/70 bg-amber-500/20 text-amber-50",
              )}
            >
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/20 font-bold",
                  correct && "border-emerald-300/50 bg-emerald-400/20",
                  wrong && "border-rose-300/50 bg-rose-400/20",
                  ambiguous &&
                    selected &&
                    "border-amber-300/50 bg-amber-400/20",
                )}
              >
                {correct ? (
                  <Check className="h-4 w-4" />
                ) : wrong ? (
                  <X className="h-4 w-4" />
                ) : (
                  String.fromCharCode(65 + index)
                )}
              </span>
              <span className="leading-5">
                {option.replace(/^[A-E]\.\s*/, "")}
              </span>
            </button>
          );
        })}
      </div>
      {answered && (
        <div
          role="status"
          className={cn(
            "mt-3 rounded-2xl border p-3 text-sm backdrop-blur-xl",
            attempt.status === "correct"
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
              : attempt.status === "incorrect"
                ? "border-rose-400/30 bg-rose-500/10 text-rose-100"
                : "border-amber-400/30 bg-amber-500/10 text-amber-100",
          )}
        >
          <div className="flex items-start gap-2">
            {attempt.status === "correct" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : attempt.status === "incorrect" ? (
              <X className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div className="flex-1">
              <p className="font-bold">
                {attempt.status === "correct"
                  ? "Correct"
                  : attempt.status === "incorrect"
                    ? "Incorrect - the correct option is highlighted in green"
                    : "The printed source has no matching option"}
              </p>
              <p className="mt-1 opacity-80">{attempt.feedback}</p>
            </div>
            <button
              onClick={onRetry}
              className="rounded-lg border border-current/20 px-2 py-1 text-xs hover:bg-white/10"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function MathsEbookSystem({ onBack }: { onBack: () => void }) {
  return <EnhancedEbookSystem config={MATHS_CONFIG} onBack={onBack} />;
}

export function ChemistryEbookSystem({ onBack }: { onBack: () => void }) {
  return <EnhancedEbookSystem config={CHEMISTRY_CONFIG} onBack={onBack} />;
}

function EnhancedEbookSystem({
  onBack,
  config,
}: {
  onBack: () => void;
  config: EbookSystemConfig;
}) {
  const scholarClass = useStore((state) => state.user.scholarClass);
  const addNoteToScholar = useStore((state) => state.addNote);
  const [data, setData] = useState<EbookData | null>(null);
  const [state, setState] = useState<ReaderState>(() =>
    createDefaultState(config),
  );
  const [nav, setNav] = useState<Nav>("Reader");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [questionSearch, setQuestionSearch] = useState("");
  const [chapterFilter, setChapterFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fontSize, setFontSize] = useState(17);
  const [lineHeight, setLineHeight] = useState(1.72);
  const [readingWidth, setReadingWidth] = useState(780);
  const [readerTheme, setReaderTheme] = useState<"light" | "dark" | "sepia">(
    "light",
  );
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [selection, setSelection] = useState<{
    text: string;
    sectionId: string;
    start: number;
    end: number;
    x: number;
    y: number;
  } | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTitle, setAiTitle] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [answerQuestion, setAnswerQuestion] = useState<EbookQuestion | null>(
    null,
  );
  const [draftAnswer, setDraftAnswer] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [inlineAI, setInlineAI] = useState<Record<string, InlineAIEntry>>({});
  const [bookModeOpen, setBookModeOpen] = useState(false);
  const articleRef = useRef<HTMLDivElement>(null);
  const readingStarted = useRef(Date.now());

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(config.dataUrl).then((response) => {
        if (!response.ok) throw new Error("Book data could not be loaded.");
        return response.json() as Promise<EbookData>;
      }),
    ])
      .then(([book]) => {
        if (active) {
          setData(book);
          setState(readState(config));
          setLoading(false);
        }
      })
      .catch((error) => {
        if (active) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Book data could not be loaded.",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [config]);

  useEffect(() => {
    try {
      const pending = JSON.parse(
        sessionStorage.getItem("scholar:ebook:target") ?? "null",
      ) as { destination?: Nav } | null;
      if (pending?.destination && NAV.includes(pending.destination))
        setNav(pending.destination);
      sessionStorage.removeItem("scholar:ebook:target");
    } catch {
      /* remain on Reader */
    }
  }, []);

  const updateState = useCallback(
    (update: (current: ReaderState) => ReaderState) => {
      setState((current) => {
        const next = update(current);
        profileSetItem(11, config.bookKey, JSON.stringify(next));
        return next;
      });
    },
    [config.bookKey],
  );

  useEffect(() => {
    if (!data || state.source !== "text") return;
    readingStarted.current = Date.now();
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      updateState((current) => ({
        ...current,
        readingSeconds: current.readingSeconds + 15,
      }));
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [data, state.source, state.textPage, updateState]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const page =
    data?.pages.find((item) => item.textPdfPageNumber === state.textPage) ??
    data?.pages[0];
  const pageMap = data?.pageMap.find(
    (item) => item.scannedPage === state.scannedPage,
  );
  const pageQuestions = useMemo(
    () =>
      data?.questions.filter(
        (question) => question.textPage === state.textPage,
      ) ?? [],
    [data, state.textPage],
  );
  const progress = data
    ? Math.round((state.studiedPages.length / data.pages.length) * 100)
    : 0;

  const switchSource = (source: "scan" | "text") => {
    if (!data) return;
    updateState((current) => {
      if (source === "text") {
        const mapped =
          data.pageMap.find((item) => item.scannedPage === current.scannedPage)
            ?.textPage ?? current.textPage;
        return { ...current, source, textPage: mapped };
      }
      const mapped =
        data.pageMap.find((item) => item.textPage === current.textPage)
          ?.scannedPage ?? current.scannedPage;
      return { ...current, source, scannedPage: mapped };
    });
  };

  const goToTextPage = (number: number) => {
    if (!data) return;
    const textPage = Math.min(data.book.pageCountText, Math.max(1, number));
    const mapped =
      data.pageMap.find((item) => item.textPage === textPage)?.scannedPage ??
      textPage;
    updateState((current) => ({ ...current, textPage, scannedPage: mapped }));
  };
  const goToScanPage = (number: number) => {
    if (!data) return;
    const scannedPage = Math.min(
      data.book.pageCountScanned,
      Math.max(1, number),
    );
    const mapped =
      data.pageMap.find((item) => item.scannedPage === scannedPage)?.textPage ??
      scannedPage;
    updateState((current) => ({ ...current, scannedPage, textPage: mapped }));
  };

  const openSource = (question: EbookQuestion, source: "scan" | "text") => {
    updateState((current) => ({
      ...current,
      source,
      scannedPage: question.sourcePage,
      textPage: question.textPage,
    }));
    setNav("Reader");
  };

  const runAI = async (
    title: string,
    prompt: string,
    pageNumber = state.scannedPage,
  ) => {
    setAiTitle(title);
    setAiText("");
    setAiOpen(true);
    setAiLoading(true);
    try {
      const answer = await askAI(prompt, "mr-raj", { temperature: 0.35 });
      setAiText(answer);
      updateState((current) => ({
        ...current,
        aiHistory: [
          {
            id: `ai-${Date.now()}`,
            label: title,
            content: answer,
            page: pageNumber,
            createdAt: new Date().toISOString(),
          },
          ...current.aiHistory,
        ].slice(0, 80),
      }));
    } catch (error) {
      setAiText(
        error instanceof Error ? error.message : "The tutor could not respond.",
      );
    } finally {
      setAiLoading(false);
    }
  };

  const explainPage = (mode = "Explain normally") => {
    if (!page || !data) return;
    void runAI(
      `${mode} - page ${page.originalPageNumber}`,
      `Use only the supplied authoritative printed text from ${config.title}. Student: Ishan, CBSE Class 11. Subject: ${config.subject}. Chapter: ${page.chapterTitle}. Source page: ${page.originalPageNumber}. Mode: ${mode}.\n\nPAGE TEXT:\n${page.rawText}\n\nRespond with: what this page teaches; definitions; formulas; each main section; one helpful worked example; common mistakes; exam relevance; mini recap; and three check questions. Cite ${config.title}, ${page.chapterTitle}, source page ${page.originalPageNumber}. Preserve notation. Do not use or trust handwritten scan answers.`,
    );
  };

  const questionPrompt = (question: EbookQuestion) => {
    const relevant =
      data?.pages.find((item) => item.textPdfPageNumber === question.textPage)
        ?.rawText ?? "";
    const attempt =
      state.attempts[question.id]?.answer ?? "No attempt supplied.";
    return `Use Groq as a page-aware CBSE Class 11 ${config.subject} tutor. Use only the supplied printed-book context. Do not treat handwritten work as an answer.\nBook: ${config.title}\nChapter: ${question.chapterTitle}\nSource page: ${question.sourcePage}\nQuestion: ${question.prompt}\nStudent attempt: ${attempt}\nRelevant printed context: ${relevant.slice(0, 7000)}\n\nRequired response: 1. What the question asks; 2. Given information; 3. Concept/formula; 4. Step-by-step solution; 5. Final answer; 6. Quick verification; 7. Common mistake. ${question.questionType === "mcq" ? "State the correct option and briefly address the alternatives." : ""} ${question.questionType === "graph" ? "Explain the figure, important points, labels, and relationships." : ""}`;
  };

  const generateInlineAnswer = async (
    question: EbookQuestion,
    regenerating = false,
  ) => {
    const active = inlineAI[question.id];
    if (active?.status === "loading" || active?.status === "regenerating")
      return;
    if (
      regenerating &&
      state.savedAIAnswers[question.id] &&
      !window.confirm(
        "Replace the currently saved AI answer with a newly generated answer?",
      )
    )
      return;
    setInlineAI((current) => ({
      ...current,
      [question.id]: {
        status: regenerating ? "regenerating" : "loading",
        answer:
          current[question.id]?.answer ??
          state.savedAIAnswers[question.id]?.answer,
      },
    }));
    try {
      const answer = await askAI(questionPrompt(question), "mr-raj", {
        temperature: 0.35,
      });
      setInlineAI((current) => ({
        ...current,
        [question.id]: { status: "generated", answer },
      }));
    } catch {
      setInlineAI((current) => ({
        ...current,
        [question.id]: {
          status: "error",
          error: "The answer could not be generated. Please try again.",
        },
      }));
    }
  };

  const saveInlineAnswer = (question: EbookQuestion) => {
    const answer =
      inlineAI[question.id]?.answer ??
      state.savedAIAnswers[question.id]?.answer;
    if (!answer) return;
    const now = new Date().toISOString();
    updateState((current) => ({
      ...current,
      savedAIAnswers: {
        ...current.savedAIAnswers,
        [question.id]: {
          id:
            current.savedAIAnswers[question.id]?.id ?? `saved-ai-${Date.now()}`,
          subjectId: config.subject.toLowerCase(),
          ebookId: data?.book.id ?? config.title,
          chapterId: question.chapterId,
          questionId: question.id,
          questionText: question.prompt,
          answer,
          createdAt: current.savedAIAnswers[question.id]?.createdAt ?? now,
          updatedAt: now,
        },
      },
    }));
    setInlineAI((current) => ({
      ...current,
      [question.id]: { status: "saved", answer },
    }));
    toast.success("AI answer saved");
  };

  const removeSavedInlineAnswer = (question: EbookQuestion) => {
    updateState((current) => {
      const savedAIAnswers = { ...current.savedAIAnswers };
      delete savedAIAnswers[question.id];
      return { ...current, savedAIAnswers };
    });
    setInlineAI((current) => ({
      ...current,
      [question.id]: {
        status: "generated",
        answer: current[question.id]?.answer,
      },
    }));
    toast.success("Saved AI answer removed");
  };

  const sectionAction = (action: string, section: EbookSection) => {
    if (action === "Add to Notes") {
      const note: BookNote = {
        id: `note-${Date.now()}`,
        pageId: page?.id ?? "",
        sectionId: section.id,
        text: section.text,
        createdAt: new Date().toISOString(),
      };
      updateState((current) => ({
        ...current,
        notes: [note, ...current.notes],
      }));
      toast.success("Saved to Book Notes");
    } else if (action === "Bookmark") {
      updateState((current) => ({
        ...current,
        bookmarks: current.bookmarks.includes(section.id)
          ? current.bookmarks
          : [section.id, ...current.bookmarks],
      }));
      toast.success("Paragraph bookmarked");
    } else if (action === "Create flashcard") {
      void runAI(
        "Flashcard from book",
        `Create one accurate front/back flashcard from this exact ${config.title} section. Cite ${page?.chapterTitle}, page ${page?.originalPageNumber}.\n\n${section.text}`,
      );
    } else {
      void runAI(
        `${action} this ${section.type}`,
        `${action} the exact selected book block for Ishan, CBSE Class 11 ${config.subject}. Preserve notation, use simple steps, and cite ${config.title}, ${page?.chapterTitle}, page ${page?.originalPageNumber}.\n\n${section.text}`,
      );
    }
  };

  const captureSelection = () => {
    const nativeSelection = window.getSelection();
    if (
      !nativeSelection ||
      nativeSelection.isCollapsed ||
      !nativeSelection.rangeCount
    ) {
      setSelection(null);
      return;
    }
    const text = nativeSelection.toString().trim();
    if (!text || text.length > 3000) {
      setSelection(null);
      return;
    }
    const range = nativeSelection.getRangeAt(0);
    const element = (
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement
    ) as HTMLElement | null;
    const section = element?.closest<HTMLElement>("[data-section-id]");
    if (!section || !articleRef.current?.contains(section)) return;
    const sectionText = section.innerText;
    const start = Math.max(0, sectionText.indexOf(text));
    const rect = range.getBoundingClientRect();
    setSelection({
      text,
      sectionId: section.dataset.sectionId ?? "",
      start,
      end: start + text.length,
      x: Math.min(window.innerWidth - 220, Math.max(12, rect.left)),
      y: Math.max(80, rect.top - 52),
    });
  };

  const highlightSelection = (color = "#fde68a") => {
    if (!selection || !page) return;
    const highlight: Highlight = {
      id: `hl-${Date.now()}`,
      pageId: page.id,
      sectionId: selection.sectionId,
      selectedText: selection.text,
      startOffset: selection.start,
      endOffset: selection.end,
      color,
      createdAt: new Date().toISOString(),
    };
    updateState((current) => ({
      ...current,
      highlights: [highlight, ...current.highlights],
    }));
    window.getSelection()?.removeAllRanges();
    setSelection(null);
    toast.success("Highlight saved");
  };

  const addSelectionNote = () => {
    if (!selection || !page) return;
    const note: BookNote = {
      id: `note-${Date.now()}`,
      pageId: page.id,
      sectionId: selection.sectionId,
      text: selection.text,
      createdAt: new Date().toISOString(),
    };
    updateState((current) => ({ ...current, notes: [note, ...current.notes] }));
    setSelection(null);
    toast.success("Selection saved to Book Notes");
  };

  const speakPage = () => {
    if (!page || !("speechSynthesis" in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(page.rawText);
    utterance.rate = 0.95;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  const filteredQuestions = useMemo(() => {
    const query = questionSearch.trim().toLowerCase();
    return (data?.questions ?? []).filter((question) => {
      const attempted = Boolean(state.attempts[question.id]);
      const bookmarked = state.bookmarks.includes(question.id);
      const status = state.attempts[question.id]?.status;
      const statusMatch =
        statusFilter === "all" ||
        (statusFilter === "attempted" && attempted) ||
        (statusFilter === "unattempted" && !attempted) ||
        (statusFilter === "correct" && status === "correct") ||
        (statusFilter === "incorrect" && status === "incorrect") ||
        (statusFilter === "bookmarked" && bookmarked) ||
        (statusFilter === "revision" && state.revision.includes(question.id));
      return (
        (!query ||
          question.prompt.toLowerCase().includes(query) ||
          question.questionNumber.toLowerCase().includes(query)) &&
        (chapterFilter === "all" || question.chapterId === chapterFilter) &&
        (sectionFilter === "all" || question.section === sectionFilter) &&
        (typeFilter === "all" ||
          (typeFilter === "non-mcq"
            ? question.questionType !== "mcq"
            : question.questionType === typeFilter)) &&
        statusMatch
      );
    });
  }, [
    data,
    questionSearch,
    chapterFilter,
    sectionFilter,
    typeFilter,
    statusFilter,
    state,
  ]);

  const selectMcqOption = (question: EbookQuestion, index: number) => {
    if (!question.options?.[index]) return;
    const ambiguous = question.correctOption == null;
    const correct = !ambiguous && question.correctOption === index;
    const attempt: Attempt = {
      id: state.attempts[question.id]?.id ?? `attempt-${Date.now()}`,
      questionId: question.id,
      answer: question.options[index],
      selectedOption: index,
      status: ambiguous ? "submitted" : correct ? "correct" : "incorrect",
      feedback:
        question.answerExplanation ??
        (correct ? "Correct." : "Review the highlighted correct option."),
      attemptedAt: new Date().toISOString(),
    };
    updateState((current) => ({
      ...current,
      attempts: { ...current.attempts, [question.id]: attempt },
      completedQuestions:
        correct && !current.completedQuestions.includes(question.id)
          ? [...current.completedQuestions, question.id]
          : current.completedQuestions,
      revision:
        !correct && !ambiguous && !current.revision.includes(question.id)
          ? [question.id, ...current.revision]
          : current.revision,
    }));
  };

  const retryMcq = (questionId: string) =>
    updateState((current) => {
      const attempts = { ...current.attempts };
      delete attempts[questionId];
      return { ...current, attempts };
    });

  const renderInlineQuestionAI = (question: EbookQuestion) => {
    const saved = state.savedAIAnswers[question.id];
    const entry =
      inlineAI[question.id] ??
      (saved
        ? { status: "saved" as const, answer: saved.answer }
        : { status: "idle" as const });
    const isSaved = Boolean(
      saved && entry.answer === saved.answer && entry.status !== "generated",
    );
    return (
      <InlineAIAnswer
        status={entry.status}
        answer={entry.answer}
        error={entry.error}
        saved={isSaved}
        hasSavedRecord={Boolean(saved)}
        onGenerate={() => void generateInlineAnswer(question)}
        onSave={() => saveInlineAnswer(question)}
        onRemove={() => removeSavedInlineAnswer(question)}
        onRegenerate={() => void generateInlineAnswer(question, true)}
        onHide={() =>
          setInlineAI((current) => ({
            ...current,
            [question.id]: { ...entry, status: "hidden" },
          }))
        }
        onShow={() =>
          setInlineAI((current) => ({
            ...current,
            [question.id]: {
              ...entry,
              status:
                saved && entry.answer === saved.answer ? "saved" : "generated",
            },
          }))
        }
        onCopy={() => {
          if (entry.answer)
            void navigator.clipboard
              .writeText(entry.answer)
              .then(() => toast.success("AI answer copied"));
        }}
      />
    );
  };

  const togglePageBookmark = (pageNumber: number) => {
    updateState((current) => {
      const existing = current.pageBookmarks.find((bookmark) => bookmark.page === pageNumber);
      return {
        ...current,
        pageBookmarks: existing
          ? current.pageBookmarks.filter((bookmark) => bookmark.page !== pageNumber)
          : [{ id: `page-bookmark-${Date.now()}`, page: pageNumber, createdAt: new Date().toISOString() }, ...current.pageBookmarks],
      };
    });
  };

  const updatePageBookmarkNote = (pageNumber: number, note: string) => {
    updateState((current) => ({
      ...current,
      pageBookmarks: current.pageBookmarks.map((bookmark) => bookmark.page === pageNumber ? { ...bookmark, note } : bookmark),
    }));
  };

  const bookModeQuestions = pageQuestions.length ? (
    <div className="space-y-3">
      {pageQuestions.map((question) => (
        <article key={`book-${question.id}`} className="rounded-2xl border border-white/10 bg-white/[.035] p-4">
          <p className="text-[10px] uppercase tracking-wider text-indigo-300">{question.section.replaceAll("-", " ")} {question.questionNumber}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/85">{question.prompt}</p>
          <div className="mt-3 flex flex-wrap gap-2">{renderInlineQuestionAI(question)}</div>
        </article>
      ))}
    </div>
  ) : <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-white/40">No extracted questions are linked to this page.</p>;

  const saveAttempt = (status: Attempt["status"] = "draft") => {
    if (!answerQuestion) return;
    const attempt: Attempt = {
      id: state.attempts[answerQuestion.id]?.id ?? `attempt-${Date.now()}`,
      questionId: answerQuestion.id,
      answer: draftAnswer,
      status,
      attemptedAt: new Date().toISOString(),
      feedback: state.attempts[answerQuestion.id]?.feedback,
    };
    updateState((current) => ({
      ...current,
      attempts: { ...current.attempts, [answerQuestion.id]: attempt },
    }));
    toast.success(status === "draft" ? "Draft saved" : "Answer submitted");
    if (status !== "draft") {
      void generateInlineAnswer(answerQuestion);
      setAnswerQuestion(null);
    }
  };

  if (scholarClass !== 11)
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-amber-500/20 bg-amber-500/5 p-8 text-center">
        <BookOpen className="mx-auto mb-4 h-10 w-10 text-amber-500" />
        <h2 className="text-xl font-bold">Class 11 book</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {config.title} belongs only to Ishan&apos;s Class 11 profile. No Class
          11 book data is loaded into Class 9.
        </p>
        <Button className="mt-5" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Library
        </Button>
      </div>
    );
  if (loading || !data)
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-500" />
          <p className="mt-3 text-sm text-muted-foreground">
            Loading structured {config.subject} book…
          </p>
        </div>
      </div>
    );

  const pageNumber =
    state.source === "scan" ? state.scannedPage : state.textPage;
  const maxPage =
    state.source === "scan"
      ? data.book.pageCountScanned
      : data.book.pageCountText;
  const readerClass =
    readerTheme === "dark"
      ? "bg-slate-950 text-slate-100"
      : readerTheme === "sepia"
        ? "bg-[#f4ecd8] text-[#4a3826]"
        : "bg-white text-slate-900";

  return (
    <div
      className={cn(
        "relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[#080b12] text-white",
        fullscreen && "fixed inset-0 z-50",
      )}
    >
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#080b12]/95 backdrop-blur-xl">
        <div className="flex items-center gap-2 px-3 py-2 sm:px-5">
          <button
            onClick={onBack}
            className="rounded-xl p-2 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="Back to E-Book library"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{config.title}</p>
            <p className="truncate text-[10px] text-white/45">
              Class 11 · {config.subtitle} · data v{data.dataVersion}
            </p>
          </div>
          <a
            href={data.book.textPdfPath}
            download
            className="hidden rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60 hover:bg-white/10 sm:flex"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" /> Clean PDF
          </a>
          <button
            onClick={() => setFullscreen((value) => !value)}
            className="rounded-xl p-2 text-white/60 hover:bg-white/10"
            aria-label="Toggle fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
        <nav
          className="flex gap-1 overflow-x-auto px-3 pb-2 sm:px-5"
          aria-label="E-Book sections"
        >
          {NAV.map((item) => (
            <button
              key={item}
              onClick={() => setNav(item)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs",
                nav === item
                  ? "bg-indigo-500 text-white"
                  : "text-white/55 hover:bg-white/10",
              )}
            >
              {item}
            </button>
          ))}
        </nav>
      </header>

      {nav === "Library" && (
        <div className="mx-auto max-w-5xl p-4 sm:p-7">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/15 to-cyan-500/5 p-6">
            <div className="grid gap-6 md:grid-cols-[220px_1fr]">
              {config.renderPdfDirectly ? (
                <div className="grid aspect-[3/4] place-items-center rounded-2xl bg-gradient-to-br from-rose-500/25 via-amber-500/10 to-slate-950 p-5 text-center shadow-2xl">
                  <div>
                    <FlaskConical className="mx-auto h-12 w-12 text-rose-300" />
                    <p className="mt-4 text-xl font-bold">Chemistry</p>
                    <p className="mt-1 text-xs text-white/50">
                      Part 1 · Class 11
                    </p>
                  </div>
                </div>
              ) : (
                <img
                  src={config.coverImage}
                  alt={`${config.title} cover`}
                  className="aspect-[3/4] w-full rounded-2xl object-cover object-top shadow-2xl"
                />
              )}
              <div>
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">
                  Original scan + authoritative clean text
                </span>
                <h1 className="mt-4 text-3xl font-bold">{config.title}</h1>
                <p className="mt-2 text-white/55">{config.description}</p>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Scan pages", data.book.pageCountScanned],
                    ["Text pages", data.book.pageCountText],
                    ["Printed questions", data.counts.totalQuestions],
                    ["Structured blocks", data.counts.totalSections],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="rounded-2xl border border-white/10 bg-black/20 p-3"
                    >
                      <p className="text-xl font-bold">{value}</p>
                      <p className="text-[11px] text-white/45">{label}</p>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={() => setNav("Reader")}
                  className="mt-6 bg-indigo-500 hover:bg-indigo-600"
                >
                  <BookOpen className="mr-2 h-4 w-4" /> Continue reading
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {nav === "Reader" && (
        <div className="grid min-h-[calc(100vh-8.5rem)] lg:grid-cols-[230px_minmax(0,1fr)_270px]">
          <aside className="hidden border-r border-white/10 bg-black/20 p-3 lg:block">
            <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
              Table of contents
            </p>
            {config.chapters.map((chapter) => (
              <button
                key={chapter.id}
                onClick={() => {
                  goToTextPage(chapter.textPage);
                  if (state.source === "scan") goToScanPage(chapter.scanPage);
                }}
                className="mt-2 w-full rounded-xl p-3 text-left text-xs text-white/65 hover:bg-white/10"
              >
                <b className="block text-white">{chapter.title}</b>
                {state.source === "scan"
                  ? `Scan page ${chapter.scanPage}`
                  : `Text page ${chapter.textPage}`}
              </button>
            ))}
            <p className="mt-5 px-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
              Page mini-map
            </p>
            <div className="mt-2 grid max-h-[50vh] grid-cols-5 gap-1 overflow-y-auto">
              {Array.from({ length: maxPage }, (_, index) => index + 1).map(
                (number) => (
                  <button
                    key={number}
                    onClick={() =>
                      state.source === "scan"
                        ? goToScanPage(number)
                        : goToTextPage(number)
                    }
                    className={cn(
                      "rounded p-1 text-[10px]",
                      number === pageNumber
                        ? "bg-indigo-500"
                        : "bg-white/5 text-white/45 hover:bg-white/10",
                    )}
                  >
                    {number}
                  </button>
                ),
              )}
            </div>
          </aside>
          <main className="min-w-0">
            <div className="sticky top-[88px] z-30 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#080b12]/95 px-3 py-2 backdrop-blur-xl">
              <div
                className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1"
                aria-label="Book source"
              >
                <button
                  onClick={() => switchSource("scan")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold",
                    state.source === "scan"
                      ? "bg-white text-slate-950"
                      : "text-white/55",
                  )}
                >
                  Original Scan
                </button>
                <button
                  onClick={() => switchSource("text")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold",
                    state.source === "text"
                      ? "bg-indigo-500 text-white"
                      : "text-white/55",
                  )}
                >
                  Clean Text
                </button>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" onClick={() => setBookModeOpen(true)} className="mr-1 bg-indigo-500 hover:bg-indigo-600" aria-label="Enter Book Mode">
                  <BookOpen className="mr-1.5 h-4 w-4" /> <span className="hidden sm:inline">Book Mode</span>
                </Button>
                <button
                  onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}
                  className="rounded-lg p-2 hover:bg-white/10"
                  aria-label="Decrease size"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <span className="w-12 text-center text-[10px] text-white/45">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom((z) => Math.min(1.8, z + 0.1))}
                  className="rounded-lg p-2 hover:bg-white/10"
                  aria-label="Increase size"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                {state.source === "text" && (
                  <button
                    onClick={speakPage}
                    className="rounded-lg p-2 hover:bg-white/10"
                    aria-label={speaking ? "Stop narration" : "Read page aloud"}
                  >
                    {speaking ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            </div>
            <div
              className={cn(config.renderPdfDirectly ? "p-0" : "p-3 sm:p-6")}
            >
              {config.renderPdfDirectly ? (
                <PdfDocument
                  key={`${state.source}-${pageNumber}-${zoom}`}
                  src={
                    state.source === "scan"
                      ? data.book.scannedPdfPath
                      : data.book.textPdfPath
                  }
                  page={pageNumber}
                  zoom={zoom}
                  title={`${config.title} — ${state.source === "scan" ? "Original Scan" : "Clean Text"}`}
                />
              ) : state.source === "scan" ? (
                <ScanPage
                  page={state.scannedPage}
                  zoom={zoom}
                  pageDir={config.scanPageDir}
                  bookTitle={config.title}
                />
              ) : (
                <ScanPage
                  page={state.textPage}
                  zoom={zoom}
                  pageDir={config.cleanPageDir}
                  label="Exact clean-text PDF"
                  bookTitle={config.title}
                />
              )}
            </div>
            <div className="sticky bottom-0 z-30 flex items-center justify-between border-t border-white/10 bg-[#080b12]/95 px-3 py-2 backdrop-blur-xl">
              <Button
                size="sm"
                variant="ghost"
                disabled={pageNumber <= 1}
                onClick={() =>
                  state.source === "scan"
                    ? goToScanPage(pageNumber - 1)
                    : goToTextPage(pageNumber - 1)
                }
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Previous
              </Button>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={maxPage}
                  value={pageNumber}
                  onChange={(event) =>
                    state.source === "scan"
                      ? goToScanPage(Number(event.target.value))
                      : goToTextPage(Number(event.target.value))
                  }
                  className="h-8 w-16 border-white/10 bg-white/5 text-center"
                />
                <span className="text-xs text-white/40">/ {maxPage}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={pageNumber >= maxPage}
                onClick={() =>
                  state.source === "scan"
                    ? goToScanPage(pageNumber + 1)
                    : goToTextPage(pageNumber + 1)
                }
              >
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </main>
          <aside className="hidden border-l border-white/10 bg-black/20 p-4 lg:block">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              Page-aware tutor
            </p>
            <Button
              onClick={() => explainPage()}
              className="mt-3 w-full bg-indigo-500 hover:bg-indigo-600"
            >
              <Sparkles className="mr-2 h-4 w-4" /> Explain This Page
            </Button>
            {[
              "Explain like a beginner",
              "Exam revision",
              "Quick summary",
              "Deep explanation",
              "Convert to notes",
              "Generate quiz from page",
            ].map((mode) => (
              <button
                key={mode}
                onClick={() => explainPage(mode)}
                className="mt-2 w-full rounded-xl border border-white/10 p-2.5 text-left text-xs text-white/60 hover:bg-white/10"
              >
                {mode}
              </button>
            ))}
            <div className="mt-5 rounded-2xl border border-white/10 p-3 text-xs text-white/55">
              <p className="font-bold text-white">Page mapping</p>
              <p className="mt-1">
                Scan {state.scannedPage} ↔ Text {state.textPage}
              </p>
              <p className="mt-1">
                {pageMap?.sectionIds.length ?? page?.sections.length ?? 0}{" "}
                mapped blocks
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                updateState((current) => ({
                  ...current,
                  studiedPages: current.studiedPages.includes(state.textPage)
                    ? current.studiedPages
                    : [...current.studiedPages, state.textPage],
                }))
              }
              className="mt-3 w-full border-white/10 bg-white/5"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" /> Mark page studied
            </Button>
          </aside>
        </div>
      )}

      {nav === "Questions" && (
        <div className="mx-auto max-w-6xl p-4 sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-300">
                Complete printed question database
              </p>
              <h1 className="mt-1 text-2xl font-bold">
                {filteredQuestions.length} questions
              </h1>
            </div>
            <Input
              value={questionSearch}
              onChange={(event) => setQuestionSearch(event.target.value)}
              placeholder="Search exact question text or number…"
              className="max-w-sm border-white/10 bg-white/5"
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              [
                chapterFilter,
                setChapterFilter,
                ["all", ...config.chapters.map((chapter) => chapter.id)],
              ],
              [
                sectionFilter,
                setSectionFilter,
                ["all", "classwork", "homework", "try-yourself", "case-study"],
              ],
              [
                typeFilter,
                setTypeFilter,
                ["all", "mcq", "non-mcq", "graph", "proof", "multi-part"],
              ],
              [
                statusFilter,
                setStatusFilter,
                [
                  "all",
                  "attempted",
                  "unattempted",
                  "correct",
                  "incorrect",
                  "bookmarked",
                  "revision",
                ],
              ],
            ].map(([value, setValue, options], index) => (
              <select
                key={index}
                value={String(value)}
                onChange={(event) =>
                  (setValue as (value: string) => void)(event.target.value)
                }
                className="rounded-xl border border-white/10 bg-[#101522] px-3 py-2 text-xs"
              >
                {(options as string[]).map((option) => (
                  <option key={option} value={option}>
                    {option.replaceAll("-", " ")}
                  </option>
                ))}
              </select>
            ))}
          </div>
          <div className="mt-5 space-y-3">
            {filteredQuestions.map((question) => {
              const attempt = state.attempts[question.id];
              const bookmarked = state.bookmarks.includes(question.id);
              return (
                <article
                  key={question.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
                >
                  <div className="flex flex-wrap items-center gap-2 text-[10px]">
                    <span className="rounded-full bg-indigo-500/15 px-2 py-1 text-indigo-300">
                      {question.section.replaceAll("-", " ")}{" "}
                      {question.questionNumber}
                    </span>
                    <span className="rounded-full bg-white/5 px-2 py-1 text-white/45">
                      {question.questionType}
                    </span>
                    <span className="rounded-full bg-white/5 px-2 py-1 text-white/45">
                      {question.difficulty}
                    </span>
                    {question.sourceLabel && (
                      <span className="text-emerald-300">NCERT</span>
                    )}
                    <span className="ml-auto text-white/35">
                      {question.chapterTitle} · p.{question.sourcePage}
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/85">
                    {question.prompt}
                  </p>
                  {question.questionType === "mcq" && (
                    <McqOptions
                      question={question}
                      attempt={attempt}
                      onSelect={(index) => selectMcqOption(question, index)}
                      onRetry={() => retryMcq(question.id)}
                    />
                  )}
                  {question.diagramRef && (
                    <img
                      src={question.diagramRef}
                      alt={`Source diagram for ${question.section} ${question.questionNumber}`}
                      className="mt-3 max-h-64 rounded-xl border border-white/10 object-contain"
                    />
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openSource(question, "scan")}
                      className="border-white/10 bg-white/5"
                    >
                      <Eye className="mr-1.5 h-3.5 w-3.5" /> Original Scan
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openSource(question, "text")}
                      className="border-white/10 bg-white/5"
                    >
                      <FileText className="mr-1.5 h-3.5 w-3.5" /> Clean Text
                    </Button>
                    {renderInlineQuestionAI(question)}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAnswerQuestion(question);
                        setDraftAnswer(attempt?.answer ?? "");
                      }}
                      className="border-white/10 bg-white/5"
                    >
                      <NotebookPen className="mr-1.5 h-3.5 w-3.5" />{" "}
                      {attempt ? "Edit answer" : "Write answer"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        updateState((current) => ({
                          ...current,
                          bookmarks: bookmarked
                            ? current.bookmarks.filter(
                                (id) => id !== question.id,
                              )
                            : [question.id, ...current.bookmarks],
                        }))
                      }
                    >
                      {bookmarked ? (
                        <BookmarkCheck className="h-4 w-4 text-amber-400" />
                      ) : (
                        <Bookmark className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        updateState((current) => ({
                          ...current,
                          revision: current.revision.includes(question.id)
                            ? current.revision
                            : [question.id, ...current.revision],
                        }))
                      }
                    >
                      Needs revision
                    </Button>
                  </div>
                  {attempt && question.questionType !== "mcq" && (
                    <p className="mt-2 text-xs text-emerald-300">
                      Attempt saved: {attempt.status}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}

      {(nav === "Book Notes" ||
        nav === "Highlights" ||
        nav === "Bookmarks") && (
        <div className="mx-auto max-w-5xl p-4 sm:p-7">
          <h1 className="text-2xl font-bold">My {nav}</h1>
          <p className="mt-1 text-sm text-white/45">
            Profile-scoped to Ishan · Class 11
          </p>
          <div className="mt-5 space-y-3">
            {nav === "Book Notes" &&
              state.notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-2xl border border-white/10 bg-white/[.035] p-4"
                >
                  <p className="text-sm whitespace-pre-wrap">{note.text}</p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const p = data.pages.find(
                          (item) => item.id === note.pageId,
                        );
                        if (p) {
                          goToTextPage(p.textPdfPageNumber);
                          switchSource("text");
                          setNav("Reader");
                        }
                      }}
                      className="border-white/10 bg-white/5"
                    >
                      Jump to source
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        updateState((current) => ({
                          ...current,
                          notes: current.notes.filter(
                            (item) => item.id !== note.id,
                          ),
                        }))
                      }
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            {nav === "Highlights" &&
              state.highlights.map((highlight) => (
                <div
                  key={highlight.id}
                  className="rounded-2xl border border-white/10 bg-white/[.035] p-4"
                >
                  <mark
                    style={{ backgroundColor: highlight.color }}
                    className="rounded px-1 text-slate-900"
                  >
                    {highlight.selectedText}
                  </mark>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const p = data.pages.find(
                          (item) => item.id === highlight.pageId,
                        );
                        if (p) {
                          goToTextPage(p.textPdfPageNumber);
                          switchSource("text");
                          setNav("Reader");
                        }
                      }}
                      className="border-white/10 bg-white/5"
                    >
                      Jump to source
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        updateState((current) => ({
                          ...current,
                          highlights: current.highlights.filter(
                            (item) => item.id !== highlight.id,
                          ),
                        }))
                      }
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            {nav === "Bookmarks" &&
              state.bookmarks.map((id) => {
                const q = data.questions.find((item) => item.id === id);
                const s = data.pages
                  .flatMap((item) => item.sections)
                  .find((item) => item.id === id);
                return (
                  <div
                    key={id}
                    className="rounded-2xl border border-white/10 bg-white/[.035] p-4"
                  >
                    <p className="text-sm">
                      {q
                        ? `${q.section} ${q.questionNumber}: ${q.prompt}`
                        : (s?.text ?? id)}
                    </p>
                    {q && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openSource(q, "text")}
                        className="mt-3 border-white/10 bg-white/5"
                      >
                        Open source
                      </Button>
                    )}
                  </div>
                );
              })}
            {((nav === "Book Notes" && !state.notes.length) ||
              (nav === "Highlights" && !state.highlights.length) ||
              (nav === "Bookmarks" && !state.bookmarks.length)) && (
              <div className="rounded-3xl border border-dashed border-white/15 p-10 text-center text-white/40">
                Nothing saved here yet.
              </div>
            )}
          </div>
        </div>
      )}

      {nav === "AI Study" && (
        <div className="mx-auto max-w-5xl p-4 sm:p-7">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-300">
            E-Book tutor
          </p>
          <h1 className="mt-1 text-3xl font-bold">Study the actual book</h1>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "AI-guided reading session",
              "Study selected pages",
              "Quiz this page",
              "Quiz this chapter",
              "Create revision sheet",
              "Ask this book",
            ].map((action) => (
              <button
                key={action}
                onClick={() =>
                  action === "Quiz this page"
                    ? explainPage("Generate quiz from page")
                    : action === "Quiz this chapter"
                      ? void runAI(
                          action,
                          `Create a clearly labelled AI-generated mixed quiz from the current chapter context only: ${page?.rawText}`,
                        )
                      : void runAI(
                          action,
                          `Act as a page-aware Class 11 ${config.subject} book tutor. Current book ${config.title}, chapter ${page?.chapterTitle}, page ${page?.originalPageNumber}. Action: ${action}. Use this printed context and link every recommendation back to page ${page?.originalPageNumber}: ${page?.rawText}`,
                        )
                }
                className="rounded-2xl border border-white/10 bg-white/[.035] p-5 text-left hover:bg-white/[.07]"
              >
                <Sparkles className="mb-3 h-5 w-5 text-indigo-300" />
                <b>{action}</b>
                <p className="mt-1 text-xs text-white/45">
                  Source-aware · Class 11 · saved to AI history
                </p>
              </button>
            ))}
          </div>
          <h2 className="mt-8 text-lg font-bold">Saved explanations</h2>
          <div className="mt-3 space-y-2">
            {state.aiHistory.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setAiTitle(item.label);
                  setAiText(item.content);
                  setAiOpen(true);
                }}
                className="w-full rounded-2xl border border-white/10 p-4 text-left hover:bg-white/5"
              >
                <b className="text-sm">{item.label}</b>
                <p className="mt-1 line-clamp-2 text-xs text-white/45">
                  {item.content}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {nav === "Reading Progress" && (
        <div className="mx-auto max-w-5xl p-4 sm:p-7">
          <h1 className="text-3xl font-bold">Reading progress</h1>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Book progress", `${progress}%`],
              [
                "Pages studied",
                `${state.studiedPages.length}/${data.pages.length}`,
              ],
              ["Reading time", `${Math.floor(state.readingSeconds / 60)} min`],
              ["Questions attempted", Object.keys(state.attempts).length],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-2xl border border-white/10 bg-white/[.035] p-5"
              >
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-white/45">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-3xl border border-white/10 p-5">
            <h2 className="font-bold">Study criteria</h2>
            <p className="mt-2 text-sm text-white/50">
              Opening a page does not mark it studied. Use “Mark page studied”
              after active reading, or complete a page check.
            </p>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-indigo-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div className="mt-5 rounded-3xl border border-white/10 p-5">
            <h2 className="font-bold">Extraction validation</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {Object.entries(data.counts).map(([label, value]) => (
                <div key={label} className="rounded-xl bg-white/5 p-3">
                  <b>{value}</b>
                  <p className="text-[10px] text-white/40">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <BookModeReader
        open={bookModeOpen}
        title={config.title}
        subject={config.subject}
        source={state.source}
        currentPage={pageNumber}
        totalPages={maxPage}
        imageUrl={(number, source) => `/${source === "scan" ? config.scanPageDir : config.cleanPageDir}/page-${String(number).padStart(3, "0")}.png`}
        chapters={config.chapters}
        searchPages={data.pages.map((bookPage) => ({ page: bookPage.textPdfPageNumber, title: bookPage.title ?? bookPage.chapterTitle, text: bookPage.rawText }))}
        bookmarks={state.pageBookmarks}
        questions={bookModeQuestions}
        onClose={() => setBookModeOpen(false)}
        onPageChange={(number) => state.source === "scan" ? goToScanPage(number) : goToTextPage(number)}
        onSourceChange={switchSource}
        onToggleBookmark={togglePageBookmark}
        onBookmarkNote={updatePageBookmarkNote}
      />

      {selection && (
        <div
          className="fixed z-[70] flex max-w-[calc(100vw-24px)] gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950 p-1.5 shadow-2xl"
          style={{ left: selection.x, top: selection.y }}
          role="toolbar"
          aria-label="Selected text actions"
        >
          <button
            onClick={() => highlightSelection()}
            className="rounded-xl px-2 py-1.5 text-xs hover:bg-white/10"
          >
            Highlight
          </button>
          <button
            onClick={() =>
              void runAI(
                "Explain selection",
                `Explain this exact selection with its local Class 11 ${config.subject} context. Cite ${page?.chapterTitle}, page ${page?.originalPageNumber}.\nSelection: ${selection.text}\nContaining section: ${page?.sections.find((item) => item.id === selection.sectionId)?.text}`,
              )
            }
            className="rounded-xl px-2 py-1.5 text-xs hover:bg-white/10"
          >
            Explain
          </button>
          <button
            onClick={addSelectionNote}
            className="rounded-xl px-2 py-1.5 text-xs hover:bg-white/10"
          >
            Note
          </button>
          <button
            onClick={() => navigator.clipboard.writeText(selection.text)}
            className="rounded-xl px-2 py-1.5 text-xs hover:bg-white/10"
          >
            Copy
          </button>
          <button
            onClick={() => setSelection(null)}
            className="rounded-xl p-1.5 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{aiTitle}</DialogTitle>
            <DialogDescription>
              Groq · {config.title} · page-aware Class 11 response
            </DialogDescription>
          </DialogHeader>
          {aiLoading ? (
            <div className="grid min-h-40 place-items-center">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
            </div>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <Markdown content={aiText} />
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(answerQuestion)}
        onOpenChange={(open) => !open && setAnswerQuestion(null)}
      >
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Write answer</DialogTitle>
            <DialogDescription>
              {answerQuestion?.chapterTitle} · source page{" "}
              {answerQuestion?.sourcePage}
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-xl bg-muted p-3 text-sm">
            {answerQuestion?.prompt}
          </p>
          <textarea
            value={draftAnswer}
            onChange={(event) => setDraftAnswer(event.target.value)}
            rows={9}
            className="w-full rounded-xl border bg-background p-3 text-sm"
            placeholder="Write your working and final answer…"
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => saveAttempt("draft")}>
              Save draft
            </Button>
            <Button onClick={() => saveAttempt("submitted")}>
              Submit & AI check
            </Button>
            {answerQuestion && (
              <Button variant="ghost" onClick={() => { void generateInlineAnswer(answerQuestion); setAnswerQuestion(null); }}>
                Generate AI Answer inline
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
