import type { AIMode } from "@/lib/ai/schemas";
import { consumeSSEChunk } from "@/lib/ai/sse";

// ===== Retry helpers =====

/**
 * Retry with exponential backoff. Only retries on transient errors
 * (5xx, network, timeout). Never retries 4xx client errors or quota/rate
 * limit responses. Returns the first successful result or throws the
 * last error.
 */
export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  { retries = 1, baseDelayMs = 800, signal }: { retries?: number; baseDelayMs?: number; signal?: AbortSignal } = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      signal?.throwIfAborted();
      const composite = signal ?? new AbortController().signal;
      return await fn(composite);
    } catch (error) {
      lastError = error;
      // Only retry on transient errors
      if (!isRetryable(error) || attempt >= retries) throw error;
      if (signal?.aborted) throw error;
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 200;
      await sleep(delay, signal);
    }
  }
  throw lastError;
}

function isRetryable(error: unknown): boolean {
  if (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name)) return false;
  if (error instanceof AIClientError) return error.status >= 500;
  const msg = error instanceof Error ? error.message : "";
  // Don't retry 4xx, quota, rate limit, or auth errors
  if (/4[0-9]{2}|QUOTA|RATE_LIMIT|AUTH|PLUS_REQUIRED|ENTITLEMENT/i.test(msg)) return false;
  // Retry on 5xx, timeout, network, and generic provider errors
  return true;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const error = new Error("The request was cancelled.");
      error.name = "AbortError";
      reject(error);
      return;
    }
    const timer = setTimeout(done, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      const error = new Error("The request was cancelled.");
      error.name = "AbortError";
      reject(error);
    };
    function done() {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export class AIClientError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "AIClientError";
  }
}

export interface AIClientMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIClientRequest {
  resourceContext?: { resourceIds?: string[]; subjectId?: string; chapterId?: string };
  requestId?: string;
  messages: AIClientMessage[];
  persona?: string;
  mode?: AIMode;
  temperature?: number;
  scholarClass: 9 | 11;
  jeeMode: boolean;
  feature?: "aisig" | "homework_scanner" | "workspace_ai" | "lam_ai" | "slideshow_generation_plus" | "premium_experiments";
  usage?: "quiz_generation" | "slideshow_generation";
}

type ErrorEnvelope = { ok?: false; error?: { message?: string } | string };

async function readJSON(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json") && !contentType.includes("+json")) {
    throw new Error("The AI service returned an unsupported response format.");
  }
  const raw = await response.text();
  if (!raw.trim()) throw new Error("The AI service returned an empty response.");
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("The AI service returned malformed data. Please retry.");
  }
}

export function aiErrorMessage(value: unknown, fallback: string): string {
  const envelope = value as ErrorEnvelope;
  if (typeof envelope?.error === "string") return envelope.error;
  if (envelope?.error && typeof envelope.error === "object" && typeof envelope.error.message === "string") {
    return envelope.error.message;
  }
  return fallback;
}

export async function requestAIText(request: AIClientRequest, signal: AbortSignal): Promise<string> {
  const response = await fetch(request.feature === "slideshow_generation_plus" ? "/api/ai/slideshow" : "/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...request, requestId: request.requestId ?? crypto.randomUUID(), mode: request.mode ?? "chat" }),
    signal,
  });
  const value = await readJSON(response) as { ok?: boolean; text?: unknown };
  if (!response.ok || value.ok !== true) throw new AIClientError(aiErrorMessage(value, `AI request failed (HTTP ${response.status}).`), response.status);
  if (typeof value.text !== "string" || !value.text.trim()) throw new Error("The AI service returned no text.");
  return value.text;
}

export async function requestAIData<T>(request: AIClientRequest, signal: AbortSignal): Promise<T> {
  const response = await fetch(request.feature === "slideshow_generation_plus" ? "/api/ai/slideshow" : "/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...request, requestId: request.requestId ?? crypto.randomUUID(), mode: request.mode ?? "json" }),
    signal,
  });
  const value = await readJSON(response) as { ok?: boolean; data?: unknown };
  if (!response.ok || value.ok !== true) throw new AIClientError(aiErrorMessage(value, `AI request failed (HTTP ${response.status}).`), response.status);
  if (!("data" in value)) throw new Error("The AI service returned no structured data.");
  return value.data as T;
}

export async function requestAIStream(
  request: AIClientRequest,
  signal: AbortSignal,
  onDelta?: (chunk: string, full: string) => void,
): Promise<string> {
  const response = await fetch("/api/ai?stream=1", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...request, requestId: request.requestId ?? crypto.randomUUID(), mode: request.mode ?? "stream" }),
    signal,
  });
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!response.ok || !response.body) {
    const value = await readJSON(response).catch(() => null);
    throw new AIClientError(aiErrorMessage(value, `AI stream failed (HTTP ${response.status}).`), response.status);
  }
  if (!contentType.includes("text/event-stream")) {
    throw new Error("The AI service returned an unsupported stream format.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  const consumeEvent = (raw: string): string | null => {
    let event: { delta?: unknown; done?: unknown; error?: { message?: string } | string };
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid event");
      event = parsed as typeof event;
    } catch {
      throw new Error("The AI stream returned malformed data.");
    }
    if (typeof event.delta === "string") {
      full += event.delta;
      onDelta?.(event.delta, full);
    }
    if (event.error) throw new Error(aiErrorMessage({ error: event.error }, "AI streaming failed."));
    if (event.done === true) {
      if (!full.trim()) throw new Error("The AI returned an empty answer. Please retry.");
      return full;
    }
    return null;
  };
  try {
    while (true) {
      const chunk = await reader.read();
      const parsed = consumeSSEChunk(buffer, chunk.done ? decoder.decode() : decoder.decode(chunk.value, { stream: true }), { flush: chunk.done });
      buffer = parsed.buffer;
      for (const event of parsed.events) {
        const completed = consumeEvent(event);
        if (completed !== null) return completed;
      }
      if (chunk.done) break;
    }
    throw new Error("Connection lost before the AI finished. Please retry.");
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
