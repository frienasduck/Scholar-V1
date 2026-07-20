"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { askAIJSON } from "@/lib/ai";
import { useStore } from "@/lib/store";
import { useCurriculum } from "@/lib/use-curriculum";
import { loadSubjectQuizzes, type QuizMCQ } from "@/lib/quizzes-loader";
import { exportPDF, mdToHtml } from "@/lib/pdf";
import { profileGetJSON, profileSetJSON } from "@/lib/profile-storage";
import { EBOOK_QUESTION_BOOKS, loadEbookQuestions, splitPrintedAnswer } from "@/lib/ebook-question-bank";
import { StatCard, EmptyState, ProgressRing } from "@/lib/shared";
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
  ClipboardCheck, Sparkles, Clock, Trophy, Brain, Play, ChevronRight, ChevronLeft,
  Download, CheckCircle2, XCircle, AlertCircle, FileText, Award, Settings, History,
  Medal, Timer, Zap, Target, TrendingUp, Crown, Users, Flag, RotateCcw, BookOpen, Loader2,
} from "lucide-react";

// ============================================================================
// Mock Exam Center
// ============================================================================

type QType = "mcq" | "short" | "long";

interface ExamQuestion {
  id: string;
  type: QType;
  question: string;
  options?: string[];
  answer: string;
  explanation?: string;
  marks: number;
  aiMarkedScore?: number; // 0..marks (for descriptive)
  aiFeedback?: string;
  userAnswer?: string;
}

interface ExamConfig {
  subject: string;
  subjectId: string;
  difficulty: "easy" | "medium" | "hard";
  duration: number; // minutes
  numQuestions: number;
  pattern: "mcq-only" | "mixed" | "subjective";
  chapterIds: string[];
  examType: "chapter" | "subject" | "jee";
}

interface MockResult {
  id: string;
  config: ExamConfig;
  questions: ExamQuestion[];
  score: number;
  total: number;
  percentage: number;
  timeSpent: number;
  predictedRank: number;
  band: string;
  at: number;
}

interface GeneratedExamQuestion {
  id: string;
  question: string;
  type: QType;
  marks: number;
  options?: string[] | null;
  correctAnswer?: number | string;
  modelAnswer?: string;
  chapterId: string;
  chapterTitle: string;
}

const PATTERNS = [
  { id: "mcq-only", name: "MCQ Only", desc: "All multiple choice — fast and objective" },
  { id: "mixed", name: "Mixed Pattern", desc: "MCQs + short + long answer — full CBSE style" },
  { id: "subjective", name: "Subjective", desc: "Short + long answer only — descriptive focus" },
] as const;

function loadHistory(scholarClass: 9 | 11): MockResult[] {
  if (typeof window === "undefined") return [];
  return profileGetJSON<MockResult[]>(scholarClass, "mock-exam-history", []);
}
function saveHistory(scholarClass: 9 | 11, list: MockResult[]) {
  profileSetJSON(scholarClass, "mock-exam-history", list);
}

// Simulated leaderboard (deterministic from history)
const LEADERBOARD_SEED = [
  { name: "Aarav Sharma", school: "Delhi Public School", score: 94, you: false },
  { name: "Diya Patel", school: "DAV Public School", score: 91, you: false },
  { name: "Ishaan Gupta", school: "Ryan International", score: 89, you: false },
  { name: "Ananya Reddy", school: "Kendriya Vidyalaya", score: 87, you: false },
  { name: "Kabir Singh", school: "Modern School", score: 85, you: false },
  { name: "Saanvi Iyer", school: "Bishop Cotton", score: 83, you: false },
  { name: "Vivaan Mehta", school: "St. Xavier's", score: 80, you: false },
  { name: "Myra Khanna", school: "Delhi Public School", score: 78, you: false },
  { name: "Reyansh Nair", school: "DAV Public School", score: 75, you: false },
  { name: "Anika Bose", school: "Modern School", score: 72, you: false },
];

// ============================================================================
// Component
// ============================================================================
export function MockExamView() {
  const mastery = useStore((s) => s.mastery);
  const scholarClass = useStore((s) => s.user.scholarClass);
  const CURRICULUM = useCurriculum();
  const SUBJECT_OPTS = CURRICULUM.map((s) => ({ id: s.id, name: s.name, accent: s.accent }));
  const quizAttempts = useStore((s) => s.quizAttempts);
  const addXP = useStore((s) => s.addXP);
  const addCoins = useStore((s) => s.addCoins);
  const pushActivity = useStore((s) => s.pushActivity);

  // Config state
  const [config, setConfig] = useState<ExamConfig>(() => ({
    subject: scholarClass === 11 ? "Physics" : "Mathematics",
    subjectId: scholarClass === 11 ? "physics" : "maths", difficulty: "medium",
    duration: 30, numQuestions: 10, pattern: "mixed",
    chapterIds: [], examType: "subject",
  }));
  const [generating, setGenerating] = useState(false);
  const [reviewQs, setReviewQs] = useState<ExamQuestion[] | null>(null);
  const [generationError, setGenerationError] = useState(false);
  const [reviewSource, setReviewSource] = useState<"ai" | "local-question-bank" | "ebook">("ai");
  const [ebookMode, setEbookMode] = useState<"chapter" | "mixed">("chapter");
  const [ebookBookId, setEbookBookId] = useState("class11-maths-part1");
  const [ebookChapterId, setEbookChapterId] = useState("sets");
  const [ebookGenerating, setEbookGenerating] = useState(false);

  // Exam-runner state
  const [examQs, setExamQs] = useState<ExamQuestion[] | null>(null);
  const [examActive, setExamActive] = useState(false);
  const [examIdx, setExamIdx] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState(0);
  const [examStartedAt, setExamStartedAt] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<MockResult | null>(null);

  const [history, setHistory] = useState<MockResult[]>([]);
  useEffect(() => { setHistory(loadHistory(scholarClass)); }, [scholarClass]);

  // Stats
  const avgScore = history.length > 0
    ? Math.round(history.reduce((a, r) => a + r.percentage, 0) / history.length)
    : 0;
  const bestScore = history.length > 0 ? Math.max(...history.map((h) => h.percentage)) : 0;
  const totalAttempts = history.length;
  const masteryValues = Object.values(mastery);
  const avgMastery = masteryValues.length > 0 ? masteryValues.reduce((a, b) => a + b, 0) / masteryValues.length : 0;

  // Build pattern → question type distribution
  const buildTypeDistribution = (n: number, pattern: ExamConfig["pattern"]): QType[] => {
    if (pattern === "mcq-only") return Array(n).fill("mcq");
    if (pattern === "subjective") {
      const shorts = Math.ceil(n * 0.6);
      const longs = n - shorts;
      return [...Array(shorts).fill("short"), ...Array(longs).fill("long")];
    }
    // mixed
    const mcqs = Math.ceil(n * 0.5);
    const shorts = Math.ceil((n - mcqs) * 0.6);
    const longs = n - mcqs - shorts;
    return [...Array(mcqs).fill("mcq"), ...Array(shorts).fill("short"), ...Array(longs).fill("long")];
  };

  // ===== Generate paper =====
  const generatePaper = async () => {
    setGenerating(true);
    setGenerationError(false);
    try {
      const types = buildTypeDistribution(config.numQuestions, config.pattern);
      const typeCount = {
        mcq: types.filter((type) => type === "mcq").length,
        short: types.filter((type) => type === "short").length,
        long: types.filter((type) => type === "long").length,
      };
      const subject = CURRICULUM.find((item) => item.id === config.subjectId) ?? CURRICULUM[0];
      if (!subject) throw new Error("subject unavailable");
      const selectedChapterRecords = subject.chapters.filter((chapter) => config.chapterIds.includes(chapter.id));
      const selectedChapters = selectedChapterRecords.map((chapter) => `${chapter.id}: ${chapter.title}`);
      const chapterClause = selectedChapters.length > 0
        ? `IMPORTANT: Only generate questions from these specific chapters. Do not use any other chapter:\n${selectedChapters.map((chapter) => `  - ${chapter}`).join("\n")}`
        : `Cover varied chapters across the full ${subject.name} syllabus. Every chapterId and chapterTitle must match the supplied Class ${scholarClass} syllabus.`;
      const jeeClause = config.examType === "jee" && scholarClass === 11
        ? "\nThis is a JEE-focused test. Use JEE-level difficulty and multi-concept numerical problems where appropriate."
        : "";
      const prompt = `Generate a CBSE Class ${scholarClass} ${subject.name} mock exam paper.
Difficulty: ${config.difficulty}${jeeClause}
Total questions: ${config.numQuestions}
Pattern: ${config.pattern}: ${typeCount.mcq} MCQ, ${typeCount.short} short-answer, ${typeCount.long} long-answer.

${chapterClause}

For MCQs provide exactly four options and correctAnswer as a zero-based option index or the exact option text. For short and long questions provide modelAnswer.
Return strict JSON in this exact shape:
{"questions":[{"id":string,"question":string,"type":"mcq"|"short"|"long","marks":number,"options":[string,string,string,string]|null,"correctAnswer":number|string,"modelAnswer":string,"chapterId":string,"chapterTitle":string}]}
For MCQs omit modelAnswer. For descriptive questions omit correctAnswer and options. Subjective model answers must be complete.`;

      const result = await askAIJSON<{ questions: GeneratedExamQuestion[] }>(prompt, "default", { mode: "mock-exam" });
      if (!result?.questions || result.questions.length < config.numQuestions) throw new Error("incomplete paper");
      const allowedChapterTitles = new Set(selectedChapterRecords.map((chapter) => chapter.title.toLowerCase()));
      const allowedChapterIds = new Set(selectedChapterRecords.map((chapter) => chapter.id));
      const questions: ExamQuestion[] = result.questions.slice(0, config.numQuestions).map((question, index) => {
        const options = Array.isArray(question.options) ? question.options.map(String) : undefined;
        if (!question.question.trim()) throw new Error("empty question");
        if (question.type === "mcq" && options?.length !== 4) throw new Error("invalid MCQ options");
        if (allowedChapterIds.size > 0 && (!allowedChapterIds.has(question.chapterId) || !allowedChapterTitles.has(question.chapterTitle.toLowerCase()))) {
          throw new Error("question outside selected chapters");
        }
        const rawAnswer = question.type === "mcq" ? question.correctAnswer : question.modelAnswer;
        let answer = String(rawAnswer ?? "").trim();
        if (question.type === "mcq" && options) {
          if (typeof rawAnswer === "number") answer = options[rawAnswer] ?? "";
          else if (/^[A-D]$/i.test(answer)) answer = options[answer.toUpperCase().charCodeAt(0) - 65] ?? "";
          if (!options.includes(answer)) throw new Error("invalid MCQ answer");
        }
        if (!answer) throw new Error("missing answer");
        return {
          id: question.id || `meq-${index}-${Date.now()}`,
          type: question.type,
          question: question.question,
          options,
          answer,
          explanation: question.type === "mcq" ? `Correct answer: ${answer}` : "Review the model answer before starting.",
          marks: question.marks,
        };
      });
      setReviewQs(questions);
      setReviewSource("ai");
      toast.success(`Generated ${questions.length} questions. Review them before starting.`);
    } catch {
      setGenerationError(true);
      toast.error("Could not generate paper", { description: "Please retry AI or use Scholar's local question bank." });
    } finally {
      setGenerating(false);
    }
  };

  const generateLocalPaper = () => {
    const subject = CURRICULUM.find((item) => item.id === config.subjectId) ?? CURRICULUM[0];
    if (!subject) return;
    const selected = config.examType === "chapter" && config.chapterIds.length > 0
      ? subject.chapters.filter((chapter) => config.chapterIds.includes(chapter.id))
      : subject.chapters;
    if (selected.length === 0) return;

    const allowedIds = new Set(selected.map((chapter) => chapter.id));
    const quizBank: QuizMCQ[] = scholarClass === 11
      ? loadSubjectQuizzes(config.subjectId).filter((question) => allowedIds.has(question.chapterId))
      : [];
    const difficultyMatches = quizBank.filter((question) => question.difficulty === config.difficulty);
    const mcqs = difficultyMatches.length >= config.numQuestions ? difficultyMatches : quizBank;
    const subjectiveBank = selected.flatMap((chapter) => chapter.questions.map((question) => ({ chapter, question })));
    if (subjectiveBank.length === 0 && mcqs.length === 0) return;
    const types = buildTypeDistribution(config.numQuestions, config.pattern);
    let mcqIndex = 0;
    let subjectiveIndex = 0;

    const localQuestions: ExamQuestion[] = types.map((requestedType, index) => {
      const quiz = requestedType === "mcq" && mcqs.length > 0 ? mcqs[mcqIndex++ % mcqs.length] : null;
      if (quiz) {
        return {
          id: `local-mcq-${Date.now()}-${index}`,
          type: "mcq",
          question: quiz.question,
          options: [...quiz.options],
          answer: quiz.correctAnswer,
          explanation: quiz.explanation,
          marks: 1,
        };
      }
      const item = subjectiveBank[subjectiveIndex++ % subjectiveBank.length];
      const type: QType = requestedType === "mcq" ? "short" : requestedType;
      return {
        id: `local-subjective-${Date.now()}-${index}`,
        type,
        question: item.question,
        answer: `${item.chapter.summary}\n\nKey concepts to include: ${item.chapter.concepts.slice(0, 5).join(", ")}.`,
        explanation: "Generated from Scholar's local curriculum question bank.",
        marks: type === "long" ? 5 : 3,
      };
    });
    setReviewQs(localQuestions);
    setReviewSource("local-question-bank");
    setGenerationError(false);
    toast.info(`Created ${localQuestions.length} questions from Scholar's local question bank. Review them before starting.`);
  };

  const generateEbookPaper = async () => {
    setEbookGenerating(true);
    setGenerationError(false);
    try {
      const raw = await loadEbookQuestions(ebookMode === "chapter" ? [ebookBookId] : undefined);
      const pool = raw.filter((question) => ebookMode === "mixed" || question.chapterId === ebookChapterId);
      if (!pool.length) throw new Error("No printed questions were found for this selection.");
      const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(config.numQuestions, pool.length));
      const mapped: ExamQuestion[] = shuffled.map((source, index) => {
        const printed = splitPrintedAnswer(source.prompt);
        const options = source.options?.map(String);
        const answerIndex = typeof source.correctOption === "number" ? source.correctOption : -1;
        const isMcq = Boolean(options?.length && answerIndex >= 0 && options[answerIndex]);
        const longTypes = new Set(["long-answer", "proof", "multi-part", "diagram", "graph"]);
        const type: QType = isMcq ? "mcq" : longTypes.has(source.questionType) ? "long" : "short";
        const sourceNote = `${source.subject} · ${source.chapterTitle} · printed page ${source.sourcePage}`;
        return {
          id: `ebook-${source.id}-${index}`,
          type,
          question: printed.question,
          options: isMcq ? options : undefined,
          answer: isMcq ? options![answerIndex] : printed.answer || `Evaluate the response by solving this exact CBSE Class 11 ${source.subject} ebook question.`,
          explanation: source.answerExplanation || sourceNote,
          marks: type === "mcq" ? 1 : type === "long" ? 5 : 3,
        };
      });
      setReviewQs(mapped);
      setReviewSource("ebook");
      toast.success(`Loaded ${mapped.length} exact printed e-book questions.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load e-book questions.");
    } finally {
      setEbookGenerating(false);
    }
  };

  const startExamFromReview = () => {
    if (!reviewQs) return;
    setExamQs(reviewQs);
    setResponses({});
    setExamIdx(0);
    setRemaining(config.duration * 60);
    setExamActive(true);
    setExamStartedAt(Date.now());
    setResult(null);
    setReviewQs(null);
    toast.success(`Paper started! ${reviewQs.length} questions • ${config.duration} min`, { description: "Good luck — focus and pace yourself." });
  };

  const regenerateFromReview = () => {
    setReviewQs(null);
    if (reviewSource === "ebook") void generateEbookPaper();
    else void generatePaper();
  };

  // ===== Auto-evaluate =====
  const endExam = async (autoSubmit = false) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setExamActive(false);
    setEvaluating(true);
    if (autoSubmit) toast("Time's up — auto-submitting your paper…");
    try {
      if (!examQs) return;
      // MCQs are objectively marked. For descriptive, ask AI to mark against the model answer.
      const descriptive = examQs.filter((q) => q.type !== "mcq" && responses[q.id]?.trim());
      let aiMarks: Record<string, { score: number; feedback: string }> = {};
      if (descriptive.length > 0) {
        const prompt = `You are a CBSE Class ${scholarClass} examiner. Mark each descriptive answer against its model answer.
For each: assign a score (0 to max marks, can be half-integer) and a one-sentence feedback.

${descriptive.map((q, i) => `QUESTION ${i + 1} (marks: ${q.marks}, type: ${q.type}):
Q: ${q.question}
Model answer: ${q.answer}
Student's answer: ${responses[q.id]}
`).join("\n")}

Return strict JSON: {"results":[{"index":number,"score":number,"feedback":string}]}`;
        const aiRes = await askAIJSON<{ results: { index: number; score: number; feedback: string }[] }>(prompt, "default");
        if (aiRes?.results) {
          aiRes.results.forEach((r) => {
            const q = descriptive[r.index - 1];
            if (q) aiMarks[q.id] = { score: r.score, feedback: r.feedback };
          });
        }
      }
      // Compute final scores
      const marked: ExamQuestion[] = examQs.map((q) => {
        if (q.type === "mcq") {
          const ua = responses[q.id] ?? "";
          const correct = ua !== "" && ua === q.answer;
          return { ...q, userAnswer: ua, aiMarkedScore: correct ? q.marks : 0, aiFeedback: correct ? "Correct." : `Correct answer: ${q.answer}` };
        } else {
          const m = aiMarks[q.id] ?? { score: 0, feedback: "No answer submitted." };
          return { ...q, userAnswer: responses[q.id] ?? "", aiMarkedScore: m.score, aiFeedback: m.feedback };
        }
      });
      const totalMarks = marked.reduce((a, q) => a + q.marks, 0);
      const score = marked.reduce((a, q) => a + (q.aiMarkedScore ?? 0), 0);
      const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
      const timeSpent = Math.floor((Date.now() - examStartedAt) / 1000);
      // Rank prediction (simulated)
      const classSize = 60;
      const predictedRank = Math.max(1, Math.round(classSize * (1 - percentage / 100) * 0.7));
      const band = percentage >= 90 ? "Outstanding" : percentage >= 75 ? "Distinction" : percentage >= 60 ? "First Class" : percentage >= 40 ? "Pass" : "Needs Work";
      const mr: MockResult = {
        id: Math.random().toString(36).slice(2) + Date.now().toString(36),
        config, questions: marked, score, total: totalMarks, percentage, timeSpent,
        predictedRank, band, at: Date.now(),
      };
      const next = [mr, ...history].slice(0, 30);
      setHistory(next); saveHistory(scholarClass, next);
      addXP(15);
      addCoins(5);
      pushActivity({ type: "exam", text: `Mock exam: ${config.subject} — ${percentage}% (${band})`, icon: "📝" });
      setResult(mr);
      if (percentage >= 90) toast.success(`Outstanding! ${percentage}% • Rank ~${predictedRank}`, { description: "+15 XP · +5 coins" });
      else if (percentage >= 60) toast.success(`Mock complete: ${percentage}% • Rank ~${predictedRank}`, { description: "+15 XP · +5 coins" });
      else toast(`Mock complete: ${percentage}%`, { description: "Review your mistakes and try again — every mock counts." });
    } catch {
      toast.error("Could not evaluate paper.");
    } finally { setEvaluating(false); }
  };

  // Timer
  useEffect(() => {
    if (!examActive) return;
    timerRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { endExam(true); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [examActive, examQs]);

  const fmtTime = (s: number) => {
    const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  // Leaderboard (insert your latest score)
  const leaderboard = useMemo(() => {
    if (history.length === 0) return LEADERBOARD_SEED;
    const latest = history[0];
    const you = { name: "You", school: "Scholar", score: latest.percentage, you: true };
    const merged = [...LEADERBOARD_SEED, you].sort((a, b) => b.score - a.score);
    return merged;
  }, [history]);

  const exportResult = (r?: MockResult) => {
    const res = r ?? result;
    if (!res) return;
    const bodyHtml = mdToHtml(`# Mock Exam Report — ${res.config.subject}

**Date:** ${new Date(res.at).toLocaleString()}
**Score:** ${res.score} / ${res.total} (${res.percentage}%) — ${res.band}
**Time Spent:** ${fmtTime(res.timeSpent)}
**Predicted Class Rank:** ~${res.predictedRank} of 60

## Configuration
- Difficulty: ${res.config.difficulty}
- Duration: ${res.config.duration} min
- Questions: ${res.config.numQuestions} (${res.config.pattern})

## Per-Question Breakdown
${res.questions.map((q, i) => `### Q${i + 1}. [${q.type.toUpperCase()} • ${q.marks} mark${q.marks > 1 ? "s" : ""}]
${q.question}

**Your answer:** ${q.userAnswer || "_(blank)_"}
**Score:** ${q.aiMarkedScore ?? 0} / ${q.marks}
${q.type === "mcq" ? `**Correct answer:** ${q.answer}` : `**Model answer:** ${q.answer}`}
**Feedback:** ${q.aiFeedback ?? "—"}`).join("\n\n")}

> Generated by Scholar Mock Exam Center.`);
    exportPDF({ title: `Mock Exam — ${res.config.subject}`, subtitle: `${res.percentage}% • ${res.band} • Rank ~${res.predictedRank}`, bodyHtml, accent: SUBJECT_OPTS.find((s) => s.id === res.config.subjectId)?.accent ?? "#6366f1", scholarClass });
    toast.success("Exporting mock exam report…");
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&display=swap');
        .me-font-serif { font-family: 'Instrument Serif', serif; }
        .me-font-body { font-family: 'Inter', sans-serif; }
        .me-glass { background: rgba(255,255,255,0.04); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.12); box-shadow: inset 0 1px 1px rgba(255,255,255,0.08); color: white; }
        .me-glass-strong { background: rgba(255,255,255,0.07); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.16); box-shadow: inset 0 1px 1px rgba(255,255,255,0.1); color: white; }
        .me-glass input, .me-glass textarea, .me-glass select { background: rgba(255,255,255,0.05) !important; border-color: rgba(255,255,255,0.15) !important; color: white !important; }
        .me-glass input::placeholder, .me-glass textarea::placeholder { color: rgba(255,255,255,0.4) !important; }
        .me-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .me-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
      `}</style>

      <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover z-0">
        <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 z-0 bg-black/55" />

      <div className="relative z-10 me-font-body p-4 md:p-8 lg:p-12 max-w-7xl mx-auto">
        {/* HERO */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="grid place-items-center h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-violet-500/30 text-indigo-300 border border-white/10">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40">AI Paper Generation • CBSE Class {scholarClass}</Badge>
          </div>
          <h1 className="me-font-serif text-5xl md:text-6xl text-white leading-tight">
            Mock Exam <em className="text-indigo-300">Center</em>
          </h1>
          <p className="text-white/70 mt-3 max-w-2xl">
            Generate full CBSE-style mock papers, take them under timed conditions, get AI auto-evaluation
            of descriptive answers, view rank prediction, and compete on the leaderboard.
          </p>
        </motion.div>

        {/* STAT PILLS */}
        <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { icon: Trophy, label: "Average Score", value: `${avgScore}%`, accent: "#6366f1" },
            { icon: Award, label: "Best Score", value: `${bestScore}%`, accent: "#f59e0b" },
            { icon: ClipboardCheck, label: "Mocks Taken", value: totalAttempts, accent: "#10b981" },
            { icon: Target, label: "Avg Mastery", value: `${Math.round(avgMastery)}%`, accent: "#f43f5e" },
          ].map((s, i) => (
            <motion.div key={i} variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
              <StatCard icon={s.icon} label={s.label} value={s.value} accent={s.accent} />
            </motion.div>
          ))}
        </motion.div>

        <Tabs defaultValue="generate" className="space-y-6">
          <TabsList className="me-glass bg-transparent h-auto p-1 flex flex-wrap gap-1">
            <TabsTrigger value="generate" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">Generate</TabsTrigger>
            <TabsTrigger value="past" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">Past Mocks</TabsTrigger>
            <TabsTrigger value="leaderboard" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">Leaderboard</TabsTrigger>
          </TabsList>

          {/* ===== GENERATE ===== */}
          <TabsContent value="generate" className="space-y-6">
            {/* Config */}
            <div className="me-glass rounded-2xl p-5 md:p-6">
              <h3 className="text-white font-semibold flex items-center gap-2 mb-4"><Settings className="h-4 w-4 text-indigo-300" /> Exam Configuration</h3>

              <div className="grid md:grid-cols-2 gap-5">
                {/* Subject */}
                <div>
                  <label className="text-xs uppercase tracking-wider text-white/50 mb-2 block">Subject</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {SUBJECT_OPTS.map((s) => (
                      <button key={s.id}
                        onClick={() => setConfig((c) => ({ ...c, subjectId: s.id, subject: s.name }))}
                        className={cn("px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left",
                          config.subjectId === s.id ? "border-white/40 bg-white/10 text-white" : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.07]")}>
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Difficulty */}
                <div>
                  <label className="text-xs uppercase tracking-wider text-white/50 mb-2 block">Difficulty</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["easy", "medium", "hard"] as const).map((d) => (
                      <button key={d}
                        onClick={() => setConfig((c) => ({ ...c, difficulty: d }))}
                        className={cn("px-3 py-2 rounded-lg text-xs font-medium border transition-all capitalize",
                          config.difficulty === d ? "border-white/40 bg-white/10 text-white" : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.07]")}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <label className="text-xs uppercase tracking-wider text-white/50 mb-2 block">Duration: {config.duration} min</label>
                  <input type="range" min={10} max={90} step={5} value={config.duration}
                    onChange={(e) => setConfig((c) => ({ ...c, duration: Number(e.target.value) }))}
                    className="w-full accent-indigo-400" />
                  <div className="flex justify-between text-[10px] text-white/40 mt-1">
                    <span>10 min</span><span>45 min</span><span>90 min</span>
                  </div>
                </div>

                {/* Num questions */}
                <div>
                  <label className="text-xs uppercase tracking-wider text-white/50 mb-2 block">Questions: {config.numQuestions}</label>
                  <input type="range" min={5} max={30} step={1} value={config.numQuestions}
                    onChange={(e) => setConfig((c) => ({ ...c, numQuestions: Number(e.target.value) }))}
                    className="w-full accent-indigo-400" />
                  <div className="flex justify-between text-[10px] text-white/40 mt-1">
                    <span>5</span><span>15</span><span>30</span>
                  </div>
                </div>

                {/* Pattern */}
                <div className="md:col-span-2">
                  <label className="text-xs uppercase tracking-wider text-white/50 mb-2 block">Pattern</label>
                  <div className="grid sm:grid-cols-3 gap-1.5">
                    {PATTERNS.map((p) => (
                      <button key={p.id}
                        onClick={() => setConfig((c) => ({ ...c, pattern: p.id }))}
                        className={cn("p-3 rounded-lg border transition-all text-left",
                          config.pattern === p.id ? "border-white/40 bg-white/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]")}>
                        <p className="text-sm text-white font-medium">{p.name}</p>
                        <p className="text-xs text-white/50 mt-0.5">{p.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Exam Scope */}
                <div className="md:col-span-2">
                  <label className="text-xs uppercase tracking-wider text-white/50 mb-2 block">Exam Scope</label>
                  <div className="grid sm:grid-cols-3 gap-1.5">
                    {([
                      { id: "chapter", name: "Chapter-wise", desc: "Pick specific chapters to test" },
                      { id: "subject", name: "Full Subject", desc: "Questions across the whole syllabus" },
                      { id: "jee", name: "JEE Concept Test", desc: "Class 11 only · advanced JEE level" },
                    ] as const).map((t) => (
                      <button key={t.id}
                        onClick={() => setConfig((c) => ({ ...c, examType: t.id, chapterIds: t.id === "chapter" ? c.chapterIds : [] }))}
                        className={cn("p-3 rounded-lg border transition-all text-left",
                          config.examType === t.id ? "border-white/40 bg-white/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]")}>
                        <p className="text-sm text-white font-medium">{t.name}</p>
                        <p className="text-xs text-white/50 mt-0.5">{t.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chapter multi-select */}
                {config.examType === "chapter" && (
                  <div className="md:col-span-2">
                    <label className="text-xs uppercase tracking-wider text-white/50 mb-2 flex items-center justify-between">
                      <span>Select Chapters ({config.chapterIds.length} selected)</span>
                      <div className="flex gap-2">
                        <button onClick={() => { const subj = CURRICULUM.find((s) => s.id === config.subjectId); setConfig((c) => ({ ...c, chapterIds: subj?.chapters.map((ch) => ch.id) ?? [] })); }} className="text-[10px] text-indigo-300 hover:text-indigo-200">Select All</button>
                        <button onClick={() => setConfig((c) => ({ ...c, chapterIds: [] }))} className="text-[10px] text-white/40 hover:text-white/60">Clear</button>
                      </div>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto me-scroll p-1 rounded-lg border border-white/10 bg-white/[0.02]">
                      {(CURRICULUM.find((s) => s.id === config.subjectId)?.chapters ?? []).map((ch) => {
                        const checked = config.chapterIds.includes(ch.id);
                        return (
                          <button key={ch.id}
                            onClick={() => setConfig((c) => ({ ...c, chapterIds: checked ? c.chapterIds.filter((id) => id !== ch.id) : [...c.chapterIds, ch.id] }))}
                            className={cn("px-2.5 py-2 rounded-md text-xs text-left border transition-all flex items-start gap-2",
                              checked ? "border-indigo-400/50 bg-indigo-500/15 text-white" : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.07]")}>
                            <span className={cn("shrink-0 mt-0.5 h-3 w-3 rounded border", checked ? "bg-indigo-500 border-indigo-400" : "border-white/30")}>
                              {checked && <span className="block text-white text-[10px] leading-none text-center pt-px">✓</span>}
                            </span>
                            <span className="line-clamp-2">{ch.title}</span>
                          </button>
                        );
                      })}
                    </div>
                    {config.chapterIds.length === 0 && <p className="text-[10px] text-amber-300/70 mt-1">⚠ Select at least 1 chapter, or switch to "Full Subject" scope.</p>}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/10">
                <div className="text-xs text-white/50">
                  {config.numQuestions} questions • {config.duration} min • {config.difficulty} • {config.pattern}
                  {config.examType === "chapter" && config.chapterIds.length > 0 && <span className="text-indigo-300"> • {config.chapterIds.length} chapter{config.chapterIds.length === 1 ? "" : "s"}</span>}
                  {config.examType === "jee" && <span className="text-fuchsia-300"> • JEE mode</span>}
                </div>
                <Button className="bg-indigo-500 hover:bg-indigo-600 text-white" disabled={generating || (config.examType === "chapter" && config.chapterIds.length === 0)} onClick={generatePaper}>
                  {generating ? (
                    <><motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="inline-block"><Sparkles className="h-4 w-4 mr-2" /></motion.span> Generating…</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" /> Generate Paper</>
                  )}
                </Button>
              </div>

              <div className="mt-5 rounded-2xl border border-violet-300/20 bg-violet-500/[0.07] p-4">
                <div className="mb-3 flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-400/15 text-violet-200"><BookOpen className="h-4 w-4" /></div>
                  <div><h4 className="text-sm font-semibold text-white">E-Book Question Mock Test</h4><p className="mt-0.5 text-xs leading-5 text-white/50">Build a paper only from questions printed in the bundled Mathematics and Chemistry e-books. No question wording is generated or rewritten.</p></div>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <button onClick={() => setEbookMode("chapter")} className={cn("rounded-xl border p-3 text-left", ebookMode === "chapter" ? "border-violet-300/40 bg-violet-400/15" : "border-white/10 bg-white/[0.03]")}><span className="text-sm font-medium text-white">Chapter-wise</span><span className="mt-0.5 block text-[11px] text-white/45">Choose one exact ebook chapter</span></button>
                  <button onClick={() => setEbookMode("mixed")} className={cn("rounded-xl border p-3 text-left", ebookMode === "mixed" ? "border-violet-300/40 bg-violet-400/15" : "border-white/10 bg-white/[0.03]")}><span className="text-sm font-medium text-white">Mixed E-Books</span><span className="mt-0.5 block text-[11px] text-white/45">Mix all available books and chapters</span></button>
                  <button onClick={() => void generateEbookPaper()} disabled={ebookGenerating} className="flex items-center justify-center gap-2 rounded-xl border border-violet-300/25 bg-violet-500/20 px-4 py-3 text-sm font-semibold text-violet-100 hover:bg-violet-500/30 disabled:opacity-50">{ebookGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Create E-Book Paper</button>
                </div>
                {ebookMode === "chapter" && <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <select aria-label="E-book mock exam book" value={ebookBookId} onChange={(event) => { const id = event.target.value; setEbookBookId(id); setEbookChapterId(EBOOK_QUESTION_BOOKS.find((book) => book.id === id)?.chapters[0]?.id ?? ""); }} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white">{EBOOK_QUESTION_BOOKS.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select>
                  <select aria-label="E-book mock exam chapter" value={ebookChapterId} onChange={(event) => setEbookChapterId(event.target.value)} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white">{EBOOK_QUESTION_BOOKS.find((book) => book.id === ebookBookId)?.chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select>
                </div>}
              </div>

              {generationError && (
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <p className="text-sm font-semibold text-amber-200">AI paper generation is unavailable.</p>
                  <p className="text-xs text-white/60 mt-1">Generate using Scholar's local question bank.</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button size="sm" variant="outline" onClick={generatePaper} disabled={generating}>Retry AI</Button>
                    <Button size="sm" variant="outline" onClick={generateLocalPaper}>Generate using Scholar's local question bank</Button>
                    <Button size="sm" variant="ghost" onClick={() => setGenerationError(false)}>Cancel</Button>
                  </div>
                </div>
              )}

              {/* Review screen */}
              {reviewQs && (
                <div className="me-glass-strong rounded-2xl p-5 md:p-6 mt-4 border border-indigo-500/30">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div>
                      <h3 className="text-white font-semibold flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-emerald-400" /> Review Generated Paper</h3>
                      <p className="text-xs text-white/60 mt-0.5">{reviewQs.length} questions · {reviewQs.reduce((a, q) => a + q.marks, 0)} marks · {config.duration} min · {reviewSource === "ai" ? "AI generated" : reviewSource === "ebook" ? "Exact e-book questions" : "Local question bank"}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="outline" onClick={regenerateFromReview} disabled={generating} className="border-white/20 text-white/70 hover:bg-white/5"><RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Regenerate</Button>
                      <Button onClick={() => setReviewQs(null)} variant="ghost" className="text-white/60 hover:bg-white/5">Discard</Button>
                      <Button onClick={startExamFromReview} className="bg-emerald-500 hover:bg-emerald-600 text-white"><Play className="h-3.5 w-3.5 mr-1.5 fill-white" /> Start Exam</Button>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto me-scroll pr-1">
                    {reviewQs.map((q, i) => (
                      <div key={q.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                        <div className="flex items-start gap-2 mb-1.5">
                          <span className="shrink-0 text-xs font-bold text-white/50 tabular-nums">Q{i + 1}</span>
                          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 uppercase tracking-wider">{q.type}</span>
                          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300">{q.marks} marks</span>
                          <p className="text-sm text-white flex-1">{q.question}</p>
                        </div>
                        {q.options && (
                          <ul className="ml-6 space-y-0.5 text-xs text-white/60">
                            {q.options.map((opt, oi) => (
                              <li key={oi} className={cn("flex gap-2", opt === q.answer && "text-emerald-300 font-medium")}>
                                <span className="font-semibold">{String.fromCharCode(65 + oi)}.</span> {opt}
                                {opt === q.answer && <span className="text-[10px] text-emerald-400">✓ correct</span>}
                              </li>
                            ))}
                          </ul>
                        )}
                        {!q.options && <p className="ml-6 text-xs text-emerald-200/70 mt-1"><span className="font-semibold">Model answer:</span> {q.answer}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ===== PAST MOCKS ===== */}
          <TabsContent value="past" className="space-y-4">
            <div className="me-glass rounded-2xl p-4">
              <h3 className="text-white font-semibold flex items-center gap-2"><History className="h-4 w-4 text-indigo-300" /> Past Mocks</h3>
              <p className="text-xs text-white/60 mt-0.5">{history.length} mock exams stored locally.</p>
            </div>
            {history.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title="No mocks yet" description="Generate your first mock exam from the Generate tab — your results and rank predictions will appear here." />
            ) : (
              <div className="space-y-3 max-h-[70vh] overflow-y-auto me-scroll pr-2">
                {history.map((h, i) => (
                  <motion.div key={h.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}
                    className="me-glass rounded-2xl p-5 flex items-center gap-4 flex-wrap">
                    <ProgressRing value={h.percentage} size={64} stroke={6}
                      color={h.percentage >= 75 ? "#10b981" : h.percentage >= 50 ? "#f59e0b" : "#f43f5e"}
                      label={<span className="text-[11px] text-white font-semibold">{h.percentage}%</span>} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40">{h.config.subject}</Badge>
                        <Badge variant="outline" className="border-white/20 text-white/70 capitalize">{h.band}</Badge>
                      </div>
                      <p className="text-sm text-white/70">{h.score} / {h.total} marks • {h.config.numQuestions} Q • {fmtTime(h.timeSpent)}</p>
                      <p className="text-xs text-white/50 mt-0.5">{new Date(h.at).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white/50">Predicted Rank</p>
                      <p className="text-lg font-bold text-white">~{h.predictedRank}<span className="text-xs text-white/50">/60</span></p>
                    </div>
                    <Button size="sm" variant="ghost" className="text-white/70" onClick={() => exportResult(h)}>
                      <Download className="h-3.5 w-3.5 mr-1.5" /> Export
                    </Button>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ===== LEADERBOARD ===== */}
          <TabsContent value="leaderboard" className="space-y-4">
            <div className="me-glass rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <div className="grid place-items-center h-10 w-10 rounded-xl bg-amber-500/20 text-amber-300">
                  <Crown className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-white font-semibold flex items-center gap-2">Class Leaderboard</h3>
                  <p className="text-xs text-white/60 mt-0.5">Simulated peer comparison based on your latest mock score. Aim for the top!</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {leaderboard.map((p, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className={cn("me-glass rounded-xl p-4 flex items-center gap-3",
                    p.you && "ring-2 ring-amber-400/70 bg-amber-500/10")}>
                  <div className={cn("grid place-items-center h-9 w-9 rounded-full font-bold text-sm shrink-0",
                    i === 0 ? "bg-amber-500/30 text-amber-300" :
                    i === 1 ? "bg-gray-400/30 text-gray-200" :
                    i === 2 ? "bg-orange-700/40 text-orange-200" :
                    "bg-white/10 text-white/60")}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium truncate", p.you ? "text-amber-200" : "text-white")}>
                      {p.name} {p.you && <span className="text-xs">← you</span>}
                    </p>
                    <p className="text-xs text-white/50 truncate">{p.school}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-white tabular-nums">{p.score}<span className="text-xs text-white/50">%</span></p>
                  </div>
                </motion.div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* ===== EXAM RUNNER DIALOG ===== */}
        <Dialog open={examActive || evaluating || !!result} onOpenChange={(o) => {
          if (!o && examActive) {
            if (confirm("Submit your mock exam now? You cannot resume it later.")) endExam(false);
          }
        }}>
          <DialogContent className="me-glass-strong !bg-black/70 !border-white/20 max-w-3xl max-h-[92vh] overflow-y-auto">
            {/* Exam in progress */}
            {examActive && examQs && !result && (
              <>
                <DialogHeader>
                  <DialogTitle className="me-font-serif text-2xl text-white flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-indigo-300" /> {config.subject} Mock
                  </DialogTitle>
                  <DialogDescription className="text-white/70">
                    {config.numQuestions} questions • {config.difficulty} • {config.pattern}
                  </DialogDescription>
                </DialogHeader>

                {/* Top bar: progress + timer */}
                <div className="flex items-center justify-between mb-4 sticky top-0 z-10 bg-black/40 backdrop-blur p-2 -mx-2 rounded-lg">
                  <div className="text-sm text-white/70">Q {examIdx + 1} of {examQs.length}</div>
                  <div className={cn("text-2xl font-mono tabular-nums flex items-center gap-2",
                    remaining < 60 ? "text-rose-400" : remaining < 300 ? "text-amber-300" : "text-emerald-300")}>
                    <Timer className="h-5 w-5" /> {fmtTime(remaining)}
                  </div>
                </div>
                <Progress value={((examIdx + 1) / examQs.length) * 100} className="mb-6 bg-white/10 h-1.5" />

                {examQs[examIdx] && (
                  <div>
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <Badge variant="outline" className="border-white/20 text-white/70 uppercase">{examQs[examIdx].type}</Badge>
                      <span className="text-xs text-white/50">{examQs[examIdx].marks} mark{examQs[examIdx].marks > 1 ? "s" : ""}</span>
                    </div>
                    <p className="text-white text-lg mb-5 leading-relaxed">{examQs[examIdx].question}</p>
                    {examQs[examIdx].options ? (
                      <div className="grid sm:grid-cols-2 gap-2">
                        {examQs[examIdx].options!.map((o) => {
                          const selected = responses[examQs[examIdx].id] === o;
                          return (
                            <button key={o}
                              onClick={() => setResponses((r) => ({ ...r, [examQs[examIdx].id]: o }))}
                              className={cn("text-left p-3 rounded-xl border text-sm transition-all",
                                selected ? "bg-indigo-500/25 border-indigo-500/50 text-white" : "bg-white/[0.03] border-white/10 text-white/80 hover:bg-white/[0.07]")}>
                              {o}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <Textarea rows={examQs[examIdx].type === "long" ? 10 : 5}
                        placeholder={`Write your ${examQs[examIdx].type} answer…`}
                        value={responses[examQs[examIdx].id] ?? ""}
                        onChange={(e) => setResponses((r) => ({ ...r, [examQs[examIdx].id]: e.target.value }))}
                        className="bg-white/5 border-white/15 text-white resize-y" />
                    )}
                  </div>
                )}

                {/* Question palette */}
                <div className="mt-6 pt-4 border-t border-white/10">
                  <p className="text-xs text-white/50 mb-2">Question palette</p>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto me-scroll">
                    {examQs.map((q, i) => {
                      const answered = !!(responses[q.id]?.trim());
                      const isCurrent = i === examIdx;
                      return (
                        <button key={q.id}
                          onClick={() => setExamIdx(i)}
                          className={cn("h-8 w-8 rounded-lg text-xs font-medium transition-all",
                            isCurrent ? "ring-2 ring-indigo-400" : "",
                            answered ? "bg-emerald-500/30 text-emerald-200" : "bg-white/10 text-white/60")}>
                          {i + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <DialogFooter className="mt-4 flex items-center justify-between !justify-between">
                  <Button variant="ghost" className="text-white/70" disabled={examIdx === 0} onClick={() => setExamIdx((i) => Math.max(0, i - 1))}>
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
                  </Button>
                  <div className="flex gap-2">
                    {examIdx < examQs.length - 1 ? (
                      <Button className="bg-indigo-500 hover:bg-indigo-600 text-white" onClick={() => setExamIdx((i) => Math.min(examQs.length - 1, i + 1))}>
                        Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    ) : (
                      <Button className="bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => endExam(false)}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Submit exam
                      </Button>
                    )}
                  </div>
                </DialogFooter>
              </>
            )}

            {/* Evaluating */}
            {evaluating && !examActive && (
              <div className="py-16 text-center">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} className="inline-block">
                  <Brain className="h-12 w-12 text-indigo-300" />
                </motion.div>
                <p className="text-white font-medium mt-4">AI is evaluating your paper…</p>
                <p className="text-white/60 text-sm mt-1">Marking descriptive answers against model responses.</p>
              </div>
            )}

            {/* Results */}
            {result && !examActive && !evaluating && (
              <>
                <DialogHeader>
                  <DialogTitle className="me-font-serif text-3xl text-white text-center">
                    Mock <em>Complete</em>
                  </DialogTitle>
                </DialogHeader>

                {/* Score hero */}
                <div className="text-center py-4">
                  <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", duration: 0.6 }}
                    className="inline-block mb-3">
                    <ProgressRing value={result.percentage} size={140} stroke={12}
                      color={result.percentage >= 75 ? "#10b981" : result.percentage >= 50 ? "#f59e0b" : "#f43f5e"}
                      label={
                        <div className="text-center">
                          <p className="text-3xl font-bold tabular-nums" style={{ color: result.percentage >= 75 ? "#10b981" : result.percentage >= 50 ? "#f59e0b" : "#f43f5e" }}>{result.percentage}%</p>
                          <p className="text-xs text-white/60 mt-0.5">{result.score}/{result.total}</p>
                        </div>
                      } />
                  </motion.div>
                  <Badge variant="outline" className="border-white/20 text-white mb-2">{result.band}</Badge>
                  <div className="grid grid-cols-3 gap-3 max-w-md mx-auto mt-4">
                    <div className="bg-white/[0.04] rounded-xl p-3 border border-white/10">
                      <p className="text-xs text-white/50">Time</p>
                      <p className="text-white font-semibold">{fmtTime(result.timeSpent)}</p>
                    </div>
                    <div className="bg-white/[0.04] rounded-xl p-3 border border-white/10">
                      <p className="text-xs text-white/50">Rank</p>
                      <p className="text-white font-semibold">~{result.predictedRank}/60</p>
                    </div>
                    <div className="bg-white/[0.04] rounded-xl p-3 border border-white/10">
                      <p className="text-xs text-white/50">XP</p>
                      <p className="text-emerald-300 font-semibold">+15</p>
                    </div>
                  </div>
                </div>

                {/* Per-question review */}
                <div className="space-y-3 max-h-64 overflow-y-auto me-scroll pr-2">
                  <p className="text-xs uppercase tracking-wider text-white/50">Per-question review</p>
                  {result.questions.map((q, i) => {
                    const full = q.aiMarkedScore === q.marks;
                    const partial = !full && (q.aiMarkedScore ?? 0) > 0;
                    const zero = (q.aiMarkedScore ?? 0) === 0;
                    return (
                      <div key={q.id} className={cn("p-3 rounded-xl border flex items-start gap-2",
                        full ? "bg-emerald-500/10 border-emerald-500/30" :
                        partial ? "bg-amber-500/10 border-amber-500/30" :
                        "bg-rose-500/10 border-rose-500/30")}>
                        {full ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /> :
                         zero ? <XCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" /> :
                         <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />}
                        <div className="text-sm flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-white/50">Q{i + 1} ({q.type})</span>
                            <span className="text-white/60 tabular-nums">{q.aiMarkedScore}/{q.marks}</span>
                          </div>
                          <p className="text-white/80 line-clamp-2">{q.question}</p>
                          <p className="text-xs text-white/50 mt-1 line-clamp-1">{q.aiFeedback}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <DialogFooter className="mt-4 gap-2">
                  <Button variant="outline" className="border-white/20 text-white hover:bg-white/10" onClick={() => exportResult()}>
                    <Download className="h-3.5 w-3.5 mr-1.5" /> Export
                  </Button>
                  <Button className="bg-indigo-500 hover:bg-indigo-600 text-white" onClick={() => { setResult(null); setExamQs(null); }}>
                    Done
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export default MockExamView;
