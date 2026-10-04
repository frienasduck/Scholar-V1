import { z } from "zod";

// Existing persistent-byte adapter and Vercel request budget: one shared limit.
export const MAX_EBOOK_BYTES = 4 * 1024 * 1024;
export const MAX_EBOOK_PAGES = 500;
export const MAX_EBOOK_TEXT = 2_000_000;
export const EMPTY_READING = { page: 1, bookmarks: [], notes: [], lastOpenedAt: null };
export const readingSchema = z.object({
  page: z.number().int().min(1).max(MAX_EBOOK_PAGES),
  bookmarks: z.array(z.object({ id: z.string().min(1).max(100), page: z.number().int().min(1).max(MAX_EBOOK_PAGES), note: z.string().max(2000).optional(), createdAt: z.string().datetime() })).max(MAX_EBOOK_PAGES),
  notes: z.array(z.object({ page: z.number().int().min(1).max(MAX_EBOOK_PAGES), text: z.string().max(4000), updatedAt: z.string().datetime() })).max(MAX_EBOOK_PAGES),
  lastOpenedAt: z.string().datetime().nullable(),
});
export type EbookReading = z.infer<typeof readingSchema>;
export const readingChangeSchema = z.object({
  page: z.number().int().min(1).max(MAX_EBOOK_PAGES).optional(),
  bookmark: z.object({ page: z.number().int().min(1).max(MAX_EBOOK_PAGES), note: z.string().max(2000).optional(), remove: z.boolean().optional() }).optional(),
  note: z.object({ page: z.number().int().min(1).max(MAX_EBOOK_PAGES), text: z.string().max(4000) }).optional(),
}).strict().refine(value => Object.keys(value).length === 1);
export type ReadingChange = z.infer<typeof readingChangeSchema>;
/** Preserve the old reader's device-only bookmarks when moving to account sync. */
export function restoreReadingJournal(cloud: EbookReading, stored: unknown, legacy: unknown) {
  const journal = z.object({ state: readingSchema, pending: z.array(readingChangeSchema).max(1000) }).safeParse(stored);
  if (journal.success) return { state: journal.data.pending.length ? journal.data.state : cloud, pending: journal.data.pending };
  const old = readingSchema.pick({ page: true, bookmarks: true }).safeParse(legacy);
  const state = { ...cloud, bookmarks: [...cloud.bookmarks] };
  const pending: ReadingChange[] = [];
  if (old.success) {
    if (!cloud.lastOpenedAt) { state.page = old.data.page; pending.push({ page: state.page }); }
    for (const bookmark of old.data.bookmarks) if (!state.bookmarks.some(item => item.page === bookmark.page)) {
      state.bookmarks.push(bookmark); pending.push({ bookmark: { page: bookmark.page, note: bookmark.note } });
    }
  }
  return { state, pending };
}
export function safeEbookName(value: string) {
  return value.replace(/[\u0000-\u001f<>:"/\\|?*]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 180) || "Scholar E-Book.pdf";
}
export function pdfValidation(file: { name: string; type: string; size: number }, signature?: string) {
  if (file.size < 5) return "This PDF is empty or incomplete. Choose another file.";
  if (file.size > MAX_EBOOK_BYTES) return `This file is ${(file.size / 1048576).toFixed(1)} MB. The limit is 4 MB; compress it or split it into smaller PDFs.`;
  if (!/\.pdf$/i.test(file.name) || file.type && file.type !== "application/pdf" || signature !== undefined && signature !== "%PDF-") return "Only genuine PDF files are supported.";
  return null;
}
export function ebookFailure(code?: string | null) {
  const messages: Record<string, string> = {
    PDF_PASSWORD_PROTECTED: "This PDF is password protected. Remove the password and upload it again.",
    PDF_CORRUPT: "We couldn't read this PDF. The file may be damaged or incomplete.",
    PDF_ACTIVE_CONTENT: "This PDF contains scripts. Export a plain PDF and upload it again.",
    PDF_PAGE_LIMIT: "PDFs must contain 1–500 pages. Split this book into smaller PDFs.",
    PDF_TEXT_LIMIT: "This PDF expands to too much text. Split it into smaller study PDFs.",
    PDF_TIMEOUT: "Reading the PDF took too long. Retry processing without uploading again.",
    WORKER_INTERRUPTED: "Processing was interrupted. Retry to reuse completed stages.",
  };
  return messages[code ?? ""] ?? "Processing is temporarily unavailable. Retry to reuse completed stages.";
}
export function fileDisposition(name: string) {
  const safe = safeEbookName(name);
  const ascii = safe.replace(/[^\x20-\x7e]/g, "_");
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16)}`)}`;
}
export function requestedBookRange(message: string, current: number, total: number) {
  const match = message.match(/\bpages?\s+(\d+)(?:\s*(?:-|–|to|through)\s*(\d+))?/i);
  if (/\b(?:whole|entire|this) book\b/i.test(message) && !match) return undefined;
  const start = match ? Number(match[1]) : current;
  const end = match?.[2] ? Number(match[2]) : start;
  if (start < 1 || end < start || end > total || end - start >= 25) throw new Error("BOOK_PAGE_RANGE");
  return { pageStart: start, pageEnd: end };
}
