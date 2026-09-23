import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { resolveUserEntitlements } from "@/lib/subscriptions/entitlements";
import { commitMonthlyUsage, getMonthlyUsage, MonthlyQuotaError, releaseMonthlyUsage, reserveMonthlyUsage } from "@/lib/subscriptions/monthly-usage";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PDF_BYTES = 4 * 1024 * 1024;
const MAX_PAGES = 500;

function safeName(value: string) {
  return value.replace(/[\u0000-\u001f<>:"/\\|?*]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 180) || "Scholar E-Book.pdf";
}

async function extractPdf(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({ data: bytes });
  const document = await loadingTask.promise;
  if (document.numPages < 1 || document.numPages > MAX_PAGES) throw new Error("PDF_PAGE_LIMIT");
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" ").replace(/\s+/g, " ").trim());
    page.cleanup();
  }
  await loadingTask.destroy();
  const text = pages.map((page, index) => `Page ${index + 1}\n${page}`).join("\n\n");
  const emptyPages = pages.filter((page) => page.length < 30).length;
  return { pageCount: pages.length, pages, text, needsOcr: emptyPages > Math.max(1, Math.floor(pages.length * 0.2)) };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const access = await resolveUserEntitlements(user.id);
  const [ebooks, usage] = await Promise.all([
    db.customEbook.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, originalFileName: true, sizeBytes: true, pageCount: true, processingStatus: true, createdAt: true },
    }),
    getMonthlyUsage(user.id, access),
  ]);
  return NextResponse.json({ ebooks, usage: usage.ebookUploads, period: usage.period, timezone: usage.timezone }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED", message: "Sign in to upload a private E-Book." }, { status: 401 });
  try {
    await enforceRateLimit(user.id, "custom-ebook-upload", 8, 60 * 60 * 1000);
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: "RATE_LIMITED", message: "Too many upload attempts. Try again later." }, { status: 429 });
    return NextResponse.json({ error: "ACCESS_CHECK_FAILED" }, { status: 503 });
  }
  const access = await resolveUserEntitlements(user.id);
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const requestedTitle = typeof form?.get("title") === "string" ? String(form.get("title")) : "";
  if (!(file instanceof File)) return NextResponse.json({ error: "PDF_REQUIRED", message: "Choose one PDF file." }, { status: 400 });
  if (file.size < 5 || file.size > MAX_PDF_BYTES) return NextResponse.json({ error: "PDF_SIZE", message: "PDFs must be no larger than 4 MB." }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = new TextDecoder("ascii").decode(bytes.slice(0, 5));
  if (file.type !== "application/pdf" || signature !== "%PDF-") return NextResponse.json({ error: "PDF_ONLY", message: "Only genuine PDF files are supported." }, { status: 415 });

  const idempotencyKey = `${user.id}:ebook:${request.headers.get("x-idempotency-key")?.slice(0, 100) || crypto.randomUUID()}`;
  try {
    const reservation = await reserveMonthlyUsage({ userId: user.id, feature: "custom_ebook_upload", idempotencyKey, access });
    if (reservation.replayed) return NextResponse.json({ error: "UPLOAD_REPLAY", message: "This upload is already being processed." }, { status: 409 });
  } catch (error) {
    if (error instanceof MonthlyQuotaError) return NextResponse.json({ error: error.code, limit: error.limit, message: `You have used all ${error.limit} custom E-Book uploads for this month.` }, { status: 429 });
    return NextResponse.json({ error: "QUOTA_UNAVAILABLE", message: "Scholar could not verify your upload allowance." }, { status: 503 });
  }

  let createdId: string | null = null;
  try {
    const extracted = await extractPdf(bytes);
    const originalFileName = safeName(file.name);
    const title = safeName(requestedTitle || originalFileName.replace(/\.pdf$/i, "")).slice(0, 120);
    const ebook = await db.customEbook.create({ data: {
      userId: user.id,
      title,
      originalFileName,
      sizeBytes: file.size,
      pageCount: extracted.pageCount,
      text: extracted.text.slice(0, 2_000_000),
      pageTexts: extracted.pages,
      pdfBytes: Buffer.from(bytes),
      processingStatus: extracted.needsOcr ? "needs_ocr" : "ready",
    } });
    createdId = ebook.id;
    await commitMonthlyUsage(user.id, idempotencyKey);
    return NextResponse.json({ ok: true, ebook: { id: ebook.id, title: ebook.title, pageCount: ebook.pageCount, sizeBytes: ebook.sizeBytes, processingStatus: ebook.processingStatus } }, { status: 201 });
  } catch (error) {
    if (createdId) await db.customEbook.deleteMany({ where: { id: createdId, userId: user.id } }).catch(() => undefined);
    await releaseMonthlyUsage(user.id, idempotencyKey).catch(() => undefined);
    const message = error instanceof Error && error.message === "PDF_PAGE_LIMIT"
      ? `PDFs must contain between 1 and ${MAX_PAGES} pages.`
      : "Scholar could not safely read this PDF. The upload was not counted.";
    return NextResponse.json({ error: "PDF_PROCESSING_FAILED", message }, { status: 422 });
  }
}
