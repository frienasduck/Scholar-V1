"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/lib/store";
import { askAI } from "@/lib/ai";
import { sanitizeHtml } from "@/lib/utils";
import { ALL_PRACTICE_QUESTIONS, ALL_PHYSICS_QUESTIONS, PHYSICS_CHAPTER_QUESTIONS, isReviewNeeded, type PracticeQuestion } from "@/lib/question-bank";
import { PdfImportReview } from "@/components/views/pdf-import-review";
import { toast } from "sonner";
import {
  Check, X, Eye, EyeOff, Sparkles, Loader2, Clock, Award, TrendingUp,
  ListChecks, ArrowLeft, ArrowRight, Filter, Atom, FlaskConical, Calculator, Code2, ChevronRight, PenLine, Scan,
} from "lucide-react";

const AURA_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
.aura-glass { background: rgba(255,255,255,0.01); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); border: none; box-shadow: inset 0 1px 1px rgba(255,255,255,0.1); position: relative; overflow: hidden; }
.aura-glass::before { content: ''; position: absolute; inset: 0; border-radius: inherit; padding: 1.4px; background: linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 20%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.15) 80%, rgba(255,255,255,0.45) 100%); -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none; }
.aura-glass-card { background: rgba(14,16,20,0.9); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; }
.aura-font { font-family: 'Inter', system-ui, sans-serif; }
.aura-chapter-hover { transition: transform .2s ease, background .2s ease; }
.aura-chapter-hover:hover { transform: translateY(-2px); background: rgba(255,255,255,0.04) !important; }
@keyframes shiny { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
.animate-shiny { animation: shiny 6s linear infinite; }
.line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
`;

type SubjectTab = "physics" | "chemistry" | "maths" | "cs";

const SUBJECT_META: Record<SubjectTab, { name: string; icon: any; accent: string }> = {
  physics:   { name: "Physics",         icon: Atom,          accent: "#3b82f6" },
  chemistry: { name: "Chemistry",       icon: FlaskConical,  accent: "#10b981" },
  maths:     { name: "Mathematics",     icon: Calculator,    accent: "#6366f1" },
  cs:        { name: "Computer Science", icon: Code2,        accent: "#a855f7" },
};

const PHYSICS_CHAPTERS = [
  // Use merged list (hand-written + PDF-imported, deduped) so chapter cards
  // show every available question. Skip "Review needed" / empty-answer OCR
  // artifacts — those only appear in PDF Import Review mode.
  { id: "ch1", title: "Units and Measurement", questions: PHYSICS_CHAPTER_QUESTIONS.filter(q => q.chapter === "Units and Measurement" && !isReviewNeeded(q)), soon: false },
  { id: "ch2", title: "Motion in a Straight Line", questions: PHYSICS_CHAPTER_QUESTIONS.filter(q => q.chapter === "Motion in a Straight Line" && !isReviewNeeded(q)), soon: false },
  { id: "ch3", title: "Motion in a Plane", questions: PHYSICS_CHAPTER_QUESTIONS.filter(q => q.chapter === "Motion in a Plane" && !isReviewNeeded(q)), soon: false },
];

const MATHS_CHAPTERS = [
  { id: "m1", title: "Sets", questions: ALL_PRACTICE_QUESTIONS.filter(q => q.chapter === "Sets"), soon: false },
  { id: "m2", title: "Relations and Functions", questions: ALL_PRACTICE_QUESTIONS.filter(q => q.chapter === "Relations and Functions"), soon: false },
  { id: "m3", title: "Trigonometric Functions", questions: [], soon: true },
];

export function PracticeView() {
  const scholarClass = useStore((s) => s.user.scholarClass);
  const [activeSubject, setActiveSubject] = useState<SubjectTab>("maths");
  const [activeChapter, setActiveChapter] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "mcq" | "subjective">("all");
  const [showPdfReview, setShowPdfReview] = useState(false);
  const addXP = useStore((s) => s.addXP);
  const pushActivity = useStore((s) => s.pushActivity);

  if (scholarClass !== 11) {
    return (
      <div className="min-h-[60vh] grid place-items-center p-8">
        <div className="text-center space-y-3">
          <ListChecks className="h-12 w-12 mx-auto text-white/20" />
          <p className="text-white/60 font-medium">Question Practice is available for Class 11 only</p>
          <p className="text-sm text-white/40">Switch to Class 11 from Settings to access this section.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-[#0c0c0c] overflow-hidden -m-4 lg:-m-6 text-white aura-font">
      <style>{AURA_STYLE}</style>
      <div className="fixed inset-0 z-0 pointer-events-none">
        <video autoPlay loop muted playsInline className="w-full h-full object-cover pointer-events-none"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_064122_c4750c0e-7476-4b44-94a2-a85a65c63bf2.mp4" />
      </div>
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <motion.nav initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center h-9 w-9 rounded-xl bg-white/5 border border-white/10">
              <ListChecks className="h-5 w-5 text-white" />
            </div>
            <span className="text-white font-semibold text-lg">Question Practice</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPdfReview(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-200 hover:bg-violet-500/25 transition-colors"
              title="Review and edit PDF-imported Physics questions"
            >
              <Scan className="h-3.5 w-3.5" /> PDF Import Review
            </button>
            <div className="aura-glass rounded-full px-3 py-1.5 text-xs text-white/60 flex items-center gap-1.5">
              <ListChecks className="h-3.5 w-3.5 text-white/70" />
              <span className="text-white font-semibold">{ALL_PRACTICE_QUESTIONS.length + ALL_PHYSICS_QUESTIONS.length}</span> questions
            </div>
          </div>
        </motion.nav>

        <div className="mt-8 mb-8">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-1.5 aura-glass rounded-full px-3 py-1 text-xs text-white/50 mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            CHAPTER-WISE PROBLEM PRACTICE · CBSE CLASS 11 PHYSICS
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-white">
            Practice{" "}
            <span className="animate-shiny" style={{ backgroundImage: "linear-gradient(to right, #091020 0%, #0B2551 12.5%, #A4F4FD 32.5%, #00d2ff 50%, #0B2551 67.5%, #091020 87.5%, #091020 100%)", backgroundSize: "200% auto", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", WebkitTextFillColor: "transparent" }}>
              Questions
            </span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-4 text-white/60 max-w-md text-sm leading-relaxed">
            Chapter-wise MCQs, numericals, and subjective questions with answers, explanations, and AI-powered help.
          </motion.p>
        </div>

        {/* Subject Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {(Object.keys(SUBJECT_META) as SubjectTab[]).map((s) => {
            const meta = SUBJECT_META[s];
            const Icon = meta.icon;
            const isActive = activeSubject === s;
            return (
              <button key={s} onClick={() => { setActiveSubject(s); setActiveChapter(null); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${isActive ? "text-white" : "text-white/50 hover:text-white"}`}
                style={isActive ? { background: `${meta.accent}20`, border: `1px solid ${meta.accent}40` } : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <Icon className="h-4 w-4" style={{ color: meta.accent }} />
                {meta.name}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {activeSubject === "physics" && !activeChapter && (
            <motion.div key="phys-list" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-3">
              <p className="text-sm text-white/50 mb-4">Select a chapter to start practicing:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PHYSICS_CHAPTERS.map((ch, i) => (
                  <motion.div key={ch.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                    className={`aura-glass aura-chapter-hover rounded-xl p-4 ${ch.soon ? "opacity-50" : "cursor-pointer"}`}
                    onClick={() => !ch.soon && setActiveChapter(ch.id)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-blue-400 font-medium mb-1">Chapter {i + 1}</p>
                        <h3 className="text-sm font-semibold text-white leading-snug">{ch.title}</h3>
                        {!ch.soon && (
                          <div className="flex items-center gap-3 mt-2 text-[11px] text-white/40">
                            <span className="flex items-center gap-1"><ListChecks className="h-3 w-3" /> {ch.questions.length} Qs</span>
                            <span className="flex items-center gap-1"><Check className="h-3 w-3" /> {ch.questions.filter(q => q.type === "mcq").length} MCQ</span>
                            <span className="flex items-center gap-1"><PenLine className="h-3 w-3" /> {ch.questions.filter(q => q.type === "subjective").length} Subjective</span>
                          </div>
                        )}
                        {ch.soon && <p className="text-[11px] text-amber-400/60 mt-2 flex items-center gap-1"><Clock className="h-3 w-3" /> Coming Soon</p>}
                      </div>
                      {!ch.soon && <ChevronRight className="h-5 w-5 text-white/30 shrink-0 mt-1" />}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
          {activeSubject === "maths" && !activeChapter && (
            <motion.div key="maths-list" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-3">
              <p className="text-sm text-white/50 mb-4">Select a chapter to start practicing:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {MATHS_CHAPTERS.map((ch, i) => (
                  <motion.div key={ch.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                    className={`aura-glass aura-chapter-hover rounded-xl p-4 ${ch.soon ? "opacity-50" : "cursor-pointer"}`}
                    onClick={() => !ch.soon && setActiveChapter(ch.id)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-indigo-400 font-medium mb-1">Chapter {i + 1}</p>
                        <h3 className="text-sm font-semibold text-white leading-snug">{ch.title}</h3>
                        {!ch.soon && (
                          <div className="flex items-center gap-3 mt-2 text-[11px] text-white/40">
                            <span className="flex items-center gap-1"><ListChecks className="h-3 w-3" /> {ch.questions.length} Qs</span>
                            <span className="flex items-center gap-1"><Check className="h-3 w-3" /> {ch.questions.filter(q => q.type === "mcq").length} MCQ</span>
                            <span className="flex items-center gap-1"><PenLine className="h-3 w-3" /> {ch.questions.filter(q => q.type === "subjective").length} Subjective</span>
                          </div>
                        )}
                        {ch.soon && <p className="text-[11px] text-amber-400/60 mt-2 flex items-center gap-1"><Clock className="h-3 w-3" /> Coming Soon</p>}
                      </div>
                      {!ch.soon && <ChevronRight className="h-5 w-5 text-white/30 shrink-0 mt-1" />}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
          {(activeSubject === "physics" || activeSubject === "maths") && activeChapter && (
            <QuestionList key="q-list" subject={activeSubject} chapterId={activeChapter} onBack={() => setActiveChapter(null)} filter={filter} setFilter={setFilter} addXP={addXP} pushActivity={pushActivity} />
          )}
          {activeSubject !== "physics" && activeSubject !== "maths" && (
            <motion.div key={`soon-${activeSubject}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="aura-glass rounded-2xl p-12 text-center">
              <div className="grid place-items-center h-16 w-16 mx-auto rounded-2xl mb-4" style={{ background: `${SUBJECT_META[activeSubject].accent}15` }}>
                {(() => { const Icon = SUBJECT_META[activeSubject].icon; return <Icon className="h-8 w-8" style={{ color: SUBJECT_META[activeSubject].accent }} />; })()}
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">{SUBJECT_META[activeSubject].name} — Coming Soon</h2>
              <p className="text-sm text-white/50 max-w-sm mx-auto">We're working on adding chapter-wise practice questions for {SUBJECT_META[activeSubject].name}. Explore the Physics section which has 20 questions with complete solutions.</p>
              <div className="mt-4 inline-flex items-center gap-1.5 text-xs text-amber-400/60 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1"><Clock className="h-3 w-3" /> Under Development</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* PDF Import Review overlay */}
      {showPdfReview && (
        <PdfImportReview onExit={() => setShowPdfReview(false)} />
      )}
    </div>
  );
}

function QuestionList({ subject, chapterId, onBack, filter, setFilter, addXP, pushActivity }: {
  subject: SubjectTab; chapterId: string; onBack: () => void; filter: "all" | "mcq" | "subjective"; setFilter: (f: "all" | "mcq" | "subjective") => void; addXP: (n: number) => void; pushActivity: (a: any) => void;
}) {
  const allQs = useMemo(() => {
    const chapterList = subject === "physics" ? PHYSICS_CHAPTERS : subject === "maths" ? MATHS_CHAPTERS : [];
    const ch = chapterList.find(c => c.id === chapterId);
    let qs = ch?.questions ?? [];
    // Defensive: never surface OCR "Review needed" / empty-answer questions
    // in normal practice — they belong only to PDF Import Review mode.
    qs = qs.filter(q => !isReviewNeeded(q));
    if (filter === "mcq") qs = qs.filter(q => q.type === "mcq");
    if (filter === "subjective") qs = qs.filter(q => q.type === "subjective");
    return qs;
  }, [subject, chapterId, filter]);

  const [answered, setAnswered] = useState<Record<string, "correct" | "wrong">>({});

  const handleAnswer = useCallback((qId: string, correct: boolean) => {
    setAnswered(prev => {
      if (prev[qId]) return prev;
      const next: Record<string, "correct" | "wrong"> = { ...prev, [qId]: correct ? "correct" : "wrong" };
      if (correct) { addXP(2); toast.success("Correct! +2 XP"); }
      else { addXP(1); toast.info("Wrong answer. Read the explanation. +1 XP"); }
      pushActivity({ type: "quiz", text: `Practice: ${correct ? "✓" : "✗"}`, icon: "✏️" });
      return next;
    });
  }, [addXP, pushActivity]);

  const correctCount = Object.values(answered).filter(v => v === "correct").length;
  const totalAnswered = Object.keys(answered).length;
  const chapterList = subject === "physics" ? PHYSICS_CHAPTERS : subject === "maths" ? MATHS_CHAPTERS : [];
  const chapterTitle = chapterList.find(c => c.id === chapterId)?.title ?? "Unknown";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
      <div className="aura-glass rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-white/60 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to Chapters
        </button>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {(["all", "mcq", "subjective"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`text-xs px-3 py-1 rounded-full transition-colors ${filter === f ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : "text-white/50 border border-white/10 hover:text-white"}`}>
                {f === "all" ? "All" : f === "mcq" ? "MCQ" : "Subjective"}
              </button>
            ))}
          </div>
          <div className="aura-glass rounded-full px-3 py-1 text-xs text-white/60 flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-emerald-400" />
            <span className="text-white font-semibold">{correctCount}</span>/{totalAnswered} answered
          </div>
        </div>
      </div>
      <div className="mb-2">
        <h2 className="text-xl font-semibold text-white">{chapterTitle}</h2>
        <p className="text-sm text-white/50">{allQs.length} questions · MCQs + Subjective</p>
      </div>
      <div className="space-y-4">
        {allQs.map((q, i) => (
          <QuestionCard key={q.id} question={q} index={i + 1} isAnswered={!!answered[q.id]} onAnswer={(correct) => handleAnswer(q.id, correct)} />
        ))}
      </div>
    </motion.div>
  );
}

function QuestionCard({ question, index, isAnswered, onAnswer }: { question: PracticeQuestion; index: number; isAnswered: boolean; onAnswer: (correct: boolean) => void; }) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const handleMCQSelect = (optionIndex: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(optionIndex);
    const correct = optionIndex === question.answerIndex;
    setShowAnswer(true);
    onAnswer(correct);
  };

  const handleGetAIExplanation = async () => {
    setAiLoading(true); setAiExplanation(null);
    try {
      const prompt = `Explain this CBSE Class 11 Physics question step by step:\n\nQuestion: ${question.question}\n${question.options ? `Options: ${question.options.map((o, i) => `${String.fromCharCode(65+i)}) ${o}`).join("\n")}` : ""}\nAnswer: ${question.answer}\nExplanation: ${question.explanation}\n\nProvide a detailed, student-friendly explanation with: 1) What concept is being tested, 2) Step-by-step solution, 3) A tip to remember. Under 200 words.`;
      const result = await askAI(prompt, "physics-11");
      setAiExplanation(result);
    } catch { toast.error("AI explanation failed"); }
    finally { setAiLoading(false); }
  };

  const isMCQ = question.type === "mcq";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.02, 0.5) }} className="aura-glass rounded-xl p-5">
      <div className="flex items-start gap-3 mb-3">
        <span className="grid place-items-center h-7 w-7 rounded-lg text-xs font-bold shrink-0 mt-0.5" style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa" }}>{index}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isMCQ ? "bg-blue-500/20 text-blue-300" : "bg-amber-500/20 text-amber-300"}`}>{isMCQ ? "MCQ" : "SUBJECTIVE"}</span>
            {isAnswered && selectedOption === question.answerIndex && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">✓ Correct</span>}
            {isAnswered && selectedOption !== null && selectedOption !== question.answerIndex && <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-medium">✗ Wrong</span>}
          </div>
          <p className="text-sm font-medium text-white/90 leading-relaxed whitespace-pre-wrap">{question.question}</p>
        </div>
      </div>
      {isMCQ && question.options && (
        <div className="grid sm:grid-cols-2 gap-2 ml-10">
          {question.options.map((opt, i) => {
            const isSelected = selectedOption === i;
            const isCorrect = i === question.answerIndex;
            let cls = "border-white/10 bg-white/5 hover:bg-white/10 text-white/70";
            if (selectedOption !== null) {
              if (isCorrect) cls = "border-emerald-500/50 bg-emerald-500/15 text-emerald-300";
              else if (isSelected) cls = "border-rose-500/50 bg-rose-500/15 text-rose-300";
              else cls = "border-white/5 bg-white/[0.02] text-white/40";
            }
            return (
              <button key={i} onClick={() => handleMCQSelect(i)} disabled={selectedOption !== null} className={`text-left text-xs px-3 py-2 rounded-lg border transition-all ${cls}`}>
                <span className="font-mono mr-2 font-bold">{String.fromCharCode(65 + i)}.</span>{opt}
                {selectedOption !== null && isCorrect && <Check className="inline-block h-3.5 w-3.5 ml-1.5" />}
                {selectedOption !== null && isSelected && !isCorrect && <X className="inline-block h-3.5 w-3.5 ml-1.5" />}
              </button>
            );
          })}
        </div>
      )}
      {!isMCQ && (
        <div className="ml-10 mt-3">
          <button onClick={() => setShowAnswer(!showAnswer)} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-colors">
            {showAnswer ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}{showAnswer ? "Hide Answer" : "Show Answer"}
          </button>
        </div>
      )}
      {showAnswer && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="ml-10 mt-3 space-y-3">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <p className="text-[10px] uppercase tracking-wide text-emerald-400 font-semibold mb-1">{isMCQ ? `Answer: ${question.answer}` : "Answer"}</p>
            <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{isMCQ ? question.options?.[question.answerIndex ?? 0] : question.answer}</p>
          </div>
          {question.explanation && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-[10px] uppercase tracking-wide text-white/40 font-semibold mb-1">Explanation</p>
              <p className="text-sm text-white/70 leading-relaxed">{question.explanation}</p>
            </div>
          )}
          <div>
            <button onClick={handleGetAIExplanation} disabled={aiLoading} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300 hover:bg-violet-500/20 transition-colors">
              {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{aiLoading ? "AI explaining…" : "Get AI Explanation"}
            </button>
            {aiExplanation && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-2 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
                <p className="text-[10px] uppercase tracking-wide text-violet-400 font-semibold mb-1.5 flex items-center gap-1.5"><Sparkles className="h-3 w-3" /> AI Explanation</p>
                <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: sanitizeHtml(aiExplanation.replace(/\n/g, "<br>")) }} />
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default PracticeView;
