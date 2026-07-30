"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2, ChevronLeft, Trash2, Save, Check, Play } from "lucide-react";
import { askAIJSON } from "@/lib/ai";
import type { Subject } from "@/lib/curriculum-class11";
import type { Class11Flashcard } from "@/lib/flashcards-physics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SUBJECT_INFO, TYPE_INFO, type CustomCard } from "./flashcard-utils";
import {
  beginBackgroundTask,
  completeBackgroundTask,
  failBackgroundTask,
} from "@/lib/background-tasks";

export type GeneratedDraft = {
  id: string;
  subject: string;
  subjectName: string;
  chapterId: string;
  chapter: string;
  topic: string;
  type: Class11Flashcard["type"];
  front: string;
  back: string;
  explanation?: string;
  difficulty: Class11Flashcard["difficulty"];
  examImportance: Class11Flashcard["examImportance"];
  tags: string[];
  selected: boolean;
  createdBy: "ai" | "local-fallback";
};

export function AIGeneratorDialog({
  open, onOpenChange, curriculum, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  curriculum: Subject[];
  onSave: (cards: CustomCard[], deckName: string, playNow?: boolean) => void;
}) {
  const [aiSubject, setAiSubject] = useState("");
  const [aiChapter, setAiChapter] = useState("");
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(6);
  const [aiDifficulty, setAiDifficulty] = useState<Class11Flashcard["difficulty"]>("medium");
  const [aiType, setAiType] = useState<Class11Flashcard["type"]>("definition");
  const [deckName, setDeckName] = useState("");
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<GeneratedDraft[]>([]);
  const [stage, setStage] = useState<"generate" | "review">("generate");
  const [generationError, setGenerationError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const pending = JSON.parse(
        localStorage.getItem("scholar-pending-ai-flashcards") || "null",
      ) as { drafts?: GeneratedDraft[]; deckName?: string } | null;
      if (pending?.drafts?.length) {
        setDrafts(pending.drafts);
        setDeckName(pending.deckName || "");
        setStage("review");
      }
    } catch {
      // A fresh generator remains available if storage is blocked.
    }
  }, []);

  const reset = () => {
    setAiSubject(""); setAiChapter(""); setAiTopic(""); setAiCount(6);
    setAiDifficulty("medium"); setAiType("definition");
    setDeckName(""); setDrafts([]); setStage("generate"); setGenerationError(null);
    try { localStorage.removeItem("scholar-pending-ai-flashcards"); } catch { /* ignore */ }
  };

  const defaultDeckName = () => {
    const subj = curriculum.find((s) => s.id === aiSubject);
    const ch = (subj?.chapters ?? []).find((c) => c.id === aiChapter);
    return subj && ch
      ? `${ch.title} — ${aiType.charAt(0).toUpperCase() + aiType.slice(1)} Cards`
      : "AI Flashcards";
  };

  const handleGenerate = async () => {
    if (!aiSubject || !aiChapter || !aiTopic.trim()) { toast.error("Pick a subject and chapter, then enter a topic"); return; }
    const subj = curriculum.find((s) => s.id === aiSubject);
    const ch = (subj?.chapters ?? []).find((c) => c.id === aiChapter);
    if (!subj || !ch) { toast.error("Could not find that chapter"); return; }
    const backgroundTaskId = beginBackgroundTask({
      kind: "flashcards",
      title: "Generating flashcards",
      message: `Creating ${aiCount} cards for ${ch.title}…`,
      viewId: "flashcards",
    });
    setLoading(true);
    setGenerationError(null);
    try {
      const prompt = `Generate ${aiCount} CBSE Class 11 flashcards about "${aiTopic.trim()}" from the chapter "${ch.title}" (${subj.name}). Each card should be ${aiDifficulty} difficulty and of type "${aiType}". Use concise fronts, accurate backs, useful optional explanations, the requested topic, and 2-4 relevant tags.`;
      const data = await askAIJSON<{ cards: { front: string; back: string; explanation?: string; topic?: string; tags?: string[] }[] }>(prompt, "default", { mode: "flashcards" });
      const list = data?.cards ?? [];
      if (list.length === 0) {
        failBackgroundTask(backgroundTaskId, "No usable flashcards were returned.");
        setStage("generate");
        setGenerationError("AI generation is unavailable. Create a local draft from Scholar's chapter content?");
        return;
      }
      const newDrafts: GeneratedDraft[] = list.map((c, i) => ({
        id: `ai-${Date.now()}-${i}`,
        subject: aiSubject, subjectName: subj.name,
        chapterId: aiChapter, chapter: ch.title,
        topic: c.topic?.trim() || aiTopic.trim(),
        type: aiType,
        front: c.front?.trim() || "",
        back: c.back?.trim() || "",
        explanation: c.explanation?.trim() || undefined,
        difficulty: aiDifficulty, examImportance: "medium",
        tags: Array.isArray(c.tags) ? c.tags.slice(0, 5) : [],
        selected: true,
        createdBy: "ai",
      }));
      setDrafts(newDrafts);
      try {
        localStorage.setItem(
          "scholar-pending-ai-flashcards",
          JSON.stringify({
            drafts: newDrafts,
            deckName: deckName.trim() || defaultDeckName(),
          }),
        );
      } catch { /* ignore */ }
      setStage("review");
      completeBackgroundTask(
        backgroundTaskId,
        `${newDrafts.length} cards are ready for review.`,
      );
      toast.success(`Generated ${newDrafts.length} draft cards — review and edit before saving.`);
    } catch {
      failBackgroundTask(backgroundTaskId, "Flashcard generation failed.");
      setStage("generate");
      setGenerationError("AI generation is unavailable. Create a local draft from Scholar's chapter content?");
    }
    finally { setLoading(false); }
  };

  const generateLocalDraft = () => {
    const subj = curriculum.find((s) => s.id === aiSubject);
    const ch = (subj?.chapters ?? []).find((c) => c.id === aiChapter);
    if (!subj || !ch || !aiTopic.trim()) return;
    const starters = [
      `Define ${aiTopic.trim()}.`,
      `State the central principle used in ${aiTopic.trim()}.`,
      `Write one key formula or rule for ${aiTopic.trim()}.`,
      `What is a common mistake when solving ${aiTopic.trim()} problems?`,
      `Give one Class 11 application of ${aiTopic.trim()}.`,
    ];
    const localDrafts: GeneratedDraft[] = Array.from({ length: aiCount }, (_, index) => ({
      id: `local-${Date.now()}-${index}`,
      subject: aiSubject,
      subjectName: subj.name,
      chapterId: aiChapter,
      chapter: ch.title,
      topic: aiTopic.trim(),
      type: aiType,
      front: starters[index % starters.length],
      back: `Add the concise ${subj.name} answer for ${aiTopic.trim()} here.`,
      explanation: "Local fallback draft — review and replace this guidance before saving.",
      difficulty: aiDifficulty,
      examImportance: "medium",
      tags: [subj.name.toLowerCase(), aiTopic.trim().toLowerCase()],
      selected: true,
      createdBy: "local-fallback",
    }));
    setDrafts(localDrafts);
    setStage("review");
    setGenerationError(null);
    toast.info("Created local fallback drafts. Review every card before saving.");
  };

  const updateDraft = (id: string, patch: Partial<GeneratedDraft>) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };
  const deleteDraft = (id: string) => setDrafts((prev) => prev.filter((d) => d.id !== id));

  const toCustomCard = (d: GeneratedDraft): CustomCard => ({
    id: d.id, subject: d.subject as Class11Flashcard["subject"], subjectName: d.subjectName,
    chapterId: d.chapterId, chapter: d.chapter, topic: d.topic, type: d.type,
    front: d.front.trim(), back: d.back.trim(), explanation: d.explanation,
    difficulty: d.difficulty, examImportance: d.examImportance, tags: d.tags, custom: true,
    createdBy: d.createdBy,
  });

  const saveAll = () => {
    const valid = drafts.filter((d) => d.front.trim() && d.back.trim());
    if (valid.length === 0) { toast.error("No valid cards to save."); return; }
    const name = deckName.trim() || defaultDeckName();
    onSave(valid.map(toCustomCard), name);
    toast.success(`Saved ${valid.length} cards to deck "${name}".`);
    onOpenChange(false); reset();
  };

  const saveSelected = () => {
    const valid = drafts.filter((d) => d.selected && d.front.trim() && d.back.trim());
    if (valid.length === 0) { toast.error("No cards selected."); return; }
    const name = deckName.trim() || defaultDeckName();
    onSave(valid.map(toCustomCard), name);
    toast.success(`Saved ${valid.length} selected cards to deck "${name}".`);
    onOpenChange(false); reset();
  };

  const saveAndPlay = () => {
    const valid = drafts.filter((d) => d.selected && d.front.trim() && d.back.trim());
    if (valid.length === 0) { toast.error("No cards selected."); return; }
    const name = deckName.trim() || defaultDeckName();
    onSave(valid.map(toCustomCard), name, true);
    onOpenChange(false); reset();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setTimeout(reset, 200); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-fuchsia-500" />
            {stage === "generate" ? "AI Flashcard Generator" : "Review Generated Cards"}
          </DialogTitle>
          <DialogDescription>
            {stage === "generate"
              ? "Generate CBSE Class 11 flashcards with AI. You'll review & edit before saving."
              : `${drafts.length} draft cards — edit, deselect, or delete before saving.`}
          </DialogDescription>
        </DialogHeader>

        {stage === "generate" ? (
          <div className="space-y-3 py-1 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select value={aiSubject} onValueChange={(v) => { setAiSubject(v); setAiChapter(""); }}>
                <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
                <SelectContent>
                  {(curriculum ?? []).map((s) => (<SelectItem key={s.id} value={s.id}>{s.icon} {s.name}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={aiChapter} onValueChange={setAiChapter} disabled={!aiSubject}>
                <SelectTrigger><SelectValue placeholder="Chapter" /></SelectTrigger>
                <SelectContent>
                  {(curriculum.find((s) => s.id === aiSubject)?.chapters ?? []).map((c) => (<SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={aiDifficulty} onValueChange={(v) => setAiDifficulty(v as Class11Flashcard["difficulty"])}>
                <SelectTrigger><SelectValue placeholder="Difficulty" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
              <Select value={aiType} onValueChange={(v) => setAiType(v as Class11Flashcard["type"])}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_INFO) ?? []).map((t) => (<SelectItem key={t} value={t}>{TYPE_INFO[t].label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Topic</label>
              <Input
                value={aiTopic}
                onChange={(event) => setAiTopic(event.target.value)}
                placeholder="e.g. Newton's second law, hybridisation, list slicing"
                className="text-sm"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">Number of cards</p>
                <span className="text-sm font-mono font-medium">{aiCount}</span>
              </div>
              <input type="range" min={3} max={15} value={aiCount} onChange={(e) => setAiCount(Number(e.target.value))} className="w-full accent-fuchsia-500" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Deck name</label>
              <Input value={deckName} onChange={(e) => setDeckName(e.target.value)} placeholder={defaultDeckName()} className="text-sm" />
              <p className="text-[10px] text-muted-foreground mt-1">Cards will be saved as a named deck you can play later.</p>
            </div>
            {generationError && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
                <p className="text-sm text-amber-700 dark:text-amber-200">{generationError}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={handleGenerate} disabled={loading}>Retry AI</Button>
                  <Button size="sm" variant="outline" onClick={generateLocalDraft}>Generate Local Draft</Button>
                  <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 overflow-y-auto max-h-[55vh] pr-1">
            <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-2.5">
              <label className="text-[10px] uppercase text-muted-foreground">Deck name</label>
              <Input value={deckName} onChange={(e) => setDeckName(e.target.value)} placeholder="Deck name" className="text-sm h-8 mt-0.5" />
            </div>
            {(drafts ?? []).map((d, i) => {
              const info = SUBJECT_INFO[d.subject] ?? SUBJECT_INFO.physics;
              return (
                <div key={d.id} className={cn("rounded-xl border p-3 transition-all", d.selected ? "border-fuchsia-500/40 bg-fuchsia-500/5" : "border-border opacity-60")}>
                  <div className="flex items-center gap-2 mb-2">
                    <input type="checkbox" checked={d.selected} onChange={(e) => updateDraft(d.id, { selected: e.target.checked })} className="h-4 w-4 accent-fuchsia-500" />
                    <Badge variant="outline" className="text-[10px]" style={{ borderColor: info.color, color: info.color }}>{info.icon} {info.name}</Badge>
                    <span className="text-[10px] text-muted-foreground">#{i + 1} · {d.topic}</span>
                    {d.createdBy === "local-fallback" && <Badge variant="secondary" className="text-[9px]">Local draft</Badge>}
                    <button onClick={() => deleteDraft(d.id)} className="ml-auto p-1 rounded hover:bg-rose-500/15 text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase text-muted-foreground">Front</label>
                      <Textarea value={d.front} onChange={(e) => updateDraft(d.id, { front: e.target.value })} rows={2} className="resize-none text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase text-muted-foreground">Back</label>
                      <Textarea value={d.back} onChange={(e) => updateDraft(d.id, { back: e.target.value })} rows={2} className="resize-none text-sm" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <label className="text-[10px] uppercase text-muted-foreground">Explanation (optional)</label>
                    <Input value={d.explanation ?? ""} onChange={(e) => updateDraft(d.id, { explanation: e.target.value || undefined })} className="text-sm h-8" />
                  </div>
                </div>
              );
            })}
            {drafts.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">All drafts deleted. Close and try again.</p>}
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-2 flex-wrap">
          {stage === "generate" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleGenerate} disabled={loading || !aiSubject || !aiChapter || !aiTopic.trim()} className="bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white">
                {loading ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Generating…</> : <><Sparkles className="h-4 w-4 mr-1.5" /> Generate</>}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setStage("generate")}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                <Button variant="outline" onClick={handleGenerate} disabled={loading}><Sparkles className="h-4 w-4 mr-1.5" /> Regenerate</Button>
                <Button variant="outline" onClick={saveAll} disabled={drafts.length === 0}><Save className="h-4 w-4 mr-1.5" /> Save All</Button>
                <Button variant="outline" onClick={saveSelected} disabled={drafts.filter((d) => d.selected).length === 0}>
                  <Check className="h-4 w-4 mr-1.5" /> Save Selected
                </Button>
                <Button onClick={saveAndPlay} disabled={drafts.filter((d) => d.selected).length === 0} className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
                  <Play className="h-4 w-4 mr-1.5" /> Save & Play
                </Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
