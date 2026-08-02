"use client";

// Class 9 Quiz View — preserved from the original quiz.tsx.
// Uses the static POOL of ~40 Class 9 questions and the store-based Leitner system.

import { useStore, type QuizQuestion, type QuizAttempt } from "@/lib/store";
import { useCurriculum } from "@/lib/use-curriculum";
import { CURRICULUM } from "@/lib/curriculum";
import { askAIJSON } from "@/lib/ai";
import { StatCard, SectionHeader, EmptyState, Pill, ProgressRing } from "@/lib/shared";
import { ScholarAIContent } from "@/components/ai/scholar-ai-content";
import { exportPDF } from "@/lib/pdf";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Send, Clock, Check, X, RotateCcw, Award, Brain,
  ChevronLeft, ChevronRight, Loader2, Target, ListChecks, Trophy, AlertCircle,
} from "lucide-react";
import { toast } from "@/lib/notifications/notification-api";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  beginBackgroundTask,
  completeBackgroundTask,
  failBackgroundTask,
} from "@/lib/background-tasks";
import { profileGetJSON, profileSetJSON } from "@/lib/profile-storage";

interface MCQ {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  subject: string;
  chapter?: string;
  difficulty: "easy" | "medium" | "hard";
}

const POOL: MCQ[] = [
  { subject: "maths", chapter: "m1", difficulty: "easy", question: "Which of the following is an irrational number?", options: ["√2", "0.5", "3/4", "0.333…"], answer: "√2", explanation: "√2 cannot be expressed as p/q, so it is irrational." },
  { subject: "maths", chapter: "m1", difficulty: "easy", question: "Every rational number is a:", options: ["Natural number", "Real number", "Integer", "Irrational number"], answer: "Real number", explanation: "Rational numbers are a subset of real numbers." },
  { subject: "maths", chapter: "m2", difficulty: "easy", question: "The degree of the polynomial x² + 3x + 2 is:", options: ["1", "2", "3", "0"], answer: "2", explanation: "The highest power of x is 2." },
  { subject: "maths", chapter: "m2", difficulty: "medium", question: "Factorise: x² − 7x + 12", options: ["(x−3)(x−4)", "(x−2)(x−6)", "(x+3)(x+4)", "(x−1)(x−12)"], answer: "(x−3)(x−4)", explanation: "−3 × −4 = 12 and −3 + (−4) = −7." },
  { subject: "science", chapter: "s1", difficulty: "easy", question: "The SI unit of force is:", options: ["Joule", "Newton", "Watt", "Pascal"], answer: "Newton", explanation: "Force = mass × acceleration, unit is Newton (N)." },
  { subject: "science", chapter: "s1", difficulty: "medium", question: "Which of the following is a vector quantity?", options: ["Speed", "Mass", "Velocity", "Temperature"], answer: "Velocity", explanation: "Velocity has both magnitude and direction." },
  { subject: "science", chapter: "s2", difficulty: "easy", question: "The atomic number of carbon is:", options: ["4", "6", "8", "12"], answer: "6", explanation: "Carbon has 6 protons." },
  { subject: "science", chapter: "s2", difficulty: "medium", question: "Which is NOT a noble gas?", options: ["Helium", "Neon", "Nitrogen", "Argon"], answer: "Nitrogen", explanation: "Nitrogen is a non-metal, not a noble gas." },
  { subject: "science", chapter: "s5", difficulty: "easy", question: "The powerhouse of the cell is:", options: ["Nucleus", "Mitochondria", "Ribosome", "Golgi body"], answer: "Mitochondria", explanation: "Mitochondria produce ATP, the energy currency." },
  { subject: "sst", chapter: "ss1", difficulty: "easy", question: "The French Revolution began in:", options: ["1776", "1789", "1804", "1815"], answer: "1789", explanation: "The storming of the Bastille was on July 14, 1789." },
  { subject: "english", difficulty: "easy", question: "Identify the noun: 'She bought a beautiful dress.'", options: ["She", "Bought", "Beautiful", "Dress"], answer: "Dress", explanation: "Dress is a common noun." },
  { subject: "english", difficulty: "medium", question: "Choose the correct synonym for 'abundant':", options: ["Scarce", "Plentiful", "Empty", "Small"], answer: "Plentiful", explanation: "Abundant means existing in large quantities." },
];

const SUBJECT_COLORS: Record<string, string> = {
  maths: "#6366f1", science: "#10b981", sst: "#f59e0b", english: "#f43f5e", hindi: "#a855f7",
};

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function toQuizQuestions(mcqs: MCQ[]): QuizQuestion[] {
  return mcqs.map((m) => ({
    id: uid(), type: "mcq" as const, question: m.question, options: m.options,
    answer: m.answer, explanation: m.explanation, subject: m.subject,
    chapter: m.chapter, difficulty: m.difficulty,
  }));
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
}

type Phase = "home" | "taking" | "results";

export function Class9QuizView() {
  const scholarClass = useStore((s) => s.user.scholarClass);
  const quizAttempts = useStore((s) => s.quizAttempts);
  const CURRICULUM = useCurriculum();
  const addQuizAttempt = useStore((s) => s.addQuizAttempt);
  const mastery = useStore((s) => s.mastery);
  const setMastery = useStore((s) => s.setMastery);
  const addXP = useStore((s) => s.addXP);
  const addCoins = useStore((s) => s.addCoins);
  const pushActivity = useStore((s) => s.pushActivity);

  const [phase, setPhase] = useState<Phase>("home");
  const [filter, setFilter] = useState<string>("all");
  const [negative, setNegative] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [timeSpent, setTimeSpent] = useState(0);
  const [lastAttempt, setLastAttempt] = useState<QuizAttempt | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [submitConfirm, setSubmitConfirm] = useState(false);

  useEffect(() => {
    const pending = profileGetJSON<QuizQuestion[]>(
      scholarClass,
      "quiz-pending-ai-questions",
      [],
    );
    if (!pending.length) return;
    setQuestions(pending);
    setResponses({});
    setCurrent(0);
    setStartedAt(Date.now());
    setTimeSpent(0);
    setPhase("taking");
  }, [scholarClass]);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (phase === "taking") {
      tickRef.current = setInterval(() => setTimeSpent(Math.floor((Date.now() - startedAt) / 1000)), 1000);
      return () => { if (tickRef.current) clearInterval(tickRef.current); };
    }
  }, [phase, startedAt]);

  const availablePool = useMemo(() => filter === "all" ? POOL : POOL.filter((q) => q.subject === filter), [filter]);

  const startQuiz = useCallback(() => {
    const pool = filter === "all" ? POOL : POOL.filter((q) => q.subject === filter);
    if (pool.length === 0) { toast.error("No questions available"); return; }
    const picked = shuffle(pool).slice(0, Math.min(10, pool.length));
    setQuestions(toQuizQuestions(picked));
    setResponses({});
    setCurrent(0);
    setStartedAt(Date.now());
    setTimeSpent(0);
    setPhase("taking");
  }, [filter]);

  const startAIQuiz = async (subject: string, chapter: string, count: number, difficulty: string) => {
    const backgroundTaskId = beginBackgroundTask({
      kind: "quiz",
      title: "Generating your quiz",
      message: `Building ${count} chapter questions…`,
      viewId: "quiz",
    });
    setAiLoading(true);
    try {
      const subj = CURRICULUM.find((s) => s.id === subject);
      const ch = subj?.chapters.find((c) => c.id === chapter);
      if (!ch) {
        failBackgroundTask(backgroundTaskId, "The selected chapter was not found.");
        toast.error("Chapter not found");
        return;
      }
      const prompt = `Generate ${count} CBSE Class 9 MCQ questions for "${ch.title}" (${subj?.name}). Difficulty: ${difficulty}. Respond ONLY as JSON: {"questions":[{"question":"...","options":["a","b","c","d"],"answer":"correct option","explanation":"short"}]}`;
      const data = await askAIJSON<{ questions: { question: string; options: string[]; answer: string; explanation?: string }[] }>(prompt, "default", { usage: "quiz_generation" });
      if (!data?.questions?.length) {
        failBackgroundTask(backgroundTaskId, "No usable quiz questions were returned.");
        toast.error("AI did not return questions.");
        return;
      }
      const qs: QuizQuestion[] = data.questions.map((q) => ({
        id: uid(), type: "mcq" as const, question: q.question,
        options: q.options?.length === 4 ? q.options : shuffle([...(q.options ?? []), q.answer]).slice(0, 4),
        answer: q.answer, explanation: q.explanation, subject, chapter, difficulty: difficulty as any,
      }));
      setQuestions(qs); setResponses({}); setCurrent(0);
      profileSetJSON(scholarClass, "quiz-pending-ai-questions", qs);
      setStartedAt(Date.now()); setTimeSpent(0); setPhase("taking"); setAiOpen(false);
      toast.success(`AI generated ${qs.length} questions.`);
      completeBackgroundTask(
        backgroundTaskId,
        `${qs.length} questions are ready.`,
      );
    } catch {
      failBackgroundTask(backgroundTaskId, "Quiz generation failed.");
      toast.error("Could not generate quiz.");
    }
    finally { setAiLoading(false); }
  };

  const handleSubmit = () => {
    profileSetJSON(scholarClass, "quiz-pending-ai-questions", []);
    let correct = 0, wrong = 0, attempted = 0;
    questions.forEach((q) => {
      const r = responses[q.id];
      if (r) { attempted++; if (r === q.answer) correct++; else wrong++; }
    });
    let score = correct;
    if (negative) score = Math.max(0, correct - wrong * 0.25);
    const finalScore = Math.round(score * 100) / 100;
    const total = questions.length;
    const ts = Math.floor((Date.now() - startedAt) / 1000);
    const attempt: QuizAttempt = {
      id: uid(), subject: filter === "all" ? undefined : filter,
      title: filter === "all" ? "Mixed Quiz" : `${CURRICULUM.find((s) => s.id === filter)?.name ?? ""} Quiz`,
      questions, responses, score: finalScore, total, startedAt, finishedAt: Date.now(), timeSpent: ts,
    };
    addQuizAttempt(attempt);
    addXP(Math.round(finalScore * 5));
    addCoins(Math.round(finalScore));
    pushActivity({ type: "quiz", text: `Scored ${finalScore}/${total} on ${attempt.title}`, icon: "🎯" });
    if (attempt.subject) {
      const cur = mastery[attempt.subject] ?? 0;
      setMastery(attempt.subject, Math.min(100, cur + (finalScore / total) * 4));
    }
    setLastAttempt(attempt);
    setPhase("results");
    setSubmitConfirm(false);
    if (finalScore >= 8) toast.success("🏆 Quiz Champion!");
    else if (finalScore >= 6) toast.success(`Nice — ${finalScore}/${total}!`);
    else toast.info(`Keep practising — ${finalScore}/${total}.`);
  };

  // ===== Results Phase =====
  if (phase === "results" && lastAttempt) {
    const pct = Math.round((lastAttempt.score / lastAttempt.total) * 100);
    const color = pct >= 80 ? "#14b8a6" : pct >= 50 ? "#f59e0b" : "#ef4444";
    const correctCount = lastAttempt.questions.filter((q) => lastAttempt.responses[q.id] === q.answer).length;
    const wrongCount = lastAttempt.questions.filter((q) => lastAttempt.responses[q.id] && lastAttempt.responses[q.id] !== q.answer).length;
    const skipped = lastAttempt.total - correctCount - wrongCount;
    return (
      <div className="flex flex-col gap-5">
        <SectionHeader title="Quiz Results" subtitle={lastAttempt.title} action={<Button variant="outline" size="sm" onClick={() => { setPhase("home"); setLastAttempt(null); }}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>} />
        <Card className="premium-card p-6 sm:p-8 relative overflow-hidden">
          <div className="relative flex flex-col sm:flex-row items-center gap-6">
            <ProgressRing value={pct} size={140} stroke={10} color={color} label={<div className="text-center"><div className="text-2xl font-bold">{pct}%</div><div className="text-[10px] text-muted-foreground mt-1">{lastAttempt.score}/{lastAttempt.total}</div></div>} />
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-2xl font-semibold">{pct >= 80 ? "Excellent!" : pct >= 60 ? "Good job!" : pct >= 40 ? "Keep going!" : "Review and retry!"}</h2>
              <p className="text-sm text-muted-foreground mt-1"><strong className="text-emerald-500">{correctCount}</strong> correct, <strong className="text-red-500">{wrongCount}</strong> wrong, <strong className="text-muted-foreground">{skipped}</strong> skipped.</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button onClick={() => { startQuiz(); }} size="sm" className="bg-gradient-to-r from-indigo-500 to-teal-500 text-white"><RotateCcw className="h-4 w-4 mr-1.5" /> Retake</Button>
          </div>
        </Card>
        <div className="space-y-2.5">
          {lastAttempt.questions.map((q, i) => {
            const user = lastAttempt.responses[q.id];
            const ok = user === q.answer;
            const isSkipped = !user;
            return (
              <Card key={q.id} className={`premium-card p-4 border-l-4 ${ok ? "border-l-emerald-500" : isSkipped ? "border-l-muted" : "border-l-red-500"}`}>
                <div className="flex items-start gap-3">
                  <div className={`grid place-items-center h-7 w-7 rounded-lg shrink-0 ${ok ? "bg-emerald-500/15 text-emerald-500" : isSkipped ? "bg-muted text-muted-foreground" : "bg-red-500/15 text-red-500"}`}>
                    {ok ? <Check className="h-4 w-4" /> : isSkipped ? <AlertCircle className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex gap-1 text-sm font-medium"><span className="shrink-0 text-muted-foreground">Q{i + 1}.</span><ScholarAIContent content={q.question} mode="compact" /></div>
                    <p className={`mt-1 text-sm ${!ok ? "text-red-500" : "text-emerald-500"}`}><span className="text-muted-foreground">Your answer:</span> {user || "—"}</p>
                    {!ok && <p className="text-sm text-emerald-500"><span className="text-muted-foreground">Correct:</span> {q.answer}</p>}
                    {q.explanation && <p className="text-xs text-muted-foreground mt-1 italic">💡 {q.explanation}</p>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // ===== Taking Phase =====
  if (phase === "taking") {
    const q = questions[current];
    if (!q) return null;
    const answered = Object.keys(responses).length;
    const progress = (current / questions.length) * 100;
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => setPhase("home")}><ChevronLeft className="h-4 w-4 mr-1" /> Exit</Button>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono">Q {current + 1}/{questions.length}</Badge>
            <Badge variant="outline" className="font-mono"><Clock className="h-3 w-3 mr-1" /> {fmtTime(timeSpent)}</Badge>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <motion.div className="h-full bg-gradient-to-r from-indigo-500 to-teal-500" animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
        </div>
        <Card className="premium-card p-5 sm:p-7">
          {q.subject && <Badge variant="secondary" style={{ color: SUBJECT_COLORS[q.subject] ?? "#6366f1" }}>{CURRICULUM.find((s) => s.id === q.subject)?.name ?? q.subject}</Badge>}
          {q.difficulty && <Badge variant="outline" className="ml-1 capitalize">{q.difficulty}</Badge>}
          <ScholarAIContent content={q.question} mode="compact" className="mb-5 mt-2 text-lg font-semibold sm:text-xl" />
          <RadioGroup value={responses[q.id] ?? ""} onValueChange={(v) => setResponses((r) => ({ ...r, [q.id]: v }))} className="grid gap-2.5">
            {q.options?.map((opt, i) => {
              const checked = responses[q.id] === opt;
              return (
                <label key={i} className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${checked ? "border-primary bg-primary/5 shadow-sm" : "border-border/60 hover:bg-muted/40"}`}>
                  <RadioGroupItem value={opt} id={`opt-${i}`} />
                  <ScholarAIContent content={opt} mode="compact" className="min-w-0 text-sm font-medium" />
                </label>
              );
            })}
          </RadioGroup>
        </Card>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Button variant="outline" size="sm" disabled={current === 0} onClick={() => setCurrent((c) => Math.max(0, c - 1))}><ChevronLeft className="h-4 w-4 mr-1" /> Prev</Button>
          <div className="flex items-center gap-1 flex-wrap justify-center">
            {questions.map((qq, i) => (
              <button key={qq.id} onClick={() => setCurrent(i)} className={`h-7 w-7 rounded-md text-xs font-medium ${i === current ? "bg-primary text-primary-foreground" : responses[qq.id] ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>{i + 1}</button>
            ))}
          </div>
          {current < questions.length - 1 ? (
            <Button size="sm" onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
          ) : (
            <Button size="sm" onClick={() => setSubmitConfirm(true)} className="bg-gradient-to-r from-indigo-500 to-teal-500 text-white"><Send className="h-4 w-4 mr-1.5" /> Submit</Button>
          )}
        </div>
        <Dialog open={submitConfirm} onOpenChange={setSubmitConfirm}>
          <DialogContent>
            <DialogHeader><DialogTitle>Submit quiz?</DialogTitle><DialogDescription>{answered === questions.length ? `All ${questions.length} answered. Submit now?` : `${answered}/${questions.length} answered. Submit anyway?`}</DialogDescription></DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSubmitConfirm(false)}>Keep going</Button>
              <Button onClick={handleSubmit} className="bg-gradient-to-r from-indigo-500 to-teal-500 text-white"><Send className="h-4 w-4 mr-1.5" /> Submit</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ===== Home Phase =====
  const lastFive = quizAttempts.slice(0, 5);
  const avgScore = quizAttempts.length ? Math.round((quizAttempts.reduce((a, b) => a + b.score / b.total, 0) / quizAttempts.length) * 100) : 0;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">
      <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover z-0 opacity-40">
        <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260319_015952_e1deeb12-8fb7-4071-a42a-60779fc64ab6.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 z-0 bg-black/50" />
      <div className="relative z-10 p-4 md:p-8 lg:p-12">
        <h1 className="text-4xl font-serif text-white mb-6">Test Your <em>Knowledge</em></h1>
        <div className="flex flex-col gap-5">
          <SectionHeader title="Quiz" subtitle="Pick a subject, race the clock, and master every chapter." action={
            <Dialog open={aiOpen} onOpenChange={setAiOpen}>
              <DialogTrigger asChild><Button variant="outline" size="sm"><Sparkles className="h-4 w-4 mr-1.5" /> AI Generate Quiz</Button></DialogTrigger>
              <AIGenerateDialog loading={aiLoading} onGenerate={startAIQuiz} curriculum={CURRICULUM} scholarClass={scholarClass} />
            </Dialog>
          } />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={Target} label="Attempts" value={quizAttempts.length} accent="#6366f1" />
            <StatCard icon={Award} label="Avg Score" value={`${avgScore}%`} accent="#14b8a6" />
            <StatCard icon={ListChecks} label="Question Pool" value={POOL.length} accent="#f59e0b" />
            <StatCard icon={Trophy} label="Best Score" value={quizAttempts[0] ? `${quizAttempts[0].score}/${quizAttempts[0].total}` : "—"} accent="#d946ef" />
          </div>
          <div className="cinema-glass rounded-2xl p-5">
            <h3 className="text-sm font-semibold mb-3 text-white">Start a quiz</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              <Pill active={filter === "all"} onClick={() => setFilter("all")} color="#6366f1">All subjects ({POOL.length})</Pill>
              {CURRICULUM.map((s) => {
                const count = POOL.filter((q) => q.subject === s.id).length;
                return <Pill key={s.id} active={filter === s.id} onClick={() => setFilter(s.id)} color={SUBJECT_COLORS[s.id]}>{s.icon} {s.name} ({count})</Pill>;
              })}
            </div>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer text-white/80">
                <Checkbox checked={negative} onCheckedChange={(v) => setNegative(v === true)} />
                <span>Negative marking <span className="text-xs text-white/50">(−0.25 per wrong)</span></span>
              </label>
              <span className="text-xs text-white/50">{availablePool.length} questions · will pick 10 at random</span>
            </div>
            <Button onClick={startQuiz} size="sm" className="bg-gradient-to-r from-indigo-500 to-teal-500 text-white w-full sm:w-auto"><Brain className="h-4 w-4 mr-1.5" /> Start quiz</Button>
          </div>
          {lastFive.length === 0 ? (
            <EmptyState icon={Target} title="No attempts yet" description="Take your first quiz to see results here." />
          ) : (
            <div className="cinema-glass rounded-2xl p-4">
              <h3 className="text-sm font-semibold mb-3 text-white">Recent attempts</h3>
              <div className="space-y-2">
                {lastFive.map((a) => {
                  const pct = Math.round((a.score / a.total) * 100);
                  return (
                    <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5">
                      <ProgressRing value={pct} size={42} stroke={4} color={pct >= 80 ? "#14b8a6" : pct >= 50 ? "#f59e0b" : "#ef4444"} label={`${pct}%`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">{a.title}</p>
                        <p className="text-xs text-white/50">{a.score}/{a.total} · {fmtTime(a.timeSpent)} · {new Date(a.finishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`.cinema-glass{background:rgba(255,255,255,0.03);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.1);color:white;}`}</style>
    </div>
  );
}

function AIGenerateDialog({ loading, onGenerate, curriculum, scholarClass }: {
  loading: boolean;
  onGenerate: (subject: string, chapter: string, count: number, difficulty: string) => Promise<void>;
  curriculum: any[];
  scholarClass: 9 | 11;
}) {
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState("medium");
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>AI Generate Quiz</DialogTitle>
        <DialogDescription>Let the AI craft fresh CBSE Class {scholarClass} MCQs.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3 py-1">
        <Select value={subject} onValueChange={(v) => { setSubject(v); setChapter(""); }}>
          <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
          <SelectContent>{curriculum.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.icon} {s.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={chapter} onValueChange={setChapter} disabled={!subject}>
          <SelectTrigger><SelectValue placeholder="Chapter" /></SelectTrigger>
          <SelectContent>{curriculum.find((s: any) => s.id === subject)?.chapters.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{[5, 8, 10, 12].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => onGenerate(subject, chapter, count, difficulty)} disabled={loading || !subject || !chapter} className="bg-gradient-to-r from-indigo-500 to-teal-500 text-white">
          {loading ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Generating…</> : <><Sparkles className="h-4 w-4 mr-1.5" /> Generate & Start</>}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
