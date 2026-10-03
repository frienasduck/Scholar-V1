import { NextRequest } from "next/server";
import { z } from "zod";
import { connectorAdapters } from "@/lib/connections/adapters";
import { connectionUser, connectionError } from "@/lib/connections/http";
import { readBoundedJson } from "@/lib/security/request-body";
import { POST as importEbook } from "@/app/api/ebooks/route";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  try {
    const user = await connectionUser(request, true);
    const body = z.object({ fileId: z.string().regex(/^[\w-]{1,200}$/) }).parse(await readBoundedJson(request, 4096));
    const file = await connectorAdapters["google-drive"].importPdf(user.id, body.fileId);
    const form = new FormData(); form.append("file", new File([Uint8Array.from(file.bytes)], file.name, { type: "application/pdf" }));
    // Same authenticated, bounded upload/quota/deduplication pipeline; no parallel Drive library.
    const headers = new Headers({ origin: request.nextUrl.origin, cookie: request.headers.get("cookie") ?? "", "x-idempotency-key": crypto.randomUUID() });
    return await importEbook(new NextRequest(`${request.nextUrl.origin}/api/ebooks`, { method: "POST", headers, body: form }));
  } catch (error) { return connectionError(error); }
}
