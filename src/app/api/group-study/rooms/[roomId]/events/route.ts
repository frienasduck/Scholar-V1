import { NextResponse } from "next/server";
import { assertRoomMutationRequest, getRoomPrincipal, groupStudyErrorResponse, performRoomAction } from "@/lib/group-study/server";
export const runtime = "nodejs";
export const maxDuration = 30;
/** V2 uses short conditional requests, not a bounded serverless stream. */
export async function GET() {
  return NextResponse.json({ ok: false, code: "TRANSPORT_RETIRED", message: "Please refresh Scholar to use the updated room connection." }, { status: 410, headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    assertRoomMutationRequest(request);
    const { roomId } = await params;
    await performRoomAction(roomId, await getRoomPrincipal(roomId, { allowPending: true }), { action: "heartbeat" });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return groupStudyErrorResponse(error); }
}
