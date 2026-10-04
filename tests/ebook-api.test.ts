import { beforeEach, expect, mock, test } from "bun:test";
import { NextRequest, NextResponse } from "next/server";
import { EMPTY_READING } from "../src/lib/ebooks/contracts";
mock.module("server-only", () => ({}));
let actor: string | null = "owner"; let broken = false; let workerCalls = 0;
let book: any; let resource: any; let chunks: any[]; let job: any;
const queries: any[] = []; const tasks: (() => unknown)[] = [];
function matches(row: any, where: any): boolean {
  return !!row && Object.entries(where).every(([key, value]: [string, any]) => {
    if (key === "resource") return matches(resource, value);
    if (key === "text") return row.text.toLowerCase().includes(value.contains.toLowerCase());
    if (key === "state" && value.in) return value.in.includes(row.state);
    return row[key] === value;
  });
}
const db: any = {
  customEbook: {
    findFirst: async ({ where, select }: any) => { queries.push(where); if (broken) throw new Error("DB unavailable"); if (!matches(book, where)) return null; return select ? Object.fromEntries(Object.keys(select).map(key => [key, book[key]])) : book; },
    update: async ({ data }: any) => { Object.assign(book, data); return book; },
    updateMany: async ({ where, data }: any) => { if (!matches(book, where)) return { count: 0 }; Object.assign(book, data); return { count: 1 }; },
  },
  studyResource: {
    findFirst: async ({ where }: any) => matches(resource, where) ? resource : null,
    update: async ({ data }: any) => Object.assign(resource, data),
    updateMany: async ({ where, data }: any) => { if (!matches(resource, where)) return { count: 0 }; Object.assign(resource, data); return { count: 1 }; },
  },
  resourceChunk: { findMany: async ({ where }: any) => { queries.push(where); return chunks.filter(c => matches(c, where)); }, deleteMany: async () => { chunks = []; } },
  resourceArtifact: { deleteMany: async () => ({ count: 0 }) },
  resourceJob: {
    updateMany: async ({ where, data }: any) => { if (!matches(job, where)) return { count: 0 }; Object.assign(job, data); return { count: 1 }; },
    deleteMany: async () => { job = null; },
  },
  $queryRaw: async (parts: TemplateStringsArray, ...values: any[]) => { expect(values).toContain(actor); if (parts.join("").includes('"pageTexts"')) return [{ text: book.pageTexts[values[0]] }]; return [{ id: book.id }]; },
  $transaction: async (callback: (tx: any) => unknown) => { const snapshot = structuredClone({ book, resource, chunks, job }); try { return await callback(db); } catch (error) { ({ book, resource, chunks, job } = snapshot); throw error; } },
};
mock.module("../src/lib/db", () => ({ db }));
mock.module("next/server", () => ({ NextRequest, NextResponse, after: (task: () => unknown) => tasks.push(task) }));
mock.module("../src/lib/auth/session", () => ({ getSessionUser: async () => actor ? { id: actor } : null }));
class RateLimitError extends Error {}
class ProfileError extends Error {}
mock.module("../src/lib/personalization/server", () => ({ ProfileError }));
mock.module("../src/lib/security/rate-limit", () => ({ RateLimitError, enforceRateLimit: async () => {} }));
mock.module("../src/lib/resources/service", () => ({ privateScope: (ownerUserId: string) => ({ ownerUserId, visibility: "PRIVATE", deletedAt: null }) }));
mock.module("../src/lib/resources/jobs", () => ({ processResourceJob: async () => { workerCalls++; } }));
const route = await import("../src/app/api/ebooks/[ebookId]/route");
const context = { params: Promise.resolve({ ebookId: "book-one" }) };
const request = (query = "", method = "GET", body?: object, origin = "http://localhost") => new NextRequest(`http://localhost/api/ebooks/book-one${query}`, { method, headers: { origin, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
beforeEach(() => {
  actor = "owner"; broken = false; workerCalls = 0; queries.length = 0; tasks.length = 0;
  resource = { id: "resource-one", ebookId: "book-one", ownerUserId: "owner", visibility: "PRIVATE", deletedAt: null, state: "READY", sourceMetadata: { grade: 11, extractionComplete: true } };
  book = { id: "book-one", userId: "owner", title: "Physics Notes", originalFileName: "物理 résumé.pdf", sizeBytes: 20, pageCount: 2, processingStatus: "ready", readingState: { ...EMPTY_READING, bookmarks: [], notes: [] }, createdAt: new Date(), deletedAt: null, resource, text: "Do not send this whole text", pageTexts: ["F = ma. Newton's second law.", "Energy equals work done."], pdfBytes: Buffer.from("%PDF-original") };
  chunks = book.pageTexts.map((text: string, i: number) => ({ resourceId: resource.id, page: i + 1, ordinal: i, heading: `Page ${i + 1}`, text }));
  job = { resourceId: resource.id, state: "DONE" };
});
test("metadata response never transfers original bytes or whole extracted text", async () => { const response = await route.GET(request(), context); const value = await response.json(); expect(response.status).toBe(200); expect(value.ebook.resourceId).toBe(resource.id); expect(value.ebook.text).toBeUndefined(); expect(value.ebook.pdfBytes).toBeUndefined(); expect(value.ebook.pageTexts).toBeUndefined(); expect(value.ebook.readingState.page).toBe(1); });
test("individual page query is bounded and owner-scoped", async () => { const value = await (await route.GET(request("?page=2"), context)).json(); expect(value.text).toContain("Energy"); expect(value.text).not.toContain("Newton"); expect((await route.GET(request("?page=3"), context)).status).toBe(400); });
test("unicode filename private original response is readable", async () => { const response = await route.GET(request("?file=1"), context); expect(response.status).toBe(200); expect(await response.text()).toBe("%PDF-original"); expect(response.headers.get("content-disposition")).toContain("UTF-8''"); expect(response.headers.get("cache-control")).toBe("private, no-store"); });
test("guest cannot read or modify private book", async () => { actor = null; expect((await route.GET(request(), context)).status).toBe(401); expect((await route.PATCH(request("", "PATCH", { page: 2 }), context)).status).toBe(401); expect((await route.DELETE(request("", "DELETE"), context)).status).toBe(401); });
test("other account cannot access metadata, file, search, notes or delete", async () => { actor = "other-account"; for (const query of ["", "?file=1", "?q=Newton", "?page=1"]) expect((await route.GET(request(query), context)).status).toBe(404); expect((await route.PATCH(request("", "PATCH", { note: { page: 1, text: "Stolen" } }), context)).status).toBe(404); expect((await route.DELETE(request("", "DELETE"), context)).status).toBe(404); expect(book.deletedAt).toBeNull(); });
test("search returns snippets and actual matching pages only", async () => { const response = await route.GET(request("?q=Newton"), context); const { results } = await response.json(); expect(results).toHaveLength(1); expect(results[0].page).toBe(1); expect(results[0].text).toContain("Newton"); expect(queries.at(-1).resource.ownerUserId).toBe(actor); });
test("notes, bookmarks, page and timestamp survive repeated metadata requests", async () => {
  for (const value of [{ page: 2 }, { bookmark: { page: 2, note: "Review this" } }, { note: { page: 1, text: "Force causes acceleration" } }]) expect((await route.PATCH(request("", "PATCH", value), context)).status).toBe(200);
  const { ebook } = await (await route.GET(request(), context)).json(); expect(ebook.readingState.page).toBe(2); expect(ebook.readingState.lastOpenedAt).toBeTruthy(); expect(ebook.readingState.bookmarks[0].note).toBe("Review this"); expect(ebook.readingState.notes[0].text).toContain("Force");
  await route.PATCH(request("", "PATCH", { bookmark: { page: 2, remove: true } }), context); expect(book.readingState.bookmarks).toHaveLength(0);
});
test("retry preserves extraction but resets both library and job state", async () => { resource.state = "FAILED"; job.state = "FAILED"; book.processingStatus = "failed"; expect((await route.PATCH(request("", "PATCH", { retry: true }), context)).status).toBe(200); expect(book.processingStatus).toBe("processing"); expect(job.state).toBe("QUEUED"); expect(resource.sourceMetadata.extractionComplete).toBe(true); await tasks[0](); expect(workerCalls).toBe(1); });
test("unsafe permanently rejected imports cannot be retried as readable", async () => { resource.state = "REJECTED"; job.state = "FAILED"; book.processingStatus = "failed"; expect((await route.PATCH(request("", "PATCH", { retry: true }), context)).status).toBe(409); expect(tasks).toHaveLength(0); });
test("rename synchronizes the private resource title", async () => { await route.PATCH(request("", "PATCH", { title: "My mechanics" }), context); expect(book.title).toBe("My mechanics"); expect(resource.title).toBe(book.title); expect(resource.sourceMetadata.titleUserSet).toBe(true); });
test("deletion cleans bytes, index, reader data and fences workers", async () => { expect((await route.DELETE(request("", "DELETE"), context)).status).toBe(200); expect(book.pdfBytes.length).toBe(0); expect(book.pageTexts).toHaveLength(0); expect(book.readingState).toEqual({}); expect(chunks).toHaveLength(0); expect(job).toBeNull(); expect(resource.identityKey).toBe("deleted:resource-one"); expect((await route.GET(request("?file=1"), context)).status).toBe(404); });
test("foreign origins and malformed page/note payloads are rejected", async () => { expect((await route.PATCH(request("", "PATCH", { page: 1 }, "https://evil.example"), context)).status).toBe(403); for (const body of [{ page: 900 }, { note: { page: 1, text: "x".repeat(4001) } }, {}]) expect((await route.PATCH(request("", "PATCH", body), context)).status).toBe(400); });
test("database outage returns a safe actionable error, not SQL or file contents", async () => { broken = true; const response = await route.GET(request(), context); expect(response.status).toBe(503); expect(await response.text()).not.toContain("DB unavailable"); });
test("raw malformed and oversized JSON have actionable 400/413 responses", async () => {
  for (const [body, status] of [["{not-json", 400], [JSON.stringify({ note: { page: 1, text: "x".repeat(13000) } }), 413]] as const) {
    const response = await route.PATCH(new NextRequest("http://localhost/api/ebooks/book-one", { method: "PATCH", headers: { origin: "http://localhost", "Content-Type": "application/json" }, body }), context);
    expect(response.status).toBe(status); expect(book.readingState.notes).toHaveLength(0);
  }
});
test("rename cannot race extraction, and multiple operations are not silently ignored", async () => {
  book.processingStatus = "processing";
  expect((await route.PATCH(request("", "PATCH", { title: "Race" }), context)).status).toBe(409);
  expect((await route.PATCH(request("", "PATCH", { page: 1, retry: true }), context)).status).toBe(400);
});
