import "server-only";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { RequestBodyError } from "@/lib/security/request-body";
import { mutationOrigin } from "@/lib/resources/http";
import { ProfileError } from "@/lib/personalization/server";
import { AIProviderError, publicAIError } from "@/lib/ai/errors";
import { ZodError } from "zod";
import { examAccess } from "./access";
export const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store, private" } });
export async function authorized(request: Request, mutate = false, ai = false) {
    if (mutate && !mutationOrigin(request))
        throw new ProfileError("Cross-site requests are not allowed.", 403);
    const user = await getSessionUser();
    if (!user)
        throw new ProfileError("Sign in for the AI teacher and account sync. Guest plans and notes stay on this device.", 401);
    if (!(await examAccess(user.id)).allowed)
        throw new ProfileError("Exam Ready is currently unavailable for your account.", 403);
    if (mutate)
        await enforceRateLimit(user.id, ai ? "exam-ready-ai" : "exam-ready-mutation", ai ? 60 : 180, 60 * 60000);
    if (ai)
        await enforceRateLimit(user.id, "ai-generation-burst", 20, 60000);
    if (ai)
        await enforceRateLimit(user.id, "ai-generation", 90, 60 * 60000);
    return user;
}
export function fail(error: unknown) {
    if (error instanceof RequestBodyError || error instanceof ProfileError)
        return reply({ message: error.message }, error.status);
    if (error instanceof RateLimitError)
        return reply({ message: "Too many requests. Wait before retrying." }, 429);
    if (error instanceof ZodError)
        return reply({ message: "Invalid Exam Ready input or teacher output. Please check your choices and retry." }, 422);
    if (error instanceof AIProviderError)
        return reply({ message: publicAIError(error).message }, error.status);
    console.warn("[Exam Ready] request unavailable; state preserved");
    return reply({ message: "Exam Ready account services are unavailable. Your local work is retained. Check database configuration and the Exam Ready migration." }, 503);
}
