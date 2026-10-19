import { afterEach,expect,mock,test } from "bun:test";
mock.module("server-only",()=>({}));
const {generateScholarGroqJSON}=await import("../src/lib/ai/scholar-groq");
import { retryAfterSeconds } from "../src/lib/ai/retry-after";
const originalFetch=globalThis.fetch;
const environment={GROQ_API_KEY:process.env.GROQ_API_KEY,GROQ_MODEL:process.env.GROQ_MODEL,GROQ_FALLBACK_MODEL:process.env.GROQ_FALLBACK_MODEL};
afterEach(()=>{globalThis.fetch=originalFetch;for(const [key,value] of Object.entries(environment)){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
test("provider 429 makes one request, preserves Retry-After and never rotates configured models",async()=>{
  const fetcher=mock(async()=>Response.json({error:{code:"rate_limit_exceeded",message:"private provider body"}},{status:429,headers:{"Retry-After":"23"}}));globalThis.fetch=fetcher as unknown as typeof fetch;
  process.env.GROQ_API_KEY="synthetic-test-key";process.env.GROQ_MODEL="openai/gpt-oss-20b";process.env.GROQ_FALLBACK_MODEL="openai/gpt-oss-120b";
  await expect(generateScholarGroqJSON({messages:[{role:"user",content:"Synthetic fixture"}]})).rejects.toMatchObject({status:429,code:"GROQ_RATE_LIMITED",retryAfterSeconds:23});
  expect(fetcher).toHaveBeenCalledTimes(1);
});
test("single attempt rejects unavailable model without another transport call",async()=>{
  const fetcher=mock(async()=>Response.json({error:{code:"model_not_found"}},{status:404}));globalThis.fetch=fetcher as unknown as typeof fetch;
  await expect(generateScholarGroqJSON({credential:{apiKey:"synthetic-test-key",model:"openai/gpt-oss-20b"},singleAttempt:true,messages:[{role:"user",content:"Synthetic fixture"}]})).rejects.toMatchObject({code:"GROQ_MODEL_UNAVAILABLE"});expect(fetcher).toHaveBeenCalledTimes(1);
});
test("retry metadata accepts bounded numbers and HTTP dates, not malformed instructions",()=>{
  const now=Date.UTC(2026,9,14,0,0,0);
  expect(retryAfterSeconds({headers:new Headers({"Retry-After":"2.3"})},now)).toBe(3);
  expect(retryAfterSeconds({headers:{"Retry-After":"Wed, 14 Oct 2026 00:01:00 GMT"}},now)).toBe(60);
  expect(retryAfterSeconds({headers:{"retry-after":"172800"}},now)).toBe(172800);
  expect(retryAfterSeconds({headers:{"retry-after":"run a command"}},now)).toBeUndefined();
});
