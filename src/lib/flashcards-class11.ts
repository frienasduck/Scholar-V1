// Class 11 Flashcard Index — combines all subject flashcard data
import { PHYSICS_FLASHCARDS, type Class11Flashcard } from "./flashcards-physics";
import { CHEMISTRY_FLASHCARDS } from "./flashcards-chemistry";
import { MATHS_FLASHCARDS } from "./flashcards-maths";
import { CS_FLASHCARDS } from "./flashcards-cs";

export type { Class11Flashcard };

export const ALL_CLASS11_FLASHCARDS: Class11Flashcard[] = [
  ...PHYSICS_FLASHCARDS,
  ...CHEMISTRY_FLASHCARDS,
  ...MATHS_FLASHCARDS,
  ...CS_FLASHCARDS,
];

export function getClass11FlashcardsBySubject(subject: string): Class11Flashcard[] {
  return ALL_CLASS11_FLASHCARDS.filter((c) => c.subject === subject);
}

export function getClass11FlashcardsByChapter(chapterId: string): Class11Flashcard[] {
  return ALL_CLASS11_FLASHCARDS.filter((c) => c.chapterId === chapterId);
}

export function getClass11FlashcardsBySubjectAndChapter(subject: string, chapterId: string): Class11Flashcard[] {
  return ALL_CLASS11_FLASHCARDS.filter((c) => c.subject === subject && c.chapterId === chapterId);
}

export const CLASS11_FLASHCARD_COUNTS = {
  total: ALL_CLASS11_FLASHCARDS.length,
  bySubject: {
    physics: PHYSICS_FLASHCARDS.length,
    chemistry: CHEMISTRY_FLASHCARDS.length,
    maths: MATHS_FLASHCARDS.length,
    cs: CS_FLASHCARDS.length,
  },
  byChapter: ALL_CLASS11_FLASHCARDS.reduce((acc, c) => {
    acc[c.chapterId] = (acc[c.chapterId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>),
};

export default ALL_CLASS11_FLASHCARDS;
