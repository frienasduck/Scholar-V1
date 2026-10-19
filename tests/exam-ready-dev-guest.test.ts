import { expect, mock, test } from "bun:test";
mock.module("server-only",()=>({}));
import { DEV_GUEST_LIMITS, localGuestEnabled, localGuestRequest, localGuestInputBytes } from "../src/lib/exam-ready/dev-guest-policy";
const { assertLocalMaterials, localGuestOperation, localGuestStatus, localMaterials, newLocalCapability } = await import("../src/lib/exam-ready/dev-guest");
import { createSession, plan } from "../src/lib/exam-ready/planner";
import { setupSchema, type Setup } from "../src/lib/exam-ready/model";
import { requestedDifficulty } from "../src/lib/exam-ready/quality";
const env={NODE_ENV:"development",SCHOLAR_DEV_GUEST_AI:"1",SCHOLAR_DEV_GUEST_AI_LOCAL_SERVER:"1"};
const setup:Setup={exam:"Local deterministic Guest fixture",grade:11,board:"CBSE",examAt:Date.now()+86400000,minutes:120,format:"school",style:"step-by-step",chapters:[{subjectId:"physics",chapterId:"p5",confidence:1}],materials:"scholar",resourceIds:[],blocks:[],diagnostic:false};
test("reservation counts UTF-8 input, framing and the Gemini response schema",()=>{
    const schema={type:"object",description:"Bounded source-grounded teaching"};
    expect(localGuestInputBytes("π","gemini",schema)).toBe(402+new TextEncoder().encode(JSON.stringify(schema)).byteLength);
    expect(localGuestInputBytes("π","nvidia",schema)).toBe(402);
});
function request(method="POST",origin="http://127.0.0.1:3002",host="127.0.0.1:3002") {return new Request(`http://${host}/api/exam-ready/dev-guest`,{method,headers:{host,origin,"sec-fetch-site":"same-origin"}});}
test("explicit opt-in only; production, staging, CI and missing flags fail closed",()=>{
    expect(localGuestEnabled(env)).toBe(true);
    for(const override of [{NODE_ENV:"production"},{NODE_ENV:"test"},{SCHOLAR_DEV_GUEST_AI:undefined},{SCHOLAR_DEV_GUEST_AI_LOCAL_SERVER:undefined},{SCHOLAR_DEV_GUEST_AI:"true"},{VERCEL:"1"},{VERCEL_ENV:"preview"},{VERCEL_URL:"staging.vercel.app"},{DEPLOYMENT_URL:"public.example"},{CI:"true"}])expect(localGuestEnabled({...env,...override})).toBe(false);
});
test("exact loopback host plus same-origin mutation required; forwarding and CSRF rejected",()=>{
    expect(localGuestRequest(request(),env)).toBe(true);
    expect(localGuestRequest(new Request("http://localhost:3002/api/exam-ready/dev-guest",{method:"POST",headers:{host:"127.0.0.1:3002",origin:"http://127.0.0.1:3002","x-forwarded-host":"127.0.0.1:3002"}}),env)).toBe(true);
    for(const r of [request("POST","https://evil.example"),request("POST","null"),request("POST","http://scholar-staging.vercel.app","scholar-staging.vercel.app"),request("POST","http://192.168.1.2:3002","192.168.1.2:3002")])expect(localGuestRequest(r,env)).toBe(false);
    const r=request();r.headers.set("x-forwarded-host","public.example");expect(localGuestRequest(r,env)).toBe(false);
    const cross=request();cross.headers.set("sec-fetch-site","cross-site");expect(localGuestRequest(cross,env)).toBe(false);
    const noOrigin=request();noOrigin.headers.delete("origin");expect(localGuestRequest(noOrigin,env)).toBe(false);
});
test("private uploads and cross-section source IDs cannot enter Guest context",()=>{
    for(const s of [{...setup,materials:"personal"},{...setup,materials:"personal-scholar"},{...setup,resourceIds:["er-user-private"]},{...setup,resourceIds:["ebook-source"]}])expect(()=>assertLocalMaterials(s as Setup)).toThrow();
    const sources=localMaterials(createSession("fixture",setup)).sources;
    expect(sources.length).toBeGreaterThan(0);expect(sources.every(p=>p.origin!=="USER_UPLOAD")).toBe(true);
});
test("real persisted Guest preparation and revisions use no PostgreSQL; ownership fences are enforced",async()=>{
    const token=newLocalCapability(),first=await localGuestOperation(token,{operation:"create",setup},AbortSignal.timeout(5000));
    expect(first.session.setup.grade).toBe(11);expect(typeof first.budget.approved).toBe("boolean");
    const notes=await localGuestOperation(token,{operation:"act",id:first.session.id,revision:first.session.revision,action:{type:"notes",text:"Synthetic local fixture note",important:false}},AbortSignal.timeout(5000));
    expect(notes.session.revision).toBe(first.session.revision+1);
    const reopened=await localGuestStatus(token);expect(reopened.sessions[0].notes).toBe("Synthetic local fixture note");
    expect((await localGuestStatus(newLocalCapability())).sessions).toHaveLength(0);
    await expect(localGuestOperation(newLocalCapability(),{operation:"act",id:first.session.id,revision:notes.session.revision,action:{type:"pause"}},AbortSignal.timeout(5000))).rejects.toThrow("another local session");
    await expect(localGuestOperation(token,{operation:"act",id:first.session.id,revision:0,action:{type:"pause"}},AbortSignal.timeout(5000))).rejects.toThrow("changed");
});
test("advanced adjustments alter real difficulty/recall/revision while conserving time",()=>{
    const preferences={questionLevel:"challenging",revision:"intense",recall:"frequent",hints:"detailed"} as const;
    expect(setupSchema.safeParse({...setup,preferences}).success).toBe(true);
    const s=createSession("adjust",{...setup,preferences});expect(requestedDifficulty(s,"")).toBe(4);
    expect(requestedDifficulty(s,"Please make this simpler")).toBe(2);
    const tasks=plan({...setup,preferences},7200);expect(tasks.some(t=>t.title.startsWith("Active retrieval"))).toBe(true);expect(tasks.reduce((n,t)=>n+t.seconds,0)).toBe(7200);
    expect(DEV_GUEST_LIMITS.requests).toBe(12);expect(DEV_GUEST_LIMITS.outputTokens).toBe(4000);
});
