"use client";

import { useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileText,
  HelpCircle,
  Layers,
  Lightbulb,
  Lock,
  Presentation,
  RefreshCw,
  RotateCw,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import type {
  LamPluginExecution,
  LamPluginFlashcard,
  LamPluginFormula,
  LamPluginQuizQuestion,
  LamPluginSlide,
} from "@/lib/lam/types";
import { openScholarPlus } from "@/lib/subscriptions/promo";
import { useStore } from "@/lib/store";
import { toast } from "@/lib/notifications/notification-api";
import { navigateTo } from "@/lib/nav-event";

export function InChatPluginWidget({ execution }: { execution: LamPluginExecution }) {
  if (execution.status === "locked") {
    return <ScholarPlusShowcaseCard execution={execution} />;
  }

  switch (execution.outputType) {
    case "quiz":
      return execution.quiz && execution.quiz.length > 0 ? (
        <InChatQuizWidget questions={execution.quiz} pluginName={execution.pluginName} />
      ) : null;
    case "flashcards":
      return execution.flashcards && execution.flashcards.length > 0 ? (
        <InChatFlashcardWidget flashcards={execution.flashcards} pluginName={execution.pluginName} />
      ) : null;
    case "slideshow":
      return execution.slides && execution.slides.length > 0 ? (
        <InChatSlideshowWidget slides={execution.slides} pluginName={execution.pluginName} />
      ) : null;
    case "formula-sheet":
      return execution.formulas && execution.formulas.length > 0 ? (
        <InChatFormulaWidget formulas={execution.formulas} pluginName={execution.pluginName} />
      ) : null;
    case "pdf":
      return execution.pdfData ? (
        <InChatPdfWidget pdfData={execution.pdfData} pluginName={execution.pluginName} />
      ) : null;
    case "explainer":
      return execution.explainerData ? (
        <InChatExplainerWidget data={execution.explainerData} pluginName={execution.pluginName} />
      ) : null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// 1. Scholar Plus Showcase Card (for Premium Plugins)
// ---------------------------------------------------------------------------
function ScholarPlusShowcaseCard({ execution }: { execution: LamPluginExecution }) {
  return (
    <div className="mt-3 rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 via-black/40 to-indigo-950/20 p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 border-b border-amber-400/20 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-400/20 text-amber-300">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-300">
                SCHOLAR PLUS
              </span>
              <h4 className="text-sm font-semibold text-white">{execution.pluginName}</h4>
            </div>
            <p className="text-xs text-white/60">Advanced AI generation tool</p>
          </div>
        </div>
        <Lock className="h-4 w-4 text-amber-300/80" />
      </div>

      <div className="py-4 text-xs leading-relaxed text-white/80">
        <p>
          This plugin generates comprehensive study materials, auto-evaluates responses, and creates
          exportable decks. Unlock Scholar Plus for unlimited in-chat AI executions.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={() => openScholarPlus({ source: "lam-ai", feature: execution.pluginId })}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2 text-xs font-bold text-black shadow-lg transition hover:brightness-110 active:scale-95"
        >
          <Sparkles className="h-3.5 w-3.5 fill-black" />
          Unlock with Scholar Plus
        </button>
        <span className="text-[11px] text-white/40">Included with all Scholar Plus plans</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Interactive In-Chat Quiz Widget
// ---------------------------------------------------------------------------
function InChatQuizWidget({
  questions,
  pluginName,
}: {
  questions: LamPluginQuizQuestion[];
  pluginName: string;
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Record<number, string>>({});
  const addXP = useStore((s) => s.addXP);

  const current = questions[index];
  const chosen = selected[index];
  const isAnswered = chosen !== undefined;
  const isCorrect = isAnswered && chosen === current.answer;

  const score = Object.entries(selected).filter(
    ([idx, ans]) => ans === questions[Number(idx)]?.answer,
  ).length;

  const handleSelect = (option: string) => {
    if (isAnswered) return;
    const next = { ...selected, [index]: option };
    setSelected(next);
    if (option === current.answer) {
      addXP(10);
      toast.success("+10 XP", { description: "Correct answer!" });
    }
  };

  return (
    <div className="mt-3 rounded-2xl border border-cyan-400/20 bg-slate-950/80 p-4 shadow-xl backdrop-blur-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-cyan-400/15 text-cyan-300">
            <HelpCircle className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs font-semibold text-white">{pluginName}</span>
          <span className="text-[10px] text-cyan-200/70">
            Question {index + 1} of {questions.length}
          </span>
        </div>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/80">
          Score: {score}/{Object.keys(selected).length}
        </span>
      </div>

      {/* Question prompt */}
      <div className="py-3">
        <p className="text-sm font-medium leading-snug text-white">{current.question}</p>
      </div>

      {/* Options */}
      <div className="grid gap-2">
        {current.options.map((opt, optIdx) => {
          const letter = String.fromCharCode(65 + optIdx);
          let btnStyle = "border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-white";

          if (isAnswered) {
            if (opt === current.answer) {
              btnStyle = "border-emerald-500/50 bg-emerald-500/20 text-emerald-100 font-semibold";
            } else if (opt === chosen) {
              btnStyle = "border-rose-500/50 bg-rose-500/20 text-rose-100";
            } else {
              btnStyle = "border-white/5 bg-white/[0.02] opacity-50 text-white/50";
            }
          }

          return (
            <button
              key={opt}
              disabled={isAnswered}
              onClick={() => handleSelect(opt)}
              className={`flex items-center justify-between rounded-xl border p-2.5 text-left text-xs transition-all ${btnStyle}`}
            >
              <div className="flex items-center gap-2.5">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-white/10 text-[10px] font-bold">
                  {letter}
                </span>
                <span>{opt}</span>
              </div>
              {isAnswered && opt === current.answer ? (
                <Check className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : isAnswered && opt === chosen ? (
                <X className="h-4 w-4 shrink-0 text-rose-400" />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Feedback & Explanation */}
      {isAnswered && (
        <div
          className={`mt-3 rounded-xl border p-3 text-xs leading-relaxed ${
            isCorrect
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-rose-500/30 bg-rose-500/10 text-rose-200"
          }`}
        >
          <div className="flex items-center gap-1.5 font-semibold">
            {isCorrect ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Correct!
              </>
            ) : (
              <>
                <XCircle className="h-3.5 w-3.5 text-rose-400" /> Incorrect
              </>
            )}
          </div>
          <p className="mt-1 text-white/80">{current.explanation}</p>
        </div>
      )}

      {/* Controls */}
      <div className="mt-3.5 flex items-center justify-between border-t border-white/10 pt-2.5">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => setIndex((i) => i - 1)}
          className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white disabled:opacity-30"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Previous
        </button>

        <div className="flex gap-1">
          {questions.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${
                i === index
                  ? "w-4 bg-cyan-400"
                  : selected[i] !== undefined
                    ? selected[i] === questions[i].answer
                      ? "bg-emerald-400"
                      : "bg-rose-400"
                    : "bg-white/20"
              }`}
            />
          ))}
        </div>

        {index < questions.length - 1 ? (
          <button
            type="button"
            onClick={() => setIndex((i) => i + 1)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setSelected({})}
            className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Interactive In-Chat Flashcard Deck Widget
// ---------------------------------------------------------------------------
function InChatFlashcardWidget({
  flashcards,
  pluginName,
}: {
  flashcards: LamPluginFlashcard[];
  pluginName: string;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const addFlashcard = useStore((s) => s.addFlashcard);
  const current = flashcards[index];

  const handleSaveToDeck = () => {
    addFlashcard({
      id: crypto.randomUUID(),
      front: current.front,
      back: current.back,
      deckId: "default",
      box: 1,
      lastReviewed: Date.now(),
      ease: 2.5,
    });
    toast.success("Saved to Flashcards Deck!", { description: current.front });
  };

  return (
    <div className="mt-3 rounded-2xl border border-indigo-400/20 bg-slate-950/80 p-4 shadow-xl backdrop-blur-2xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-indigo-400/15 text-indigo-300">
            <Layers className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs font-semibold text-white">{pluginName}</span>
        </div>
        <span className="text-xs font-medium text-white/60">
          Card {index + 1} of {flashcards.length}
        </span>
      </div>

      {/* Card Body */}
      <div
        onClick={() => setFlipped((f) => !f)}
        className="group relative my-3 min-h-[160px] cursor-pointer rounded-xl border border-white/15 bg-white/[0.04] p-5 shadow-lg transition-all hover:border-indigo-400/40 hover:bg-white/[0.06]"
      >
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider text-indigo-300/70 group-hover:text-indigo-300">
          <RotateCw className="h-3 w-3" /> {flipped ? "REVERSE" : "CLICK TO FLIP"}
        </span>

        <div className="flex min-h-[110px] flex-col justify-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
            {flipped ? "Official Answer / Definition" : "Prompt / Question"}
          </span>
          <p className="mt-2 text-sm font-medium leading-relaxed text-white">
            {flipped ? current.back : current.front}
          </p>
          {flipped && current.tip && (
            <p className="mt-3 border-t border-white/10 pt-2 text-[11px] italic text-amber-300/80">
              💡 Tip: {current.tip}
            </p>
          )}
        </div>
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between border-t border-white/10 pt-2.5 text-xs">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => {
            setIndex((i) => i - 1);
            setFlipped(false);
          }}
          className="inline-flex items-center gap-1 text-white/60 hover:text-white disabled:opacity-30"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Previous
        </button>

        <button
          type="button"
          onClick={handleSaveToDeck}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1 font-medium text-white hover:bg-white/[0.12]"
        >
          Save to Deck
        </button>

        <button
          type="button"
          disabled={index === flashcards.length - 1}
          onClick={() => {
            setIndex((i) => i + 1);
            setFlipped(false);
          }}
          className="inline-flex items-center gap-1 font-semibold text-indigo-300 hover:text-indigo-200 disabled:opacity-30"
        >
          Next <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Interactive In-Chat Slideshow Deck Widget
// ---------------------------------------------------------------------------
function InChatSlideshowWidget({
  slides,
  pluginName,
}: {
  slides: LamPluginSlide[];
  pluginName: string;
}) {
  const [index, setIndex] = useState(0);
  const current = slides[index];

  return (
    <div className="mt-3 rounded-2xl border border-violet-400/20 bg-slate-950/80 p-4 shadow-xl backdrop-blur-2xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-violet-400/15 text-violet-300">
            <Presentation className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs font-semibold text-white">{pluginName}</span>
        </div>
        <span className="text-xs font-medium text-white/60">
          Slide {index + 1} of {slides.length}
        </span>
      </div>

      {/* Slide Canvas */}
      <div className="my-3 min-h-[170px] rounded-xl border border-white/10 bg-gradient-to-br from-violet-950/30 to-black/40 p-4 shadow-inner">
        <h4 className="text-base font-bold text-white">{current.title}</h4>
        <ul className="mt-3 space-y-1.5 pl-4 text-xs text-white/85">
          {current.bullets.map((b, i) => (
            <li key={i} className="list-disc leading-relaxed">
              {b}
            </li>
          ))}
        </ul>
        {current.takeaway && (
          <div className="mt-3.5 rounded-lg border border-violet-400/20 bg-violet-400/10 p-2 text-xs text-violet-200">
            <strong>Key Takeaway:</strong> {current.takeaway}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between border-t border-white/10 pt-2.5 text-xs">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => setIndex((i) => i - 1)}
          className="inline-flex items-center gap-1 text-white/60 hover:text-white disabled:opacity-30"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Prev Slide
        </button>

        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all ${
                i === index ? "w-5 bg-violet-400" : "w-2 bg-white/20"
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          disabled={index === slides.length - 1}
          onClick={() => setIndex((i) => i + 1)}
          className="inline-flex items-center gap-1 font-semibold text-violet-300 hover:text-violet-200 disabled:opacity-30"
        >
          Next Slide <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Interactive In-Chat Formula Sheet Widget
// ---------------------------------------------------------------------------
function InChatFormulaWidget({
  formulas,
  pluginName,
}: {
  formulas: LamPluginFormula[];
  pluginName: string;
}) {
  const [copied, setCopied] = useState<number | null>(null);

  const copyFormula = (text: string, i: number) => {
    void navigator.clipboard.writeText(text);
    setCopied(i);
    setTimeout(() => setCopied(null), 2000);
    toast.success("Formula copied to clipboard!");
  };

  return (
    <div className="mt-3 rounded-2xl border border-emerald-400/20 bg-slate-950/80 p-4 shadow-xl backdrop-blur-2xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-400/15 text-emerald-300">
            <FileText className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs font-semibold text-white">{pluginName}</span>
        </div>
        <span className="text-xs text-white/50">{formulas.length} formulas</span>
      </div>

      <div className="my-3 grid gap-2.5">
        {formulas.map((f, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3 transition hover:bg-white/[0.06]"
          >
            <div>
              <p className="text-xs font-semibold text-emerald-300">{f.name}</p>
              <p className="mt-1 font-mono text-sm font-bold text-white">{f.formula}</p>
              <p className="mt-1 text-[11px] text-white/60">
                Units: <span className="text-white/80">{f.units}</span>
                {f.condition && (
                  <span className="ml-2 border-l border-white/10 pl-2 text-white/50">
                    {f.condition}
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => copyFormula(f.formula, i)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
            >
              {copied === i ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. Interactive In-Chat PDF / Study Sheet Widget
// ---------------------------------------------------------------------------
function InChatPdfWidget({
  pdfData,
  pluginName,
}: {
  pdfData: { title: string; subtitle: string; sections: Array<{ heading: string; body: string }> };
  pluginName: string;
}) {
  const downloadText = () => {
    const content = `# ${pdfData.title}\n${pdfData.subtitle}\n\n` +
      pdfData.sections.map((s) => `## ${s.heading}\n${s.body}\n`).join("\n");
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pdfData.title.toLowerCase().replace(/\s+/g, "-")}-scholar-notes.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded study sheet notes!");
  };

  return (
    <div className="mt-3 rounded-2xl border border-cyan-400/20 bg-slate-950/80 p-4 shadow-xl backdrop-blur-2xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-cyan-400/15 text-cyan-300">
            <Download className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs font-semibold text-white">{pluginName}</span>
        </div>
        <button
          type="button"
          onClick={downloadText}
          className="inline-flex items-center gap-1 rounded-lg bg-cyan-400/20 px-2.5 py-1 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/30"
        >
          <Download className="h-3 w-3" /> Export
        </button>
      </div>

      <div className="my-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs">
        <h4 className="text-sm font-bold text-white">{pdfData.title}</h4>
        <p className="mt-0.5 text-white/50">{pdfData.subtitle}</p>
        <div className="mt-3 space-y-3">
          {pdfData.sections.map((s, i) => (
            <div key={i} className="border-t border-white/5 pt-2">
              <strong className="text-cyan-300">{s.heading}</strong>
              <p className="mt-1 leading-relaxed text-white/80">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7. Interactive In-Chat Concept Explainer Widget
// ---------------------------------------------------------------------------
function InChatExplainerWidget({
  data,
  pluginName,
}: {
  data: { concept: string; intuition: string; definition: string; derivation?: string; mistakes: string[] };
  pluginName: string;
}) {
  return (
    <div className="mt-3 rounded-2xl border border-sky-400/20 bg-slate-950/80 p-4 shadow-xl backdrop-blur-2xl">
      <div className="flex items-center gap-2 border-b border-white/10 pb-2.5">
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-sky-400/15 text-sky-300">
          <Lightbulb className="h-3.5 w-3.5" />
        </span>
        <div>
          <span className="text-xs font-semibold text-white">{pluginName}</span>
          <p className="text-[11px] text-sky-200/70">{data.concept}</p>
        </div>
      </div>

      <div className="my-3 space-y-2.5 text-xs">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">💡 Intuitive Analogy</span>
          <p className="mt-1 leading-relaxed text-white/90">{data.intuition}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">🎯 Official CBSE Definition</span>
          <p className="mt-1 leading-relaxed text-white/90">{data.definition}</p>
        </div>

        {data.derivation && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">📐 Mathematical Derivation</span>
            <p className="mt-1 font-mono leading-relaxed text-white/90">{data.derivation}</p>
          </div>
        )}

        {data.mistakes?.length > 0 && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300">⚠️ Common Exam Pitfalls</span>
            <ul className="mt-1 space-y-1 pl-4 text-white/80">
              {data.mistakes.map((m, i) => (
                <li key={i} className="list-disc leading-relaxed">
                  {m}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
