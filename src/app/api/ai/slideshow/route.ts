import { NextRequest } from "next/server";
import { requireEntitlement } from "@/lib/subscriptions/entitlements";
import { readBoundedAIJSON, AIRequestBodyError } from "@/lib/ai/request";
import { mutationOrigin } from "@/lib/resources/http";
import { POST as generate } from "@/app/api/ai/route";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  if (!mutationOrigin(request)) return Response.json({ error: "ORIGIN_REJECTED" }, { status: 403 });
  const access = await requireEntitlement("slideshow_generation_plus");
  if (!access.ok) return access.response;
  try { const body = await readBoundedAIJSON(request, 320 * 1024); if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "INVALID_AI_REQUEST" }, { status: 400 });
    const headers = new Headers(request.headers); headers.delete("content-length"); headers.set("Content-Type", "application/json");
    return await generate(new NextRequest(new URL("/api/ai", request.url), { method: "POST", headers, body: JSON.stringify({ ...body, feature: "slideshow_generation_plus" }), signal: request.signal }));
  } catch (error) { return Response.json({ error: error instanceof AIRequestBodyError ? error.message : "The slideshow request could not be processed." }, { status: error instanceof AIRequestBodyError ? error.status : 503 }); }
}
