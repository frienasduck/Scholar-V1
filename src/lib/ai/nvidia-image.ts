import "server-only";

import { AIProviderError } from "@/lib/ai/errors";

const DEFAULT_ENDPOINT =
  "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b";
const IMAGE_TIMEOUT_MS = 180_000;
const MAX_IMAGE_BASE64_LENGTH = 20_000_000;

export interface GeneratedNvidiaImage {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  data: string;
  revisedPrompt?: string;
}

type NvidiaImageResponse = {
  artifacts?: Array<{
    base64?: string;
    image?: string;
    finishReason?: string;
  }>;
  image?: string;
  data?: string;
};

const FILTERED_FINISH_REASONS = new Set([
  "CONTENT_FILTERED",
  "SAFETY",
  "NSFW",
]);

const IMAGE_SIZE_MAP = {
  "1:1": { width: 1024, height: 1024 },
  "3:4": { width: 880, height: 1184 },
  "4:3": { width: 1184, height: 880 },
  "9:16": { width: 752, height: 1392 },
  "16:9": { width: 1392, height: 752 },
} as const;

export async function generateNvidiaImage(
  prompt: string,
  aspectRatio: keyof typeof IMAGE_SIZE_MAP,
  requestSignal?: AbortSignal,
): Promise<GeneratedNvidiaImage> {
  const apiKey = process.env.AISIG_NVIDIA_API_KEY?.trim();
  if (!apiKey) {
    throw new AIProviderError(
      "AISIG is not configured on the server.",
      503,
      "AISIG_NOT_CONFIGURED",
    );
  }

  const endpoint = process.env.AISIG_NVIDIA_ENDPOINT?.trim() || DEFAULT_ENDPOINT;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  const abortFromRequest = () => controller.abort();
  requestSignal?.addEventListener("abort", abortFromRequest, { once: true });

  try {
    const first = await requestImage(endpoint, apiKey, prompt, aspectRatio, controller.signal);
    if (first.image) return first.image;

    if (first.filtered) {
      const saferPrompt = educationalSafetyRewrite(prompt);
      const retry = await requestImage(
        endpoint,
        apiKey,
        saferPrompt,
        aspectRatio,
        controller.signal,
      );
      if (retry.image) return retry.image;
      if (retry.filtered) {
        throw new AIProviderError(
          "AISIG could not generate this image safely. Try a more neutral educational description.",
          422,
          "AISIG_SAFETY_BLOCKED",
        );
      }
    }

    throw new AIProviderError(
      "AISIG returned no usable image. Please retry.",
      502,
      "AISIG_EMPTY_IMAGE",
    );
  } catch (error) {
    if (error instanceof AIProviderError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new AIProviderError(
      "AISIG could not generate the image.",
      502,
      "AISIG_IMAGE_FAILED",
    );
  } finally {
    clearTimeout(timeout);
    requestSignal?.removeEventListener("abort", abortFromRequest);
  }
}

async function requestImage(
  endpoint: string,
  apiKey: string,
  prompt: string,
  aspectRatio: keyof typeof IMAGE_SIZE_MAP,
  signal: AbortSignal,
): Promise<{ image?: GeneratedNvidiaImage; filtered: boolean }> {
  const providerPrompt = compactProviderPrompt(prompt);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      prompt: providerPrompt,
      ...IMAGE_SIZE_MAP[aspectRatio],
      cfg_scale: 1,
      samples: 1,
      seed: 0,
      steps: 4,
    }),
    signal,
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403) {
    throw new AIProviderError(
      "AISIG authentication failed on the server.",
      503,
      "AISIG_AUTH_FAILED",
    );
  }
  if (response.status === 429) {
    throw new AIProviderError(
      "AISIG image quota is currently exhausted. Please retry later.",
      429,
      "AISIG_QUOTA_EXHAUSTED",
    );
  }
  if (response.status === 400 || response.status === 422) {
    throw new AIProviderError(
      "AISIG could not use this image request. Try a different prompt.",
      422,
      "AISIG_INVALID_REQUEST",
    );
  }
  if (!response.ok) {
    throw new AIProviderError(
      "AISIG could not generate the image.",
      502,
      "AISIG_IMAGE_FAILED",
    );
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.startsWith("image/")) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    const data = Buffer.from(bytes).toString("base64");
    return { image: validatedImage(data, providerPrompt, contentType), filtered: false };
  }

  const payload = await response.json() as NvidiaImageResponse;
  const artifact = payload.artifacts?.[0];
  const finishReason = artifact?.finishReason?.toUpperCase() ?? "";
  if (FILTERED_FINISH_REASONS.has(finishReason)) {
    return { filtered: true };
  }

  const rawData = artifact?.base64 || artifact?.image || payload.image || payload.data;
  const data = rawData?.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "");
  return {
    image: data ? validatedImage(data, providerPrompt) : undefined,
    filtered: false,
  };
}

function compactProviderPrompt(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (normalized.length <= 780) return normalized;
  const shortened = normalized.slice(0, 780);
  const lastBoundary = Math.max(
    shortened.lastIndexOf("."),
    shortened.lastIndexOf(";"),
    shortened.lastIndexOf(","),
  );
  return (lastBoundary >= 320 ? shortened.slice(0, lastBoundary + 1) : shortened).trim();
}

function educationalSafetyRewrite(prompt: string): string {
  const neutralPrompt = prompt
    .replace(/\bzombie process(?:es)?\b/gi, "defunct operating-system process")
    .replace(/\bthe zombie(?:'s)?\b/gi, "the defunct process")
    .replace(/\bto the zombie\b/gi, "to the defunct process")
    .replace(/\bzombie state\b/gi, "defunct process state")
    .replace(/\bzombie\b/gi, "defunct process")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[—–][\s\S]*$/, " ")
    .replace(/\binterior[- ]view\b/gi, "labelled")
    .replace(/\banatomical\b/gi, "educational")
    .replace(/\bcross[- ]section\b/gi, "diagram")
    .replace(/\bbloody\b/gi, "red-toned")
    .replace(/\bblood\b/gi, "circulation")
    .replace(/\boxygenated\b/gi, "red")
    .replace(/\bdeoxygenated\b/gi, "blue")
    .replace(/\bgraphic\b/gi, "clear")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 320);
  return [
    "Create a classroom-safe educational textbook illustration using simplified diagrammatic forms.",
    neutralPrompt,
  ].join(" ");
}

function validatedImage(
  data: string,
  revisedPrompt: string,
  contentType?: string,
): GeneratedNvidiaImage {
  if (data.length > MAX_IMAGE_BASE64_LENGTH) {
    throw new AIProviderError(
      "AISIG returned an image that is too large.",
      502,
      "AISIG_IMAGE_TOO_LARGE",
    );
  }
  const mimeType = detectImageType(data, contentType);
  return { mimeType, data, revisedPrompt };
}

function detectImageType(
  data: string,
  contentType?: string,
): GeneratedNvidiaImage["mimeType"] {
  if (contentType?.includes("png") || data.startsWith("iVBOR")) return "image/png";
  if (contentType?.includes("webp") || data.startsWith("UklGR")) return "image/webp";
  return "image/jpeg";
}
