import "server-only";

import { createHash } from "node:crypto";
import { db } from "@/lib/db";

const words = (value: string) => new Set(value.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);

export function memoryFingerprint(kind: string, content: string) {
  return createHash("sha256").update(`${kind}:${content.trim().toLowerCase().replace(/\s+/g, " ")}`).digest("hex");
}

export async function loadLiveTutorMemoryContext(input: {
  userId: string;
  query: string;
  subject?: string;
  chapter?: string;
}) {
  const now = new Date();
  const [memories, mastery, mistakes, revision] = await Promise.all([
    db.liveTutorMemory.findMany({
      where: { userId: input.userId, enabled: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
      take: 40,
    }),
    db.masteryRecord.findMany({ where: { userId: input.userId }, orderBy: [{ score: "asc" }, { updatedAt: "desc" }], take: 4 }),
    db.mistakeRecord.findMany({ where: { userId: input.userId, resolved: false }, orderBy: { occurredAt: "desc" }, take: 4 }),
    db.revisionItem.findMany({ where: { userId: input.userId, dueAt: { lte: now }, state: { not: "MATURE" } }, orderBy: [{ priority: "desc" }, { dueAt: "asc" }], take: 4 }),
  ]);

  const queryWords = words(`${input.query} ${input.subject ?? ""} ${input.chapter ?? ""}`);
  const ranked = memories.map((memory) => {
    const candidate = words(`${memory.content} ${memory.subject ?? ""} ${memory.topic ?? ""}`);
    let overlap = 0;
    for (const word of queryWords) if (candidate.has(word)) overlap += 1;
    const contextual = [memory.subject, memory.topic].some((value) => value && `${input.subject ?? ""} ${input.chapter ?? ""}`.toLowerCase().includes(value.toLowerCase())) ? 4 : 0;
    return { memory, score: overlap * 3 + contextual + memory.importance / 25 };
  }).sort((a, b) => b.score - a.score).slice(0, 8).map(({ memory }) => memory);

  if (ranked.length) {
    void db.liveTutorMemory.updateMany({ where: { userId: input.userId, id: { in: ranked.map((memory) => memory.id) } }, data: { lastUsedAt: now } }).catch(() => undefined);
  }

  const sections = [
    ranked.length ? `Relevant learning memory:\n${ranked.map((memory) => `- [${memory.kind}] ${memory.content}`).join("\n")}` : "No durable Live Tutor memory matched this turn.",
    mastery.length ? `Lowest current mastery signals:\n${mastery.map((item) => `- ${item.topic || item.chapter || item.subject}: ${Math.round(item.score * 100)}% (${item.evidenceCount} evidence item${item.evidenceCount === 1 ? "" : "s"})`).join("\n")}` : "No mastery signals are available.",
    mistakes.length ? `Recent unresolved mistakes:\n${mistakes.map((item) => `- ${item.subject}${item.topic ? ` · ${item.topic}` : ""}: ${item.mistakeType}`).join("\n")}` : "No unresolved mistake records are available.",
    revision.length ? `Due revision:\n${revision.map((item) => `- ${item.subject}${item.topic ? ` · ${item.topic}` : ""}: ${item.title}`).join("\n")}` : "No revision items are currently due.",
  ];

  return {
    text: sections.join("\n\n"),
    selectedMemoryIds: ranked.map((memory) => memory.id),
    summary: {
      memories: memories.length,
      relevantMemories: ranked.length,
      weakTopics: mastery.map((item) => item.topic || item.chapter || item.subject),
      unresolvedMistakes: mistakes.length,
      dueRevision: revision.length,
    },
  };
}
