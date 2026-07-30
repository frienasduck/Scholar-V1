"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { askAIJSON } from "@/lib/ai";
import { useStore } from "@/lib/store";
import { useCurriculum } from "@/lib/use-curriculum";
import { PHYSICS_PAST_PAPERS } from "@/lib/question-bank";
import { exportPDF, mdToHtml } from "@/lib/pdf";
import { profileGetJSON, profileSetJSON } from "@/lib/profile-storage";
import { StatCard, SectionHeader, EmptyState, Pill, Markdown } from "@/lib/shared";
import { ScholarAIContent } from "@/components/ai/scholar-ai-content";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  FileStack, Clock, Trophy, Zap, Target, Filter, Sparkles, CheckCircle2,
  XCircle, AlertCircle, Timer, Brain, Trash2, Download, Play, RefreshCw,
  ChevronRight, BookOpen, Award, Flame, History, ListChecks, X, Eye, EyeOff, Loader2,
} from "lucide-react";

// ============================================================================
// Past Papers & Question Bank — Class 11 Physics
// ============================================================================

interface PPQuestion {
  id: string;
  subject: string;
  subjectName: string;
  chapter: string;
  year: string;
  type: "mcq" | "short" | "long";
  difficulty: "easy" | "medium" | "hard";
  question: string;
  options?: string[];
  answer: string;
  explanation: string;
  marks: number;
  source: string;
}

const SUBJECTS = [
  { id: "physics", name: "Physics", color: "#3b82f6" },
  { id: "chemistry", name: "Chemistry", color: "#10b981" },
  { id: "maths", name: "Mathematics", color: "#6366f1" },
  { id: "cs", name: "Computer Science", color: "#a855f7" },
] as const;

const YEARS = ["2025", "2024", "2023", "2022", "2021"];
const DIFFS = ["easy", "medium", "hard"] as const;
const TYPES = [
  { id: "mcq", name: "MCQ" },
  { id: "short", name: "Short" },
  { id: "long", name: "Long" },
] as const;

const QUESTIONS: PPQuestion[] = PHYSICS_PAST_PAPERS.map(q => ({
  id: q.id,
  subject: "physics",
  subjectName: "Physics",
  chapter: q.number <= 4 ? "Units and Measurement" : "Motion in a Straight Line",
  year: q.year,
  type: q.type === "mcq" ? "mcq" : "short",
  difficulty: q.marks <= 1 ? "easy" : q.marks <= 2 ? "medium" : "hard",
  question: q.question,
  answer: q.answer,
  explanation: q.explanation,
  marks: q.marks,
  source: q.source,
}));

// ============================================================================
// localStorage helpers for Mistake Tracker
// ============================================================================
interface MistakeEntry {
  questionId: string;
  question: string;
  subjectName: string;
  chapter: string;
  yourAnswer: string;
  correctAnswer: string;
  at: number;
}
function loadMistakes(scholarClass: 9 | 11): MistakeEntry[] {
  if (typeof window === "undefined") return [];
  return profileGetJSON<MistakeEntry[]>(scholarClass, "pp-mistakes", []);
}
function saveMistakes(scholarClass: 9 | 11, list: MistakeEntry[]) {
  profileSetJSON(scholarClass, "pp-mistakes", list);
}

// ============================================================================
// Component
// ============================================================================
export function PastPapersView() {
  const addXP = useStore((s) => s.addXP);
  const scholarClass = useStore((s) => s.user.scholarClass);
  const CURRICULUM = useCurriculum();
  const pushActivity = useStore((s) => s.pushActivity);

  // Filter state
  const [board, setBoard] = useState("CBSE");
  const [fSubject, setFSubject] = useState<string>("all");
  const [fChapter, setFChapter] = useState<string>("all");
  const [fDiff, setFDiff] = useState<string>("all");
  const [fYear, setFYear] = useState<string>("all");
  const [fType, setFType] = useState<string>("all");

  // Question Bank interaction
  const [openId, setOpenId] = useState<string | null>(null);
  const [userAnswer, setUserAnswer] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  // Timed Practice
  const [timedOpen, setTimedOpen] = useState(false);
  const [timedActive, setTimedActive] = useState(false);
  const [timedQs, setTimedQs] = useState<PPQuestion[]>([]);
  const [timedIdx, setTimedIdx] = useState(0);
  const [timedResponses, setTimedResponses] = useState<Record<string, string>>({});
  const [timedRemaining, setTimedRemaining] = useState(15 * 60); // 15 min in seconds
  const [timedResult, setTimedResult] = useState<null | {
    correct: number; total: number; xp: number;
  }>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // AI Similar
  const [similarFor, setSimilarFor] = useState<PPQuestion | null>(null);
  const [similarQs, setSimilarQs] = useState<PPQuestion[] | null>(null);
  const [similarLoading, setSimilarLoading] = useState(false);

  // Mistake tracker
  const [mistakes, setMistakes] = useState<MistakeEntry[]>([]);
  useEffect(() => { setMistakes(loadMistakes(scholarClass)); }, [scholarClass]);
  const addMistake = (m: MistakeEntry) => {
    setMistakes((prev) => {
      const next = [m, ...prev.filter((x) => x.questionId !== m.questionId)].slice(0, 50);
      saveMistakes(scholarClass, next);
      return next;
    });
  };
  const removeMistake = (qid: string) => {
    setMistakes((prev) => {
      const next = prev.filter((x) => x.questionId !== qid);
      saveMistakes(scholarClass, next);
      return next;
    });
  };
  const clearMistakes = () => {
    setMistakes([]); saveMistakes(scholarClass, []);
    toast.success("Mistake tracker cleared.");
  };

  // Derived chapter options
  const chapterOptions = useMemo(() => {
    if (fSubject === "all") return [];
    const sub = SUBJECTS.find((s) => s.id === fSubject);
    if (!sub) return [];
    const chaptersInCurriculum = CURRICULUM.find((c) => c.id === fSubject)?.chapters.map((c) => c.title) ?? [];
    const chaptersInQuestions = QUESTIONS.filter((q) => q.subject === fSubject).map((q) => q.chapter);
    return Array.from(new Set([...chaptersInQuestions, ...chaptersInCurriculum])).slice(0, 15);
  }, [fSubject]);

  const filtered = useMemo(() => {
    return QUESTIONS.filter((q) => {
      if (fSubject !== "all" && q.subject !== fSubject) return false;
      if (fChapter !== "all" && q.chapter !== fChapter) return false;
      if (fDiff !== "all" && q.difficulty !== fDiff) return false;
      if (fYear !== "all" && q.year !== fYear) return false;
      if (fType !== "all" && q.type !== fType) return false;
      return true;
    });
  }, [fSubject, fChapter, fDiff, fYear, fType]);

  // Stats
  const totalAttempted = Object.keys(revealed).length;
  const totalCorrect = Object.entries(revealed).filter(([id, ok]) => ok && userAnswer[id]).length;
  const accuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
  const totalMarks = QUESTIONS.reduce((a, q) => a + q.marks, 0);

  // Submit single answer (instant marking)
  const submitAnswer = (q: PPQuestion) => {
    const ans = (userAnswer[q.id] ?? "").trim();
    if (!ans) { toast.error("Enter an answer first."); return; }
    const correct = q.type === "mcq"
      ? ans === q.answer
      : ans.toLowerCase().trim() === q.answer.toLowerCase().trim() ||
        ans.toLowerCase().includes(q.answer.toLowerCase().split(/[\s,;.]/)[0]);
    setRevealed((r) => ({ ...r, [q.id]: correct }));
    if (correct) {
      addXP(5);
      toast.success("Correct! +5 XP", { description: q.chapter });
      pushActivity({ type: "quiz", text: `Answered correctly: ${q.chapter}`, icon: "✅" });
    } else {
      addMistake({
        questionId: q.id, question: q.question, subjectName: q.subjectName,
        chapter: q.chapter, yourAnswer: ans, correctAnswer: q.answer, at: Date.now(),
      });
      toast.error("Not quite — added to Mistake Tracker", { description: "Review the explanation below." });
      pushActivity({ type: "quiz", text: `Mistake logged: ${q.chapter}`, icon: "❌" });
    }
  };

  // Timed Practice: 10 MCQs, 15 min, auto-submit
  const startTimed = () => {
    const mcqs = QUESTIONS.filter((q) => q.type === "mcq");
    const shuffled = [...mcqs].sort(() => Math.random() - 0.5).slice(0, 10);
    setTimedQs(shuffled); setTimedIdx(0); setTimedResponses({});
    setTimedRemaining(15 * 60); setTimedResult(null);
    setTimedActive(true); setTimedOpen(true);
  };
  const endTimed = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    let correct = 0;
    const newMistakes: MistakeEntry[] = [];
    for (const q of timedQs) {
      const ans = timedResponses[q.id] ?? "";
      const ok = ans === q.answer;
      if (ok) correct++;
      else if (ans) newMistakes.push({
        questionId: q.id, question: q.question, subjectName: q.subjectName,
        chapter: q.chapter, yourAnswer: ans, correctAnswer: q.answer, at: Date.now(),
      });
    }
    newMistakes.forEach(addMistake);
    const xp = correct * 5;
    addXP(xp);
    pushActivity({ type: "quiz", text: `Timed Practice: ${correct}/10 correct (+${xp} XP)`, icon: "⏱" });
    setTimedResult({ correct, total: timedQs.length, xp });
    setTimedActive(false);
    if (correct === 10) toast.success("Perfect score! 🎉", { description: `+${xp} XP` });
    else toast.success("Timed practice submitted", { description: `${correct}/10 correct • +${xp} XP` });
  };
  useEffect(() => {
    if (!timedActive) return;
    timerRef.current = setInterval(() => {
      setTimedRemaining((r) => {
        if (r <= 1) { endTimed(); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timedActive, timedQs]);

  // AI Similar Questions
  const generateSimilar = async (q: PPQuestion) => {
    setSimilarFor(q); setSimilarLoading(true); setSimilarQs(null);
    try {
      const prompt = `Given this CBSE Class ${scholarClass} ${q.subjectName} question, generate 3 SIMILAR questions of the same difficulty and type. Topic: ${q.chapter}.
Original question: ${q.question}
Return JSON: {"questions":[{"question":string,"options":[string,string,string,string]|null,"answer":string,"explanation":string,"difficulty":string,"type":string,"marks":number}]}.`;
      const result = await askAIJSON<{ questions: any[] }>(prompt, "default");
      if (!result?.questions?.length) throw new Error("No questions returned");
      const parsed: PPQuestion[] = result.questions.slice(0, 3).map((r, i) => ({
        id: `sim-${q.id}-${i}`,
        subject: q.subject, subjectName: q.subjectName, chapter: q.chapter,
        year: "AI-generated", type: (r.type === "mcq" ? "mcq" : r.type === "long" ? "long" : "short") as PPQuestion["type"], difficulty: (r.difficulty === "easy" || r.difficulty === "medium" || r.difficulty === "hard" ? r.difficulty : q.difficulty) as PPQuestion["difficulty"],
        question: r.question, options: Array.isArray(r.options) ? r.options : undefined, answer: r.answer,
        explanation: r.explanation ?? "AI-generated.", marks: r.marks ?? q.marks,
        source: "AI-generated",
      }));
      setSimilarQs(parsed);
      toast.success("AI generated 3 similar questions.");
    } catch {
      toast.error("Could not generate similar questions.");
    } finally { setSimilarLoading(false); }
  };

  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const exportBank = () => {
    const bodyHtml = mdToHtml(`# Past Papers & Question Bank — CBSE Class ${scholarClass}

Generated on ${new Date().toLocaleString()}.

**Board:** ${board} • **Total Questions:** ${QUESTIONS.length} • **Total Marks:** ${totalMarks}

${QUESTIONS.map((q, i) => `### Q${i + 1}. ${q.question}\n- **Subject:** ${q.subjectName} • **Chapter:** ${q.chapter} • **Year:** ${q.year} • **Marks:** ${q.marks} • **Difficulty:** ${q.difficulty}\n${q.options ? q.options.map((o) => `  - ${o}${o === q.answer ? " ✓" : ""}`).join("\n") : ""}\n- **Answer:** ${q.answer}\n- **Explanation:** ${q.explanation}\n`).join("\n")}

> Generated by Scholar Past Papers module.`);
    exportPDF({ title: "Past Papers & Question Bank", subtitle: `CBSE Class ${scholarClass} • Practice Set`, bodyHtml, accent: "#f59e0b", scholarClass });
    toast.success("Exporting question bank as PDF…");
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&display=swap');
        .pp-font-serif { font-family: 'Instrument Serif', serif; }
        .pp-font-body { font-family: 'Inter', sans-serif; }
        .pp-glass { background: rgba(255,255,255,0.04); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.12); box-shadow: inset 0 1px 1px rgba(255,255,255,0.08); color: white; }
        .pp-glass-strong { background: rgba(255,255,255,0.07); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.16); box-shadow: inset 0 1px 1px rgba(255,255,255,0.1); color: white; }
        .pp-glass input, .pp-glass textarea, .pp-glass select { background: rgba(255,255,255,0.05) !important; border-color: rgba(255,255,255,0.15) !important; color: white !important; }
        .pp-glass input::placeholder, .pp-glass textarea::placeholder { color: rgba(255,255,255,0.4) !important; }
        .pp-glass .text-muted-foreground { color: rgba(255,255,255,0.6) !important; }
        .pp-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .pp-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
      `}</style>

      <video autoPlay muted loop playsInline poster="/backgrounds/scholar-poster.svg" preload="metadata" className="absolute inset-0 w-full h-full object-cover z-0">
        <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_204221_5339e40b-e73d-4ab0-9c65-79c18c66fd50.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 z-0 bg-black/55" />

      <div className="relative z-10 pp-font-body p-4 md:p-8 lg:p-12 max-w-7xl mx-auto">
        {/* HERO */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="grid place-items-center h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-500/30 to-rose-500/30 text-amber-300 border border-white/10">
              <FileStack className="h-6 w-6" />
            </div>
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">CBSE • Class 9</Badge>
          </div>
          <h1 className="pp-font-serif text-5xl md:text-6xl text-white leading-tight">
            Past Papers <em className="text-amber-300">& Question Bank</em>
          </h1>
          <p className="text-white/70 mt-3 max-w-2xl">
            24 hand-curated CBSE questions across Maths, Science, SST & English — with instant marking,
            timed practice, AI-generated similar questions, and a smart mistake tracker.
          </p>
        </motion.div>

        {/* STAT PILLS */}
        <motion.div
          initial="hidden" animate="show" variants={{
            hidden: {}, show: { transition: { staggerChildren: 0.07 } },
          }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8"
        >
          {[
            { icon: FileStack, label: "Total Questions", value: QUESTIONS.length, accent: "#f59e0b" },
            { icon: Trophy, label: "Attempted", value: totalAttempted, accent: "#6366f1" },
            { icon: Target, label: "Accuracy", value: `${accuracy}%`, accent: "#10b981" },
            { icon: Zap, label: "Marks Coverage", value: totalMarks, accent: "#f43f5e" },
          ].map((s, i) => (
            <motion.div key={i} variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
              <StatCard icon={s.icon} label={s.label} value={s.value} accent={s.accent} />
            </motion.div>
          ))}
        </motion.div>

        {/* TABS */}
        <Tabs defaultValue="bank" className="space-y-6">
          <TabsList className="pp-glass bg-transparent h-auto p-1 flex flex-wrap gap-1">
            <TabsTrigger value="bank" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">Question Bank</TabsTrigger>
            <TabsTrigger value="timed" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">Timed Practice</TabsTrigger>
            <TabsTrigger value="mistakes" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">
              Mistake Tracker {mistakes.length > 0 && <span className="ml-1.5 text-xs bg-rose-500/30 text-rose-200 rounded-full px-1.5">{mistakes.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="ai" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">AI Similar</TabsTrigger>
          </TabsList>

          {/* ===== QUESTION BANK ===== */}
          <TabsContent value="bank" className="space-y-6">
            {/* FILTER BAR */}
            <div className="pp-glass rounded-2xl p-4 md:p-5">
              <div className="flex items-center gap-2 mb-3 text-white/80">
                <Filter className="h-4 w-4" />
                <span className="text-sm font-medium">Filters</span>
                <span className="ml-auto text-xs text-white/50">{filtered.length} of {QUESTIONS.length} shown</span>
              </div>
              <div className="space-y-3">
                {/* Board */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-white/50 w-16 shrink-0">Board</span>
                  <Pill active={board === "CBSE"} onClick={() => setBoard("CBSE")} color="#f59e0b">CBSE</Pill>
                  <Pill active={board === "ICSE"} onClick={() => { setBoard("ICSE"); toast("Showing CBSE-aligned ICSE-style questions."); }}>ICSE</Pill>
                  <Pill active={board === "State"} onClick={() => { setBoard("State"); toast("State-board filter applied — content aligned to CBSE."); }}>State Board</Pill>
                </div>
                {/* Subject */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-white/50 w-16 shrink-0">Subject</span>
                  <Pill active={fSubject === "all"} onClick={() => { setFSubject("all"); setFChapter("all"); }}>All</Pill>
                  {SUBJECTS.map((s) => (
                    <Pill key={s.id} active={fSubject === s.id} onClick={() => { setFSubject(s.id); setFChapter("all"); }} color={s.color}>{s.name}</Pill>
                  ))}
                </div>
                {/* Chapter */}
                {fSubject !== "all" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-white/50 w-16 shrink-0">Chapter</span>
                    <Pill active={fChapter === "all"} onClick={() => setFChapter("all")}>All</Pill>
                    {chapterOptions.slice(0, 8).map((c) => (
                      <Pill key={c} active={fChapter === c} onClick={() => setFChapter(c)}>{c.length > 30 ? c.slice(0, 28) + "…" : c}</Pill>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-white/50 w-16 shrink-0">Difficulty</span>
                  <Pill active={fDiff === "all"} onClick={() => setFDiff("all")}>All</Pill>
                  {DIFFS.map((d) => (
                    <Pill key={d} active={fDiff === d} onClick={() => setFDiff(d)} color={d === "easy" ? "#10b981" : d === "medium" ? "#f59e0b" : "#f43f5e"}>
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </Pill>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-white/50 w-16 shrink-0">Year</span>
                  <Pill active={fYear === "all"} onClick={() => setFYear("all")}>All</Pill>
                  {YEARS.map((y) => (
                    <Pill key={y} active={fYear === y} onClick={() => setFYear(y)}>{y}</Pill>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-white/50 w-16 shrink-0">Type</span>
                  <Pill active={fType === "all"} onClick={() => setFType("all")}>All</Pill>
                  {TYPES.map((t) => (
                    <Pill key={t.id} active={fType === t.id} onClick={() => setFType(t.id)}>{t.name}</Pill>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
                <Button variant="ghost" size="sm" className="text-white/70 hover:text-white"
                  onClick={() => { setFSubject("all"); setFChapter("all"); setFDiff("all"); setFYear("all"); setFType("all"); }}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Reset filters
                </Button>
                <Button variant="outline" size="sm" className="bg-white/5 border-white/15 text-white hover:bg-white/10" onClick={exportBank}>
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Export bank
                </Button>
              </div>
            </div>

            {/* QUESTION LIST */}
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {filtered.map((q, i) => {
                  const sub = SUBJECTS.find((s) => s.id === q.subject)!;
                  const isRevealed = revealed[q.id] !== undefined;
                  const isCorrect = revealed[q.id] === true;
                  return (
                    <motion.div
                      key={q.id}
                      layout
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.3) }}
                      className="pp-glass rounded-2xl p-5 md:p-6"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge style={{ background: `${sub.color}22`, color: sub.color, border: `${sub.color}55` }}>{q.subjectName}</Badge>
                          <span className="text-xs text-white/50">{q.chapter}</span>
                          <span className="text-xs text-white/40">•</span>
                          <span className="text-xs text-white/50">{q.year}</span>
                          <span className="text-xs text-white/40">•</span>
                          <span className="text-xs text-white/50 capitalize">{q.difficulty}</span>
                          <span className="text-xs text-white/40">•</span>
                          <span className="text-xs text-white/50">{q.marks} mark{q.marks > 1 ? "s" : ""}</span>
                        </div>
                        <Badge variant="outline" className="border-white/20 text-white/70 capitalize">{q.type === "mcq" ? "MCQ" : q.type === "short" ? "2 marks" : "Long"}</Badge>
                      </div>
                      <p className="text-white text-base md:text-lg leading-relaxed mb-4">{q.question}</p>

                      {/* Answer input */}
                      {q.type === "mcq" && q.options ? (
                        <div className="grid sm:grid-cols-2 gap-2 mb-4">
                          {q.options.map((o) => {
                            const selected = userAnswer[q.id] === o;
                            const showCorrect = isRevealed && o === q.answer;
                            const showWrong = isRevealed && selected && o !== q.answer;
                            return (
                              <button
                                key={o}
                                onClick={() => !isRevealed && setUserAnswer((a) => ({ ...a, [q.id]: o }))}
                                disabled={isRevealed}
                                className={cn(
                                  "text-left p-3 rounded-xl border text-sm transition-all flex items-center gap-2",
                                  showCorrect ? "bg-emerald-500/20 border-emerald-500/50 text-white" :
                                  showWrong ? "bg-rose-500/20 border-rose-500/50 text-white" :
                                  selected ? "bg-white/10 border-white/40 text-white" :
                                  "bg-white/[0.03] border-white/10 text-white/80 hover:bg-white/[0.07]"
                                )}
                              >
                                {showCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
                                {showWrong && <XCircle className="h-4 w-4 text-rose-400 shrink-0" />}
                                <span>{o}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <Textarea
                          rows={q.type === "long" ? 6 : 3}
                          placeholder="Type your answer…"
                          value={userAnswer[q.id] ?? ""}
                          disabled={isRevealed}
                          onChange={(e) => setUserAnswer((a) => ({ ...a, [q.id]: e.target.value }))}
                          className="mb-3 bg-white/5 border-white/15 text-white"
                        />
                      )}

                      <div className="flex items-center gap-2 flex-wrap">
                        {!isRevealed ? (
                          <Button size="sm" onClick={() => submitAnswer(q)} className="bg-amber-500 hover:bg-amber-600 text-white">
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Submit & Mark
                          </Button>
                        ) : (
                          <Badge variant="outline" className={cn("border", isCorrect ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300" : "bg-rose-500/15 border-rose-500/40 text-rose-300")}>
                            {isCorrect ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                            {isCorrect ? "Correct" : "Needs review"}
                          </Badge>
                        )}
                        <Button size="sm" variant="ghost" className="text-white/70 hover:text-white" onClick={() => generateSimilar(q)}>
                          <Sparkles className="h-3.5 w-3.5 mr-1.5" /> AI Similar
                        </Button>
                        {isRevealed && (
                          <Button size="sm" variant="ghost" className="text-white/60 hover:text-white" onClick={() => {
                            setOpenId(openId === q.id ? null : q.id);
                          }}>
                            <BookOpen className="h-3.5 w-3.5 mr-1.5" /> {openId === q.id ? "Hide" : "Show"} answer
                          </Button>
                        )}
                      </div>

                      {/* Explanation panel */}
                      <AnimatePresence>
                        {isRevealed && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                              <div className="text-sm">
                                <span className="text-white/50">Correct Answer: </span>
                  <ScholarAIContent content={q.answer} mode="compact" className="font-medium text-emerald-300" />
                              </div>
                              <div className="bg-white/[0.03] rounded-xl p-3 border border-white/10">
                                <p className="text-xs uppercase tracking-wider text-white/50 mb-1.5 flex items-center gap-1.5"><Brain className="h-3.5 w-3.5" /> Explanation</p>
                  <ScholarAIContent content={q.explanation} mode="compact" className="text-sm text-white/80" />
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {filtered.length === 0 && (
                <EmptyState icon={FileStack} title="No questions match your filters" description="Try widening the criteria to see more questions." />
              )}
            </div>
          </TabsContent>

          {/* ===== TIMED PRACTICE ===== */}
          <TabsContent value="timed" className="space-y-6">
            <div className="pp-glass rounded-2xl p-6 md:p-8 text-center">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5 }}>
                <div className="grid place-items-center h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-500/30 to-rose-500/30 text-amber-300 mx-auto mb-4 border border-white/10">
                  <Timer className="h-8 w-8" />
                </div>
                <h2 className="pp-font-serif text-3xl text-white mb-2">Timed <em>Practice</em></h2>
                <p className="text-white/70 max-w-md mx-auto mb-6">
                  10 randomly selected MCQs · 15 minutes · auto-submit at zero · instant marking · +5 XP per correct answer.
                </p>
                <Button size="lg" className="bg-amber-500 hover:bg-amber-600 text-white" onClick={startTimed}>
                  <Play className="h-4 w-4 mr-2" /> Start timed practice
                </Button>
              </motion.div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="pp-glass rounded-2xl p-5">
                <Clock className="h-5 w-5 text-amber-300 mb-2" />
                <h3 className="text-white font-semibold mb-1">15-Minute Window</h3>
                <p className="text-sm text-white/70">Auto-submits when the timer hits zero. Pacing matters in CBSE exams.</p>
              </div>
              <div className="pp-glass rounded-2xl p-5">
                <ListChecks className="h-5 w-5 text-emerald-300 mb-2" />
                <h3 className="text-white font-semibold mb-1">10 MCQ Format</h3>
                <p className="text-sm text-white/70">Mixed subjects and difficulty, mimicking Section A of CBSE papers.</p>
              </div>
              <div className="pp-glass rounded-2xl p-5">
                <Brain className="h-5 w-5 text-indigo-300 mb-2" />
                <h3 className="text-white font-semibold mb-1">Instant Feedback</h3>
                <p className="text-sm text-white/70">Score, XP and explanations revealed as soon as you submit.</p>
              </div>
            </div>
          </TabsContent>

          {/* ===== MISTAKE TRACKER ===== */}
          <TabsContent value="mistakes" className="space-y-4">
            <div className="pp-glass rounded-2xl p-5 flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold flex items-center gap-2"><AlertCircle className="h-4 w-4 text-rose-300" /> Your Mistakes ({mistakes.length})</h3>
                <p className="text-xs text-white/60 mt-0.5">Stored locally on your device. Review these before your next exam.</p>
              </div>
              {mistakes.length > 0 && (
                <Button variant="ghost" size="sm" className="text-rose-300 hover:bg-rose-500/10" onClick={clearMistakes}>
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear all
                </Button>
              )}
            </div>

            {mistakes.length === 0 ? (
              <EmptyState icon={Trophy} title="No mistakes yet — well done!" description="Wrong answers from question bank and timed practice will appear here automatically." />
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pp-scroll pr-2">
                {mistakes.map((m, i) => {
                  const sub = SUBJECTS.find((s) => s.name === m.subjectName);
                  return (
                    <motion.div
                      key={m.questionId + i}
                      initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}
                      className="pp-glass rounded-xl p-4 border-l-2 border-rose-500/50"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <Badge style={sub ? { background: `${sub.color}22`, color: sub.color, border: `${sub.color}55` } : undefined}>{m.subjectName}</Badge>
                        <button onClick={() => removeMistake(m.questionId)} className="text-white/40 hover:text-rose-300">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-white text-sm mb-2">{m.question}</p>
                      <div className="grid sm:grid-cols-2 gap-2 text-xs">
                        <div className="bg-rose-500/10 rounded-lg p-2 border border-rose-500/20">
                          <span className="text-rose-300">Your answer:</span><br />
                          <span className="text-white/80">{m.yourAnswer || "(blank)"}</span>
                        </div>
                        <div className="bg-emerald-500/10 rounded-lg p-2 border border-emerald-500/20">
                          <span className="text-emerald-300">Correct:</span><br />
                          <span className="text-white/80">{m.correctAnswer}</span>
                        </div>
                      </div>
                      <p className="text-xs text-white/50 mt-2">Chapter: {m.chapter} • Logged {new Date(m.at).toLocaleDateString()}</p>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ===== AI SIMILAR ===== */}
          <TabsContent value="ai" className="space-y-6">
            <div className="pp-glass rounded-2xl p-5">
              <h3 className="text-white font-semibold flex items-center gap-2 mb-1"><Sparkles className="h-4 w-4 text-amber-300" /> AI Similar Questions</h3>
              <p className="text-sm text-white/70">Click "AI Similar" on any question to generate 3 fresh questions of the same type, difficulty and topic — perfect for extra practice.</p>
            </div>

            {!similarFor && !similarLoading && !similarQs && (
              <EmptyState icon={Sparkles} title="No similar questions generated yet" description="Open any question in the Question Bank tab and click 'AI Similar'." />
            )}

            {similarLoading && (
              <div className="pp-glass rounded-2xl p-8 text-center">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} className="inline-block">
                  <Sparkles className="h-8 w-8 text-amber-300" />
                </motion.div>
                <p className="text-white/70 mt-3 text-sm">Generating similar questions…</p>
              </div>
            )}

            {similarQs && !similarLoading && (
              <div className="space-y-4">
                <div className="pp-glass rounded-xl p-3 text-xs text-white/60 flex items-center gap-2">
                  <ChevronRight className="h-3.5 w-3.5 text-amber-300" />
                  Based on: <span className="text-white">{similarFor?.question.slice(0, 80)}…</span>
                </div>
                {similarQs.map((q, i) => (
                  <motion.div key={q.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                    className="pp-glass rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-2 text-xs">
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">AI Generated #{i + 1}</Badge>
                      <span className="text-white/50">{q.subjectName} • {q.chapter}</span>
                    </div>
                    <p className="text-white mb-3">{q.question}</p>
                    {q.options && (
                      <div className="grid sm:grid-cols-2 gap-2 mb-3">
                        {q.options.map((o) => (
                          <div key={o} className={cn("p-2 rounded-lg text-sm border",
                            o === q.answer ? "bg-emerald-500/15 border-emerald-500/40 text-white" : "bg-white/[0.03] border-white/10 text-white/70")}>
                            {o}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="text-sm text-white/80"><span className="text-emerald-300">Answer:</span> {q.answer}</div>
                    <ScholarAIContent content={q.explanation} mode="compact" className="mt-2 text-xs text-white/60" />
                  </motion.div>
                ))}
                <Button variant="ghost" className="text-white/70" onClick={() => { setSimilarFor(null); setSimilarQs(null); }}>
                  <X className="h-3.5 w-3.5 mr-1.5" /> Clear
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* TIMED PRACTICE DIALOG */}
        <Dialog open={timedOpen} onOpenChange={(o) => {
          if (!o && timedActive) {
            if (confirm("Leave timed practice? Your progress will be lost.")) {
              setTimedOpen(false); setTimedActive(false);
              if (timerRef.current) clearInterval(timerRef.current);
            }
          } else { setTimedOpen(o); }
        }}>
          <DialogContent className="pp-glass-strong !bg-black/60 !border-white/20 max-w-3xl max-h-[90vh] overflow-y-auto">
            {!timedResult ? (
              <>
                <DialogHeader>
                  <DialogTitle className="pp-font-serif text-2xl text-white flex items-center gap-2">
                    <Timer className="h-5 w-5 text-amber-300" /> Timed Practice
                  </DialogTitle>
                  <DialogDescription className="text-white/70">
                    10 MCQs • {timedQs.length} loaded • auto-submit at zero
                  </DialogDescription>
                </DialogHeader>

                {/* Top bar: progress + timer */}
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-white/70">Question {timedIdx + 1} of {timedQs.length}</div>
                  <div className={cn("text-2xl font-mono tabular-nums", timedRemaining < 60 ? "text-rose-400" : "text-amber-300")}>
                    {fmtTime(timedRemaining)}
                  </div>
                </div>
                <Progress value={((timedIdx + 1) / timedQs.length) * 100} className="mb-6 bg-white/10 h-1.5" />

                {timedQs[timedIdx] && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">{timedQs[timedIdx].subjectName}</Badge>
                      <span className="text-xs text-white/50">{timedQs[timedIdx].chapter}</span>
                    </div>
                    <p className="text-white text-lg mb-5">{timedQs[timedIdx].question}</p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {timedQs[timedIdx].options?.map((o) => {
                        const selected = timedResponses[timedQs[timedIdx].id] === o;
                        return (
                          <button key={o}
                            onClick={() => setTimedResponses((r) => ({ ...r, [timedQs[timedIdx].id]: o }))}
                            className={cn("text-left p-3 rounded-xl border text-sm transition-all",
                              selected ? "bg-amber-500/20 border-amber-500/50 text-white" : "bg-white/[0.03] border-white/10 text-white/80 hover:bg-white/[0.07]")}>
                            {o}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Question palette */}
                <div className="mt-6 pt-4 border-t border-white/10">
                  <p className="text-xs text-white/50 mb-2">Question palette</p>
                  <div className="flex flex-wrap gap-1.5">
                    {timedQs.map((q, i) => {
                      const answered = !!timedResponses[q.id];
                      const isCurrent = i === timedIdx;
                      return (
                        <button key={q.id}
                          onClick={() => setTimedIdx(i)}
                          className={cn("h-8 w-8 rounded-lg text-xs font-medium transition-all",
                            isCurrent ? "ring-2 ring-amber-400" : "",
                            answered ? "bg-emerald-500/30 text-emerald-200" : "bg-white/10 text-white/60")}>
                          {i + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <DialogFooter className="mt-4 flex items-center justify-between">
                  <Button variant="ghost" className="text-white/70" disabled={timedIdx === 0} onClick={() => setTimedIdx((i) => Math.max(0, i - 1))}>
                    Previous
                  </Button>
                  <div className="flex gap-2">
                    {timedIdx < timedQs.length - 1 ? (
                      <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={() => setTimedIdx((i) => Math.min(timedQs.length - 1, i + 1))}>
                        Next <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button className="bg-emerald-500 hover:bg-emerald-600 text-white" onClick={endTimed}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Submit
                      </Button>
                    )}
                  </div>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="pp-font-serif text-3xl text-white text-center">Practice <em>Complete</em></DialogTitle>
                </DialogHeader>
                <div className="text-center py-6">
                  <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, type: "spring" }}
                    className="inline-grid place-items-center h-24 w-24 rounded-full bg-gradient-to-br from-amber-500/30 to-rose-500/30 border border-white/15 mb-4">
                    <Trophy className="h-12 w-12 text-amber-300" />
                  </motion.div>
                  <p className="text-5xl text-white font-bold mb-1">{timedResult.correct}/{timedResult.total}</p>
                  <p className="text-white/70 mb-4">Accuracy: {Math.round((timedResult.correct / timedResult.total) * 100)}% · +{timedResult.xp} XP earned</p>
                  <div className="flex gap-2 justify-center">
                    <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={() => { startTimed(); }}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Try again
                    </Button>
                    <Button variant="outline" className="border-white/20 text-white hover:bg-white/10" onClick={() => setTimedOpen(false)}>
                      Done
                    </Button>
                  </div>
                </div>
                {/* Per-question review */}
                <div className="space-y-2 max-h-64 overflow-y-auto pp-scroll mt-2">
                  {timedQs.map((q, i) => {
                    const ans = timedResponses[q.id];
                    const ok = ans === q.answer;
                    return (
                      <div key={q.id} className={cn("p-3 rounded-xl border flex items-start gap-2",
                        ok ? "bg-emerald-500/10 border-emerald-500/30" : "bg-rose-500/10 border-rose-500/30")}>
                        {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />}
                        <div className="text-sm">
                          <span className="text-white/50">Q{i + 1}.</span> <span className="text-white">{q.question.slice(0, 80)}…</span>
                          <div className="text-xs text-white/60 mt-1">
                            Your: {ans || "—"} · Correct: <span className="text-emerald-300">{q.answer}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export default PastPapersView;
