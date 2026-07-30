import "server-only";

import Groq from "groq-sdk";
import type { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";
import { AIProviderError } from "@/lib/ai/errors";

const REQUEST_TIMEOUT_MS = 120_000;
const DEFAULT_TEXT_MAX_TOKENS = 8_000;
const DEFAULT_JSON_MAX_TOKENS = 6_000;

export type ScholarGroqMessage = ChatCompletionMessageParam;

export type ScholarGroqRequest = {
  messages: ScholarGroqMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

type ScholarGroqConfig = {
  apiKey: string;
  model: string;
};

export function getScholarGroqConfig(): ScholarGroqConfig {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  const model = process.env.GROQ_MODEL?.trim();
  if (!apiKey) {
    throw new AIProviderError(
      "Scholar AI is temporarily unavailable. Please try again.",
      503,
      "GROQ_NOT_CONFIGURED",
    );
  }
  if (!model) {
    throw new AIProviderError(
      "Scholar AI is temporarily unavailable. Please try again.",
      503,
      "GROQ_MODEL_NOT_CONFIGURED",
    );
  }
  return { apiKey, model };
}

function client(config: ScholarGroqConfig): Groq {
  return new Groq({
    apiKey: config.apiKey,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 1,
  });
}

function temperature(value = 0.6): number {
  return Math.min(1.5, Math.max(0, value));
}

function maxTokens(value: number | undefined, fallback: number): number {
  return Math.min(16_384, Math.max(1, value ?? fallback));
}

function statusOf(error: unknown): number {
  return typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status?: unknown }).status)
    : 0;
}

function providerError(error: unknown): never {
  if (error instanceof AIProviderError) throw error;
  if (error instanceof Error && error.name === "AbortError") throw error;
  const status = statusOf(error);
  if (status === 400 || status === 413 || status === 422) {
    throw new AIProviderError(
      "This request is too large or could not be processed. Shorten it and try again.",
      status === 413 ? 413 : 422,
      "GROQ_INVALID_REQUEST",
    );
  }
  if (status === 401 || status === 403) {
    throw new AIProviderError(
      "Scholar AI is temporarily unavailable. Please try again.",
      503,
      "GROQ_AUTH_FAILED",
    );
  }
  if (status === 429) {
    throw new AIProviderError(
      "Scholar AI is busy right now. Please retry shortly.",
      429,
      "GROQ_RATE_LIMITED",
    );
  }
  if (status === 408 || status === 504) {
    throw new AIProviderError(
      "The AI request timed out. Please try again.",
      504,
      "GROQ_TIMEOUT",
    );
  }
  throw new AIProviderError(
    "Scholar AI is temporarily unavailable. Please try again.",
    502,
    "GROQ_REQUEST_FAILED",
  );
}

function parseJSONObject(text: string): unknown {
  const withoutFence = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(withoutFence);
  } catch {
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(withoutFence.slice(start, end + 1));
      } catch {
        // The caller performs one controlled repair attempt.
      }
    }
    throw new AIProviderError(
      "The AI returned invalid structured data. Please retry.",
      502,
      "GROQ_INVALID_JSON",
    );
  }
}

async function completeJSON(
  request: ScholarGroqRequest,
  repairAttempt: boolean,
): Promise<unknown> {
  const config = getScholarGroqConfig();
  const messages: ScholarGroqMessage[] = repairAttempt
    ? [
        ...request.messages,
        {
          role: "system",
          content:
            "The previous structured response was malformed. Regenerate the answer as exactly one valid JSON object matching the requested shape. Do not add markdown fences or commentary.",
        },
      ]
    : request.messages;
  const completion = await client(config).chat.completions.create(
    {
      model: config.model,
      messages,
      temperature: Math.min(0.8, temperature(request.temperature ?? 0.4)),
      max_completion_tokens: maxTokens(
        request.maxTokens,
        DEFAULT_JSON_MAX_TOKENS,
      ),
      response_format: { type: "json_object" },
      stream: false,
    },
    { signal: request.signal },
  );
  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new AIProviderError(
      "The AI returned no structured data. Please retry.",
      502,
      "GROQ_EMPTY_RESPONSE",
    );
  }
  return parseJSONObject(text);
}

export async function generateScholarGroqText(
  request: ScholarGroqRequest,
): Promise<string> {
  try {
    const config = getScholarGroqConfig();
    const completion = await client(config).chat.completions.create(
      {
        model: config.model,
        messages: request.messages,
        temperature: temperature(request.temperature),
        max_completion_tokens: maxTokens(
          request.maxTokens,
          DEFAULT_TEXT_MAX_TOKENS,
        ),
        stream: false,
      },
      { signal: request.signal },
    );
    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      throw new AIProviderError(
        "The AI returned no text. Please retry.",
        502,
        "GROQ_EMPTY_RESPONSE",
      );
    }
    return text;
  } catch (error) {
    return providerError(error);
  }
}

export async function generateScholarGroqJSON(
  request: ScholarGroqRequest,
): Promise<unknown> {
  try {
    return await completeJSON(request, false);
  } catch (error) {
    if (
      error instanceof AIProviderError &&
      error.code === "GROQ_INVALID_JSON"
    ) {
      try {
        return await completeJSON(request, true);
      } catch (repairError) {
        return providerError(repairError);
      }
    }
    return providerError(error);
  }
}

export async function streamScholarGroqText(
  request: ScholarGroqRequest,
  onDelta: (delta: string) => void,
): Promise<void> {
  try {
    const config = getScholarGroqConfig();
    const stream = await client(config).chat.completions.create(
      {
        model: config.model,
        messages: request.messages,
        temperature: temperature(request.temperature),
        max_completion_tokens: maxTokens(
          request.maxTokens,
          DEFAULT_TEXT_MAX_TOKENS,
        ),
        stream: true,
      },
      { signal: request.signal },
    );
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) onDelta(delta);
    }
  } catch (error) {
    return providerError(error);
  }
}
