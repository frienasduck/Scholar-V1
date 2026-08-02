"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useStore } from "@/lib/store";
import { useCurriculum } from "@/lib/use-curriculum";
import { loadSubjectQuizzes } from "@/lib/quizzes-loader";
import { CLASS11_QUIZ_META, getQuizCountBySubject } from "@/lib/quizzes-class11-meta";
import type { QuizMCQ } from "@/lib/quizzes-physics";
import { askAIJSON } from "@/lib/ai";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Zap, Target, Clock, Check, X, ChevronLeft, ChevronRight,
  Send, RotateCcw, Award, Brain, ListChecks, Trophy, AlertCircle,
  Search, Loader2, Video, VideoOff, BookOpen, Save, Trash2, Play, NotebookPen,
  Layers,
} from "lucide-react";
import { toast } from "@/lib/notifications/notification-api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScholarAIContent } from "@/components/ai/scholar-ai-content";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  SUBJECT_INFO, SUBJECT_ORDER, TYPE_INFO, DIFFICULTY_INFO,
  VIDEO_URL, loadVideoPref, saveVideoPref,
  shuffle, fmtTime, uid, toQuizQuestions,
} from "./quiz-utils";
import { profileGetJSON, profileSetJSON } from "@/lib/profile-storage";
import { EBOOK_QUESTION_BOOKS, loadEbookQuestions, toEbookQuizQuestion } from "@/lib/ebook-question-bank";
import {
  loadQuizMistakes,
  saveQuizMistakes,
  type SavedQuizMistake,
} from "@/lib/quiz-mistakes";
import {
  beginBackgroundTask,
  completeBackgroundTask,
  failBackgroundTask,
} from "@/lib/background-tasks";

type Phase = "home" | "taking" | "results" | "aiReview";

// ===== localStorage helpers for saved AI questions and mistakes =====
// (profile-scoped via profileGetJSON/profileSetJSON to isolate Class 9/11 data)

function loadCustomQuestions(scholarClass: 9 | 11): any[] {
  if (typeof window === "undefined") return [];
  return profileGetJSON<any[]>(scholarClass, "quiz-custom-questions", []);
}
function saveCustomQuestions(scholarClass: 9 | 11, qs: any[]) {
  profileSetJSON(scholarClass, "quiz-custom-questions", qs);
}
function inferMistakeType(subject: string, question: string, qType: string): string {
  const q = question.toLowerCase();
  if (subject === "physics") {
    if (/unit|\[.*?\]|si unit/.test(q)) return "Unit mistake";
    if (/formula|equation|=/.test(q)) return "Formula mistake";
    if (/graph|slope|area under/.test(q)) return "Graph interpretation mistake";
    if (/sign|direction|positive|negative/.test(q)) return "Sign convention mistake";
    return "Concept mistake";
  }
  if (subject === "chemistry") {
    if (/mole|molar|stoichio/.test(q)) return "Mole calculation mistake";
    if (/formula|equation/.test(q)) return "Formula mistake";
    if (/trend|periodic|electronegativ/.test(q)) return "Trend mistake";
    return "Concept mistake";
  }
  if (subject === "maths") {
    if (/formula|identity/.test(q)) return "Formula mistake";
    if (/solve|find|calculate|value of/.test(q)) return "Calculation mistake";
    if (/condition|domain|range/.test(q)) return "Condition mistake";
    return "Concept mistake";
  }
  if (subject === "cs") {
    if (/output|print/.test(q)) return "Output prediction mistake";
    if (/operator|\/\/|\*\*|%/.test(q)) return "Operator mistake";
    if (/loop|for|while|range/.test(q)) return "Loop logic mistake";
    if (/type|int|str|float|list|dict/.test(q)) return "Data type mistake";
    return "Syntax mistake";
  }
  return "Concept mistake";
}

export function Class11QuizView() {
  const scholarClass = useStore((s) => s.user.scholarClass);
  const quizAttempts = useStore((s) => s.quizAttempts);
  const curriculum = useCurriculum();
  const addQuizAttempt = useStore((s) => s.addQuizAttempt);
  const mastery = useStore((s) => s.mastery);
  const setMastery = useStore((s) => s.setMastery);
  const addXP = useStore((s) => s.addXP);
  const addCoins = useStore((s) => s.addCoins);
  const pushActivity = useStore((s) => s.pushActivity);

  const [phase, setPhase] = useState<Phase>("home");
  const [subject, setSubject] = useState("physics");
  const [chapterId, setChapterId] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [negative, setNegative] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [timeSpent, setTimeSpent] = useState(0);
  const [lastAttempt, setLastAttempt] = useState<any>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [submitConfirm, setSubmitConfirm] = useState(false);
  const [videoOn, setVideoOn] = useState(() => loadVideoPref());
  const [aiDrafts, setAiDrafts] = useState<any[]>([]);
  const [savedMistakeIds, setSavedMistakeIds] = useState<Set<string>>(new Set());
  const [customQuestions, setCustomQuestions] = useState<any[]>(() => loadCustomQuestions(scholarClass));
  const [ebookBookId, setEbookBookId] = useState("class11-maths-part1");
  const [ebookChapterId, setEbookChapterId] = useState("sets");
  const [ebookMode, setEbookMode] = useState<"chapter" | "mixed">("chapter");
  const [ebookLoading, setEbookLoading] = useState(false);

  useEffect(() => {
    const pending = profileGetJSON<any[]>(
      scholarClass,
      "quiz-pending-ai-drafts",
      [],
    );
    if (pending.length) {
      setAiDrafts(pending);
      setPhase("aiReview");
    }
  }, [scholarClass]);

  // Statically-loaded quiz data (no async, no server dependency)
  const quizData = useMemo(() => loadSubjectQuizzes(subject), [subject]);
  const loadingData = false; // data is bundled, always loaded

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  // Timer
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (phase === "taking") {
      tickRef.current = setInterval(() => setTimeSpent(Math.floor((Date.now() - startedAt) / 1000)), 1000);
      return () => { if (tickRef.current) clearInterval(tickRef.current); };
    }
  }, [phase, startedAt]);

  // Filtered questions
  const filteredQuizzes = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return quizData.filter((item) => {
      if (chapterId !== "all" && item.chapterId !== chapterId) return false;
      if (difficulty !== "all" && item.difficulty !== difficulty) return false;
      if (type !== "all" && item.type !== type) return false;
      if (q) {
        const hay = `${item.question} ${item.options.join(" ")} ${item.explanation} ${item.topic} ${(item.tags ?? []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [quizData, chapterId, difficulty, type, debouncedSearch]);

  // Available chapters for selected subject
  const availableChapters = useMemo(() => {
    const subj = curriculum.find((s) => s.id === subject);
    if (!subj) return [];
    const chapterIdsWithData = new Set(CLASS11_QUIZ_META.filter((m) => m.subjectId === subject).map((m) => m.chapterId));
    return (subj.chapters ?? []).filter((ch) => chapterIdsWithData.has(ch.id));
  }, [curriculum, subject]);

  // Stats
  const stats = useMemo(() => {
    const total = quizData.length;
    const filtered = filteredQuizzes.length;
    const easy = filteredQuizzes.filter((q) => q.difficulty === "easy").length;
    const medium = filteredQuizzes.filter((q) => q.difficulty === "medium").length;
    const hard = filteredQuizzes.filter((q) => q.difficulty === "hard").length;
    return { total, filtered, easy, medium, hard };
  }, [quizData, filteredQuizzes]);

  const handleSubjectChange = (s: string) => {
    setSubject(s);
    setChapterId("all");
  };

  // Pre-made quiz deck definitions — surfaced as cards so users see actual content.
  const premadeDecks = useMemo(() => {
    return CLASS11_QUIZ_META.filter((m) => m.subjectId === subject).flatMap((m) => {
      const decks: { id: string; chapterId: string; chapterTitle: string; name: string; count: number; difficulty: string; estMin: number; type: string; color: string }[] = [];
      const quickCount = Math.min(10, m.questionCount);
      decks.push({ id: `${m.chapterId}-quick`, chapterId: m.chapterId, chapterTitle: m.chapterTitle, name: "Quick Check", count: quickCount, difficulty: "Mixed", estMin: Math.ceil(quickCount * 1.5), type: "Concept", color: "#10b981" });
      decks.push({ id: `${m.chapterId}-concepts`, chapterId: m.chapterId, chapterTitle: m.chapterTitle, name: "Concepts", count: Math.min(15, m.questionCount), difficulty: "Easy-Medium", estMin: Math.ceil(Math.min(15, m.questionCount) * 1.5), type: "Concept", color: "#6366f1" });
      decks.push({ id: `${m.chapterId}-numericals`, chapterId: m.chapterId, chapterTitle: m.chapterTitle, name: "Numericals & Formulas", count: Math.min(15, m.questionCount), difficulty: "Medium-Hard", estMin: Math.ceil(Math.min(15, m.questionCount) * 2), type: "Numerical", color: "#f59e0b" });
      decks.push({ id: `${m.chapterId}-full`, chapterId: m.chapterId, chapterTitle: m.chapterTitle, name: "Full Chapter Quiz", count: m.questionCount, difficulty: "Mixed", estMin: Math.ceil(m.questionCount * 1.5), type: "Mixed", color: "#ec4899" });
      return decks;
    });
  }, [subject]);

  const getBestForChapter = (chapterId: string): number | null => {
    const meta = CLASS11_QUIZ_META.find((m) => m.chapterId === chapterId);
    const matching = quizAttempts.filter((a: any) => meta && a.title?.includes(meta.chapterTitle));
    if (matching.length === 0) return null;
    return Math.max(...matching.map((a: any) => Math.round((a.score / a.total) * 100)));
  };

  const startPremadeDeck = (deck: { chapterId: string; name: string; count: number; chapterTitle: string; type?: string }) => {
    const pool = quizData.filter((q) => q.chapterId === deck.chapterId);
    if (pool.length === 0) {
      toast.error(`No questions loaded for "${deck.chapterTitle}".`, { description: "Quiz data could not be loaded. Try refreshing the page." });
      return;
    }

    // Apply mode-specific filtering so deck types are meaningfully different
    let filteredPool = pool;
    if (deck.type === "Concept") {
      // Concepts: prefer conceptual questions, fall back to all
      const concepts = pool.filter((q) => q.type === "concept" || q.type === "true-false");
      filteredPool = concepts.length >= 5 ? concepts : pool;
    } else if (deck.type === "Numerical") {
      // Numericals & Formulas: prefer numerical/formula questions, fall back to all
      const numericals = pool.filter((q) => q.type === "numerical" || q.type === "formula" || q.type === "output");
      filteredPool = numericals.length >= 5 ? numericals : pool;
    }
    // Quick Check and Full Chapter Quiz use the full pool (broad coverage)

    const picked = shuffle(filteredPool).slice(0, Math.min(deck.count, filteredPool.length));
    setQuestions(toQuizQuestions(picked));
    setResponses({});
    setCurrent(0);
    setStartedAt(Date.now());
    setTimeSpent(0);
    setPhase("taking");
    toast.success(`Starting "${deck.name}" — ${picked.length} questions from ${deck.chapterTitle}.`);
  };

  const startQuiz = useCallback(() => {
    if (filteredQuizzes.length === 0) { toast.error("No questions available for these filters"); return; }
    const picked = shuffle(filteredQuizzes).slice(0, Math.min(10, filteredQuizzes.length));
    setQuestions(toQuizQuestions(picked));
    setResponses({});
    setCurrent(0);
    setStartedAt(Date.now());
    setTimeSpent(0);
    setPhase("taking");
  }, [filteredQuizzes]);

  const startEbookQuiz = async () => {
    setEbookLoading(true);
    try {
      const raw = await loadEbookQuestions(ebookMode === "chapter" ? [ebookBookId] : undefined);
      const eligible = raw.filter((q) => {
        if (ebookMode === "chapter" && q.chapterId !== ebookChapterId) return false;
        return Array.isArray(q.options) && q.options.length >= 2 && typeof q.correctOption === "number";
      });
      if (!eligible.length) {
        toast.info("This selection has no printed MCQs with an answer key.", { description: "Choose Mathematics Part 1 or Mixed E-Books. Descriptive ebook questions are available in Mock Exam." });
        return;
      }
      const picked = shuffle(eligible).slice(0, Math.min(10, eligible.length)).map(toEbookQuizQuestion);
      setSubject(ebookMode === "mixed" ? "mixed" : picked[0]?.subject ?? "maths");
      setQuestions(picked);
      setResponses({});
      setCurrent(0);
      setStartedAt(Date.now());
      setTimeSpent(0);
      setPhase("taking");
      toast.success(`Starting an exact e-book quiz with ${picked.length} printed questions.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load e-book questions.");
    } finally {
      setEbookLoading(false);
    }
  };

  const startAIQuiz = async (aiSubject: string, aiChapter: string, count: number, aiDifficulty: string) => {
    const backgroundTaskId = beginBackgroundTask({
      kind: "quiz",
      title: "Generating your quiz",
      message: `Building ${count} chapter questions…`,
      viewId: "quiz",
    });
    setAiLoading(true);
    try {
      const subj = curriculum.find((s) => s.id === aiSubject);
      const ch = subj?.chapters.find((c) => c.id === aiChapter);
      if (!ch) {
        failBackgroundTask(backgroundTaskId, "The selected chapter was not found.");
        toast.error("Chapter not found");
        return;
      }
      const prompt = `Generate ${count} CBSE Class 11 MCQ questions for the chapter "${ch.title}" (${subj?.name}). Difficulty: ${aiDifficulty}. Each question needs: question, 4 options, correctAnswer (must exactly match one option), explanation. Respond ONLY as JSON: {"questions":[{"question":"...","options":["a","b","c","d"],"correctAnswer":"correct option","explanation":"short","topic":"subtopic","difficulty":"${aiDifficulty}","type":"concept"}]}`;
      const data = await askAIJSON<{ questions: any[] }>(prompt, "default", { usage: "quiz_generation" });
      if (!data?.questions?.length) {
        failBackgroundTask(backgroundTaskId, "No usable quiz questions were returned.");
        toast.error("AI did not return questions.");
        return;
      }
      // Validate each question
      const drafts = data.questions.map((q: any, i: number) => {
        const opts = Array.isArray(q.options) ? q.options : [];
        const answer = q.correctAnswer || q.answer || "";
        const hasValidAnswer = answer && opts.includes(answer);
        const hasValidOptions = opts.length === 4;
        const hasQuestion = q.question && q.question.trim().length > 5;
        const hasExplanation = q.explanation && q.explanation.trim().length > 2;
        return {
          id: uid(),
          type: "mcq" as const,
          question: q.question || "",
          options: hasValidOptions ? opts : shuffle([...opts, answer].filter(Boolean)).slice(0, 4),
          answer: hasValidAnswer ? answer : (opts[0] || ""),
          explanation: q.explanation || "",
          subject: aiSubject,
          chapter: aiChapter,
          chapterTitle: ch.title,
          subjectName: subj?.name || "",
          difficulty: aiDifficulty,
          topic: q.topic || "General",
          qType: q.type || "concept",
          tags: Array.isArray(q.tags) ? q.tags : [],
          selected: true,
          valid: hasQuestion && hasValidOptions && hasValidAnswer && hasExplanation,
          createdBy: "ai",
        };
      });
      const validCount = drafts.filter((d) => d.valid).length;
      const invalidCount = drafts.length - validCount;
      setAiDrafts(drafts);
      profileSetJSON(scholarClass, "quiz-pending-ai-drafts", drafts);
      setPhase("aiReview");
      setAiOpen(false);
      if (invalidCount > 0) {
        toast.info(`Generated ${drafts.length} questions (${validCount} valid, ${invalidCount} need review).`);
      } else {
        toast.success(`Generated ${drafts.length} questions. Review and start when ready.`);
      }
      completeBackgroundTask(
        backgroundTaskId,
        `${drafts.length} questions are ready for review.`,
      );
    } catch {
      failBackgroundTask(backgroundTaskId, "Quiz generation failed.");
      toast.error("Could not generate quiz.");
    }
    finally { setAiLoading(false); }
  };

  // Start quiz from AI review with selected drafts
  const startQuizFromDrafts = (draftsToUse: any[]) => {
    const valid = draftsToUse.filter((d) => d.selected && d.question.trim() && d.options.length === 4 && d.answer);
    if (valid.length === 0) { toast.error("No valid questions selected."); return; }
    const qs = valid.map((d) => ({
      id: d.id, type: "mcq" as const, question: d.question, options: d.options,
      answer: d.answer, explanation: d.explanation, subject: d.subject,
      chapter: d.chapter, difficulty: d.difficulty, topic: d.topic,
    }));
    setQuestions(qs);
    setResponses({});
    setCurrent(0);
    setStartedAt(Date.now());
    setTimeSpent(0);
    profileSetJSON(scholarClass, "quiz-pending-ai-drafts", []);
    setPhase("taking");
  };

  // Save AI-generated questions to localStorage
  const saveAIDrafts = (draftsToSave: any[]) => {
    const valid = draftsToSave.filter((d) => d.selected && d.question.trim() && d.options.length === 4 && d.answer);
    if (valid.length === 0) { toast.error("No valid questions to save."); return; }
    const toSave = valid.map((d) => ({
      id: d.id, type: "mcq", question: d.question, options: d.options,
      answer: d.answer, explanation: d.explanation, subject: d.subject,
      chapter: d.chapter, difficulty: d.difficulty, topic: d.topic,
      createdBy: "ai", createdAt: Date.now(),
    }));
    const next = [...customQuestions, ...toSave];
    setCustomQuestions(next);
    saveCustomQuestions(scholarClass, next);
    profileSetJSON(scholarClass, "quiz-pending-ai-drafts", []);
    toast.success(`Saved ${toSave.length} AI-generated questions.`);
  };

  // Save a single wrong answer to mistake notebook
  const saveMistake = (q: any, userAnswer: string) => {
    const mistakes = loadQuizMistakes(scholarClass);
    const mistakeId = `${q.id}-${userAnswer}`;
    if (mistakes.some((m) => m.id === mistakeId)) {
      toast.info("This mistake is already saved.");
      return;
    }
    const mistake: SavedQuizMistake = {
      id: mistakeId,
      questionId: q.id,
      question: q.question,
      userAnswer,
      correctAnswer: q.answer,
      explanation: q.explanation || "",
      subject: q.subject || subject,
      chapter: q.chapter || "",
      difficulty: q.difficulty || "medium",
      mistakeType: inferMistakeType(q.subject || subject, q.question, q.type || "concept"),
      source: "Quiz",
      savedAt: Date.now(),
    };
    mistakes.unshift(mistake);
    saveQuizMistakes(scholarClass, mistakes);
    setSavedMistakeIds((prev) => new Set([...prev, mistakeId]));
    toast.success("Mistake saved to Revision Hub.");
  };

  // Save all wrong answers
  const saveAllMistakes = (attempt: any) => {
    const mistakes = loadQuizMistakes(scholarClass);
    let newCount = 0;
    attempt.questions.forEach((q: any) => {
      const user = attempt.responses[q.id];
      if (user && user !== q.answer) {
        const mistakeId = `${q.id}-${user}`;
        if (!mistakes.some((m) => m.id === mistakeId)) {
          mistakes.unshift({
            id: mistakeId, questionId: q.id, question: q.question,
            userAnswer: user, correctAnswer: q.answer,
            explanation: q.explanation || "", subject: q.subject || subject,
            chapter: q.chapter || "", difficulty: q.difficulty || "medium",
            mistakeType: inferMistakeType(q.subject || subject, q.question, q.type || "concept"),
            source: "Quiz", savedAt: Date.now(),
          });
          newCount++;
        }
      }
    });
    saveQuizMistakes(scholarClass, mistakes);
    const allIds = new Set([...savedMistakeIds]);
    attempt.questions.forEach((q: any) => {
      const user = attempt.responses[q.id];
      if (user && user !== q.answer) allIds.add(`${q.id}-${user}`);
    });
    setSavedMistakeIds(allIds);
    if (newCount > 0) toast.success(`Saved ${newCount} mistake${newCount === 1 ? "" : "s"} to Revision Hub.`);
    else toast.info("All wrong answers are already saved.");
  };

  // Create flashcard from wrong answer
  const createFlashcardFromMistake = (q: any) => {
    try {
      const flashcards = profileGetJSON<any[]>(scholarClass, "fc-custom-cards", []);
      const card = {
        id: `fc-quiz-${q.id}-${Date.now()}`,
        subject: q.subject || subject,
        subjectName: SUBJECT_INFO[q.subject || subject]?.name || "",
        chapterId: q.chapter || "",
        chapter: "",
        topic: "Quiz mistake",
        type: "concept",
        front: q.question,
        back: q.answer,
        explanation: q.explanation || "",
        difficulty: q.difficulty || "medium",
        examImportance: "high",
        tags: ["quiz mistake", "review"],
        custom: true,
      };
      flashcards.unshift(card);
      profileSetJSON(scholarClass, "fc-custom-cards", flashcards);
      toast.success("Flashcard created from this question.");
    } catch {
      toast.error("Could not create flashcard.");
    }
  };

  const handleSubmit = () => {
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
    const subjName = SUBJECT_INFO[subject]?.name ?? "Mixed";

    const attempt = {
      id: uid(),
      subject,
      title: `${subjName} Quiz`,
      questions, responses, score: finalScore, total,
      startedAt, finishedAt: Date.now(), timeSpent: ts,
    };
    addQuizAttempt(attempt);
    addXP(Math.round(finalScore * 5));
    addCoins(Math.round(finalScore));
    pushActivity({ type: "quiz", text: `Scored ${finalScore}/${total} on ${attempt.title}`, icon: "🎯" });
    if (subject) {
      const cur = mastery[subject] ?? 0;
      setMastery(subject, Math.min(100, cur + (finalScore / total) * 4));
    }
    setLastAttempt(attempt);
    setPhase("results");
    setSubmitConfirm(false);
    if (finalScore >= 8) toast.success("🏆 Quiz Champion! Score 8+!");
    else if (finalScore >= 6) toast.success(`Nice — ${finalScore}/${total}!`);
    else toast.info(`Keep practising — ${finalScore}/${total}.`);
  };

  // ===== AI Review Phase =====
  if (phase === "aiReview") {
    return (
      <AIReviewScreen
        drafts={aiDrafts}
        setDrafts={setAiDrafts}
        onStartAll={() => startQuizFromDrafts(aiDrafts)}
        onStartSelected={() => startQuizFromDrafts(aiDrafts.filter((d) => d.selected))}
        onSaveSelected={() => saveAIDrafts(aiDrafts)}
        onBack={() => {
          setPhase("home");
          setAiDrafts([]);
          profileSetJSON(scholarClass, "quiz-pending-ai-drafts", []);
        }}
      />
    );
  }

  // ===== Results Phase =====
  if (phase === "results" && lastAttempt) {
    return (
      <ResultsScreen
        attempt={lastAttempt}
        onRetake={() => { startQuiz(); }}
        onBack={() => { setPhase("home"); setLastAttempt(null); }}
        onSaveMistake={saveMistake}
        onSaveAllMistakes={() => saveAllMistakes(lastAttempt)}
        onCreateFlashcard={createFlashcardFromMistake}
        savedMistakeIds={savedMistakeIds}
      />
    );
  }

  // ===== Taking Phase =====
  if (phase === "taking") {
    return (
      <QuizTakingMode
        questions={questions}
        responses={responses}
        setResponses={setResponses}
        current={current}
        setCurrent={setCurrent}
        timeSpent={timeSpent}
        negative={negative}
        videoOn={videoOn}
        setVideoOn={(v: boolean) => { setVideoOn(v); saveVideoPref(v); }}
        onExit={() => setPhase("home")}
        onSubmit={() => setSubmitConfirm(true)}
        submitConfirm={submitConfirm}
        setSubmitConfirm={setSubmitConfirm}
        handleSubmit={handleSubmit}
        subjectName={SUBJECT_INFO[subject]?.name ?? ""}
      />
    );
  }

  // ===== Home Phase =====
  const lastFive = (quizAttempts ?? []).slice(0, 5);
  const avgScore = quizAttempts.length
    ? Math.round((quizAttempts.reduce((a, b) => a + b.score / b.total, 0) / quizAttempts.length) * 100)
    : 0;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Instrument+Serif:ital@0;1&display=swap');
        .cinema-glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 25px 80px -12px rgba(0,0,0,0.3); color: white; }
        .cinema-glass:hover { background: rgba(255,255,255,0.05); }
        .cinema-font-serif { font-family: 'Instrument Serif', serif; }
      `}</style>
      <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover z-0 opacity-30">
        <source src={VIDEO_URL} type="video/mp4" />
      </video>
      <div className="absolute inset-0 z-0 bg-black/60" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="cinema-font-serif text-3xl sm:text-4xl text-white italic">Quiz</h1>
          <p className="text-sm text-white/50 mt-1">Class 11 chapter-wise MCQ testing · {stats.total} questions loaded</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <div className="cinema-glass rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40 mb-1"><Target className="h-3 w-3" /> Attempts</div>
            <p className="text-lg font-bold text-white">{quizAttempts.length}</p>
          </div>
          <div className="cinema-glass rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40 mb-1"><Award className="h-3 w-3" /> Avg Score</div>
            <p className="text-lg font-bold text-teal-300">{avgScore}%</p>
          </div>
          <div className="cinema-glass rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40 mb-1"><ListChecks className="h-3 w-3" /> Questions</div>
            <p className="text-lg font-bold text-amber-300">{stats.total}</p>
          </div>
          <div className="cinema-glass rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40 mb-1"><Trophy className="h-3 w-3" /> Best</div>
            <p className="text-lg font-bold text-fuchsia-300">{quizAttempts[0] ? `${quizAttempts[0].score}/${quizAttempts[0].total}` : "—"}</p>
          </div>
        </div>

        {/* Subject tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {SUBJECT_ORDER.map((s) => {
            const info = SUBJECT_INFO[s];
            const count = getQuizCountBySubject(s);
            const isActive = subject === s;
            return (
              <button key={s} onClick={() => handleSubjectChange(s)} className={cn("flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all", isActive ? "text-white" : "text-white/50 hover:text-white")} style={isActive ? { background: `${info.color}20`, border: `1px solid ${info.color}40` } : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span>{info.icon}</span> {info.name} <span className="text-[10px] text-white/40">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="cinema-glass rounded-xl p-3 mb-4 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions…" className="w-full rounded-lg bg-white/5 border border-white/10 pl-9 pr-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select value={chapterId} onChange={(e) => setChapterId(e.target.value)} className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/40">
              <option value="all">All Chapters</option>
              {availableChapters.map((ch) => (<option key={ch.id} value={ch.id}>{ch.title}</option>))}
            </select>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/40">
              <option value="all">All Difficulty</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/40">
              <option value="all">All Types</option>
              {Object.entries(TYPE_INFO).map(([k, v]) => (<option key={k} value={k}>{v.label}</option>))}
            </select>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
              <input type="checkbox" checked={negative} onChange={(e) => setNegative(e.target.checked)} className="h-3.5 w-3.5 accent-indigo-500" />
              Negative marking (−0.25 per wrong)
            </label>
            <span className="text-xs text-white/40">
              {loadingData ? "Loading…" : `${stats.filtered} questions available · will pick 10 at random`}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button onClick={startQuiz} disabled={loadingData || stats.filtered === 0} className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-teal-500 text-white font-semibold hover:from-indigo-600 hover:to-teal-600 shadow-lg shadow-indigo-500/25 disabled:opacity-40 transition-all">
            <Brain className="h-4 w-4" /> Start Quiz
          </button>
          <button onClick={() => setAiOpen(true)} className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/30 text-fuchsia-200 hover:bg-fuchsia-500/25 transition-colors">
            <Sparkles className="h-4 w-4" /> AI Generate Quiz
          </button>
        </div>

        {/* Exact questions extracted from the bundled e-books */}
        <div className="cinema-glass mb-4 rounded-2xl p-4">
          <div className="mb-3 flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-200"><BookOpen className="h-4 w-4" /></div>
            <div><h3 className="text-sm font-semibold text-white">E-Book Question Quiz</h3><p className="text-xs leading-5 text-white/45">Uses the exact printed MCQs and answer keys from the bundled e-books—never generated placeholders.</p></div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <select aria-label="E-book quiz mode" value={ebookMode} onChange={(e) => setEbookMode(e.target.value as "chapter" | "mixed")} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white">
              <option value="chapter">Chapter-wise</option><option value="mixed">Mixed E-Books</option>
            </select>
            {ebookMode === "chapter" && <select aria-label="E-book" value={ebookBookId} onChange={(e) => { const id = e.target.value; setEbookBookId(id); setEbookChapterId(EBOOK_QUESTION_BOOKS.find((b) => b.id === id)?.chapters[0]?.id ?? ""); }} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white">{EBOOK_QUESTION_BOOKS.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select>}
            {ebookMode === "chapter" && <select aria-label="E-book chapter" value={ebookChapterId} onChange={(e) => setEbookChapterId(e.target.value)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white">{EBOOK_QUESTION_BOOKS.find((book) => book.id === ebookBookId)?.chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select>}
          </div>
          <button onClick={() => void startEbookQuiz()} disabled={ebookLoading} className="mt-3 flex items-center gap-2 rounded-xl border border-violet-300/25 bg-violet-500/15 px-4 py-2 text-sm font-semibold text-violet-100 transition-colors hover:bg-violet-500/25 disabled:opacity-50">{ebookLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Start E-Book Quiz</button>
        </div>

        {/* Pre-made Quiz Decks */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-4 w-4 text-amber-300" />
            <h3 className="text-sm font-semibold text-white">Pre-made Quiz Decks</h3>
            <span className="text-xs text-white/40">{loadingData ? "Loading…" : `${premadeDecks.length} decks · ${stats.total} questions`}</span>
          </div>
          {loadingData ? (
            <div className="cinema-glass rounded-xl p-4 text-sm text-white/50 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading questions for {SUBJECT_INFO[subject]?.name}…
            </div>
          ) : premadeDecks.length === 0 ? (
            <div className="cinema-glass rounded-xl p-4 text-sm text-white/50">No pre-made quizzes available for {SUBJECT_INFO[subject]?.name} yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {premadeDecks.map((deck) => {
                const best = getBestForChapter(deck.chapterId);
                return (
                  <button key={deck.id} onClick={() => startPremadeDeck(deck)}
                    className="cinema-glass rounded-xl p-3 text-left hover:scale-[1.02] transition-all group"
                    style={{ borderLeft: `3px solid ${deck.color}` }}>
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{deck.name}</p>
                        <p className="text-[11px] text-white/50 truncate">{deck.chapterTitle}</p>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full shrink-0" style={{ background: `${deck.color}22`, color: deck.color }}>{deck.type}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-white/40 mb-2">
                      <span>{deck.count} Qs</span><span>~{deck.estMin} min</span><span>{deck.difficulty}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-white/40">Best: {best === null ? "—" : `${best}%`}</span>
                      <span className="text-[10px] font-semibold text-white/70 group-hover:text-white flex items-center gap-1">Start <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" /></span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent attempts */}
        {lastFive.length > 0 && (
          <div className="cinema-glass rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Recent attempts</h3>
            <div className="space-y-2">
              {lastFive.map((a: any) => {
                const pct = Math.round((a.score / a.total) * 100);
                const color = pct >= 80 ? "#14b8a6" : pct >= 50 ? "#f59e0b" : "#ef4444";
                return (
                  <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.02]">
                    <div className="grid place-items-center h-10 w-10 rounded-full shrink-0" style={{ background: `${color}20` }}>
                      <span className="text-xs font-bold" style={{ color }}>{pct}%</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{a.title}</p>
                      <p className="text-xs text-white/40">{a.score}/{a.total} · {fmtTime(a.timeSpent)} · {new Date(a.finishedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AI Generator Dialog */}
        <AIQuizGeneratorDialog open={aiOpen} onOpenChange={setAiOpen} loading={aiLoading} onGenerate={startAIQuiz} curriculum={curriculum} />

        {/* Saved AI questions indicator */}
        {customQuestions.length > 0 && (
          <div className="cinema-glass rounded-xl p-3 mt-4 flex items-center gap-2">
            <Save className="h-3.5 w-3.5 text-emerald-400" />
            <p className="text-xs text-white/60">{customQuestions.length} AI-generated questions saved locally</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Quiz Taking Mode (with video background)
// ============================================================================

function QuizTakingMode({
  questions, responses, setResponses, current, setCurrent,
  timeSpent, negative, videoOn, setVideoOn,
  onExit, onSubmit, submitConfirm, setSubmitConfirm, handleSubmit, subjectName,
}: {
  questions: any[];
  responses: Record<string, string>;
  setResponses: (r: Record<string, string>) => void;
  current: number;
  setCurrent: (n: number | ((c: number) => number)) => void;
  timeSpent: number;
  negative: boolean;
  videoOn: boolean;
  setVideoOn: (v: boolean) => void;
  onExit: () => void;
  onSubmit: () => void;
  submitConfirm: boolean;
  setSubmitConfirm: (b: boolean) => void;
  handleSubmit: () => void;
  subjectName: string;
}) {
  const q = questions[current];
  if (!q) return null;
  const answered = Object.keys(responses).length;
  const allAnswered = answered === questions.length;
  const progress = (current / questions.length) * 100;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">
      {videoOn && (
        <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover z-0 opacity-30">
          <source src={VIDEO_URL} type="video/mp4" />
        </video>
      )}
      <div className="absolute inset-0 z-0 bg-black/60" />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-6">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <button onClick={onExit} className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white">
            <ChevronLeft className="h-4 w-4" /> Exit
          </button>
          <div className="flex items-center gap-2">
            <Badge className="bg-white/10 text-white border-white/20 font-mono">Q {current + 1}/{questions.length}</Badge>
            <Badge className="bg-white/10 text-white border-white/20 font-mono"><Clock className="h-3 w-3 mr-1" /> {fmtTime(timeSpent)}</Badge>
            <button onClick={() => setVideoOn(!videoOn)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors" title="Toggle video">
              {videoOn ? <Video className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-6">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-teal-500" animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
        </div>

        {/* Question card */}
        <div className="cinema-glass rounded-2xl p-5 sm:p-7">
          {subjectName && <Badge className="mb-3 bg-indigo-500/20 text-indigo-300 border-indigo-500/30">{subjectName}</Badge>}
          {q.difficulty && <Badge variant="outline" className="ml-1 capitalize border-white/20 text-white/60">{q.difficulty}</Badge>}
          <ScholarAIContent content={q.question} mode="compact" className="mb-5 text-lg font-semibold text-white sm:text-xl" />

          <div className="grid gap-2.5">
            {q.options?.map((opt: string, i: number) => {
              const checked = responses[q.id] === opt;
              return (
                <button
                  key={i}
                  onClick={() => setResponses({ ...responses, [q.id]: opt })}
                  className={cn(
                    "flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all text-left",
                    checked ? "border-indigo-500 bg-indigo-500/10 shadow-sm" : "border-white/10 hover:bg-white/5 hover:border-white/20"
                  )}
                >
                  <span className={cn("grid place-items-center h-6 w-6 rounded-full border shrink-0 text-xs font-bold", checked ? "border-indigo-500 bg-indigo-500 text-white" : "border-white/20 text-white/50")}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <ScholarAIContent content={opt} mode="compact" className="min-w-0 text-sm font-medium text-white" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
          <button onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0} className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white disabled:opacity-30">
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>
          <div className="flex items-center gap-1 flex-wrap justify-center">
            {questions.map((qq: any, i: number) => (
              <button key={qq.id} onClick={() => setCurrent(i)} className={cn("h-7 w-7 rounded-md text-xs font-medium transition-colors", i === current ? "bg-indigo-500 text-white" : responses[qq.id] ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-white/5 text-white/50 hover:bg-white/10")}>
                {i + 1}
              </button>
            ))}
          </div>
          {current < questions.length - 1 ? (
            <button onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))} className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 hover:bg-indigo-500/30">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={onSubmit} className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-teal-500 text-white font-medium">
              <Send className="h-4 w-4" /> Submit
            </button>
          )}
        </div>

        {/* Submit confirm */}
        <Dialog open={submitConfirm} onOpenChange={setSubmitConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit quiz?</DialogTitle>
              <DialogDescription>
                {allAnswered ? `You've answered all ${questions.length} questions. Submit now to see your score.`
                  : `You've answered ${answered} of ${questions.length}. Unanswered will be marked wrong. Submit anyway?`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSubmitConfirm(false)}>Keep going</Button>
              <Button onClick={handleSubmit} className="bg-gradient-to-r from-indigo-500 to-teal-500 text-white">
                <Send className="h-4 w-4 mr-1.5" /> Submit quiz
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// ============================================================================
// Results Screen
// ============================================================================

function ResultsScreen({
  attempt, onRetake, onBack, onSaveMistake, onSaveAllMistakes, onCreateFlashcard, savedMistakeIds,
}: {
  attempt: any;
  onRetake: () => void;
  onBack: () => void;
  onSaveMistake: (q: any, userAnswer: string) => void;
  onSaveAllMistakes: () => void;
  onCreateFlashcard: (q: any) => void;
  savedMistakeIds: Set<string>;
}) {
  const pct = Math.round((attempt.score / attempt.total) * 100);
  const color = pct >= 80 ? "#14b8a6" : pct >= 50 ? "#f59e0b" : "#ef4444";
  const correctCount = attempt.questions.filter((q: any) => attempt.responses[q.id] === q.answer).length;
  const wrongCount = attempt.questions.filter((q: any) => attempt.responses[q.id] && attempt.responses[q.id] !== q.answer).length;
  const skipped = attempt.total - correctCount - wrongCount;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-zinc-950 via-black to-zinc-900" />
      <div className="relative z-10 max-w-3xl mx-auto px-4 py-6">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white mb-4">
          <ChevronLeft className="h-4 w-4" /> Back to quizzes
        </button>

        {/* Score hero */}
        <div className="cinema-glass rounded-2xl p-6 sm:p-8 mb-4">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative" style={{ width: 120, height: 120 }}>
              <svg width="120" height="120" className="-rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
                <motion.circle cx="60" cy="60" r="52" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 52} initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - pct / 100) }} transition={{ duration: 0.8 }} />
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center"><div className="text-2xl font-bold text-white">{pct}%</div><div className="text-[10px] text-white/40">{attempt.score}/{attempt.total}</div></div>
              </div>
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-2xl font-semibold text-white">
                {pct >= 80 ? "Excellent!" : pct >= 60 ? "Good job!" : pct >= 40 ? "Keep going!" : "Review and retry!"}
              </h2>
              <p className="text-sm text-white/60 mt-1">
                <strong className="text-emerald-400">{correctCount}</strong> correct,
                <strong className="text-red-400"> {wrongCount}</strong> wrong,
                <strong className="text-white/40"> {skipped}</strong> skipped
              </p>
              <div className="mt-3 flex items-center gap-2 justify-center sm:justify-start text-sm">
                <Badge variant="outline" className="border-white/20 text-white/60"><Clock className="h-3 w-3 mr-1" /> {fmtTime(attempt.timeSpent)}</Badge>
                <Badge variant="outline" className="border-white/20 text-white/60"><Target className="h-3 w-3 mr-1" /> {attempt.questions.length} questions</Badge>
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2 justify-center sm:justify-start">
            <button onClick={onRetake} className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-teal-500 text-white font-medium">
              <RotateCcw className="h-4 w-4" /> Retake quiz
            </button>
            {wrongCount > 0 && (
              <button onClick={onSaveAllMistakes} className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 hover:bg-rose-500/25 font-medium">
                <NotebookPen className="h-4 w-4" /> Save all wrong answers
              </button>
            )}
          </div>
        </div>

        {/* Question review */}
        <h3 className="text-sm font-semibold text-white mb-3">Question Review</h3>
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {attempt.questions.map((q: any, i: number) => {
              const user = attempt.responses[q.id];
              const ok = user === q.answer;
              const isSkipped = !user;
              const mistakeId = `${q.id}-${user}`;
              const isMistakeSaved = savedMistakeIds.has(mistakeId);
              return (
                <motion.div key={q.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.3) }}>
                  <div className={cn("cinema-glass rounded-xl p-4 border-l-4", ok ? "border-l-emerald-500" : isSkipped ? "border-l-white/30" : "border-l-red-500")} style={{ borderLeftColor: ok ? "#10b981" : isSkipped ? "#71717a" : "#ef4444" }}>
                    <div className="flex items-start gap-3">
                      <div className={cn("grid place-items-center h-7 w-7 rounded-lg shrink-0", ok ? "bg-emerald-500/15 text-emerald-400" : isSkipped ? "bg-white/5 text-white/40" : "bg-red-500/15 text-red-400")}>
                        {ok ? <Check className="h-4 w-4" /> : isSkipped ? <AlertCircle className="h-4 w-4" /> : <X className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex gap-1 text-sm font-medium text-white"><span className="shrink-0 text-white/40">Q{i + 1}.</span><ScholarAIContent content={q.question} mode="compact" /></div>
                        <div className="mt-2 grid gap-1.5 text-sm">
                          <p className={cn(!ok ? "text-red-400" : "text-emerald-400")}>
                            <span className="text-white/40">Your answer:</span> {user || "— (skipped)"}
                          </p>
                          {!ok && <p className="text-emerald-400"><span className="text-white/40">Correct answer:</span> {q.answer}</p>}
                          {q.explanation && <ScholarAIContent content={q.explanation} mode="compact" className="mt-1 text-xs italic text-white/50" />}
                        </div>
                        {/* Action buttons for wrong answers */}
                        {!ok && !isSkipped && (
                          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => onSaveMistake(q, user)}
                              disabled={isMistakeSaved}
                              className={cn(
                                "flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md border transition-colors",
                                isMistakeSaved
                                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300/50 cursor-default"
                                  : "bg-rose-500/15 border-rose-500/30 text-rose-200 hover:bg-rose-500/25"
                              )}
                            >
                              <NotebookPen className="h-3 w-3" /> {isMistakeSaved ? "Saved" : "Save mistake"}
                            </button>
                            <button
                              onClick={() => onCreateFlashcard(q)}
                              className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md bg-violet-500/15 border border-violet-500/30 text-violet-200 hover:bg-violet-500/25 transition-colors"
                            >
                              <BookOpen className="h-3 w-3" /> Create flashcard
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// AI Quiz Review Screen
// ============================================================================

function AIReviewScreen({
  drafts, setDrafts, onStartAll, onStartSelected, onSaveSelected, onBack,
}: {
  drafts: any[];
  setDrafts: (d: any[]) => void;
  onStartAll: () => void;
  onStartSelected: () => void;
  onSaveSelected: () => void;
  onBack: () => void;
}) {
  const updateDraft = (id: string, patch: Partial<any>) => {
    setDrafts(drafts.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };
  const deleteDraft = (id: string) => setDrafts(drafts.filter((d) => d.id !== id));
  const selectedCount = drafts.filter((d) => d.selected).length;
  const validCount = drafts.filter((d) => d.valid).length;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-zinc-950 via-black to-zinc-900" />
      <div className="relative z-10 max-w-3xl mx-auto px-4 py-6">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white mb-4">
          <ChevronLeft className="h-4 w-4" /> Cancel
        </button>

        <div className="cinema-glass rounded-2xl p-5 mb-4">
          <h2 className="text-xl font-semibold text-white mb-1">Review Generated Questions</h2>
          <p className="text-sm text-white/50">
            {drafts.length} questions generated · {validCount} valid · {selectedCount} selected
          </p>
          {drafts.some((d) => !d.valid) && (
            <div className="mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs">
              <AlertCircle className="h-3.5 w-3.5 inline mr-1" />
              Some questions need review (marked with warning). Edit or delete them before starting.
            </div>
          )}
        </div>

        {/* Draft questions */}
        <div className="space-y-3 mb-4">
          {drafts.map((d, i) => (
            <div key={d.id} className={cn(
              "cinema-glass rounded-xl p-4 border",
              d.selected ? "border-indigo-500/30" : "border-white/10 opacity-60",
              !d.valid && "border-amber-500/30"
            )}>
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  checked={d.selected}
                  onChange={(e) => updateDraft(d.id, { selected: e.target.checked })}
                  className="h-4 w-4 accent-indigo-500"
                />
                <span className="text-[10px] text-white/40">#{i + 1}</span>
                {!d.valid && <AlertCircle className="h-3.5 w-3.5 text-amber-400" />}
                <Badge variant="outline" className="text-[9px] border-white/20 text-white/50 capitalize">{d.difficulty}</Badge>
                <Badge variant="outline" className="text-[9px] border-white/20 text-white/50">{d.topic}</Badge>
                <button onClick={() => deleteDraft(d.id)} className="ml-auto p-1 rounded hover:bg-rose-500/15 text-rose-400">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Question text */}
              <textarea
                value={d.question}
                onChange={(e) => updateDraft(d.id, { question: e.target.value })}
                rows={2}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/40 resize-y mb-2"
                placeholder="Question text"
              />

              {/* Options */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                {d.options.map((opt: string, oi: number) => (
                  <div key={oi} className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateDraft(d.id, { answer: opt })}
                      className={cn("h-5 w-5 rounded-full border shrink-0 text-[9px] font-bold grid place-items-center",
                        d.answer === opt ? "border-emerald-500 bg-emerald-500 text-white" : "border-white/20 text-white/40")}
                      title="Mark as correct answer"
                    >
                      {String.fromCharCode(65 + oi)}
                    </button>
                    <input
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...d.options];
                        newOpts[oi] = e.target.value;
                        const newAnswer = d.answer === opt ? e.target.value : d.answer;
                        updateDraft(d.id, { options: newOpts, answer: newAnswer });
                      }}
                      className="flex-1 rounded-md bg-white/5 border border-white/10 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
                    />
                  </div>
                ))}
              </div>

              {/* Explanation */}
              <input
                value={d.explanation}
                onChange={(e) => updateDraft(d.id, { explanation: e.target.value })}
                className="w-full rounded-md bg-white/5 border border-white/10 px-2 py-1 text-xs text-white/70 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 mb-2"
                placeholder="Explanation"
              />

              {/* Topic */}
              <input
                value={d.topic}
                onChange={(e) => updateDraft(d.id, { topic: e.target.value })}
                className="w-full rounded-md bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-white/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
                placeholder="Topic"
              />
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onStartSelected} disabled={selectedCount === 0}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-teal-500 text-white font-medium disabled:opacity-40">
            <Play className="h-4 w-4" /> Start with Selected ({selectedCount})
          </button>
          <button onClick={onStartAll}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl bg-white/5 border border-white/15 text-white/70 hover:bg-white/10">
            <Play className="h-4 w-4" /> Start with All
          </button>
          <button onClick={onSaveSelected} disabled={selectedCount === 0}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-40">
            <Save className="h-4 w-4" /> Save Selected
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// AI Quiz Generator Dialog
// ============================================================================

function AIQuizGeneratorDialog({
  open, onOpenChange, loading, onGenerate, curriculum,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  loading: boolean;
  onGenerate: (subject: string, chapter: string, count: number, difficulty: string) => Promise<void>;
  curriculum: any[];
}) {
  const [aiSubject, setAiSubject] = useState("");
  const [aiChapter, setAiChapter] = useState("");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState("medium");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>AI Generate Quiz</DialogTitle>
          <DialogDescription>Let the AI craft fresh CBSE Class 11 MCQs. You'll review before starting.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <Select value={aiSubject} onValueChange={(v) => { setAiSubject(v); setAiChapter(""); }}>
            <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
            <SelectContent>
              {(curriculum ?? []).map((s: any) => (<SelectItem key={s.id} value={s.id}>{s.icon} {s.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={aiChapter} onValueChange={setAiChapter} disabled={!aiSubject}>
            <SelectTrigger><SelectValue placeholder="Chapter" /></SelectTrigger>
            <SelectContent>
              {(curriculum.find((s: any) => s.id === aiSubject)?.chapters ?? []).map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{[5, 8, 10, 12].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onGenerate(aiSubject, aiChapter, count, difficulty)} disabled={loading || !aiSubject || !aiChapter} className="bg-gradient-to-r from-indigo-500 to-teal-500 text-white">
            {loading ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Generating…</> : <><Sparkles className="h-4 w-4 mr-1.5" /> Generate Questions</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
