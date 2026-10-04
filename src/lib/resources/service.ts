import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { BUILTIN_RESOURCES, BUILTIN_SNAPSHOTS } from "./catalog";
import { chunkSections, lexicalScore, rankResources, tokens } from "./engine";
import { ARTIFACT_GENERATOR, deriveArtifact, type ArtifactType } from "./artifacts";
import type { Citation, IndexedChunk, ResourceQuery, ResourceRecord, ResourceResult } from "./types";
import type { Preferences } from "@/lib/personalization/schema";
const snapshotById = new Map(BUILTIN_SNAPSHOTS.map(s => [s.resourceId, s]));

// Ownership is mandatory in the query, never a post-fetch client-side filter.
export const privateScope = (userId: string): Prisma.StudyResourceWhereInput => ({ ownerUserId: userId, visibility: "PRIVATE", deletedAt: null });
export function record(row: Prisma.StudyResourceGetPayload<{ include: { mappings: true } }>): ResourceRecord {
  const { sections: _sections, usageKey: _usageKey, ...safeMetadata } = row.sourceMetadata as Record<string, unknown>;
  return { ...row, createdAt: undefined, updatedAt: undefined, lastCheckedAt: row.lastCheckedAt?.toISOString(), deletedAt: row.deletedAt?.toISOString(),
    sourceMetadata: safeMetadata } as ResourceRecord;
}
export async function library(query: ResourceQuery, userId: string | null): Promise<ResourceResult> {
  let personal: ResourceRecord[] = []; let privateAvailable = true; let preferences: Preferences | undefined;
  if (userId && query.scope !== "built-in") {
    try {
      const words = tokens(query.q ?? "").slice(0, 12);
      const ids = words.length ? await db.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT r."id" FROM "StudyResource" r
        WHERE r."ownerUserId" = ${userId} AND r."visibility" = 'PRIVATE' AND r."deletedAt" IS NULL
        AND (to_tsvector('simple', r."title" || ' ' || r."description") @@ plainto_tsquery('simple', ${words.join(" ")})
          OR EXISTS (SELECT 1 FROM "ResourceChunk" c WHERE c."resourceId" = r."id" AND to_tsvector('simple', c."text") @@ plainto_tsquery('simple', ${words.join(" ")})))
        ORDER BY r."updatedAt" DESC LIMIT 500`) : null;
      const rows = await db.studyResource.findMany({ where: { ...privateScope(userId), ...(ids ? { id: { in: ids.map(r => r.id) } } : {}),
        ...(query.subjectId ? { mappings: { some: { subjectId: query.subjectId, ...(query.grade ? { grade: query.grade } : {}), ...(query.chapterId ? { chapterId: { in: [query.chapterId, ""] } } : {}) } } } : {}) }, include: { mappings: true }, take: 500, orderBy: { updatedAt: "desc" } });
      personal = rows.map(record);
      // Full-text matches inside private chunks must survive metadata-only ranking.
      if (ids) personal = personal.map(r => ({ ...r, searchScore: 1 }));
      const profile = await db.learningProfile.findUnique({ where: { userId }, select: { preferences: true } });
      preferences = profile?.preferences as Preferences | undefined;
    } catch { personal = []; privateAvailable = false; console.warn("[Resource library] private index unavailable; no private content returned"); }
  }
  const builtins = BUILTIN_RESOURCES.map(r => ({ ...r, searchScore: query.q ? Math.max(0, ...(snapshotById.get(r.id)?.sections.map(s => lexicalScore(s.text, query.q!)) ?? [])) : 0 }));
  const ranked = rankResources([...builtins, ...personal], query, userId, preferences);
  const limit = Math.max(1, Math.min(query.limit ?? 12, 24));
  const pages = Math.max(1, Math.ceil(ranked.length / limit));
  const page = Math.max(1, Math.min(query.page ?? 1, pages));
  return { resources: ranked.slice((page - 1) * limit, page * limit).map(({ score: _score, lexical: _lexical, ...r }) => r), total: ranked.length, page, pages, privateAvailable };
}
export async function findResource(id: string, userId: string | null) {
  const builtin = BUILTIN_RESOURCES.find(r => r.id === id);
  if (builtin) return builtin;
  if (!userId) return null;
  const row = await db.studyResource.findFirst({ where: { id, ...privateScope(userId) }, include: { mappings: true } });
  return row ? record(row) : null;
}
export async function resourceChunks(resource: ResourceRecord, offset = 0, limit = 24): Promise<IndexedChunk[]> {
  if (!resource.canStoreCopy || !resource.canGenerateDerivatives || !["READY", "NEEDS_REVIEW"].includes(resource.state)) return [];
  if (resource.visibility === "GLOBAL") return chunkSections(snapshotById.get(resource.id)?.sections ?? []).slice(offset, offset + limit);
  if (!resource.ownerUserId || resource.deletedAt) return [];
  return db.resourceChunk.findMany({ where: { resourceId: resource.id, resource: privateScope(resource.ownerUserId) }, orderBy: { ordinal: "asc" }, skip: offset, take: limit }).then(rows => rows.map(row => ({ ...row, page: row.page ?? undefined, timestamp: row.timestamp ?? undefined, sourceUrl: row.sourceUrl ?? undefined })));
}
export function citationFor(resource: ResourceRecord, chunk: IndexedChunk, id: string): Citation {
  return { id, resourceId: resource.id, title: resource.title, publisher: resource.publisher, url: chunk.sourceUrl ?? resource.canonicalUrl, heading: chunk.heading, page: chunk.page, timestamp: chunk.timestamp };
}
export async function artifact(resource: ResourceRecord, type: ArtifactType) {
  if (!resource.canGenerateDerivatives || !resource.canStoreCopy || !["READY", "NEEDS_REVIEW"].includes(resource.state)) return null;
  const hash = resource.contentHash ?? "v1";
  if (resource.visibility === "PRIVATE") {
    const cached = await db.resourceArtifact.findFirst({ where: { resourceId: resource.id, type, sourceHash: hash, resource: privateScope(resource.ownerUserId!) } });
    if (cached?.generator === ARTIFACT_GENERATOR) return cached.content;
  }
  const chunks = await resourceChunks(resource, 0, 80);
  const result = deriveArtifact(type, chunks.map(c => ({ chunk: c, citation: citationFor(resource, c, `S${c.ordinal + 1}`) })), resource.licenseType);
  if (resource.visibility === "PRIVATE") await db.resourceArtifact.upsert({ where: { resourceId_type_sourceHash: { resourceId: resource.id, type, sourceHash: hash } }, create: { resourceId: resource.id, type, sourceHash: hash, generator: result.generator, content: result as unknown as Prisma.InputJsonValue, references: result.items.map(i => i.citation) as unknown as Prisma.InputJsonValue }, update: { generator: result.generator, content: result as unknown as Prisma.InputJsonValue, references: result.items.map(i => i.citation) as unknown as Prisma.InputJsonValue } });
  return result;
}
export async function retrieve(userId: string, query: ResourceQuery, resourceIds?: string[]) {
  const candidates = resourceIds?.length ? (await Promise.all(resourceIds.slice(0, 4).map(id => findResource(id, userId)))).filter((r): r is ResourceRecord => !!r) : (await library({ ...query, limit: 8 }, userId)).resources;
  const matched = candidates.filter(r => r.canStoreCopy && r.canGenerateDerivatives && ["READY", "NEEDS_REVIEW"].includes(r.state) && (!query.grade || r.mappings.some(m => m.grade === query.grade) || !r.mappings.length && r.visibility === "PRIVATE"));
  const words = tokens(query.q ?? "").slice(0, 12);
  const groups = await Promise.all(matched.map(async resource => {
    let chunks: IndexedChunk[];
    if (query.pageStart !== undefined && resource.visibility === "PRIVATE") {
      const rows = await db.resourceChunk.findMany({ where: { resourceId: resource.id, resource: privateScope(userId), page: { gte: query.pageStart, lte: query.pageEnd ?? query.pageStart } }, orderBy: { ordinal: "asc" }, take: 80 });
      chunks = rows.map(c => ({ ...c, page: c.page ?? undefined, timestamp: c.timestamp ?? undefined, sourceUrl: c.sourceUrl ?? undefined }));
    } else if (resource.visibility === "PRIVATE" && words.length) {
      const rows = await db.$queryRaw<(IndexedChunk & { page: number | null; timestamp: number | null; sourceUrl: string | null })[]>(Prisma.sql`
        SELECT c."ordinal", c."heading", c."text", c."page", c."timestamp", c."sourceUrl"
        FROM "ResourceChunk" c JOIN "StudyResource" r ON r."id" = c."resourceId"
        WHERE r."id" = ${resource.id} AND r."ownerUserId" = ${userId} AND r."visibility" = 'PRIVATE' AND r."deletedAt" IS NULL
        AND to_tsvector('simple', c."text") @@ plainto_tsquery('simple', ${words.join(" ")}) LIMIT 12`);
      chunks = rows.map(c => ({ ...c, page: c.page ?? undefined, timestamp: c.timestamp ?? undefined, sourceUrl: c.sourceUrl ?? undefined }));
      if (!chunks.length && resourceIds?.includes(resource.id)) chunks = await resourceChunks(resource, 0, 6);
    } else chunks = await resourceChunks(resource, 0, 80);
    return chunks.filter(chunk => query.pageStart === undefined || chunk.page !== undefined && chunk.page >= query.pageStart && chunk.page <= (query.pageEnd ?? query.pageStart)).map(chunk => ({ resource, chunk, score: lexicalScore(`${chunk.heading} ${chunk.text}`, query.q ?? "") }));
  }));
  let size = 0;
  return groups.flat().filter(r => resourceIds?.length || r.score > .15).sort((a, b) => query.pageStart !== undefined ? (a.chunk.page ?? 0) - (b.chunk.page ?? 0) || a.chunk.ordinal - b.chunk.ordinal : b.score - a.score).slice(0, query.pageStart !== undefined ? 25 : 6).flatMap(({ resource, chunk }, i) => {
    const text = chunk.text.slice(0, Math.min(2400, (query.pageStart !== undefined ? 40_000 : 12_000) - size)); size += text.length;
    return text ? [{ citation: citationFor(resource, chunk, `S${i + 1}`), text }] : [];
  });
}
