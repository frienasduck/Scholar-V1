import { expect, test } from "bun:test";
import { EMPTY_READING, restoreReadingJournal, requestedBookRange, pdfValidation } from "../src/lib/ebooks/contracts";
const cloud = () => ({ ...EMPTY_READING, bookmarks: [], notes: [] });
const mark = { id: "old-mark", page: 42, note: "Return here", createdAt: "2026-09-01T10:00:00.000Z" };
test("legacy device progress and bookmarks become durable cloud operations", () => {
  const result = restoreReadingJournal(cloud(), null, { page: 42, bookmarks: [mark] });
  expect(result.state.page).toBe(42); expect(result.state.bookmarks).toEqual([mark]);
  expect(result.pending).toEqual([{ page: 42 }, { bookmark: { page: 42, note: "Return here" } }]);
});
test("legacy bookmarks merge without replacing newer cloud progress or notes", () => {
  const saved = { ...cloud(), page: 6, lastOpenedAt: "2026-10-03T10:00:00.000Z", notes: [{ page: 6, text: "Cloud note", updatedAt: "2026-10-03T10:00:00.000Z" }] };
  const result = restoreReadingJournal(saved, null, { page: 42, bookmarks: [mark] });
  expect(result.state.page).toBe(6); expect(result.state.notes).toEqual(saved.notes); expect(result.pending).toHaveLength(1);
});
test("pending local edits survive reload; settled journal uses newer account state", () => {
  const local = { ...cloud(), page: 7 };
  expect(restoreReadingJournal(cloud(), { state: local, pending: [{ page: 7 }] }, null).state.page).toBe(7);
  expect(restoreReadingJournal({ ...cloud(), page: 8 }, { state: local, pending: [] }, null).state.page).toBe(8);
});
test("corrupt or unbounded journals are not submitted as account changes", () => {
  const result = restoreReadingJournal(cloud(), { state: cloud(), pending: [{ note: { page: 1, text: "x".repeat(4001) } }] }, { page: -1, bookmarks: [] });
  expect(result.pending).toEqual([]); expect(result.state).toEqual(cloud());
});
test("client/server shared validation rejects spoofed MIME independently of multipart normalization", () => {
  expect(pdfValidation({ name: "book.pdf", type: "text/html", size: 30 }, "%PDF-")).toBeTruthy();
  expect(pdfValidation({ name: "book.pdf", type: "application/pdf", size: 30 }, "%PDF-")).toBeNull();
});
test("LAM explicit pages, ranges and whole-book scope resolve without invented page numbers", () => {
  for (const [message, range] of [["Summarize page 5.", [5, 5]], ["Explain the equation on page 12.", [12, 12]], ["Quiz me from pages 20 to 25.", [20, 25]]] as const) expect(requestedBookRange(message, 2, 125)).toEqual({ pageStart: range[0], pageEnd: range[1] });
  expect(requestedBookRange("What are the main ideas in this book?", 2, 125)).toBeUndefined();
  expect(() => requestedBookRange("pages 1-30", 2, 125)).toThrow("BOOK_PAGE_RANGE");
  expect(() => requestedBookRange("page 126", 2, 125)).toThrow("BOOK_PAGE_RANGE");
});
