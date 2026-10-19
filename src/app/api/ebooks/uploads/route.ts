import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { mutationOrigin } from "@/lib/resources/http";
import { readBoundedBytes, readBoundedJson, RequestBodyError } from "@/lib/security/request-body";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { resolveUserEntitlements } from "@/lib/subscriptions/entitlements";
import { checkGrade } from "@/lib/personalization/server";
import { privateStorageUsed } from "@/lib/ebooks/storage";
import { EBOOK_CHUNK_BYTES, MAX_EBOOK_BYTES, pdfValidation, safeEbookName } from "@/lib/ebooks/contracts";
import { saveEbookUpload } from "@/lib/ebooks/save-upload";

export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
const startSchema = z.object({ key: z.string().regex(/^[a-zA-Z0-9-]{16,100}$/), name: z.string().min(1).max(180), title: z.string().max(120), size: z.number().int().min(5).max(MAX_EBOOK_BYTES) }).strict();
class UploadError extends Error { constructor(message: string, public status = 409) { super(message); } }
function fail(error: unknown) {
  if (error instanceof UploadError) return NextResponse.json({ message: error.message }, { status: error.status, headers });
  if (error instanceof RequestBodyError) return NextResponse.json({ message: "The upload request is invalid or too large. Retry the same PDF." }, { status: error.status, headers });
  if (error instanceof RateLimitError) return NextResponse.json({ message: "Too many upload requests. Try again later." }, { status: 429, headers });
  console.warn("[Ebook transfer] unavailable", { code: error instanceof Error ? error.name : "UNKNOWN" });
  return NextResponse.json({ message: "Upload interrupted. Retry the same file to resume safely." }, { status: 503, headers });
}
async function actor(request: NextRequest) {
  if (!mutationOrigin(request)) throw new UploadError("This upload request is not allowed.", 403);
  const user = await getSessionUser();
  if (!user) throw new UploadError("Sign in to upload a private E-Book.", 401);
  return user;
}
const summary = { id: true, userId: true, key: true, name: true, title: true, totalBytes: true, receivedBytes: true, status: true, lastOffset: true, lastDigest: true, expiresAt: true, result: true, leaseUntil: true } as const;

export async function POST(request: NextRequest) {
  try {
    const user = await actor(request);
    const body = await readBoundedJson(request, 4096);
    const finish = z.object({ finish: z.string().min(1).max(100) }).strict().safeParse(body);
    if (finish.success) {
      const row = await db.ebookUpload.findFirst({ where: { id: finish.data.finish, userId: user.id, expiresAt: { gt: new Date() } }, select: summary });
      if (!row) throw new UploadError("This upload expired or is unavailable. Choose the PDF again.", 404);
      if (row.status === "done") return NextResponse.json(row.result, { headers });
      if (row.receivedBytes !== row.totalBytes) throw new UploadError("The PDF transfer is incomplete. Retry to resume.");
      const claimed = await db.ebookUpload.updateMany({ where: { id: row.id, userId: user.id, OR: [{ status: "uploading" }, { status: "finalizing", leaseUntil: { lt: new Date() } }] }, data: { status: "finalizing", leaseUntil: new Date(Date.now() + 120_000) } });
      if (!claimed.count) throw new UploadError("This upload is already being saved. Retry shortly.");
      try {
        const data = await db.ebookUpload.findFirst({ where: { id: row.id, userId: user.id }, select: { bytes: true } });
        if (!data || data.bytes.length !== row.totalBytes) throw new UploadError("The transfer could not be verified. Choose the PDF again.");
        const forwardHeaders = new Headers(request.headers); forwardHeaders.set("x-idempotency-key", row.key);
        const response = await saveEbookUpload(new NextRequest(request.url, { method: "POST", headers: forwardHeaders }), { file: new File([data.bytes], row.name, { type: "application/pdf" }), title: row.title });
        const result = await response.json();
        await db.ebookUpload.updateMany({ where: { id: row.id, userId: user.id, status: "finalizing" }, data: response.ok ? { status: "done", bytes: Buffer.alloc(0), result: result as Prisma.InputJsonValue, leaseUntil: null } : { status: "uploading", leaseUntil: null } });
        return NextResponse.json(result, { status: response.status, headers });
      } catch (error) {
        await db.ebookUpload.updateMany({ where: { id: row.id, userId: user.id, status: "finalizing" }, data: { status: "uploading", leaseUntil: null } }).catch(() => undefined);
        throw error;
      }
    }
    const input = startSchema.safeParse(body);
    if (!input.success) throw new UploadError("Choose a PDF up to 20 MB with a valid upload reference.", 400);
    const invalid = pdfValidation({ name: input.data.name, type: "application/pdf", size: input.data.size });
    if (invalid) throw new UploadError(invalid, 400);
    await checkGrade(user.id, user.currentScholarClass === 9 ? 9 : 11);
    await enforceRateLimit(user.id, "ebook-transfer-start", 24, 60 * 60 * 1000);
    const access = await resolveUserEntitlements(user.id);
    // Expired transfer buffers are temporary, not saved books or user work.
    await db.ebookUpload.deleteMany({ where: { expiresAt: { lte: new Date() } } });
    const row = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${user.id} FOR UPDATE`;
      const previous = await tx.ebookUpload.findUnique({ where: { userId_key: { userId: user.id, key: input.data.key } }, select: summary });
      if (previous) {
        if (previous.name !== safeEbookName(input.data.name) || previous.totalBytes !== input.data.size) throw new UploadError("This reference belongs to another file. Choose the PDF again.");
        return previous;
      }
      const pending = await tx.ebookUpload.findMany({ where: { userId: user.id, status: { in: ["uploading", "finalizing"] } }, select: { totalBytes: true } });
      if (pending.length >= 2) throw new UploadError("Finish or cancel your pending PDF uploads first.");
      if (await privateStorageUsed(tx, user.id) + pending.reduce((sum, item) => sum + item.totalBytes, 0) + input.data.size > access.storageLimitBytes) throw new UploadError("This PDF exceeds your remaining account storage. Remove files or books to make room.", 413);
      return tx.ebookUpload.create({ data: { userId: user.id, key: input.data.key, name: safeEbookName(input.data.name), title: input.data.title, totalBytes: input.data.size, bytes: Buffer.alloc(0), expiresAt: new Date(Date.now() + 60 * 60 * 1000) }, select: summary });
    });
    return NextResponse.json({ uploadId: row.id, offset: row.receivedBytes, chunkBytes: EBOOK_CHUNK_BYTES }, { headers });
  } catch (error) { return fail(error); }
}
export async function PUT(request: NextRequest) {
  try {
    const user = await actor(request);
    await enforceRateLimit(user.id, "ebook-transfer-chunk", 240, 60 * 60 * 1000);
    const id = request.nextUrl.searchParams.get("id") || "";
    const offset = Number(request.nextUrl.searchParams.get("offset"));
    if (!id || id.length > 100 || !request.nextUrl.searchParams.has("offset") || !Number.isSafeInteger(offset) || offset < 0) throw new UploadError("Invalid upload position.", 400);
    const bytes = Buffer.from(await readBoundedBytes(request, EBOOK_CHUNK_BYTES));
    if (!bytes.length) throw new UploadError("The upload chunk is empty.", 400);
    const digest = createHash("sha256").update(bytes).digest("hex");
    const row = await db.ebookUpload.findFirst({ where: { id, userId: user.id, expiresAt: { gt: new Date() }, status: "uploading" }, select: summary });
    if (!row) throw new UploadError("Upload unavailable. Choose the PDF again.", 404);
    if (row.lastOffset === offset && row.lastDigest === digest) return NextResponse.json({ offset: row.receivedBytes }, { headers });
    if (offset !== row.receivedBytes || offset + bytes.length > row.totalBytes) throw new UploadError("The upload position changed. Retry the same PDF to resume.");
    if (offset === 0 && bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new UploadError("Only genuine PDF files are supported.", 415);
    const changed = await db.$executeRaw`UPDATE "EbookUpload" SET "bytes"="bytes" || ${bytes}, "receivedBytes"="receivedBytes" + ${bytes.length}, "lastOffset"=${offset}, "lastDigest"=${digest} WHERE "id"=${id} AND "userId"=${user.id} AND "status"='uploading' AND "receivedBytes"=${offset} AND "expiresAt">NOW()`;
    if (changed !== 1) throw new UploadError("The upload position changed. Retry to resume.");
    return NextResponse.json({ offset: offset + bytes.length }, { headers });
  } catch (error) { return fail(error); }
}
export async function DELETE(request: NextRequest) {
  try {
    const user = await actor(request);
    await db.ebookUpload.deleteMany({ where: { id: request.nextUrl.searchParams.get("id") || "", userId: user.id, status: "uploading" } });
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) { return fail(error); }
}
