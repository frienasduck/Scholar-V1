"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookMarked,
  BookOpen,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileDown,
  FileText,
  GitBranch,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  Lightbulb,
  Link2,
  ListChecks,
  Loader2,
  Lock,
  Play,
  Presentation,
  RefreshCw,
  RotateCcw,
  RotateCw,
  ScanText,
  Sparkles,
  Square,
  Target,
  TrendingUp,
  Volume2,
  X,
  XCircle,
} from "lucide-react";
import type {
  LamPluginAnalyticsData,
  LamPluginCompanionData,
  LamPluginEvaluatorData,
  LamPluginExecution,
  LamPluginExplainerData,
  LamPluginFlashcard,
  LamPluginFlowchartData,
  LamPluginFormula,
  LamPluginHomeworkData,
  LamPluginImageData,
  LamPluginNcertSetData,
  LamPluginPdfData,
  LamPluginPlannerData,
  LamPluginPyqData,
  LamPluginQuizQuestion,
  LamPluginSlideshowData,
  LamPluginUserInteraction,
} from "@/lib/lam/types";
import { ScholarAIContent } from "@/components/ai/lazy-scholar-ai-content";
import { LAM_IMAGE_ACCEPT } from "@/lib/lam/attachments";
import { buildPluginChainSeed, saveArtifactToResources } from "@/lib/lam/in-chat-plugins";
import { navigateTo } from "@/lib/nav-event";
import { toast } from "@/lib/notifications/notification-api";
import { exportPDF, mdToHtml } from "@/lib/pdf";
import { newSlide, newSlideshow, upsertSlideshow, type SlideType } from "@/lib/slideshow";
import { useStore } from "@/lib/store";
import { openScholarPlus } from "@/lib/subscriptions/promo";

export interface InChatPluginWidgetProps {
  execution: LamPluginExecution;
  streamedText?: string;
  onRetry?: () => void;
  onCancel?: () => void;
  onRefine?: (prompt: string) => void;
  onChainPlugin?: (targetPluginId: string, seedPrompt: string) => void;
  onUpdateInteraction?: (patch: Partial<LamPluginUserInteraction>) => void;
  onProvideWaitingInput?: (opts: { prompt?: string; files?: File[] }) => void;
}

const CHAIN_OPTIONS = [
  { id: "notes-to-quiz", label: "Turn into Quiz" },
  { id: "flashcard-maker", label: "Make Flashcards" },
  { id: "formula-sheet-generator", label: "Extract Formulas" },
  { id: "ai-pdf-studio", label: "Format as PDF" },
  { id: "slideshow-maker", label: "Build Slides (Plus)" },
  { id: "concept-explainer", label: "Deepen Concept" },
] as const;

export function InChatPluginWidget({
  execution,
  streamedText,
  onRetry,
  onCancel,
  onRefine,
  onChainPlugin,
  onUpdateInteraction,
  onProvideWaitingInput,
}: InChatPluginWidgetProps) {
  if (execution.status === "locked") {
    return <ScholarPlusShowcaseCard execution={execution} />;
  }

  if (execution.status === "waiting_input") {
    return (
      <InChatWaitingInputCard
        execution={execution}
        onProvideWaitingInput={onProvideWaitingInput}
      />
    );
  }

  if (
    execution.status === "queued" ||
    execution.status === "preparing" ||
    execution.status === "running" ||
    execution.status === "generating"
  ) {
    return (
      <InChatLifecycleCard
        execution={execution}
        streamedText={streamedText}
        onCancel={onCancel}
      />
    );
  }

  if (execution.status === "failed" || execution.status === "cancelled") {
    return <InChatErrorCard execution={execution} onRetry={onRetry} />;
  }

  let body: React.ReactNode = null;
  let refinePresets: string[] = [];

  switch (execution.outputType) {
    case "quiz":
      if (execution.quiz?.length) {
        body = (
          <InChatQuizWidget
            questions={execution.quiz}
            pluginName={execution.pluginName}
            interaction={execution.userInteraction}
            onUpdateInteraction={onUpdateInteraction}
          />
        );
        refinePresets = ["Make questions harder", "Add 3 numericals", "More conceptual MCQs"];
      }
      break;
    case "ncert-set":
      if (execution.ncertData?.items?.length) {
        body = (
          <InChatNcertSetWidget
            data={execution.ncertData}
            interaction={execution.userInteraction}
            onUpdateInteraction={onUpdateInteraction}
          />
        );
        refinePresets = ["More 5-mark questions", "Focus on reasoning & assertion", "Add diagram questions"];
      }
      break;
    case "flashcards":
      if (execution.flashcards?.length) {
        body = (
          <InChatFlashcardWidget
            cards={execution.flashcards}
            pluginName={execution.pluginName}
            interaction={execution.userInteraction}
            onUpdateInteraction={onUpdateInteraction}
          />
        );
        refinePresets = ["Add 6 harder cards", "Focus on exam definitions", "Include numerical tricks"];
      }
      break;
    case "slideshow": {
      const deckData: LamPluginSlideshowData | null = execution.slideshowData
        ? execution.slideshowData
        : execution.slides?.length
          ? { title: execution.pluginName, slides: execution.slides }
          : null;
      if (deckData?.slides?.length) {
        body = (
          <InChatSlideshowWidget
            data={deckData}
            scholarClass={execution.scholarClass}
            interaction={execution.userInteraction}
            onUpdateInteraction={onUpdateInteraction}
          />
        );
        refinePresets = ["Add more numerical examples", "Simplify explanations", "Add speaker notes"];
      }
      break;
    }
    case "formula-sheet":
      if (execution.formulas?.length) {
        body = <InChatFormulaWidget formulas={execution.formulas} pluginName={execution.pluginName} />;
        refinePresets = ["Include edge cases & graphs", "Add SI unit conversions", "Highlight JEE shortcuts"];
      }
      break;
    case "pdf":
      if (execution.pdfData) {
        body = <InChatPdfWidget data={execution.pdfData} fallbackClass={execution.scholarClass} />;
        refinePresets = ["Expand solved examples", "Add a quick-revision table", "Make it exam-cram concise"];
      }
      break;
    case "explainer":
      if (execution.explainerData) {
        body = <InChatExplainerWidget data={execution.explainerData} />;
        refinePresets = ["Explain more simply", "Show a harder derivation", "Give another numerical"];
      }
      break;
    case "image":
      if (execution.imageData) {
        body = <InChatImageWidget data={execution.imageData} onRetry={onRetry} />;
        refinePresets = ["Clean whiteboard style", "Add clearer labels & arrows", "High-contrast textbook diagram"];
      }
      break;
    case "homework":
      if (execution.homeworkData) {
        body = (
          <InChatHomeworkWidget
            data={execution.homeworkData}
            interaction={execution.userInteraction}
            onUpdateInteraction={onUpdateInteraction}
          />
        );
        refinePresets = ["Explain why the second step works", "Give an alternate method", "Make a practice question like this"];
      }
      break;
    case "evaluator":
      if (execution.evaluatorData) {
        body = <InChatEvaluatorWidget data={execution.evaluatorData} />;
        refinePresets = ["How do I reach full marks?", "Rewrite an ideal CBSE answer", "Test me with a similar question"];
      }
      break;
    case "planner":
      if (execution.plannerData) {
        body = (
          <InChatPlannerWidget
            data={execution.plannerData}
            interaction={execution.userInteraction}
            onUpdateInteraction={onUpdateInteraction}
          />
        );
        refinePresets = ["Make it lighter (2 hrs/day)", "Front-load weak chapters", "Turn into a 7-day cram"];
      }
      break;
    case "flowchart":
      if (execution.flowchartData) {
        body = <InChatFlowchartWidget data={execution.flowchartData} />;
        refinePresets = ["Add decision branches", "Keep steps ultra-short", "Highlight common traps"];
      }
      break;
    case "analytics":
      if (execution.analyticsData) {
        body = <InChatAnalyticsWidget data={execution.analyticsData} />;
        refinePresets = ["Build a fix-first checklist", "Which topic boosts my score fastest?"];
      }
      break;
    case "pyq":
      if (execution.pyqData) {
        body = <InChatPyqWidget data={execution.pyqData} />;
        refinePresets = ["Show another PYQ on this topic", "Explain examiner step-marking"];
      }
      break;
    case "companion":
      if (execution.companionData) {
        body = <InChatCompanionWidget data={execution.companionData} />;
        refinePresets = ["Make a 15-minute sprint plan", "Simplify what to do next"];
      }
      break;
    default:
      break;
  }

  if (!body) {
    const fallbackText = streamedText?.trim() || execution.companionData?.markdown || "";
    if (!fallbackText) return null;
    body = (
      <div className="my-2 w-full min-w-0 rounded-2xl border border-white/10 bg-black/25 p-3.5 text-xs text-white/85">
        <ScholarAIContent content={fallbackText} />
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-2">
      {body}
      <PluginWidgetFooter
        execution={execution}
        refinePresets={refinePresets}
        onRetry={onRetry}
        onRefine={onRefine}
        onChainPlugin={onChainPlugin}
        onUpdateInteraction={onUpdateInteraction}
      />
    </div>
  );
}

/* ─── Unified Plugin Footer (Save to Resources/Notes, Refine, Retry, Chain) ─── */
function PluginWidgetFooter({
  execution,
  refinePresets,
  onRetry,
  onRefine,
  onChainPlugin,
  onUpdateInteraction,
}: {
  execution: LamPluginExecution;
  refinePresets: string[];
  onRetry?: () => void;
  onRefine?: (prompt: string) => void;
  onChainPlugin?: (targetPluginId: string, seedPrompt: string) => void;
  onUpdateInteraction?: (patch: Partial<LamPluginUserInteraction>) => void;
}) {
  const scholarClass = useStore((s) => s.user.scholarClass);
  const addNote = useStore((s) => s.addNote);
  const [savingResource, setSavingResource] = useState(false);
  const [savedResources, setSavedResources] = useState(Boolean(execution.userInteraction?.savedToResources));
  const [savedNote, setSavedNote] = useState(Boolean(execution.userInteraction?.savedToNotes));
  const [chainOpen, setChainOpen] = useState(false);

  const seed = useMemo(() => buildPluginChainSeed(execution), [execution]);
  const hasSeedText = Boolean(seed.bodyText.trim());

  const handleSaveResources = async () => {
    if (savingResource || !hasSeedText) return;
    setSavingResource(true);
    try {
      const res = await saveArtifactToResources({
        title: `${execution.pluginName}: ${seed.title}`,
        text: seed.bodyText,
        scholarClass: execution.scholarClass ?? scholarClass,
      });
      setSavedResources(true);
      onUpdateInteraction?.({ savedToResources: true });
      toast.success(res.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save to Resources.");
    } finally {
      setSavingResource(false);
    }
  };

  const handleSaveNote = () => {
    if (!hasSeedText || savedNote) return;
    addNote({
      title: `${execution.pluginName} · ${seed.title}`.slice(0, 80),
      content: seed.bodyText,
      folder: "LAM AI Plugins",
      tags: ["lam-ai", execution.pluginId],
      color: "cyan",
      pinned: false,
    });
    setSavedNote(true);
    onUpdateInteraction?.({ savedToNotes: true });
    toast.success("Saved to Scholar Notes.");
  };

  return (
    <div className="space-y-1.5 px-0.5">
      {onRefine && refinePresets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {refinePresets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onRefine(preset)}
              className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium text-white/75 transition hover:border-cyan-400/35 hover:bg-cyan-400/12 hover:text-cyan-200"
            >
              {preset}
            </button>
          ))}
        </div>
      )}

      <div className="relative flex flex-wrap items-center gap-1.5 pt-0.5 text-[10.5px]">
        {hasSeedText && (
          <button
            type="button"
            onClick={handleSaveNote}
            disabled={savedNote}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 font-medium text-white/75 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
          >
            {savedNote ? <Check className="h-3 w-3 text-emerald-400" /> : <BookOpen className="h-3 w-3" />}
            {savedNote ? "In Notes" : "Save Note"}
          </button>
        )}

        {hasSeedText && execution.outputType !== "image" && (
          <button
            type="button"
            onClick={handleSaveResources}
            disabled={savingResource || savedResources}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 font-medium text-white/75 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
          >
            {savingResource ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : savedResources ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <BookMarked className="h-3 w-3" />
            )}
            {savedResources ? "Saved to Resources" : "Save to Resources"}
          </button>
        )}

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
          >
            <RefreshCw className="h-3 w-3" /> Regenerate
          </button>
        )}

        {onChainPlugin && hasSeedText && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setChainOpen((v) => !v)}
              aria-expanded={chainOpen}
              className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-1 font-medium text-cyan-200 transition hover:bg-cyan-400/20"
            >
              <Link2 className="h-3 w-3" /> Send to Plugin
            </button>
            {chainOpen && (
              <div className="absolute bottom-full left-0 z-30 mb-1.5 min-w-[185px] rounded-xl border border-white/15 bg-slate-950/95 p-1.5 shadow-xl backdrop-blur-xl">
                <p className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white/45">
                  Chain inside chat
                </p>
                {CHAIN_OPTIONS.filter((o) => o.id !== execution.pluginId).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setChainOpen(false);
                      onChainPlugin(opt.id, `Using ${seed.title}:\n${seed.bodyText}`);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium text-white/85 transition hover:bg-cyan-400/15 hover:text-cyan-100"
                  >
                    <span>{opt.label}</span>
                    <ArrowRight className="h-3 w-3 opacity-60" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── 0. Scholar Plus Showcase Card (Inline Paywall) ─── */
function ScholarPlusShowcaseCard({ execution }: { execution: LamPluginExecution }) {
  return (
    <div className="relative my-2 overflow-hidden rounded-2xl border border-amber-400/35 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-transparent p-4 text-white backdrop-blur-md">
      <div className="flex flex-wrap items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-400/35 bg-amber-400/15 text-amber-300">
          <Lock className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-bold text-amber-100">{execution.pluginName}</h4>
            <span className="rounded-full border border-amber-400/35 bg-amber-400/20 px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-widest text-amber-200">
              Scholar Plus
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-white/75">
            {execution.error ||
              "Interactive image generation (AISIG), Photo Homework Scanner OCR, and AI Slideshow studio decks run natively inside LAM AI chat for Scholar Plus members."}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openScholarPlus({ source: "lam-ai", feature: execution.pluginId })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-sm transition hover:brightness-105"
            >
              <Sparkles className="h-3.5 w-3.5" /> Upgrade to Scholar Plus
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── 0.25 Waiting Input Card (Missing Photo or Input Collection inside chat) ─── */
function InChatWaitingInputCard({
  execution,
  onProvideWaitingInput,
}: {
  execution: LamPluginExecution;
  onProvideWaitingInput?: (opts: { prompt?: string; files?: File[] }) => void;
}) {
  const [textInput, setTextInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="my-2 rounded-2xl border border-cyan-400/30 bg-cyan-500/[0.08] p-4 text-white backdrop-blur-md">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-400/30 bg-cyan-400/15 text-cyan-200">
          {execution.requiresImage ? <Camera className="h-4.5 w-4.5" /> : <HelpCircle className="h-4.5 w-4.5" />}
        </div>
        <div className="min-w-0 flex-1 space-y-2.5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">
              {execution.pluginName} · Input needed
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-white/90">
              {execution.waitingInputPrompt || `Provide input to run ${execution.pluginName}.`}
            </p>
          </div>

          {execution.requiresImage && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept={LAM_IMAGE_ACCEPT}
                hidden
                onChange={(e) => {
                  const files = e.target.files ? Array.from(e.target.files) : [];
                  e.target.value = "";
                  if (files.length && onProvideWaitingInput) {
                    onProvideWaitingInput({ files, prompt: textInput.trim() || undefined });
                  }
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-400 px-3 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-300"
              >
                <Camera className="h-3.5 w-3.5" /> Upload Problem Photo
              </button>
              <span className="text-[10.5px] text-white/55">PNG, JPG, or WEBP up to 10 MB</span>
            </div>
          )}

          {execution.waitingInputSuggestions?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {execution.waitingInputSuggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onProvideWaitingInput?.({ prompt: s })}
                  className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[10.5px] font-medium text-white/85 transition hover:border-cyan-400/40 hover:bg-cyan-400/15"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && textInput.trim()) {
                  e.preventDefault();
                  onProvideWaitingInput?.({ prompt: textInput.trim() });
                }
              }}
              placeholder={
                execution.requiresImage
                  ? "Or paste the question text directly..."
                  : "Type details here and press Enter..."
              }
              className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-1.5 text-xs text-white placeholder:text-white/40 focus:border-cyan-400/50 focus:outline-none"
            />
            <button
              type="button"
              disabled={!textInput.trim()}
              onClick={() => textInput.trim() && onProvideWaitingInput?.({ prompt: textInput.trim() })}
              className="rounded-xl border border-cyan-400/35 bg-cyan-400/15 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/25 disabled:opacity-40"
            >
              Run
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── 0.5 Lifecycle Progress Card (Honest stages, no fake percentages) ─── */
function InChatLifecycleCard({
  execution,
  streamedText,
  onCancel,
}: {
  execution: LamPluginExecution;
  streamedText?: string;
  onCancel?: () => void;
}) {
  const stageText =
    execution.progressStage ||
    (execution.status === "queued"
      ? "Queued for execution..."
      : execution.status === "preparing"
        ? "Preparing curriculum & attachment context..."
        : execution.status === "generating"
          ? "Generating interactive result..."
          : `Running ${execution.pluginName}...`);

  return (
    <div className="my-2 w-full min-w-0 rounded-2xl border border-white/15 bg-black/25 p-3.5 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white">{execution.pluginName}</p>
            <p className="truncate text-[11px] text-white/65">{stageText}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {execution.currentStep && execution.totalSteps ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/70">
              Step {execution.currentStep}/{execution.totalSteps}
            </span>
          ) : null}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[10.5px] font-semibold text-white/75 transition hover:bg-white/15 hover:text-white"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {streamedText?.trim() ? (
        <div className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/85">
          <ScholarAIContent content={streamedText} streaming />
        </div>
      ) : null}
    </div>
  );
}

/* ─── 0.75 Error / Cancelled Card ─── */
function InChatErrorCard({ execution, onRetry }: { execution: LamPluginExecution; onRetry?: () => void }) {
  const isCancelled = execution.status === "cancelled";
  const isAuth = execution.errorCode === "AUTH_REQUIRED";
  return (
    <div className="my-2 rounded-2xl border border-red-400/25 bg-red-500/10 p-3.5 text-white">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-red-100">
            {isCancelled
              ? `${execution.pluginName} cancelled`
              : isAuth
                ? "Sign in required to execute plugin"
                : `${execution.pluginName} could not complete`}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-red-200/80">
            {execution.error || (isCancelled ? "Execution stopped before completion." : "An unexpected error occurred.")}
          </p>
          {onRetry && !isAuth && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-red-300/30 bg-red-400/15 px-3 py-1 text-[11px] font-semibold text-red-100 transition hover:bg-red-400/25"
            >
              <RotateCcw className="h-3 w-3" /> Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── 1. Quiz Widget ─── */
function InChatQuizWidget({
  questions,
  pluginName,
  interaction,
  onUpdateInteraction,
}: {
  questions: LamPluginQuizQuestion[];
  pluginName: string;
  interaction?: LamPluginUserInteraction;
  onUpdateInteraction?: (patch: Partial<LamPluginUserInteraction>) => void;
}) {
  const addXP = useStore((s) => s.addXP);
  const addQuizAttempt = useStore((s) => s.addQuizAttempt);
  const [localPicks, setLocalPicks] = useState<Record<number, string>>({});
  const [localSaved, setLocalSaved] = useState(false);
  const [idx, setIdx] = useState(0);

  const picks = interaction?.quizPicks ?? localPicks;
  const saved = typeof interaction?.quizSaved === "boolean" ? interaction.quizSaved : localSaved;

  const current = questions[idx] ?? questions[0];
  if (!current) return null;

  const picked = picks[idx];
  const answeredCount = Object.keys(picks).length;
  const correctCount = questions.filter((q, i) => picks[i] === q.answer).length;
  const allAnswered = answeredCount === questions.length;

  const choose = (opt: string) => {
    if (picks[idx]) return;
    const next = { ...picks, [idx]: opt };
    setLocalPicks(next);
    onUpdateInteraction?.({ quizPicks: next });
  };

  const handleSave = () => {
    if (saved) return;
    const xp = correctCount * 8 + 5;
    addXP(xp);
    const ts = Date.now();
    addQuizAttempt({
      id: `lam-quiz-${ts}`,
      title: `${pluginName} (${questions.length} Qs)`,
      questions: questions.map((q, i) => ({
        id: `q-${i}`,
        type: "mcq",
        question: q.question,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        difficulty: "medium",
      })),
      responses: Object.fromEntries(Object.entries(picks).map(([k, v]) => [`q-${k}`, v])),
      score: correctCount,
      total: questions.length,
      startedAt: ts - questions.length * 20_000,
      finishedAt: ts,
      timeSpent: questions.length * 20,
    });
    setLocalSaved(true);
    onUpdateInteraction?.({ quizSaved: true });
    toast.success(`Saved ${correctCount}/${questions.length} · +${xp} XP`);
  };

  return (
    <div className="my-2 w-full min-w-0 rounded-2xl border border-white/15 bg-black/25 p-4 text-white backdrop-blur-md">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <ListChecks className="h-4 w-4 shrink-0 text-cyan-300" />
          <span className="truncate text-xs font-bold">{pluginName}</span>
          <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-semibold">
            {idx + 1} / {questions.length}
          </span>
        </div>
        <span className="text-[11px] font-semibold text-white/65">
          Score {correctCount}/{answeredCount}
        </span>
      </div>

      <div className="mb-3 text-sm font-medium leading-relaxed text-white">
        <ScholarAIContent content={current.question} mode="compact" />
      </div>

      <div className="space-y-2">
        {current.options.map((opt, oIdx) => {
          const isPicked = picked === opt;
          const isCorrect = opt === current.answer;
          let cls = "border-white/10 bg-white/[0.04] hover:border-white/25 hover:bg-white/[0.08]";
          if (picked) {
            if (isCorrect) cls = "border-emerald-400/50 bg-emerald-500/15 text-emerald-100";
            else if (isPicked) cls = "border-red-400/50 bg-red-500/15 text-red-100";
            else cls = "border-white/5 bg-white/[0.02] opacity-55";
          }
          return (
            <button
              key={`${idx}-${oIdx}`}
              type="button"
              onClick={() => choose(opt)}
              disabled={Boolean(picked)}
              className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-xs transition ${cls}`}
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md border border-white/15 bg-black/25 text-[10px] font-bold">
                {String.fromCharCode(65 + oIdx)}
              </span>
              <span className="min-w-0 flex-1 break-words">
                <ScholarAIContent content={opt} mode="compact" />
              </span>
              {picked && isCorrect && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
              {picked && isPicked && !isCorrect && <XCircle className="h-4 w-4 shrink-0 text-red-400" />}
            </button>
          );
        })}
      </div>

      {picked && (
        <div className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-3 text-xs leading-relaxed text-cyan-100">
          <strong className="mb-0.5 block text-[10px] uppercase tracking-wider text-cyan-300">
            Explanation
          </strong>
          <ScholarAIContent content={current.explanation} mode="compact" />
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={idx === 0}
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold disabled:opacity-35"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={idx >= questions.length - 1}
            onClick={() => setIdx((i) => Math.min(questions.length - 1, i + 1))}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold disabled:opacity-35"
          >
            Next
          </button>
        </div>

        {allAnswered && (
          <button
            type="button"
            disabled={saved}
            onClick={handleSave}
            className="rounded-lg bg-emerald-500/20 px-3 py-1 text-[11px] font-bold text-emerald-200 ring-1 ring-emerald-400/40 transition hover:bg-emerald-500/30 disabled:opacity-55"
          >
            {saved ? "Score Saved" : "Save Result (+XP)"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── 1.5 NCERT Question Set Widget (Mixed MCQ + Subjective CBSE Marks) ─── */
function InChatNcertSetWidget({
  data,
  interaction,
  onUpdateInteraction,
}: {
  data: LamPluginNcertSetData;
  interaction?: LamPluginUserInteraction;
  onUpdateInteraction?: (patch: Partial<LamPluginUserInteraction>) => void;
}) {
  const [revealed, setRevealed] = useState<Record<number, boolean>>(
    () => interaction?.revealedSolutions ?? {},
  );
  const [picks, setPicks] = useState<Record<number, string>>(() => interaction?.quizPicks ?? {});

  const toggleReveal = (index: number) => {
    const next = { ...revealed, [index]: !revealed[index] };
    setRevealed(next);
    onUpdateInteraction?.({ revealedSolutions: next });
  };

  return (
    <div className="my-2 w-full min-w-0 rounded-2xl border border-white/15 bg-black/25 p-4 text-white backdrop-blur-md">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <BookOpen className="h-4 w-4 shrink-0 text-emerald-300" />
          <div className="min-w-0">
            <p className="truncate text-xs font-bold">{data.title}</p>
            {(data.subject || data.chapter) && (
              <p className="truncate text-[10.5px] text-white/55">
                {[data.subject, data.chapter].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/12 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
          {data.items.length} Questions
        </span>
      </div>

      <div className="space-y-3">
        {data.items.map((item, i) => {
          const pick = picks[i];
          const isOpen = Boolean(revealed[i]);
          return (
            <div key={i} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                  Q{i + 1} · {item.type}
                </span>
                <span className="rounded-full border border-amber-400/30 bg-amber-400/12 px-2 py-0.5 text-[9.5px] font-bold text-amber-200">
                  {item.marks} {item.marks === 1 ? "Mark" : "Marks"}
                </span>
              </div>

              <div className="text-xs leading-relaxed text-white/95">
                <ScholarAIContent content={item.question} mode="compact" />
              </div>

              {item.options && item.options.length > 0 && (
                <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {item.options.map((opt, oi) => {
                    const isPicked = pick === opt;
                    const isAns = item.answer ? opt === item.answer : false;
                    let cls = "border-white/10 bg-black/25 hover:bg-white/10";
                    if (pick) {
                      if (isAns) cls = "border-emerald-400/50 bg-emerald-500/15 text-emerald-100";
                      else if (isPicked) cls = "border-red-400/50 bg-red-500/15 text-red-100";
                    }
                    return (
                      <button
                        key={oi}
                        type="button"
                        disabled={Boolean(pick)}
                        onClick={() => {
                          const next = { ...picks, [i]: opt };
                          setPicks(next);
                          onUpdateInteraction?.({ quizPicks: next });
                        }}
                        className={`flex items-baseline gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition ${cls}`}
                      >
                        <span className="shrink-0 font-semibold">{String.fromCharCode(65 + oi)}.</span>
                        <span className="min-w-0 [&_p]:m-0">
                          <ScholarAIContent content={formatFormulaSubtext(opt)} mode="compact" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-2.5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => toggleReveal(i)}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[10.5px] font-semibold text-white/80 hover:bg-white/10"
                >
                  {isOpen ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {isOpen ? "Hide CBSE Solution" : "Reveal CBSE Marking Solution"}
                </button>
              </div>

              {isOpen && (
                <div className="mt-2 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.08] p-2.5 text-xs text-emerald-50">
                  <ScholarAIContent content={item.solution} mode="compact" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── 2. Flashcard Widget ─── */
function InChatFlashcardWidget({
  cards,
  pluginName,
  interaction,
  onUpdateInteraction,
}: {
  cards: LamPluginFlashcard[];
  pluginName: string;
  interaction?: LamPluginUserInteraction;
  onUpdateInteraction?: (patch: Partial<LamPluginUserInteraction>) => void;
}) {
  const addDeck = useStore((s) => s.addDeck);
  const addFlashcard = useStore((s) => s.addFlashcard);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [savedIndices, setSavedIndices] = useState<Set<number>>(
    () => new Set(interaction?.savedCardIndices ?? []),
  );
  const [knownIndices, setKnownIndices] = useState<Set<number>>(
    () => new Set(interaction?.knownCardIndices ?? []),
  );

  const card = cards[idx] ?? cards[0];
  if (!card) return null;

  const ensureDeck = () =>
    addDeck({
      id: "lam-ai-chat-deck",
      name: "LAM AI Flashcards",
      color: "cyan",
    });

  const saveOne = () => {
    if (savedIndices.has(idx)) return;
    const deckId = ensureDeck();
    addFlashcard({
      deckId,
      front: card.front,
      back: card.tip ? `${card.back}\n\nExam tip: ${card.tip}` : card.back,
      box: 1,
    });
    const next = new Set(savedIndices).add(idx);
    setSavedIndices(next);
    onUpdateInteraction?.({ savedCardIndices: Array.from(next) });
    toast.success("Card saved to Flashcards deck.");
  };

  const saveAll = () => {
    const deckId = ensureDeck();
    const next = new Set(savedIndices);
    cards.forEach((c, i) => {
      if (!next.has(i)) {
        addFlashcard({
          deckId,
          front: c.front,
          back: c.tip ? `${c.back}\n\nExam tip: ${c.tip}` : c.back,
          box: 1,
        });
        next.add(i);
      }
    });
    setSavedIndices(next);
    onUpdateInteraction?.({ savedCardIndices: Array.from(next) });
    toast.success(`Saved all ${cards.length} cards to Flashcards!`);
  };

  const markKnown = () => {
    const next = new Set(knownIndices);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setKnownIndices(next);
    onUpdateInteraction?.({ knownCardIndices: Array.from(next) });
  };

  return (
    <div className="my-2 w-full min-w-0 rounded-2xl border border-white/15 bg-black/25 p-4 text-white backdrop-blur-md">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-amber-300" />
          <span className="text-xs font-bold">{pluginName}</span>
          <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px]">
            {idx + 1} / {cards.length}
          </span>
        </div>
        <button
          type="button"
          onClick={saveAll}
          disabled={savedIndices.size === cards.length}
          className="rounded-lg border border-amber-400/30 bg-amber-400/12 px-2.5 py-1 text-[10.5px] font-semibold text-amber-200 transition hover:bg-amber-400/20 disabled:opacity-50"
        >
          {savedIndices.size === cards.length ? "All Saved" : `Save All (${cards.length})`}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="group relative flex min-h-[136px] w-full flex-col items-center justify-center rounded-xl border border-white/15 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-5 text-center transition hover:border-amber-400/40"
      >
        <span className="mb-2 text-[9.5px] font-bold uppercase tracking-widest text-amber-300/80">
          {flipped ? "Answer" : card.topic ? `${card.topic} · Question` : "Tap to reveal answer"}
        </span>
        <div className="max-w-full text-sm font-semibold leading-relaxed text-white">
          <ScholarAIContent content={flipped ? card.back : card.front} mode="compact" />
        </div>
        {flipped && card.tip && (
          <p className="mt-2.5 rounded-lg border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-200">
            Tip: {card.tip}
          </p>
        )}
        <span className="mt-3 inline-flex items-center gap-1 text-[10px] text-white/45 group-hover:text-white/75">
          <RotateCw className="h-3 w-3" /> Flip card
        </span>
      </button>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setFlipped(false);
              setIdx((i) => (i - 1 + cards.length) % cards.length);
            }}
            className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
            aria-label="Previous card"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setFlipped(false);
              setIdx((i) => (i + 1) % cards.length);
            }}
            className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
            aria-label="Next card"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={markKnown}
            className={`rounded-lg border px-2.5 py-1 text-[10.5px] font-semibold transition ${
              knownIndices.has(idx)
                ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            {knownIndices.has(idx) ? "Known ✓" : "Mark Known"}
          </button>
        </div>

        <button
          type="button"
          onClick={saveOne}
          disabled={savedIndices.has(idx)}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/10 disabled:opacity-50"
        >
          {savedIndices.has(idx) ? <Check className="h-3 w-3 text-emerald-400" /> : <Download className="h-3 w-3" />}
          {savedIndices.has(idx) ? "Saved" : "Save Card"}
        </button>
      </div>
    </div>
  );
}

/* ─── 3. Slideshow Widget (Interactive Carousel + Slideshow Library + Real PPTX Download) ─── */
function InChatSlideshowWidget({
  data,
  scholarClass,
  interaction,
  onUpdateInteraction,
}: {
  data: LamPluginSlideshowData;
  scholarClass?: 9 | 11;
  interaction?: LamPluginUserInteraction;
  onUpdateInteraction?: (patch: Partial<LamPluginUserInteraction>) => void;
}) {
  const userClass = useStore((s) => s.user.scholarClass);
  const resolvedClass = scholarClass ?? userClass;
  const [idx, setIdx] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [exportingPptx, setExportingPptx] = useState(false);
  const [savedId, setSavedId] = useState(interaction?.slideshowSavedId || "");

  const slide = data.slides[idx] ?? data.slides[0];
  if (!slide) return null;

  const handleSaveToLibrary = () => {
    const validTypes = new Set<string>([
      "title", "agenda", "section", "concept", "formula", "diagram",
      "example", "practice", "summary", "takeaways", "comparison",
    ]);
    const deck = newSlideshow({
      title: data.title,
      subject: data.subject || "",
      chapter: data.chapter || "",
      classProfile: resolvedClass,
      slides: data.slides.map((s) =>
        newSlide((s.type && validTypes.has(s.type) ? s.type : "concept") as SlideType, {
          title: s.title,
          content: s.content || s.takeaway || "",
          bullets: s.bullets,
          formula: s.formula,
          speakerNotes: s.note || s.takeaway || "",
        }),
      ),
    });
    upsertSlideshow(deck);
    setSavedId(deck.id);
    onUpdateInteraction?.({ slideshowSavedId: deck.id });
    toast.success("Saved to Slideshow Maker library.");
  };

  const handleExportPptx = async () => {
    if (exportingPptx) return;
    setExportingPptx(true);
    try {
      const { default: PptxGenJS } = await import("pptxgenjs");
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE";
      pptx.title = data.title;
      pptx.author = "Scholar LAM AI";
      for (let i = 0; i < data.slides.length; i += 1) {
        const s = data.slides[i];
        const pSlide = pptx.addSlide();
        pSlide.background = { color: "0B1020" };
        pSlide.addText(s.title, {
          x: 0.65,
          y: 0.45,
          w: 12,
          h: 0.7,
          fontSize: 24,
          bold: true,
          color: "F8FAFC",
        });
        let y = 1.3;
        if (s.content) {
          pSlide.addText(s.content, { x: 0.75, y, w: 11.8, h: 1.1, fontSize: 15, color: "E2E8F0" });
          y += 1.2;
        }
        if (s.formula) {
          pSlide.addText(s.formula, {
            x: 0.75,
            y,
            w: 11.8,
            h: 0.75,
            fontSize: 20,
            bold: true,
            color: "67E8F9",
            fill: { color: "152238" },
            align: "center",
          });
          y += 0.9;
        }
        if (s.bullets?.length) {
          pSlide.addText(s.bullets.map((b) => `• ${b}`).join("\n"), {
            x: 0.85,
            y,
            w: 11.6,
            h: Math.max(1.5, 5.8 - y),
            fontSize: 15,
            color: "E2E8F0",
            paraSpaceAfter: 8,
            valign: "top",
          });
        }
        if (s.takeaway) {
          pSlide.addText(`Key Takeaway: ${s.takeaway}`, {
            x: 0.75,
            y: 6.25,
            w: 11.8,
            h: 0.6,
            fontSize: 12,
            bold: true,
            color: "A7F3D0",
            fill: { color: "112A2A" },
          });
        }
        pSlide.addText(`${i + 1} / ${data.slides.length}`, {
          x: 11.4,
          y: 7.05,
          w: 1.2,
          h: 0.2,
          fontSize: 9,
          color: "94A3B8",
          align: "right",
        });
        if (s.note) pSlide.addNotes(s.note);
      }
      await pptx.writeFile({
        fileName: `${data.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "scholar-deck"}.pptx`,
        compression: true,
      });
      toast.success("Downloaded editable .pptx deck.");
    } catch {
      toast.error("PPTX export failed. Please try again.");
    } finally {
      setExportingPptx(false);
    }
  };

  return (
    <div className="my-2 w-full min-w-0 rounded-2xl border border-white/15 bg-black/25 p-4 text-white backdrop-blur-md">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Presentation className="h-4 w-4 shrink-0 text-purple-300" />
          <div className="min-w-0">
            <p className="truncate text-xs font-bold">{data.title}</p>
            <p className="text-[10px] text-white/55">
              Slide {idx + 1} of {data.slides.length}
              {slide.type ? ` · ${slide.type}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleExportPptx}
            disabled={exportingPptx}
            className="inline-flex items-center gap-1 rounded-lg border border-purple-400/35 bg-purple-400/15 px-2.5 py-1 text-[10.5px] font-semibold text-purple-100 hover:bg-purple-400/25 disabled:opacity-60"
          >
            {exportingPptx ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            PPTX
          </button>
          <button
            type="button"
            onClick={handleSaveToLibrary}
            disabled={Boolean(savedId)}
            className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[10.5px] font-semibold text-white/80 hover:bg-white/10 disabled:opacity-60"
          >
            {savedId ? <Check className="h-3 w-3 text-emerald-400" /> : <BookMarked className="h-3 w-3" />}
            {savedId ? "Saved to Library" : "Save Deck"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-purple-400/20 bg-gradient-to-br from-purple-950/45 via-slate-900/55 to-black/40 p-4">
        <h4 className="mb-2 text-sm font-bold text-purple-100">{slide.title}</h4>
        {slide.content && (
          <div className="mb-2.5 text-xs leading-relaxed text-white/80">
            <ScholarAIContent content={slide.content} mode="compact" />
          </div>
        )}
        {slide.formula && (
          <div className="mb-2.5 rounded-lg border border-cyan-400/25 bg-cyan-500/10 p-2 text-xs text-cyan-100">
            <ScholarAIContent content={`$$${slide.formula}$$`} mode="compact" />
          </div>
        )}
        <ul className="space-y-1.5 text-xs text-white/85">
          {slide.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-300" />
              <span className="min-w-0 flex-1 break-words">
                <ScholarAIContent content={b} mode="compact" />
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 rounded-lg border border-purple-400/20 bg-purple-400/10 px-3 py-2 text-[11px] font-medium text-purple-200">
          Key Takeaway: {slide.takeaway}
        </div>
        {slide.note && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowNotes((v) => !v)}
              className="text-[10.5px] font-semibold text-white/55 hover:text-white/85"
            >
              {showNotes ? "Hide speaker notes" : "Show speaker notes"}
            </button>
            {showNotes && <p className="mt-1 text-[11px] leading-relaxed text-white/70">{slide.note}</p>}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold disabled:opacity-35"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Prev
        </button>

        <div className="flex max-w-full flex-wrap items-center justify-center gap-1">
          {data.slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`Slide ${i + 1}`}
              className={`h-2 rounded-full transition-all ${
                i === idx ? "w-5 bg-purple-400" : "w-2 bg-white/25 hover:bg-white/45"
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setIdx((i) => Math.min(data.slides.length - 1, i + 1))}
          disabled={idx >= data.slides.length - 1}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold disabled:opacity-35"
        >
          Next <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─── 4. Formula Sheet Widget (KaTeX via ScholarAIContent) ─── */
function formatFormulaSubtext(text: string): string {
  const trimmed = text.replace(/^·+/, "").trim();
  if (!trimmed || trimmed.includes("$")) return trimmed;
  if (/\\(?:mathrm|cdot|times|omega|theta|text|frac)\b/i.test(trimmed) && trimmed.length <= 60 && !/\s[a-z]{4,}\s/i.test(trimmed)) {
    return `$${trimmed}$`;
  }
  return trimmed
    .replace(/([A-Za-z0-9]+(?:_\{[^}]+\}|\^\{[^}]+\})+(?:[·*][A-Za-z0-9]+(?:\^\{[^}]+\})?)*)/g, (_, tok: string) => `$${tok}$`)
    .replace(/\\(alpha|beta|gamma|delta|theta|omega|phi|sigma|lambda|mu|pi)\b/gi, (_, sym: string) => `$\\${sym}$`);
}

function InChatFormulaWidget({
  formulas,
  pluginName,
}: {
  formulas: LamPluginFormula[];
  pluginName: string;
}) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const copyFormula = (f: LamPluginFormula, i: number) => {
    void navigator.clipboard.writeText(`${f.name}: ${f.formula} (${f.units})`);
    setCopiedIdx(i);
    setTimeout(() => setCopiedIdx(null), 1400);
  };
  const copyAll = () => {
    void navigator.clipboard.writeText(
      formulas.map((f) => `${f.name}: ${f.formula} [${f.units}]${f.condition ? ` — ${f.condition}` : ""}`).join("\n"),
    );
    toast.success("Copied formula sheet.");
  };

  return (
    <div className="my-2 w-full min-w-0 rounded-2xl border border-white/15 bg-black/25 p-4 text-white backdrop-blur-md">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-300" />
          <span className="text-xs font-bold">{pluginName}</span>
          <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px]">
            {formulas.length}
          </span>
        </div>
        <button
          type="button"
          onClick={copyAll}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10.5px] font-semibold text-white/80 hover:bg-white/10"
        >
          <Copy className="h-3 w-3" /> Copy All
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {formulas.map((f, i) => (
          <div key={i} className="group flex flex-col justify-between rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-bold text-cyan-200">{f.name}</span>
                <button
                  type="button"
                  onClick={() => copyFormula(f, i)}
                  className="text-white/40 transition hover:text-white"
                  title="Copy formula"
                >
                  {copiedIdx === i ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              <div className="my-1.5 overflow-x-auto rounded-lg bg-black/30 px-2.5 py-1.5 text-xs font-semibold text-white">
                <ScholarAIContent content={f.formula.includes("$") ? f.formula : `$$${f.formula}$$`} mode="compact" />
              </div>
            </div>
            <div className="mt-1 space-y-0.5 text-[10px] text-white/60">
              <div className="flex flex-wrap items-baseline gap-1">
                <span>Units:</span>
                <ScholarAIContent content={formatFormulaSubtext(f.units)} mode="compact" />
              </div>
              {f.condition && (
                <div className="flex flex-wrap items-baseline gap-1 text-amber-200/80">
                  <span>Condition:</span>
                  <ScholarAIContent content={formatFormulaSubtext(f.condition)} mode="compact" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── 5. PDF Studio / Summarizer / One Night Exam / Chapter Builder Widget ─── */
function InChatPdfWidget({
  data,
  fallbackClass,
}: {
  data: LamPluginPdfData;
  fallbackClass?: 9 | 11;
}) {
  const userClass = useStore((s) => s.user.scholarClass);
  const addFile = useStore((s) => s.addFile);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [savedFile, setSavedFile] = useState(false);

  const handlePrintPdf = () => {
    exportPDF({
      title: data.title,
      subtitle: data.subtitle,
      bodyHtml: mdToHtml(data.fullMarkdown),
      scholarClass: data.scholarClass ?? fallbackClass ?? userClass,
    });
    toast.success("Opened publication PDF export.");
  };

  const handleSaveMarkdown = () => {
    if (savedFile) return;
    const blob = new Blob([data.fullMarkdown], { type: "text/markdown" });
    const dataUrl = `data:text/markdown;base64,${btoa(unescape(encodeURIComponent(data.fullMarkdown)))}`;
    addFile({
      name: `${data.title.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 42)}.md`,
      type: "markdown",
      size: blob.size,
      dataUrl,
      tags: ["lam-ai", "pdf-draft"],
    });
    setSavedFile(true);
    toast.success("Saved Markdown study pack to Scholar Files.");
  };

  return (
    <>
      <div className="my-2 w-full min-w-0 rounded-2xl border border-white/15 bg-black/25 p-4 text-white backdrop-blur-md">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2.5 border-b border-white/10 pb-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-400/25 bg-cyan-500/15 text-cyan-300">
              <FileText className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <h4 className="truncate text-xs font-bold text-white">{data.title}</h4>
              <p className="truncate text-[11px] text-white/60">{data.subtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-white/85 hover:bg-white/10"
            >
              <Eye className="h-3.5 w-3.5" /> Preview
            </button>
            <button
              type="button"
              onClick={handlePrintPdf}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-400 to-teal-300 px-3 py-1.5 text-[11px] font-bold text-slate-950 transition hover:brightness-105"
            >
              <FileDown className="h-3.5 w-3.5" /> Export PDF
            </button>
            <button
              type="button"
              onClick={handleSaveMarkdown}
              disabled={savedFile}
              className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-white/80 hover:bg-white/10 disabled:opacity-55"
            >
              {savedFile ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Download className="h-3.5 w-3.5" />}
              {savedFile ? "Saved MD" : "Save MD"}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {data.sections.slice(0, 6).map((s, i) => (
            <details key={i} open={i === 0} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <summary className="cursor-pointer list-none text-xs font-semibold text-cyan-200">
                {s.heading}
              </summary>
              <div className="mt-2 text-xs leading-relaxed text-white/80">
                <ScholarAIContent content={s.body} mode="compact" />
              </div>
            </details>
          ))}
        </div>
      </div>

      {previewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <h4 className="truncate text-sm font-bold text-white">{data.title}</h4>
                <p className="truncate text-[11px] text-white/55">{data.subtitle}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintPdf}
                  className="inline-flex items-center gap-1 rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-bold text-slate-950"
                >
                  <FileDown className="h-3.5 w-3.5" /> Export PDF
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  aria-label="Close document preview"
                  className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-white/75 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 text-sm text-white/90">
              <ScholarAIContent content={data.fullMarkdown} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── 6. Concept Explainer Widget ─── */
function InChatExplainerWidget({ data }: { data: LamPluginExplainerData }) {
  const [showDeriv, setShowDeriv] = useState(true);
  return (
    <div className="my-2 w-full min-w-0 space-y-2.5 rounded-2xl border border-white/15 bg-black/25 p-4 text-white backdrop-blur-md">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-300" />
          <h4 className="text-xs font-bold">{data.concept}</h4>
        </div>
        {data.derivation && (
          <button
            type="button"
            onClick={() => setShowDeriv((d) => !d)}
            className="text-[10.5px] font-semibold text-cyan-300 hover:underline"
          >
            {showDeriv ? "Hide derivation" : "Show derivation"}
          </button>
        )}
      </div>

      <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.08] p-3 text-xs leading-relaxed">
        <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-amber-300">
          Core Intuition
        </span>
        <ScholarAIContent content={data.intuition} mode="compact" />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed">
        <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-cyan-300">
          Precise Definition
        </span>
        <ScholarAIContent content={data.definition} mode="compact" />
      </div>

      {data.derivation && showDeriv && (
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-relaxed">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-purple-300">
            Derivation / Mechanism
          </span>
          <ScholarAIContent content={data.derivation} mode="compact" />
        </div>
      )}

      {data.workedExample && (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.08] p-3 text-xs leading-relaxed">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-emerald-300">
            Worked Example
          </span>
          <ScholarAIContent content={data.workedExample} mode="compact" />
        </div>
      )}

      {data.mistakes.length > 0 && (
        <div className="rounded-xl border border-red-400/20 bg-red-500/[0.08] p-3 text-xs">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-red-300">
            Common Exam Pitfalls
          </span>
          <ul className="space-y-1 text-red-100/90">
            {data.mistakes.map((m, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-red-300" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ─── 7. Generated Image / Diagram Widget (AISIG Plus) ─── */
function InChatImageWidget({ data, onRetry }: { data: LamPluginImageData; onRetry?: () => void }) {
  const [zoom, setZoom] = useState(false);
  const [savedFile, setSavedFile] = useState(false);
  const addFile = useStore((s) => s.addFile);

  const handleSaveToFiles = () => {
    if (savedFile) return;
    addFile({
      name: `aisig-${Date.now()}.png`,
      type: "image",
      mimeType: "image/png",
      size: data.url.length,
      dataUrl: data.url,
      tags: ["lam-ai", "aisig"],
    });
    setSavedFile(true);
    toast.success("Saved image to Scholar Files.");
  };

  return (
    <>
      <div className="my-2 overflow-hidden rounded-2xl border border-white/15 bg-black/30 backdrop-blur-md">
        <div className="relative flex justify-center bg-slate-950/60">
          <img
            src={data.url}
            alt={data.prompt}
            className="max-h-80 w-auto cursor-zoom-in object-contain transition hover:opacity-95"
            onClick={() => setZoom(true)}
          />
          {data.style && (
            <span className="absolute left-2.5 top-2.5 rounded-full border border-white/15 bg-black/65 px-2 py-0.5 text-[9.5px] font-semibold text-white/85">
              {data.style}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 p-3 text-xs">
          <div className="flex min-w-0 items-center gap-2 text-white/75">
            <ImageIcon className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
            <span className="truncate">{data.prompt}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <a
              href={data.url}
              download={`scholar-diagram-${Date.now()}.png`}
              className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[10.5px] font-semibold text-white/85 hover:bg-white/15"
            >
              <Download className="h-3 w-3" /> Download PNG
            </a>
            <button
              type="button"
              onClick={handleSaveToFiles}
              disabled={savedFile}
              className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[10.5px] font-semibold text-white/85 hover:bg-white/15 disabled:opacity-55"
            >
              {savedFile ? <Check className="h-3 w-3 text-emerald-400" /> : <BookMarked className="h-3 w-3" />}
              {savedFile ? "Saved" : "Save File"}
            </button>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[10.5px] font-semibold text-white/85 hover:bg-white/15"
              >
                <RefreshCw className="h-3 w-3" /> Regenerate
              </button>
            )}
          </div>
        </div>
      </div>

      {zoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          onClick={() => setZoom(false)}
        >
          <button
            type="button"
            onClick={() => setZoom(false)}
            aria-label="Close image preview"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={data.url}
            alt={data.prompt}
            className="max-h-[90vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}
    </>
  );
}

/* ─── 7.5 Homework Scanner Widget (Hint-First + OCR Verification) ─── */
function InChatHomeworkWidget({
  data,
  interaction,
  onUpdateInteraction,
}: {
  data: LamPluginHomeworkData;
  interaction?: LamPluginUserInteraction;
  onUpdateInteraction?: (patch: Partial<LamPluginUserInteraction>) => void;
}) {
  const [showSolution, setShowSolution] = useState(Boolean(interaction?.homeworkSolutionRevealed));
  const revealSolution = () => {
    const next = !showSolution;
    setShowSolution(next);
    onUpdateInteraction?.({ homeworkSolutionRevealed: next });
  };

  return (
    <div className="my-2 w-full min-w-0 space-y-2.5 rounded-2xl border border-white/15 bg-black/25 p-4 text-white backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <ScanText className="h-4 w-4 text-cyan-300" />
          <span className="text-xs font-bold">
            Homework Scanner {data.fileName ? `· ${data.fileName}` : ""}
          </span>
        </div>
        {typeof data.confidence === "number" && (
          <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-200">
            OCR {Math.round(data.confidence)}%
          </span>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/80">
        <span className="mb-1 block text-[9.5px] font-bold uppercase tracking-wider text-white/50">
          Extracted Problem
        </span>
        <ScholarAIContent content={data.ocrText} mode="compact" />
      </div>

      <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.08] p-3 text-xs text-amber-100">
        <span className="mb-1 block text-[9.5px] font-bold uppercase tracking-wider text-amber-300">
          Guiding Hint (Try First!)
        </span>
        <ScholarAIContent content={data.hint} mode="compact" />
      </div>

      <button
        type="button"
        onClick={revealSolution}
        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/35 bg-emerald-400/15 px-3 py-1.5 text-xs font-bold text-emerald-100 transition hover:bg-emerald-400/25"
      >
        {showSolution ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        {showSolution ? "Hide Full Solution" : "Reveal Full Step-by-Step Solution"}
      </button>

      {showSolution && (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.08] p-3 text-xs leading-relaxed text-emerald-50">
          <span className="mb-1 block text-[9.5px] font-bold uppercase tracking-wider text-emerald-300">
            Verified Step-by-Step Solution
          </span>
          <ScholarAIContent content={data.solution} mode="compact" />
        </div>
      )}
    </div>
  );
}

/* ─── 8. Answer Evaluator Rubric Widget ─── */
function InChatEvaluatorWidget({ data }: { data: LamPluginEvaluatorData }) {
  const [showModel, setShowModel] = useState(false);
  const ratio = data.maxScore > 0 ? data.score / data.maxScore : 0;
  const color = ratio >= 0.75 ? "text-emerald-300" : ratio >= 0.45 ? "text-amber-300" : "text-red-300";

  return (
    <div className="my-2 w-full min-w-0 space-y-2.5 rounded-2xl border border-white/15 bg-black/25 p-4 text-white backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <span className="text-xs font-bold">CBSE Rubric Evaluation</span>
        <span className={`text-sm font-black ${color}`}>
          {data.score} / {data.maxScore}
        </span>
      </div>

      {data.markingBreakdown && data.markingBreakdown.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[260px] text-left text-[11px]">
            <thead className="bg-white/[0.06] text-white/60">
              <tr>
                <th className="px-2.5 py-1.5 font-semibold">Criterion</th>
                <th className="whitespace-nowrap px-2.5 py-1.5 font-semibold">Marks</th>
                <th className="px-2.5 py-1.5 font-semibold">Feedback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {data.markingBreakdown.map((row, idx) => (
                <tr key={idx}>
                  <td className="px-2.5 py-1.5 font-medium text-white">{row.criterion}</td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 font-bold text-cyan-200">
                    {row.marksAwarded}/{row.maxMarks}
                  </td>
                  <td className="px-2.5 py-1.5 text-white/75 [&_p]:m-0">
                    <ScholarAIContent content={row.feedback} mode="compact" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(data.formulaFeedback || data.unitsFeedback || data.stepFeedback) && (
        <div className="grid grid-cols-1 gap-1.5 text-[11px] sm:grid-cols-3">
          {data.formulaFeedback && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
              <strong className="mb-0.5 block text-[9.5px] uppercase text-cyan-300">Formula</strong>
              <div className="text-white/80 [&_p]:m-0">
                <ScholarAIContent content={data.formulaFeedback} mode="compact" />
              </div>
            </div>
          )}
          {data.unitsFeedback && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
              <strong className="mb-0.5 block text-[9.5px] uppercase text-cyan-300">Units</strong>
              <div className="text-white/80 [&_p]:m-0">
                <ScholarAIContent content={data.unitsFeedback} mode="compact" />
              </div>
            </div>
          )}
          {data.stepFeedback && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
              <strong className="mb-0.5 block text-[9.5px] uppercase text-cyan-300">Steps</strong>
              <div className="text-white/80 [&_p]:m-0">
                <ScholarAIContent content={data.stepFeedback} mode="compact" />
              </div>
            </div>
          )}
        </div>
      )}

      {data.strengths.length > 0 && (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.08] p-2.5 text-xs">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">What Worked</p>
          <ul className="space-y-1 text-emerald-100/90">
            {data.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.gaps.length > 0 && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/[0.08] p-2.5 text-xs">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
            Missing Key Marks / Gaps
          </p>
          <ul className="space-y-1 text-amber-100/90">
            {data.gaps.map((g, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowModel((m) => !m)}
        className="text-xs font-semibold text-cyan-300 hover:underline"
      >
        {showModel ? "Hide Model CBSE Answer" : "View Full-Mark Model Answer"}
      </button>
      {showModel && (
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-relaxed text-white/85">
          <ScholarAIContent content={data.modelAnswer} mode="compact" />
        </div>
      )}
    </div>
  );
}

/* ─── 9. Planner Widget ─── */
function InChatPlannerWidget({
  data,
  interaction,
  onUpdateInteraction,
}: {
  data: LamPluginPlannerData;
  interaction?: LamPluginUserInteraction;
  onUpdateInteraction?: (patch: Partial<LamPluginUserInteraction>) => void;
}) {
  const addTask = useStore((s) => s.addTask);
  const [added, setAdded] = useState<Set<number>>(
    () => new Set(interaction?.addedTaskIndices ?? []),
  );
  const [allAdded, setAllAdded] = useState(Boolean(interaction?.allTasksAdded));

  const addSingle = (t: LamPluginPlannerData["tasks"][number], i: number) => {
    if (added.has(i)) return;
    addTask({
      title: t.title,
      subject: t.subject,
      type: "study",
      date: t.date,
      time: t.time,
      priority: t.priority,
      done: false,
    });
    const next = new Set(added).add(i);
    setAdded(next);
    onUpdateInteraction?.({
      addedTaskIndices: Array.from(next),
      allTasksAdded: next.size === data.tasks.length,
    });
    toast.success("Added task to Planner.");
  };

  const addAll = () => {
    if (allAdded) return;
    const next = new Set(added);
    data.tasks.forEach((t, i) => {
      if (!next.has(i)) {
        addTask({
          title: t.title,
          subject: t.subject,
          type: "study",
          date: t.date,
          time: t.time,
          priority: t.priority,
          done: false,
        });
        next.add(i);
      }
    });
    setAdded(next);
    setAllAdded(true);
    onUpdateInteraction?.({ addedTaskIndices: Array.from(next), allTasksAdded: true });
    toast.success(`Added ${data.tasks.length} study sessions to Planner!`);
  };

  return (
    <div className="my-2 w-full min-w-0 rounded-2xl border border-white/15 bg-black/25 p-4 text-white backdrop-blur-md">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Calendar className="h-4 w-4 shrink-0 text-cyan-300" />
          <div className="min-w-0">
            <h4 className="truncate text-xs font-bold">{data.planTitle}</h4>
            {data.subtitle && <p className="truncate text-[10.5px] text-white/55">{data.subtitle}</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={addAll}
          disabled={allAdded}
          className="rounded-lg bg-cyan-400/20 px-2.5 py-1 text-[10.5px] font-bold text-cyan-200 ring-1 ring-cyan-400/40 transition hover:bg-cyan-400/30 disabled:opacity-50"
        >
          {allAdded ? "All Scheduled" : `Add All (${data.tasks.length})`}
        </button>
      </div>

      {data.summaryMarkdown && (
        <div className="mb-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-xs text-white/80">
          <ScholarAIContent content={data.summaryMarkdown} mode="compact" />
        </div>
      )}

      <div className="space-y-2">
        {data.tasks.map((t, i) => (
          <div
            key={i}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-white">{t.title}</p>
              <p className="text-[10.5px] text-white/55">
                {t.subject} · {t.date}
                {t.durationMinutes ? ` · ${t.durationMinutes} min` : ""}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase ${
                  t.priority === "high"
                    ? "bg-red-500/20 text-red-200"
                    : t.priority === "medium"
                      ? "bg-amber-500/20 text-amber-200"
                      : "bg-white/10 text-white/65"
                }`}
              >
                {t.priority}
              </span>
              <button
                type="button"
                disabled={added.has(i)}
                onClick={() => addSingle(t, i)}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold hover:bg-white/15 disabled:opacity-45"
              >
                {added.has(i) ? "Added" : "Add"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── 10. Flowchart / Diagram Widget ─── */
function InChatFlowchartWidget({ data }: { data: LamPluginFlowchartData }) {
  const copySteps = () => {
    void navigator.clipboard.writeText(
      data.steps
        .map((s) => `${s.stepNumber}. ${s.title}: ${s.description}${s.keyRule ? ` [${s.keyRule}]` : ""}`)
        .join("\n"),
    );
    toast.success("Copied flowchart steps.");
  };

  return (
    <div className="my-2 w-full min-w-0 rounded-2xl border border-white/15 bg-black/25 p-4 text-white backdrop-blur-md">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-cyan-300" />
          <h4 className="text-xs font-bold">{data.title}</h4>
        </div>
        <button
          type="button"
          onClick={copySteps}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10.5px] font-semibold text-white/75 hover:bg-white/10"
        >
          <Copy className="h-3 w-3" /> Copy Steps
        </button>
      </div>
      <div className="space-y-1">
        {data.steps.map((s, i) => (
          <div key={s.stepNumber} className="flex flex-col items-center">
            <div className="w-full rounded-xl border border-cyan-400/20 bg-white/[0.04] p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-400/20 text-[10px] font-bold text-cyan-200">
                    {s.stepNumber}
                  </span>
                  <span className="font-bold text-cyan-100">{s.title}</span>
                </div>
                {s.keyRule && (
                  <span className="rounded-md border border-purple-400/25 bg-purple-400/12 px-2 py-0.5 text-[10px] font-semibold text-purple-200 [&_.katex]:text-[10px] [&_p]:m-0">
                    <ScholarAIContent content={s.keyRule} mode="compact" />
                  </span>
                )}
              </div>
              <div className="mt-1 pl-7 text-white/75">
                <ScholarAIContent content={s.description} mode="compact" />
              </div>
            </div>
            {i < data.steps.length - 1 && (
              <ArrowRight className="my-1 h-4 w-4 rotate-90 text-cyan-400/60" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── 11. Analytics / Tracker / Memory Predictor / Mistake Analyzer Widget ─── */
function InChatAnalyticsWidget({ data }: { data: LamPluginAnalyticsData }) {
  return (
    <div className="my-2 w-full min-w-0 space-y-2.5 rounded-2xl border border-white/15 bg-black/25 p-4 text-white backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-300" />
          <h4 className="text-xs font-bold">{data.title}</h4>
        </div>
        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-200">
          {data.metricLabel}: {data.metricValue}
        </span>
      </div>

      {data.honestyNote && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white/65">
          {data.honestyNote}
        </div>
      )}

      {data.summaryMetrics && data.summaryMetrics.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {data.summaryMetrics.map((m, idx) => (
            <div key={idx} className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wider text-white/55">{m.label}</p>
              <p className="mt-0.5 text-xs font-bold text-cyan-200">{m.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {data.items.map((item, i) => {
          const pct = typeof item.value === "number" ? Math.max(0, Math.min(100, item.value)) : null;
          const barColor =
            item.level === "danger"
              ? "bg-red-400"
              : item.level === "warning"
                ? "bg-amber-400"
                : "bg-emerald-400";
          return (
            <div key={i} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-white/85">{item.label}</span>
                <span className="font-bold text-cyan-200">
                  {typeof item.value === "number" ? `${item.value}%` : item.value}
                </span>
              </div>
              {pct !== null && (
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
              )}
              {item.detail && (
                <div className="mt-1 text-[10.5px] text-white/60 [&_p]:m-0">
                  <ScholarAIContent content={item.detail} mode="compact" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {data.diagnosisMarkdown && (
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-relaxed text-white/85">
          <ScholarAIContent content={data.diagnosisMarkdown} mode="compact" />
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.08] p-2.5 text-xs text-cyan-100">
        <Target className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
        <span>{data.recommendation}</span>
      </div>
    </div>
  );
}

/* ─── 12. PYQ Solver Widget ─── */
function InChatPyqWidget({ data }: { data: LamPluginPyqData }) {
  return (
    <div className="my-2 w-full min-w-0 space-y-2.5 rounded-2xl border border-white/15 bg-black/25 p-4 text-white backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <span className="rounded-full border border-purple-400/35 bg-purple-400/15 px-2.5 py-0.5 text-[10.5px] font-bold text-purple-200">
          {data.yearExam}
        </span>
        <span className="rounded-full border border-amber-400/35 bg-amber-400/15 px-2.5 py-0.5 text-[10.5px] font-bold text-amber-200">
          {data.totalMarks} Marks
        </span>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs font-medium text-white">
        <ScholarAIContent content={data.question} mode="compact" />
      </div>

      <div className="space-y-2">
        {data.markingSteps.map((s) => (
          <div key={s.stepNumber} className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-cyan-200">
                Step {s.stepNumber}: {s.title}
              </span>
              <span className="rounded-md border border-emerald-400/30 bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                {s.marks}
              </span>
            </div>
            <div className="text-white/85">
              <ScholarAIContent content={s.content} mode="compact" />
            </div>
          </div>
        ))}
      </div>

      {data.finalAnswer && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/12 p-2.5 text-xs text-emerald-100">
          <strong className="mr-1.5 text-emerald-300">Final Answer:</strong>
          <ScholarAIContent content={data.finalAnswer} mode="compact" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
        <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/[0.08] p-2.5 text-cyan-100">
          <strong className="mb-0.5 block text-[9.5px] uppercase text-cyan-300">Examiner Tip</strong>
          <div className="[&_p]:m-0">
            <ScholarAIContent content={data.examinerTip} mode="compact" />
          </div>
        </div>
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/[0.08] p-2.5 text-amber-100">
          <strong className="mb-0.5 block text-[9.5px] uppercase text-amber-300">Common Pitfall</strong>
          <div className="[&_p]:m-0">
            <ScholarAIContent content={data.commonPitfall} mode="compact" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── 13. Companion / Briefing / Life Saver Widget ─── */
function InChatCompanionWidget({ data }: { data: LamPluginCompanionData }) {
  const [speaking, setSpeaking] = useState(false);

  const toggleSpeak = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(data.markdown.replace(/[#*`$_]/g, " "));
    utter.rate = 0.98;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utter);
  };

  return (
    <div className="my-2 w-full min-w-0 space-y-2.5 rounded-2xl border border-white/15 bg-black/25 p-4 text-white backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-cyan-300" />
          <h4 className="text-xs font-bold">{data.title}</h4>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {data.canReadAloud && (
            <button
              type="button"
              onClick={toggleSpeak}
              className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[10.5px] font-semibold text-white/80 hover:bg-white/10"
            >
              {speaking ? <Square className="h-3 w-3 text-red-300" /> : <Volume2 className="h-3 w-3" />}
              {speaking ? "Stop Audio" : "Listen"}
            </button>
          )}
          {data.suggestedFocusMinutes ? (
            <button
              type="button"
              onClick={() => navigateTo("focus", { minutes: data.suggestedFocusMinutes, autoStart: true })}
              className="inline-flex items-center gap-1 rounded-lg bg-cyan-400/20 px-2.5 py-1 text-[10.5px] font-bold text-cyan-200 ring-1 ring-cyan-400/35 hover:bg-cyan-400/30"
            >
              <Play className="h-3 w-3" /> Start {data.suggestedFocusMinutes}m Focus
            </button>
          ) : null}
        </div>
      </div>

      {data.metrics && data.metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {data.metrics.map((m, idx) => (
            <div key={idx} className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-center">
              <p className="text-[9.5px] uppercase tracking-wider text-white/55">{m.label}</p>
              <p className="mt-0.5 text-xs font-bold text-cyan-200">{m.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-white/85">
        <ScholarAIContent content={data.markdown} mode="compact" />
      </div>
    </div>
  );
}
