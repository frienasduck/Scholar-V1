import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
const root='test-artifacts/liquid-velocity-3',versions={};
for(const name of ['next','react','typescript','tailwindcss','animejs','@playwright/test','@prisma/client'])versions[name]=JSON.parse(await readFile(`node_modules/${name}/package.json`,'utf8')).version;
const before=JSON.parse(await readFile(root+'/before/results.json','utf8')),after=JSON.parse(await readFile(root+'/after/results.json','utf8'));
const rows=['cold','publicWarm','guest','warm','throttled'].map(name=>({name,before:before[name],after:after[name]}));
const oldCss=await readFile('../.rollback-backups/2026-11-03-liquid-velocity-3/src/components/liquid-glass/liquid-velocity.css'),newCss=await readFile('src/components/liquid-glass/liquid-velocity.css');
const css={sourceBytesBefore:oldCss.length,sourceBytesAfter:newCss.length,gzipSourceBefore:gzipSync(oldCss).length,gzipSourceAfter:gzipSync(newCss).length,scope:'gzip of source stylesheet, not a delivered/minified bundle delta; original production bundle manifest not captured'};
await writeFile(root+'/summary.json',JSON.stringify({versions,css,rows},null,2));console.log(JSON.stringify({versions,css,metrics:rows.map(r=>({name:r.name,before:{lcp:r.before.lcpMs,cls:r.before.cls,longMs:r.before.longTaskMs,event:r.before.eventMaxMs,p95:r.before.frameP95Ms},after:{lcp:r.after.lcpMs,cls:r.after.cls,longMs:r.after.longTaskMs,event:r.after.eventMaxMs,p95:r.after.frameP95Ms}}))},null,2));
