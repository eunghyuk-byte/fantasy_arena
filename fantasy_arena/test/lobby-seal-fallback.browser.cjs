const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.LOBBY_FALLBACK_QA_DIR||'../../medallion-fallback-qa');fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json','.ttf':'font/ttf'};
(async()=>{
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
const results=[];
for(const mode of ['normal','asset-404','canvas-read-error','source-upload-error','atlas-upload-error','stone-read-error','stone-upload-error']){
 const context=await browser.newContext({viewport:{width:1672,height:941}});
 await context.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname!=='sanctuary.test')return r.abort();if(mode==='asset-404'&&u.pathname==='/assets/img/icons/water.png')return r.fulfill({status:404,body:''});const p=path.join(root,u.pathname==='/'?'index.html':u.pathname);if(!p.startsWith(root)||!fs.existsSync(p))return r.fulfill({status:404,body:''});return r.fulfill({contentType:mime[path.extname(p)]||'application/octet-stream',body:fs.readFileSync(p)});});
 if(mode==='canvas-read-error')await context.addInitScript(()=>{const original=CanvasRenderingContext2D.prototype.getImageData;CanvasRenderingContext2D.prototype.getImageData=function(...args){if(this.canvas.width===1536&&this.canvas.height===256)throw new DOMException('Forced readback failure','SecurityError');return original.apply(this,args);};});
 if(mode==='stone-read-error')await context.addInitScript(()=>{const original=CanvasRenderingContext2D.prototype.getImageData;CanvasRenderingContext2D.prototype.getImageData=function(...args){if(this.canvas.width===1672&&this.canvas.height===940)throw new DOMException('Forced stone readback failure','SecurityError');return original.apply(this,args);};});
 if(mode==='stone-upload-error')await context.addInitScript(()=>{const original=WebGLRenderingContext.prototype.texImage2D;WebGLRenderingContext.prototype.texImage2D=function(...args){const source=args[args.length-1];if(source instanceof HTMLCanvasElement&&source.width===512&&source.height===512)throw new DOMException('Forced stone upload failure','InvalidStateError');return original.apply(this,args);};});
 if(mode==='source-upload-error'||mode==='atlas-upload-error')await context.addInitScript(mode=>{const original=WebGLRenderingContext.prototype.texImage2D;WebGLRenderingContext.prototype.texImage2D=function(...args){const source=args[args.length-1];if(mode==='source-upload-error'&&source instanceof HTMLImageElement&&source.src.includes('approved-lobby-source.png'))throw new DOMException('Forced image upload failure','SecurityError');if(mode==='atlas-upload-error'&&source instanceof HTMLCanvasElement&&source.width===1536&&source.height===256)throw new DOMException('Forced atlas upload failure','InvalidStateError');return original.apply(this,args);};},mode);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://sanctuary.test');await page.waitForFunction(()=>!!window.Lobby);
 await page.evaluate(()=>{persistLocalDecks(TRIBES.map((t,i)=>({id:'review-'+i,name:t.name,tribe:t.id,cards:buildDeck(t.id).map(c=>typeof c==='string'?c:c.id)})));Lobby.open();});
 await page.waitForTimeout(1500);
 const result={mode,errors,...await page.evaluate(()=>({stats:Lobby.sealRendererStats(),renderer:document.querySelector('#lobbySealCanvas').dataset.renderer,ready:document.querySelector('#lobbySealCanvas').parentElement.classList.contains('seal-webgl-ready'),canvasDisplay:getComputedStyle(document.querySelector('#lobbySealCanvas')).display}))};results.push(result);
 assert.deepEqual(errors,[],mode+' has no uncaught page errors');
 if(mode==='normal'){assert.equal(result.stats.textureReady,true);assert.equal(result.stats.glyphsReady,true);assert.equal(result.renderer,'webgl');assert.equal(result.ready,true);}
 else {assert.equal(result.renderer,'fallback');assert.equal(result.ready,false);assert.equal(result.canvasDisplay,'none');assert.equal(result.stats.textureReady,false);}
 await context.close();
}
await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log('PASS normal load and six image/texture failure paths');
})().catch(e=>{console.error(e);process.exit(1)});
