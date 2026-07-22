"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Mic, Play, Pause, Square, SkipBack, SkipForward, Volume2, VolumeX,
  Gauge, X, ChevronLeft, ChevronRight, RefreshCw, Loader2, Edit3,
  Captions, Highlighter, Clock, Save, Download, Copy, Settings2,
  Type, Sparkles, AlertCircle, CheckCircle2, Headphones, Rewind, FastForward,
  Maximize2, Minimize2,
} from "lucide-react";

import { askAIJSON } from "@/lib/ai";
import { useStore } from "@/lib/store";
import {
  type Slide, type Slideshow, type SlideType,
  getTemplate, getSlideTypeMeta,
} from "@/lib/slideshow";
import {
  type SlideNarration, type NarrationSettings, type NarratedSlideshow,
  DEFAULT_NARRATION_SETTINGS,
  buildNarrationPrompt, buildChunkedNarrationPrompt,
  validateNarrationResponse, mergeNarrations,
  newNarratedSlideshow, upsertNarratedSlideshow,
  recalcDuration, fmtTime, estimateNarrationDuration,
} from "@/lib/narration";
import { useSpeechSynthesis, type VoiceInfo } from "@/lib/use-speech";
import { cn } from "@/lib/utils";
import { SlideStage } from "./slideshow-maker";
import { repairSlideQuality } from "@/lib/slideshow-pipeline";
import { ScholarAIContent } from "@/components/ai/scholar-ai-content";

// ============================================================================
// Narrated Slideshow Maker — sub-feature of AI Slideshow Maker
// ============================================================================

interface NarratedSlideshowMakerProps {
  slideshow: Slideshow;
  onExit: () => void;
}

export function NarratedSlideshowMaker({ slideshow, onExit }: NarratedSlideshowMakerProps) {
  const scholarClass = useStore((s) => s.user.scholarClass);
  const jeeMode = useStore((s) => s.user.jeeMode);
  const addXP = useStore((s) => s.addXP);
  const addCoins = useStore((s) => s.addCoins);
  const pushActivity = useStore((s) => s.pushActivity);

  const speech = useSpeechSynthesis();
  const [narrations, setNarrations] = useState<SlideNarration[]>([]);
  const [settings, setSettings] = useState<NarrationSettings>(DEFAULT_NARRATION_SETTINGS);
  const [generating, setGenerating] = useState(false);
  const [genStage, setGenStage] = useState("");
  const [hasNarration, setHasNarration] = useState(false);
  const [playing, setPlaying] = useState(false);     // playback overlay open
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  // Load existing narration on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`scholar-narration-${slideshow.id}`);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.narrations && Array.isArray(data.narrations)) {
          setNarrations(data.narrations);
          setSettings({ ...DEFAULT_NARRATION_SETTINGS, ...(data.settings || {}) });
          setHasNarration(true);
          setSavedId(data.id || null);
        }
      }
    } catch { /* ignore */ }
  }, [slideshow.id]);

  const totalDuration = useMemo(() => recalcDuration(narrations), [narrations]);

  // === Generate narration (chunked for large slideshows) ===
  const handleGenerate = async () => {
    if (!slideshow.slides.length) {
      toast.error("This slideshow has no slides to narrate.");
      return;
    }
    setGenerating(true);
    setGenStage("Composing narration prompt…");
    try {
      const totalSlides = slideshow.slides.length;
      const BATCH_SIZE = 5; // Generate 5 slides at a time to avoid token limits
      const allNarrations: SlideNarration[] = [];

      if (totalSlides <= BATCH_SIZE) {
        // Small enough — generate all at once
        setGenStage("Calling AI…");
        const prompt = buildNarrationPrompt({
          slideshow, scholarClass, jeeMode,
          targetDurationMin: settings.targetDurationMin,
        });
        const result = await askAIJSONWithTimeout(prompt, 110_000);
        if (!result) throw new Error("AI returned an empty response. Please try again.");
        setGenStage("Validating narration…");
        const parsed = validateNarrationResponse(result, slideshow);
        if (!parsed || !parsed.length) throw new Error("Could not parse narration from AI response.");
        allNarrations.push(...parsed);
      } else {
        // Chunked generation — batches of BATCH_SIZE slides
        const batches: number[][] = [];
        for (let i = 0; i < totalSlides; i += BATCH_SIZE) {
          batches.push(Array.from({ length: Math.min(BATCH_SIZE, totalSlides - i) }, (_, j) => i + j));
        }
        for (let b = 0; b < batches.length; b++) {
          const batch = batches[b];
          setGenStage(`Generating batch ${b + 1}/${batches.length} (slides ${batch[0] + 1}–${batch[batch.length - 1] + 1})…`);
          const prompt = buildChunkedNarrationPrompt({
            slideshow, scholarClass, jeeMode,
            targetDurationMin: settings.targetDurationMin,
            slideIndices: batch,
          });
          const result = await askAIJSONWithTimeout(prompt, 110_000);
          if (!result) {
            // If a batch fails, use fallback scripts for those slides
            toast.info(`Batch ${b + 1} failed — using fallback for slides ${batch[0] + 1}–${batch[batch.length - 1] + 1}`);
            continue;
          }
          const parsed = validateNarrationResponse(result, slideshow);
          if (parsed && parsed.length) {
            allNarrations.push(...parsed);
          }
        }
        if (!allNarrations.length) throw new Error("All batches failed. Please try again.");
      }

      // Merge in slide order, filling any gaps with fallback
      const finalNarrations = mergeNarrations([], allNarrations, slideshow);
      setNarrations(finalNarrations);
      setHasNarration(true);

      // Auto-save
      const ns = newNarratedSlideshow(slideshow, finalNarrations, settings);
      try {
        localStorage.setItem(`scholar-narration-${slideshow.id}`, JSON.stringify(ns));
        upsertNarratedSlideshow(ns);
        setSavedId(ns.id);
      } catch { /* quota */ }

      const generated = allNarrations.length;
      const fallback = finalNarrations.length - generated;
      addXP(10);
      addCoins(5);
      pushActivity({ type: "narration", text: `Generated narration: ${slideshow.title.slice(0, 40)}`, icon: "🎙️" });
      toast.success(
        `Generated narration for ${finalNarrations.length} slides! · +10 XP, +5 coins`,
        { description: fallback > 0 ? `${generated} AI-generated, ${fallback} fallback.` : undefined }
      );
    } catch (e: any) {
      toast.error("Narration generation failed", { description: e?.message || "Please try again." });
    } finally {
      setGenerating(false);
      setGenStage("");
    }
  };

  // === Update single narration ===
  const updateNarration = (slideId: string, patch: Partial<SlideNarration>) => {
    setNarrations((prev) => {
      const slide = slideshow.slides.find((item) => item.id === slideId);
      const adjusted = patch.script && slide ? { ...patch, durationSec: estimateNarrationDuration(patch.script, slide.type, settings.rate) } : patch;
      const next = prev.map((n) => (n.slideId === slideId ? { ...n, ...adjusted } : n));
      // Auto-persist
      try {
        const ns = newNarratedSlideshow(slideshow, next, settings);
        if (savedId) ns.id = savedId;
        localStorage.setItem(`scholar-narration-${slideshow.id}`, JSON.stringify(ns));
      } catch { /* ignore */ }
      return next;
    });
  };

  // === Regenerate one slide's narration ===
  const handleRegenerateOne = async (idx: number) => {
    const slide = slideshow.slides[idx];
    if (!slide) return;
    toast.info("Regenerating narration for this slide…");
    try {
      const promptText = `Rewrite ONLY the narration script for this single slide. Make it clearer, more engaging, and academically rigorous. Return ONLY JSON.

Slide (Class ${scholarClass} ${slideshow.subject}):
${JSON.stringify({ type: slide.type, title: slide.title, content: slide.content, bullets: slide.bullets, formula: slide.formula, practiceQuestion: slide.practiceQuestion, practiceAnswer: slide.practiceAnswer }, null, 2)}

Return ONLY: { "script": "...", "caption": "...", "durationSec": 18, "highlightKeywords": ["..."] }
No markdown fences.`;
      const result = await askAIJSON<any>(promptText, "default", { temperature: 0.6 });
      if (!result) throw new Error("AI returned empty");
      const patch: Partial<SlideNarration> = {};
      if (typeof result.script === "string") patch.script = result.script.slice(0, 4000);
      if (typeof result.caption === "string") patch.caption = result.caption.slice(0, 200);
      if (typeof result.durationSec === "number") patch.durationSec = Math.max(3, Math.min(180, result.durationSec));
      if (Array.isArray(result.highlightKeywords)) patch.highlightKeywords = result.highlightKeywords.filter((k: any) => typeof k === "string").slice(0, 6);
      updateNarration(slide.id, patch);
      toast.success("Narration updated");
    } catch (e: any) {
      toast.error("Regeneration failed", { description: e?.message });
    }
  };

  // === Save ===
  const handleSave = () => {
    if (!narrations.length) return;
    const ns = newNarratedSlideshow(slideshow, narrations, settings);
    if (savedId) ns.id = savedId;
    try {
      localStorage.setItem(`scholar-narration-${slideshow.id}`, JSON.stringify(ns));
      upsertNarratedSlideshow(ns);
      setSavedId(ns.id);
      toast.success("Narrated slideshow saved");
    } catch {
      toast.error("Could not save — storage quota may be full.");
    }
  };

  // === Export transcript ===
  const exportTranscript = () => {
    const lines = [
      `# ${slideshow.title} — Narration Transcript`,
      ``,
      `Class: ${scholarClass} · Subject: ${slideshow.subject || "—"} · Chapter: ${slideshow.chapter || "—"}`,
      `Total duration: ~${fmtTime(totalDuration)}`,
      ``,
      `---`,
      ``,
    ];
    slideshow.slides.forEach((s, i) => {
      const n = narrations[i];
      lines.push(`## Slide ${i + 1}: ${s.title}`);
      lines.push(`Duration: ${n ? fmtTime(n.durationSec) : "—"}`);
      lines.push(``);
      lines.push(n?.script || "(no narration)");
      lines.push(``);
      lines.push(`---`);
      lines.push(``);
    });
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slideshow.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-transcript.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Transcript exported");
  };

  const copyAllNarration = async () => {
    const text = slideshow.slides.map((s, i) => {
      const n = narrations[i];
      return `Slide ${i + 1} — ${s.title}:\n${n?.script || "(no narration)"}`;
    }).join("\n\n");
    try {
      await navigator.clipboard?.writeText(text);
      toast.success("All narration copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  };

  // === Play handler ===
  const handlePlay = () => {
    if (!hasNarration || !narrations.length) {
      toast.error("Generate narration first.");
      return;
    }
    if (!speech.supported) {
      toast.error("Voice playback is not available in this browser.", {
        description: "Try Chrome, Edge, or Safari with system voices installed.",
      });
      return;
    }
    setPlaying(true);
  };

  // === Render ===
  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Slideshow
          </button>
          <div className="flex items-center gap-1.5 text-sm font-medium text-white min-w-0">
            <Mic className="h-4 w-4 text-violet-300 shrink-0" />
            <span className="truncate">Auto-Lecture: {slideshow.title}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {hasNarration && (
            <button
              onClick={exportTranscript}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white transition-colors"
              title="Export transcript as Markdown"
            >
              <Download className="h-3.5 w-3.5" /> Transcript
            </button>
          )}
          {hasNarration && (
            <button
              onClick={copyAllNarration}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white transition-colors"
              title="Copy all narration"
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
          )}
          {hasNarration && (
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white transition-colors"
            >
              <Save className="h-3.5 w-3.5" /> Save
            </button>
          )}
          {hasNarration && (
            <button
              onClick={handlePlay}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white border border-violet-400/40 hover:from-violet-600 hover:to-fuchsia-600 transition-colors shadow-lg shadow-violet-500/25"
            >
              <Play className="h-3.5 w-3.5" /> Play Auto-Lecture
            </button>
          )}
        </div>
      </div>

      {/* Browser support warning */}
      {!speech.supported && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-100">
            <p className="font-semibold mb-0.5">Voice playback is not available in this browser.</p>
            <p className="opacity-80">Auto-Lecture requires the Web Speech API. Try Chrome, Edge, or Safari. You can still generate scripts and export the transcript.</p>
          </div>
        </div>
      )}

      {/* Stats */}
      {hasNarration && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard label="Slides" value={String(slideshow.slides.length)} icon={Sparkles} />
          <StatCard label="Total duration" value={fmtTime(totalDuration)} icon={Clock} />
          <StatCard label="Voice" value={speech.voices.find((v) => v.uri === settings.voiceURI)?.name.slice(0, 18) || (speech.voices.length ? "Default" : "Not loaded")} icon={Headphones} />
          <StatCard label="Speed" value={`${settings.rate.toFixed(2)}×`} icon={Gauge} />
        </div>
      )}

      {/* Generate button (if no narration) */}
      {!hasNarration && (
        <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-6 text-center">
          <div className="grid place-items-center h-14 w-14 rounded-2xl bg-violet-500/15 mx-auto mb-3">
            <Mic className="h-7 w-7 text-violet-300" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">Generate AI Narration</h3>
          <p className="text-xs text-white/60 max-w-md mx-auto mb-4">
            Scholar will write a teacher-style voice script for every slide, estimate timing, and prepare captions. Then you can play it as an auto-lecture with synchronized voice.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all",
              generating
                ? "bg-white/5 text-white/50 cursor-wait"
                : "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600 shadow-lg shadow-violet-500/25"
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
                Generate narration for {slideshow.slides.length} slides
              </>
            )}
          </button>
        </div>
      )}

      {/* Settings panel */}
      {hasNarration && (
        <NarrationSettingsPanel
          settings={settings}
          onChange={setSettings}
          voices={speech.voices}
          supported={speech.supported}
        />
      )}

      {/* Timeline / per-slide narration editor */}
      {hasNarration && (
        <NarrationTimeline
          slideshow={slideshow}
          narrations={narrations}
          editIdx={editIdx}
          setEditIdx={setEditIdx}
          onUpdate={updateNarration}
          onRegenerate={handleRegenerateOne}
          onPreview={(idx) => {
            const n = narrations[idx];
            if (n) {
              speech.speak(n.script, {
                voiceURI: settings.voiceURI,
                rate: settings.rate,
                pitch: settings.pitch,
                volume: settings.volume,
                onEnd: () => {},
              });
            }
          }}
          onStopPreview={() => speech.cancel()}
          previewing={speech.speaking}
          settings={settings}
        />
      )}

      {/* Playback overlay */}
      <AnimatePresence>
        {playing && (
          <AutoLecturePlayer
            slideshow={slideshow}
            narrations={narrations}
            settings={settings}
            onExit={() => {
              speech.cancel();
              setPlaying(false);
            }}
            onSettingsChange={setSettings}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// AI helper with timeout — also tries to recover JSON from failed responses
// ============================================================================

async function askAIJSONWithTimeout(message: string, timeoutMs: number): Promise<any | null> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { useStore: _useStore } = await import("@/lib/store");
    const state = _useStore.getState();
    const scholarClass = state.user.scholarClass ?? 9;
    const jeeMode = state.user.jeeMode ?? false;

    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: message }],
        persona: "default",
        temperature: 0.55,
        json: true,
        scholarClass,
        jeeMode,
      }),
      signal: controller.signal,
    });
    clearTimeout(tid);
    if (!res.ok) return null;
    const text = await res.text();
    let data: { ok?: boolean; data?: any; raw?: string };
    try { data = JSON.parse(text); } catch { return null; }

    // Success — parsed JSON returned by server
    if (data.ok && data.data) return data.data;

    // Failure — but server might have raw content we can try to parse ourselves
    if (!data.ok && data.raw) {
      const recovered = tryRecoverJSON(data.raw);
      if (recovered) return recovered;
    }

    return null;
  } catch (e: any) {
    clearTimeout(tid);
    if (e?.name === "AbortError") return null;
    return null;
  }
}

// Client-side JSON recovery — strips markdown fences, extracts balanced braces, repairs truncation
function tryRecoverJSON(raw: string): any | null {
  if (!raw || typeof raw !== "string") return null;
  let s = raw.trim();

  // Strip markdown fences
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();

  // Try direct parse
  try { return JSON.parse(s); } catch { /* continue */ }

  // Extract balanced JSON object
  const start = s.search(/{/);
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  let end = -1;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { end = i; break; } }
  }

  if (end >= 0) {
    try { return JSON.parse(s.slice(start, end + 1)); } catch { /* continue */ }
  }

  // Try to repair truncated JSON
  let truncated = end < 0 ? s.slice(start) : s.slice(start, end + 1);
  // Close open strings
  let inStr2 = false;
  let esc2 = false;
  let objDepth = 0;
  let arrDepth = 0;
  for (let i = 0; i < truncated.length; i++) {
    const c = truncated[i];
    if (inStr2) {
      if (esc2) esc2 = false;
      else if (c === "\\") esc2 = true;
      else if (c === '"') inStr2 = false;
      continue;
    }
    if (c === '"') { inStr2 = true; continue; }
    if (c === "{") objDepth++;
    else if (c === "}") objDepth--;
    else if (c === "[") arrDepth++;
    else if (c === "]") arrDepth--;
  }
  if (inStr2) truncated += '"';
  truncated = truncated.replace(/,\s*"[^"]+"\s*:\s*$/, "");
  truncated = truncated.replace(/[\s,:]+$/, "");
  while (arrDepth > 0) { truncated += "]"; arrDepth--; }
  while (objDepth > 0) { truncated += "}"; objDepth--; }

  try { return JSON.parse(truncated); } catch { return null; }
}

// ============================================================================
// Stat card
// ============================================================================

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-white/40 mb-1">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className="text-sm font-semibold text-white truncate">{value}</p>
    </div>
  );
}

// ============================================================================
// Narration settings panel
// ============================================================================

function NarrationSettingsPanel({
  settings, onChange, voices, supported,
}: {
  settings: NarrationSettings;
  onChange: (s: NarrationSettings) => void;
  voices: VoiceInfo[];
  supported: boolean;
}) {
  const update = (patch: Partial<NarrationSettings>) => onChange({ ...settings, ...patch });

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
      <div className="flex items-center gap-2 text-xs font-medium text-white/70">
        <Settings2 className="h-3.5 w-3.5 text-violet-300" /> Voice & Playback Settings
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Voice */}
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider text-white/50">Voice</label>
          <select
            value={settings.voiceURI}
            onChange={(e) => update({ voiceURI: e.target.value })}
            disabled={!supported || !voices.length}
            className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-50"
          >
            <option value="">Default system voice</option>
            {voices.map((v) => (
              <option key={v.uri} value={v.uri}>{v.name} ({v.lang})</option>
            ))}
          </select>
          {!voices.length && supported && (
            <p className="text-[10px] text-white/40 mt-1">Loading voices…</p>
          )}
        </div>

        {/* Rate */}
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider text-white/50 flex items-center justify-between">
            <span>Speed</span><span className="text-violet-300">{settings.rate.toFixed(2)}×</span>
          </label>
          <input
            type="range" min={0.5} max={2} step={0.05}
            value={settings.rate}
            onChange={(e) => update({ rate: +e.target.value })}
            className="mt-2 w-full accent-violet-500"
          />
          <div className="flex justify-between text-[9px] text-white/30 mt-0.5">
            <span>0.5×</span><span>1×</span><span>2×</span>
          </div>
        </div>

        {/* Pitch */}
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider text-white/50 flex items-center justify-between">
            <span>Pitch</span><span className="text-violet-300">{settings.pitch.toFixed(2)}</span>
          </label>
          <input
            type="range" min={0} max={2} step={0.05}
            value={settings.pitch}
            onChange={(e) => update({ pitch: +e.target.value })}
            className="mt-2 w-full accent-violet-500"
          />
          <div className="flex justify-between text-[9px] text-white/30 mt-0.5">
            <span>Low</span><span>Normal</span><span>High</span>
          </div>
        </div>

        {/* Volume */}
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider text-white/50 flex items-center justify-between">
            <span>Volume</span><span className="text-violet-300">{Math.round(settings.volume * 100)}%</span>
          </label>
          <input
            type="range" min={0} max={1} step={0.05}
            value={settings.volume}
            onChange={(e) => update({ volume: +e.target.value })}
            className="mt-2 w-full accent-violet-500"
          />
        </div>

        {/* Target duration */}
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider text-white/50">Target duration</label>
          <select
            value={settings.targetDurationMin ?? 5}
            onChange={(e) => update({ targetDurationMin: +e.target.value })}
            className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          >
            <option value={2}>2 minutes (quick)</option>
            <option value={5}>5 minutes (standard)</option>
            <option value={10}>10 minutes (detailed)</option>
            <option value={15}>15 minutes (deep dive)</option>
          </select>
        </div>
      </div>

      {/* Toggles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {[
          { label: "Auto-advance", v: settings.autoAdvance, set: (b: boolean) => update({ autoAdvance: b }), icon: SkipForward },
          { label: "Captions", v: settings.showCaptions, set: (b: boolean) => update({ showCaptions: b }), icon: Captions },
          { label: "Highlight text", v: settings.highlightText, set: (b: boolean) => update({ highlightText: b }), icon: Highlighter },
          { label: "Practice pauses", v: settings.practicePauses, set: (b: boolean) => update({ practicePauses: b }), icon: Pause },
          { label: "Recap pauses", v: settings.recapPauses, set: (b: boolean) => update({ recapPauses: b }), icon: RefreshCw },
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
  );
}

// ============================================================================
// Narration timeline editor
// ============================================================================

function NarrationTimeline({
  slideshow, narrations, editIdx, setEditIdx, onUpdate, onRegenerate, onPreview, onStopPreview, previewing, settings,
}: {
  slideshow: Slideshow;
  narrations: SlideNarration[];
  editIdx: number | null;
  setEditIdx: (i: number | null) => void;
  onUpdate: (slideId: string, patch: Partial<SlideNarration>) => void;
  onRegenerate: (idx: number) => void;
  onPreview: (idx: number) => void;
  onStopPreview: () => void;
  previewing: boolean;
  settings: NarrationSettings;
}) {
  const tpl = getTemplate(slideshow.template);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-medium uppercase tracking-wider text-white/40 flex items-center gap-1.5">
          <Clock className="h-3 w-3" /> Timeline — {slideshow.slides.length} slides
        </p>
        <p className="text-[10px] text-white/40">Click a slide to edit narration</p>
      </div>

      {/* Timeline bar */}
      <div className="flex h-6 rounded-md overflow-hidden border border-white/10 bg-black/30">
        {slideshow.slides.map((s, i) => {
          const n = narrations[i];
          const dur = n?.durationSec ?? 8;
          const total = narrations.reduce((sum, x) => sum + x.durationSec, 0) || 1;
          const width = (dur / total) * 100;
          const meta = getSlideTypeMeta(s.type);
          const color: Record<string, string> = {
            title: tpl.accent, agenda: "#38bdf8", section: "#a78bfa", concept: "#60a5fa",
            formula: "#fbbf24", diagram: "#34d399", example: "#fb923c", practice: "#f472b6",
            summary: "#22d3ee", thanks: tpl.accent,
          };
          const c = color[s.type] || "#94a3b8";
          const start = narrations.slice(0, i).reduce((sum, item) => sum + item.durationSec, 0);
          const end = start + dur;
          return (
            <button
              key={s.id}
              onClick={() => setEditIdx(editIdx === i ? null : i)}
              title={`${s.title} — ${fmtTime(start)} to ${fmtTime(end)}`}
              style={{ width: `${width}%`, background: `${c}40`, borderRight: "1px solid rgba(0,0,0,0.3)" }}
              className={cn(
                "h-full text-[8px] text-white/80 hover:brightness-125 transition-all flex items-center justify-center px-0.5",
                editIdx === i && "ring-2 ring-white/60 ring-inset"
              )}
            >
              <span className="truncate">{meta.icon}</span>
            </button>
          );
        })}
      </div>

      {/* Per-slide narration list */}
      <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
        {slideshow.slides.map((s, i) => {
          const n = narrations[i];
          const isEditing = editIdx === i;
          const meta = getSlideTypeMeta(s.type);
          return (
            <div
              key={s.id}
              className={cn(
                "rounded-lg border transition-colors",
                isEditing ? "border-violet-500/40 bg-violet-500/5" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
              )}
            >
              <button
                onClick={() => setEditIdx(isEditing ? null : i)}
                className="w-full text-left p-2.5 flex items-start gap-2"
              >
                <span className="text-[10px] font-bold text-white/40 shrink-0 mt-0.5">#{i + 1}</span>
                <span className="text-sm shrink-0 mt-0.5">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{s.title}</p>
                  <p className="text-[10px] text-white/40 truncate">{n?.script.slice(0, 80) || "No narration"}…</p>
                </div>
                <span className="text-[10px] text-white/40 shrink-0 mt-0.5">{fmtTime(n?.durationSec ?? 0)}</span>
              </button>

              {isEditing && n && (
                <div className="p-2.5 pt-0 space-y-2">
                  <textarea
                    value={n.script}
                    onChange={(e) => onUpdate(s.id, { script: e.target.value })}
                    rows={4}
                    className="w-full rounded-md bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500/40 resize-y"
                    placeholder="Narration script…"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] text-white/40 uppercase tracking-wider">Caption</label>
                      <input
                        value={n.caption}
                        onChange={(e) => onUpdate(s.id, { caption: e.target.value })}
                        className="mt-0.5 w-full rounded-md bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-white/40 uppercase tracking-wider">Duration (sec)</label>
                      <input
                        type="number" min={3} max={180}
                        value={n.durationSec}
                        onChange={(e) => onUpdate(s.id, { durationSec: Math.max(3, Math.min(180, +e.target.value || 12)) })}
                        className="mt-0.5 w-full rounded-md bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] text-white/40 uppercase tracking-wider">Highlight keywords (comma-separated)</label>
                    <input
                      value={(n.highlightKeywords || []).join(", ")}
                      onChange={(e) => onUpdate(s.id, { highlightKeywords: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })}
                      className="mt-0.5 w-full rounded-md bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                      placeholder="displacement, vector, shortest distance"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      onClick={() => onRegenerate(i)}
                      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white/60 hover:text-white"
                    >
                      <RefreshCw className="h-3 w-3" /> Regenerate
                    </button>
                    {previewing ? (
                      <button
                        onClick={onStopPreview}
                        className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-200"
                      >
                        <Square className="h-3 w-3" /> Stop
                      </button>
                    ) : (
                      <button
                        onClick={() => onPreview(i)}
                        className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-violet-500/15 border border-violet-500/30 text-violet-200 hover:bg-violet-500/25"
                      >
                        <Play className="h-3 w-3" /> Preview voice
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Auto-Lecture Player (fullscreen playback)
// ============================================================================

function AutoLecturePlayer({
  slideshow, narrations, settings, onExit, onSettingsChange,
}: {
  slideshow: Slideshow;
  narrations: SlideNarration[];
  settings: NarrationSettings;
  onExit: () => void;
  onSettingsChange: (s: NarrationSettings) => void;
}) {
  const speech = useSpeechSynthesis();
  const tpl = getTemplate(slideshow.template);
  const playerRef = useRef<HTMLDivElement>(null);

  const [idx, setIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showCaptions, setShowCaptions] = useState(settings.showCaptions);
  const [showSidebar, setShowSidebar] = useState(() => typeof window === "undefined" ? true : window.innerWidth >= 1100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pausedForPractice, setPausedForPractice] = useState(false);
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});

  const slide = slideshow.slides[idx];
  const displaySlide = useMemo(() => repairSlideQuality([slide])[0] ?? slide, [slide]);
  const narration = narrations[idx];
  const totalDuration = narrations.reduce((s, n) => s + n.durationSec, 0);
  const elapsedBefore = narrations.slice(0, idx).reduce((s, n) => s + n.durationSec, 0);

  // === Speak current narration ===
  const speakCurrent = useCallback((slideIdx: number) => {
    const n = narrations[slideIdx];
    if (!n) return;
    speech.speak(n.script, {
      voiceURI: settings.voiceURI,
      rate: settings.rate,
      pitch: settings.pitch,
      volume: settings.volume,
      onEnd: () => {
        // Auto-advance unless this is a practice slide with pause enabled
        const s = slideshow.slides[slideIdx];
        if (s?.type === "practice" && settings.practicePauses && n.pauseAfter) {
          setPausedForPractice(true);
          return;
        }
        if (s?.type === "recap" && settings.recapPauses) {
          setPausedForPractice(true);
          return;
        }
        if (slideIdx < slideshow.slides.length - 1 && settings.autoAdvance) {
          setIdx(slideIdx + 1);
        } else {
          setIsPlaying(false);
        }
      },
      onError: (err) => {
        toast.error(`Voice error: ${err}`);
        setIsPlaying(false);
      },
    });
  }, [narrations, slideshow.slides, settings, speech]);

  // === Start / pause / resume ===
  const handlePlayPause = () => {
    if (pausedForPractice) {
      // Continue from practice pause
      setPausedForPractice(false);
      if (idx < slideshow.slides.length - 1 && settings.autoAdvance) {
        setIdx(idx + 1);
      } else {
        setIsPlaying(false);
      }
      return;
    }
    if (isPlaying) {
      speech.pause();
      setIsPlaying(false);
    } else {
      // If speech is paused (not stopped), resume
      if (speech.paused) {
        speech.resume();
        setIsPlaying(true);
      } else {
        // Fresh start from current slide
        setIsPlaying(true);
        speakCurrent(idx);
      }
    }
  };

  // === When idx changes during playback, speak the new slide ===
  useEffect(() => {
    if (!isPlaying || pausedForPractice) return;
    // Cancel any current speech and start the new slide
    speech.cancel();
    // Small delay to let cancel settle
    const t = setTimeout(() => speakCurrent(idx), 100);
    return () => clearTimeout(t);
  }, [idx]);

  // === Stop everything on exit ===
  useEffect(() => {
    return () => { speech.cancel(); };
  }, []);

  useEffect(() => {
    const sync = () => setIsFullscreen(document.fullscreenElement === playerRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await playerRef.current?.requestFullscreen?.();
    } catch {
      toast.error("Fullscreen is unavailable in this browser.");
    }
  };

  const goToSlide = (newIdx: number) => {
    const clamped = Math.max(0, Math.min(slideshow.slides.length - 1, newIdx));
    speech.cancel();
    setPausedForPractice(false);
    setIdx(clamped);
  };

  // === Keyboard shortcuts ===
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === " ") { e.preventDefault(); handlePlayPause(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); goToSlide(idx + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goToSlide(idx - 1); }
      else if (e.key === "Escape" && !document.fullscreenElement) { onExit(); }
      else if (e.key === "c") { setShowCaptions((s) => !s); }
      else if (e.key === "s") { setShowSidebar((s) => !s); }
      else if (e.key.toLowerCase() === "f") { void toggleFullscreen(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [idx, isPlaying, pausedForPractice]);

  const handleRestart = () => {
    speech.cancel();
    setPausedForPractice(false);
    setIdx(0);
    setIsPlaying(true);
    // speakCurrent will fire via the idx useEffect
  };

  // Practice slide "show answer" / "continue"
  const handlePracticeContinue = () => {
    setPausedForPractice(false);
    if (idx < slideshow.slides.length - 1 && settings.autoAdvance) {
      setIdx(idx + 1);
    } else {
      setIsPlaying(false);
    }
  };
  const handlePracticeReveal = () => {
    setRevealedAnswers((prev) => ({ ...prev, [idx]: true }));
  };

  // === Volume mute toggle ===
  const [muted, setMuted] = useState(false);
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    onSettingsChange({ ...settings, volume: next ? 0 : (settings.volume > 0 ? settings.volume : 1) });
  };

  const content = (
    <div ref={playerRef} className="fixed inset-0 z-[200] bg-black flex flex-col overflow-hidden" style={{ contain: "layout" }} data-testid="auto-lecture-player">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-3 bg-gradient-to-b from-black/80 to-transparent text-white">
        <div className="flex items-center gap-3 text-xs min-w-0">
          <button
            onClick={onExit}
            className="px-2.5 py-1 rounded-md text-[11px] bg-white/5 border border-white/15 text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            title="Exit (Esc)"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <span className="opacity-70 truncate max-w-[200px]">{slideshow.title}</span>
          <span className="opacity-40 shrink-0">·</span>
          <span className="opacity-70 shrink-0">Slide {idx + 1} / {slideshow.slides.length}</span>
          <span className="opacity-40 shrink-0 hidden sm:inline">·</span>
          <span className="opacity-70 shrink-0 hidden sm:inline">{fmtTime(elapsedBefore)} / {fmtTime(totalDuration)}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowCaptions((s) => !s)}
            className={cn("px-2.5 py-1 rounded-md text-[11px] border transition-colors", showCaptions ? "bg-violet-500/20 border-violet-500/40 text-violet-200" : "bg-white/5 border-white/15 text-white/60 hover:text-white")}
            title="Toggle captions (C)"
          >
            <Captions className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setShowSidebar((s) => !s)}
            className={cn("px-2.5 py-1 rounded-md text-[11px] border transition-colors", showSidebar ? "bg-violet-500/20 border-violet-500/40 text-violet-200" : "bg-white/5 border-white/15 text-white/60 hover:text-white")}
            title="Toggle sidebar (S)"
          >
            <Type className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => void toggleFullscreen()}
            className={cn("px-2.5 py-1 rounded-md text-[11px] border transition-colors", isFullscreen ? "bg-violet-500/20 border-violet-500/40 text-violet-200" : "bg-white/5 border-white/15 text-white/60 hover:text-white")}
            title={isFullscreen ? "Exit fullscreen (F)" : "Enter fullscreen (F)"}
            aria-label={isFullscreen ? "Exit Auto-Lecture fullscreen" : "Enter Auto-Lecture fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex-1 flex pt-12 pb-28 min-h-0 overflow-hidden">
        {/* Slide area */}
        <div className="flex-1 grid place-items-center p-3 sm:p-5 min-w-0 min-h-0 overflow-hidden">
          <div className="w-full max-w-[min(1100px,calc((100dvh-12.5rem)*16/9))] aspect-video shadow-2xl rounded-2xl overflow-hidden relative" data-testid="auto-lecture-slide-canvas">
            <SlideStage
              slide={displaySlide}
              tpl={tpl}
              className="w-full h-full"
              fullscreen
              highlightKeywords={settings.highlightText ? narration?.highlightKeywords : undefined}
              isNarrating={isPlaying}
              revealAnswer={revealedAnswers[idx]}
            />
            {/* Practice pause overlay */}
            {pausedForPractice && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="absolute inset-0 grid place-items-center bg-black/70 backdrop-blur-sm z-10"
              >
                <div className="text-center max-w-md p-6">
                  <div className="grid place-items-center h-14 w-14 rounded-2xl bg-violet-500/20 mx-auto mb-3">
                    <Pause className="h-7 w-7 text-violet-200" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Pause & try it yourself</h3>
                  <ScholarAIContent content={narration?.pausePrompt || "Take a moment to work through this slide."} mode="transcript" className="mb-4 text-sm text-white/60" />
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {!revealedAnswers[idx] && displaySlide.practiceAnswer && (
                      <button
                        onClick={handlePracticeReveal}
                        className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm hover:bg-white/15"
                      >
                        Show answer
                      </button>
                    )}
                    <button
                      onClick={handlePracticeContinue}
                      className="px-4 py-2 rounded-lg bg-violet-500/30 border border-violet-400/40 text-violet-100 text-sm hover:bg-violet-500/40"
                    >
                      Continue →
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Sidebar: narration + slide list */}
        {showSidebar && (
          <div className="w-72 lg:w-80 shrink-0 border-l border-white/10 bg-zinc-950/70 backdrop-blur-md flex flex-col">
            {/* Narration script */}
            <div className="p-3 border-b border-white/10">
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/40 mb-1.5 flex items-center gap-1.5">
                <Mic className="h-3 w-3" /> Narration script
              </p>
              <div className="max-h-40 overflow-y-auto text-xs text-white/80">
                <ScholarAIContent content={narration?.script || "(no narration)"} mode="transcript" />
              </div>
            </div>
            {/* Upcoming slide */}
            {idx + 1 < slideshow.slides.length && (
              <div className="p-3 border-b border-white/10">
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/40 mb-1.5">Up next</p>
                <p className="text-xs text-white/70 truncate">{slideshow.slides[idx + 1].title}</p>
              </div>
            )}
            {/* Slide list */}
            <div className="flex-1 overflow-y-auto p-2">
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/40 px-1 py-1.5">Slides</p>
              <div className="space-y-0.5">
                {slideshow.slides.map((s, i) => {
                  const meta = getSlideTypeMeta(s.type);
                  return (
                    <button
                      key={s.id}
                      onClick={() => goToSlide(i)}
                      className={cn(
                        "w-full text-left p-2 rounded-md text-xs flex items-center gap-2 transition-colors",
                        i === idx ? "bg-violet-500/20 text-white" : "text-white/60 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <span className="shrink-0">{meta.icon}</span>
                      <span className="truncate flex-1">{i + 1}. {s.title}</span>
                      <span className="text-[9px] text-white/30 shrink-0">{fmtTime(narrations[i]?.durationSec ?? 0)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Captions */}
      <AnimatePresence>
        {showCaptions && narration?.caption && !pausedForPractice && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-32 left-1/2 -translate-x-1/2 z-20 max-w-2xl w-[90%] text-center"
          >
            <div className="inline-block px-4 py-2 rounded-lg bg-black/70 backdrop-blur-md border border-white/15">
              <ScholarAIContent content={narration.caption} mode="transcript" className="text-sm text-white/90" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/95 to-transparent p-4 pt-8">
        {/* Progress bar */}
        <div className="mb-3 px-2">
          <div className="relative h-1.5 bg-white/10 rounded-full cursor-pointer group" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            const targetSec = pct * totalDuration;
            // Find slide whose cumulative range contains targetSec
            let acc = 0;
            for (let i = 0; i < narrations.length; i++) {
              if (acc + narrations[i].durationSec > targetSec) {
                goToSlide(i);
                return;
              }
              acc += narrations[i].durationSec;
            }
          }}>
            <div
              className="absolute top-0 left-0 h-full rounded-full transition-all"
              style={{ width: `${((elapsedBefore + (isPlaying ? narration?.durationSec ?? 0 : 0)) / totalDuration) * 100}%`, background: tpl.accent }}
            />
            {/* Per-slide tick marks */}
            {narrations.map((_, i) => {
              const pos = (narrations.slice(0, i + 1).reduce((s, n) => s + n.durationSec, 0) / totalDuration) * 100;
              return <div key={i} className="absolute top-0 h-full w-px bg-black/40" style={{ left: `${pos}%` }} />;
            })}
          </div>
          <div className="flex justify-between text-[10px] text-white/50 mt-1 font-mono">
            <span>{fmtTime(elapsedBefore)}</span>
            <span>{fmtTime(totalDuration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          <button
            onClick={handleRestart}
            className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Restart"
          >
            <Rewind className="h-4 w-4" />
          </button>
          <button
            onClick={() => goToSlide(idx - 1)}
            disabled={idx === 0}
            className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
            title="Previous (←)"
          >
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            onClick={handlePlayPause}
            className={cn(
              "grid place-items-center h-12 w-12 rounded-full text-white transition-all",
              isPlaying
                ? "bg-white/10 hover:bg-white/15"
                : "bg-gradient-to-br from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 shadow-lg shadow-violet-500/30"
            )}
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </button>
          <button
            onClick={() => goToSlide(idx + 1)}
            disabled={idx === slideshow.slides.length - 1}
            className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
            title="Next (→)"
          >
            <SkipForward className="h-4 w-4" />
          </button>

          {/* Speed */}
          <div className="flex items-center gap-1 ml-2">
            <Gauge className="h-3.5 w-3.5 text-white/50" />
            <select
              value={settings.rate}
              onChange={(e) => onSettingsChange({ ...settings, rate: +e.target.value })}
              className="bg-white/5 border border-white/10 rounded-md text-[11px] text-white px-1.5 py-1 focus:outline-none"
            >
              <option value={0.5}>0.5×</option>
              <option value={0.75}>0.75×</option>
              <option value={1}>1×</option>
              <option value={1.25}>1.25×</option>
              <option value={1.5}>1.5×</option>
              <option value={2}>2×</option>
            </select>
          </div>

          {/* Volume */}
          <button
            onClick={toggleMute}
            className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Mute"
          >
            {muted || settings.volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <input
            type="range" min={0} max={1} step={0.05}
            value={muted ? 0 : settings.volume}
            onChange={(e) => { setMuted(false); onSettingsChange({ ...settings, volume: +e.target.value }); }}
            className="w-16 accent-violet-500 hidden sm:block"
          />
        </div>
      </div>

      {/* Progress bar at top */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/5 z-30">
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
