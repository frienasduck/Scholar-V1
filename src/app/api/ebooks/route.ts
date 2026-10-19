import { after, NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { resolveUserEntitlements } from "@/lib/subscriptions/entitlements";
import { getMonthlyUsage } from "@/lib/subscriptions/monthly-usage";
import { processResourceJob } from "@/lib/resources/jobs";
import { saveEbookUpload } from "@/lib/ebooks/save-upload";
export const runtime = "nodejs";
export const maxDuration = 60;
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


export async function POST(request: NextRequest) { return saveEbookUpload(request); }
