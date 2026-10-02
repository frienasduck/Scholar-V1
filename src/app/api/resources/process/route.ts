import { timingSafeEqual } from "node:crypto";
import { processResourceJob } from "@/lib/resources/jobs";
export const runtime = "nodejs";
export const maxDuration = 60;
// Scheduled external invocation or local worker; no unauthenticated maintenance access.
export async function POST(request: Request) {
  const secret = process.env.RESOURCE_WORKER_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || secret.length < 32 || Buffer.byteLength(provided) !== Buffer.byteLength(secret) || !timingSafeEqual(Buffer.from(provided), Buffer.from(secret))) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const processed = await processResourceJob();
  return Response.json({ processed }, { headers: { "Cache-Control": "no-store" } });
}
