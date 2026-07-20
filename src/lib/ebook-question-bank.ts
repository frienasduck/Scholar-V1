export type EbookQuestion = {
  id: string;
  bookId: string;
  subject: string;
  chapterId: string;
  chapterTitle: string;
  sourcePage: number;
  section: string;
  questionType: string;
  prompt: string;
  options?: string[];
  correctOption?: number | null;
  answerExplanation?: string;
  difficulty?: string;
};

export const EBOOK_QUESTION_BOOKS = [
  {
    id: "class11-maths-part1",
    title: "Mathematics Part 1",
    subject: "Mathematics",
    url: "/content/ebooks/class11-maths-part1/book-v1.json",
    chapters: [
      { id: "sets", title: "Sets" },
      { id: "relations-and-functions", title: "Relations and Functions" },
    ],
  },
  {
    id: "class11-chemistry-part1",
    title: "Chemistry Part 1",
    subject: "Chemistry",
    url: "/content/ebooks/class11-chemistry-part1/book-v1.json",
    chapters: [
      { id: "some-basic-concepts-of-chemistry", title: "Some Basic Concepts of Chemistry" },
      { id: "structure-of-atom", title: "Structure of Atom" },
    ],
  },
] as const;

const cache = new Map<string, EbookQuestion[]>();

export async function loadEbookQuestions(bookIds?: string[]): Promise<EbookQuestion[]> {
  const books = EBOOK_QUESTION_BOOKS.filter((book) => !bookIds?.length || bookIds.includes(book.id));
  const banks = await Promise.all(books.map(async (book) => {
    if (cache.has(book.id)) return cache.get(book.id)!;
    const response = await fetch(book.url);
    if (!response.ok) throw new Error(`Could not load ${book.title} questions.`);
    const data = await response.json() as { questions?: EbookQuestion[] };
    const questions = Array.isArray(data.questions) ? data.questions : [];
    cache.set(book.id, questions);
    return questions;
  }));
  return banks.flat();
}

export function splitPrintedAnswer(prompt: string) {
  const match = /\s+Answer\s*:\s*/i.exec(prompt);
  if (!match || match.index < 1) return { question: prompt.trim(), answer: "" };
  return {
    question: prompt.slice(0, match.index).trim(),
    answer: prompt.slice(match.index + match[0].length).trim(),
  };
}

export function toEbookQuizQuestion(question: EbookQuestion) {
  const options = question.options ?? [];
  const correctIndex = typeof question.correctOption === "number" ? question.correctOption : -1;
  return {
    id: `ebook-${question.id}`,
    type: "mcq",
    question: question.prompt,
    options,
    answer: options[correctIndex] ?? "",
    explanation: question.answerExplanation || `Printed in ${question.chapterTitle}, page ${question.sourcePage}.`,
    subject: question.subject === "Mathematics" ? "maths" : "chemistry",
    chapter: question.chapterId,
    chapterTitle: question.chapterTitle,
    difficulty: question.difficulty ?? "medium",
    topic: question.chapterTitle,
    source: "ebook",
    sourcePage: question.sourcePage,
  };
}
