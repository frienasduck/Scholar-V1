import { z } from "zod";

export const MAX_ROOM_PARTICIPANTS = 15;
export const ROOM_LIFETIME_MS = 8 * 60 * 60 * 1000;
export const ROOM_IDLE_MS = 2 * 60 * 60 * 1000;
export const PRESENCE_ONLINE_MS = 90_000;
export const HEARTBEAT_WRITE_MS = 60_000;
export const displayNameSchema = z.string().trim().min(2).max(40).refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Use a readable display name.");
export const createRoomSchema = z.object({
  name: z.string().trim().min(2).max(80), subject: z.string().trim().max(80).default(""),
  topic: z.string().trim().max(160).default(""), maxParticipants: z.number().int().min(2).max(MAX_ROOM_PARTICIPANTS).default(15),
}).strict();
export const joinRoomSchema = z.object({ displayName: displayNameSchema, code: z.string().trim().min(6).max(20) }).strict();
export const quizQuestionSchema = z.object({
  question: z.string().trim().min(3).max(1200), options: z.array(z.string().trim().min(1).max(500)).min(2).max(6),
  correctAnswer: z.number().int().min(0).max(5), explanation: z.string().trim().max(2000).default(""),
}).strict().refine((value) => value.correctAnswer < value.options.length, "Choose a valid correct answer.");
export const groupActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["start", "pause", "resume", "end", "heartbeat", "leave", "clear-chat", "regenerate-code"]) }).strict(),
  z.object({ action: z.enum(["approve", "deny", "remove"]), participantId: z.string().min(1).max(80) }).strict(),
  z.object({ action: z.literal("mute"), participantId: z.string().min(1).max(80), muted: z.boolean() }).strict(),
  z.object({ action: z.literal("hand"), raised: z.boolean() }).strict(),
  z.object({ action: z.literal("chat"), body: z.string().trim().min(1).max(2000) }).strict(),
  z.object({ action: z.literal("announce"), body: z.string().trim().max(1000) }).strict(),
  z.object({ action: z.literal("lock"), locked: z.boolean() }).strict(),
  z.object({ action: z.literal("settings"), settings: z.object({ requireApproval: z.boolean().optional(), aiEnabled: z.boolean().optional(), chatEnabled: z.boolean().optional(), pdfEnabled: z.boolean().optional(), participantUploads: z.boolean().optional(), notesEditable: z.boolean().optional(), followHost: z.boolean().optional() }).strict() }).strict(),
  z.object({ action: z.literal("notes"), text: z.string().max(20_000), revision: z.number().int().nonnegative() }).strict(),
  z.object({ action: z.literal("focus"), operation: z.enum(["start", "pause", "resume", "stop"]), durationSeconds: z.number().int().min(60).max(7200).optional() }).strict(),
  z.object({ action: z.literal("quiz"), title: z.string().trim().min(1).max(120).default("Room quiz"), questions: z.array(quizQuestionSchema).min(1).max(10) }).strict(),
  z.object({ action: z.literal("answer"), quizId: z.string().min(1).max(80), questionId: z.string().min(1).max(80), answer: z.number().int().min(0).max(5) }).strict(),
  z.object({ action: z.literal("reveal"), quizId: z.string().min(1).max(80) }).strict(),
  z.object({ action: z.literal("poll"), question: z.string().trim().min(3).max(500), options: z.array(z.string().trim().min(1).max(200)).min(2).max(6) }).strict(),
  z.object({ action: z.literal("vote"), pollId: z.string().min(1).max(80), option: z.number().int().min(0).max(5) }).strict(),
  z.object({ action: z.literal("resource"), resourceId: z.string().max(80).nullable(), remove: z.boolean().optional() }).strict(),
  z.object({ action: z.literal("page"), page: z.number().int().min(1).max(2000) }).strict(),
]);
export type GroupAction = z.infer<typeof groupActionSchema>;
export const HOST_ACTIONS = new Set(["approve", "deny", "remove", "mute", "announce", "start", "pause", "resume", "end", "lock", "settings", "focus", "quiz", "reveal", "poll", "resource", "page", "clear-chat", "regenerate-code"]);
export function canPerformAction(role: string, status: string, action: string): boolean {
  if (status !== "approved") return action === "heartbeat" || action === "leave";
  return role === "host" || !HOST_ACTIONS.has(action);
}
export function normalizeRoomCode(code: string) { return code.toUpperCase().replace(/[^A-Z0-9]/g, ""); }
