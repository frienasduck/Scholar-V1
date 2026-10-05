import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { chunkSections, classify, contentHash } from "./engine";
import { extractPdf } from "./pdf";
import { privateScope } from "./service";
import type { SourceSection } from "./types";

/** One bounded durable job per invocation. A token-checked lease fences stale workers. */
export async function processResourceJob(resourceId?: string, ownerUserId?: string) {
  const now = new Date();
  // A process killed on its last attempt must not leave a permanent RUNNING badge.
  await db.$transaction(async tx => {
    const exhausted = await tx.resourceJob.findMany({ where: { state: "RUNNING", attempts: { gte: 3 }, leaseUntil: { lt: now }, resource: { deletedAt: null, visibility: "PRIVATE", ...(ownerUserId ? { ownerUserId } : {}) }, ...(resourceId ? { resourceId } : {}) }, select: { id: true, resourceId: true }, take: 10 });
    for (const stale of exhausted) {
      const fenced = await tx.resourceJob.updateMany({ where: { id: stale.id, state: "RUNNING", attempts: { gte: 3 }, leaseUntil: { lt: now } }, data: { state: "FAILED", stage: "FAILED", errorCode: "WORKER_INTERRUPTED", leaseToken: null, leaseUntil: null } });
      if (fenced.count) {
        await tx.studyResource.updateMany({ where: { id: stale.resourceId, deletedAt: null }, data: { state: "FAILED" } });
        await tx.customEbook.updateMany({ where: { resource: { id: stale.resourceId }, deletedAt: null }, data: { processingStatus: "failed" } });
      }
    }
  });
  const eligible: Prisma.ResourceJobWhereInput = { attempts: { lt: 3 }, resource: { deletedAt: null, visibility: "PRIVATE", ...(ownerUserId ? { ownerUserId } : {}) }, ...(resourceId ? { resourceId } : {}),
    OR: [{ state: "QUEUED", nextRunAt: { lte: now } }, { state: "RUNNING", leaseUntil: { lt: now } }] };
  const job = await db.resourceJob.findFirst({ where: eligible, orderBy: { nextRunAt: "asc" } });
  if (!job) return false;
  const leaseToken = randomUUID();
  const claimed = await db.resourceJob.updateMany({ where: { id: job.id, ...eligible }, data: { state: "RUNNING", attempts: { increment: 1 }, leaseToken, leaseUntil: new Date(Date.now() + 60_000), stage: "EXTRACTING", errorCode: null } });
  if (!claimed.count) return false;
  const resource = await db.studyResource.findFirst({ where: { id: job.resourceId, deletedAt: null, visibility: "PRIVATE", ...(ownerUserId ? { ownerUserId } : {}) }, include: { ebook: true, mappings: true } });
  if (!resource?.ownerUserId) return false;
  let metadata = resource.sourceMetadata as Record<string, unknown>;
  console.info("[Resource job] started", { id: resource.id, stage: metadata.extractionComplete ? "INDEXING" : "EXTRACTING", attempt: job.attempts + 1 });
  async function advance(stage: "CLASSIFYING" | "INDEXING", checkpoint?: Prisma.CustomEbookUpdateInput) {
    return db.$transaction(async tx => {
      const fenced = await tx.resourceJob.updateMany({ where: { id: job!.id, state: "RUNNING", leaseToken }, data: { stage } });
      if (!fenced.count) return false;
      const current = await tx.studyResource.updateMany({ where: { id: resource!.id, ...privateScope(resource!.ownerUserId!) }, data: { state: stage, ...(checkpoint ? { sourceMetadata: { ...metadata, extractionComplete: true } as Prisma.InputJsonValue, ...(typeof checkpoint.title === "string" ? { title: checkpoint.title } : {}) } : {}) } });
      if (!current.count) return false;
      if (checkpoint) await tx.customEbook.updateMany({ where: { id: resource!.ebookId!, userId: resource!.ownerUserId!, deletedAt: null }, data: { ...checkpoint, processingStatus: "processing" } });
      return true;
    });
  }
  try {
    let sections: SourceSection[] = (metadata.sections as SourceSection[] | undefined) ?? [];
    let bookData: Prisma.CustomEbookUpdateInput | undefined;
    if (resource.ebook) {
      // Persist successful extraction before indexing. A database/index retry must
      // not re-parse the same PDF or consume another upload allocation.
      const pages = resource.ebook.pageTexts as string[];
      const pdf = metadata.extractionComplete && Array.isArray(pages) && pages.length
        ? { pages, pageCount: resource.ebook.pageCount, text: resource.ebook.text, needsOcr: Boolean(metadata.needsOcr), complete: true, title: undefined, outline: metadata.outline }
        : await extractPdf(resource.ebook.pdfBytes, { pages: metadata.extractedPages && Array.isArray(pages) ? pages : [], batchSize: 30, checkpoint: async checkpoint => {
          const saved = await db.$transaction(async tx => {
            const fenced = await tx.resourceJob.updateMany({ where: { id: job.id, state: "RUNNING", leaseToken }, data: { stage: "EXTRACTING" } });
            if (!fenced.count) return false;
            await tx.customEbook.updateMany({ where: { id: resource.ebookId!, userId: resource.ownerUserId!, deletedAt: null }, data: { pageTexts: checkpoint.pages, pageCount: checkpoint.pageCount } });
            metadata = { ...metadata, extractedPages: checkpoint.pages.length };
            await tx.studyResource.updateMany({ where: { id: resource.id, ...privateScope(resource.ownerUserId!) }, data: { sourceMetadata: metadata as Prisma.InputJsonValue } });
            return true;
          });
          if (!saved) throw new Error("LEASE_LOST");
        } });
      if (pdf.complete === false) {
        await db.$transaction(async tx => {
          const fenced = await tx.resourceJob.updateMany({ where: { id: job.id, state: "RUNNING", leaseToken }, data: { state: "QUEUED", attempts: 0, stage: "EXTRACTING", nextRunAt: new Date(), leaseToken: null, leaseUntil: null } });
          if (!fenced.count) return;
          await tx.customEbook.updateMany({ where: { id: resource.ebookId!, userId: resource.ownerUserId!, deletedAt: null }, data: { pageTexts: pdf.pages, pageCount: pdf.pageCount } });
          await tx.studyResource.updateMany({ where: { id: resource.id, ...privateScope(resource.ownerUserId!) }, data: { sourceMetadata: { ...metadata, extractedPages: pdf.pages.length } as Prisma.InputJsonValue } });
        });
        return true;
      }
      metadata = { ...metadata, needsOcr: pdf.needsOcr, outline: pdf.outline ?? [], extractedPages: pdf.pages.length };
      if (pdf.needsOcr && !pdf.pages.some(text => text.length >= 30)) {
        await db.$transaction(async tx => {
          const claim = await tx.resourceJob.updateMany({ where: { id: job.id, state: "RUNNING", leaseToken }, data: { state: "DONE", stage: "NEEDS_OCR", leaseToken: null, leaseUntil: null } });
          if (!claim.count) return;
          await tx.studyResource.updateMany({ where: { id: resource.id, ...privateScope(resource.ownerUserId!) }, data: { state: "NEEDS_REVIEW", sourceMetadata: { ...metadata, needsOcr: true, review: "Scanned pages need OCR. No complete text index or study aids are claimed." } as Prisma.InputJsonValue } });
          await tx.customEbook.updateMany({ where: { id: resource.ebookId!, userId: resource.ownerUserId!, deletedAt: null }, data: { processingStatus: "needs_ocr", pageCount: pdf.pageCount, text: pdf.text, pageTexts: pdf.pages } });
        });
        return true;
      }
      sections = pdf.pages.flatMap((text, i) => text.length >= 30 ? [{ heading: `Page ${i + 1}`, text, page: i + 1 }] : []);
      bookData = { processingStatus: pdf.needsOcr ? "needs_ocr" : "ready", pageCount: pdf.pageCount, text: pdf.text, pageTexts: pdf.pages, ...(pdf.title && !metadata.titleUserSet ? { title: pdf.title.replace(/[\u0000-\u001f]/g, " ") } : {}) };
    }
    if (!sections.length) throw new Error("NO_EXTRACTABLE_TEXT");
    if (!await advance("CLASSIFYING", bookData)) return true;
    if (bookData) metadata = { ...metadata, extractionComplete: true };
    const classification = resource.mappings.length ? { mappings: [], confidence: 1 } : classify(resource.title, sections.map(s => s.text).join("\n"), metadata.grade === 9 ? 9 : 11);
    const chunks = chunkSections(sections);
    const state = resource.mappings.length || classification.mappings.length ? "READY" : "NEEDS_REVIEW";
    if (!await advance("INDEXING")) return true;
    const published = await db.$transaction(async tx => {
      const claim = await tx.resourceJob.updateMany({ where: { id: job.id, state: "RUNNING", leaseToken }, data: { state: "DONE", stage: state, leaseToken: null, leaseUntil: null } });
      if (!claim.count || !await tx.studyResource.findFirst({ where: { id: resource.id, ...privateScope(resource.ownerUserId!) } })) return;
      await tx.resourceChunk.deleteMany({ where: { resourceId: resource.id } });
      await tx.resourceArtifact.deleteMany({ where: { resourceId: resource.id } });
      await tx.resourceChunk.createMany({ data: chunks.map(c => ({ ...c, resourceId: resource.id })) });
      if (classification.mappings.length) await tx.resourceMapping.createMany({ data: classification.mappings.map(m => ({ ...m, resourceId: resource.id })) });
      const { sections: _pendingText, ...safeMetadata } = metadata;
      await tx.studyResource.update({ where: { id: resource.id }, data: { state, confidence: classification.confidence, contentHash: contentHash(sections.map(s => s.text).join("\n")), sourceMetadata: { ...safeMetadata, review: state === "NEEDS_REVIEW" ? "Choose a chapter to improve recommendations." : null } as Prisma.InputJsonValue } });
      if (bookData) await tx.customEbook.update({ where: { id: resource.ebookId! }, data: bookData });
      return true;
    }, { timeout: 15_000 });
    if (published) console.info("[Resource job] completed", { id: resource.id, state, chunks: chunks.length });
  } catch (error) {
    if (error instanceof Error && error.message === "LEASE_LOST") return true;
    const code = error instanceof Error && /^(PDF_|NO_EXTRACTABLE)/.test(error.message) ? error.message : "EXTRACTION_UNAVAILABLE";
    const permanent = code !== "EXTRACTION_UNAVAILABLE" && code !== "PDF_TIMEOUT";
    await db.$transaction(async tx => {
      const claim = await tx.resourceJob.updateMany({ where: { id: job.id, state: "RUNNING", leaseToken }, data: { state: permanent || job.attempts >= 2 ? "FAILED" : "QUEUED", stage: "FAILED", errorCode: code, leaseToken: null, leaseUntil: null, nextRunAt: new Date(Date.now() + 30_000 * (job.attempts + 1)) } });
      if (!claim.count) return;
      await tx.studyResource.updateMany({ where: { id: resource.id, ...privateScope(resource.ownerUserId!) }, data: { state: permanent ? "REJECTED" : "FAILED" } });
      if (resource.ebookId) await tx.customEbook.updateMany({ where: { id: resource.ebookId, deletedAt: null }, data: { processingStatus: permanent || job.attempts >= 2 ? "failed" : "processing" } });
      // Refund only definitively invalid PDFs, exactly once under the job lease.
      if (permanent && resource.ebook && !metadata.refunded && !metadata.legacy) {
        if (resource.ebook.allocation === "onboarding") {
          await tx.learningProfile.updateMany({ where: { userId: resource.ownerUserId!, bonusUsedBytes: { gte: resource.ebook.sizeBytes } }, data: { bonusUsedBytes: { decrement: resource.ebook.sizeBytes } } });
        } else if (typeof metadata.usageKey === "string") {
          const event = await tx.usageEvent.findUnique({ where: { idempotencyKey: metadata.usageKey } });
          if (event?.status === "consumed" && event.userId === resource.ownerUserId) {
            const refund = await tx.usageEvent.updateMany({ where: { id: event.id, status: "consumed" }, data: { status: "released" } });
            if (refund.count) await tx.usageCounter.updateMany({ where: { userId: resource.ownerUserId, key: "custom_ebook_upload_monthly", day: event.periodDay, count: { gte: event.units } }, data: { count: { decrement: event.units } } });
          }
        }
        await tx.studyResource.update({ where: { id: resource.id }, data: { sourceMetadata: { ...metadata, refunded: true } as Prisma.InputJsonValue } });
      }
    });
    console.warn("[Resource job] failed", { id: resource.id, code,
      type: error instanceof Error ? error.name : "Unknown",
      runtimeCode: error && typeof error === "object" && "code" in error && typeof error.code === "string" && /^[A-Z_]{1,60}$/.test(error.code) ? error.code : undefined,
      frames: error instanceof Error ? error.stack?.split("\n").filter(line => /^\s+at /.test(line)).slice(0, 5) : undefined,
    });
  }
  return true;
}
