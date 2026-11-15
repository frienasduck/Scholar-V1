import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/session";
import { publicAIError } from "@/lib/ai/errors";
import { db } from "@/lib/db";
import { mutationOrigin } from "@/lib/resources/http";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import {
  analyzeDocumentIntelligence,
  buildSearchableChunks,
  computePdfContentHash,
  inspectAndExtractNativePdf,
  interpretKeyDiagramPages,
  runOcrBatchOnPdf,
  structurePdfContent,
} from "@/lib/lam/pdf-processor";
import type { PdfDocumentIntelligence, PdfPageInfo, StructuredPdfDocument } from "@/lib/lam/pdf-contracts";

export const runtime = "nodejs";
export const maxDuration = 60;

type Context = { params: Promise<{ docId: string }> };
const HEADERS = { "Cache-Control": "private, no-store" };

function buildStatusPayload(
  ebook: {
    id: string;
    title: string;
    originalFileName: string;
    sizeBytes: number;
    pageCount: number;
    processingStatus: string;
    resource: {
      id: string;
      state: string;
      sourceMetadata: unknown;
      artifacts?: Array<{ type: string; content: unknown }>;
    } | null;
  }
) {
  const meta = (ebook.resource?.sourceMetadata ?? {}) as Record<string, unknown>;
  const pageInfos = Array.isArray(meta.pageInfos) ? (meta.pageInfos as PdfPageInfo[]) : [];
  const scannedPages = Array.isArray(meta.scannedPages) ? (meta.scannedPages as number[]) : [];
  const mixedPages = Array.isArray(meta.mixedPages) ? (meta.mixedPages as number[]) : [];
  const poorQualityPages = Array.isArray(meta.poorQualityPages) ? (meta.poorQualityPages as number[]) : [];
  const ocrTargetPages = Array.isArray(meta.ocrTargetPages) ? (meta.ocrTargetPages as number[]) : [];
  const ocrCompletedPages = pageInfos.filter((p) => p.ocrApplied).map((p) => p.page);
  const intelArtifact = ebook.resource?.artifacts?.find((a) => a.type === "learn-with-pdf-intelligence");
  const intelContent = (intelArtifact?.content ?? {}) as {
    intelligence?: PdfDocumentIntelligence;
    limitationNote?: string;
    indexedChunkCount?: number;
  };

  return {
    ok: true,
    docId: ebook.id,
    resourceId: ebook.resource?.id ?? null,
    title: intelContent.intelligence?.documentTitle || ebook.title,
    fileName: ebook.originalFileName,
    sizeBytes: ebook.sizeBytes,
    pageCount: ebook.pageCount,
    processingStatus: ebook.processingStatus,
    stage: ebook.processingStatus === "ready" ? "ready" : String(meta.lamPdfStage || "inspecting"),
    errorCode: typeof meta.lamPdfErrorCode === "string" ? meta.lamPdfErrorCode : undefined,
    errorMessage: typeof meta.lamPdfErrorMessage === "string" ? meta.lamPdfErrorMessage : undefined,
    ocrTotal: ocrTargetPages.length,
    ocrCompleted: ocrCompletedPages.length,
    ocrPages: ocrCompletedPages,
    scannedPages,
    mixedPages,
    poorQualityPages,
    limitationNote: intelContent.limitationNote,
    indexedChunkCount: intelContent.indexedChunkCount ?? (typeof meta.indexedChunkCount === "number" ? meta.indexedChunkCount : 0),
    intelligence: intelContent.intelligence ?? null,
  };
}

export async function GET(_request: NextRequest, context: Context) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in to access your PDF." } }, { status: 401, headers: HEADERS });
  }
  const { docId } = await context.params;
  const ebook = await db.customEbook.findFirst({
    where: { id: docId, userId: user.id, deletedAt: null },
    select: {
      id: true,
      title: true,
      originalFileName: true,
      sizeBytes: true,
      pageCount: true,
      processingStatus: true,
      resource: {
        select: {
          id: true,
          state: true,
          sourceMetadata: true,
          artifacts: {
            where: { type: "learn-with-pdf-intelligence" },
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });
  if (!ebook) {
    return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "PDF document not found." } }, { status: 404, headers: HEADERS });
  }
  return NextResponse.json(buildStatusPayload(ebook), { headers: HEADERS });
}

export async function POST(request: NextRequest, context: Context) {
  if (!mutationOrigin(request)) {
    return NextResponse.json({ ok: false, error: { code: "ORIGIN_REJECTED", message: "Open Learn with PDF from Scholar." } }, { status: 403, headers: HEADERS });
  }
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in to process your PDF." } }, { status: 401, headers: HEADERS });
  }
  try {
    await enforceRateLimit(user.id, "lam-pdf-process", 180, 60 * 60 * 1000);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json({ ok: false, error: { code: "RATE_LIMITED", message: "Too many PDF processing steps. Retry shortly." } }, { status: 429, headers: HEADERS });
    }
    return NextResponse.json({ ok: false, error: { code: "ACCESS_CHECK_FAILED", message: "Could not verify rate limit." } }, { status: 503, headers: HEADERS });
  }

  const { docId } = await context.params;
  const ebook = await db.customEbook.findFirst({
    where: { id: docId, userId: user.id, deletedAt: null },
    select: {
      id: true,
      title: true,
      originalFileName: true,
      sizeBytes: true,
      pageCount: true,
      pageTexts: true,
      pdfBytes: true,
      processingStatus: true,
      resource: {
        select: {
          id: true,
          state: true,
          sourceMetadata: true,
          artifacts: {
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  if (!ebook || !ebook.resource) {
    return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "PDF document not found." } }, { status: 404, headers: HEADERS });
  }

  if (ebook.processingStatus === "ready") {
    return NextResponse.json(buildStatusPayload(ebook), { headers: HEADERS });
  }

  const resourceId = ebook.resource.id;
  const meta = { ...((ebook.resource.sourceMetadata ?? {}) as Record<string, unknown>) };
  let stage = String(meta.lamPdfStage || "inspecting");

  // Allow resuming cleanly if previously failed during analysis or OCR
  if (stage === "failed" && typeof meta.lamPdfResumeStage === "string") {
    stage = meta.lamPdfResumeStage;
  }

  const recordFailure = async (code: string, message: string, resumeStage: string, permanent = false) => {
    await db.$transaction(async (tx) => {
      await tx.studyResource.update({
        where: { id: resourceId },
        data: {
          state: permanent ? "REJECTED" : "FAILED",
          sourceMetadata: {
            ...meta,
            lamPdfStage: "failed",
            lamPdfResumeStage: permanent ? "" : resumeStage,
            lamPdfErrorCode: code,
            lamPdfErrorMessage: message,
          } as Prisma.InputJsonValue,
        },
      });
      await tx.customEbook.update({
        where: { id: ebook.id },
        data: { processingStatus: "failed" },
      });
    });
    return NextResponse.json({ ok: false, error: { code, message } }, { status: permanent ? 422 : 502, headers: HEADERS });
  };

  try {
    // ── STAGE 1 & 2: Inspect PDF & Extract Native Text ──
    if (stage === "inspecting" || stage === "extracting") {
      const inspected = await inspectAndExtractNativePdf(ebook.pdfBytes);
      const ocrTargets = Array.from(new Set([...inspected.scannedPages, ...inspected.poorPages])).sort((a, b) => a - b);
      const nextStage = ocrTargets.length > 0 ? "ocr" : "structuring";

      const nextMeta: Record<string, unknown> = {
        ...meta,
        lamPdfStage: nextStage,
        lamPdfErrorCode: null,
        lamPdfErrorMessage: null,
        outline: inspected.outline,
        pageInfos: inspected.pageInfos,
        scannedPages: inspected.scannedPages,
        mixedPages: inspected.mixedPages,
        poorQualityPages: inspected.poorPages,
        ocrTargetPages: ocrTargets,
      };

      const nextTitle = inspected.titleHint || ebook.title;
      await db.$transaction(async (tx) => {
        await tx.customEbook.update({
          where: { id: ebook.id },
          data: {
            title: nextTitle,
            pageCount: inspected.pageCount,
            pageTexts: inspected.pageTexts,
            text: inspected.pageTexts.join("\n\n").slice(0, 500_000),
            processingStatus: "processing",
          },
        });
        await tx.studyResource.update({
          where: { id: resourceId },
          data: {
            title: nextTitle,
            state: "EXTRACTING",
            sourceMetadata: nextMeta as Prisma.InputJsonValue,
          },
        });
      });

      const refreshed = { ...ebook, title: nextTitle, pageCount: inspected.pageCount, processingStatus: "processing", resource: { ...ebook.resource, sourceMetadata: nextMeta } };
      return NextResponse.json(buildStatusPayload(refreshed), { headers: HEADERS });
    }

    // ── STAGE 3: Bounded Real OCR on Scanned / Incomplete Pages ──
    if (stage === "ocr") {
      const currentTexts = Array.isArray(ebook.pageTexts) ? (ebook.pageTexts as string[]) : [];
      const currentInfos = Array.isArray(meta.pageInfos) ? (meta.pageInfos as PdfPageInfo[]) : [];
      const batchResult = await runOcrBatchOnPdf(ebook.pdfBytes, currentTexts, currentInfos, 4);

      const poorPages = batchResult.pageInfos.filter((p) => p.kind === "poor").map((p) => p.page);
      const ocrPages = batchResult.pageInfos.filter((p) => p.ocrApplied).map((p) => p.page);
      const nextStage = batchResult.remainingOcrPages.length > 0 ? "ocr" : "structuring";
      const nextMeta: Record<string, unknown> = {
        ...meta,
        lamPdfStage: nextStage,
        pageInfos: batchResult.pageInfos,
        ocrPages,
        poorQualityPages: poorPages,
      };

      await db.$transaction(async (tx) => {
        await tx.customEbook.update({
          where: { id: ebook.id },
          data: {
            pageTexts: batchResult.pageTexts,
            text: batchResult.pageTexts.join("\n\n").slice(0, 500_000),
          },
        });
        await tx.studyResource.update({
          where: { id: resourceId },
          data: {
            sourceMetadata: nextMeta as Prisma.InputJsonValue,
          },
        });
      });

      const refreshed = { ...ebook, resource: { ...ebook.resource, sourceMetadata: nextMeta } };
      return NextResponse.json(buildStatusPayload(refreshed), { headers: HEADERS });
    }

    // ── STAGE 4: Structure Chapters, Equations, Definitions & Vision Check ──
    if (stage === "structuring") {
      const pageTexts = Array.isArray(ebook.pageTexts) ? (ebook.pageTexts as string[]) : [];
      if (!pageTexts.some((t) => t.trim().length >= 8)) {
        return recordFailure(
          "PDF_NO_EXTRACTABLE_TEXT",
          "No readable text could be extracted or recognized by OCR from this PDF.",
          "ocr",
          true
        );
      }

      const currentInfos = Array.isArray(meta.pageInfos) ? (meta.pageInfos as PdfPageInfo[]) : [];
      const outline = Array.isArray(meta.outline) ? (meta.outline as Array<{ title: string; page: number }>) : [];
      const vision = await interpretKeyDiagramPages(ebook.pdfBytes, pageTexts, currentInfos);
      const structured = structurePdfContent(pageTexts, outline, vision.pageInfos);
      const docHash = computePdfContentHash(pageTexts);

      const nextMeta: Record<string, unknown> = {
        ...meta,
        lamPdfStage: "analyzing",
        pageInfos: vision.pageInfos,
        limitationNote: vision.limitationNote ?? null,
        structuredDigest: {
          chapters: structured.chapters.length,
          equations: structured.equations.length,
          definitions: structured.definitions.length,
          examples: structured.examples.length,
          exercises: structured.exercises.length,
        },
      };

      await db.$transaction(async (tx) => {
        await tx.resourceArtifact.upsert({
          where: {
            resourceId_type_sourceHash: {
              resourceId,
              type: "learn-with-pdf-structured",
              sourceHash: docHash,
            },
          },
          create: {
            resourceId,
            type: "learn-with-pdf-structured",
            sourceHash: docHash,
            generator: "learn-with-pdf-v1",
            content: structured as unknown as Prisma.InputJsonValue,
            references: [] as Prisma.InputJsonValue,
          },
          update: {
            content: structured as unknown as Prisma.InputJsonValue,
          },
        });
        await tx.studyResource.update({
          where: { id: resourceId },
          data: {
            contentHash: docHash,
            state: "CLASSIFYING",
            sourceMetadata: nextMeta as Prisma.InputJsonValue,
          },
        });
      });

      const refreshed = { ...ebook, resource: { ...ebook.resource, sourceMetadata: nextMeta } };
      return NextResponse.json(buildStatusPayload(refreshed), { headers: HEADERS });
    }

    // ── STAGE 5 & 6: AI Document Intelligence + Searchable Chunk Indexing ──
    if (stage === "analyzing" || stage === "indexing") {
      const structuredArt = ebook.resource.artifacts.find((a) => a.type === "learn-with-pdf-structured");
      const structured = structuredArt?.content as StructuredPdfDocument | undefined;
      if (!structured) {
        return recordFailure("PDF_STRUCTURE_MISSING", "Document structure could not be loaded. Retry structuring.", "structuring");
      }

      const scholarClass = meta.grade === 9 ? 9 : 11;
      const goalHint = typeof meta.goalHint === "string" && meta.goalHint.trim() ? meta.goalHint.trim() : undefined;
      const docHash = structuredArt?.sourceHash || computePdfContentHash(structured.pages.map((p) => p.text));

      const intelligence = await analyzeDocumentIntelligence(
        user.id,
        structured,
        ebook.originalFileName,
        scholarClass,
        goalHint,
        AbortSignal.any([request.signal, AbortSignal.timeout(45_000)])
      );

      const chunks = buildSearchableChunks(structured);
      if (!chunks.length) {
        return recordFailure("PDF_NO_EXTRACTABLE_TEXT", "Extracted text was empty and could not be indexed.", "ocr", true);
      }

      const limitationParts: string[] = [];
      if (typeof meta.limitationNote === "string" && meta.limitationNote) {
        limitationParts.push(meta.limitationNote);
      }
      const poor = structured.pageInfos.filter((p) => p.kind === "poor" || Boolean(p.ocrError));
      if (poor.length) {
        limitationParts.push(`Lower extraction confidence on page(s) ${poor.map((p) => p.page).join(", ")} (noisy scan or sparse text).`);
      }
      const limitationNote = limitationParts.length ? limitationParts.join(" ") : undefined;

      const nextMeta: Record<string, unknown> = {
        ...meta,
        lamPdfStage: "ready",
        lamPdfErrorCode: null,
        lamPdfErrorMessage: null,
        indexedChunkCount: chunks.length,
      };

      await db.$transaction(async (tx) => {
        await tx.resourceChunk.deleteMany({ where: { resourceId } });
        await tx.resourceChunk.createMany({
          data: chunks.map((c) => ({
            resourceId,
            ordinal: c.ordinal,
            heading: c.heading,
            text: c.text,
            page: c.page,
          })),
        });
        await tx.resourceArtifact.upsert({
          where: {
            resourceId_type_sourceHash: {
              resourceId,
              type: "learn-with-pdf-intelligence",
              sourceHash: docHash,
            },
          },
          create: {
            resourceId,
            type: "learn-with-pdf-intelligence",
            sourceHash: docHash,
            generator: "learn-with-pdf-v1",
            content: {
              intelligence,
              limitationNote,
              indexedChunkCount: chunks.length,
            } as unknown as Prisma.InputJsonValue,
            references: structured.chapters as unknown as Prisma.InputJsonValue,
          },
          update: {
            content: {
              intelligence,
              limitationNote,
              indexedChunkCount: chunks.length,
            } as unknown as Prisma.InputJsonValue,
            references: structured.chapters as unknown as Prisma.InputJsonValue,
          },
        });
        await tx.studyResource.update({
          where: { id: resourceId },
          data: {
            title: intelligence.documentTitle || ebook.title,
            state: "READY",
            contentHash: docHash,
            sourceMetadata: nextMeta as Prisma.InputJsonValue,
          },
        });
        await tx.customEbook.update({
          where: { id: ebook.id },
          data: {
            title: intelligence.documentTitle || ebook.title,
            processingStatus: "ready",
          },
        });
      }, { timeout: 25_000 });

      const finalStatus = buildStatusPayload({
        ...ebook,
        title: intelligence.documentTitle || ebook.title,
        processingStatus: "ready",
        resource: {
          ...ebook.resource,
          sourceMetadata: nextMeta,
          artifacts: [
            {
              type: "learn-with-pdf-intelligence",
              content: { intelligence, limitationNote, indexedChunkCount: chunks.length },
            },
          ],
        },
      });
      return NextResponse.json(finalStatus, { headers: HEADERS });
    }

    return NextResponse.json(buildStatusPayload(ebook), { headers: HEADERS });
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : "PDF processing failed.";
    if (rawMsg === "PDF_PASSWORD_PROTECTED") {
      return recordFailure("PDF_PASSWORD_PROTECTED", "This PDF is password-protected or encrypted. Remove encryption and upload again.", stage, true);
    }
    if (rawMsg === "PDF_ACTIVE_CONTENT") {
      return recordFailure("PDF_ACTIVE_CONTENT", "This PDF contains embedded JavaScript/active scripts and was blocked for security.", stage, true);
    }
    if (rawMsg === "PDF_CORRUPT" || rawMsg === "PDF_INVALID_SIGNATURE") {
      return recordFailure("PDF_CORRUPT", "The uploaded file is corrupted or not a valid PDF document.", stage, true);
    }
    if (rawMsg === "PDF_EMPTY") {
      return recordFailure("PDF_EMPTY", "This PDF has zero pages.", stage, true);
    }
    if (rawMsg === "PDF_PAGE_LIMIT") {
      return recordFailure("PDF_PAGE_LIMIT", "PDF exceeds the 250-page processing limit.", stage, true);
    }
    if (rawMsg === "PDF_TIMEOUT") {
      return recordFailure("PDF_TIMEOUT", "Document inspection timed out. Retry safely from the checkpoint.", stage, false);
    }
    const aiErr = publicAIError(err);
    return recordFailure("PDF_PROCESSING_FAILED", aiErr.message || "PDF analysis failed. Retry safely.", stage, false);
  }
}
