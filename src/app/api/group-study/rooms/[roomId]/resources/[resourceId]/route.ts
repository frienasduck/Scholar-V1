import { getRoomPrincipal, withRoomTransaction, GroupStudyError, groupStudyErrorResponse } from "@/lib/group-study/server";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ roomId: string; resourceId: string }> }) {
  try {
    const { roomId, resourceId } = await params;
    const principal = await getRoomPrincipal(roomId);
    const resource = await withRoomTransaction(roomId, principal, async (tx, _fresh, room) => {
      if (!room.pdfEnabled) throw new GroupStudyError("Shared materials are paused by the host.", 403);
      const resource = await tx.groupStudyResource.findFirst({ where: { id: resourceId, roomId } });
      if (!resource) throw new GroupStudyError("This material is no longer available.", 404);
      return resource;
    });
    return new Response(new Uint8Array(resource.bytes), { headers: {
      "Content-Type": resource.mimeType,
      "Content-Length": String(resource.sizeBytes),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(resource.name)}`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox; frame-ancestors 'self'",
      "Cross-Origin-Resource-Policy": "same-origin",
    } });
  } catch (error) { return groupStudyErrorResponse(error); }
}
