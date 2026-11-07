"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  GitBranch,
  HelpCircle,
  Layers,
  Lightbulb,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Target,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { askAI, askAIJSON } from "@/lib/ai";
import { useStore } from "@/lib/store";
import { useCurriculum } from "@/lib/use-curriculum";
import { Markdown } from "@/lib/shared";
import { exportPDF, mdToHtml } from "@/lib/pdf";
import { toast } from "@/lib/notifications/notification-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { loadQuizMistakes } from "@/lib/quiz-mistakes";
import { profileGetJSON } from "@/lib/profile-storage";
import { PHYSICS_PAST_PAPERS } from "@/lib/question-bank";

function PluginLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] py-10 text-sm text-white/70">
      <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
      <span>{label}</span>
    </div>
  );
}

function PluginError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200" role="alert">
      <span>{message}</span>
      {onRetry ? (
        <Button size="sm" variant="outline" onClick={onRetry} className="border-rose-400/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20">
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Retry
        </Button>
      ) : null}
    </div>
  );
}

function useChapterSelect() {
  const curriculum = useCurriculum();
  const scholarClass = useStore((s) => s.user.scholarClass);
  const [subjectId, setSubjectId] = useState(curriculum[0]?.id ?? "physics");
  const subject = useMemo(
    () => curriculum.find((s) => s.id === subjectId) ?? curriculum[0],
    [curriculum, subjectId],
  );
  const [chapterId, setChapterId] = useState(subject?.chapters[0]?.id ?? "");

  useEffect(() => {
    if (subject && !subject.chapters.some((c) => c.id === chapterId)) {
      setChapterId(subject.chapters[0]?.id ?? "");
    }
  }, [chapterId, subject]);

  const chapter = useMemo(
    () => subject?.chapters.find((c) => c.id === chapterId) ?? subject?.chapters[0],
    [chapterId, subject],
  );

  return {
    curriculum,
    scholarClass,
    subjectId,
    setSubjectId,
    subject,
    chapterId,
    setChapterId,
    chapter,
  };
}

// ============================================================================
// 1. Concept Explainer
// ============================================================================
export function ConceptExplainerPlugin({ initialPrompt }: { initialPrompt?: string }) {
  const { curriculum, scholarClass, subjectId, setSubjectId, subject, chapterId, setChapterId, chapter } = useChapterSelect();
  const addNote = useStore((s) => s.addNote);
  const [concept, setConcept] = useState(initialPrompt ?? "");
  const [depth, setDepth] = useState<"intuition" | "exam" | "derivation">("exam");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [output, setOutput] = useState<string | null>(null);

  const run = async () => {
    const target = concept.trim() || chapter?.title || "";
    if (!target) {
      toast.error("Enter a concept or select a chapter first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const depthGuide =
        depth === "intuition"
          ? "Focus on physical/real-world intuition, everyday analogies, a step-by-step mental model, and common misconceptions."
          : depth === "derivation"
            ? "Focus on rigorous mathematical/scientific formulation, step-by-step derivation, limiting cases, and high-difficulty application."
            : "Focus on CBSE exam definition, key formulas/points, a worked NCERT-level example, and examiner marking tips.";
      const prompt = `Explain the concept "${target}" for a Class ${scholarClass} CBSE student (${subject?.name ?? "General"} · ${chapter?.title ?? "General"}).\n\n${depthGuide}\n\nStructure with clear headings: Core Idea, Step-by-Step Breakdown, Key Formula / Rule, Worked Example, and Common Pitfall.`;
      const text = await askAI(prompt, "default", { mode: "lesson" });
      setOutput(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate explanation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select value={subjectId} onValueChange={setSubjectId}>
          <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
          <SelectContent>
            {curriculum.map((s) => <SelectItem key={s.id} value={s.id}>{s.icon} {s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={chapterId} onValueChange={setChapterId}>
          <SelectTrigger><SelectValue placeholder="Chapter" /></SelectTrigger>
          <SelectContent>
            {(subject?.chapters ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-2">
        {([
          ["intuition", "Intuition & Analogy"],
          ["exam", "CBSE Exam Ready"],
          ["derivation", "Deep Derivation & Edge Cases"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setDepth(id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              depth === id
                ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-100"
                : "border-white/15 bg-white/5 text-white/65 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <Textarea
        value={concept}
        onChange={(e) => setConcept(e.target.value)}
        rows={3}
        placeholder={`Enter a specific concept or paste notes (e.g., "${chapter?.concepts?.[0] ?? chapter?.title ?? "Conservation of Momentum"}")…`}
      />
      <Button onClick={run} disabled={loading} className="w-full">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lightbulb className="mr-2 h-4 w-4" />}
        Explain Concept
      </Button>
      {loading ? <PluginLoading label="Building structured concept breakdown…" /> : null}
      {error ? <PluginError message={error} onRetry={run} /> : null}
      {output ? (
        <div className="space-y-3 rounded-2xl border border-white/15 bg-white/[0.04] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
            <Badge className="bg-cyan-500/20 text-cyan-200 border-cyan-500/30">{subject?.name} · {chapter?.title}</Badge>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  addNote({ title: `Concept: ${concept.trim() || chapter?.title || "Study Note"}`, content: output, folder: subject?.id ?? "general" });
                  toast.success("Saved to your Scholar Notes");
                }}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" /> Save to Notes
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  exportPDF({
                    title: concept.trim() || chapter?.title || "Concept Explanation",
                    subtitle: `Class ${scholarClass} · ${subject?.name ?? ""}`,
                    bodyHtml: mdToHtml(output),
                    scholarClass,
                  });
                }}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" /> Export PDF
              </Button>
            </div>
          </div>
          <Markdown content={output} />
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// 2. Chapter Summarizer
// ============================================================================
export function ChapterSummarizerPlugin({ initialPrompt }: { initialPrompt?: string }) {
  const { curriculum, scholarClass, subjectId, setSubjectId, subject, chapterId, setChapterId, chapter } = useChapterSelect();
  const addNote = useStore((s) => s.addNote);
  const [notesInput, setNotesInput] = useState(initialPrompt ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const sourceMaterial = notesInput.trim()
        ? `Source material / student notes:\n${notesInput.trim()}`
        : `Chapter: ${subject?.name} — ${chapter?.title}\nKey topics: ${(chapter?.concepts ?? []).join(", ")}\nExisting summary context: ${chapter?.summary ?? ""}`;
      const prompt = `Create a comprehensive, exam-focused chapter summary for Class ${scholarClass} CBSE.\n\n${sourceMaterial}\n\nInclude:\n1. **Executive Overview** (3–4 sentences)\n2. **Key Definitions & Laws**\n3. **Core Formulas / Dates / Rules**\n4. **High-Yield Exam Points & Distinctions**\n5. **Quick 5-Point Revision Checklist**`;
      const res = await askAI(prompt, "default", { mode: "summary" });
      setSummary(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not summarize chapter.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select value={subjectId} onValueChange={setSubjectId}>
          <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
          <SelectContent>
            {curriculum.map((s) => <SelectItem key={s.id} value={s.id}>{s.icon} {s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={chapterId} onValueChange={setChapterId}>
          <SelectTrigger><SelectValue placeholder="Chapter" /></SelectTrigger>
          <SelectContent>
            {(subject?.chapters ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Textarea
        value={notesInput}
        onChange={(e) => setNotesInput(e.target.value)}
        rows={4}
        placeholder="Optional: paste chapter text, lecture notes, or attached excerpt to summarize (leave blank to summarize the selected syllabus chapter)…"
      />
      <Button onClick={run} disabled={loading} className="w-full">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookOpen className="mr-2 h-4 w-4" />}
        Generate Chapter Summary
      </Button>
      {loading ? <PluginLoading label="Distilling key concepts and exam points…" /> : null}
      {error ? <PluginError message={error} onRetry={run} /> : null}
      {summary ? (
        <div className="space-y-3 rounded-2xl border border-white/15 bg-white/[0.04] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
            <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-500/30">{subject?.name} · {chapter?.title}</Badge>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  addNote({ title: `Summary: ${chapter?.title ?? "Chapter"}`, content: summary, folder: subject?.id ?? "general" });
                  toast.success("Summary saved to Notes");
                }}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" /> Save to Notes
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  exportPDF({
                    title: `${chapter?.title ?? "Chapter"} — Summary`,
                    subtitle: `Class ${scholarClass} CBSE · ${subject?.name ?? ""}`,
                    bodyHtml: mdToHtml(summary),
                    scholarClass,
                  });
                }}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" /> Export PDF
              </Button>
            </div>
          </div>
          <Markdown content={summary} />
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// 3. Flashcard Maker
// ============================================================================
interface GeneratedCard {
  front: string;
  back: string;
  explanation?: string;
  topic?: string;
}

export function FlashcardMakerPlugin({ initialPrompt }: { initialPrompt?: string }) {
  const { curriculum, scholarClass, subjectId, setSubjectId, subject, chapterId, setChapterId, chapter } = useChapterSelect();
  const addFlashcard = useStore((s) => s.addFlashcard);
  const [sourceText, setSourceText] = useState(initialPrompt ?? "");
  const [count, setCount] = useState("6");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cards, setCards] = useState<GeneratedCard[]>([]);
  const [savedIds, setSavedIds] = useState<Record<number, boolean>>({});

  const run = async () => {
    setLoading(true);
    setError("");
    setSavedIds({});
    try {
      const context = sourceText.trim()
        ? `Source material:\n${sourceText.trim()}`
        : `Subject: ${subject?.name}, Chapter: ${chapter?.title}, Topics: ${(chapter?.concepts ?? []).join(", ")}`;
      const prompt = `Create ${count} high-yield active-recall flashcards for Class ${scholarClass} CBSE.\n${context}\nReturn JSON matching: { "cards": [{ "front": string, "back": string, "explanation": string, "topic": string }] }`;
      const data = await askAIJSON<{ cards: GeneratedCard[] }>(prompt, "default", { mode: "flashcards" });
      if (!data?.cards?.length) throw new Error("No flashcards were returned. Please retry.");
      setCards(data.cards);
      toast.success(`Generated ${data.cards.length} flashcards`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate flashcards.");
    } finally {
      setLoading(false);
    }
  };

  const saveCard = (card: GeneratedCard, idx: number) => {
    addFlashcard({
      deckId: subject?.id ?? "general",
      front: card.front,
      back: card.explanation ? `${card.back}\n\nWhy: ${card.explanation}` : card.back,
    });
    setSavedIds((prev) => ({ ...prev, [idx]: true }));
  };

  const saveAll = () => {
    cards.forEach((card, idx) => {
      if (!savedIds[idx]) saveCard(card, idx);
    });
    toast.success(`Saved ${cards.length} flashcards to your Flashcards deck`);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Select value={subjectId} onValueChange={setSubjectId}>
          <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
          <SelectContent>
            {curriculum.map((s) => <SelectItem key={s.id} value={s.id}>{s.icon} {s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={chapterId} onValueChange={setChapterId}>
          <SelectTrigger><SelectValue placeholder="Chapter" /></SelectTrigger>
          <SelectContent>
            {(subject?.chapters ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={count} onValueChange={setCount}>
          <SelectTrigger><SelectValue placeholder="Count" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="4">4 cards</SelectItem>
            <SelectItem value="6">6 cards</SelectItem>
            <SelectItem value="8">8 cards</SelectItem>
            <SelectItem value="10">10 cards</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Textarea
        value={sourceText}
        onChange={(e) => setSourceText(e.target.value)}
        rows={3}
        placeholder="Optional: paste notes, definitions, or topic focus to turn into flashcards…"
      />
      <Button onClick={run} disabled={loading} className="w-full">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Layers className="mr-2 h-4 w-4" />}
        Generate Flashcards
      </Button>
      {loading ? <PluginLoading label="Creating active-recall flashcards…" /> : null}
      {error ? <PluginError message={error} onRetry={run} /> : null}
      {cards.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/60">{cards.length} cards ready</span>
            <Button size="sm" onClick={saveAll} className="bg-emerald-500 hover:bg-emerald-600 text-white">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Save All to Flashcards
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {cards.map((card, idx) => (
              <div key={idx} className="flex flex-col justify-between rounded-2xl border border-white/15 bg-white/[0.04] p-4 space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-[10px] border-white/20 text-white/70">
                      Card {idx + 1}{card.topic ? ` · ${card.topic}` : ""}
                    </Badge>
                    <button
                      type="button"
                      disabled={Boolean(savedIds[idx])}
                      onClick={() => {
                        saveCard(card, idx);
                        toast.success("Card saved to Flashcards");
                      }}
                      className="text-xs font-semibold text-cyan-300 hover:text-cyan-200 disabled:text-emerald-300"
                    >
                      {savedIds[idx] ? "✓ Saved" : "+ Save"}
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-white">Q: {card.front}</p>
                  <p className="text-xs leading-relaxed text-white/80">A: {card.back}</p>
                  {card.explanation ? (
                    <p className="text-[11px] text-white/55 border-t border-white/10 pt-2">{card.explanation}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// 4. Formula Sheet Generator
// ============================================================================
export function FormulaSheetGeneratorPlugin({ initialPrompt }: { initialPrompt?: string }) {
  const { curriculum, scholarClass, subjectId, setSubjectId, subject, chapterId, setChapterId, chapter } = useChapterSelect();
  const addNote = useStore((s) => s.addNote);
  const [focus, setFocus] = useState(initialPrompt ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const prompt = `Generate a complete, structured Formula & Key Relations Sheet for Class ${scholarClass} CBSE (${subject?.name ?? "Science"} — ${chapter?.title ?? "Chapter"}).\n${focus.trim() ? `Additional focus/context: ${focus.trim()}\n` : ""}\nInclude:\n1. **Core Formulas & Equations** (with clear variable definitions and SI units)\n2. **Dimensional Formulas & Constants** (where applicable)\n3. **Sign Conventions & Conditions of Validity**\n4. **Important Special Cases / Shortcuts for Numericals**\nUse clean Markdown tables and LaTeX notation where helpful.`;
      const res = await askAI(prompt, "default", { mode: "summary" });
      setSheet(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate formula sheet.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select value={subjectId} onValueChange={setSubjectId}>
          <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
          <SelectContent>
            {curriculum.map((s) => <SelectItem key={s.id} value={s.id}>{s.icon} {s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={chapterId} onValueChange={setChapterId}>
          <SelectTrigger><SelectValue placeholder="Chapter" /></SelectTrigger>
          <SelectContent>
            {(subject?.chapters ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Input
        value={focus}
        onChange={(e) => setFocus(e.target.value)}
        placeholder="Optional: specific sub-topic (e.g. Projectile motion, Thermodynamics laws, Trigonometry)…"
      />
      <Button onClick={run} disabled={loading} className="w-full">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
        Generate Formula Sheet
      </Button>
      {loading ? <PluginLoading label="Compiling formulas, units, and conditions…" /> : null}
      {error ? <PluginError message={error} onRetry={run} /> : null}
      {sheet ? (
        <div className="space-y-3 rounded-2xl border border-white/15 bg-white/[0.04] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
            <Badge className="bg-indigo-500/20 text-indigo-200 border-indigo-500/30">{subject?.name} · {chapter?.title}</Badge>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  addNote({ title: `Formula Sheet: ${chapter?.title ?? "Chapter"}`, content: sheet, folder: subject?.id ?? "general" });
                  toast.success("Saved to Notes");
                }}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" /> Save to Notes
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  exportPDF({
                    title: `${chapter?.title ?? "Chapter"} — Formula Sheet`,
                    subtitle: `Class ${scholarClass} · ${subject?.name ?? ""}`,
                    bodyHtml: mdToHtml(sheet),
                    scholarClass,
                  });
                }}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" /> Download PDF
              </Button>
            </div>
          </div>
          <Markdown content={sheet} />
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// 5. Notes-to-Quiz
// ============================================================================
interface NotesQuizItem {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export function NotesToQuizPlugin({ initialPrompt }: { initialPrompt?: string }) {
  const { scholarClass, subject, chapter } = useChapterSelect();
  const addXP = useStore((s) => s.addXP);
  const [notes, setNotes] = useState(initialPrompt ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState<NotesQuizItem[]>([]);
  const [picks, setPicks] = useState<Record<number, string>>({});

  const run = async () => {
    const material = notes.trim() || `${subject?.name}: ${chapter?.title} — ${(chapter?.concepts ?? []).join(", ")}`;
    setLoading(true);
    setError("");
    setPicks({});
    try {
      const prompt = `Generate 5 multiple-choice questions for a Class ${scholarClass} CBSE student from the following study notes/topic:\n\n${material}\n\nReturn JSON matching: { "questions": [{ "question": string, "options": [string, string, string, string], "correctAnswer": string (must exactly match one of the four options), "explanation": string }] }`;
      const res = await askAIJSON<{ questions: NotesQuizItem[] }>(prompt, "default", { mode: "json" });
      if (!res?.questions?.length) throw new Error("Could not build quiz from these notes.");
      setQuestions(res.questions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Quiz generation failed.");
    } finally {
      setLoading(false);
    }
  };

  const score = useMemo(
    () => questions.reduce((acc, q, i) => (picks[i] === q.correctAnswer ? acc + 1 : acc), 0),
    [picks, questions],
  );

  return (
    <div className="space-y-4">
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={5}
        placeholder="Paste your study notes, textbook excerpt, or topic summary here (or attach a file from the LAM composer)…"
      />
      <Button onClick={run} disabled={loading} className="w-full">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <HelpCircle className="mr-2 h-4 w-4" />}
        Turn Notes into Interactive Quiz
      </Button>
      {loading ? <PluginLoading label="Crafting 5 concept-check MCQs from your notes…" /> : null}
      {error ? <PluginError message={error} onRetry={run} /> : null}
      {questions.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3">
            <span className="text-sm font-medium text-white">
              Answered: {Object.keys(picks).length}/{questions.length}
            </span>
            <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-500/30">
              Score: {score}/{questions.length}
            </Badge>
          </div>
          {questions.map((q, idx) => {
            const picked = picks[idx];
            return (
              <div key={idx} className="rounded-2xl border border-white/15 bg-white/[0.04] p-4 space-y-3">
                <p className="text-sm font-semibold text-white">
                  {idx + 1}. {q.question}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {q.options.map((opt) => {
                    const isPicked = picked === opt;
                    const isRight = opt === q.correctAnswer;
                    let cls = "border-white/15 bg-white/5 text-white/80 hover:bg-white/10";
                    if (picked) {
                      if (isRight) cls = "border-emerald-400/50 bg-emerald-500/20 text-emerald-100";
                      else if (isPicked) cls = "border-rose-400/50 bg-rose-500/20 text-rose-100";
                    }
                    return (
                      <button
                        key={opt}
                        type="button"
                        disabled={Boolean(picked)}
                        onClick={() => {
                          setPicks((prev) => ({ ...prev, [idx]: opt }));
                          if (opt === q.correctAnswer) addXP(2);
                        }}
                        className={`rounded-xl border p-3 text-left text-xs font-medium transition ${cls}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {picked ? (
                  <p className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/75">
                    <strong className={picked === q.correctAnswer ? "text-emerald-300" : "text-amber-300"}>
                      {picked === q.correctAnswer ? "Correct! " : `Correct answer: ${q.correctAnswer}. `}
                    </strong>
                    {q.explanation}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// 6. Answer Evaluator
// ============================================================================
interface RubricEvaluation {
  score: number;
  maxScore: number;
  correctConcepts: string[];
  missingConcepts: string[];
  formulaFeedback: string;
  unitsFeedback: string;
  stepFeedback: string;
  markingBreakdown: Array<{
    criterion: string;
    marksAwarded: number;
    maxMarks: number;
    feedback: string;
  }>;
  improvedAnswer: string;
}

export function AnswerEvaluatorPlugin({ initialPrompt }: { initialPrompt?: string }) {
  const { scholarClass, subject } = useChapterSelect();
  const [question, setQuestion] = useState("");
  const [studentAnswer, setStudentAnswer] = useState(initialPrompt ?? "");
  const [maxMarks, setMaxMarks] = useState("5");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [evaluation, setEvaluation] = useState<RubricEvaluation | null>(null);

  const run = async () => {
    if (!question.trim() || !studentAnswer.trim()) {
      toast.error("Enter both the exam question and your answer.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const prompt = `Evaluate this Class ${scholarClass} CBSE (${subject?.name ?? "Science"}) student answer strictly according to CBSE step-wise marking.\n\nQuestion (${maxMarks} marks): ${question.trim()}\n\nStudent Answer:\n${studentAnswer.trim()}\n\nReturn JSON with: score (0 to ${maxMarks}), maxScore (${Number(maxMarks)}), correctConcepts (string[]), missingConcepts (string[]), formulaFeedback (string), unitsFeedback (string), stepFeedback (string), markingBreakdown ([{ criterion, marksAwarded, maxMarks, feedback }]), improvedAnswer (string).`;
      const res = await askAIJSON<RubricEvaluation>(prompt, "default", { mode: "answer-evaluation" });
      if (!res) throw new Error("Evaluation returned no data.");
      setEvaluation(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not evaluate answer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Exam question (e.g., State and prove the work-energy theorem for a variable force)…"
        />
        <Select value={maxMarks} onValueChange={setMaxMarks}>
          <SelectTrigger><SelectValue placeholder="Marks" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="2">2 Marks</SelectItem>
            <SelectItem value="3">3 Marks</SelectItem>
            <SelectItem value="5">5 Marks</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Textarea
        value={studentAnswer}
        onChange={(e) => setStudentAnswer(e.target.value)}
        rows={6}
        placeholder="Paste or write your descriptive answer here for CBSE rubric evaluation…"
      />
      <Button onClick={run} disabled={loading} className="w-full">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-2 h-4 w-4" />}
        Evaluate Answer with CBSE Rubric
      </Button>
      {loading ? <PluginLoading label="Grading your answer against CBSE step-marking criteria…" /> : null}
      {error ? <PluginError message={error} onRetry={run} /> : null}
      {evaluation ? (
        <div className="space-y-4 rounded-2xl border border-white/15 bg-white/[0.04] p-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-white/50">CBSE Rubric Score</p>
              <p className="text-3xl font-bold text-white">
                {evaluation.score} <span className="text-lg text-white/50">/ {evaluation.maxScore}</span>
              </p>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-500/30">
              {Math.round((evaluation.score / evaluation.maxScore) * 100)}%
            </Badge>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/60">Step-wise Breakdown</p>
            {evaluation.markingBreakdown.map((item, idx) => (
              <div key={idx} className="rounded-xl border border-white/10 bg-black/25 p-3">
                <div className="flex items-center justify-between text-xs font-semibold text-white">
                  <span>{item.criterion}</span>
                  <span>{item.marksAwarded}/{item.maxMarks}</span>
                </div>
                <p className="mt-1 text-xs text-white/70">{item.feedback}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
              <p className="text-xs font-semibold text-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Concepts Covered
              </p>
              <ul className="mt-2 space-y-1 text-xs text-white/80">
                {evaluation.correctConcepts.map((c, i) => <li key={i}>• {c}</li>)}
              </ul>
            </div>
            <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3">
              <p className="text-xs font-semibold text-rose-200 flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5" /> Missing / Needs Detail
              </p>
              <ul className="mt-2 space-y-1 text-xs text-white/80">
                {evaluation.missingConcepts.map((c, i) => <li key={i}>• {c}</li>)}
              </ul>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-200 mb-2">Model Full-Marks Answer</p>
            <Markdown content={evaluation.improvedAnswer} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// 7. Revision & Study Planner
// ============================================================================
interface PlannedDay {
  day: string;
  title: string;
  subject: string;
  durationMinutes: number;
  focus: string;
}

export function RevisionPlannerPlugin({ initialPrompt }: { initialPrompt?: string }) {
  const { curriculum, scholarClass } = useChapterSelect();
  const addTask = useStore((s) => s.addTask);
  const [days, setDays] = useState("7");
  const [hoursPerDay, setHoursPerDay] = useState("3");
  const [goal, setGoal] = useState(initialPrompt ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [schedule, setSchedule] = useState<PlannedDay[]>([]);
  const [addedToPlanner, setAddedToPlanner] = useState(false);

  const run = async () => {
    setLoading(true);
    setError("");
    setAddedToPlanner(false);
    try {
      const subjectsList = curriculum.map((s) => `${s.name} (${s.chapters.slice(0, 4).map((c) => c.title).join(", ")})`).join("; ");
      const prompt = `Create a realistic ${days}-day CBSE Class ${scholarClass} revision and study schedule (${hoursPerDay} hours/day).\nAvailable syllabus: ${subjectsList}.\n${goal.trim() ? `Student goal / weak topics: ${goal.trim()}` : ""}\nReturn JSON: { "schedule": [{ "day": string (e.g. "Day 1"), "title": string, "subject": string, "durationMinutes": number, "focus": string }] }`;
      const res = await askAIJSON<{ schedule: PlannedDay[] }>(prompt, "default", { mode: "json" });
      if (!res?.schedule?.length) throw new Error("Could not generate schedule.");
      setSchedule(res.schedule);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate revision plan.");
    } finally {
      setLoading(false);
    }
  };

  const commitToPlanner = () => {
    const today = new Date();
    schedule.forEach((item, index) => {
      const date = new Date(today.getTime() + index * 86_400_000).toISOString().slice(0, 10);
      addTask({
        title: `${item.subject}: ${item.title} (${item.durationMinutes}m)`,
        subject: item.subject.toLowerCase(),
        date,
        priority: index < 2 ? "high" : "medium",
      });
    });
    setAddedToPlanner(true);
    toast.success(`Added ${schedule.length} revision sessions to your Scholar Planner`);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger><SelectValue placeholder="Horizon" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="3">3-Day Sprint</SelectItem>
            <SelectItem value="7">7-Day Weekly Plan</SelectItem>
            <SelectItem value="14">14-Day Exam Block</SelectItem>
          </SelectContent>
        </Select>
        <Select value={hoursPerDay} onValueChange={setHoursPerDay}>
          <SelectTrigger><SelectValue placeholder="Daily study hours" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="2">2 hours / day</SelectItem>
            <SelectItem value="3">3 hours / day</SelectItem>
            <SelectItem value="4">4 hours / day</SelectItem>
            <SelectItem value="6">6 hours / day</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Textarea
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        rows={3}
        placeholder="Optional: mention upcoming exam date, weak chapters, or subjects to prioritize…"
      />
      <Button onClick={run} disabled={loading} className="w-full">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarDays className="mr-2 h-4 w-4" />}
        Build Revision & Study Plan
      </Button>
      {loading ? <PluginLoading label="Balancing chapters, recall sessions, and practice blocks…" /> : null}
      {error ? <PluginError message={error} onRetry={run} /> : null}
      {schedule.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-white/60">{schedule.length} study blocks generated</span>
            <Button
              size="sm"
              disabled={addedToPlanner}
              onClick={commitToPlanner}
              className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {addedToPlanner ? "Added to Planner ✓" : "Add All to Scholar Planner"}
            </Button>
          </div>
          <div className="space-y-2.5">
            {schedule.map((item, idx) => (
              <div key={idx} className="flex flex-col gap-1 rounded-2xl border border-white/15 bg-white/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-cyan-500/20 text-cyan-200 border-cyan-500/30">{item.day}</Badge>
                    <Badge variant="outline" className="border-white/20 text-white/75">{item.subject}</Badge>
                    <span className="text-xs text-white/50">{item.durationMinutes} mins</span>
                  </div>
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="text-xs text-white/65">{item.focus}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// 8. Diagram & Flowchart Builder
// ============================================================================
interface FlowchartNode {
  step: number;
  title: string;
  detail: string;
  formulaOrTag?: string;
}

export function DiagramFlowchartBuilderPlugin({ initialPrompt }: { initialPrompt?: string }) {
  const { scholarClass, subject, chapter } = useChapterSelect();
  const [topic, setTopic] = useState(initialPrompt ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [diagramTitle, setDiagramTitle] = useState("");
  const [nodes, setNodes] = useState<FlowchartNode[]>([]);

  const run = async () => {
    const target = topic.trim() || `${subject?.name}: ${chapter?.title}`;
    setLoading(true);
    setError("");
    try {
      const prompt = `Build a clear, step-by-step academic concept flowchart / process diagram for Class ${scholarClass} CBSE on: "${target}".\nReturn JSON: { "title": string, "nodes": [{ "step": number, "title": string, "detail": string, "formulaOrTag": string }] } with 4 to 7 sequential or hierarchical stages.`;
      const res = await askAIJSON<{ title: string; nodes: FlowchartNode[] }>(prompt, "default", { mode: "json" });
      if (!res?.nodes?.length) throw new Error("Could not build flowchart nodes.");
      setDiagramTitle(res.title || target);
      setNodes(res.nodes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Flowchart generation failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder={`Topic or process to map (e.g., "${chapter?.title ?? "Carnot Cycle"}", "Nitrogen Cycle", "Solving Kinematics Problems")…`}
      />
      <Button onClick={run} disabled={loading} className="w-full">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitBranch className="mr-2 h-4 w-4" />}
        Build Visual Flowchart
      </Button>
      {loading ? <PluginLoading label="Structuring concept nodes and transitions…" /> : null}
      {error ? <PluginError message={error} onRetry={run} /> : null}
      {nodes.length > 0 ? (
        <div className="space-y-4 rounded-2xl border border-white/15 bg-white/[0.04] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
            <h3 className="text-base font-semibold text-white">{diagramTitle}</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const md = `# ${diagramTitle}\n\n` + nodes.map((n) => `### Step ${n.step}: ${n.title}\n${n.detail}${n.formulaOrTag ? `\n\n**Key relation:** \`${n.formulaOrTag}\`` : ""}`).join("\n\n---\n\n");
                exportPDF({ title: diagramTitle, subtitle: `Class ${scholarClass} Flowchart`, bodyHtml: mdToHtml(md), scholarClass });
              }}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export PDF
            </Button>
          </div>
          <div className="relative space-y-3 pl-4 before:absolute before:bottom-4 before:left-6 before:top-4 before:w-0.5 before:bg-gradient-to-b before:from-cyan-400 before:via-indigo-400 before:to-emerald-400">
            {nodes.map((node, i) => (
              <div key={i} className="relative flex items-start gap-4">
                <div className="relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cyan-500 text-xs font-bold text-slate-950 shadow">
                  {node.step || i + 1}
                </div>
                <div className="flex-1 rounded-2xl border border-white/12 bg-black/35 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{node.title}</p>
                    {node.formulaOrTag ? (
                      <Badge variant="outline" className="border-cyan-400/30 bg-cyan-400/10 text-cyan-200 text-[10px]">
                        {node.formulaOrTag}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-white/75">{node.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// 9. PYQ Solver (Previous Year Question Solver)
// ============================================================================
export function PYQSolverPlugin({ initialPrompt }: { initialPrompt?: string }) {
  const { scholarClass } = useChapterSelect();
  const samplePyqs = useMemo(() => PHYSICS_PAST_PAPERS.slice(0, 8), []);
  const [question, setQuestion] = useState(initialPrompt ?? samplePyqs[0]?.question ?? "");
  const [marks, setMarks] = useState("3");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [solution, setSolution] = useState<string | null>(null);

  const run = async () => {
    if (!question.trim()) {
      toast.error("Select or paste a previous-year question first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const prompt = `Solve this Class ${scholarClass} Previous Year Question (${marks} marks) with a complete CBSE board examiner marking breakdown:\n\nQuestion:\n${question.trim()}\n\nFormat your response with:\n1. **Concept & Chapter Identified**\n2. **Given Data & Formula Used** (with ½ mark allocation)\n3. **Step-by-Step Solution / Derivation** (with step-marks shown at each stage)\n4. **Final Boxed Answer with SI Units**\n5. **Examiner Tip / Common Student Mistake**`;
      const res = await askAI(prompt, "default", { mode: "chat" });
      setSolution(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not solve PYQ.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs text-white/60">Quick-load a real Past Paper question or paste your own below:</label>
        <div className="flex flex-wrap gap-1.5">
          {samplePyqs.slice(0, 4).map((pyq) => (
            <button
              key={pyq.id}
              type="button"
              onClick={() => {
                setQuestion(pyq.question);
                setMarks(String(pyq.marks));
              }}
              className="rounded-xl border border-white/15 bg-white/5 px-2.5 py-1 text-left text-[11px] text-white/75 hover:bg-white/10 hover:text-white"
            >
              {pyq.source} · {pyq.year} ({pyq.marks}M)
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_130px]">
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={4}
          placeholder="Paste any Previous Year Question (CBSE Board / School Annual / JEE)…"
        />
        <Select value={marks} onValueChange={setMarks}>
          <SelectTrigger><SelectValue placeholder="Marks" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 Mark</SelectItem>
            <SelectItem value="2">2 Marks</SelectItem>
            <SelectItem value="3">3 Marks</SelectItem>
            <SelectItem value="5">5 Marks</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button onClick={run} disabled={loading} className="w-full">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Target className="mr-2 h-4 w-4" />}
        Solve with Step-Wise Marking Scheme
      </Button>
      {loading ? <PluginLoading label="Solving with step-marks allocation…" /> : null}
      {error ? <PluginError message={error} onRetry={run} /> : null}
      {solution ? (
        <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-5">
          <Markdown content={solution} />
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// 10. NCERT Question Generator
// ============================================================================
interface NcertQuestionItem {
  type: string;
  marks: number;
  question: string;
  solution: string;
}

export function NcertQuestionGeneratorPlugin({ initialPrompt }: { initialPrompt?: string }) {
  const { curriculum, scholarClass, subjectId, setSubjectId, subject, chapterId, setChapterId, chapter } = useChapterSelect();
  const [qType, setQType] = useState("mixed");
  const [focus, setFocus] = useState(initialPrompt ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<NcertQuestionItem[]>([]);
  const [openSolutions, setOpenSolutions] = useState<Record<number, boolean>>({});

  const run = async () => {
    setLoading(true);
    setError("");
    setOpenSolutions({});
    try {
      const prompt = `Generate 5 NCERT-aligned practice questions with complete model solutions for Class ${scholarClass} CBSE (${subject?.name} — ${chapter?.title}).\nQuestion format preference: ${qType === "mixed" ? "Mix of 1M Assertion-Reason/MCQ, 2M Short Answer, 3M Analytical, and 5M Long Answer" : qType}.\n${focus.trim() ? `Specific focus: ${focus.trim()}` : ""}\nReturn JSON: { "questions": [{ "type": string, "marks": number, "question": string, "solution": string }] }`;
      const res = await askAIJSON<{ questions: NcertQuestionItem[] }>(prompt, "default", { mode: "json" });
      if (!res?.questions?.length) throw new Error("Could not generate NCERT questions.");
      setItems(res.questions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "NCERT question generation failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Select value={subjectId} onValueChange={setSubjectId}>
          <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
          <SelectContent>
            {curriculum.map((s) => <SelectItem key={s.id} value={s.id}>{s.icon} {s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={chapterId} onValueChange={setChapterId}>
          <SelectTrigger><SelectValue placeholder="Chapter" /></SelectTrigger>
          <SelectContent>
            {(subject?.chapters ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={qType} onValueChange={setQType}>
          <SelectTrigger><SelectValue placeholder="Question Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="mixed">Mixed CBSE Pattern</SelectItem>
            <SelectItem value="Assertion-Reason & MCQ (1 Mark)">Assertion-Reason & MCQ</SelectItem>
            <SelectItem value="NCERT Exemplar Short Answer (2-3 Marks)">Exemplar Short (2–3M)</SelectItem>
            <SelectItem value="Case-Based & Long Answer (4-5 Marks)">Case-Based & Long (4–5M)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Input
        value={focus}
        onChange={(e) => setFocus(e.target.value)}
        placeholder="Optional: specific NCERT section, theorem, or exercise focus…"
      />
      <Button onClick={run} disabled={loading} className="w-full">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
        Generate NCERT Questions & Solutions
      </Button>
      {loading ? <PluginLoading label="Generating NCERT-aligned questions and solutions…" /> : null}
      {error ? <PluginError message={error} onRetry={run} /> : null}
      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="rounded-2xl border border-white/15 bg-white/[0.04] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Badge className="bg-violet-500/20 text-violet-200 border-violet-500/30">{item.type}</Badge>
                <span className="text-xs text-white/60">{item.marks} {item.marks === 1 ? "mark" : "marks"}</span>
              </div>
              <p className="text-sm font-medium text-white">{idx + 1}. {item.question}</p>
              <button
                type="button"
                onClick={() => setOpenSolutions((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                className="text-xs font-semibold text-cyan-300 hover:text-cyan-200"
              >
                {openSolutions[idx] ? "Hide Model Solution" : "Show Model Solution →"}
              </button>
              {openSolutions[idx] ? (
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/80">
                  <Markdown content={item.solution} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// 11. Mistake Pattern Tracker
// ============================================================================
export function MistakePatternTrackerPlugin({ initialPrompt }: { initialPrompt?: string }) {
  const scholarClass = useStore((s) => s.user.scholarClass);
  const [extraContext, setExtraContext] = useState(initialPrompt ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<string | null>(null);

  const recordedMistakes = useMemo(() => {
    const quizMistakes = loadQuizMistakes(scholarClass);
    const ppMistakes = profileGetJSON<Array<{ question?: string; chapter?: string; subject?: string }>>(scholarClass, "pp-mistakes", []);
    const doubts = profileGetJSON<Array<{ question?: string; subject?: string; status?: string }>>(scholarClass, "doubt-history", []);
    return {
      quizCount: quizMistakes.length,
      ppCount: ppMistakes.length,
      openDoubts: doubts.filter((d) => d.status !== "resolved").length,
      samples: [
        ...quizMistakes.slice(0, 8).map((m) => `[Quiz · ${m.subject} · ${m.chapter}] ${m.question} (Picked: ${m.userAnswer}; Correct: ${m.correctAnswer})`),
        ...ppMistakes.slice(0, 6).map((m) => `[Past Paper · ${m.subject ?? "Physics"} · ${m.chapter ?? ""}] ${m.question ?? ""}`),
        ...doubts.slice(0, 6).map((d) => `[Doubt · ${d.subject ?? "General"}] ${d.question ?? ""}`),
      ],
    };
  }, [scholarClass]);

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const historyBlock = recordedMistakes.samples.length
        ? `Recorded student mistakes and open doubts:\n${recordedMistakes.samples.join("\n")}`
        : "No automatic quiz/past-paper mistakes recorded yet; use the student's self-reported notes below.";
      const prompt = `Analyze recurring mistake patterns for this Class ${scholarClass} CBSE student.\n\n${historyBlock}\n\n${extraContext.trim() ? `Additional student notes:\n${extraContext.trim()}\n\n` : ""}Provide:\n1. **Recurring Error Patterns** (conceptual vs calculation vs reading/sign errors)\n2. **High-Risk Chapters & Subtopics**\n3. **Targeted 3-Step Corrective Drill**`;
      const res = await askAI(prompt, "mistake-analyzer");
      setReport(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not analyze mistake patterns.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-3 text-center">
          <p className="text-xl font-bold text-amber-300">{recordedMistakes.quizCount}</p>
          <p className="text-[11px] text-white/60">Quiz Mistakes</p>
        </div>
        <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-3 text-center">
          <p className="text-xl font-bold text-rose-300">{recordedMistakes.ppCount}</p>
          <p className="text-[11px] text-white/60">Past Paper Mistakes</p>
        </div>
        <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-3 text-center">
          <p className="text-xl font-bold text-violet-300">{recordedMistakes.openDoubts}</p>
          <p className="text-[11px] text-white/60">Open Doubts</p>
        </div>
      </div>
      <Textarea
        value={extraContext}
        onChange={(e) => setExtraContext(e.target.value)}
        rows={3}
        placeholder="Optional: add any recent test errors or topics where you keep losing marks…"
      />
      <Button onClick={run} disabled={loading} className="w-full">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
        Diagnose My Mistake Patterns
      </Button>
      {loading ? <PluginLoading label="Scanning your quiz, past-paper, and doubt history for patterns…" /> : null}
      {error ? <PluginError message={error} onRetry={run} /> : null}
      {report ? (
        <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-5">
          <Markdown content={report} />
        </div>
      ) : null}
    </div>
  );
}
