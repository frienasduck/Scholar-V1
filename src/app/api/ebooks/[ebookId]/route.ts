import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { mutationOrigin } from "@/lib/resources/http";
import { privateScope } from "@/lib/resources/service";
import { processResourceJob } from "@/lib/resources/jobs";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { readBoundedJson, RequestBodyError } from "@/lib/security/request-body";
import { EMPTY_READING, fileDisposition, readingSchema, safeEbookName } from "@/lib/ebooks/contracts";

export const runtime = "nodejs";
export const maxDuration = 60;
type Context = { params: Promise<{ ebookId: string }> };
const headers = { "Cache-Control": "private, no-store" };
const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(), retry: z.literal(true).optional(),
  page: z.number().int().min(1).max(500).optional(),
  bookmark: z.object({ page: z.number().int().min(1).max(500), note: z.string().max(2000).optional(), remove: z.boolean().optional() }).optional(),
  note: z.object({ page: z.number().int().min(1).max(500), text: z.string().max(4000) }).optional(),
}).strict().refine(value => Object.keys(value).length === 1);
function unavailable(error: unknown) {
  if (error instanceof RequestBodyError) return NextResponse.json({ error: error.code, message: error.status === 413 ? "This update is too large. Shorten the note and try again." : "Send one valid book update at a time." }, { status: error.status, headers });
  if (error instanceof RateLimitError) return NextResponse.json({ error: "RATE_LIMITED", message: "Too many updates. Your device changes will retry shortly." }, { status: 429, headers: { ...headers, "Retry-After": String(error.retryAfterSeconds) } });
  console.warn("[Ebook] request failed", { code: error instanceof Error ? error.name : "UNKNOWN" });
  return NextResponse.json({ error: "EBOOK_UNAVAILABLE", message: "Your private E-Book service is temporarily unavailable. Your saved books have not been removed." }, { status: 503, headers });
}

export async function GET(request: NextRequest, context: Context) {
  try {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const { ebookId } = await context.params;
  const ebook = await db.customEbook.findFirst({ where: { id: ebookId, userId: user.id, deletedAt: null }, select: { id: true, title: true, originalFileName: true, sizeBytes: true, pageCount: true, processingStatus: true, readingState: true, createdAt: true, resource: { select: { id: true, sourceMetadata: true } } } });
  if (!ebook) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (!["ready", "needs_ocr"].includes(ebook.processingStatus)) return NextResponse.json({ error: "PDF_NOT_READY", message: "This PDF has not completed safe processing. Check its status in Resources." }, { status: 409 });
  if (request.nextUrl.searchParams.get("file") === "1") {
    const source = await db.customEbook.findFirst({ where: { id: ebookId, userId: user.id, deletedAt: null }, select: { pdfBytes: true } });
    if (!source) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return new Response(source.pdfBytes, { headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": fileDisposition(ebook.originalFileName), "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox", "Cross-Origin-Resource-Policy": "same-origin" } });
  }
  const query = request.nextUrl.searchParams.get("q");
  if (query !== null) {
    if (query.trim().length < 2 || query.length > 160) return NextResponse.json({ results: [] }, { headers });
    const chunks = ebook.resource ? await db.resourceChunk.findMany({ where: { resourceId: ebook.resource.id, resource: privateScope(user.id), text: { contains: query.trim(), mode: "insensitive" } }, select: { page: true, heading: true, text: true }, orderBy: { ordinal: "asc" }, take: 120 }) : [];
    const seen = new Set<number>();
    const results = chunks.flatMap(chunk => {
      if (!chunk.page || seen.has(chunk.page)) return [];
      seen.add(chunk.page);
      const at = chunk.text.toLocaleLowerCase().indexOf(query.trim().toLocaleLowerCase());
      return [{ page: chunk.page, title: chunk.heading, text: chunk.text.slice(Math.max(0, at - 60), Math.max(0, at - 60) + 240) }];
    }).slice(0, 60);
    return NextResponse.json({ results }, { headers });
  }
  const pageQuery = request.nextUrl.searchParams.get("page");
  if (pageQuery !== null) {
    const page = Number(pageQuery);
    if (!Number.isInteger(page) || page < 1 || page > ebook.pageCount) return NextResponse.json({ message: "Choose a page in this book." }, { status: 400 });
    // Prisma binds JS integers as bigint; JSON array operators require int4.
    const rows = await db.$queryRaw<{ text: string | null }[]>`SELECT "pageTexts" ->> CAST(${page - 1} AS integer) AS text FROM "CustomEbook" WHERE "id" = ${ebookId} AND "userId" = ${user.id} AND "deletedAt" IS NULL`;
    return NextResponse.json({ page, text: rows[0]?.text?.slice(0, 20_000) ?? "" }, { headers });
  }
  const reading = readingSchema.safeParse(ebook.readingState);
  const metadata = ebook.resource?.sourceMetadata as { outline?: { title: string; page: number }[] } | undefined;
  return NextResponse.json({ ebook: { ...ebook, resource: undefined, resourceId: ebook.resource?.id, readingState: reading.success ? reading.data : EMPTY_READING, outline: Array.isArray(metadata?.outline) ? metadata.outline : [] } }, { headers });
  } catch (error) { return unavailable(error); }
}

export async function PATCH(request: NextRequest, context: Context) {
  if (!mutationOrigin(request)) return NextResponse.json({ error: "ORIGIN_REJECTED" }, { status: 403 });
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    await enforceRateLimit(user.id, "ebook-update", 120, 60_000);
    const parsed = patchSchema.safeParse(await readBoundedJson(request, 12_000));
    if (!parsed.success) return NextResponse.json({ message: "Choose a valid page, note, bookmark or title." }, { status: 400 });
    const { ebookId } = await context.params;
    const input = parsed.data;
    const result = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "CustomEbook" WHERE "id" = ${ebookId} AND "userId" = ${user.id} AND "deletedAt" IS NULL FOR UPDATE`;
      const book = await tx.customEbook.findFirst({ where: { id: ebookId, userId: user.id, deletedAt: null }, select: { id: true, pageCount: true, processingStatus: true, readingState: true, resource: { select: { id: true, state: true, sourceMetadata: true } } } });
      if (!book) return { status: 404, message: "E-Book not found." };
      if (input.title && book.processingStatus === "processing") return { status: 409, message: "Wait for processing to finish before renaming this book." };
      if (input.retry) {
        if (!book.resource || book.resource.state !== "FAILED") return { status: 409, message: "Only interrupted jobs can be retried. Damaged or protected PDFs must be corrected and uploaded again." };
        const queued = await tx.resourceJob.updateMany({ where: { resourceId: book.resource.id, resource: privateScope(user.id), state: { in: ["FAILED", "QUEUED"] } }, data: { state: "QUEUED", stage: "EXTRACTING", attempts: 0, errorCode: null, leaseToken: null, leaseUntil: null, nextRunAt: new Date() } });
        if (!queued.count) return { status: 409, message: "This job is already running." };
        await tx.studyResource.updateMany({ where: { id: book.resource.id, ...privateScope(user.id) }, data: { state: "EXTRACTING" } });
        await tx.customEbook.update({ where: { id: book.id }, data: { processingStatus: "processing" } });
        return { status: 200, resourceId: book.resource.id };
      }
      if ([input.page, input.bookmark?.page, input.note?.page].some(page => page !== undefined && page > book.pageCount)) return { status: 400, message: "Choose a page in this book." };
      const saved = readingSchema.safeParse(book.readingState);
      const state = saved.success ? saved.data : { ...EMPTY_READING, bookmarks: [], notes: [] };
      if (input.page) { state.page = input.page; state.lastOpenedAt = new Date().toISOString(); }
      if (input.bookmark) {
        const item = input.bookmark;
        const previous = state.bookmarks.find(b => b.page === item.page);
        state.bookmarks = state.bookmarks.filter(b => b.page !== item.page);
        if (!item.remove) state.bookmarks.push({ id: previous?.id ?? crypto.randomUUID(), page: item.page, note: item.note ?? previous?.note, createdAt: previous?.createdAt ?? new Date().toISOString() });
      }
      if (input.note) {
        state.notes = state.notes.filter(n => n.page !== input.note!.page);
        if (input.note.text.trim()) state.notes.push({ ...input.note, updatedAt: new Date().toISOString() });
      }
      await tx.customEbook.update({ where: { id: book.id }, data: { readingState: state as unknown as Prisma.InputJsonValue, ...(input.title ? { title: safeEbookName(input.title) } : {}) } });
      if (input.title && book.resource) await tx.studyResource.update({ where: { id: book.resource.id }, data: { title: safeEbookName(input.title), sourceMetadata: { ...(book.resource.sourceMetadata as Record<string, Prisma.InputJsonValue>), titleUserSet: true } } });
      return { status: 200 };
    });
    if (result.resourceId) after(() => processResourceJob(result.resourceId, user.id).catch(() => console.warn("[Ebook] retry worker unavailable")));
    return NextResponse.json({ ok: result.status === 200, message: result.message }, { status: result.status, headers });
  } catch (error) { return unavailable(error); }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ ebookId: string }> }) {
  if (!mutationOrigin(request)) return NextResponse.json({ error: "ORIGIN_REJECTED" }, { status: 403 });
  try {
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
    return tx.customEbook.updateMany({ where: { id: ebookId, userId: user.id, deletedAt: null }, data: { deletedAt: new Date(), text: "", pageTexts: [], readingState: {}, pdfBytes: Buffer.alloc(0) } });
  });
  if (!result.count) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ ok: true });
  } catch (error) { return unavailable(error); }
}
