// Lightweight flashcard metadata — only counts, no card content.
// Used by Chapter Command Center and other places that just need counts.
// Do NOT import the full flashcard data files here.

export interface FlashcardCountMeta {
  subject: string;
  subjectId: string;
  chapterId: string;
  chapterTitle: string;
  count: number;
}

export const CLASS11_FLASHCARD_META: FlashcardCountMeta[] = [
  { subject: "Physics", subjectId: "physics", chapterId: "p2", chapterTitle: "Units and Measurements", count: 60 },
  { subject: "Physics", subjectId: "physics", chapterId: "p3", chapterTitle: "Motion in a Straight Line", count: 60 },
  { subject: "Chemistry", subjectId: "chemistry", chapterId: "c1", chapterTitle: "Some Basic Concepts of Chemistry", count: 40 },
  { subject: "Chemistry", subjectId: "chemistry", chapterId: "c2", chapterTitle: "Structure of Atom", count: 40 },
  { subject: "Chemistry", subjectId: "chemistry", chapterId: "c4", chapterTitle: "Chemical Bonding and Molecular Structure", count: 40 },
  { subject: "Mathematics", subjectId: "maths", chapterId: "m1", chapterTitle: "Sets", count: 35 },
  { subject: "Mathematics", subjectId: "maths", chapterId: "m2", chapterTitle: "Relations and Functions", count: 35 },
  { subject: "Mathematics", subjectId: "maths", chapterId: "m3", chapterTitle: "Trigonometric Functions", count: 40 },
  { subject: "Mathematics", subjectId: "maths", chapterId: "m13", chapterTitle: "Limits and Derivatives", count: 35 },
  { subject: "Computer Science", subjectId: "cs", chapterId: "cs2", chapterTitle: "Number System and Conversion", count: 30 },
  { subject: "Computer Science", subjectId: "cs", chapterId: "cs5", chapterTitle: "Introducing Python", count: 40 },
  { subject: "Computer Science", subjectId: "cs", chapterId: "cs6", chapterTitle: "Flow of Control", count: 30 },
  { subject: "Computer Science", subjectId: "cs", chapterId: "cs7", chapterTitle: "Data Handling", count: 40 },
];

export function getFlashcardCountByChapter(chapterId: string): number {
  return CLASS11_FLASHCARD_META.filter((m) => m.chapterId === chapterId).reduce((sum, m) => sum + m.count, 0);
}

export function getFlashcardCountBySubject(subjectId: string): number {
  return CLASS11_FLASHCARD_META.filter((m) => m.subjectId === subjectId).reduce((sum, m) => sum + m.count, 0);
}

export const TOTAL_CLASS11_FLASHCARDS = CLASS11_FLASHCARD_META.reduce((sum, m) => sum + m.count, 0);
