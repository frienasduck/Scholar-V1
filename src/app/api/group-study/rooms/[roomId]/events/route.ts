import { NextResponse } from "next/server";
import { getRoomSnapshot, getRoomPrincipal, groupStudyErrorResponse, withRoomTransaction, GroupStudyError } from "@/lib/group-study/server";
import { canPerformAction } from "@/lib/group-study/policy";

export const runtime = "nodejs";
export const maxDuration = 55;

/** Serverless-friendly SSE: bounded lifetime, snapshot diffs, no shared state. */
export async function GET(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params;
    const principal = await getRoomPrincipal(roomId, { allowPending: true });
    const encoder = new TextEncoder();
    let closed = false;
    let lastSignature: string | null = null;
    const abort = () => { closed = true; };
    request.signal.addEventListener("abort", abort);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          if (closed) return;
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        const push = async () => {
          if (closed) return;
          try {
            const snapshot = await getRoomSnapshot(roomId);
            if (closed) return;
            const pendingCount = snapshot.participants.filter((p) => p.status === "pending").length;
            const signature = [
              snapshot.revision, snapshot.room.status, snapshot.room.page, snapshot.room.activeResourceId,
              snapshot.room.announcement, snapshot.room.locked, snapshot.room.followHost,
              snapshot.participants.length, pendingCount,
              snapshot.participants.map((p) => `${p.id}:${p.status}:${p.online ? 1 : 0}:${p.handRaised ? 1 : 0}`).join("|"),
              snapshot.messages.length ? snapshot.messages[snapshot.messages.length - 1].id : "",
              snapshot.resources.map((r) => r.id).join("|"),
              snapshot.quiz ? `${snapshot.quiz.id}:${snapshot.quiz.revealed}:${snapshot.quiz.responseCount}` : "",
              snapshot.poll ? `${snapshot.poll.id}:${snapshot.poll.counts.join(",")}` : "",
              snapshot.focus ? `${snapshot.focus.status}` : "",
            ].join("~");
            if (signature !== lastSignature) {
              lastSignature = signature;
              send("snapshot", snapshot);
            }
          } catch (error) {
            // Session revoked or room ended: tell the client once, then close.
            if (error instanceof GroupStudyError) {
              send("closed", { message: error.message, code: error.code, status: error.status });
              closed = true;
              controller.close();
              return;
            }
            throw error;
          }
        };

        const heartbeat = setInterval(() => {
          if (closed) return;
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        }, 15_000);

        await push();
        let elapsed = 0;
        while (!closed && elapsed < 50_000) {
          await new Promise((resolve) => setTimeout(resolve, 2_500));
          elapsed += 2_500;
          await push();
        }
        clearInterval(heartbeat);
        if (!closed) {
          closed = true;
          controller.close();
        }
        request.signal.removeEventListener("abort", abort);
      },
      cancel() { closed = true; },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "private, no-store, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
    });
  } catch (error) {
    return groupStudyErrorResponse(error);
  }
}

/** Browser keeps presence alive with an authenticated POST heartbeat. */
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params;
    const principal = await getRoomPrincipal(roomId, { allowPending: true });
    await withRoomTransaction(roomId, principal, async (tx, me) => {
      if (!canPerformAction(me.role, me.member.status, "heartbeat")) throw new GroupStudyError("Heartbeat unavailable.", 403, "ROOM_ACCESS_DENIED");
      if (Date.now() - me.member.lastSeenAt.getTime() >= 60_000) {
        await tx.groupStudyParticipant.update({ where: { id: me.id }, data: { lastSeenAt: new Date() } });
      }
    });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return groupStudyErrorResponse(error);
  }
}
