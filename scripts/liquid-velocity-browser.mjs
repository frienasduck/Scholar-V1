// Local production-only visual/performance harness. No API writes or AI calls.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const phase = process.argv[2] || 'before';
const base = process.env.SCHOLAR_QA_URL || 'http://127.0.0.1:3010';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw Error('Localhost only');
const out = `test-artifacts/liquid-velocity/${phase}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.SCHOLAR_QA_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [], blocked = [];
page.on('pageerror', e => errors.push(e.message));
await context.route('**/api/**', route => { blocked.push(new URL(route.request().url()).pathname); return route.abort('blockedbyclient'); });
await context.addInitScript(() => {
  const key = 'neha-scholar-v5';
  const saved = JSON.parse(localStorage.getItem(key) || '{"schema":6,"state":{"authed":false,"guestMode":false}}');
  saved.state.settings = { ...saved.state.settings, startupLoadingMode: 'quick', elamEnabled: false, mobileLamMode: 'off' };
  localStorage.setItem(key, JSON.stringify(saved));
  window.__velocity = { longTasks: [], shifts: [], events: [], lcp: [] };
  for (const type of ['longtask', 'layout-shift', 'event', 'largest-contentful-paint']) {
    try { new PerformanceObserver(list => { for (const e of list.getEntries()) {
      if (type === 'longtask') window.__velocity.longTasks.push(e.duration);
      if (type === 'layout-shift' && !e.hadRecentInput) window.__velocity.shifts.push(e.value);
      if (type === 'event') window.__velocity.events.push(e.duration);
      if (type === 'largest-contentful-paint') window.__velocity.lcp.push(e.startTime);
    } }).observe({ type, buffered: true, durationThreshold: 16 }); } catch {}
  }
});
const stats = () => page.evaluate(async () => {
  const frames = []; let last = performance.now();
  await new Promise(resolve => { function tick(now) { frames.push(now-last); last=now; if (frames.length < 90) requestAnimationFrame(tick); else resolve(); } requestAnimationFrame(tick); });
  const data = window.__velocity, nav = performance.getEntriesByType('navigation')[0];
  frames.sort((a,b) => a-b);
  return { domContentLoaded: nav?.domContentLoadedEventEnd, lcp: data.lcp.at(-1) ?? null, cls: data.shifts.reduce((a,b)=>a+b,0), longTasks: data.longTasks.length, longTaskMs: data.longTasks.reduce((a,b)=>a+b,0), eventMaxMs: Math.max(0,...data.events), frameP95Ms: frames[Math.floor(frames.length*.95)], framesOver34ms: frames.filter(x=>x>34).length, heapBytes: performance.memory?.usedJSHeapSize, domNodes: document.querySelectorAll('*').length, glassSurfaces: document.querySelectorAll('.sg-glass').length, refractiveSurfaces: document.querySelectorAll('[data-sg-optics="active"]').length, flags: { ...document.documentElement.dataset } };
});
try {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Continue as Guest', exact: true }).waitFor({ timeout: 60000 });
  const cold = await stats();
  await page.screenshot({ path: `${out}/homepage.png` });
  await page.getByRole('button', { name: 'Continue as Guest', exact: true }).click();
  await page.locator('#main-scroll').waitFor({ timeout: 60000 });
  await page.waitForTimeout(1000);
  const guestCold = await stats();
  await page.screenshot({ path: `${out}/dashboard.png` });
  const routes = ['study','exam-prep','chapter-command','notes','ebook','practice','mock-exam','planner','flashcards','settings','files','live-tutor','music','nigtube'];
  const routeResults = [];
  for (const route of routes) {
    const begin = Date.now();
    await page.goto(`${base}/${route}`, { waitUntil: 'domcontentloaded' });
    await page.locator(`#main-scroll[data-active-view="${route}"]`).waitFor({ timeout: 45000 });
    await page.waitForTimeout(600);
    routeResults.push({ route, shellReadyMs: Date.now()-begin, overflow: await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth+1), text: (await page.locator('#main-scroll').innerText()).slice(0,250) });
    await page.screenshot({ path: `${out}/${route}.png` });
  }
  await page.goto(base+'/dashboard', { waitUntil: 'domcontentloaded' });
  await page.locator('#main-scroll').waitFor(); await page.waitForTimeout(600);
  const warm = await stats();
  const responsive = [];
  for (const [width,height] of [[320,700],[360,800],[390,844],[430,932],[768,1024],[844,390],[1024,768],[1366,768],[1440,900],[1920,1080]]) {
    await page.setViewportSize({width,height}); await page.waitForTimeout(250);
    responsive.push({width,height,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)});
    await page.screenshot({path:`${out}/dashboard-${width}x${height}.png`});
  }
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:90000});
  await page.reload({waitUntil:'domcontentloaded'}); await page.locator('#main-scroll').waitFor({timeout:60000});
  const throttled = await stats();
  const result = {phase,base,apiMode:'all API requests blocked; real Guest UI; no AI/auth/private-data success claims',cold,guestCold,warm,throttled,routes:routeResults,responsive,errors,blockedApiPaths:[...new Set(blocked)]};
  await writeFile(`${out}/metrics.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
} finally { await browser.close(); }
