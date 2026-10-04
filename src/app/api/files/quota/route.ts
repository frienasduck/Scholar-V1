import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { resolveUserEntitlements } from "@/lib/subscriptions/entitlements";
import { db } from "@/lib/db";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { recordAudit } from "@/lib/subscriptions/audit";
import { readBoundedJson, RequestBodyError } from "@/lib/security/request-body";
import { privateStorageUsed } from "@/lib/ebooks/storage";

const createSchema = z.object({ clientId: z.string().min(4).max(100), name: z.string().min(1).max(255), mimeType: z.string().min(1).max(160), sizeBytes: z.number().int().positive().max(100 * 1024 * 1024) });
const deleteSchema = z.object({ clientId: z.string().min(4).max(100) });

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const access = await resolveUserEntitlements(user.id);
  return NextResponse.json({ usedBytes: await privateStorageUsed(db, user.id), limitBytes: access.storageLimitBytes });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  try {
    await enforceRateLimit(user.id, "file-upload", 60, 60 * 60 * 1000);
    const parsed = createSchema.safeParse(await readBoundedJson(request, 8 * 1024));
    if (!parsed.success) return NextResponse.json({ error: "Invalid file metadata." }, { status: 400 });
    const access = await resolveUserEntitlements(user.id);
    const result = await db.$transaction(async (tx) => {
      // Serialize quota calculations for this account. Distinct client IDs can
      // otherwise race through the aggregate check and exceed the plan limit.
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE
      `;
      if (!locked[0]) throw new Error("AUTH_REQUIRED");
      const existing = await tx.storedFile.findUnique({ where: { userId_clientId: { userId: user.id, clientId: parsed.data.clientId } } });
      if (existing && !existing.deletedAt) return { usedBytes: 0, duplicate: true };
      const usedBytes = await privateStorageUsed(tx, user.id);
      if (usedBytes + parsed.data.sizeBytes > access.storageLimitBytes) throw new Error("STORAGE_LIMIT_REACHED");
      await tx.storedFile.upsert({
        where: { userId_clientId: { userId: user.id, clientId: parsed.data.clientId } },
        create: { userId: user.id, ...parsed.data },
        update: { ...parsed.data, deletedAt: null },
      });
      return { usedBytes: usedBytes + parsed.data.sizeBytes, duplicate: false };
    });
    return NextResponse.json({ ok: true, ...result, limitBytes: access.storageLimitBytes });
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    if (error instanceof RateLimitError) return NextResponse.json({ error: error.message }, { status: 429 });
    if (error instanceof Error && error.message === "STORAGE_LIMIT_REACHED") {
      await recordAudit("STORAGE_LIMIT_REJECTED", { actorUserId: user.id, targetUserId: user.id });
      return NextResponse.json({ error: "STORAGE_LIMIT_REACHED", message: "Your Free plan includes 30 MB of file storage. Upgrade to Scholar Plus for expanded storage." }, { status: 413 });
    }
    return NextResponse.json({ error: "File quota could not be reserved." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  let raw: unknown;
  try {
    raw = await readBoundedJson(request, 2 * 1024);
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    return NextResponse.json({ error: "Invalid file." }, { status: 400 });
  }
  const parsed = deleteSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid file." }, { status: 400 });
  await db.storedFile.updateMany({ where: { userId: user.id, clientId: parsed.data.clientId, deletedAt: null }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
