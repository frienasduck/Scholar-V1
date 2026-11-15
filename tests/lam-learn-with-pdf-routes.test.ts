import { beforeEach, describe, expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";

mock.module("server-only", () => ({}));

let currentUser: { id: string } | null = { id: "user-owner-1" };

const storedDocs = new Map<
  string,
  {
    id: string;
    userId: string;
    title: string;
    originalFileName: string;
    sizeBytes: number;
    pageCount: number;
    processingStatus: string;
    deletedAt: Date | null;
    allocation: string;
    pdfBytes: Buffer;
    resourceId: string | null;
  }
>();
const storedUploads = new Map<
  string,
  {
    id: string;
    userId: string;
    key: string;
    name: string;
    title: string;
    totalBytes: number;
    receivedBytes: number;
    status: string;
    bytes: Buffer;
    expiresAt: Date;
    lastOffset: number | null;
    lastDigest: string | null;
    result: unknown;
  }
>();

const deletedChunks: string[] = [];
const deletedArtifacts: string[] = [];
const deletedResources: string[] = [];
const deletedEbooks: string[] = [];

class MockRateLimitError extends Error {
  retryAfterSeconds = 60;
}

mock.module("@/lib/auth/session", () => ({
  getSessionUser: async () => currentUser,
  hasDeveloperSession: async () => false,
  createSession: async () => "",
  clearSession: async () => {},
  createDeveloperSession: async () => {},
  clearDeveloperSession: async () => {},
}));
mock.module("@/lib/resources/http", () => ({
  mutationOrigin: (request: Request) =>
    request.headers.get("origin") === "http://localhost:3000",
  resourceError: (err: unknown) =>
    Response.json({ message: err instanceof Error ? err.message : "Error" }, { status: 500 }),
}));
mock.module("@/lib/security/rate-limit", () => ({
  RateLimitError: MockRateLimitError,
  enforceRateLimit: async () => {},
}));

const mockDb = {
  customEbook: {
    findMany: async ({ where }: { where: { userId: string } }) =>
      [...storedDocs.values()].filter(
        (d) => d.userId === where.userId && d.deletedAt === null
      ),
    findFirst: async ({
      where,
    }: {
      where: { id: string; userId: string; deletedAt?: null };
    }) => {
      const row = storedDocs.get(where.id);
      if (!row || row.userId !== where.userId || row.deletedAt !== null) {
        return null;
      }
      return {
        ...row,
        resource: row.resourceId
          ? {
              id: row.resourceId,
              state: "READY",
              sourceMetadata: { lamPdfStage: "ready", scannedPages: [], mixedPages: [] },
              artifacts: [],
            }
          : null,
      };
    },
    deleteMany: async ({ where }: { where: { id: string; userId: string } }) => {
      const row = storedDocs.get(where.id);
      if (row && row.userId === where.userId) {
        storedDocs.delete(where.id);
        deletedEbooks.push(where.id);
        return { count: 1 };
      }
      return { count: 0 };
    },
  },
  ebookUpload: {
    findFirst: async ({
      where,
    }: {
      where: { id: string; userId: string; status?: string };
    }) => {
      const row = storedUploads.get(where.id);
      if (!row || row.userId !== where.userId) return null;
      if (where.status && row.status !== where.status) return null;
      return row;
    },
    findMany: async () => [],
    findUnique: async () => null,
    create: async ({
      data,
    }: {
      data: {
        userId: string;
        key: string;
        name: string;
        title: string;
        totalBytes: number;
      };
    }) => {
      const id = "upload-1";
      const created = {
        id,
        ...data,
        receivedBytes: 0,
        status: "uploading",
        bytes: Buffer.alloc(0),
        expiresAt: new Date(Date.now() + 3600_000),
        lastOffset: null,
        lastDigest: null,
        result: null,
      };
      storedUploads.set(id, created);
      return created;
    },
    deleteMany: async () => ({ count: 0 }),
  },
  resourceChunk: {
    deleteMany: async ({ where }: { where: { resourceId: string } }) => {
      deletedChunks.push(where.resourceId);
      return { count: 2 };
    },
  },
  resourceArtifact: {
    deleteMany: async ({ where }: { where: { resourceId: string } }) => {
      deletedArtifacts.push(where.resourceId);
      return { count: 1 };
    },
  },
  studyResource: {
    deleteMany: async ({ where }: { where: { id: string } }) => {
      deletedResources.push(where.id);
      return { count: 1 };
    },
  },
  $queryRaw: async () => [],
  $transaction: async <T>(fn: (tx: typeof mockDb) => Promise<T>) => fn(mockDb),
};

mock.module("@/lib/db", () => ({ db: mockDb }));

const listRoute = await import("../src/app/api/lam/pdf/route");
const uploadsRoute = await import("../src/app/api/lam/pdf/uploads/route");
const docRoute = await import("../src/app/api/lam/pdf/[docId]/route");
const processRoute = await import("../src/app/api/lam/pdf/[docId]/process/route");

describe("Learn with PDF — API Auth, Ownership Isolation & Upload Validation", () => {
  beforeEach(() => {
    currentUser = { id: "user-owner-1" };
    storedDocs.clear();
    storedUploads.clear();
    deletedChunks.length = 0;
    deletedArtifacts.length = 0;
    deletedResources.length = 0;
    deletedEbooks.length = 0;

    storedDocs.set("doc-owned-1", {
      id: "doc-owned-1",
      userId: "user-owner-1",
      title: "Private Chapter",
      originalFileName: "private.pdf",
      sizeBytes: 1200,
      pageCount: 2,
      processingStatus: "ready",
      deletedAt: null,
      allocation: "lam-pdf",
      pdfBytes: Buffer.from("%PDF-1.4\n..."),
      resourceId: "res-owned-1",
    });
  });

  test("rejects unauthenticated requests with 401 across all PDF endpoints", async () => {
    currentUser = null;

    const listRes = await listRoute.GET();
    expect(listRes.status).toBe(401);

    const startRes = await uploadsRoute.POST(
      new NextRequest("http://localhost:3000/api/lam/pdf/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({
          key: "testkey1234567890",
          name: "doc.pdf",
          size: 1024,
        }),
      })
    );
    expect(startRes.status).toBe(401);

    const getDocRes = await docRoute.GET(
      new NextRequest("http://localhost:3000/api/lam/pdf/doc-owned-1"),
      { params: Promise.resolve({ docId: "doc-owned-1" }) }
    );
    expect(getDocRes.status).toBe(401);

    const procRes = await processRoute.POST(
      new NextRequest("http://localhost:3000/api/lam/pdf/doc-owned-1/process", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      }),
      { params: Promise.resolve({ docId: "doc-owned-1" }) }
    );
    expect(procRes.status).toBe(401);
  });

  test("rejects CSRF cross-origin mutations with 403", async () => {
    const startRes = await uploadsRoute.POST(
      new NextRequest("http://localhost:3000/api/lam/pdf/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json", origin: "https://evil.example" },
        body: JSON.stringify({
          key: "testkey1234567890",
          name: "doc.pdf",
          size: 1024,
        }),
      })
    );
    expect(startRes.status).toBe(403);

    const delRes = await docRoute.DELETE(
      new NextRequest("http://localhost:3000/api/lam/pdf/doc-owned-1", {
        method: "DELETE",
        headers: { origin: "https://evil.example" },
      }),
      { params: Promise.resolve({ docId: "doc-owned-1" }) }
    );
    expect(delRes.status).toBe(403);
  });

  test("rejects oversized (>25 MB), non-PDF filenames, and invalid %PDF- signatures on PUT", async () => {
    const overRes = await uploadsRoute.POST(
      new NextRequest("http://localhost:3000/api/lam/pdf/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({
          key: "oversized123456789",
          name: "too-big.pdf",
          size: 25 * 1024 * 1024 + 1,
        }),
      })
    );
    expect(overRes.status).toBe(400);

    const wrongExt = await uploadsRoute.POST(
      new NextRequest("http://localhost:3000/api/lam/pdf/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({
          key: "wrongext1234567890",
          name: "notes.txt",
          size: 1024,
        }),
      })
    );
    expect(wrongExt.status).toBe(400);

    // Valid start session, then spoofed first chunk without %PDF- signature
    const okStart = await uploadsRoute.POST(
      new NextRequest("http://localhost:3000/api/lam/pdf/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({
          key: "spoofpdf1234567890",
          name: "fake.pdf",
          size: 64,
        }),
      })
    );
    expect(okStart.status).toBe(200);
    const { uploadId } = (await okStart.json()) as { uploadId: string };

    const badPut = await uploadsRoute.PUT(
      new NextRequest(
        `http://localhost:3000/api/lam/pdf/uploads?id=${encodeURIComponent(uploadId)}&offset=0`,
        {
          method: "PUT",
          headers: { origin: "http://localhost:3000" },
          body: new Uint8Array(Buffer.from("HELLO THIS IS NOT A REAL PDF FILE")),
        }
      )
    );
    expect(badPut.status).toBe(415);
    const badJson = (await badPut.json()) as { error?: { code?: string } };
    expect(badJson.error?.code).toBe("INVALID_PDF_SIGNATURE");
  });

  test("enforces strict cross-user ownership isolation and full delete cleanup", async () => {
    currentUser = { id: "user-intruder-2" };

    const listRes = await listRoute.GET();
    const listJson = (await listRes.json()) as { docs: Array<{ id: string }> };
    expect(listJson.docs).toEqual([]);

    const getOther = await docRoute.GET(
      new NextRequest("http://localhost:3000/api/lam/pdf/doc-owned-1"),
      { params: Promise.resolve({ docId: "doc-owned-1" }) }
    );
    expect(getOther.status).toBe(404);

    const procOther = await processRoute.POST(
      new NextRequest("http://localhost:3000/api/lam/pdf/doc-owned-1/process", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      }),
      { params: Promise.resolve({ docId: "doc-owned-1" }) }
    );
    expect(procOther.status).toBe(404);

    const delOther = await docRoute.DELETE(
      new NextRequest("http://localhost:3000/api/lam/pdf/doc-owned-1", {
        method: "DELETE",
        headers: { origin: "http://localhost:3000" },
      }),
      { params: Promise.resolve({ docId: "doc-owned-1" }) }
    );
    expect(delOther.status).toBe(404);
    expect(storedDocs.has("doc-owned-1")).toBe(true);

    // Owner deletes -> all chunks, artifacts, studyResource, customEbook cleaned up
    currentUser = { id: "user-owner-1" };
    const delOwner = await docRoute.DELETE(
      new NextRequest("http://localhost:3000/api/lam/pdf/doc-owned-1", {
        method: "DELETE",
        headers: { origin: "http://localhost:3000" },
      }),
      { params: Promise.resolve({ docId: "doc-owned-1" }) }
    );
    expect(delOwner.status).toBe(200);
    expect(deletedChunks).toEqual(["res-owned-1"]);
    expect(deletedArtifacts).toEqual(["res-owned-1"]);
    expect(deletedResources).toEqual(["res-owned-1"]);
    expect(deletedEbooks).toEqual(["doc-owned-1"]);
  });
});
