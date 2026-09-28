import "server-only";

import { GoogleGenAI } from "@google/genai";
import { AIProviderError } from "@/lib/ai/errors";
import { consumeSSEChunk } from "@/lib/ai/sse";
import { getScholarGroqConfig, streamScholarGroqText, type ScholarGroqMessage } from "@/lib/ai/scholar-groq";
import type { LiveTutorProvider, LiveTutorProviderStatus } from "./types";

export interface LiveTutorProviderRequest {
  provider: LiveTutorProvider;
  credential?: { apiKey: string; model: string };
  model?: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  signal: AbortSignal;
  temperature?: number;
  maxTokens?: number;
  preferLargeContext?: boolean;
  onDelta: (value: string) => void;
  onProviderResolved?: (provider: Exclude<LiveTutorProvider, "auto">, model: string) => void;
}

export function liveTutorProviderStatus(): LiveTutorProviderStatus[] {
  const groqModel = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-20b";
  const geminiModel = process.env.GEMINI_TEXT_MODEL?.trim() || "gemini-3.6-flash";
  const nvidiaModel = process.env.NVIDIA_TEXT_MODEL?.trim() || "nvidia/nemotron-3-ultra-550b-a55b";
  const groq = Boolean(process.env.GROQ_API_KEY?.trim());
  const gemini = Boolean(process.env.GEMINI_API_KEY?.trim());
  const nvidia = Boolean((process.env.NVIDIA_TEXT_API_KEY ?? process.env.NVIDIA_API_KEY)?.trim());
  return [
    { id: "auto", label: "Auto", available: groq || gemini || nvidia, note: "Chooses the best available model for this turn." },
    { id: "groq", label: "Groq", available: groq, model: groq ? groqModel : undefined, models: [...new Set([groqModel, "openai/gpt-oss-20b", "openai/gpt-oss-120b"])], note: groq ? "Fast streamed tutoring" : "Not configured" },
    { id: "gemini", label: "Gemini", available: gemini, model: gemini ? geminiModel : undefined, models: [...new Set([geminiModel, "gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"])], note: gemini ? "Large-context tutoring" : "Text model not configured" },
    { id: "nvidia", label: "NVIDIA Nemotron", available: nvidia, model: nvidia ? nvidiaModel : undefined, models: [nvidiaModel], note: nvidia ? "Nemotron reasoning model" : "Text model not configured" },
  ];
}

const LIVE_TUTOR_DEADLINE_MS = 50_000;

export function resolveProviderOrder(requested: LiveTutorProvider, preferLargeContext: boolean): Array<Exclude<LiveTutorProvider, "auto">> {
  const status = liveTutorProviderStatus();
  const available = (id: LiveTutorProvider) => status.some((item) => item.id === id && item.available);
  if (requested !== "auto") {
    if (!available(requested)) throw new AIProviderError(`${requested === "gemini" ? "Gemini" : requested === "nvidia" ? "NVIDIA" : "Groq"} text tutoring is not configured on this Scholar server. Choose Auto or another available provider.`, 503, "LIVE_TUTOR_PROVIDER_UNAVAILABLE");
    return [requested];
  }
  const preferred: Array<Exclude<LiveTutorProvider, "auto">> = preferLargeContext
    ? ["gemini", "groq", "nvidia"]
    : ["groq", "gemini", "nvidia"];
  const providers = preferred.filter(available);
  if (providers.length) return providers;
  throw new AIProviderError("No LAM AI text provider is configured on this Scholar server.", 503, "LIVE_TUTOR_PROVIDER_UNAVAILABLE");
}

function statusOf(error: unknown) {
  return error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
}

function canAutoFallback(error: unknown) {
  if (!(error instanceof AIProviderError)) return true;
  return error.status === 429 || error.status === 502 || error.status === 503 || error.status === 504;
}

export function validateGeminiCompletion(received: boolean, finishReason: string | undefined) {
  if (!received) throw new AIProviderError("Gemini returned no answer. Please retry.", 502, "GEMINI_EMPTY_RESPONSE");
  if (finishReason === "STOP") return;
  if (finishReason === "MAX_TOKENS") {
    throw new AIProviderError("The Gemini answer exceeded its output limit. Ask for a shorter response.", 422, "AI_OUTPUT_TRUNCATED");
  }
  if (["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII"].includes(finishReason ?? "")) {
    throw new AIProviderError("Gemini stopped this answer for safety. Rephrase the request and try again.", 422, "AI_CONTENT_FILTERED");
  }
  throw new AIProviderError("Connection to Gemini closed before the answer finished. Please retry.", 502, "AI_STREAM_INCOMPLETE");
}

async function streamGemini(request: LiveTutorProviderRequest) {
  const apiKey = request.credential?.apiKey ?? process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new AIProviderError("Gemini text tutoring is not configured.", 503, "GEMINI_NOT_CONFIGURED");
  const system = request.messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n");
  const contents = request.messages.filter((message) => message.role !== "system").map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
  const model = request.credential?.model ?? request.model ?? process.env.GEMINI_TEXT_MODEL?.trim() ?? "gemini-3.6-flash";
  try {
    const ai = new GoogleGenAI({ apiKey });
    request.onProviderResolved?.("gemini", model);
    const stream = await ai.models.generateContentStream({
      model,
      contents,
      config: {
        systemInstruction: system,
        temperature: request.temperature ?? 0.35,
        maxOutputTokens: request.maxTokens ?? 4_000,
        abortSignal: request.signal,
      },
    });
    let received = false;
    let finishReason: string | undefined;
    for await (const chunk of stream) {
      request.signal.throwIfAborted();
      const candidateFinishReason = chunk.candidates?.[0]?.finishReason;
      if (candidateFinishReason) finishReason = String(candidateFinishReason);
      const value = chunk.text;
      if (value) { received = true; request.onDelta(value); }
    }
    validateGeminiCompletion(received, finishReason);
    return model;
  } catch (error) {
    if (error instanceof AIProviderError) throw error;
    if (request.signal.aborted || (error instanceof Error && error.name === "AbortError")) throw new AIProviderError("The Gemini request was cancelled or timed out.", 504, "AI_TIMEOUT");
    const status = statusOf(error);
    if (status === 401 || status === 403) throw new AIProviderError("Gemini text tutoring is temporarily unavailable. Try Auto or contact support.", 503, "GEMINI_AUTH_FAILED");
    if (status === 404) throw new AIProviderError("The configured Gemini model is unavailable. Try Auto or another provider.", 503, "GEMINI_MODEL_UNAVAILABLE");
    if (status === 429) throw new AIProviderError("Gemini is busy right now. Try Auto or retry shortly.", 429, "GEMINI_RATE_LIMITED");
    if (status === 400 || status === 413 || status === 422) throw new AIProviderError("Gemini could not process this input. Shorten the conversation and retry.", 422, "GEMINI_INVALID_REQUEST");
    if (status === 503) throw new AIProviderError("Gemini is temporarily overloaded. Try Auto or retry shortly.", 503, "GEMINI_OVERLOADED");
    throw new AIProviderError("Gemini could not finish this response.", 502, "GEMINI_REQUEST_FAILED");
  }
}

async function streamNvidiaModel(request: LiveTutorProviderRequest, apiKey: string, endpoint: string, model: string) {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.35,
        max_tokens: request.maxTokens ?? 4_000,
        stream: true,
      }),
      signal: request.signal,
    });
    if (!response.ok || !response.body) {
      if (response.status === 401 || response.status === 403) throw new AIProviderError("NVIDIA text tutoring is temporarily unavailable. Try Auto or contact support.", 503, "NVIDIA_AUTH_FAILED");
      if (response.status === 404 || response.status === 410) throw new AIProviderError("The selected NVIDIA model is unavailable. Try Auto or another provider.", 503, "NVIDIA_MODEL_UNAVAILABLE");
      if (response.status === 429 || response.status === 503) throw new AIProviderError("NVIDIA is temporarily overloaded. Try Auto or retry shortly.", 503, "NVIDIA_OVERLOADED");
      if (response.status === 400 || response.status === 413 || response.status === 422) throw new AIProviderError("NVIDIA could not process this input. Shorten the conversation and retry.", 422, "NVIDIA_INVALID_REQUEST");
      throw new AIProviderError("NVIDIA could not start this response.", 502, "NVIDIA_REQUEST_FAILED");
    }
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("text/event-stream")) throw new AIProviderError("NVIDIA returned an unsupported stream format.", 502, "NVIDIA_MALFORMED_STREAM");

    request.onProviderResolved?.("nvidia", model);
    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let received = false;
    let completed = false;
    const consumeEvent = (data: string) => {
      if (!data) return;
      if (data === "[DONE]") { completed = true; return; }
      let parsed: {
        choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>;
        error?: { message?: string; code?: number | string };
      };
      try {
        const value = JSON.parse(data) as unknown;
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid event");
        parsed = value as typeof parsed;
      } catch {
        throw new AIProviderError("NVIDIA returned malformed streaming data. Try Auto or retry.", 502, "NVIDIA_MALFORMED_STREAM");
      }
      if (parsed.error) {
        const overloaded = parsed.error.code === 503 || /overload|unavailable/i.test(parsed.error.message ?? "");
        throw new AIProviderError(
          overloaded ? "NVIDIA is temporarily overloaded. Try Auto or retry shortly." : "NVIDIA could not finish this response.",
          overloaded ? 503 : 502,
          overloaded ? "NVIDIA_OVERLOADED" : "NVIDIA_STREAM_ERROR",
        );
      }
      const choice = parsed.choices?.[0];
      const value = choice?.delta?.content;
      if (value) { received = true; request.onDelta(value); }
      if (choice?.finish_reason === "stop") completed = true;
      else if (choice?.finish_reason === "length") throw new AIProviderError("The NVIDIA answer exceeded its output limit. Ask for a shorter response.", 422, "AI_OUTPUT_TRUNCATED");
      else if (choice?.finish_reason) throw new AIProviderError("NVIDIA stopped before completing the answer. Please retry.", 502, "AI_STREAM_INCOMPLETE");
    };

    while (true) {
      const chunk = await reader.read();
      const parsed = consumeSSEChunk(buffer, chunk.done ? decoder.decode() : decoder.decode(chunk.value, { stream: true }), { flush: chunk.done });
      buffer = parsed.buffer;
      for (const event of parsed.events) consumeEvent(event);
      if (chunk.done) break;
    }
    if (!received) throw new AIProviderError("NVIDIA returned no answer. Please retry.", 502, "NVIDIA_EMPTY_RESPONSE");
    if (!completed) throw new AIProviderError("Connection to NVIDIA closed before the answer finished. Please retry.", 502, "AI_STREAM_INCOMPLETE");
  } catch (error) {
    if (error instanceof AIProviderError) throw error;
    if (request.signal.aborted || (error instanceof Error && error.name === "AbortError")) throw new AIProviderError("The NVIDIA request was cancelled or timed out.", 504, "AI_TIMEOUT");
    throw new AIProviderError("NVIDIA could not finish this response.", 502, "NVIDIA_REQUEST_FAILED");
  } finally {
    await reader?.cancel().catch(() => undefined);
    reader?.releaseLock();
  }
}

async function streamNvidia(request: LiveTutorProviderRequest): Promise<string> {
  const apiKey = request.credential?.apiKey ?? (process.env.NVIDIA_TEXT_API_KEY ?? process.env.NVIDIA_API_KEY)?.trim();
  if (!apiKey) throw new AIProviderError("NVIDIA text tutoring is not configured.", 503, "NVIDIA_NOT_CONFIGURED");
  const configuredEndpoint = process.env.NVIDIA_TEXT_BASE_URL?.trim() || "https://integrate.api.nvidia.com/v1";
  const endpoint = /\/chat\/completions\/?$/i.test(configuredEndpoint)
    ? configuredEndpoint
    : `${configuredEndpoint.replace(/\/$/, "")}/chat/completions`;
  const configuredModel = request.credential?.model ?? request.model ?? process.env.NVIDIA_TEXT_MODEL?.trim() ?? "nvidia/nemotron-3-ultra-550b-a55b";
  await streamNvidiaModel(request, apiKey, endpoint, configuredModel);
  return configuredModel;
}

export async function streamLiveTutorText(request: LiveTutorProviderRequest): Promise<{ provider: Exclude<LiveTutorProvider, "auto">; model: string }> {
  const deadline = AbortSignal.timeout(LIVE_TUTOR_DEADLINE_MS);
  const signal = AbortSignal.any([request.signal, deadline]);
  const providers = request.credential && request.provider !== "auto"
    ? [request.provider as Exclude<LiveTutorProvider, "auto">]
    : resolveProviderOrder(request.provider, Boolean(request.preferLargeContext));
  let lastError: unknown;

  for (const provider of providers) {
    let emitted = false;
    const attempt: LiveTutorProviderRequest = {
      ...request,
      signal,
      onDelta: (value) => { emitted = true; request.onDelta(value); },
    };
    try {
      signal.throwIfAborted();
      if (provider === "groq") {
        const config = getScholarGroqConfig(request.credential, request.model);
        const model = await streamScholarGroqText({
          messages: request.messages as ScholarGroqMessage[],
          credential: request.credential,
          model: request.model,
          temperature: request.temperature,
          maxTokens: request.maxTokens,
          signal,
        }, attempt.onDelta, (resolvedModel) => request.onProviderResolved?.(provider, resolvedModel));
        return { provider, model: model || config.model };
      }
      if (provider === "gemini") return { provider, model: await streamGemini(attempt) };
      return { provider, model: await streamNvidia(attempt) };
    } catch (error) {
      lastError = error;
      if (signal.aborted) throw new AIProviderError("The LAM AI request was cancelled or timed out.", 504, "AI_TIMEOUT");
      if (request.provider !== "auto" || emitted || !canAutoFallback(error)) throw error;
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new AIProviderError("No LAM AI provider could complete this response.", 503, "LIVE_TUTOR_PROVIDER_UNAVAILABLE");
}
