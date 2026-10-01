const test=require('node:test'),assert=require('node:assert/strict');
const {loadGame,setup,place,vm}=require('../test-support/harness');
function unit(g,p,o={}) {return Object.assign(place(g,p,'e1'),{atk:0,def:0,hp:20,maxHp:20,atkC:0,defC:0,hpC:0,ability:null,keywords:[],atkSkill:1,coinGold:true},o);}
test('consecutive hits preserve rolled defense and counterattack on both hits',async()=>{
 const g=loadGame(),{p1,p2}=setup(g);const a=unit(g,p1,{atk:3,atkSkill:4}),d=unit(g,p2,{atk:1,atkC:2,defC:2});
 await g.doAttack(p1,a,{kind:'minion',owner:p2,minion:d},true);
 assert.deepEqual({defenderHp:d.hp,attackerHp:a.hp},{defenderHp:18,attackerHp:14});
});
test('AoE respects already rolled defender defense on each victim',async()=>{
 const g=loadGame(),{p1,p2}=setup(g);const a=unit(g,p1,{atk:3,atkSkill:9}),d=unit(g,p2,{defC:2}),d2=unit(g,p2,{defC:2});
 g.turnCoinRoll(d);g.turnCoinRoll(d2);
 await g.doAttack(p1,a,{kind:'minion',owner:p2,minion:d},true);
 assert.deepEqual([d.hp,d2.hp],[19,19]);
});
test('automatic combat rolls positive attack coins when base attack is zero',async()=>{
 const g=loadGame(),{p1,p2}=setup(g);unit(g,p1,{atk:0,atkC:2});
 await g.runAutoCombat(p1);assert.equal(p2.hp,28);
});
test('an old spell cannot damage a restarted match or clear its busy flag',async()=>{
 const g=loadGame(),old=setup(g);let finish;
 g.SpellFx={play:()=>new Promise(r=>finish=r)};
 const cast=g.runSpellCast(old.p1,{id:'test',spell:{type:'aoe_enemy',value:3}},null);
 const newer=setup(g),d=unit(g,newer.p1);g.__s.busy=true;
 finish();await cast;
 assert.deepEqual({hp:d.hp,busy:g.__s.busy},{hp:20,busy:true});
});
test('same turn uses saved roll even if coin links change before the second fight',async()=>{
 const g=loadGame(),{p1,p2}=setup(g),d=unit(g,p2,{defC:2});g.turnCoinRoll(d);d.defC=0;
 for(let i=0;i<2;i++){const a=unit(g,p1,{atk:3,atkSkill:4});await g.doAttack(p1,a,{kind:'minion',owner:p2,minion:d},true);}
 assert.equal(d.hp,16);assert.equal(d._turnRoll.dDef,2);
});
test('negative defense coins remain active for both consecutive hits',async()=>{
 const g=loadGame(),{p1,p2}=setup(g),a=unit(g,p1,{atk:3,atkSkill:4}),d=unit(g,p2,{def:2,defC:-2});
 await g.doAttack(p1,a,{kind:'minion',owner:p2,minion:d},true);assert.equal(d.hp,14);
});
test('a stale summon callback cannot resolve into either match after restart',async()=>{
 const g=loadGame(),old=setup(g);let finish,plan;g.SpellFx={play:(card,opts)=>{plan=opts;return new Promise(r=>finish=r)}};
 const cast=g.runSpellCast(old.p1,{id:'test',spell:{type:'aoe_enemy',value:3}},null);
 const newer=setup(g),d=unit(g,newer.p1);const spawned=plan.resolveNow();assert.equal(spawned.length,0);finish();await cast;assert.equal(d.hp,20);
});
test('a spell resolves once when presentation calls resolveNow repeatedly',async()=>{
 const g=loadGame(),{p1,p2}=setup(g),d=unit(g,p2);g.SpellFx={play:async(card,opts)=>{opts.resolveNow();opts.resolveNow()}};
 await g.runSpellCast(p1,{id:'test',spell:{type:'aoe_enemy',value:3}},null);assert.equal(d.hp,17);assert.equal(g.__s.busy,false);
});
test('zero attack with a cached zero coin roll stays skipped and never rerolls',async()=>{
 const g=loadGame(),{p1,p2}=setup(g),a=unit(g,p1,{atkC:2,coinGold:false,coinBlack:true});g.turnCoinRoll(a);a.coinBlack=false;a.coinGold=true;
 await g.runAutoCombat(p1);assert.equal(p2.hp,30);assert.equal(a.attacksLeft,1);assert.equal(a._turnRoll.dAtk,0);
});
