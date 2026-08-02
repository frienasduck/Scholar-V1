import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { resolveUserEntitlements } from "@/lib/subscriptions/entitlements";
import { consumeGeneration } from "@/lib/subscriptions/usage";

const schema = z.object({ key: z.enum(["quiz_generation", "slideshow_generation"]) });

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED", message: "Sign in to generate content." }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "INVALID_USAGE_KEY" }, { status: 400 });
  try {
    const result = await consumeGeneration(user.id, parsed.data.key, await resolveUserEntitlements(user.id));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof Error && (error as Error & { code?: string }).code === "QUOTA_REACHED") {
      return NextResponse.json({ error: "QUOTA_REACHED", message: "Your daily generation limit has been reached. Upgrade to Scholar Plus for a higher limit." }, { status: 429 });
    }
    return NextResponse.json({ error: "USAGE_CHECK_FAILED", message: "Scholar could not verify your generation limit." }, { status: 500 });
  }
}
