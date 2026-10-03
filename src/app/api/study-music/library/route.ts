import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { assertAuthMutation } from "@/lib/auth/request-security";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { readBoundedJson, RequestBodyError } from "@/lib/security/request-body";
import { db } from "@/lib/db";
import { librarySchema, emptyLibrary } from "@/lib/study-music/model";
import { z } from "zod";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
type LibraryRow = { stateJson: string; revision: number };
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ message: "Sign in to sync your library." }, { status: 401, headers });
    const rows = await db.$queryRaw<LibraryRow[]>`SELECT "stateJson", "revision" FROM "StudyMusicLibrary" WHERE "userId" = ${user.id}`;
    return NextResponse.json({ library: rows[0] ? librarySchema.parse(JSON.parse(rows[0].stateJson)) : emptyLibrary(), revision: rows[0]?.revision ?? 0 }, { headers });
  } catch { return NextResponse.json({ message: "Cloud music storage is unavailable. Your device library is still safe." }, { status: 503, headers }); }
}
export async function PUT(request: Request) {
  try {
    assertAuthMutation(request);
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ message: "Sign in to sync your library." }, { status: 401, headers });
    await enforceRateLimit(user.id, "music-library", 60, 60_000);
    const data = z.object({ revision: z.number().int().nonnegative(), library: librarySchema }).parse(await readBoundedJson(request, 512 * 1024));
    const json = JSON.stringify(data.library);
    const updated = await db.$transaction(async tx => {
      await tx.$executeRaw`INSERT INTO "StudyMusicLibrary" ("userId", "stateJson", "revision", "updatedAt") VALUES (${user.id}, ${JSON.stringify(emptyLibrary())}, 0, CURRENT_TIMESTAMP) ON CONFLICT ("userId") DO NOTHING`;
      return tx.$executeRaw`UPDATE "StudyMusicLibrary" SET "stateJson" = ${json}, "revision" = "revision" + 1, "updatedAt" = CURRENT_TIMESTAMP WHERE "userId" = ${user.id} AND "revision" = ${data.revision}`;
    });
    if (!updated) return NextResponse.json({ message: "Your library changed on another device. Reload cloud library before syncing again." }, { status: 409, headers });
    return NextResponse.json({ revision: data.revision + 1 }, { headers });
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : error instanceof RateLimitError ? 429 : error instanceof z.ZodError ? 400 : 503;
    return NextResponse.json({ message: status === 400 ? "Invalid music library." : "Cloud sync is unavailable. Your device library is still safe." }, { status, headers });
  }
}
