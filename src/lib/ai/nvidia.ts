import "server-only";

import { AIProviderError } from "@/lib/ai/errors";

const DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b";
const DEFAULT_TIMEOUT_MS = 300_000;
const DEFAULT_MAX_TOKENS = 16_384;
const DEFAULT_REASONING_BUDGET = 16_384;
const DEFAULT_TOP_P = 0.95;

export type NvidiaChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export interface NvidiaGenerationOptions {
  messages: NvidiaChatMessage[];
  temperature?: number;
  signal?: AbortSignal;
  maxTokens?: number;
}

type NvidiaCompletion = {
  choices?: Array<{
    message?: { content?: string | null };
  }>;
};

type NvidiaStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string | null;
      reasoning_content?: string | null;
    };
  }>;
};

function apiKey(): string {
  const value = process.env.NVIDIA_TEXT_API_KEY?.trim();
  if (!value) {
    throw new AIProviderError(
      "NVIDIA AI is not configured on the server.",
      503,
      "NVIDIA_NOT_CONFIGURED",
    );
  }
  return value;
}

function endpoint(): string {
  const baseUrl = process.env.NVIDIA_TEXT_BASE_URL?.trim() || DEFAULT_BASE_URL;
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}

function model(): string {
  return process.env.NVIDIA_TEXT_MODEL?.trim() || DEFAULT_MODEL;
}

function numericEnvironment(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function requestBody(options: NvidiaGenerationOptions, stream: boolean) {
  return {
    model: model(),
    messages: options.messages,
    temperature: Math.min(2, Math.max(0, options.temperature ?? 1)),
    top_p: Math.min(1, Math.max(0, numericEnvironment("NVIDIA_TEXT_TOP_P", DEFAULT_TOP_P))),
    max_tokens: Math.min(
      DEFAULT_MAX_TOKENS,
      Math.max(1, options.maxTokens ?? DEFAULT_MAX_TOKENS),
    ),
    chat_template_kwargs: { enable_thinking: true },
    reasoning_budget: Math.max(
      0,
      numericEnvironment("NVIDIA_TEXT_REASONING_BUDGET", DEFAULT_REASONING_BUDGET),
    ),
    stream,
  };
}

async function nvidiaFetch(
  options: NvidiaGenerationOptions,
  stream: boolean,
  responseFormat?: { type: "json_object" },
): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal;
  try {
    const response = await fetch(endpoint(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        Accept: stream ? "text/event-stream" : "application/json",
      },
      body: JSON.stringify({
        ...requestBody(options, stream),
        ...(responseFormat ? { response_format: responseFormat } : {}),
      }),
      signal,
      cache: "no-store",
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new AIProviderError(
      "NVIDIA AI could not complete the request.",
      502,
      "NVIDIA_REQUEST_FAILED",
    );
  }
}

async function assertSuccess(response: Response): Promise<void> {
  if (response.ok) return;
  if (response.status === 401 || response.status === 403) {
    throw new AIProviderError(
      "NVIDIA authentication failed on the server.",
      503,
      "NVIDIA_AUTH_FAILED",
    );
  }
  if (response.status === 429) {
    throw new AIProviderError(
      "NVIDIA AI is rate-limited. Please retry shortly.",
      429,
      "NVIDIA_RATE_LIMITED",
    );
  }
  if (response.status === 400 || response.status === 422) {
    throw new AIProviderError(
      "NVIDIA AI rejected the request.",
      502,
      "NVIDIA_INVALID_REQUEST",
    );
  }
  throw new AIProviderError(
    "NVIDIA AI could not complete the request.",
    502,
    "NVIDIA_REQUEST_FAILED",
  );
}

function contentFromCompletion(completion: NvidiaCompletion): string {
  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new AIProviderError(
      "NVIDIA AI returned an empty response.",
      502,
      "NVIDIA_EMPTY_RESPONSE",
    );
  }
  return text;
}

function parseJSONObject(text: string): unknown {
  const withoutFence = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(withoutFence);
  } catch {
    const firstBrace = withoutFence.indexOf("{");
    const lastBrace = withoutFence.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(withoutFence.slice(firstBrace, lastBrace + 1));
      } catch {
        // The public error below is intentionally provider-safe.
      }
    }
    throw new AIProviderError(
      "NVIDIA AI returned malformed structured data.",
      502,
      "NVIDIA_INVALID_JSON",
    );
  }
}

export async function generateNvidiaText(options: NvidiaGenerationOptions): Promise<string> {
  const response = await nvidiaFetch(options, false);
  await assertSuccess(response);
  return contentFromCompletion(await response.json() as NvidiaCompletion);
}

export async function generateNvidiaJSON(options: NvidiaGenerationOptions): Promise<unknown> {
  let response = await nvidiaFetch(options, false, { type: "json_object" });
  if (response.status === 400 || response.status === 422) {
    response = await nvidiaFetch(options, false);
  }
  await assertSuccess(response);
  return parseJSONObject(contentFromCompletion(await response.json() as NvidiaCompletion));
}

export async function streamNvidiaText(
  options: NvidiaGenerationOptions,
  onDelta: (delta: string) => void,
): Promise<void> {
  const response = await nvidiaFetch(options, true);
  await assertSuccess(response);
  if (!response.body) {
    throw new AIProviderError(
      "NVIDIA AI returned no response stream.",
      502,
      "NVIDIA_EMPTY_RESPONSE",
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const data = line.startsWith("data:") ? line.slice(5).trim() : "";
        if (!data || data === "[DONE]") continue;
        let chunk: NvidiaStreamChunk;
        try {
          chunk = JSON.parse(data) as NvidiaStreamChunk;
        } catch {
          continue;
        }
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) onDelta(delta);
        // reasoning_content is intentionally never exposed to the client.
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
}
