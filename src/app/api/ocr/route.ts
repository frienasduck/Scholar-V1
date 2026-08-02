import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { requireEntitlement } from "@/lib/subscriptions/entitlements";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const OCR_TIMEOUT_MS = 45_000;
const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const activeJobs = new Map<string, Promise<OcrResult>>();
let sharedWorker: Awaited<ReturnType<typeof createWorker>> | null = null;
let workerPromise: ReturnType<typeof createWorker> | null = null;

type OcrResult = { text: string; confidence: number };

function errorResponse(status: number, code: string, error: string) {
  return NextResponse.json({ ok: false, code, error }, { status });
}

async function pageImage(body: unknown): Promise<Buffer> {
  if (!body || typeof body !== "object") throw new Error("INVALID_REQUEST");
  const { page, bookId } = body as { page?: unknown; bookId?: unknown };
  if (!Number.isInteger(page) || (page as number) < 1) throw new Error("INVALID_PAGE");
  if (bookId !== "physics-pt1" && bookId !== "maths-pt1") throw new Error("INVALID_BOOK");

  const maxPage = bookId === "maths-pt1" ? 37 : 96;
  if ((page as number) > maxPage) throw new Error("INVALID_PAGE");
  const pageDir = bookId === "maths-pt1" ? "ebook-pages-maths" : "ebook-pages";
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
    const form = await request.formData();
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
  return { source: await pageImage(await request.json()), homeworkScanner: false };
}

async function runOcr(source: Buffer): Promise<OcrResult> {
  const prepared = await sharp(source, { failOn: "error" })
    .rotate()
    .grayscale()
    .normalize()
    .sharpen({ sigma: 0.8 })
    .resize({ width: 2200, withoutEnlargement: true })
    .png()
    .toBuffer();

  if (!workerPromise) {
    const workerPath = path.join(process.cwd(), "node_modules", "tesseract.js", "src", "worker-script", "node", "index.js");
    workerPromise = createWorker("eng", undefined, {
      workerPath,
      cachePath: path.join(process.cwd(), ".cache", "tesseract"),
      errorHandler: () => {
        sharedWorker = null;
        workerPromise = null;
      },
    });
  }
  const worker = sharedWorker ?? await workerPromise;
  sharedWorker = worker;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      worker.recognize(prepared),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("OCR_TIMEOUT")), OCR_TIMEOUT_MS);
      }),
    ]);
    return {
      text: result.data.text.trim(),
      confidence: Math.max(0, Math.min(100, Math.round(result.data.confidence))),
    };
  } catch (error) {
    if (error instanceof Error && error.message === "OCR_TIMEOUT") {
      await worker.terminate().catch(() => undefined);
      sharedWorker = null;
      workerPromise = null;
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = await requestImage(request);
    if (input.homeworkScanner) {
      const access = await requireEntitlement("homework_scanner");
      if (!access.ok) return access.response;
    }
    const source = input.source;
    const jobId = createHash("sha256").update(source).digest("hex");
    let job = activeJobs.get(jobId);
    if (!job) {
      job = runOcr(source).finally(() => activeJobs.delete(jobId));
      activeJobs.set(jobId, job);
    }
    const result = await job;
    if (!result.text) {
      return errorResponse(422, "NO_TEXT", "No readable text was found. Try a sharper, well-lit image with the page filling the frame.");
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : "OCR_FAILED";
    const known: Record<string, [number, string]> = {
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
    const [status, message] = known[code] ?? [500, "OCR could not start. Please retry; if it continues, restart the development server."];
    return errorResponse(status, known[code] ? code : "OCR_FAILED", message);
  }
}
