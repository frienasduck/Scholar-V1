"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useStore } from "@/lib/store";
import { useCurriculum } from "@/lib/use-curriculum";
import { loadSubjectFlashcards } from "@/lib/flashcards-loader";
import { CLASS11_FLASHCARD_META, getFlashcardCountBySubject } from "@/lib/flashcards-class11-meta";
import type { Class11Flashcard } from "@/lib/flashcards-physics";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Layers, Brain, Zap, Search, Flame, Target,
  Bookmark, BookmarkCheck, Video, BookOpen, Filter, Rocket, Loader2,
  Trash2, Play,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ScholarAIContent } from "@/components/ai/scholar-ai-content";
import { Badge } from "@/components/ui/badge";
import {
  SUBJECT_INFO, SUBJECT_ORDER, TYPE_INFO, DIFFICULTY_INFO,
  type RevisionMode, type ReviewState, type CustomCard,
  type FlashcardDeck,
  loadReviewState, saveReviewState, isC11CardDue,
  loadBookmarks, saveBookmarks,
  loadCustomCards, saveCustomCards,
  loadDecks, saveDecks, upsertDeck, deleteDeck,
} from "./flashcard-utils";
import { RevisionPortal } from "./RevisionPortal";
import { AIGeneratorDialog } from "./AIGeneratorDialog";

const PAGE_SIZE = 40;

export function Class11FlashcardsView() {
  const curriculum = useCurriculum();
  const addXP = useStore((s) => s.addXP);
  const addCoins = useStore((s) => s.addCoins);
  const pushActivity = useStore((s) => s.pushActivity);
  const scholarClass = useStore((s) => s.user.scholarClass);

  // ---- Filter state ----
  const [subject, setSubject] = useState<string>("physics");
  const [chapterId, setChapterId] = useState<string>("all");
  const [topic, setTopic] = useState<string>("all");
  const [difficulty, setDifficulty] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // ---- Data loading (lazy by subject) ----
  const [cards, setCards] = useState<Class11Flashcard[]>([]);
  const [loadingCards, setLoadingCards] = useState(true);

  // ---- Custom cards (AI-generated) ----
  const [customCards, setCustomCards] = useState<CustomCard[]>(() => loadCustomCards(scholarClass));

  // ---- AI-generated decks (named, playable) ----
  const [decks, setDecks] = useState<FlashcardDeck[]>(() => loadDecks(scholarClass));

  // ---- Revision state ----
  const [revisionQueue, setRevisionQueue] = useState<Class11Flashcard[]>([]);
  const [revisionMode, setRevisionMode] = useState<RevisionMode>("classic");
  const [showRevision, setShowRevision] = useState(false);

  // ---- Review state (localStorage) ----
  const [reviewState, setReviewState] = useState<ReviewState>(() => loadReviewState(scholarClass));
  const [bookmarks, setBookmarks] = useState<Set<string>>(() => loadBookmarks(scholarClass));

  // ---- Browse expanded card ----
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ---- AI Generator open ----
  const [aiOpen, setAiOpen] = useState(false);

  // ---- Pagination ----
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  // Load cards when subject changes (lazy)
  useEffect(() => {
    let cancelled = false;
    loadSubjectFlashcards(subject).then((loaded) => {
      if (cancelled) return;
      setCards(loaded);
      setLoadingCards(false);
    });
    return () => { cancelled = true; };
  }, [subject]);

  // Older custom cards (including cards created from quiz mistakes) were
  // stored without a deck. Recover them into profile-scoped sets so they are
  // never stranded in the individual-card browser.
  useEffect(() => {
    const referencedIds = new Set(decks.flatMap((deck) => deck.cardIds));
    const orphanCards = customCards.filter((card) => !referencedIds.has(card.id));
    if (orphanCards.length === 0) return;

    const grouped = new Map<string, CustomCard[]>();
    orphanCards.forEach((card) => {
      const key = [card.subject || "general", card.chapterId || card.topic || "custom"].join(":");
      grouped.set(key, [...(grouped.get(key) ?? []), card]);
    });

    const recoveredDecks: FlashcardDeck[] = [...grouped.entries()].map(([key, group]) => {
      const first = group[0];
      const chapterTitle = first.chapter || first.topic || "Custom cards";
      return {
        id: `deck-recovered-${scholarClass}-${key.replace(/[^a-z0-9]+/gi, "-")}`,
        profile: scholarClass,
        name: chapterTitle === "Quiz mistake" ? "Quiz Mistake Review" : `${chapterTitle} · Custom Set`,
        subject: first.subject || "general",
        subjectName: first.subjectName || SUBJECT_INFO[first.subject]?.name || "Custom",
        chapterId: first.chapterId || "",
        chapterTitle,
        difficulty: first.difficulty || "medium",
        createdBy: first.createdBy === "local-fallback" ? "local-fallback" : "ai",
        createdAt: Date.now(),
        cardIds: group.map((card) => card.id),
      };
    });
    const next = [...recoveredDecks, ...decks];
    saveDecks(scholarClass, next);
    const updateTimer = window.setTimeout(() => setDecks(next), 0);
    return () => window.clearTimeout(updateTimer);
  }, [customCards, decks, scholarClass]);

  // Available chapters for selected subject (from metadata — no data import needed)
  const chaptersWithCards = useMemo(() => {
    const subj = curriculum.find((s) => s.id === subject);
    if (!subj) return [];
    const chapterIdsWithCards = new Set(
      CLASS11_FLASHCARD_META.filter((m) => m.subjectId === subject).map((m) => m.chapterId)
    );
    return (subj.chapters ?? []).filter((ch) => chapterIdsWithCards.has(ch.id));
  }, [curriculum, subject]);

  // Topics available for selected subject + chapter
  const availableTopics = useMemo(() => {
    const set = new Set<string>();
    cards.filter((c) => chapterId === "all" || c.chapterId === chapterId).forEach((c) => set.add(c.topic));
    return [...set].sort();
  }, [cards, chapterId]);

  // Built-in cards stay in the browse grid. Custom/AI cards are presented
  // only through their named sets below, avoiding an unstructured card dump.
  const baseCards = useMemo(() => {
    return cards;
  }, [cards]);

  // Filtered cards
  const filteredCards = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return baseCards.filter((c) => {
      if (chapterId !== "all" && c.chapterId !== chapterId) return false;
      if (topic !== "all" && c.topic !== topic) return false;
      if (difficulty !== "all" && c.difficulty !== difficulty) return false;
      if (type !== "all" && c.type !== type) return false;
      if (q) {
        const hay = `${c.front} ${c.back} ${c.topic} ${(c.tags ?? []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [baseCards, chapterId, topic, difficulty, type, debouncedSearch]);

  // Paginated cards
  const visibleCards = useMemo(() => filteredCards.slice(0, visibleCount), [filteredCards, visibleCount]);

  // Stats
  const stats = useMemo(() => {
    const total = baseCards.length + customCards.length;
    const filtered = filteredCards.length;
    const easy = filteredCards.filter((c) => c.difficulty === "easy").length;
    const medium = filteredCards.filter((c) => c.difficulty === "medium").length;
    const hard = filteredCards.filter((c) => c.difficulty === "hard").length;
    const dueCount = filteredCards.filter((c) => isC11CardDue(reviewState, c.id)).length;
    const bookmarked = filteredCards.filter((c) => bookmarks.has(c.id)).length;
    return { total, filtered, easy, medium, hard, dueCount, bookmarked };
  }, [baseCards, customCards.length, filteredCards, reviewState, bookmarks]);

  const handleSubjectChange = (newSubject: string) => {
    setLoadingCards(true);
    setSubject(newSubject);
    setChapterId("all");
    setTopic("all");
    setVisibleCount(PAGE_SIZE);
  };
  const handleChapterChange = (newChapter: string) => {
    setChapterId(newChapter);
    setTopic("all");
    setVisibleCount(PAGE_SIZE);
  };

  const launchRevision = useCallback(
    (mode: RevisionMode) => {
      let queue: Class11Flashcard[] = [];
      if (mode === "classic") {
        queue = filteredCards.filter((c) => isC11CardDue(reviewState, c.id));
        if (queue.length === 0) queue = [...filteredCards];
      } else if (mode === "formula") {
        queue = filteredCards.filter((c) => c.type === "formula");
      } else if (mode === "weak") {
        queue = filteredCards.filter((c) => {
          const r = reviewState[c.id];
          return r && (r.rating === "again" || r.rating === "hard");
        });
        if (queue.length === 0) { toast.info("No weak cards yet — rate some cards Again/Hard during revision first."); return; }
      } else if (mode === "exam") {
        queue = filteredCards.filter((c) => c.examImportance === "high");
      }
      if (queue.length === 0) { toast.info("No cards match this revision mode."); return; }
      queue = [...queue].sort(() => Math.random() - 0.5);
      setRevisionQueue(queue);
      setRevisionMode(mode);
      setShowRevision(true);
    },
    [filteredCards, reviewState]
  );

  const handleRate = useCallback(
    (card: Class11Flashcard, rating: "again" | "hard" | "good" | "easy") => {
      const r = [{ key: "again", box: 1 }, { key: "hard", box: 2 }, { key: "good", box: 3 }, { key: "easy", box: 4 }].find((x) => x.key === rating)!;
      setReviewState((prev) => {
        const next: ReviewState = { ...prev, [card.id]: { cardId: card.id, lastReviewed: Date.now(), box: r.box, rating } };
        saveReviewState(scholarClass, next);
        return next;
      });
      addXP(rating === "again" ? 1 : 3);
      if (rating !== "again") addCoins(1);
    },
    [addXP, addCoins, scholarClass]
  );

  const toggleBookmark = useCallback((cardId: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId); else next.add(cardId);
      saveBookmarks(scholarClass, next);
      return next;
    });
  }, [scholarClass]);

  const handleSaveCustomCards = useCallback(
    (newCards: CustomCard[], deckName: string, playNow?: boolean) => {
      setCustomCards((prev) => {
        const next = [...prev, ...newCards];
        saveCustomCards(scholarClass, next);
        return next;
      });
      const first = newCards[0];
      const deck: FlashcardDeck = {
        id: `deck-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        profile: scholarClass, name: deckName,
        subject: first?.subject ?? subject, subjectName: first?.subjectName ?? "",
        chapterId: first?.chapterId ?? "", chapterTitle: first?.chapter ?? "",
        difficulty: first?.difficulty ?? "medium",
        createdBy: first?.createdBy === "local-fallback" ? "local-fallback" : "ai",
        createdAt: Date.now(), cardIds: newCards.map((c) => c.id),
      };
      const updatedDecks = upsertDeck(scholarClass, deck);
      setDecks(updatedDecks);
      pushActivity({ type: "flashcard", text: `Saved deck "${deckName}" (${newCards.length} cards)`, icon: "✨" });
      if (playNow) {
        const queue = newCards as unknown as Class11Flashcard[];
        setRevisionQueue(queue);
        setRevisionMode("classic");
        setShowRevision(true);
        toast.success(`Playing "${deckName}" — ${newCards.length} cards.`);
      }
    },
    [pushActivity, scholarClass, subject]
  );

  const playDeck = useCallback((deckId: string) => {
    const deck = decks.find((d) => d.id === deckId);
    if (!deck || deck.cardIds.length === 0) { toast.error("This deck has no cards."); return; }
    const deckCards = customCards.filter((c) => deck.cardIds.includes(c.id)) as unknown as Class11Flashcard[];
    if (deckCards.length === 0) { toast.error("Could not find the cards for this deck."); return; }
    setRevisionQueue(deckCards);
    setRevisionMode("classic");
    setShowRevision(true);
    toast.success(`Playing "${deck.name}" — ${deckCards.length} cards.`);
  }, [decks, customCards]);

  const handleDeleteDeck = useCallback((deckId: string) => {
    const deck = decks.find((d) => d.id === deckId);
    if (!deck) return;
    const updatedDecks = deleteDeck(scholarClass, deckId);
    setDecks(updatedDecks);
    setCustomCards((prev) => {
      const next = prev.filter((c) => !deck.cardIds.includes(c.id));
      saveCustomCards(scholarClass, next);
      return next;
    });
    toast.success(`Deleted deck "${deck.name}".`);
  }, [decks, scholarClass]);

  // ===== Revision Mode =====
  if (showRevision && revisionQueue.length > 0) {
    return (
      <RevisionPortal
        cards={revisionQueue}
        mode={revisionMode}
        reviewState={reviewState}
        bookmarks={bookmarks}
        onRate={handleRate}
        onToggleBookmark={toggleBookmark}
        onExit={() => setShowRevision(false)}
      />
    );
  }

  // ===== Browse Mode =====
  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Instrument+Serif:ital@0;1&display=swap');
        .cinema-glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 25px 80px -12px rgba(0,0,0,0.3); color: white; }
        .cinema-glass:hover { background: rgba(255,255,255,0.05); }
        .cinema-font-serif { font-family: 'Instrument Serif', serif; }
        .cinema-font-body { font-family: 'Inter', sans-serif; }
        .cinema-glass .text-muted-foreground { color: rgba(255,255,255,0.6) !important; }
        .cinema-glass input, .cinema-glass textarea, .cinema-glass select { background: rgba(255,255,255,0.05) !important; border-color: rgba(255,255,255,0.15) !important; color: white !important; }
      `}</style>
      <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover z-0 opacity-30">
        <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260319_015952_e1deeb12-8fb7-4071-a42a-60779fc64ab6.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 z-0 bg-black/60" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="cinema-font-serif text-3xl sm:text-4xl text-white italic">Flashcards</h1>
          <p className="text-sm text-white/50 mt-1">Spaced repetition for Class 11 PCM + CS · {stats.total} cards loaded</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <div className="cinema-glass rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40 mb-1"><Layers className="h-3 w-3" /> Total</div>
            <p className="text-lg font-bold text-white">{stats.total}</p>
          </div>
          <div className="cinema-glass rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40 mb-1"><Zap className="h-3 w-3" /> Due</div>
            <p className="text-lg font-bold text-amber-300">{stats.dueCount}</p>
          </div>
          <div className="cinema-glass rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40 mb-1"><Bookmark className="h-3 w-3" /> Saved</div>
            <p className="text-lg font-bold text-white">{stats.bookmarked}</p>
          </div>
          <div className="cinema-glass rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40 mb-1"><Filter className="h-3 w-3" /> Showing</div>
            <p className="text-lg font-bold text-white">{stats.filtered}</p>
          </div>
        </div>

        {/* Subject tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {SUBJECT_ORDER.map((s) => {
            const info = SUBJECT_INFO[s];
            const count = getFlashcardCountBySubject(s);
            const isActive = subject === s;
            return (
              <button key={s} onClick={() => handleSubjectChange(s)} className={cn("flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all", isActive ? "text-white" : "text-white/50 hover:text-white")} style={isActive ? { background: `${info.color}20`, border: `1px solid ${info.color}40` } : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span>{info.icon}</span> {info.name}
                <span className="text-[10px] text-white/40">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="cinema-glass rounded-xl p-3 mb-4 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search flashcards…" className="w-full rounded-lg bg-white/5 border border-white/10 pl-9 pr-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/40" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <select value={chapterId} onChange={(e) => handleChapterChange(e.target.value)} className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500/40">
              <option value="all">All Chapters</option>
              {chaptersWithCards.map((ch) => (<option key={ch.id} value={ch.id}>{ch.title}</option>))}
            </select>
            <select value={topic} onChange={(e) => setTopic(e.target.value)} disabled={chapterId === "all" && availableTopics.length > 20} className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500/40 disabled:opacity-50">
              <option value="all">All Topics</option>
              {availableTopics.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500/40">
              <option value="all">All Difficulty</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500/40">
              <option value="all">All Types</option>
              {Object.entries(TYPE_INFO).map(([k, v]) => (<option key={k} value={k}>{v.label}</option>))}
            </select>
          </div>
        </div>

        {/* Revision modes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <RevisionModeButton icon={<Zap className="h-4 w-4" />} label="Classic Flip" desc="Due cards" color="#3b82f6" onClick={() => launchRevision("classic")} />
          <RevisionModeButton icon={<Brain className="h-4 w-4" />} label="Formula" desc="Formula cards" color="#f59e0b" onClick={() => launchRevision("formula")} />
          <RevisionModeButton icon={<Flame className="h-4 w-4" />} label="Weak Cards" desc="Again/Hard rated" color="#ef4444" onClick={() => launchRevision("weak")} />
          <RevisionModeButton icon={<Target className="h-4 w-4" />} label="Exam Cram" desc="High importance" color="#10b981" onClick={() => launchRevision("exam")} />
        </div>

        {/* AI Generator button */}
        <div className="cinema-glass rounded-xl p-3 mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="grid place-items-center h-9 w-9 rounded-xl bg-fuchsia-500/15 text-fuchsia-300">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">My Custom & AI Sets</p>
              <p className="text-[11px] text-white/50">{decks.length} organized set{decks.length === 1 ? "" : "s"} · {customCards.length} custom cards</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {decks.length > 0 && (
              <button
                type="button"
                onClick={() => document.getElementById("my-flashcard-sets")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white"
              >
                View sets
              </button>
            )}
          <button onClick={() => setAiOpen(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-500/30 text-fuchsia-200 hover:bg-fuchsia-500/25 transition-colors">
            <Sparkles className="h-3.5 w-3.5" /> AI Flashcard Generator
          </button>
          </div>
        </div>

        {/* Loading state */}
        {loadingCards ? (
          <div className="cinema-glass rounded-2xl p-12 text-center">
            <Loader2 className="h-8 w-8 mx-auto text-white/40 animate-spin mb-2" />
            <p className="text-sm text-white/50">Loading {SUBJECT_INFO[subject]?.name} flashcards…</p>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="cinema-glass rounded-2xl p-8 text-center">
            <BookOpen className="h-8 w-8 mx-auto text-white/20 mb-2" />
            <p className="text-sm text-white/50">No flashcards match your filters.</p>
            <button onClick={() => { setChapterId("all"); setTopic("all"); setDifficulty("all"); setType("all"); setSearch(""); }} className="mt-2 text-xs text-violet-300 hover:text-violet-200">Clear filters</button>
          </div>
        ) : (
          <>
            {/* Card grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {visibleCards.map((card) => {
                const info = SUBJECT_INFO[card.subject] ?? SUBJECT_INFO.physics;
                const tInfo = TYPE_INFO[card.type] ?? { label: card.type, color: "#888" };
                const dInfo = DIFFICULTY_INFO[card.difficulty] ?? { label: card.difficulty, color: "#888" };
                const isBookmarked = bookmarks.has(card.id);
                const isDue = isC11CardDue(reviewState, card.id);
                const isExpanded = expandedId === card.id;
                return (
                  <div key={card.id} className={cn("cinema-glass rounded-xl p-3 transition-all cursor-pointer", isExpanded && "ring-1 ring-violet-500/40")} onClick={() => setExpandedId(isExpanded ? null : card.id)}>
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${info.color}20`, color: info.color }}>{info.icon} {info.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: `${tInfo.color}20`, color: tInfo.color }}>{tInfo.label}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: `${dInfo.color}20`, color: dInfo.color }}>{dInfo.label}</span>
                      {isDue && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300">Due</span>}
                      <button onClick={(e) => { e.stopPropagation(); toggleBookmark(card.id); }} className="ml-auto p-0.5 text-white/40 hover:text-amber-300">
                        {isBookmarked ? <BookmarkCheck className="h-3.5 w-3.5 text-amber-300" /> : <Bookmark className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <ScholarAIContent content={card.front} mode="compact" className="mb-1 text-sm font-medium text-white" />
                    <p className="text-[10px] text-white/40">{card.chapter} · {card.topic}</p>
                    {isExpanded && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-2 pt-2 border-t border-white/10">
                        <ScholarAIContent content={card.back} mode="compact" className="text-sm text-white/80" />
                        {card.explanation && <ScholarAIContent content={card.explanation} mode="compact" className="mt-1 text-[11px] italic text-white/50" />}
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Load more */}
            {visibleCount < filteredCards.length && (
              <div className="text-center mt-4">
                <button onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} className="text-xs px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                  Load more ({filteredCards.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </>
        )}

        {/* ===== My AI-Generated Decks ===== */}
        <div id="my-flashcard-sets" className="mt-6 pt-6 border-t border-white/10 scroll-mt-20">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-fuchsia-400" />
              <h3 className="text-sm font-semibold text-white">My Custom & AI Sets</h3>
              <span className="text-xs text-white/40">{decks.length} set{decks.length === 1 ? "" : "s"}</span>
            </div>
            {decks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center">
                <Layers className="h-7 w-7 mx-auto text-white/25 mb-2" />
                <p className="text-sm text-white/60">No custom sets yet.</p>
                <button type="button" onClick={() => setAiOpen(true)} className="mt-2 text-xs text-fuchsia-300 hover:text-fuchsia-200">
                  Generate your first set
                </button>
              </div>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {decks.map((deck) => {
                const info = SUBJECT_INFO[deck.subject] ?? SUBJECT_INFO.physics;
                return (
                  <div key={deck.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 hover:bg-white/[0.05] transition-all" style={{ borderLeft: `3px solid ${info.color}` }}>
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{deck.name}</p>
                        <p className="text-[11px] text-white/50 truncate">{info.icon} {info.name} · {deck.chapterTitle}</p>
                      </div>
                      <button onClick={() => handleDeleteDeck(deck.id)} aria-label={`Delete deck ${deck.name}`} className="p-1 rounded hover:bg-rose-500/15 text-rose-400 shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-white/40 mb-2.5">
                      <span>{deck.cardIds.length} cards</span>
                      <span>{deck.difficulty}</span>
                      <span>{new Date(deck.createdAt).toLocaleDateString()}</span>
                    </div>
                    <button onClick={() => playDeck(deck.id)} className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white hover:from-fuchsia-600 hover:to-violet-600 transition-all">
                      <Play className="h-3 w-3 fill-white" /> Play Deck
                    </button>
                  </div>
                );
              })}
            </div>
            )}
          </div>

        {/* AI Generator Dialog */}
        <AIGeneratorDialog open={aiOpen} onOpenChange={setAiOpen} curriculum={curriculum} onSave={handleSaveCustomCards} />
      </div>
    </div>
  );
}

function RevisionModeButton({ icon, label, desc, color, onClick }: { icon: React.ReactNode; label: string; desc: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group flex flex-col items-start gap-1 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all hover:-translate-y-0.5 text-left" style={{ boxShadow: `inset 0 -2px 0 0 ${color}` }}>
      <div className="flex items-center gap-2 text-sm font-medium text-white">
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <p className="text-[11px] text-white/60">{desc}</p>
    </button>
  );
}
