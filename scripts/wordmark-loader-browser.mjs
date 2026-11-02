import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const phase=process.argv[2]||'after', base=process.env.SCHOLAR_QA_URL||'http://127.0.0.1:3012';
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))throw Error('Localhost only');
const out=`test-artifacts/wordmark-loader/${phase}`;await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true});
const results=[];
try {
  for(const scenario of ['fast','slow','mobile','reduced','failed','repeat','mobile-throttled']) {
    console.log('SCENARIO',scenario);
    const mobile=scenario==='mobile'||scenario==='mobile-throttled';
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1600,height:1200},hasTouch:mobile,isMobile:mobile,reducedMotion:scenario==='reduced'?'reduce':'no-preference',recordVideo:{dir:out,size:mobile?{width:390,height:844}:{width:1600,height:1200}}});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(120000);
    if(scenario==='mobile-throttled')await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate',{rate:4});
    await context.route('**/api/**',route=>route.abort('blockedbyclient'));
    await context.route('**/api/auth/config',route=>route.fulfill({json:{registrationEnabled:true,googleConfigured:false,passwordResetConfigured:false}}));
    await context.route('**/api/auth/session',async route=>{
      await new Promise(resolve=>setTimeout(resolve,scenario==='fast'?100:scenario==='slow'||mobile?3000:800));
      if(scenario==='failed')return route.fulfill({status:503,json:{error:'Synthetic offline fixture'}});
      await route.fulfill({json:{authenticated:false,developerMode:false,entitlementsLoaded:true}});
    });
    await context.addInitScript(({repeat,failed})=>{
      localStorage.setItem('neha-scholar-v5',JSON.stringify({schema:6,state:{authed:failed,guestMode:false,onboarded:true,user:{email:failed?'loader-fixture@example.test':'',name:'Loader fixture',scholarClass:11},settings:{startupLoadingMode:'quick',elamEnabled:false,mobileLamMode:'off'}}}));
      if(repeat)sessionStorage.setItem('scholar:launch-seen:v1','1');
      const sample={shown:0,ready:0,removed:0,maxOverlays:0,fill:[],longTasks:[],steadyFrameGaps:[],pointerEventsWhenReady:null};window.__loaderSample=sample;
      let lastFrame=0;
      const frame=at=>{const el=document.querySelector('.scholar-launch-overlay');if(el?.dataset.visible==='true'&&sample.shown&&at-sample.shown>1500){if(lastFrame)sample.steadyFrameGaps.push(at-lastFrame);lastFrame=at;}else lastFrame=0;if(!sample.removed)requestAnimationFrame(frame);};requestAnimationFrame(frame);
      try{new PerformanceObserver(list=>sample.longTasks.push(...list.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true});}catch{}
      const observe=()=>{
        const overlay=document.querySelector('.scholar-launch-overlay, .scholar-launch-reload-cover');
        sample.maxOverlays=Math.max(sample.maxOverlays,document.querySelectorAll('.scholar-launch').length);
        if(overlay){if(!sample.shown)sample.shown=performance.now();if((overlay.getAttribute('data-visible')==='false'||overlay.getAttribute('aria-hidden')==='true')&&!sample.ready){sample.ready=performance.now();sample.pointerEventsWhenReady=getComputedStyle(overlay).pointerEvents;}if(overlay.dataset.liquidFill&&sample.fill.length<500)sample.fill.push({at:performance.now(),value:Number(overlay.dataset.liquidFill),state:overlay.dataset.phase});}
        else if(sample.shown&&!sample.removed){sample.removed=performance.now();if(!sample.ready)sample.pointerEventsWhenReady='overlay-removed';}
      };const observer=new MutationObserver(observe);observer.observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['data-visible','data-phase','data-liquid-fill']});observe();
    },{repeat:scenario==='repeat',failed:scenario==='failed'});
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__loaderSample.shown>0);
    if(scenario==='slow'||mobile||scenario==='reduced') {
      await page.locator('.scholar-launch-overlay').waitFor();await page.waitForTimeout(180);await page.screenshot({path:`${out}/${scenario}-loading.png`});
    }
    await expect(page.locator('.scholar-launch-overlay, .scholar-launch-reload-cover')).toHaveCount(0,{timeout:25000});
    if(scenario==='failed')await expect(page.getByRole('button',{name:'Retry connection',exact:true})).toBeVisible();
    else await expect(page.getByRole('button',{name:'Continue as Guest',exact:true})).toBeVisible();
    const data=await page.evaluate(()=>({...window.__loaderSample,overflow:document.documentElement.scrollWidth>innerWidth+1,animations:document.getAnimations().length}));
    expect(data.maxOverlays).toBeLessThanOrEqual(1);expect(data.overflow).toBe(false);expect(errors).toEqual([]);
    // Reduced motion can synchronously unmount in the layout effect before a
    // MutationObserver sees data-visible=false. Absence cannot intercept input;
    // do not invent a separate readiness timestamp for that case.
    expect(['none','overlay-removed']).toContain(data.pointerEventsWhenReady);
    await page.screenshot({path:`${out}/${scenario}-ready.png`});
    const video=page.video();await context.close();await video.saveAs(`${out}/${scenario}.webm`);
    results.push({scenario,...data,errors});
    await writeFile(out+'/results.json',JSON.stringify({phase,base,scope:'synthetic session/network fixtures; actual app/startup controller; no database or AI calls',results},null,2));
  }
  await writeFile(out+'/results.json',JSON.stringify({phase,base,scope:'synthetic session/network fixtures; actual app/startup controller; no database or AI calls',results},null,2));
  console.log(JSON.stringify(results.map(({scenario,shown,ready,removed,maxOverlays,overflow,errors,longTasks})=>({scenario,shown,ready,removed,maxOverlays,overflow,errors,longTaskMs:longTasks.reduce((a,b)=>a+b,0)})),null,2));
} finally {await browser.close();}
