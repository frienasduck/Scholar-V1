import { expect, mock, test } from "bun:test";
let reads = 0, fail = false;
let rows = [{ key: "v2_lam_identity", enabled: true }];
mock.module("server-only", () => ({}));
mock.module("@/lib/db", () => ({ db: { featureFlag: {
  async findMany() { reads++; await Promise.resolve(); if (fail) throw new Error("test database outage"); return rows; },
  async upsert() {},
} } }));
const { serverFlagOverrides, setServerFlag } = await import("../src/lib/v2/server-flags");

test("parallel global flag reads share one query; mutations invalidate the TTL", async () => {
  const values = await Promise.all(Array.from({ length: 25 }, () => serverFlagOverrides()));
  expect(reads).toBe(1); expect(values.every(v => v.v2_lam_identity === true)).toBe(true);
  await serverFlagOverrides(); expect(reads).toBe(1);
  rows = [{ key: "v2_lam_identity", enabled: false }];
  await setServerFlag("v2_lam_identity", false);
  expect((await serverFlagOverrides()).v2_lam_identity).toBe(false); expect(reads).toBe(2);
});
test("an outage logs once and backs off queries while retaining the same default fallback", async () => {
  fail = true; await setServerFlag("v2_lam_identity", true);
  const original = console.error; let errors = 0; console.error = () => errors++;
  try {
    const before = reads;
    const results = await Promise.all(Array.from({ length: 25 }, () => serverFlagOverrides()));
    await serverFlagOverrides();
    expect(reads - before).toBe(1); expect(errors).toBe(1); expect(results.every(v => Object.keys(v).length === 0)).toBe(true);
  } finally { console.error = original; }
});
