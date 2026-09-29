import { navigateTo } from "@/lib/nav-event";

export type ChapterDestination = "study" | "practice" | "mock-exam";
export type ChapterPracticeFilter = "all" | "mcq" | "subjective";

export interface ChapterNavigationTarget {
  view: ChapterDestination;
  scholarClass: 9 | 11;
  subjectId: string;
  chapterId: string;
  filter?: ChapterPracticeFilter;
  createdAt: number;
}

const TARGET_KEY = "scholar:chapter-command:target";
const TARGET_TTL_MS = 60_000;

export function openChapterDestination(target: Omit<ChapterNavigationTarget, "createdAt">) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(TARGET_KEY, JSON.stringify({ ...target, createdAt: Date.now() }));
  } catch { /* The destination can still open without session storage. */ }
  navigateTo(target.view);
}

export function takeChapterDestination(view: ChapterDestination, scholarClass: 9 | 11): ChapterNavigationTarget | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(TARGET_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(TARGET_KEY);
    const target = JSON.parse(raw) as Partial<ChapterNavigationTarget>;
    if (target.view !== view || target.scholarClass !== scholarClass ||
      typeof target.subjectId !== "string" || typeof target.chapterId !== "string" ||
      typeof target.createdAt !== "number" || Date.now() - target.createdAt > TARGET_TTL_MS) return null;
    return target as ChapterNavigationTarget;
  } catch { return null; }
}

export function practiceChapterId(subjectId: string, chapterId: string): string | null {
  if (subjectId === "physics") return ({ p2: "ch1", p3: "ch2", p4: "ch3" } as Record<string, string>)[chapterId] ?? null;
  if (subjectId === "maths" && (chapterId === "m1" || chapterId === "m2")) return chapterId;
  return null;
}
