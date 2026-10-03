import { z } from "zod";
export const focusSchema = z.object({
  id: z.string(), goal: z.string().max(180), subject: z.string().max(80), chapter: z.string().max(120),
  studySeconds: z.number().int().min(60).max(10800), breakSeconds: z.number().int().min(0).max(3600),
  phase: z.enum(["study", "break", "complete"]), deadline: z.number().finite(),
  remaining: z.number().finite().min(0), paused: z.boolean(), startedAt: z.number().finite(),
  music: z.string().max(240), pauseMusicOnBreak: z.boolean(), recorded: z.boolean(),
});
export type FocusSession = z.infer<typeof focusSchema>;
export function focusRemaining(session: FocusSession, now: number): number {
  return session.phase === "complete" ? 0 : session.paused ? session.remaining : Math.max(0, Math.ceil((session.deadline - now) / 1000));
}
export function advanceFocus(session: FocusSession, now: number): FocusSession {
  if (session.paused || session.phase === "complete" || now < session.deadline) return session;
  if (session.phase === "study" && session.breakSeconds > 0)
    return { ...session, phase: "break", paused: true, remaining: session.breakSeconds, deadline: now + session.breakSeconds * 1000 };
  return { ...session, phase: "complete", remaining: 0, paused: false };
}
export function toggleFocusPause(session: FocusSession, now: number): FocusSession {
  if (session.phase === "complete") return session;
  if (session.paused) return { ...session, paused: false, deadline: now + session.remaining * 1000 };
  return { ...session, paused: true, remaining: focusRemaining(session, now) };
}
