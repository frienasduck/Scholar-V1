import { after } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { checkGrade } from "@/lib/personalization/server";
import { readBoundedJson } from "@/lib/security/request-body";
import { db } from "@/lib/db";
import { authorized, fail, reply } from "@/lib/exam-ready/http";
import { examAccess } from "@/lib/exam-ready/access";
import { findUnit, findLicensed, unitPassage } from "@/lib/exam-ready/knowledge/library";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { privateMaterial, privateSummary, processMaterial } from "@/lib/exam-ready/knowledge/private-materials";
type Context = { params: Promise<{ materialId: string }> };
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request, ctx: Context) {
  try {
    const id = (await ctx.params).materialId, unit = findUnit(id), user = await getSessionUser();
    if (unit) {
      if (!(await examAccess(user?.id ?? null)).allowed || !user && unit.grade === 9) return reply({ message: "Material unavailable." }, 403);
      if (user) await checkGrade(user.id, unit.grade);
      return reply({ id, text: unitPassage(unit, "S1").text, references: unit.references, reviewStatus: unit.reviewStatus, limitations: ["Original topic-level material, not a full chapter or official question paper."] });
    }
    const licensed = findLicensed(id);
    if(licensed) {
      if(!(await examAccess(user?.id??null)).allowed || !user && licensed.grade===9) return reply({message:"Material unavailable."},403);
      if(user) await checkGrade(user.id,licensed.grade);
      const licenseText = await readFile(join(process.cwd(),"src/lib/exam-ready/knowledge/PSF-LICENSE.txt"),"utf8");
      return reply({id,text:licensed.sections.map(s=>`${s.heading}\n\n${s.text}`).join("\n\n")+`\n\n${licensed.attribution}\n\n${licensed.changes}\n\n${licenseText}`,version:licensed.version,licenseUrl:licensed.licenseUrl});
    }
    const auth = await authorized(request), r = await privateMaterial(auth.id, id, new URL(request.url).searchParams.has("file"));
    await checkGrade(auth.id, r.grade);
    if (r.fileBytes) {
      if(r.mime==="application/pdf"&&r.metadata.extractionComplete!==true) return reply({message:"Wait for PDF validation to finish before opening the original file."},409);
      if(r.errorCode==="PDF_ACTIVE_CONTENT") return reply({message:"This PDF contains active scripts and cannot be opened in Scholar."},415);
      return new Response(Uint8Array.from(r.fileBytes), { headers: { "Content-Type": r.mime, "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(r.title.replace(/[\r\n]/g, " "))}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'" } });
    }
    const page=Number(new URL(request.url).searchParams.get("page")??1);
    if(!Number.isInteger(page)||page<1||page>Math.max(1,r.pages.length)) return reply({message:"Choose an extracted page in this material."},422);
    return reply({ material: privateSummary(r), pages: r.pages.length?[r.pages[page-1]]:[],page,totalPages:r.pages.length,errorCode: r.errorCode });
  } catch (e) { return fail(e); }
}
export async function PATCH(request: Request, ctx: Context) {
  try {
    const user = await authorized(request, true), id = (await ctx.params).materialId;
    const body = z.discriminatedUnion("action", [z.object({ action: z.literal("rename"), title: z.string().trim().min(1).max(180) }), z.object({ action: z.literal("retry") }), z.object({ action: z.literal("review"), page: z.number().int().min(1).max(3000), text: z.string().trim().min(30).max(20000) })]).parse(await readBoundedJson(request, 24000));
    const r = await privateMaterial(user.id, id); await checkGrade(user.id, r.grade);
    if (body.action === "rename") await db.$executeRaw`UPDATE "ExamReadyMaterial" SET "title"=${body.title},"revision"="revision"+1,"updatedAt"=NOW() WHERE "id"=${id} AND "userId"=${user.id} AND "deletedAt" IS NULL`;
    if (body.action === "retry") {
      const metadata={...r.metadata,ocrPending:r.pages.flatMap((text,i)=>text.length<30?[i]:[])};
      await db.$executeRaw`UPDATE "ExamReadyMaterial" SET "state"='PROCESSING',"attempts"=0,"leaseToken"=NULL,"leaseUntil"=NULL,"errorCode"=NULL,"metadata"=${JSON.stringify(metadata)}::jsonb,"revision"="revision"+1,"updatedAt"=NOW() WHERE "id"=${id} AND "userId"=${user.id} AND "deletedAt" IS NULL AND "state" IN ('FAILED','NEEDS_OCR')`;
      after(() => processMaterial(user.id, id).then(() => undefined));
    }
    if (body.action === "review") {
      if (body.page > r.pages.length || r.metadata.extractionComplete !== true) return reply({ message: "Wait for extraction to complete, then review a real page." }, 409);
      const pages = [...r.pages]; pages[body.page - 1] = body.text;
      const reviewedPages = [...new Set([...(Array.isArray(r.metadata.reviewedPages) ? r.metadata.reviewedPages : []), body.page])];
      const required=Array.isArray(r.metadata.reviewRequiredPages)?r.metadata.reviewRequiredPages:pages.map((_,i)=>i+1);
      const state = pages.every(p=>p.length>=30) && required.every(page=>reviewedPages.includes(page)) ? "READY" : "NEEDS_REVIEW";
      const metadata = { ...r.metadata, reviewedPages, needsReview: state !== "READY", indexedPages: pages.filter(p => p.length >= 30).length };
      await db.$executeRaw`UPDATE "ExamReadyMaterial" SET "pages"=${JSON.stringify(pages)}::jsonb,"metadata"=${JSON.stringify(metadata)}::jsonb,"state"=${state},"revision"="revision"+1,"updatedAt"=NOW() WHERE "id"=${id} AND "userId"=${user.id} AND "deletedAt" IS NULL AND "revision"=${r.revision}`;
    }
    return reply({ material: privateSummary(await privateMaterial(user.id, id)) });
  } catch (e) { return fail(e); }
}
export async function DELETE(request: Request, ctx: Context) {
  try {
    const user = await authorized(request, true), id = (await ctx.params).materialId;
    await privateMaterial(user.id, id);
    // Soft deletion blocks all reads and fences in-flight extraction immediately.
    await db.$executeRaw`UPDATE "ExamReadyMaterial" SET "deletedAt"=NOW(),"leaseToken"=NULL,"leaseUntil"=NULL,"revision"="revision"+1,"updatedAt"=NOW() WHERE "id"=${id} AND "userId"=${user.id} AND "deletedAt" IS NULL`;
    return reply({ removed: true, message: "Removed from active Exam Ready retrieval. Original storage is retained for recovery; it is not publicly accessible." });
  } catch (e) { return fail(e); }
}
