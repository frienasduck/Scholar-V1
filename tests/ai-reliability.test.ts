import { afterEach, describe, expect, mock, test } from "bun:test";
mock.module("server-only", () => ({}));
const { validateCompletion, parseJSONObject } = await import("../src/lib/ai/scholar-groq");
const { AIRequestBodyError, readBoundedAIJSON, readBoundedMultipartForm } = await import("../src/lib/ai/request");
const { AIProviderError, publicAIError } = await import("../src/lib/ai/errors");
import { AIClientError, requestAIStream, withRetry } from "../src/lib/ai/client";
import { checkpointSchema } from "../src/lib/ai/schemas";
import { validateLiveTutorMessageScope, validateLiveTutorSessionScope } from "../src/lib/live-tutor/session-scope";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const request = { messages: [{ role: "user" as const, content: "Explain force" }], scholarClass: 11 as const, jeeMode: false };
function streamResponse(events: unknown[]) {
  return new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(""), { headers: { "content-type": "text/event-stream" } });
}
function chunkedStreamResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  }), { headers: { "content-type": "text/event-stream" } });
}

describe("AI completion integrity", () => {
  test("accepts only a complete nonempty answer", () => {
    expect(validateCompletion(" answer ", "stop")).toBe("answer");
    expect(() => validateCompletion("", "stop")).toThrow("no answer");
    expect(() => validateCompletion("partial", "length")).toThrow("output limit");
    expect(() => validateCompletion("partial", null)).toThrow("Connection lost");
  });
  test("rejects malformed JSON and accepts optional fences", () => {
    expect(parseJSONObject('```json\n{"cards": []}\n```')).toEqual({ cards: [] });
    expect(() => parseJSONObject('{"cards":')).toThrow("invalid structured data");
  });
  test("quiz answer cannot point outside its options", () => {
    expect(checkpointSchema.safeParse({ question: "Force?", options: ["ma", "mv"], correctAnswer: 2, explanation: "F=ma" }).success).toBe(false);
  });
  test("successful stream emits text once", async () => {
    globalThis.fetch = mock(async () => streamResponse([{ delta: "Newton" }, { delta: " explains force." }, { done: true }])) as unknown as typeof fetch;
    const deltas: string[] = [];
    expect(await requestAIStream(request, new AbortController().signal, delta => deltas.push(delta))).toBe("Newton explains force.");
    expect(deltas).toEqual(["Newton", " explains force."]);
  });
  test("stream parser handles split CRLF boundaries and a final unterminated frame", async () => {
    globalThis.fetch = mock(async () => chunkedStreamResponse([
      'data: {"delta":"Newton"}\r',
      '\n\r',
      '\ndata: {"delta":" works"}\r\n\r\n',
      'data: {"done":true}',
    ])) as unknown as typeof fetch;
    expect(await requestAIStream(request, new AbortController().signal)).toBe("Newton works");
  });
  test("EOF is not successful completion", async () => {
    globalThis.fetch = mock(async () => streamResponse([{ delta: "partial" }])) as unknown as typeof fetch;
    await expect(requestAIStream(request, new AbortController().signal)).rejects.toThrow("Connection lost");
  });
  test("empty done is rejected", async () => {
    globalThis.fetch = mock(async () => streamResponse([{ done: true }])) as unknown as typeof fetch;
    await expect(requestAIStream(request, new AbortController().signal)).rejects.toThrow("empty answer");
  });
  test("provider stream error is actionable", async () => {
    globalThis.fetch = mock(async () => streamResponse([{ delta: "partial" }, { error: { message: "Please retry later." } }])) as unknown as typeof fetch;
    await expect(requestAIStream(request, new AbortController().signal)).rejects.toThrow("Please retry later");
  });
  test("HTTP quota failure never retries based on message wording", async () => {
    const operation = mock(async () => { throw new AIClientError("Your daily allowance is exhausted", 429); });
    await expect(withRetry(operation)).rejects.toThrow("daily allowance");
    expect(operation).toHaveBeenCalledTimes(1);
  });
  test("already-cancelled requests do not call provider", async () => {
    const operation = mock(async () => "unused");
    await expect(withRetry(operation, { signal: AbortSignal.abort() })).rejects.toThrow();
    expect(operation).not.toHaveBeenCalled();
  });
  test("cancellation interrupts retry backoff immediately", async () => {
    const controller = new AbortController();
    const operation = mock(async () => { throw new Error("temporary network failure"); });
    const started = Date.now();
    const pending = withRetry(operation, { retries: 2, baseDelayMs: 5_000, signal: controller.signal });
    setTimeout(() => controller.abort(), 10);
    await expect(pending).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(operation).toHaveBeenCalledTimes(1);
  });
  test("AI request bodies enforce content type and byte limits", async () => {
    await expect(readBoundedAIJSON(new Request("https://scholar.test/api/ai", { method: "POST", body: "{}" }), 100)).rejects.toBeInstanceOf(AIRequestBodyError);
    await expect(readBoundedAIJSON(new Request("https://scholar.test/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: "x".repeat(200) }) }), 100)).rejects.toMatchObject({ status: 413, code: "AI_REQUEST_TOO_LARGE" });
  });
  test("multipart voice bodies are bounded before form parsing", async () => {
    const accepted = new FormData();
    accepted.set("audio", new File(["voice"], "voice.webm", { type: "audio/webm" }));
    expect((await readBoundedMultipartForm(new Request("https://scholar.test/api/lam/transcribe", { method: "POST", body: accepted }), 2_000)).get("audio")).toBeInstanceOf(File);

    const oversized = new FormData();
    oversized.set("audio", new File(["x".repeat(2_000)], "voice.webm", { type: "audio/webm" }));
    await expect(readBoundedMultipartForm(new Request("https://scholar.test/api/lam/transcribe", { method: "POST", body: oversized }), 1_000)).rejects.toMatchObject({
      status: 413,
      code: "TRANSCRIPTION_REQUEST_TOO_LARGE",
    });
  });
  test("live tutor sessions and turns cannot cross personality or session boundaries", () => {
    expect(validateLiveTutorSessionScope(
      { userId: "user-a", profileId: "class-11", personality: "calm" },
      { userId: "user-a", profileId: "class-11", personality: "exam" },
    )).toMatchObject({ status: 409 });
    expect(validateLiveTutorSessionScope(
      { userId: "user-b", profileId: "class-11", personality: "calm" },
      { userId: "user-a", profileId: "class-11", personality: "calm" },
    )).toMatchObject({ status: 403 });
    expect(validateLiveTutorMessageScope({ sessionId: "session-b" }, "session-a")).toMatchObject({ status: 403 });
  });
  test("unknown provider exceptions are redacted while safe provider errors keep stable codes", () => {
    const raw = publicAIError(new Error("upstream rejected bearer provider-secret-value"));
    expect(raw).toEqual({
      message: "The AI service could not be reached. This is a temporary infrastructure issue.",
      status: 500,
      code: "AI_INTERNAL_ERROR",
    });
    expect(JSON.stringify(raw)).not.toContain("provider-secret-value");
    expect(publicAIError(new AIProviderError("Scholar AI is busy right now.", 429, "GROQ_RATE_LIMITED"))).toEqual({
      message: "Scholar AI is busy right now.",
      status: 429,
      code: "GROQ_RATE_LIMITED",
    });
  });
});
