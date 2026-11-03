import { chromium, firefox, webkit, expect } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const out='test-artifacts/liquid-velocity-3/verification',base=process.env.SCHOLAR_QA_URL||'http://127.0.0.1:3024';await mkdir(out,{recursive:true});
// Demonstrate that the feature migrations changed attributes only, not any AI,
// assessment, reader, permission or account callback.
const changes=JSON.parse(await readFile('test-artifacts/liquid-velocity-3/control-migration.json','utf8')),safety=[];
for(const change of changes){const before=await readFile('../.rollback-backups/2026-11-03-liquid-velocity-3/'+change.file,'utf8'),after=await readFile(change.file,'utf8');const normalized=after.replace(/ data-velocity-control="(?:practice|reader|revision|lam|exam)"/g,'').replaceAll('\r\n','\n');const original=before.replaceAll('\r\n','\n');expect(normalized).toBe(original);safety.push({file:change.file,count:change.count,attributeOnly:true,originalSha256:createHash('sha256').update(original).digest('hex')});}
for(const file of ['src/components/launch-readiness-gate.tsx','src/components/launch-splash.tsx','src/components/launch-splash.css','src/lib/animation/launch-wordmark.ts','tests/launch-splash.spec.ts','tests/launch-wordmark.test.tsx'])expect(await readFile(file,'utf8')).toBe(await readFile('../.rollback-backups/2026-11-03-liquid-velocity-3/'+file,'utf8'));
await writeFile(out+'/source-safety.json',JSON.stringify({safety,loaderFilesUnchanged:6},null,2));
const remaining=process.argv.includes('--remaining');
const results=remaining?JSON.parse(await readFile(out+'/browser-matrix.json','utf8')).filter(r=>r.engine==='chromium'):[];
for(const [name,engine,options] of [['chromium',chromium,{executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'}],['firefox',firefox,{executablePath:'C:\\Users\\Lenovo\\AppData\\Local\\ms-playwright\\firefox-1555\\firefox\\firefox.exe'}],['webkit',webkit,{executablePath:'C:\\Users\\Lenovo\\AppData\\Local\\ms-playwright\\webkit-2370\\Playwright.exe'}]]){
 if(remaining&&name==='chromium')continue;
 let browser;
 try{
  browser=await engine.launch({headless:true,...options});const context=await browser.newContext({viewport:{width:1440,height:900}});await context.route('**/api/**',r=>r.abort('blockedbyclient'));
  await context.addInitScript(()=>{const key='neha-scholar-v5',saved=JSON.parse(localStorage.getItem(key)||'{"schema":6,"state":{"authed":false,"guestMode":false}}');saved.state.settings={...saved.state.settings,startupLoadingMode:'quick',elamEnabled:false,mobileLamMode:'off'};localStorage.setItem(key,JSON.stringify(saved));});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>performance.now()>5200||document.querySelector('.scholar-launch-overlay'));await expect(page.locator('.scholar-launch-overlay')).toHaveCount(0,{timeout:20000});await page.getByRole('button',{name:'Continue as Guest',exact:true}).click();await page.locator('#main-scroll').waitFor();await expect(page.locator('.scholar-launch-overlay')).toHaveCount(0,{timeout:20000});await page.waitForTimeout(500);
  const flags=await page.evaluate(()=>({...document.documentElement.dataset}));
  await page.screenshot({path:`${out}/${name}-normal.png`});
  if(name!=='chromium')expect(flags.sgRefraction).toBe('off');
  if(name==='chromium'){
   const nav=page.locator('[data-velocity-nav="desktop"]'),lens=nav.locator('.sg-velocity-lens'),optic=lens.locator('.sg-velocity-lens-optic');
   await nav.evaluate(el=>el.style.backgroundImage='repeating-linear-gradient(90deg,#f7d98b 0 4px,#1d4053 4px 8px)');
   await optic.evaluate(el=>el.style.setProperty('backdrop-filter','none','important'));const off=await lens.screenshot({path:out+'/actual-lens-optics-off.png'});
   await optic.evaluate(el=>el.style.setProperty('backdrop-filter','url("#sg-refraction-subtle")','important'));await page.waitForTimeout(100);const on=await lens.screenshot({path:out+'/actual-lens-optics-on.png'});
   const a=await sharp(off).removeAlpha().raw().toBuffer({resolveWithObject:true}),b=await sharp(on).removeAlpha().raw().toBuffer();let edge=0,center=0,en=0,cn=0;
   for(let y=12;y<a.info.height-12;y++)for(let x=3;x<a.info.width-3;x++)for(let c=0;c<3;c++){const d=Math.abs(a.data[(y*a.info.width+x)*3+c]-b[(y*a.info.width+x)*3+c]);if(x<13||x>a.info.width-14){edge+=d;en++;}else if(x>60&&x<a.info.width-60){center+=d;cn++;}}
   const proof={edgeMean:edge/en,centerMean:center/cn,component:'actual mounted NavigationLens, live striped backdrop, no cloned scene'};expect(proof.edgeMean).toBeGreaterThan(proof.centerMean+2);await writeFile(out+'/optical-proof.json',JSON.stringify(proof,null,2));await nav.evaluate(el=>el.style.backgroundImage='');await optic.evaluate(el=>el.style.removeProperty('backdrop-filter'));
  }
  await page.getByRole('button',{name:'Hide sidebar',exact:true}).click();await page.waitForTimeout(400);expect((await page.locator('.scholar-desktop-sidebar').boundingBox()).width).toBe(76);await page.getByRole('button',{name:'Show sidebar',exact:true}).click();await page.waitForTimeout(400);
  await page.keyboard.press('Control+k');await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.evaluate(()=>{document.documentElement.dataset.appearanceTheme='light';document.documentElement.style.fontSize='20px';});await page.screenshot({path:`${out}/${name}-light-large-text.png`});
  await page.evaluate(()=>{document.documentElement.style.fontSize='';document.documentElement.dataset.appearanceTheme='dark';document.documentElement.dataset.appearanceGlass='off';});await expect.poll(()=>page.locator('[data-sg-optics="active"]').count()).toBe(0);await page.screenshot({path:`${out}/${name}-glass-off.png`});
  await page.emulateMedia({reducedMotion:'reduce'});await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.sgMotion)).toBe('reduced');await page.getByRole('button',{name:'Hide sidebar',exact:true}).click();await page.waitForTimeout(60);expect((await page.locator('.scholar-desktop-sidebar').boundingBox()).width).toBe(76);
  expect(errors).toEqual([]);results.push({engine:name,version:browser.version(),flags,errors,passed:true});await context.close();
 }catch(error){results.push({engine:name,passed:false,error:String(error)});}
 finally{await browser?.close();await writeFile(out+'/browser-matrix.json',JSON.stringify(results,null,2));}
}
console.log(JSON.stringify(results,null,2));
