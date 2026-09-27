import { beforeEach, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

const attempts: Array<{ key: string; action: string; createdAt: Date }> = [];
let lockCalls = 0;
let transactionTail = Promise.resolve();

const tx = {
  $executeRaw: async () => {
    lockCalls += 1;
    return 1;
  },
  securityAttempt: {
    count: async ({ where }: { where: { key: string; action: string; createdAt: { gte: Date } } }) =>
      attempts.filter((attempt) =>
        attempt.key === where.key &&
        attempt.action === where.action &&
        attempt.createdAt >= where.createdAt.gte
      ).length,
    create: async ({ data }: { data: { key: string; action: string } }) => {
      attempts.push({ ...data, createdAt: new Date() });
      return { id: String(attempts.length) };
    },
  },
};

mock.module("../src/lib/db", () => ({
  db: {
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => {
      const previous = transactionTail;
      let release!: () => void;
      transactionTail = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      try {
        return await callback(tx);
      } finally {
        release();
      }
    },
    securityAttempt: {
      count: tx.securityAttempt.count,
      deleteMany: async () => ({ count: 0 }),
    },
  },
}));

const { enforceRateLimit, opaqueRateLimitKey, requestRateLimitKey, RateLimitError } = await import("../src/lib/security/rate-limit");

beforeEach(() => {
  attempts.length = 0;
  lockCalls = 0;
  transactionTail = Promise.resolve();
});

test("concurrent requests cannot exceed the durable rate-limit ceiling", async () => {
  const results = await Promise.allSettled(
    Array.from({ length: 12 }, () =>
      enforceRateLimit("account-1", "expensive-action", 3, 60_000),
    ),
  );

  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(3);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(9);
  expect(
    results
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .every((result) => result.reason instanceof RateLimitError),
  ).toBe(true);
  expect(attempts).toHaveLength(3);
  expect(lockCalls).toBe(12);
});

test("durable limiter keys never persist raw account or network identifiers", () => {
  const email = "student@example.test";
  const ip = "203.0.113.42";
  const accountKey = opaqueRateLimitKey("login-account", email);
  const ipKey = requestRateLimitKey(new Request("https://scholar.example", { headers: { "x-forwarded-for": ip } }), "login-ip");

  expect(accountKey).not.toContain(email);
  expect(ipKey).not.toContain(ip);
  expect(accountKey).toBe(opaqueRateLimitKey("login-account", email));
});
