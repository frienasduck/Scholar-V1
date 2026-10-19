import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { AIProviderError } from "@/lib/ai/errors";
import { parseJSONObject } from "@/lib/ai/scholar-groq";
import { streamLiveTutorText } from "@/lib/live-tutor/providers";
import { boundedPassages } from "./knowledge/context";
import { builtInMaterials, findLicensed, findUnit, retrieveBuiltIn, sourcePolicyFingerprint } from "./knowledge/library";
import type { Segments } from "./knowledge/generation";
import { gradingPrompt, objectiveVerdict, rubricVerdict } from "./assessment";
import { actionSchema, currentTask, setupSchema, type ExamSession, type Setup } from "./model";
import { createSession, recordAnswer, transition } from "./planner";
import { publicSession, questionFor, storeLesson } from "./server";
import { lessonKey, teach, teachingStyles } from "./teacher";
import { DEV_GUEST_LIMITS, localGuestInputBytes } from "./dev-guest-policy";
import { clarifyPhysicsFeedback } from "./feedback-safety";

export const DEV_GUEST_COOKIE = "scholar_exam_local";
const root = path.join(process.cwd(), ".exam-ready-dev");
const ledgerPath = path.join(root, "approved-budget.json");
const ledgerSchema = z.object({
    approval: z.string().max(120), provider: z.enum(["gemini", "nvidia", "groq"]), model: z.string().min(1).max(160),
    maxRequests: z.number().int().min(0).max(DEV_GUEST_LIMITS.requests), maxReservedTokens: z.number().int().min(0).max(DEV_GUEST_LIMITS.reservedTokens),
    used: z.number().int().nonnegative(), reservedTokens: z.number().int().nonnegative(), halted: z.boolean(),
    lastAt: z.number().nonnegative(), events: z.array(z.object({at:z.number(),provider:z.string(),model:z.string(),inputBytes:z.number(),outputTokens:z.number(),result:z.string().max(120)})).max(12),
});
type Ledger = z.infer<typeof ledgerSchema>;
type LocalState = {sessions: ExamSession[]; segments: Record<string, Segments>; requests: number[]};
export class LocalGuestError extends Error { constructor(message:string, readonly status=409) {super(message);} }
async function atomicJSON(file:string, value:unknown) {
    const temporary = `${file}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(value), {mode:0o600});
    await rename(temporary, file);
}
/** Exclusive cross-process lock. A crash leaves it closed, never resets an allowance. */
async function locked<T>(name:string, work:()=>Promise<T>) {
    await mkdir(root,{recursive:true});
    const file = path.join(root,`${name}.lock`);
    let handle;
    try {handle=await open(file,"wx",0o600);} catch {throw new LocalGuestError("Another local turn is running, or a previous process stopped. No additional AI request was made.");}
    try {return await work();} finally {await handle.close();await unlink(file);}
}
export function newLocalCapability() { return randomBytes(32).toString("hex"); }
function ownerPath(token:string) {
    if(!/^[a-f0-9]{64}$/.test(token))throw new LocalGuestError("Reopen the local workspace to establish a development session.",401);
    return path.join(root,`${createHash("sha256").update(token).digest("hex")}.json`);
}
async function stateFor(token:string):Promise<LocalState> {
    try {return JSON.parse(await readFile(ownerPath(token),"utf8"));}
    catch(error) {if(error && typeof error==="object" && "code" in error && error.code==="ENOENT")return {sessions:[],segments:{},requests:[]};throw error;}
}
async function budget():Promise<Ledger> {
    try {return ledgerSchema.parse(JSON.parse(await readFile(ledgerPath,"utf8")));}
    catch {return {approval:"Not approved",provider:"gemini",model:"gemini-2.5-flash",maxRequests:0,maxReservedTokens:0,used:0,reservedTokens:0,halted:false,lastAt:0,events:[]};}
}
function budgetPublic(value:Ledger) {return {provider:value.provider,model:value.model,remaining:Math.max(0,value.maxRequests-value.used),used:value.used,approved:value.maxRequests>0,halted:value.halted};}
export async function localGuestStatus(token:string) {
    const [state,allowance]=await Promise.all([stateFor(token),budget()]);
    return {enabled:true,sessions:state.sessions.map(publicSession),budget:budgetPublic(allowance)};
}
export function assertLocalMaterials(setup:Setup) {
    if(["personal","personal-scholar"].includes(setup.materials))throw new LocalGuestError("Development Guest teaching cannot access account uploads. Use Scholar materials or selected public library units.",403);
    if(setup.resourceIds.some(id=>!findUnit(id)&&!findLicensed(id)) || (setup.excludedResourceIds??[]).some(id=>id.startsWith("er-user-")))throw new LocalGuestError("Only independent, built-in Exam Ready sources are permitted in local Guest AI.",403);
}
export function localMaterials(s:ExamSession,request="") {
    assertLocalMaterials(s.setup);
    const task=currentTask(s);if(!task)throw new LocalGuestError("Choose an active checkpoint.");
    const scope={grade:s.setup.grade,subjectId:task.subjectId,chapterId:task.chapterId};
    const pageRequested=/\b(?:page|p\.)\s*\d/i.test(request);
    const retrieved=retrieveBuiltIn(scope,task.objectiveIds??[],s.setup.resourceIds,s.setup.excludedResourceIds??[],s.setup.materials,request);
    const focused=task.objectiveIds?.length?retrieved.filter(source=>source.objectiveIds.some(id=>task.objectiveIds!.includes(id))):retrieved;
    const sources=pageRequested?[]:boundedPassages(focused,8000);
    return {sources,resources:builtInMaterials(scope),restricted:true,pageRequested,privateAvailable:false,policyFingerprint:sourcePolicyFingerprint(s)};
}
/** Existing adapters; server-held credentials, one attempt, pinned approved provider/model. */
async function localComplete(_owner:string,prompt:string,signal:AbortSignal,jsonSchema?:Record<string,unknown>,policy?:{maxTokens?:number}) {
    return locked("live-budget",async()=>{
        const allowance=await budget(), inputBytes=localGuestInputBytes(prompt,allowance.provider,jsonSchema), outputTokens=Math.min(policy?.maxTokens??4000,DEV_GUEST_LIMITS.outputTokens);
        if(!allowance.maxRequests || allowance.used>=allowance.maxRequests || allowance.halted)throw new AIProviderError("Local live-AI allowance is not approved, exhausted or halted. No provider request was made; library fallback remains available.",503,"DEV_GUEST_BUDGET_CLOSED");
        if(inputBytes>DEV_GUEST_LIMITS.inputBytes || allowance.reservedTokens+inputBytes+outputTokens>allowance.maxReservedTokens)throw new LocalGuestError("This turn exceeds the approved input/token allowance. No provider request was made.",413);
        if(Date.now()-allowance.lastAt<3000)throw new LocalGuestError("Wait three seconds between local AI turns. No provider request was made.",429);
        const available=allowance.provider==="gemini"?process.env.GEMINI_API_KEY:allowance.provider==="groq"?process.env.GROQ_API_KEY:process.env.NVIDIA_TEXT_API_KEY??process.env.NVIDIA_API_KEY;
        if(!available)throw new AIProviderError(`The approved ${allowance.provider} credential is not configured on this server.`,503,"DEV_GUEST_CREDENTIAL_MISSING");
        allowance.used++;allowance.reservedTokens+=inputBytes+outputTokens;allowance.lastAt=Date.now();
        const event={at:allowance.lastAt,provider:allowance.provider,model:allowance.model,inputBytes,outputTokens,result:"reserved"};allowance.events.push(event);
        // Reserve durably BEFORE transport; failures and restarts never refund or reset calls.
        await atomicJSON(ledgerPath,allowance);
        try {
            let text="";
            await streamLiveTutorText({provider:allowance.provider,model:allowance.model,signal:AbortSignal.any([signal,AbortSignal.timeout(120000)]),deadlineMs:120000,singleAttempt:true,maxTokens:outputTokens,temperature:.25,jsonSchema,
                ...(allowance.provider==="gemini"&&allowance.model.startsWith("gemini-2.5")?{thinkingBudget:0}:{}),
                ...(allowance.provider==="gemini"&&/^gemini-[34]/.test(allowance.model)?{thinkingLevel:"low" as const}:{}),
                ...(allowance.provider==="nvidia"?{nvidiaThinking:false}:{}),
                messages:[{role:"system",content:prompt},{role:"user",content:"Return only the requested JSON result. Cite the supplied passages inline. Do not return the schema."}],
                onDelta:delta=>{text+=delta;if(text.length>60000)throw new LocalGuestError("The live output exceeded its safety limit.",413);}});
            const value=parseJSONObject(text);event.result="response-received";await atomicJSON(ledgerPath,allowance);
            // Bounded, local-only diagnostic artifact. Never served to the client,
            // never contains credentials, and holds only the latest response.
            await atomicJSON(path.join(root,"last-live-response.json"),{provider:allowance.provider,model:allowance.model,value});return value;
        }catch(error){event.result=error instanceof AIProviderError?error.code:"OUTPUT_OR_TRANSPORT_REJECTED";if(error instanceof AIProviderError&&error.status===429)allowance.halted=true;await atomicJSON(ledgerPath,allowance);throw error;}
    });
}
const operationSchema=z.discriminatedUnion("operation",[
    z.object({operation:z.literal("create"),setup:setupSchema}),
    z.object({operation:z.literal("act"),id:z.string().uuid(),revision:z.number().int().nonnegative(),action:actionSchema}),
    z.object({operation:z.literal("teacher"),id:z.string().uuid(),revision:z.number().int().nonnegative(),pace:z.enum(teachingStyles),question:z.string().max(1800).default("")}),
]);
export async function localGuestOperation(token:string,raw:unknown,signal:AbortSignal) {
    const operation=operationSchema.parse(raw);
    return locked("workspace",async()=>{
        const state=await stateFor(token), now=Date.now();state.requests=state.requests.filter(at=>at>now-60000);
        if(state.requests.length>=30)throw new LocalGuestError("Local request limit reached. Wait a minute; your work is preserved.",429);
        state.requests.push(now);await atomicJSON(ownerPath(token),state);
        let session:ExamSession,key:string|undefined;
        if(operation.operation==="create") {
            assertLocalMaterials(operation.setup);
            if(operation.setup.examAt<=now)throw new LocalGuestError("Choose a future exam time.",422);
            if(state.sessions.length>=DEV_GUEST_LIMITS.preparations)throw new LocalGuestError("The local development workspace allows ten preparations.");
            session=createSession(randomUUID(),operation.setup);state.sessions.unshift(session);
        }else{
            const index=state.sessions.findIndex(s=>s.id===operation.id);if(index<0)throw new LocalGuestError("This preparation belongs to another local session or is a previous offline preview. Create a new development preparation.",404);
            session=state.sessions[index];if(session.revision!==operation.revision)throw new LocalGuestError("The local preparation changed. Reload its saved version before retrying.");
            if(operation.operation==="teacher") {
                if(session.status!=="active")throw new LocalGuestError("Resume studying before asking LAM.");
                const selected=localMaterials(session,operation.question);
                key=lessonKey(session,operation.pace,operation.question,selected.sources.map(p=>`${p.citation.resourceId}:${p.version}`));
                const lesson=await teach("local-development",session,operation.pace,operation.question,signal,selected,{forceLive:true,complete:localComplete,
                    read:async(_u,_s,hash)=>structuredClone(state.segments[`${session.id}:${hash}`]??{}),
                    save:async(_u,_s,hash,parts)=>{state.segments[`${session.id}:${hash}`]=parts;state.segments=Object.fromEntries(Object.entries(state.segments).slice(-24));await atomicJSON(ownerPath(token),state);}});
                storeLesson(session,key,lesson,operation.question);
            }else if(operation.action.type==="answer") {
                const action=operation.action,q=questionFor(session,action.questionId);
                if(!q || session.attempts.some(a=>a.questionId===q.id))throw new LocalGuestError("This check was already recorded or is no longer active. Ask for a fresh question to retry.");
                const objective=objectiveVerdict(q,action.answer);
                try {
                    const prompt=gradingPrompt(q,action.answer)+(objective?`\nIndependent deterministic verification: ${JSON.stringify({correct:objective.correct,score:objective.score,maxScore:objective.maxScore,errorCategory:objective.errorCategory})}. Do not contradict this verified quantitative/option verdict. Explain the student's actual error and how to repair it.`:"");
                    const raw=await localComplete("local-development",prompt,signal,undefined,{maxTokens:2000});
                    const ai=rubricVerdict(q,raw),feedback=clarifyPhysicsFeedback(`Live AI feedback:\n\n${ai.feedback}`,q.subjectId,q.chapterId),verdict=objective?{...objective,feedback,evaluation:"objective" as const}:{...ai,feedback};
                    session=recordAnswer(session,q,action.answer,verdict.correct,verdict.evaluation,now,verdict);
                }catch(error){
                    if(!(error instanceof AIProviderError)||![429,502,503,504].includes(error.status))throw error;
                    if(!objective)throw new LocalGuestError("Live AI feedback is unavailable. Your answer is not graded; notes and the independent library still work.",503);
                    session=recordAnswer(session,q,action.answer,objective.correct,objective.evaluation,now,{...objective,feedback:`Live AI feedback unavailable (${error.code}). The following is deterministic question-bank feedback, not a new AI response.\n\n${objective.feedback}`});
                }
            }else {
                if(operation.action.type==="settings")assertLocalMaterials(operation.action.setup);
                session=transition(session,operation.action);
            }
            session.revision++;state.sessions[index]=session;
        }
        if(JSON.stringify(session).length>400000)throw new LocalGuestError("This preparation is too large. Shorten your notes.",413);
        await atomicJSON(ownerPath(token),state);
        return {session:publicSession(session),key,budget:budgetPublic(await budget())};
    });
}
