/**
 * Pure shared contracts & validation helpers for LAM AI "Learn with PDF".
 * Safe to import in both client components and server routes/tests.
 */

export const MAX_LAM_PDF_BYTES = 25 * 1024 * 1024; // 25 MB exact limit
export const LAM_PDF_CHUNK_BYTES = 2 * 1024 * 1024; // 2 MB chunks (safe on Vercel Serverless 4.5 MB limit)
export const MAX_LAM_PDF_PAGES = 250;
export const MAX_LAM_PDF_TEXT_CHARS = 3_000_000;

export const LAM_PDF_STAGES = [
  "uploading",
  "inspecting",
  "extracting",
  "ocr",
  "structuring",
  "analyzing",
  "indexing",
  "ready",
  "failed",
] as const;

export type LamPdfStage = (typeof LAM_PDF_STAGES)[number];

export type PageKind = "native" | "scanned" | "mixed" | "poor";

export interface PdfPageInfo {
  page: number;
  kind: PageKind;
  nativeChars: number;
  ocrChars: number;
  imageCount: number;
  ocrApplied: boolean;
  ocrConfidence: number | null;
  ocrError?: string;
  visionNote?: string;
}

export interface PdfChapterSection {
  title: string;
  startPage: number;
  endPage: number;
  summary?: string;
}

export interface StructuredPdfDocument {
  pageCount: number;
  pages: Array<{
    page: number;
    heading: string;
    text: string;
    paragraphs: string[];
    equations: string[];
    definitions: string[];
    examples: string[];
    exercises: string[];
    kind: PageKind;
    ocrApplied: boolean;
    ocrConfidence: number | null;
    visionNote?: string;
  }>;
  chapters: PdfChapterSection[];
  equations: Array<{ page: number; text: string }>;
  definitions: Array<{ page: number; text: string }>;
  examples: Array<{ page: number; text: string }>;
  exercises: Array<{ page: number; text: string }>;
  keyTerms: string[];
  outline: Array<{ title: string; page: number }>;
  pageInfos: PdfPageInfo[];
}

export interface PdfDocumentIntelligence {
  documentTitle: string;
  subject: string;
  difficultyLevel: string;
  mainTopics: string[];
  chapters: Array<{ title: string; startPage: number; endPage: number; summary: string }>;
  importantConcepts: string[];
  definitionsSummary: string[];
  formulasSummary: string[];
  examplesSummary: string[];
  tablesAndDiagramsNote: string;
  exercisePatterns: string[];
  prerequisites: string[];
  keyLearningOutcomes: string[];
  learningAnalysis: {
    foundationalConcepts: string[];
    topicDependencies: string[];
    prioritySections: string[];
    numericalTopics: string[];
    conceptualTopics: string[];
    challengingAreas: string[];
  };
  suggestedLearningGoal?: string;
  followUpQuestion: string;
}

export function formatPdfBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function sanitizePdfFilename(rawName: string): string {
  const cleaned = rawName
    .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  const base = cleaned || "document.pdf";
  return base.slice(0, 180);
}

/**
 * Validates file metadata on client & server before chunked transfer begins.
 * Returns null if valid, or a clear user-facing error message if invalid.
 */
export function validatePdfUploadMeta(file: {
  name: string;
  type?: string;
  size: number;
}): string | null {
  const name = file.name.trim();
  if (!name) return "Select a valid PDF file.";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const mime = (file.type ?? "").toLowerCase();
  const isPdfMime = mime === "" || mime === "application/pdf" || mime === "application/x-pdf";
  if (ext !== "pdf" || !isPdfMime) {
    return `${name}: Only PDF (.pdf) documents are supported by Learn with PDF.`;
  }
  if (!Number.isFinite(file.size) || file.size < 16) {
    return `${name} is empty or corrupted (file too small to be a valid PDF).`;
  }
  if (file.size > MAX_LAM_PDF_BYTES) {
    return `${name} is ${formatPdfBytes(file.size)}, which exceeds the 25 MB limit. Please upload a PDF of 25 MB or smaller.`;
  }
  return null;
}

/**
 * Verifies the binary `%PDF-` signature header (allowing leading BOM/whitespace only up to 16 bytes
 * if standard, though strict PDF requires `%PDF-` at offset 0).
 */
export function hasPdfMagicSignature(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 5) return false;
  // %PDF- in ASCII: 0x25 0x50 0x44 0x46 0x2D
  return (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}
