import { NextResponse } from "next/server";
import { assertRoomMutationRequest, getRoomPrincipal, getRoomSnapshot, groupStudyErrorResponse, performRoomAction } from "@/lib/group-study/server";
import { groupActionSchema } from "@/lib/group-study/policy";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    assertRoomMutationRequest(request);
    const input = groupActionSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) throw Object.assign(new Error("That action is not available here."), { status: 400, code: "VALIDATION_ERROR" });
    const { roomId } = await params;
    const principal = await getRoomPrincipal(roomId);
    await performRoomAction(roomId, principal, input.data);
    return NextResponse.json({ ok: true, snapshot: await getRoomSnapshot(roomId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return groupStudyErrorResponse(error);
  }
}
