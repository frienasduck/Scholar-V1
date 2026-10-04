import { beforeEach, expect, mock, test } from "bun:test";
import { NextRequest, NextResponse } from "next/server";
import type { ResourceRecord } from "../src/lib/resources/types";
mock.module("server-only", () => ({}));
let actor: string | null = "owner"; let unavailable = false; let workerCalls = 0; let bytesUsed = 0;
let workerTasks: (() => unknown)[] = [];
const rows: any[] = []; const chunks: any[] = []; const stored: any[] = []; const whereChecks: any[] = [];
const matches = (row: any, where: any): boolean => !where || Object.entries(where).every(([key, value]: [string, any]) => {
  if (key === "resource") return matches(rows.find(r => r.id === row.resourceId), value);
  if (key === "id" && value?.in) return value.in.includes(row.id);
  if (key === "page" && typeof value === "object") return row.page >= value.gte && row.page <= value.lte;
  return row && row[key] === value;
});
const studyResource = {
  findFirst: async ({ where }: any) => { whereChecks.push(where); if (unavailable) throw new Error("unavailable"); return rows.find(r => matches(r, where)) ?? null; },
  findMany: async ({ where }: any) => { whereChecks.push(where); if (unavailable) throw new Error("unavailable"); return rows.filter(r => matches(r, where)); },
  count: async ({ where }: any) => rows.filter(r => matches(r, where)).length,
  create: async ({ data }: any) => { const row = { id: `private-${rows.length}`, deletedAt: null, language: "en", qualityStatus: "user-provided", updatedAt: new Date(), lastCheckedAt: null, mappings: data.mappings ? [data.mappings.create] : [], ...data }; rows.push(row); return row; },
};
const db = { studyResource, storedFile: { aggregate: async () => ({ _sum: { sizeBytes: bytesUsed } }), create: async ({ data }: any) => { stored.push(data); bytesUsed += data.sizeBytes; return data; } },
  learningProfile: { findUnique: async () => ({ preferences: { weak: ["physics"], subjects: ["physics"] } }) },
  resourceChunk: { findMany: async ({ where }: any) => { whereChecks.push(where); return chunks.filter(r => matches(r, where)); } },
  resourceJob: { findFirst: async () => null }, resourceArtifact: { findFirst: async () => null, upsert: async () => ({}) },
  $queryRaw: async (query: any) => { expect(query.values).toContain(actor); return []; },
  $transaction: async (callback: (tx: any) => unknown) => callback(db),
};
mock.module("../src/lib/db", () => ({ db }));
mock.module("next/server", () => ({ NextRequest, NextResponse, after: (task: () => unknown) => workerTasks.push(task) }));
mock.module("../src/lib/auth/session", () => ({ getSessionUser: async () => actor ? { id: actor, currentScholarClass: 11 } : null }));
class ProfileError extends Error { constructor(message: string, public status = 409) { super(message); } }
class RateLimitError extends Error {}
mock.module("../src/lib/personalization/server", () => ({ ProfileError, checkGrade: async (_user: string, grade: number) => { if (grade === 9) throw new ProfileError("Class access", 403); }, lockAccount: async (_tx: unknown, id: string) => { expect(id).toBe(actor!); } }));
mock.module("../src/lib/security/rate-limit", () => ({ RateLimitError, enforceRateLimit: async () => {} }));
mock.module("../src/lib/subscriptions/entitlements", () => ({ resolveUserEntitlements: async () => ({ storageLimitBytes: 1_000_000 }) }));
mock.module("../src/lib/resources/jobs", () => ({ processResourceJob: async () => { workerCalls++; return true; } }));
mock.module("../src/lib/resources/safe-fetch", () => ({ safeFetch: async (url: string) => { if (url.includes("127.0.0.1")) throw new Error("SSRF"); return { url, headers: { "content-type": "text/html" }, bytes: Buffer.from("<title>Verified page</title>") }; }, webpageMetadata: () => ({ title: "Verified page", description: "Metadata only" }) }));
const route = await import("../src/app/api/resources/route");
const detail = await import("../src/app/api/resources/[id]/route");
const { library, findResource, resourceChunks, retrieve } = await import("../src/lib/resources/service");
const { BUILTIN_RESOURCES } = await import("../src/lib/resources/catalog");
const worker = await import("../src/app/api/resources/process/route");
const request = (body: unknown, method = "POST", extra: Record<string, string> = {}) => new NextRequest("http://localhost/api/resources", { method, headers: { "content-type": "application/json", origin: "http://localhost", ...extra }, body: JSON.stringify(body) });
const params = (id: string) => ({ params: Promise.resolve({ id }) });
function privateRecord(owner = "owner") {
  return { ...BUILTIN_RESOURCES.find(r => r.canStoreCopy)!, id: `test-${owner}`, ownerUserId: owner, visibility: "PRIVATE", deletedAt: null, title: "Private Laws of Motion notes", mappings: [{ curriculumId: "cbse", grade: 11, subjectId: "physics", chapterId: "p5" }], sourceMetadata: { sections: [{ text: "PRIVATE BODY" }], usageKey: "PRIVATE-USAGE-KEY" }, updatedAt: new Date(), lastCheckedAt: null };
}
beforeEach(() => { actor = "owner"; unavailable = false; workerCalls = 0; workerTasks = []; bytesUsed = 0; rows.length = 0; chunks.length = 0; stored.length = 0; whereChecks.length = 0; });
test("guest browses real built-ins without reading private tables", async () => { actor = null; rows.push(privateRecord("victim")); const response = await route.GET(new NextRequest("http://localhost/api/resources?grade=11")); expect(response.status).toBe(200); const result = await response.json(); expect(result.total).toBeGreaterThan(100); expect(result.resources.every((r: ResourceRecord) => r.visibility === "GLOBAL")).toBe(true); expect(whereChecks).toHaveLength(0); });
test("guest cannot import and cross-origin mutation is rejected", async () => { actor = null; expect((await route.POST(request({ title: "Notes", text: "x".repeat(100) }))).status).toBe(401); actor = "owner"; expect((await route.POST(request({}, "POST", { origin: "https://attacker.example" }))).status).toBe(403); expect(rows).toHaveLength(0); });
test("oversized import is bounded before any database write", async () => { expect((await route.POST(request({ title: "Oversized", text: "x".repeat(300_000) }))).status).toBe(413); expect(rows).toHaveLength(0); });
test("text import is private, queued and charged by actual UTF-8 bytes", async () => { const text = "Laws of Motion: F = ma. ".repeat(8); const response = await route.POST(request({ title: "Study notes", text, grade: 11 })); expect(response.status).toBe(202); expect(rows[0].ownerUserId).toBe("owner"); expect(rows[0].visibility).toBe("PRIVATE"); expect(rows[0].job.create).toEqual({}); expect(stored[0].sizeBytes).toBe(Buffer.byteLength(text.trim())); expect(workerCalls).toBe(0); await workerTasks[0](); expect(workerCalls).toBe(1); });
test("normalized duplicate text reuses resource and does not charge twice", async () => { const text = "Learn Newton's laws of motion through worked examples. ".repeat(3); const a = await (await route.POST(request({ title: "A", text }))).json(); const b = await (await route.POST(request({ title: "B", text: ` ${text} ` }))).json(); expect(b.id).toBe(a.id); expect(b.duplicate).toBe(true); expect(stored).toHaveLength(1); });
test("URL imports store metadata/link only, no source copy or derivative job", async () => { const response = await route.POST(request({ title: "Saved source link", url: "https://source.example/study?utm_source=tracker" })); expect(response.status).toBe(202); expect(rows[0].title).toBe("Verified page"); expect(rows[0].canonicalUrl).toBe("https://source.example/study"); expect(rows[0].licenseType).toBe("LINK_ONLY"); expect(rows[0].canStoreCopy).toBe(false); expect(rows[0].job).toBeUndefined(); expect(workerTasks).toHaveLength(0); });
test("unsafe URL and invalid mapping never create private records", async () => { expect((await route.POST(request({ title: "Unsafe", url: "https://127.0.0.1/" }))).status).toBe(422); expect((await route.POST(request({ title: "Notes", text: "x".repeat(100), mapping: { curriculumId: "cbse", grade: 11, subjectId: "physics", chapterId: "m1" } }))).status).toBe(400); expect(rows).toHaveLength(0); });
test("UTF-8 text file import follows the same private ingestion path", async () => { const form = new FormData(); form.set("file", new File(["F = ma: Laws of Motion. ".repeat(5)], "chapter.md")); const response = await route.POST(new NextRequest("http://localhost/api/resources", { method: "POST", body: form })); expect(response.status).toBe(202); expect(rows[0].sourceType).toBe("upload"); });
test("binary disguised as text is rejected", async () => { const form = new FormData(); form.set("file", new File([Uint8Array.from([255, 254, 0])], "malicious.txt")); const response = await route.POST(new NextRequest("http://localhost/api/resources", { method: "POST", body: form })); expect(response.status).toBe(415); expect(rows).toHaveLength(0); });
test("storage allowance is enforced without writing an orphaned resource", async () => { bytesUsed = 999_999; expect((await route.POST(request({ title: "Too much", text: "x".repeat(100) }))).status).toBe(413); expect(rows).toHaveLength(0); expect(stored).toHaveLength(0); });
test("private resource retrieval has an owner query and strips pending document bodies", async () => { rows.push(privateRecord(), privateRecord("victim")); const own = await findResource("test-owner", "owner"); expect(own!.sourceMetadata!.sections).toBeUndefined(); expect(own!.sourceMetadata!.usageKey).toBeUndefined(); expect(await findResource("test-victim", "owner")).toBeNull(); expect(whereChecks.every(w => w.visibility === "PRIVATE" && w.ownerUserId === "owner")).toBe(true); });
test("cross-user GET, artifact, PATCH and DELETE consistently return 404", async () => { rows.push(privateRecord("victim")); for (const method of ["GET", "POST", "PATCH", "DELETE"] as const) { const req = method === "GET" ? new NextRequest("http://localhost/api/resources/test-victim") : request({ type: "summary", retry: true }, method); expect((await detail[method](req, params("test-victim"))).status).toBe(404); } expect(chunks).toHaveLength(0); });
test("chunk retrieval scopes owner at database level, and processing text stays hidden", async () => { const own = privateRecord(); rows.push(own, privateRecord("victim")); chunks.push({ resourceId: own.id, ordinal: 0, heading: "Law", text: "F = ma: a sufficiently complete explanation.", page: 2 }, { resourceId: "test-victim", ordinal: 0, heading: "Secret", text: "Victim secret" }); expect(await resourceChunks(own)).toHaveLength(1); expect(await resourceChunks({ ...own, state: "EXTRACTING" })).toHaveLength(0); expect(whereChecks[0].resource.ownerUserId).toBe("owner"); });
test("database failure never falls back to somebody else's private data", async () => { rows.push(privateRecord("victim")); unavailable = true; const result = await library({ grade: 11 }, "owner"); expect(result.privateAvailable).toBe(false); expect(result.resources.every(r => r.visibility === "GLOBAL")).toBe(true); });
test("selected PDF page range includes only owned readable pages, even in a mixed scanned book", async () => {
  const own = privateRecord(); own.sourceMetadata = { ...own.sourceMetadata, needsOcr: true } as any; rows.push(own, privateRecord("victim"));
  for (const page of [1, 12, 13, 40]) chunks.push({ resourceId: own.id, ordinal: page, heading: `Page ${page}`, text: `Newton's force explanation on actual page ${page}.`, page });
  chunks.push({ resourceId: "test-victim", ordinal: 12, heading: "Private", text: "Another account's secret force explanation.", page: 12 });
  const found = await retrieve("owner", { grade: 11, q: "summarize selected pages", pageStart: 12, pageEnd: 13 }, [own.id]);
  expect(found.map(item => item.citation.page)).toEqual([12, 13]); expect(found.every(item => item.text.includes("actual page"))).toBe(true);
});
test("explicit owned source can ground a general question when lexical words miss", async () => { const own = privateRecord(); rows.push(own); chunks.push({ resourceId: own.id, ordinal: 0, heading: "Newton's law", text: "A sufficiently long explanation about F = ma.", page: 2 }); const found = await retrieve("owner", { grade: 11, q: "summarize everything" }, [own.id]); expect(found).toHaveLength(1); expect(found[0].citation.page).toBe(2); expect(await retrieve("owner", { grade: 11 }, ["test-victim"])).toHaveLength(0); });
test("link-only official material cannot be used to fabricate an artifact", async () => { const source = BUILTIN_RESOURCES.find(r => r.state === "LINK_ONLY")!; expect((await detail.POST(request({ type: "summary" }), params(source.id))).status).toBe(409); });
test("worker maintenance secret is required, including malformed unicode tokens", async () => { process.env.RESOURCE_WORKER_SECRET = "x".repeat(32); for (const token of ["", "short", "é".repeat(32)]) expect((await worker.POST(new Request("http://localhost/api/resources/process", { method: "POST", headers: { authorization: `Bearer ${token}` } }))).status).toBe(401); expect(workerCalls).toBe(0); expect((await worker.POST(new Request("http://localhost/api/resources/process", { method: "POST", headers: { authorization: `Bearer ${"x".repeat(32)}` } }))).status).toBe(200); expect(workerCalls).toBe(1); delete process.env.RESOURCE_WORKER_SECRET; });
