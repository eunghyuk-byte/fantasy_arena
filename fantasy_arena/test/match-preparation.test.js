const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../js/spell-fx.js'),'utf8');
function load(){const a=src.indexOf('  const DIM_DEFAULT_OPACITY'),b=src.indexOf('  /** Safari: VP9');return new Function(src.slice(a,b)+';return {resolveDim,applyMatchPresentation:typeof applyMatchPresentation === "function" ? applyMatchPresentation : null};')();}
test('explicit dim off/zero never falls back to MyTurn default',()=>{
 const {resolveDim}=load();
 for(const dim of [false,0,{doInCode:false,opacity:0},{doInCode:false,opacity:.7},{opacity:0}])assert.equal(resolveDim('turn_start_me',{dim}),null);
 for(const opts of [{dim:false},{dim:0},{dimOpacity:0}])assert.equal(resolveDim('turn_start_me',{},opts),null);
 assert.equal(resolveDim('turn_start_me',{}).opacity,.3);
});
const anchor={mode:'reference-contain',container:'matchStage',referenceSizePx:[1920,1080],fit:'contain',pivotPx:[960,540],positionAtRef1080p:[954,510],displaySizeAtRef1080p:[1920,1080],canvasTopLeftAtRef1080p:[-6,-30],scale:1};
test('MY TURN renders at 80 percent with its existing centre preserved',()=>{
 const meta=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/vfx/match/turn_start_me/meta.json'),'utf8'));
 const visual={style:{}};load().applyMatchPresentation(visual,meta,{},1920,1080);
 assert.equal(parseFloat(visual.style.width),1536);assert.equal(parseFloat(visual.style.height),864);
 assert.equal(parseFloat(visual.style.left)+768,954);assert.equal(parseFloat(visual.style.top)+432,510);
});
test('confirmed synthetic contract fits container once and resets reused legacy visuals',()=>{
 const {applyMatchPresentation}=load(),visual={style:{}};
 const meta={anchor};const opts={};
 assert.equal(applyMatchPresentation(visual,meta,opts,1920,1080),true);
 assert.equal(visual.style.left,'-6px');assert.equal(visual.style.top,'-30px');assert.equal(visual.style.width,'1920px');assert.equal(visual.style.height,'1080px');assert.equal(visual.style.transform,'none');
 applyMatchPresentation(visual,meta,opts,960,540);assert.equal(visual.style.left,'-3px');assert.equal(visual.style.top,'-15px');assert.equal(visual.style.width,'960px');
 applyMatchPresentation(visual,meta,opts,1000,1000);assert.ok(Math.abs(parseFloat(visual.style.left)+3.125)<1e-9);assert.ok(Math.abs(parseFloat(visual.style.top)-203.125)<1e-9);
 applyMatchPresentation(visual,{anchor:{...anchor,canvasTopLeftAtRef1080p:[999,999]}},opts,1920,1080);assert.equal(visual.style.left,'-6px');
 assert.equal(applyMatchPresentation(visual,{anchor:{...anchor,mode:undefined}},{},1920,1080),false);for(const value of Object.values(visual.style))assert.equal(value,'');
});
test('unknown or invalid layout metadata leaves legacy CSS in control',()=>{
 const {applyMatchPresentation}=load();for(const a of [null,{}, {...anchor,referenceSizePx:[0,1080]},{...anchor,container:'unknown'}]){
  const visual={style:{}};assert.equal(applyMatchPresentation(visual,{anchor:a},{},1920,1080),false);assert.equal(visual.style.transform,'');
 }
});
test('final dim enabled and runtime options preserve off and result non-hold contracts',()=>{
 const {resolveDim}=load();assert.equal(resolveDim('turn_start_me',{dim:{enabled:false,opacity:.4}}),null);
 assert.equal(resolveDim('turn_start_me',{runtimeOptions:{dim:false}}),null);
 for(const id of ['victory','defeat']){
  const meta={durationMs:id==='victory'?2300:2150,dim:{enabled:true,opacity:.4,hold:false},runtimeOptions:{label:'',holdDim:false}};
  const d=resolveDim(id,meta);assert.equal(d.opacity,.4);assert.equal(d.hold,false);assert.equal(d.durationMs,meta.durationMs);assert.equal(resolveDim(id,meta,{dim:false}),null);
 }
});
