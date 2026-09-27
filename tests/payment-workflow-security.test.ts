import { expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";

mock.module("server-only", () => ({}));

const { paymentReviewResultEmail } = await import("../src/lib/subscriptions/email");

test("payment review email escapes administrator-entered HTML", () => {
  const html = paymentReviewResultEmail({
    approved: false,
    title: '<img src=x onerror="alert(1)">',
    reason: '<a href="javascript:alert(1)">retry</a>',
  });
  expect(html).not.toContain("<img");
  expect(html).not.toContain("<a href");
  expect(html).toContain("&lt;img");
  expect(html).toContain("&lt;a");
});

test("payment state changes are serialized or conditionally atomic", () => {
  const proof = readFileSync("src/app/api/subscriptions/payment-requests/[reference]/route.ts", "utf8");
  const checkout = readFileSync("src/app/api/subscriptions/payment-requests/route.ts", "utf8");
  const admin = readFileSync("src/app/api/admin/subscriptions/payment-requests/[id]/route.ts", "utf8");

  expect(proof).toContain('FROM "ScholarPaymentRequest"');
  expect(proof).toContain("FOR UPDATE");
  expect(proof).toContain("scholarPaymentRequest.updateMany");
  expect(checkout).toContain('FROM "User"');
  expect(checkout).toContain("FOR UPDATE");
  expect(admin.match(/FOR UPDATE/g)?.length).toBeGreaterThanOrEqual(2);
});
