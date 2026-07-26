import { profileGetJSON, profileSetJSON } from "@/lib/profile-storage";

export interface SavedQuizMistake {
  id: string;
  questionId: string;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  subject: string;
  chapter: string;
  difficulty: string;
  mistakeType: string;
  source: string;
  savedAt: number;
}

const STORAGE_KEY = "quiz-mistakes";
export const QUIZ_MISTAKES_UPDATED_EVENT = "scholar:quiz-mistakes-updated";

export function loadQuizMistakes(scholarClass: 9 | 11): SavedQuizMistake[] {
  if (typeof window === "undefined") return [];
  const stored = profileGetJSON<SavedQuizMistake[]>(scholarClass, STORAGE_KEY, []);
  return Array.isArray(stored) ? stored.filter(isSavedQuizMistake) : [];
}

export function saveQuizMistakes(
  scholarClass: 9 | 11,
  mistakes: SavedQuizMistake[],
): void {
  profileSetJSON(scholarClass, STORAGE_KEY, mistakes);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(QUIZ_MISTAKES_UPDATED_EVENT, {
      detail: { scholarClass, count: mistakes.length },
    }));
  }
}

export function removeQuizMistake(
  scholarClass: 9 | 11,
  mistakeId: string,
): SavedQuizMistake[] {
  const next = loadQuizMistakes(scholarClass).filter((mistake) => mistake.id !== mistakeId);
  saveQuizMistakes(scholarClass, next);
  return next;
}

function isSavedQuizMistake(value: unknown): value is SavedQuizMistake {
  if (!value || typeof value !== "object") return false;
  const mistake = value as Partial<SavedQuizMistake>;
  return (
    typeof mistake.id === "string"
    && typeof mistake.question === "string"
    && typeof mistake.correctAnswer === "string"
    && typeof mistake.savedAt === "number"
  );
}
