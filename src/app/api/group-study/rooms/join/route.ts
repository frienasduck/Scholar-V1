import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { isBetaAllowed } from "@/lib/auth/beta";
import {
  GroupStudyError,
  groupStudyErrorResponse,
  assertRoomMutationRequest,
  groupStudyIpKey,
  setParticipantCookie,
  createParticipantToken,
  getRoomPrincipal,
  withRoomTransaction,
  withLockedRoom,
  assertRoomOpen,
} from "@/lib/group-study/server";
import {
  joinRoomSchema,
  normalizeRoomCode,
  displayNameSchema,
} from "@/lib/group-study/policy";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { readBoundedJson } from "@/lib/security/request-body";

export const runtime = "nodejs";
export const maxDuration = 30;

const GENERIC_JOIN_FAILURE =
  "That study room couldn't be found or is unavailable.";

export async function POST(request: Request) {
  try {
    assertRoomMutationRequest(request);
    const input = joinRoomSchema.safeParse(
      await readBoundedJson(request, 8 * 1024),
    );
    if (!input.success)
      throw new GroupStudyError(
        "Enter your name and a study code.",
        400,
        "VALIDATION_ERROR",
      );
    const code = normalizeRoomCode(input.data.code);
    if (!/^SCH[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(code)) {
      throw new GroupStudyError(GENERIC_JOIN_FAILURE, 404, "ROOM_NOT_FOUND");
    }
    // One atomic limiter: code guessing and join floods share the same budget.
    // The previous insert-then-count sequence allowed concurrent requests to
    // race past the ceiling.
    await enforceRateLimit(
      `group-join:${groupStudyIpKey(request)}`,
      "group-join",
      30,
      15 * 60_000,
    );

    const room = await db.groupStudyRoom.findUnique({ where: { code } });
    // Identical response and timing profile whether the code is unknown, the
    // room expired, or the room already ended — never reveal which one it was.
    if (
      !room ||
      room.expiresAt.getTime() <= Date.now() ||
      room.status === "ended"
    ) {
      throw new GroupStudyError(GENERIC_JOIN_FAILURE, 404, "ROOM_NOT_FOUND");
    }

    const user = await getSessionUser();
    if (user && user.id === room.hostUserId && (await isBetaAllowed(user))) {
      // The authorized host opening their own room code re-enters as host.
      const principal = await getRoomPrincipal(room.id);
      await withRoomTransaction(room.id, principal, async (tx) => {
        await tx.groupStudyRoom.update({
          where: { id: room.id },
          data: { lastActivityAt: new Date() },
        });
      });
      return NextResponse.json(
        { ok: true, roomId: room.id, role: "host", status: "approved" },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const displayName = displayNameSchema.safeParse(input.data.displayName);
    if (!displayName.success)
      throw new GroupStudyError(
        "Display names are 2–40 characters with no control characters.",
        400,
        "VALIDATION_ERROR",
      );

    const { token, tokenHash } = createParticipantToken();
    const created = await withLockedRoom(room.id, async (tx, freshRoom) => {
      assertRoomOpen(freshRoom);
      if (freshRoom.locked)
        throw new GroupStudyError(GENERIC_JOIN_FAILURE, 404, "ROOM_NOT_FOUND");
      const count = await tx.groupStudyParticipant.count({
        where: { roomId: room.id, status: { in: ["pending", "approved"] } },
      });
      if (count >= freshRoom.maxParticipants)
        throw new GroupStudyError(
          "This study room is full. Ask your host before trying again.",
          409,
          "ROOM_FULL",
        );
      const member = await tx.groupStudyParticipant.create({
        data: {
          roomId: room.id,
          displayName: displayName.data,
          role: "participant",
          status: freshRoom.requireApproval ? "pending" : "approved",
          approvedAt: freshRoom.requireApproval ? null : new Date(),
          expiresAt: freshRoom.expiresAt,
          tokenHash,
        },
      });
      await tx.groupStudyEvent.create({
        data: {
          roomId: room.id,
          participantId: member.id,
          type: "participant_join_requested",
        },
      });
      await tx.groupStudyRoom.update({
        where: { id: room.id },
        data: { revision: { increment: 1 }, lastActivityAt: new Date() },
      });
      return member;
    });
    await setParticipantCookie(room, token);
    return NextResponse.json(
      {
        ok: true,
        roomId: room.id,
        role: "participant",
        status: created.status,
      },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return groupStudyErrorResponse(error);
  }
}
