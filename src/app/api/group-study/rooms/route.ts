import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { isBetaAllowed } from "@/lib/auth/beta";
import {
  GroupStudyError,
  groupStudyErrorResponse,
  assertRoomMutationRequest,
  generateRoomCode,
} from "@/lib/group-study/server";
import { createRoomSchema, ROOM_LIFETIME_MS } from "@/lib/group-study/policy";
import type { GroupStudyOverview, RoomStatus } from "@/lib/group-study/types";
import { resolveUserEntitlements, hasEntitlement } from "@/lib/subscriptions/entitlements";

export const runtime = "nodejs";
export const maxDuration = 30;

const SAFE_RECENT_STATUSES: RoomStatus[] = [
  "waiting",
  "active",
  "paused",
  "ended",
];

/** Retry the unique code insert on the (astronomically unlikely) collision. */
async function createRoomForHost(
  host: { id: string; name: string | null },
  input: z.infer<typeof createRoomSchema>,
) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ROOM_LIFETIME_MS);
      return await db.groupStudyRoom.create({
        data: {
          code: generateRoomCode(),
          hostUserId: host.id,
          name: input.name,
          subject: input.subject,
          topic: input.topic,
          maxParticipants: input.maxParticipants,
          expiresAt,
          lastActivityAt: now,
          updatedAt: now,
          // Atomic nested writes: every successful room has its host identity.
          participants: {
            create: {
              displayName: (host.name || "Scholar Host").slice(0, 40),
              role: "host",
              status: "approved",
              expiresAt,
              approvedAt: now,
            },
          },
          events: { create: { type: "room_created" } },
        },
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "P2002" || attempt === 3) throw error;
    }
  }
  throw new GroupStudyError(
    "Could not allocate a room code. Try again.",
    503,
    "CODE_ALLOCATION_FAILED",
  );
}

export async function GET() {
  try {
    const user = await getSessionUser();
    const canHost = Boolean(user && (await isBetaAllowed(user)) && hasEntitlement(await resolveUserEntitlements(user.id), "group_study_beta"));
    if (user && canHost) {
      const rooms = await db.groupStudyRoom.findMany({
        where: { hostUserId: user.id },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          name: true,
          subject: true,
          topic: true,
          status: true,
          createdAt: true,
          startedAt: true,
          endedAt: true,
          expiresAt: true,
        },
      });
      const active = rooms.find(
        (room) =>
          room.status !== "ended" && room.expiresAt.getTime() > Date.now(),
      );
      const overview = {
        canHost: true,
        ...(active ? { roomId: active.id } : {}),
        rooms: rooms.map((room) => ({
          id: room.id,
          name: room.name,
          subject: room.subject,
          topic: room.topic,
          status: (SAFE_RECENT_STATUSES.includes(room.status as RoomStatus)
            ? room.status
            : "ended") as RoomStatus,
          createdAt: room.createdAt.toISOString(),
          startedAt: room.startedAt?.toISOString() ?? null,
          endedAt: room.endedAt?.toISOString() ?? null,
        })),
      };
      return NextResponse.json(overview, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    // Not signed in (or not allowlisted): plain join entry, nothing else.
    const joiner: GroupStudyOverview = { canHost: false, recentRooms: [] };
    return NextResponse.json({ ...joiner, signedIn: Boolean(user), hostReason: user ? "plus_required" : "sign_in_required" }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return groupStudyErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertRoomMutationRequest(request);
    const user = await getSessionUser();
    const access = user ? await resolveUserEntitlements(user.id) : null;
    if (!user || !(await isBetaAllowed(user)) || !access || !hasEntitlement(access, "group_study_beta")) {
      throw new GroupStudyError(
        "Group Study room creation is currently an early-access Scholar Plus feature. Invited participants can still join without an account.",
        403,
        "HOST_REQUIRED",
      );
    }
    const input = createRoomSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!input.success)
      throw new GroupStudyError(
        "Enter a room name of 2–80 characters.",
        400,
        "VALIDATION_ERROR",
      );
    await db.securityAttempt.create({
      data: { key: `group-create:${user.id}`, action: "group-create" },
    });
    const room = await createRoomForHost(user, input.data);
    return NextResponse.json(
      { ok: true, roomId: room.id, name: room.name, code: room.code },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return groupStudyErrorResponse(error);
  }
}
