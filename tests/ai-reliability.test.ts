import { afterEach, describe, expect, mock, test } from "bun:test";
mock.module("server-only", () => ({}));
const { validateCompletion, parseJSONObject } = await import("../src/lib/ai/scholar-groq");
import { AIClientError, requestAIStream, withRetry } from "../src/lib/ai/client";
import { checkpointSchema } from "../src/lib/ai/schemas";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const request = { messages: [{ role: "user" as const, content: "Explain force" }], scholarClass: 11 as const, jeeMode: false };
function streamResponse(events: unknown[]) {
  return new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(""), { headers: { "content-type": "text/event-stream" } });
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
});
