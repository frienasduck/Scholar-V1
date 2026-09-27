import { afterEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));
const { resolveProviderOrder, streamLiveTutorText, validateGeminiCompletion } = await import("../src/lib/live-tutor/providers");

const originalFetch = globalThis.fetch;
const originalEnvironment = {
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GROQ_MODEL: process.env.GROQ_MODEL,
  GROQ_FALLBACK_MODEL: process.env.GROQ_FALLBACK_MODEL,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  NVIDIA_API_KEY: process.env.NVIDIA_API_KEY,
  NVIDIA_TEXT_API_KEY: process.env.NVIDIA_TEXT_API_KEY,
  NVIDIA_TEXT_BASE_URL: process.env.NVIDIA_TEXT_BASE_URL,
  NVIDIA_TEXT_MODEL: process.env.NVIDIA_TEXT_MODEL,
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function configureNvidia() {
  delete process.env.GEMINI_API_KEY;
  process.env.NVIDIA_TEXT_API_KEY = "test-key";
  delete process.env.NVIDIA_API_KEY;
  process.env.NVIDIA_TEXT_BASE_URL = "https://nvidia.test/v1";
  process.env.NVIDIA_TEXT_MODEL = "test-nvidia-model";
}

function providerRequest(provider: "auto" | "groq" | "gemini" | "nvidia", onDelta: (value: string) => void) {
  return {
    provider,
    messages: [{ role: "user" as const, content: "Explain force." }],
    signal: AbortSignal.timeout(5_000),
    onDelta,
  };
}

function nvidiaResponse(body: string, status = 200) {
  return new Response(body, { status, headers: { "content-type": status === 200 ? "text/event-stream" : "application/json" } });
}

describe("LAM AI provider resilience", () => {
  test("Gemini accepts only a natural completed stream", () => {
    expect(() => validateGeminiCompletion(true, "STOP")).not.toThrow();
    expect(() => validateGeminiCompletion(true, "MAX_TOKENS")).toThrow("output limit");
    expect(() => validateGeminiCompletion(true, "SAFETY")).toThrow("safety");
    expect(() => validateGeminiCompletion(true, undefined)).toThrow("before the answer finished");
    expect(() => validateGeminiCompletion(false, "STOP")).toThrow("no answer");
  });

  test("NVIDIA requires an explicit completed stream", async () => {
    delete process.env.GROQ_API_KEY;
    configureNvidia();
    globalThis.fetch = mock(async () => nvidiaResponse('data: {"choices":[{"delta":{"content":"partial"},"finish_reason":null}]}\n\n')) as unknown as typeof fetch;
    await expect(streamLiveTutorText(providerRequest("nvidia", () => undefined))).rejects.toMatchObject({ code: "AI_STREAM_INCOMPLETE" });
  });

  test("NVIDIA rejects malformed provider frames instead of silently succeeding", async () => {
    delete process.env.GROQ_API_KEY;
    configureNvidia();
    globalThis.fetch = mock(async () => nvidiaResponse("data: not-json\n\n")) as unknown as typeof fetch;
    await expect(streamLiveTutorText(providerRequest("nvidia", () => undefined))).rejects.toMatchObject({ code: "NVIDIA_MALFORMED_STREAM" });
  });

  test("NVIDIA maps upstream rate limiting without exposing the provider body", async () => {
    delete process.env.GROQ_API_KEY;
    configureNvidia();
    globalThis.fetch = mock(async () => nvidiaResponse('{"error":"raw provider detail"}', 429)) as unknown as typeof fetch;
    await expect(streamLiveTutorText(providerRequest("nvidia", () => undefined))).rejects.toMatchObject({
      code: "NVIDIA_OVERLOADED",
      status: 503,
      message: "NVIDIA is temporarily overloaded. Try Auto or retry shortly.",
    });
  });

  test("provider cancellation aborts in-flight NVIDIA work", async () => {
    delete process.env.GROQ_API_KEY;
    configureNvidia();
    const controller = new AbortController();
    globalThis.fetch = mock(async (_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      }, { once: true });
    })) as unknown as typeof fetch;
    const pending = streamLiveTutorText({ ...providerRequest("nvidia", () => undefined), signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "AI_TIMEOUT", status: 504 });
  });

  test("Auto falls back to another configured provider before any text is emitted", async () => {
    configureNvidia();
    process.env.GROQ_API_KEY = "test-key";
    process.env.GROQ_MODEL = "test-groq-model";
    process.env.GROQ_FALLBACK_MODEL = "test-groq-model";
    const chunks: string[] = [];
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("api.groq.com")) return new Response('{"error":{"message":"busy"}}', { status: 503, headers: { "content-type": "application/json" } });
      return nvidiaResponse('data: {"choices":[{"delta":{"content":"Force"},"finish_reason":null}]}\n\ndata: [DONE]\n\n');
    }) as unknown as typeof fetch;

    const result = await streamLiveTutorText(providerRequest("auto", (value) => chunks.push(value)));
    expect(result).toEqual({ provider: "nvidia", model: "test-nvidia-model" });
    expect(chunks).toEqual(["Force"]);
  });

  test("Auto never mixes another provider into an already-started answer", async () => {
    configureNvidia();
    process.env.GROQ_API_KEY = "test-key";
    process.env.GROQ_MODEL = "test-groq-model";
    process.env.GROQ_FALLBACK_MODEL = "test-groq-model";
    const chunks: string[] = [];
    const calls: string[] = [];
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      calls.push(url);
      if (url.includes("api.groq.com")) {
        return new Response('data: {"id":"turn","choices":[{"index":0,"delta":{"content":"Partial"},"finish_reason":null}]}\n\n', {
          headers: { "content-type": "text/event-stream" },
        });
      }
      return nvidiaResponse('data: {"choices":[{"delta":{"content":" replacement"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
    }) as unknown as typeof fetch;

    await expect(streamLiveTutorText(providerRequest("auto", (value) => chunks.push(value)))).rejects.toMatchObject({ code: "AI_STREAM_INCOMPLETE" });
    expect(chunks).toEqual(["Partial"]);
    expect(calls.some((url) => url.includes("nvidia.test"))).toBe(false);
  });

  test("provider ordering keeps large-context preference without mixing unavailable providers", () => {
    process.env.GROQ_API_KEY = "test-key";
    process.env.GEMINI_API_KEY = "test-key";
    configureNvidia();
    process.env.GEMINI_API_KEY = "test-key";
    expect(resolveProviderOrder("auto", true)).toEqual(["gemini", "groq", "nvidia"]);
    expect(resolveProviderOrder("groq", false)).toEqual(["groq"]);
  });
});
