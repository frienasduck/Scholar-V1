"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/lib/notifications/notification-api";
import {
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Edit3,
  Eye,
  Presentation,
  FileText,
  Wand2,
  RefreshCw,
  Download,
  Play,
  X,
  ChevronLeft,
  ChevronRight,
  Save,
  Search,
  Filter,
  Image as ImageIcon,
  Code2,
  Mic,
  Lightbulb,
  AlertTriangle,
  Trophy,
  BookOpen,
  Clock,
  Layers,
  Maximize2,
  Keyboard,
  ListChecks,
  FileDown,
  Link2,
  CheckCircle2,
  BarChart3,
  GripVertical,
  Merge,
  ExternalLink,
  FileUp,
} from "lucide-react";

import { askAIJSON } from "@/lib/ai";
import { ScholarAIContent } from "@/components/ai/scholar-ai-content";
import { renderAcademicFormulaToPng, renderAcademicTextToHtml } from "@/lib/ai/export";
import { useStore } from "@/lib/store";
import { useCurriculum } from "@/lib/use-curriculum";
import {
  type Slide,
  type Slideshow,
  type SlideshowTemplate,
  type SlideshowMode,
  type SlideshowDifficulty,
  type SlideType,
  TEMPLATES,
  MODES,
  DIFFICULTIES,
  SLIDE_TYPES,
  getTemplate,
  getSlideTypeMeta,
  loadSlideshows,
  upsertSlideshow,
  deleteSlideshow,
  newSlide,
  newSlideshow,
  type SlideshowDensity,
  type SlideshowAudience,
  type SlideshowStudyMode,
  type SlideshowOutlineItem,
  type SlideshowSourceMeta,
  type SlideshowSourcePage,
  type SlideshowGenerationSettings,
} from "@/lib/slideshow";
import {
  EBOOK_SLIDESHOW_SOURCES,
  loadEbookSource,
  extractEbookPages,
  analyseSourcePages,
  analysePlainText,
  sourceStatistics,
  recommendSlideCounts,
  allocateSlides,
  buildSlideBatchPrompt,
  parseSlideBatch,
  makeCoverageLedger,
  validateCoverage,
  repairMissingCoverage,
  compactOutlineForStorage,
  formatPageRange,
  normalizeSlideshowIntent,
  containsInstructionLeakage,
  assessSlideshowQuality,
  repairSlideQuality,
} from "@/lib/slideshow-pipeline";
import { cn } from "@/lib/utils";
import { NarratedSlideshowMaker } from "@/components/views/narrated-slideshow";
import {
  beginBackgroundTask,
  completeBackgroundTask,
  failBackgroundTask,
  updateBackgroundTask,
} from "@/lib/background-tasks";

// ============================================================================
// AI helpers — fetch with timeout so the client doesn't hang forever
// ============================================================================

async function askAIJSONWithTimeout(
  message: string,
  persona: string,
  opts: { temperature?: number },
  timeoutMs: number,
): Promise<any | null> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Use askAIJSON but with abort signal — we'll reimplement here to add abort support
    const { useStore: _useStore } = await import("@/lib/store");
    const state = _useStore.getState();
    const scholarClass = state.user.scholarClass ?? 9;
    const jeeMode = state.user.jeeMode ?? false;

    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: message }],
        persona,
        temperature: opts.temperature ?? 0.55,
        json: true,
        scholarClass,
        jeeMode,
      }),
      signal: controller.signal,
    });
    clearTimeout(tid);
    if (!res.ok) return null;
    const text = await res.text();
    let data: { ok?: boolean; data?: any };
    try {
      data = JSON.parse(text);
    } catch {
      return null;
    }
    if (!data.ok || !data.data) return null;
    return data.data;
  } catch (e: any) {
    clearTimeout(tid);
    if (e?.name === "AbortError") return null;
    return null;
  }
}

// ============================================================================
// AI Slideshow Maker
// ============================================================================

type InputMode =
  | "prompt"
  | "topic"
  | "notes"
  | "chapter"
  | "ebook"
  | "document";

const INPUT_MODES: { id: InputMode; name: string; icon: any; hint: string }[] =
  [
    {
      id: "prompt",
      name: "Prompt",
      icon: Wand2,
      hint: "Type a free-form prompt.",
    },
    {
      id: "topic",
      name: "Topic",
      icon: BookOpen,
      hint: "Pick subject, chapter, audience.",
    },
    {
      id: "notes",
      name: "Paste Notes",
      icon: FileText,
      hint: "Turn rough notes into slides.",
    },
    {
      id: "chapter",
      name: "Chapter",
      icon: Layers,
      hint: "Generate from a curriculum chapter.",
    },
    {
      id: "ebook",
      name: "Clean E‑Book Pages",
      icon: FileUp,
      hint: "Choose an exact selectable-text page range.",
    },
    {
      id: "document",
      name: "Upload Text File",
      icon: FileText,
      hint: "Use a TXT, Markdown, JSON, or CSV document.",
    },
  ];

export function SlideshowMaker() {
  const scholarClass = useStore((s) => s.user.scholarClass);
  const jeeMode = useStore((s) => s.user.jeeMode);
  const addXP = useStore((s) => s.addXP);
  const addCoins = useStore((s) => s.addCoins);
  const pushActivity = useStore((s) => s.pushActivity);
  const curriculum = useCurriculum();

  // ===== Generation settings =====
  const [inputMode, setInputMode] = useState<InputMode>("prompt");
  const [prompt, setPrompt] = useState("");
  const [topic, setTopic] = useState("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [chapterId, setChapterId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [uploadedDocumentName, setUploadedDocumentName] = useState("");
  const [uploadedDocumentText, setUploadedDocumentText] = useState("");
  const [slideCount, setSlideCount] = useState(28);
  const [density, setDensity] = useState<SlideshowDensity>("detailed");
  const [audience, setAudience] = useState<SlideshowAudience>(
    scholarClass === 11 ? "class-11" : "beginner",
  );
  const [studyMode, setStudyMode] = useState<SlideshowStudyMode>("standard");
  const [mode, setMode] = useState<SlideshowMode>("chapter-explanation");
  const [difficulty, setDifficulty] = useState<SlideshowDifficulty>("standard");
  const [template, setTemplate] = useState<SlideshowTemplate>("scholar-glass");
  const [language, setLanguage] = useState("English");
  const [includeSpeakerNotes, setIncludeSpeakerNotes] = useState(true);
  const [includeDiagrams, setIncludeDiagrams] = useState(true);
  const [includeExamples, setIncludeExamples] = useState(true);
  const [includePractice, setIncludePractice] = useState(true);
  const [includeQuiz, setIncludeQuiz] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeReferences, setIncludeReferences] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genStage, setGenStage] = useState("");
  const [generationStageIndex, setGenerationStageIndex] = useState(-1);
  const [ebookId, setEbookId] = useState(EBOOK_SLIDESHOW_SOURCES[0].id);
  const [ebookChapterId, setEbookChapterId] = useState("");
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(EBOOK_SLIDESHOW_SOURCES[0].pageCount);
  const [sourcePages, setSourcePages] = useState<SlideshowSourcePage[]>([]);
  const [sourceMeta, setSourceMeta] = useState<SlideshowSourceMeta | null>(
    null,
  );
  const [outline, setOutline] = useState<SlideshowOutlineItem[]>([]);
  const [analysing, setAnalysing] = useState(false);

  // ===== Editor state =====
  const [active, setActive] = useState<Slideshow | null>(null);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [editingSlide, setEditingSlide] = useState<Slide | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const [narrationMode, setNarrationMode] = useState(false);
  const autoRepairedDecks = useRef(new Set<string>());

  // ===== Saved library =====
  const [saved, setSaved] = useState<Slideshow[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setSaved(loadSlideshows(scholarClass));
  }, [scholarClass]);

  useEffect(() => {
    if (scholarClass !== 11 && inputMode === "ebook") setInputMode("prompt");
  }, [scholarClass, inputMode]);

  const selectedEbook = useMemo(
    () =>
      EBOOK_SLIDESHOW_SOURCES.find((book) => book.id === ebookId) ??
      EBOOK_SLIDESHOW_SOURCES[0],
    [ebookId],
  );

  const normalizedIntent = useMemo(() => {
    const curriculumSubject = curriculum.find((item) => item.id === subjectId);
    const curriculumChapter = curriculumSubject?.chapters.find((item) => item.id === chapterId);
    const ebookChapter = selectedEbook.chapters.find((item) => item.id === ebookChapterId || (!ebookChapterId && startPage >= item.startPage && endPage <= item.endPage));
    return normalizeSlideshowIntent({
      userInstruction: inputMode === "prompt" ? prompt : undefined,
      subject: inputMode === "ebook" ? selectedEbook.subject : curriculumSubject?.name,
      classLevel: `Class ${scholarClass}`,
      chapter: inputMode === "ebook" ? ebookChapter?.title : curriculumChapter?.title || (inputMode === "topic" ? topic : undefined),
      sourceTitle: inputMode === "document" ? uploadedDocumentName : inputMode === "notes" ? "Study Notes" : undefined,
    });
  }, [chapterId, curriculum, ebookChapterId, endPage, inputMode, prompt, scholarClass, selectedEbook, startPage, subjectId, topic, uploadedDocumentName]);

  useEffect(() => {
    if (!active || autoRepairedDecks.current.has(active.id)) return;
    const needsRepair = !active.quality || active.quality.score < 80 || active.quality.overflowCount > 0 || active.quality.duplicateContent > 0;
    if (!needsRepair) return;
    autoRepairedDecks.current.add(active.id);
    let cancelled = false;
    void (async () => {
      const sourceBook = EBOOK_SLIDESHOW_SOURCES.find((book) => book.id === active.source?.bookId);
      const inferredChapter = sourceBook?.chapters.find((chapter) => (active.source?.startPage ?? 0) >= chapter.startPage && (active.source?.endPage ?? Number.MAX_SAFE_INTEGER) <= chapter.endPage);
      const intent = normalizeSlideshowIntent({ subject: active.subject, classLevel: `Class ${active.classProfile}`, chapter: (active.chapter && active.chapter !== "Selected pages" ? active.chapter : inferredChapter?.title) || undefined, sourceTitle: active.source?.ebookTitle || active.title });
      let sourceOutline = active.outline ?? [];
      let expectedPages = active.coverage?.totalPages;
      const lowQuality = !active.quality || active.quality.score < 70;
      if (sourceBook && active.source?.startPage && active.source?.endPage && lowQuality) {
        try {
          const loaded = await loadEbookSource(sourceBook.id);
          const pages = extractEbookPages(loaded, active.source.startPage, active.source.endPage, active.source.chapterId || inferredChapter?.id);
          sourceOutline = analyseSourcePages(pages);
          expectedPages = pages.map((page) => page.pageNumber);
        } catch { /* retain the saved outline if the local source cannot be reloaded */ }
      }
      let slides = repairSlideQuality(active.slides, intent);
      let ledger = active.coverageLedger;
      if (sourceOutline.length && lowQuality) {
        const generationSettings = active.generationSettings ?? { slideCount: active.slides.length, density: "detailed", audience: "class-11", studyMode: "standard", includeDiagrams: true, includeExamples: true, includeSpeakerNotes: true, includeSummary: true, includeQuiz: true, includeSourceReferences: true };
        const plans = allocateSlides(sourceOutline, generationSettings, intent);
        ledger = makeCoverageLedger(sourceOutline, plans);
        slides = repairSlideQuality(parseSlideBatch(null, plans, generationSettings.includeSpeakerNotes, generationSettings.density).map((slide) => ({ ...slide, sourceBookId: active.source?.bookId, showSourceReference: generationSettings.includeSourceReferences })), intent);
      }
      const coverage = ledger ? validateCoverage(slides, ledger, expectedPages) : null;
      const percentage = coverage?.report.percentage ?? active.coverage?.percentage ?? 0;
      const quality = assessSlideshowQuality(slides, percentage);
      const repaired: Slideshow = { ...active, title: intent.title, chapter: intent.chapter || active.chapter, slides, outline: sourceOutline.length ? compactOutlineForStorage(sourceOutline) : active.outline, coverageLedger: coverage?.ledger ?? ledger, coverage: coverage?.report ?? active.coverage, quality, metadata: active.metadata ? { ...active.metadata, generatedSlideCount: slides.length, detectedTopicCount: sourceOutline.length || active.metadata.detectedTopicCount, coveragePercentage: percentage, qualityScore: quality.score, updatedAt: new Date().toISOString() } : active.metadata, lastAutosavedAt: Date.now() };
      if (cancelled) return;
      setActive(repaired);
      setSaved(upsertSlideshow(repaired));
      toast.success("Rebuilt the low-quality presentation", { description: `${active.slides.length - slides.length > 0 ? `${active.slides.length - slides.length} repeated slides removed. ` : ""}Titles, source mappings, formulas, and fit were revalidated.` });
    })();
    return () => { cancelled = true; };
  }, [active]);

  const generationStages = [
    "Reading selected pages",
    "Detecting topics",
    "Building complete outline",
    "Planning slide coverage",
    "Generating slide content",
    "Adding formulas and figures",
    "Checking for missing topics",
    "Finalising presentation",
  ];

  const clearAnalysis = useCallback(() => {
    setOutline([]);
    setSourcePages([]);
    setSourceMeta(null);
  }, []);

  useEffect(() => {
    clearAnalysis();
  }, [
    inputMode,
    prompt,
    notes,
    topic,
    subjectId,
    chapterId,
    ebookId,
    ebookChapterId,
    startPage,
    endPage,
    uploadedDocumentName,
    uploadedDocumentText,
    clearAnalysis,
  ]);

  // Build the prompt text for any input mode
  const buildPromptText = useCallback((): string => {
    if (inputMode === "prompt") {
      const value = prompt.trim();
      if (containsInstructionLeakage(value) && value.split(/\s+/).length < 120)
        throw new Error("The prompt contains an instruction but no complete source. Select an e-book chapter/page range, upload a text document, or paste source notes before generating.");
      return value;
    }
    if (inputMode === "notes") return notes.trim();
    if (inputMode === "document") return uploadedDocumentText.trim();
    if (inputMode === "topic") {
      const matching = curriculum.find((s) => s.id === subjectId)?.chapters.find((chapter) => chapter.title.toLowerCase().includes(topic.trim().toLowerCase()) || topic.trim().toLowerCase().includes(chapter.title.toLowerCase()));
      if (!matching) throw new Error("A topic name is not enough source material. Select its curriculum chapter, choose an e-book range, or paste source text.");
      return [matching.title, matching.summary, ...(matching.concepts ?? []), ...(matching.formulas ?? []), ...(matching.questions ?? [])].filter(Boolean).join("\n\n");
    }
    if (inputMode === "ebook") {
      const chapter = selectedEbook.chapters.find(
        (item) => item.id === ebookChapterId || (!ebookChapterId && startPage >= item.startPage && endPage <= item.endPage),
      );
      return `${selectedEbook.title}${chapter ? ` — ${chapter.title}` : ""}, clean pages ${startPage}–${endPage}`;
    }
    // chapter
    const sub = curriculum.find((s) => s.id === subjectId);
    const ch = sub?.chapters.find((c) => c.id === chapterId);
    const concepts = ch?.concepts?.length
      ? `Key concepts: ${ch.concepts.join(", ")}.`
      : "";
    const formulas = ch?.formulas?.length
      ? `Important formulas: ${ch.formulas.join(", ")}.`
      : "";
    return [ch?.title, ch?.summary, concepts, formulas, ...(ch?.questions ?? [])].filter(Boolean).join("\n\n");
  }, [
    inputMode,
    prompt,
    notes,
    topic,
    subjectId,
    chapterId,
    scholarClass,
    curriculum,
    selectedEbook,
    ebookChapterId,
    startPage,
    endPage,
    uploadedDocumentText,
  ]);

  const canAnalyse = useMemo(() => {
    if (generating || analysing) return false;
    if (inputMode === "prompt") return prompt.trim().length > 5;
    if (inputMode === "notes") return notes.trim().length > 20;
    if (inputMode === "document")
      return uploadedDocumentText.trim().length > 20;
    if (inputMode === "topic") return topic.trim().length > 1 && !!subjectId;
    if (inputMode === "chapter") return !!subjectId && !!chapterId;
    if (inputMode === "ebook")
      return (
        startPage >= 1 &&
        endPage >= startPage &&
        endPage <= selectedEbook.pageCount
      );
    return false;
  }, [
    inputMode,
    prompt,
    notes,
    topic,
    subjectId,
    chapterId,
    generating,
    analysing,
    startPage,
    endPage,
    selectedEbook.pageCount,
    uploadedDocumentText,
  ]);

  const canGenerate =
    !generating && !analysing && outline.some((item) => item.included);

  const prepareSource = useCallback(async (): Promise<{
    pages: SlideshowSourcePage[];
    outline: SlideshowOutlineItem[];
    meta: SlideshowSourceMeta;
  }> => {
    setGenerationStageIndex(0);
    setGenStage(
      inputMode === "ebook"
        ? "Reading clean ebook pages…"
        : "Reading source material…",
    );
    if (inputMode === "ebook") {
      const loaded = await loadEbookSource(ebookId);
      const pages = extractEbookPages(
        loaded,
        startPage,
        endPage,
        ebookChapterId || undefined,
      );
      setGenerationStageIndex(1);
      setGenStage("Detecting headings, formulas, figures, and examples…");
      const detected = analyseSourcePages(pages);
      const stats = sourceStatistics(detected);
      const chapter = selectedEbook.chapters.find(
        (item) => item.id === ebookChapterId,
      );
      return {
        pages,
        outline: detected,
        meta: {
          kind: "ebook-pages",
          label: `${selectedEbook.title}${chapter ? ` — ${chapter.title}` : ""}, pages ${startPage}–${endPage}`,
          bookId: selectedEbook.id,
          ebookTitle: selectedEbook.title,
          chapterId: chapter?.id,
          startPage,
          endPage,
          pageCount: pages.length,
          wordCount: stats.wordCount,
        },
      };
    }

    const text = buildPromptText();
    setGenerationStageIndex(1);
    setGenStage("Detecting topics, formulas, examples, and source order…");
    const detected = analysePlainText(text);
    const stats = sourceStatistics(detected);
    const sub = curriculum.find((item) => item.id === subjectId);
    const chapter = sub?.chapters.find((item) => item.id === chapterId);
    return {
      pages: [],
      outline: detected,
      meta: {
        kind: inputMode === "document" ? "uploaded-document" : inputMode,
        label:
          inputMode === "chapter"
            ? `${sub?.name ?? "Class material"} — ${chapter?.title ?? "Selected chapter"}`
            : inputMode === "topic"
              ? topic.trim()
              : inputMode === "notes"
                ? "Pasted study notes"
                : inputMode === "document"
                  ? uploadedDocumentName || "Uploaded text document"
                  : prompt.trim().slice(0, 100),
        chapterId: chapter?.id,
        wordCount: stats.wordCount,
      },
    };
  }, [
    inputMode,
    ebookId,
    startPage,
    endPage,
    ebookChapterId,
    selectedEbook,
    buildPromptText,
    curriculum,
    subjectId,
    chapterId,
    topic,
    prompt,
    uploadedDocumentName,
  ]);

  const handleAnalyse = async () => {
    if (!canAnalyse) {
      toast.error("Please complete the source selection first.");
      return;
    }
    setAnalysing(true);
    try {
      const prepared = await prepareSource();
      setGenerationStageIndex(2);
      setGenStage("Building a complete ordered outline…");
      setSourcePages(prepared.pages);
      setSourceMeta(prepared.meta);
      setOutline(prepared.outline);
      toast.success(
        `Detected ${prepared.outline.length} ordered source topics.`,
      );
    } catch (error) {
      toast.error("Source analysis failed", {
        description:
          error instanceof Error
            ? error.message
            : "The selected source could not be read.",
      });
    } finally {
      setAnalysing(false);
      setGenStage("");
      setGenerationStageIndex(-1);
    }
  };

  const handleGenerate = () => {
    void handleGenerateFromCoverage();
  };

  /* Legacy single-request generator retained in repository history only.
  const handleLegacyGenerate = async () => {
    if (!canGenerate) {
      toast.error("Please fill in the required fields first.");
      return;
    }
    setGenerating(true);
    setGenStage("Composing prompt…");
    try {
      const finalPrompt = buildPromptText();
      const subName =
        curriculum.find((s) => s.id === subjectId)?.name ??
        (inputMode === "prompt" ? "" : "");
      const chName =
        curriculum
          .find((s) => s.id === subjectId)
          ?.chapters.find((c) => c.id === chapterId)?.title ?? "";

      const baseOpts = {
        prompt: finalPrompt,
        scholarClass,
        jeeMode,
        subject: subName,
        chapter: chName,
        mode,
        difficulty,
        template,
        includeSpeakerNotes,
        includeDiagrams,
        includeExamples,
        includePractice,
        includeSummary,
        includeReferences,
        language,
      };

      // Strategy: try with requested count first; if AI returns empty/truncated,
      // automatically retry ONCE with a smaller count (more likely to fit in token budget).
      const tryCounts =
        slideCount > 20
          ? [slideCount, Math.min(20, slideCount), 12]
          : slideCount > 12
            ? [slideCount, 12]
            : [slideCount];

      let lastErr: any = null;
      let parsed: {
        title?: string;
        slides: Slide[];
        partial?: boolean;
      } | null = null;
      let usedCount = slideCount;

      for (const tryCount of tryCounts) {
        const fullPrompt = buildSlideshowPrompt({
          ...baseOpts,
          slideCount: tryCount,
        });
        setGenStage(
          tryCount === slideCount
            ? "Calling AI…"
            : `Retrying with ${tryCount} slides…`,
        );
        try {
          const result = await askAIJSONWithTimeout(
            fullPrompt,
            "default",
            { temperature: 0.55 },
            110_000,
          );
          if (!result) {
            lastErr = new Error(
              "AI returned an empty response. The model may have hit its output limit.",
            );
            continue;
          }
          setGenStage("Validating slides…");
          parsed = validateAIResponse(result);
          if (!parsed || !parsed.slides.length) {
            lastErr = new Error("Could not parse slides from AI response.");
            parsed = null;
            continue;
          }
          usedCount = tryCount;
          break; // success
        } catch (e: any) {
          lastErr = e;
          continue;
        }
      }

      if (!parsed || !parsed.slides.length) {
        throw (
          lastErr ??
          new Error(
            "AI returned an empty response. Please try fewer slides or a simpler prompt.",
          )
        );
      }

      const slideshow = newSlideshow({
        title:
          parsed.title ??
          (inputMode === "prompt" ? prompt.slice(0, 60) : "New Presentation"),
        subject: subName,
        chapter: chName,
        classProfile: scholarClass,
        mode,
        template,
        difficulty,
        language,
        slides: parsed.slides,
      });

      // Auto-save
      const next = upsertSlideshow(slideshow);
      setSaved(next);

      setActive(slideshow);
      setActiveSlideIdx(0);
      setPreviewMode(false);
      addXP(8);
      addCoins(4);
      pushActivity({
        type: "slideshow",
        text: `Created slideshow: ${slideshow.title.slice(0, 40)}`,
        icon: "📽️",
      });

      if (parsed.partial || parsed.slides.length < usedCount) {
        toast.success(
          `Generated ${parsed.slides.length} slides (requested ${usedCount}). · +8 XP, +4 coins`,
          {
            description: parsed.partial
              ? "The AI hit its output limit. You got partial slides — you can add more in the editor."
              : undefined,
          },
        );
      } else {
        toast.success(
          `Generated ${parsed.slides.length} slides! · +8 XP, +4 coins`,
        );
      }
    } catch (e: any) {
      const msg = e?.message || "Please try again in a moment.";
      toast.error("Slideshow generation failed", {
        description: msg.length > 200 ? msg.slice(0, 200) + "…" : msg,
      });
    } finally {
      setGenerating(false);
      setGenStage("");
    }
  };
  */

  const handleGenerateFromCoverage = async () => {
    if (!canGenerate || !sourceMeta) {
      toast.error(
        "Analyse the source and keep at least one outline topic first.",
      );
      return;
    }
    const backgroundTaskId = beginBackgroundTask({
      kind: "slideshow",
      title: "Creating your slideshow",
      message: "Planning source-grounded slides…",
      viewId: "ai-tools",
      toolId: "slideshow-maker",
    });
    setGenerating(true);
    setGenerationStageIndex(3);
    setGenStage("Planning complete slide coverage…");
    let checkpoint: Slideshow | null = null;
    try {
      const subName =
        inputMode === "ebook"
          ? selectedEbook.subject
          : (curriculum.find((s) => s.id === subjectId)?.name ?? "");
      const chName =
        inputMode === "ebook"
          ? (selectedEbook.chapters.find((item) => item.id === ebookChapterId)
              ?.title ?? "Selected pages")
          : (curriculum
              .find((s) => s.id === subjectId)
              ?.chapters.find((c) => c.id === chapterId)?.title ?? "");
      const settings: SlideshowGenerationSettings = {
        slideCount,
        density,
        audience,
        studyMode,
        includeSpeakerNotes,
        includeDiagrams,
        includeExamples,
        includeSummary,
        includeQuiz,
        includeSourceReferences: includeReferences,
      };
      const plans = allocateSlides(outline, settings, normalizedIntent);
      const ledger = makeCoverageLedger(outline, plans);
      checkpoint = newSlideshow({
        title: normalizedIntent.title,
        subject: subName,
        chapter: chName,
        classProfile: scholarClass,
        mode,
        template,
        difficulty,
        language,
        slides: [],
        source: sourceMeta,
        outline: compactOutlineForStorage(outline),
        coverageLedger: ledger,
        generationSettings: settings,
        generationStatus: "partial",
      });

      let generatedSlides: Slide[] = [];
      let recoveredBatches = 0;
      const batches: (typeof plans)[] = [];
      let currentBatch: typeof plans = [];
      let currentChars = 0;
      plans.forEach((plan) => {
        const size = Math.min(plan.sourceText.length, 18_000);
        if (
          currentBatch.length &&
          (currentBatch.length >= 4 || currentChars + size > 38_000)
        ) {
          batches.push(currentBatch);
          currentBatch = [];
          currentChars = 0;
        }
        currentBatch.push(plan);
        currentChars += size;
      });
      if (currentBatch.length) batches.push(currentBatch);

      setGenerationStageIndex(4);
      for (let index = 0; index < batches.length; index += 1) {
        const batch = batches[index];
        updateBackgroundTask(
          backgroundTaskId,
          `Generating batch ${index + 1} of ${batches.length}…`,
        );
        setGenStage(
          `Generating source-grounded slides — batch ${index + 1} of ${batches.length}…`,
        );
        const result = await askAIJSONWithTimeout(
          buildSlideBatchPrompt({
            plans: batch,
            settings,
            source: sourceMeta,
            language,
            subject: subName,
            classProfile: scholarClass,
            intent: normalizedIntent,
          }),
          "default",
          { temperature: 0.35 },
          120_000,
        );
        if (!result) recoveredBatches += 1;
        const batchSlides = parseSlideBatch(
          result,
          batch,
          includeSpeakerNotes,
          density,
        ).map((slide) => ({
          ...slide,
          sourceBookId: sourceMeta.bookId,
          showSourceReference: includeReferences,
        }));
        generatedSlides = [...generatedSlides, ...batchSlides];
        checkpoint = {
          ...checkpoint,
          slides: generatedSlides,
          generationStatus: "partial",
          failedStage: undefined,
        };
        setSaved(upsertSlideshow(checkpoint));
      }

      setGenerationStageIndex(5);
      updateBackgroundTask(backgroundTaskId, "Checking formulas and source coverage…");
      setGenStage("Adding formulas, figures, notes, and source references…");
      setGenerationStageIndex(6);
      setGenStage("Checking every topic and selected page…");
      const expectedPages = sourcePages.map((page) => page.pageNumber);
      generatedSlides = repairSlideQuality(generatedSlides, normalizedIntent);
      let coverage = validateCoverage(generatedSlides, ledger, expectedPages);
      if (
        coverage.report.missingTopicIds.length ||
        coverage.report.missingFormulas.length
      ) {
        generatedSlides = repairMissingCoverage(
          generatedSlides,
          outline,
          coverage.report,
        );
        generatedSlides = repairSlideQuality(generatedSlides, normalizedIntent);
        coverage = validateCoverage(generatedSlides, ledger, expectedPages);
      }
      const quality = assessSlideshowQuality(generatedSlides, coverage.report.percentage);
      if (quality.issues.some((issue) => issue.severity === "critical")) {
        throw new Error("Critical presentation-quality validation failed.");
      }
      setGenerationStageIndex(7);
      setGenStage("Finalising and autosaving presentation…");
      const slideshow: Slideshow = {
        ...checkpoint,
        slides: generatedSlides,
        coverageLedger: coverage.ledger.map((item) => ({
          ...item,
          assignedSlideIds: generatedSlides
            .filter((slide) => slide.topicIds?.includes(item.id))
            .map((slide) => slide.id),
        })),
        coverage: coverage.report,
        quality,
        metadata: {
          sourceType: sourceMeta.kind,
          sourceId: sourceMeta.bookId || sourceMeta.chapterId,
          sourceTitle: sourceMeta.label,
          sourceStartPage: sourceMeta.startPage,
          sourceEndPage: sourceMeta.endPage,
          sourceWordCount: sourceMeta.wordCount,
          detectedTopicCount: outline.filter((item) => item.included).length,
          generatedSlideCount: generatedSlides.length,
          densityMode: density,
          generationModel: "server-configured",
          coveragePercentage: coverage.report.percentage,
          qualityScore: quality.score,
          createdAt: new Date(checkpoint.createdAt).toISOString(),
          updatedAt: new Date().toISOString(),
        },
        generationStatus:
          coverage.report.percentage === 100 && quality.passed ? "complete" : "partial",
        lastAutosavedAt: Date.now(),
      };
      setSaved(upsertSlideshow(slideshow));
      setActive(slideshow);
      setActiveSlideIdx(0);
      setPreviewMode(false);
      addXP(8);
      addCoins(4);
      pushActivity({
        type: "slideshow",
        text: `Created slideshow: ${slideshow.title.slice(0, 40)}`,
        icon: "📽️",
      });
      toast.success(
        `Generated ${slideshow.slides.length} complete slides · +8 XP, +4 coins`,
        {
          description: recoveredBatches
            ? `${recoveredBatches} interrupted AI batch${recoveredBatches === 1 ? " was" : "es were"} safely rebuilt from the selected source.`
            : `Validated ${coverage.report.percentage}% topic and page coverage.`,
        },
      );
      completeBackgroundTask(
        backgroundTaskId,
        `${slideshow.slides.length} slides are ready to open.`,
      );
    } catch {
      failBackgroundTask(
        backgroundTaskId,
        "Generation stopped. Completed work was autosaved.",
      );
      if (checkpoint) {
        checkpoint = {
          ...checkpoint,
          generationStatus: "failed",
          failedStage: genStage || "Generation",
        };
        setSaved(upsertSlideshow(checkpoint));
      }
      toast.error("Slideshow generation failed", {
        description:
          "Completed work was autosaved. Review the source and retry the failed stage.",
      });
    } finally {
      setGenerating(false);
      setGenStage("");
      setGenerationStageIndex(-1);
    }
  };

  // ===== Editor actions =====
  const updateActive = useCallback((updated: Slideshow) => {
    if (updated.coverageLedger?.length) {
      const expectedPages =
        updated.source?.startPage && updated.source?.endPage
          ? Array.from(
              { length: updated.source.endPage - updated.source.startPage + 1 },
              (_, index) => updated.source!.startPage! + index,
            )
          : undefined;
      const coverage = validateCoverage(
        updated.slides,
        updated.coverageLedger,
        expectedPages,
      );
      setActive({
        ...updated,
        coverageLedger: coverage.ledger,
        coverage: coverage.report,
      });
      return;
    }
    setActive(updated);
  }, []);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => {
      const autosaved = { ...active, lastAutosavedAt: Date.now() };
      setSaved(upsertSlideshow(autosaved));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [active]);

  const persistActive = useCallback(() => {
    if (!active) return;
    const next = upsertSlideshow(active);
    setSaved(next);
    toast.success("Slideshow saved");
  }, [active]);

  const handleAddSlide = (type: SlideType = "concept") => {
    if (!active) return;
    const s = newSlide(type, { title: "New Slide" });
    const next = { ...active, slides: [...active.slides] };
    next.slides.splice(activeSlideIdx + 1, 0, s);
    next.updatedAt = Date.now();
    updateActive(next);
    setActiveSlideIdx(activeSlideIdx + 1);
    setEditingSlide(s);
  };

  const handleDeleteSlide = (idx: number) => {
    if (!active) return;
    if (active.slides.length <= 1) {
      toast.error("Cannot delete the only slide.");
      return;
    }
    const next = {
      ...active,
      slides: active.slides.filter((_, i) => i !== idx),
    };
    updateActive(next);
    if (activeSlideIdx >= next.slides.length)
      setActiveSlideIdx(next.slides.length - 1);
  };

  const handleDuplicateSlide = (idx: number) => {
    if (!active) return;
    const orig = active.slides[idx];
    const copy: Slide = {
      ...orig,
      id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: `${orig.title} (copy)`,
    };
    const next = { ...active, slides: [...active.slides] };
    next.slides.splice(idx + 1, 0, copy);
    updateActive(next);
    setActiveSlideIdx(idx + 1);
  };

  const handleMoveSlide = (idx: number, dir: -1 | 1) => {
    if (!active) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= active.slides.length) return;
    const slides = [...active.slides];
    [slides[idx], slides[newIdx]] = [slides[newIdx], slides[idx]];
    updateActive({ ...active, slides });
    setActiveSlideIdx(newIdx);
  };

  const handleSplitSlide = (idx: number) => {
    if (!active) return;
    const original = active.slides[idx];
    const bullets = original.bullets ?? [];
    const midpoint = Math.max(1, Math.ceil(bullets.length / 2));
    const first = { ...original, bullets: bullets.slice(0, midpoint) };
    const second = newSlide(original.type, {
      ...original,
      title: `${original.title} — continued`,
      content: bullets.length
        ? ""
        : original.content.slice(Math.ceil(original.content.length / 2)),
      bullets: bullets.slice(midpoint),
      sourcePages: original.sourcePages,
      sourceBookId: original.sourceBookId,
      topicIds: original.topicIds,
    });
    if (!bullets.length)
      first.content = original.content.slice(
        0,
        Math.ceil(original.content.length / 2),
      );
    const slides = [...active.slides];
    slides.splice(idx, 1, first, second);
    updateActive({ ...active, slides });
    setActiveSlideIdx(idx + 1);
  };

  const handleMergeNextSlide = (idx: number) => {
    if (!active || idx >= active.slides.length - 1) return;
    const first = active.slides[idx];
    const second = active.slides[idx + 1];
    const merged: Slide = {
      ...first,
      title: `${first.title} + ${second.title}`,
      content: [first.content, second.content].filter(Boolean).join("\n\n"),
      bullets: [
        ...new Set([...(first.bullets ?? []), ...(second.bullets ?? [])]),
      ],
      sourcePages: [
        ...new Set([
          ...(first.sourcePages ?? []),
          ...(second.sourcePages ?? []),
        ]),
      ].sort((a, b) => a - b),
      topicIds: [
        ...new Set([...(first.topicIds ?? []), ...(second.topicIds ?? [])]),
      ],
      speakerNotes: [first.speakerNotes, second.speakerNotes]
        .filter(Boolean)
        .join("\n\n"),
    };
    updateActive({
      ...active,
      slides: [
        ...active.slides.slice(0, idx),
        merged,
        ...active.slides.slice(idx + 2),
      ],
    });
  };

  const handleUpdateSlide = (slideId: string, patch: Partial<Slide>) => {
    if (!active) return;
    const next = {
      ...active,
      slides: active.slides.map((s) =>
        s.id === slideId ? { ...s, ...patch } : s,
      ),
    };
    updateActive(next);
    if (editingSlide?.id === slideId)
      setEditingSlide({ ...editingSlide, ...patch });
  };

  const handleRegenerateSlide = async (idx: number) => {
    if (!active) return;
    const slide = active.slides[idx];
    toast.info("Regenerating slide…");
    try {
      const promptText = `Rewrite ONLY this slide's content and speaker notes for a Class ${active.classProfile} ${active.subject} presentation. Make it clearer, more engaging, and academically rigorous. Return JSON.

Source pages: ${(slide.sourcePages ?? []).join(", ") || "not page-based"}
Current source-grounded slide:
${JSON.stringify({ type: slide.type, title: slide.title, content: slide.content, bullets: slide.bullets, formula: slide.formula, speakerNotes: slide.speakerNotes, practiceQuestion: slide.practiceQuestion, practiceAnswer: slide.practiceAnswer }, null, 2)}

Return ONLY JSON in this exact shape:
{
  "title": "...",
  "content": "...",
  "bullets": ["..."],
  "formula": "...",
  "speakerNotes": "...",
  "practiceQuestion": "...",
  "practiceAnswer": "..."
}
Omit any field that doesn't apply. No markdown fences.`;
      const result = await askAIJSON<any>(promptText, "default", {
        temperature: 0.6,
      });
      if (!result) throw new Error("AI returned empty");
      const patch: Partial<Slide> = {};
      if (typeof result.title === "string") patch.title = result.title;
      if (typeof result.content === "string") patch.content = result.content;
      if (Array.isArray(result.bullets))
        patch.bullets = result.bullets.filter(
          (b: any) => typeof b === "string",
        );
      if (typeof result.formula === "string") patch.formula = result.formula;
      if (typeof result.speakerNotes === "string")
        patch.speakerNotes = result.speakerNotes;
      if (typeof result.practiceQuestion === "string")
        patch.practiceQuestion = result.practiceQuestion;
      if (typeof result.practiceAnswer === "string")
        patch.practiceAnswer = result.practiceAnswer;
      handleUpdateSlide(slide.id, patch);
      toast.success("Slide regenerated");
    } catch {
      toast.error("Regeneration failed", {
        description: "The original slide is unchanged. Please retry.",
      });
    }
  };

  const handleRewriteSlide = async (
    idx: number,
    action:
      | "expand"
      | "shorten"
      | "simplify"
      | "example"
      | "formula"
      | "table"
      | "exam",
  ) => {
    if (!active) return;
    const slide = active.slides[idx];
    const map = {
      expand:
        "Expand this slide's content — add more detail, examples, and depth.",
      shorten:
        "Shorten this slide — make every bullet punchier and remove fluff.",
      simplify:
        "Simplify this slide's language so a younger student can understand it.",
      example:
        "Add one accurate worked or concrete example using only the facts already present in this source-grounded slide.",
      formula:
        "Add or improve the formula explanation, defining symbols and units without inventing formulas.",
      table:
        "Convert the material to a concise editable comparison table. Put one row per bullet and separate cells with |.",
      exam: "Add high-yield exam points, likely confusions, and common mistakes grounded in this slide.",
    };
    toast.info(
      `${action === "expand" ? "Expanding" : action === "shorten" ? "Shortening" : "Simplifying"}…`,
    );
    try {
      const promptText = `${map[action]} Return ONLY JSON of the updated slide.

Current slide:
${JSON.stringify({ type: slide.type, title: slide.title, content: slide.content, bullets: slide.bullets, formula: slide.formula, speakerNotes: slide.speakerNotes }, null, 2)}

Return ONLY: { "title": "...", "content": "...", "bullets": ["..."], "speakerNotes": "..." }
No markdown fences.`;
      const result = await askAIJSON<any>(promptText, "default", {
        temperature: 0.55,
      });
      if (!result) throw new Error("AI returned empty");
      const patch: Partial<Slide> = {};
      if (typeof result.title === "string") patch.title = result.title;
      if (typeof result.content === "string") patch.content = result.content;
      if (Array.isArray(result.bullets))
        patch.bullets = result.bullets.filter(
          (b: any) => typeof b === "string",
        );
      if (typeof result.speakerNotes === "string")
        patch.speakerNotes = result.speakerNotes;
      if (action === "table") patch.type = "table";
      handleUpdateSlide(slide.id, patch);
      toast.success(`Slide ${action}ed`);
    } catch {
      toast.error("Rewrite failed", {
        description: "The original slide is unchanged. Please retry.",
      });
    }
  };

  const handleDeleteSlideshow = (id: string) => {
    const next = deleteSlideshow(id, scholarClass);
    setSaved(next);
    if (active?.id === id) {
      setActive(null);
      setActiveSlideIdx(0);
    }
    toast.success("Slideshow deleted");
  };

  const handleFixCoverage = () => {
    if (!active?.coverage || !active.coverageLedger || !active.outline) return;
    const inferredSourceChapter = EBOOK_SLIDESHOW_SOURCES.find((book) => book.id === active.source?.bookId)?.chapters.find((chapter) => (active.source?.startPage ?? 0) >= chapter.startPage && (active.source?.endPage ?? Number.MAX_SAFE_INTEGER) <= chapter.endPage)?.title;
    const repaired = repairMissingCoverage(
      active.slides,
      active.outline,
      active.coverage,
    );
    const fitted = repairSlideQuality(repaired, normalizeSlideshowIntent({
      subject: active.subject,
      classLevel: `Class ${active.classProfile}`,
      chapter: (active.chapter && active.chapter !== "Selected pages" ? active.chapter : inferredSourceChapter) || undefined,
      sourceTitle: active.source?.ebookTitle || active.title,
    }));
    const checked = validateCoverage(
      fitted,
      active.coverageLedger,
      active.coverage.totalPages,
    );
    updateActive({
      ...active,
      slides: fitted,
      coverageLedger: checked.ledger,
      coverage: checked.report,
      quality: assessSlideshowQuality(fitted, checked.report.percentage),
    });
    toast.success(
      checked.report.percentage === 100
        ? "Missing source coverage repaired"
        : "Coverage repair applied",
    );
  };

  const moveOutlineItem = (index: number, direction: -1 | 1) => {
    setOutline((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const mergeOutlineWithNext = (index: number) => {
    setOutline((current) => {
      if (index >= current.length - 1) return current;
      const first = current[index];
      const second = current[index + 1];
      const merged: SlideshowOutlineItem = {
        ...first,
        title: `${first.title} + ${second.title}`,
        sourcePages: [
          ...new Set([...first.sourcePages, ...second.sourcePages]),
        ].sort((a, b) => a - b),
        subtopics: [...new Set([...first.subtopics, ...second.subtopics])],
        sourceText: `${first.sourceText}\n\n${second.sourceText}`,
        formulas: [...new Set([...first.formulas, ...second.formulas])],
        figureReferences: [
          ...new Set([...first.figureReferences, ...second.figureReferences]),
        ],
        importance:
          first.importance === "core" || second.importance === "core"
            ? "core"
            : "important",
        included: first.included || second.included,
      };
      return [...current.slice(0, index), merged, ...current.slice(index + 2)];
    });
  };

  // ===== If a slideshow is active, show the editor =====
  if (active) {
    return (
      <SlideshowEditor
        slideshow={active}
        activeSlideIdx={activeSlideIdx}
        setActiveSlideIdx={setActiveSlideIdx}
        editingSlide={editingSlide}
        setEditingSlide={setEditingSlide}
        previewMode={previewMode}
        setPreviewMode={setPreviewMode}
        fullscreenPreview={fullscreenPreview}
        setFullscreenPreview={setFullscreenPreview}
        narrationMode={narrationMode}
        setNarrationMode={setNarrationMode}
        onUpdate={updateActive}
        onPersist={persistActive}
        onExit={() => {
          setActive(null);
          setEditingSlide(null);
          setPreviewMode(false);
          setNarrationMode(false);
        }}
        onAddSlide={handleAddSlide}
        onDeleteSlide={handleDeleteSlide}
        onDuplicateSlide={handleDuplicateSlide}
        onMoveSlide={handleMoveSlide}
        onSplitSlide={handleSplitSlide}
        onMergeNextSlide={handleMergeNextSlide}
        onUpdateSlide={handleUpdateSlide}
        onRegenerateSlide={handleRegenerateSlide}
        onRewriteSlide={handleRewriteSlide}
        onFixCoverage={handleFixCoverage}
      />
    );
  }

  // ===== Generation form =====
  const selectedSubject = curriculum.find((s) => s.id === subjectId);
  const analysedStats = outline.length ? sourceStatistics(outline) : null;
  const recommendations = outline.length ? recommendSlideCounts(outline) : null;
  const selectedRecommendation = recommendations?.[density];

  return (
    <div className="space-y-6" data-testid="slideshow-maker">
      {/* Top bar: saved library — ALWAYS visible */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-white/50 flex items-center gap-2">
          <Presentation className="h-3.5 w-3.5" />
          Class {scholarClass}
          {jeeMode ? " · JEE Mode" : ""}
        </div>
        <button
          onClick={() => setLibraryOpen(true)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/15 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
        >
          <Layers className="h-3.5 w-3.5" /> My Slideshows
          {saved.length > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-violet-500/30 text-violet-200 text-[10px] font-bold">
              {saved.length}
            </span>
          )}
        </button>
      </div>

      {/* Recently saved slideshows (quick access) */}
      {saved.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">
              Recent slideshows
            </p>
            <button
              onClick={() => setLibraryOpen(true)}
              className="text-[10px] text-violet-300 hover:text-violet-200"
            >
              View all →
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {saved.slice(0, 6).map((s) => {
              const tpl = getTemplate(s.template);
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setActive(s);
                    setActiveSlideIdx(0);
                  }}
                  className="shrink-0 w-40 rounded-lg overflow-hidden border border-white/10 hover:border-violet-500/40 transition-colors text-left group"
                >
                  <div className="h-16" style={{ background: tpl.swatch }} />
                  <div className="p-2 bg-white/[0.02]">
                    <p className="text-[11px] text-white/80 truncate group-hover:text-white">
                      {s.title}
                    </p>
                    <p className="text-[9px] text-white/40">
                      {s.slides.length} slides · {s.subject || "General"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Input mode tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
        {INPUT_MODES.filter(
          (item) => item.id !== "ebook" || scholarClass === 11,
        ).map((m) => {
          const Icon = m.icon;
          const isActive = inputMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setInputMode(m.id)}
              className={cn(
                "flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all",
                isActive
                  ? "bg-violet-500/15 border-violet-500/40 text-white"
                  : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="text-xs font-medium">{m.name}</span>
              <span className="text-[10px] text-white/40 leading-tight">
                {m.hint}
              </span>
            </button>
          );
        })}
      </div>

      {/* Input area */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        {inputMode === "prompt" && (
          <div>
            <label className="text-[10px] font-medium uppercase tracking-wider text-white/50">
              Your prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="e.g., Create a 12-slide Class 11 Physics presentation on Units and Measurement with formulas, examples, and practice questions."
              className="mt-1.5 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/40 resize-y"
            />
          </div>
        )}

        {inputMode === "notes" && (
          <div>
            <label className="text-[10px] font-medium uppercase tracking-wider text-white/50">
              Paste your notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              placeholder="Paste rough notes, bullet points, or any text. The AI will turn it into a structured presentation."
              className="mt-1.5 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/40 resize-y font-mono"
            />
          </div>
        )}

        {inputMode === "document" && (
          <div className="space-y-3">
            <label className="block cursor-pointer rounded-xl border border-dashed border-white/15 bg-white/[0.03] p-5 text-center hover:border-violet-400/40 hover:bg-violet-400/[0.04] transition-colors">
              <FileUp className="h-6 w-6 mx-auto text-violet-300" />
              <span className="mt-2 block text-sm font-medium text-white">
                Choose a text-based study document
              </span>
              <span className="mt-1 block text-[10px] text-white/40">
                TXT, Markdown, JSON, or CSV · maximum 2 MB
              </span>
              <input
                type="file"
                accept=".txt,.md,.markdown,.json,.csv,text/plain,text/markdown,application/json,text/csv"
                className="sr-only"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (file.size > 2_000_000) {
                    toast.error("That document is larger than 2 MB.");
                    event.target.value = "";
                    return;
                  }
                  try {
                    const text = await file.text();
                    if (text.trim().length < 20) throw new Error();
                    setUploadedDocumentName(file.name);
                    setUploadedDocumentText(text);
                    toast.success("Document text loaded");
                  } catch {
                    toast.error(
                      "The selected file does not contain readable text.",
                    );
                    event.target.value = "";
                  }
                }}
              />
            </label>
            {uploadedDocumentName && (
              <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100 flex items-center justify-between gap-2">
                <span className="truncate">
                  {uploadedDocumentName} · Approximately{" "}
                  {uploadedDocumentText
                    .split(/\s+/)
                    .filter(Boolean)
                    .length.toLocaleString()}{" "}
                  words
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setUploadedDocumentName("");
                    setUploadedDocumentText("");
                  }}
                  className="text-emerald-100/60 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {inputMode === "topic" && (
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                Topic
              </label>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Newton's Laws of Motion"
                className="mt-1.5 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                Subject
              </label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="mt-1.5 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              >
                <option value="">Pick subject…</option>
                {curriculum.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {inputMode === "chapter" && (
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                Subject
              </label>
              <select
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  setChapterId("");
                }}
                className="mt-1.5 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              >
                <option value="">Pick subject…</option>
                {curriculum.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                Chapter
              </label>
              <select
                value={chapterId}
                onChange={(e) => setChapterId(e.target.value)}
                disabled={!selectedSubject}
                className="mt-1.5 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-50"
              >
                <option value="">
                  {selectedSubject ? "Pick chapter…" : "Pick a subject first"}
                </option>
                {selectedSubject?.chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {inputMode === "ebook" && (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Subject">
                <select
                  value={selectedEbook.subject}
                  onChange={(event) => {
                    const book = EBOOK_SLIDESHOW_SOURCES.find(
                      (item) => item.subject === event.target.value,
                    );
                    if (!book) return;
                    setEbookId(book.id);
                    setEbookChapterId("");
                    setStartPage(1);
                    setEndPage(book.pageCount);
                  }}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                >
                  {[
                    ...new Set(
                      EBOOK_SLIDESHOW_SOURCES.map((item) => item.subject),
                    ),
                  ].map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Clean ebook">
                <select
                  value={ebookId}
                  onChange={(event) => {
                    const book = EBOOK_SLIDESHOW_SOURCES.find(
                      (item) => item.id === event.target.value,
                    );
                    if (!book) return;
                    setEbookId(book.id);
                    setEbookChapterId("");
                    setStartPage(1);
                    setEndPage(book.pageCount);
                  }}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                >
                  {EBOOK_SLIDESHOW_SOURCES.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Chapter (optional)">
                <select
                  value={ebookChapterId}
                  onChange={(event) => {
                    const id = event.target.value;
                    setEbookChapterId(id);
                    const chapter = selectedEbook.chapters.find(
                      (item) => item.id === id,
                    );
                    if (chapter) {
                      setStartPage(chapter.startPage);
                      setEndPage(chapter.endPage);
                    } else {
                      setStartPage(1);
                      setEndPage(selectedEbook.pageCount);
                    }
                  }}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                >
                  <option value="">Whole ebook</option>
                  {selectedEbook.chapters.map((chapter) => (
                    <option key={chapter.id} value={chapter.id}>
                      {chapter.title}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Starting page">
                <input
                  aria-label="Starting page"
                  type="number"
                  min={1}
                  max={selectedEbook.pageCount}
                  value={startPage}
                  onChange={(event) => setStartPage(Number(event.target.value))}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                />
              </Field>
              <Field label="Ending page">
                <input
                  aria-label="Ending page"
                  type="number"
                  min={1}
                  max={selectedEbook.pageCount}
                  value={endPage}
                  onChange={(event) => setEndPage(Number(event.target.value))}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                />
              </Field>
            </div>
            <div
              className={cn(
                "rounded-xl border px-3 py-2 text-xs",
                startPage >= 1 &&
                  endPage >= startPage &&
                  endPage <= selectedEbook.pageCount
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-100"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-100",
              )}
            >
              {startPage < 1
                ? "Start page must be at least 1."
                : endPage < startPage
                  ? "End page cannot be before the start page."
                  : endPage > selectedEbook.pageCount
                    ? `End page cannot exceed ${selectedEbook.pageCount}.`
                    : `Selected range: Pages ${startPage}–${endPage} · ${endPage - startPage + 1} pages${sourceMeta ? ` · Approximately ${sourceMeta.wordCount.toLocaleString()} words` : ""}`}
            </div>
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
        <div className="flex items-center gap-2 text-xs font-medium text-white/70">
          <Sparkles className="h-3.5 w-3.5 text-violet-300" /> Generation
          Settings
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="Slides">
            <input
              type="number"
              min={3}
              max={45}
              value={slideCount}
              onChange={(e) =>
                setSlideCount(Math.max(3, Math.min(45, +e.target.value || 28)))
              }
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            />
          </Field>
          <Field label="Content density">
            <select
              value={density}
              onChange={(e) => setDensity(e.target.value as SlideshowDensity)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            >
              <option value="concise">Concise</option>
              <option value="balanced">Balanced</option>
              <option value="detailed">Detailed</option>
              <option value="exam-revision">Exam Revision</option>
            </select>
          </Field>
          <Field label="Audience level">
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as SlideshowAudience)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            >
              <option value="beginner">Beginner</option>
              <option value="class-11">Class 11</option>
              <option value="exam-revision">Exam revision</option>
              <option value="advanced">Advanced</option>
              <option value="teacher">Teacher presentation</option>
            </select>
          </Field>
          <Field label="Mode">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as SlideshowMode)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            >
              {MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Difficulty">
            <select
              value={difficulty}
              onChange={(e) =>
                setDifficulty(e.target.value as SlideshowDifficulty)
              }
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            >
              {DIFFICULTIES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Language">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            >
              {["English", "Hindi", "Bilingual (English + Hindi)"].map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Template">
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value as SlideshowTemplate)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            >
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid sm:grid-cols-3 gap-2">
          {(
            [
              { id: "standard", label: "Standard", hint: "Custom settings" },
              {
                id: "deep-study",
                label: "Deep Study Slideshow",
                hint: "Detailed learning deck",
              },
              {
                id: "exam-crash",
                label: "Exam Crash Revision",
                hint: "Complete high-yield review",
              },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setStudyMode(item.id);
                if (item.id === "deep-study") {
                  setDensity("detailed");
                  setIncludeSpeakerNotes(true);
                  setIncludeExamples(true);
                  setIncludeDiagrams(true);
                  setIncludeSummary(true);
                  setIncludeQuiz(true);
                  if (outline.length) {
                    const range = recommendSlideCounts(outline).detailed;
                    setSlideCount(
                      Math.min(
                        45,
                        Math.max(16, Math.round((range.min + range.max) / 2)),
                      ),
                    );
                  }
                }
                if (item.id === "exam-crash") {
                  setDensity("exam-revision");
                  setAudience("exam-revision");
                  setIncludeSummary(true);
                  setIncludeQuiz(true);
                  if (outline.length) {
                    const range =
                      recommendSlideCounts(outline)["exam-revision"];
                    setSlideCount(
                      Math.min(
                        45,
                        Math.max(10, Math.round((range.min + range.max) / 2)),
                      ),
                    );
                  }
                }
              }}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                studyMode === item.id
                  ? "border-cyan-400/40 bg-cyan-400/10 text-white"
                  : "border-white/10 bg-white/[0.03] text-white/60 hover:text-white",
              )}
            >
              <span className="block text-xs font-semibold">{item.label}</span>
              <span className="mt-0.5 block text-[10px] opacity-60">
                {item.hint}
              </span>
            </button>
          ))}
        </div>

        {/* Template swatch preview */}
        <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 p-2">
          <div
            className="h-10 w-16 rounded-md shrink-0"
            style={{ background: getTemplate(template).swatch }}
          />
          <div className="text-xs">
            <p className="text-white/80 font-medium">
              {getTemplate(template).name}
            </p>
            <p className="text-white/40">{getTemplate(template).blurb}</p>
          </div>
        </div>

        {/* Toggles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            {
              label: "Speaker Notes",
              v: includeSpeakerNotes,
              set: setIncludeSpeakerNotes,
              icon: Presentation,
            },
            {
              label: "Diagrams",
              v: includeDiagrams,
              set: setIncludeDiagrams,
              icon: ImageIcon,
            },
            {
              label: "Examples",
              v: includeExamples,
              set: setIncludeExamples,
              icon: Lightbulb,
            },
            {
              label: "Practice Qs",
              v: includePractice,
              set: setIncludePractice,
              icon: ListChecks,
            },
            {
              label: "Quiz",
              v: includeQuiz,
              set: setIncludeQuiz,
              icon: ListChecks,
            },
            {
              label: "Summary",
              v: includeSummary,
              set: setIncludeSummary,
              icon: Trophy,
            },
            {
              label: "References",
              v: includeReferences,
              set: setIncludeReferences,
              icon: Link2,
            },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.label}
                onClick={() => t.set(!t.v)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors",
                  t.v
                    ? "bg-violet-500/15 border-violet-500/40 text-white"
                    : "bg-white/5 border-white/10 text-white/50 hover:text-white",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
                <span
                  className={cn(
                    "ml-auto h-2 w-2 rounded-full",
                    t.v ? "bg-violet-400" : "bg-white/20",
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Source analysis and complete outline */}
      {!outline.length ? (
        <button
          onClick={handleAnalyse}
          disabled={!canAnalyse}
          className={cn(
            "w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-all",
            canAnalyse
              ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500"
              : "bg-white/5 text-white/30 cursor-not-allowed",
          )}
        >
          {analysing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ListChecks className="h-4 w-4" />
          )}
          {analysing
            ? genStage || "Analysing source…"
            : "Analyse source & review complete outline"}
        </button>
      ) : (
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.04] overflow-hidden">
          <div className="p-4 border-b border-white/10 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" /> Complete
                ordered outline
              </p>
              <p className="text-[11px] text-white/45 mt-1">
                {analysedStats?.topicCount} topics ·{" "}
                {analysedStats?.subtopicCount} subtopics ·{" "}
                {analysedStats?.formulaCount} formulas ·{" "}
                {analysedStats?.figureCount} figures
              </p>
              {sourceMeta && (
                <p className="text-[11px] text-cyan-100/70 mt-1">
                  {sourceMeta.startPage
                    ? `Selected range: Pages ${sourceMeta.startPage}–${sourceMeta.endPage} · ${sourceMeta.pageCount} pages · `
                    : ""}
                  Approximately {sourceMeta.wordCount.toLocaleString()} words
                </p>
              )}
            </div>
            <button
              onClick={handleAnalyse}
              className="text-[11px] px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white/60 hover:text-white flex items-center gap-1.5"
            >
              <RefreshCw className="h-3 w-3" /> Analyse again
            </button>
          </div>

          {selectedRecommendation && analysedStats && (
            <div className="m-3 rounded-xl border border-violet-400/20 bg-violet-400/[0.06] p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-white/70">
                <span className="font-semibold text-white">
                  Recommended for {density.replace("-", " ")}:
                </span>{" "}
                {selectedRecommendation.min}–{selectedRecommendation.max} slides
                <span className="text-white/35"> · Selected: {slideCount}</span>
              </div>
              <button
                onClick={() =>
                  setSlideCount(
                    Math.min(
                      45,
                      Math.round(
                        (selectedRecommendation.min +
                          selectedRecommendation.max) /
                          2,
                      ),
                    ),
                  )
                }
                className="text-[11px] rounded-lg bg-violet-500/20 border border-violet-400/30 px-2.5 py-1.5 text-violet-100 hover:bg-violet-500/30"
              >
                Use recommendation
              </button>
            </div>
          )}

          {selectedRecommendation &&
            slideCount < selectedRecommendation.min && (
              <div className="mx-3 mb-3 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-xs text-amber-100 flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  This source contains approximately {analysedStats?.topicCount} major source sections. {slideCount} slides will produce a heavily compressed overview. Recommended: {selectedRecommendation.min}–{selectedRecommendation.max} slides. If you continue, Scholar will distribute every section across the available slides instead of skipping the end of the source.
                </span>
              </div>
            )}

          <div
            className="max-h-80 overflow-y-auto p-3 space-y-2"
            data-testid="slideshow-outline"
          >
            {outline.map((item, index) => (
              <div
                key={item.id}
                className={cn(
                  "rounded-xl border p-2.5 flex items-start gap-2",
                  item.included
                    ? "border-white/10 bg-white/[0.03]"
                    : "border-white/5 bg-black/10 opacity-55",
                )}
              >
                <GripVertical className="h-4 w-4 text-white/25 mt-1 shrink-0" />
                <button
                  type="button"
                  aria-label={`${item.included ? "Exclude" : "Include"} ${item.title}`}
                  onClick={() =>
                    setOutline((current) =>
                      current.map((entry) =>
                        entry.id === item.id
                          ? { ...entry, included: !entry.included }
                          : entry,
                      ),
                    )
                  }
                  className={cn(
                    "mt-1 h-4 w-4 rounded border shrink-0",
                    item.included
                      ? "border-emerald-400 bg-emerald-400/25"
                      : "border-white/20",
                  )}
                />
                <div className="flex-1 min-w-0">
                  <input
                    aria-label={`Outline topic ${index + 1}`}
                    value={item.title}
                    onChange={(event) =>
                      setOutline((current) =>
                        current.map((entry) =>
                          entry.id === item.id
                            ? { ...entry, title: event.target.value }
                            : entry,
                        ),
                      )
                    }
                    className="w-full bg-transparent text-xs font-medium text-white outline-none border-b border-transparent focus:border-violet-400/40"
                  />
                  <p className="mt-1 text-[10px] text-white/40 line-clamp-2">
                    {formatPageRange(item.sourcePages) || "Pasted source"} ·{" "}
                    {item.subtopics.slice(0, 3).join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    aria-label="Move topic up"
                    onClick={() => moveOutlineItem(index, -1)}
                    disabled={index === 0}
                    className="p-1 text-white/40 hover:text-white disabled:opacity-20"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    aria-label="Move topic down"
                    onClick={() => moveOutlineItem(index, 1)}
                    disabled={index === outline.length - 1}
                    className="p-1 text-white/40 hover:text-white disabled:opacity-20"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                  <button
                    aria-label="Merge with next topic"
                    title="Merge with next"
                    onClick={() => mergeOutlineWithNext(index)}
                    disabled={index === outline.length - 1}
                    className="p-1 text-white/40 hover:text-cyan-200 disabled:opacity-20"
                  >
                    <Merge className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 px-4 py-2.5 text-[10px] text-white/40">
            Every topic is included by default. Exclusions happen only when you
            turn a topic off.
          </div>
        </div>
      )}

      {(generating || analysing) && generationStageIndex >= 0 && (
        <div
          className="rounded-xl border border-violet-400/20 bg-violet-400/[0.05] p-3"
          aria-live="polite"
        >
          <p className="text-xs font-medium text-white">
            {genStage || generationStages[generationStageIndex]}
          </p>
          <div className="mt-2 grid grid-cols-4 sm:grid-cols-8 gap-1">
            {generationStages.map((stage, index) => (
              <div
                key={stage}
                className={cn(
                  "h-1.5 rounded-full",
                  index <= generationStageIndex
                    ? "bg-violet-400"
                    : "bg-white/10",
                )}
                title={stage}
              />
            ))}
          </div>
          <p className="text-[10px] text-white/35 mt-1.5">
            Stage {generationStageIndex + 1} of {generationStages.length}
          </p>
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate}
        className={cn(
          "w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-all",
          canGenerate
            ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600 shadow-lg shadow-violet-500/25"
            : "bg-white/5 text-white/30 cursor-not-allowed",
        )}
      >
        {generating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {genStage || "Generating…"}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate {slideCount}-slide source-complete presentation
          </>
        )}
      </button>

      {!canGenerate && !generating && (
        <p className="text-center text-xs text-white/40">
          {outline.length
            ? "Keep at least one outline topic included."
            : canAnalyse
              ? "Analyse the source and review its complete outline before generation."
              : inputMode === "prompt"
                ? "Write at least a few words to analyse."
                : inputMode === "notes"
                  ? "Paste a meaningful chunk of notes (20+ characters)."
                  : inputMode === "topic"
                    ? "Pick a subject and type a topic."
                    : inputMode === "chapter"
                      ? "Pick a subject and chapter."
                      : inputMode === "document"
                        ? "Choose a readable text document."
                        : "Choose a valid clean ebook page range."}
        </p>
      )}

      {/* Saved library modal */}
      <AnimatePresence>
        {libraryOpen &&
          typeof document !== "undefined" &&
          createPortal(
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLibraryOpen(false)}
              className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm grid place-items-center p-4"
            >
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-3xl max-h-[80vh] overflow-hidden rounded-2xl border border-white/15 bg-zinc-950/95 backdrop-blur-xl flex flex-col"
              >
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Layers className="h-4 w-4" /> Saved Slideshows
                    </h3>
                    <p className="text-[11px] text-white/40 mt-0.5">
                      {saved.length} presentation{saved.length === 1 ? "" : "s"}{" "}
                      saved locally
                    </p>
                  </div>
                  <button
                    onClick={() => setLibraryOpen(false)}
                    className="text-white/50 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-3 border-b border-white/10">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by title, subject, or chapter…"
                      className="w-full rounded-lg bg-white/5 border border-white/10 pl-9 pr-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {saved.length === 0 && (
                    <div className="text-center py-10 text-white/40 text-sm">
                      No saved slideshows yet. Generate one above!
                    </div>
                  )}
                  {saved
                    .filter(
                      (s) =>
                        !search ||
                        s.title.toLowerCase().includes(search.toLowerCase()) ||
                        s.subject
                          .toLowerCase()
                          .includes(search.toLowerCase()) ||
                        s.chapter.toLowerCase().includes(search.toLowerCase()),
                    )
                    .map((s) => {
                      const tpl = getTemplate(s.template);
                      return (
                        <div
                          key={s.id}
                          className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 hover:bg-white/[0.06] transition-colors"
                        >
                          <div
                            className="h-12 w-16 rounded-md shrink-0"
                            style={{ background: tpl.swatch }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {s.title}
                            </p>
                            <p className="text-[11px] text-white/40 truncate">
                              Class {s.classProfile} · {s.subject || "—"} ·{" "}
                              {s.chapter || "—"} · {s.slides.length} slides ·{" "}
                              {tpl.name}
                            </p>
                            <p className="text-[10px] text-white/30 mt-0.5">
                              Created{" "}
                              {new Date(s.createdAt).toLocaleDateString()} ·
                              Updated{" "}
                              {new Date(s.updatedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => {
                                setActive(s);
                                setActiveSlideIdx(0);
                                setLibraryOpen(false);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-violet-500/20 border border-violet-500/40 text-violet-200 text-xs hover:bg-violet-500/30"
                            >
                              Open
                            </button>
                            <button
                              onClick={() => {
                                const dup = {
                                  ...s,
                                  id: `slideshow-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                  title: `${s.title} (copy)`,
                                  createdAt: Date.now(),
                                  updatedAt: Date.now(),
                                };
                                const next = upsertSlideshow(dup);
                                setSaved(next);
                                toast.success("Duplicated");
                              }}
                              className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white"
                              title="Duplicate"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSlideshow(s.id)}
                              className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-rose-300 hover:border-rose-500/30"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </motion.div>
            </motion.div>,
            document.body,
          )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Editor
// ============================================================================

interface EditorProps {
  slideshow: Slideshow;
  activeSlideIdx: number;
  setActiveSlideIdx: (i: number) => void;
  editingSlide: Slide | null;
  setEditingSlide: (s: Slide | null) => void;
  previewMode: boolean;
  setPreviewMode: (b: boolean) => void;
  fullscreenPreview: boolean;
  setFullscreenPreview: (b: boolean) => void;
  narrationMode: boolean;
  setNarrationMode: (b: boolean) => void;
  onUpdate: (s: Slideshow) => void;
  onPersist: () => void;
  onExit: () => void;
  onAddSlide: (type: SlideType) => void;
  onDeleteSlide: (idx: number) => void;
  onDuplicateSlide: (idx: number) => void;
  onMoveSlide: (idx: number, dir: -1 | 1) => void;
  onSplitSlide: (idx: number) => void;
  onMergeNextSlide: (idx: number) => void;
  onUpdateSlide: (id: string, patch: Partial<Slide>) => void;
  onRegenerateSlide: (idx: number) => void;
  onRewriteSlide: (
    idx: number,
    action:
      | "expand"
      | "shorten"
      | "simplify"
      | "example"
      | "formula"
      | "table"
      | "exam",
  ) => void;
  onFixCoverage: () => void;
}

function SlideshowEditor(props: EditorProps) {
  const {
    slideshow,
    activeSlideIdx,
    setActiveSlideIdx,
    editingSlide,
    setEditingSlide,
    previewMode,
    setPreviewMode,
    fullscreenPreview,
    setFullscreenPreview,
    narrationMode,
    setNarrationMode,
    onUpdate,
    onPersist,
    onExit,
    onAddSlide,
    onDeleteSlide,
    onDuplicateSlide,
    onMoveSlide,
    onSplitSlide,
    onMergeNextSlide,
    onUpdateSlide,
    onRegenerateSlide,
    onRewriteSlide,
    onFixCoverage,
  } = props;

  const tpl = getTemplate(slideshow.template);
  const activeSlide = slideshow.slides[activeSlideIdx];

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        setActiveSlideIdx(
          Math.min(slideshow.slides.length - 1, activeSlideIdx + 1),
        );
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setActiveSlideIdx(Math.max(0, activeSlideIdx - 1));
      } else if (e.key === "Escape" && fullscreenPreview) {
        setFullscreenPreview(false);
      } else if (e.key === "f" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setFullscreenPreview(!fullscreenPreview);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    activeSlideIdx,
    slideshow.slides.length,
    fullscreenPreview,
    setActiveSlideIdx,
    setFullscreenPreview,
  ]);

  // Title editing
  const [titleEdit, setTitleEdit] = useState(false);
  const [titleDraft, setTitleDraft] = useState(slideshow.title);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setTitleDraft(slideshow.title);
    });
    return () => {
      cancelled = true;
    };
  }, [slideshow.title]);

  // ===== Fullscreen preview =====
  if (fullscreenPreview) {
    return (
      <FullscreenPreview
        slideshow={slideshow}
        initialIdx={activeSlideIdx}
        onExit={() => setFullscreenPreview(false)}
      />
    );
  }

  // ===== Narration / Auto-Lecture mode =====
  if (narrationMode) {
    return (
      <NarratedSlideshowMaker
        slideshow={slideshow}
        onExit={() => setNarrationMode(false)}
      />
    );
  }

  // ===== Preview mode (single slide, big) =====
  if (previewMode) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            onClick={() => setPreviewMode(false)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back to editor
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50">
              {activeSlideIdx + 1} / {slideshow.slides.length}
            </span>
            <button
              onClick={() => setFullscreenPreview(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-violet-500/20 border border-violet-500/40 text-violet-200 hover:bg-violet-500/30 transition-colors"
            >
              <Maximize2 className="h-3.5 w-3.5" /> Present Fullscreen
            </button>
          </div>
        </div>
        <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
          <SlideStage
            slide={activeSlide}
            tpl={tpl}
            className="aspect-video w-full"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setActiveSlideIdx(Math.max(0, activeSlideIdx - 1))}
            disabled={activeSlideIdx === 0}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <span className="text-xs text-white/50 truncate max-w-[60%]">
            {activeSlide.title}
          </span>
          <button
            onClick={() =>
              setActiveSlideIdx(
                Math.min(slideshow.slides.length - 1, activeSlideIdx + 1),
              )
            }
            disabled={activeSlideIdx === slideshow.slides.length - 1}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white disabled:opacity-40 transition-colors"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // ===== Editor (three-panel layout) =====
  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> New
          </button>
          <button
            onClick={() => {
              onPersist();
            }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            title="My saved slideshows"
          >
            <Layers className="h-3.5 w-3.5" /> Library
          </button>
          {titleEdit ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => {
                onUpdate({ ...slideshow, title: titleDraft || "Untitled" });
                setTitleEdit(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onUpdate({ ...slideshow, title: titleDraft || "Untitled" });
                  setTitleEdit(false);
                }
              }}
              className="text-sm bg-white/5 border border-white/15 rounded-lg px-2 py-1 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40 min-w-0"
            />
          ) : (
            <button
              onClick={() => setTitleEdit(true)}
              className="text-sm font-medium text-white hover:text-violet-300 flex items-center gap-1.5 min-w-0"
            >
              <span className="truncate">{slideshow.title}</span>
              <Edit3 className="h-3 w-3 text-white/40 shrink-0" />
            </button>
          )}
        </div>
        <div className="flex w-full sm:w-auto items-center gap-1.5 flex-wrap sm:justify-end">
          <button
            onClick={() => setPreviewMode(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Eye className="h-3.5 w-3.5" /> Preview
          </button>
          <button
            onClick={() => setFullscreenPreview(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Play className="h-3.5 w-3.5" /> Present
          </button>
          <button
            onClick={() => setNarrationMode(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 border border-violet-400/40 text-violet-100 hover:from-violet-500/30 hover:to-fuchsia-500/30 transition-colors"
            title="AI Narrated Slideshow / Auto-Lecture Mode"
          >
            <Mic className="h-3.5 w-3.5" /> Auto-Lecture
          </button>
          <ExportMenu slideshow={slideshow} />
          <button
            onClick={onPersist}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-violet-500/20 border border-violet-500/40 text-violet-200 hover:bg-violet-500/30"
          >
            <Save className="h-3.5 w-3.5" /> Save
          </button>
        </div>
      </div>

      {slideshow.source && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/50">
          <span className="truncate">
            <strong className="text-white/75">Source:</strong>{" "}
            {slideshow.source.label}
          </span>
          <span>
            {slideshow.lastAutosavedAt
              ? `Autosaved ${new Date(slideshow.lastAutosavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "Autosave active"}
          </span>
        </div>
      )}

      {slideshow.coverage && (
        <CoveragePanel slideshow={slideshow} onFix={onFixCoverage} />
      )}
      {slideshow.quality && <QualityPanel slideshow={slideshow} onFix={onFixCoverage} />}

      {/* Layout: thumbnails | main stage | edit panel */}
      <div className="grid grid-cols-12 gap-3">
        {/* Left: thumbnails */}
        <div className="col-span-12 lg:col-span-3 order-2 lg:order-1">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2 max-h-[calc(100vh-20rem)] overflow-y-auto sticky top-2">
            <div className="text-[10px] font-medium uppercase tracking-wider text-white/40 px-2 py-1.5 sticky top-0 bg-zinc-950/95 backdrop-blur-sm z-10">
              {slideshow.slides.length} slides
            </div>
            <div className="space-y-1.5">
              {slideshow.slides.map((s, i) => (
                <ThumbCard
                  key={s.id}
                  slide={s}
                  index={i}
                  active={i === activeSlideIdx}
                  tpl={tpl}
                  onClick={() => {
                    setActiveSlideIdx(i);
                    setEditingSlide(null);
                  }}
                />
              ))}
              <button
                onClick={() => onAddSlide("concept")}
                className="w-full flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg border border-dashed border-white/15 text-white/50 hover:text-white hover:border-violet-500/40 hover:bg-violet-500/5 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add slide
              </button>
            </div>
          </div>
        </div>

        {/* Center: main stage */}
        <div className="col-span-12 lg:col-span-6 order-1 lg:order-2">
          <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            <SlideStage
              slide={activeSlide}
              tpl={tpl}
              className="aspect-video w-full"
            />
          </div>
          {/* Stage controls */}
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => onMoveSlide(activeSlideIdx, -1)}
                disabled={activeSlideIdx === 0}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white disabled:opacity-40"
                title="Move up"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onMoveSlide(activeSlideIdx, 1)}
                disabled={activeSlideIdx === slideshow.slides.length - 1}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white disabled:opacity-40"
                title="Move down"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onDuplicateSlide(activeSlideIdx)}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white"
                title="Duplicate"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onDeleteSlide(activeSlideIdx)}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-rose-300 hover:border-rose-500/30"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-white/50">
              <span>
                {activeSlideIdx + 1} / {slideshow.slides.length}
              </span>
              <span className="text-white/30">·</span>
              <span>
                {getSlideTypeMeta(activeSlide.type).icon}{" "}
                {getSlideTypeMeta(activeSlide.type).name}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  setEditingSlide(
                    editingSlide?.id === activeSlide.id ? null : activeSlide,
                  )
                }
                className={cn(
                  "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border",
                  editingSlide?.id === activeSlide.id
                    ? "bg-violet-500/15 border-violet-500/40 text-violet-200"
                    : "bg-white/5 border-white/10 text-white/60 hover:text-white",
                )}
              >
                <Edit3 className="h-3.5 w-3.5" /> Edit
              </button>
            </div>
          </div>

          {/* AI rewrite actions */}
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => onRegenerateSlide(activeSlideIdx)}
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-white/60 hover:text-white"
            >
              <RefreshCw className="h-3 w-3" /> Regenerate
            </button>
            <button
              onClick={() => onRewriteSlide(activeSlideIdx, "expand")}
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-white/60 hover:text-white"
            >
              <Plus className="h-3 w-3" /> Expand
            </button>
            <button
              onClick={() => onRewriteSlide(activeSlideIdx, "shorten")}
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-white/60 hover:text-white"
            >
              <RefreshCw className="h-3 w-3" /> Shorten
            </button>
            <button
              onClick={() => onRewriteSlide(activeSlideIdx, "simplify")}
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-white/60 hover:text-white"
            >
              <Lightbulb className="h-3 w-3" /> Simplify
            </button>
            <button
              onClick={() => onRewriteSlide(activeSlideIdx, "example")}
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-white/60 hover:text-white"
            >
              <Plus className="h-3 w-3" /> Add example
            </button>
            <button
              onClick={() => onRewriteSlide(activeSlideIdx, "formula")}
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-white/60 hover:text-white"
            >
              <Code2 className="h-3 w-3" /> Explain formula
            </button>
            <button
              onClick={() => onRewriteSlide(activeSlideIdx, "table")}
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-white/60 hover:text-white"
            >
              <Layers className="h-3 w-3" /> Comparison table
            </button>
            <button
              onClick={() => onRewriteSlide(activeSlideIdx, "exam")}
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-white/60 hover:text-white"
            >
              <Trophy className="h-3 w-3" /> Exam points
            </button>
            <button
              onClick={() => onSplitSlide(activeSlideIdx)}
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-white/60 hover:text-white"
            >
              <Layers className="h-3 w-3" /> Split slide
            </button>
            <button
              onClick={() => onMergeNextSlide(activeSlideIdx)}
              disabled={activeSlideIdx >= slideshow.slides.length - 1}
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-white/60 hover:text-white disabled:opacity-30"
            >
              <Merge className="h-3 w-3" /> Merge next
            </button>
          </div>

          {/* Speaker notes (below stage) */}
          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/40 flex items-center gap-1.5">
                <Presentation className="h-3 w-3" /> Speaker Notes
              </span>
              <button
                onClick={() =>
                  setEditingSlide(
                    editingSlide?.id === activeSlide.id ? null : activeSlide,
                  )
                }
                className="text-[10px] text-white/50 hover:text-white"
              >
                {editingSlide?.id === activeSlide.id ? "Done" : "Edit"}
              </button>
            </div>
            {editingSlide?.id === activeSlide.id ? (
              <textarea
                value={editingSlide.speakerNotes}
                onChange={(e) =>
                  onUpdateSlide(activeSlide.id, {
                    speakerNotes: e.target.value,
                  })
                }
                rows={3}
                placeholder="What should the presenter say while showing this slide?"
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/40 resize-y"
              />
            ) : (
              <p className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap">
                {activeSlide.speakerNotes || (
                  <span className="text-white/30 italic">
                    No speaker notes yet.
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Right: edit panel */}
        <div className="col-span-12 lg:col-span-3 order-3">
          <EditPanel
            slide={editingSlide ?? activeSlide}
            tpl={tpl}
            isEditing={!!editingSlide}
            onStartEdit={() => setEditingSlide(activeSlide)}
            onStopEdit={() => setEditingSlide(null)}
            onUpdate={(patch) => onUpdateSlide(activeSlide.id, patch)}
            onAddSlide={onAddSlide}
            onTemplateChange={(t) => onUpdate({ ...slideshow, template: t })}
            currentTemplate={slideshow.template}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Coverage panel
// ============================================================================

function QualityPanel({ slideshow, onFix }: { slideshow: Slideshow; onFix: () => void }) {
  const quality = slideshow.quality!;
  return (
    <div className="rounded-2xl border border-violet-400/20 bg-violet-400/[0.04] p-3" data-testid="slideshow-quality-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><CheckCircle2 className={cn("h-4 w-4", quality.passed ? "text-emerald-300" : "text-amber-300")} /><div><p className="text-xs font-semibold text-white">Presentation quality: {quality.score}/100</p><p className="text-[10px] text-white/40">Validated content, fit, grounding, and repetition</p></div></div>
        {!quality.passed && <button onClick={onFix} className="rounded-lg border border-violet-400/30 bg-violet-400/10 px-2.5 py-1.5 text-[10px] text-violet-100 hover:bg-violet-400/20">Fix all source issues</button>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-5">
        <div className="rounded-lg bg-black/15 p-2"><span className="block text-white/35">Content coverage</span><span className="text-white/75">{quality.contentCoverage}%</span></div>
        <div className="rounded-lg bg-black/15 p-2"><span className="block text-white/35">Readability</span><span className="text-white/75">{quality.readability}%</span></div>
        <div className="rounded-lg bg-black/15 p-2"><span className="block text-white/35">Source grounding</span><span className="text-white/75">{quality.sourceGrounding}%</span></div>
        <div className="rounded-lg bg-black/15 p-2"><span className="block text-white/35">Duplicate content</span><span className="text-white/75">{quality.duplicateContent ? quality.duplicateContent : "None"}</span></div>
        <div className="rounded-lg bg-black/15 p-2"><span className="block text-white/35">Overflow</span><span className="text-white/75">{quality.overflowCount ? `${quality.overflowCount} slides` : "None"}</span></div>
      </div>
      {quality.issues.length > 0 && <div className="mt-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-2 text-[10px] leading-5 text-amber-100/80">{quality.issues.slice(0, 4).map((issue) => <p key={`${issue.slideId}-${issue.category}-${issue.message}`}>• {issue.message}</p>)}</div>}
    </div>
  );
}

function CoveragePanel({
  slideshow,
  onFix,
}: {
  slideshow: Slideshow;
  onFix: () => void;
}) {
  const coverage = slideshow.coverage!;
  const pageLabel = coverage.totalPages.length
    ? `${coverage.pagesCovered.length} of ${coverage.totalPages.length} · ${formatPageRange(coverage.totalPages)}`
    : "Not page-based";
  const missingTitles = (slideshow.coverageLedger ?? [])
    .filter((item) => coverage.missingTopicIds.includes(item.id))
    .map((item) => item.title);

  const openFirstSourcePage = () => {
    const firstPage = coverage.pagesCovered[0] ?? slideshow.source?.startPage;
    if (!firstPage || !slideshow.source?.bookId) return;
    const bookId = slideshow.source.bookId.includes("maths")
      ? "maths-pt1"
      : "chemistry-pt1";
    sessionStorage.setItem(
      "scholar:ebook:target",
      JSON.stringify({ bookId, page: firstPage, source: "text" }),
    );
    window.location.href = "/ebook";
  };

  return (
    <div
      className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] p-3"
      data-testid="coverage-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-emerald-300" />
          <div>
            <p className="text-xs font-semibold text-white">
              Source coverage: {coverage.percentage}%
            </p>
            <p className="text-[10px] text-white/40">
              Validated from slide topic IDs and source-page mappings
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {slideshow.source?.bookId && (
            <button
              onClick={openFirstSourcePage}
              className="text-[10px] rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-white/60 hover:text-white flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" /> Open source
            </button>
          )}
          {coverage.percentage < 100 && (
            <button
              onClick={onFix}
              className="text-[10px] rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-amber-100 hover:bg-amber-400/20"
            >
              Fix missing content
            </button>
          )}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-2 text-[10px]">
        <div className="rounded-lg bg-black/15 p-2">
          <span className="block text-white/35">Pages covered</span>
          <span className="text-white/75">{pageLabel}</span>
        </div>
        <div className="rounded-lg bg-black/15 p-2">
          <span className="block text-white/35">Topics covered</span>
          <span className="text-white/75">
            {coverage.topicsCovered} of {coverage.totalTopics}
          </span>
        </div>
        <div className="rounded-lg bg-black/15 p-2">
          <span className="block text-white/35">Formulas included</span>
          <span className="text-white/75">
            {coverage.formulasIncluded} of {coverage.totalFormulas}
          </span>
        </div>
        <div className="rounded-lg bg-black/15 p-2">
          <span className="block text-white/35">Figures included</span>
          <span className="text-white/75">
            {coverage.figuresIncluded} of {coverage.totalFigures}
          </span>
        </div>
      </div>
      {(missingTitles.length > 0 ||
        coverage.missingPages.length > 0 ||
        coverage.missingFormulas.length > 0 ||
        coverage.missingFigures.length > 0) && (
        <div className="mt-2 text-[10px] text-amber-100/80">
          {missingTitles.length > 0 && (
            <p>Missing topics: {missingTitles.join(", ")}</p>
          )}
          {coverage.missingPages.length > 0 && (
            <p>Missing pages: {coverage.missingPages.join(", ")}</p>
          )}
          {coverage.missingFormulas.length > 0 && (
            <p>
              Missing formulas:{" "}
              {coverage.missingFormulas.slice(0, 8).join(" · ")}
              {coverage.missingFormulas.length > 8 ? "…" : ""}
            </p>
          )}
          {coverage.missingFigures.length > 0 && (
            <p>Unused source figures: {coverage.missingFigures.length}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Slide Stage (renders one slide with the template styling)
// ============================================================================

export function SlideStage({
  slide,
  tpl,
  className,
  fullscreen,
  highlightKeywords,
  isNarrating,
  revealAnswer,
}: {
  slide: Slide;
  tpl: ReturnType<typeof getTemplate>;
  className?: string;
  fullscreen?: boolean;
  highlightKeywords?: string[];
  isNarrating?: boolean;
  revealAnswer?: boolean;
}) {
  const meta = getSlideTypeMeta(slide.type);

  // Type-specific accent badge
  const typeColor: Record<SlideType, string> = {
    title: tpl.accent,
    agenda: "#38bdf8",
    section: "#a78bfa",
    concept: "#60a5fa",
    formula: "#fbbf24",
    diagram: "#34d399",
    example: "#fb923c",
    practice: "#f472b6",
    summary: "#22d3ee",
    takeaways: "#facc15",
    comparison: "#c084fc",
    table: "#60a5fa",
    timeline: "#2dd4bf",
    definitions: "#a3e635",
    mistakes: "#fb7185",
    "exam-tips": "#f59e0b",
    recap: "#818cf8",
    quiz: "#f472b6",
    thanks: tpl.accent,
  };

  return (
    <div
      className={cn("relative overflow-hidden flex flex-col", className)}
      data-slide-renderer="shared"
      data-slide-type={slide.type}
      style={{
        background: slide.background || tpl.background,
        color: tpl.text,
        fontFamily: tpl.fontFamily,
      }}
    >
      {/* Decorative accent shape */}
      <div
        className="absolute -top-20 -right-20 h-48 w-48 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: typeColor[slide.type] }}
      />
      {/* Narrating pulse indicator */}
      {isNarrating && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/15">
          <span className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-1 rounded-full bg-violet-300"
                animate={{ height: [4, 12, 4] }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.15,
                }}
                style={{ height: 4 }}
              />
            ))}
          </span>
          <span className="text-[9px] text-white/60 uppercase tracking-wider">
            Narrating
          </span>
        </div>
      )}

      <div
        className={cn(
          "relative z-10 h-full w-full flex flex-col",
          fullscreen ? "p-5 sm:p-7 lg:p-9" : "p-5 sm:p-6 lg:p-7",
        )}
      >
        {/* Type badge */}
        {slide.type !== "title" && slide.type !== "thanks" && (
          <div data-slide-reveal-item className="flex items-center gap-2 mb-3 shrink-0">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider"
              style={{
                background: `${typeColor[slide.type]}20`,
                color: typeColor[slide.type],
              }}
            >
              <span>{meta.icon}</span>
              {meta.name}
            </span>
          </div>
        )}

        {/* Title */}
        <SlideTitle
          slide={slide}
          tpl={tpl}
          fullscreen={fullscreen}
          highlightKeywords={highlightKeywords}
        />

        {/* Body */}
        <div data-slide-reveal-item className="min-h-0 flex-1 overflow-hidden">
          <SlideBody
            slide={slide}
            tpl={tpl}
            typeColor={typeColor}
            fullscreen={fullscreen}
            highlightKeywords={highlightKeywords}
            revealAnswer={revealAnswer}
          />
        </div>

        {slide.showSourceReference &&
          slide.sourcePages &&
          slide.sourcePages.length > 0 && (
            <a
              href="/ebook"
              onClick={() => {
                if (!slide.sourceBookId) return;
                const bookId = slide.sourceBookId.includes("maths")
                  ? "maths-pt1"
                  : "chemistry-pt1";
                sessionStorage.setItem(
                  "scholar:ebook:target",
                  JSON.stringify({
                    bookId,
                    page: slide.sourcePages?.[0],
                    source: "text",
                  }),
                );
              }}
              data-slide-reveal-item
              className="mt-2 self-end text-[9px] opacity-45 hover:opacity-90 underline underline-offset-2 shrink-0"
            >
              Source: {formatPageRange(slide.sourcePages)}
            </a>
          )}

        {/* Footer for title slide */}
        {slide.type === "title" && (
          <div data-slide-reveal-item className="mt-auto pt-4 text-xs opacity-60 shrink-0">
            <p>
              Class {useStore.getState().user.scholarClass} ·{" "}
              {new Date().getFullYear()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper: highlight keywords in a text string
function HighlightedText({
  text,
  keywords,
  baseClass,
}: {
  text: string;
  keywords?: string[];
  baseClass?: string;
}) {
  if (!keywords || !keywords.length)
    return <span className={baseClass}>{text}</span>;
  // Build a regex that matches any keyword (case-insensitive, word-boundary)
  const escaped = keywords
    .filter((k) => k && k.length > 1)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!escaped.length) return <span className={baseClass}>{text}</span>;
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(re);
  return (
    <span className={baseClass}>
      {parts.map((part, i) =>
        keywords.some((k) => k.toLowerCase() === part.toLowerCase()) ? (
          <mark
            key={i}
            className="bg-yellow-300/30 text-inherit rounded px-0.5"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

function SlideTitle({
  slide,
  tpl,
  fullscreen,
  highlightKeywords,
}: {
  slide: Slide;
  tpl: ReturnType<typeof getTemplate>;
  fullscreen?: boolean;
  highlightKeywords?: string[];
}) {
  const titleSize = fullscreen
    ? "text-3xl sm:text-4xl lg:text-5xl"
    : "text-2xl sm:text-3xl";
  const headingSize = fullscreen
    ? "text-2xl sm:text-3xl lg:text-4xl"
    : "text-xl sm:text-2xl";
  if (slide.type === "title") {
    return (
      <div data-slide-reveal-item className="mt-auto mb-auto text-center">
        <h1
          className={cn("font-bold leading-tight mb-3 line-clamp-2", titleSize)}
          style={{ color: tpl.text }}
        >
          <HighlightedText text={slide.title} keywords={highlightKeywords} />
        </h1>
        {slide.content && (
          <p
            className={cn(
              "opacity-70 max-w-xl mx-auto",
              fullscreen ? "text-base sm:text-lg" : "text-sm sm:text-base",
            )}
          >
            {slide.content}
          </p>
        )}
      </div>
    );
  }
  if (slide.type === "thanks") {
    return (
      <div data-slide-reveal-item className="mt-auto mb-auto text-center">
        <div className={cn("mb-4", fullscreen ? "text-6xl" : "text-5xl")}>
          🙏
        </div>
        <h1
          className={cn("font-bold mb-2", headingSize)}
          style={{ color: tpl.text }}
        >
          {slide.title}
        </h1>
        {slide.content && (
          <p className={cn("opacity-70", fullscreen ? "text-base" : "text-sm")}>
            {slide.content}
          </p>
        )}
      </div>
    );
  }
  return (
    <h2
      data-slide-reveal-item
      className={cn("font-bold mb-4 leading-tight shrink-0 line-clamp-2", headingSize)}
      style={{ color: tpl.text }}
    >
      <HighlightedText text={slide.title} keywords={highlightKeywords} />
    </h2>
  );
}

function SlideBody({
  slide,
  tpl,
  typeColor,
  fullscreen,
  highlightKeywords,
  revealAnswer,
}: {
  slide: Slide;
  tpl: ReturnType<typeof getTemplate>;
  typeColor: Record<SlideType, string>;
  fullscreen?: boolean;
  highlightKeywords?: string[];
  revealAnswer?: boolean;
}) {
  const accent = typeColor[slide.type];
  const textBase = fullscreen ? "text-sm sm:text-base" : "text-xs sm:text-sm";
  const textLarge = fullscreen ? "text-base sm:text-lg" : "text-sm sm:text-base";
  const textBullet = fullscreen
    ? "text-sm sm:text-base"
    : "text-sm sm:text-base";
  const textFormula = fullscreen
    ? "text-2xl sm:text-3xl lg:text-4xl"
    : "text-xl sm:text-2xl lg:text-3xl";

  // Formula slide
  if (slide.type === "formula" && slide.formula) {
    return (
      <div className="flex-1 flex flex-col justify-center">
        <div
          className={cn("rounded-2xl text-center", fullscreen ? "p-4 sm:p-5" : "p-6 sm:p-8")}
          style={{ background: tpl.cardBg, border: `1px solid ${accent}40` }}
        >
          <ScholarAIContent
            content={slide.formula.startsWith("\\(") || slide.formula.startsWith("$") ? slide.formula : `\\[${slide.formula}\\]`}
            mode="slide"
            className={cn("mb-3 font-bold", textFormula)}
            style={{ color: accent }}
          />
          {slide.content && (
            <ScholarAIContent content={slide.content} mode="slide" className={cn("opacity-70", textBase)} />
          )}
        </div>
        {slide.bullets && slide.bullets.length > 0 && (
          <ul className={cn("mt-3", fullscreen ? "space-y-1.5" : "space-y-2")}>
            {slide.bullets.map((b, i) => (
              <li
                key={i}
                className={cn("flex items-start gap-2 opacity-90", textBullet)}
              >
                <span
                  className="mt-1.5 h-1 w-1 rounded-full shrink-0"
                  style={{ background: accent }}
                />
                <ScholarAIContent content={b} mode="slide" />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Example slide
  if (slide.type === "example") {
    return (
      <div className="flex-1 space-y-3">
        {slide.content && (
          <div className="rounded-xl p-4" style={{ background: tpl.cardBg }}>
            <p className="text-[10px] uppercase tracking-wider opacity-50 mb-1">
              Problem
            </p>
            <ScholarAIContent content={slide.content} mode="slide" className={cn(textLarge)} />
          </div>
        )}
        {slide.bullets && slide.bullets.length > 0 && (
          <div
            className="rounded-xl p-4 border"
            style={{ borderColor: `${accent}40`, background: `${accent}10` }}
          >
            <p
              className="text-[10px] uppercase tracking-wider opacity-60 mb-2"
              style={{ color: accent }}
            >
              Solution
            </p>
            <ol className="space-y-2">
              {slide.bullets.map((b, i) => (
                <li key={i} className={cn("flex items-start gap-2", textBase)}>
                  <span
                    className="font-bold shrink-0"
                    style={{ color: accent }}
                  >
                    {i + 1}.
                  </span>
                  <ScholarAIContent content={b} mode="slide" />
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    );
  }

  // Practice slide
  if (slide.type === "practice") {
    return (
      <div className="flex-1 space-y-3">
        {slide.practiceQuestion && (
          <div className="rounded-xl p-4" style={{ background: tpl.cardBg }}>
            <p className="text-[10px] uppercase tracking-wider opacity-50 mb-1">
              Try it
            </p>
            <ScholarAIContent content={slide.practiceQuestion} mode="slide" className={cn("font-medium", textLarge)} />
          </div>
        )}
        {slide.practiceAnswer &&
          (revealAnswer !== undefined ? (
            // During narration playback — only show if revealAnswer is true
            revealAnswer && (
              <div
                className="rounded-xl p-4 border"
                style={{
                  borderColor: `${accent}40`,
                  background: `${accent}10`,
                }}
              >
                <p
                  className="text-[10px] uppercase tracking-wider opacity-70 mb-1"
                  style={{ color: accent }}
                >
                  Answer
                </p>
                <ScholarAIContent content={slide.practiceAnswer} mode="slide" className={textBase} />
              </div>
            )
          ) : (
            // Normal editor view — collapsible
            <details
              className="rounded-xl p-4 border"
              style={{ borderColor: `${accent}40`, background: `${accent}10` }}
            >
              <summary
                className="text-[10px] uppercase tracking-wider cursor-pointer opacity-70"
                style={{ color: accent }}
              >
                Show answer
              </summary>
              <ScholarAIContent content={slide.practiceAnswer} mode="slide" className={cn("mt-2", textBase)} />
            </details>
          ))}
        {slide.bullets && slide.bullets.length > 0 && (
          <ul className="space-y-2">
            {slide.bullets.map((b, i) => (
              <li
                key={i}
                className={cn("flex items-start gap-2 opacity-80", textBase)}
              >
                <span
                  className="mt-1.5 h-1 w-1 rounded-full shrink-0"
                  style={{ background: accent }}
                />
                <HighlightedText text={b} keywords={highlightKeywords} />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Quiz slide
  if (slide.type === "quiz") {
    return (
      <div className="flex-1 space-y-3">
        {slide.content && (
          <ScholarAIContent content={slide.content} mode="slide" className={cn("font-medium", textLarge)} />
        )}
        {slide.bullets && slide.bullets.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {slide.bullets.map((b, i) => (
              <div
                key={i}
                className="rounded-lg p-3 border"
                style={{ borderColor: `${accent}30`, background: tpl.cardBg }}
              >
                <span className="text-xs font-bold opacity-60 mr-2">
                  {String.fromCharCode(65 + i)}.
                </span>
                <ScholarAIContent content={b} mode="slide" className={cn(textBase)} />
              </div>
            ))}
          </div>
        )}
        {slide.practiceAnswer &&
          (revealAnswer ? (
            <div
              className="rounded-lg border p-3 text-sm"
              style={{ borderColor: `${accent}40`, background: `${accent}12` }}
            >
              <span className="font-semibold" style={{ color: accent }}>
                Answer:
              </span>{" "}
              <ScholarAIContent content={slide.practiceAnswer} mode="slide" className="inline" />
            </div>
          ) : revealAnswer === undefined ? (
            <details
              className="rounded-lg border p-2 text-xs"
              style={{ borderColor: `${accent}30` }}
            >
              <summary className="cursor-pointer">Reveal answer</summary>
              <ScholarAIContent content={slide.practiceAnswer} mode="slide" className="mt-2" />
            </details>
          ) : null)}
      </div>
    );
  }

  // Comparison slide (2-column bullets)
  if (
    slide.type === "comparison" &&
    slide.bullets &&
    slide.bullets.length >= 2
  ) {
    const half = Math.ceil(slide.bullets.length / 2);
    const left = slide.bullets.slice(0, half);
    const right = slide.bullets.slice(half);
    return (
      <div className="flex-1 grid grid-cols-2 gap-3">
        {[left, right].map((col, ci) => (
          <div
            key={ci}
            className="rounded-xl p-4"
            style={{ background: tpl.cardBg }}
          >
            {col.map((b, i) => (
              <p
                key={i}
                className={cn(
                  "mb-2 last:mb-0 flex items-start gap-2",
                  textBase,
                )}
              >
                <span
                  className="mt-1.5 h-1 w-1 rounded-full shrink-0"
                  style={{ background: accent }}
                />
                <ScholarAIContent content={b} mode="slide" />
              </p>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // Table slide
  if (slide.type === "table" && slide.bullets && slide.bullets.length > 0) {
    return (
      <div className="flex-1">
        <div
          className="rounded-xl overflow-hidden border"
          style={{ borderColor: `${accent}30` }}
        >
          {slide.bullets.map((b, i) => {
            const cells = b.split("|").map((c) => c.trim());
            if (cells.length < 2) {
              return (
                <div
                  key={i}
                  className={cn("px-4 py-2", textBase)}
                  style={{
                    background: i === 0 ? `${accent}20` : tpl.cardBg,
                    fontWeight: i === 0 ? 600 : 400,
                  }}
                >
                  <ScholarAIContent content={b} mode="slide" />
                </div>
              );
            }
            return (
              <div
                key={i}
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${cells.length}, 1fr)`,
                  background: i === 0 ? `${accent}20` : tpl.cardBg,
                }}
              >
                {cells.map((c, ci) => (
                  <div
                    key={ci}
                    className={cn(
                      "px-3 py-2 border-r last:border-r-0",
                      textBase,
                    )}
                    style={{
                      borderColor: `${accent}20`,
                      fontWeight: i === 0 ? 600 : 400,
                    }}
                  >
                    <ScholarAIContent content={c} mode="slide" />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        {slide.content && (
          <ScholarAIContent content={slide.content} mode="slide" className={cn("mt-3 opacity-60", textBase)} />
        )}
      </div>
    );
  }

  // Timeline slide
  if (slide.type === "timeline" && slide.bullets && slide.bullets.length > 0) {
    return (
      <div className="flex-1">
        <div className="relative pl-6">
          <div
            className="absolute left-2 top-0 bottom-0 w-0.5"
            style={{ background: `${accent}40` }}
          />
          {slide.bullets.map((b, i) => (
            <div key={i} className="relative mb-4 last:mb-0">
              <div
                className="absolute -left-[18px] top-1 h-3 w-3 rounded-full border-2"
                style={{ background: tpl.background, borderColor: accent }}
              />
              <ScholarAIContent content={b} mode="slide" className={textBase} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Diagram slide
  if (slide.type === "diagram") {
    return (
      <div className="flex-1 flex flex-col justify-center">
        <div
          className="rounded-2xl p-3 border text-center"
          style={{ borderColor: `${accent}40`, background: tpl.cardBg }}
        >
          {slide.imageReference ? (
            <div
              className={cn(
                "relative mx-auto w-full overflow-hidden rounded-lg bg-black/10",
                fullscreen ? "h-[42vh]" : "h-36 sm:h-44",
              )}
            >
              <Image
                src={slide.imageReference}
                alt={slide.diagramPrompt || slide.title}
                fill
                sizes="(max-width: 768px) 90vw, 700px"
                className="object-contain"
              />
            </div>
          ) : (
            <>
              <ImageIcon
                className="h-8 w-8 mx-auto mb-2 opacity-50"
                style={{ color: accent }}
              />
              <p className="text-[10px] uppercase tracking-wider opacity-60 mb-2">
                Source diagram description
              </p>
              <ScholarAIContent content={slide.diagramPrompt || slide.content || ""} mode="slide" className={cn("opacity-80", textBase)} />
            </>
          )}
        </div>
        {slide.bullets && slide.bullets.length > 0 && (
          <ul className="mt-3 space-y-1">
            {slide.bullets.map((b, i) => (
              <li
                key={i}
                className={cn("flex items-start gap-2 opacity-80", textBase)}
              >
                <span
                  className="mt-1.5 h-1 w-1 rounded-full shrink-0"
                  style={{ background: accent }}
                />
                <ScholarAIContent content={b} mode="slide" />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Definitions / mistakes / exam-tips / recap / takeaways — list with strong styling
  if (
    ["definitions", "mistakes", "exam-tips", "recap", "takeaways"].includes(
      slide.type,
    ) &&
    slide.bullets &&
    slide.bullets.length > 0
  ) {
    return (
      <div className="flex-1 space-y-2">
        {slide.content && (
          <ScholarAIContent content={slide.content} mode="slide" className={cn("opacity-70 mb-2", textBase)} />
        )}
        {slide.bullets.map((b, i) => {
          const [term, ...rest] = b.split(":").map((x) => x.trim());
          const def = rest.join(":");
          return (
            <div
              key={i}
              className="rounded-lg p-3 flex items-start gap-3"
              style={{ background: tpl.cardBg }}
            >
              <span
                className="text-xs font-bold shrink-0 px-1.5 py-0.5 rounded"
                style={{ background: `${accent}20`, color: accent }}
              >
                {i + 1}
              </span>
              <ScholarAIContent content={def ? `**${term}:** ${def}` : term} mode="slide" className={textBase} />
            </div>
          );
        })}
      </div>
    );
  }

  // Section divider
  if (slide.type === "section") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div
            className="h-1 w-16 mx-auto rounded-full mb-4"
            style={{ background: accent }}
          />
          <h2
            className={cn(
              "font-bold opacity-90",
              fullscreen
                ? "text-3xl sm:text-4xl lg:text-5xl"
                : "text-xl sm:text-2xl lg:text-3xl",
            )}
          >
            {slide.title}
          </h2>
          {slide.content && (
            <ScholarAIContent content={slide.content} mode="slide" className={cn("opacity-50 mt-2", textBase)} />
          )}
        </div>
      </div>
    );
  }

  // Agenda / summary / concept — bullet-driven
  if (slide.bullets && slide.bullets.length > 0) {
    return (
      <div className="flex-1">
        {slide.content && (
          <ScholarAIContent content={slide.content} mode="slide" className={cn("opacity-70 mb-3", textBase)} />
        )}
        <ul className="space-y-2">
          {slide.bullets.map((b, i) => (
            <li key={i} className={cn("flex items-start gap-3", textBullet)}>
              <span
                className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
                style={{ background: accent }}
              />
              <ScholarAIContent content={b} mode="slide" />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Fallback — content only
  if (slide.content) {
    return (
      <div className="flex-1">
        <ScholarAIContent content={slide.content} mode="slide" className={cn("opacity-85", textLarge)} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex-1 grid place-items-center opacity-40 italic",
        textBase,
      )}
    >
      Empty slide
    </div>
  );
}

// ============================================================================
// Thumbnail card
// ============================================================================

function ThumbCard({
  slide,
  index,
  active,
  tpl,
  onClick,
}: {
  slide: Slide;
  index: number;
  active: boolean;
  tpl: ReturnType<typeof getTemplate>;
  onClick: () => void;
}) {
  const meta = getSlideTypeMeta(slide.type);
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-lg overflow-hidden border transition-all text-left",
        active
          ? "border-violet-500/60 ring-2 ring-violet-500/30"
          : "border-white/10 hover:border-white/25",
      )}
    >
      <div
        className="aspect-video p-2 relative overflow-hidden"
        style={{
          background: tpl.background,
          color: tpl.text,
          fontFamily: tpl.fontFamily,
        }}
      >
        <div className="text-[8px] uppercase tracking-wide opacity-50 mb-0.5">
          {meta.icon} {meta.name}
        </div>
        <p className="text-[10px] font-semibold leading-tight line-clamp-2">
          {slide.title}
        </p>
        {slide.bullets && slide.bullets.length > 0 && (
          <p className="text-[7px] opacity-50 mt-0.5 line-clamp-2">
            {slide.bullets[0]}
          </p>
        )}
      </div>
      <div className="px-2 py-1 bg-white/[0.02] flex items-center justify-between">
        <span className="text-[10px] text-white/40">#{index + 1}</span>
        <span className="text-[10px] text-white/30">
          {slide.bullets?.length ?? 0} bullets
        </span>
      </div>
    </button>
  );
}

// ============================================================================
// Edit Panel
// ============================================================================

function EditPanel({
  slide,
  tpl,
  isEditing,
  onStartEdit,
  onStopEdit,
  onUpdate,
  onAddSlide,
  onTemplateChange,
  currentTemplate,
}: {
  slide: Slide;
  tpl: ReturnType<typeof getTemplate>;
  isEditing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onUpdate: (patch: Partial<Slide>) => void;
  onAddSlide: (type: SlideType) => void;
  onTemplateChange: (t: SlideshowTemplate) => void;
  currentTemplate: SlideshowTemplate;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 max-h-[calc(100vh-20rem)] overflow-y-auto sticky top-2 space-y-3">
      {/* Template switcher */}
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-white/40 mb-1.5">
          Template
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => onTemplateChange(t.id)}
              className={cn(
                "rounded-md overflow-hidden border text-left transition-all",
                currentTemplate === t.id
                  ? "border-violet-500/60 ring-1 ring-violet-500/30"
                  : "border-white/10 hover:border-white/25",
              )}
            >
              <div className="h-8" style={{ background: t.swatch }} />
              <p className="text-[9px] text-white/60 px-1.5 py-0.5 truncate">
                {t.name}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10 pt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">
            Slide editor
          </p>
          <button
            onClick={isEditing ? onStopEdit : onStartEdit}
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-full",
              isEditing
                ? "bg-violet-500/20 text-violet-200 border border-violet-500/40"
                : "bg-white/5 text-white/60 border border-white/10",
            )}
          >
            {isEditing ? "Editing" : "Edit"}
          </button>
        </div>

        <div className="space-y-2">
          <div>
            <label className="text-[9px] text-white/40 uppercase tracking-wider">
              Type
            </label>
            <select
              value={slide.type}
              onChange={(e) => onUpdate({ type: e.target.value as SlideType })}
              className="mt-0.5 w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            >
              {SLIDE_TYPES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[9px] text-white/40 uppercase tracking-wider">
              Title
            </label>
            <input
              value={slide.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              className="mt-0.5 w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            />
          </div>

          <div>
            <label className="text-[9px] text-white/40 uppercase tracking-wider">
              Content
            </label>
            <textarea
              value={slide.content}
              onChange={(e) => onUpdate({ content: e.target.value })}
              rows={3}
              placeholder="Main paragraph"
              className="mt-0.5 w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500/40 resize-y"
            />
          </div>

          <div>
            <label className="text-[9px] text-white/40 uppercase tracking-wider">
              Bullets (one per line)
            </label>
            <textarea
              value={(slide.bullets ?? []).join("\n")}
              onChange={(e) =>
                onUpdate({
                  bullets: e.target.value
                    .split("\n")
                    .filter((b) => b.trim() || true),
                })
              }
              rows={4}
              placeholder="One bullet per line"
              className="mt-0.5 w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500/40 resize-y font-mono"
            />
          </div>

          {(slide.type === "formula" || slide.formula) && (
            <div>
              <label className="text-[9px] text-white/40 uppercase tracking-wider">
                Formula
              </label>
              <input
                value={slide.formula ?? ""}
                onChange={(e) => onUpdate({ formula: e.target.value })}
                placeholder="e.g., v = u + at"
                className="mt-0.5 w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white font-mono placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
              />
            </div>
          )}

          {(slide.type === "diagram" || slide.diagramPrompt) && (
            <div>
              <label className="text-[9px] text-white/40 uppercase tracking-wider">
                Diagram description
              </label>
              <textarea
                value={slide.diagramPrompt ?? ""}
                onChange={(e) => onUpdate({ diagramPrompt: e.target.value })}
                rows={2}
                placeholder="Describe what to draw"
                className="mt-0.5 w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500/40 resize-y"
              />
            </div>
          )}

          {(slide.type === "practice" || slide.practiceQuestion) && (
            <>
              <div>
                <label className="text-[9px] text-white/40 uppercase tracking-wider">
                  Practice question
                </label>
                <textarea
                  value={slide.practiceQuestion ?? ""}
                  onChange={(e) =>
                    onUpdate({ practiceQuestion: e.target.value })
                  }
                  rows={2}
                  className="mt-0.5 w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500/40 resize-y"
                />
              </div>
              <div>
                <label className="text-[9px] text-white/40 uppercase tracking-wider">
                  Practice answer
                </label>
                <textarea
                  value={slide.practiceAnswer ?? ""}
                  onChange={(e) => onUpdate({ practiceAnswer: e.target.value })}
                  rows={2}
                  className="mt-0.5 w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500/40 resize-y"
                />
              </div>
            </>
          )}

          <div>
            <label className="text-[9px] text-white/40 uppercase tracking-wider">
              Speaker notes
            </label>
            <textarea
              value={slide.speakerNotes}
              onChange={(e) => onUpdate({ speakerNotes: e.target.value })}
              rows={3}
              placeholder="What to say"
              className="mt-0.5 w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500/40 resize-y"
            />
          </div>

          <div>
            <label className="text-[9px] text-white/40 uppercase tracking-wider">
              Source pages (comma separated)
            </label>
            <input
              value={(slide.sourcePages ?? []).join(", ")}
              onChange={(event) =>
                onUpdate({
                  sourcePages: [
                    ...new Set(
                      event.target.value
                        .split(",")
                        .map((value) => Number(value.trim()))
                        .filter(
                          (value) => Number.isInteger(value) && value > 0,
                        ),
                    ),
                  ],
                })
              }
              placeholder="e.g., 12, 13, 14"
              className="mt-0.5 w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            />
          </div>

          <div>
            <label className="text-[9px] text-white/40 uppercase tracking-wider">
              Source figure URL
            </label>
            <input
              value={slide.imageReference ?? ""}
              onChange={(event) =>
                onUpdate({ imageReference: event.target.value || undefined })
              }
              placeholder="Existing ebook figure/page image"
              className="mt-0.5 w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            />
          </div>
        </div>
      </div>

      {/* Quick-add slide buttons */}
      <div className="border-t border-white/10 pt-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-white/40 mb-1.5">
          Quick add
        </p>
        <div className="grid grid-cols-3 gap-1">
          {(
            [
              "concept",
              "formula",
              "example",
              "practice",
              "summary",
              "section",
            ] as SlideType[]
          ).map((t) => {
            const meta = getSlideTypeMeta(t);
            return (
              <button
                key={t}
                onClick={() => onAddSlide(t)}
                className="text-[10px] py-1.5 rounded-md bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-violet-500/10 hover:border-violet-500/30 flex flex-col items-center gap-0.5"
              >
                <span className="text-sm">{meta.icon}</span>
                <span>{meta.name.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Fullscreen Presentation Mode
// ============================================================================

function FullscreenPreview({
  slideshow,
  initialIdx,
  onExit,
}: {
  slideshow: Slideshow;
  initialIdx: number;
  onExit: () => void;
}) {
  const [idx, setIdx] = useState(initialIdx);
  const [showNotes, setShowNotes] = useState(true);
  const [showOverview, setShowOverview] = useState(false);
  const [revealedAnswers, setRevealedAnswers] = useState<
    Record<string, boolean>
  >({});
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const tpl = getTemplate(slideshow.template);
  const slide = slideshow.slides[idx];

  useEffect(() => {
    const i = setInterval(
      () => setElapsed(Math.floor((Date.now() - startTime) / 1000)),
      500,
    );
    return () => clearInterval(i);
  }, [startTime]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      )
        return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        setIdx((i) => Math.min(slideshow.slides.length - 1, i + 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Escape") {
        onExit();
      } else if (e.key === "n") {
        setShowNotes((s) => !s);
      } else if (e.key.toLowerCase() === "o") {
        setShowOverview((value) => !value);
      } else if (e.key.toLowerCase() === "f") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.();
      } else if (e.key === "Home") {
        setIdx(0);
      } else if (e.key === "End") {
        setIdx(slideshow.slides.length - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [slideshow.slides.length, onExit]);

  const mm = Math.floor(elapsed / 60)
    .toString()
    .padStart(2, "0");
  const ss = (elapsed % 60).toString().padStart(2, "0");
  const estMin = Math.ceil((slideshow.slides.length * 90) / 60); // ~90s/slide

  // Use portal to escape any parent containing-block (backdrop-filter, transform, etc.)
  const content = (
    <div
      className="fixed inset-0 z-[200] bg-black flex flex-col"
      style={{ contain: "layout" }}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-3 bg-gradient-to-b from-black/80 to-transparent text-white">
        <div className="flex items-center gap-3 text-xs min-w-0">
          <span className="opacity-70 truncate max-w-[200px]">
            {slideshow.title}
          </span>
          <span className="opacity-40 shrink-0">·</span>
          <span className="opacity-70 shrink-0">
            {idx + 1} / {slideshow.slides.length}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs shrink-0">
          <Clock className="h-3.5 w-3.5 opacity-60" />
          <span className="font-mono opacity-80">
            {mm}:{ss}
          </span>
          <span className="opacity-40 hidden sm:inline">/ ~{estMin}m est</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowOverview(true)}
            className="px-2.5 py-1 rounded-md text-[11px] bg-white/5 border border-white/15 text-white/60 hover:text-white"
            title="Overview (O)"
          >
            Overview
          </button>
          <button
            onClick={() =>
              document.fullscreenElement
                ? void document.exitFullscreen()
                : void document.documentElement.requestFullscreen?.()
            }
            className="p-1.5 rounded-md bg-white/5 border border-white/15 text-white/60 hover:text-white"
            title="Fullscreen (F)"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setShowNotes((s) => !s)}
            className={cn(
              "px-2.5 py-1 rounded-md text-[11px] border transition-colors",
              showNotes
                ? "bg-violet-500/20 border-violet-500/40 text-violet-200"
                : "bg-white/5 border-white/15 text-white/60 hover:text-white",
            )}
            title="Toggle speaker notes (N)"
          >
            {showNotes ? "Notes on" : "Notes off"}
          </button>
          <button
            onClick={onExit}
            className="px-2.5 py-1 rounded-md text-[11px] bg-white/5 border border-white/15 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Exit (Esc)"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main slide — fills the entire viewport minus small padding */}
      <div
        className="flex-1 grid place-items-center p-4 sm:p-8 pt-16 touch-pan-y"
        onPointerDown={(event) => {
          pointerStart.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={(event) => {
          const start = pointerStart.current;
          pointerStart.current = null;
          if (!start) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
          setIdx((value) =>
            dx < 0
              ? Math.min(slideshow.slides.length - 1, value + 1)
              : Math.max(0, value - 1),
          );
        }}
      >
        <div className="w-full h-full max-w-[1400px] max-h-[780px] aspect-video shadow-2xl rounded-2xl overflow-hidden">
          <SlideStage
            slide={slide}
            tpl={tpl}
            className="w-full h-full"
            fullscreen
            revealAnswer={Boolean(revealedAnswers[slide.id])}
          />
        </div>
      </div>

      <AnimatePresence>
        {showOverview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-zinc-950/95 p-5 sm:p-8 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4 text-white">
              <div>
                <h2 className="font-semibold">Slide overview</h2>
                <p className="text-xs text-white/40">
                  Choose any slide to jump there
                </p>
              </div>
              <button
                onClick={() => setShowOverview(false)}
                className="p-2 rounded-lg border border-white/10 bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {slideshow.slides.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setIdx(index);
                    setShowOverview(false);
                  }}
                  className={cn(
                    "rounded-xl overflow-hidden border text-left",
                    index === idx
                      ? "border-violet-400 ring-2 ring-violet-400/30"
                      : "border-white/10",
                  )}
                >
                  <SlideStage
                    slide={item}
                    tpl={tpl}
                    className="aspect-video w-full pointer-events-none"
                  />
                  <div className="bg-black/30 px-2 py-1 text-[10px] text-white/60">
                    {index + 1}. {item.title}
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Speaker notes overlay */}
      <AnimatePresence>
        {showNotes && slide.speakerNotes && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-20 left-4 right-4 sm:left-8 sm:right-auto sm:max-w-md z-20 rounded-xl border border-white/15 bg-zinc-950/90 backdrop-blur-md p-3"
          >
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1 flex items-center gap-1.5">
              <Presentation className="h-3 w-3" /> Speaker notes
            </p>
            <p className="text-xs text-white/80 leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">
              {slide.speakerNotes}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom nav */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-zinc-950/80 backdrop-blur-md border border-white/15 p-1.5">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs text-white/60 px-2 font-mono">
          {idx + 1} / {slideshow.slides.length}
        </span>
        {slide.type === "quiz" && slide.practiceAnswer && (
          <button
            onClick={() =>
              setRevealedAnswers((current) => ({
                ...current,
                [slide.id]: !current[slide.id],
              }))
            }
            className="px-2.5 py-1 rounded-full bg-violet-500/20 text-[10px] text-violet-100"
          >
            {revealedAnswers[slide.id] ? "Hide answer" : "Reveal answer"}
          </button>
        )}
        <button
          onClick={() =>
            setIdx((i) => Math.min(slideshow.slides.length - 1, i + 1))
          }
          disabled={idx === slideshow.slides.length - 1}
          className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/5 z-30">
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${((idx + 1) / slideshow.slides.length) * 100}%`,
            background: tpl.accent,
          }}
        />
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(content, document.body);
  }
  return content;
}

// ============================================================================
// Export Menu
// ============================================================================

function ExportMenu({ slideshow }: { slideshow: Slideshow }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const exportHTML = () => {
    const tpl = getTemplate(slideshow.template);
    const slidesHTML = slideshow.slides
      .map((s, i) => {
        const meta = getSlideTypeMeta(s.type);
        const bullets =
          s.bullets?.map((b) => `<li>${renderAcademicTextToHtml(b)}</li>`).join("") ?? "";
        return `
        <section class="slide" data-type="${s.type}" data-index="${i}">
          <div class="badge">${meta.icon} ${meta.name}</div>
          <h2>${escapeHtml(s.title)}</h2>
          ${s.content ? `<div class="content">${renderAcademicTextToHtml(s.content)}</div>` : ""}
          ${bullets ? `<ul>${bullets}</ul>` : ""}
          ${s.formula ? `<div class="formula">${renderAcademicTextToHtml(s.formula.startsWith("$") || s.formula.startsWith("\\(") ? s.formula : `\\[${s.formula}\\]`)}</div>` : ""}
          ${s.practiceQuestion ? `<div class="practice"><strong>Try:</strong> ${renderAcademicTextToHtml(s.practiceQuestion)}</div>` : ""}
          ${s.practiceAnswer ? `<details><summary>Show answer</summary><div>${renderAcademicTextToHtml(s.practiceAnswer)}</div></details>` : ""}
          ${s.showSourceReference && s.sourcePages?.length ? `<p class="source">Source: ${escapeHtml(formatPageRange(s.sourcePages))}</p>` : ""}
          ${s.speakerNotes ? `<div class="notes"><strong>Speaker notes:</strong> ${escapeHtml(s.speakerNotes)}</div>` : ""}
        </section>
      `;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(slideshow.title)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.18.1/dist/katex.min.css" />
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; font-family: ${JSON.stringify(tpl.fontFamily)}; background: ${tpl.background}; color: ${tpl.text}; }
  .deck { display: flex; flex-direction: column; align-items: center; gap: 24px; padding: 24px; }
  .slide { width: 100%; max-width: 1024px; aspect-ratio: 16/9; padding: 48px; background: ${tpl.background}; border-radius: 16px; border: 1px solid ${tpl.muted}; position: relative; overflow: hidden; page-break-after: always; }
  .slide[data-type="title"] { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
  .badge { display: inline-block; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; padding: 4px 10px; border-radius: 99px; background: ${tpl.accent}20; color: ${tpl.accent}; margin-bottom: 16px; }
  h2 { font-size: 32px; margin: 0 0 16px 0; }
  p.content { font-size: 16px; opacity: 0.8; line-height: 1.6; }
  ul { font-size: 18px; line-height: 1.8; padding-left: 24px; }
  .formula { font-family: monospace; font-size: 28px; text-align: center; padding: 24px; background: ${tpl.cardBg}; border-radius: 12px; margin: 16px 0; color: ${tpl.accent}; }
  .practice { padding: 16px; background: ${tpl.cardBg}; border-radius: 8px; margin: 8px 0; }
  details { margin-top: 12px; }
  .notes { margin-top: 24px; padding-top: 16px; border-top: 1px dashed ${tpl.muted}; font-size: 12px; opacity: 0.6; }
  .source { text-align: right; font-size: 11px; opacity: 0.5; }
  @media print { .slide { border-radius: 0; border: 0; page-break-after: always; } body { background: white; } }
</style>
</head>
<body>
<div class="deck">
  <h1 style="text-align:center;padding:24px;">${escapeHtml(slideshow.title)}</h1>
  ${slidesHTML}
</div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slideshow.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported as HTML");
    setOpen(false);
  };

  const exportPDF = () => {
    printDeck(false);
  };

  const copyOutline = async () => {
    const lines = slideshow.slides.map((s, i) => {
      const meta = getSlideTypeMeta(s.type);
      let line = `${i + 1}. [${meta.name}] ${s.title}`;
      if (s.bullets?.length) line += `\n   • ${s.bullets.join("\n   • ")}`;
      if (s.formula) line += `\n   Formula: ${s.formula}`;
      return line;
    });
    const outline = `${slideshow.title}\n${"=".repeat(slideshow.title.length)}\n\n${lines.join("\n\n")}`;
    try {
      await navigator.clipboard?.writeText(outline);
      toast.success("Outline copied to clipboard");
    } catch {
      toast.error("Could not copy. Try the HTML export instead.");
    }
    setOpen(false);
  };

  const downloadText = (content: string, suffix: string) => {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slideshow.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${suffix}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportSpeakerNotes = () => {
    downloadText(
      [
        `# ${slideshow.title} — Speaker Notes`,
        "",
        ...slideshow.slides.flatMap((slide, index) => [
          `## ${index + 1}. ${slide.title}`,
          slide.sourcePages?.length
            ? `Source: ${formatPageRange(slide.sourcePages)}`
            : "",
          slide.speakerNotes || "No speaker notes.",
          "",
        ]),
      ].join("\n"),
      "speaker-notes",
    );
    toast.success("Speaker notes exported");
    setOpen(false);
  };

  const exportStudyNotes = () => {
    downloadText(
      [
        `# ${slideshow.title}`,
        slideshow.source ? `Source: ${slideshow.source.label}` : "",
        "",
        ...slideshow.slides.flatMap((slide, index) => [
          `## ${index + 1}. ${slide.title}`,
          slide.content,
          ...(slide.bullets ?? []).map((bullet) => `- ${bullet}`),
          slide.formula ? `\n**Formula:** ${slide.formula}` : "",
          slide.practiceQuestion
            ? `\n**Question:** ${slide.practiceQuestion}`
            : "",
          slide.practiceAnswer ? `\n**Answer:** ${slide.practiceAnswer}` : "",
          slide.sourcePages?.length
            ? `\n_Source: ${formatPageRange(slide.sourcePages)}_`
            : "",
          "",
        ]),
      ]
        .filter(Boolean)
        .join("\n"),
      "study-notes",
    );
    toast.success("Study notes exported");
    setOpen(false);
  };

  const printDeck = (handout = false) => {
    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (!popup) {
      toast.error("The print window was blocked. Allow popups and retry.");
      return;
    }
    const slides = slideshow.slides
      .map(
        (slide, index) => `
      <section class="slide">
        <small>${index + 1} / ${slideshow.slides.length} · ${escapeHtml(slide.type)}</small>
        <h2>${escapeHtml(slide.title)}</h2>
        ${slide.content ? `<p>${escapeHtml(slide.content)}</p>` : ""}
        ${slide.bullets?.length ? `<ul>${slide.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>` : ""}
        ${slide.formula ? `<div class="formula">${escapeHtml(slide.formula)}</div>` : ""}
        ${slide.practiceQuestion ? `<p><strong>Question:</strong> ${escapeHtml(slide.practiceQuestion)}</p>` : ""}
        ${slide.practiceAnswer ? `<p class="answer"><strong>Answer:</strong> ${escapeHtml(slide.practiceAnswer)}</p>` : ""}
        ${slide.showSourceReference && slide.sourcePages?.length ? `<footer>Source: ${escapeHtml(formatPageRange(slide.sourcePages))}</footer>` : ""}
        ${slide.speakerNotes && !handout ? `<aside><strong>Speaker notes:</strong> ${escapeHtml(slide.speakerNotes)}</aside>` : ""}
      </section>`,
      )
      .join("");
    popup.document
      .write(`<!doctype html><html><head><title>${escapeHtml(slideshow.title)}</title><style>
      @page { size: ${handout ? "A4 portrait" : "A4 landscape"}; margin: 10mm; }
      * { box-sizing: border-box; } body { font-family: Inter, Arial, sans-serif; margin: 0; color: #111827; }
      .slide { ${handout ? "height: 126mm;" : "min-height: 180mm;"} border: 1px solid #cbd5e1; padding: 12mm; margin: 0 0 8mm; page-break-inside: avoid; position: relative; }
      ${handout ? ".slide:nth-of-type(2n) { page-break-after: always; }" : ".slide { page-break-after: always; }"}
      h2 { font-size: ${handout ? "22px" : "34px"}; margin: 8px 0 14px; } p, li { font-size: ${handout ? "13px" : "18px"}; line-height: 1.5; }
      .formula { font: bold ${handout ? "18px" : "26px"} ui-monospace, monospace; background: #eef2ff; padding: 12px; border-radius: 8px; }
      small, footer { color: #64748b; } footer { position: absolute; right: 12mm; bottom: 8mm; font-size: 11px; }
      aside { border-top: 1px dashed #94a3b8; margin-top: 14px; padding-top: 10px; font-size: 12px; color: #475569; }
      .answer { color: #475569; }
    </style></head><body>${slides}<script>window.onload=()=>window.print()<\/script></body></html>`);
    popup.document.close();
    toast.info(handout ? "Printable handout opened" : "PDF print view opened");
    setOpen(false);
  };

  const exportPPTX = async () => {
    setOpen(false);
    const toastId = toast.loading("Building editable PPTX…");
    try {
      const { default: PptxGenJS } = await import("pptxgenjs");
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE";
      pptx.author = "Scholar V2";
      pptx.subject = slideshow.source?.label ?? slideshow.chapter;
      pptx.title = slideshow.title;
      pptx.company = "Scholar V2";
      pptx.theme = {
        headFontFace: "Aptos Display",
        bodyFontFace: "Aptos",
      };
      const palette: Record<
        SlideshowTemplate,
        { background: string; text: string; accent: string; card: string }
      > = {
        "scholar-glass": {
          background: "0B1020",
          text: "F8FAFC",
          accent: "60A5FA",
          card: "172033",
        },
        "minimal-white": {
          background: "FFFFFF",
          text: "0F172A",
          accent: "3B82F6",
          card: "F1F5F9",
        },
        blackboard: {
          background: "132413",
          text: "F0FFF0",
          accent: "FDE047",
          card: "203520",
        },
        "science-lab": {
          background: "0C4A6E",
          text: "ECFEFF",
          accent: "67E8F9",
          card: "155E75",
        },
        space: {
          background: "090B24",
          text: "E0E7FF",
          accent: "A78BFA",
          card: "1E1B4B",
        },
        notebook: {
          background: "FEFCE8",
          text: "1E293B",
          accent: "B91C1C",
          card: "FEF9C3",
        },
        corporate: {
          background: "1E293B",
          text: "F1F5F9",
          accent: "38BDF8",
          card: "334155",
        },
        "exam-revision": {
          background: "FAFAFA",
          text: "171717",
          accent: "DC2626",
          card: "FFFFFF",
        },
      };
      const colors = palette[slideshow.template];

      const imageData = async (url: string) => {
        const response = await fetch(url);
        if (!response.ok) return null;
        const blob = await response.blob();
        return await new Promise<{
          data: string;
          width: number;
          height: number;
        } | null>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const data = String(reader.result);
            const image = new window.Image();
            image.onload = () =>
              resolve({
                data,
                width: image.naturalWidth,
                height: image.naturalHeight,
              });
            image.onerror = () => resolve(null);
            image.src = data;
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      };

      for (let index = 0; index < slideshow.slides.length; index += 1) {
        const sourceSlide = slideshow.slides[index];
        const slide = pptx.addSlide();
        slide.background = { color: colors.background };
        slide.addText(sourceSlide.title, {
          x: 0.65,
          y: sourceSlide.type === "title" ? 2.15 : 0.45,
          w: 12,
          h: sourceSlide.type === "title" ? 1.1 : 0.65,
          fontFace: "Aptos Display",
          fontSize: sourceSlide.type === "title" ? 34 : 25,
          bold: true,
          align: sourceSlide.type === "title" ? "center" : "left",
          color: colors.text,
          margin: 0,
          breakLine: false,
        });
        const hasImage = Boolean(sourceSlide.imageReference);
        const textWidth = hasImage ? 6.4 : 11.8;
        let y = sourceSlide.type === "title" ? 3.4 : 1.35;
        if (sourceSlide.content) {
          slide.addText(sourceSlide.content, {
            x: 0.75,
            y,
            w: textWidth,
            h: 1.15,
            fontSize: sourceSlide.type === "title" ? 20 : 15,
            color: colors.text,
            valign: "top",
            margin: 0.04,
            breakLine: false,
          });
          y += 1.2;
        }
        if (sourceSlide.formula) {
          const renderedFormula = await renderAcademicFormulaToPng(sourceSlide.formula, `#${colors.accent}`);
          if (renderedFormula) slide.addImage({ data: renderedFormula, x: 0.75, y, w: textWidth, h: 0.72, transparency: 0 });
          else slide.addText(sourceSlide.formula, { x: 0.75, y, w: textWidth, h: 0.72, fontFace: "Cambria Math", fontSize: 22, bold: true, color: colors.accent, fill: { color: colors.card }, margin: 0.12, align: "center", valign: "middle" });
          y += 0.85;
        }
        if (sourceSlide.bullets?.length) {
          slide.addText(
            sourceSlide.bullets.map((bullet) => `• ${bullet}`).join("\n"),
            {
              x: 0.85,
              y,
              w: textWidth - 0.1,
              h: Math.max(1.2, 6.45 - y),
              fontSize: 15,
              color: colors.text,
              breakLine: false,
              margin: 0.03,
              valign: "top",
              paraSpaceAfter: 8,
              fit: "shrink",
            },
          );
        }
        if (sourceSlide.practiceQuestion) {
          slide.addText(`Question: ${sourceSlide.practiceQuestion}`, {
            x: 0.75,
            y: 5.4,
            w: textWidth,
            h: 0.65,
            fontSize: 14,
            bold: true,
            color: colors.text,
            fill: { color: colors.card },
            margin: 0.1,
            fit: "shrink",
          });
        }
        if (sourceSlide.imageReference) {
          const image = await imageData(sourceSlide.imageReference);
          if (image) {
            const box = { x: 7.65, y: 1.35, w: 4.85, h: 4.95 };
            const scale = Math.min(box.w / image.width, box.h / image.height);
            const w = image.width * scale;
            const h = image.height * scale;
            slide.addImage({
              data: image.data,
              x: box.x + (box.w - w) / 2,
              y: box.y + (box.h - h) / 2,
              w,
              h,
            });
          }
        }
        if (
          sourceSlide.showSourceReference &&
          sourceSlide.sourcePages?.length
        ) {
          slide.addText(`Source: ${formatPageRange(sourceSlide.sourcePages)}`, {
            x: 9.5,
            y: 7.08,
            w: 3.1,
            h: 0.18,
            fontSize: 8,
            color: colors.text,
            transparency: 45,
            align: "right",
            margin: 0,
          });
        }
        slide.addText(`${index + 1} / ${slideshow.slides.length}`, {
          x: 0.7,
          y: 7.08,
          w: 1.2,
          h: 0.18,
          fontSize: 8,
          color: colors.text,
          transparency: 45,
          margin: 0,
        });
        const accessibleNotes = [sourceSlide.speakerNotes, sourceSlide.formula ? `Formula source (LaTeX): ${sourceSlide.formula}` : ""].filter(Boolean).join("\n\n");
        if (accessibleNotes) slide.addNotes(accessibleNotes);
      }
      await pptx.writeFile({
        fileName: `${slideshow.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "scholar-slideshow"}.pptx`,
        compression: true,
      });
      toast.success("Editable PPTX exported", { id: toastId });
    } catch {
      toast.error("PPTX export failed", {
        id: toastId,
        description:
          "Your slideshow is unchanged. Try again or use PDF export.",
      });
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white"
      >
        <Download className="h-3.5 w-3.5" /> Export
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute right-0 top-full mt-1.5 z-30 w-56 rounded-xl border border-white/15 bg-zinc-950/95 backdrop-blur-xl p-1.5 shadow-2xl"
          >
            <button
              onClick={exportHTML}
              className="w-full flex items-center gap-2 text-xs px-2.5 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5"
            >
              <FileDown className="h-3.5 w-3.5" /> Export as HTML
            </button>
            <button
              onClick={exportPDF}
              className="w-full flex items-center gap-2 text-xs px-2.5 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5"
            >
              <FileDown className="h-3.5 w-3.5" /> Export as PDF
            </button>
            <button
              onClick={() => void exportPPTX()}
              className="w-full flex items-center gap-2 text-xs px-2.5 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5"
            >
              <Presentation className="h-3.5 w-3.5" /> Export editable PPTX
            </button>
            <button
              onClick={() => printDeck(true)}
              className="w-full flex items-center gap-2 text-xs px-2.5 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5"
            >
              <FileText className="h-3.5 w-3.5" /> Printable handout
            </button>
            <button
              onClick={copyOutline}
              className="w-full flex items-center gap-2 text-xs px-2.5 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5"
            >
              <Copy className="h-3.5 w-3.5" /> Copy slide outline
            </button>
            <div className="border-t border-white/10 my-1" />
            <button
              onClick={exportSpeakerNotes}
              className="w-full flex items-center gap-2 text-xs px-2.5 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5"
            >
              <Mic className="h-3.5 w-3.5" /> Speaker-notes export
            </button>
            <button
              onClick={exportStudyNotes}
              className="w-full flex items-center gap-2 text-xs px-2.5 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5"
            >
              <BookOpen className="h-3.5 w-3.5" /> Study-notes export
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10px] font-medium uppercase tracking-wider text-white/50">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
