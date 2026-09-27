import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { requireEntitlement } from "@/lib/subscriptions/entitlements";
import { recordAudit } from "@/lib/subscriptions/audit";
import { readBoundedJson, RequestBodyError } from "@/lib/security/request-body";

const schema = z.object({ scholarClass: z.union([z.literal(9), z.literal(11)]) });

export async function PATCH(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  let raw: unknown;
  try {
    raw = await readBoundedJson(request, 2 * 1024);
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    return NextResponse.json({ error: "REQUEST_FAILED" }, { status: 400 });
  }
  const input = schema.safeParse(raw);
  if (!input.success) return NextResponse.json({ error: "Choose Class 9 or Class 11." }, { status: 400 });
  if (input.data.scholarClass === 9) {
    const gate = await requireEntitlement("class_9_access");
    if (!gate.ok) return gate.response;
  }
  await db.user.update({ where: { id: user.id }, data: { currentScholarClass: input.data.scholarClass } });
  await recordAudit("ACADEMIC_CLASS_CHANGED", { actorUserId: user.id, targetUserId: user.id, metadata: { scholarClass: input.data.scholarClass } });
  return NextResponse.json({ ok: true, scholarClass: input.data.scholarClass });
}
