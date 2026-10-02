import { getSessionUser } from "@/lib/auth/session";
import { readBoundedJson } from "@/lib/security/request-body";
import { setupSchema } from "@/lib/exam-ready/model";
import { createSession } from "@/lib/exam-ready/planner";
import { examAccess } from "@/lib/exam-ready/access";
import { insertSession, listSessions, publicSession } from "@/lib/exam-ready/server";
import { authorized, fail, reply } from "@/lib/exam-ready/http";
export const runtime = "nodejs";
export async function GET() { try {
    const user = await getSessionUser();
    const access = await examAccess(user?.id ?? null);
    return reply({ access, sessions: user && access.allowed ? await listSessions(user.id) : [] });
}
catch (e) {
    return fail(e);
} }
export async function POST(request: Request) { try {
    const user = await authorized(request, true);
    const setup = setupSchema.parse(await readBoundedJson(request, 24000));
    return reply({ session: publicSession(await insertSession(user.id, createSession(crypto.randomUUID(), setup))) }, 201);
}
catch (e) {
    return fail(e);
} }
