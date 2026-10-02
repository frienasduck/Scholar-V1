import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { checkGrade } from "@/lib/personalization/server";
import { readBoundedJson } from "@/lib/security/request-body";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { findResource, privateScope, resourceChunks, artifact } from "@/lib/resources/service";
import { ARTIFACT_TYPES } from "@/lib/resources/artifacts";
import { validateMapping } from "@/lib/resources/engine";
import { processResourceJob } from "@/lib/resources/jobs";
import { mutationOrigin, resourceError } from "@/lib/resources/http";
export const runtime = "nodejs";
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await getSessionUser(); const { id } = await context.params;
    const resource = await findResource(id, user?.id ?? null);
    if (!resource) return NextResponse.json({ message: "Resource not found." }, { status: 404 });
    const offset = Math.max(0, Math.min(Number(request.nextUrl.searchParams.get("offset")) || 0, 2000));
    const chunks = await resourceChunks(resource, Math.floor(offset), 12);
    const job = resource.visibility === "PRIVATE" ? await db.resourceJob.findFirst({ where: { resourceId: id, resource: privateScope(user!.id) }, select: { state: true, stage: true, attempts: true, errorCode: true } }) : null;
    return NextResponse.json({ resource, chunks, hasMore: chunks.length === 12, job }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return resourceError(error); }
}
export async function POST(request: NextRequest, context: Context) {
  if (!mutationOrigin(request)) return NextResponse.json({ message: "Origin rejected." }, { status: 403 });
  try {
    const user = await getSessionUser(); const { id } = await context.params;
    const resource = await findResource(id, user?.id ?? null);
    if (!resource) return NextResponse.json({ message: "Resource not found." }, { status: 404 });
    const input = z.object({ type: z.enum(ARTIFACT_TYPES) }).safeParse(await readBoundedJson(request, 1024));
    if (!input.success) return NextResponse.json({ message: "Choose a supported study aid." }, { status: 400 });
    if (user) await enforceRateLimit(user.id, "resource-study-aid", 40, 60_000);
    const result = await artifact(resource, input.data.type);
    if (!result) return NextResponse.json({ message: "This source is link-only, not yet indexed, or requires review. Open the original; Scholar will not invent its content." }, { status: 409 });
    return NextResponse.json({ artifact: result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return resourceError(error); }
}
export async function PATCH(request: NextRequest, context: Context) {
  if (!mutationOrigin(request)) return NextResponse.json({ message: "Origin rejected." }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  try {
    await enforceRateLimit(user.id, "resource-update", 30, 60_000);
    const { id } = await context.params; const resource = await db.studyResource.findFirst({ where: { id, ...privateScope(user.id) } });
    if (!resource) return NextResponse.json({ message: "Resource not found." }, { status: 404 });
    const parsed = z.object({ retry: z.boolean().optional(), mapping: z.object({ curriculumId: z.literal("cbse"), grade: z.union([z.literal(9), z.literal(11)]), subjectId: z.string().max(60), chapterId: z.string().max(60), topicId: z.string().max(120).optional() }).optional() }).safeParse(await readBoundedJson(request, 4096));
    if (!parsed.success || !parsed.data.retry && !parsed.data.mapping) return NextResponse.json({ message: "Choose a chapter or retry processing." }, { status: 400 });
    if (parsed.data.mapping) {
      let mapping;
      try { mapping = validateMapping(parsed.data.mapping); } catch { return NextResponse.json({ message: "Choose a valid chapter in the selected class and subject." }, { status: 400 }); }
      await checkGrade(user.id, mapping.grade);
      await db.$transaction(async tx => { await tx.resourceMapping.deleteMany({ where: { resourceId: id, resource: privateScope(user.id) } }); await tx.resourceMapping.create({ data: { ...mapping, resourceId: id } }); await tx.studyResource.updateMany({ where: { id, ...privateScope(user.id) }, data: { confidence: 1, ...(resource.state === "NEEDS_REVIEW" && !(resource.sourceMetadata as { needsOcr?: boolean }).needsOcr ? { state: "READY" } : {}) } }); });
    }
    if (parsed.data.retry) {
      if (resource.state !== "FAILED") return NextResponse.json({ message: "Only failed transient jobs can be retried. Rejected PDFs must be corrected and uploaded again." }, { status: 409 });
      await db.$transaction(async tx => {
        const queued = await tx.resourceJob.updateMany({ where: { resourceId: id, resource: privateScope(user.id), state: { in: ["FAILED", "QUEUED"] } }, data: { state: "QUEUED", attempts: 0, errorCode: null, nextRunAt: new Date(), leaseToken: null, leaseUntil: null } });
        if (queued.count) await tx.studyResource.updateMany({ where: { id, ...privateScope(user.id) }, data: { state: "EXTRACTING" } });
      });
      after(async () => { await processResourceJob(id, user.id).catch(() => false); });
    }
    return NextResponse.json({ ok: true });
  } catch (error) { return resourceError(error); }
}
export async function DELETE(request: NextRequest, context: Context) {
  if (!mutationOrigin(request)) return NextResponse.json({ message: "Origin rejected." }, { status: 403 });
  const user = await getSessionUser(); if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  try {
    const { id } = await context.params;
    await enforceRateLimit(user.id, "resource-delete", 30, 60_000);
    const resource = await db.studyResource.findFirst({ where: { id, ...privateScope(user.id) } });
    if (!resource) return NextResponse.json({ message: "Resource not found." }, { status: 404 });
    await db.$transaction(async tx => {
      await tx.studyResource.updateMany({ where: { id, ...privateScope(user.id) }, data: { deletedAt: new Date(), identityKey: `deleted:${id}`, sourceMetadata: {} } });
      await tx.resourceJob.deleteMany({ where: { resourceId: id } }); await tx.resourceChunk.deleteMany({ where: { resourceId: id } }); await tx.resourceArtifact.deleteMany({ where: { resourceId: id } });
      await tx.storedFile.updateMany({ where: { userId: user.id, clientId: `resource:${id}` }, data: { deletedAt: new Date() } });
      if (resource.ebookId) await tx.customEbook.updateMany({ where: { id: resource.ebookId, userId: user.id }, data: { deletedAt: new Date(), pdfBytes: Buffer.alloc(0), text: "", pageTexts: [] } });
    });
    return NextResponse.json({ ok: true });
  } catch (error) { return resourceError(error); }
}
