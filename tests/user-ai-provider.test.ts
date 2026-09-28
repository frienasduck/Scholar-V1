import { describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));
const { sealUserAISettings, unsealUserAISettings, userAISettingsSchema } = await import("../src/lib/ai/user-provider");

describe("account-bound custom AI credentials", () => {
  test("seals a key and never returns it for a different account or tampered cookie", () => {
    const input = { userId: "user-a", provider: "groq" as const, model: "openai/gpt-oss-20b", scopes: ["lam" as const], apiKey: "a-private-provider-key" };
    const sealed = sealUserAISettings(input);
    expect(sealed).not.toContain(input.apiKey);
    expect(unsealUserAISettings(sealed, "user-a")).toEqual({ provider: input.provider, model: input.model, scopes: input.scopes, apiKey: input.apiKey });
    expect(unsealUserAISettings(sealed, "user-b")).toBeNull();
    expect(unsealUserAISettings(`${sealed.slice(0, -4)}abcd`, "user-a")).toBeNull();
  });

  test("rejects arbitrary provider URLs and empty scope", () => {
    expect(userAISettingsSchema.safeParse({ provider: "custom-url", model: "https://example.com", apiKey: "a-private-provider-key", scopes: ["lam"] }).success).toBe(false);
    expect(userAISettingsSchema.safeParse({ provider: "groq", model: "openai/gpt-oss-20b", apiKey: "a-private-provider-key", scopes: [] }).success).toBe(false);
  });
});
