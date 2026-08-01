"use client";

import { useStore } from "@/lib/store";
import { CURRICULUM } from "@/lib/curriculum";
import type { Chapter, Subject } from "@/lib/curriculum-class11";
import { useCurriculum } from "@/lib/use-curriculum";
import { useUserName } from "@/lib/use-user-name";
import { askAI, askAIJSON, askAIStream } from "@/lib/ai";
import { ProgressRing, Markdown } from "@/lib/shared";
import { ScholarAIContent } from "@/components/ai/scholar-ai-content";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogClose, DialogTitle,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, BookOpen, Sparkles, Brain, Sigma, Save, Check,
  Lightbulb, ListTodo, GraduationCap, Clock, Target, TrendingUp, AlertTriangle,
  Zap, FileText, Layers, HelpCircle, Award, Loader2,
} from "lucide-react";
import { toast } from "@/lib/notifications/notification-api";
import { useState, useMemo, useCallback, useEffect } from "react";
import { openMathsEbook } from "@/lib/ebook-navigation";
import { setLamPageContext } from "@/lib/lam-context";

// Use the ACTIVE curriculum (Class 9 or Class 11) instead of hardcoded Class 9 subjects.
// This was a critical bug — Class 11 students saw no subjects in the Study view.
function personaFor(subjectId: string): string {
  // Class 11 subject-aware personas
  if (subjectId === "physics") return "physics-11";
  if (subjectId === "chemistry") return "chemistry-11";
  if (subjectId === "cs") return "cs-11";
  if (subjectId === "maths") return "mr-raj";
  if (subjectId === "english") return "sara";
  // Class 9 defaults
  if (subjectId === "science") return "dr-meera";
  if (subjectId === "sst") return "arjun";
  return "default";
}

function chapterName(chapter: Chapter, subject: Subject) {
  return `${chapter.title} • ${subject.name}`;
}

const AURA_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
.aura-glass {
  background: rgba(255,255,255,0.01);
  background-blend-mode: luminosity;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  border: none;
  box-shadow: inset 0 1px 1px rgba(255,255,255,0.1);
  position: relative;
  overflow: hidden;
}
.aura-glass::before {
  content: '';
  position: absolute; inset: 0;
  border-radius: inherit;
  padding: 1.4px;
  background: linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 20%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.15) 80%, rgba(255,255,255,0.45) 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}
.aura-glass-card {
  background: rgba(14,16,20,0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
}
.aura-font { font-family: 'Inter', system-ui, sans-serif; }
.aura-glass .text-muted-foreground { color: rgba(255,255,255,0.6) !important; }
.aura-glass input, .aura-glass textarea, .aura-glass select {
  background: rgba(255,255,255,0.05) !important;
  border-color: rgba(255,255,255,0.15) !important;
  color: white !important;
}
.aura-glass .bg-muted { background: rgba(255,255,255,0.05) !important; }
.aura-glass .border-border { border-color: rgba(255,255,255,0.1) !important; }
@keyframes shiny { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
.animate-shiny { animation: shiny 6s linear infinite; }
.aura-chapter-item { transition: background .2s ease, transform .2s ease; }
.aura-chapter-item:hover { background: rgba(255,255,255,0.05) !important; }
.aura-tab-active { box-shadow: 0 8px 24px -8px rgba(0,0,0,0.6); }
.aura-prose { color: rgba(255,255,255,0.85); }
.aura-prose strong { color: white; }
.aura-prose code { background: rgba(255,255,255,0.08); padding: 1px 4px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 0.85em; }
.aura-prose p { line-height: 1.6; margin-bottom: 0.5em; }
.aura-prose ul { list-style: disc; padding-left: 1.25em; margin-bottom: 0.5em; }
.aura-prose li { margin-bottom: 0.25em; }
.aura-prose h1, .aura-prose h2, .aura-prose h3 { color: white; font-weight: 600; margin-top: 0.5em; margin-bottom: 0.25em; }
`;

export function StudyView() {
  const CURRICULUM = useCurriculum();
  const scholarClass = useStore((s) => s.user.scholarClass);
  const jeeMode = useStore((s) => s.user.jeeMode);
  const { appName } = useUserName();
  const studyProgress = useStore((s) => s.studyProgress);
  const setStudyProgress = useStore((s) => s.setStudyProgress);
  const addNote = useStore((s) => s.addNote);
  const addXP = useStore((s) => s.addXP);
  const addCoins = useStore((s) => s.addCoins);
  const pushActivity = useStore((s) => s.pushActivity);

  // Use ALL subjects from the active curriculum (Class 9 or Class 11)
  const STUDY_SUBJECTS = CURRICULUM;
  const [subjectId, setSubjectId] = useState<string>(CURRICULUM[0]?.id ?? "physics");
  const [chapterIdx, setChapterIdx] = useState(0);
  const [explainOpen, setExplainOpen] = useState<{ concept: string; loading: boolean; content: string } | null>(null);
  const [aiQuiz, setAiQuiz] = useState<{ q: string; options: string[]; answer: number; explanation: string }[] | null>(null);
  const [aiQuizLoading, setAiQuizLoading] = useState(false);
  const [aiFlashcards, setAiFlashcards] = useState<{ front: string; back: string }[] | null>(null);
  const [aiFcLoading, setAiFcLoading] = useState(false);
  const [aiNotes, setAiNotes] = useState<string | null>(null);
  const [aiNotesLoading, setAiNotesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "notes" | "practice" | "flashcards" | "ai">("overview");

  // Keep subjectId in sync with the active curriculum (Class 9 ↔ Class 11 switch).
  // Without this, switching class leaves subjectId pointing to a subject that no
  // longer exists in the new curriculum (e.g. "science" only exists in Class 9),
  // and `STUDY_SUBJECTS.find()` returns undefined, crashing the StudyView.
  useEffect(() => {
    const exists = CURRICULUM.some((s) => s.id === subjectId);
    if (!exists && CURRICULUM[0]) {
      setSubjectId(CURRICULUM[0].id);
      setChapterIdx(0);
    }
  }, [CURRICULUM, subjectId]);

  const subject = useMemo(() => STUDY_SUBJECTS.find((s) => s.id === subjectId)!, [subjectId, STUDY_SUBJECTS]);
  const chapter = subject.chapters[chapterIdx];
  const progress = studyProgress[chapter.id] ?? 0;

  useEffect(() => {
    setLamPageContext({ subjectTitle: subject.name, chapterTitle: chapter.title });
    return () => setLamPageContext({});
  }, [chapter.title, subject.name]);

  // Reset AI-generated content (quiz / flashcards / notes) whenever the chapter
  // changes — otherwise stale content from the previous chapter is shown.
  useEffect(() => {
    setAiQuiz(null);
    setAiFlashcards(null);
    setAiNotes(null);
  }, [chapter.id]);

  const goPrev = () => {
    if (chapterIdx > 0) setChapterIdx(chapterIdx - 1);
    else toast("Already at the first chapter of this subject.");
  };
  const goNext = () => {
    if (chapterIdx < subject.chapters.length - 1) setChapterIdx(chapterIdx + 1);
    else toast("You've reached the last chapter.");
  };

  const handleSwitchSubject = (id: string) => {
    if (id === subjectId) return;
    setSubjectId(id);
    setChapterIdx(0);
  };

  const handleExplain = useCallback(async (concept: string) => {
    setExplainOpen({ concept, loading: true, content: "" });
    try {
      const prompt = `Explain this Class ${scholarClass} CBSE concept simply with an example: "${concept}" (chapter: ${chapter.title}, subject: ${subject.name}). Keep it under 200 words, friendly, and end with one quick check question.`;
      const reply = await askAI(prompt, personaFor(subjectId));
      setExplainOpen({ concept, loading: false, content: reply });
    } catch {
      setExplainOpen({ concept, loading: false, content: "Sorry, I couldn't fetch an explanation right now. Please try again in a moment." });
      toast.error("AI explanation failed");
    }
  }, [chapter.title, subject.name, subjectId]);

  const handleMarkStudied = () => {
    const wasDone = progress >= 100;
    setStudyProgress(chapter.id, 100);
    if (!wasDone) {
      addXP(20);
      addCoins(5);
      pushActivity({ type: "study", text: `Studied ${chapter.title}`, icon: "📖" });
      toast.success("Chapter marked as studied! 📖", { description: "+20 XP · +5 coins" });
    } else {
      toast.success("Already complete", { description: "This chapter is marked studied." });
    }
  };

  const handleSaveAsNote = () => {
    const lesson = buildLessonMarkdown(chapter, subject, appName);
    addNote({ title: chapter.title, content: lesson, folder: subject.name, color: subject.id === "science" ? "emerald" : "amber", tags: [subject.id, "study"] });
    pushActivity({ type: "note", text: `Saved lesson note: ${chapter.title}`, icon: "📝" });
    toast.success("Saved as note", { description: "Open the Notes view to read it." });
  };

  // ===== AI-Powered On-Demand Content Generation =====
  const handleGenerateQuiz = useCallback(async () => {
    setAiQuizLoading(true); setAiQuiz(null);
    try {
      const prompt = `Generate exactly 10 MCQ questions for CBSE Class ${scholarClass} ${subject.name} chapter "${chapter.title}". ${jeeMode ? "JEE-level difficulty (advanced, multi-concept, numerical-heavy)." : "Board exam level difficulty."} Return ONLY valid JSON in this exact shape (no markdown fences, no commentary):\n\n{"questions":[{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"..."}]}\n\nRules:\n- "answer" MUST be an integer 0, 1, 2, or 3 (the index of the correct option).\n- Each question must have exactly 4 options.\n- Cover different concepts from the chapter. Do not repeat the same sub-topic.\n- Keep explanations concise (1-2 sentences).`;
      const r = await askAIJSON<{ questions: { question: string; options: string[]; answer: number | string; explanation: string }[] }>(
        prompt,
        personaFor(subjectId),
        { timeoutMs: 180_000 } // 3-minute ceiling — JEE-mode quiz can take 60s+
      );
      if (r?.questions?.length) {
        const cleaned = r.questions
          .map((item) => ({
            q: String(item.question ?? "").trim(),
            options: Array.isArray(item.options) ? item.options.map(String) : [],
            answer: Math.max(0, Math.min(3, Number(item.answer) || 0)),
            explanation: String(item.explanation ?? "").trim(),
          }))
          .filter((q) => q.q && q.options.length === 4);
        if (cleaned.length) {
          setAiQuiz(cleaned);
          addXP(5);
          toast.success(`Generated ${cleaned.length} quiz questions! +5 XP`);
        } else {
          toast.error("AI returned malformed quiz. Please try again.");
        }
      } else toast.error("Couldn't generate quiz. The model may be busy — try again in a moment.");
    } catch (err) {
      console.error("[Study] Quiz generation failed:", err);
      toast.error(err instanceof Error ? err.message : "Quiz generation failed");
    }
    finally { setAiQuizLoading(false); }
  }, [chapter.title, subject.name, subjectId, scholarClass, jeeMode, addXP]);

  const handleGenerateFlashcards = useCallback(async () => {
    setAiFcLoading(true); setAiFlashcards(null);
    try {
      const prompt = `Generate exactly 20 flashcards for CBSE Class ${scholarClass} ${subject.name} chapter "${chapter.title}". Return ONLY valid JSON in this exact shape (no markdown fences, no commentary):\n\n{"cards":[{"front":"...","back":"..."}]}\n\nRules:\n- "front" = a question, term, or prompt (1 sentence).\n- "back" = a concise answer or definition (1-3 sentences).\n- Cover definitions, formulas, concepts, and key facts from the chapter.\n- Avoid duplicates.`;
      const r = await askAIJSON<{ cards: { front: string; back: string }[] }>(
        prompt,
        personaFor(subjectId),
        { timeoutMs: 120_000 }
      );
      if (r?.cards?.length) {
        const cleaned = r.cards
          .map((c) => ({ front: String(c.front ?? "").trim(), back: String(c.back ?? "").trim() }))
          .filter((c) => c.front && c.back);
        if (cleaned.length) {
          setAiFlashcards(cleaned);
          addXP(5);
          toast.success(`Generated ${cleaned.length} flashcards! +5 XP`);
        } else {
          toast.error("AI returned malformed flashcards. Please try again.");
        }
      } else toast.error("Couldn't generate flashcards. The model may be busy — try again in a moment.");
    } catch (err) {
      console.error("[Study] Flashcard generation failed:", err);
      toast.error(err instanceof Error ? err.message : "Flashcard generation failed");
    }
    finally { setAiFcLoading(false); }
  }, [chapter.title, subject.name, subjectId, scholarClass, addXP]);

  const handleGenerateNotes = useCallback(async () => {
    setAiNotesLoading(true); setAiNotes(null);
    try {
      const prompt = `Write comprehensive study notes for CBSE Class ${scholarClass} ${subject.name} chapter "${chapter.title}". Include: detailed theory (500+ words), key formulas with explanations, 3 worked examples with step-by-step solutions, common mistakes to avoid, and exam tips. Use markdown with clear headings (# for main, ## for sections). Do NOT include any preamble — start directly with the first heading.`;
      // Stream the notes — long-form generation often takes 50-70s, so we show
      // incremental progress instead of a static spinner.
      let acc = "";
      await askAIStream(prompt, personaFor(subjectId), {
        timeoutMs: 240_000, // 4-minute ceiling — notes can be 60s+
        onDelta: (_chunk, full) => {
          acc = full;
          setAiNotes(full); // live-update the markdown as it streams in
        },
      });
      if (acc.trim()) {
        setAiNotes(acc);
        addXP(10);
        toast.success("Detailed notes generated! +10 XP");
      } else {
        toast.error("Couldn't generate notes. The model may be busy — try again in a moment.");
      }
    } catch (err) {
      console.error("[Study] Notes generation failed:", err);
      toast.error(err instanceof Error ? err.message : "Notes generation failed");
    }
    finally { setAiNotesLoading(false); }
  }, [chapter.title, subject.name, subjectId, scholarClass, addXP]);

  // Total studied count across all active subjects
  const studiedCount = STUDY_SUBJECTS.flatMap((s) => s.chapters).filter((c) => (studyProgress[c.id] ?? 0) >= 100).length;
  const totalStudyChapters = STUDY_SUBJECTS.flatMap((s) => s.chapters).length;

  const focusChapterList = () => {
    const el = document.getElementById("aura-chapter-list");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const now = new Date();

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-[#0c0c0c] overflow-x-hidden -m-4 lg:-m-6 text-white aura-font">
      <style>{AURA_STYLE}</style>
      <div className="fixed inset-0 z-0 pointer-events-none">
        <video autoPlay loop muted playsInline className="w-full h-full object-cover pointer-events-none"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_064122_c4750c0e-7476-4b44-94a2-a85a65c63bf2.mp4" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-8">
        {/* Navbar */}
        <motion.nav
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-between py-4"
        >
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 256 256" className="w-8 h-8" fill="white">
              <path d="M 0 128 C 70.692 128 128 185.308 128 256 L 64 256 C 64 220.654 35.346 192 0 192 Z M 256 192 C 220.654 192 192 220.654 192 256 L 128 256 C 128 185.308 185.308 128 256 128 Z M 128 0 C 128 70.692 70.692 128 0 128 L 0 64 C 35.346 64 64 35.346 64 0 Z M 192 0 C 192 35.346 220.654 64 256 64 L 256 128 C 185.308 128 128 70.692 128 0 Z" />
            </svg>
            <span className="text-white font-semibold text-lg">Study</span>
          </div>
          <div className="hidden md:flex gap-4 lg:gap-6 flex-wrap">
            <button onClick={focusChapterList} className="text-white/70 text-sm font-medium hover:text-white transition-colors">Chapters</button>
            {STUDY_SUBJECTS.map((s) => (
              <button key={s.id} onClick={() => handleSwitchSubject(s.id)}
                className={`text-sm font-medium transition-colors ${subjectId === s.id ? "text-white" : "text-white/50 hover:text-white"}`}>
                {s.icon} {s.name}
              </button>
            ))}
          </div>
          <div className="aura-glass rounded-full px-3 py-1.5 text-xs text-white/60 flex items-center gap-1.5">
            <GraduationCap className="h-3.5 w-3.5 text-white/70" />
            <span className="text-white font-semibold">{studiedCount}/{totalStudyChapters}</span> done
          </div>
        </motion.nav>

        {/* Hero */}
        <div className="mt-12 mb-10">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-1.5 aura-glass rounded-full px-3 py-1 text-xs text-white/50 mb-6"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            AI-NATIVE STUDY PLATFORM
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-4xl md:text-7xl font-semibold tracking-tight leading-[0.9] text-white"
          >
            Your textbook.{" "}
            <span
              className="animate-shiny"
              style={{
                backgroundImage: "linear-gradient(to right, #091020 0%, #0B2551 12.5%, #A4F4FD 32.5%, #00d2ff 50%, #0B2551 67.5%, #091020 87.5%, #091020 100%)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                WebkitTextFillColor: "transparent",
              }}
            >
              Revitalized
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="mt-8 text-white/60 max-w-md text-base leading-[1.5]"
          >
            Textbook-style chapter reader for Science &amp; Social Science, enhanced with AI explanations and interactive lessons.
          </motion.p>
        </div>

        {/* macOS menu bar strip */}
        <div className="h-10 bg-black/40 backdrop-blur-md border-t border-b border-white/10 -mx-6">
          <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              <svg viewBox="0 0 384 512" className="w-3.5 h-3.5 text-white" fill="currentColor">
                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
              </svg>
              <span className="font-bold text-white">Scholar</span>
              {["File", "Edit", "View", "Go", "Window", "Help"].map((m) => (
                <span key={m} className="text-white/70 hover:text-white cursor-default transition-colors">{m}</span>
              ))}
            </div>
            <div className="flex items-center gap-3 text-white/60">
              <Sparkles className="h-3.5 w-3.5" />
              <span suppressHydrationWarning>{now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
              <span suppressHydrationWarning>{now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-8">
          {[
            { icon: GraduationCap, label: "Studied", value: `${studiedCount}/${totalStudyChapters}`, sub: "Science + SST", accent: "#6366f1" },
            { icon: BookOpen, label: "Subject", value: subject.icon, sub: subject.name, accent: subject.accent },
            { icon: Sparkles, label: "Chapter", value: chapterIdx + 1, sub: `of ${subject.chapters.length}`, accent: "#14b8a6" },
          ].map((s, i) => (
            <div key={i} className="aura-glass rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-white/50">{s.label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums leading-tight text-white">{s.value}</p>
                  {s.sub && <p className="mt-1 text-xs text-white/50">{s.sub}</p>}
                </div>
                <div
                  className="grid place-items-center h-9 w-9 rounded-xl shrink-0"
                  style={{ background: `${s.accent}1a`, color: s.accent }}
                >
                  <s.icon className="h-4 w-4" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {scholarClass === 11 && (
          <section className="mt-5 rounded-3xl border border-indigo-300/15 bg-gradient-to-br from-indigo-500/15 via-black/30 to-cyan-500/10 p-4 sm:p-5" aria-labelledby="ebook-study-title">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-200">E-Book Study</p>
                <h2 id="ebook-study-title" className="mt-1 text-xl font-semibold">Continue Mathematics Part 1</h2>
                <p className="mt-1 max-w-2xl text-sm text-white/55">Learn directly from Sets and Relations and Functions with synchronized scan pages, clean selectable text, 140 printed questions, highlights, notes, page quizzes, flashcards, and a Groq-guided reading tutor.</p>
              </div>
              <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
                <Button onClick={() => openMathsEbook("Reader")} className="bg-indigo-500 hover:bg-indigo-600"><BookOpen className="mr-1.5 h-4 w-4" /> Continue</Button>
                <Button onClick={() => openMathsEbook("AI Study")} variant="outline" className="border-white/15 bg-white/5"><Sparkles className="mr-1.5 h-4 w-4" /> Guided session</Button>
                <Button onClick={() => openMathsEbook("Questions")} variant="outline" className="border-white/15 bg-white/5"><ListTodo className="mr-1.5 h-4 w-4" /> Book questions</Button>
                <Button onClick={() => openMathsEbook("Reading Progress")} variant="outline" className="border-white/15 bg-white/5"><TrendingUp className="mr-1.5 h-4 w-4" /> Progress</Button>
              </div>
            </div>
          </section>
        )}

        {/* Subject selector */}
        <div className="flex gap-2 mt-8">
          {STUDY_SUBJECTS.map((s) => {
            const active = s.id === subjectId;
            return (
              <button
                key={s.id}
                onClick={() => handleSwitchSubject(s.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  active ? "aura-tab-active text-white" : "aura-glass text-white/60 hover:text-white"
                }`}
                style={active ? { background: s.accent } : undefined}
              >
                <span className="text-base">{s.icon}</span>
                {s.name}
              </button>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-[260px_1fr] gap-4 mt-6">
          {/* Chapter list */}
          <div id="aura-chapter-list" className="aura-glass-card p-3 lg:max-h-[70vh] lg:overflow-hidden flex flex-col scroll-mt-8">
            <h3 className="text-xs uppercase tracking-wider text-white/50 font-semibold px-2 py-1.5">
              {subject.name} • Chapters
            </h3>
            <div className="flex-1 max-h-[50vh] lg:max-h-none lg:overflow-y-auto overflow-y-auto -webkit-overflow-scrolling-touch">
              <div className="space-y-1 pr-1">
                {subject.chapters.map((ch, i) => {
                  const active = i === chapterIdx;
                  const prog = studyProgress[ch.id] ?? 0;
                  return (
                    <button
                      key={ch.id}
                      onClick={() => setChapterIdx(i)}
                      className={`aura-chapter-item w-full text-left rounded-lg px-2.5 py-2 transition-all flex items-start gap-2 ${
                        active ? "bg-white/10 ring-1 ring-white/20" : "hover:bg-white/5"
                      }`}
                    >
                      <div className="grid place-items-center h-5 w-5 rounded-full text-[10px] font-semibold shrink-0 mt-0.5"
                        style={{ background: prog >= 100 ? subject.accent : "transparent", color: prog >= 100 ? "white" : "rgba(255,255,255,0.7)", border: `1px solid ${prog >= 100 ? subject.accent : "rgba(255,255,255,0.2)"}` }}>
                        {prog >= 100 ? <Check className="h-3 w-3" /> : i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-medium leading-snug ${active ? "text-white" : "text-white/60"}`}>{ch.title}</p>
                        <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${prog}%`, background: subject.accent }} />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Reader */}
          <div className="aura-glass-card p-0 overflow-visible lg:overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={chapter.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                {/* Hero */}
                <div className="p-6 sm:p-8" style={{ background: `linear-gradient(135deg, ${subject.accent}22, transparent 70%)` }}>
                  <div className="flex items-start gap-4">
                    <ProgressRing value={progress} size={72} stroke={7} color={subject.accent} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase tracking-wider font-medium" style={{ color: subject.accent }}>
                        {subject.icon} {subject.name} • Chapter {chapterIdx + 1}
                      </p>
                      <h2 className="text-2xl font-semibold leading-tight mt-1 text-white">{chapter.title}</h2>
                    </div>
                  </div>
                </div>

                <div className="px-4 sm:px-6 lg:px-8">
                  <div className="space-y-7 py-6 pb-8 lg:max-h-[75vh] lg:overflow-y-auto">
                    {/* Introduction */}
                    <Section title="Introduction" icon={BookOpen} accent={subject.accent}>
                      <p className="text-sm leading-relaxed text-white/80">{chapter.summary}</p>
                    </Section>

                    {/* Key Concepts */}
                    <Section title="Key Concepts" icon={Brain} accent={subject.accent}>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {chapter.concepts.map((c, i) => (
                          <div key={i} className="group rounded-xl border border-white/10 bg-white/5 p-3 flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium leading-snug text-white/90">{c}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleExplain(c)}
                              className="h-7 px-2 text-[11px] opacity-80 group-hover:opacity-100 hover:bg-white/10 hover:text-white"
                              style={{ color: subject.accent }}
                            >
                              <Sparkles className="h-3 w-3 mr-1" /> Explain
                            </Button>
                          </div>
                        ))}
                      </div>
                    </Section>

                    {/* Important Points */}
                    <Section title="Important Points" icon={ListTodo} accent={subject.accent}>
                      <ul className="space-y-1.5">
                        {chapter.concepts.map((c, i) => (
                          <li key={i} className="text-sm flex gap-2.5 leading-relaxed text-white/80">
                            <Check className="h-4 w-4 mt-0.5 shrink-0" style={{ color: subject.accent }} />
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </Section>

                    {/* Formulas */}
                    {chapter.formulas && chapter.formulas.length > 0 && (
                      <Section title="Formulas" icon={Sigma} accent={subject.accent}>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2 font-mono text-sm">
                          {chapter.formulas.map((f, i) => (
                            <div key={i} className="flex items-center gap-3 text-white/90">
                              <span className="grid place-items-center h-5 w-5 rounded-full text-[10px] font-semibold shrink-0"
                                style={{ background: `${subject.accent}20`, color: subject.accent }}>{i + 1}</span>
                              <code>{f}</code>
                            </div>
                          ))}
                        </div>
                      </Section>
                    )}

                    {/* Examples (2 questions with hidden answer) */}
                    <Section title="Examples" icon={Lightbulb} accent={subject.accent}>
                      <div className="space-y-2.5">
                        {chapter.questions.slice(0, 2).map((q, i) => (
                          <ExampleItem key={i} index={i + 1} question={q} accent={subject.accent} />
                        ))}
                      </div>
                    </Section>

                    {/* Summary */}
                    <Section title="Summary" icon={BookOpen} accent={subject.accent}>
                      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <p className="text-sm leading-relaxed text-white/80">
                          <strong className="text-white">{chapter.title}</strong> — {chapter.summary} In this chapter you explored {chapter.concepts.length} key concepts
                          {chapter.formulas?.length ? ` and ${chapter.formulas.length} important formula${chapter.formulas.length === 1 ? "" : "s"}` : ""}.
                          Make sure you can answer the {chapter.questions.length} important questions listed in the Resources view before your exam.
                        </p>
                      </div>
                    </Section>

                    {/* ===== RICH METADATA SECTIONS ===== */}

                    {/* Chapter Metadata Bar */}
                    {(chapter.estimatedTime || chapter.difficulty || chapter.boardWeightage || chapter.jeeWeightage) && (
                      <Section title="Chapter Info" icon={Target} accent={subject.accent}>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {chapter.estimatedTime && (
                            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                              <Clock className="h-4 w-4 mx-auto mb-1" style={{ color: subject.accent }} />
                              <p className="text-[10px] uppercase tracking-wide text-white/40">Study Time</p>
                              <p className="text-sm font-medium text-white">{chapter.estimatedTime}</p>
                            </div>
                          )}
                          {chapter.difficulty && (
                            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                              <TrendingUp className="h-4 w-4 mx-auto mb-1" style={{ color: subject.accent }} />
                              <p className="text-[10px] uppercase tracking-wide text-white/40">Difficulty</p>
                              <p className="text-sm font-medium text-white">{chapter.difficulty}</p>
                            </div>
                          )}
                          {chapter.boardWeightage && (
                            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                              <Award className="h-4 w-4 mx-auto mb-1" style={{ color: subject.accent }} />
                              <p className="text-[10px] uppercase tracking-wide text-white/40">Board</p>
                              <p className="text-sm font-medium text-white">{chapter.boardWeightage}</p>
                            </div>
                          )}
                          {chapter.jeeWeightage && (
                            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                              <Zap className="h-4 w-4 mx-auto mb-1" style={{ color: subject.accent }} />
                              <p className="text-[10px] uppercase tracking-wide text-white/40">JEE</p>
                              <p className="text-sm font-medium text-white">{chapter.jeeWeightage}</p>
                            </div>
                          )}
                        </div>
                      </Section>
                    )}

                    {/* Overview */}
                    {chapter.overview && (
                      <Section title="Overview" icon={BookOpen} accent={subject.accent}>
                        <p className="text-sm leading-relaxed text-white/80">{chapter.overview}</p>
                      </Section>
                    )}

                    {/* Learning Objectives */}
                    {chapter.learningObjectives && chapter.learningObjectives.length > 0 && (
                      <Section title="Learning Objectives" icon={Target} accent={subject.accent}>
                        <ul className="space-y-1.5">
                          {chapter.learningObjectives.map((obj, i) => (
                            <li key={i} className="text-sm flex gap-2.5 leading-relaxed text-white/80">
                              <Check className="h-4 w-4 mt-0.5 shrink-0" style={{ color: subject.accent }} />
                              <span>{obj}</span>
                            </li>
                          ))}
                        </ul>
                      </Section>
                    )}

                    {/* Prerequisites */}
                    {chapter.prerequisites && chapter.prerequisites.length > 0 && (
                      <Section title="Prerequisites" icon={ListTodo} accent={subject.accent}>
                        <div className="flex flex-wrap gap-2">
                          {chapter.prerequisites.map((pre, i) => (
                            <span key={i} className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-white/70">
                              {pre}
                            </span>
                          ))}
                        </div>
                      </Section>
                    )}

                    {/* Quick Summary */}
                    {chapter.quickSummary && chapter.quickSummary.length > 0 && (
                      <Section title="Quick Summary" icon={Zap} accent={subject.accent}>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                          {chapter.quickSummary.map((qs, i) => (
                            <div key={i} className="text-sm flex gap-2.5 leading-relaxed text-white/80">
                              <span className="grid place-items-center h-5 w-5 rounded-full text-[10px] font-semibold shrink-0 mt-0.5"
                                style={{ background: `${subject.accent}20`, color: subject.accent }}>{i + 1}</span>
                              <span>{qs}</span>
                            </div>
                          ))}
                        </div>
                      </Section>
                    )}

                    {/* Important Definitions */}
                    {chapter.importantDefinitions && chapter.importantDefinitions.length > 0 && (
                      <Section title="Important Definitions" icon={BookOpen} accent={subject.accent}>
                        <div className="space-y-2">
                          {chapter.importantDefinitions.map((d, i) => (
                            <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-3">
                              <p className="text-sm font-semibold text-white mb-1">{d.term}</p>
                              <p className="text-sm text-white/70 leading-relaxed">{d.definition}</p>
                            </div>
                          ))}
                        </div>
                      </Section>
                    )}

                    {/* Common Mistakes */}
                    {chapter.commonMistakes && chapter.commonMistakes.length > 0 && (
                      <Section title="Common Mistakes" icon={AlertTriangle} accent="#f59e0b">
                        <div className="space-y-2">
                          {chapter.commonMistakes.map((cm, i) => (
                            <div key={i} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex gap-2.5">
                              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                              <p className="text-sm text-white/80 leading-relaxed">{cm}</p>
                            </div>
                          ))}
                        </div>
                      </Section>
                    )}

                    {/* Exam Tips */}
                    {chapter.examTips && chapter.examTips.length > 0 && (
                      <Section title="Exam Tips" icon={Lightbulb} accent="#10b981">
                        <div className="space-y-2">
                          {chapter.examTips.map((et, i) => (
                            <div key={i} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex gap-2.5">
                              <Lightbulb className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
                              <p className="text-sm text-white/80 leading-relaxed">{et}</p>
                            </div>
                          ))}
                        </div>
                      </Section>
                    )}

                    {/* Frequently Confused Concepts */}
                    {chapter.frequentlyConfused && chapter.frequentlyConfused.length > 0 && (
                      <Section title="Frequently Confused" icon={HelpCircle} accent="#8b5cf6">
                        <div className="space-y-2">
                          {chapter.frequentlyConfused.map((fc, i) => (
                            <div key={i} className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-semibold text-white">{fc.a}</span>
                                <span className="text-white/30 text-xs">vs</span>
                                <span className="text-sm font-semibold text-white">{fc.b}</span>
                              </div>
                              <p className="text-sm text-white/70 leading-relaxed">{fc.distinction}</p>
                            </div>
                          ))}
                        </div>
                      </Section>
                    )}

                    {/* ===== AI-POWERED ON-DEMAND CONTENT ===== */}

                    {/* AI Generate Quiz */}
                    <Section title="AI Quiz Generator" icon={HelpCircle} accent={subject.accent}>
                      <div className="space-y-3">
                        <p className="text-sm text-white/60">Generate 10 chapter-specific MCQs with instant explanations. {jeeMode ? "JEE-level difficulty enabled." : "Board-level difficulty."}</p>
                        <Button size="sm" onClick={handleGenerateQuiz} disabled={aiQuizLoading}
                          style={{ background: subject.accent, color: "white" }} className="hover:opacity-90">
                          {aiQuizLoading ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Generating…</> : <><Sparkles className="h-4 w-4 mr-1.5" /> Generate 10 Quiz Questions</>}
                        </Button>
                        {aiQuiz && aiQuiz.length > 0 && (
                          <div className="space-y-2 mt-2">
                            {aiQuiz.map((q, i) => <AIQuizItem key={i} index={i + 1} question={q} accent={subject.accent} />)}
                          </div>
                        )}
                      </div>
                    </Section>

                    {/* AI Generate Flashcards */}
                    <Section title="AI Flashcard Generator" icon={Layers} accent={subject.accent}>
                      <div className="space-y-3">
                        <p className="text-sm text-white/60">Generate 20 flashcards covering definitions, formulas, and key concepts for this chapter.</p>
                        <Button size="sm" onClick={handleGenerateFlashcards} disabled={aiFcLoading}
                          style={{ background: subject.accent, color: "white" }} className="hover:opacity-90">
                          {aiFcLoading ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Generating…</> : <><Sparkles className="h-4 w-4 mr-1.5" /> Generate 20 Flashcards</>}
                        </Button>
                        {aiFlashcards && aiFlashcards.length > 0 && (
                          <div className="grid sm:grid-cols-2 gap-2 mt-2">
                            {aiFlashcards.map((fc, i) => (
                              <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-3">
                                <p className="text-xs font-semibold text-white mb-1">{fc.front}</p>
                                <p className="text-sm text-white/70">{fc.back}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </Section>

                    {/* AI Generate Detailed Notes */}
                    <Section title="AI Detailed Notes" icon={FileText} accent={subject.accent}>
                      <div className="space-y-3">
                        <p className="text-sm text-white/60">Generate comprehensive study notes with theory, worked examples, and exam tips — tailored to your class.</p>
                        <Button size="sm" onClick={handleGenerateNotes} disabled={aiNotesLoading}
                          style={{ background: subject.accent, color: "white" }} className="hover:opacity-90">
                          {aiNotesLoading ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Generating…</> : <><Sparkles className="h-4 w-4 mr-1.5" /> Generate Detailed Notes</>}
                        </Button>
                        {aiNotes && (
                          <div className="rounded-xl border border-white/10 bg-white/5 p-4 mt-2 aura-prose">
                            <Markdown content={aiNotes} />
                          </div>
                        )}
                      </div>
                    </Section>

                    {/* Quick Revision MCQs */}
                    <Section title="Quick Revision" icon={GraduationCap} accent={subject.accent}>
                      <div className="space-y-2">
                        {chapter.concepts.slice(0, 3).map((c, i) => (
                          <MCQItem key={i} index={i + 1} concept={c} chapterTitle={chapter.title} subjectName={subject.name} accent={subject.accent} />
                        ))}
                      </div>
                    </Section>

                    {/* Bottom actions */}
                    <div className="pt-4 border-t border-white/10 flex flex-wrap gap-2 justify-between items-center">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={goPrev} className="bg-white/5 border-white/15 text-white hover:bg-white/10 hover:text-white">
                          <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                        </Button>
                        <Button size="sm" variant="outline" onClick={goNext} className="bg-white/5 border-white/15 text-white hover:bg-white/10 hover:text-white">
                          Next <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={handleSaveAsNote} className="bg-white/5 border-white/15 text-white hover:bg-white/10 hover:text-white">
                          <Save className="h-3.5 w-3.5 mr-1.5" /> Save as Note
                        </Button>
                        <Button size="sm" onClick={handleMarkStudied} style={{ background: subject.accent, color: "white" }} className="hover:opacity-90">
                          <Check className="h-4 w-4 mr-1.5" /> Mark as studied
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Explain dialog */}
        <Dialog open={!!explainOpen} onOpenChange={(o) => !o && setExplainOpen(null)}>
          <DialogContent className="aura-glass-card max-w-lg text-white border-white/10">
            <DialogTitle className="sr-only">Concept Explanation</DialogTitle>
            <div className="flex items-center gap-2 mb-4">
              <div className="grid place-items-center h-8 w-8 rounded-lg" style={{ background: `${subject.accent}1a`, color: subject.accent }}>
                <Sparkles className="h-4 w-4" />
              </div>
              <h2 className="text-base font-semibold text-white">{explainOpen?.concept ?? "Explain"}</h2>
            </div>
            {explainOpen?.loading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <div className="h-8 w-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                <p className="text-sm text-white/60">AI tutor is explaining…</p>
              </div>
            ) : (
              <div className="text-sm aura-prose">
                <Markdown content={explainOpen?.content ?? ""} />
              </div>
            )}
            <div className="flex justify-end mt-4">
              <DialogClose asChild>
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white">Close</Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}

// ===== Sub-components =====
function Section({ title, icon: Icon, accent, children }: { title: string; icon: typeof Brain; accent: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 text-white">
        <Icon className="h-4 w-4" style={{ color: accent }} />
        {title}
      </h3>
      {children}
    </section>
  );
}

function ExampleItem({ index, question, accent }: { index: number; question: string; accent: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
      <div className="flex items-start gap-2.5">
        <span className="grid place-items-center h-6 w-6 rounded-full text-[11px] font-semibold shrink-0"
          style={{ background: `${accent}20`, color: accent }}>{index}</span>
        <p className="text-sm leading-relaxed flex-1 text-white/85">{question}</p>
      </div>
      <button
        onClick={() => setRevealed((v) => !v)}
        className="mt-2 ml-8 text-[11px] text-white/50 hover:text-white transition-colors flex items-center gap-1"
      >
        <Lightbulb className="h-3 w-3" />
        {revealed ? "Hide approach" : "Show approach"}
      </button>
      {revealed && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-2 ml-8 text-xs text-white/50 italic"
        >
          Try this: identify the key concept the question targets, write the relevant formula or fact, then solve step-by-step. Use the &quot;Explain with AI&quot; button on any concept for a worked example.
        </motion.div>
      )}
    </div>
  );
}

function MCQItem({ index, concept, chapterTitle, subjectName, accent }: { index: number; concept: string; chapterTitle: string; subjectName: string; accent: string }) {
  // Build pseudo MCQ options from the concept
  const opts = useMemo(() => {
    const base = [
      `Correctly describes "${concept}"`,
      `Unrelated to ${chapterTitle}`,
      `Opposite of the concept`,
      `None of the above`,
    ];
    return base;
  }, [concept, chapterTitle]);
  const correctIdx = 0;
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
      <div className="flex items-start gap-2.5 mb-2">
        <span className="grid place-items-center h-5 w-5 rounded-full text-[10px] font-semibold shrink-0 mt-0.5"
          style={{ background: `${accent}20`, color: accent }}>Q{index}</span>
        <p className="text-sm font-medium leading-snug text-white/90">Which of the following best describes &quot;{concept}&quot; in {chapterTitle}?</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-1.5 ml-7">
        {opts.map((o, i) => {
          const isCorrect = i === correctIdx;
          const isPicked = picked === i;
          let cls = "border-white/10 bg-white/5 hover:bg-white/10 text-white/60";
          if (picked !== null) {
            if (isCorrect) cls = "border-emerald-500/50 bg-emerald-500/15 text-emerald-300";
            else if (isPicked) cls = "border-rose-500/50 bg-rose-500/15 text-rose-300";
            else cls = "border-white/5 bg-white/[0.02] text-white/40";
          }
          return (
            <button
              key={i}
              onClick={() => setPicked(i)}
              disabled={picked !== null}
              className={`text-left text-xs px-2.5 py-1.5 rounded-lg border transition-all ${cls}`}
            >
              <span className="font-mono mr-1.5">{String.fromCharCode(65 + i)}.</span>{o}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <p className="text-[11px] text-white/60 mt-2 ml-7">
          {picked === correctIdx ? "✅ Correct!" : "❌ Review the concept above and try the next question."}
        </p>
      )}
    </div>
  );
}

function AIQuizItem({ index, question, accent }: { index: number; question: { q: string; options: string[]; answer: number; explanation: string }; accent: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
      <div className="flex items-start gap-2.5 mb-2">
        <span className="grid place-items-center h-5 w-5 rounded-full text-[10px] font-semibold shrink-0 mt-0.5"
          style={{ background: `${accent}20`, color: accent }}>Q{index}</span>
        <p className="text-sm font-medium leading-snug text-white/90">{question.q}</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-1.5 ml-7">
        {question.options.map((o, i) => {
          const isCorrect = i === question.answer;
          const isPicked = picked === i;
          let cls = "border-white/10 bg-white/5 hover:bg-white/10 text-white/60";
          if (picked !== null) {
            if (isCorrect) cls = "border-emerald-500/50 bg-emerald-500/15 text-emerald-300";
            else if (isPicked) cls = "border-rose-500/50 bg-rose-500/15 text-rose-300";
            else cls = "border-white/5 bg-white/[0.02] text-white/40";
          }
          return (
            <button key={i} onClick={() => setPicked(i)} disabled={picked !== null}
              className={`text-left text-xs px-2.5 py-1.5 rounded-lg border transition-all ${cls}`}>
              <span className="font-mono mr-1.5">{String.fromCharCode(65 + i)}.</span>{o}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div className="mt-2 ml-7 rounded-lg bg-white/5 p-2.5">
          <p className="text-[11px] text-white/60 mb-0.5">
            {picked === question.answer ? "✅ Correct!" : `❌ Correct answer: ${String.fromCharCode(65 + question.answer)}`}
          </p>
                      <ScholarAIContent content={question.explanation} mode="compact" className="text-[11px] text-white/50" />
        </div>
      )}
    </div>
  );
}

function buildLessonMarkdown(chapter: Chapter, subject: Subject, appName: string): string {
  return [
    `# ${chapter.title}`,
    `**Subject:** ${subject.icon} ${subject.name}`,
    ``,
    `## Introduction`,
    chapter.summary,
    ``,
    `## Key Concepts`,
    ...chapter.concepts.map((c) => `- ${c}`),
    ...(chapter.formulas?.length ? [``, `## Formulas`, ...chapter.formulas.map((f) => `- \`${f}\``)] : []),
    ``,
    `## Important Questions`,
    ...chapter.questions.map((q, i) => `${i + 1}. ${q}`),
    ``,
    `---`,
    `*Saved from ${appName} — Study view*`,
  ].join("\n");
}

export default StudyView;
