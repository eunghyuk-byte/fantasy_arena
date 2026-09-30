// Synthetic contract tests: no final Zhang media is loaded here.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../js/spell-fx.js'),'utf8');
function extract(ctx,name){const start=src.indexOf('function '+name+'(');assert.ok(start>=0,name);const end=src.indexOf('\n  }',start)+4;vm.runInContext((src.slice(start-6,start)==='async '?'async ':'')+src.slice(start,end),ctx);}
test('video preload loads only enemy sprites and preserves layer indices',async()=>{
 const layers=[{file:'old-main',anchor:'summonedUnit'},{file:'mute',anchor:'eachEnemy',frames:2,w:10,h:20}];const loaded=[];
 const ctx={_legendaryPreloads:new Set(),_legacyMatchJobs:new Set(),_matchWaiters:new Set(),_packQueue:Promise.resolve(),setTimeout,clearTimeout,loadLegendaryMeta:async()=>({video:{file:'main'},layers}),isLegendarySummonMeta:()=>true,LegendaryVideoFx:{preload:async()=>true},loadFrames:async file=>{loaded.push(file);return {file}},assetUrl:(base,file)=>base+file,Promise};vm.createContext(ctx);extract(ctx,'preloadLegendarySummon');
 const pack=await ctx.preloadLegendarySummon('pack/');assert.deepEqual(loaded,['pack/mute']);assert.equal(pack.frames[0],null);assert.equal(pack.frames[1].file,'pack/mute');
});
test('video enemy sprites use actual arbitrary anchors, common video time and upright drawing',()=>{
 for(const count of [0,1,3,7]){
  const draws=[];const ctx={legendaryLayerMs:L=>L.durationMs,drawFrame:(...args)=>draws.push(args)};vm.createContext(ctx);extract(ctx,'legendaryVideoOverlay');
  const enemies=Array.from({length:count},(_,i)=>({uid:'u'+i,x:90+i*137,y:200+i*23}));
  const L={anchor:'eachEnemy',flipYWhenOppCasts:true,startMs:0,durationMs:900,frames:3,fps:10,'displayPx@1080p':[40,60],'offsetPx@1080p':[5,-20.5]};
  const render=ctx.legendaryVideoOverlay({layers:[L,{anchor:'summonedUnit'}]},[{w:10,h:20},{}],{enemies},1);
  const canvas={scale(){throw Error('enemy glyph flipped')},translate(){throw Error('unexpected transform')}};
  render(canvas,0);assert.equal(draws.length,count);draws.forEach((d,i)=>{assert.equal(d[2],0);assert.equal(d[3],enemies[i].x+5-20);assert.equal(d[4],enemies[i].y-20.5-30);});
  render(canvas,200);assert.equal(draws.length,count*2);draws.slice(count).forEach(d=>assert.equal(d[2],2));render(canvas,900);assert.equal(draws.length,count*2);
 }
});
test('video dispatch wires enemy overlay without invoking sprite playback or enemy state effects',async()=>{
 for(const casterIsMe of [true,false]){
  const draws=[],swaps=[];let invoked;
  const meta={layers:[{anchor:'eachEnemy',frames:1,durationMs:900,'displayPx@1080p':[40,60]}]};
  const ctx={_legendaryEpoch:0,_hidden:{},Set,preloadLegendarySummon:async()=>({meta,video:true,frames:[{w:10,h:20}]}),
   legendaryAnchors:()=>({summonedUnit:{x:700,y:casterIsMe?800:280},enemies:[{uid:'a',x:100,y:300}]}),fxScale:()=>1,
   legendaryLayerMs:L=>L.durationMs,drawFrame:(...a)=>draws.push(a),revealUnit(){},
   muteEnemy(){throw Error('unexpected enemy mutation')},
   LegendaryVideoFx:{play:async(base,m,opts)=>{invoked=opts;opts.onStart();opts.drawOverlay({},0);return true}}};
  vm.createContext(ctx);extract(ctx,'legendaryVideoOverlay');extract(ctx,'legendaryTokenPresentation');extract(ctx,'playLegendarySummon');
  assert.equal(await ctx.playLegendarySummon('fixture/',{casterIsMe,enemyUids:['a'],onEnemySwap:u=>swaps.push(u)}),true);
  assert.equal(invoked.casterIsMe,casterIsMe);assert.equal(invoked.anchor.y,casterIsMe?800:280);assert.equal(draws.length,1);assert.deepEqual(swaps,['a']);
 }
});
test('cancelled sprite preload cannot start a stale video overlay',async()=>{
 let resolve;let starts=0;const ctx={_legendaryEpoch:0,_hidden:{},Set,preloadLegendarySummon:()=>new Promise(r=>resolve=r),LegendaryVideoFx:{play:()=>starts++}};
 vm.createContext(ctx);extract(ctx,'legendaryTokenPresentation');extract(ctx,'playLegendarySummon');const p=ctx.playLegendarySummon('fixture/',{});ctx._legendaryEpoch++;resolve({meta:{},video:true,frames:[]});assert.equal(await p,false);assert.equal(starts,0);
});
test('stalled enemy sprite loading settles on clear or bounded deadline',async()=>{
 for(const mode of ['clear','deadline']){
  let deadline;const ctx={_legendaryEpoch:0,_legendaryPreloads:new Set(),_legacyMatchJobs:new Set(),_matchWaiters:new Set(),_packQueue:Promise.resolve(),setTimeout:f=>{deadline=f;return 1},clearTimeout(){},
   loadLegendaryMeta:async()=>({video:{file:'main'},layers:[{anchor:'eachEnemy',file:'mute'}]}),isLegendarySummonMeta:()=>true,
   LegendaryVideoFx:{preload:async()=>true,clear(){}},loadFrames:()=>new Promise(()=>{}),assetUrl:(b,f)=>b+f,Promise,
   document:{getElementById:()=>null},cleanupFx(){}};
  vm.createContext(ctx);extract(ctx,'preloadLegendarySummon');extract(ctx,'clear');const p=ctx.preloadLegendarySummon('fixture/');
  await new Promise(r=>setImmediate(r));assert.equal(ctx._legendaryPreloads.size,1);
  if(mode==='clear')ctx.clear();else deadline();assert.equal(await p,null);assert.equal(ctx._legendaryPreloads.size,0);
 }
});
test('both caster sides resolve only real enemy DOM positions, without preview slots',()=>{
 for(const casterIsMe of [true,false]){
  const queried=[];const ctx={window:{innerWidth:1920,innerHeight:1080},boardRect:()=>null,rectCenter:()=>null,casterBoardCenter:()=>({x:600,y:casterIsMe?800:280}),
   document:{querySelector:s=>{queried.push(s);return s.includes('missing')?null:{getBoundingClientRect:()=>({left:123,top:456,width:80,height:120})}}}};
  vm.createContext(ctx);extract(ctx,'legendaryAnchors');const a=ctx.legendaryAnchors({}, {casterIsMe,enemyUids:['real','missing']});
  assert.equal(a.enemies.length,1);assert.equal(a.enemies[0].x,163);assert.equal(a.enemies[0].y,516);assert.equal(a.enemies[0].uid,'real');assert.ok(queried.every(s=>s.startsWith(casterIsMe?'#oppBoard':'#myBoard')));
 }
});

test('video preserves explicit ring mute and deferred swap timing, cleaning owned mute on completion',async()=>{
 const calls=[];const meta={enemyMute:{swapAtMs:60},layers:[]};
 const ctx={_legendaryEpoch:0,_hidden:{},_muted:{},preloadLegendarySummon:async()=>({meta,video:true,frames:[]}),
 legendaryAnchors:()=>({summonedUnit:{x:0,y:0},enemies:[{uid:'a',x:160,y:0}]}),fxScale:()=>1,
 legendaryHitMs:()=>480,legendaryLayerMs:()=>0,drawFrame(){},revealUnit(){},syncMuteStyle(){calls.push('clean')},
 muteEnemy(u){ctx._muted[u]={owned:true};calls.push('mute')},
 LegendaryVideoFx:{play:async(b,m,o)=>{o.drawOverlay({},479);assert.deepEqual(calls,[]);o.drawOverlay({},480);assert.deepEqual(calls,['mute','hit']);o.drawOverlay({},539);assert.deepEqual(calls,['mute','hit']);o.drawOverlay({},540);assert.deepEqual(calls,['mute','hit','swap']);return true;}}};
 vm.createContext(ctx);extract(ctx,'legendaryVideoOverlay');extract(ctx,'legendaryTokenPresentation');extract(ctx,'playLegendarySummon');
 assert.equal(await ctx.playLegendarySummon('fixture/',{enemyUids:['a'],onEnemyHit:()=>calls.push('hit'),onEnemySwap:()=>calls.push('swap')}),true);
 assert.equal(ctx._muted.a,undefined);assert.deepEqual(calls,['mute','hit','swap','clean']);
});
test('missing required enemy sprite rejects partial video pack',async()=>{
 const ctx={_legendaryPreloads:new Set(),_legacyMatchJobs:new Set(),_matchWaiters:new Set(),_packQueue:Promise.resolve(),setTimeout,clearTimeout,loadLegendaryMeta:async()=>({video:{file:'main'},layers:[{anchor:'eachEnemy',file:'missing'}]}),
 isLegendarySummonMeta:()=>true,LegendaryVideoFx:{preload:async()=>true},loadFrames:async()=>null,assetUrl:(b,f)=>b+f,Promise};
 vm.createContext(ctx);extract(ctx,'preloadLegendarySummon');assert.equal(await ctx.preloadLegendarySummon('fixture/'),null);
});

test('approved reveal contract preserves zero/off and flips only Storm vertical slide',async()=>{
 for(const side of [true,false]) for(const id of ['n13','a14','d27','l26']) {
  const meta=JSON.parse(fs.readFileSync(path.join(__dirname,`../assets/vfx/legendary/${id}/meta.json`)));const reveals=[];
  const ctx={_legendaryEpoch:0,_hidden:{},preloadLegendarySummon:async()=>({meta,video:true,frames:[]}),legendaryAnchors:()=>({summonedUnit:{x:400,y:600},enemies:[]}),fxScale:()=>.5,
  revealUnit:(...a)=>reveals.push(a),legendaryLayerMs:()=>0,drawFrame(){},LegendaryVideoFx:{play:async(b,m,o)=>{o.onStart();return true}}};
  vm.createContext(ctx);extract(ctx,'legendaryVideoOverlay');extract(ctx,'legendaryTokenPresentation');extract(ctx,'playLegendarySummon');
  await ctx.playLegendarySummon('fixture/',{unitUid:'card',casterIsMe:side});
  if(id==='n13') { assert.equal(reveals.length,1);assert.equal(reveals[0][1],160);assert.equal(reveals[0][2],240);assert.equal(reveals[0][3].offsetYFrom,side?16.5:-16.5);assert.equal(Math.abs(reveals[0][3].offsetYTo),0); }
  else assert.equal(reveals.length,0,'fixed card has no inherited fade/pop/slide');
 }
});
