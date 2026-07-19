import { NextRequest, NextResponse } from "next/server";
import { generateGeminiImage } from "@/lib/ai/gemini-image";
import { publicAIError } from "@/lib/ai/errors";
import { imageRequestSchema } from "@/lib/ai/schemas";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse("The request body must be valid JSON.", 400, "INVALID_JSON_BODY");
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
    const image = await generateGeminiImage(imagePrompt, parsed.data.aspectRatio, request.signal);
    return NextResponse.json({ ok: true, image });
  } catch (error) {
    const detail = publicAIError(error);
    return errorResponse(detail.message, detail.status, detail.code);
  }
}

function errorResponse(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}
