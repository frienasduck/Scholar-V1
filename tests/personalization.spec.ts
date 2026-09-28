import {expect,test,type Page} from "@playwright/test";
import {DEFAULT_PREFERENCES,preferencesSchema} from "../src/lib/personalization/schema";
import {getCurriculum} from "../src/lib/curriculum-helper";
import {buildBlueprint} from "../src/lib/personalization/engine";
import type {LearningProfileView} from "../src/components/personalization/personalization-provider";
import { BUILD_VIDEO,SCHOLAR_SCENES } from "../src/components/personalization/personalization-presentation";
test.use({baseURL:process.env.SCHOLAR_QA_BASE_URL || "http://127.0.0.1:3000",actionTimeout:20_000,launchOptions:{executablePath:process.env.SCHOLAR_QA_BROWSER || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"}});
test.setTimeout(180_000);
test.afterEach(async({page},info)=>{
  if(info.status!==info.expectedStatus && !page.isClosed())console.log("Startup handoff diagnostics",await page.evaluate(()=>{
    const gate=document.querySelector<HTMLElement>("[data-startup-mode]");
    return {visibility:document.visibilityState,ready:document.querySelector(".your-scholar")?.getAttribute("data-startup-ready"),gate:gate ? {progress:gate.dataset.startupProgress,opacity:getComputedStyle(gate).opacity,pointerEvents:getComputedStyle(gate).pointerEvents,animations:gate.getAnimations({subtree:true}).map(a=>({state:a.playState,time:a.currentTime}))} : null};
  }));
});
const email="personalization@example.test";
const makeProfile=():LearningProfileView=>({required:true,status:"NOT_STARTED",stage:0,revision:0,preferences:structuredClone(DEFAULT_PREFERENCES),result:null,bonus:{total:52428800,used:0,closed:false},jobStartedAt:null});
async function fixture(page:Page,initial=makeProfile(),guest=false){
  const state={profile:initial,holdAnalysis:false,writes:0};
  const errors:string[]=[];page.on("pageerror",e=>{errors.push(e.message);console.log(e.stack);});
  await page.route("**/api/**",route=>route.fulfill({json:{ok:true,rooms:[],members:[],events:[],items:[],ebooks:[],files:[],memories:[],sessions:[],pendingPayment:null}}));
  await page.route(/\.mp4(?:\?.*)?$/,route=>route.fulfill({status:204,body:""}));
  await page.route("**/api/auth/session",route=>route.fulfill({json:{authenticated:!guest,developerMode:false,plan:"FREE",entitlementsLoaded:true,user:guest?null:{id:"profile-owner",email,name:"Aisha Learner",role:"USER",coins:0,currentScholarClass:11},access:{plan:"FREE",source:"free",entitlementsLoaded:true,entitlements:[],storageLimitBytes:10485760,dailyQuizLimit:3,dailySlideshowLimit:1,monthlyEbookUploadLimit:3,monthlyMockExamLimit:3},usage:{day:"2026-09-27",quiz:{used:0,limit:3},slideshow:{used:0,limit:1}},config:{subscriptionsEnabled:true,checkoutConfigured:false},beta:{privateBeta:false,registrationEnabled:true}}}));
  await page.route("**/api/personalization",async route=>{
    if(route.request().method()==="PATCH"){
      const input=route.request().postDataJSON();state.writes++;state.profile={...state.profile,status:input.action==="skip"?"SKIPPED":"IN_PROGRESS",stage:input.stage??state.profile.stage,preferences:input.preferences??state.profile.preferences,revision:state.profile.revision+1,bonus:{...state.profile.bonus,closed:input.action==="skip" || state.profile.bonus.closed}};
    }
    await route.fulfill({json:state.profile});
  });
  await page.route("**/api/personalization/analyze",async route=>{
    state.profile.status="COMPLETED";state.profile.result={...buildBlueprint(state.profile.preferences,state.profile.bonus.used ? [{id:"book-1",title:"My revision notes"}]:[]),ai:"fallback"};state.profile.bonus.closed=true;
    const body=[{stage:"profile",message:"Profile validated."},{stage:"priorities",message:"Priorities built."},{stage:"lam",message:"LAM defaults configured."},{stage:"strategy",message:"Strategy ready."},{stage:"dashboard",message:"Dashboard saved."},{profile:state.profile}].map(event=>`data: ${JSON.stringify(event)}\n\n`).join("");
    await route.fulfill({contentType:"text/event-stream",body});
  });
  await page.route("**/api/ebooks",async route=>{if(route.request().method()==="POST"){state.profile.bonus.used+=100;await route.fulfill({status:201,json:{ok:true,ebook:{id:"book-1",title:"My revision notes",processingStatus:"ready"}}});}else await route.fulfill({json:{ebooks:[],usage:{used:0,limit:3}}});});
  await page.addInitScript(({email,guest})=>{
    localStorage.setItem("scholar-workspace-owner-v1",guest?"guest":email);
    localStorage.setItem("neha-scholar-v5",JSON.stringify({schema:6,state:{authed:true,guestMode:guest,onboarded:true,user:{email:guest?"":email,name:"Aisha Learner",username:"aisha",bio:"",school:"",class:"11 - CBSE",avatar:"A",scholarClass:11,jeeMode:false},settings:{mobileLamMode:"off",elamEnabled:false,reduceMotion:false,startupLoadingMode:"quick"}}}));
  },{email,guest});
  return {state,errors};
}
async function ready(page:Page){await expect(page.locator(".your-scholar")).toHaveAttribute("data-startup-ready","true",{timeout:30_000});await expect(page.locator("[data-startup-mode]")).toBeHidden({timeout:5_000});}
async function open(page:Page){await page.goto("/",{waitUntil:"domcontentloaded"});await ready(page);}
async function next(page:Page){await page.getByRole("button",{name:"Continue",exact:true}).click();}
async function noOverflow(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);}
test("full personalized arrival, reactive feedback, PDF bonus, fallback, dashboard and settings",async({page})=>{
  const {state,errors}=await fixture(page);await page.setViewportSize({width:1440,height:900});await open(page);
  await page.screenshot({path:"test-artifacts/personalization-intro-desktop.png"});
  await page.getByRole("button",{name:"Build my Scholar",exact:true}).click();
  const subject=getCurriculum(11)[0];await page.getByRole("button",{name:subject.name,exact:false}).last().click();await next(page);
  await page.getByRole("button",{name:"JEE Main",exact:false}).click();await expect(page.locator(".your-scholar-feedback")).toContainText("Plus gates");await next(page);
  await page.getByRole("group",{name:"Priority subjects"}).getByRole("button").first().click();await expect(page.locator(".your-scholar-feedback")).toContainText("come first");await next(page);
  await page.getByRole("button",{name:"Remembering",exact:false}).click();await next(page);
  await page.getByRole("group",{name:"Explanation preference"}).getByRole("button",{name:"Short and direct",exact:false}).click();await next(page);
  await page.getByRole("button",{name:"Exam Coach",exact:false}).click();await next(page);
  await page.getByLabel("Your daily target · minutes").fill("45");await next(page);await next(page);await next(page);
  await expect(page.locator('input[type="file"]')).toBeHidden();await expect(page.getByRole("button",{name:"Choose a study PDF"})).toBeEnabled();
  await page.locator('input[type="file"]').setInputFiles({name:"notes.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.7 study notes")});
  await expect(page.getByRole("status").filter({hasText:"Imported and ready"})).toBeVisible();await expect(page.locator(".your-scholar-import-meter")).toContainText("50.0 MB available");
  await page.screenshot({path:"test-artifacts/personalization-import-desktop.png"});await next(page);
  await expect(page.getByText("SCHOLAR PLUS",{exact:true})).toBeVisible();await page.screenshot({path:"test-artifacts/personalization-plus-desktop.png"});
  await page.getByRole("button",{name:"Continue Free · Build my Scholar"}).click();await expect(page.getByRole("heading",{name:"Welcome to your Scholar, Aisha."})).toBeVisible();
  await page.screenshot({path:"test-artifacts/personalization-reveal-desktop.png"});await page.getByRole("button",{name:"Enter my Scholar"}).click();
  await expect(page.locator(".scholar-today")).toContainText(subject.name);await expect(page.locator(".scholar-today")).toContainText("45 min");await expect(page.locator(".scholar-today")).toContainText("My revision notes");
  expect(state.profile.status).toBe("COMPLETED");
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("scholar-lam-v1-class-11")??"{}").preferences.liveTutorPersonality)).toBe("exam");
  await page.screenshot({path:"test-artifacts/personalization-dashboard-desktop.png"});
  await page.goto("/settings");await page.getByRole("tab",{name:"Learning Profile"}).click();await expect(page.locator(".learning-profile")).toContainText("45 minutes");expect(errors).toEqual([]);
});
test("saved drafts resume, skipped account bypasses, existing invitation dismisses permanently",async({page})=>{
  const {state,errors}=await fixture(page);await open(page);await page.getByRole("button",{name:"Build my Scholar",exact:true}).click();await next(page);await next(page);
  await page.reload();await ready(page);await expect(page.getByRole("heading",{name:"Where should we put our energy?"})).toBeVisible();
  await page.getByRole("button",{name:"Skip setup for now"}).click();await expect(page.locator(".scholar-shell")).toBeVisible();await page.reload();await expect(page.locator(".scholar-shell")).toBeVisible();expect(state.profile.status).toBe("SKIPPED");
  state.profile={...makeProfile(),required:false};await page.reload();await expect(page.getByRole("button",{name:"Personalize Scholar",exact:true})).toBeVisible();await page.getByRole("button",{name:"Not now",exact:true}).click();await page.reload();await expect(page.getByRole("button",{name:"Personalize Scholar",exact:true})).toHaveCount(0);expect(errors).toEqual([]);
});
test("Guest and completed users bypass authenticated questions",async({page})=>{
  const {errors}=await fixture(page,{...makeProfile(),status:"COMPLETED",result:buildBlueprint(DEFAULT_PREFERENCES)},true);await page.goto("/");await expect(page.locator(".scholar-shell")).toBeVisible();expect(await page.locator(".your-scholar").count()).toBe(0);expect(errors).toEqual([]);
});
test("Learning Profile edits rebuild real defaults without renewing the import bonus",async({page})=>{
  const saved={...makeProfile(),required:false,status:"COMPLETED" as const,stage:11,result:buildBlueprint(DEFAULT_PREFERENCES),bonus:{total:52428800,used:100,closed:true}};
  const {state,errors}=await fixture(page,saved);await page.goto("/settings");await expect(page.locator(".scholar-shell")).toBeVisible({timeout:30_000});await page.getByRole("tab",{name:"Learning Profile"}).click();
  await page.getByRole("button",{name:"Edit preferences / Save changes"}).click();await expect(page.locator(".your-scholar")).toHaveAttribute("data-setup-stage","1");
  for(let stage=1;stage<=6;stage++)await next(page);
  await page.getByLabel("Your daily target · minutes").fill("60");await next(page);await next(page);await next(page);
  await expect(page.locator(".your-scholar-import-meter")).toContainText("closed");await next(page);
  await page.getByRole("button",{name:"Continue Free · Build my Scholar"}).click();await page.getByRole("button",{name:"Enter my Scholar"}).click();
  await expect(page.locator(".scholar-today")).toContainText("60 min");expect(state.profile.bonus).toEqual({total:52428800,used:100,closed:true});expect(errors).toEqual([]);
});
test("mobile save failure is recoverable and keyboard Skip keeps the account usable",async({page})=>{
  const {state,errors}=await fixture(page);await page.setViewportSize({width:390,height:844});await open(page);
  let fail=true;await page.route("**/api/personalization",async route=>{if(route.request().method()==="PATCH" && fail){fail=false;await route.fulfill({status:503,json:{message:"Your answers could not be saved. Check your connection and retry."}});}else await route.fallback();});
  await page.getByRole("button",{name:"Build my Scholar",exact:true}).click();await expect(page.locator(".your-scholar-error")).toContainText("retry");await page.getByRole("button",{name:"Build my Scholar",exact:true}).click();
  await expect(page.locator(".your-scholar")).toHaveAttribute("data-setup-stage","1");await noOverflow(page);
  const skip=page.getByRole("button",{name:"Skip setup for now"});await skip.focus();await page.keyboard.press("Enter");await expect(page.locator(".scholar-shell")).toBeVisible();expect(state.profile.status).toBe("SKIPPED");expect(errors).toEqual([]);
});
test("console stays clean and 200-percent-equivalent reflow keeps keyboard controls reachable",async({page})=>{
  const {errors}=await fixture(page);
  const consoleErrors:string[]=[];const httpErrors:string[]=[];
  page.on("console",message=>{if(message.type()==="error")consoleErrors.push(message.text());});
  page.on("response",response=>{if(response.status()>=400)httpErrors.push(`${response.status()} ${response.url()}`);});
  // 1440x900 at 200% browser zoom has a 720x450 CSS layout viewport.
  // This verifies equivalent reflow, not the operating system's browser zoom control.
  await page.setViewportSize({width:720,height:450});await open(page);await noOverflow(page);
  const begin=page.getByRole("button",{name:"Build my Scholar",exact:true});await begin.focus();await page.keyboard.press("Enter");
  await expect(page.locator(".your-scholar")).toHaveAttribute("data-setup-stage","1");
  for(let stage=1;stage<=11;stage++){
    await noOverflow(page);
    const control=stage===11 ? page.getByRole("button",{name:"Continue Free · Build my Scholar"}) : page.getByRole("button",{name:"Continue",exact:true});
    await control.scrollIntoViewIfNeeded();await expect(control).toBeInViewport();await control.focus();await page.keyboard.press("Enter");
  }
  await expect(page.getByRole("button",{name:"Enter my Scholar"})).toBeVisible();await noOverflow(page);
  await page.getByRole("button",{name:"Enter my Scholar"}).click();await expect(page.locator(".scholar-today")).toBeVisible();
  expect(errors).toEqual([]);expect(consoleErrors).toEqual([]);expect(httpErrors).toEqual([]);
});
test("an expired exam resumes safely without resetting unrelated answers or trapping the build",async({page})=>{
  const {state,errors}=await fixture(page,{...makeProfile(),status:"IN_PROGRESS",stage:11,preferences:{...DEFAULT_PREFERENCES,dailyGoal:45,style:"Short and direct",exam:{name:"Past exam",date:"2000-01-01",subjects:[]}}});
  await open(page);await expect(page.locator(".your-scholar-stage")).toContainText("your other choices stay intact");
  await page.getByRole("button",{name:"Continue Free · Build my Scholar"}).click();await page.getByRole("button",{name:"Enter my Scholar"}).click();
  await expect(page.locator(".scholar-today")).toContainText("45 min");expect(state.profile.preferences.exam).toBeNull();expect(state.profile.preferences.style).toBe("Short and direct");expect(errors).toEqual([]);
});
test("a failed build can be skipped without an endless analysis screen",async({page})=>{
  const {state,errors}=await fixture(page,{...makeProfile(),status:"IN_PROGRESS",stage:11});
  await page.route("**/api/personalization/analyze",route=>route.fulfill({contentType:"text/event-stream",body:'data: {"error":true,"message":"Your answers are saved. Retry the build."}\n\n'}));
  await open(page);await page.getByRole("button",{name:"Continue Free · Build my Scholar"}).click();await expect(page.locator(".your-scholar-build-error")).toContainText("Retry");
  await page.getByRole("button",{name:"Skip setup for now"}).click();await expect(page.locator(".scholar-shell")).toBeVisible();expect(state.profile.status).toBe("SKIPPED");expect(state.profile.bonus.closed).toBe(true);expect(errors).toEqual([]);
});
const viewports=[[1920,1080],[1600,900],[1440,900],[1366,768],[1280,800],[1280,720],[1152,720],[1024,768],[1024,600],[1024,1366],[834,1194],[768,1024],[430,932],[412,915],[390,844],[375,812],[360,800],[320,568],[844,390],[812,375],[740,360]];
test("every question, import and Plus stay usable at all 21 required viewports",async({page})=>{
  test.setTimeout(360_000);
  const {state,errors}=await fixture(page,{...makeProfile(),preferences:{...DEFAULT_PREFERENCES,subjects:getCurriculum(11).map(s=>s.id)}});
  await page.setViewportSize({width:1920,height:1080});await open(page);
  for(const [width,height] of viewports){
    await page.setViewportSize({width,height});await noOverflow(page);await page.getByRole("button",{name:"Build my Scholar",exact:true}).click();
    for(let stage=1;stage<=11;stage++){
      await expect(page.locator(".your-scholar")).toHaveAttribute("data-setup-stage",String(stage));await noOverflow(page);
      if(stage===8){await page.getByRole("button",{name:"Add an exam",exact:false}).click();await page.getByLabel("Exam name",{exact:true}).fill("Term assessment");await page.getByLabel("Approximate date").fill(new Date(Date.now()+30*86400000).toISOString().slice(0,10));}
      const button=stage===11 ? page.getByRole("button",{name:"Continue Free · Build my Scholar"}) : page.getByRole("button",{name:"Continue",exact:true});
      await button.scrollIntoViewIfNeeded();await expect(button).toBeInViewport();await expect(page.getByRole("button",{name:"Skip setup for now"})).toBeEnabled();
      if([1440,1024,390,320,844].includes(width) && [1,3,5,6,7,8,9,10,11].includes(stage))await page.screenshot({path:`test-artifacts/personalization-${width}x${height}-step${stage}.png`});
      if(stage<11)await button.click();
    }
    for(let back=11;back>0;back--){await page.getByRole("button",{name:"Back",exact:true}).click();await expect(page.locator(".your-scholar")).toHaveAttribute("data-setup-stage",String(back-1));}
  }
  expect(state.writes).toBeGreaterThan(400);
  expect(errors).toEqual([]);
});

test("provided build video plays, pauses for reveal and releases on arrival",async({page})=>{
  test.skip(!process.env.SCHOLAR_QA_LIVE_MEDIA,"Opt-in check against the supplied remote video; normal regressions stay offline.");
  const {state,errors}=await fixture(page,{...makeProfile(),status:"ANALYZING",stage:11,jobStartedAt:new Date().toISOString()});
  await page.route(/\.mp4(?:\?.*)?$/,route=>route.continue());
  await open(page);
  await expect(page.locator(".your-scholar-build-backdrop")).toHaveAttribute("data-video-ready","true",{timeout:15_000});
  const video=page.locator(`video[src="${BUILD_VIDEO}"]`);
  const element=await video.elementHandle();
  expect(await video.evaluate(el=>el instanceof HTMLVideoElement && !el.paused && el.readyState>=2 && el.muted && !el.controls)).toBe(true);
  expect(await video.evaluate(el=>getComputedStyle(el).objectFit)).toBe("cover");
  await page.screenshot({path:"test-artifacts/your-scholar-live-build-video.png"});
  state.profile={...state.profile,status:"COMPLETED",result:{...buildBlueprint(DEFAULT_PREFERENCES),ai:"fallback"}};
  await expect(page.getByRole("button",{name:"Enter my Scholar"})).toBeVisible({timeout:10_000});
  expect(await video.evaluate(el=>el instanceof HTMLVideoElement && el.paused)).toBe(true);
  await page.getByRole("button",{name:"Enter my Scholar"}).click();
  await expect(page.locator(".your-scholar-build-backdrop")).toHaveCount(0);
  expect(await element!.evaluate(el=>el instanceof HTMLVideoElement && el.paused && el.getAttribute("src")===null)).toBe(true);
  expect(errors).toEqual([]);
});
test("planet resume and reduced motion remain readable at compact and landscape sizes",async({page})=>{
  const {state,errors}=await fixture(page,{...makeProfile(),status:"ANALYZING",stage:11,jobStartedAt:new Date().toISOString(),bonus:{total:52428800,used:100,closed:false}});
  await page.setViewportSize({width:1440,height:900});await open(page);
  for(const [width,height]of [[1440,900],[1024,600],[390,844],[320,568],[844,390]]){
    await page.setViewportSize({width,height});state.profile.jobStartedAt=new Date().toISOString();await expect(page.locator(".your-scholar-journey")).toBeVisible();await noOverflow(page);await page.screenshot({path:`test-artifacts/personalization-planet-${width}x${height}.png`});
  }
  await page.emulateMedia({reducedMotion:"reduce"});expect(await page.locator(".your-scholar-orbit-loader").evaluate(el=>getComputedStyle(el).animationName)).toBe("none");
  state.profile={...state.profile,status:"COMPLETED",result:{...buildBlueprint(preferencesSchema.parse({...DEFAULT_PREFERENCES,dailyGoal:45})),ai:"fallback"}};
  await expect(page.getByRole("button",{name:"Enter my Scholar"})).toBeVisible({timeout:10_000});await noOverflow(page);expect(errors).toEqual([]);
});

test("cinematic interface stays responsive and no build video loads during early questions",async({page})=>{
  const {errors}=await fixture(page);
  await open(page);
  await expect(page.locator('.your-scholar-scene-video[data-scene="earth"]')).toHaveAttribute("src",SCHOLAR_SCENES.earth.video);
  expect(await page.locator(".your-scholar-stage").evaluate(el=>getComputedStyle(el).backgroundImage)).toContain("linear-gradient");
  for(const [width,height] of [[1920,1080],[1440,900],[1024,600],[768,1024],[430,932],[375,812],[320,568],[844,390]]) {
    await page.setViewportSize({width,height});await noOverflow(page);
    await expect(page.getByRole("button",{name:"Build my Scholar",exact:true})).toBeEnabled();
    expect(await page.locator(`video[src="${BUILD_VIDEO}"]`).count()).toBe(0);
    await page.screenshot({path:`test-artifacts/your-scholar-cinematic-intro-${width}x${height}.png`});
  }
  await page.getByRole("button",{name:"Build my Scholar",exact:true}).click();
  await expect(page.getByRole("list",{name:"Your Scholar journey"})).toBeVisible();
  await expect(page.getByRole("group",{name:"Choose background atmosphere"})).toHaveCount(0);
  await expect(page.locator(".your-scholar")).toHaveAttribute("data-setup-stage","1");
  await page.getByRole("group",{name:"Curriculum"}).getByRole("button",{name:"State"}).click();
  await expect(page.getByRole("group",{name:"Curriculum"}).getByRole("button",{name:"State"})).toHaveAttribute("aria-pressed","true");
  expect(await page.getByRole("group",{name:"Curriculum"}).getByRole("button",{name:"State"}).evaluate(el=>getComputedStyle(el,"::before").animationName)).toBe("ys-choice-light");
  for(const [width,height] of [[1440,900],[1024,600],[768,1024],[430,932],[375,812],[320,568],[844,390]]) {
    await page.setViewportSize({width,height});await noOverflow(page);
    expect(await page.locator(".your-scholar-stage").evaluate(el=>getComputedStyle(el).backdropFilter)).toContain("blur(");
    if(width<=480)expect(await page.locator(".your-scholar-choice").first().evaluate(el=>getComputedStyle(el).backdropFilter)).toBe("none");
    await page.getByRole("button",{name:"Continue",exact:true}).scrollIntoViewIfNeeded();
    await expect(page.getByRole("button",{name:"Continue",exact:true})).toBeInViewport();
    await page.screenshot({path:`test-artifacts/your-scholar-cinematic-question-${width}x${height}.png`});
  }
  await page.emulateMedia({reducedMotion:"reduce"});
  await expect(page.locator(".your-scholar-scene-video")).toHaveCount(0);
  expect(await page.locator('.your-scholar-scene-layer[data-active="true"]').evaluate(el=>getComputedStyle(el).backgroundImage)).toContain("20260827_202133");
  expect(errors).toEqual([]);
});

test("supplied live scene video plays and automatically crossfades without advancing setup",async({page})=>{
  test.skip(!process.env.SCHOLAR_QA_LIVE_MEDIA,"Opt-in live media check; normal regressions stay offline.");
  const {errors}=await fixture(page);
  await page.route(/\.mp4(?:\?.*)?$/,route=>route.continue());
  await page.setViewportSize({width:1440,height:900});await open(page);
  await expect(page.locator('.your-scholar-scene-video[data-scene="earth"]')).toHaveAttribute("data-visible","true",{timeout:20_000});
  expect(await page.locator('.your-scholar-scene-video[data-scene="earth"]').evaluate(el=>el instanceof HTMLVideoElement && !el.paused && el.readyState>=2)).toBe(true);
  await page.screenshot({path:"test-artifacts/your-scholar-live-entrance.png"});
  await expect(page.getByRole("group",{name:"Choose background atmosphere"})).toHaveCount(0);
  await expect(page.locator(".your-scholar-scene")).toHaveAttribute("data-scene","venus",{timeout:12_000});
  await expect(page.locator('.your-scholar-scene-video[data-scene="venus"]')).toHaveAttribute("data-visible","true",{timeout:20_000});
  await expect(page.locator('.your-scholar-scene-layer[data-scene="venus"]')).toHaveCSS("opacity","1");
  await expect(page.locator(".your-scholar")).toHaveAttribute("data-setup-stage","0");
  await page.screenshot({path:"test-artifacts/your-scholar-live-venus.png"});
  expect(errors).toEqual([]);
});

test("Continue visibly loads while saving before the next question appears",async({page})=>{
  const {errors}=await fixture(page);
  await page.route("**/api/personalization",async route=>{
    if(route.request().method()==="PATCH")await new Promise(resolve=>setTimeout(resolve,700));
    await route.fallback();
  });
  await open(page);
  await page.getByRole("button",{name:"Build my Scholar",exact:true}).click();
  const loading=page.locator('.your-scholar-next[data-loading="true"]');
  await expect(loading).toBeVisible();
  await expect(loading).toContainText("Opening next question");
  expect(await loading.locator(".your-scholar-next-spinner").evaluate(el=>getComputedStyle(el).animationName)).toBe("ys-next-spin");
  await expect(page.locator(".your-scholar")).toHaveAttribute("data-setup-stage","0");
  await expect(page.locator(".your-scholar")).toHaveAttribute("data-setup-stage","1");
  await page.getByRole("button",{name:"Continue",exact:true}).click();
  await expect(loading).toBeVisible();
  await expect(page.locator(".your-scholar")).toHaveAttribute("data-setup-stage","2");
  expect(errors).toEqual([]);
});

test("build is fullscreen, uncluttered and completes when video fails; personalized reveal stays editable",async({page})=>{
  const prefs=preferencesSchema.parse({...DEFAULT_PREFERENCES,dailyGoal:75,studyWindow:"Evening",personality:"exam",goals:["JEE Main"]});
  const {state,errors}=await fixture(page,{...makeProfile(),status:"ANALYZING",stage:11,preferences:prefs,jobStartedAt:new Date().toISOString()});
  await page.route(/\.mp4(?:\?.*)?$/,route=>route.abort());
  await open(page);
  await expect(page.locator(".your-scholar-build-backdrop")).toBeVisible();
  await expect(page.locator(".your-scholar-stage")).toHaveCount(0);
  await expect(page.locator(".your-scholar-header")).toHaveCount(0);
  await expect(page.locator(".your-scholar-orbit-loader")).toHaveCount(1);
  await expect(page.locator(".your-scholar-build-backdrop")).toHaveAttribute("data-video-fallback","true");
  await page.screenshot({path:"test-artifacts/your-scholar-build-fallback.png"});
  state.profile={...state.profile,status:"COMPLETED",result:{...buildBlueprint(prefs),ai:"fallback"}};
  await expect(page.getByRole("heading",{name:"Welcome to your Scholar, Aisha."})).toBeVisible({timeout:10_000});
  await expect(page.getByText("Built around how you learn.",{exact:true})).toBeVisible();
  await expect(page.locator(".your-scholar-reveal")).toContainText("75");
  expect(await page.locator(".your-scholar-reveal li").count()).toBeLessThanOrEqual(5);
  await page.screenshot({path:"test-artifacts/your-scholar-cinematic-reveal.png"});
  await page.getByRole("button",{name:"Adjust preferences"}).click();
  await expect(page.locator(".your-scholar")).toHaveAttribute("data-setup-stage","1");
  await expect(page.getByRole("heading",{name:"Your studies, your starting point."})).toBeVisible();
  expect(errors).toEqual([]);
});

test("ready startup handoff releases the UI even if its animations stop",async({page})=>{
  const {errors}=await fixture(page);
  await page.addInitScript(()=>{
    const observer=new MutationObserver(()=>{
      const gate=document.querySelector<HTMLElement>("[data-startup-mode]");
      if(gate?.style.opacity==="0" && gate.style.pointerEvents==="none"){
        gate.getAnimations({subtree:true}).forEach(animation=>animation.cancel());
        (window as Window & {gateExitCancelled?:boolean}).gateExitCancelled=true;
        observer.disconnect();
      }
    });
    observer.observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:["style"]});
  });
  await open(page);
  expect(await page.evaluate(()=>(window as Window & {gateExitCancelled?:boolean}).gateExitCancelled)).toBe(true);
  await expect(page.locator("[data-startup-mode]")).toHaveCount(0);
  await page.getByRole("button",{name:"Build my Scholar",exact:true}).click();
  await expect(page.locator(".your-scholar")).toHaveAttribute("data-setup-stage","1");
  expect(errors).toEqual([]);
});

test("locked Plus navigation remains responsive and the selected menu pill settles cleanly",async({page})=>{
  const {errors}=await fixture(page,{...makeProfile(),required:false,status:"SKIPPED"});
  await page.setViewportSize({width:1440,height:900});
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator(".scholar-shell")).toBeVisible({timeout:30_000});
  const nav=page.locator(".scholar-desktop-sidebar nav");
  for(const [label,title,view] of [["Practical Lab","Practical Lab","practicals"],["Python Workspace","Python Workspace","python"],["Derivation Library","Derivation Library","derivations"]]){
    await nav.getByRole("button",{name:new RegExp(label)}).click();
    await expect(page.locator("#main-scroll")).toHaveAttribute("data-active-view",view);
    await expect(page.getByRole("heading",{name:`Unlock ${title}`})).toBeVisible();
    await expect(nav.locator(".sg-nav-pill-motion")).toHaveCount(1);
    await expect(nav.locator(".sg-nav-pill-motion [data-sg-glass]")).toHaveCount(0);
    await expect(page.locator(".scholar-plus-gate-panel")).toHaveCSS("backdrop-filter","none");
  }
  await page.screenshot({path:"test-artifacts/locked-plus-navigation-lightweight.png"});
  await page.setViewportSize({width:390,height:844});
  await page.getByRole("button",{name:"Open navigation menu"}).click();
  await page.locator('[data-slot="sheet-content"] nav').getByRole("button",{name:/Python Workspace/}).click();
  await expect(page.locator("#main-scroll")).toHaveAttribute("data-active-view","python");
  await expect(page.getByRole("heading",{name:"Unlock Python Workspace"})).toBeVisible();
  await expect(page.locator(".scholar-plus-gate-panel")).toHaveCSS("backdrop-filter","none");
  expect(errors).toEqual([]);
});
