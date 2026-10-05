import { beforeEach, expect, mock, test } from "bun:test";
mock.module("server-only", () => ({}));
let signedIn=true, conflict=false, plus=true, planAvailable=true;
const sql: Array<{command:string;values:unknown[]}> = [];
mock.module("../src/lib/auth/session",()=>({getSessionUser:async()=>signedIn?{id:"owner-A",name:"A",email:"a@example.test"}:null}));
mock.module("../src/lib/subscriptions/entitlements",()=>({requireEntitlement:async(feature:string)=>{
  if (!signedIn) return {ok:false,response:Response.json({error:"AUTH_REQUIRED"},{status:401})};
  if (!planAvailable) return {ok:false,response:Response.json({error:"ENTITLEMENTS_UNAVAILABLE"},{status:503})};
  if (!plus) return {ok:false,response:Response.json({error:"PLUS_REQUIRED",feature},{status:403})};
  return {ok:true,user:{id:"owner-A"},access:{plan:"PLUS"}};
}}));
mock.module("../src/lib/auth/request-security",()=>({assertAuthMutation:(request:Request)=>{if(request.headers.get("origin") && request.headers.get("origin")!==new URL(request.url).origin)throw new Error("Cross origin");}}));
mock.module("../src/lib/security/rate-limit",()=>({enforceRateLimit:async()=>{},RateLimitError:class extends Error{}}));
const execute=async(parts:TemplateStringsArray,...values:unknown[])=>{sql.push({command:parts.join("?"),values});return parts[0].startsWith("UPDATE")&&conflict?0:1;};
mock.module("../src/lib/db",()=>({db:{$queryRaw:async(parts:TemplateStringsArray,...values:unknown[])=>{sql.push({command:parts.join("?"),values});return [];},$transaction:async(fn:(tx:unknown)=>unknown)=>fn({$executeRaw:execute})}}));
const libraryRoute=await import("../src/app/api/study-music/library/route");
const metadataRoute=await import("../src/app/api/study-music/metadata/route");
const {resolveMusicMetadata}=await import("../src/lib/study-music/metadata");
const {emptyLibrary}=await import("../src/lib/study-music/model");
const request=(data:unknown,origin="http://localhost")=>new Request("http://localhost/api/study-music/library?userId=owner-B",{method:"PUT",headers:{"Content-Type":"application/json",origin},body:JSON.stringify(data)});
beforeEach(()=>{signedIn=true;conflict=false;plus=true;planAvailable=true;sql.length=0;});

test("Free, guest and unavailable plans cannot use music library or metadata APIs",async()=>{
  const previous=globalThis.fetch;let fetches=0;
  globalThis.fetch=(async()=>{fetches++;return Response.json({});}) as unknown as typeof fetch;
  try {
    for (const state of [{signedIn:false,plus:false,planAvailable:true,status:401},{signedIn:true,plus:false,planAvailable:true,status:403},{signedIn:true,plus:true,planAvailable:false,status:503}]) {
      signedIn=state.signedIn;plus=state.plus;planAvailable=state.planAvailable;
      const responses=[await libraryRoute.GET(),await libraryRoute.PUT(request({revision:0,library:emptyLibrary()})),await metadataRoute.POST(new Request("http://localhost/api/study-music/metadata",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:"https://youtu.be/Abcdef12345"})}))];
      for (const response of responses) {expect(response.status).toBe(state.status);expect(response.headers.get("Cache-Control")).toBe("private, no-store");}
    }
    expect(sql).toHaveLength(0);expect(fetches).toBe(0);
  } finally {globalThis.fetch=previous;}
});
test("unauthenticated requests never read or change a music library",async()=>{signedIn=false;expect((await libraryRoute.GET()).status).toBe(401);expect((await libraryRoute.PUT(request({revision:0,library:emptyLibrary()}))).status).toBe(401);expect(sql).toHaveLength(0);});
test("library reads and writes always use the server session owner, not supplied IDs",async()=>{await libraryRoute.GET();expect(sql[0].values).toEqual(["owner-A"]);const res=await libraryRoute.PUT(request({revision:0,library:emptyLibrary(),userId:"owner-B"}));expect(res.status).toBe(200);expect(sql.every(q=>!q.values.includes("owner-B"))).toBe(true);expect(sql[2].values).toContain("owner-A");expect(sql[2].command).toContain('AND "revision"');});
test("cross-origin requests cannot mutate the library",async()=>{expect((await libraryRoute.PUT(request({revision:0,library:emptyLibrary()},"https://evil.test"))).status).not.toBe(200);expect(sql).toHaveLength(0);});
test("concurrent version conflicts do not overwrite another device's library",async()=>{conflict=true;expect((await libraryRoute.PUT(request({revision:0,library:emptyLibrary()}))).status).toBe(409);});
test("invalid library structures and oversized bodies are rejected before database access",async()=>{expect((await libraryRoute.PUT(request({revision:-1,library:emptyLibrary()}))).status).toBe(400);expect(sql).toHaveLength(0);expect((await libraryRoute.PUT(request({padding:"x".repeat(600000)}))).status).toBe(413);});
test("metadata resolver never fetches user-controlled hosts, ignores oEmbed HTML and bounds responses",async()=>{
  const previous=globalThis.fetch;const calls:string[]=[];
  globalThis.fetch=(async(input)=>{calls.push(String(input));return Response.json({title:"A <b>song</b>",author_name:"Creator",thumbnail_url:"https://evil.test/image",html:"<script>bad()</script>"});}) as typeof fetch;
  try {await expect(resolveMusicMetadata("https://127.0.0.1/private")).rejects.toThrow();expect(calls).toHaveLength(0);const track=await resolveMusicMetadata("https://youtu.be/Abcdef12345?list=private");expect(calls[0].startsWith("https://www.youtube.com/oembed?")).toBe(true);expect(calls[0]).not.toContain("private");expect(track.thumbnail).toBe("https://i.ytimg.com/vi/Abcdef12345/hqdefault.jpg");expect(track).not.toHaveProperty("html");expect(track.durationSeconds).toBeNull();await resolveMusicMetadata("https://youtube.com/watch?v=Abcdef12345");expect(calls).toHaveLength(1);}finally{globalThis.fetch=previous;}
});
test("metadata failure is explicit and unavailable videos are not invented",async()=>{const previous=globalThis.fetch;globalThis.fetch=(async()=>new Response("Unavailable",{status:404})) as unknown as typeof fetch;try{await expect(resolveMusicMetadata("https://youtu.be/Unavailable")).rejects.toThrow("unavailable");}finally{globalThis.fetch=previous;}});
test("metadata route rejects non-video links and cross-origin lookups",async()=>{for(const url of ["https://youtube.com/playlist?list=abc","https://private.test/v"]){const res=await metadataRoute.POST(new Request("http://localhost/api/study-music/metadata",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url})}));expect(res.status).toBe(422);}});
