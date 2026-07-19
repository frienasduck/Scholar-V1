"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Sparkles, Loader2, Plus, Trash2, Copy, ArrowUp, ArrowDown, Edit3, Eye,
  Presentation, FileText, Wand2, RefreshCw, Download, Play, X, ChevronLeft,
  ChevronRight, Save, Search, Filter, Image as ImageIcon, Code2, Mic,
  Lightbulb, AlertTriangle, Trophy, BookOpen, Clock, Layers, Maximize2,
  Minimize2, Keyboard, ListChecks, FileDown, Link2,
} from "lucide-react";

import { askAIJSON } from "@/lib/ai";
import { useStore } from "@/lib/store";
import { useCurriculum } from "@/lib/use-curriculum";
import {
  type Slide, type Slideshow, type SlideshowTemplate, type SlideshowMode,
  type SlideshowDifficulty, type SlideType,
  TEMPLATES, MODES, DIFFICULTIES, SLIDE_TYPES,
  getTemplate, getSlideTypeMeta,
  loadSlideshows, upsertSlideshow, deleteSlideshow,
  newSlide, newSlideshow,
  buildSlideshowPrompt, validateAIResponse,
} from "@/lib/slideshow";
import { cn } from "@/lib/utils";
import { NarratedSlideshowMaker } from "@/components/views/narrated-slideshow";

// ============================================================================
// AI helpers — fetch with timeout so the client doesn't hang forever
// ============================================================================

async function askAIJSONWithTimeout(
  message: string,
  persona: string,
  opts: { temperature?: number },
  timeoutMs: number
): Promise<any | null> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Use askAIJSON but with abort signal — we'll reimplement here to add abort support
    const { useStore: _useStore } = await import("@/lib/store");
    const state = _useStore.getState();
    const scholarClass = state.user.scholarClass ?? 9;
    const jeeMode = state.user.jeeMode ?? false;

    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: message }],
        persona,
        temperature: opts.temperature ?? 0.55,
        json: true,
        scholarClass,
        jeeMode,
      }),
      signal: controller.signal,
    });
    clearTimeout(tid);
    if (!res.ok) return null;
    const text = await res.text();
    let data: { ok?: boolean; data?: any };
    try { data = JSON.parse(text); } catch { return null; }
    if (!data.ok || !data.data) return null;
    return data.data;
  } catch (e: any) {
    clearTimeout(tid);
    if (e?.name === "AbortError") return null;
    return null;
  }
}

// ============================================================================
// AI Slideshow Maker
// ============================================================================

type InputMode = "prompt" | "topic" | "notes" | "chapter";

const INPUT_MODES: { id: InputMode; name: string; icon: any; hint: string }[] = [
  { id: "prompt", name: "Prompt", icon: Wand2, hint: "Type a free-form prompt." },
  { id: "topic", name: "Topic", icon: BookOpen, hint: "Pick subject, chapter, audience." },
  { id: "notes", name: "Paste Notes", icon: FileText, hint: "Turn rough notes into slides." },
  { id: "chapter", name: "Chapter", icon: Layers, hint: "Generate from a curriculum chapter." },
];

export function SlideshowMaker() {
  const scholarClass = useStore((s) => s.user.scholarClass);
  const jeeMode = useStore((s) => s.user.jeeMode);
  const addXP = useStore((s) => s.addXP);
  const addCoins = useStore((s) => s.addCoins);
  const pushActivity = useStore((s) => s.pushActivity);
  const curriculum = useCurriculum();

  // ===== Generation settings =====
  const [inputMode, setInputMode] = useState<InputMode>("prompt");
  const [prompt, setPrompt] = useState("");
  const [topic, setTopic] = useState("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [chapterId, setChapterId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [slideCount, setSlideCount] = useState(12);
  const [mode, setMode] = useState<SlideshowMode>("chapter-explanation");
  const [difficulty, setDifficulty] = useState<SlideshowDifficulty>("standard");
  const [template, setTemplate] = useState<SlideshowTemplate>("scholar-glass");
  const [language, setLanguage] = useState("English");
  const [includeSpeakerNotes, setIncludeSpeakerNotes] = useState(true);
  const [includeDiagrams, setIncludeDiagrams] = useState(true);
  const [includeExamples, setIncludeExamples] = useState(true);
  const [includePractice, setIncludePractice] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeReferences, setIncludeReferences] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genStage, setGenStage] = useState("");

  // ===== Editor state =====
  const [active, setActive] = useState<Slideshow | null>(null);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [editingSlide, setEditingSlide] = useState<Slide | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const [narrationMode, setNarrationMode] = useState(false);

  // ===== Saved library =====
  const [saved, setSaved] = useState<Slideshow[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setSaved(loadSlideshows());
  }, []);

  // Build the prompt text for any input mode
  const buildPromptText = useCallback((): string => {
    if (inputMode === "prompt") return prompt.trim();
    if (inputMode === "notes") return `Convert these rough notes into a structured presentation:\n\n${notes.trim()}`;
    if (inputMode === "topic") {
      const sub = curriculum.find((s) => s.id === subjectId)?.name ?? subjectId;
      return `Create a presentation on "${topic || "the selected topic"}" for Class ${scholarClass} ${sub}. Audience: Class ${scholarClass} students.`;
    }
    // chapter
    const sub = curriculum.find((s) => s.id === subjectId);
    const ch = sub?.chapters.find((c) => c.id === chapterId);
    const concepts = ch?.concepts?.length ? `Key concepts: ${ch.concepts.join(", ")}.` : "";
    const formulas = ch?.formulas?.length ? `Important formulas: ${ch.formulas.join(", ")}.` : "";
    return `Create a presentation on Class ${scholarClass} ${sub?.name ?? ""} — Chapter: "${ch?.title ?? ""}". ${concepts} ${formulas} Cover the chapter thoroughly with definitions, formulas, worked examples, and practice questions.`;
  }, [inputMode, prompt, notes, topic, subjectId, chapterId, scholarClass, curriculum]);

  const canGenerate = useMemo(() => {
    if (generating) return false;
    if (inputMode === "prompt") return prompt.trim().length > 5;
    if (inputMode === "notes") return notes.trim().length > 20;
    if (inputMode === "topic") return topic.trim().length > 1 && !!subjectId;
    if (inputMode === "chapter") return !!subjectId && !!chapterId;
    return false;
  }, [inputMode, prompt, notes, topic, subjectId, chapterId, generating]);

  const handleGenerate = async () => {
    if (!canGenerate) {
      toast.error("Please fill in the required fields first.");
      return;
    }
    setGenerating(true);
    setGenStage("Composing prompt…");
    try {
      const finalPrompt = buildPromptText();
      const subName = curriculum.find((s) => s.id === subjectId)?.name ?? (inputMode === "prompt" ? "" : "");
      const chName = curriculum.find((s) => s.id === subjectId)?.chapters.find((c) => c.id === chapterId)?.title ?? "";

      const baseOpts = {
        prompt: finalPrompt,
        scholarClass,
        jeeMode,
        subject: subName,
        chapter: chName,
        mode,
        difficulty,
        template,
        includeSpeakerNotes,
        includeDiagrams,
        includeExamples,
        includePractice,
        includeSummary,
        includeReferences,
        language,
      };

      // Strategy: try with requested count first; if AI returns empty/truncated,
      // automatically retry ONCE with a smaller count (more likely to fit in token budget).
      const tryCounts = slideCount > 20 ? [slideCount, Math.min(20, slideCount), 12] : slideCount > 12 ? [slideCount, 12] : [slideCount];

      let lastErr: any = null;
      let parsed: { title?: string; slides: Slide[]; partial?: boolean } | null = null;
      let usedCount = slideCount;

      for (const tryCount of tryCounts) {
        const fullPrompt = buildSlideshowPrompt({ ...baseOpts, slideCount: tryCount });
        setGenStage(tryCount === slideCount ? "Calling AI…" : `Retrying with ${tryCount} slides…`);
        try {
          const result = await askAIJSONWithTimeout(fullPrompt, "default", { temperature: 0.55 }, 110_000);
          if (!result) {
            lastErr = new Error("AI returned an empty response. The model may have hit its output limit.");
            continue;
          }
          setGenStage("Validating slides…");
          parsed = validateAIResponse(result);
          if (!parsed || !parsed.slides.length) {
            lastErr = new Error("Could not parse slides from AI response.");
            parsed = null;
            continue;
          }
          usedCount = tryCount;
          break; // success
        } catch (e: any) {
          lastErr = e;
          continue;
        }
      }

      if (!parsed || !parsed.slides.length) {
        throw lastErr ?? new Error("AI returned an empty response. Please try fewer slides or a simpler prompt.");
      }

      const slideshow = newSlideshow({
        title: parsed.title ?? (inputMode === "prompt" ? prompt.slice(0, 60) : "New Presentation"),
        subject: subName,
        chapter: chName,
        classProfile: scholarClass,
        mode,
        template,
        difficulty,
        language,
        slides: parsed.slides,
      });

      // Auto-save
      const next = upsertSlideshow(slideshow);
      setSaved(next);

      setActive(slideshow);
      setActiveSlideIdx(0);
      setPreviewMode(false);
      addXP(8);
      addCoins(4);
      pushActivity({ type: "slideshow", text: `Created slideshow: ${slideshow.title.slice(0, 40)}`, icon: "📽️" });

      if (parsed.partial || parsed.slides.length < usedCount) {
        toast.success(`Generated ${parsed.slides.length} slides (requested ${usedCount}). · +8 XP, +4 coins`, {
          description: parsed.partial
            ? "The AI hit its output limit. You got partial slides — you can add more in the editor."
            : undefined,
        });
      } else {
        toast.success(`Generated ${parsed.slides.length} slides! · +8 XP, +4 coins`);
      }
    } catch (e: any) {
      const msg = e?.message || "Please try again in a moment.";
      toast.error("Slideshow generation failed", {
        description: msg.length > 200 ? msg.slice(0, 200) + "…" : msg,
      });
    } finally {
      setGenerating(false);
      setGenStage("");
    }
  };

  // ===== Editor actions =====
  const updateActive = useCallback((updated: Slideshow) => {
    setActive(updated);
  }, []);

  const persistActive = useCallback(() => {
    if (!active) return;
    const next = upsertSlideshow(active);
    setSaved(next);
    toast.success("Slideshow saved");
  }, [active]);

  const handleAddSlide = (type: SlideType = "concept") => {
    if (!active) return;
    const s = newSlide(type, { title: "New Slide" });
    const next = { ...active, slides: [...active.slides] };
    next.slides.splice(activeSlideIdx + 1, 0, s);
    next.updatedAt = Date.now();
    updateActive(next);
    setActiveSlideIdx(activeSlideIdx + 1);
    setEditingSlide(s);
  };

  const handleDeleteSlide = (idx: number) => {
    if (!active) return;
    if (active.slides.length <= 1) {
      toast.error("Cannot delete the only slide.");
      return;
    }
    const next = { ...active, slides: active.slides.filter((_, i) => i !== idx) };
    updateActive(next);
    if (activeSlideIdx >= next.slides.length) setActiveSlideIdx(next.slides.length - 1);
  };

  const handleDuplicateSlide = (idx: number) => {
    if (!active) return;
    const orig = active.slides[idx];
    const copy: Slide = {
      ...orig,
      id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: `${orig.title} (copy)`,
    };
    const next = { ...active, slides: [...active.slides] };
    next.slides.splice(idx + 1, 0, copy);
    updateActive(next);
    setActiveSlideIdx(idx + 1);
  };

  const handleMoveSlide = (idx: number, dir: -1 | 1) => {
    if (!active) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= active.slides.length) return;
    const slides = [...active.slides];
    [slides[idx], slides[newIdx]] = [slides[newIdx], slides[idx]];
    updateActive({ ...active, slides });
    setActiveSlideIdx(newIdx);
  };

  const handleUpdateSlide = (slideId: string, patch: Partial<Slide>) => {
    if (!active) return;
    const next = {
      ...active,
      slides: active.slides.map((s) => (s.id === slideId ? { ...s, ...patch } : s)),
    };
    updateActive(next);
    if (editingSlide?.id === slideId) setEditingSlide({ ...editingSlide, ...patch });
  };

  const handleRegenerateSlide = async (idx: number) => {
    if (!active) return;
    const slide = active.slides[idx];
    toast.info("Regenerating slide…");
    try {
      const promptText = `Rewrite ONLY this slide's content and speaker notes for a Class ${active.classProfile} ${active.subject} presentation. Make it clearer, more engaging, and academically rigorous. Return JSON.

Current slide:
${JSON.stringify({ type: slide.type, title: slide.title, content: slide.content, bullets: slide.bullets, formula: slide.formula, speakerNotes: slide.speakerNotes, practiceQuestion: slide.practiceQuestion, practiceAnswer: slide.practiceAnswer }, null, 2)}

Return ONLY JSON in this exact shape:
{
  "title": "...",
  "content": "...",
  "bullets": ["..."],
  "formula": "...",
  "speakerNotes": "...",
  "practiceQuestion": "...",
  "practiceAnswer": "..."
}
Omit any field that doesn't apply. No markdown fences.`;
      const result = await askAIJSON<any>(promptText, "default", { temperature: 0.6 });
      if (!result) throw new Error("AI returned empty");
      const patch: Partial<Slide> = {};
      if (typeof result.title === "string") patch.title = result.title;
      if (typeof result.content === "string") patch.content = result.content;
      if (Array.isArray(result.bullets)) patch.bullets = result.bullets.filter((b: any) => typeof b === "string");
      if (typeof result.formula === "string") patch.formula = result.formula;
      if (typeof result.speakerNotes === "string") patch.speakerNotes = result.speakerNotes;
      if (typeof result.practiceQuestion === "string") patch.practiceQuestion = result.practiceQuestion;
      if (typeof result.practiceAnswer === "string") patch.practiceAnswer = result.practiceAnswer;
      handleUpdateSlide(slide.id, patch);
      toast.success("Slide regenerated");
    } catch (e: any) {
      toast.error("Regeneration failed", { description: e?.message });
    }
  };

  const handleRewriteSlide = async (idx: number, action: "expand" | "shorten" | "simplify") => {
    if (!active) return;
    const slide = active.slides[idx];
    const map = {
      expand: "Expand this slide's content — add more detail, examples, and depth.",
      shorten: "Shorten this slide — make every bullet punchier and remove fluff.",
      simplify: "Simplify this slide's language so a younger student can understand it.",
    };
    toast.info(`${action === "expand" ? "Expanding" : action === "shorten" ? "Shortening" : "Simplifying"}…`);
    try {
      const promptText = `${map[action]} Return ONLY JSON of the updated slide.

Current slide:
${JSON.stringify({ type: slide.type, title: slide.title, content: slide.content, bullets: slide.bullets, formula: slide.formula, speakerNotes: slide.speakerNotes }, null, 2)}

Return ONLY: { "title": "...", "content": "...", "bullets": ["..."], "speakerNotes": "..." }
No markdown fences.`;
      const result = await askAIJSON<any>(promptText, "default", { temperature: 0.55 });
      if (!result) throw new Error("AI returned empty");
      const patch: Partial<Slide> = {};
      if (typeof result.title === "string") patch.title = result.title;
      if (typeof result.content === "string") patch.content = result.content;
      if (Array.isArray(result.bullets)) patch.bullets = result.bullets.filter((b: any) => typeof b === "string");
      if (typeof result.speakerNotes === "string") patch.speakerNotes = result.speakerNotes;
      handleUpdateSlide(slide.id, patch);
      toast.success(`Slide ${action}ed`);
    } catch (e: any) {
      toast.error("Rewrite failed", { description: e?.message });
    }
  };

  const handleDeleteSlideshow = (id: string) => {
    const next = deleteSlideshow(id);
    setSaved(next);
    if (active?.id === id) {
      setActive(null);
      setActiveSlideIdx(0);
    }
    toast.success("Slideshow deleted");
  };

  // ===== If a slideshow is active, show the editor =====
  if (active) {
    return (
      <SlideshowEditor
        slideshow={active}
        activeSlideIdx={activeSlideIdx}
        setActiveSlideIdx={setActiveSlideIdx}
        editingSlide={editingSlide}
        setEditingSlide={setEditingSlide}
        previewMode={previewMode}
        setPreviewMode={setPreviewMode}
        fullscreenPreview={fullscreenPreview}
        setFullscreenPreview={setFullscreenPreview}
        narrationMode={narrationMode}
        setNarrationMode={setNarrationMode}
        onUpdate={updateActive}
        onPersist={persistActive}
        onExit={() => { setActive(null); setEditingSlide(null); setPreviewMode(false); setNarrationMode(false); }}
        onAddSlide={handleAddSlide}
        onDeleteSlide={handleDeleteSlide}
        onDuplicateSlide={handleDuplicateSlide}
        onMoveSlide={handleMoveSlide}
        onUpdateSlide={handleUpdateSlide}
        onRegenerateSlide={handleRegenerateSlide}
        onRewriteSlide={handleRewriteSlide}
      />
    );
  }

  // ===== Generation form =====
  const selectedSubject = curriculum.find((s) => s.id === subjectId);

  return (
    <div className="space-y-6">
      {/* Top bar: saved library — ALWAYS visible */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-white/50 flex items-center gap-2">
          <Presentation className="h-3.5 w-3.5" />
          Class {scholarClass}{jeeMode ? " · JEE Mode" : ""}
        </div>
        <button
          onClick={() => setLibraryOpen(true)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/15 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
        >
          <Layers className="h-3.5 w-3.5" /> My Slideshows
          {saved.length > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-violet-500/30 text-violet-200 text-[10px] font-bold">{saved.length}</span>
          )}
        </button>
      </div>

      {/* Recently saved slideshows (quick access) */}
      {saved.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">Recent slideshows</p>
            <button onClick={() => setLibraryOpen(true)} className="text-[10px] text-violet-300 hover:text-violet-200">View all →</button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {saved.slice(0, 6).map((s) => {
              const tpl = getTemplate(s.template);
              return (
                <button
                  key={s.id}
                  onClick={() => { setActive(s); setActiveSlideIdx(0); }}
                  className="shrink-0 w-40 rounded-lg overflow-hidden border border-white/10 hover:border-violet-500/40 transition-colors text-left group"
                >
                  <div className="h-16" style={{ background: tpl.swatch }} />
                  <div className="p-2 bg-white/[0.02]">
                    <p className="text-[11px] text-white/80 truncate group-hover:text-white">{s.title}</p>
                    <p className="text-[9px] text-white/40">{s.slides.length} slides · {s.subject || "General"}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Input mode tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {INPUT_MODES.map((m) => {
          const Icon = m.icon;
          const isActive = inputMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setInputMode(m.id)}
              className={cn(
                "flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all",
                isActive
                  ? "bg-violet-500/15 border-violet-500/40 text-white"
                  : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="text-xs font-medium">{m.name}</span>
              <span className="text-[10px] text-white/40 leading-tight">{m.hint}</span>
            </button>
          );
        })}
      </div>

      {/* Input area */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        {inputMode === "prompt" && (
          <div>
            <label className="text-[10px] font-medium uppercase tracking-wider text-white/50">Your prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="e.g., Create a 12-slide Class 11 Physics presentation on Units and Measurement with formulas, examples, and practice questions."
              className="mt-1.5 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/40 resize-y"
            />
          </div>
        )}

        {inputMode === "notes" && (
          <div>
            <label className="text-[10px] font-medium uppercase tracking-wider text-white/50">Paste your notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              placeholder="Paste rough notes, bullet points, or any text. The AI will turn it into a structured presentation."
              className="mt-1.5 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/40 resize-y font-mono"
            />
          </div>
        )}

        {inputMode === "topic" && (
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wider text-white/50">Topic</label>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Newton's Laws of Motion"
                className="mt-1.5 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wider text-white/50">Subject</label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="mt-1.5 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              >
                <option value="">Pick subject…</option>
                {curriculum.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {inputMode === "chapter" && (
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wider text-white/50">Subject</label>
              <select
                value={subjectId}
                onChange={(e) => { setSubjectId(e.target.value); setChapterId(""); }}
                className="mt-1.5 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              >
                <option value="">Pick subject…</option>
                {curriculum.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wider text-white/50">Chapter</label>
              <select
                value={chapterId}
                onChange={(e) => setChapterId(e.target.value)}
                disabled={!selectedSubject}
                className="mt-1.5 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-50"
              >
                <option value="">{selectedSubject ? "Pick chapter…" : "Pick a subject first"}</option>
                {selectedSubject?.chapters.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
        <div className="flex items-center gap-2 text-xs font-medium text-white/70">
          <Sparkles className="h-3.5 w-3.5 text-violet-300" /> Generation Settings
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="Slides">
            <input
              type="number" min={3} max={40} value={slideCount}
              onChange={(e) => setSlideCount(Math.max(3, Math.min(40, +e.target.value || 12)))}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            />
          </Field>
          <Field label="Mode">
            <select value={mode} onChange={(e) => setMode(e.target.value as SlideshowMode)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40">
              {MODES.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="Difficulty">
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as SlideshowDifficulty)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40">
              {DIFFICULTIES.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Language">
            <select value={language} onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40">
              {["English", "Hindi", "Bilingual (English + Hindi)"].map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>
          <Field label="Template">
            <select value={template} onChange={(e) => setTemplate(e.target.value as SlideshowTemplate)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40">
              {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
        </div>

        {/* Template swatch preview */}
        <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 p-2">
          <div className="h-10 w-16 rounded-md shrink-0" style={{ background: getTemplate(template).swatch }} />
          <div className="text-xs">
            <p className="text-white/80 font-medium">{getTemplate(template).name}</p>
            <p className="text-white/40">{getTemplate(template).blurb}</p>
          </div>
        </div>

        {/* Toggles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { label: "Speaker Notes", v: includeSpeakerNotes, set: setIncludeSpeakerNotes, icon: Presentation },
            { label: "Diagrams", v: includeDiagrams, set: setIncludeDiagrams, icon: ImageIcon },
            { label: "Examples", v: includeExamples, set: setIncludeExamples, icon: Lightbulb },
            { label: "Practice Qs", v: includePractice, set: setIncludePractice, icon: ListChecks },
            { label: "Summary", v: includeSummary, set: setIncludeSummary, icon: Trophy },
            { label: "References", v: includeReferences, set: setIncludeReferences, icon: Link2 },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.label}
                onClick={() => t.set(!t.v)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors",
                  t.v
                    ? "bg-violet-500/15 border-violet-500/40 text-white"
                    : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
                <span className={cn("ml-auto h-2 w-2 rounded-full", t.v ? "bg-violet-400" : "bg-white/20")} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate}
        className={cn(
          "w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-all",
          canGenerate
            ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600 shadow-lg shadow-violet-500/25"
            : "bg-white/5 text-white/30 cursor-not-allowed"
        )}
      >
        {generating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {genStage || "Generating…"}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate {slideCount}-slide presentation
          </>
        )}
      </button>

      {!canGenerate && !generating && (
        <p className="text-center text-xs text-white/40">
          {inputMode === "prompt" && "Write at least a few words to enable generation."}
          {inputMode === "notes" && "Paste a meaningful chunk of notes (20+ characters)."}
          {inputMode === "topic" && "Pick a subject and type a topic."}
          {inputMode === "chapter" && "Pick a subject and chapter."}
        </p>
      )}

      {/* Saved library modal */}
      <AnimatePresence>
        {libraryOpen && typeof document !== "undefined" && createPortal(
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setLibraryOpen(false)}
            className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm grid place-items-center p-4"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl max-h-[80vh] overflow-hidden rounded-2xl border border-white/15 bg-zinc-950/95 backdrop-blur-xl flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Layers className="h-4 w-4" /> Saved Slideshows</h3>
                  <p className="text-[11px] text-white/40 mt-0.5">{saved.length} presentation{saved.length === 1 ? "" : "s"} saved locally</p>
                </div>
                <button onClick={() => setLibraryOpen(false)} className="text-white/50 hover:text-white"><X className="h-5 w-5" /></button>
              </div>
              <div className="p-3 border-b border-white/10">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by title, subject, or chapter…"
                    className="w-full rounded-lg bg-white/5 border border-white/10 pl-9 pr-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {saved.length === 0 && (
                  <div className="text-center py-10 text-white/40 text-sm">No saved slideshows yet. Generate one above!</div>
                )}
                {saved
                  .filter((s) =>
                    !search ||
                    s.title.toLowerCase().includes(search.toLowerCase()) ||
                    s.subject.toLowerCase().includes(search.toLowerCase()) ||
                    s.chapter.toLowerCase().includes(search.toLowerCase())
                  )
                  .map((s) => {
                    const tpl = getTemplate(s.template);
                    return (
                      <div key={s.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 hover:bg-white/[0.06] transition-colors">
                        <div className="h-12 w-16 rounded-md shrink-0" style={{ background: tpl.swatch }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{s.title}</p>
                          <p className="text-[11px] text-white/40 truncate">
                            Class {s.classProfile} · {s.subject || "—"} · {s.chapter || "—"} · {s.slides.length} slides · {tpl.name}
                          </p>
                          <p className="text-[10px] text-white/30 mt-0.5">
                            Created {new Date(s.createdAt).toLocaleDateString()} · Updated {new Date(s.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => { setActive(s); setActiveSlideIdx(0); setLibraryOpen(false); }}
                            className="px-3 py-1.5 rounded-lg bg-violet-500/20 border border-violet-500/40 text-violet-200 text-xs hover:bg-violet-500/30"
                          >Open</button>
                          <button
                            onClick={() => {
                              const dup = { ...s, id: `slideshow-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title: `${s.title} (copy)`, createdAt: Date.now(), updatedAt: Date.now() };
                              const next = upsertSlideshow(dup); setSaved(next); toast.success("Duplicated");
                            }}
                            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white"
                            title="Duplicate"
                          ><Copy className="h-3.5 w-3.5" /></button>
                          <button
                            onClick={() => handleDeleteSlideshow(s.id)}
                            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-rose-300 hover:border-rose-500/30"
                            title="Delete"
                          ><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </motion.div>
          </motion.div>,
          document.body
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Editor
// ============================================================================

interface EditorProps {
  slideshow: Slideshow;
  activeSlideIdx: number;
  setActiveSlideIdx: (i: number) => void;
  editingSlide: Slide | null;
  setEditingSlide: (s: Slide | null) => void;
  previewMode: boolean;
  setPreviewMode: (b: boolean) => void;
  fullscreenPreview: boolean;
  setFullscreenPreview: (b: boolean) => void;
  narrationMode: boolean;
  setNarrationMode: (b: boolean) => void;
  onUpdate: (s: Slideshow) => void;
  onPersist: () => void;
  onExit: () => void;
  onAddSlide: (type: SlideType) => void;
  onDeleteSlide: (idx: number) => void;
  onDuplicateSlide: (idx: number) => void;
  onMoveSlide: (idx: number, dir: -1 | 1) => void;
  onUpdateSlide: (id: string, patch: Partial<Slide>) => void;
  onRegenerateSlide: (idx: number) => void;
  onRewriteSlide: (idx: number, action: "expand" | "shorten" | "simplify") => void;
}

function SlideshowEditor(props: EditorProps) {
  const {
    slideshow, activeSlideIdx, setActiveSlideIdx,
    editingSlide, setEditingSlide,
    previewMode, setPreviewMode,
    fullscreenPreview, setFullscreenPreview,
    narrationMode, setNarrationMode,
    onUpdate, onPersist, onExit,
    onAddSlide, onDeleteSlide, onDuplicateSlide, onMoveSlide, onUpdateSlide,
    onRegenerateSlide, onRewriteSlide,
  } = props;

  const tpl = getTemplate(slideshow.template);
  const activeSlide = slideshow.slides[activeSlideIdx];

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        setActiveSlideIdx(Math.min(slideshow.slides.length - 1, activeSlideIdx + 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setActiveSlideIdx(Math.max(0, activeSlideIdx - 1));
      } else if (e.key === "Escape" && fullscreenPreview) {
        setFullscreenPreview(false);
      } else if (e.key === "f" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setFullscreenPreview(!fullscreenPreview);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeSlideIdx, slideshow.slides.length, fullscreenPreview, setActiveSlideIdx, setFullscreenPreview]);

  // Title editing
  const [titleEdit, setTitleEdit] = useState(false);
  const [titleDraft, setTitleDraft] = useState(slideshow.title);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setTitleDraft(slideshow.title); });
    return () => { cancelled = true; };
  }, [slideshow.title]);

  // ===== Fullscreen preview =====
  if (fullscreenPreview) {
    return (
      <FullscreenPreview
        slideshow={slideshow}
        initialIdx={activeSlideIdx}
        onExit={() => setFullscreenPreview(false)}
      />
    );
  }

  // ===== Narration / Auto-Lecture mode =====
  if (narrationMode) {
    return (
      <NarratedSlideshowMaker
        slideshow={slideshow}
        onExit={() => setNarrationMode(false)}
      />
    );
  }

  // ===== Preview mode (single slide, big) =====
  if (previewMode) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            onClick={() => setPreviewMode(false)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back to editor
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50">{activeSlideIdx + 1} / {slideshow.slides.length}</span>
            <button
              onClick={() => setFullscreenPreview(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-violet-500/20 border border-violet-500/40 text-violet-200 hover:bg-violet-500/30 transition-colors"
            >
              <Maximize2 className="h-3.5 w-3.5" /> Present Fullscreen
            </button>
          </div>
        </div>
        <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
          <SlideStage slide={activeSlide} tpl={tpl} className="aspect-video w-full" />
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setActiveSlideIdx(Math.max(0, activeSlideIdx - 1))}
            disabled={activeSlideIdx === 0}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <span className="text-xs text-white/50 truncate max-w-[60%]">{activeSlide.title}</span>
          <button
            onClick={() => setActiveSlideIdx(Math.min(slideshow.slides.length - 1, activeSlideIdx + 1))}
            disabled={activeSlideIdx === slideshow.slides.length - 1}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white disabled:opacity-40 transition-colors"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // ===== Editor (three-panel layout) =====
  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> New
          </button>
          <button
            onClick={() => { onPersist(); }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            title="My saved slideshows"
          >
            <Layers className="h-3.5 w-3.5" /> Library
          </button>
          {titleEdit ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => { onUpdate({ ...slideshow, title: titleDraft || "Untitled" }); setTitleEdit(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") { onUpdate({ ...slideshow, title: titleDraft || "Untitled" }); setTitleEdit(false); } }}
              className="text-sm bg-white/5 border border-white/15 rounded-lg px-2 py-1 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40 min-w-0"
            />
          ) : (
            <button
              onClick={() => setTitleEdit(true)}
              className="text-sm font-medium text-white hover:text-violet-300 flex items-center gap-1.5 min-w-0"
            >
              <span className="truncate">{slideshow.title}</span>
              <Edit3 className="h-3 w-3 text-white/40 shrink-0" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPreviewMode(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Eye className="h-3.5 w-3.5" /> Preview
          </button>
          <button
            onClick={() => setFullscreenPreview(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Play className="h-3.5 w-3.5" /> Present
          </button>
          <button
            onClick={() => setNarrationMode(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 border border-violet-400/40 text-violet-100 hover:from-violet-500/30 hover:to-fuchsia-500/30 transition-colors"
            title="AI Narrated Slideshow / Auto-Lecture Mode"
          >
            <Mic className="h-3.5 w-3.5" /> Auto-Lecture
          </button>
          <ExportMenu slideshow={slideshow} />
          <button
            onClick={onPersist}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-violet-500/20 border border-violet-500/40 text-violet-200 hover:bg-violet-500/30"
          >
            <Save className="h-3.5 w-3.5" /> Save
          </button>
        </div>
      </div>

      {/* Layout: thumbnails | main stage | edit panel */}
      <div className="grid grid-cols-12 gap-3">
        {/* Left: thumbnails */}
        <div className="col-span-12 lg:col-span-3 order-1">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2 max-h-[calc(100vh-20rem)] overflow-y-auto sticky top-2">
            <div className="text-[10px] font-medium uppercase tracking-wider text-white/40 px-2 py-1.5 sticky top-0 bg-zinc-950/95 backdrop-blur-sm z-10">
              {slideshow.slides.length} slides
            </div>
            <div className="space-y-1.5">
              {slideshow.slides.map((s, i) => (
                <ThumbCard
                  key={s.id}
                  slide={s}
                  index={i}
                  active={i === activeSlideIdx}
                  tpl={tpl}
                  onClick={() => { setActiveSlideIdx(i); setEditingSlide(null); }}
                />
              ))}
              <button
                onClick={() => onAddSlide("concept")}
                className="w-full flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg border border-dashed border-white/15 text-white/50 hover:text-white hover:border-violet-500/40 hover:bg-violet-500/5 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add slide
              </button>
            </div>
          </div>
        </div>

        {/* Center: main stage */}
        <div className="col-span-12 lg:col-span-6 order-2">
          <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            <SlideStage slide={activeSlide} tpl={tpl} className="aspect-video w-full" />
          </div>
          {/* Stage controls */}
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => onMoveSlide(activeSlideIdx, -1)}
                disabled={activeSlideIdx === 0}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white disabled:opacity-40"
                title="Move up"
              ><ArrowUp className="h-3.5 w-3.5" /></button>
              <button
                onClick={() => onMoveSlide(activeSlideIdx, 1)}
                disabled={activeSlideIdx === slideshow.slides.length - 1}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white disabled:opacity-40"
                title="Move down"
              ><ArrowDown className="h-3.5 w-3.5" /></button>
              <button
                onClick={() => onDuplicateSlide(activeSlideIdx)}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white"
                title="Duplicate"
              ><Copy className="h-3.5 w-3.5" /></button>
              <button
                onClick={() => onDeleteSlide(activeSlideIdx)}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-rose-300 hover:border-rose-500/30"
                title="Delete"
              ><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-white/50">
              <span>{activeSlideIdx + 1} / {slideshow.slides.length}</span>
              <span className="text-white/30">·</span>
              <span>{getSlideTypeMeta(activeSlide.type).icon} {getSlideTypeMeta(activeSlide.type).name}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setEditingSlide(editingSlide?.id === activeSlide.id ? null : activeSlide)}
                className={cn(
                  "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border",
                  editingSlide?.id === activeSlide.id
                    ? "bg-violet-500/15 border-violet-500/40 text-violet-200"
                    : "bg-white/5 border-white/10 text-white/60 hover:text-white"
                )}
              >
                <Edit3 className="h-3.5 w-3.5" /> Edit
              </button>
            </div>
          </div>

          {/* AI rewrite actions */}
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <button onClick={() => onRegenerateSlide(activeSlideIdx)}
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-white/60 hover:text-white">
              <RefreshCw className="h-3 w-3" /> Regenerate
            </button>
            <button onClick={() => onRewriteSlide(activeSlideIdx, "expand")}
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-white/60 hover:text-white">
              <Plus className="h-3 w-3" /> Expand
            </button>
            <button onClick={() => onRewriteSlide(activeSlideIdx, "shorten")}
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-white/60 hover:text-white">
              <RefreshCw className="h-3 w-3" /> Shorten
            </button>
            <button onClick={() => onRewriteSlide(activeSlideIdx, "simplify")}
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-white/60 hover:text-white">
              <Lightbulb className="h-3 w-3" /> Simplify
            </button>
          </div>

          {/* Speaker notes (below stage) */}
          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/40 flex items-center gap-1.5">
                <Presentation className="h-3 w-3" /> Speaker Notes
              </span>
              <button
                onClick={() => setEditingSlide(editingSlide?.id === activeSlide.id ? null : activeSlide)}
                className="text-[10px] text-white/50 hover:text-white"
              >{editingSlide?.id === activeSlide.id ? "Done" : "Edit"}</button>
            </div>
            {editingSlide?.id === activeSlide.id ? (
              <textarea
                value={editingSlide.speakerNotes}
                onChange={(e) => onUpdateSlide(activeSlide.id, { speakerNotes: e.target.value })}
                rows={3}
                placeholder="What should the presenter say while showing this slide?"
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/40 resize-y"
              />
            ) : (
              <p className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap">
                {activeSlide.speakerNotes || <span className="text-white/30 italic">No speaker notes yet.</span>}
              </p>
            )}
          </div>
        </div>

        {/* Right: edit panel */}
        <div className="col-span-12 lg:col-span-3 order-3">
          <EditPanel
            slide={editingSlide ?? activeSlide}
            tpl={tpl}
            isEditing={!!editingSlide}
            onStartEdit={() => setEditingSlide(activeSlide)}
            onStopEdit={() => setEditingSlide(null)}
            onUpdate={(patch) => onUpdateSlide(activeSlide.id, patch)}
            onAddSlide={onAddSlide}
            onTemplateChange={(t) => onUpdate({ ...slideshow, template: t })}
            currentTemplate={slideshow.template}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Slide Stage (renders one slide with the template styling)
// ============================================================================

export function SlideStage({ slide, tpl, className, fullscreen, highlightKeywords, isNarrating, revealAnswer }: {
  slide: Slide;
  tpl: ReturnType<typeof getTemplate>;
  className?: string;
  fullscreen?: boolean;
  highlightKeywords?: string[];
  isNarrating?: boolean;
  revealAnswer?: boolean;
}) {
  const meta = getSlideTypeMeta(slide.type);

  // Type-specific accent badge
  const typeColor: Record<SlideType, string> = {
    title: tpl.accent,
    agenda: "#38bdf8",
    section: "#a78bfa",
    concept: "#60a5fa",
    formula: "#fbbf24",
    diagram: "#34d399",
    example: "#fb923c",
    practice: "#f472b6",
    summary: "#22d3ee",
    takeaways: "#facc15",
    comparison: "#c084fc",
    table: "#60a5fa",
    timeline: "#2dd4bf",
    definitions: "#a3e635",
    mistakes: "#fb7185",
    "exam-tips": "#f59e0b",
    recap: "#818cf8",
    quiz: "#f472b6",
    thanks: tpl.accent,
  };

  return (
    <div
      className={cn("relative overflow-hidden flex flex-col", className)}
      style={{
        background: slide.background || tpl.background,
        color: tpl.text,
        fontFamily: tpl.fontFamily,
      }}
    >
      {/* Decorative accent shape */}
      <div
        className="absolute -top-20 -right-20 h-48 w-48 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: typeColor[slide.type] }}
      />
      {/* Narrating pulse indicator */}
      {isNarrating && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/15">
          <span className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-1 rounded-full bg-violet-300"
                animate={{ height: [4, 12, 4] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                style={{ height: 4 }}
              />
            ))}
          </span>
          <span className="text-[9px] text-white/60 uppercase tracking-wider">Narrating</span>
        </div>
      )}

      <div className={cn("relative z-10 h-full w-full flex flex-col", fullscreen ? "p-8 sm:p-12 lg:p-16" : "p-5 sm:p-6 lg:p-7")}>
        {/* Type badge */}
        {slide.type !== "title" && slide.type !== "thanks" && (
          <div className="flex items-center gap-2 mb-3 shrink-0">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider"
              style={{ background: `${typeColor[slide.type]}20`, color: typeColor[slide.type] }}
            >
              <span>{meta.icon}</span>
              {meta.name}
            </span>
          </div>
        )}

        {/* Title */}
        <SlideTitle slide={slide} tpl={tpl} fullscreen={fullscreen} highlightKeywords={highlightKeywords} />

        {/* Body */}
        <SlideBody slide={slide} tpl={tpl} typeColor={typeColor} fullscreen={fullscreen} highlightKeywords={highlightKeywords} revealAnswer={revealAnswer} />

        {/* Footer for title slide */}
        {slide.type === "title" && (
          <div className="mt-auto pt-4 text-xs opacity-60 shrink-0">
            <p>Class {useStore.getState().user.scholarClass} · {new Date().getFullYear()}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper: highlight keywords in a text string
function HighlightedText({ text, keywords, baseClass }: { text: string; keywords?: string[]; baseClass?: string }) {
  if (!keywords || !keywords.length) return <span className={baseClass}>{text}</span>;
  // Build a regex that matches any keyword (case-insensitive, word-boundary)
  const escaped = keywords
    .filter((k) => k && k.length > 1)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!escaped.length) return <span className={baseClass}>{text}</span>;
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(re);
  return (
    <span className={baseClass}>
      {parts.map((part, i) =>
        keywords.some((k) => k.toLowerCase() === part.toLowerCase()) ? (
          <mark key={i} className="bg-yellow-300/30 text-inherit rounded px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

function SlideTitle({ slide, tpl, fullscreen, highlightKeywords }: { slide: Slide; tpl: ReturnType<typeof getTemplate>; fullscreen?: boolean; highlightKeywords?: string[] }) {
  const titleSize = fullscreen ? "text-4xl sm:text-5xl lg:text-6xl" : "text-2xl sm:text-3xl";
  const headingSize = fullscreen ? "text-3xl sm:text-4xl lg:text-5xl" : "text-xl sm:text-2xl";
  if (slide.type === "title") {
    return (
      <div className="mt-auto mb-auto text-center">
        <h1 className={cn("font-bold leading-tight mb-3", titleSize)} style={{ color: tpl.text }}>
          <HighlightedText text={slide.title} keywords={highlightKeywords} />
        </h1>
        {slide.content && (
          <p className={cn("opacity-70 max-w-xl mx-auto", fullscreen ? "text-base sm:text-lg" : "text-sm sm:text-base")}>{slide.content}</p>
        )}
      </div>
    );
  }
  if (slide.type === "thanks") {
    return (
      <div className="mt-auto mb-auto text-center">
        <div className={cn("mb-4", fullscreen ? "text-6xl" : "text-5xl")}>🙏</div>
        <h1 className={cn("font-bold mb-2", headingSize)} style={{ color: tpl.text }}>{slide.title}</h1>
        {slide.content && <p className={cn("opacity-70", fullscreen ? "text-base" : "text-sm")}>{slide.content}</p>}
      </div>
    );
  }
  return (
    <h2 className={cn("font-bold mb-4 leading-tight shrink-0", headingSize)} style={{ color: tpl.text }}>
      <HighlightedText text={slide.title} keywords={highlightKeywords} />
    </h2>
  );
}

function SlideBody({
  slide, tpl, typeColor, fullscreen, highlightKeywords, revealAnswer,
}: {
  slide: Slide;
  tpl: ReturnType<typeof getTemplate>;
  typeColor: Record<SlideType, string>;
  fullscreen?: boolean;
  highlightKeywords?: string[];
  revealAnswer?: boolean;
}) {
  const accent = typeColor[slide.type];
  const textBase = fullscreen ? "text-base sm:text-lg" : "text-xs sm:text-sm";
  const textLarge = fullscreen ? "text-lg sm:text-xl" : "text-sm sm:text-base";
  const textBullet = fullscreen ? "text-base sm:text-lg" : "text-sm sm:text-base";
  const textFormula = fullscreen ? "text-3xl sm:text-4xl lg:text-5xl" : "text-xl sm:text-2xl lg:text-3xl";

  // Formula slide
  if (slide.type === "formula" && slide.formula) {
    return (
      <div className="flex-1 flex flex-col justify-center">
        <div
          className="rounded-2xl p-6 sm:p-8 text-center"
          style={{ background: tpl.cardBg, border: `1px solid ${accent}40` }}
        >
          <p className={cn("font-mono font-bold mb-3", textFormula)} style={{ color: accent }}>
            {slide.formula}
          </p>
          {slide.content && <p className={cn("opacity-70", textBase)}>{slide.content}</p>}
        </div>
        {slide.bullets && slide.bullets.length > 0 && (
          <ul className="mt-4 space-y-2">
            {slide.bullets.map((b, i) => (
              <li key={i} className={cn("flex items-start gap-2 opacity-90", textBullet)}>
                <span className="mt-1.5 h-1 w-1 rounded-full shrink-0" style={{ background: accent }} />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Example slide
  if (slide.type === "example") {
    return (
      <div className="flex-1 space-y-3">
        {slide.content && (
          <div className="rounded-xl p-4" style={{ background: tpl.cardBg }}>
            <p className="text-[10px] uppercase tracking-wider opacity-50 mb-1">Problem</p>
            <p className={cn(textLarge)}>{slide.content}</p>
          </div>
        )}
        {slide.bullets && slide.bullets.length > 0 && (
          <div className="rounded-xl p-4 border" style={{ borderColor: `${accent}40`, background: `${accent}10` }}>
            <p className="text-[10px] uppercase tracking-wider opacity-60 mb-2" style={{ color: accent }}>Solution</p>
            <ol className="space-y-2">
              {slide.bullets.map((b, i) => (
                <li key={i} className={cn("flex items-start gap-2", textBase)}>
                  <span className="font-bold shrink-0" style={{ color: accent }}>{i + 1}.</span>
                  <span>{b}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    );
  }

  // Practice slide
  if (slide.type === "practice") {
    return (
      <div className="flex-1 space-y-3">
        {slide.practiceQuestion && (
          <div className="rounded-xl p-4" style={{ background: tpl.cardBg }}>
            <p className="text-[10px] uppercase tracking-wider opacity-50 mb-1">Try it</p>
            <p className={cn("font-medium", textLarge)}>{slide.practiceQuestion}</p>
          </div>
        )}
        {slide.practiceAnswer && (
          revealAnswer !== undefined ? (
            // During narration playback — only show if revealAnswer is true
            revealAnswer && (
              <div className="rounded-xl p-4 border" style={{ borderColor: `${accent}40`, background: `${accent}10` }}>
                <p className="text-[10px] uppercase tracking-wider opacity-70 mb-1" style={{ color: accent }}>Answer</p>
                <p className={textBase}>{slide.practiceAnswer}</p>
              </div>
            )
          ) : (
            // Normal editor view — collapsible
            <details className="rounded-xl p-4 border" style={{ borderColor: `${accent}40`, background: `${accent}10` }}>
              <summary className="text-[10px] uppercase tracking-wider cursor-pointer opacity-70" style={{ color: accent }}>
                Show answer
              </summary>
              <p className={cn("mt-2", textBase)}>{slide.practiceAnswer}</p>
            </details>
          )
        )}
        {slide.bullets && slide.bullets.length > 0 && (
          <ul className="space-y-2">
            {slide.bullets.map((b, i) => (
              <li key={i} className={cn("flex items-start gap-2 opacity-80", textBase)}>
                <span className="mt-1.5 h-1 w-1 rounded-full shrink-0" style={{ background: accent }} />
                <HighlightedText text={b} keywords={highlightKeywords} />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Quiz slide
  if (slide.type === "quiz") {
    return (
      <div className="flex-1 space-y-3">
        {slide.content && <p className={cn("font-medium", textLarge)}>{slide.content}</p>}
        {slide.bullets && slide.bullets.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {slide.bullets.map((b, i) => (
              <div key={i} className="rounded-lg p-3 border" style={{ borderColor: `${accent}30`, background: tpl.cardBg }}>
                <span className="text-xs font-bold opacity-60 mr-2">{String.fromCharCode(65 + i)}.</span>
                <span className={cn(textBase)}>{b}</span>
              </div>
            ))}
          </div>
        )}
        {slide.practiceAnswer && (
          <p className="text-[10px] opacity-50 italic">Answer: {slide.practiceAnswer}</p>
        )}
      </div>
    );
  }

  // Comparison slide (2-column bullets)
  if (slide.type === "comparison" && slide.bullets && slide.bullets.length >= 2) {
    const half = Math.ceil(slide.bullets.length / 2);
    const left = slide.bullets.slice(0, half);
    const right = slide.bullets.slice(half);
    return (
      <div className="flex-1 grid grid-cols-2 gap-3">
        {[left, right].map((col, ci) => (
          <div key={ci} className="rounded-xl p-4" style={{ background: tpl.cardBg }}>
            {col.map((b, i) => (
              <p key={i} className={cn("mb-2 last:mb-0 flex items-start gap-2", textBase)}>
                <span className="mt-1.5 h-1 w-1 rounded-full shrink-0" style={{ background: accent }} />
                <span>{b}</span>
              </p>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // Table slide
  if (slide.type === "table" && slide.bullets && slide.bullets.length > 0) {
    return (
      <div className="flex-1">
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: `${accent}30` }}>
          {slide.bullets.map((b, i) => {
            const cells = b.split("|").map((c) => c.trim());
            if (cells.length < 2) {
              return (
                <div key={i} className={cn("px-4 py-2", textBase)} style={{ background: i === 0 ? `${accent}20` : tpl.cardBg, fontWeight: i === 0 ? 600 : 400 }}>
                  {b}
                </div>
              );
            }
            return (
              <div key={i} className="grid" style={{ gridTemplateColumns: `repeat(${cells.length}, 1fr)`, background: i === 0 ? `${accent}20` : tpl.cardBg }}>
                {cells.map((c, ci) => (
                  <div key={ci} className={cn("px-3 py-2 border-r last:border-r-0", textBase)} style={{ borderColor: `${accent}20`, fontWeight: i === 0 ? 600 : 400 }}>
                    {c}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        {slide.content && <p className={cn("mt-3 opacity-60", textBase)}>{slide.content}</p>}
      </div>
    );
  }

  // Timeline slide
  if (slide.type === "timeline" && slide.bullets && slide.bullets.length > 0) {
    return (
      <div className="flex-1">
        <div className="relative pl-6">
          <div className="absolute left-2 top-0 bottom-0 w-0.5" style={{ background: `${accent}40` }} />
          {slide.bullets.map((b, i) => (
            <div key={i} className="relative mb-4 last:mb-0">
              <div className="absolute -left-[18px] top-1 h-3 w-3 rounded-full border-2" style={{ background: tpl.background, borderColor: accent }} />
              <p className={textBase}>{b}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Diagram slide
  if (slide.type === "diagram") {
    return (
      <div className="flex-1 flex flex-col justify-center">
        <div
          className="rounded-2xl p-6 border-2 border-dashed text-center"
          style={{ borderColor: `${accent}40`, background: tpl.cardBg }}
        >
          <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" style={{ color: accent }} />
          <p className="text-[10px] uppercase tracking-wider opacity-60 mb-2">Diagram placeholder</p>
          <p className={cn("opacity-80", textBase)}>{slide.diagramPrompt || "Draw a labelled diagram here."}</p>
        </div>
        {slide.bullets && slide.bullets.length > 0 && (
          <ul className="mt-3 space-y-1">
            {slide.bullets.map((b, i) => (
              <li key={i} className={cn("flex items-start gap-2 opacity-80", textBase)}>
                <span className="mt-1.5 h-1 w-1 rounded-full shrink-0" style={{ background: accent }} />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Definitions / mistakes / exam-tips / recap / takeaways — list with strong styling
  if (["definitions", "mistakes", "exam-tips", "recap", "takeaways"].includes(slide.type) && slide.bullets && slide.bullets.length > 0) {
    return (
      <div className="flex-1 space-y-2">
        {slide.content && <p className={cn("opacity-70 mb-2", textBase)}>{slide.content}</p>}
        {slide.bullets.map((b, i) => {
          const [term, ...rest] = b.split(":").map((x) => x.trim());
          const def = rest.join(":");
          return (
            <div key={i} className="rounded-lg p-3 flex items-start gap-3" style={{ background: tpl.cardBg }}>
              <span className="text-xs font-bold shrink-0 px-1.5 py-0.5 rounded" style={{ background: `${accent}20`, color: accent }}>
                {i + 1}
              </span>
              <p className={textBase}>
                {def ? <><span className="font-semibold">{term}:</span> {def}</> : term}
              </p>
            </div>
          );
        })}
      </div>
    );
  }

  // Section divider
  if (slide.type === "section") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="h-1 w-16 mx-auto rounded-full mb-4" style={{ background: accent }} />
          <h2 className={cn("font-bold opacity-90", fullscreen ? "text-3xl sm:text-4xl lg:text-5xl" : "text-xl sm:text-2xl lg:text-3xl")}>{slide.title}</h2>
          {slide.content && <p className={cn("opacity-50 mt-2", textBase)}>{slide.content}</p>}
        </div>
      </div>
    );
  }

  // Agenda / summary / concept — bullet-driven
  if (slide.bullets && slide.bullets.length > 0) {
    return (
      <div className="flex-1">
        {slide.content && <p className={cn("opacity-70 mb-3", textBase)}><HighlightedText text={slide.content} keywords={highlightKeywords} /></p>}
        <ul className="space-y-2">
          {slide.bullets.map((b, i) => (
            <li key={i} className={cn("flex items-start gap-3", textBullet)}>
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: accent }} />
              <HighlightedText text={b} keywords={highlightKeywords} />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Fallback — content only
  if (slide.content) {
    return (
      <div className="flex-1">
        <p className={cn("opacity-85 leading-relaxed whitespace-pre-wrap", textLarge)}><HighlightedText text={slide.content} keywords={highlightKeywords} /></p>
      </div>
    );
  }

  return <div className={cn("flex-1 grid place-items-center opacity-40 italic", textBase)}>Empty slide</div>;
}

// ============================================================================
// Thumbnail card
// ============================================================================

function ThumbCard({
  slide, index, active, tpl, onClick,
}: {
  slide: Slide; index: number; active: boolean; tpl: ReturnType<typeof getTemplate>; onClick: () => void;
}) {
  const meta = getSlideTypeMeta(slide.type);
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-lg overflow-hidden border transition-all text-left",
        active ? "border-violet-500/60 ring-2 ring-violet-500/30" : "border-white/10 hover:border-white/25"
      )}
    >
      <div
        className="aspect-video p-2 relative overflow-hidden"
        style={{ background: tpl.background, color: tpl.text, fontFamily: tpl.fontFamily }}
      >
        <div className="text-[8px] uppercase tracking-wide opacity-50 mb-0.5">{meta.icon} {meta.name}</div>
        <p className="text-[10px] font-semibold leading-tight line-clamp-2">{slide.title}</p>
        {slide.bullets && slide.bullets.length > 0 && (
          <p className="text-[7px] opacity-50 mt-0.5 line-clamp-2">{slide.bullets[0]}</p>
        )}
      </div>
      <div className="px-2 py-1 bg-white/[0.02] flex items-center justify-between">
        <span className="text-[10px] text-white/40">#{index + 1}</span>
        <span className="text-[10px] text-white/30">{slide.bullets?.length ?? 0} bullets</span>
      </div>
    </button>
  );
}

// ============================================================================
// Edit Panel
// ============================================================================

function EditPanel({
  slide, tpl, isEditing, onStartEdit, onStopEdit, onUpdate, onAddSlide, onTemplateChange, currentTemplate,
}: {
  slide: Slide;
  tpl: ReturnType<typeof getTemplate>;
  isEditing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onUpdate: (patch: Partial<Slide>) => void;
  onAddSlide: (type: SlideType) => void;
  onTemplateChange: (t: SlideshowTemplate) => void;
  currentTemplate: SlideshowTemplate;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 max-h-[calc(100vh-20rem)] overflow-y-auto sticky top-2 space-y-3">
      {/* Template switcher */}
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-white/40 mb-1.5">Template</p>
        <div className="grid grid-cols-2 gap-1.5">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => onTemplateChange(t.id)}
              className={cn(
                "rounded-md overflow-hidden border text-left transition-all",
                currentTemplate === t.id ? "border-violet-500/60 ring-1 ring-violet-500/30" : "border-white/10 hover:border-white/25"
              )}
            >
              <div className="h-8" style={{ background: t.swatch }} />
              <p className="text-[9px] text-white/60 px-1.5 py-0.5 truncate">{t.name}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10 pt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">Slide editor</p>
          <button
            onClick={isEditing ? onStopEdit : onStartEdit}
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-full",
              isEditing ? "bg-violet-500/20 text-violet-200 border border-violet-500/40" : "bg-white/5 text-white/60 border border-white/10"
            )}
          >
            {isEditing ? "Editing" : "Edit"}
          </button>
        </div>

        <div className="space-y-2">
          <div>
            <label className="text-[9px] text-white/40 uppercase tracking-wider">Type</label>
            <select
              value={slide.type}
              onChange={(e) => onUpdate({ type: e.target.value as SlideType })}
              className="mt-0.5 w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            >
              {SLIDE_TYPES.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[9px] text-white/40 uppercase tracking-wider">Title</label>
            <input
              value={slide.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              className="mt-0.5 w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            />
          </div>

          <div>
            <label className="text-[9px] text-white/40 uppercase tracking-wider">Content</label>
            <textarea
              value={slide.content}
              onChange={(e) => onUpdate({ content: e.target.value })}
              rows={3}
              placeholder="Main paragraph"
              className="mt-0.5 w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500/40 resize-y"
            />
          </div>

          <div>
            <label className="text-[9px] text-white/40 uppercase tracking-wider">Bullets (one per line)</label>
            <textarea
              value={(slide.bullets ?? []).join("\n")}
              onChange={(e) => onUpdate({ bullets: e.target.value.split("\n").filter((b) => b.trim() || true) })}
              rows={4}
              placeholder="One bullet per line"
              className="mt-0.5 w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500/40 resize-y font-mono"
            />
          </div>

          {(slide.type === "formula" || slide.formula) && (
            <div>
              <label className="text-[9px] text-white/40 uppercase tracking-wider">Formula</label>
              <input
                value={slide.formula ?? ""}
                onChange={(e) => onUpdate({ formula: e.target.value })}
                placeholder="e.g., v = u + at"
                className="mt-0.5 w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white font-mono placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
              />
            </div>
          )}

          {(slide.type === "diagram" || slide.diagramPrompt) && (
            <div>
              <label className="text-[9px] text-white/40 uppercase tracking-wider">Diagram description</label>
              <textarea
                value={slide.diagramPrompt ?? ""}
                onChange={(e) => onUpdate({ diagramPrompt: e.target.value })}
                rows={2}
                placeholder="Describe what to draw"
                className="mt-0.5 w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500/40 resize-y"
              />
            </div>
          )}

          {(slide.type === "practice" || slide.practiceQuestion) && (
            <>
              <div>
                <label className="text-[9px] text-white/40 uppercase tracking-wider">Practice question</label>
                <textarea
                  value={slide.practiceQuestion ?? ""}
                  onChange={(e) => onUpdate({ practiceQuestion: e.target.value })}
                  rows={2}
                  className="mt-0.5 w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500/40 resize-y"
                />
              </div>
              <div>
                <label className="text-[9px] text-white/40 uppercase tracking-wider">Practice answer</label>
                <textarea
                  value={slide.practiceAnswer ?? ""}
                  onChange={(e) => onUpdate({ practiceAnswer: e.target.value })}
                  rows={2}
                  className="mt-0.5 w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500/40 resize-y"
                />
              </div>
            </>
          )}

          <div>
            <label className="text-[9px] text-white/40 uppercase tracking-wider">Speaker notes</label>
            <textarea
              value={slide.speakerNotes}
              onChange={(e) => onUpdate({ speakerNotes: e.target.value })}
              rows={3}
              placeholder="What to say"
              className="mt-0.5 w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500/40 resize-y"
            />
          </div>
        </div>
      </div>

      {/* Quick-add slide buttons */}
      <div className="border-t border-white/10 pt-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-white/40 mb-1.5">Quick add</p>
        <div className="grid grid-cols-3 gap-1">
          {(["concept", "formula", "example", "practice", "summary", "section"] as SlideType[]).map((t) => {
            const meta = getSlideTypeMeta(t);
            return (
              <button
                key={t}
                onClick={() => onAddSlide(t)}
                className="text-[10px] py-1.5 rounded-md bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-violet-500/10 hover:border-violet-500/30 flex flex-col items-center gap-0.5"
              >
                <span className="text-sm">{meta.icon}</span>
                <span>{meta.name.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Fullscreen Presentation Mode
// ============================================================================

function FullscreenPreview({ slideshow, initialIdx, onExit }: {
  slideshow: Slideshow; initialIdx: number; onExit: () => void;
}) {
  const [idx, setIdx] = useState(initialIdx);
  const [showNotes, setShowNotes] = useState(true);
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const tpl = getTemplate(slideshow.template);
  const slide = slideshow.slides[idx];

  useEffect(() => {
    const i = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 500);
    return () => clearInterval(i);
  }, [startTime]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        setIdx((i) => Math.min(slideshow.slides.length - 1, i + 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Escape") {
        onExit();
      } else if (e.key === "n") {
        setShowNotes((s) => !s);
      } else if (e.key === "Home") {
        setIdx(0);
      } else if (e.key === "End") {
        setIdx(slideshow.slides.length - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [slideshow.slides.length, onExit]);

  const mm = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const ss = (elapsed % 60).toString().padStart(2, "0");
  const estMin = Math.ceil((slideshow.slides.length * 90) / 60); // ~90s/slide

  // Use portal to escape any parent containing-block (backdrop-filter, transform, etc.)
  const content = (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col" style={{ contain: "layout" }}>
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-3 bg-gradient-to-b from-black/80 to-transparent text-white">
        <div className="flex items-center gap-3 text-xs min-w-0">
          <span className="opacity-70 truncate max-w-[200px]">{slideshow.title}</span>
          <span className="opacity-40 shrink-0">·</span>
          <span className="opacity-70 shrink-0">{idx + 1} / {slideshow.slides.length}</span>
        </div>
        <div className="flex items-center gap-3 text-xs shrink-0">
          <Clock className="h-3.5 w-3.5 opacity-60" />
          <span className="font-mono opacity-80">{mm}:{ss}</span>
          <span className="opacity-40 hidden sm:inline">/ ~{estMin}m est</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowNotes((s) => !s)}
            className={cn("px-2.5 py-1 rounded-md text-[11px] border transition-colors", showNotes ? "bg-violet-500/20 border-violet-500/40 text-violet-200" : "bg-white/5 border-white/15 text-white/60 hover:text-white")}
            title="Toggle speaker notes (N)"
          >
            {showNotes ? "Notes on" : "Notes off"}
          </button>
          <button onClick={onExit} className="px-2.5 py-1 rounded-md text-[11px] bg-white/5 border border-white/15 text-white/60 hover:text-white hover:bg-white/10 transition-colors" title="Exit (Esc)">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main slide — fills the entire viewport minus small padding */}
      <div className="flex-1 grid place-items-center p-4 sm:p-8 pt-16">
        <div className="w-full h-full max-w-[1400px] max-h-[780px] aspect-video shadow-2xl rounded-2xl overflow-hidden">
          <SlideStage slide={slide} tpl={tpl} className="w-full h-full" fullscreen />
        </div>
      </div>

      {/* Speaker notes overlay */}
      <AnimatePresence>
        {showNotes && slide.speakerNotes && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-20 left-4 right-4 sm:left-8 sm:right-auto sm:max-w-md z-20 rounded-xl border border-white/15 bg-zinc-950/90 backdrop-blur-md p-3"
          >
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1 flex items-center gap-1.5">
              <Presentation className="h-3 w-3" /> Speaker notes
            </p>
            <p className="text-xs text-white/80 leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">{slide.speakerNotes}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom nav */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-zinc-950/80 backdrop-blur-md border border-white/15 p-1.5">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs text-white/60 px-2 font-mono">{idx + 1} / {slideshow.slides.length}</span>
        <button
          onClick={() => setIdx((i) => Math.min(slideshow.slides.length - 1, i + 1))}
          disabled={idx === slideshow.slides.length - 1}
          className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/5 z-30">
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${((idx + 1) / slideshow.slides.length) * 100}%`, background: tpl.accent }}
        />
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(content, document.body);
  }
  return content;
}

// ============================================================================
// Export Menu
// ============================================================================

function ExportMenu({ slideshow }: { slideshow: Slideshow }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const exportHTML = () => {
    const tpl = getTemplate(slideshow.template);
    const slidesHTML = slideshow.slides.map((s, i) => {
      const meta = getSlideTypeMeta(s.type);
      const bullets = s.bullets?.map((b) => `<li>${escapeHtml(b)}</li>`).join("") ?? "";
      return `
        <section class="slide" data-type="${s.type}" data-index="${i}">
          <div class="badge">${meta.icon} ${meta.name}</div>
          <h2>${escapeHtml(s.title)}</h2>
          ${s.content ? `<p class="content">${escapeHtml(s.content)}</p>` : ""}
          ${bullets ? `<ul>${bullets}</ul>` : ""}
          ${s.formula ? `<div class="formula">${escapeHtml(s.formula)}</div>` : ""}
          ${s.practiceQuestion ? `<div class="practice"><strong>Try:</strong> ${escapeHtml(s.practiceQuestion)}</div>` : ""}
          ${s.practiceAnswer ? `<details><summary>Show answer</summary><p>${escapeHtml(s.practiceAnswer)}</p></details>` : ""}
          ${s.speakerNotes ? `<div class="notes"><strong>Speaker notes:</strong> ${escapeHtml(s.speakerNotes)}</div>` : ""}
        </section>
      `;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(slideshow.title)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; font-family: ${JSON.stringify(tpl.fontFamily)}; background: ${tpl.background}; color: ${tpl.text}; }
  .deck { display: flex; flex-direction: column; align-items: center; gap: 24px; padding: 24px; }
  .slide { width: 100%; max-width: 1024px; aspect-ratio: 16/9; padding: 48px; background: ${tpl.background}; border-radius: 16px; border: 1px solid ${tpl.muted}; position: relative; overflow: hidden; page-break-after: always; }
  .slide[data-type="title"] { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
  .badge { display: inline-block; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; padding: 4px 10px; border-radius: 99px; background: ${tpl.accent}20; color: ${tpl.accent}; margin-bottom: 16px; }
  h2 { font-size: 32px; margin: 0 0 16px 0; }
  p.content { font-size: 16px; opacity: 0.8; line-height: 1.6; }
  ul { font-size: 18px; line-height: 1.8; padding-left: 24px; }
  .formula { font-family: monospace; font-size: 28px; text-align: center; padding: 24px; background: ${tpl.cardBg}; border-radius: 12px; margin: 16px 0; color: ${tpl.accent}; }
  .practice { padding: 16px; background: ${tpl.cardBg}; border-radius: 8px; margin: 8px 0; }
  details { margin-top: 12px; }
  .notes { margin-top: 24px; padding-top: 16px; border-top: 1px dashed ${tpl.muted}; font-size: 12px; opacity: 0.6; }
  @media print { .slide { border-radius: 0; border: 0; page-break-after: always; } body { background: white; } }
</style>
</head>
<body>
<div class="deck">
  <h1 style="text-align:center;padding:24px;">${escapeHtml(slideshow.title)}</h1>
  ${slidesHTML}
</div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slideshow.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported as HTML");
    setOpen(false);
  };

  const exportPDF = () => {
    // Use browser's print dialog (the HTML export has print CSS)
    exportHTML();
    setTimeout(() => window.print(), 500);
    toast.info("Open the print dialog and choose 'Save as PDF'");
    setOpen(false);
  };

  const copyOutline = async () => {
    const lines = slideshow.slides.map((s, i) => {
      const meta = getSlideTypeMeta(s.type);
      let line = `${i + 1}. [${meta.name}] ${s.title}`;
      if (s.bullets?.length) line += `\n   • ${s.bullets.join("\n   • ")}`;
      if (s.formula) line += `\n   Formula: ${s.formula}`;
      return line;
    });
    const outline = `${slideshow.title}\n${"=".repeat(slideshow.title.length)}\n\n${lines.join("\n\n")}`;
    try {
      await navigator.clipboard?.writeText(outline);
      toast.success("Outline copied to clipboard");
    } catch {
      toast.error("Could not copy. Try the HTML export instead.");
    }
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white"
      >
        <Download className="h-3.5 w-3.5" /> Export
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute right-0 top-full mt-1.5 z-30 w-56 rounded-xl border border-white/15 bg-zinc-950/95 backdrop-blur-xl p-1.5 shadow-2xl"
          >
            <button onClick={exportHTML} className="w-full flex items-center gap-2 text-xs px-2.5 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5">
              <FileDown className="h-3.5 w-3.5" /> Export as HTML
            </button>
            <button onClick={exportPDF} className="w-full flex items-center gap-2 text-xs px-2.5 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5">
              <FileDown className="h-3.5 w-3.5" /> Export as PDF (via print)
            </button>
            <button onClick={copyOutline} className="w-full flex items-center gap-2 text-xs px-2.5 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5">
              <Copy className="h-3.5 w-3.5" /> Copy slide outline
            </button>
            <div className="border-t border-white/10 my-1" />
            <div className="px-2.5 py-1.5 text-[10px] text-white/40 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400/60" /> PPTX export coming soon
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-medium uppercase tracking-wider text-white/50">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
