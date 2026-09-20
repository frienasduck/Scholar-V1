import { db } from "@/lib/db";
import {
  assertFeatureAccess,
  getRoomPrincipal,
  groupStudyErrorResponse,
  GroupStudyError,
} from "@/lib/group-study/server";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const principal = await getRoomPrincipal(roomId);
    assertFeatureAccess(principal.room, principal.role, "chat");
    const before = new URL(request.url).searchParams.get("before");
    const after = new URL(request.url).searchParams.get("after");
    if (
      (before && before.length > 80) ||
      (after && after.length > 80) ||
      (before && after)
    )
      throw new GroupStudyError(
        "Choose a valid message cursor.",
        400,
        "INVALID_CURSOR",
      );
    const cursorId = before ?? after;
    const cursor = cursorId
      ? await db.groupStudyMessage.findFirst({
          where: { id: cursorId, roomId },
          select: { id: true, createdAt: true },
        })
      : null;
    if (cursorId && !cursor)
      throw new GroupStudyError(
        "That message is no longer available.",
        404,
        "MESSAGE_NOT_FOUND",
      );
    const where = cursor
      ? {
          roomId,
          OR: before
            ? [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ]
            : [
                { createdAt: { gt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { gt: cursor.id } },
              ],
        }
      : { roomId };
    const rows = await db.groupStudyMessage.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: before ? 50 : 60,
      include: { participant: { select: { displayName: true, role: true } } },
    });
    return Response.json(
      {
        messages: rows.reverse().map((m) => ({
          id: m.id,
          authorId: m.participantId ?? undefined,
          authorRole: m.participant?.role,
          author:
            m.participant?.displayName ??
            (m.kind === "ai" ? "Group LAM" : "Scholar"),
          kind: m.kind,
          body: m.body,
          createdAt: m.createdAt.toISOString(),
        })),
        hasMore: rows.length === 50,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return groupStudyErrorResponse(error);
  }
}
