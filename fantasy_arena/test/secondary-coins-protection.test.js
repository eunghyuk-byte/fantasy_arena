const test=require('node:test'),assert=require('node:assert/strict');
const {loadGame,setup,place}=require('../test-support/harness');
function unit(g,p,o={}){return Object.assign(place(g,p,'e1'),{atk:0,def:0,hp:20,maxHp:20,atkC:0,defC:0,hpC:0,ability:null,keywords:[],atkSkill:1,coinGold:true},o);}
test('AoE first combat does not roll backline DEF coins',async()=>{
 const g=loadGame(),{p1,p2}=setup(g),a=unit(g,p1,{atk:3,atkSkill:9}),front=unit(g,p2),back=unit(g,p2,{defC:2});
 await g.doAttack(p1,a,{kind:'minion',owner:p2,minion:front},true);
 assert.deepEqual({hp:back.hp,rolled:!!back._turnRoll},{hp:17,rolled:false});
});
test('AoE cached positive HP coins protect a backline unit for this exchange',async()=>{
 const g=loadGame(),{p1,p2}=setup(g),a=unit(g,p1,{atk:3,atkSkill:9}),front=unit(g,p2),back=unit(g,p2,{hp:2,maxHp:2,hpC:2});g.turnCoinRoll(back);
 await g.doAttack(p1,a,{kind:'minion',owner:p2,minion:front},true);
 assert.deepEqual({hp:back.hp,present:p2.board.includes(back)},{hp:1,present:true});
});
test('consecutive retarget rolls the fresh target DEF and counter ATK coin',async()=>{
 const g=loadGame(),{p1,p2}=setup(g),a=unit(g,p1,{atk:3,atkSkill:4}),front=unit(g,p2,{hp:1,maxHp:1}),back=unit(g,p2,{atk:1,atkC:2,defC:2});
 await g.doAttack(p1,a,{kind:'minion',owner:p2,minion:front},true);
 assert.deepEqual({hp:back.hp,aHp:a.hp,rolled:!!back._turnRoll},{hp:19,aHp:17,rolled:true});
});
test('consecutive retarget applies cached positive HP for the new target',async()=>{
 const g=loadGame(),{p1,p2}=setup(g),a=unit(g,p1,{atk:3,atkSkill:4}),front=unit(g,p2,{hp:1,maxHp:1}),back=unit(g,p2,{hp:2,maxHp:2,hpC:2});g.turnCoinRoll(back);
 await g.doAttack(p1,a,{kind:'minion',owner:p2,minion:front},true);
 assert.deepEqual({hp:back.hp,present:p2.board.includes(back)},{hp:1,present:true});
});
test('retarget black HP coin death consumes the last hit without counter or further target',async()=>{
 const g=loadGame(),{p1,p2}=setup(g),a=unit(g,p1,{atk:3,atkSkill:4}),front=unit(g,p2,{hp:1,maxHp:1}),back=unit(g,p2,{hp:1,maxHp:1,hpC:-1,atk:10}),last=unit(g,p2);
 if(a.atkSkill===9)g.turnCoinRoll(back);
 await g.doAttack(p1,a,{kind:'minion',owner:p2,minion:front},true);
 assert.equal(back._turnRoll?.dHp,-1);assert.equal(back._deathCtx?.fromCoin,true);assert.equal(a.hp,20);assert.equal(last.hp,20);assert.equal(p2.hp,30);assert.equal(a.attacksLeft,0);
});
test('AoE cached black HP coin death does not stop the other victims or cause a counter',async()=>{
 const g=loadGame(),{p1,p2}=setup(g),a=unit(g,p1,{atk:3,atkSkill:9}),front=unit(g,p2),back=unit(g,p2,{hp:1,maxHp:1,hpC:-1,atk:10}),last=unit(g,p2);
 if(a.atkSkill===9)g.turnCoinRoll(back);
 await g.doAttack(p1,a,{kind:'minion',owner:p2,minion:front},true);
 assert.equal(back._deathCtx?.fromCoin,true);assert.equal(a.hp,20);assert.equal(last.hp,17);
});
test('same defender HP coins are applied once across two hits and restored once',async()=>{
 const g=loadGame(),{p1,p2}=setup(g),a=unit(g,p1,{atk:3,atkSkill:4}),d=unit(g,p2,{hp:10,maxHp:10,hpC:2});
 await g.doAttack(p1,a,{kind:'minion',owner:p2,minion:d},true);assert.equal(d.hp,4);
});
test('falling rock stat reduction bypasses and preserves protection',()=>{
 const g=loadGame(),{p1,p2}=setup(g),d=unit(g,p2,{hp:10,maxHp:10,def:2,ability:'보호'});
 g.applyFx(p1,{type:'enemy_def_hp_down',value:1},null);
 assert.deepEqual({hp:d.hp,def:d.def,shield:g.hasOwnAbility(d,'보호')},{hp:9,def:1,shield:true});
});
test('spell damage still consumes protection and prevents HP damage',()=>{
 const g=loadGame(),{p1,p2}=setup(g),d=unit(g,p2,{hp:10,maxHp:10,def:2,ability:'보호'});
 g.spellDamageMinion(p2,d,5,{fromSpell:true});assert.equal(d.hp,10);assert.equal(g.hasOwnAbility(d,'보호'),false);
});
test('backline HP coin is restored and reused on a later exchange in the same turn',async()=>{
 const g=loadGame(),{p1,p2}=setup(g),front=unit(g,p2),back=unit(g,p2,{hp:10,maxHp:10,hpC:2});g.turnCoinRoll(back);
 for(let i=0;i<2;i++){const a=unit(g,p1,{atk:3,atkSkill:9});await g.doAttack(p1,a,{kind:'minion',owner:p2,minion:front},true);}
 assert.equal(back.hp,4);assert.equal(back._turnRoll.dHp,2);
});
test('reborn defender rolls fresh coins before the second hit',async()=>{
 const g=loadGame(),{p1,p2}=setup(g),a=unit(g,p1,{atk:2,atkSkill:4}),d=unit(g,p2,{hp:1,maxHp:1,hpC:1,ability:'환생'});
 let tosses=0;g.Math=Object.create(Math);g.Math.random=()=>{tosses++;return 0;};
 await g.doAttack(p1,a,{kind:'minion',owner:p2,minion:d},true);
 assert.equal(tosses,2);assert.ok(!p2.board.includes(d));
});
test('restart while a secondary coin overlay is pending cannot affect the new match',async()=>{
 const g=loadGame(),old=setup(g),a=unit(g,old.p1,{atk:3,atkSkill:4}),front=unit(g,old.p2,{hp:1,maxHp:1}),back=unit(g,old.p2,{hpC:2});
 let pending,signal;const reached=new Promise(r=>signal=r);
 g.showCoinResult=(title,rows,done)=>{if(rows.some(r=>r.unit===back)){pending=done;signal();}else done();};
 const fight=g.doAttack(old.p1,a,{kind:'minion',owner:old.p2,minion:front},true);
 await reached;const fresh=setup(g),d=unit(g,fresh.p1);g.__s.busy=true;pending();await fight;
 assert.equal(d.hp,20);assert.equal(g.__s.busy,true);assert.equal(fresh.p2.hp,30);
});
test('lethal falling rock reduction preserves fromSpell death context without consuming protection',()=>{
 const g=loadGame(),{p1,p2}=setup(g),d=unit(g,p2,{hp:1,maxHp:1,ability:'보호'});
 g.applyFx(p1,{type:'enemy_def_hp_down',value:1},null);
 assert.ok(!p2.board.includes(d));assert.equal(d._deathCtx.fromSpell,true);assert.equal(g.hasOwnAbility(d,'보호'),true);
});
test('sandhell direct ATK DEF HP reduction also bypasses and preserves protection',()=>{
 const g=loadGame(),{p1,p2}=setup(g),d=unit(g,p2,{hp:10,maxHp:10,atk:4,def:2,ability:'보호'});
 g.applyFx(p1,{type:'sandhell',value:2},null);
 assert.deepEqual({hp:d.hp,atk:d.atk,def:d.def,shield:g.hasOwnAbility(d,'보호')},{hp:8,atk:2,def:0,shield:true});
});
