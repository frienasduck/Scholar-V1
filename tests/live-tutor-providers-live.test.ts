import { describe, expect, mock, test } from "bun:test";

// Explicit opt-in: these checks spend a very small amount of configured
// provider quota. They never print credentials, prompts, or response text.
mock.module("server-only", () => ({}));
const { streamLiveTutorText } = await import("../src/lib/live-tutor/providers");

describe.skipIf(process.env.SCHOLAR_LIVE_LAM_PROVIDERS !== "1")("live LAM AI provider adapters", () => {
  for (const provider of ["groq", "gemini", "nvidia", "auto"] as const) {
    test(`${provider} streams a real answer`, async () => {
      let text = "";
      let resolved;
      try { resolved = await streamLiveTutorText({
        provider,
        messages: [
          { role: "system", content: "You are a concise Class 11 physics tutor." },
          { role: "user", content: "State Newton's second law in one sentence." },
        ],
        signal: AbortSignal.timeout(55_000),
        temperature: 0.1,
        // Exercise the same bounded 4,000-token default as production. The
        // old 80-token override also capped thinking, truncating valid Gemini
        // reasoning before completion (confirmed AI_OUTPUT_TRUNCATED, 422).
        // https://ai.google.dev/gemini-api/docs/generate-content/thinking
        onDelta: (value) => { text += value; },
      }); } catch (error) {
        const code = error && typeof error === "object" && "code" in error && /^[A-Z_]+$/.test(String(error.code)) ? String(error.code) : "PROBE_FAILED";
        const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
        console.info(JSON.stringify({ capability: `live-tutor-${provider}`, status: "failed", code, providerStatus: status }));
        throw new Error(`${provider}: ${code} (${status})`);
      }
      expect(["groq", "gemini", "nvidia"]).toContain(resolved.provider);
      if (provider !== "auto") expect(resolved.provider).toBe(provider);
      expect(text.trim().length).toBeGreaterThan(5);
      console.info(JSON.stringify({ provider, resolved: resolved.provider, status: "passed", outputCharacters: text.trim().length }));
    }, 60_000);
  }
});
