// Run against the local client; artifacts are local QA, never published automatically.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const out=process.env.QA_OUTPUT||'audio-match-qa';
const near=(a,b)=>assert.ok(Math.abs(a-b)<.00001,`${a} != ${b}`);
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{channel:'chrome'}),headless:true});
 try {
 const context=await browser.newContext({viewport:{width:1600,height:900}});
 await context.addInitScript(()=>{
   window.qaAudio=[];window.qaGains=[];window.qaContexts=[];
   const NativeAudio=window.Audio,NativeContext=window.AudioContext;
   window.Audio=new Proxy(NativeAudio,{construct(target,args){const a=new target(...args);window.qaAudio.push(a);return a;}});
   window.AudioContext=new Proxy(NativeContext,{construct(target,args){const c=new target(...args);window.qaContexts.push(c);const original=c.createGain.bind(c);c.createGain=()=>{const g=original(),connect=g.connect.bind(g);g.connect=dest=>{if(dest===c.destination)window.qaGains.push(g);return connect(dest);};return g;};return c;}});
 });
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765');await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>window.qaAudio.some(a=>!a.paused)),false,'no autoplay before gesture');
 await page.evaluate(()=>localStorage.setItem('fa_bgm_vol','20'));await page.reload();
 await page.click('#btnSettings');await page.waitForTimeout(800);
 async function slider(id,value){await page.locator('#'+id).evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},String(value));}
 await slider('bgmChannelVol',70);await slider('sfxChannelVol',30);
 await page.evaluate(()=>Sfx.playSummon());await page.waitForTimeout(300);
 const levels=await page.evaluate(()=>({bgm:Bgm.getChannelVolume(),sfx:Sfx.getChannelVolume(),master:Bgm.getVolume(),gain:qaGains[0]?.gain.value,bgmGain:qaAudio.find(a=>a.src.includes('/menu.'))?.volume}));
 assert.equal(levels.master,.2);assert.equal(levels.bgm,.7);assert.equal(levels.sfx,.3);near(levels.gain,.85*.04*.09);
 // Summon ducking can temporarily reduce music; turn ducking off before measuring.
 await page.evaluate(()=>Bgm.duck(false,40));await page.waitForTimeout(250);
 near(await page.evaluate(()=>qaAudio.find(a=>a.src.includes('/menu.')).volume),.04*.49);
 await page.locator('#sfxToggle').uncheck();assert.equal(await page.evaluate(()=>qaGains[0].gain.value),0);
 assert.equal(await page.evaluate(()=>Bgm.isWanted()),true);
 await page.locator('#bgmToggle').uncheck();await slider('sfxChannelVol',40);await page.locator('#sfxToggle').check();
 near(await page.evaluate(()=>qaGains[0].gain.value),.85*.04*.16);
 assert.equal(await page.evaluate(()=>qaAudio.every(a=>a.paused)),true);
 await page.screenshot({path:out+'/sound-independent.png'});
 await page.reload();await page.click('#btnSettings');await page.waitForTimeout(300);
 assert.equal(await page.locator('#bgmToggle').isChecked(),false,'first gesture respects persisted BGM off');
 assert.equal(await page.locator('#sfxToggle').isChecked(),true);
 assert.equal(await page.locator('#sfxChannelVol').inputValue(),'40');
 assert.equal(await page.locator('#bgmChannelVol').inputValue(),'70');
 assert.equal(await page.locator('#bgmVol').inputValue(),'20');
 await page.locator('#sfxChannelVol').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#sfxChannelVol').inputValue(),'41');
 await page.locator('#bgmToggle').check();await page.waitForTimeout(600);
 await page.screenshot({path:out+'/sound-controls.png'});
 await page.click('#btnSettingsClose');await page.click('#btnLobby');await page.waitForTimeout(250);
 assert.equal(await page.locator('#matchDemo').isVisible(),false,'preview is disabled by default');
 await page.goto('http://127.0.0.1:8765/?match-preview=1');
 // Isolated browser fixture only; verifies nonempty selected-deck layout without changing game data.
 await page.evaluate(()=>localStorage.setItem('fs-local-decks',JSON.stringify([{id:'qa-deck',name:'미리보기 덱',tribe:'earth',cards:[]}])));
 await page.click('#btnLobby');await page.waitForTimeout(250);
 assert.equal(await page.locator('#matchDemo').isVisible(),true,'explicit local-only preview');
 assert.doesNotMatch(await page.locator('#matchDemo').innerText(),/테스트 표시/);
 const before=await page.locator('#matchDemoCount').innerText();assert.ok(+before>=10&&+before<=100);
 const box=await page.locator('#btnMatch').boundingBox();
 const phases=new Set();for(let i=0;i<5;i++){phases.add(await page.locator('#matchDemoDots').innerText());await page.screenshot({path:out+`/demo-frame-${i}.png`});await page.waitForTimeout(720);}
 assert.equal(phases.size,3);await page.waitForTimeout(900);
 assert.notEqual(await page.locator('#matchDemoCount').innerText(),before);
 assert.deepEqual(await page.locator('#btnMatch').boundingBox(),box,'dot animation does not shift matching button');
 await page.screenshot({path:out+'/lobby-demo.png'});
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);
 assert.equal(await page.locator('#matchDemoDots').innerText(),'...');await page.waitForTimeout(800);assert.equal(await page.locator('#matchDemoDots').innerText(),'...');
 await page.click('#btnLobbyBack');const frozen=await page.locator('#matchDemoCount').innerText();await page.waitForTimeout(4200);assert.equal(await page.locator('#matchDemoCount').innerText(),frozen);
 await page.setViewportSize({width:844,height:390});await page.click('#btnSettings');
 await page.locator('#sfxChannelVol').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/sound-small.png'});
 for(const id of ['bgmVol','bgmChannelVol','sfxChannelVol']){const b=await page.locator('#'+id).boundingBox();assert.ok(b.width>=44&&b.height>=44);}
 await page.click('#btnSettingsClose');await page.click('#btnLobby');await page.screenshot({path:out+'/lobby-small.png'});
 const badge=await page.locator('#matchDemo').boundingBox();assert.ok(badge.x>=0&&badge.x+badge.width<=844);
 for(const [width,height] of [[568,320],[360,640],[844,390]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(200);
   assert.ok((await page.locator('#lobbySel').boundingBox()).height>0,'selected deck area does not collapse');
   assert.ok((await page.locator('.lobby-sel-icon').boundingBox()).height>0,'selected emblem is not collapsed');
   const panel=await page.locator('.lobby-right').boundingBox();
   for(const id of ['btnMatch','btnLobbyAi','btnLobbyBack']){
     await page.locator('#'+id).scrollIntoViewIfNeeded();const b=await page.locator('#'+id).boundingBox();
     assert.ok(b.height>=44&&b.y>=panel.y&&b.y+b.height<=panel.y+panel.height&&b.y+b.height<=height,`${id} remains reachable at ${width}x${height}`);
   }
   await page.locator('#matchDemo').scrollIntoViewIfNeeded();await page.screenshot({path:out+`/lobby-${width}x${height}.png`});
 }
 const touch=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
 const tp=await touch.newPage();await tp.goto('http://127.0.0.1:8765');await tp.locator('#btnSettings').tap();
 await tp.locator('#sfxChannelVol').scrollIntoViewIfNeeded();let r=await tp.locator('#sfxChannelVol').boundingBox();
 await tp.touchscreen.tap(r.x+r.width*.25,r.y+r.height/2);assert.ok(Number(await tp.locator('#sfxChannelVol').inputValue())<60);
 const val=await tp.locator('#sfxChannelVol').inputValue();await tp.locator('#sfxToggle').tap();assert.equal(await tp.locator('#sfxToggle').isChecked(),false);assert.equal(await tp.locator('#sfxChannelVol').inputValue(),val);
 await tp.screenshot({path:out+'/sound-touch.png'});await touch.close();
 assert.deepEqual(errors,[]);
 fs.writeFileSync(out+'/evidence.json',JSON.stringify({levels,countBefore:before,dotPhases:[...phases],checks:'independent channels, saved switches, refresh, first gesture, live native gain, keyboard, touch, reduced motion, timer cleanup'},null,2));
 console.log('PASS: independent audio, saved mute/refresh, autoplay gate, actual WebAudio gain, keyboard/touch, demo range/dots/layout/timer cleanup/reduced motion.');
 await context.close();
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
