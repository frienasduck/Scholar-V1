import { beforeEach, expect, mock, test } from "bun:test";
mock.module("server-only", () => ({}));
let pageCount = 1; let scripts = false; let text = "Laws of Motion: a body remains at rest unless a net force acts.";
let destroyed = 0;
let parserError: Error | null = null;
mock.module("pdfjs-dist/legacy/build/pdf.mjs", () => ({ getDocument: ({ data }: { data: Uint8Array }) => {
  structuredClone(data, { transfer: [data.buffer] });
  return { promise: parserError ? Promise.reject(parserError) : Promise.resolve({ numPages: pageCount, hasJSActions: async () => scripts,
    getPage: async () => ({ getTextContent: async () => ({ items: [{ str: text }] }), cleanup() {} }) }), destroy: async () => { destroyed++; } };
} }));
const { extractPdf } = await import("../src/lib/resources/pdf");
beforeEach(() => { pageCount = 1; scripts = false; text = "Laws of Motion: a body remains at rest unless a net force acts."; destroyed = 0; parserError = null; });
test("PDF adapter preserves original bytes when the parser transfers its copy", async () => {
  const original = Buffer.from("%PDF-original-private-document");
  const result = await extractPdf(original);
  expect(original.toString()).toBe("%PDF-original-private-document");
  expect(result.pageCount).toBe(1); expect(result.needsOcr).toBe(false); expect(result.text).toContain("Page 1"); expect(destroyed).toBeGreaterThan(0);
});
test("PDF scripts are rejected before any usable text is returned", async () => { scripts = true; await expect(extractPdf(Buffer.from("%PDF"))).rejects.toThrow("PDF_ACTIVE_CONTENT"); });
test("oversized PDF page count is rejected", async () => { pageCount = 501; await expect(extractPdf(Buffer.from("%PDF"))).rejects.toThrow("PDF_PAGE_LIMIT"); });
test("zero-page PDF is rejected", async () => { pageCount = 0; await expect(extractPdf(Buffer.from("%PDF"))).rejects.toThrow("PDF_PAGE_LIMIT"); });
test("decompressed text expansion is bounded", async () => { text = "x".repeat(2_000_001); await expect(extractPdf(Buffer.from("%PDF"))).rejects.toThrow("PDF_TEXT_LIMIT"); });
test("single scanned page is explicitly marked needs OCR, never falsely ready", async () => { text = ""; const result = await extractPdf(Buffer.from("%PDF")); expect(result.needsOcr).toBe(true); });
test("encrypted PDFs become permanent actionable failures", async () => { parserError = new Error("password required"); parserError.name = "PasswordException"; await expect(extractPdf(Buffer.from("%PDF"))).rejects.toThrow("PDF_PASSWORD_PROTECTED"); expect(destroyed).toBe(1); });
test("corrupt PDFs become permanent actionable failures", async () => { parserError = new Error("invalid format"); parserError.name = "InvalidPDFException"; await expect(extractPdf(Buffer.from("%PDF"))).rejects.toThrow("PDF_CORRUPT"); expect(destroyed).toBe(1); });
