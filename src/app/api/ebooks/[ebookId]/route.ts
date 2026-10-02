import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { mutationOrigin } from "@/lib/resources/http";
import { privateScope } from "@/lib/resources/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ ebookId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const { ebookId } = await context.params;
  const ebook = await db.customEbook.findFirst({ where: { id: ebookId, userId: user.id, deletedAt: null } });
  if (!ebook) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (!["ready", "needs_ocr"].includes(ebook.processingStatus)) return NextResponse.json({ error: "PDF_NOT_READY", message: "This PDF has not completed safe processing. Check its status in Resources." }, { status: 409 });
  if (request.nextUrl.searchParams.get("file") === "1") {
    return new Response(ebook.pdfBytes, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${ebook.originalFileName.replace(/["\\\r\n]/g, "")}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox", "Cross-Origin-Resource-Policy": "same-origin" } });
  }
  return NextResponse.json({ ebook: { id: ebook.id, title: ebook.title, originalFileName: ebook.originalFileName, sizeBytes: ebook.sizeBytes, pageCount: ebook.pageCount, processingStatus: ebook.processingStatus, text: ebook.text, pageTexts: ebook.pageTexts, createdAt: ebook.createdAt } }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ ebookId: string }> }) {
  if (!mutationOrigin(request)) return NextResponse.json({ error: "ORIGIN_REJECTED" }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const { ebookId } = await context.params;
  const result = await db.$transaction(async tx => {
    const resource = await tx.studyResource.findFirst({ where: { ebookId, ...privateScope(user.id) } });
    if (resource) {
      await tx.studyResource.updateMany({ where: { id: resource.id, ...privateScope(user.id) }, data: { deletedAt: new Date(), identityKey: `deleted:${resource.id}`, sourceMetadata: {} } });
      await tx.resourceJob.deleteMany({ where: { resourceId: resource.id } });
      await tx.resourceChunk.deleteMany({ where: { resourceId: resource.id } });
      await tx.resourceArtifact.deleteMany({ where: { resourceId: resource.id } });
    }
    return tx.customEbook.updateMany({ where: { id: ebookId, userId: user.id, deletedAt: null }, data: { deletedAt: new Date(), text: "", pageTexts: [], pdfBytes: Buffer.alloc(0) } });
  });
  if (!result.count) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
