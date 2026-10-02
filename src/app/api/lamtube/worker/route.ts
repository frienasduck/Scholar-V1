import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { processVideo } from "@/lib/lamtube/generate";
import { reply } from "@/lib/lamtube/http";
export const runtime = "nodejs";
export const maxDuration = 60;
/** Optional external scheduler: one bounded persisted stage per invocation. */
export async function POST(request: Request) {
  const secret = process.env.LAMTUBE_WORKER_SECRET;
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (
    !secret ||
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return reply({ message: "Unauthorized" }, 401);
  try {
    const rows = await db.$queryRaw<
      { id: string; userId: string }[]
    >`SELECT "id","userId" FROM "AIVideo" WHERE "deletedAt" IS NULL AND "state"->>'status'='generating' AND ("leaseUntil" IS NULL OR "leaseUntil"<NOW()) ORDER BY "updatedAt" ASC LIMIT 1`;
    if (!rows[0]) return reply({ processed: false });
    await processVideo(rows[0].userId, rows[0].id);
    return reply({ processed: true });
  } catch {
    return reply(
      { message: "Worker stage stopped; persisted state retained." },
      503
    );
  }
}
