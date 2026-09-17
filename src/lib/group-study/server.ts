import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Prisma, type GroupStudyRoom, type GroupStudyParticipant } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { isBetaAllowed } from "@/lib/auth/beta";
import { RateLimitError } from "@/lib/security/rate-limit";
import { HEARTBEAT_WRITE_MS, PRESENCE_ONLINE_MS, ROOM_IDLE_MS, HOST_ACTIONS, canPerformAction, type GroupAction } from "./policy";
import type { RoomMember, RoomSnapshot, RoomQuiz } from "./types";

export class GroupStudyError extends Error {
  constructor(message: string, public status = 400, public code = "GROUP_STUDY_ERROR") { super(message); }
}
export type RoomPrincipal = { room: GroupStudyRoom; member: GroupStudyParticipant; role: "host" | "participant"; displayName: string; id: string; userId?: string };
export type RoomTransaction = Prisma.TransactionClient;
export type StoredQuiz = { id: string; title: string; revealed: boolean; questions: Array<{ id: string; question: string; options: string[]; correctAnswer: number; explanation: string }>; answers: Record<string, Record<string, number>> };
type StoredPoll = { id: string; question: string; options: string[]; votes: Record<string, number> };
type StoredFocus = { status: "running" | "paused" | "completed"; durationSeconds: number; remainingSeconds: number; endsAt: string | null };

export function groupStudyErrorResponse(error: unknown) {
  // `message` is what the browser client renders; `error` is the stable code.
  if (error instanceof GroupStudyError) return NextResponse.json({ ok: false, error: error.code, code: error.code, message: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  if (error instanceof RateLimitError) return NextResponse.json({ ok: false, error: "RATE_LIMITED", code: "RATE_LIMITED", message: "Too many requests. Please wait before trying again." }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ ok: false, error: "ROOM_BUSY", code: "ROOM_BUSY", message: "The room changed. Please retry." }, { status: 409 });
  console.error("[Group Study] request failed", error instanceof Error ? error.name : "unknown");
  return NextResponse.json({ ok: false, error: "GROUP_STUDY_UNAVAILABLE", code: "GROUP_STUDY_UNAVAILABLE", message: "Group Study is temporarily unavailable. Please retry." }, { status: 503 });
}

export function assertRoomMutationRequest(request: Request) {
  const origin = request.headers.get("origin");
  const targetOrigin = new URL(request.url).origin;
  if ((origin && origin !== targetOrigin) || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new GroupStudyError("This request is not allowed.", 403, "INVALID_ORIGIN");
  }
}
export function groupStudyIpKey(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return `group-ip:${createHash("sha256").update(ip).digest("hex")}`;
}
export function participantCookieName(roomId: string) { return `scholar_group_${roomId}`; }
export function hashParticipantToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function generateRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return `SCH${Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join("")}`;
}
export async function setParticipantCookie(room: GroupStudyRoom, token: string) {
  (await cookies()).set(participantCookieName(room.id), token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/group-study", maxAge: Math.max(0, Math.floor((room.expiresAt.getTime() - Date.now()) / 1000)) });
}
export function createParticipantToken() { const token = randomBytes(32).toString("base64url"); return { token, tokenHash: hashParticipantToken(token) }; }

export function assertRoomOpen(room: GroupStudyRoom) {
  if (room.status === "ended") throw new GroupStudyError("This study room has ended.", 410, "ROOM_ENDED");
  if (room.expiresAt.getTime() <= Date.now() || Date.now() - room.lastActivityAt.getTime() > ROOM_IDLE_MS) throw new GroupStudyError("This study room has expired.", 410, "ROOM_EXPIRED");
}
export function assertRoomActive(room: GroupStudyRoom) {
  assertRoomOpen(room);
  if (room.status !== "active") throw new GroupStudyError(room.status === "paused" ? "The host has paused this room." : "Wait for the host to start the session.", 409, "ROOM_NOT_ACTIVE");
}
function memberStatus(member: GroupStudyParticipant, allowPending = false) {
  if (member.expiresAt.getTime() <= Date.now()) throw new GroupStudyError("Your study room session has expired.", 401, "ROOM_SESSION_EXPIRED");
  if (member.status === "removed") throw new GroupStudyError("You were removed from this study room.", 403, "PARTICIPANT_REMOVED");
  if (member.status === "denied") throw new GroupStudyError("The host declined your request to join.", 403, "PARTICIPANT_DENIED");
  if (member.status === "left") throw new GroupStudyError("You have left this room. Join again to request access.", 403, "PARTICIPANT_LEFT");
  if (member.status !== "approved" && !(allowPending && member.status === "pending")) throw new GroupStudyError("Waiting for host approval.", 403, "APPROVAL_REQUIRED");
}
export async function getRoomPrincipal(roomId: string, options: { allowPending?: boolean } = {}): Promise<RoomPrincipal> {
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(roomId)) throw new GroupStudyError("Study room not found.", 404, "ROOM_NOT_FOUND");
  const room = await db.groupStudyRoom.findUnique({ where: { id: roomId } });
  if (!room) throw new GroupStudyError("Study room not found.", 404, "ROOM_NOT_FOUND");
  assertRoomOpen(room);
  const user = await getSessionUser();
  if (user && user.id === room.hostUserId && await isBetaAllowed(user)) {
    let member = await db.groupStudyParticipant.findFirst({ where: { roomId, role: "host" } });
    if (!member) {
      // Repair previously orphaned rooms for their authorized owner only.
      // Locking the room prevents duplicate hosts on simultaneous refreshes.
      member = await withLockedRoom(roomId, async (tx, freshRoom) => {
        assertRoomOpen(freshRoom);
        if (freshRoom.hostUserId !== user.id) throw new GroupStudyError("Only the authorized host can do this.", 403, "HOST_REQUIRED");
        const owner = await tx.user.findUnique({ where: { id: user.id }, select: { id: true, email: true, sessionVersion: true } });
        if (!owner || !(await isBetaAllowed(owner))) throw new GroupStudyError("Only the authorized host can do this.", 403, "HOST_REQUIRED");
        return await tx.groupStudyParticipant.findFirst({ where: { roomId, role: "host" } }) ?? tx.groupStudyParticipant.create({ data: { roomId, displayName: (user.name || "Scholar Host").slice(0, 40), role: "host", status: "approved", expiresAt: freshRoom.expiresAt, approvedAt: new Date() } });
      });
    }
    memberStatus(member);
    return { room, member, role: "host", displayName: member.displayName, id: member.id, userId: user.id };
  }
  const token = (await cookies()).get(participantCookieName(roomId))?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new GroupStudyError("Join this study room with its invite code.", 401, "ROOM_ACCESS_REQUIRED");
  const member = await db.groupStudyParticipant.findFirst({ where: { roomId, tokenHash: hashParticipantToken(token), role: "participant" } });
  if (!member) throw new GroupStudyError("Your room session is invalid. Join again.", 401, "ROOM_ACCESS_REQUIRED");
  memberStatus(member, options.allowPending);
  return { room, member, role: "participant", displayName: member.displayName, id: member.id };
}

export async function revalidateRoomPrincipal(tx: RoomTransaction, room: GroupStudyRoom, principal: RoomPrincipal, options: { allowPending?: boolean } = {}): Promise<RoomPrincipal> {
  assertRoomOpen(room);
  if (principal.room.id !== room.id) throw new GroupStudyError("This room session is not valid here.", 403, "ROOM_ACCESS_DENIED");
  const member = await tx.groupStudyParticipant.findFirst({ where: { id: principal.id, roomId: room.id } });
  if (!member || member.role !== principal.role) throw new GroupStudyError("Your room session is invalid.", 403, "ROOM_ACCESS_DENIED");
  if (principal.role === "host") {
    const user = principal.userId ? await tx.user.findUnique({ where: { id: principal.userId }, select: { id: true, email: true, sessionVersion: true } }) : null;
    if (!user || user.id !== room.hostUserId || !(await isBetaAllowed(user))) throw new GroupStudyError("Only the authorized host can do this.", 403, "HOST_REQUIRED");
  } else if (!member.tokenHash || member.tokenHash !== principal.member.tokenHash) throw new GroupStudyError("Your room session was revoked.", 403, "ROOM_ACCESS_DENIED");
  memberStatus(member, options.allowPending);
  return { ...principal, room, member, displayName: member.displayName };
}

/** No provider/network calls in this callback: the row lock only protects database work. */
export async function withRoomTransaction<T>(roomId: string, principal: RoomPrincipal, callback: (tx: RoomTransaction, principal: RoomPrincipal, room: GroupStudyRoom) => Promise<T>, options: { allowPending?: boolean } = {}): Promise<T> {
  return withLockedRoom(roomId, async (tx, room) => callback(tx, await revalidateRoomPrincipal(tx, room, principal, options), room));
}
export async function withLockedRoom<T>(roomId: string, callback: (tx: RoomTransaction, room: GroupStudyRoom) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<GroupStudyRoom[]>`SELECT * FROM "GroupStudyRoom" WHERE "id" = ${roomId} FOR UPDATE`;
        const room = rows[0];
        if (!room) throw new GroupStudyError("Study room not found.", 404, "ROOM_NOT_FOUND");
        return callback(tx, room);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034" || attempt >= 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 30 * (attempt + 1) + randomInt(30)));
    }
  }
}
export async function recordRoomEvent(tx: RoomTransaction, roomId: string, participantId: string | null, type: string) {
  await tx.groupStudyEvent.create({ data: { roomId, participantId, type } });
}
export async function touchRoom(tx: RoomTransaction, roomId: string) {
  return tx.groupStudyRoom.update({ where: { id: roomId }, data: { revision: { increment: 1 }, lastActivityAt: new Date() } });
}
function publicMember(member: GroupStudyParticipant): RoomMember {
  return { id: member.id, role: member.role as RoomMember["role"], status: member.status as RoomMember["status"], displayName: member.displayName, handRaised: member.handRaised, chatMuted: member.chatMuted };
}
export function sanitizeQuiz(quiz: StoredQuiz, meId: string, participants: Array<{ id: string; displayName: string }>): RoomQuiz {
  return {
    id: quiz.id, title: quiz.title, revealed: quiz.revealed,
    questions: quiz.questions.map((q) => ({ id: q.id, question: q.question, options: q.options, ...(quiz.revealed ? { correctAnswer: q.correctAnswer, explanation: q.explanation } : {}) })),
    responseCount: Object.values(quiz.answers).filter((answers) => quiz.questions.every((q) => Number.isInteger(answers[q.id]))).length,
    myAnswers: quiz.answers[meId] ?? {},
    ...(quiz.revealed ? { results: participants.filter((p) => quiz.answers[p.id]).map((p) => ({ participantId: p.id, displayName: p.displayName, score: quiz.questions.filter((q) => quiz.answers[p.id]?.[q.id] === q.correctAnswer).length, total: quiz.questions.length })) } : {}),
  };
}
export function resolveFocus(focus: StoredFocus, now = Date.now()): StoredFocus {
  const remainingSeconds = focus.status === "running" && focus.endsAt ? Math.max(0, Math.ceil((Date.parse(focus.endsAt) - now) / 1000)) : focus.remainingSeconds;
  return { ...focus, remainingSeconds, status: remainingSeconds <= 0 ? "completed" : focus.status };
}

export async function getRoomSnapshot(roomId: string): Promise<RoomSnapshot> {
  const principal = await getRoomPrincipal(roomId, { allowPending: true });
  return withRoomTransaction(roomId, principal, async (tx, me, room) => {
    const isHost = me.role === "host";
    const pending = me.member.status === "pending";
    if (Date.now() - me.member.lastSeenAt.getTime() >= HEARTBEAT_WRITE_MS) {
      await tx.groupStudyParticipant.update({ where: { id: me.id }, data: { lastSeenAt: new Date() } });
      if (!pending) await tx.groupStudyRoom.update({ where: { id: room.id }, data: { lastActivityAt: new Date() } });
    }
    const result: RoomSnapshot = {
      room: { id: room.id, name: pending ? "" : room.name, subject: pending ? "" : room.subject, topic: pending ? "" : room.topic, status: room.status as RoomSnapshot["room"]["status"], locked: pending ? false : room.locked, requireApproval: true, aiEnabled: !pending && room.aiEnabled, chatEnabled: !pending && room.chatEnabled, pdfEnabled: !pending && room.pdfEnabled, participantUploads: !pending && room.participantUploads, notesEditable: !pending && room.notesEditable, maxParticipants: pending ? 0 : room.maxParticipants, ...(isHost ? { code: `SCH-${room.code.slice(3)}` } : {}), activeResourceId: pending ? null : room.activeResourceId, page: pending ? 1 : room.page, followHost: !pending && room.followHost, announcement: pending ? "" : room.announcement, createdAt: pending ? "" : room.createdAt.toISOString(), startedAt: pending ? null : room.startedAt?.toISOString() ?? null, expiresAt: room.expiresAt.toISOString() },
      me: publicMember(me.member), participants: [], messages: [], resources: [], quiz: null, poll: null, focus: null, notes: pending ? "" : room.notes, revision: pending ? 0 : room.revision,
    };
    if (pending) return result;
    result.room.requireApproval = room.requireApproval;
    const [participants, messages, resources, activities] = await Promise.all([
      tx.groupStudyParticipant.findMany({ where: { roomId, status: isHost ? { in: ["approved", "pending"] } : "approved" }, orderBy: { joinedAt: "asc" } }),
      tx.groupStudyMessage.findMany({ where: { roomId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100, include: { participant: { select: { displayName: true } } } }),
      tx.groupStudyResource.findMany({ where: { roomId }, select: { id: true, name: true, mimeType: true, sizeBytes: true, pageCount: true }, orderBy: { createdAt: "asc" } }),
      tx.groupStudyActivity.findMany({ where: { roomId } }),
    ]);
    result.participants = participants.map((p) => ({ ...publicMember(p), online: Date.now() - p.lastSeenAt.getTime() <= PRESENCE_ONLINE_MS, lastSeenAt: p.lastSeenAt.toISOString() }));
    result.messages = messages.reverse().map((message) => ({ id: message.id, author: message.participant?.displayName ?? (message.kind === "ai" ? "Group LAM" : "Scholar"), kind: message.kind as RoomSnapshot["messages"][number]["kind"], body: message.body, createdAt: message.createdAt.toISOString() }));
    result.resources = room.pdfEnabled || isHost ? resources : [];
    for (const activity of activities) {
      if (activity.kind === "quiz") result.quiz = sanitizeQuiz(activity.state as unknown as StoredQuiz, me.id, participants);
      if (activity.kind === "poll") {
        const poll = activity.state as unknown as StoredPoll;
        result.poll = { id: poll.id, question: poll.question, options: poll.options, counts: poll.options.map((_, i) => Object.values(poll.votes).filter((v) => v === i).length), myVote: poll.votes[me.id] ?? null };
      }
      if (activity.kind === "focus") result.focus = resolveFocus(activity.state as unknown as StoredFocus);
    }
    return result;
  }, { allowPending: true });
}

async function updateActivity(tx: RoomTransaction, roomId: string, kind: string, state: object) {
  return tx.groupStudyActivity.upsert({ where: { roomId_kind: { roomId, kind } }, create: { roomId, kind, state: state as Prisma.InputJsonObject }, update: { state: state as Prisma.InputJsonObject } });
}
export async function performRoomAction(roomId: string, principal: RoomPrincipal, input: GroupAction) {
  return withRoomTransaction(roomId, principal, async (tx, me, room) => {
    if (!canPerformAction(me.role, me.member.status, input.action)) throw new GroupStudyError("Only the host can perform that action.", 403, "HOST_REQUIRED");
    if (input.action === "heartbeat") {
      if (Date.now() - me.member.lastSeenAt.getTime() >= HEARTBEAT_WRITE_MS) await tx.groupStudyParticipant.update({ where: { id: me.id }, data: { lastSeenAt: new Date() } });
      return;
    }
    if (me.role !== "host" && room.status === "paused" && !["leave", "hand"].includes(input.action)) throw new GroupStudyError("The host has paused this room.", 409, "ROOM_PAUSED");
    if (["approve", "deny", "remove", "mute"].includes(input.action)) {
      const action = input as Extract<GroupAction, { participantId: string }>;
      const target = await tx.groupStudyParticipant.findFirst({ where: { id: action.participantId, roomId, role: "participant" } });
      if (!target) throw new GroupStudyError("Participant not found.", 404, "PARTICIPANT_NOT_FOUND");
      if (input.action === "approve") {
        if (room.locked) throw new GroupStudyError("Unlock the room before approving new participants.", 409, "ROOM_LOCKED");
        if (target.status !== "pending") throw new GroupStudyError("This join request is no longer pending.", 409, "PARTICIPANT_CHANGED");
        const count = await tx.groupStudyParticipant.count({ where: { roomId, status: "approved" } });
        if (count >= room.maxParticipants) throw new GroupStudyError("This study room is full.", 409, "ROOM_FULL");
        await tx.groupStudyParticipant.update({ where: { id: target.id }, data: { status: "approved", approvedAt: new Date() } });
      } else if (input.action === "mute") await tx.groupStudyParticipant.update({ where: { id: target.id }, data: { chatMuted: input.muted } });
      else await tx.groupStudyParticipant.update({ where: { id: target.id }, data: { status: input.action === "deny" ? "denied" : "removed", removedAt: new Date() } });
    } else switch (input.action) {
      case "hand": await tx.groupStudyParticipant.update({ where: { id: me.id }, data: { handRaised: input.raised } }); break;
      case "leave":
        if (me.role === "host") throw new GroupStudyError("Use End room to close your study session.", 409, "HOST_MUST_END_ROOM");
        await tx.groupStudyParticipant.update({ where: { id: me.id }, data: { status: "left", removedAt: new Date() } }); break;
      case "chat":
        if (!room.chatEnabled || me.member.chatMuted) throw new GroupStudyError("Chat is disabled for you in this room.", 403, "CHAT_DISABLED");
        await tx.groupStudyMessage.create({ data: { roomId, participantId: me.id, body: input.body, kind: "chat" } }); break;
      case "announce":
        await tx.groupStudyRoom.update({ where: { id: roomId }, data: { announcement: input.body } });
        if (input.body) await tx.groupStudyMessage.create({ data: { roomId, participantId: me.id, body: input.body, kind: "announcement" } }); break;
      case "start":
        if (room.status !== "waiting") throw new GroupStudyError("The room has already started.", 409, "INVALID_TRANSITION");
        await tx.groupStudyRoom.update({ where: { id: roomId }, data: { status: "active", startedAt: new Date() } }); break;
      case "pause":
        assertRoomActive(room);
        await tx.groupStudyRoom.update({ where: { id: roomId }, data: { status: "paused" } });
        await pauseFocus(tx, roomId); break;
      case "resume":
        if (room.status !== "paused") throw new GroupStudyError("This room is not paused.", 409, "INVALID_TRANSITION");
        await tx.groupStudyRoom.update({ where: { id: roomId }, data: { status: "active" } }); break;
      case "end":
        await tx.groupStudyRoom.update({ where: { id: roomId }, data: { status: "ended", endedAt: new Date(), locked: true } });
        await tx.groupStudyParticipant.updateMany({ where: { roomId, role: "participant" }, data: { tokenHash: null, status: "left" } });
        await tx.groupStudyResource.deleteMany({ where: { roomId } }); break;
      case "lock": await tx.groupStudyRoom.update({ where: { id: roomId }, data: { locked: input.locked } }); break;
      case "settings": await tx.groupStudyRoom.update({ where: { id: roomId }, data: input.settings }); break;
      case "notes":
        if (me.role !== "host" && !room.notesEditable) throw new GroupStudyError("Shared notes are currently read-only.", 403, "NOTES_READ_ONLY");
        if (input.revision !== room.revision) throw new GroupStudyError("The room changed while you were editing. Refresh and merge your notes.", 409, "NOTES_CONFLICT");
        await tx.groupStudyRoom.update({ where: { id: roomId }, data: { notes: input.text } }); break;
      case "focus": {
        assertRoomActive(room);
        const stored = await tx.groupStudyActivity.findUnique({ where: { roomId_kind: { roomId, kind: "focus" } } });
        const previous = stored ? resolveFocus(stored.state as unknown as StoredFocus) : null;
        if (input.operation !== "start" && !previous) throw new GroupStudyError("Start a focus timer first.", 409, "NO_FOCUS_TIMER");
        const duration = input.durationSeconds ?? 600;
        const focus: StoredFocus = input.operation === "start" ? { status: "running", durationSeconds: duration, remainingSeconds: duration, endsAt: new Date(Date.now() + duration * 1000).toISOString() } : input.operation === "pause" ? { ...previous!, status: "paused", endsAt: null } : input.operation === "resume" ? { ...previous!, status: "running", endsAt: new Date(Date.now() + previous!.remainingSeconds * 1000).toISOString() } : { ...previous!, status: "completed", remainingSeconds: 0, endsAt: null };
        await updateActivity(tx, roomId, "focus", focus); break;
      }
      case "quiz":
        assertRoomActive(room);
        await updateActivity(tx, roomId, "quiz", { id: randomBytes(12).toString("hex"), title: input.title, revealed: false, questions: input.questions.map((q) => ({ ...q, id: randomBytes(8).toString("hex") })), answers: {} }); break;
      case "answer": {
        assertRoomActive(room);
        const activity = await tx.groupStudyActivity.findUnique({ where: { roomId_kind: { roomId, kind: "quiz" } } });
        const quiz = activity?.state as unknown as StoredQuiz | undefined;
        const question = quiz?.questions.find((q) => q.id === input.questionId);
        if (!quiz || quiz.id !== input.quizId || quiz.revealed || !question || input.answer >= question.options.length) throw new GroupStudyError("This question is no longer accepting answers.", 409, "QUIZ_CLOSED");
        const previous = quiz.answers[me.id] ?? {};
        if (previous[input.questionId] !== undefined) throw new GroupStudyError("Your answer has already been submitted.", 409, "ANSWER_EXISTS");
        await updateActivity(tx, roomId, "quiz", { ...quiz, answers: { ...quiz.answers, [me.id]: { ...previous, [input.questionId]: input.answer } } }); break;
      }
      case "reveal": {
        const activity = await tx.groupStudyActivity.findUnique({ where: { roomId_kind: { roomId, kind: "quiz" } } });
        const quiz = activity?.state as unknown as StoredQuiz | undefined;
        if (!quiz || quiz.id !== input.quizId) throw new GroupStudyError("Quiz not found.", 404, "QUIZ_NOT_FOUND");
        await updateActivity(tx, roomId, "quiz", { ...quiz, revealed: true }); break;
      }
      case "poll": assertRoomActive(room); await updateActivity(tx, roomId, "poll", { id: randomBytes(12).toString("hex"), question: input.question, options: input.options, votes: {} }); break;
      case "vote": {
        assertRoomActive(room);
        const activity = await tx.groupStudyActivity.findUnique({ where: { roomId_kind: { roomId, kind: "poll" } } });
        const poll = activity?.state as unknown as StoredPoll | undefined;
        if (!poll || poll.id !== input.pollId || input.option >= poll.options.length) throw new GroupStudyError("Poll not found.", 404, "POLL_NOT_FOUND");
        await updateActivity(tx, roomId, "poll", { ...poll, votes: { ...poll.votes, [me.id]: input.option } }); break;
      }
      case "resource": {
        if (!room.pdfEnabled) throw new GroupStudyError("Materials are disabled.", 403, "MATERIALS_DISABLED");
        if (input.resourceId) {
          const resource = await tx.groupStudyResource.findFirst({ where: { id: input.resourceId, roomId }, select: { id: true } });
          if (!resource) throw new GroupStudyError("Resource not found.", 404, "RESOURCE_NOT_FOUND");
          if (input.remove) await tx.groupStudyResource.delete({ where: { id: resource.id } });
        }
        if (!input.remove || room.activeResourceId === input.resourceId) await tx.groupStudyRoom.update({ where: { id: roomId }, data: { activeResourceId: input.remove ? null : input.resourceId, page: 1 } }); break;
      }
      case "page": {
        const resource = room.activeResourceId ? await tx.groupStudyResource.findFirst({ where: { id: room.activeResourceId, roomId }, select: { pageCount: true } }) : null;
        if (!room.pdfEnabled || !resource || input.page > resource.pageCount) throw new GroupStudyError("Choose a valid resource page.", 400, "INVALID_PAGE");
        await tx.groupStudyRoom.update({ where: { id: roomId }, data: { page: input.page } }); break;
      }
      case "clear-chat": await tx.groupStudyMessage.deleteMany({ where: { roomId } }); break;
      case "regenerate-code": await tx.groupStudyRoom.update({ where: { id: roomId }, data: { code: generateRoomCode() } }); break;
    }
    await touchRoom(tx, roomId);
    await recordRoomEvent(tx, roomId, me.id, input.action);
  }, { allowPending: input.action === "heartbeat" || input.action === "leave" });
}
async function pauseFocus(tx: RoomTransaction, roomId: string) {
  const activity = await tx.groupStudyActivity.findUnique({ where: { roomId_kind: { roomId, kind: "focus" } } });
  if (activity) {
    const focus = resolveFocus(activity.state as unknown as StoredFocus);
    if (focus.status === "running") await updateActivity(tx, roomId, "focus", { ...focus, status: "paused", endsAt: null });
  }
}
