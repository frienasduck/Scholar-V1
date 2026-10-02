import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { mutationOrigin } from "@/lib/resources/http";
import { ProfileError } from "@/lib/personalization/server";
import { RequestBodyError } from "@/lib/security/request-body";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { AIProviderError } from "@/lib/ai/errors";
import { MonthlyQuotaError } from "@/lib/subscriptions/monthly-usage";
export const reply = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  });
export async function authorize(
  request: Request,
  mutate = false,
  ai = false,
  job = false
) {
  if (mutate && !mutationOrigin(request))
    throw new ProfileError("Cross-site requests are not allowed.", 403);
  const user = await getSessionUser();
  if (!user)
    throw new ProfileError(
      "Sign in to generate and save private AI videos. The preview is free to explore.",
      401
    );
  if (mutate)
    await enforceRateLimit(
      user.id,
      job ? "lamtube-stage" : ai ? "lamtube-ai" : "lamtube-mutation",
      job ? 600 : ai ? 60 : 180,
      60 * 60000
    );
  if (ai) await enforceRateLimit(user.id, "ai-generation-burst", 20, 60000);
  return user;
}
export function fail(error: unknown) {
  if (error instanceof ProfileError || error instanceof RequestBodyError)
    return reply({ message: error.message }, error.status);
  if (error instanceof MonthlyQuotaError)
    return reply(
      {
        message:
          "Your 10 monthly AI videos have been used. Existing videos and edits remain available; Scholar Plus has unlimited full generations.",
        code: error.code,
      },
      429
    );
  if (error instanceof RateLimitError)
    return reply(
      { message: "Too many requests. Wait a moment before retrying." },
      429
    );
  if (error instanceof ZodError)
    return reply(
      {
        message:
          "The lesson input or scene data did not pass validation. Check your settings and retry.",
      },
      422
    );
  if (error instanceof AIProviderError)
    return reply({ message: error.message }, error.status);
  console.warn(
    "[LAMTube] account service unavailable; private state preserved"
  );
  return reply(
    {
      message:
        "LAMTube account storage is unavailable. Check database connectivity and the LAMTube migration, then refresh persisted progress before retrying.",
    },
    503
  );
}
