import { z } from "zod";
import { readBoundedJson } from "@/lib/security/request-body";
import { checkGrade } from "@/lib/personalization/server";
import { actionSchema } from "@/lib/exam-ready/model";
import { recordAnswer, transition } from "@/lib/exam-ready/planner";
import { claimTeacher, publicSession, questionFor, readSession, releaseTeacher, saveSession, ProfileError } from "@/lib/exam-ready/server";
import { completeJSON } from "@/lib/exam-ready/teacher";
import { authorized, fail, reply } from "@/lib/exam-ready/http";
import { gradingPrompt, objectiveVerdict, rubricVerdict } from "@/lib/exam-ready/assessment";
export const runtime = "nodejs";
export const maxDuration = 60;
type Context = {
    params: Promise<{
        id: string;
    }>;
};
export async function GET(request: Request, ctx: Context) { try {
    const user = await authorized(request);
    return reply({ session: publicSession(await readSession(user.id, (await ctx.params).id)) });
}
catch (e) {
    return fail(e);
} }
export async function PATCH(request: Request, ctx: Context) {
    let lease: { userId: string; id: string; revision: number } | null = null;
    try {
        const body = z.object({ revision: z.number().int().nonnegative(), action: actionSchema }).parse(await readBoundedJson(request, 28000));
        const user = await authorized(request, true, body.action.type === "answer");
        let s = await readSession(user.id, (await ctx.params).id);
        if (s.revision !== body.revision)
            throw new ProfileError("Your session changed elsewhere. Reload before retrying.", 409);
        await checkGrade(user.id, s.setup.grade);
        if (body.action.type === "answer") {
            const q = questionFor(s, body.action.questionId);
            if (!q)
                throw new ProfileError("This question is no longer active.", 409);
            const answered = s.attempts.some(a => a.questionId === q.id);
            if (answered)
                throw new ProfileError("This answer was already saved.", 409);
            let verdict = objectiveVerdict(q, body.action.answer);
            if (!verdict) {
                await claimTeacher(user.id, s.id, body.revision);
                lease = { userId: user.id, id: s.id, revision: body.revision };
                verdict = rubricVerdict(q, await completeJSON(user.id, gradingPrompt(q, body.action.answer), AbortSignal.any([request.signal, AbortSignal.timeout(45000)])));
            }
            s = recordAnswer(s, q, body.action.answer, verdict.correct, verdict.evaluation, Date.now(), verdict);
        }
        else
            s = transition(s, body.action);
        return reply({ session: publicSession(await saveSession(user.id, s, body.revision, !!lease)) });
    }
    catch (e) {
        return fail(e);
    }
    finally { if (lease) await releaseTeacher(lease.userId, lease.id, lease.revision).catch(() => undefined); }
}
