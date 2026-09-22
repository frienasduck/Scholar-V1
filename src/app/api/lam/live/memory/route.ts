import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { memoryFingerprint } from "@/lib/live-tutor/memory";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const memorySchema = z.object({
  kind: z.enum(["learning", "preference", "progress", "task", "user_confirmed"]),
  content: z.string().trim().min(3).max(1_000),
  subject: z.string().trim().max(100).optional(),
  topic: z.string().trim().max(180).optional(),
}).strict();

const patchSchema = z.object({
  id: z.string().min(1).max(160),
  enabled: z.boolean().optional(),
  content: z.string().trim().min(3).max(1_000).optional(),
}).strict().refine((value) => value.enabled !== undefined || value.content !== undefined);

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  const now = new Date();
  const [memories, weakTopics, unresolvedMistakes, dueRevision] = await Promise.all([
    db.liveTutorMemory.findMany({ where: { userId: user.id, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, orderBy: [{ enabled: "desc" }, { importance: "desc" }, { updatedAt: "desc" }], take: 100 }),
    db.masteryRecord.findMany({ where: { userId: user.id, score: { lt: 0.55 } }, orderBy: { score: "asc" }, take: 5, select: { subject: true, chapter: true, topic: true, score: true, evidenceCount: true } }),
    db.mistakeRecord.count({ where: { userId: user.id, resolved: false } }),
    db.revisionItem.count({ where: { userId: user.id, dueAt: { lte: now }, state: { not: "MATURE" } } }),
  ]);
  return NextResponse.json({ ok: true, memories, summary: { relevantMemories: memories.filter((item) => item.enabled).length, weakTopics, unresolvedMistakes, dueRevision } });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  try { await enforceRateLimit(user.id, "live-tutor-memory-write", 30, 60_000); }
  catch (error) { return NextResponse.json({ ok: false, error: error instanceof RateLimitError ? "Too many memory changes. Please wait and retry." : "Memory protection is temporarily unavailable." }, { status: error instanceof RateLimitError ? 429 : 503 }); }
  const parsed = memorySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid memory." }, { status: 400 });
  const input = parsed.data;
  const fingerprint = memoryFingerprint(input.kind, input.content);
  const memory = await db.liveTutorMemory.upsert({
    where: { userId_fingerprint: { userId: user.id, fingerprint } },
    update: { ...input, enabled: true, confidence: 1, importance: input.kind === "user_confirmed" ? 90 : 70 },
    create: { userId: user.id, fingerprint, ...input, sourceType: "explicit", confidence: 1, importance: input.kind === "user_confirmed" ? 90 : 70 },
  });
  return NextResponse.json({ ok: true, memory }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  try { await enforceRateLimit(user.id, "live-tutor-memory-write", 30, 60_000); }
  catch (error) { return NextResponse.json({ ok: false, error: error instanceof RateLimitError ? "Too many memory changes. Please wait and retry." : "Memory protection is temporarily unavailable." }, { status: error instanceof RateLimitError ? 429 : 503 }); }
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid memory update." }, { status: 400 });
  const existing = await db.liveTutorMemory.findFirst({ where: { id: parsed.data.id, userId: user.id } });
  if (!existing) return NextResponse.json({ ok: false, error: "Memory not found." }, { status: 404 });
  const memory = await db.liveTutorMemory.update({
    where: { id: existing.id },
    data: {
      enabled: parsed.data.enabled,
      content: parsed.data.content,
      fingerprint: parsed.data.content ? memoryFingerprint(existing.kind, parsed.data.content) : undefined,
    },
  });
  return NextResponse.json({ ok: true, memory });
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  try { await enforceRateLimit(user.id, "live-tutor-memory-write", 30, 60_000); }
  catch (error) { return NextResponse.json({ ok: false, error: error instanceof RateLimitError ? "Too many memory changes. Please wait and retry." : "Memory protection is temporarily unavailable." }, { status: error instanceof RateLimitError ? 429 : 503 }); }
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ ok: false, error: "Memory id is required." }, { status: 400 });
  const deleted = await db.liveTutorMemory.deleteMany({ where: { id, userId: user.id } });
  if (!deleted.count) return NextResponse.json({ ok: false, error: "Memory not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
