// Lightweight quiz metadata — only counts, no question data.
// Used by Chapter Command Center and other places that just need counts.

export interface QuizCountMeta {
  subject: string;
  subjectId: string;
  chapterId: string;
  chapterTitle: string;
  quizCount: number;
  questionCount: number;
}

export const CLASS11_QUIZ_META: QuizCountMeta[] = [
  { subject: "Physics", subjectId: "physics", chapterId: "p2", chapterTitle: "Units and Measurements", quizCount: 6, questionCount: 60 },
  { subject: "Physics", subjectId: "physics", chapterId: "p3", chapterTitle: "Motion in a Straight Line", quizCount: 6, questionCount: 60 },
  { subject: "Chemistry", subjectId: "chemistry", chapterId: "c1", chapterTitle: "Some Basic Concepts of Chemistry", quizCount: 4, questionCount: 40 },
  { subject: "Chemistry", subjectId: "chemistry", chapterId: "c2", chapterTitle: "Structure of Atom", quizCount: 4, questionCount: 40 },
  { subject: "Chemistry", subjectId: "chemistry", chapterId: "c4", chapterTitle: "Chemical Bonding and Molecular Structure", quizCount: 4, questionCount: 40 },
  { subject: "Mathematics", subjectId: "maths", chapterId: "m1", chapterTitle: "Sets", quizCount: 4, questionCount: 40 },
  { subject: "Mathematics", subjectId: "maths", chapterId: "m2", chapterTitle: "Relations and Functions", quizCount: 4, questionCount: 35 },
  { subject: "Mathematics", subjectId: "maths", chapterId: "m3", chapterTitle: "Trigonometric Functions", quizCount: 4, questionCount: 40 },
  { subject: "Mathematics", subjectId: "maths", chapterId: "m13", chapterTitle: "Limits and Derivatives", quizCount: 4, questionCount: 35 },
  { subject: "Computer Science", subjectId: "cs", chapterId: "cs2", chapterTitle: "Number System and Conversion", quizCount: 3, questionCount: 30 },
  { subject: "Computer Science", subjectId: "cs", chapterId: "cs5", chapterTitle: "Introducing Python", quizCount: 4, questionCount: 40 },
  { subject: "Computer Science", subjectId: "cs", chapterId: "cs6", chapterTitle: "Flow of Control", quizCount: 3, questionCount: 30 },
  { subject: "Computer Science", subjectId: "cs", chapterId: "cs7", chapterTitle: "Data Handling", quizCount: 4, questionCount: 40 },
];

export function getQuizCountByChapter(chapterId: string): number {
  return CLASS11_QUIZ_META.filter((m) => m.chapterId === chapterId).reduce((sum, m) => sum + m.questionCount, 0);
}

export function getQuizCountBySubject(subjectId: string): number {
  return CLASS11_QUIZ_META.filter((m) => m.subjectId === subjectId).reduce((sum, m) => sum + m.questionCount, 0);
}

export const TOTAL_CLASS11_QUIZ_QUESTIONS = CLASS11_QUIZ_META.reduce((sum, m) => sum + m.questionCount, 0);
