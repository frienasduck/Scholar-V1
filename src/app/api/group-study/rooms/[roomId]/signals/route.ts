import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  assertRoomMutationRequest,
  getRoomPrincipal,
  groupStudyErrorResponse,
  GroupStudyError,
} from "@/lib/group-study/server";

export const runtime = "nodejs";
const signalSchema = z
  .object({
    targetId: z.string().min(1).max(80),
    kind: z.enum(["offer", "answer", "ice", "leave"]),
    payload: z.record(z.string(), z.unknown()),
  })
  .strict();
const MAX_SIGNAL_BYTES = 16_384;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params,
      principal = await getRoomPrincipal(roomId);
    if (!principal.room.voiceEnabled && !principal.room.cameraEnabled)
      throw new GroupStudyError(
        "Live media is disabled for this room.",
        403,
        "MEDIA_DISABLED",
      );
    const after = new URL(request.url).searchParams.get("after");
    const afterDate = after ? new Date(after) : new Date(Date.now() - 90_000);
    if (
      !Number.isFinite(afterDate.getTime()) ||
      afterDate.getTime() > Date.now() + 1000
    )
      throw new GroupStudyError(
        "Choose a valid signal cursor.",
        400,
        "INVALID_CURSOR",
      );
    const now = new Date();
    const [, signals] = await db.$transaction([
      db.groupStudySignal.deleteMany({ where: { expiresAt: { lt: now } } }),
      db.groupStudySignal.findMany({
        where: {
          roomId,
          targetId: principal.id,
          createdAt: { gt: afterDate },
          expiresAt: { gt: now },
        },
        orderBy: { createdAt: "asc" },
        take: 100,
        select: {
          id: true,
          senderId: true,
          kind: true,
          payload: true,
          createdAt: true,
        },
      }),
    ]);
    return Response.json(
      {
        signals: signals.map((signal) => ({
          ...signal,
          createdAt: signal.createdAt.toISOString(),
        })),
        serverTime: now.toISOString(),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return groupStudyErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    assertRoomMutationRequest(request);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_SIGNAL_BYTES)
      throw new GroupStudyError(
        "That media signal is too large.",
        413,
        "SIGNAL_TOO_LARGE",
      );
    const input = signalSchema.safeParse(JSON.parse(raw));
    if (!input.success)
      throw new GroupStudyError(
        "That media signal is invalid.",
        400,
        "INVALID_SIGNAL",
      );
    const { roomId } = await params,
      principal = await getRoomPrincipal(roomId);
    if (!principal.room.voiceEnabled && !principal.room.cameraEnabled)
      throw new GroupStudyError(
        "Live media is disabled for this room.",
        403,
        "MEDIA_DISABLED",
      );
    if (
      !principal.member.voiceAllowed ||
      !principal.member.voiceJoined ||
      input.data.targetId === principal.id
    )
      throw new GroupStudyError(
        "That media connection is not allowed.",
        403,
        "MEDIA_NOT_ALLOWED",
      );
    const target = await db.groupStudyParticipant.findFirst({
      where: {
        id: input.data.targetId,
        roomId,
        status: "approved",
        voiceAllowed: true,
        voiceJoined: true,
      },
      select: { id: true },
    });
    if (!target)
      throw new GroupStudyError(
        "That room member is unavailable.",
        404,
        "PEER_NOT_FOUND",
      );
    const key = `group-signal:${principal.id}`,
      since = new Date(Date.now() - 60_000);
    const recent = await db.securityAttempt.count({
      where: { key, action: "group-signal", createdAt: { gte: since } },
    });
    if (recent >= 180)
      throw new GroupStudyError(
        "Media signaling is moving too quickly. Please reconnect.",
        429,
        "RATE_LIMITED",
      );
    await db.$transaction([
      db.securityAttempt.create({ data: { key, action: "group-signal" } }),
      db.groupStudySignal.create({
        data: {
          roomId,
          senderId: principal.id,
          targetId: target.id,
          kind: input.data.kind,
          payload: input.data.payload as Prisma.InputJsonObject,
          expiresAt: new Date(Date.now() + 90_000),
        },
      }),
    ]);
    return Response.json(
      { ok: true },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return groupStudyErrorResponse(error);
  }
}
