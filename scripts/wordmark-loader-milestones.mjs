// Actual app + startup controller under Playwright's deterministic clock.
// These are labeled visual milestones, not real-world load-time measurements.
import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.SCHOLAR_QA_URL||'http://127.0.0.1:3015';
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))throw Error('Localhost only');
const out='test-artifacts/wordmark-loader/milestones';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
const results=[];
try {
 for(const mobile of [false,true]) {
  const name=mobile?'mobile':'desktop';
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1600,height:1200},isMobile:mobile,hasTouch:mobile});
  await context.route('**/api/**',r=>r.abort('blockedbyclient'));
  let release;
  const pending=new Promise(resolve=>release=resolve);
  await context.route('**/api/auth/session',async r=>{await pending;await r.fulfill({json:{authenticated:false,developerMode:false}});});
  await context.route('**/api/auth/config',r=>r.fulfill({json:{registrationEnabled:true}}));
  await context.addInitScript(()=>localStorage.setItem('neha-scholar-v5',JSON.stringify({schema:6,state:{authed:false,guestMode:false,settings:{startupLoadingMode:'quick',elamEnabled:false,mobileLamMode:'off'}}})));
  const page=await context.newPage();await page.clock.install({time:new Date('2026-11-02T12:00:00Z')});await page.clock.pauseAt(new Date('2026-11-02T12:00:01Z'));
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:120000});
  const overlay=page.locator('.scholar-launch-overlay');
  for(let i=0;i<400&&await overlay.count()===0;i++){await page.clock.runFor(16);await new Promise(r=>setTimeout(r,10));}
  await expect(overlay).toHaveCount(1);
  const record=[];
  const snap=async label=>{
    const data=await overlay.evaluate(el=>({fill:Number(el.dataset.liquidFill||0),phase:el.dataset.phase,visible:el.dataset.visible,opacity:Number(getComputedStyle(el).opacity),transform:getComputedStyle(el.querySelector('.scholar-launch-wordmark')).transform}));
    if(label==='fade'){expect(data.fill).toBe(1);expect(data.transform).toBe('none');expect(data.opacity).toBeGreaterThan(0);expect(data.opacity).toBeLessThan(1);}
    await page.screenshot({path:`${out}/${name}-${label}.png`});record.push({label,...data});
  };
  await snap('start');
  for(const [label,target]of[['25',.25],['50',.5]]) {
    for(let i=0;i<200&&await overlay.evaluate(el=>Number(el.dataset.liquidFill||0))<target;i++){await page.clock.runFor(16);await new Promise(r=>setTimeout(r,5));}
    await snap(label);
  }
  expect(await overlay.getAttribute('data-visible')).toBe('true');
  expect(await overlay.evaluate(el=>Number(el.dataset.liquidFill))).toBeLessThan(1);
  await page.clock.runFor(600);await snap('pending');
  release();
  let captured75=false;
  for(let i=0;i<200;i++) {
    await page.clock.runFor(8);await new Promise(r=>setTimeout(r,5));
    // Playwright's clock controls Anime's JS liquid timeline, not the native
    // compositor clock. Pause only the real opacity animation for stills.
    await overlay.evaluate(el=>el.getAnimations().forEach(a=>a.pause()));
    if(!captured75&&await overlay.evaluate(el=>Number(el.dataset.liquidFill||0)>=.75)){await snap('75');captured75=true;}
    if(await overlay.getAttribute('data-phase')==='fading')break;
  }
  await overlay.evaluate(el=>el.getAnimations().forEach(a=>a.currentTime=90));
  await snap('100');
  await overlay.evaluate(el=>el.getAnimations().forEach(a=>a.currentTime=154));await snap('fade');
  await page.clock.runFor(500);await expect(overlay).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Continue as Guest',exact:true})).toBeVisible();
  await page.screenshot({path:`${out}/${name}-ready.png`});
  results.push({name,clock:'deterministic visual capture; real controller; session held until explicit release',record});
  await context.close();
 }
 await writeFile(out+'/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
