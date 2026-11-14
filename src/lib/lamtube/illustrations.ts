import "server-only";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { generateNvidiaImage } from "@/lib/ai/nvidia-image";
import { generateGeminiImage } from "@/lib/ai/gemini-image";
import type { AssetArtifactMeta, VideoState } from "./model";

export type SavedAssetRecord = AssetArtifactMeta & {
  digest: string;
  bytes: Buffer;
};

const STRICT_VISUAL_SUFFIX =
  "Clean modern textbook scientific visual vignette, dark midnight navy canvas (#091022), crisp luminous cyan and warm gold accents, smooth educational diagram backdrop, ZERO text, ZERO letters, ZERO words, ZERO numbers, ZERO equations, ZERO labels, ZERO watermarks.";

export function collectRequestedIllustrations(v: VideoState) {
  const seen = new Set<string>();
  const requests: { key: string; prompt: string; w: number; h: number }[] = [];
  for (const plan of v.plans) {
    for (const el of plan.elements) {
      if (el.kind === "illustration" && el.assetKey && el.illustrationPrompt?.trim()) {
        if (seen.has(el.assetKey)) continue;
        seen.add(el.assetKey);
        requests.push({
          key: el.assetKey,
          prompt: el.illustrationPrompt.trim(),
          w: Math.max(240, Math.min(920, Math.round(Math.abs(el.w || 420)))),
          h: Math.max(180, Math.min(760, Math.round(Math.abs(el.h || 320)))),
        });
        if (requests.length >= 3) return requests;
      }
    }
  }
  return requests;
}

export async function generateEducationalPlate(
  prompt: string,
  aspect: VideoState["settings"]["aspect"],
  signal: AbortSignal
): Promise<SavedAssetRecord | null> {
  const fullPrompt = `${prompt.replace(/text|labels?|numbers?|equations?/gi, "").trim()}. ${STRICT_VISUAL_SUFFIX}`;
  const targetRatio: "16:9" | "9:16" | "1:1" = aspect === "9:16" ? "9:16" : aspect === "1:1" ? "1:1" : "16:9";

  let rawBase64 = "";
  try {
    const nvidia = await generateNvidiaImage(fullPrompt, targetRatio, signal);
    rawBase64 = nvidia.data;
  } catch (nvidiaErr) {
    if (signal.aborted) throw nvidiaErr;
    try {
      const gemini = await generateGeminiImage(fullPrompt, targetRatio, signal);
      rawBase64 = gemini.data;
    } catch (geminiErr) {
      if (signal.aborted) throw geminiErr;
      console.warn(
        "[LAMTube] Illustration generation skipped after both image providers failed:",
        geminiErr instanceof Error ? geminiErr.message : String(geminiErr)
      );
      return null;
    }
  }

  if (!rawBase64) return null;
  const decoded = Buffer.from(rawBase64, "base64");
  const normalized = sharp(decoded).png({ compressionLevel: 9 });
  const meta = await normalized.metadata();
  const maxWidth = 1024;
  const resized =
    (meta.width ?? 0) > maxWidth
      ? normalized.resize({ width: maxWidth, withoutEnlargement: true })
      : normalized;
  const pngBytes = await resized.png().toBuffer();
  const outMeta = await sharp(pngBytes).metadata();
  const digest = createHash("sha256").update(pngBytes).digest("hex");

  return {
    key: "plate",
    prompt,
    mimeType: "image/png",
    width: outMeta.width ?? 1024,
    height: outMeta.height ?? 576,
    digest,
    bytes: pngBytes,
  };
}
