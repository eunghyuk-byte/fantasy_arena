const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const {loadGame,setup,place}=require('../test-support/harness');
test('Zhao Yun results use current ATK and report actual removal versus rebirth',()=>{
 const g=loadGame(),{p1,p2}=setup(g);const low=place(g,p2,'f22');low.atk=4;const raised=place(g,p2,'e8');raised.atk=5;const reborn=place(g,p2,'l12');reborn.atk=6;
 const r=g.applyFx(p1,{type:'destroy_atk_ge',value:5},null);
 assert.deepEqual(Array.from(r.targets,t=>t.uid),[raised.uid,reborn.uid]);assert.equal(r.targets[0].destroyed,true);assert.equal(r.targets[1].destroyed,false);assert.equal(reborn.hp,1);assert.ok(p2.board.includes(low));
});
test('Lu Bu results omit zero N, retain attack/coins and use engine DEF/HP outcomes',()=>{
 const g=loadGame(),{p1,p2}=setup(g);const zero=place(g,p2,'e41');zero.atkC=zero.defC=zero.hpC=0;const hit=place(g,p2,'e8');Object.assign(hit,{atk:9,def:1,hp:6,atkC:-3,defC:0,hpC:1});const dead=place(g,p2,'e8');Object.assign(dead,{hp:1,atkC:2,defC:0,hpC:0});
 const r=g.applyFx(p1,{type:'reduce_by_coins'},null);assert.deepEqual(Array.from(r.targets,t=>t.uid),[hit.uid,dead.uid]);const h=r.targets[0];assert.equal(h.n,3);assert.equal(h.after.def,0);assert.equal(h.after.hp,3);assert.equal(h.after.atk,9);assert.deepEqual([h.after.atkC,h.after.defC,h.after.hpC],[-3,0,1]);assert.equal(h.destroyed,false);assert.equal(r.targets[1].destroyed,true);assert.ok(p2.board.includes(zero));
});
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'js/legendary-outcomes.js'),'utf8');
function renderer(){const ctx={Image:class{async decode(){}},document:{querySelector:()=>({getBoundingClientRect:()=>({width:198})})},warmMinionFace:async u=>'after-'+u.uid,LegendaryVideoFx:{ease:t=>Math.max(0,Math.min(1,t))},fetch:async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,url)))})};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx);return ctx.LegendaryOutcomeFx;}
for(const id of ['n2','d7'])test(`${id} engine-owned arbitrary targets share one impact descriptor and six real-face polygons per death`,async()=>{
 for(const count of [0,1,3,7]){
  const fx=renderer(),base='assets/vfx/legendary/'+id+'/',raw=JSON.parse(fs.readFileSync(path.join(root,base,'meta.json'))),meta=fx.normalize(raw);
  const snapshots=Array.from({length:count},(_,i)=>({uid:'u'+i,rect:{x:100+i*130,y:200,width:198,height:297},facePromise:Promise.resolve('before-'+i)}));
  const targets=snapshots.map((s,i)=>({uid:s.uid,destroyed:i%2===0,after:{uid:s.uid}}));
  const group=await fx.prepare(base,meta,{snapshots,outcome:{targets},unitUid:'caster',isEnemyPresent:()=>true});assert.equal(group.secondary?group.secondary.anchors.length:0,count);assert.equal(group.secondary?.video.file,count?'impact.webm':undefined);
  let clips=0;const images=[];const c={save(){},restore(){},translate(){},rotate(){},scale(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){clips++},drawImage(img){images.push(img.src)}};
  group.pieces(c,1100);assert.equal(clips,6*Math.ceil(count/2));assert.ok(images.every(x=>x.startsWith(id==='n2'?'before-':'after-')));clips=0;group.pieces(c,1800);assert.equal(clips,0);
 }
});
test('presentation module never invokes gameplay selection or RNG',()=>{for(const name of ['Math.random','coinPoolN(','destroyMinion(','damageMinion('])assert.equal(source.includes(name),false,name);});

test('Zhao Yun lower-attack unaffected face remains above ambience',async()=>{
 const fx=renderer(),base='assets/vfx/legendary/n2/',meta=JSON.parse(fs.readFileSync(path.join(root,base,'meta.json')));
 const group=await fx.prepare(base,meta,{unitUid:'c',snapshots:[{uid:'low',rect:{x:10,y:20,width:198,height:297},facePromise:Promise.resolve('actual-low-face')}],outcome:{targets:[]},isEnemyPresent:()=>true});
 const images=[];group.under({drawImage:i=>images.push(i.src)},500);assert.equal(images.length,0);group.over({drawImage:i=>images.push(i.src)},500);assert.deepEqual(images,['actual-low-face']);
});

test('card-face capture failure never prevents engine battlecry resolution',async()=>{
 const g=loadGame(),{p1,p2}=setup(g);const target=place(g,p2,'e8');target.atk=7;
 g.__capture={capture(){throw Error('DOM unavailable')}};g.__fx={hideUnits(){},revealUnit(){},whenOverlayIdle:async()=>{},overlayHold:()=>()=>{},playLegendarySummon:async()=>false};vm.runInContext('LegendaryOutcomeFx=__capture;SpellFx=__fx',g);
 const card=g.cloneCard('n2');p1.hand.push(card);g.playCard(p1,card,null);assert.ok(!p2.board.some(u=>u.uid===target.uid));await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));assert.equal(g.__s.busy,false);
});
