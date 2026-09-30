const test=require('node:test'),assert=require('node:assert/strict'),cp=require('node:child_process'),path=require('node:path');
const {loadGame,setup,place,vm}=require('../test-support/harness');
const root=path.resolve(__dirname,'../..'),base='322b6392498c2eee42d9b92f559cb6db9edf3994';
const baseline=cp.execFileSync('git',['-c',`safe.directory=${root}`,'-C',root,'show',`${base}:fantasy_arena/js/combat.js`],{encoding:'utf8'});
function simplify(p){return JSON.parse(JSON.stringify(p,(k,v)=>k==='_deathCtx'?undefined:v));}
async function run(old,skill,enemySkill,coins,shield,opponent){
 const g=loadGame();if(old)vm.runInContext(baseline,g);
 let seed=42;g.Math=Object.create(Math);g.Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const {p1,p2}=setup(g),mine=opponent?p2:p1,foe=opponent?p1:p2;
 if(opponent){g.__s.turn=2;g.__s.acting=p2;}
 const a=place(g,mine,'e1'),d=place(g,foe,'e8');
 Object.assign(a,{hp:6,maxHp:9,atk:4,def:1,atkSkill:skill,atkC:coins?-1:0,defC:0,hpC:coins?-1:0,ability:null,keywords:[]});
 Object.assign(d,{hp:5,maxHp:8,atk:3,def:2,atkSkill:enemySkill,atkC:coins?-1:0,defC:0,hpC:coins?-1:0,ability:shield?'보호':'환생',keywords:shield?['shield']:['rebirth']});
 if(!old)g.CombatFx={generation:()=>0,onCancel:()=>()=>{},snapshot:()=>null,play:async(k,o)=>{o.onImpact?.();return {}}};
 await g.doAttack(mine,a,{kind:'minion',owner:foe,minion:d});return JSON.parse(JSON.stringify({p1:simplify(p1),p2:simplify(p2),rng:seed}));
}
test('360 deterministic exchanges preserve both sides state and RNG against published v0.390',async()=>{
 let count=0;
 for(const opponent of [false,true])for(let skill=1;skill<=9;skill++)for(const enemy of [1,4,5,6,9])for(const coins of [false,true])for(const shield of [false,true]){
   assert.deepEqual(await run(false,skill,enemy,coins,shield,opponent),await run(true,skill,enemy,coins,shield,opponent),JSON.stringify({skill,enemy,coins,shield,opponent}));count++;
 }
 assert.equal(count,360);
});
