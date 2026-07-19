import "server-only";

import Groq from "groq-sdk";
import type { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";
import { AIProviderError } from "@/lib/ai/errors";

const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_FALLBACK_MODEL = "llama-3.1-8b-instant";
const DEFAULT_TIMEOUT_MS = 90_000;
const FALLBACK_MAX_TOKENS = 1_500;

function getClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new AIProviderError("Groq is not configured on the server.", 503, "GROQ_NOT_CONFIGURED");
  }
  return new Groq({ apiKey, timeout: DEFAULT_TIMEOUT_MS, maxRetries: 1 });
}

function models(): string[] {
  const primary = process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL;
  const fallback = process.env.GROQ_FALLBACK_MODEL?.trim() || DEFAULT_FALLBACK_MODEL;
  return primary === fallback ? [primary] : [primary, fallback];
}

export interface GroqGenerationOptions {
  messages: ChatCompletionMessageParam[];
  temperature: number;
  signal?: AbortSignal;
  maxTokens?: number;
}

function providerError(error: unknown): never {
  const status = typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status?: unknown }).status)
    : 502;
  if (status === 401 || status === 403) {
    throw new AIProviderError("Groq authentication failed on the server.", 503, "GROQ_AUTH_FAILED");
  }
  if (status === 429) {
    throw new AIProviderError("Groq is rate-limited. Please retry shortly.", 429, "GROQ_RATE_LIMITED");
  }
  if (error instanceof Error && error.name === "AbortError") throw error;
  throw new AIProviderError("Groq could not complete the request.", 502, "GROQ_REQUEST_FAILED");
}

function statusOf(error: unknown): number {
  return typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status?: unknown }).status)
    : 0;
}

export async function generateGroqText(options: GroqGenerationOptions): Promise<string> {
  const candidates = models();
  for (const [index, candidate] of candidates.entries()) {
    try {
      const completion = await getClient().chat.completions.create({
        model: candidate,
        messages: options.messages,
        temperature: options.temperature,
        max_completion_tokens: index === 0 ? options.maxTokens ?? 6_000 : Math.min(options.maxTokens ?? 6_000, FALLBACK_MAX_TOKENS),
        stream: false,
      }, { signal: options.signal });
      const text = completion.choices[0]?.message?.content?.trim();
      if (!text) throw new AIProviderError("Groq returned an empty response.", 502, "GROQ_EMPTY_RESPONSE");
      return text;
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      if (statusOf(error) === 429 && index < candidates.length - 1) continue;
      return providerError(error);
    }
  }
  throw new AIProviderError("Groq is rate-limited. Please retry shortly.", 429, "GROQ_RATE_LIMITED");
}

export async function generateGroqJSON(options: GroqGenerationOptions): Promise<unknown> {
  const candidates = models();
  for (const [index, candidate] of candidates.entries()) {
    try {
      const completion = await getClient().chat.completions.create({
        model: candidate,
        messages: options.messages,
        temperature: options.temperature,
        max_completion_tokens: index === 0 ? options.maxTokens ?? 8_000 : Math.min(options.maxTokens ?? 8_000, FALLBACK_MAX_TOKENS),
        response_format: { type: "json_object" },
        stream: false,
      }, { signal: options.signal });
      const text = completion.choices[0]?.message?.content?.trim();
      if (!text) throw new AIProviderError("Groq returned an empty JSON response.", 502, "GROQ_EMPTY_RESPONSE");
      try {
        return JSON.parse(text);
      } catch {
        throw new AIProviderError("Groq returned malformed structured data.", 502, "GROQ_INVALID_JSON");
      }
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      if (statusOf(error) === 429 && index < candidates.length - 1) continue;
      return providerError(error);
    }
  }
  throw new AIProviderError("Groq is rate-limited. Please retry shortly.", 429, "GROQ_RATE_LIMITED");
}

export async function streamGroqText(
  options: GroqGenerationOptions,
  onDelta: (delta: string) => void,
): Promise<void> {
  const candidates = models();
  for (const [index, candidate] of candidates.entries()) {
    let emitted = false;
    try {
      const stream = await getClient().chat.completions.create({
        model: candidate,
        messages: options.messages,
        temperature: options.temperature,
        max_completion_tokens: index === 0 ? options.maxTokens ?? 8_000 : Math.min(options.maxTokens ?? 8_000, FALLBACK_MAX_TOKENS),
        stream: true,
      }, { signal: options.signal });
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          emitted = true;
          onDelta(delta);
        }
      }
      return;
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      if (!emitted && statusOf(error) === 429 && index < candidates.length - 1) continue;
      return providerError(error);
    }
  }
  throw new AIProviderError("Groq is rate-limited. Please retry shortly.", 429, "GROQ_RATE_LIMITED");
}
