import { createHash } from "node:crypto";
import { plainHtml } from "@/lib/resources/safe-fetch";
import type { Scope } from "./types";
export type LicensedSource = Scope & { id: string; title: string; canonicalUrl: string; publisher: string; licenseType: "PSF-2.0"; licenseUrl: string; attribution: string; changes: string; retrievedAt: string; version: string; topicIndexes: number[]; sections: {heading:string;text:string}[] };
export type IngestionJob = { id:string; state:"DISCOVERED"|"VALIDATING"|"ACQUIRING"|"INDEXING"|"READY"|"FAILED"; attempts:number; version?:string; error?:string };
export function robotsAllows(text:string,path:string) {
  let agents:string[]=[], rules:{agent:string;allow:boolean;path:string}[]=[], hadRule=false;
  for(const raw of text.split(/\r?\n/)) {
    const line=raw.split("#")[0].trim(), match=line.match(/^(user-agent|disallow|allow):\s*(.*)$/i); if(!match) continue;
    if(match[1].toLowerCase()==="user-agent") {if(hadRule){agents=[];hadRule=false;}agents.push(match[2].toLowerCase());}
    else {hadRule=true;if(match[2]) rules.push(...agents.map(agent=>({agent,allow:match[1].toLowerCase()==="allow",path:match[2]})));}
  }
  const specific=rules.filter(r=>r.agent.includes("scholarresourceverifier"));
  const relevant=(specific.length?specific:rules.filter(r=>r.agent==="*")).filter(r=>path.startsWith(r.path.split("*")[0].replace(/\$$/,""))).sort((a,b)=>b.path.length-a.path.length||Number(b.allow)-Number(a.allow));
  return !relevant.length || relevant[0].allow;
}
export function htmlSection(html:string,id:string) {
  const tag=`<section id="${id}">`, start=html.indexOf(tag); if(start<0) throw new Error(`SECTION_NOT_FOUND:${id}`);
  const tail=html.slice(start), pattern=/<\/?section\b[^>]*>/g; let depth=0,end=0;
  for(const match of tail.matchAll(pattern)){depth+=match[0].startsWith("</")?-1:1;if(!depth){end=match.index!+match[0].length;break;}}
  if(!end) throw new Error("UNBALANCED_SECTION");
  const text=plainHtml(tail.slice(0,end)).replace(/¶/g,"").replace(/\n{3,}/g,"\n\n").trim();
  if(text.length<100) throw new Error("NO_READABLE_SECTION"); return text;
}
/** An explicit PSF allowlist, not an unrestricted crawler or arbitrary license override. */
export async function ingestPythonSection(input: Omit<LicensedSource,"sections"|"version"|"retrievedAt"|"licenseType"|"licenseUrl"|"publisher"|"attribution"|"changes"> & {sectionId:string}, fetchText:(url:string)=>Promise<string>, checkpoint:(job:IngestionJob)=>Promise<void>, prior?:IngestionJob):Promise<LicensedSource> {
  const url=new URL(input.canonicalUrl);
  if(url.origin!=="https://docs.python.org"||!url.pathname.startsWith("/3/tutorial/")) throw new Error("SOURCE_NOT_ALLOWLISTED");
  const job:IngestionJob={id:input.id,state:"DISCOVERED",attempts:prior?.attempts??0};
  if(job.attempts>=3) throw new Error("RETRY_BUDGET_EXHAUSTED"); job.attempts++;
  try {
    job.state="VALIDATING"; await checkpoint(job);
    const robots=await fetchText("https://docs.python.org/robots.txt"); if(!robotsAllows(robots,url.pathname)) throw new Error("ROBOTS_DENIED");
    const license=await fetchText("https://docs.python.org/3/license.html");
    if(!plainHtml(license).replace(/\s+/g," ").includes("Python software and documentation are licensed under the Python Software Foundation License Version 2")) throw new Error("LICENSE_CHANGED_REVIEW_REQUIRED");
    job.state="ACQUIRING";await checkpoint(job);
    const html=await fetchText(url.toString()), text=htmlSection(html,input.sectionId);
    const version=createHash("sha256").update(text).digest("hex"); job.state="INDEXING";job.version=version;await checkpoint(job);
    const result:LicensedSource={grade:input.grade,subjectId:input.subjectId,chapterId:input.chapterId,id:input.id,title:input.title,canonicalUrl:input.canonicalUrl,publisher:"Python Software Foundation",licenseType:"PSF-2.0",licenseUrl:"https://docs.python.org/3/license.html",attribution:"Copyright © 2001 Python Software Foundation; All Rights Reserved. PSF License Version 2.",changes:"Selected section; HTML/navigation removed; Unicode/entities normalized; educational mapping added. Original code text is not executed.",retrievedAt:new Date().toISOString(),version,topicIndexes:input.topicIndexes,sections:[{heading:input.title,text}]};
    job.state="READY";await checkpoint(job);return result;
  }catch(error){job.state="FAILED";job.error=error instanceof Error?error.message:"INGESTION_FAILED";await checkpoint(job);throw error;}
}
