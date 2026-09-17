import { NextResponse } from "next/server";
import { assertRoomMutationRequest, getRoomPrincipal, getRoomSnapshot, groupStudyErrorResponse, performRoomAction, GroupStudyError } from "@/lib/group-study/server";
import { groupActionSchema } from "@/lib/group-study/policy";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    assertRoomMutationRequest(request);
    const input = groupActionSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) throw new GroupStudyError("That action is not available here.", 400, "VALIDATION_ERROR");
    const { roomId } = await params;
    const principal = await getRoomPrincipal(roomId, { allowPending: ["heartbeat", "leave"].includes(input.data.action) });
    await performRoomAction(roomId, principal, input.data);
    // End/leave revoke access. Reading a new protected snapshot here would
    // incorrectly report a successful mutation as a 410/403 failure.
    if (["end", "leave"].includes(input.data.action)) return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
    return NextResponse.json({ ok: true, snapshot: await getRoomSnapshot(roomId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return groupStudyErrorResponse(error);
  }
}
