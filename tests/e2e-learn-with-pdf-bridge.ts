import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { mock } from "bun:test";
import { NextRequest } from "next/server";

type Actor = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: "USER";
  plusActive: boolean;
  planTier: "PLUS";
  emailVerified: Date;
  currentScholarClass: 9 | 11;
  examTrack: "NEET_JEE";
};

type UploadRow = {
  id: string;
  userId: string;
  key: string;
  name: string;
  title: string | null;
  totalBytes: number;
  receivedBytes: number;
  bytes: Buffer;
  status: string;
  lastOffset: number;
  lastDigest: string;
  leaseUntil: Date | null;
  result: unknown | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type EbookRow = {
  id: string;
  userId: string;
  title: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  pageCount: number;
  text: string;
  pageTexts: string[];
  readingState: Record<string, unknown>;
  pdfBytes: Buffer;
  processingStatus: string;
  allocation: string;
  importKey: string;
  importDigest: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ResourceRow = {
  id: string;
  identityKey: string;
  ownerUserId: string;
  ebookId: string | null;
  visibility: string;
  title: string;
  description: string;
  resourceType: string;
  sourceType: string;
  publisher: string;
  language: string;
  licenseType: string;
  attributionText: string;
  canStoreCopy: boolean;
  canGenerateDerivatives: boolean;
  contentHash: string;
  state: string;
  qualityStatus: string;
  sourceMetadata: Record<string, unknown>;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ArtifactRow = {
  id: string;
  resourceId: string;
  type: string;
  sourceHash: string;
  generator: string;
  content: unknown;
  references: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type ChunkRow = {
  id: string;
  resourceId: string;
  ordinal: number;
  heading: string;
  text: string;
  page: number | null;
};

const actorStorage = new AsyncLocalStorage<string | null>();

const uploads = new Map<string, UploadRow>();
const ebooks = new Map<string, EbookRow>();
const resources = new Map<string, ResourceRow>();
const artifacts = new Map<string, ArtifactRow>();
const chunks: ChunkRow[] = [];

function resetStore() {
  uploads.clear();
  ebooks.clear();
  resources.clear();
  artifacts.clear();
  chunks.length = 0;
}

function buildActor(userId: string | null): Actor | null {
  if (!userId || userId === "anonymous") return null;
  return {
    id: userId,
    name: userId === "e2e-user-1" ? "E2E Student" : "Second Student",
    email: `${userId}@scholar.local`,
    image: null,
    role: "USER",
    plusActive: true,
    planTier: "PLUS",
    emailVerified: new Date("2026-01-01T00:00:00.000Z"),
    currentScholarClass: 11,
    examTrack: "NEET_JEE",
  };
}

function matchesScalar(actual: unknown, expected: unknown): boolean {
  if (expected === undefined) return true;
  if (expected === null || typeof expected !== "object" || expected instanceof Date) {
    if (actual instanceof Date && expected instanceof Date) return actual.getTime() === expected.getTime();
    return actual === expected;
  }
  const op = expected as Record<string, unknown>;
  if ("equals" in op) return matchesScalar(actual, op.equals);
  if ("not" in op) return !matchesScalar(actual, op.not);
  if ("in" in op && Array.isArray(op.in)) return op.in.includes(actual);
  if ("gt" in op) {
    const a = actual instanceof Date ? actual.getTime() : Number(actual);
    const b = op.gt instanceof Date ? op.gt.getTime() : Number(op.gt);
    return a > b;
  }
  if ("gte" in op) {
    const a = actual instanceof Date ? actual.getTime() : Number(actual);
    const b = op.gte instanceof Date ? op.gte.getTime() : Number(op.gte);
    return a >= b;
  }
  if ("lt" in op) {
    const a = actual instanceof Date ? actual.getTime() : Number(actual);
    const b = op.lt instanceof Date ? op.lt.getTime() : Number(op.lt);
    return a < b;
  }
  if ("lte" in op) {
    const a = actual instanceof Date ? actual.getTime() : Number(actual);
    const b = op.lte instanceof Date ? op.lte.getTime() : Number(op.lte);
    return a <= b;
  }
  return false;
}

function matchesRecord(row: Record<string, unknown>, where?: Record<string, unknown>): boolean {
  if (!where) return true;
  for (const [key, val] of Object.entries(where)) {
    if (val === undefined) continue;
    if (key === "OR" && Array.isArray(val)) {
      if (!val.some((branch) => matchesRecord(row, branch as Record<string, unknown>))) return false;
      continue;
    }
    if (key === "AND" && Array.isArray(val)) {
      if (!val.every((branch) => matchesRecord(row, branch as Record<string, unknown>))) return false;
      continue;
    }
    const actual = row[key];
    if (
      val !== null &&
      typeof val === "object" &&
      !(val instanceof Date) &&
      !("equals" in val || "not" in val || "in" in val || "gt" in val || "gte" in val || "lt" in val || "lte" in val)
    ) {
      const relFilter = val as Record<string, unknown>;
      if ("isNot" in relFilter) {
        if (relFilter.isNot === null && !actual) return false;
        continue;
      }
      if ("is" in relFilter) {
        if (relFilter.is === null) {
          if (actual !== null && actual !== undefined) return false;
        } else if (!actual || !matchesRecord(actual as Record<string, unknown>, relFilter.is as Record<string, unknown>)) {
          return false;
        }
        continue;
      }
      if (!actual || typeof actual !== "object") return false;
      if (!matchesRecord(actual as Record<string, unknown>, relFilter)) return false;
      continue;
    }
    if (!matchesScalar(actual, val)) return false;
  }
  return true;
}

function projectRow(row: Record<string, unknown>, select?: Record<string, unknown>): Record<string, unknown> {
  if (!select) return { ...row };
  const out: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(select)) {
    if (!spec) continue;
    const val = row[key];
    if (spec === true) {
      out[key] = val;
      continue;
    }
    if (typeof spec === "object") {
      const subSpec = spec as {
        where?: Record<string, unknown>;
        orderBy?: Record<string, "asc" | "desc">;
        take?: number;
        select?: Record<string, unknown>;
      };
      if (Array.isArray(val)) {
        let items = [...val] as Array<Record<string, unknown>>;
        if (subSpec.where) items = items.filter((item) => matchesRecord(item, subSpec.where));
        if (subSpec.orderBy) {
          const [[orderField, dir]] = Object.entries(subSpec.orderBy);
          items.sort((a, b) => {
            const av = a[orderField] instanceof Date ? (a[orderField] as Date).getTime() : Number(a[orderField] ?? 0);
            const bv = b[orderField] instanceof Date ? (b[orderField] as Date).getTime() : Number(b[orderField] ?? 0);
            return dir === "desc" ? bv - av : av - bv;
          });
        }
        if (typeof subSpec.take === "number") items = items.slice(0, subSpec.take);
        out[key] = subSpec.select ? items.map((item) => projectRow(item, subSpec.select)) : items;
      } else if (val && typeof val === "object") {
        out[key] = subSpec.select ? projectRow(val as Record<string, unknown>, subSpec.select) : val;
      } else {
        out[key] = val ?? null;
      }
    }
  }
  return out;
}

function hydrateResource(row: ResourceRow): Record<string, unknown> {
  const relEbook = row.ebookId ? ebooks.get(row.ebookId) ?? null : null;
  const relArtifacts = Array.from(artifacts.values())
    .filter((a) => a.resourceId === row.id)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return {
    ...row,
    ebook: relEbook ? { ...relEbook } : null,
    artifacts: relArtifacts,
  };
}

function hydrateEbook(row: EbookRow): Record<string, unknown> {
  const relResource = Array.from(resources.values()).find((r) => r.ebookId === row.id && !r.deletedAt) ?? null;
  return {
    ...row,
    resource: relResource ? hydrateResource(relResource) : null,
  };
}

function sortRows<T extends Record<string, unknown>>(rows: T[], orderBy?: Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">>): T[] {
  if (!orderBy) return rows;
  const rules = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const rule of rules) {
      for (const [field, dir] of Object.entries(rule)) {
        const av = a[field] instanceof Date ? (a[field] as Date).getTime() : String(a[field] ?? "");
        const bv = b[field] instanceof Date ? (b[field] as Date).getTime() : String(b[field] ?? "");
        if (av === bv) continue;
        if (typeof av === "number" && typeof bv === "number") {
          return dir === "desc" ? bv - av : av - bv;
        }
        return dir === "desc" ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
      }
    }
    return 0;
  });
}

function extractSqlAndValues(firstArg: unknown, rest: unknown[]): { sql: string; values: unknown[] } {
  if (Array.isArray(firstArg)) {
    return { sql: firstArg.join(" ? "), values: rest };
  }
  if (firstArg && typeof firstArg === "object" && "strings" in firstArg && "values" in firstArg) {
    const sqlObj = firstArg as { strings: string[]; values: unknown[] };
    return { sql: sqlObj.strings.join(" ? "), values: sqlObj.values };
  }
  return { sql: String(firstArg ?? ""), values: rest };
}

const fakeDb = {
  user: {
    async findUnique({ where }: { where: { id?: string } }) {
      return where.id ? { id: where.id, role: "USER" } : null;
    },
  },
  scholarSubscription: {
    async findFirst({ where }: { where?: { userId?: string } }) {
      if (!where?.userId || where.userId === "anonymous") return null;
      return { id: `sub-${where.userId}`, status: "active", endsAt: null };
    },
  },
  ebookUpload: {
    async findUnique({ where, select }: { where: { id?: string; userId_key?: { userId: string; key: string } }; select?: Record<string, unknown> }) {
      let found: UploadRow | undefined;
      if (where.id) {
        found = uploads.get(where.id);
      } else if (where.userId_key) {
        found = Array.from(uploads.values()).find(
          (r) => r.userId === where.userId_key!.userId && r.key === where.userId_key!.key
        );
      }
      return found ? projectRow(found as unknown as Record<string, unknown>, select) : null;
    },
    async findFirst({ where, select }: { where?: Record<string, unknown>; select?: Record<string, unknown> }) {
      const found = Array.from(uploads.values()).find((r) => matchesRecord(r as unknown as Record<string, unknown>, where));
      return found ? projectRow(found as unknown as Record<string, unknown>, select) : null;
    },
    async findMany({ where, select }: { where?: Record<string, unknown>; select?: Record<string, unknown> }) {
      return Array.from(uploads.values())
        .filter((r) => matchesRecord(r as unknown as Record<string, unknown>, where))
        .map((r) => projectRow(r as unknown as Record<string, unknown>, select));
    },
    async create({ data, select }: { data: Partial<UploadRow> & { userId: string; key: string; name: string; totalBytes: number; expiresAt: Date }; select?: Record<string, unknown> }) {
      const now = new Date();
      const row: UploadRow = {
        id: data.id ?? randomUUID(),
        userId: data.userId,
        key: data.key,
        name: data.name,
        title: data.title ?? null,
        totalBytes: data.totalBytes,
        receivedBytes: data.receivedBytes ?? 0,
        bytes: data.bytes ? Buffer.from(data.bytes) : Buffer.alloc(0),
        status: data.status ?? "uploading",
        lastOffset: data.lastOffset ?? -1,
        lastDigest: data.lastDigest ?? "",
        leaseUntil: data.leaseUntil ?? null,
        result: data.result ?? null,
        expiresAt: data.expiresAt,
        createdAt: now,
        updatedAt: now,
      };
      uploads.set(row.id, row);
      return projectRow(row as unknown as Record<string, unknown>, select);
    },
    async updateMany({ where, data }: { where?: Record<string, unknown>; data: Partial<UploadRow> }) {
      let count = 0;
      for (const row of uploads.values()) {
        if (!matchesRecord(row as unknown as Record<string, unknown>, where)) continue;
        Object.assign(row, data, { updatedAt: new Date() });
        if (data.bytes) row.bytes = Buffer.from(data.bytes);
        count += 1;
      }
      return { count };
    },
    async deleteMany({ where }: { where?: Record<string, unknown> }) {
      let count = 0;
      for (const [id, row] of uploads.entries()) {
        if (!matchesRecord(row as unknown as Record<string, unknown>, where)) continue;
        uploads.delete(id);
        count += 1;
      }
      return { count };
    },
  },
  customEbook: {
    async findFirst({ where, select }: { where?: Record<string, unknown>; select?: Record<string, unknown> }) {
      const found = Array.from(ebooks.values())
        .map((r) => hydrateEbook(r))
        .find((h) => matchesRecord(h, where));
      return found ? projectRow(found, select) : null;
    },
    async findMany({ where, orderBy, take, select }: { where?: Record<string, unknown>; orderBy?: Record<string, "asc" | "desc">; take?: number; select?: Record<string, unknown> }) {
      let rows = Array.from(ebooks.values())
        .map((r) => hydrateEbook(r))
        .filter((h) => matchesRecord(h, where));
      rows = sortRows(rows, orderBy);
      if (typeof take === "number") rows = rows.slice(0, take);
      return rows.map((r) => projectRow(r, select));
    },
    async create({ data, select }: { data: Partial<EbookRow> & { userId: string; title: string; originalFileName: string; sizeBytes: number; pdfBytes: Buffer }; select?: Record<string, unknown> }) {
      const now = new Date();
      const row: EbookRow = {
        id: data.id ?? randomUUID(),
        userId: data.userId,
        title: data.title,
        originalFileName: data.originalFileName,
        mimeType: data.mimeType ?? "application/pdf",
        sizeBytes: data.sizeBytes,
        pageCount: data.pageCount ?? 0,
        text: data.text ?? "",
        pageTexts: Array.isArray(data.pageTexts) ? data.pageTexts : [],
        readingState: (data.readingState as Record<string, unknown>) ?? {},
        pdfBytes: Buffer.from(data.pdfBytes),
        processingStatus: data.processingStatus ?? "processing",
        allocation: data.allocation ?? "lam-pdf",
        importKey: data.importKey ?? "",
        importDigest: data.importDigest ?? "",
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      ebooks.set(row.id, row);
      return projectRow(hydrateEbook(row), select);
    },
    async update({ where, data }: { where: { id: string }; data: Partial<EbookRow> }) {
      const existing = ebooks.get(where.id);
      if (!existing) throw new Error(`CustomEbook not found: ${where.id}`);
      Object.assign(existing, data, { updatedAt: new Date() });
      return hydrateEbook(existing);
    },
    async deleteMany({ where }: { where?: Record<string, unknown> }) {
      let count = 0;
      for (const [id, row] of ebooks.entries()) {
        if (!matchesRecord(hydrateEbook(row), where)) continue;
        ebooks.delete(id);
        count += 1;
      }
      return { count };
    },
  },
  studyResource: {
    async findFirst({ where, select }: { where?: Record<string, unknown>; select?: Record<string, unknown> }) {
      const found = Array.from(resources.values())
        .map((r) => hydrateResource(r))
        .find((h) => matchesRecord(h, where));
      return found ? projectRow(found, select) : null;
    },
    async create({ data, select }: { data: Partial<ResourceRow> & { identityKey: string; ownerUserId: string; title: string }; select?: Record<string, unknown> }) {
      const now = new Date();
      const row: ResourceRow = {
        id: data.id ?? randomUUID(),
        identityKey: data.identityKey,
        ownerUserId: data.ownerUserId,
        ebookId: data.ebookId ?? null,
        visibility: data.visibility ?? "PRIVATE",
        title: data.title,
        description: data.description ?? "",
        resourceType: data.resourceType ?? "textbook",
        sourceType: data.sourceType ?? "USER_PDF_UPLOAD",
        publisher: data.publisher ?? "Personal Upload",
        language: data.language ?? "en",
        licenseType: data.licenseType ?? "PRIVATE_USER_UPLOAD",
        attributionText: data.attributionText ?? "",
        canStoreCopy: data.canStoreCopy ?? true,
        canGenerateDerivatives: data.canGenerateDerivatives ?? true,
        contentHash: data.contentHash ?? "",
        state: data.state ?? "EXTRACTING",
        qualityStatus: data.qualityStatus ?? "user-provided",
        sourceMetadata: (data.sourceMetadata as Record<string, unknown>) ?? {},
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      resources.set(row.id, row);
      return projectRow(hydrateResource(row), select);
    },
    async update({ where, data }: { where: { id: string }; data: Partial<ResourceRow> }) {
      const existing = resources.get(where.id);
      if (!existing) throw new Error(`StudyResource not found: ${where.id}`);
      Object.assign(existing, data, { updatedAt: new Date() });
      return hydrateResource(existing);
    },
    async deleteMany({ where }: { where?: Record<string, unknown> }) {
      let count = 0;
      for (const [id, row] of resources.entries()) {
        if (!matchesRecord(hydrateResource(row), where)) continue;
        resources.delete(id);
        count += 1;
      }
      return { count };
    },
  },
  resourceArtifact: {
    async upsert({
      where,
      create,
      update,
    }: {
      where: { resourceId_type_sourceHash: { resourceId: string; type: string; sourceHash: string } };
      create: Omit<ArtifactRow, "id" | "createdAt" | "updatedAt">;
      update: Partial<ArtifactRow>;
    }) {
      const key = where.resourceId_type_sourceHash;
      const existing = Array.from(artifacts.values()).find(
        (a) => a.resourceId === key.resourceId && a.type === key.type && a.sourceHash === key.sourceHash
      );
      if (existing) {
        Object.assign(existing, update, { updatedAt: new Date() });
        return existing;
      }
      const now = new Date();
      const row: ArtifactRow = {
        id: randomUUID(),
        ...create,
        createdAt: now,
        updatedAt: now,
      };
      artifacts.set(row.id, row);
      return row;
    },
    async deleteMany({ where }: { where?: Record<string, unknown> }) {
      let count = 0;
      for (const [id, row] of artifacts.entries()) {
        if (!matchesRecord(row as unknown as Record<string, unknown>, where)) continue;
        artifacts.delete(id);
        count += 1;
      }
      return { count };
    },
  },
  resourceChunk: {
    async findMany({
      where,
      orderBy,
      take,
      select,
    }: {
      where?: Record<string, unknown>;
      orderBy?: Record<string, "asc" | "desc">;
      take?: number;
      select?: Record<string, unknown>;
    }) {
      const hydrated = chunks.map((c) => {
        const res = resources.get(c.resourceId) ?? null;
        return { ...c, resource: res };
      });
      let filtered = hydrated.filter((c) => matchesRecord(c as unknown as Record<string, unknown>, where));
      filtered = sortRows(filtered as Array<Record<string, unknown>>, orderBy) as typeof filtered;
      if (typeof take === "number") filtered = filtered.slice(0, take);
      return filtered.map((c) => projectRow(c as unknown as Record<string, unknown>, select));
    },
    async createMany({ data }: { data: Array<Omit<ChunkRow, "id">> }) {
      for (const item of data) {
        chunks.push({ id: randomUUID(), ...item });
      }
      return { count: data.length };
    },
    async deleteMany({ where }: { where?: Record<string, unknown> }) {
      let count = 0;
      for (let i = chunks.length - 1; i >= 0; i -= 1) {
        if (!matchesRecord(chunks[i] as unknown as Record<string, unknown>, where)) continue;
        chunks.splice(i, 1);
        count += 1;
      }
      return { count };
    },
  },
  async $queryRaw(firstArg: unknown, ...rest: unknown[]) {
    const { sql, values } = extractSqlAndValues(firstArg, rest);
    if (sql.includes('FROM "User"')) {
      return [{ id: String(values[0] ?? "") }];
    }
    if (sql.includes('"pageTexts" ->>')) {
      const idx = Number(values[0]);
      const docId = String(values[1] ?? "");
      const userId = String(values[2] ?? "");
      const ebook = ebooks.get(docId);
      if (!ebook || ebook.userId !== userId || ebook.deletedAt) return [];
      return [{ text: ebook.pageTexts[idx] ?? null }];
    }
    if (sql.includes('substring("pdfBytes"')) {
      const start1 = Number(values[0]);
      const len = Number(values[1]);
      const docId = String(values[2] ?? "");
      const userId = String(values[3] ?? "");
      const ebook = ebooks.get(docId);
      if (!ebook || ebook.userId !== userId || ebook.deletedAt) return [];
      const start0 = Math.max(0, start1 - 1);
      return [{ bytes: ebook.pdfBytes.subarray(start0, start0 + len) }];
    }
    if (sql.includes('FROM "ResourceChunk"')) {
      const resourceId = String(values[0] ?? "");
      const ownerUserId = String(values[1] ?? "");
      const q = String(values[2] ?? "").toLowerCase().split(/\s+/).filter(Boolean);
      const res = resources.get(resourceId);
      if (!res || res.ownerUserId !== ownerUserId || res.visibility !== "PRIVATE" || res.deletedAt) return [];
      return chunks
        .filter((c) => c.resourceId === resourceId)
        .filter((c) => {
          const hay = `${c.heading} ${c.text}`.toLowerCase();
          return q.some((term) => hay.includes(term));
        })
        .slice(0, 30)
        .map(({ ordinal, heading, text, page }) => ({ ordinal, heading, text, page }));
    }
    return [];
  },
  async $executeRaw(firstArg: unknown, ...rest: unknown[]) {
    const { sql, values } = extractSqlAndValues(firstArg, rest);
    if (sql.includes('UPDATE "EbookUpload"')) {
      const chunkBytes = Buffer.from(values[0] as Uint8Array);
      const offset = Number(values[2]);
      const digest = String(values[3] ?? "");
      const id = String(values[4] ?? "");
      const userId = String(values[5] ?? "");
      const expectedOffset = Number(values[6]);
      const row = uploads.get(id);
      if (!row || row.userId !== userId || row.status !== "uploading" || row.receivedBytes !== expectedOffset || row.expiresAt.getTime() <= Date.now()) {
        return 0;
      }
      row.bytes = Buffer.concat([row.bytes, chunkBytes]);
      row.receivedBytes += chunkBytes.length;
      row.lastOffset = offset;
      row.lastDigest = digest;
      row.updatedAt = new Date();
      return 1;
    }
    return 0;
  },
  async $transaction<T>(fn: (tx: typeof fakeDb) => Promise<T>): Promise<T> {
    return fn(fakeDb);
  },
};

mock.module("server-only", () => ({}));
mock.module("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}));
mock.module("@/lib/db", () => ({ db: fakeDb }));
mock.module("@/lib/auth/session", () => ({
  getSessionUser: async () => buildActor(actorStorage.getStore() ?? "e2e-user-1"),
  hasDeveloperSession: async () => false,
}));
mock.module("@/lib/security/rate-limit", () => {
  class RateLimitError extends Error {
    constructor(public readonly retryAfterSeconds: number) {
      super("Rate limit exceeded");
      this.name = "RateLimitError";
    }
  }
  return {
    RateLimitError,
    opaqueRateLimitKey: (_ns: string, v: string) => v,
    requestRateLimitKey: (_r: Request, ns: string) => ns,
    checkRateLimit: async () => ({ allowed: true, remaining: 999, resetAt: Date.now() + 60_000 }),
    enforceRateLimit: async () => undefined,
  };
});
mock.module("@/lib/resources/http", () => ({
  mutationOrigin: (request: Request) => {
    const origin = request.headers.get("origin");
    if (!origin) return true;
    return origin.startsWith("http://127.0.0.1") || origin.startsWith("http://localhost");
  },
  resourceError: (err: unknown) => {
    const message = err instanceof Error ? err.message : "Resource error";
    return Response.json({ error: message }, { status: 500 });
  },
}));

const pdfCollectionRoute = await import("@/app/api/lam/pdf/route");
const pdfUploadsRoute = await import("@/app/api/lam/pdf/uploads/route");
const pdfDocRoute = await import("@/app/api/lam/pdf/[docId]/route");
const pdfProcessRoute = await import("@/app/api/lam/pdf/[docId]/process/route");
const { executePluginServer, PLUGIN_EXECUTE_REQUEST_SCHEMA } = await import("@/lib/lam/plugin-server");
const { publicAIError } = await import("@/lib/ai/errors");

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,X-Test-User-Id",
  "Access-Control-Expose-Headers": "Content-Range,Content-Length,Content-Disposition",
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    headers.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function toNextRequest(req: Request): Promise<NextRequest> {
  const headers = new Headers(req.headers);
  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const bodyBuf = hasBody ? Buffer.from(await req.arrayBuffer()) : undefined;
  return new NextRequest(req.url, {
    method,
    headers,
    body: bodyBuf,
  });
}

async function handlePluginExecute(req: Request): Promise<Response> {
  const parsed = PLUGIN_EXECUTE_REQUEST_SCHEMA.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, error: { code: "INVALID_REQUEST", message: "Invalid plugin request." } }, { status: 400, headers: CORS_HEADERS });
  }
  const actorId = actorStorage.getStore() ?? "e2e-user-1";
  if (!actorId || actorId === "anonymous") {
    return Response.json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in to use LAM plugins." } }, { status: 401, headers: CORS_HEADERS });
  }
  const encoder = new TextEncoder();
  const ac = new AbortController();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const close = () => {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // Stream already closed
          }
        }
      };
      const send = (payload: Record<string, unknown>) => {
        if (!closed && !ac.signal.aborted) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        }
      };
      try {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const result = await executePluginServer({
              input: parsed.data,
              userId: actorId,
              customAI: null,
              signal: ac.signal,
              emit: send,
            });
            send({ type: "result", content: result.content, execution: result.execution });
            break;
          } catch (err) {
            const msg = err instanceof Error ? err.message : "";
            const status = typeof (err as { status?: unknown })?.status === "number" ? (err as { status: number }).status : 0;
            if (attempt === 0 && (status === 429 || /\b429\b|rate.?limit/i.test(msg))) {
              await new Promise((r) => setTimeout(r, 2000));
              continue;
            }
            throw err;
          }
        }
      } catch (err) {
        if (!ac.signal.aborted) {
          const pub = publicAIError(err);
          send({ type: "error", code: pub.code, status: pub.status, message: pub.message });
        }
      } finally {
        close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

const port = Number(process.env.LAM_PDF_E2E_PORT || 3101);
const server = Bun.serve({
  port,
  hostname: "127.0.0.1",
  idleTimeout: 120,
  async fetch(req) {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    const url = new URL(req.url);
    if (url.pathname === "/health") {
      return Response.json({ ok: true, ebooks: ebooks.size }, { headers: CORS_HEADERS });
    }
    if (url.pathname === "/reset" && req.method === "POST") {
      resetStore();
      return Response.json({ ok: true }, { headers: CORS_HEADERS });
    }

    const actorHeader = req.headers.get("x-test-user-id");
    const actorId = actorHeader === null ? "e2e-user-1" : actorHeader;

    return actorStorage.run(actorId, async () => {
      if (url.pathname === "/api/lam/plugins/execute" && req.method === "POST") {
        return handlePluginExecute(req);
      }

      const nextReq = await toNextRequest(req);

      if (url.pathname === "/api/lam/pdf" && req.method === "GET") {
        return withCors(await pdfCollectionRoute.GET());
      }
      if (url.pathname === "/api/lam/pdf/uploads") {
        if (req.method === "POST") return withCors(await pdfUploadsRoute.POST(nextReq));
        if (req.method === "PUT") return withCors(await pdfUploadsRoute.PUT(nextReq));
        if (req.method === "DELETE") return withCors(await pdfUploadsRoute.DELETE(nextReq));
      }

      const processMatch = url.pathname.match(/^\/api\/lam\/pdf\/([^/]+)\/process$/);
      if (processMatch) {
        const context = { params: Promise.resolve({ docId: decodeURIComponent(processMatch[1]) }) };
        if (req.method === "GET") return withCors(await pdfProcessRoute.GET(nextReq, context));
        if (req.method === "POST") {
          let procRes = await pdfProcessRoute.POST(nextReq, context);
          if (procRes.status === 502 || procRes.status === 503 || procRes.status === 429) {
            await new Promise((r) => setTimeout(r, 2500));
            const retryReq = new NextRequest(req.url, { method: "POST", headers: nextReq.headers, body: "{}" });
            procRes = await pdfProcessRoute.POST(retryReq, context);
          }
          return withCors(procRes);
        }
      }

      const docMatch = url.pathname.match(/^\/api\/lam\/pdf\/([^/]+)$/);
      if (docMatch && docMatch[1] !== "uploads") {
        const context = { params: Promise.resolve({ docId: decodeURIComponent(docMatch[1]) }) };
        if (req.method === "GET") return withCors(await pdfDocRoute.GET(nextReq, context));
        if (req.method === "DELETE") return withCors(await pdfDocRoute.DELETE(nextReq, context));
      }

      return Response.json({ ok: false, error: "Not found" }, { status: 404, headers: CORS_HEADERS });
    });
  },
});

console.log(`LAM PDF E2E bridge listening on http://127.0.0.1:${server.port}`);
