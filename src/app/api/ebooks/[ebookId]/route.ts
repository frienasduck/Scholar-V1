import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ ebookId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const { ebookId } = await context.params;
  const ebook = await db.customEbook.findFirst({ where: { id: ebookId, userId: user.id, deletedAt: null } });
  if (!ebook) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (request.nextUrl.searchParams.get("file") === "1") {
    return new Response(ebook.pdfBytes, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${ebook.originalFileName.replace(/["\\]/g, "")}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  }
  return NextResponse.json({ ebook: { id: ebook.id, title: ebook.title, originalFileName: ebook.originalFileName, sizeBytes: ebook.sizeBytes, pageCount: ebook.pageCount, processingStatus: ebook.processingStatus, text: ebook.text, pageTexts: ebook.pageTexts, createdAt: ebook.createdAt } }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ ebookId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const { ebookId } = await context.params;
  const result = await db.customEbook.updateMany({ where: { id: ebookId, userId: user.id, deletedAt: null }, data: { deletedAt: new Date() } });
  if (!result.count) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
