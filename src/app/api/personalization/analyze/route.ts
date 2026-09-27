import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { recordAudit } from "@/lib/subscriptions/audit";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { readBoundedJson, RequestBodyError } from "@/lib/security/request-body";
import { preferencesSchema } from "@/lib/personalization/schema";
import { buildBlueprint } from "@/lib/personalization/engine";
import { enhanceBlueprint } from "@/lib/personalization/ai-analysis";
import { checkGrade,jsonValue,lockAccount,ProfileError,readProfile } from "@/lib/personalization/server";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({message:"Sign in again to finish your saved setup."},{status:401});
  const token = crypto.randomUUID();
  let preferences;
  try {
    const input = z.object({revision:z.number().int().min(0),useAI:z.boolean().default(true)}).strict().parse(await readBoundedJson(request,1024));
    const existing = await db.learningProfile.findUnique({where:{userId:user.id}});
    if (existing?.status === "COMPLETED" && existing.revision === input.revision) return NextResponse.json({profile:await readProfile(user.id)});
    preferences = preferencesSchema.parse(existing?.preferences);
    await checkGrade(user.id,preferences.grade);
    await enforceRateLimit(user.id,"personalization-analysis",4,10*60*1000);
    await db.$transaction(async tx => {
      await lockAccount(tx,user.id);
      const current = await tx.learningProfile.findUnique({where:{userId:user.id}});
      if (!current || current.revision !== input.revision || !["IN_PROGRESS","FAILED_RETRYABLE","ANALYZING"].includes(current.status)) throw new ProfileError("Reload your saved profile before rebuilding Scholar.");
      if (current.jobStartedAt && Date.now()-current.jobStartedAt.getTime()<50_000) throw new ProfileError("A build is already running. Your saved answers are safe.");
      await tx.learningProfile.update({where:{userId:user.id},data:{status:"ANALYZING",jobToken:token,jobStartedAt:new Date()}});
    });
    const p = preferences;
    const encoder = new TextEncoder();
    let connected = true;
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: object) => { if (connected) { try {controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));} catch {connected=false;} } };
        try {
          send({stage:"profile",message:"Your saved learning profile is validated."});
          const [materials,attempts,dueRevision] = await Promise.all([
            db.customEbook.findMany({where:{userId:user.id,deletedAt:null,allocation:"onboarding"},select:{id:true,title:true},take:30}),
            db.practiceAttempt.count({where:{userId:user.id}}).catch(()=>0),
            db.revisionItem.count({where:{userId:user.id,dueAt:{lte:new Date()},state:{not:"MATURE"}}}).catch(()=>0),
          ]);
          let result = buildBlueprint(p,materials,{attempts,dueRevision});
          send({stage:"priorities",message:`${result.priorities[0]?.name ?? "Your subjects"} is first in your study plan.`});
          if(materials.length) send({stage:"materials",message:`${materials.length} imported books linked. Text was checked during secure PDF import.`});
          send({stage:"lam",message:"LAM explanation and guidance defaults configured."});
          send({stage:"strategy",message:input.useAI ? "Shaping your strategy; a reliable plan is already ready." : "Building your preference-based study strategy."});
          if(input.useAI) {
            const samples=materials.length ? await db.customEbook.findMany({where:{userId:user.id,deletedAt:null,allocation:"onboarding"},select:{title:true,text:true},orderBy:{createdAt:"desc"},take:3}) : [];
            result = await enhanceBlueprint(result,p,AbortSignal.timeout(12_000),samples);
          }
          await checkGrade(user.id,p.grade);
          await db.$transaction(async tx => {
            await lockAccount(tx,user.id);
            const current = await tx.learningProfile.findUnique({where:{userId:user.id}});
            if(current?.jobToken !== token) throw new ProfileError("This build was superseded. Reload your latest profile.");
            await tx.learningProfile.update({where:{userId:user.id},data:{status:"COMPLETED",required:false,result:jsonValue(result),completedAt:new Date(),bonusClosedAt:current.bonusClosedAt ?? new Date(),jobToken:null,jobStartedAt:null}});
            await tx.user.update({where:{id:user.id},data:{currentScholarClass:p.grade}});
          });
          send({stage:"dashboard",message:"Scholar Today and your recommendations are saved."});
          send({profile:await readProfile(user.id)});
          await recordAudit("personalization_completed",{actorUserId:user.id});
        } catch {
          await db.learningProfile.updateMany({where:{userId:user.id,jobToken:token},data:{status:"FAILED_RETRYABLE",jobToken:null,jobStartedAt:null}}).catch(()=>undefined);
          send({message:"Your answers are saved. Scholar could not finish the build; retry without AI or check your connection.",error:true});
          await recordAudit("personalization_failed",{actorUserId:user.id});
        } finally {if(connected) {try {controller.close();} catch { /* disconnected */ }} }
      },
      cancel(){connected=false;},
    });
    return new Response(stream,{headers:{"Content-Type":"text/event-stream","Cache-Control":"private, no-store","X-Accel-Buffering":"no"}});
  } catch(error) {
    const status = error instanceof ProfileError || error instanceof RequestBodyError ? error.status : error instanceof RateLimitError ? 429 : error instanceof z.ZodError ? 400 : 503;
    return NextResponse.json({message:error instanceof ProfileError ? error.message : status === 429 ? "You have rebuilt several times. Please try again in a few minutes." : "Your setup could not start. Your saved answers are safe; retry shortly."},{status});
  }
}
