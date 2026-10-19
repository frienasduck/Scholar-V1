import type { KnowledgePassage } from "./types";
/** Keep complete JSON/reference records inside a fair context budget, not a cut JSON blob. */
export function boundedPassages(input:KnowledgePassage[],maxCharacters=17000) {
  const sources=input.slice(0,16).map(p=>({...p,citation:{...p.citation},text:p.text}));
  const overhead=JSON.stringify(sources.map(p=>({...p,text:""}))).length;
  const share=Math.max(100,Math.floor((maxCharacters-overhead)/Math.max(1,sources.length)));
  for(const p of sources) p.text=p.text.slice(0,share);
  let changes=0;
  while(JSON.stringify(sources).length>maxCharacters&&changes++<200){const largest=sources.reduce((a,b)=>a.text.length>b.text.length?a:b);if(!largest?.text.length)throw new Error("Reference metadata exceeds the context budget.");largest.text=largest.text.slice(0,Math.max(0,largest.text.length-200));}
  if(JSON.stringify(sources).length>maxCharacters)throw new Error("Reference context exceeds the limit.");
  return sources;
}
