import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { fileDisposition, EBOOK_READ_BYTES } from "@/lib/ebooks/contracts";
import { mutationOrigin } from "@/lib/resources/http";
import { renderPdfPage } from "@/lib/resources/pdf";
import type { PdfDocumentIntelligence } from "@/lib/lam/pdf-contracts";

export const runtime = "nodejs";
export const maxDuration = 60;

type Context = { params: Promise<{ docId: string }> };
const HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest, context: Context) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: HEADERS });
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
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: HEADERS });
  }

  // Render an individual owner-authorized page as a crisp PNG for the built-in PDF viewer
  const pageImageParam = request.nextUrl.searchParams.get("pageImage");
  if (pageImageParam !== null) {
    const pageNum = Number(pageImageParam);
    if (!Number.isInteger(pageNum) || pageNum < 1 || (ebook.pageCount > 0 && pageNum > ebook.pageCount)) {
      return NextResponse.json({ ok: false, error: "INVALID_PAGE" }, { status: 400, headers: HEADERS });
    }
    const raw = await db.customEbook.findFirst({
      where: { id: docId, userId: user.id, deletedAt: null },
      select: { pdfBytes: true },
    });
    if (!raw) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: HEADERS });
    }
    try {
      const png = await renderPdfPage(raw.pdfBytes, pageNum);
      return new Response(new Uint8Array(png), {
        status: 200,
        headers: {
          ...HEADERS,
          "Content-Type": "image/png",
          "X-Content-Type-Options": "nosniff",
          "Cross-Origin-Resource-Policy": "same-origin",
        },
      });
    } catch {
      return NextResponse.json({ ok: false, error: "PAGE_RENDER_FAILED" }, { status: 502, headers: HEADERS });
    }
  }

  // Return extracted text for a specific page
  const pageParam = request.nextUrl.searchParams.get("page");
  if (pageParam !== null) {
    const pageNum = Number(pageParam);
    if (!Number.isInteger(pageNum) || pageNum < 1 || (ebook.pageCount > 0 && pageNum > ebook.pageCount)) {
      return NextResponse.json({ ok: false, error: "INVALID_PAGE" }, { status: 400, headers: HEADERS });
    }
    const rows = await db.$queryRaw<Array<{ text: string | null }>>`
      SELECT "pageTexts" ->> CAST(${pageNum - 1} AS integer) AS text
      FROM "CustomEbook"
      WHERE "id" = ${docId} AND "userId" = ${user.id} AND "deletedAt" IS NULL
    `;
    return NextResponse.json({ ok: true, page: pageNum, text: rows[0]?.text ?? "" }, { headers: HEADERS });
  }

  // Range-stream or download private PDF safely (for up to 25 MB documents)
  if (request.nextUrl.searchParams.get("file") === "1") {
    const offsetQuery = request.nextUrl.searchParams.get("offset");
    if (offsetQuery !== null) {
      const offset = Number(offsetQuery);
      if (!/^\d+$/.test(offsetQuery) || !Number.isSafeInteger(offset) || offset < 0 || offset >= ebook.sizeBytes) {
        return NextResponse.json({ ok: false, error: "INVALID_RANGE" }, { status: 416, headers: HEADERS });
      }
      const rows = await db.$queryRaw<Array<{ bytes: Uint8Array }>>`
        SELECT substring("pdfBytes" from CAST(${offset + 1} AS integer) for CAST(${EBOOK_READ_BYTES} AS integer)) AS bytes
        FROM "CustomEbook"
        WHERE "id" = ${docId} AND "userId" = ${user.id} AND "deletedAt" IS NULL
      `;
      const chunk = rows[0]?.bytes;
      if (!chunk?.length) {
        return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: HEADERS });
      }
      return new Response(Buffer.from(chunk), {
        status: 206,
        headers: {
          ...HEADERS,
          "Content-Type": "application/pdf",
          "Content-Range": `bytes ${offset}-${offset + chunk.length - 1}/${ebook.sizeBytes}`,
          "Content-Length": String(chunk.length),
          "X-Content-Type-Options": "nosniff",
          "Cross-Origin-Resource-Policy": "same-origin",
        },
      });
    }
    if (ebook.sizeBytes > 4 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "CHUNKED_READ_REQUIRED" }, { status: 413, headers: HEADERS });
    }
    const raw = await db.customEbook.findFirst({
      where: { id: docId, userId: user.id, deletedAt: null },
      select: { pdfBytes: true },
    });
    if (!raw) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: HEADERS });
    return new Response(raw.pdfBytes, {
      status: 200,
      headers: {
        ...HEADERS,
        "Content-Type": "application/pdf",
        "Content-Disposition": fileDisposition(ebook.originalFileName),
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  }

  const artContent = (ebook.resource?.artifacts[0]?.content ?? {}) as {
    intelligence?: PdfDocumentIntelligence;
    limitationNote?: string;
    indexedChunkCount?: number;
  };
  return NextResponse.json(
    {
      ok: true,
      docId: ebook.id,
      resourceId: ebook.resource?.id ?? null,
      title: artContent.intelligence?.documentTitle || ebook.title,
      fileName: ebook.originalFileName,
      sizeBytes: ebook.sizeBytes,
      pageCount: ebook.pageCount,
      processingStatus: ebook.processingStatus,
      intelligence: artContent.intelligence ?? null,
      limitationNote: artContent.limitationNote,
      indexedChunkCount: artContent.indexedChunkCount ?? 0,
    },
    { headers: HEADERS }
  );
}

/** Delete user's uploaded PDF and all associated extracted data, chunks, and intelligence artifacts. */
export async function DELETE(request: NextRequest, context: Context) {
  if (!mutationOrigin(request)) {
    return NextResponse.json({ ok: false, error: "ORIGIN_REJECTED" }, { status: 403, headers: HEADERS });
  }
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: HEADERS });
  }
  const { docId } = await context.params;

  const owned = await db.customEbook.findFirst({
    where: { id: docId, userId: user.id, deletedAt: null },
    select: { id: true, resource: { select: { id: true } } },
  });
  if (!owned) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: HEADERS });
  }

  await db.$transaction(async (tx) => {
    if (owned.resource?.id) {
      await tx.resourceChunk.deleteMany({ where: { resourceId: owned.resource.id } });
      await tx.resourceArtifact.deleteMany({ where: { resourceId: owned.resource.id } });
      await tx.studyResource.deleteMany({ where: { id: owned.resource.id, ownerUserId: user.id } });
    }
    await tx.customEbook.deleteMany({ where: { id: owned.id, userId: user.id } });
  });

  return NextResponse.json({ ok: true, deleted: true }, { headers: HEADERS });
}
