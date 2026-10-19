import { expect,mock,test } from "bun:test";
mock.module("server-only",()=>({}));
const {streamLiveTutorText}=await import("../src/lib/live-tutor/providers");
const originalFetch=globalThis.fetch;
test("existing Gemini SDK retains 404/429 status with one fetch and no automatic provider retry",async()=>{
    for(const status of [404,429]) {
        let calls=0;globalThis.fetch=Object.assign(async()=>{calls++;return Response.json({error:{code:status,status:status===404?"NOT_FOUND":"RESOURCE_EXHAUSTED",message:"Synthetic unavailable response"}},{status});},originalFetch);
        try{await expect(streamLiveTutorText({provider:"gemini",credential:{apiKey:"synthetic-no-network",model:"gemini-3.8-flash"},messages:[{role:"user",content:"Synthetic fixture"}],singleAttempt:true,signal:AbortSignal.timeout(5000),onDelta:()=>{}})).rejects.toMatchObject({code:status===404?"GEMINI_MODEL_UNAVAILABLE":"GEMINI_RATE_LIMITED"});expect(calls).toBe(1);}finally{globalThis.fetch=originalFetch;}
    }
});
test("Gemini 3.x contract removes obsolete temperature, pins low thinking and requests structured JSON",async()=>{
    let payload:Record<string,unknown>={};globalThis.fetch=Object.assign(async(_url:unknown,init?:RequestInit)=>{payload=JSON.parse(String(init?.body));return new Response('data: {"candidates":[{"content":{"parts":[{"text":"{\\"text\\":\\"Synthetic fixture\\"}"}]},"finishReason":"STOP"}]}\n\n',{headers:{"content-type":"text/event-stream"}});},originalFetch);
    try{let result="";await streamLiveTutorText({provider:"gemini",credential:{apiKey:"synthetic-no-network",model:"gemini-3.8-flash"},messages:[{role:"user",content:"Synthetic fixture"}],singleAttempt:true,thinkingLevel:"low",jsonSchema:{type:"object"},maxTokens:2400,signal:AbortSignal.timeout(5000),onDelta:delta=>{result+=delta;}});expect(result).toContain("Synthetic fixture");expect(payload.generationConfig).toMatchObject({maxOutputTokens:2400,responseMimeType:"application/json",thinkingConfig:{thinkingLevel:"LOW"}});expect(payload.generationConfig).not.toHaveProperty("temperature");}finally{globalThis.fetch=originalFetch;}
});
