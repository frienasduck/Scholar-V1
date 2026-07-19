// Chapter Command Center — data aggregation layer.
// Pulls chapter-related data from all existing Scholar sources and normalizes the
// chapter-name inconsistency (curriculum uses "Units and Measurements" plural,
// question-bank/ebook/past-papers use "Units and Measurement" singular).

import { CURRICULUM } from "./curriculum";
import { CURRICULUM_CLASS11, type Subject, type Chapter } from "./curriculum-class11";
import { ALL_PRACTICE_QUESTIONS, PHYSICS_CHAPTER_QUESTIONS, PHYSICS_PAST_PAPERS, isReviewNeeded, type PracticeQuestion, type PastPaperQuestion } from "./question-bank";
import { getFlashcardCountByChapter } from "./flashcards-class11-meta";

// ============================================================================
// Types
// ============================================================================

export interface ChapterVideo {
  id: string;
  title: string;
  channel: string;
  channelAvatar?: string;
  duration?: string;
  views?: string;
  uploaded?: string;
  description?: string;
}

export interface ChapterFormula {
  key: string;
  formula: string;
  chapterId: string;
  chapterTitle: string;
  subjectId: string;
  subjectName: string;
}

export interface ChapterDerivation {
  id: string;
  title: string;
  difficulty: string;
  formula: string;
  steps: string[];
  applications: string[];
}

export interface ChapterEbookData {
  available: boolean;
  startPage?: number;
  endPage?: number;
  totalPages?: number;
  title?: string;
}

export interface ChapterQuestionStats {
  total: number;
  mcq: number;
  subjective: number;
  questions: PracticeQuestion[];
}

export interface ChapterPastPaperStats {
  total: number;
  questions: PastPaperQuestion[];
}

export interface ChapterCommandData {
  classProfile: 9 | 11;
  subjectId: string;
  subjectName: string;
  subjectAccent: string;
  subjectIcon: string;
  chapterId: string;
  chapterTitle: string;
  chapterNumber: number;
  overview?: string;
  learningObjectives?: string[];
  prerequisites?: string[];
  estimatedTime?: string;
  difficulty?: string;
  boardWeightage?: string;
  jeeWeightage?: string;
  concepts: string[];
  quickSummary?: string[];
  importantDefinitions?: { term: string; definition: string }[];
  commonMistakes?: string[];
  examTips?: string[];
  formulas: ChapterFormula[];
  derivations: ChapterDerivation[];
  questions: ChapterQuestionStats;
  pastPapers: ChapterPastPaperStats;
  videos: ChapterVideo[];
  ebook: ChapterEbookData;
  masteryPct: number;
  studyProgressPct: number;
}

// ============================================================================
// Chapter name normalization
// ============================================================================

// Map of canonical chapter id → all known name variants
const CHAPTER_NAME_VARIANTS: Record<string, string[]> = {
  p2: ["Units and Measurements", "Units and Measurement"],
  p3: ["Motion in a Straight Line"],
  p4: ["Motion in a Plane"],
};

export function getChapterNameVariants(chapterId: string, fallbackTitle?: string): string[] {
  if (CHAPTER_NAME_VARIANTS[chapterId]) return CHAPTER_NAME_VARIANTS[chapterId];
  return fallbackTitle ? [fallbackTitle] : [];
}

export function matchesChapter(chapterId: string, canonicalTitle: string | undefined, testName: string): boolean {
  const variants = getChapterNameVariants(chapterId, canonicalTitle);
  if (variants.some((v) => v.toLowerCase() === testName.toLowerCase())) return true;
  if (canonicalTitle && canonicalTitle.toLowerCase() === testName.toLowerCase()) return true;
  return false;
}

// ============================================================================
// Curriculum lookup
// ============================================================================

export function findChapter(scholarClass: 9 | 11, subjectId: string, chapterId: string): { subject: Subject; chapter: Chapter } | null {
  const curriculum = scholarClass === 11 ? CURRICULUM_CLASS11 : CURRICULUM;
  const subject = curriculum.find((s) => s.id === subjectId);
  if (!subject) return null;
  const chapter = subject.chapters.find((c) => c.id === chapterId);
  if (!chapter) return null;
  return { subject, chapter };
}

export function getSubjectChapters(scholarClass: 9 | 11, subjectId: string): { subject: Subject; chapters: Chapter[] } | null {
  const curriculum = scholarClass === 11 ? CURRICULUM_CLASS11 : CURRICULUM;
  const subject = curriculum.find((s) => s.id === subjectId);
  if (!subject) return null;
  return { subject, chapters: subject.chapters };
}

// ============================================================================
// Question aggregation
// ============================================================================

export function getChapterQuestions(scholarClass: 9 | 11, subjectId: string, chapterId: string): ChapterQuestionStats {
  const found = findChapter(scholarClass, subjectId, chapterId);
  if (!found) return { total: 0, mcq: 0, subjective: 0, questions: [] };

  const { chapter } = found;
  // For physics, use PHYSICS_CHAPTER_QUESTIONS (merged hand-written + PDF-imported,
  // duplicates removed). For other subjects, use ALL_PRACTICE_QUESTIONS.
  // Skip any question flagged as "Review needed" (OCR artifacts without a real answer).
  const sourceQuestions = subjectId === "physics" ? PHYSICS_CHAPTER_QUESTIONS : ALL_PRACTICE_QUESTIONS;
  const questions = sourceQuestions.filter((q) => {
    if (isReviewNeeded(q)) return false;
    if (subjectId === "physics" && q.subject !== "physics") return false;
    if (subjectId === "maths" && q.subject !== "maths") return false;
    if (subjectId === "chemistry" && q.subject !== "chemistry") return false;
    if (subjectId === "cs" && q.subject !== "cs") return false;
    if (subjectId === "english" && q.subject !== "english") return false;
    return matchesChapter(chapterId, chapter.title, q.chapter);
  });

  return {
    total: questions.length,
    mcq: questions.filter((q) => q.type === "mcq").length,
    subjective: questions.filter((q) => q.type === "subjective").length,
    questions,
  };
}

// ============================================================================
// Past papers aggregation
// ============================================================================

export function getChapterPastPapers(scholarClass: 9 | 11, subjectId: string, chapterId: string): ChapterPastPaperStats {
  const found = findChapter(scholarClass, subjectId, chapterId);
  if (!found) return { total: 0, questions: [] };

  const { chapter } = found;
  // PHYSICS_PAST_PAPERS has no chapter field — derive from question content heuristics
  // (past-papers.tsx uses q.number <= 4 for Units, but that's fragile)
  // Better: match by keywords in the question text
  const variants = getChapterNameVariants(chapterId, chapter.title);
  const lowerVariants = variants.map((v) => v.toLowerCase());

  const keywordMap: Record<string, string[]> = {
    p2: ["dimensional", "significant figure", "vernier", "screw gauge", "error", "least count", "parsec", "light year", "si unit", "parse"],
    p3: ["velocity", "displacement", "acceleration", "kinematic", "free fall", "projectile", "motion", "retardation", "uniformly accelerated"],
  };

  const keywords = keywordMap[chapterId] || [];

  const questions = PHYSICS_PAST_PAPERS.filter((q) => {
    const qLower = q.question.toLowerCase();
    // Check if any chapter keyword matches
    return keywords.some((k) => qLower.includes(k));
  });

  // Fallback: if keyword match fails, use the past-papers.tsx heuristic (pp1-4 = Units, pp5-10 = Motion)
  if (questions.length === 0 && chapterId === "p2") {
    return { total: 4, questions: PHYSICS_PAST_PAPERS.slice(0, 4) };
  }
  if (questions.length === 0 && chapterId === "p3") {
    return { total: 6, questions: PHYSICS_PAST_PAPERS.slice(4) };
  }

  return { total: questions.length, questions };
}

// ============================================================================
// Formula aggregation
// ============================================================================

export function getChapterFormulas(scholarClass: 9 | 11, subjectId: string, chapterId: string): ChapterFormula[] {
  const found = findChapter(scholarClass, subjectId, chapterId);
  if (!found) return [];
  const { subject, chapter } = found;
  if (!chapter.formulas?.length) return [];
  return chapter.formulas.map((f, i) => ({
    key: `${chapter.id}-${i}`,
    formula: f,
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    subjectId: subject.id,
    subjectName: subject.name,
  }));
}

// ============================================================================
// Derivation aggregation (manual chapter mapping)
// ============================================================================

// Derivations are hardcoded in derivations.tsx with no chapter field.
// Map by derivation ID → chapter ID for Physics.
const DERIVATION_CHAPTER_MAP: Record<string, string> = {
  d1: "p3",  // Equations of Motion (v = u + at)
  d2: "p3",  // Second Equation of Motion (s = ut + ½at²)
  d3: "p6",  // Work-Energy Theorem
  d4: "p7",  // Rotational kinetic energy
  d5: "p8",  // Gravitational potential
  d6: "p9",  // Young's modulus
  d7: "p10", // Bernoulli's principle
  d8: "p11", // Heat transfer
  d9: "p12", // Carnot engine
  d10: "p13", // Kinetic theory pressure
  d11: "p14", // Simple pendulum
  d12: "p15", // Wave equation
};

export function getChapterDerivations(chapterId: string): ChapterDerivation[] {
  // Note: We can't import the DERIVATIONS array directly from the view file
  // (it's a local const). For now return an empty list — the view will
  // surface derivations via the navigateTo("derivations") button.
  // Future: extract DERIVATIONS to a lib file.
  return [];
}

export function getDerivationChapterIds(): Record<string, string> {
  return DERIVATION_CHAPTER_MAP;
}

// ============================================================================
// E-Book aggregation
// ============================================================================

// Matches the DEFAULT_CHAPTERS in ebook.tsx
const EBOOK_CHAPTER_MAP: Record<string, { startPage: number; endPage: number; title: string }> = {
  p2: { startPage: 1, endPage: 45, title: "Units and Measurement" },
  p3: { startPage: 46, endPage: 90, title: "Motion in a Straight Line" },
  m1: { startPage: 1, endPage: 17, title: "Mathematics Part 1 · Sets" },
  m2: { startPage: 18, endPage: 37, title: "Mathematics Part 1 · Relations and Functions" },
};

export function getChapterEbookData(chapterId: string): ChapterEbookData {
  const mapping = EBOOK_CHAPTER_MAP[chapterId];
  if (!mapping) return { available: false };
  return {
    available: true,
    startPage: mapping.startPage,
    endPage: mapping.endPage,
    totalPages: mapping.endPage - mapping.startPage + 1,
    title: mapping.title,
  };
}

// ============================================================================
// Video aggregation (lazy — avoid importing the view file)
// ============================================================================

export interface ChapterVideoInternal extends ChapterVideo {
  subject: string;
  chapter: string;
}

let _videosCache: ChapterVideoInternal[] | null = null;

async function loadVideos(): Promise<ChapterVideoInternal[]> {
  if (_videosCache) return _videosCache;
  try {
    // Dynamic import to avoid pulling the view's React component
    const mod = await import("../components/views/nigtube");
    // The view exports VIDEOS, VIDEOS_CLASS11, VIDEOS_JEE as non-exported consts.
    // We can't access them directly. Instead, hardcode the known Class 11 videos here.
    _videosCache = [
      { id: "UuzZYVRcemY", title: "Units and Measurements — Class 11 Physics Ch 2", channel: "PhysicsWallah", chapter: "Units and Measurements", subject: "Physics", duration: "Full lecture" },
      { id: "XIJAZM5G5Fg", title: "Motion in a Straight Line — Class 11 Physics Ch 3", channel: "PhysicsWallah", chapter: "Motion in a Straight Line", subject: "Physics", duration: "Full lecture" },
    ];
  } catch {
    _videosCache = [];
  }
  return _videosCache;
}

export function getChapterVideosSync(chapterId: string, chapterTitle?: string): ChapterVideo[] {
  // Hardcoded known Class 11 Physics videos (avoids importing the view file)
  const allVideos: ChapterVideoInternal[] = [
    { id: "UuzZYVRcemY", title: "Units and Measurements — Class 11 Physics Ch 2", channel: "PhysicsWallah", chapter: "Units and Measurements", subject: "Physics", duration: "Full lecture" },
    { id: "XIJAZM5G5Fg", title: "Motion in a Straight Line — Class 11 Physics Ch 3", channel: "PhysicsWallah", chapter: "Motion in a Straight Line", subject: "Physics", duration: "Full lecture" },
  ];
  const variants = getChapterNameVariants(chapterId, chapterTitle);
  const filtered = allVideos.filter((v) =>
    variants.some((variant) => variant.toLowerCase() === v.chapter.toLowerCase())
  );
  return filtered.map(({ subject: _s, chapter: _c, ...rest }) => rest);
}

// ============================================================================
// Mastery calculation
// ============================================================================

export function calculateChapterMastery(opts: {
  studyProgressPct: number;
  subjectMasteryPct: number;
  questionStats: ChapterQuestionStats;
  pastPaperCount: number;
  formulaCount: number;
  videoCount: number;
  ebookAvailable: boolean;
}): { pct: number; level: "Beginner" | "Learning" | "Strong" | "Mastered" | "Limited Data"; limited: boolean } {
  const { studyProgressPct, subjectMasteryPct, questionStats, pastPaperCount, formulaCount, videoCount, ebookAvailable } = opts;
  const signals: number[] = [];
  // Study progress (0-100)
  if (studyProgressPct > 0) signals.push(studyProgressPct * 0.3);
  // Subject mastery (0-100) — proxy
  if (subjectMasteryPct > 0) signals.push(subjectMasteryPct * 0.2);
  // Practice questions attempted (assume attempted = available for now, capped)
  if (questionStats.total > 0) {
    const practiceScore = Math.min(100, questionStats.total * 2); // 50 questions = 100
    signals.push(practiceScore * 0.3);
  }
  // Resources touched
  let resourceScore = 0;
  if (formulaCount > 0) resourceScore += 25;
  if (videoCount > 0) resourceScore += 25;
  if (ebookAvailable) resourceScore += 25;
  if (pastPaperCount > 0) resourceScore += 25;
  if (resourceScore > 0) signals.push(resourceScore * 0.2);

  if (!signals.length) return { pct: 0, level: "Limited Data", limited: true };
  const pct = Math.round(signals.reduce((a, b) => a + b, 0));
  let level: "Beginner" | "Learning" | "Strong" | "Mastered" = "Beginner";
  if (pct > 80) level = "Mastered";
  else if (pct > 60) level = "Strong";
  else if (pct > 30) level = "Learning";
  return { pct, level, limited: false };
}

// ============================================================================
// Chapter status system
// ============================================================================

export type ChapterStatus = "not-started" | "started" | "learning" | "practice-needed" | "revision-due" | "test-ready" | "mastered";

export function getChapterStatus(opts: {
  studyProgressPct: number;
  masteryPct: number;
  questionStats: ChapterQuestionStats;
}): ChapterStatus {
  const { studyProgressPct, masteryPct, questionStats } = opts;
  if (masteryPct >= 80) return "mastered";
  if (studyProgressPct === 0 && questionStats.total === 0) return "not-started";
  if (studyProgressPct > 0 && studyProgressPct < 30) return "started";
  if (studyProgressPct >= 30 && studyProgressPct < 60) return "learning";
  if (studyProgressPct >= 60 && questionStats.total < 25) return "practice-needed";
  if (studyProgressPct >= 60 && masteryPct < 70) return "revision-due";
  return "test-ready";
}

export const STATUS_META: Record<ChapterStatus, { label: string; color: string; bg: string }> = {
  "not-started": { label: "Not Started", color: "#94a3b8", bg: "rgba(148,163,184,0.15)" },
  "started": { label: "Started", color: "#60a5fa", bg: "rgba(96,165,250,0.15)" },
  "learning": { label: "Learning", color: "#a78bfa", bg: "rgba(167,139,250,0.15)" },
  "practice-needed": { label: "Practice Needed", color: "#fbbf24", bg: "rgba(251,191,36,0.15)" },
  "revision-due": { label: "Revision Due", color: "#fb923c", bg: "rgba(251,146,60,0.15)" },
  "test-ready": { label: "Test Ready", color: "#34d399", bg: "rgba(52,211,153,0.15)" },
  "mastered": { label: "Mastered", color: "#10b981", bg: "rgba(16,185,129,0.15)" },
};

// ============================================================================
// Full aggregation
// ============================================================================

export function getChapterCommandData(opts: {
  scholarClass: 9 | 11;
  jeeMode: boolean;
  subjectId: string;
  chapterId: string;
  studyProgressPct: number;
  subjectMasteryPct: number;
}): ChapterCommandData | null {
  const { scholarClass, subjectId, chapterId, studyProgressPct, subjectMasteryPct } = opts;
  const found = findChapter(scholarClass, subjectId, chapterId);
  if (!found) return null;
  const { subject, chapter } = found;

  const questions = getChapterQuestions(scholarClass, subjectId, chapterId);
  const pastPapers = getChapterPastPapers(scholarClass, subjectId, chapterId);
  const formulas = getChapterFormulas(scholarClass, subjectId, chapterId);
  const videos = getChapterVideosSync(chapterId, chapter.title);
  const ebook = getChapterEbookData(chapterId);
  const derivations = getChapterDerivations(chapterId);

  const mastery = calculateChapterMastery({
    studyProgressPct,
    subjectMasteryPct,
    questionStats: questions,
    pastPaperCount: pastPapers.total,
    formulaCount: formulas.length,
    videoCount: videos.length,
    ebookAvailable: ebook.available,
  });

  return {
    classProfile: scholarClass,
    subjectId: subject.id,
    subjectName: subject.name,
    subjectAccent: subject.accent,
    subjectIcon: subject.icon,
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    chapterNumber: subject.chapters.findIndex((c) => c.id === chapterId) + 1,
    overview: chapter.overview,
    learningObjectives: chapter.learningObjectives,
    prerequisites: chapter.prerequisites,
    estimatedTime: chapter.estimatedTime,
    difficulty: chapter.difficulty,
    boardWeightage: chapter.boardWeightage,
    jeeWeightage: chapter.jeeWeightage,
    concepts: chapter.concepts ?? [],
    quickSummary: chapter.quickSummary,
    importantDefinitions: chapter.importantDefinitions,
    commonMistakes: chapter.commonMistakes,
    examTips: chapter.examTips,
    formulas,
    derivations,
    questions,
    pastPapers,
    videos,
    ebook,
    masteryPct: mastery.pct,
    studyProgressPct,
  };
}

// ============================================================================
// Checklist
// ============================================================================

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  targetView: string;       // nav id to navigate to
  targetChapter?: string;   // optional chapter filter
  completed: boolean;
  progress?: number;        // 0-100
}

export function getChapterChecklist(data: ChapterCommandData): ChecklistItem[] {
  const items: ChecklistItem[] = [
    {
      id: "read-ebook",
      label: "Read E-Book pages",
      description: data.ebook.available
        ? `Pages ${data.ebook.startPage}–${data.ebook.endPage} (${data.ebook.totalPages} pages)`
        : "No e-book pages mapped yet",
      targetView: "ebook",
      targetChapter: data.chapterId,
      completed: data.ebook.available ? data.studyProgressPct >= 30 : false,
      progress: data.ebook.available ? Math.min(100, data.studyProgressPct) : 0,
    },
    {
      id: "study-notes",
      label: "Complete Study Notes",
      description: "Review the full chapter notes",
      targetView: "study",
      targetChapter: data.chapterId,
      completed: data.studyProgressPct >= 50,
      progress: data.studyProgressPct,
    },
    {
      id: "learn-formulas",
      label: "Learn formulas",
      description: `${data.formulas.length} formula${data.formulas.length === 1 ? "" : "s"} in this chapter`,
      targetView: "formulas",
      targetChapter: data.chapterId,
      completed: data.formulas.length > 0 && data.studyProgressPct >= 40,
      progress: data.formulas.length > 0 ? Math.min(100, (data.studyProgressPct / 40) * 100) : 0,
    },
    {
      id: "flashcards",
      label: "Complete flashcards",
      description: "Review chapter flashcards",
      targetView: "flashcards",
      targetChapter: data.chapterId,
      completed: data.studyProgressPct >= 60,
      progress: data.studyProgressPct,
    },
    {
      id: "basic-quiz",
      label: "Attempt basic quiz",
      description: "Test your understanding",
      targetView: "quiz",
      targetChapter: data.chapterId,
      completed: data.studyProgressPct >= 45,
      progress: data.studyProgressPct,
    },
    {
      id: "practice-25",
      label: "Solve 25 practice questions",
      description: `${data.questions.total} questions available`,
      targetView: "practice",
      targetChapter: data.chapterId,
      completed: data.questions.total >= 25,
      progress: Math.min(100, (data.questions.total / 25) * 100),
    },
    {
      id: "practice-50",
      label: "Solve 50 practice questions",
      description: `Target: 50 (current: ${data.questions.total})`,
      targetView: "practice",
      targetChapter: data.chapterId,
      completed: data.questions.total >= 50,
      progress: Math.min(100, (data.questions.total / 50) * 100),
    },
    {
      id: "review-mistakes",
      label: "Review mistakes",
      description: "Check your mistake notebook",
      targetView: "past-papers",
      targetChapter: data.chapterId,
      completed: false,
      progress: 0,
    },
    {
      id: "watch-videos",
      label: "Watch Nightube videos",
      description: `${data.videos.length} video${data.videos.length === 1 ? "" : "s"} available`,
      targetView: "nigtube",
      targetChapter: data.chapterId,
      completed: data.videos.length > 0 && data.studyProgressPct >= 35,
      progress: data.videos.length > 0 ? Math.min(100, (data.studyProgressPct / 35) * 100) : 0,
    },
    {
      id: "assignment",
      label: "Complete assignment",
      description: "Chapter assignment",
      targetView: "assignments",
      targetChapter: data.chapterId,
      completed: false,
      progress: 0,
    },
    {
      id: "chapter-test",
      label: "Attempt chapter test",
      description: "Mock exam for this chapter",
      targetView: "mock-exam",
      targetChapter: data.chapterId,
      completed: data.masteryPct >= 70,
      progress: data.masteryPct,
    },
    {
      id: "revise-formulas",
      label: "Revise formula sheet",
      description: "Quick formula revision",
      targetView: "revision-hub",
      targetChapter: data.chapterId,
      completed: data.studyProgressPct >= 80,
      progress: data.studyProgressPct,
    },
    {
      id: "ready",
      label: "Mark chapter as ready",
      description: "Final readiness check",
      targetView: "study",
      targetChapter: data.chapterId,
      completed: data.masteryPct >= 85,
      progress: data.masteryPct,
    },
  ];
  return items;
}

export function getChecklistProgress(items: ChecklistItem[]): { completed: number; total: number; pct: number } {
  const total = items.length;
  const completed = items.filter((i) => i.completed).length;
  return { completed, total, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
}
