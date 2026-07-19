import "server-only";

import { GoogleGenAI } from "@google/genai";
import { AIProviderError } from "@/lib/ai/errors";

const DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-image";
const IMAGE_TIMEOUT_MS = 120_000;
const MAX_IMAGE_BASE64_LENGTH = 16_000_000;
const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export interface GeneratedImage {
  mimeType: string;
  data: string;
  revisedPrompt?: string;
}

export async function generateGeminiImage(
  prompt: string,
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9",
  requestSignal?: AbortSignal,
): Promise<GeneratedImage> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new AIProviderError("Gemini image generation is not configured on the server.", 503, "GEMINI_NOT_CONFIGURED");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  const abortFromRequest = () => controller.abort();
  requestSignal?.addEventListener("abort", abortFromRequest, { once: true });

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL,
      contents: prompt,
      config: {
        abortSignal: controller.signal,
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio },
      },
    });

    const finishReason = String(response.candidates?.[0]?.finishReason ?? "").toUpperCase();
    if (["SAFETY", "BLOCKLIST", "PROHIBITED_CONTENT", "IMAGE_SAFETY"].includes(finishReason)) {
      throw new AIProviderError("Gemini blocked this image request for safety reasons.", 422, "GEMINI_SAFETY_BLOCKED");
    }

    let revisedPrompt: string | undefined;
    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.text?.trim()) revisedPrompt = part.text.trim();
      const data = part.inlineData?.data;
      if (data) {
        const mimeType = part.inlineData?.mimeType?.toLowerCase() || "image/png";
        if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
          throw new AIProviderError("Gemini returned an unsupported image format.", 502, "GEMINI_UNSUPPORTED_IMAGE");
        }
        if (data.length > MAX_IMAGE_BASE64_LENGTH) {
          throw new AIProviderError("Gemini returned an image that is too large.", 502, "GEMINI_IMAGE_TOO_LARGE");
        }
        return {
          mimeType,
          data,
          revisedPrompt,
        };
      }
    }
    throw new AIProviderError("Gemini returned no image data.", 502, "GEMINI_EMPTY_IMAGE");
  } catch (error) {
    if (error instanceof AIProviderError) throw error;
    const status = typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : 502;
    if (status === 429) {
      throw new AIProviderError("Gemini image quota is currently exhausted. Please retry later.", 429, "GEMINI_QUOTA_EXHAUSTED");
    }
    if (status === 401 || status === 403) {
      throw new AIProviderError("Gemini authentication failed on the server.", 503, "GEMINI_AUTH_FAILED");
    }
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new AIProviderError("Gemini could not generate the image.", 502, "GEMINI_IMAGE_FAILED");
  } finally {
    clearTimeout(timeout);
    requestSignal?.removeEventListener("abort", abortFromRequest);
  }
}
