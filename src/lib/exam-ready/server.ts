import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { lockAccount, checkGrade, jsonValue, ProfileError } from "@/lib/personalization/server";
import { currentTask, restoreMissionCoverage, type ExamSession, type Lesson } from "./model";
export { ProfileError };
type Row = {
    state: Prisma.JsonValue;
    revision: number;
};
export function publicSession(s: ExamSession): ExamSession {
    return { ...s, lessons: Object.fromEntries(Object.entries(s.lessons).map(([key, l]) => [key, { ...l, questions: l.questions.map(q => ({ ...q, answer: "", explanation: "" })) }])) };
}
export async function readSession(userId: string, id: string) {
    const rows = await db.$queryRaw<Row[]> `SELECT "state", "revision" FROM "ExamReadySession" WHERE "id"=${id} AND "userId"=${userId}`;
    if (!rows[0])
        throw new ProfileError("This Exam Ready session was not found.", 404);
    return restoreMissionCoverage({ ...rows[0].state as unknown as ExamSession, revision: rows[0].revision });
}
export async function listSessions(userId: string) {
    const rows = await db.$queryRaw<Row[]> `SELECT "state", "revision" FROM "ExamReadySession" WHERE "userId"=${userId} ORDER BY "updatedAt" DESC LIMIT 30`;
    return rows.map(r => publicSession(restoreMissionCoverage({ ...r.state as unknown as ExamSession, revision: r.revision })));
}
export async function insertSession(userId: string, s: ExamSession) {
    await checkGrade(userId, s.setup.grade);
    await db.$transaction(async (tx) => {
        await lockAccount(tx, userId);
        const count = await tx.$queryRaw<{
            count: bigint;
        }[]> `SELECT COUNT(*) as count FROM "ExamReadySession" WHERE "userId"=${userId}`;
        if (Number(count[0].count) >= 100)
            throw new ProfileError("Your Exam Ready history has reached 100 sessions. Please contact support before starting another.", 409);
        await tx.$executeRaw `INSERT INTO "ExamReadySession" ("id","userId","state") VALUES (${s.id},${userId},${JSON.stringify(jsonValue(s))}::jsonb)`;
    });
    return s;
}
export async function saveSession(userId: string, s: ExamSession, expected: number, leased = false) {
    const state = { ...s, revision: expected + 1 };
    if (JSON.stringify(state).length > 400000)
        throw new ProfileError("This session is too large; shorten your notes or start a new session.", 413);
    const changed = leased ? await db.$executeRaw `UPDATE "ExamReadySession" SET "state"=${JSON.stringify(state)}::jsonb,"revision"="revision"+1,"leaseUntil"=NULL,"updatedAt"=NOW() WHERE "id"=${s.id} AND "userId"=${userId} AND "revision"=${expected} AND "leaseUntil">NOW()`
        : await db.$executeRaw `UPDATE "ExamReadySession" SET "state"=${JSON.stringify(state)}::jsonb,"revision"="revision"+1,"updatedAt"=NOW() WHERE "id"=${s.id} AND "userId"=${userId} AND "revision"=${expected} AND ("leaseUntil" IS NULL OR "leaseUntil"<NOW())`;
    if (changed !== 1)
        throw new ProfileError("This session changed on another device or is generating. Reload it before retrying; your local notes are retained.", 409);
    return state;
}
export async function claimTeacher(userId: string, id: string, revision: number) {
    const changed = await db.$executeRaw `UPDATE "ExamReadySession" SET "leaseUntil"=NOW()+INTERVAL '70 seconds' WHERE "id"=${id} AND "userId"=${userId} AND "revision"=${revision} AND ("leaseUntil" IS NULL OR "leaseUntil"<NOW())`;
    if (changed !== 1)
        throw new ProfileError("A turn is already generating or this session changed. Reload and retry.", 409);
}
export async function releaseTeacher(userId: string, id: string, revision: number) { await db.$executeRaw `UPDATE "ExamReadySession" SET "leaseUntil"=NULL WHERE "id"=${id} AND "userId"=${userId} AND "revision"=${revision}`; }
export function storeLesson(s: ExamSession, key: string, lesson: Lesson, question: string) {
    s.lessons = Object.fromEntries([...Object.entries(s.lessons).filter(([id]) => id !== key).slice(-11), [key, lesson]]);
    s.chat = [...s.chat, ...(question ? [{ role: "user" as const, content: question }] : []), { role: "assistant" as const, content: lesson.text }].slice(-12);
    s.updatedAt = Date.now();
    return s;
}
export function questionFor(s: ExamSession, id: string) {
    const task = currentTask(s);
    return Object.entries(s.lessons).filter(([key]) => key.startsWith(`${task?.id}:`)).flatMap(([, l]) => l.questions).find(q => q.id === id && q.subjectId === task?.subjectId && q.chapterId === task?.chapterId);
}
