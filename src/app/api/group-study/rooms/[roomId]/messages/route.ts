import { db } from "@/lib/db";
import { getRoomPrincipal, groupStudyErrorResponse, GroupStudyError } from "@/lib/group-study/server";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params;
    await getRoomPrincipal(roomId);
    const before = new URL(request.url).searchParams.get("before");
    if (!before || before.length > 80) throw new GroupStudyError("Choose a valid message cursor.", 400, "INVALID_CURSOR");
    const cursor = await db.groupStudyMessage.findFirst({ where: { id: before, roomId }, select: { id: true, createdAt: true } });
    if (!cursor) throw new GroupStudyError("That message is no longer available.", 404, "MESSAGE_NOT_FOUND");
    const rows = await db.groupStudyMessage.findMany({ where: { roomId, OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50, include: { participant: { select: { displayName: true, role: true } } } });
    return Response.json({ messages: rows.reverse().map(m => ({ id: m.id, authorId: m.participantId ?? undefined, authorRole: m.participant?.role, author: m.participant?.displayName ?? (m.kind === "ai" ? "Group LAM" : "Scholar"), kind: m.kind, body: m.body, createdAt: m.createdAt.toISOString() })), hasMore: rows.length === 50 }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return groupStudyErrorResponse(error); }
}
