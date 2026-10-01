const test=require('node:test'),assert=require('node:assert/strict');
const {loadGame,setup,place}=require('../test-support/harness');
function unit(g,p,o={}){return Object.assign(place(g,p,'e1'),{atk:0,def:0,hp:20,maxHp:20,atkC:0,defC:0,hpC:0,ability:null,keywords:[],atkSkill:1,coinGold:true},o);}
test('AoE uses one attacker/front coin dialog; backline consumes no RNG or fresh roll',async()=>{
 const g=loadGame(),{p1,p2}=setup(g),a=unit(g,p1,{atk:3,atkC:1,atkSkill:9}),f=unit(g,p2,{def:10,defC:1}),b=unit(g,p2,{defC:3,hpC:3});let coins=0,tosses=0;g.Math=Object.create(Math);g.Math.random=()=>{tosses++;return 0;};g.showCoinResult=(t,rows,done)=>{coins++;done();};
 await g.doAttack(p1,a,{kind:'minion',owner:p2,minion:f},true);
 assert.deepEqual({coins,tosses,front:f.hp,back:b.hp,fresh:!!b._turnRoll},{coins:1,tosses:2,front:20,back:16,fresh:false});
});
test('all target damage commits in one impact and visual jobs start concurrently',async()=>{
 const g=loadGame(),{p1,p2}=setup(g),a=unit(g,p1,{atk:3,atkSkill:9}),f=unit(g,p2),b=unit(g,p2);const jobs=[];let started;const ready=new Promise(r=>started=r);
 g.CombatFx={generation:()=>0,onCancel:()=>()=>{},snapshot:()=>null,play:(kind,opts)=>{if(kind==='death')return Promise.resolve({});return new Promise(resolve=>{jobs.push({opts,resolve});if(jobs.length===2)started();});}};
 const fight=g.doAttack(p1,a,{kind:'minion',owner:p2,minion:f},true);
 await Promise.race([ready,new Promise(r=>setTimeout(r,50))]);assert.equal(jobs.length,2,'both targets schedule before either finishes');assert.equal(f.hp,20);assert.equal(b.hp,20);
 jobs[0].opts.onImpact();assert.equal(f.hp,17);assert.equal(b.hp,17,'same impact applies both');jobs[1].opts.onImpact();assert.equal(b.hp,17,'no duplicate damage');for(const j of jobs)j.resolve({});await fight;
});
test('first target protection or zero damage never prevents AoE; each victim keeps own defense/protection',async()=>{
 const g=loadGame(),{p1,p2}=setup(g),a=unit(g,p1,{atk:3,atkSkill:9}),f=unit(g,p2,{ability:'보호'}),b=unit(g,p2,{def:1}),c=unit(g,p2,{def:7});
 await g.doAttack(p1,a,{kind:'minion',owner:p2,minion:f},true);assert.deepEqual([f.hp,b.hp,c.hp],[20,18,20]);assert.equal(g.hasOwnAbility(f,'보호'),false);assert.equal(a.hp,20);
});
test('AoE preserves cached secondary defense and HP coins without reroll',async()=>{
 const g=loadGame(),{p1,p2}=setup(g),a=unit(g,p1,{atk:3,atkSkill:9}),f=unit(g,p2),b=unit(g,p2,{hp:2,maxHp:2,defC:1,hpC:1});g.turnCoinRoll(b);const saved=b._turnRoll;
 await g.doAttack(p1,a,{kind:'minion',owner:p2,minion:f},true);assert.equal(b._turnRoll,saved);assert.equal(b.hp,1);assert.ok(p2.board.includes(b));
});
test('simultaneous AoE deaths use one grouped death event after the attack jobs',async()=>{
 const g=loadGame(),{p1,p2}=setup(g),a=unit(g,p1,{atk:3,atkSkill:9}),f=unit(g,p2,{hp:2,maxHp:2}),b=unit(g,p2,{hp:2,maxHp:2});const deaths=[];
 g.CombatFx={generation:()=>0,onCancel:()=>()=>{},snapshot:uid=>({uid}),play:async(kind,opts)=>{if(kind==='death')deaths.push(opts.snapshots.map(s=>s.uid));else opts.onImpact();return {};}};
 await g.doAttack(p1,a,{kind:'minion',owner:p2,minion:f},true);assert.equal(deaths.length,1);assert.deepEqual([...deaths[0]],[f.uid,b.uid]);assert.equal(p2.board.length,0);assert.equal(p2.hp,30);
});
test('no fresh backline black HP roll can kill a unit during AoE',async()=>{
 const g=loadGame(),{p1,p2}=setup(g),a=unit(g,p1,{atk:1,atkSkill:9}),f=unit(g,p2),b=unit(g,p2,{hp:3,maxHp:3,hpC:-3});
 await g.doAttack(p1,a,{kind:'minion',owner:p2,minion:f},true);assert.equal(b.hp,2);assert.ok(p2.board.includes(b));assert.equal(b._turnRoll,undefined);
});
test('restart before shared impact cannot damage either old or new participants',async()=>{
 const g=loadGame(),old=setup(g),a=unit(g,old.p1,{atk:3,atkSkill:9}),f=unit(g,old.p2),b=unit(g,old.p2);const jobs=[];let started;const ready=new Promise(r=>started=r);
 g.CombatFx={generation:()=>0,onCancel:()=>()=>{},snapshot:()=>null,play:(kind,opts)=>new Promise(resolve=>{jobs.push({opts,resolve});if(jobs.length===2)started();})};
 const fight=g.doAttack(old.p1,a,{kind:'minion',owner:old.p2,minion:f},true);await ready;const fresh=setup(g),u=unit(g,fresh.p1);g.__s.busy=true;
 assert.throws(()=>jobs[0].opts.onImpact(),/cancelled/);for(const j of jobs)j.resolve({cancelled:true});await fight;assert.deepEqual([f.hp,b.hp,u.hp],[20,20,20]);assert.equal(g.__s.busy,true);
});
