import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { lockAccount, ProfileError } from "@/lib/personalization/server";
import { resolveUserEntitlements } from "@/lib/subscriptions/entitlements";
import { extractPdf, renderPdfPage } from "@/lib/resources/pdf";
import { recognizePageImage } from "@/lib/ebooks/ocr";
import { chapterManifest } from "../coverage";
import type { KnowledgeMaterial, KnowledgePassage, Scope } from "./types";

export const MAX_MATERIAL_BYTES = 3 * 1024 * 1024;
export type PrivateMaterialRow = Scope & { id: string; userId: string; title: string; mime: string; sizeBytes: number; contentHash: string; revision: number; fileBytes?: Uint8Array; state: string; pages: string[]; metadata: Record<string, unknown>; attempts: number; leaseToken?: string; errorCode: string | null; updatedAt: Date };
export function validateMaterialFile(bytes: Uint8Array, mime: string) {
  if (!bytes.length || bytes.length > MAX_MATERIAL_BYTES) throw new ProfileError("Choose a nonempty file up to 3 MB.", 413);
  const pdf = new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!(mime === "application/pdf" && pdf || mime === "image/png" && png || mime === "image/jpeg" && jpeg || mime === "text/plain" && !pdf && !png && !jpeg && !bytes.slice(0, 1000).includes(0))) throw new ProfileError("Use a valid PDF, PNG, JPEG or plain-text file; renaming a file does not convert it.", 415);
}
export async function privateMaterials(userId: string, scope: Scope): Promise<PrivateMaterialRow[]> {
  await db.$executeRaw`UPDATE "ExamReadyMaterial" SET "state"='FAILED',"errorCode"='WORKER_INTERRUPTED',"leaseToken"=NULL,"leaseUntil"=NULL WHERE "userId"=${userId} AND "state"='PROCESSING' AND "deletedAt" IS NULL AND "attempts">=3 AND "leaseUntil"<NOW()`;
  return db.$queryRaw<PrivateMaterialRow[]>`SELECT "id","userId","grade","subjectId","chapterId","title","mime","sizeBytes","contentHash","revision","state","metadata","attempts","errorCode","updatedAt", jsonb_build_array() AS "pages" FROM "ExamReadyMaterial" WHERE "userId"=${userId} AND "grade"=${scope.grade} AND "subjectId"=${scope.subjectId} AND "chapterId"=${scope.chapterId} AND "deletedAt" IS NULL ORDER BY "createdAt" DESC LIMIT 40`;
}
export async function privateMaterial(userId: string, id: string, file = false) {
  const rows = file ? await db.$queryRaw<PrivateMaterialRow[]>`SELECT * FROM "ExamReadyMaterial" WHERE "id"=${id} AND "userId"=${userId} AND "deletedAt" IS NULL`
    : await db.$queryRaw<PrivateMaterialRow[]>`SELECT "id","userId","grade","subjectId","chapterId","title","mime","sizeBytes","contentHash","revision","state","pages","metadata","attempts","errorCode","updatedAt" FROM "ExamReadyMaterial" WHERE "id"=${id} AND "userId"=${userId} AND "deletedAt" IS NULL`;
  if (!rows[0]) throw new ProfileError("This private Exam Ready material was not found.", 404);
  return rows[0];
}
export function privateSummary(r: PrivateMaterialRow): KnowledgeMaterial {
  return { id: r.id, title: r.title, description: "Your private Exam Ready material", domain: "EXAM_READY", version: `${r.contentHash}:${r.revision}`, reviewStatus: r.state === "READY" ? "user-provided · not academically certified" : r.state, objectiveIds: [], indexedChunks: Number(r.metadata.indexedPages ?? 0), pages: Number(r.metadata.pageCount ?? 0), canonicalUrl: null, resourceType: "notes", sourceType: "user-upload", publisher: "Your material", language: "en", licenseType: "PRIVATE_USER_UPLOAD", licenseUrl: null, attributionText: "Privately uploaded by you; not published in another Scholar section.", canStoreCopy: true, canGenerateDerivatives: true, ownerUserId: r.userId, visibility: "PRIVATE", state: r.state, qualityStatus: "user-provided", mappings: [{ curriculumId: "cbse", grade: r.grade, subjectId: r.subjectId, chapterId: r.chapterId }], limitations: ["User content can contain mistakes. OCR equations require review."], sourceMetadata: { domain: "EXAM_READY", errorCode: r.errorCode, ...r.metadata } };
}
export async function uploadMaterial(userId: string, scope: Scope, title: string, mime: string, bytes: Uint8Array) {
  try{chapterManifest(scope.grade, scope.subjectId, scope.chapterId);}catch{throw new ProfileError("Choose a registered CBSE chapter before uploading.",422);} validateMaterialFile(bytes, mime);
  const hash = createHash("sha256").update(bytes).digest("hex"), access = await resolveUserEntitlements(userId);
  if (!access.entitlementsLoaded) throw new ProfileError("Your storage allowance could not be verified. Retry after reconnecting.", 503);
  const limit = ["PLUS", "DEVELOPER", "UNLOCKED"].includes(access.plan) ? 20 : 3;
  return db.$transaction(async tx => {
    await lockAccount(tx, userId);
    const existing = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "ExamReadyMaterial" WHERE "userId"=${userId} AND "grade"=${scope.grade} AND "subjectId"=${scope.subjectId} AND "chapterId"=${scope.chapterId} AND "contentHash"=${hash} AND "deletedAt" IS NULL LIMIT 1`;
    if (existing[0]) return existing[0].id;
    const totals = await tx.$queryRaw<{ count: bigint; bytes: bigint }[]>`SELECT COUNT(*) FILTER (WHERE "deletedAt" IS NULL) AS count, COALESCE(SUM("sizeBytes"),0) AS bytes FROM "ExamReadyMaterial" WHERE "userId"=${userId}`;
    if (Number(totals[0]?.count ?? 0) >= limit || Number(totals[0]?.bytes ?? 0) + bytes.length > limit * MAX_MATERIAL_BYTES * 2) throw new ProfileError(`Your private Exam Ready limit is ${limit} active files, up to 3 MB each, with bounded recovery storage. Remove an active file or contact support if retained recovery storage is full.`, 409);
    const id = `er-user-${randomUUID()}`;
    await tx.$executeRaw`INSERT INTO "ExamReadyMaterial" ("id","userId","grade","subjectId","chapterId","title","mime","sizeBytes","contentHash","fileBytes") VALUES (${id},${userId},${scope.grade},${scope.subjectId},${scope.chapterId},${title.slice(0,180)},${mime},${bytes.length},${hash},${Buffer.from(bytes)})`;
    return id;
  });
}
/** One fenced, bounded extraction batch. Successful pages survive interruptions. */
export async function processMaterial(userId: string, id: string) {
  const token = randomUUID();
  const claimed = await db.$executeRaw`UPDATE "ExamReadyMaterial" SET "leaseToken"=${token},"leaseUntil"=NOW()+INTERVAL '65 seconds',"attempts"="attempts"+1 WHERE "id"=${id} AND "userId"=${userId} AND "deletedAt" IS NULL AND "state"='PROCESSING' AND "attempts"<3 AND ("leaseUntil" IS NULL OR "leaseUntil"<NOW())`;
  if (!claimed) return false;
  try {
    const r = await privateMaterial(userId, id, true);
    let pages = r.pages ?? [], pageCount = Number(r.metadata.pageCount ?? 1), complete = true;
    const metadata: Record<string,unknown> = {...r.metadata};
    let pending = Array.isArray(metadata.ocrPending) ? metadata.ocrPending as number[] : [];
    const required = new Set<number>(Array.isArray(metadata.reviewRequiredPages) ? metadata.reviewRequiredPages as number[] : []);
    if (r.mime === "application/pdf" && metadata.extractionComplete !== true) {
      const parsed = await extractPdf(r.fileBytes!, { pages, batchSize: 10 }); pages = parsed.pages; pageCount = parsed.pageCount; complete = parsed.complete;
      if(pages.join("").length>250000) throw new Error("TEXT_LIMIT");
      pending = complete ? pages.flatMap((text,i)=>text.length<30?[i]:[]) : [];
      pending.forEach(i=>required.add(i+1));
      Object.assign(metadata,{pageCount,extractedPages:pages.length,indexedPages:pages.filter(p=>p.trim().length>=30).length,extractionComplete:complete,ocrPending:pending,reviewRequiredPages:[...required]});
      // Save extraction before OCR. An interrupted native worker does not reparse.
      if(!complete || pending.length) {
        await db.$executeRaw`UPDATE "ExamReadyMaterial" SET "pages"=${JSON.stringify(pages)}::jsonb,"metadata"=${JSON.stringify(metadata)}::jsonb,"attempts"=0,"leaseToken"=NULL,"leaseUntil"=NULL,"revision"="revision"+1,"updatedAt"=NOW() WHERE "id"=${id} AND "userId"=${userId} AND "deletedAt" IS NULL AND "leaseToken"=${token}`;
        return true;
      }
    } else if(r.mime === "application/pdf" && pending.length) {
      const index=pending[0];
      try { const ocr=await recognizePageImage(await renderPdfPage(r.fileBytes!,index+1));pages[index]=ocr.text||"";metadata.lastOcrConfidence=ocr.confidence; }
      catch { metadata.ocrFailedPages=[...Array.isArray(metadata.ocrFailedPages)?metadata.ocrFailedPages:[],index+1]; }
      pending=pending.slice(1);metadata.ocrPending=pending;required.add(index+1);
    } else if (r.mime === "text/plain") pages = [new TextDecoder("utf-8", { fatal: true }).decode(r.fileBytes!)];
    else if(r.mime !== "application/pdf") { const ocr=await recognizePageImage(Buffer.from(r.fileBytes!)); pages=[ocr.text];metadata.lastOcrConfidence=ocr.confidence;required.add(1); }
    if(pages.join("").length>250000) throw new Error("TEXT_LIMIT");
    const indexedPages=pages.filter(p=>p.trim().length>=30).length;
    const state=!complete||pending.length ? "PROCESSING" : !indexedPages ? "NEEDS_OCR" : required.size ? "NEEDS_REVIEW" : "READY";
    Object.assign(metadata,{pageCount,extractedPages:pages.length,indexedPages,needsReview:required.size>0,reviewRequiredPages:[...required],extractionComplete:complete});
    await db.$executeRaw`UPDATE "ExamReadyMaterial" SET "pages"=${JSON.stringify(pages)}::jsonb,"metadata"=${JSON.stringify(metadata)}::jsonb,"state"=${state},"attempts"=0,"leaseToken"=NULL,"leaseUntil"=NULL,"revision"="revision"+1,"updatedAt"=NOW() WHERE "id"=${id} AND "userId"=${userId} AND "deletedAt" IS NULL AND "leaseToken"=${token}`;
  } catch (error) {
    const code = error instanceof Error && /^(PDF_|TEXT_LIMIT|OCR_)/.test(error.message) ? error.message : "EXTRACTION_FAILED";
    await db.$executeRaw`UPDATE "ExamReadyMaterial" SET "state"='FAILED',"errorCode"=${code},"leaseToken"=NULL,"leaseUntil"=NULL,"revision"="revision"+1,"updatedAt"=NOW() WHERE "id"=${id} AND "userId"=${userId} AND "deletedAt" IS NULL AND "leaseToken"=${token}`;
  }
  return true;
}
export async function retrievePrivate(userId: string, scope: Scope, ids: string[], excluded: string[], query: string, pageStart?: number, pageEnd?: number): Promise<KnowledgePassage[]> {
  const result: KnowledgePassage[] = [], words = query.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
  for (const id of ids.filter(id => id.startsWith("er-user-") && !excluded.includes(id)).slice(0, 12)) {
    const r = await privateMaterial(userId, id);
    if (r.grade !== scope.grade || r.subjectId !== scope.subjectId || r.chapterId !== scope.chapterId) continue;
    if (r.state !== "READY") continue;
    const pages = r.pages.map((text, i) => ({ text, page: i + 1, score: words.filter(word => text.toLowerCase().includes(word)).length })).filter(p => p.text.length >= 30 && (pageStart === undefined || p.page >= pageStart && p.page <= (pageEnd ?? pageStart)));
    if (pageStart === undefined) pages.sort((a, b) => b.score - a.score || a.page - b.page);
    for (const p of pages.slice(0, 3)) result.push({ citation: { id: "", resourceId: id, title: r.title, publisher: "Your private Exam Ready material", heading: `Page ${p.page}`, page: p.page, url: null }, text: p.text.slice(0, 5000), origin: "USER_UPLOAD", version: `${r.contentHash}:${r.revision}`, objectiveIds: [], reviewStatus: "user-provided" });
  }
  return result.slice(0, 6);
}
