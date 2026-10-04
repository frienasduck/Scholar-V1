import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { recognizePageImage } from "@/lib/ebooks/ocr";
import { mutationOrigin } from "@/lib/resources/http";
import { requireEntitlement } from "@/lib/subscriptions/entitlements";
import { readBoundedBytes, readBoundedJson, RequestBodyError } from "@/lib/security/request-body";
import { enforceRateLimit, RateLimitError, requestRateLimitKey } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_JSON_BYTES = 2 * 1024;
const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function errorResponse(status: number, code: string, error: string) {
  return NextResponse.json({ ok: false, code, error }, { status });
}

async function pageImage(body: unknown): Promise<Buffer> {
  if (!body || typeof body !== "object") throw new Error("INVALID_REQUEST");
  const { page, bookId } = body as { page?: unknown; bookId?: unknown };
  if (!Number.isInteger(page) || (page as number) < 1) throw new Error("INVALID_PAGE");
  if (bookId !== "physics-pt1" && bookId !== "maths-pt1" && bookId !== "chemistry-pt1") throw new Error("INVALID_BOOK");

  const maxPage = bookId === "maths-pt1" ? 37 : bookId === "chemistry-pt1" ? 60 : 96;
  if ((page as number) > maxPage) throw new Error("INVALID_PAGE");
  const pageDir = bookId === "maths-pt1" ? "ebook-pages-maths" : bookId === "chemistry-pt1" ? "ebook-pages-chemistry" : "ebook-pages";
  const imagePath = path.join(
    process.cwd(),
    "public",
    pageDir,
    `page-${String(page).padStart(3, "0")}.png`,
  );
  try {
    return await readFile(imagePath);
  } catch {
    throw new Error("PAGE_NOT_FOUND");
  }
}

async function requestImage(request: NextRequest): Promise<{ source: Buffer; homeworkScanner: boolean }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const bytes = await readBoundedBytes(request, MAX_UPLOAD_BYTES + 16_384);
    const form = await new Response(bytes, { headers: { "Content-Type": contentType } }).formData();
    if (form.get("feature") !== "homework_scanner") throw new Error("FEATURE_REQUIRED");
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("FILE_REQUIRED");
    if (file.size === 0) throw new Error("EMPTY_FILE");
    if (file.size > MAX_UPLOAD_BYTES) throw new Error("FILE_TOO_LARGE");
    if (file.type === "application/pdf") throw new Error("PDF_REQUIRES_IMPORT");
    if (!ACCEPTED_TYPES.has(file.type)) throw new Error("UNSUPPORTED_TYPE");
    return { source: Buffer.from(await file.arrayBuffer()), homeworkScanner: true };
  }
  if (!contentType.includes("application/json")) throw new Error("UNSUPPORTED_REQUEST");
  return { source: await pageImage(await readBoundedJson(request, MAX_JSON_BYTES)), homeworkScanner: false };
}

export async function POST(request: NextRequest) {
  if (!mutationOrigin(request)) return errorResponse(403, "ORIGIN_REJECTED", "Open OCR from Scholar.");
  try {
    await enforceRateLimit(requestRateLimitKey(request, "ocr-ip"), "ocr", 15, 10 * 60_000);
    const input = await requestImage(request);
    if (input.homeworkScanner) {
      const access = await requireEntitlement("homework_scanner");
      if (!access.ok) return access.response;
    }
    const result = await recognizePageImage(input.source);
    if (!result.text) {
      return errorResponse(422, "NO_TEXT", "No readable text was found. Try a sharper, well-lit image with the page filling the frame.");
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { ok: false, code: "RATE_LIMITED", error: "Too many OCR requests. Please wait and retry." },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } },
      );
    }
    if (error instanceof RequestBodyError) {
      return errorResponse(error.status, error.code, error.message);
    }
    const code = error instanceof Error ? error.message : "OCR_FAILED";
    const known: Record<string, [number, string]> = {
      OCR_BUSY: [429, "Another page is being read. Please retry in a moment."],
      NO_TEXT: [422, "No readable text was found. Try a sharper scan or type the page text for review."],
      FILE_REQUIRED: [400, "Choose an image before starting OCR."],
      EMPTY_FILE: [400, "The selected file is empty."],
      FILE_TOO_LARGE: [413, "The image is larger than 10 MB. Compress or crop it and try again."],
      PDF_REQUIRES_IMPORT: [415, "Direct PDF OCR is not available here. Import the PDF into the eBook reader, then run OCR on its scanned pages."],
      UNSUPPORTED_TYPE: [415, "Use a PNG, JPEG, or WebP image."],
      UNSUPPORTED_REQUEST: [415, "Upload an image or submit a supported eBook page."],
      FEATURE_REQUIRED: [400, "Uploaded-image OCR must identify the protected Homework Scanner feature."],
      INVALID_REQUEST: [400, "The OCR request is incomplete."],
      INVALID_PAGE: [400, "The requested eBook page is invalid."],
      INVALID_BOOK: [400, "The requested eBook is not supported."],
      PAGE_NOT_FOUND: [404, "The page image could not be found."],
      OCR_TIMEOUT: [504, "OCR took too long. Crop the image to the text area and try again."],
    };
    if (!known[code]) {
      console.warn("[OCR] request failed", { type: error instanceof Error ? error.name : "UNKNOWN", code: typeof error === "object" && error && "code" in error ? String(error.code) : "OCR_FAILED" });
      return errorResponse(503, "OCR_UNAVAILABLE", "OCR is temporarily unavailable. Check the server database and OCR configuration, then retry. No text has been saved.");
    }
    const [status, message] = known[code] ?? [500, "The image could not be read. Try a clearer PNG or JPEG, then retry."];
    return errorResponse(status, known[code] ? code : "OCR_FAILED", message);
  }
}
