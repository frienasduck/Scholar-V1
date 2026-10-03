import { beforeEach, expect, mock, test } from "bun:test";
mock.module("server-only", () => ({}));
let resource: any; let job: any; let chunkRows: any[]; let scriptError = false; let scanned = false;
let loseLease = false; let refundCount = 0; let monthlyRefundCount = 0; let mappingCreates = 0;
let transient = false; let extractionCalls = 0; let indexFailure = false; let stages: string[];
function matches(row: any, where: any): boolean {
  if (!row) return false;
  return Object.entries(where).every(([key, value]: [string, any]) => {
    if (key === "OR") return value.some((branch: any) => matches(row, branch));
    if (key === "resource") return matches(resource, value);
    if (key === "attempts") return value.lt != null ? row.attempts < value.lt : row.attempts >= value.gte;
    if (key === "nextRunAt") return row.nextRunAt <= value.lte;
    if (key === "leaseUntil") return row.leaseUntil && row.leaseUntil < value.lt;
    return row[key] === value;
  });
}
const db: any = {
  $transaction: async (callback: (tx: any) => unknown) => {
    const original = structuredClone({ resource, job, chunkRows });
    try { return await callback(db); } catch (error) { resource = original.resource; job = original.job; chunkRows = original.chunkRows; throw error; }
  },
  resourceJob: {
    findFirst: async ({ where }: any) => matches(job, where) ? { ...job } : null,
    findMany: async ({ where }: any) => matches(job, where) ? [{ id: job.id, resourceId: job.resourceId }] : [],
    updateMany: async ({ where, data }: any) => {
      if (loseLease && (data.state === "DONE" || data.stage === "CLASSIFYING")) return { count: 0 };
      if (!matches(job, where)) return { count: 0 };
      const attempts = job.attempts; const increment = data.attempts?.increment;
      Object.assign(job, data); if (increment) job.attempts = attempts + increment;
      if (data.stage) stages.push(data.stage);
      return { count: 1 };
    },
  },
  studyResource: {
    findFirst: async ({ where }: any) => matches(resource, where) ? resource : null,
    update: async ({ data }: any) => { Object.assign(resource, data); return resource; },
    updateMany: async ({ where, data }: any) => { if (!matches(resource, where)) return { count: 0 }; Object.assign(resource, data); return { count: 1 }; },
  },
  resourceChunk: { deleteMany: async () => { chunkRows = []; }, createMany: async ({ data }: any) => { if (indexFailure) throw new Error("Database temporarily unavailable"); chunkRows.push(...data); } },
  resourceArtifact: { deleteMany: async () => {} },
  resourceMapping: { createMany: async ({ data }: any) => { mappingCreates++; resource.mappings.push(...data); } },
  customEbook: { update: async ({ data }: any) => Object.assign(resource.ebook, data), updateMany: async ({ data }: any) => { if (resource.ebook) Object.assign(resource.ebook, data); return { count: 1 }; } },
  learningProfile: { updateMany: async () => { refundCount++; return { count: 1 }; } },
  usageEvent: { findUnique: async () => ({ id: "usage", status: "consumed", userId: "owner", periodDay: "2026-10", units: 1 }), updateMany: async () => ({ count: 1 }) },
  usageCounter: { updateMany: async () => { monthlyRefundCount++; return { count: 1 }; } },
};
mock.module("../src/lib/db", () => ({ db }));
mock.module("../src/lib/resources/service", () => ({ privateScope: (ownerUserId: string) => ({ ownerUserId, visibility: "PRIVATE", deletedAt: null }) }));
mock.module("../src/lib/resources/pdf", () => ({ extractPdf: async () => { extractionCalls++; if (transient) throw new Error("Parser temporarily unavailable"); if (scriptError) throw new Error("PDF_ACTIVE_CONTENT"); return { pages: scanned ? [""] : ["Laws of Motion: F = ma. Newton's law relates force, mass and acceleration."], pageCount: 1, text: "Extracted text", needsOcr: scanned }; } }));
const { processResourceJob } = await import("../src/lib/resources/jobs");
beforeEach(() => {
  resource = { id: "r1", title: "Laws of Motion", ownerUserId: "owner", visibility: "PRIVATE", deletedAt: null, state: "EXTRACTING", ebookId: null, ebook: null, mappings: [], sourceMetadata: { grade: 11, sections: [{ heading: "Newton's laws", text: "Laws of Motion: Newton's second law F = ma. A net force causes acceleration." }] } };
  job = { id: "j1", resourceId: "r1", state: "QUEUED", attempts: 0, leaseToken: null, leaseUntil: null, nextRunAt: new Date(0) };
  chunkRows = []; scriptError = false; scanned = false; loseLease = false; refundCount = 0; monthlyRefundCount = 0; mappingCreates = 0; transient = false; extractionCalls = 0; indexFailure = false; stages = [];
});
function addPdf(allocation = "standard") { resource.ebookId = "b1"; resource.ebook = { pdfBytes: Buffer.from("%PDF"), userId: "owner", sizeBytes: 100, allocation, processingStatus: "processing" }; resource.sourceMetadata = { grade: 11, usageKey: "owner:ebook:key" }; }
test("durable job classifies, indexes and removes pending text from metadata", async () => { expect(await processResourceJob("r1", "owner")).toBe(true); expect(job.state).toBe("DONE"); expect(resource.state).toBe("READY"); expect(resource.mappings[0].chapterId).toBe("p5"); expect(chunkRows).toHaveLength(1); expect(resource.sourceMetadata.sections).toBeUndefined(); expect(resource.contentHash).toHaveLength(64); });
test("same completed job is idempotent, not a second extraction", async () => { await processResourceJob(); const count = chunkRows.length; expect(await processResourceJob()).toBe(false); expect(chunkRows.length).toBe(count); expect(mappingCreates).toBe(1); });
test("manual mapping is preserved instead of overridden by auto-classification", async () => { resource.mappings = [{ curriculumId: "cbse", grade: 11, subjectId: "chemistry", chapterId: "c1" }]; await processResourceJob(); expect(resource.mappings[0].chapterId).toBe("c1"); expect(mappingCreates).toBe(0); });
test("owner-triggered job cannot claim another account's queued upload", async () => { expect(await processResourceJob("r1", "victim")).toBe(false); expect(job.state).toBe("QUEUED"); expect(chunkRows).toHaveLength(0); });
test("a stale worker that lost its lease cannot publish chunks", async () => { loseLease = true; await processResourceJob(); expect(chunkRows).toHaveLength(0); expect(resource.state).toBe("EXTRACTING"); });
test("unknown material retains readable chunks but asks for mapping review", async () => { resource.title = "My observations"; resource.sourceMetadata.sections[0].text = "Observations on personal memories without a recognized academic concept."; await processResourceJob(); expect(resource.state).toBe("NEEDS_REVIEW"); expect(resource.mappings).toHaveLength(0); expect(chunkRows).toHaveLength(1); });
test("scanned PDF does not create a misleading searchable index or study aids", async () => { addPdf(); scanned = true; await processResourceJob(); expect(job.stage).toBe("NEEDS_OCR"); expect(resource.state).toBe("NEEDS_REVIEW"); expect(resource.ebook.processingStatus).toBe("needs_ocr"); expect(chunkRows).toHaveLength(0); });
test("active PDF is rejected and onboarding bytes refunded once under lease", async () => { addPdf("onboarding"); scriptError = true; await processResourceJob(); expect(resource.state).toBe("REJECTED"); expect(resource.ebook.processingStatus).toBe("failed"); expect(refundCount).toBe(1); await processResourceJob(); expect(refundCount).toBe(1); expect(chunkRows).toHaveLength(0); });
test("active standard PDF releases the consumed monthly unit exactly once", async () => { addPdf(); scriptError = true; await processResourceJob(); expect(monthlyRefundCount).toBe(1); await processResourceJob(); expect(monthlyRefundCount).toBe(1); });
test("legacy backfill never refunds or recharges an existing allowance", async () => { addPdf("onboarding"); resource.sourceMetadata.legacy = true; scriptError = true; await processResourceJob(); expect(refundCount).toBe(0); expect(monthlyRefundCount).toBe(0); });
test("last interrupted attempt becomes a visible retryable failure", async () => { job.state = "RUNNING"; job.attempts = 3; job.leaseUntil = new Date(0); expect(await processResourceJob()).toBe(false); expect(job.state).toBe("FAILED"); expect(job.errorCode).toBe("WORKER_INTERRUPTED"); expect(resource.state).toBe("FAILED"); });
test("soft-deleted resource can never be acquired by a worker", async () => { resource.deletedAt = new Date(); expect(await processResourceJob()).toBe(false); expect(chunkRows).toHaveLength(0); });
test("transient extraction retries with backoff and stops after three attempts", async () => {
  addPdf(); transient = true;
  await processResourceJob(); expect(job.state).toBe("QUEUED"); expect(resource.ebook.processingStatus).toBe("processing"); expect(job.attempts).toBe(1); expect(job.nextRunAt.getTime()).toBeGreaterThan(Date.now());
  job.nextRunAt = new Date(0); await processResourceJob(); expect(job.state).toBe("QUEUED"); expect(job.attempts).toBe(2);
  job.nextRunAt = new Date(0); await processResourceJob(); expect(job.state).toBe("FAILED"); expect(resource.ebook.processingStatus).toBe("failed"); expect(job.attempts).toBe(3); expect(await processResourceJob()).toBe(false); expect(monthlyRefundCount).toBe(0);
});
test("classification and indexing stages are actually persisted", async () => {
  await processResourceJob(); expect(stages).toEqual(["EXTRACTING", "CLASSIFYING", "INDEXING", "READY"]);
});
test("PDF extraction checkpoint is reused after an interrupted indexing attempt", async () => {
  addPdf(); resource.sourceMetadata.extractionComplete = true;
  resource.ebook.pageTexts = ["Laws of Motion: F = ma, net force relates mass and acceleration."];
  resource.ebook.text = resource.ebook.pageTexts[0]; resource.ebook.pageCount = 1;
  await processResourceJob(); expect(extractionCalls).toBe(0); expect(resource.state).toBe("READY"); expect(chunkRows).toHaveLength(1);
});
test("index failure rolls back partial publication and retries from the saved PDF checkpoint", async () => {
  addPdf(); indexFailure = true; await processResourceJob();
  expect(job.state).toBe("QUEUED"); expect(resource.state).toBe("FAILED"); expect(resource.sourceMetadata.extractionComplete).toBe(true); expect(chunkRows).toHaveLength(0);
  indexFailure = false; job.nextRunAt = new Date(0); await processResourceJob();
  expect(extractionCalls).toBe(1); expect(job.state).toBe("DONE"); expect(resource.state).toBe("READY"); expect(resource.ebook.processingStatus).toBe("ready");
});
