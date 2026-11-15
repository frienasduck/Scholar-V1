import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";
const HEADERS = { "Cache-Control": "private, no-store" };

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: HEADERS });
  }

  const rows = await db.customEbook.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
      allocation: "lam-pdf",
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      id: true,
      title: true,
      originalFileName: true,
      sizeBytes: true,
      pageCount: true,
      processingStatus: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ ok: true, docs: rows }, { headers: HEADERS });
}
