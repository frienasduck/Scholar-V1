import { after, NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { lockAccount } from "@/lib/personalization/server";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { pdfResource } from "@/lib/resources/intake";
import { processResourceJob } from "@/lib/resources/jobs";
import { mutationOrigin, resourceError } from "@/lib/resources/http";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Opt-in bridge for pre-existing PDFs. Never recharges uploads or reopens setup space. */
export async function POST(request: NextRequest) {
  if (!mutationOrigin(request)) return NextResponse.json({ message: "Origin rejected." }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  try {
    await enforceRateLimit(user.id, "resource-backfill", 10, 60_000);
    const result = await db.$transaction(async tx => {
      await lockAccount(tx, user.id);
      const books = await tx.customEbook.findMany({ where: { userId: user.id, deletedAt: null, resource: null }, take: 5, orderBy: { createdAt: "asc" } });
      let indexed = 0; let duplicates = 0;
      for (const book of books) {
        const digest = createHash("sha256").update(book.pdfBytes).digest("hex");
        const data = pdfResource(user.id, book.title, digest, user.currentScholarClass === 9 ? 9 : 11);
        if (await tx.studyResource.findUnique({ where: { identityKey: data.identityKey } })) { duplicates++; continue; }
        await tx.studyResource.create({ data: { ...data, ebookId: book.id, sourceMetadata: { grade: user.currentScholarClass === 9 ? 9 : 11, legacy: true } } });
        await tx.customEbook.update({ where: { id: book.id }, data: { processingStatus: "processing" } });
        indexed++;
      }
      return { indexed, duplicates, batchSize: books.length };
    });
    if (result.indexed) after(async () => { await processResourceJob(undefined, user.id).catch(() => false); });
    return NextResponse.json(result, { status: result.indexed ? 202 : 200 });
  } catch (error) { return resourceError(error); }
}
