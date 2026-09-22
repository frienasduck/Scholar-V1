import "server-only";

import { GoogleGenAI } from "@google/genai";
import { AIProviderError } from "@/lib/ai/errors";
import { getScholarGroqConfig, streamScholarGroqText, type ScholarGroqMessage } from "@/lib/ai/scholar-groq";
import type { LiveTutorProvider, LiveTutorProviderStatus } from "./types";

export interface LiveTutorProviderRequest {
  provider: LiveTutorProvider;
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
  const geminiModel = process.env.GEMINI_TEXT_MODEL?.trim() || "gemini-2.5-flash";
  const nvidiaModel = process.env.NVIDIA_TEXT_MODEL?.trim() || "meta/llama-3.3-70b-instruct";
  const groq = Boolean(process.env.GROQ_API_KEY?.trim());
  const gemini = Boolean(process.env.GEMINI_API_KEY?.trim());
  const nvidia = Boolean((process.env.NVIDIA_TEXT_API_KEY ?? process.env.NVIDIA_API_KEY)?.trim());
  return [
    { id: "auto", label: "Auto", available: groq || gemini || nvidia, note: "Chooses the best available model for this turn." },
    { id: "groq", label: "Groq", available: groq, model: groq ? groqModel : undefined, note: groq ? "Fast streamed tutoring" : "Not configured" },
    { id: "gemini", label: "Gemini", available: gemini, model: gemini ? geminiModel : undefined, note: gemini ? "Large-context tutoring" : "Text model not configured" },
    { id: "nvidia", label: "NVIDIA", available: nvidia, model: nvidia ? nvidiaModel : undefined, note: nvidia ? "Reasoning model" : "Text model not configured" },
  ];
}

function resolveProvider(requested: LiveTutorProvider, preferLargeContext: boolean): Exclude<LiveTutorProvider, "auto"> {
  const status = liveTutorProviderStatus();
  const available = (id: LiveTutorProvider) => status.some((item) => item.id === id && item.available);
  if (requested !== "auto") {
    if (!available(requested)) throw new AIProviderError(`${requested === "gemini" ? "Gemini" : requested === "nvidia" ? "NVIDIA" : "Groq"} text tutoring is not configured on this Scholar server. Choose Auto or another available provider.`, 503, "LIVE_TUTOR_PROVIDER_UNAVAILABLE");
    return requested;
  }
  if (preferLargeContext && available("gemini")) return "gemini";
  if (available("groq")) return "groq";
  if (available("gemini")) return "gemini";
  if (available("nvidia")) return "nvidia";
  throw new AIProviderError("No Live Tutor text provider is configured on this Scholar server.", 503, "LIVE_TUTOR_PROVIDER_UNAVAILABLE");
}

async function streamGemini(request: LiveTutorProviderRequest) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new AIProviderError("Gemini text tutoring is not configured.", 503, "GEMINI_NOT_CONFIGURED");
  const system = request.messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n");
  const contents = request.messages.filter((message) => message.role !== "system").map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
  try {
    const ai = new GoogleGenAI({ apiKey });
    const stream = await ai.models.generateContentStream({
      model: process.env.GEMINI_TEXT_MODEL?.trim() || "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: system,
        temperature: request.temperature ?? 0.35,
        maxOutputTokens: request.maxTokens ?? 4_000,
        abortSignal: request.signal,
      },
    });
    let received = false;
    for await (const chunk of stream) {
      request.signal.throwIfAborted();
      const value = chunk.text;
      if (value) { received = true; request.onDelta(value); }
    }
    if (!received) throw new AIProviderError("Gemini returned no answer. Please retry.", 502, "GEMINI_EMPTY_RESPONSE");
  } catch (error) {
    if (error instanceof AIProviderError) throw error;
    if (request.signal.aborted || (error instanceof Error && error.name === "AbortError")) throw new AIProviderError("The Gemini request was cancelled or timed out.", 504, "AI_TIMEOUT");
    const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
    if (status === 429) throw new AIProviderError("Gemini is busy right now. Try Auto or retry shortly.", 429, "GEMINI_RATE_LIMITED");
    throw new AIProviderError("Gemini could not finish this response.", 502, "GEMINI_REQUEST_FAILED");
  }
}

async function streamNvidia(request: LiveTutorProviderRequest) {
  const apiKey = (process.env.NVIDIA_TEXT_API_KEY ?? process.env.NVIDIA_API_KEY)?.trim();
  if (!apiKey) throw new AIProviderError("NVIDIA text tutoring is not configured.", 503, "NVIDIA_NOT_CONFIGURED");
  const endpoint = process.env.NVIDIA_TEXT_BASE_URL?.trim() || "https://integrate.api.nvidia.com/v1/chat/completions";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.NVIDIA_TEXT_MODEL?.trim() || "meta/llama-3.3-70b-instruct",
      messages: request.messages,
      temperature: request.temperature ?? 0.35,
      max_tokens: request.maxTokens ?? 4_000,
      stream: true,
    }),
    signal: request.signal,
  });
  if (!response.ok || !response.body) {
    if (response.status === 429) throw new AIProviderError("NVIDIA is busy right now. Try Auto or retry shortly.", 429, "NVIDIA_RATE_LIMITED");
    throw new AIProviderError("NVIDIA could not start this response.", 502, "NVIDIA_REQUEST_FAILED");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let received = false;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const data = line.trim().replace(/^data:\s*/, "");
      if (!data || data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
        const value = parsed.choices?.[0]?.delta?.content;
        if (value) { received = true; request.onDelta(value); }
      } catch { /* provider keepalive or non-data frame */ }
    }
  }
  if (!received) throw new AIProviderError("NVIDIA returned no answer. Please retry.", 502, "NVIDIA_EMPTY_RESPONSE");
}

export async function streamLiveTutorText(request: LiveTutorProviderRequest): Promise<{ provider: Exclude<LiveTutorProvider, "auto">; model: string }> {
  const provider = resolveProvider(request.provider, Boolean(request.preferLargeContext));
  if (provider === "groq") {
    const config = getScholarGroqConfig();
    request.onProviderResolved?.(provider, config.model);
    await streamScholarGroqText({
      messages: request.messages as ScholarGroqMessage[],
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      signal: request.signal,
    }, request.onDelta);
    return { provider, model: config.model };
  }
  if (provider === "gemini") {
    request.onProviderResolved?.(provider, process.env.GEMINI_TEXT_MODEL?.trim() || "gemini-2.5-flash");
    await streamGemini(request);
    return { provider, model: process.env.GEMINI_TEXT_MODEL?.trim() || "gemini-2.5-flash" };
  }
  request.onProviderResolved?.(provider, process.env.NVIDIA_TEXT_MODEL?.trim() || "meta/llama-3.3-70b-instruct");
  await streamNvidia(request);
  return { provider, model: process.env.NVIDIA_TEXT_MODEL?.trim() || "meta/llama-3.3-70b-instruct" };
}
