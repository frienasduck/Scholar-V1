import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { readBoundedJson, readBoundedBytes } from "@/lib/security/request-body";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { checkGrade, lockAccount, ProfileError } from "@/lib/personalization/server";
import { resolveUserEntitlements } from "@/lib/subscriptions/entitlements";
import { canonicalUrl, contentHash, normalizeText, validateMapping } from "@/lib/resources/engine";
import { library, privateScope } from "@/lib/resources/service";
import { safeFetch, webpageMetadata } from "@/lib/resources/safe-fetch";
import { processResourceJob } from "@/lib/resources/jobs";
import { mutationOrigin, resourceError } from "@/lib/resources/http";
export const runtime = "nodejs";
export const maxDuration = 60;
const mappingSchema = z.object({ curriculumId: z.literal("cbse"), grade: z.union([z.literal(9), z.literal(11)]), subjectId: z.string().max(50), chapterId: z.string().max(60), topicId: z.string().max(120).optional() });
const inputSchema = z.object({ title: z.string().trim().min(1).max(180), text: z.string().trim().min(40).max(250_000).optional(), url: z.string().url().max(2000).optional(), mapping: mappingSchema.optional(), grade: z.union([z.literal(9), z.literal(11)]).default(11) }).refine(v => !!v.text !== !!v.url, "Provide either text or one URL.");
const querySchema = z.object({ q: z.string().trim().max(160).optional(), grade: z.coerce.number().int().refine(v => [9, 11].includes(v)).optional(), subjectId: z.string().max(60).optional(), chapterId: z.string().max(60).optional(), topic: z.string().max(120).optional(), type: z.string().max(50).optional(), scope: z.enum(["all", "built-in", "personal"]).optional(), publisher: z.string().max(180).optional(), language: z.string().max(20).optional(), page: z.coerce.number().int().positive().max(100).optional(), limit: z.coerce.number().int().min(1).max(24).optional() });
export async function GET(request: NextRequest) {
  const query = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) return NextResponse.json({ message: "Invalid resource filters." }, { status: 400 });
  try {
    const user = await getSessionUser();
    const result = await library(query.data, user?.id ?? null);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  } catch (error) { return resourceError(error); }
}
export async function POST(request: NextRequest) {
  if (!mutationOrigin(request)) return NextResponse.json({ message: "Origin rejected." }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Sign in to import private resources." }, { status: 401 });
  try {
    await enforceRateLimit(user.id, "resource-import", 20, 60 * 60_000);
    let raw: unknown;
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const bytes = await readBoundedBytes(request, 280_000);
      const form = await new Response(bytes as BodyInit, { headers: { "Content-Type": request.headers.get("content-type")! } }).formData();
      const file = form.get("file");
      if (!(file instanceof File) || !/\.(txt|md)$/i.test(file.name) || file.size > 250_000) throw new ProfileError("Use a .txt or .md file up to 250 KB. Upload PDFs through Custom E-Books; other formats are not supported.", 415);
      let text: string;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()); }
      catch { throw new ProfileError("Choose a plain UTF-8 text file.", 415); }
      if (text.includes("\0")) throw new ProfileError("Choose a plain UTF-8 text file.", 415);
      raw = { title: form.get("title") || file.name, text, grade: Number(form.get("grade") ?? 11) };
    } else raw = await readBoundedJson(request, 280_000);
    const input = inputSchema.safeParse(raw);
    if (!input.success) return NextResponse.json({ message: "Provide a title and text (40–250,000 characters) or one public HTTPS URL." }, { status: 400 });
    const data = input.data;
    await checkGrade(user.id, data.grade);
    if (data.mapping) {
      try { validateMapping(data.mapping); } catch { throw new ProfileError("Choose a valid chapter in the selected class and subject.", 400); }
      if (data.mapping.grade !== data.grade) throw new ProfileError("The mapping must use the selected class.", 400);
    }
    let url: string | null = null; let title = data.title; let description = "Private study material"; let publisher = "Your private upload";
    if (data.url) {
      try {
        const initial = await safeFetch(canonicalUrl(data.url), { head: true });
        url = initial.url; publisher = new URL(url).hostname;
        if (/text\/html/i.test(initial.headers["content-type"])) {
          const html = await safeFetch(url, { maxBytes: 512_000 });
          const meta = webpageMetadata(html.bytes.toString("utf8"));
          title = data.title === "Saved source link" && meta.title ? meta.title : data.title; description = meta.description; url = html.url;
        }
      } catch { throw new ProfileError("That URL could not be safely verified. Use a public HTTPS source without login or attachments, or upload your own file.", 422); }
    }
    const text = data.text ? normalizeText(data.text) : "";
    const digest = contentHash(url ?? text);
    const identityKey = `${user.id}:${url ? "url" : "text"}:${digest}`;
    const sizeBytes = Buffer.byteLength(text || `${title}\n${url}\n${description}`, "utf8");
    if (sizeBytes > 250_000) throw new ProfileError("Text imports must be no larger than 250 KB.", 413);
    const access = await resolveUserEntitlements(user.id);
    const result = await db.$transaction(async tx => {
      await lockAccount(tx, user.id);
      const duplicate = await tx.studyResource.findFirst({ where: { ...privateScope(user.id), identityKey } });
      if (duplicate) return { id: duplicate.id, duplicate: true };
      if (await tx.studyResource.count({ where: privateScope(user.id) }) >= 500) throw new ProfileError("The private library currently supports 500 active resources. Remove unused imports before adding more.", 413);
      const used = await tx.storedFile.aggregate({ where: { userId: user.id, deletedAt: null }, _sum: { sizeBytes: true } });
      if ((used._sum.sizeBytes ?? 0) + sizeBytes > access.storageLimitBytes) throw new ProfileError("This import exceeds your file storage allowance.", 413);
      const resource = await tx.studyResource.create({ data: { identityKey, ownerUserId: user.id, visibility: "PRIVATE", title, description, publisher, canonicalUrl: url,
        resourceType: url ? /youtube\.com|youtu\.be/.test(new URL(url).hostname) ? "video" : "reference" : "notes", sourceType: url ? "url" : "upload",
        licenseType: url ? "LINK_ONLY" : "PRIVATE_USER_UPLOAD", canStoreCopy: !url, canGenerateDerivatives: !url, contentHash: digest,
        attributionText: url ? `Original source: ${publisher}. Link only; rights to reproduce or generate from this page have not been established.` : "Private user material. Not reviewed or shared by Scholar.",
        state: url ? "LINK_ONLY" : "EXTRACTING", sourceMetadata: { grade: data.grade, ...(text ? { sections: [{ heading: title, text }] } : { transcriptAvailable: false }) },
        ...(data.mapping ? { mappings: { create: data.mapping } } : {}), ...(!url ? { job: { create: {} } } : {}) } });
      await tx.storedFile.create({ data: { userId: user.id, clientId: `resource:${resource.id}`, name: title, mimeType: url ? "text/uri-list" : "text/plain", sizeBytes } });
      return { id: resource.id, duplicate: false };
    });
    if (!url && !result.duplicate) after(async () => { await processResourceJob(result.id, user.id).catch(() => false); });
    return NextResponse.json({ ok: true, ...result }, { status: result.duplicate ? 200 : 202 });
  } catch (error) { return resourceError(error); }
}
