import Groq from "groq-sdk";
import { AIProviderError } from "@/lib/ai/errors";
import { readBoundedBytes } from "@/lib/security/request-body";
import type { VideoSettings } from "./model";
import { wavInfo } from "./wav";

export const TTS_MODEL = "canopylabs/orpheus-v1-english";
const geminiVoices = { autumn: "Kore", diana: "Aoede", hannah: "Leda", austin: "Puck", daniel: "Charon", troy: "Fenrir" } as const;
export function speechConfiguration() {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const groqKey = process.env.GROQ_TTS_API_KEY?.trim() || process.env.GROQ_API_KEY?.trim();
  // Prefer configured Gemini speech: Groq Orpheus may require separate model terms.
  const provider = process.env.LAMTUBE_TTS_PROVIDER === "groq" || !geminiKey ? "groq" : "gemini";
  return { provider, apiKey: provider === "groq" ? groqKey : geminiKey, model: provider === "groq" ? TTS_MODEL : process.env.GEMINI_TTS_MODEL?.trim() || "gemini-3.8-flash-lite-tts" };
}
export function speechError(error: unknown): AIProviderError {
  if (error instanceof AIProviderError) return error;
  const e = error as { code?: string; status?: number; error?: { error?: { code?: string } } } | null;
  const code = e?.code || e?.error?.error?.code;
  if (code === "model_terms_required") return new AIProviderError("The speech provider requires its account owner to accept the Orpheus model terms in Groq Console, or configure Gemini narration. Retrying cannot fix this configuration. Your lesson is saved and no generation credit was consumed.", 503, "TTS_MODEL_TERMS_REQUIRED");
  if (e?.status === 429) return new AIProviderError("Narration is temporarily rate limited. Retry after a short wait; completed phrases are saved.", 429, "TTS_RATE_LIMITED");
  if (e?.status === 401 || e?.status === 403) return new AIProviderError("The configured speech provider denied access. The site administrator must check the narration API key and model access. Your saved lesson has not been charged.", 503, "TTS_ACCESS_DENIED");
  return new AIProviderError("Narration could not finish this phrase. Retry to reuse the completed scenes and audio without a full-generation charge.", 502, "TTS_FAILED");
}

/** Real, seekable WAV output. No browser speech or fabricated silent-audio fallback. */
export async function generateSpeech(text: string, settings: Pick<VideoSettings, "voice" | "pace">, signal: AbortSignal): Promise<Buffer> {
  const config = speechConfiguration();
  if (!config.apiKey) throw new AIProviderError("Narration is not configured. Add a Gemini or Groq speech API key on the server, then resume this saved lesson.", 503, "TTS_NOT_CONFIGURED");
  if (text.length > 200 || !text.trim()) throw new AIProviderError("The narration phrase is outside the supported length.", 422, "TTS_INVALID_PHRASE");
  try {
    let bytes: Buffer;
    const boundedSignal = AbortSignal.any([signal, AbortSignal.timeout(25000)]);
    if (config.provider === "gemini") {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST", signal: boundedSignal,
        headers: { "x-goog-api-key": config.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ model: config.model, input: [{ type: "user_input", content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style: settings.pace === "calm" ? "Calm, clear educational narration, speaking slowly" : settings.pace === "brisk" ? "Clear, confident educational narration, speaking briskly" : "Clear, warm educational narration" }] }] }], response_format: { type: "audio" }, generation_config: { speech_config: [{ voice: geminiVoices[settings.voice] }] } }),
      });
      if (!response.ok) { await response.body?.cancel(); throw { status: response.status }; }
      const raw = await readBoundedBytes(new Request("http://lamtube.local/speech", { method: "POST", body: response.body, duplex: "half" } as RequestInit), 11_000_000);
      const result = JSON.parse(new TextDecoder().decode(raw)) as { steps?: { type?: string; content?: { type?: string; mime_type?: string; data?: string }[] }[] };
      const audio = result.steps?.filter(step => step.type === "model_output").flatMap(step => step.content ?? []).filter(part => part.type === "audio").at(-1);
      if (audio?.mime_type !== "audio/wav" || !audio.data || audio.data.length > 10_666_668) throw new Error("Invalid speech response");
      bytes = Buffer.from(audio.data, "base64");
    } else {
      const client = new Groq({ apiKey: config.apiKey, timeout: 25000, maxRetries: 0 });
      const response = await client.audio.speech.create({ model: config.model, voice: settings.voice, input: text, response_format: "wav" }, { signal: boundedSignal });
      bytes = Buffer.from(await readBoundedBytes(new Request("http://lamtube.local/narration", { method: "POST", headers: response.headers, body: response.body, duplex: "half" } as RequestInit), 8_000_000));
    }
    wavInfo(bytes);
    return bytes;
  } catch (error) { throw speechError(error); }
}
