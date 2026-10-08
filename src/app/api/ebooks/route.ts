import { after, NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { resolveUserEntitlements } from "@/lib/subscriptions/entitlements";
import { commitMonthlyUsage, getMonthlyUsage, MonthlyQuotaError, releaseMonthlyUsage, reserveMonthlyUsage } from "@/lib/subscriptions/monthly-usage";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { createHash } from "node:crypto";
import { readBoundedBytes,RequestBodyError } from "@/lib/security/request-body";
import { storeBonusBook, ProfileError } from "@/lib/personalization/server";
import { mayImport } from "@/lib/personalization/schema";
import { pdfResource } from "@/lib/resources/intake";
import { processResourceJob } from "@/lib/resources/jobs";
import { checkGrade } from "@/lib/personalization/server";
import { mutationOrigin } from "@/lib/resources/http";
import { recordAudit } from "@/lib/subscriptions/audit";
import { MAX_EBOOK_BYTES, pdfValidation, safeEbookName } from "@/lib/ebooks/contracts";
import { privateStorageUsed } from "@/lib/ebooks/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PDF_BYTES = MAX_EBOOK_BYTES;


function safeName(value: string) {
  return safeEbookName(value);
}

export async function GET() {
  try {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const access = await resolveUserEntitlements(user.id);
  const [ebooks, usage] = await Promise.all([
    db.customEbook.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, title: true, originalFileName: true, sizeBytes: true, pageCount: true, processingStatus: true, readingState: true, createdAt: true, allocation: true, resource: { select: { id: true, state: true, sourceMetadata: true, job: { select: { stage: true, errorCode: true, state: true } } } } },
    }),
    getMonthlyUsage(user.id, access),
  ]);
  const pending = ebooks.find(book => book.processingStatus === "processing" && book.resource);
  if (pending?.resource) after(() => processResourceJob(pending.resource!.id, user.id).catch(() => false));
  const summaries = ebooks.map(book => {
    const metadata = book.resource?.sourceMetadata as { extractedPages?: number } | undefined;
    const reading = book.readingState as { page?: number; lastOpenedAt?: string };
    return { ...book, readingState: undefined, lastPage: reading.page ?? 1, lastOpenedAt: reading.lastOpenedAt, resource: book.resource ? { id: book.resource.id, state: book.resource.state, job: book.resource.job, extractedPages: metadata?.extractedPages ?? 0 } : null };
  });
  return NextResponse.json({ ebooks: summaries, usage: usage.ebookUploads, period: usage.period, timezone: usage.timezone }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "LIBRARY_UNAVAILABLE", message: "Your private library is temporarily unavailable. Saved books have not been removed." }, { status: 503 }); }
}

export async function POST(request: NextRequest) {
  try { return await uploadBook(request); }
  catch (error) { console.warn("[Ebook upload] unavailable", { code: error instanceof Error ? error.name : "UNKNOWN" }); return NextResponse.json({ error: "UPLOAD_UNAVAILABLE", message: "Scholar could not verify your session or save this PDF. Retry with the same file." }, { status: 503 }); }
}
async function uploadBook(request: NextRequest) {
  if (!mutationOrigin(request)) return NextResponse.json({ error: "ORIGIN_REJECTED" }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED", message: "Sign in to upload a private E-Book." }, { status: 401 });
  const grade = user.currentScholarClass === 9 ? 9 : 11;
  try { await checkGrade(user.id, grade); } catch { return NextResponse.json({ error: "CLASS_ACCESS_REQUIRED" }, { status: 403 }); }
  try {
    const profile = request.headers.get("x-scholar-import") === "initial-setup" ? await db.learningProfile.findUnique({where:{userId:user.id}}) : null;
    const initialSetup = profile?.status === "IN_PROGRESS" && !profile.bonusClosedAt;
    await enforceRateLimit(user.id, initialSetup ? "onboarding-ebook-upload" : "custom-ebook-upload", initialSetup ? 24 : 8, 60 * 60 * 1000);
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: "RATE_LIMITED", message: "Too many upload attempts. Try again later." }, { status: 429 });
    return NextResponse.json({ error: "ACCESS_CHECK_FAILED" }, { status: 503 });
  }
  const access = await resolveUserEntitlements(user.id);
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_PDF_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "PDF_SIZE", message: "PDFs must be no larger than 4 MB." }, { status: 413 });
  }
  let form: FormData;
  try {
    const bounded = await readBoundedBytes(request, MAX_PDF_BYTES + 64 * 1024);
    form = await new Response(bounded as BodyInit, { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
  } catch(error) {return NextResponse.json({message:"Choose a PDF up to 4 MB."},{status:error instanceof RequestBodyError ? error.status : 400});}
  const file = form?.get("file");
  const requestedTitle = typeof form?.get("title") === "string" ? String(form.get("title")) : "";
  if (!(file instanceof File)) return NextResponse.json({ error: "PDF_REQUIRED", message: "Choose one PDF file." }, { status: 400 });
  const invalid = pdfValidation(file);
  if (invalid) return NextResponse.json({ error: "PDF_INVALID", message: invalid }, { status: file.size > MAX_PDF_BYTES ? 413 : 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = new TextDecoder("ascii").decode(bytes.slice(0, 5));
  if (signature !== "%PDF-" || pdfValidation(file, signature)) return NextResponse.json({ error: "PDF_ONLY", message: "Only genuine PDF files are supported." }, { status: 415 });

  const digest = createHash("sha256").update(bytes).digest("hex");
  try {
    const duplicate = await db.studyResource.findFirst({ where: { ownerUserId: user.id, visibility: "PRIVATE", deletedAt: null, identityKey: `${user.id}:pdf:${digest}` }, select: { title: true, ebook: { select: { id: true, processingStatus: true, sizeBytes: true, pageCount: true } } } });
    if (duplicate?.ebook) return NextResponse.json({ ok: true, duplicate: true, ebook: duplicate.ebook ? { id: duplicate.ebook.id, title: duplicate.title, processingStatus: duplicate.ebook.processingStatus, sizeBytes: duplicate.ebook.sizeBytes, pageCount: duplicate.ebook.pageCount } : null });
  } catch { return NextResponse.json({ error: "RESOURCE_INDEX_UNAVAILABLE", message: "Private imports require the resource database update." }, { status: 503 }); }
  if (form?.get("allocation") === "onboarding") {
    const key = request.headers.get("x-idempotency-key") ?? "";
    if (!/^[a-zA-Z0-9-]{16,100}$/.test(key)) return NextResponse.json({message:"Choose the PDF again before importing."},{status:400});
    try {
      const previous = await db.customEbook.findUnique({where:{userId_importKey:{userId:user.id,importKey:key}}});
      if (previous && previous.importDigest === digest && !previous.deletedAt) return NextResponse.json({ok:true,ebook:{id:previous.id,title:previous.title,pageCount:previous.pageCount,sizeBytes:previous.sizeBytes,processingStatus:previous.processingStatus}});
      if (previous) throw new ProfileError("This import reference was already used. Choose the file again.");
      const profile = await db.learningProfile.findUnique({where:{userId:user.id}});
      if(!profile || !mayImport(profile.status,Boolean(profile.bonusClosedAt),profile.bonusUsedBytes,bytes.byteLength)) throw new ProfileError("Your setup import space is closed or this PDF exceeds the remaining space.");
      const importGrade = (profile.preferences as { grade?: number }).grade === 9 ? 9 : 11;
      await checkGrade(user.id, importGrade);
      const originalFileName = safeName(file.name);
      const bonusSource = pdfResource(user.id,safeName(requestedTitle || originalFileName.replace(/\.pdf$/i,"")),digest,importGrade);
      bonusSource.sourceMetadata = { grade: importGrade, titleUserSet: Boolean(requestedTitle.trim()) };
      const ebook = await storeBonusBook(user.id,key,digest,{title:safeName(requestedTitle || originalFileName.replace(/\.pdf$/i,"")).slice(0,120),originalFileName,sizeBytes:bytes.byteLength,pageCount:0,text:"",pageTexts:[],pdfBytes:Buffer.from(bytes),processingStatus:"processing",resource:{create:bonusSource}});
      if (ebook.resource) after(() => processResourceJob(ebook.resource!.id, user.id).catch(() => console.warn("[Ebook upload] saved setup job awaits worker")));
      await recordAudit("onboarding_import_used",{actorUserId:user.id}).catch(() => console.warn("[Ebook upload] setup audit deferred"));
      return NextResponse.json({ok:true,ebook:{id:ebook.id,title:ebook.title,pageCount:ebook.pageCount,sizeBytes:ebook.sizeBytes,processingStatus:ebook.processingStatus}},{status:201});
    } catch(error) {
      return NextResponse.json({message:error instanceof ProfileError ? error.message : "Scholar could not save this setup PDF. Retry with the same file; existing imports are detected safely."},{status:error instanceof ProfileError ? error.status : 503});
    }
  }

  const importKey = request.headers.get("x-idempotency-key") || crypto.randomUUID();
  if (!/^[a-zA-Z0-9-]{16,100}$/.test(importKey)) return NextResponse.json({ message: "Invalid upload reference. Choose the PDF again." }, { status: 400 });
  const idempotencyKey = `${user.id}:ebook:${importKey}`;
  try {
    const reservation = await reserveMonthlyUsage({ userId: user.id, feature: "custom_ebook_upload", idempotencyKey, access });
    if (reservation.replayed) return NextResponse.json({ error: "UPLOAD_REPLAY", message: "This upload is already being processed." }, { status: 409 });
  } catch (error) {
    if (error instanceof MonthlyQuotaError) return NextResponse.json({ error: error.code, limit: error.limit, message: `You have used all ${error.limit} custom E-Book uploads for this month.` }, { status: 429 });
    return NextResponse.json({ error: "QUOTA_UNAVAILABLE", message: "Scholar could not verify your upload allowance." }, { status: 503 });
  }

  console.info("[Ebook upload] saving", { sizeBytes: file.size });
  try {
    const originalFileName = safeName(file.name);
    const title = safeName(requestedTitle || originalFileName.replace(/\.pdf$/i, "")).slice(0, 120);
    const saved = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
    const previous = await tx.customEbook.findFirst({ where: { userId: user.id, deletedAt: null, OR: [{ importDigest: digest }, { importKey }] }, select: { id: true, title: true, pageCount: true, sizeBytes: true, processingStatus: true, importDigest: true, resource: { select: { id: true } } } });
    if (previous) {
      if (previous.importDigest !== digest) throw new Error("UPLOAD_KEY_CONFLICT");
      return { ebook: previous, duplicate: true };
    }
    if (await privateStorageUsed(tx, user.id) + file.size > access.storageLimitBytes) throw new Error("STORAGE_LIMIT_REACHED");
    const source = pdfResource(user.id, title, digest, grade, idempotencyKey);
    source.sourceMetadata = { grade, usageKey: idempotencyKey, titleUserSet: Boolean(requestedTitle.trim()) };
    const ebook = await tx.customEbook.create({ data: {
      userId: user.id,
      title,
      originalFileName,
      sizeBytes: file.size,
      pageCount: 0,
      text: "",
      pageTexts: [],
      importDigest: digest,
      importKey,
      resource: { create: source },
      pdfBytes: Buffer.from(bytes),
      processingStatus: "processing",
    }, select: { id: true, title: true, pageCount: true, sizeBytes: true, processingStatus: true, resource: { select: { id: true } } } });
    await commitMonthlyUsage(user.id, idempotencyKey, tx);
    return { ebook, duplicate: false };
    }, { timeout: 15_000 });
    const { ebook } = saved;
    if (saved.duplicate) await releaseMonthlyUsage(user.id, idempotencyKey).catch(() => console.warn("[Ebook upload] duplicate reservation release pending"));
    if (ebook.resource) after(() => processResourceJob(ebook.resource!.id, user.id).catch(() => console.warn("[Ebook upload] saved job awaits worker")));
    return NextResponse.json({ ok: true, duplicate: saved.duplicate, ebook: { id: ebook.id, title: ebook.title, pageCount: ebook.pageCount, sizeBytes: ebook.sizeBytes, processingStatus: ebook.processingStatus } }, { status: saved.duplicate ? 200 : 201 });
  } catch (error) {
    await releaseMonthlyUsage(user.id, idempotencyKey).catch(() => undefined);
    console.warn("[Ebook upload] storage failed", { code: error instanceof Error && ["STORAGE_LIMIT_REACHED", "UPLOAD_KEY_CONFLICT"].includes(error.message) ? error.message : "STORAGE_UNAVAILABLE" });
    if (error instanceof Error && error.message === "STORAGE_LIMIT_REACHED") return NextResponse.json({ error: error.message, message: `Your account storage limit is ${Math.round(access.storageLimitBytes / 1048576)} MB. Remove files or books to make room.` }, { status: 413 });
    const message = error instanceof Error && error.message === "PDF_PAGE_LIMIT"
      ? "PDFs must contain between 1 and 500 pages."
      : error instanceof Error && error.message === "PDF_ACTIVE_CONTENT"
        ? "PDFs containing scripts cannot be imported. Export a plain PDF and try again."
        : error instanceof Error && error.message === "PDF_TEXT_LIMIT"
          ? "This PDF expands to too much text. Split it into smaller study PDFs and try again."
          : "Scholar could not save this PDF. Retry with the same file; duplicate detection protects existing books.";
    return NextResponse.json({ error: "PDF_STORAGE_FAILED", message }, { status: 503 });
  }
}
