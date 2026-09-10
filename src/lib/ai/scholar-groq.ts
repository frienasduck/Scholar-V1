import "server-only";

import Groq from "groq-sdk";
import type { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";
import { AIProviderError } from "@/lib/ai/errors";

export type ScholarGroqMessage = ChatCompletionMessageParam;
export type ScholarGroqRequest = {
  messages: ScholarGroqMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

export function getScholarGroqConfig() {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) throw new AIProviderError("Scholar AI is not configured. Please contact support.", 503, "GROQ_NOT_CONFIGURED");
  // Preserve the deployed legacy alias mapping; model availability is account-specific.
  const configured = process.env.GROQ_MODEL?.trim();
  const model = configured && configured !== "llama-3.3-70b-versatile" ? configured : "openai/gpt-oss-20b";
  const fallback = process.env.GROQ_FALLBACK_MODEL?.trim() || (model === "openai/gpt-oss-20b" ? "openai/gpt-oss-120b" : "openai/gpt-oss-20b");
  return { apiKey, model, models: [...new Set([model, fallback])] };
}

function statusOf(error: unknown) {
  return error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
}

function normalizeError(error: unknown, signal: AbortSignal): Error {
  if (signal.aborted) return new AIProviderError("The AI request timed out or was cancelled. Please try again.", 504, "AI_TIMEOUT");
  if (error instanceof AIProviderError) return error;
  const status = statusOf(error);
  if (status === 401 || status === 403) return new AIProviderError("Scholar AI is temporarily unavailable. Please contact support.", 503, "GROQ_AUTH_FAILED");
  if (status === 429) return new AIProviderError("Scholar AI is busy right now. Please retry shortly.", 429, "GROQ_RATE_LIMITED");
  if (status === 404) return new AIProviderError("This AI model is unavailable. Please try again.", 503, "GROQ_MODEL_UNAVAILABLE");
  if ([400, 413, 422].includes(status)) return new AIProviderError("This request could not be processed. Shorten the input and try again.", 422, "GROQ_INVALID_REQUEST");
  return new AIProviderError("Scholar AI could not finish this request. Please retry.", 502, "GROQ_REQUEST_FAILED");
}

function canFallback(error: unknown) {
  if (error instanceof AIProviderError) return error.code === "GROQ_EMPTY_RESPONSE";
  const status = statusOf(error);
  return status === 0 || status === 404 || status === 429 || status >= 500;
}

function parameters(request: ScholarGroqRequest, model: string, json: boolean) {
  return {
    model,
    messages: request.messages,
    temperature: Math.min(1.5, Math.max(0, request.temperature ?? (json ? 0.4 : 0.6))),
    // Reasoning tokens share this budget. Large structured documents need room
    // for both reasoning and the actual JSON, rather than a tiny fallback cap.
    max_completion_tokens: Math.min(16_384, Math.max(256, request.maxTokens ?? (json ? 12_000 : 4_000))),
    ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" as const, include_reasoning: false } : {}),
    ...(json ? { response_format: { type: "json_object" as const } } : {}),
  };
}

export function validateCompletion(text: string | null | undefined, finishReason: string | null | undefined): string {
  if (finishReason === "length") throw new AIProviderError("The answer exceeded its output limit. Request fewer questions or a smaller section.", 422, "AI_OUTPUT_TRUNCATED");
  if (finishReason === "content_filter") throw new AIProviderError("The AI could not answer this request. Try rephrasing it.", 422, "AI_CONTENT_FILTERED");
  if (!text?.trim()) throw new AIProviderError("The AI returned no answer. Please retry.", 502, "GROQ_EMPTY_RESPONSE");
  if (finishReason !== "stop") throw new AIProviderError("Connection lost before the answer finished. Please retry.", 502, "AI_STREAM_INCOMPLETE");
  return text.trim();
}

export function parseJSONObject(text: string): unknown {
  const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(clean); }
  catch { throw new AIProviderError("The AI returned invalid structured data. Please retry.", 502, "GROQ_INVALID_JSON"); }
}

async function complete(request: ScholarGroqRequest, json: boolean): Promise<string> {
  const config = getScholarGroqConfig();
  const deadline = AbortSignal.timeout(50_000);
  const signal = request.signal ? AbortSignal.any([request.signal, deadline]) : deadline;
  const client = new Groq({ apiKey: config.apiKey, timeout: 25_000, maxRetries: 0 });
  for (const [index, model] of config.models.entries()) {
    try {
      signal.throwIfAborted();
      const result = await client.chat.completions.create({ ...parameters(request, model, json), stream: false }, { signal });
      const choice = result.choices[0];
      return validateCompletion(choice?.message.content, choice?.finish_reason);
    } catch (error) {
      console.warn("[Scholar AI]", { model, status: statusOf(error), code: error instanceof AIProviderError ? error.code : "PROVIDER_FAILURE" });
      if (!signal.aborted && index < config.models.length - 1 && canFallback(error)) continue;
      throw normalizeError(error, signal);
    }
  }
  throw new AIProviderError("Scholar AI is unavailable.", 503);
}

export async function generateScholarGroqText(request: ScholarGroqRequest): Promise<string> {
  return complete(request, false);
}

export async function generateScholarGroqJSON(request: ScholarGroqRequest): Promise<unknown> {
  // Syntax/schema repair belongs to the API route so there is only one retry budget.
  return parseJSONObject(await complete(request, true));
}

export async function streamScholarGroqText(request: ScholarGroqRequest, onDelta: (delta: string) => void): Promise<void> {
  const config = getScholarGroqConfig();
  const deadline = AbortSignal.timeout(50_000);
  const signal = request.signal ? AbortSignal.any([request.signal, deadline]) : deadline;
  const client = new Groq({ apiKey: config.apiKey, timeout: 20_000, maxRetries: 0 });
  for (const [index, model] of config.models.entries()) {
    let text = "";
    let finish: string | null | undefined;
    const idle = new AbortController();
    let timer = setTimeout(() => idle.abort(), 20_000);
    const attemptSignal = AbortSignal.any([signal, idle.signal]);
    try {
      attemptSignal.throwIfAborted();
      const stream = await client.chat.completions.create({ ...parameters(request, model, false), stream: true }, { signal: attemptSignal });
      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (choice?.finish_reason) finish = choice.finish_reason;
        const delta = choice?.delta.content;
        if (delta) {
          clearTimeout(timer);
          timer = setTimeout(() => idle.abort(), 20_000);
          text += delta;
          onDelta(delta);
        }
      }
      validateCompletion(text, finish);
      return;
    } catch (error) {
      console.warn("[Scholar AI stream]", { model, status: statusOf(error), partial: Boolean(text), code: error instanceof AIProviderError ? error.code : "PROVIDER_FAILURE" });
      if (!text && !signal.aborted && index < config.models.length - 1 && canFallback(error)) continue;
      throw normalizeError(error, attemptSignal);
    } finally {
      clearTimeout(timer);
      idle.abort();
    }
  }
}
