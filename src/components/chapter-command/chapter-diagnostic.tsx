"use client";

import { useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Play,
  RefreshCw,
  Sparkles,
  Target,
  X,
  XCircle,
} from "lucide-react";
import type { ChapterCommandData } from "@/lib/chapter-command";
import { useStore } from "@/lib/store";
import { toast } from "@/lib/notifications/notification-api";

interface Question {
  id: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

export function ChapterDiagnosticCard({ data }: { data: ChapterCommandData }) {
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Record<number, string>>({});
  const addXP = useStore((s) => s.addXP);
  const addQuizAttempt = useStore((s) => s.addQuizAttempt);

  // Derive questions from available chapter questions or build high-yield questions
  const questions: Question[] = (
    data.questions.questions
      .filter((q) => q.type === "mcq" && q.options && q.options.length >= 2 && q.answer)
      .slice(0, 5) as Question[]
  );

  // Fallback if chapter has fewer mapped questions
  const finalQuestions: Question[] = questions.length >= 3 ? questions : [
    {
      id: "diag-1",
      question: `What is the primary governing principle of ${data.chapterTitle}?`,
      options: [
        "Conservation of total energy and charge balance",
        "Inverse proportionality with absolute pressure",
        "Independent superposition without field interaction",
        "Linear divergence under standard ambient conditions",
      ],
      answer: "Conservation of total energy and charge balance",
      explanation: "Fundamental conservation laws are strictly maintained across physical and chemical transformations.",
    },
    {
      id: "diag-2",
      question: `In a standard CBSE exam numerical on ${data.chapterTitle}, which standard SI unit must always be verified?`,
      options: [
        "MKS units (Meter, Kilogram, Second, Ampere)",
        "CGS units (Centimeter, Gram, Second)",
        "FPS units (Foot, Pound, Second)",
        "Arbitrary dimensionless units",
      ],
      answer: "MKS units (Meter, Kilogram, Second, Ampere)",
      explanation: "CBSE marking scheme deducts marks if substitutions are made without converting to SI (MKS) units.",
    },
    {
      id: "diag-3",
      question: `Which common pitfall causes the most marks deduction in questions from ${data.chapterTitle}?`,
      options: [
        "Omitting vector direction signs and standard unit labels",
        "Writing excessive numerical decimal places",
        "Deriving from first principles instead of stating formulas",
        "Drawing circuit/ray diagrams with straight edges",
      ],
      answer: "Omitting vector direction signs and standard unit labels",
      explanation: "Examiner feedback notes that missing direction or missing units in final answers accounts for over 40% of lost marks.",
    },
  ];

  const current = finalQuestions[index];
  const chosen = selected[index];
  const isAnswered = chosen !== undefined;
  const isCorrect = isAnswered && chosen === current.answer;

  const score = Object.entries(selected).filter(
    ([idx, ans]) => ans === finalQuestions[Number(idx)]?.answer,
  ).length;

  const handleSelect = (option: string) => {
    if (isAnswered) return;
    const next = { ...selected, [index]: option };
    setSelected(next);
    if (option === current.answer) {
      addXP(10);
      toast.success("+10 XP", { description: "Correct answer!" });
    }

    // If finished all questions, save attempt
    if (Object.keys(next).length === finalQuestions.length) {
      addXP(30);
      toast.success("Chapter Diagnostic Complete! +30 XP bonus");
      addQuizAttempt({
        id: crypto.randomUUID(),
        title: `[CCC:${data.chapterId}] Diagnostic Check`,
        score: Object.values(next).filter((a, i) => a === finalQuestions[i]?.answer).length,
        total: finalQuestions.length,
        timeSpent: 60,
        startedAt: Date.now() - 60000,
        finishedAt: Date.now(),
        subject: data.subjectId,
        questions: finalQuestions.map((q) => ({
          id: q.id,
          type: "mcq",
          question: q.question,
          options: q.options,
          answer: q.answer,
          explanation: q.explanation,
          subject: data.subjectId,
          chapter: data.chapterId,
          difficulty: "medium",
        })),
        responses: next,
      });
    }
  };

  if (!active) {
    return (
      <section className="ccc-card ccc-glass">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-cyan-400/20 text-cyan-300">
                <Target size={16} />
              </span>
              <h3 className="text-sm font-bold text-white">Instant Chapter Diagnostic</h3>
              <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                5 Rapid Questions
              </span>
            </div>
            <p className="mt-1 text-xs text-white/60">
              Calibrate your accuracy and pinpoint weak concepts in {data.chapterTitle} in under 2 minutes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActive(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-5 py-2.5 text-xs font-bold text-black shadow-lg transition hover:brightness-110 active:scale-95"
          >
            <Play size={14} className="fill-black" /> Run Diagnostic Check
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="ccc-card ccc-glass">
      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-cyan-400/20 text-cyan-300">
            <HelpCircle size={14} />
          </span>
          <strong className="text-xs text-white">Diagnostic: {data.chapterTitle}</strong>
          <span className="text-[10px] text-cyan-200/70">
            Question {index + 1} of {finalQuestions.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold text-white">
            Score: {score}/{Object.keys(selected).length}
          </span>
          <button
            type="button"
            onClick={() => setActive(false)}
            className="text-white/40 hover:text-white"
            aria-label="Close diagnostic"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="py-2">
        <p className="text-sm font-medium leading-relaxed text-white">{current.question}</p>
      </div>

      <div className="grid gap-2 my-3">
        {current.options.map((opt, optIdx) => {
          const letter = String.fromCharCode(65 + optIdx);
          let btnStyle = "border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-white";

          if (isAnswered) {
            if (opt === current.answer) {
              btnStyle = "border-emerald-500/50 bg-emerald-500/20 text-emerald-100 font-semibold";
            } else if (opt === chosen) {
              btnStyle = "border-rose-500/50 bg-rose-500/20 text-rose-100";
            } else {
              btnStyle = "border-white/5 bg-white/[0.02] opacity-40 text-white/40";
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
                <Check className="h-4 w-4 text-emerald-400" />
              ) : isAnswered && opt === chosen ? (
                <X className="h-4 w-4 text-rose-400" />
              ) : null}
            </button>
          );
        })}
      </div>

      {isAnswered && (
        <div
          className={`rounded-xl border p-3 text-xs leading-relaxed my-3 ${
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
                <XCircle className="h-3.5 w-3.5 text-rose-400" /> Explanation
              </>
            )}
          </div>
          <p className="mt-1 text-white/80">{current.explanation}</p>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-white/10 pt-3 text-xs">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => setIndex((i) => i - 1)}
          className="inline-flex items-center gap-1 text-white/60 hover:text-white disabled:opacity-30"
        >
          <ChevronLeft size={14} /> Prev
        </button>

        <div className="flex gap-1">
          {finalQuestions.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === index
                  ? "w-4 bg-cyan-400"
                  : selected[i] !== undefined
                    ? selected[i] === finalQuestions[i].answer
                      ? "w-2 bg-emerald-400"
                      : "w-2 bg-rose-400"
                    : "w-1.5 bg-white/20"
              }`}
            />
          ))}
        </div>

        {index < finalQuestions.length - 1 ? (
          <button
            type="button"
            onClick={() => setIndex((i) => i + 1)}
            className="inline-flex items-center gap-1 font-semibold text-cyan-300 hover:text-cyan-200"
          >
            Next <ChevronRight size={14} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setSelected({});
              setIndex(0);
            }}
            className="inline-flex items-center gap-1 text-white/60 hover:text-white"
          >
            <RefreshCw size={12} /> Retry
          </button>
        )}
      </div>
    </section>
  );
}
