import { NextResponse } from "next/server";
import { getRoomPrincipal, getRoomSnapshot, withRoomTransaction, groupStudyErrorResponse, GroupStudyError, assertRoomMutationRequest } from "@/lib/group-study/server";
import { canPerformAction } from "@/lib/group-study/policy";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(_request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params;
    return NextResponse.json(await getRoomSnapshot(roomId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return groupStudyErrorResponse(error);
  }
}

/** Explicit "leave room" action for participants (hosts must use end instead). */
export async function DELETE(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    assertRoomMutationRequest(request);
    const { roomId } = await params;
    const principal = await getRoomPrincipal(roomId);
    if (principal.role === "host") throw new GroupStudyError("Use End room to close your study session.", 409, "HOST_MUST_END_ROOM");
    await withRoomTransaction(roomId, principal, async (tx, me) => {
      if (!canPerformAction(me.role, me.member.status, "leave")) throw new GroupStudyError("You cannot leave in your current state.", 409, "INVALID_STATE");
      await tx.groupStudyParticipant.update({ where: { id: me.id }, data: { status: "left", removedAt: new Date(), tokenHash: null } });
    });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return groupStudyErrorResponse(error);
  }
}
