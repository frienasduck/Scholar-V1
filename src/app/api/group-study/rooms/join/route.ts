import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { isBetaAllowed } from "@/lib/auth/beta";
import {
  GroupStudyError, groupStudyErrorResponse, assertRoomMutationRequest,
  groupStudyIpKey, setParticipantCookie, createParticipantToken, hashParticipantToken,
} from "@/lib/group-study/server";
import { joinRoomSchema, normalizeRoomCode, displayNameSchema } from "@/lib/group-study/policy";

export const runtime = "nodejs";
export const maxDuration = 30;

const GENERIC_JOIN_FAILURE = "That study room couldn't be found or is unavailable.";

export async function POST(request: Request) {
  try {
    assertRoomMutationRequest(request);
    const input = joinRoomSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) throw new GroupStudyError("Enter your name and a study code.", 400, "VALIDATION_ERROR");
    const code = normalizeRoomCode(input.data.code);
    if (!/^SCH[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(code)) {
      throw new GroupStudyError(GENERIC_JOIN_FAILURE, 404, "ROOM_NOT_FOUND");
    }
    // One combined limiter: code guessing and join floods share the same budget.
    await db.securityAttempt.create({ data: { key: `group-join:${groupStudyIpKey(request)}`, action: "group-join" } });
    const recent = await db.securityAttempt.count({
      where: { key: `group-join:${groupStudyIpKey(request)}`, action: "group-join", createdAt: { gte: new Date(Date.now() - 15 * 60_000) } },
    });
    if (recent > 30) throw new GroupStudyError("Too many join attempts. Wait a few minutes and try again.", 429, "JOIN_RATE_LIMITED");

    const room = await db.groupStudyRoom.findUnique({ where: { code } });
    // Identical response and timing profile whether the code is unknown, the
    // room expired, or the room already ended — never reveal which one it was.
    if (!room || room.expiresAt.getTime() <= Date.now() || room.status === "ended") {
      throw new GroupStudyError(GENERIC_JOIN_FAILURE, 404, "ROOM_NOT_FOUND");
    }

    const user = await getSessionUser();
    if (user && user.id === room.hostUserId && isBetaAllowed(user)) {
      // The authorized host opening their own room code re-enters as host.
      const hostMember = await db.groupStudyParticipant.findFirst({ where: { roomId: room.id, role: "host" } });
      if (hostMember) {
        await db.groupStudyParticipant.update({ where: { id: hostMember.id }, data: { status: "approved", tokenHash: null } });
      } else {
        await db.groupStudyParticipant.create({
          data: { roomId: room.id, displayName: user.name || "Host", role: "host", status: "approved", approvedAt: new Date(), expiresAt: room.expiresAt },
        });
      }
      await db.groupStudyRoom.update({ where: { id: room.id }, data: { lastActivityAt: new Date() } });
      return NextResponse.json({ ok: true, roomId: room.id, role: "host", status: "approved" }, { headers: { "Cache-Control": "private, no-store" } });
    }

    const displayName = displayNameSchema.safeParse(input.data.displayName);
    if (!displayName.success) throw new GroupStudyError("Display names are 2–40 characters with no control characters.", 400, "VALIDATION_ERROR");

    const created = await db.groupStudyParticipant.create({
      data: {
        roomId: room.id,
        displayName: displayName.data,
        role: "participant",
        status: room.requireApproval ? "pending" : "approved",
        approvedAt: room.requireApproval ? null : new Date(),
        expiresAt: room.expiresAt,
      },
    });
    const { token } = createParticipantToken();
    await db.groupStudyParticipant.update({ where: { id: created.id }, data: { tokenHash: hashParticipantToken(token) } });
    await setParticipantCookie(room, token);
    await db.groupStudyEvent.create({ data: { roomId: room.id, participantId: created.id, type: "participant_join_requested" } });
    await db.groupStudyRoom.update({ where: { id: room.id }, data: { revision: { increment: 1 }, lastActivityAt: new Date() } });
    return NextResponse.json({ ok: true, roomId: room.id, role: "participant", status: created.status }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return groupStudyErrorResponse(error);
  }
}
