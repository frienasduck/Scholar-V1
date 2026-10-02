import { z } from "zod";
import { readBoundedJson } from "@/lib/security/request-body";
import { checkGrade } from "@/lib/personalization/server";
import { claimTeacher, publicSession, readSession, releaseTeacher, saveSession, storeLesson, ProfileError } from "@/lib/exam-ready/server";
import { lessonKey, teach, teachingStyles } from "@/lib/exam-ready/teacher";
import { authorized, fail, reply } from "@/lib/exam-ready/http";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request, ctx: {
    params: Promise<{
        id: string;
    }>;
}) {
    let lease: {
        userId: string;
        id: string;
        revision: number;
    } | null = null;
    try {
        const body = z.object({ revision: z.number().int().nonnegative(), pace: z.enum(teachingStyles).default("normal"), question: z.string().trim().max(1800).default("") }).parse(await readBoundedJson(request, 6000));
        const user = await authorized(request, true, true), id = (await ctx.params).id;
        const s = await readSession(user.id, id);
        if (s.revision !== body.revision || s.status === "completed")
            throw new ProfileError("The session changed or is complete. Reload before starting a teaching turn.", 409);
        await checkGrade(user.id, s.setup.grade);
        const key = lessonKey(s, body.pace, body.question);
        if (s.lessons[key])
            return reply({ session: publicSession(s), key });
        await claimTeacher(user.id, id, body.revision);
        lease = { userId: user.id, id, revision: body.revision };
        const lesson = await teach(user.id, s, body.pace, body.question, AbortSignal.any([request.signal, AbortSignal.timeout(50000)]));
        return reply({ session: publicSession(await saveSession(user.id, storeLesson(s, key, lesson, body.question), body.revision, true)), key });
    }
    catch (e) {
        return fail(e);
    }
    finally {
        if (lease)
            await releaseTeacher(lease.userId, lease.id, lease.revision).catch(() => undefined);
    }
}
