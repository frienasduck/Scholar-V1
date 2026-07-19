// Quiz constants, types, and helpers shared across quiz components.

import type { QuizMCQ } from "@/lib/quizzes-physics";

export type { QuizMCQ };

export const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260319_015952_e1deeb12-8fb7-4071-a42a-60779fc64ab6.mp4";

export const LS_VIDEO_KEY = "quiz-video-bg";

export const SUBJECT_INFO: Record<string, { name: string; color: string; icon: string }> = {
  physics: { name: "Physics", color: "#3b82f6", icon: "⚛️" },
  chemistry: { name: "Chemistry", color: "#10b981", icon: "🧪" },
  maths: { name: "Mathematics", color: "#6366f1", icon: "📐" },
  cs: { name: "Computer Science", color: "#a855f7", icon: "💻" },
};

export const SUBJECT_ORDER = ["physics", "chemistry", "maths", "cs"] as const;

export const TYPE_INFO: Record<string, { label: string; color: string }> = {
  concept: { label: "Concept", color: "#8b5cf6" },
  numerical: { label: "Numerical", color: "#06b6d4" },
  formula: { label: "Formula", color: "#f59e0b" },
  output: { label: "Output", color: "#14b8a6" },
  "true-false": { label: "True/False", color: "#84cc16" },
};

export const DIFFICULTY_INFO: Record<string, { label: string; color: string }> = {
  easy: { label: "Easy", color: "#10b981" },
  medium: { label: "Medium", color: "#f59e0b" },
  hard: { label: "Hard", color: "#ef4444" },
};

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

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

// Convert QuizMCQ to store-compatible QuizQuestion
export function toQuizQuestions(mcqs: QuizMCQ[]): any[] {
  return mcqs.map((m) => ({
    id: m.id,
    type: "mcq" as const,
    question: m.question,
    options: m.options,
    answer: m.correctAnswer,
    explanation: m.explanation,
    subject: m.subject,
    chapter: m.chapterId,
    difficulty: m.difficulty,
  }));
}
