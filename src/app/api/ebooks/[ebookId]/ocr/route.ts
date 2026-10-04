import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { mutationOrigin } from "@/lib/resources/http";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { readBoundedJson, RequestBodyError } from "@/lib/security/request-body";
import { renderPdfPage } from "@/lib/resources/pdf";
import { recognizePageImage } from "@/lib/ebooks/ocr";
import { replaceReviewedPage } from "@/lib/ebooks/page-text";
import { chunkSections, contentHash } from "@/lib/resources/engine";

export const runtime = "nodejs";
export const maxDuration = 60;
type Context = { params: Promise<{ ebookId: string }> };
const headers = { "Cache-Control": "private, no-store" };
const input = z.object({ page: z.number().int().min(1).max(500) }).strict();
const reviewed = input.extend({ text: z.string().trim().min(10).max(20_000) }).strict();
const json = (status: number, value: object) => NextResponse.json(value, { status, headers });
function failure(error: unknown) {
  if (error instanceof RequestBodyError) return json(error.status, { message: "This OCR update is invalid or too large." });
  if (error instanceof RateLimitError) return NextResponse.json({ message: "Too many OCR requests. Wait and retry." }, { status: 429, headers: { ...headers, "Retry-After": String(error.retryAfterSeconds) } });
  const messages: Record<string, [number, string]> = {
    OCR_BUSY: [429, "Another page is being read. Please retry shortly."],
    NO_TEXT: [422, "No readable text was found. You can type or paste this page's text and review it."],
    INVALID_PAGE: [400, "Choose a page in this book."], INVALID_TEXT: [400, "Review at least 10 characters of actual page text before saving."],
    PDF_TEXT_LIMIT: [413, "This book's text limit has been reached."],
    PDF_TIMEOUT: [504, "Rendering this page took too long. Try reopening the PDF."],
    OCR_TIMEOUT: [504, "OCR took too long. Retry this page; no text was saved."],
  };
  const match = error instanceof Error ? messages[error.message] : undefined;
  if (match) return json(match[0], { message: match[1] });
  console.warn("[Ebook OCR] request failed", { type: error instanceof Error ? error.name : "UNKNOWN" });
  return json(503, { message: "The private OCR service is temporarily unavailable. Your original book is safe; no replacement text was saved." });
}

export async function POST(request: NextRequest, context: Context) {
  if (!mutationOrigin(request)) return json(403, { error: "ORIGIN_REJECTED" });
  try {
    const user = await getSessionUser();
    if (!user) return json(401, { error: "AUTH_REQUIRED" });
    const parsed = input.safeParse(await readBoundedJson(request, 2048));
    if (!parsed.success) return json(400, { message: "Choose one valid book page." });
    const { ebookId } = await context.params;
    const book = await db.customEbook.findFirst({ where: { id: ebookId, userId: user.id, deletedAt: null }, select: { pageCount: true, pdfBytes: true, processingStatus: true } });
    if (!book) return json(404, { error: "NOT_FOUND" });
    if (!["ready", "needs_ocr"].includes(book.processingStatus)) return json(409, { message: "Wait for safe PDF processing to finish." });
    if (parsed.data.page > book.pageCount) return json(400, { message: "Choose a page in this book." });
    await enforceRateLimit(user.id, "ebook-ocr", 15, 10 * 60_000);
    const image = await renderPdfPage(book.pdfBytes, parsed.data.page);
    const result = await recognizePageImage(image);
    return json(200, { ok: true, page: parsed.data.page, ...result });
  } catch (error) { return failure(error); }
}

/** Review is explicit. Original PDF bytes and other pages are never overwritten. */
export async function PATCH(request: NextRequest, context: Context) {
  if (!mutationOrigin(request)) return json(403, { error: "ORIGIN_REJECTED" });
  try {
    const user = await getSessionUser();
    if (!user) return json(401, { error: "AUTH_REQUIRED" });
    const parsed = reviewed.safeParse(await readBoundedJson(request, 90_000));
    if (!parsed.success) return json(400, { message: "Review 10–20,000 characters of page text before saving." });
    await enforceRateLimit(user.id, "ebook-ocr-review", 60, 60_000);
    const { ebookId } = await context.params;
    const result = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "CustomEbook" WHERE "id" = ${ebookId} AND "userId" = ${user.id} AND "deletedAt" IS NULL FOR UPDATE`;
      const book = await tx.customEbook.findFirst({ where: { id: ebookId, userId: user.id, deletedAt: null }, select: { id: true, pageCount: true, pageTexts: true, processingStatus: true, resource: { select: { id: true, state: true, sourceMetadata: true } } } });
      if (!book) return { status: 404, message: "E-Book not found." };
      if (!["ready", "needs_ocr"].includes(book.processingStatus)) return { status: 409, message: "Wait for PDF processing to finish." };
      const content = replaceReviewedPage(book.pageTexts, book.pageCount, parsed.data.page, parsed.data.text);
      await tx.customEbook.update({ where: { id: book.id }, data: { pageTexts: content.pages, text: content.text, processingStatus: content.needsOcr ? "needs_ocr" : "ready" } });
      if (book.resource) {
        const resourceId = book.resource.id;
        const chunks = chunkSections(content.pages.flatMap((text, i) => text.trim().length >= 10 ? [{ heading: `Page ${i + 1}`, page: i + 1, text }] : []));
        await tx.resourceChunk.deleteMany({ where: { resourceId } });
        if (chunks.length) await tx.resourceChunk.createMany({ data: chunks.map(chunk => ({ resourceId, ...chunk })) });
        await tx.resourceArtifact.deleteMany({ where: { resourceId } });
        const metadata = (book.resource.sourceMetadata ?? {}) as Record<string, Prisma.InputJsonValue>;
        const ocrPages = Array.isArray(metadata.ocrReviewedPages) ? metadata.ocrReviewedPages.filter((n): n is number => typeof n === "number" && n >= 1 && n <= book.pageCount) : [];
        await tx.studyResource.update({ where: { id: resourceId }, data: { contentHash: contentHash(content.text), state: book.resource.state === "READY" ? "READY" : "NEEDS_REVIEW", sourceMetadata: { ...metadata, needsOcr: content.needsOcr, review: content.needsOcr ? "Reviewed OCR pages are indexed. Other scanned pages still need OCR." : book.resource.state === "READY" ? null : "Choose a chapter to improve recommendations.", ocrReviewedPages: [...new Set([...ocrPages, parsed.data.page])], extractionComplete: true } } });
      }
      return { status: 200, message: "Reviewed text saved and indexed for LAM.", text: content.pages[parsed.data.page - 1] };
    }, { timeout: 20_000 });
    return json(result.status, { ok: result.status === 200, ...result });
  } catch (error) { return failure(error); }
}
