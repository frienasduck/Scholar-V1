import { expect, mock, test } from "bun:test";
import { ebookFixture } from "./ebook-fixtures";
import { MAX_EBOOK_BYTES, fileDisposition, pdfValidation } from "../src/lib/ebooks/contracts";
mock.module("server-only", () => ({}));
const { extractPdf } = await import("../src/lib/resources/pdf");
test("real parser: five text pages preserve content, metadata, boundaries and original bytes", async () => {
  const bytes = ebookFixture(5); const original = Buffer.from(bytes);
  const result = await extractPdf(bytes);
  expect(result.pageCount).toBe(5); expect(result.pages[4]).toContain("Page 5"); expect(result.title).toBe("Mechanics fixture"); expect(result.needsOcr).toBe(false); expect(bytes.equals(original)).toBe(true);
}, 45_000); // Cold PDF.js/native-font loading can exceed Bun's default five seconds.
test("real parser: 125-page book resumes without repeating extracted pages", async () => {
  const bytes = ebookFixture(125); let pages: string[] = []; let passes = 0; let checkpoints = 0;
  while (pages.length < 125) {
    const result = await extractPdf(bytes, { pages, batchSize: 30, checkpoint: async value => { checkpoints++; expect(value.pages.length).toBeGreaterThan(pages.length); } });
    expect(result.pages.slice(0, pages.length)).toEqual(pages); pages = result.pages; passes++;
  }
  expect(passes).toBe(5); expect(checkpoints).toBeGreaterThan(12); expect(pages[124]).toContain("Page 125");
}, 45_000);
test("real parser: mixed and scan-only documents accurately warn about missing text", async () => {
  const mixed = await extractPdf(ebookFixture(4, { mixed: true })); expect(mixed.needsOcr).toBe(true); expect(mixed.pages[0]).toContain("Newton"); expect(mixed.pages[1]).toBe("");
  const scan = await extractPdf(ebookFixture(5, { scan: true })); expect(scan.needsOcr).toBe(true); expect(scan.pages.every(page => !page)).toBe(true);
});
test("real parser: corrupted PDF produces an actionable permanent failure", async () => { await expect(extractPdf(Buffer.from("%PDF-damaged"))).rejects.toThrow("PDF_CORRUPT"); });
test("real parser: encrypted document requests a password instead of spinning", async () => { await expect(extractPdf(ebookFixture(5, { encrypted: true }))).rejects.toThrow("PDF_PASSWORD_PROTECTED"); });
test("real parser: near-limit PDF remains bounded and readable", async () => { const bytes = ebookFixture(5, { padding: MAX_EBOOK_BYTES - 10_000 }); expect(bytes.length).toBeLessThan(MAX_EBOOK_BYTES); expect((await extractPdf(bytes)).pageCount).toBe(5); });
test("unusual unicode filename is safely supported in HTTP headers", () => { const file = { name: '物理 résumé (1).pdf', type: "application/pdf", size: 1024 }; expect(pdfValidation(file, "%PDF-")).toBeNull(); expect(fileDisposition(file.name)).toContain("filename*=UTF-8''"); expect(() => new Headers({ "Content-Disposition": fileDisposition(file.name) })).not.toThrow(); });
