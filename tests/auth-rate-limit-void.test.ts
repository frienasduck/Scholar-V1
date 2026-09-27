import { beforeEach, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));
let count = 0;
let lockFails = false;
const events: string[] = [];
let sql = "";
let parameters: unknown[] = [];
const tx = {
  $queryRaw: async () => { throw new Error("Failed to deserialize column of type 'void'."); },
  $executeRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => {
    events.push("lock"); sql = parts.join("?"); parameters = values;
    if (lockFails) throw new Error("Lock unavailable");
    return 1;
  },
  securityAttempt: {
    count: async () => { events.push("count"); return count; },
    create: async () => { events.push("create"); return {}; },
  },
};
mock.module("../src/lib/db", () => ({ db: {
  $transaction: async (callback: (transaction: typeof tx) => Promise<void>) => callback(tx),
  securityAttempt: { deleteMany: async () => ({ count: 0 }) },
} }));
const { enforceRateLimit, RateLimitError } = await import("../src/lib/security/rate-limit");

beforeEach(() => { count = 0; lockFails = false; events.length = 0; sql = ""; parameters = []; });

test("auth limiter executes void advisory lock without querying/deserializing its result", async () => {
  await enforceRateLimit("opaque-key", "google-start", 20, 900_000);
  expect(events).toEqual(["lock", "count", "create"]);
  expect(sql).toContain("SELECT pg_advisory_xact_lock(");
  expect(sql).toContain("hashtextextended(?, 0)");
  expect(parameters).toEqual(["google-start\u001fopaque-key"]);
});

test("the same locked limiter still rejects email/login/recovery buckets at their ceiling", async () => {
  for (const action of ["register-ip", "login-account", "recovery-ip"]) {
    events.length = 0; count = 5;
    await expect(enforceRateLimit("opaque-key", action, 5, 60_000)).rejects.toBeInstanceOf(RateLimitError);
    expect(events).toEqual(["lock", "count"]);
  }
});

test("lock execution failure remains fail-closed before count or record", async () => {
  lockFails = true;
  await expect(enforceRateLimit("opaque-key", "google-start", 20, 900_000)).rejects.toThrow("Lock unavailable");
  expect(events).toEqual(["lock"]);
});
