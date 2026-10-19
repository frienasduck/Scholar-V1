import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { safeFetch } from "../src/lib/resources/safe-fetch";
import { ingestPythonSection, type IngestionJob, type LicensedSource } from "../src/lib/exam-ready/knowledge/ingestion";
// Explicit manual operation; no AI, database, account, schedule or production mutation.
const root=resolve(import.meta.dir,".."), output=resolve(root,"src/lib/exam-ready/knowledge/licensed-sources.json"), jobsPath=resolve(root,"test-artifacts/exam-ready-3.1-ingestion.json");
const jobs:Record<string,IngestionJob>=JSON.parse(await readFile(jobsPath,"utf8").catch(()=>"{}"));
const existing:LicensedSource[]=JSON.parse(await readFile(output,"utf8"));
const sources=new Map(existing.map(s=>[s.id,s])), htmlCache=new Map<string,string>();
async function fetchText(url:string){if(htmlCache.has(url))return htmlCache.get(url)!;let text:string;try{text=(await safeFetch(url,{maxBytes:800000})).bytes.toString("utf8");}catch(e){if(url.endsWith("/robots.txt")&&e instanceof Error&&e.message.includes("HTTP 404"))text="";else throw e;}htmlCache.set(url,text);return text;}
const seeds:[string,string,string,string,number[]][]=[
 ["cs7","introduction","numbers","Python numeric operations",[0,2,3,4]],
 ["cs9","introduction","text","Python strings and indexing",[0,1,2,4]],
 ["cs8","controlflow","if-statements","Conditional branches",[0]],
 ["cs8","controlflow","for-statements","Iteration over sequences",[1]],
 ["cs8","controlflow","the-range-function","The range function",[1]],
 ["cs10","datastructures","more-on-lists","List methods and mutation",[0,1,2]],
 ["cs11","datastructures","tuples-and-sequences","Tuples and sequences",[0,1,2,3]],
 ["cs12","datastructures","dictionaries","Dictionary operations",[0,1,2,3]],
 ["cs15","modules","modules","Modules, importing and search paths",[0,1,3,4]],
 ["cs14","inputoutput","reading-and-writing-files","Reading and writing files — teacher-assigned extension",[0,1,2,3,4]]
];
await mkdir(resolve(root,"test-artifacts"),{recursive:true});
for(const [chapterId,page,sectionId,title,topicIndexes] of seeds){
 const id=`er-psf-${chapterId}-${sectionId}`;
 if(sources.has(id)&&process.argv.includes("--refresh")===false){console.log(`${id}: already indexed; unchanged`);continue;}
 try{const source=await ingestPythonSection({id,grade:11,subjectId:"cs",chapterId,title,topicIndexes,canonicalUrl:`https://docs.python.org/3/tutorial/${page}.html`,sectionId},fetchText,async job=>{jobs[id]=structuredClone(job);await writeFile(jobsPath,JSON.stringify(jobs,null,2)+"\n");},jobs[id]);sources.set(id,source);await writeFile(output,JSON.stringify([...sources.values()],null,2)+"\n");console.log(`${id}: ${source.sections[0].text.length} readable characters`);}catch(e){console.warn(`${id}: ${e instanceof Error?e.message:"failed"}`);}
}
console.log(JSON.stringify({sources:sources.size,failed:Object.values(jobs).filter(j=>j.state==="FAILED").length,productionModified:false,aiCalls:0}));
