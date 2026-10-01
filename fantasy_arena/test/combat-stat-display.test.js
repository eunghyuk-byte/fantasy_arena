const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {loadGame,setup,place,vm}=require('../test-support/harness');
const read=f=>fs.readFileSync(path.join(__dirname,'../js',f),'utf8');
const declaration=(src,name)=>{const start=src.indexOf('function '+name+'(');return src.slice(start,src.indexOf('\n}',start)+2);};
function unit(g,p,o={}){return Object.assign(place(g,p,'e1'),{atk:0,def:0,hp:20,maxHp:20,atkC:0,defC:0,hpC:0,ability:null,keywords:[],atkSkill:1,coinGold:true},o);}
function actualOverlay(g){vm.runInContext(declaration(read('game.js'),'showCoinResult'),g);const specs=[];g.CoinDuel={play:async spec=>{specs.push(spec);return true;}};return specs;}
test('second exchange overlay uses cached coin values and current HP without rerolling',async()=>{
 const g=loadGame(),{p1,p2}=setup(g),a=unit(g,p1,{atk:3,def:1,atkC:2,defC:2,hpC:2,attacksLeft:2}),d=unit(g,p2,{atk:4}),next=unit(g,p2,{atkC:1});
 const specs=actualOverlay(g);await g.doAttack(p1,a,{kind:'minion',owner:p2,minion:d},true);const roll=a._turnRoll;
 await g.doAttack(p1,a,{kind:'minion',owner:p2,minion:next},true);
 assert.equal(a._turnRoll,roll);assert.equal(next.hp,15);assert.equal(a.atk,3);assert.equal(a.def,1);assert.equal(a.hp,19);
 assert.deepEqual({...specs[1].bottom.faceOpts},{atk:5,def:3,hp:21});assert.equal(specs[1].bottom.flips.length,0);
});
test('retarget overlay keeps attacker combat values while fresh target rolls',async()=>{
 const g=loadGame(),{p1,p2}=setup(g),a=unit(g,p1,{atk:3,atkSkill:4,atkC:2,defC:2,hpC:2}),d=unit(g,p2,{hp:1,maxHp:1}),next=unit(g,p2,{hpC:1});
 const specs=actualOverlay(g);await g.doAttack(p1,a,{kind:'minion',owner:p2,minion:d},true);
 assert.deepEqual({...specs[1].bottom.faceOpts},{atk:5,def:2,hp:22});assert.deepEqual({...specs[1].top.faceOpts},{atk:0,def:0,hp:21});assert.equal(a.hp,20);assert.equal(next.hp,15);
});
test('coin face ignores stale board image and uses explicit snapshot',async()=>{
 const src=read('coin-duel.js'),start=src.indexOf('  function faceFor('),end=src.indexOf('  function waitReady(',start);
 const ctx={Promise,sleep:()=>new Promise(()=>{}),document:{querySelector:()=>({src:'stale',classList:{contains:()=>true}})},faceSrc:async(u,o)=>JSON.stringify(o)};
 vm.createContext(ctx);vm.runInContext(src.slice(start,end),ctx);const out=await ctx.faceFor({unit:{uid:'a',atk:3,def:1,hp:21},faceOpts:{atk:5,def:3,hp:21},hpPre:19});assert.deepEqual(JSON.parse(out),{atk:5,def:3,hp:21});
});
test('battlefield HP uses damaged current HP rather than initial FX HP',()=>{
 const ctx={unitHasActiveShield:()=>false,unitHasActiveImmune:()=>false,unitHasActiveRebirth:()=>false};vm.createContext(ctx);vm.runInContext(declaration(read('render.js'),'minionFaceOpts'),ctx);assert.equal(ctx.minionFaceOpts({atk:3,def:1,hp:7,_fxHp:12}).hp,7);
});
test('last damage remains visible after normal combat state cleanup',async()=>{
 const g=loadGame(),{p1,p2}=setup(g),a=unit(g,p1,{atk:3}),d=unit(g,p2);g.render=()=>{for(const u of [...p1.board,...p2.board])g.damageNumberHtml(u);};
 await g.doAttack(p1,a,{kind:'minion',owner:p2,minion:d},true);assert.equal(d._hurt,null);assert.match(g.damageNumberHtml(d),/>-3</);
});
function viewHarness(){const g=loadGame();setup(g);let now=1000,renders=0;const timers=[];g.Date={now:()=>now};g.setTimeout=(fn,ms)=>timers.push({fn,ms});g.render=()=>renders++;return {g,timers,time:n=>now=n,renders:()=>renders};}
test('floating number expires once without replay or timers',()=>{const h=viewHarness(),u={_hurt:{dmg:3}};assert.match(h.g.damageNumberHtml(u),/>-3</);h.time(2800);assert.equal(h.g.damageNumberHtml(u),'');assert.equal(h.timers.length,0);});
test('rerender preserves age and newer hit replaces prior number without timer',()=>{const h=viewHarness(),u={_hurt:{dmg:3}};h.g.damageNumberHtml(u);h.time(1300);assert.match(h.g.damageNumberHtml(u),/delay:-300ms/);u._hurt={dmg:2};assert.match(h.g.damageNumberHtml(u),/>-2</);assert.equal(h.timers.length,0);assert.equal(h.renders(),0);});
test('old match number cannot schedule work into new match',()=>{const h=viewHarness(),u={_hurt:{dmg:3}};h.g.damageNumberHtml(u);setup(h.g);assert.equal(h.timers.length,0);assert.equal(h.renders(),0);});
test('rebirth clears old damage number',()=>{const h=viewHarness(),{p2}=setup(h.g),u=unit(h.g,p2,{ability:'환생'});u._hurt={dmg:5};h.g.damageNumberHtml(u);h.g.destroyMinion(p2,u,{fromSpell:false});assert.equal(u.hp,1);assert.equal(h.g.damageNumberHtml(u),'');});
test('stored coin badge sits inside effect panel with one-step larger font',()=>{const css=fs.readFileSync(path.join(__dirname,'../css/game.css'),'utf8'),b=css.slice(css.indexOf('.minion .turn-coin {')).split('}')[0];assert.match(b,/right:\s*11%/);assert.match(b,/font:\s*900 12px\/1/);assert.match(b,/top:\s*65%/);});
test('floating digits scale to 92 percent of printed stats and hold before fade',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/game.css'),'utf8');for(const selector of ['.minion .hp-tick {','.stat-delta {'])assert.match(css.slice(css.indexOf(selector)).split('}')[0],/font-size:\s*calc\(var\(--slot-h, 320px\) \* 0\.0703\)/);
 const ratio=.0703/((Math.round(1152*.066)+12)/1152);assert.ok(ratio>.90&&ratio<.95);assert.match(css,/animation: hpPopGem 1\.8s/);assert.match(css,/12%, 78% \{ opacity: 1;/);
});
for(const [skill,atk,def] of [[7,3,1],[8,0,3],[2,4,1]])test(`counter skill ${skill} refreshes battlefield ATK DEF`,async()=>{const g=loadGame(),{p1,p2}=setup(g),a=unit(g,p1,{atk:4,def:2}),d=unit(g,p2,{atk:1,atkSkill:skill}),frames=[];g.render=()=>{if(a._fxAtk!=null)frames.push({atk:a._fxAtk,def:a._fxDef});};await g.doAttack(p1,a,{kind:'minion',owner:p2,minion:d},true);assert.deepEqual(frames.at(-1),{atk,def});});
test('second-hit attack item increment refreshes battlefield face',async()=>{const g=loadGame(),{p1,p2}=setup(g),a=unit(g,p1,{atk:4,atkSkill:4,_itemFx:'attack_atk_plus2'}),d=unit(g,p2),frames=[];g.render=()=>{if(a._fxAtk!=null)frames.push(a._fxAtk);};await g.doAttack(p1,a,{kind:'minion',owner:p2,minion:d},true);assert.equal(frames.at(-1),8);});
test('coin chips survive FX cleanup briefly without mutating unit or scheduling',()=>{const h=viewHarness(),u={_fxAtk:5,_fxDef:2,_fxHp:10,_fxAtkD:2,_fxDefD:1,_fxHpD:0},original=JSON.stringify(u);assert.match(h.g.combatStatDeltaHtml(u),/>\+2</);assert.equal(JSON.stringify(u),original);h.time(1200);u._fxAtk=u._fxDef=u._fxHp=null;u._fxAtkD=u._fxDefD=u._fxHpD=null;assert.match(h.g.combatStatDeltaHtml(u),/>\+2</);assert.equal(h.timers.length,0);h.time(2800);assert.equal(h.g.combatStatDeltaHtml(u),'');});
test('deferred legendary copies preserve original unit number age',()=>{
 const h=viewHarness(),g=h.g,{p2}=setup(g),u=place(g,p2,'e1');g.faceCacheKey=()=>'';g._faceDone=new Map();g.faceSrc=()=>Promise.resolve('');for(const n of ['unitHasActiveShield','unitHasActiveImmune','unitHasActiveRebirth'])g[n]=()=>false;
 for(const n of ['minionFaceOpts','renderMinion'])vm.runInContext(declaration(read('render.js'),n),g);
 g.damageMinion(p2,u,1,{});assert.match(g.renderMinion(u,'opp'),/hp-tick/);g.__damageViewUnit=u;vm.runInContext('_fxDeferredView[__damageViewUnit.uid]={ability:__damageViewUnit.ability}',g);
 h.time(1300);assert.match(g.renderMinion(u,'opp'),/animation-delay:-300ms/);h.time(3000);assert.doesNotMatch(g.renderMinion(u,'opp'),/hp-tick/);assert.equal(h.timers.filter(t=>t.ms===1800).length,0);
});
test('rebirth does not revive old coin chips or temporary face stats',()=>{const h=viewHarness(),{p2}=setup(h.g),u=unit(h.g,p2,{ability:'환생',_fxAtk:7,_fxDef:3,_fxHp:8,_fxAtkD:2,_fxDefD:1,_fxHpD:2});h.g.combatStatDeltaHtml(u);h.g.destroyMinion(p2,u,{fromSpell:false});assert.equal(h.g.combatStatDeltaHtml(u),'');assert.equal(u._fxAtk,null);assert.equal(u._fxDef,null);assert.equal(u._fxHp,null);});
test('simultaneous HP coin chip clears both name strip and turn-coin badge',()=>{const css=fs.readFileSync(path.join(__dirname,'../css/game.css'),'utf8');assert.match(css,/\.hp-tick ~ \.stat-delta\.d-hp \{ bottom: 44%;/);for(const h of [160,240,320,480])assert.ok(h*.56<h*(.59-.023)&&h*.56<h*.65);});
