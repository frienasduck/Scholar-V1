import "server-only";
import { z } from "zod";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { ProfileError } from "@/lib/personalization/server";
import { arithmetic } from "../assessment";
import { lessonSchema, type Lesson } from "../model";
import { AIProviderError } from "@/lib/ai/errors";

const coreSchema = z.object({ text: z.string().min(100).max(16000), concept: z.object({ title: z.string().min(1).max(160), explanation: z.string().min(120).max(2400), formula: z.string().max(500).optional(), symbols: z.string().max(1200).optional(), conditions: z.string().max(1200).optional() }).optional(), formulas: z.array(z.string().max(500)).max(12).default([]), takeaway: z.string().max(1200).optional() });
const exampleSchema = z.object({ title: z.string().min(1).max(160), problem: z.string().min(8).max(1800), steps: z.array(z.string().min(1).max(1000)).min(3).max(8), result: z.string().min(1).max(1000), calculations: z.array(z.object({ expression:z.string().max(200), value:z.number().finite(), unit:z.string().max(60), tolerance:z.number().min(0).max(.01) })).max(8).optional() });
export function generationContract(stage:"full"|"core"|"example"|"questions") {
  const schema=stage==="core"?coreSchema:stage==="example"?z.object({example:exampleSchema}):stage==="questions"?z.object({questions:lessonSchema.shape.questions}):lessonSchema;
  const nullableOptional=(raw:Record<string,unknown>):Record<string,unknown>=>{
    const result={...raw};delete result.$schema;delete result.default;
    if(result.properties&&typeof result.properties==="object") {const required=new Set(Array.isArray(result.required)?result.required:[]);result.properties=Object.fromEntries(Object.entries(result.properties).map(([key,child])=>[key,required.has(key)?nullableOptional(child as Record<string,unknown>):{anyOf:[nullableOptional(child as Record<string,unknown>),{type:"null"}]}]));}
    if(result.items&&typeof result.items==="object")result.items=nullableOptional(result.items as Record<string,unknown>);
    if(Array.isArray(result.anyOf))result.anyOf=result.anyOf.map(child=>nullableOptional(child as Record<string,unknown>));
    return result;
  };
  return nullableOptional(z.toJSONSchema(schema) as Record<string,unknown>);
}
export type Segments = { core?: z.infer<typeof coreSchema>; example?: z.infer<typeof exampleSchema>; questions?: unknown[]; rejectedOutput?:{stage:string;data:unknown}; failed?: string[]; diagnostics?: Record<string,string[]>; providerFailure?: {code:string;status:number;retryAt?:number} };
export function acceptedCore(raw: unknown, teaching: boolean) {
  const core = coreSchema.parse(raw);
  if(/^(?:intuitive explanation of|lesson outline|outline:)/i.test(core.text)) throw new Error("OUTLINE_NOT_TEACHING");
  if(/middle\s+term(?:\(s\)|s)?\s+(?:are|is)\s+always\s+(?:the\s+)?largest(?!\s+(?:binomial\s+)?coefficients)/i.test(core.text)) throw new Error("KNOWN_BINOMIAL_MISCONCEPTION");
  if (teaching && (!core.concept || core.text.length + core.concept.explanation.length < 650)) throw new Error("SHALLOW_CORE");
  return core;
}
export function acceptedExample(raw: unknown) {
  const example = exampleSchema.parse(raw);
  if(example.steps.join(" ").length<140) throw new Error("SHALLOW_EXAMPLE");
  if (/\d[\s\u202f]*(?:kg|N\b|mol|m\b|°)/.test(example.problem) || /coefficient/i.test(example.problem)) {
    if(!example.calculations?.length) throw new Error("CALCULATION_REQUIRED");
  }
  for(const c of example.calculations??[]) if(Math.abs(arithmetic(c.expression)-c.value)>Math.max(1e-9,Math.abs(c.value)*c.tolerance)) throw new Error("CALCULATION_REJECTED");
  const final = example.calculations?.at(-1), normalized = example.result.replace(/²/g,"^2").replace(/³/g,"^3");
  const plain=normalized.replace(/−/g,"-").match(/^(?:(?:the )?(?:coefficient|constant term|answer|result)(?: is)?[:= ]+)?([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:\s*\/\s*\d+)?)\.?\s*$/i);
  if(final&&!final.unit&&plain&&Math.abs(arithmetic(plain[1])-final.value)>Math.max(1e-9,Math.abs(final.value)*final.tolerance))throw new Error("RESULT_TRACE_MISMATCH");
  const sameUnit = final?.unit ? [...normalized.matchAll(/([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*([a-z][a-z0-9/*^-]*)/gi)].filter(m=>m[2].toLowerCase()===final.unit.toLowerCase()).at(-1) : undefined;
  if(sameUnit && final && Math.abs(Number(sameUnit[1])-final.value)>Math.max(1e-9,Math.abs(final.value)*final.tolerance)) throw new Error("RESULT_TRACE_MISMATCH");
  if (/\b(wait,?\s*(?:check|actually)|correct answer:)\b/i.test(example.steps.join(" "))) throw new Error("CONTRADICTORY_EXAMPLE");
  return example;
}
export function contextHash(key: string) { return createHash("sha256").update(key).digest("hex"); }
export async function readSegments(userId:string,sessionId:string,hash:string) {
  const rows=await db.$queryRaw<{segments:Segments}[]>`SELECT "segments" FROM "ExamReadyGeneration" WHERE "userId"=${userId} AND "sessionId"=${sessionId} AND "contextHash"=${hash} LIMIT 1`;
  return rows[0]?.segments??{};
}
export async function saveSegments(userId:string,sessionId:string,hash:string,segments:Segments) {
  if(JSON.stringify(segments).length>60000) throw new Error("GENERATION_CHECKPOINT_LIMIT");
  // The session owner AND active teacher lease fence every durable stage write.
  const changed=await db.$executeRaw`INSERT INTO "ExamReadyGeneration" ("id","userId","sessionId","contextHash","segments") SELECT ${`${sessionId}:${hash}`},${userId},${sessionId},${hash},${JSON.stringify(segments)}::jsonb FROM "ExamReadySession" WHERE "id"=${sessionId} AND "userId"=${userId} AND "leaseUntil">NOW() ON CONFLICT ("userId","sessionId","contextHash") DO UPDATE SET "segments"=EXCLUDED."segments","updatedAt"=NOW()`;
  if(changed!==1) throw new ProfileError("The teaching lease changed. The missing segment was not recorded; reload before retrying.",409);
  await db.$executeRaw`DELETE FROM "ExamReadyGeneration" WHERE "userId"=${userId} AND "sessionId"=${sessionId} AND "contextHash"<>${hash} AND "id" NOT IN (SELECT "id" FROM "ExamReadyGeneration" WHERE "userId"=${userId} AND "sessionId"=${sessionId} ORDER BY "updatedAt" DESC LIMIT 12)`;
}
/** One provider call per request. Retain valid segments; explicitly retry only failures. */
export async function stagedLesson(options: {
  saved: Segments; teaching: boolean; needExample: boolean;
  generate:(stage:"full"|"core"|"example"|"questions",saved:Segments)=>Promise<unknown>;
  normalize:(raw:unknown)=>unknown; validate:(raw:unknown)=>Lesson;
  checkpoint:(segments:Segments)=>Promise<void>;
  validateCore?:(core:NonNullable<Segments["core"]>)=>void;
  validateQuestions?:(questions:unknown)=>unknown[];
}): Promise<{lesson?:Lesson;segments:Segments;pending:string[];providerFailure?:AIProviderError;restored?:boolean}> {
  const parts:Segments={...options.saved}, stage = !parts.core ? Object.keys(parts).length ? "core" : "full" : options.needExample && !parts.example ? "example" : "questions";
  if(parts.core && (!options.needExample || parts.example) && parts.questions) {
    try { const lesson=options.validate({...parts.core,example:parts.example,questions:parts.questions});return {lesson,segments:parts,pending:[]}; } catch { /* Repair only the rejected remainder below. */ }
  }
  let raw:unknown;
  // A repaired decoder can recover an actual prior provider response without
  // billing another call. All academic/source validators still apply. If it
  // remains invalid, the explicit retry below asks for the missing stage only.
  if(!parts.core&&parts.rejectedOutput?.stage==="core") {
    try {
      const core=acceptedCore(options.normalize(parts.rejectedOutput.data),options.teaching);options.validateCore?.(core);
      if(!options.needExample||parts.example){const lesson=options.validate({...core,example:parts.example,questions:parts.questions??[]});parts.core=core;parts.questions=lesson.questions;parts.failed=[];delete parts.rejectedOutput;delete parts.providerFailure;await options.checkpoint(parts);return {lesson,segments:parts,pending:[],restored:true};}
    }catch{/* Never accept a shallow or ungrounded candidate merely to avoid a call. */}
  }
  try {
    if(parts.providerFailure?.retryAt && parts.providerFailure.retryAt>Date.now()) throw new AIProviderError("Scholar AI is still rate-limited. Your saved material is retained.",429,parts.providerFailure.code,Math.ceil((parts.providerFailure.retryAt-Date.now())/1000));
    raw=await options.generate(stage,parts);
    delete parts.providerFailure;
  } catch(error) {
    if(!(error instanceof AIProviderError) || ![429,502,503,504].includes(error.status)) throw error;
    parts.providerFailure={code:error.code,status:error.status,...(error.retryAfterSeconds?{retryAt:Date.now()+error.retryAfterSeconds*1000}:{})};
    parts.failed=[...(!parts.core?["core"]:[]),...(options.needExample&&!parts.example?["example"]:[]),...(!parts.questions?["questions"]:[])];
    await options.checkpoint(parts);
    return {segments:parts,pending:parts.failed,providerFailure:error};
  }
  const normalized=options.normalize(raw);
  const value=normalized&&typeof normalized==="object"&&!Array.isArray(normalized)?normalized as Record<string,unknown>:{};
  const failed:string[]=[];
  const rejected=(stage:string,error:unknown)=>{failed.push(stage);const reason=error instanceof z.ZodError?error.issues.slice(0,2).map(issue=>`${issue.path.join(".")}: ${issue.message}`).join("; ").slice(0,200):error instanceof Error?error.message.slice(0,200):"Segment did not meet its validation contract";parts.diagnostics={...parts.diagnostics,[stage]:[reason]};};
  if(!parts.core) { try { const core=acceptedCore(value,options.teaching); options.validateCore?.(core); parts.core=core; } catch(error) { rejected("core",error); } }
  if(options.needExample && !parts.example) { try { parts.example=acceptedExample(value.example??(stage==="example"?value:undefined)); } catch(error) { rejected("example",error); } }
  if(!parts.questions && options.validateQuestions && Array.isArray(value.questions)) {try{parts.questions=options.validateQuestions(value.questions);}catch(error){rejected("questions",error);}}
  if(parts.core && (!options.needExample || parts.example)) {
    try { const lesson=options.validate({...parts.core,example:parts.example,questions:parts.questions??(Array.isArray(value.questions)?value.questions:[])}); parts.questions=lesson.questions; parts.failed=[]; await options.checkpoint(parts); return {lesson,segments:parts,pending:[]}; }
    catch(error) { delete parts.questions; rejected("questions",error); }
  }
  parts.failed=[...new Set([...failed,...(!parts.core?["core"]:[]),...(options.needExample&&!parts.example?["example"]:[]),...(!parts.questions?["questions"]:[])])];
  if(!parts.core&&stage==="core"&&raw!==undefined&&(JSON.stringify(raw)??"").length<30000)parts.rejectedOutput={stage,data:raw};
  await options.checkpoint(parts);
  return {segments:parts,pending:parts.failed};
}
