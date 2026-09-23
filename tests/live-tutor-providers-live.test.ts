import { describe, expect, mock, test } from "bun:test";

// Explicit opt-in: these checks spend a very small amount of configured
// provider quota. They never print credentials, prompts, or response text.
mock.module("server-only", () => ({}));
const { streamLiveTutorText } = await import("../src/lib/live-tutor/providers");

describe.skipIf(process.env.SCHOLAR_LIVE_LAM_PROVIDERS !== "1")("live LAM AI provider adapters", () => {
  for (const provider of ["groq", "gemini", "nvidia", "auto"] as const) {
    test(`${provider} streams a real answer`, async () => {
      let text = "";
      const resolved = await streamLiveTutorText({
        provider,
        messages: [
          { role: "system", content: "You are a concise Class 11 physics tutor." },
          { role: "user", content: "State Newton's second law in one sentence." },
        ],
        signal: AbortSignal.timeout(40_000),
        temperature: 0.1,
        maxTokens: 80,
        onDelta: (value) => { text += value; },
      });
      expect(["groq", "gemini", "nvidia"]).toContain(resolved.provider);
      expect(text.trim().length).toBeGreaterThan(5);
      console.info(JSON.stringify({ provider, resolved: resolved.provider, status: "passed", outputCharacters: text.trim().length }));
    }, 50_000);
  }
});
