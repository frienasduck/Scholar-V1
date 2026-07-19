// Lazy loader for Class 11 flashcards — only loads the selected subject's data.
// This prevents importing all 525 cards at once.

import type { Class11Flashcard } from "./flashcards-physics";

export type { Class11Flashcard };

// Cache loaded subjects to avoid re-fetching
const cache = new Map<string, Class11Flashcard[]>();

/**
 * Load flashcards for a single subject lazily.
 * Returns a cached array if already loaded.
 */
export async function loadSubjectFlashcards(subjectId: string): Promise<Class11Flashcard[]> {
  if (cache.has(subjectId)) {
    return cache.get(subjectId)!;
  }

  let cards: Class11Flashcard[] = [];
  try {
    if (subjectId === "physics") {
      const mod = await import("./flashcards-physics");
      cards = mod.PHYSICS_FLASHCARDS;
    } else if (subjectId === "chemistry") {
      const mod = await import("./flashcards-chemistry");
      cards = mod.CHEMISTRY_FLASHCARDS;
    } else if (subjectId === "maths") {
      const mod = await import("./flashcards-maths");
      cards = mod.MATHS_FLASHCARDS;
    } else if (subjectId === "cs") {
      const mod = await import("./flashcards-cs");
      cards = mod.CS_FLASHCARDS;
    }
  } catch (e) {
    console.error(`Failed to load flashcards for ${subjectId}:`, e);
    cards = [];
  }

  cache.set(subjectId, cards);
  return cards;
}

/**
 * Load flashcards for multiple subjects (used when "all subjects" is selected).
 */
export async function loadMultipleSubjects(subjectIds: string[]): Promise<Class11Flashcard[]> {
  const results = await Promise.all(subjectIds.map((s) => loadSubjectFlashcards(s)));
  return results.flat();
}

/**
 * Clear the cache (useful if data changes).
 */
export function clearFlashcardCache(): void {
  cache.clear();
}
