import { expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));
const { readBoundedJson, RequestBodyError } = await import("../src/lib/security/request-body");

test("bounded JSON stops a chunked body at the byte ceiling", async () => {
  const encoder = new TextEncoder();
  let cancelled = false;
  const request = new Request("https://scholar.example/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('{"value":"'));
        controller.enqueue(encoder.encode("x".repeat(128)));
        controller.enqueue(encoder.encode('"}'));
      },
      cancel() { cancelled = true; },
    }),
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  await expect(readBoundedJson(request, 32)).rejects.toMatchObject({
    status: 413,
    code: "REQUEST_TOO_LARGE",
  });
  expect(cancelled).toBe(true);
});

test("bounded JSON enforces media type and parses a valid body", async () => {
  const wrong = new Request("https://scholar.example/api/test", { method: "POST", body: "{}" });
  await expect(readBoundedJson(wrong, 64)).rejects.toBeInstanceOf(RequestBodyError);

  const valid = new Request("https://scholar.example/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: '{"ok":true}',
  });
  expect(await readBoundedJson(valid, 64)).toEqual({ ok: true });
});
