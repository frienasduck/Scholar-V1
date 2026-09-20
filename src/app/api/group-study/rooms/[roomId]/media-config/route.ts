import {
  getRoomPrincipal,
  groupStudyErrorResponse,
} from "@/lib/group-study/server";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    await getRoomPrincipal(roomId);
    let iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
    if (process.env.GROUP_STUDY_ICE_SERVERS_JSON) {
      const parsed = JSON.parse(process.env.GROUP_STUDY_ICE_SERVERS_JSON);
      if (Array.isArray(parsed) && parsed.length <= 5) iceServers = parsed;
    }
    return Response.json(
      { iceServers, mediaParticipantLimit: 6, videoPublisherLimit: 4 },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch (error) {
    return groupStudyErrorResponse(error);
  }
}
