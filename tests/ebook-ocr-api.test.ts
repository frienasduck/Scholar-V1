import { beforeEach, expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";
mock.module("server-only", () => ({}));
let actor: string | null = "owner", renderCalls = 0, indexBroken = false, artifactsDeleted = 0;
let book: any, resource: any, chunks: any[];
let providerPrompt = "";
const db: any = {
  customEbook: {
    findFirst: async ({ where }: any) => book && where.id === book.id && where.userId === actor && actor === book.userId && !book.deletedAt ? book : null,
    update: async ({ data }: any) => Object.assign(book, data),
  },
  studyResource: { update: async ({ data }: any) => Object.assign(resource, data) },
  resourceChunk: { deleteMany: async () => { chunks = []; }, createMany: async ({ data }: any) => { if (indexBroken) throw new Error("index failed"); chunks.push(...data); } },
  resourceArtifact: { deleteMany: async () => { artifactsDeleted++; } },
  learningProfile: { findUnique: async () => null },
  $queryRaw: async (_sql: unknown, ...values: unknown[]) => { expect(values).toContain(actor); return [{ id: book.id }]; },
  $transaction: async (fn: (tx: any) => unknown) => {
    const snapshot = structuredClone({ book, resource, chunks, artifactsDeleted });
    try { return await fn(db); } catch (error) { ({ book, resource, chunks, artifactsDeleted } = snapshot); throw error; }
  },
};
mock.module("../src/lib/db", () => ({ db }));
mock.module("../src/lib/auth/session", () => ({ getSessionUser: async () => actor ? { id: actor } : null }));
class RateLimitError extends Error {}
mock.module("../src/lib/security/rate-limit", () => ({ RateLimitError, enforceRateLimit: async () => {} }));
mock.module("../src/lib/resources/pdf", () => ({ renderPdfPage: async (_bytes: unknown, page: number) => { renderCalls++; return Buffer.from(`image-${page}`); } }));
mock.module("../src/lib/ebooks/ocr", () => ({ recognizePageImage: async () => ({ text: "Newton's second law: net force equals mass times acceleration. F = ma.", confidence: 78, reviewRequired: true }) }));
mock.module("../src/lib/ai/access", () => ({ checkAssistantAccess: async () => ({ ok: true, user: { id: actor, timezone: "Asia/Kolkata" } }) }));
mock.module("../src/lib/ai/user-provider", () => ({ getUserAISettings: async () => null }));
mock.module("../src/lib/subscriptions/entitlements", () => ({ resolveUserEntitlements: async () => ({ plan: "FREE" }) }));
mock.module("../src/lib/resources/service", () => ({ retrieve: async (_actor: string, query: any, ids: string[]) => {
  expect(ids).toEqual([resource.id]);
  return chunks.filter(chunk => chunk.page >= query.pageStart && chunk.page <= query.pageEnd).map((chunk, i) => ({ text: chunk.text, citation: { id: `S${i + 1}`, title: book.title, heading: chunk.heading, page: chunk.page, resourceId: resource.id } }));
} }));
mock.module("../src/lib/ai/groq", () => ({ streamGroqText: async (options: any, delta: (text: string) => void) => { providerPrompt = options.messages[0].content; delta("Net force equals mass times acceleration. [S1]"); } }));
const ocr = await import("../src/app/api/ebooks/[ebookId]/ocr/route");
const lam = await import("../src/app/api/lam/chat/route");
const context = { params: Promise.resolve({ ebookId: "private-book" }) };
const request = (method: string, body: object, origin = "http://localhost") => new NextRequest("http://localhost/api/ebooks/private-book/ocr", { method, headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => {
  actor = "owner"; renderCalls = 0; indexBroken = false; artifactsDeleted = 0; providerPrompt = "";
  resource = { id: "source", state: "NEEDS_REVIEW", sourceMetadata: { grade: 11, outline: [], needsOcr: true } };
  book = { id: "private-book", userId: "owner", title: "My physics book", originalFileName: "Physics.pdf", processingStatus: "needs_ocr", pageCount: 2, pageTexts: ["", "Second page remains readable and unchanged."], text: "", pdfBytes: Buffer.from("original-pdf"), deletedAt: null, resource };
  chunks = [];
});
test("private OCR renders the owned page and requires review without replacing content", async () => {
  const response = await ocr.POST(request("POST", { page: 1 }), context);
  expect(response.status).toBe(200); expect((await response.json()).reviewRequired).toBe(true);
  expect(renderCalls).toBe(1); expect(book.pageTexts[0]).toBe(""); expect(chunks).toHaveLength(0);
});
test("guest and other owners cannot render or save private OCR", async () => {
  for (const [user, status] of [[null, 401], ["other-owner", 404]] as const) {
    actor = user;
    expect((await ocr.POST(request("POST", { page: 1 }), context)).status).toBe(status);
    expect((await ocr.PATCH(request("PATCH", { page: 1, text: "Attempt to replace another user's text." }), context)).status).toBe(status);
  }
  expect(renderCalls).toBe(0); expect(book.pageTexts[0]).toBe("");
});
test("reviewed OCR updates text, source index and artifacts while retaining PDF and other pages", async () => {
  const response = await ocr.PATCH(request("PATCH", { page: 1, text: "Newton's second law: F = ma. Force changes momentum." }), context);
  expect(response.status).toBe(200); expect(book.pageTexts[0]).toContain("F = ma"); expect(book.pageTexts[1]).toContain("unchanged");
  expect(book.pdfBytes.toString()).toBe("original-pdf"); expect(chunks[0].page).toBe(1); expect(chunks[1].page).toBe(2);
  expect(resource.contentHash).toHaveLength(64); expect(resource.sourceMetadata.ocrReviewedPages).toEqual([1]); expect(artifactsDeleted).toBe(1);
});
test("index failures roll back reviewed text; no partly saved LAM context", async () => {
  indexBroken = true;
  expect((await ocr.PATCH(request("PATCH", { page: 1, text: "Reviewed force and acceleration content." }), context)).status).toBe(503);
  expect(book.pageTexts[0]).toBe(""); expect(chunks).toHaveLength(0); expect(artifactsDeleted).toBe(0);
});
test("unsafe origins, invalid pages, OCR errors and interrupted processing are refused", async () => {
  expect((await ocr.POST(request("POST", { page: 1 }, "https://other.example"), context)).status).toBe(403);
  expect((await ocr.POST(request("POST", { page: 3 }), context)).status).toBe(400);
  expect((await ocr.PATCH(request("PATCH", { page: 1, text: "OCR error: unavailable" }), context)).status).toBe(400);
  book.processingStatus = "processing";
  expect((await ocr.POST(request("POST", { page: 1 }), context)).status).toBe(409);
  expect((await ocr.PATCH(request("PATCH", { page: 1, text: "Review cannot race extraction." }), context)).status).toBe(409);
  expect(renderCalls).toBe(0);
});
test("LAM receives server-saved reviewed OCR, not a stale or fabricated client excerpt", async () => {
  await ocr.PATCH(request("PATCH", { page: 1, text: "Reviewed OCR: Newton's second law says F = ma. Net force equals mass times acceleration." }), context);
  const response = await lam.POST(new NextRequest("http://localhost/api/lam/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId: "class-11", message: "Explain this page", inputMode: "text", assistantMode: "ebook-companion", messages: [], pageContext: { profileId: "class-11", profileName: "Student", scholarClass: 11, currentView: "ebook", currentRoute: "/ebook?book=private-book", ebookTitle: "wrong title", activeFileId: book.id, sourcePageNumber: 1, visibleText: "Stale client text about gravity." } }) }));
  expect(response.status).toBe(200); const events = await response.text();
  expect(providerPrompt).toContain("Reviewed OCR: Newton"); expect(providerPrompt).not.toContain("Stale client text"); expect(providerPrompt).toContain("Page 1"); expect(providerPrompt).toContain("My physics book"); expect(events).toContain('"type":"finish"');
});
