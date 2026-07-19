// Flashcard types, constants, and localStorage helpers.
// This file is lightweight — no flashcard data is imported here.

import type { Class11Flashcard } from "@/lib/flashcards-physics";
import { profileGetJSON, profileSetJSON } from "@/lib/profile-storage";

// ===== Constants =====

export const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260319_015952_e1deeb12-8fb7-4071-a42a-60779fc64ab6.mp4";

// Legacy keys kept for reference; access is now profile-scoped via helpers below.
export const LS_REVIEW_KEY = "fc-c11-review-state";
export const LS_BOOKMARKS_KEY = "fc-c11-bookmarks";
export const LS_VIDEO_KEY = "fc-video-bg";
export const LS_CUSTOM_KEY = "fc-custom-cards";

export const DECK_COLORS: Record<string, string> = {
  indigo: "#6366f1", teal: "#14b8a6", emerald: "#10b981", violet: "#8b5cf6",
  amber: "#f59e0b", rose: "#f43f5e", cyan: "#06b6d4", fuchsia: "#d946ef",
};

export const SUBJECT_INFO: Record<string, { name: string; color: string; icon: string; gradient: string }> = {
  physics: { name: "Physics", color: "#3b82f6", icon: "⚛️", gradient: "from-blue-500 to-cyan-500" },
  chemistry: { name: "Chemistry", color: "#10b981", icon: "🧪", gradient: "from-emerald-500 to-green-500" },
  maths: { name: "Mathematics", color: "#6366f1", icon: "📐", gradient: "from-indigo-500 to-violet-500" },
  cs: { name: "Computer Science", color: "#a855f7", icon: "💻", gradient: "from-purple-500 to-fuchsia-500" },
};

export const SUBJECT_ORDER = ["physics", "chemistry", "maths", "cs"] as const;

export const TYPE_INFO: Record<string, { label: string; color: string }> = {
  definition: { label: "Definition", color: "#3b82f6" },
  formula: { label: "Formula", color: "#f59e0b" },
  concept: { label: "Concept", color: "#8b5cf6" },
  mistake: { label: "Mistake", color: "#ef4444" },
  numerical: { label: "Numerical", color: "#06b6d4" },
  jee: { label: "JEE", color: "#d946ef" },
  "exam-tip": { label: "Exam Tip", color: "#10b981" },
  output: { label: "Output", color: "#14b8a6" },
  syntax: { label: "Syntax", color: "#6366f1" },
  law: { label: "Law", color: "#f43f5e" },
  difference: { label: "Difference", color: "#a855f7" },
  application: { label: "Application", color: "#0ea5e9" },
  unit: { label: "Unit", color: "#84cc16" },
};

export const DIFFICULTY_INFO: Record<string, { label: string; color: string }> = {
  easy: { label: "Easy", color: "#10b981" },
  medium: { label: "Medium", color: "#f59e0b" },
  hard: { label: "Hard", color: "#ef4444" },
};

export const RATINGS = [
  { key: "again" as const, label: "Again", color: "#ef4444", hint: "1", desc: "1 day", box: 1, intervalDays: 1 },
  { key: "hard" as const, label: "Hard", color: "#f59e0b", hint: "2", desc: "2 days", box: 2, intervalDays: 2 },
  { key: "good" as const, label: "Good", color: "#3b82f6", hint: "3", desc: "4 days", box: 3, intervalDays: 4 },
  { key: "easy" as const, label: "Easy", color: "#10b981", hint: "4", desc: "7 days", box: 4, intervalDays: 7 },
];

export type RevisionMode = "classic" | "formula" | "weak" | "exam";

export type CustomCard = Class11Flashcard & {
  custom: true;
  createdBy?: "ai" | "local-fallback" | "manual";
};

// ===== Review state =====

export type ReviewState = Record<
  string,
  { cardId: string; lastReviewed: number; box: number; rating: "again" | "hard" | "good" | "easy" }
>;

export function loadReviewState(scholarClass: 9 | 11): ReviewState {
  if (typeof window === "undefined") return {};
  return profileGetJSON<ReviewState>(scholarClass, LS_REVIEW_KEY, {});
}

export function saveReviewState(scholarClass: 9 | 11, state: ReviewState) {
  profileSetJSON(scholarClass, LS_REVIEW_KEY, state);
}

export function isC11CardDue(state: ReviewState, cardId: string): boolean {
  const r = state[cardId];
  if (!r) return true;
  const intervalMs = r.box * 86_400_000;
  return Date.now() - r.lastReviewed > intervalMs;
}

// ===== Bookmarks =====

export function loadBookmarks(scholarClass: 9 | 11): Set<string> {
  if (typeof window === "undefined") return new Set();
  const arr = profileGetJSON<string[]>(scholarClass, LS_BOOKMARKS_KEY, []);
  return new Set(arr);
}

export function saveBookmarks(scholarClass: 9 | 11, set: Set<string>) {
  profileSetJSON(scholarClass, LS_BOOKMARKS_KEY, [...set]);
}

// ===== Video preference =====

export function loadVideoPref(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(LS_VIDEO_KEY);
    return raw === null ? true : raw === "1";
  } catch { return true; }
}

export function saveVideoPref(on: boolean) {
  try { localStorage.setItem(LS_VIDEO_KEY, on ? "1" : "0"); } catch { /* ignore */ }
}

// ===== Custom cards (AI generated) =====

export function loadCustomCards(scholarClass: 9 | 11): CustomCard[] {
  if (typeof window === "undefined") return [];
  const arr = profileGetJSON<CustomCard[]>(scholarClass, LS_CUSTOM_KEY, []);
  return Array.isArray(arr) ? arr : [];
}

export function saveCustomCards(scholarClass: 9 | 11, cards: CustomCard[]) {
  profileSetJSON(scholarClass, LS_CUSTOM_KEY, cards);
}

// ===== AI-generated decks (named, playable) =====
export interface FlashcardDeck {
  id: string;
  profile: 9 | 11;
  name: string;
  subject: string;
  subjectName: string;
  chapterId: string;
  chapterTitle: string;
  difficulty: string;
  createdBy: "ai" | "local-fallback" | "user" | "system";
  createdAt: number;
  cardIds: string[];
}

const LS_DECKS_KEY = "fc-ai-decks";

export function loadDecks(scholarClass: 9 | 11): FlashcardDeck[] {
  if (typeof window === "undefined") return [];
  const arr = profileGetJSON<FlashcardDeck[]>(scholarClass, LS_DECKS_KEY, []);
  return Array.isArray(arr) ? arr : [];
}

export function saveDecks(scholarClass: 9 | 11, decks: FlashcardDeck[]) {
  profileSetJSON(scholarClass, LS_DECKS_KEY, decks);
}

export function upsertDeck(scholarClass: 9 | 11, deck: FlashcardDeck): FlashcardDeck[] {
  const all = loadDecks(scholarClass);
  const idx = all.findIndex((d) => d.id === deck.id);
  if (idx >= 0) all[idx] = deck; else all.unshift(deck);
  saveDecks(scholarClass, all);
  return all;
}

export function deleteDeck(scholarClass: 9 | 11, deckId: string): FlashcardDeck[] {
  const all = loadDecks(scholarClass).filter((d) => d.id !== deckId);
  saveDecks(scholarClass, all);
  return all;
}
