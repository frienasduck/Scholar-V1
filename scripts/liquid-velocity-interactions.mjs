import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
const base = process.env.SCHOLAR_QA_URL || 'http://127.0.0.1:3012';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw Error('Localhost only');
const out = 'test-artifacts/liquid-velocity/interactions'; await mkdir(out,{recursive:true});
const browser = await chromium.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true});
const results = [], errors = [];
async function guest(options={}) {
  const context = await browser.newContext({viewport:{width:1440,height:900}, ...options});
  await context.route('**/api/**', route=>route.abort('blockedbyclient'));
  await context.addInitScript(()=>{
    const key='neha-scholar-v5', saved=JSON.parse(localStorage.getItem(key)||'{"schema":6,"state":{"authed":false,"guestMode":false}}');
    saved.state.settings={...saved.state.settings,startupLoadingMode:'quick',elamEnabled:false,mobileLamMode:'off'};
    localStorage.setItem(key,JSON.stringify(saved));
  });
  const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Continue as Guest',exact:true}).click();
  await page.locator('#main-scroll').waitFor(); await page.waitForTimeout(700);
  return {context,page};
}
async function aligned(page, hostSelector) {
  return page.locator(hostSelector).evaluate(host=>{
    const target=host.querySelector('[aria-current="page"], [data-state="active"]'),lens=host.querySelector('.sg-velocity-lens');
    if(!target||!lens)return false;
    const a=target.getBoundingClientRect(), b=lens.getBoundingClientRect();
    return Math.abs(a.left-b.left)<2 && Math.abs(a.top-b.top)<2 && Math.abs(a.width-b.width)<2 && Math.abs(a.height-b.height)<2;
  });
}
try {
  const {context,page}=await guest({recordVideo:{dir:out,size:{width:1440,height:900}}});
  const nav=page.locator('[data-velocity-nav="desktop"]');
  await expect.poll(()=>aligned(page,'[data-velocity-nav="desktop"]')).toBe(true);
  for(const title of ['Notes','Study','Question Practice','Chapter Command Center','Notes']) {
    await nav.locator('.scholar-nav-item').filter({hasText:title}).first().click();
  }
  await expect.poll(()=>aligned(page,'[data-velocity-nav="desktop"]')).toBe(true);
  await page.screenshot({path:out+'/desktop-lens-settled.png'});
  await page.getByRole('button',{name:'Hide sidebar',exact:true}).click();
  await expect(page.locator('.scholar-desktop-sidebar')).toHaveCount(0);
  await page.getByRole('button',{name:'Show sidebar',exact:true}).click();
  await expect.poll(()=>aligned(page,'[data-velocity-nav="desktop"]')).toBe(true);
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({path:out+'/dialog.png'});
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  results.push({test:'rapid sidebar navigation, collapse/reopen, command dialog Escape',passed:true});
  await page.goto(base+'/notes'); await page.waitForTimeout(500);
  const newNote=page.getByRole('button',{name:/New Note|Create note|Create your first note/i}).first();
  if(await newNote.count()) {
    await newNote.click(); await page.waitForTimeout(250);
    const editor=page.getByPlaceholder('Start writing in Markdown…', {exact:false});
    await editor.fill('Liquid Velocity verification: force = mass × acceleration.');
    await expect(editor).toHaveValue('Liquid Velocity verification: force = mass × acceleration.');
    await page.locator('#main-scroll [data-slot="dropdown-menu-trigger"]:visible').first().click();
    await expect(page.getByRole('menu')).toBeVisible(); await page.screenshot({path:out+'/notes-menu.png'});
    await page.keyboard.press('Escape'); await page.screenshot({path:out+'/notes-editor.png'});
    results.push({test:'Guest note creation/editing, real dropdown open/Escape',passed:true});
  }
  await page.goto(base+'/settings'); await page.waitForTimeout(500);
  const tabs=page.locator('.sg-velocity-tabs:visible').first();
  if(await tabs.count()) {
    await tabs.getByRole('tab').last().click();
    await expect.poll(()=>aligned(page,'.sg-velocity-tabs:visible')).toBe(true);
    await tabs.getByRole('tab').first().focus(); await page.keyboard.press('ArrowRight');
    await page.screenshot({path:out+'/notes-tabs.png'});
    results.push({test:'Radix tab click and keyboard navigation with lens',passed:true});
  }
  await page.goto(base+'/files'); await expect(page.getByRole('heading',{name:'Sign in to use this private feature'})).toBeVisible();
  results.push({test:'private Guest gate preserved',passed:true});
  await page.goto(base+'/dashboard'); await page.waitForTimeout(600);
  const lam=page.getByRole('button',{name:'LAM',exact:true}).first();
  if(await lam.count()) {
    await lam.click();
    const lamRoot=page.getByRole('complementary',{name:'LAM personal assistant'});
    if(await lamRoot.getByRole('heading',{name:'Meet LAM',exact:true}).count()) {
      await page.screenshot({path:out+'/lam-onboarding.png'});
      for(let i=0;i<3;i++) await lamRoot.getByRole('button',{name:'Continue',exact:true}).click();
      await lamRoot.getByRole('button',{name:'Start using LAM',exact:true}).click();
    }
    await page.getByLabel('Message LAM',{exact:true}).waitFor();
    await page.screenshot({path:out+'/lam-panel.png'});
    await page.getByRole('button',{name:'Close LAM',exact:true}).last().click();
    results.push({test:'LAM panel open/close only; no message sent',passed:true});
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.sgMotion)).toBe('reduced');
  await nav.locator('.scholar-nav-item').filter({hasText:'Notes'}).first().click();
  await expect.poll(()=>aligned(page,'[data-velocity-nav="desktop"]')).toBe(true);
  results.push({test:'system reduced motion, immediate selection',passed:true});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>document.documentElement.dataset.appearanceGlass='off');
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.sgMaterial)).toBe('fallback');
  await expect.poll(()=>page.locator('[data-sg-optics="active"]').count()).toBe(0);
  await page.screenshot({path:out+'/opaque-fallback.png'});
  results.push({test:'appearance glass off disables optics, no opacity-only fallback',passed:true});
  await page.evaluate(()=>{delete document.documentElement.dataset.appearanceGlass;document.documentElement.dataset.appearancePerformance='performance';});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.sgQuality)).toBe('lightweight');
  await expect.poll(()=>page.locator('[data-sg-optics="active"]').count()).toBe(0);
  results.push({test:'explicit lightweight quality disables optics',passed:true});
  await page.evaluate(()=>delete document.documentElement.dataset.appearancePerformance);
  await page.evaluate(()=>{delete document.documentElement.dataset.appearanceGlass;document.documentElement.dataset.appearanceTheme='light';document.documentElement.style.fontSize='20px';});
  await page.screenshot({path:out+'/light-large-text.png'});
  results.push({test:'light material and 125% root text',overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)});
  // Isolated optical proof against a high-frequency background, using the real
  // application's shared filter definitions and styles, not a screenshot sprite.
  await page.evaluate(()=>{
    document.documentElement.style.fontSize='';document.documentElement.dataset.appearanceTheme='dark';
    const fixture=document.createElement('div');fixture.id='optical-proof';
    fixture.style.cssText='position:fixed;inset:0;z-index:20000;background:repeating-linear-gradient(90deg,#f7d98b 0 4px,#1d4053 4px 8px);display:grid;place-items:center';
    fixture.innerHTML='<div id="proof-lens" class="sg-glass" data-sg-refraction="standard" data-sg-optics="off" style="width:360px;height:160px;--sg-radius:36px;--sg-blur:0px;--sg-sat:100%;--sg-bright:1;--sg-press:1;--sg-pull-x:0px;--sg-pull-y:0px;box-shadow:none;border:none"><span class="sg-layer sg-warp" style="backdrop-filter:none!important"></span></div>';
    document.body.append(fixture);
  });
  await page.waitForTimeout(200);
  const off=await page.locator('#proof-lens').screenshot({path:out+'/optics-off.png'});
  await page.locator('#proof-lens').evaluate(el=>el.dataset.sgOptics='active');
  await page.locator('#proof-lens .sg-warp').evaluate(el=>el.style.setProperty('backdrop-filter','url("#sg-refraction-standard")','important'));
  await page.waitForTimeout(300);
  const on=await page.locator('#proof-lens').screenshot({path:out+'/optics-on.png'});
  const a=await sharp(off).removeAlpha().raw().toBuffer({resolveWithObject:true}),b=await sharp(on).removeAlpha().raw().toBuffer();
  let edge=0,center=0,edgeN=0,centerN=0;
  for(let y=40;y<120;y++)for(let x=8;x<352;x++)for(let c=0;c<3;c++) {
    const diff=Math.abs(a.data[(y*a.info.width+x)*3+c]-b[(y*a.info.width+x)*3+c]);
    if(x<15||x>345){edge+=diff;edgeN++;} else if(x>80&&x<280){center+=diff;centerN++;}
  }
  const optical={test:'live backdrop displacement pixel proof',edgeMeanDifference:edge/edgeN,centerMeanDifference:center/centerN,filter:await page.locator('#proof-lens .sg-warp').evaluate(el=>getComputedStyle(el).backdropFilter)};
  expect(optical.edgeMeanDifference).toBeGreaterThan(optical.centerMeanDifference+5);results.push(optical);
  await page.locator('#optical-proof').evaluate(el=>el.remove());
  const desktopVideo=page.video(); await context.close(); await desktopVideo.saveAs(out+'/desktop-runtime.webm');
  const mobile=await guest({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,recordVideo:{dir:out,size:{width:390,height:844}}});
  const mp=mobile.page;
  await mp.getByRole('button',{name:'Open bottom menu',exact:true}).tap();
  const dock=mp.getByRole('navigation',{name:'Primary mobile navigation'});
  await expect(dock).toBeVisible();
  await expect.poll(()=>aligned(mp,'.sg-velocity-dock')).toBe(true);
  for(const title of ['Study','Practice','Home','AI Tools','Home']) await dock.getByRole('button',{name:title,exact:true}).tap();
  await expect.poll(()=>aligned(mp,'.sg-velocity-dock')).toBe(true);
  await mp.screenshot({path:out+'/mobile-dock.png'});
  const button=dock.getByRole('button',{name:'Study',exact:true});
  await button.dispatchEvent('pointerdown',{pointerId:8,pointerType:'touch',isPrimary:true,button:0,buttons:1,bubbles:true});
  await mp.waitForTimeout(90);await mp.screenshot({path:out+'/mobile-pressed.png'});
  await button.dispatchEvent('pointercancel',{pointerId:8,pointerType:'touch',bubbles:true});
  await mp.waitForTimeout(250);
  expect(await button.evaluate(el=>getComputedStyle(el).scale)).toBe('none');
  await mp.evaluate(()=>document.documentElement.dataset.scholarKeyboardOpen='true');
  await expect(dock).not.toBeVisible();
  await mp.evaluate(()=>document.documentElement.dataset.scholarKeyboardOpen='false');
  await mp.setViewportSize({width:844,height:390});
  await expect.poll(()=>aligned(mp,'.sg-velocity-dock')).toBe(true);
  await mp.screenshot({path:out+'/mobile-landscape.png'});
  await dock.getByRole('button',{name:'More sections'}).tap();
  await expect(mp.getByRole('dialog')).toBeVisible(); await mp.keyboard.press('Escape');
  await expect(mp.getByRole('dialog')).toHaveCount(0);
  results.push({test:'touch dock rapid taps, pointer cancellation, More drawer, Escape',passed:true,optics:await mp.locator('[data-sg-optics="active"]').count()});
  const mobileVideo=mp.video(); await mobile.context.close(); await mobileVideo.saveAs(out+'/mobile-runtime.webm');
  expect(errors).toEqual([]);
  await writeFile(out+'/results.json',JSON.stringify({results,errors,scope:'local UI only; API blocked; native hardware not tested'},null,2));
  console.log(JSON.stringify({results,errors},null,2));
} catch(error) {
  await writeFile(out+'/results.json',JSON.stringify({results,errors,failure:String(error)},null,2));
  throw error;
} finally {await browser.close();}
