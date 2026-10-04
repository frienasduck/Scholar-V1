import { expect, test } from "bun:test";
import { replaceReviewedPage } from "../src/lib/ebooks/page-text";
test("reviewed OCR preserves page numbers and unrelated readable pages", () => {
  const result = replaceReviewedPage(["", "Newton's second law: F = ma."], 3, 1, "Reviewed OCR from the first scan.");
  expect(result.pages).toEqual(["Reviewed OCR from the first scan.", "Newton's second law: F = ma.", ""]);
  expect(result.text).toContain("Page 2\nNewton");
  expect(result.needsOcr).toBe(true);
});
test("OCR errors, empty text and invalid page numbers cannot be indexed", () => {
  for (const text of ["", "OCR error: service unavailable", "(No text extracted)"]) expect(() => replaceReviewedPage([], 2, 1, text)).toThrow("INVALID_TEXT");
  expect(() => replaceReviewedPage([], 2, 3, "real reviewed text")).toThrow("INVALID_PAGE");
  expect(() => replaceReviewedPage([], 2, 1, "x".repeat(20_001))).toThrow("INVALID_TEXT");
});
