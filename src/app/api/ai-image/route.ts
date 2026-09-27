import { NextRequest, NextResponse } from "next/server";
import { generateNvidiaImage } from "@/lib/ai/nvidia-image";
import { publicAIError } from "@/lib/ai/errors";
import { AIRequestBodyError, readBoundedAIJSON } from "@/lib/ai/request";
import { imageRequestSchema } from "@/lib/ai/schemas";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { requireEntitlement } from "@/lib/subscriptions/entitlements";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: NextRequest) {
  const access = await requireEntitlement("aisig");
  if (!access.ok) return access.response;
  try {
    await enforceRateLimit(access.user.id, "ai-image-burst", 12, 10 * 60_000);
    await enforceRateLimit(access.user.id, "ai-image-hourly", 40, 60 * 60_000);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { ok: false, error: { code: "RATE_LIMITED", message: "Too many image requests. Please wait and retry." } },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } },
      );
    }
    return errorResponse("Scholar could not verify this image request.", 503, "ACCESS_CHECK_FAILED");
  }
  let raw: unknown;
  try {
    raw = await readBoundedAIJSON(request, 32 * 1024);
  } catch (error) {
    if (error instanceof AIRequestBodyError) return errorResponse(error.message, error.status, error.code);
    return errorResponse("The request body could not be read.", 400, "INVALID_JSON_BODY");
  }

  const parsed = imageRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return errorResponse("Enter a prompt between 3 and 4,000 characters.", 400, "INVALID_IMAGE_REQUEST");
  }

  try {
    const context = [
      parsed.data.subject ? `Subject: ${parsed.data.subject}.` : "",
      parsed.data.chapter ? `Chapter: ${parsed.data.chapter}.` : "",
      parsed.data.style ? `Requested style: ${parsed.data.style}.` : "",
    ].filter(Boolean).join(" ");
    const imagePrompt = context ? `${parsed.data.prompt}\n\n${context}` : parsed.data.prompt;
    const image = await generateNvidiaImage(imagePrompt, parsed.data.aspectRatio, request.signal);
    return NextResponse.json({ ok: true, image });
  } catch (error) {
    const detail = publicAIError(error);
    return errorResponse(detail.message, detail.status, detail.code);
  }
}

function errorResponse(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}
