import { beforeEach, expect, mock, test } from "bun:test";
mock.module("server-only",()=>({}));
type Event={id:string;userId:string;feature:string;periodDay:string;idempotencyKey:string;status:string;createdAt:Date;units:number};
let events:Event[]=[]; let counters=new Map<string,number>(); let serial:Promise<unknown>=Promise.resolve();
const key=(x:{userId:string;key:string;day:string})=>`${x.userId}:${x.key}:${x.day}`;
function matches(e:Event,w:Record<string,unknown>):boolean {
  return Object.entries(w).every(([k,v])=>{ if(k==="createdAt" && typeof v==="object"&&v){const bounds=v as {gte?:Date;lt?:Date};return (!bounds.gte||e.createdAt>=bounds.gte)&&(!bounds.lt||e.createdAt<bounds.lt);} return e[k as keyof Event]===v; });
}
const tx={
  usageEvent:{findUnique:async({where}:{where:{idempotencyKey:string}})=>events.find(e=>e.idempotencyKey===where.idempotencyKey)??null,count:async({where}:{where:Record<string,unknown>})=>events.filter(e=>matches(e,where)).length,create:async({data}:{data:Omit<Event,"id"|"units"|"createdAt">})=>{const e={...data,id:String(events.length+1),units:1,createdAt:new Date()};events.push(e);return e;},updateMany:async({where,data}:{where:Record<string,unknown>;data:Partial<Event>})=>{const list=events.filter(e=>matches(e,where));list.forEach(e=>Object.assign(e,data));return{count:list.length};}},
  usageCounter:{findUnique:async({where}:{where:{userId_key_day:{userId:string;key:string;day:string}}})=>({count:counters.get(key(where.userId_key_day))??0}),upsert:async({where,create,update}:{where:{userId_key_day:{userId:string;key:string;day:string}};create:{count:number};update:{count:{increment:number}}})=>{const k=key(where.userId_key_day);counters.set(k,counters.has(k)?counters.get(k)!+update.count.increment:create.count);return{count:counters.get(k)};}},
  $executeRaw:async()=>1,
};
mock.module("../src/lib/db",()=>({db:{...tx,user:{findUnique:async()=>({timezone:"Asia/Kolkata"})},$transaction:<T>(fn:(t:typeof tx)=>Promise<T>)=>{const next=serial.then(()=>fn(tx));serial=next.catch(()=>{});return next;}}}));
const {reserveMonthlyUsage,commitMonthlyUsage,releaseMonthlyUsage,MonthlyQuotaError}=await import("../src/lib/subscriptions/monthly-usage");
import type { ResolvedEntitlements } from "../src/lib/subscriptions/entitlements";
const access={authenticated:true,entitlementsLoaded:true,plan:"FREE"} as ResolvedEntitlements;
const reserve=(id:string,userId="u")=>reserveMonthlyUsage({userId,feature:"ai_video_generation",idempotencyKey:id,access});
beforeEach(()=>{events=[];counters=new Map();serial=Promise.resolve();});
test("concurrent full generations cannot exceed ten reservations",async()=>{const results=await Promise.allSettled(Array.from({length:11},(_,i)=>reserve(`k${i}`)));expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(10);expect(results.find(r=>r.status==="rejected")!.status).toBe("rejected");expect(events).toHaveLength(10);});
test("retrying a creation key is idempotent",async()=>{await reserve("same");await reserve("same");expect(events).toHaveLength(1);});
test("only readiness commits; repeat completion does not double charge",async()=>{await reserve("one");expect([...counters.values()]).toEqual([]);await commitMonthlyUsage("u","one");await commitMonthlyUsage("u","one");expect([...counters.values()]).toEqual([1]);expect(events[0].status).toBe("consumed");});
test("failed/cancelled work releases the reservation and capacity",async()=>{for(let i=0;i<10;i++)await reserve(`k${i}`);await releaseMonthlyUsage("u","k0");await expect(reserve("replacement")).resolves.toBeDefined();});
test("deleting completed work cannot refund a consumed full generation",async()=>{await reserve("one");await commitMonthlyUsage("u","one");await releaseMonthlyUsage("u","one");expect(events[0].status).toBe("consumed");expect([...counters.values()]).toEqual([1]);});
test("stale abandoned reservations expire without consuming usage",async()=>{await reserve("old");events[0].createdAt=new Date(Date.now()-16*60000);await reserve("fresh");expect(events[0].status).toBe("released");expect([...counters.values()]).toEqual([]);});
test("cross-account replay and commit are rejected",async()=>{await reserve("one");await expect(reserve("one","attacker")).rejects.toThrow("CONFLICT");await expect(commitMonthlyUsage("attacker","one")).rejects.toThrow("INVALID");});
test("verified Plus reservation is unlimited, failure still refundable",async()=>{for(let i=0;i<12;i++)await reserveMonthlyUsage({userId:"u",feature:"ai_video_generation",idempotencyKey:`p${i}`,access:{...access,plan:"PLUS"}});expect(events).toHaveLength(12);await releaseMonthlyUsage("u","p0");expect(events[0].status).toBe("released");});
test("quota exhaustion uses a dedicated safe error",async()=>{for(let i=0;i<10;i++)await reserve(`k${i}`);await expect(reserve("extra")).rejects.toBeInstanceOf(MonthlyQuotaError);});
