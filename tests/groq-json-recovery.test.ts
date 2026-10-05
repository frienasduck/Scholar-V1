import { afterEach, expect, mock, spyOn, test } from "bun:test";
mock.module("server-only", () => ({}));
const { generateScholarGroqJSON } = await import("../src/lib/ai/scholar-groq");
const original = { key: process.env.GROQ_API_KEY, model: process.env.GROQ_MODEL, fallback: process.env.GROQ_FALLBACK_MODEL };
afterEach(() => {
  mock.restore();
  for (const [key, value] of Object.entries({ GROQ_API_KEY: original.key, GROQ_MODEL: original.model, GROQ_FALLBACK_MODEL: original.fallback })) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
function setup(code: string) {
  process.env.GROQ_API_KEY = "unit-test-only";
  process.env.GROQ_MODEL = "openai/gpt-oss-20b";
  process.env.GROQ_FALLBACK_MODEL = "openai/gpt-oss-120b";
  let calls = 0;
  const fetcher = spyOn(globalThis, "fetch").mockImplementation((async () => {
    calls++;
    return calls === 1 ? Response.json({ error: { code, message: "provider rejection" } }, { status: 400 })
      : Response.json({ choices: [{ message: { content: '{"ok":true}' }, finish_reason: "stop" }] });
  }) as unknown as typeof fetch);
  return fetcher;
}
test("provider JSON validation failure uses one alternate model", async () => {
  const fetcher = setup("json_validate_failed");
  expect(await generateScholarGroqJSON({ messages: [{ role: "user", content: "JSON result" }] })).toEqual({ ok: true });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
test("arbitrary invalid-request 400 is not retried", async () => {
  const fetcher = setup("invalid_request_error");
  await expect(generateScholarGroqJSON({ messages: [{ role: "user", content: "JSON result" }] })).rejects.toMatchObject({ code: "GROQ_INVALID_REQUEST" });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
