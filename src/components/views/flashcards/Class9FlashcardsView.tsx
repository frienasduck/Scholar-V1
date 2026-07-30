"use client";

import { useState, useMemo, useCallback } from "react";
import { useStore, type Deck, type Flashcard } from "@/lib/store";
import { CURRICULUM } from "@/lib/curriculum";
import type { Subject } from "@/lib/curriculum-class11";
import { useCurriculum } from "@/lib/use-curriculum";
import { askAIJSON } from "@/lib/ai";
import {
  beginBackgroundTask,
  completeBackgroundTask,
  failBackgroundTask,
} from "@/lib/background-tasks";
import { StatCard, SectionHeader, Pill } from "@/lib/shared";
import { ScholarAIContent } from "@/components/ai/scholar-ai-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Sparkles, Layers, Zap, Loader2, X, ChevronRight, RotateCcw, Award, Check } from "lucide-react";
import { toast } from "sonner";
import { DECK_COLORS } from "./flashcard-utils";

const isDue = (c: Flashcard) => Date.now() - c.lastReviewed > 86_400_000 * c.box;
const RATINGS_C9 = [
  { key: "again" as const, label: "Again", color: "#ef4444" },
  { key: "hard" as const, label: "Hard", color: "#f59e0b" },
  { key: "good" as const, label: "Good", color: "#3b82f6" },
  { key: "easy" as const, label: "Easy", color: "#10b981" },
];

export function Class9FlashcardsView() {
  const CURRICULUM = useCurriculum();
  const decks = useStore((s) => s.decks);
  const flashcards = useStore((s) => s.flashcards);
  const addDeck = useStore((s) => s.addDeck);
  const addFlashcard = useStore((s) => s.addFlashcard);
  const reviewFlashcard = useStore((s) => s.reviewFlashcard);
  const pushActivity = useStore((s) => s.pushActivity);
  const addXP = useStore((s) => s.addXP);
  const addCoins = useStore((s) => s.addCoins);

  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const activeDeckId = selectedDeckId && decks.find((d) => d.id === selectedDeckId) ? selectedDeckId : decks[0]?.id ?? "";
  const [studying, setStudying] = useState(false);
  const [studyQueue, setStudyQueue] = useState<string[]>([]);
  const [studyIdx, setStudyIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  const stats = useMemo(() => {
    const total = flashcards.length;
    const due = flashcards.filter(isDue).length;
    const mastered = flashcards.filter((c) => c.box >= 5).length;
    return { total, due, mastered };
  }, [flashcards]);

  const deckStats = useCallback((deckId: string) => {
    const cards = flashcards.filter((c) => c.deckId === deckId);
    return { total: cards.length, due: cards.filter(isDue).length, mastered: cards.filter((c) => c.box >= 5).length };
  }, [flashcards]);

  const activeDeck = decks.find((d) => d.id === activeDeckId);

  const startStudy = (deckId: string) => {
    const cards = flashcards.filter((c) => c.deckId === deckId && isDue(c));
    if (cards.length === 0) { toast.info("No cards due in this deck right now."); return; }
    setSelectedDeckId(deckId);
    setStudyQueue(cards.map((c) => c.id));
    setStudyIdx(0); setReviewedCount(0); setFlipped(false); setStudying(true);
  };

  const startReviewAll = () => {
    const cards = flashcards.filter(isDue);
    if (cards.length === 0) { toast.info("No cards due."); return; }
    setStudyQueue(cards.map((c) => c.id));
    setStudyIdx(0); setReviewedCount(0); setFlipped(false); setStudying(true);
  };

  const rateCard = (quality: "again" | "hard" | "good" | "easy") => {
    const cardId = studyQueue[studyIdx];
    if (!cardId) return;
    reviewFlashcard(cardId, quality);
    addXP(quality === "again" ? 1 : 3);
    if (quality !== "again") addCoins(1);
    setReviewedCount((n) => n + 1);
    if (studyIdx + 1 < studyQueue.length) {
      setStudyIdx((i) => i + 1); setFlipped(false);
    } else {
      toast.success(`Reviewed ${reviewedCount + 1} cards!`);
      pushActivity({ type: "flashcard", text: `Reviewed ${reviewedCount + 1} flashcards`, icon: "⚡" });
      setStudying(false);
    }
  };

  // ===== Study Mode =====
  if (studying) {
    const card = flashcards.find((c) => c.id === studyQueue[studyIdx]);
    if (!card) { setStudying(false); return null; }
    return (
      <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">
        <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover z-0 opacity-40">
          <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260319_015952_e1deeb12-8fb7-4071-a42a-60779fc64ab6.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 z-0 bg-black/50" />
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setStudying(false)} className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white">
              <X className="h-4 w-4" /> Exit study
            </button>
            <Badge className="bg-white/10 text-white border-white/20">{studyIdx + 1} / {studyQueue.length}</Badge>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-8">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-teal-400" initial={{ width: 0 }} animate={{ width: `${((studyIdx + 1) / studyQueue.length) * 100}%` }} transition={{ duration: 0.3 }} />
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={card.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="relative" style={{ perspective: "1600px" }}>
              <div className="relative h-72 sm:h-80 cursor-pointer" style={{ transformStyle: "preserve-3d" }} onClick={() => setFlipped((f) => !f)}>
                <motion.div className="absolute inset-0" animate={{ rotateY: flipped ? 180 : 0 }} transition={{ duration: 0.5 }} style={{ transformStyle: "preserve-3d" }}>
                  <div className="absolute inset-0 rounded-3xl flex flex-col items-center justify-center p-6 sm:p-8" style={{ backfaceVisibility: "hidden", background: "rgba(20,20,30,0.6)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <Badge variant="outline" className="mb-4 border-white/20 text-white/60">Question</Badge>
                    <ScholarAIContent content={card.front} mode="compact" className="text-center text-lg font-medium text-white sm:text-2xl" />
                    {!flipped && <p className="mt-6 text-xs text-white/40">Click to flip</p>}
                  </div>
                  <div className="absolute inset-0 rounded-3xl flex flex-col items-center justify-center p-6 sm:p-8 overflow-y-auto" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: "rgba(30,20,40,0.6)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <Badge variant="outline" className="mb-4 border-teal-400/40 text-teal-300">Answer</Badge>
                    <ScholarAIContent content={card.back} mode="compact" className="text-center text-lg font-semibold text-white sm:text-2xl" />
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </AnimatePresence>
          {flipped && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-6">
              {RATINGS_C9.map((r) => (
                <button key={r.key} onClick={() => rateCard(r.key)} className="flex flex-col items-center gap-1 py-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/15 transition-all" style={{ boxShadow: `inset 0 -3px 0 0 ${r.color}` }}>
                  <span className="text-sm font-semibold" style={{ color: r.color }}>{r.label}</span>
                </button>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  // ===== Browse Mode =====
  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">
      <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover z-0 opacity-40">
        <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260319_015952_e1deeb12-8fb7-4071-a42a-60779fc64ab6.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 z-0 bg-black/50" />
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <SectionHeader title="Master with Spaced Repetition" subtitle="Leitner spaced repetition — review at increasing intervals." />
        <div className="flex items-center justify-end mb-6">
          <Button onClick={startReviewAll} disabled={stats.due === 0} className="bg-gradient-to-r from-indigo-500 to-teal-500 text-white">
            <Zap className="h-4 w-4 mr-1.5" /> Review all ({stats.due})
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total Cards" value={stats.total} icon={Layers} />
          <StatCard label="Due Today" value={stats.due} icon={Zap} />
          <StatCard label="Mastered" value={stats.mastered} icon={Award} />
          <StatCard label="Decks" value={decks.length} icon={Layers} />
        </div>
        {stats.due === 0 && stats.total > 0 && (
          <div className="cinema-glass rounded-2xl p-6 text-center mb-6">
            <p className="text-2xl mb-1">🎉</p>
            <p className="text-white font-medium">All caught up!</p>
            <p className="text-xs text-white/60 mt-1">No cards due for review. Come back later.</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2 mb-4">
          {decks.map((d) => {
            const s = deckStats(d.id);
            return (
              <button key={d.id} onClick={() => setSelectedDeckId(d.id)} className={`px-3 py-1.5 rounded-full text-sm transition-all ${activeDeckId === d.id ? "bg-white/15 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"}`}>
                {d.name} · {s.total} <span className="text-amber-400">({s.due})</span>
              </button>
            );
          })}
          <NewDeckDialog onAdd={addDeck} />
        </div>
        {activeDeck && (
          <DeckPanel deck={activeDeck} cards={flashcards.filter((c) => c.deckId === activeDeck.id)} onAddCard={(f, b) => addFlashcard({ deckId: activeDeck.id, front: f, back: b })} onStudy={() => startStudy(activeDeck.id)} pushActivity={pushActivity} curriculum={CURRICULUM} scholarClass={9} />
        )}
      </div>
      <style>{`.cinema-glass{background:rgba(255,255,255,0.03);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.1);color:white;}.cinema-glass:hover{background:rgba(255,255,255,0.05);}`}</style>
    </div>
  );
}

function NewDeckDialog({ onAdd }: { onAdd: (d: Partial<Deck>) => string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [color, setColor] = useState("indigo");

  const submit = () => {
    const n = name.trim();
    if (!n) { toast.error("Deck name is required"); return; }
    onAdd({ name: n, subject: subject || undefined, color });
    toast.success(`Deck "${n}" created`);
    setName(""); setSubject(""); setColor("indigo"); setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Pill><Plus className="h-3 w-3 mr-1 inline" /> New deck</Pill></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New flashcard deck</DialogTitle>
          <DialogDescription>Group related cards together for focused review.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Input placeholder="Deck name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger><SelectValue placeholder="Subject (optional)" /></SelectTrigger>
            <SelectContent>
              {CURRICULUM.map((s) => (<SelectItem key={s.id} value={s.id}>{s.icon} {s.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Color</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(DECK_COLORS).map(([k, v]) => (
                <button key={k} onClick={() => setColor(k)} className={`h-7 w-7 rounded-full transition-transform ${color === k ? "ring-2 ring-offset-2 ring-offset-background scale-110" : "hover:scale-105"}`} style={{ background: v }} />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit}>Create deck</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeckPanel({ deck, cards, onAddCard, onStudy, pushActivity, curriculum, scholarClass }: {
  deck: Deck; cards: Flashcard[]; onAddCard: (f: string, b: string) => void; onStudy: () => void;
  pushActivity: (a: { type: string; text: string; icon?: string }) => void; curriculum: Subject[]; scholarClass: 9 | 11;
}) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSubject, setAiSubject] = useState("");
  const [aiChapter, setAiChapter] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [aiLoading, setAiLoading] = useState(false);

  const due = cards.filter(isDue).length;
  const mastered = cards.filter((c) => c.box >= 5).length;

  const handleAdd = () => {
    const f = front.trim(); const b = back.trim();
    if (!f || !b) { toast.error("Both front and back are required"); return; }
    onAddCard(f, b); setFront(""); setBack("");
    toast.success("Card added");
  };

  const handleAIGenerate = async () => {
    if (!aiSubject || !aiChapter) { toast.error("Pick a subject and chapter"); return; }
    const subj = curriculum.find((s) => s.id === aiSubject);
    const ch = (subj?.chapters ?? []).find((c) => c.id === aiChapter);
    if (!ch) return;
    const backgroundTaskId = beginBackgroundTask({
      kind: "flashcards",
      title: "Generating flashcards",
      message: `Creating ${aiCount} cards for ${ch.title}…`,
      viewId: "flashcards",
    });
    setAiLoading(true);
    try {
      const prompt = `Generate ${aiCount} CBSE Class ${scholarClass} flashcards for "${ch.title}" (${subj?.name}). Respond ONLY as JSON: {"cards":[{"front":"...","back":"..."}]}`;
      const data = await askAIJSON<{ cards: { front: string; back: string }[] }>(prompt, "default", { mode: "flashcards" });
      if (!data?.cards?.length) {
        failBackgroundTask(backgroundTaskId, "No usable flashcards were returned.");
        toast.error("AI did not return any cards.");
        return;
      }
      data.cards.forEach((c) => onAddCard(c.front, c.back));
      completeBackgroundTask(
        backgroundTaskId,
        `${data.cards.length} cards were added to ${deck.name}.`,
      );
      toast.success(`Added ${data.cards.length} AI-generated cards`);
      pushActivity({ type: "flashcard", text: `AI generated ${data.cards.length} cards for ${deck.name}`, icon: "✨" });
      setAiOpen(false);
    } catch {
      failBackgroundTask(backgroundTaskId, "Flashcard generation failed.");
      toast.error("Could not generate cards.");
    }
    finally { setAiLoading(false); }
  };

  return (
    <div className="cinema-glass rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid place-items-center h-10 w-10 rounded-xl shrink-0" style={{ background: `${DECK_COLORS[deck.color] ?? "#6366f1"}1a`, color: DECK_COLORS[deck.color] ?? "#6366f1" }}>
            <Layers className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold truncate">{deck.name}</h3>
            <p className="text-xs text-muted-foreground">{cards.length} cards · <span className="text-amber-500">{due} due</span> · <span className="text-teal-500">{mastered} mastered</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setAiOpen(true)} variant="outline" size="sm"><Sparkles className="h-4 w-4 mr-1.5" /> AI Generate</Button>
          <Button onClick={onStudy} size="sm" disabled={due === 0} className="bg-gradient-to-r from-indigo-500 to-teal-500 text-white"><Zap className="h-4 w-4 mr-1.5" /> Study ({due})</Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 mb-4 p-3 rounded-xl bg-muted/30">
        <Input placeholder="Front (question)" value={front} onChange={(e) => setFront(e.target.value)} />
        <Input placeholder="Back (answer)" value={back} onChange={(e) => setBack(e.target.value)} />
        <Button onClick={handleAdd} size="sm"><Plus className="h-4 w-4 mr-1" /> Add</Button>
      </div>
      <div className="max-h-80 overflow-y-auto -mx-1 px-1">
        {cards.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">No cards in this deck yet.</p>
        ) : (
          <div className="space-y-2">
            {cards.map((c) => (
              <div key={c.id} className="flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-card/40 hover:bg-muted/30 transition-colors">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
                  <p className="text-sm font-medium truncate">{c.front}</p>
                  <p className="text-sm text-muted-foreground truncate">{c.back}</p>
                </div>
                <BoxIndicator box={c.box} />
              </div>
            ))}
          </div>
        )}
      </div>
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI Generate Flashcards</DialogTitle>
            <DialogDescription>Pick a chapter and AI will craft flashcards into &quot;{deck.name}&quot;.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <Select value={aiSubject} onValueChange={(v) => { setAiSubject(v); setAiChapter(""); }}>
              <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
              <SelectContent>{(curriculum ?? []).map((s) => (<SelectItem key={s.id} value={s.id}>{s.icon} {s.name}</SelectItem>))}</SelectContent>
            </Select>
            <Select value={aiChapter} onValueChange={setAiChapter} disabled={!aiSubject}>
              <SelectTrigger><SelectValue placeholder="Chapter" /></SelectTrigger>
              <SelectContent>{(curriculum.find((s) => s.id === aiSubject)?.chapters ?? []).map((c) => (<SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>))}</SelectContent>
            </Select>
            <input type="range" min={3} max={12} value={aiCount} onChange={(e) => setAiCount(Number(e.target.value))} className="w-full accent-indigo-500" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiOpen(false)}>Cancel</Button>
            <Button onClick={handleAIGenerate} disabled={aiLoading} className="bg-gradient-to-r from-indigo-500 to-teal-500 text-white">
              {aiLoading ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Generating…</> : <><Sparkles className="h-4 w-4 mr-1.5" /> Generate</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BoxIndicator({ box }: { box: number }) {
  const colors = ["#a1a1aa", "#f59e0b", "#f97316", "#14b8a6", "#6366f1"];
  const color = colors[Math.min(box - 1, colors.length - 1)];
  return (
    <div className="flex items-center gap-1 shrink-0" title={`Leitner box ${box}/5`}>
      <span className="text-[10px] font-mono text-muted-foreground">B{box}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (<span key={n} className="h-3 w-1.5 rounded-full" style={{ background: n <= box ? color : "oklch(0.5 0 0 / 0.15)" }} />))}
      </div>
    </div>
  );
}
