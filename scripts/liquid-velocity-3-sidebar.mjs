import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const out='test-artifacts/liquid-velocity-3/sidebar-milestone';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out,size:{width:1440,height:900}}});
await context.route('**/api/**',r=>r.abort('blockedbyclient'));
await context.addInitScript(()=>{const saved=JSON.parse(localStorage.getItem('neha-scholar-v5')||'{"schema":6,"state":{"authed":false,"guestMode":false}}');saved.state.settings={...saved.state.settings,startupLoadingMode:'quick',elamEnabled:false,mobileLamMode:'off'};localStorage.setItem('neha-scholar-v5',JSON.stringify(saved));});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:3021',{waitUntil:'domcontentloaded'});await page.locator('.scholar-launch-overlay').waitFor();await expect(page.locator('.scholar-launch-overlay')).toHaveCount(0,{timeout:20000});
 await page.getByRole('button',{name:'Continue as Guest',exact:true}).click();await page.locator('#main-scroll').waitFor();await page.waitForTimeout(700);
 const nav=page.locator('[data-velocity-nav="desktop"]'),lens=nav.locator('.sg-velocity-lens'),shell=page.locator('.scholar-desktop-sidebar');
 const points=[];
 for(const name of ['Dashboard','Group Study','Scholar Intelligence','Chapter Command Center','Notes','Dashboard']){
  await nav.getByRole('button',{name,exact:true}).click();await page.waitForTimeout(380);
  points.push({name,rect:await lens.boundingBox()});
 }
 await page.screenshot({path:out+'/expanded.png'});await shell.screenshot({path:out+'/sidebar.png'});
 const from=await lens.boundingBox();await nav.getByRole('button',{name:'Notes',exact:true}).click();await page.waitForTimeout(65);const during=await lens.boundingBox();await page.waitForTimeout(380);const to=await lens.boundingBox();
 expect(Math.abs(during.y-from.y)).toBeGreaterThan(2);expect(Math.abs(during.y-to.y)).toBeGreaterThan(2);
 await page.getByRole('button',{name:'Hide sidebar',exact:true}).click();await page.waitForTimeout(400);expect((await shell.boundingBox()).width).toBe(76);await page.screenshot({path:out+'/rail.png'});
 await nav.getByRole('button',{name:'Dashboard',exact:true}).click();await page.waitForTimeout(400);await page.getByRole('button',{name:'Show sidebar',exact:true}).click();await page.waitForTimeout(400);expect((await shell.boundingBox()).width).toBe(256);
 await nav.getByRole('button',{name:'Notes',exact:true}).hover();await page.waitForTimeout(300);await page.screenshot({path:out+'/hover.png'});
 for(const name of ['Study','Notes','Dashboard'])await nav.getByRole('button',{name,exact:true}).click();await page.waitForTimeout(400);
 const a=await lens.boundingBox(),b=await nav.locator('[aria-current="page"]').boundingBox();expect(Math.abs(a.y-b.y)).toBeLessThan(2);
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Hide sidebar',exact:true}).click();await page.waitForTimeout(50);expect((await shell.boundingBox()).width).toBe(76);
 expect(errors).toEqual([]);await writeFile(out+'/results.json',JSON.stringify({points,from,during,to,errors,surface:await shell.evaluate(el=>({background:getComputedStyle(el).backgroundImage,blur:getComputedStyle(el).backdropFilter}))},null,2));
 const video=page.video();await context.close();await video.saveAs(out+'/sidebar-runtime.webm');console.log('Sidebar sequence, moving persistent lens, compact rail, rapid selection, reduced motion: passed');
}catch(error){await page.screenshot({path:out+'/failure.png'});await writeFile(out+'/failure.json',JSON.stringify({error:String(error),errors,body:(await page.locator('body').innerText()).slice(0,2500)},null,2));throw error;}finally{await browser.close();}
