// Quiz question loader for Class 11.
// Uses STATIC imports (not dynamic) so the question data is bundled into the
// main JS chunk and doesn't require a separate server request to load.
// This fixes the "0 questions loaded" bug that occurred when the dev server
// died during dynamic import().

import type { QuizMCQ } from "./quizzes-physics";
import { PHYSICS_QUIZZES } from "./quizzes-physics";
import { CHEMISTRY_QUIZZES } from "./quizzes-chemistry";
import { MATHS_QUIZZES } from "./quizzes-maths";
import { CS_QUIZZES } from "./quizzes-cs";

export type { QuizMCQ };

// Pre-built lookup — no async, no dynamic import, no server dependency.
const QUIZ_BANK: Record<string, QuizMCQ[]> = {
  physics: PHYSICS_QUIZZES,
  chemistry: CHEMISTRY_QUIZZES,
  maths: MATHS_QUIZZES,
  cs: CS_QUIZZES,
};

export function loadSubjectQuizzes(subjectId: string): QuizMCQ[] {
  const quizzes = QUIZ_BANK[subjectId] ?? [];
  if (quizzes.length === 0) {
    console.warn(`[Quiz Loader] No questions found for subject "${subjectId}"`);
  }
  return quizzes;
}

// Async wrapper for backward compatibility (returns immediately)
export async function loadSubjectQuizzesAsync(subjectId: string): Promise<QuizMCQ[]> {
  return loadSubjectQuizzes(subjectId);
}

export function clearQuizCache(): void {
  // No-op — data is statically bundled
}
