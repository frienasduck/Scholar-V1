import { afterAll, expect, mock, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { ebookFixture } from "./ebook-fixtures";
mock.module("server-only", () => ({}));
const { renderPdfPage } = await import("../src/lib/resources/pdf");
const { recognizePageImage, disposeOcrWorker } = await import("../src/lib/ebooks/ocr");
afterAll(() => disposeOcrWorker());

test("real PDF rasterization and local English OCR recover actual page content", async () => {
  const image = await renderPdfPage(ebookFixture(2), 2);
  expect(image.subarray(1, 4).toString()).toBe("PNG");
  const result = await recognizePageImage(image);
  expect(result.text).toMatch(/Newton/i);
  expect(result.text).toMatch(/acceleration/i);
  expect(result.text).toMatch(/Page 2/i);
  expect(result.confidence).toBeGreaterThan(60);
  expect(result.reviewRequired).toBe(true);
}, 60_000);

test("the supplied built-in Physics scan has real OCR content, not only metadata", async () => {
  const result = await recognizePageImage(await readFile("public/ebook-pages/page-009.png"));
  expect(result.text.length).toBeGreaterThan(300);
  expect(result.text).toMatch(/mass|atom|unit|number/i);
  expect(result.text).not.toContain("OCR error:");
  console.info("[OCR verification]", { page: 9, characters: result.text.length, confidence: result.confidence });
}, 60_000);

test("invalid pages and blank scans never produce saved book text", async () => {
  await expect(renderPdfPage(ebookFixture(1), 2)).rejects.toThrow("INVALID_PAGE");
  const scan = await renderPdfPage(ebookFixture(1, { scan: true }), 1);
  await expect(recognizePageImage(scan)).rejects.toThrow("NO_TEXT");
}, 60_000);
