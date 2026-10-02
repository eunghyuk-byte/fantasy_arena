// Real browser regression for uniform medals, continuous center and complete turns.
// Uses only temporary browser-local decks; never fabricates a server match.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.LOBBY_MEDALLION_QA_DIR||'../../medallion-qa');fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json','.ttf':'font/ttf'};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
 const results=[];
 for(const viewport of [{width:1672,height:941},{width:390,height:844},{width:844,height:390},{width:3840,height:2160}]){
  const context=await browser.newContext({viewport,hasTouch:true,recordVideo:{dir:path.join(out,'video'),size:viewport.width>1000?{width:1280,height:720}:{width:viewport.width,height:viewport.height}}});
  await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='sanctuary.test')return r.abort();const p=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!p.startsWith(root+path.sep)||!fs.existsSync(p))return r.fulfill({status:404,body:''});return r.fulfill({contentType:mime[path.extname(p)]||'application/octet-stream',body:fs.readFileSync(p)});});
  await context.addInitScript(()=>{let api;Object.defineProperty(window,'LobbySeal3D',{configurable:true,get:()=>api,set:v=>{const make=v.create;v.create=(...a)=>window.__seal=make(...a);api=v;}});});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://sanctuary.test');await page.waitForFunction(()=>!!window.Lobby);
  await page.evaluate(()=>{persistLocalDecks(TRIBES.map((t,i)=>({id:'medal-qa-'+i,name:t.name+' 덱',tribe:t.id,cards:buildDeck(t.id).map(c=>typeof c==='string'?c:c.id)})));Lobby.open();});
  await page.waitForFunction(()=>Lobby.sealRendererStats()?.textureReady);await page.waitForTimeout(150);
  if(viewport.width===3840){await page.evaluate(()=>{const a=document.getElementById('app');a.style.width='3840px';a.style.height='2160px';});await page.waitForTimeout(150);}
  const portrait=await page.locator('.lobby-sel-icon').boundingBox();
  const report={viewport,errors,angles:[],portrait};
  // Draw every integer degree. Sample pictures around the entire turn and prove
  // the WebGL buffer did receive every draw, independently of rAF animation.
  const startFrames=await page.evaluate(()=>window.__seal.stats.frames);
  for(let first=0;first<=360;first+=30){
   await page.evaluate(first=>{for(let a=first;a<Math.min(first+30,361);a++)window.__seal.render(a,.3);window.__seal.render(first,.3);},first);
   assert.deepEqual(await page.locator('.lobby-sel-icon').boundingBox(),portrait,'portrait fixed at '+first);
   if(viewport.width===1672||viewport.width===390)await page.screenshot({path:path.join(out,`${viewport.width}-angle-${first}.png`)});
   report.angles.push(first);
  }
  assert.ok(await page.evaluate(()=>window.__seal.stats.frames)-startFrames>=361);
  // Save actual artist-facing medal detail and an updated fallback from the same
  // renderer. The exported alpha layer contains no controls, text or background.
  if(viewport.width===1672){
   const isolated=await page.evaluate(async()=>{
    window.__liveSeal=window.__seal;const c=document.createElement('canvas');c.style.cssText='position:fixed;left:-2000px;width:1400px;height:1400px';document.body.append(c);
    const renderer=LobbySeal3D.create(c);while(!renderer.stats.textureReady)await new Promise(r=>setTimeout(r,10));renderer.render(0,0);const png=c.toDataURL();c.remove();return png;
   });
   fs.writeFileSync(path.join(out,'seal-isolated.png'),Buffer.from(isolated.split(',')[1],'base64'));
   if(process.env.UPDATE_SEAL_FALLBACK==='1')fs.writeFileSync(path.join(root,'assets/img/lobby/reference-seal-fallback.png'),Buffer.from(isolated.split(',')[1],'base64'));
   // The wrapper captures the isolated instance; restore the live canvas renderer.
   await page.evaluate(()=>{window.__seal=window.__liveSeal;});
   await page.waitForFunction(()=>window.__seal.stats.textureReady);
  }
  const angle=()=>page.locator('#lobbySealRotor').evaluate(e=>Number(e.style.transform.match(/rotate\(([^d]+)deg/)?.[1]||0));
  const m={start:await angle()};await page.locator('#btnMatch').tap();await page.waitForTimeout(350);m.a=await angle();await page.waitForTimeout(850);m.b=await angle();await page.waitForTimeout(1700);m.c=await angle();
  assert.ok(m.a>m.start&&m.b>m.a&&m.c>m.b);assert.ok((m.b-m.a)/.85>(m.a-m.start)/.35,'accelerates');
  assert.deepEqual(await page.locator('.lobby-sel-icon').boundingBox(),portrait);
  assert.equal(await page.evaluate(()=>Lobby._state.matchState),'idle','local preview has no fake match event');
  await page.screenshot({path:path.join(out,`${viewport.width}-spinning.png`)});
  await page.locator('#btnMatch').tap();m.cancel=await angle();await page.waitForTimeout(350);m.coastA=await angle();await page.waitForTimeout(650);m.coastB=await angle();await page.waitForTimeout(1100);m.stopped=await angle();await page.waitForTimeout(300);m.stable=await angle();
  assert.ok(m.coastA>m.cancel&&m.stopped>m.coastA);assert.ok((m.coastB-m.coastA)/.65<(m.coastA-m.cancel)/.35,'decelerates');assert.equal(m.stable,m.stopped,'no stop jump');
  for(let n=0;n<5;n++){await page.locator('#btnMatch').tap();await page.waitForTimeout(70);}await page.locator('#btnLobbyBack').tap();await page.waitForSelector('#title.active');
  assert.equal(await page.locator('#sealPreviewStatus').isHidden(),true,'rapid repeats and back clean up');
  await page.click('#btnLobby');await page.waitForSelector('#lobby.active');await page.waitForTimeout(200);const idle=await angle();await page.waitForTimeout(250);assert.equal(await angle(),idle,'reenter does not restart stale rotation');
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#btnMatch').tap();await page.waitForTimeout(350);assert.equal(await angle(),idle,'reduced motion remains stationary');
  assert.deepEqual(errors,[]);report.motion=m;report.stats=await page.evaluate(()=>Lobby.sealRendererStats());
  assert.equal(report.stats.glyphsReady,true);assert.equal(report.stats.medallions,6);assert.equal(report.stats.continuousCenter,true);
  if(viewport.width===3840)assert.ok(report.stats.bufferWidth>=Math.floor(await page.locator('#lobbySealCanvas').evaluate(c=>c.getBoundingClientRect().width)));
  await page.screenshot({path:path.join(out,`${viewport.width}-final.png`)});results.push(report);await context.close();console.log('PASS complete turn and live motion '+viewport.width+'x'+viewport.height);
 }
 await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({pass:true,mode:'Temporary browser-local decks; no account branch or network stubs',results},null,2));
})().catch(e=>{console.error(e);process.exit(1)});
