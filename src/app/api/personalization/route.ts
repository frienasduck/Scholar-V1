import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { recordAudit } from "@/lib/subscriptions/audit";
import { readBoundedJson, RequestBodyError } from "@/lib/security/request-body";
import { enforceRateLimit,RateLimitError } from "@/lib/security/rate-limit";
import { preferencesSchema } from "@/lib/personalization/schema";
import { checkGrade, jsonValue, lockAccount, ProfileError, readProfile } from "@/lib/personalization/server";

const writeSchema = z.object({action:z.enum(["begin","save","skip"]),revision:z.number().int().min(0),stage:z.number().int().min(0).max(12).optional(),preferences:preferencesSchema.optional()}).strict();
const headers = {"Cache-Control":"private, no-store"};
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({message:"Sign in to make Scholar yours."},{status:401,headers});
  try { return NextResponse.json(await readProfile(user.id),{headers}); }
  catch { return NextResponse.json({message:"Learning Profile is not available yet. Your normal Scholar workspace is unaffected."},{status:503,headers}); }
}
export async function PATCH(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({message:"Your session expired. Sign in again; your saved answers will be here."},{status:401});
  try {
    const input = writeSchema.parse(await readBoundedJson(request,16*1024));
    await enforceRateLimit(user.id,"personalization-write",90,10*60*1000);
    if (input.preferences && input.action !== "skip") await checkGrade(user.id,input.preferences.grade);
    await db.$transaction(async tx => {
      await lockAccount(tx,user.id);
      const current = await tx.learningProfile.upsert({where:{userId:user.id},create:{userId:user.id},update:{}});
      if (current.revision !== input.revision) throw new ProfileError("Your profile changed in another tab. Reload your saved answers before continuing.");
      if (current.status === "ANALYZING" && current.jobStartedAt && Date.now()-current.jobStartedAt.getTime()<50_000) throw new ProfileError("Scholar is still building your workspace. Please wait a moment.");
      await tx.learningProfile.update({where:{userId:user.id},data:{
        status:input.action === "skip" ? "SKIPPED" : "IN_PROGRESS",
        revision:{increment:1},stage:input.stage ?? current.stage,
        ...(input.preferences && input.action !== "skip" ? {preferences:jsonValue(input.preferences)} : {}),
        ...(input.action === "skip" ? {skippedAt:new Date(),bonusClosedAt:current.bonusClosedAt ?? new Date()} : {}),
        jobToken:null,jobStartedAt:null,
      }});
    });
    if (input.action !== "save") await recordAudit(input.action === "begin" ? "personalization_started" : "personalization_skipped",{actorUserId:user.id});
    return NextResponse.json(await readProfile(user.id),{headers});
  } catch(error) {
    const status = error instanceof ProfileError || error instanceof RequestBodyError ? error.status : error instanceof RateLimitError ? 429 : error instanceof z.ZodError ? 400 : 503;
    return NextResponse.json({message:error instanceof ProfileError ? error.message : error instanceof z.ZodError ? error.issues[0]?.message ?? "Check your preferences." : "Your answers could not be saved. Check your connection and retry."},{status});
  }
}
