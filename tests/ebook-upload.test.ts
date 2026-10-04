import { beforeEach, expect, mock, test } from "bun:test";
import { NextRequest, NextResponse } from "next/server";
mock.module("server-only", () => ({}));
let actor: string | null = "owner", failStorage = false, failCommit = false, allowance = 10_000, storedBytes = 0, existingBytes = 0;
let books: any[] = [], events: string[] = [], tasks: (() => unknown)[] = [];
let reservation: "released" | "reserved" | "consumed" | null = null;
const db: any = {
  studyResource: { findFirst: async () => null },
  learningProfile: { findUnique: async () => null },
  storedFile: { aggregate: async () => ({ _sum: { sizeBytes: storedBytes } }) },
  customEbook: {
    aggregate: async () => ({ _sum: { sizeBytes: existingBytes } }),
    findFirst: async ({ where }: any) => books.find(b => b.userId === where.userId && where.OR.some((item: any) => item.importDigest === b.importDigest || item.importKey === b.importKey)) ?? null,
    create: async ({ data }: any) => { events.push("create"); if (failStorage) throw new Error("secret SQL details"); const book = { ...data, id: "book-new", resource: { id: "resource-new", ...data.resource.create } }; books.push(book); return book; },
  },
  $queryRaw: async () => { events.push("account-lock"); return []; },
  $transaction: async (callback: (tx: any) => unknown) => { const before = structuredClone(books); try { return await callback(db); } catch (error) { books = before; throw error; } },
};
mock.module("../src/lib/db", () => ({ db }));
mock.module("next/server", () => ({ NextRequest, NextResponse, after: (task: () => unknown) => tasks.push(task) }));
mock.module("../src/lib/auth/session", () => ({ getSessionUser: async () => actor ? { id: actor, currentScholarClass: 11 } : null }));
class RateLimitError extends Error {}
class MonthlyQuotaError extends Error {}
class ProfileError extends Error {}
mock.module("../src/lib/security/rate-limit", () => ({ RateLimitError, enforceRateLimit: async () => {} }));
mock.module("../src/lib/subscriptions/entitlements", () => ({ resolveUserEntitlements: async () => ({ storageLimitBytes: allowance }) }));
mock.module("../src/lib/subscriptions/monthly-usage", () => ({
  MonthlyQuotaError, getMonthlyUsage: async () => ({}),
  reserveMonthlyUsage: async () => { const replayed = reservation === "reserved" || reservation === "consumed"; if (!replayed) reservation = "reserved"; return { replayed }; },
  commitMonthlyUsage: async (_user: string, _key: string, tx: unknown) => { expect(tx).toBe(db); events.push("commit-credit"); if (failCommit) throw new Error("credit write failed"); reservation = "consumed"; },
  releaseMonthlyUsage: async () => { events.push("release-credit"); reservation = "released"; },
}));
mock.module("../src/lib/personalization/server", () => ({ ProfileError, checkGrade: async () => {}, storeBonusBook: async () => { throw new Error("not used"); } }));
mock.module("../src/lib/subscriptions/audit", () => ({ recordAudit: async () => {} }));
mock.module("../src/lib/resources/intake", () => ({ pdfResource: (ownerUserId: string, title: string, digest: string) => ({ ownerUserId, title, identityKey: `${ownerUserId}:pdf:${digest}`, visibility: "PRIVATE", job: { create: {} } }) }));
mock.module("../src/lib/resources/jobs", () => ({ processResourceJob: async () => true }));
const { POST } = await import("../src/app/api/ebooks/route");
const key = "12345678-1234-1234-1234-123456789012";
const request = (content = "%PDF-test document", name = "My notes.pdf", type = "application/pdf", origin = "http://localhost") => {
  const form = new FormData(); form.set("file", new File([content], name, { type })); form.set("title", "My Study Book");
  return new NextRequest("http://localhost/api/ebooks", { method: "POST", headers: { origin, "x-idempotency-key": key }, body: form });
};
beforeEach(() => { actor = "owner"; failStorage = false; failCommit = false; allowance = 10000; storedBytes = 0; existingBytes = 0; books = []; events = []; tasks = []; reservation = null; });
test("original bytes, private book, resource and credit commit atomically before worker dispatch", async () => {
  const response = await POST(request()); expect(response.status).toBe(201);
  expect(events).toEqual(["account-lock", "create", "commit-credit"]);
  expect(books[0].pdfBytes.toString()).toBe("%PDF-test document"); expect(books[0].resource.visibility).toBe("PRIVATE"); expect(books[0].resource.ownerUserId).toBe(actor);
  expect(books[0].resource.sourceMetadata.titleUserSet).toBe(true); expect(books[0].importKey).toBe(key); expect(tasks).toHaveLength(1);
});
test("storage or credit failure rolls back book and releases reservation without deleting existing books", async () => {
  for (const which of ["storage", "credit"]) {
    failStorage = which === "storage"; failCommit = which === "credit"; reservation = null;
    const response = await POST(request()); expect(response.status).toBe(503); expect(await response.text()).not.toContain("secret SQL"); expect(books).toHaveLength(0); expect(String(reservation)).toBe("released"); expect(tasks).toHaveLength(0);
  }
});
test("network retry with same hash and reference reuses stored book and releases competing unit", async () => {
  expect((await POST(request())).status).toBe(201); reservation = null;
  const response = await POST(request()); expect(response.status).toBe(200); expect((await response.json()).duplicate).toBe(true); expect(books).toHaveLength(1); expect(events.filter(e => e === "create")).toHaveLength(1); expect(String(reservation)).toBe("released");
});
test("storage quota counts both existing books and other files under account lock", async () => {
  allowance = 100; storedBytes = 60; existingBytes = 35;
  expect((await POST(request())).status).toBe(413); expect(books).toHaveLength(0); expect(events).toEqual(["account-lock", "release-credit"]);
});
test("guest, foreign origin, fake PDF, wrong extension and empty file never consume quota", async () => {
  actor = null; expect((await POST(request())).status).toBe(401); actor = "owner";
  expect((await POST(request("%PDF-test", "book.pdf", "application/pdf", "https://evil.example"))).status).toBe(403);
  expect((await POST(request("Not a PDF"))).status).toBe(415);
  expect((await POST(request("%PDF-test", "book.txt", "text/plain"))).status).toBe(400);
  expect((await POST(request(""))).status).toBe(400);
  expect(reservation).toBeNull(); expect(books).toHaveLength(0);
});
test("same import key with different source cannot overwrite an existing book", async () => {
  await POST(request()); reservation = null;
  expect((await POST(request("%PDF-different"))).status).toBe(503); expect(books).toHaveLength(1); expect(Buffer.from(books[0].pdfBytes).toString()).toBe("%PDF-test document");
});
