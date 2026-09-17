import { getRoomPrincipal, withRoomTransaction, assertRoomMutationRequest, GroupStudyError, groupStudyErrorResponse } from "@/lib/group-study/server";
import { parseStudyUpload, StudyUploadError, MAX_STUDY_FILE_BYTES, MAX_ROOM_FILE_BYTES } from "@/lib/group-study/uploads";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    assertRoomMutationRequest(request);
    const { roomId } = await params;
    const principal = await getRoomPrincipal(roomId);
    const check = () => withRoomTransaction(roomId, principal, async (_tx, fresh, room) => {
      if (!room.pdfEnabled || (fresh.role !== "host" && !room.participantUploads)) throw new GroupStudyError("The host has not enabled material uploads for you.", 403);
    });
    await check();
    if (Number(request.headers.get("content-length")) > MAX_STUDY_FILE_BYTES + 32_768) throw new StudyUploadError("Choose a file up to 3 MB.");
    const data = await request.formData();
    const file = data.get("file");
    if (!(file instanceof File) || file.size > MAX_STUDY_FILE_BYTES) throw new StudyUploadError("Choose a PDF, PNG, JPEG or text file up to 3 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = await parseStudyUpload(bytes);
    const savedBytes = "sanitized" in parsed && parsed.sanitized ? new Uint8Array(parsed.sanitized) : bytes;
    const name = file.name.replace(/[\x00-\x1f\x7f<>/\\]/g, "").slice(0, 180) || "Study material";
    const resource = await withRoomTransaction(roomId, principal, async (tx, fresh, room) => {
      if (!room.pdfEnabled || (fresh.role !== "host" && !room.participantUploads)) throw new GroupStudyError("Material uploads were paused by the host.", 403);
      const sum = await tx.groupStudyResource.aggregate({ where: { roomId }, _sum: { sizeBytes: true }, _count: true });
      if (sum._count >= 20 || (sum._sum.sizeBytes ?? 0) + savedBytes.byteLength > MAX_ROOM_FILE_BYTES) throw new GroupStudyError("This room has reached its temporary material limit (20 files / 30 MB). Remove a material first.", 413);
      const attempts = await tx.securityAttempt.count({ where: { key: `group-upload:${fresh.id}`, action: "group-upload", createdAt: { gte: new Date(Date.now() - 3_600_000) } } });
      if (attempts >= 20) throw new GroupStudyError("Too many material uploads. Try again later.", 429);
      await tx.securityAttempt.create({ data: { key: `group-upload:${fresh.id}`, action: "group-upload" } });
      const resource = await tx.groupStudyResource.create({ data: { roomId, uploadedById: fresh.id, name, mimeType: parsed.mimeType, sizeBytes: savedBytes.byteLength, pageCount: parsed.pageCount, bytes: savedBytes, text: parsed.text, pageTexts: parsed.pageTexts }, select: { id: true, name: true, mimeType: true, sizeBytes: true, pageCount: true } });
      await tx.groupStudyRoom.update({ where: { id: roomId }, data: { revision: { increment: 1 }, lastActivityAt: new Date() } });
      await tx.groupStudyEvent.create({ data: { roomId, participantId: fresh.id, type: "resource_added" } });
      return resource;
    });
    return Response.json({ ok: true, resource }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof StudyUploadError) return Response.json({ message: error.message }, { status: 422 });
    return groupStudyErrorResponse(error);
  }
}
