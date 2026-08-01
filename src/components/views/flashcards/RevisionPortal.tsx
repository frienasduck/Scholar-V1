"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/lib/notifications/notification-api";
import { X, Video, VideoOff, Keyboard, Check, Flame, Trophy, Bookmark, BookmarkCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScholarAIContent } from "@/components/ai/scholar-ai-content";
import type { Class11Flashcard } from "@/lib/flashcards-physics";
import {
  VIDEO_URL, SUBJECT_INFO, TYPE_INFO, DIFFICULTY_INFO, RATINGS,
  type RevisionMode, type ReviewState,
  loadVideoPref, saveVideoPref,
} from "./flashcard-utils";

// ===================================================================
//  REVISION PORTAL  (fullscreen, video background, glass card)
// ===================================================================

export function RevisionPortal({
  cards, mode, reviewState, bookmarks, onRate, onToggleBookmark, onExit,
}: {
  cards: Class11Flashcard[];
  mode: RevisionMode;
  reviewState: ReviewState;
  bookmarks: Set<string>;
  onRate: (card: Class11Flashcard, rating: "again" | "hard" | "good" | "easy") => void;
  onToggleBookmark: (cardId: string) => void;
  onExit: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [videoOn, setVideoOn] = useState<boolean>(() => loadVideoPref());
  const [finished, setFinished] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    saveVideoPref(videoOn);
  }, [videoOn]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const total = cards.length;
  const card = cards[idx];
  const progress = total > 0 ? (idx / total) * 100 : 0;

  const next = useCallback(() => {
    if (idx + 1 >= total) {
      setFinished(true);
      toast.success(`Revision complete! Reviewed ${reviewedCount + 1} card${reviewedCount + 1 === 1 ? "" : "s"}.`);
      setTimeout(() => onExit(), 1200);
      return;
    }
    setIdx((i) => i + 1);
    setFlipped(false);
  }, [idx, total, reviewedCount, onExit]);

  const rateAndAdvance = useCallback(
    (rating: "again" | "hard" | "good" | "easy") => {
      if (!card) return;
      onRate(card, rating);
      setReviewedCount((n) => n + 1);
      next();
    },
    [card, onRate, next]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") { e.preventDefault(); setFlipped((f) => !f); }
      else if (e.key === "1" && flipped) rateAndAdvance("again");
      else if (e.key === "2" && flipped) rateAndAdvance("hard");
      else if (e.key === "3" && flipped) rateAndAdvance("good");
      else if (e.key === "4" && flipped) rateAndAdvance("easy");
      else if (e.key.toLowerCase() === "b" && card) onToggleBookmark(card.id);
      else if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, card, onToggleBookmark, onExit, rateAndAdvance]);

  if (!card) return null;

  const info = SUBJECT_INFO[card.subject] ?? SUBJECT_INFO.physics;
  const tInfo = TYPE_INFO[card.type] ?? { label: card.type, color: "#888" };
  const dInfo = DIFFICULTY_INFO[card.difficulty] ?? { label: card.difficulty, color: "#888" };
  const isBookmarked = bookmarks.has(card.id);
  const review = reviewState[card.id];

  const content = (
    <div
      className="fixed inset-0 z-[200] overflow-hidden"
      style={{ background: videoOn ? "#000" : "linear-gradient(160deg, #0a0a14 0%, #14121f 50%, #0a0e1a 100%)" }}
    >
      {videoOn && (
        <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.45 }}>
          <source src={VIDEO_URL} type="video/mp4" />
        </video>
      )}
      <div className="absolute inset-0 bg-black/60" />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 sm:p-6 flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs text-white/70 mb-1.5">
            <span className="font-mono">{idx + 1} / {total}</span>
            <span className="hidden sm:inline">
              Mode: <span className="text-white font-medium">{mode === "classic" ? "Classic Flip" : mode === "formula" ? "Formula Revision" : mode === "weak" ? "Weak Cards" : "Exam Cram"}</span>
              {" · "}Reviewed {reviewedCount}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(to right, ${info.color}, #14b8a6)` }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setVideoOn((v) => !v)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors" title={videoOn ? "Turn video off" : "Turn video on"}>
            {videoOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </button>
          <button onClick={onExit} className="p-2 rounded-lg bg-rose-500/80 hover:bg-rose-500 text-white transition-colors" title="Exit (Esc)">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Card */}
      <div className="relative z-10 h-full min-h-0 flex flex-col items-center justify-start sm:justify-center overflow-y-auto px-4 pb-4 pt-20">
        <div className="w-full max-w-2xl" style={{ perspective: "1800px" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22 }}
              className="relative h-[clamp(17rem,calc(100dvh-14rem),28rem)] cursor-pointer"
              style={{ transformStyle: "preserve-3d" }}
              onClick={() => setFlipped((f) => !f)}
            >
              <motion.div
                className="absolute inset-0"
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformStyle: "preserve-3d" }}
              >
                {/* FRONT */}
                <div className="absolute inset-0 rounded-3xl flex flex-col p-6 sm:p-8" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", background: "rgba(20, 20, 30, 0.55)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", border: `1px solid ${info.color}40`, boxShadow: `0 25px 60px -12px ${info.color}30` }}>
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <Badge className="text-[10px] border" style={{ background: `${info.color}25`, color: info.color, borderColor: `${info.color}40` }}>{info.icon} {info.name}</Badge>
                    <Badge variant="outline" className="text-[10px] border-white/20 text-white/70">{card.chapter}</Badge>
                    <Badge variant="outline" className="text-[10px] border-white/20 text-white/60">{card.topic}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <Badge variant="outline" className="text-[10px]" style={{ borderColor: dInfo.color, color: dInfo.color }}>{dInfo.label}</Badge>
                    <Badge variant="outline" className="text-[10px]" style={{ borderColor: tInfo.color, color: tInfo.color }}>{tInfo.label}</Badge>
                    {card.examImportance === "high" && (
                      <Badge variant="outline" className="text-[10px] border-rose-400/60 text-rose-300"><Flame className="h-3 w-3 mr-1" /> High importance</Badge>
                    )}
                    {review && <Badge variant="outline" className="text-[10px] border-white/20 text-white/50 ml-auto">Box {review.box}</Badge>}
                  </div>
                  <div className="min-h-0 flex-1 flex flex-col items-center justify-center overflow-y-auto text-center">
                    <ScholarAIContent
                      content={card.front}
                      mode="compact"
                      className="text-lg font-medium leading-snug text-white sm:text-2xl"
                    />
                  </div>
                  <div className="mt-4 text-center text-xs text-white/50 flex items-center justify-center gap-2">
                    <Keyboard className="h-3 w-3" /> Click or press Space to flip
                  </div>
                </div>

                {/* BACK */}
                <div className="absolute inset-0 rounded-3xl flex flex-col p-5 sm:p-7 overflow-hidden" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)", background: `linear-gradient(135deg, ${info.color}25, rgba(20,20,30,0.7))`, backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", border: `1px solid ${info.color}60`, boxShadow: `0 25px 60px -12px ${info.color}40` }}>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <Badge variant="outline" className="text-[10px] border-white/20 text-white/70"><Check className="h-3 w-3 mr-1" /> Answer</Badge>
                    <button onClick={(e) => { e.stopPropagation(); onToggleBookmark(card.id); }} className="ml-auto p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white" aria-label="Bookmark card">
                      {isBookmarked ? <BookmarkCheck className="h-4 w-4 text-amber-300" /> : <Bookmark className="h-4 w-4" />}
                    </button>
                  </div>
                  <div
                    className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2 [scrollbar-gutter:stable]"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <ScholarAIContent
                      content={card.back}
                      mode="compact"
                      className="text-base font-medium leading-relaxed text-white sm:text-lg"
                    />
                    {card.explanation && (
                      <div className="mt-4 p-3 rounded-xl bg-black/30 border border-white/10">
                        <p className="text-[10px] uppercase tracking-wide text-white/40 mb-1">Explanation</p>
                        <ScholarAIContent content={card.explanation} mode="compact" className="text-sm text-white/80" />
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-center text-[11px] text-white/50">Rate your recall — press 1/2/3/4 or click below</p>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Rating buttons */}
        <div className="mt-3 sm:mt-5 w-full max-w-2xl shrink-0">
          <AnimatePresence mode="wait">
            {flipped && !finished ? (
              <motion.div key="ratings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {RATINGS.map((r) => (
                  <button key={r.key} onClick={(e) => { e.stopPropagation(); rateAndAdvance(r.key); }} className="group flex flex-col items-center gap-0.5 py-2 sm:py-3 px-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/15 transition-all hover:-translate-y-0.5" style={{ boxShadow: `inset 0 -3px 0 0 ${r.color}` }}>
                    <span className="text-sm font-semibold" style={{ color: r.color }}>{r.label}</span>
                    <span className="text-[10px] text-white/60">{r.desc}</span>
                    <kbd className="mt-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-white/70">{r.hint}</kbd>
                  </button>
                ))}
              </motion.div>
            ) : finished ? (
              <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-6">
                <Trophy className="h-10 w-10 text-amber-300 mx-auto mb-2" />
                <p className="text-white font-medium">All done! 🎉</p>
              </motion.div>
            ) : (
              <motion.div key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-sm text-white/60">
                Reveal the answer to rate your recall.
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom hint bar */}
        <div className="absolute bottom-4 left-0 right-0 z-20 flex items-center justify-center gap-3 text-[11px] text-white/50">
          <span className="hidden sm:inline"><kbd className="font-mono px-1.5 py-0.5 rounded bg-white/10">Space</kbd> flip</span>
          <span className="hidden sm:inline"><kbd className="font-mono px-1.5 py-0.5 rounded bg-white/10">1-4</kbd> rate</span>
          <span className="hidden sm:inline"><kbd className="font-mono px-1.5 py-0.5 rounded bg-white/10">B</kbd> bookmark</span>
          <span><kbd className="font-mono px-1.5 py-0.5 rounded bg-white/10">Esc</kbd> exit</span>
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(content, document.body);
  }
  return content;
}
