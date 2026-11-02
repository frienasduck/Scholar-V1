// Isolated diagnostic: make the neutral centre visibly accountable, not just "different".
import {chromium} from '@playwright/test';
import sharp from 'sharp';
const browser=await chromium.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
const page=await browser.newPage({viewport:{width:1440,height:900}});
await page.route('**/api/**',r=>r.abort());
await page.goto(process.env.SCHOLAR_QA_URL || 'http://127.0.0.1:3012');
await page.waitForSelector('.sg-filter-defs',{state:'attached'});
await page.evaluate(()=>{
  document.documentElement.dataset.sgRefraction='on';
  const e=document.createElement('div');e.style.cssText='position:fixed;inset:0;z-index:30000;display:grid;place-items:center;background:repeating-linear-gradient(90deg,#f7d98b 0 4px,#1d4053 4px 8px)';e.innerHTML='<div id="box" style="width:360px;height:160px;border-radius:36px;overflow:hidden"><div id="warp" style="height:100%"></div></div>';document.body.append(e);
});
let off=await sharp(await page.locator('#box').screenshot()).removeAlpha().raw().toBuffer({resolveWithObject:true});
for (const variant of ['current-object-units','regression-zero-viewport','explicit-user-space','object-unit-repair']) {
  await page.evaluate(variant=>{
    const filter=document.querySelector('#sg-refraction-standard');
    const images=filter.querySelectorAll('feImage');
    if(variant==='regression-zero-viewport'){filter.removeAttribute('primitiveUnits');images.forEach(el=>{el.setAttribute('width','100%');el.setAttribute('height','100%');});filter.querySelector('feDisplacementMap').setAttribute('scale','22');}
    if(variant==='explicit-user-space') {filter.removeAttribute('primitiveUnits');images.forEach(el=>{el.setAttribute('width','360');el.setAttribute('height','160');});filter.querySelector('feDisplacementMap').setAttribute('scale','22');}
    if(variant==='object-unit-repair'){filter.setAttribute('primitiveUnits','objectBoundingBox');images.forEach(el=>{el.setAttribute('width','1');el.setAttribute('height','1');});filter.querySelector('feDisplacementMap').setAttribute('scale','.06');}
    document.querySelector('#warp').style.backdropFilter='url("#sg-refraction-standard")';
  },variant);
  await page.waitForTimeout(200);
  const on=await sharp(await page.locator('#box').screenshot({path:`test-artifacts/liquid-velocity/interactions/probe-${variant}.png`})).removeAlpha().raw().toBuffer();
  let edge=0,center=0,en=0,cn=0;
  for(let y=40;y<120;y++) for(let x=5;x<355;x++) for(let c=0;c<3;c++) {let d=Math.abs(off.data[(y*360+x)*3+c]-on[(y*360+x)*3+c]);if(x<15||x>345){edge+=d;en++;}if(x>80&&x<280){center+=d;cn++;}}
  console.log(JSON.stringify({variant,edge:edge/en,center:center/cn}));
}
await browser.close();
