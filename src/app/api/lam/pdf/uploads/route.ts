import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { mutationOrigin } from "@/lib/resources/http";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { readBoundedBytes, readBoundedJson, RequestBodyError } from "@/lib/security/request-body";
import {
  hasPdfMagicSignature,
  LAM_PDF_CHUNK_BYTES,
  MAX_LAM_PDF_BYTES,
  sanitizePdfFilename,
  validatePdfUploadMeta,
} from "@/lib/lam/pdf-contracts";

export const runtime = "nodejs";
export const maxDuration = 60;

const HEADERS = { "Cache-Control": "private, no-store" };

const startSchema = z
  .object({
    key: z.string().regex(/^[a-zA-Z0-9-]{16,100}$/),
    name: z.string().min(1).max(180),
    title: z.string().max(160).optional(),
    size: z.number().int().min(16).max(MAX_LAM_PDF_BYTES),
  })
  .strict();

class LamPdfUploadError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "PDF_UPLOAD_ERROR"
  ) {
    super(message);
  }
}

function fail(err: unknown) {
  if (err instanceof LamPdfUploadError) {
    return NextResponse.json(
      { ok: false, error: { code: err.code, message: err.message } },
      { status: err.status, headers: HEADERS }
    );
  }
  if (err instanceof RequestBodyError) {
    return NextResponse.json(
      { ok: false, error: { code: err.code, message: "Upload request is invalid or exceeds the chunk limit. Retry safely." } },
      { status: err.status, headers: HEADERS }
    );
  }
  if (err instanceof RateLimitError) {
    return NextResponse.json(
      { ok: false, error: { code: "RATE_LIMITED", message: "Too many PDF uploads right now. Please wait and retry." } },
      { status: 429, headers: { ...HEADERS, "Retry-After": String(err.retryAfterSeconds) } }
    );
  }
  console.warn("[LAM PDF Upload] unavailable", {
    type: err instanceof Error ? err.name : "UNKNOWN",
  });
  return NextResponse.json(
    { ok: false, error: { code: "UPLOAD_UNAVAILABLE", message: "PDF upload service is temporarily unavailable. Retry the same file to resume." } },
    { status: 503, headers: HEADERS }
  );
}

async function requireActor(request: NextRequest) {
  if (!mutationOrigin(request)) {
    throw new LamPdfUploadError("Open Learn with PDF from Scholar.", 403, "ORIGIN_REJECTED");
  }
  const user = await getSessionUser();
  if (!user) {
    throw new LamPdfUploadError("Sign in to upload a PDF for Learn with PDF.", 401, "AUTH_REQUIRED");
  }
  return user;
}

const uploadSummarySelect = {
  id: true,
  userId: true,
  key: true,
  name: true,
  title: true,
  totalBytes: true,
  receivedBytes: true,
  status: true,
  lastOffset: true,
  lastDigest: true,
  expiresAt: true,
  result: true,
  leaseUntil: true,
} as const;

export async function POST(request: NextRequest) {
  try {
    const user = await requireActor(request);
    const body = await readBoundedJson(request, 8192);

    const finishParsed = z
      .object({
        finish: z.string().min(1).max(100),
        goalHint: z.string().trim().max(400).optional(),
      })
      .strict()
      .safeParse(body);

    if (finishParsed.success) {
      const row = await db.ebookUpload.findFirst({
        where: {
          id: finishParsed.data.finish,
          userId: user.id,
          expiresAt: { gt: new Date() },
        },
        select: uploadSummarySelect,
      });
      if (!row) {
        throw new LamPdfUploadError("This upload session expired or was not found. Select the PDF again.", 404, "UPLOAD_NOT_FOUND");
      }
      if (row.status === "done" && row.result) {
        return NextResponse.json(row.result, { headers: HEADERS });
      }
      if (row.receivedBytes !== row.totalBytes) {
        throw new LamPdfUploadError("PDF transfer is incomplete. Retry to resume from the last saved chunk.", 409, "UPLOAD_INCOMPLETE");
      }

      const claimed = await db.ebookUpload.updateMany({
        where: {
          id: row.id,
          userId: user.id,
          OR: [{ status: "uploading" }, { status: "finalizing", leaseUntil: { lt: new Date() } }],
        },
        data: { status: "finalizing", leaseUntil: new Date(Date.now() + 90_000) },
      });
      if (!claimed.count) {
        throw new LamPdfUploadError("This upload is already finalizing. Retry shortly.", 409, "UPLOAD_BUSY");
      }

      try {
        const data = await db.ebookUpload.findFirst({
          where: { id: row.id, userId: user.id },
          select: { bytes: true },
        });
        if (!data || data.bytes.length !== row.totalBytes) {
          throw new LamPdfUploadError("Uploaded PDF bytes could not be verified. Select the PDF again.", 400, "UPLOAD_CORRUPT");
        }
        const pdfBytes = Uint8Array.from(data.bytes);
        if (!hasPdfMagicSignature(pdfBytes)) {
          throw new LamPdfUploadError("Only genuine PDF documents (%PDF-) are accepted.", 415, "INVALID_PDF_SIGNATURE");
        }
        const digest = createHash("sha256").update(pdfBytes).digest("hex");
        const cleanTitle = (row.title || row.name.replace(/\.pdf$/i, "")).trim().slice(0, 140) || "Untitled PDF";
        const identityKey = `${user.id}:lam-pdf:${digest}`;

        const existingResource = await db.studyResource.findFirst({
          where: {
            identityKey,
            ownerUserId: user.id,
            visibility: "PRIVATE",
            deletedAt: null,
          },
          select: {
            id: true,
            title: true,
            state: true,
            sourceMetadata: true,
            ebook: {
              select: {
                id: true,
                originalFileName: true,
                sizeBytes: true,
                pageCount: true,
                processingStatus: true,
              },
            },
          },
        });

        let responsePayload: Record<string, unknown>;
        if (existingResource?.ebook) {
          const meta = (existingResource.sourceMetadata ?? {}) as Record<string, unknown>;
          responsePayload = {
            ok: true,
            duplicate: true,
            doc: {
              docId: existingResource.ebook.id,
              resourceId: existingResource.id,
              title: existingResource.title,
              fileName: existingResource.ebook.originalFileName,
              sizeBytes: existingResource.ebook.sizeBytes,
              pageCount: existingResource.ebook.pageCount,
              stage: existingResource.ebook.processingStatus === "ready" ? "ready" : String(meta.lamPdfStage || "inspecting"),
              ready: existingResource.ebook.processingStatus === "ready",
            },
          };
        } else {
          const created = await db.$transaction(async (tx) => {
            const ebook = await tx.customEbook.create({
              data: {
                id: randomUUID(),
                userId: user.id,
                title: cleanTitle,
                originalFileName: row.name,
                mimeType: "application/pdf",
                sizeBytes: pdfBytes.byteLength,
                pageCount: 0,
                text: "",
                pageTexts: [],
                readingState: {},
                pdfBytes: Buffer.from(pdfBytes),
                processingStatus: "processing",
                allocation: "lam-pdf",
                importKey: row.key,
                importDigest: digest,
              },
              select: { id: true, sizeBytes: true, originalFileName: true },
            });

            const resource = await tx.studyResource.create({
              data: {
                identityKey,
                ownerUserId: user.id,
                ebookId: ebook.id,
                visibility: "PRIVATE",
                title: cleanTitle,
                description: "Uploaded via LAM AI Learn with PDF",
                resourceType: "textbook",
                sourceType: "USER_PDF_UPLOAD",
                publisher: "Personal Upload",
                language: "en",
                licenseType: "PRIVATE_USER_UPLOAD",
                attributionText: "User-uploaded private PDF for Learn with PDF",
                canStoreCopy: true,
                canGenerateDerivatives: true,
                contentHash: digest,
                state: "EXTRACTING",
                qualityStatus: "user-provided",
                sourceMetadata: {
                  lamPdf: true,
                  lamPdfStage: "inspecting",
                  goalHint: finishParsed.data.goalHint ?? "",
                  grade: user.currentScholarClass === 9 ? 9 : 11,
                } as Prisma.InputJsonValue,
              },
              select: { id: true },
            });

            return { ebook, resource };
          }, { timeout: 30_000 });

          responsePayload = {
            ok: true,
            duplicate: false,
            doc: {
              docId: created.ebook.id,
              resourceId: created.resource.id,
              title: cleanTitle,
              fileName: created.ebook.originalFileName,
              sizeBytes: created.ebook.sizeBytes,
              pageCount: 0,
              stage: "inspecting",
              ready: false,
            },
          };
        }

        await db.ebookUpload.updateMany({
          where: { id: row.id, userId: user.id, status: "finalizing" },
          data: {
            status: "done",
            bytes: Buffer.alloc(0),
            result: responsePayload as Prisma.InputJsonValue,
            leaseUntil: null,
          },
        });

        return NextResponse.json(responsePayload, { headers: HEADERS });
      } catch (err) {
        await db.ebookUpload
          .updateMany({
            where: { id: row.id, userId: user.id, status: "finalizing" },
            data: { status: "uploading", leaseUntil: null },
          })
          .catch(() => undefined);
        throw err;
      }
    }

    const input = startSchema.safeParse(body);
    if (!input.success) {
      throw new LamPdfUploadError("Select a valid PDF document up to 25 MB.", 400, "INVALID_UPLOAD_INPUT");
    }

    const validationError = validatePdfUploadMeta({
      name: input.data.name,
      type: "application/pdf",
      size: input.data.size,
    });
    if (validationError) {
      throw new LamPdfUploadError(validationError, input.data.size > MAX_LAM_PDF_BYTES ? 413 : 400, "PDF_VALIDATION_FAILED");
    }

    await enforceRateLimit(user.id, "lam-pdf-upload-start", 30, 60 * 60 * 1000);
    // Clean expired upload buffers opportunistically
    await db.ebookUpload.deleteMany({ where: { expiresAt: { lte: new Date() } } }).catch(() => undefined);

    const safeName = sanitizePdfFilename(input.data.name);
    const cleanTitle = (input.data.title || safeName.replace(/\.pdf$/i, "")).trim().slice(0, 140) || "Untitled PDF";

    const row = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${user.id} FOR UPDATE`;
      const existing = await tx.ebookUpload.findUnique({
        where: { userId_key: { userId: user.id, key: input.data.key } },
        select: uploadSummarySelect,
      });
      if (existing) {
        if (existing.name !== safeName || existing.totalBytes !== input.data.size) {
          throw new LamPdfUploadError("Upload key belongs to a different file. Re-select the PDF.", 409, "UPLOAD_KEY_CONFLICT");
        }
        return existing;
      }
      const pending = await tx.ebookUpload.findMany({
        where: { userId: user.id, status: { in: ["uploading", "finalizing"] } },
        select: { id: true },
      });
      if (pending.length >= 3) {
        throw new LamPdfUploadError("Finish or cancel pending PDF uploads first.", 429, "TOO_MANY_PENDING_UPLOADS");
      }
      return tx.ebookUpload.create({
        data: {
          userId: user.id,
          key: input.data.key,
          name: safeName,
          title: cleanTitle,
          totalBytes: input.data.size,
          bytes: Buffer.alloc(0),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
        select: uploadSummarySelect,
      });
    });

    return NextResponse.json(
      {
        ok: true,
        uploadId: row.id,
        offset: row.receivedBytes,
        chunkBytes: LAM_PDF_CHUNK_BYTES,
        maxBytes: MAX_LAM_PDF_BYTES,
      },
      { headers: HEADERS }
    );
  } catch (err) {
    return fail(err);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireActor(request);
    await enforceRateLimit(user.id, "lam-pdf-upload-chunk", 360, 60 * 60 * 1000);

    const id = request.nextUrl.searchParams.get("id") || "";
    const offset = Number(request.nextUrl.searchParams.get("offset"));
    if (
      !id ||
      id.length > 100 ||
      !request.nextUrl.searchParams.has("offset") ||
      !Number.isSafeInteger(offset) ||
      offset < 0
    ) {
      throw new LamPdfUploadError("Invalid chunk offset.", 400, "INVALID_OFFSET");
    }

    const bytes = Buffer.from(await readBoundedBytes(request, LAM_PDF_CHUNK_BYTES));
    if (!bytes.length) {
      throw new LamPdfUploadError("Uploaded chunk was empty.", 400, "EMPTY_CHUNK");
    }

    const digest = createHash("sha256").update(bytes).digest("hex");
    const row = await db.ebookUpload.findFirst({
      where: {
        id,
        userId: user.id,
        expiresAt: { gt: new Date() },
        status: "uploading",
      },
      select: uploadSummarySelect,
    });
    if (!row) {
      throw new LamPdfUploadError("Upload session expired or unavailable. Select the PDF again.", 404, "UPLOAD_NOT_FOUND");
    }

    // Idempotent retry of the last chunk
    if (row.lastOffset === offset && row.lastDigest === digest) {
      return NextResponse.json({ ok: true, offset: row.receivedBytes }, { headers: HEADERS });
    }
    if (offset !== row.receivedBytes || offset + bytes.length > row.totalBytes) {
      throw new LamPdfUploadError("Chunk sequence mismatch. Resuming from server offset.", 409, "OFFSET_MISMATCH");
    }
    if (offset === 0 && !hasPdfMagicSignature(bytes)) {
      throw new LamPdfUploadError("Only genuine PDF documents (%PDF-) are accepted.", 415, "INVALID_PDF_SIGNATURE");
    }

    const updated = await db.$executeRaw`
      UPDATE "EbookUpload"
      SET "bytes" = "bytes" || ${bytes},
          "receivedBytes" = "receivedBytes" + ${bytes.length},
          "lastOffset" = ${offset},
          "lastDigest" = ${digest}
      WHERE "id" = ${id}
        AND "userId" = ${user.id}
        AND "status" = 'uploading'
        AND "receivedBytes" = ${offset}
        AND "expiresAt" > NOW()
    `;
    if (updated !== 1) {
      throw new LamPdfUploadError("Concurrent chunk modification detected. Retry safely.", 409, "CHUNK_RACE");
    }

    return NextResponse.json(
      { ok: true, offset: offset + bytes.length, totalBytes: row.totalBytes },
      { headers: HEADERS }
    );
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireActor(request);
    const id = request.nextUrl.searchParams.get("id") || "";
    if (id) {
      await db.ebookUpload.deleteMany({
        where: { id, userId: user.id, status: "uploading" },
      });
    }
    return NextResponse.json({ ok: true }, { headers: HEADERS });
  } catch (err) {
    return fail(err);
  }
}
