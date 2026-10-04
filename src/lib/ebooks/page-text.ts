import { MAX_EBOOK_TEXT } from "./contracts";

export function readablePageText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 10 && !/^(OCR error:|\(No text extracted\))/i.test(value.trim());
}

/** Actual page numbers are retained, including scans which still have no text. */
export function replaceReviewedPage(stored: unknown, pageCount: number, page: number, reviewed: string) {
  if (!Number.isInteger(page) || page < 1 || page > pageCount) throw new Error("INVALID_PAGE");
  const text = reviewed.trim();
  if (!readablePageText(text) || text.length > 20_000) throw new Error("INVALID_TEXT");
  const pages = Array.from({ length: pageCount }, (_, i) => Array.isArray(stored) && typeof stored[i] === "string" ? stored[i] : "");
  pages[page - 1] = text;
  const fullText = pages.map((value, i) => `Page ${i + 1}\n${value}`).join("\n\n");
  if (fullText.length > MAX_EBOOK_TEXT) throw new Error("PDF_TEXT_LIMIT");
  return { pages, text: fullText, needsOcr: pages.some(value => value.trim().length < 30) };
}
