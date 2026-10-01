const test=require('node:test'),assert=require('node:assert/strict');
const {loadGame,setup,place,vm}=require('../test-support/harness');
const decide=(g,p)=>{assert.equal(typeof g.chooseAiAction,'function');return g.chooseAiAction(p);};
function init(){const g=loadGame(),{p1:p,p2:e}=setup(g);p.isAI=true;p.soul=5;p.deck=['e8'];return {g,p,e};}
const spell=(g,p,id)=>{const c=g.cloneCard(id);p.hand.push(c);return c;};
const body=(g,p,o={})=>Object.assign(place(g,p,'e1'),{atk:1,def:0,hp:3,maxHp:3,atkC:0,defC:0,hpC:0,ability:null,keywords:[]},o);
const handUnit=(g,p,o={})=>{const c=Object.assign(g.cloneCard('e1'),{atk:1,def:0,hp:1,cost:2},o);p.hand.push(c);return c;};
test('plan with3souls left draws before playing an affordable card and then re-evaluates new hand',()=>{
 const {g,p}=init(),weak=handUnit(g,p);p.deck=['f5'];assert.equal(decide(g,p).kind,'draw');g.useSoulDraw(p);const newCard=p.hand.find(c=>c!==weak);assert.equal(newCard.id,'f5');assert.equal(decide(g,p).card,newCard);
});
test('a plan spending the available souls does not take3souls away for draw',()=>{const {g,p}=init();const c=handUnit(g,p,{cost:5});assert.equal(decide(g,p).card,c);});
test('coin is saved on turn1 when no useful follow-up exists',()=>{const {g,p}=init();p.soul=1;p.deck=[];spell(g,p,'coin');assert.equal(decide(g,p).kind,'combat');});
test('coin is saved when the useful card is already affordable',()=>{const {g,p}=init();p.soul=2;p.deck=[];spell(g,p,'coin');const c=handUnit(g,p);assert.equal(decide(g,p).card,c);});
test('coin is played when it unlocks a currently unaffordable useful card',()=>{const {g,p}=init();p.soul=1;p.deck=[];const coin=spell(g,p,'coin');handUnit(g,p);assert.equal(decide(g,p).card,coin);});
test('certain lethal automatic attack is taken before spending cards or drawing',()=>{const {g,p,e}=init();body(g,p,{atk:5});e.hp=4;handUnit(g,p);assert.equal(decide(g,p).kind,'combat');});
test('enemy hand and deck contents are never inspected, and decision consumes no RNG',()=>{const {g,p,e}=init();handUnit(g,p);Object.defineProperty(e,'hand',{get(){throw Error('hidden hand');}});Object.defineProperty(e,'deck',{get(){throw Error('hidden deck');}});g.Math=Object.create(Math);g.Math.random=()=>{throw Error('planning RNG');};assert.equal(decide(g,p).kind,'draw');});
test('immune enemies are never selected for a targeted removal',()=>{const {g,p,e}=init();p.soul=3;p.deck=[];body(g,e,{ability:'면역',atk:10});const target=body(g,e,{atk:2});const c=spell(g,p,'as3');const a=decide(g,p);assert.equal(a.card,c);assert.equal(a.target.minion,target);});
test('removal is re-evaluated after the first target has been removed',()=>{const {g,p,e}=init();p.soul=6;p.deck=[];const d=body(g,e);spell(g,p,'as3');spell(g,p,'as3');const a=decide(g,p);g.resolveSpell(p,a.card,a.target);p.hand=p.hand.filter(c=>c!==a.card);p.soul-=3;assert.ok(!e.board.includes(d));assert.equal(decide(g,p).kind,'combat');});
test('empty AoE is not spent and friendly-only AoE damage is avoided',()=>{const {g,p}=init();p.soul=8;p.deck=[];spell(g,p,'fs8');body(g,p);assert.equal(decide(g,p).kind,'combat');});
test('AoE with multiple valuable enemies is preferred to weak development',()=>{const {g,p,e}=init();p.soul=6;p.deck=[];body(g,e,{hp:3,maxHp:3,atk:6});body(g,e,{hp:3,maxHp:3,atk:6});const aoe=spell(g,p,'fs2');handUnit(g,p);assert.equal(decide(g,p).card,aoe);});
test('full-health heal is held and an injured board is healed',()=>{const {g,p}=init();p.soul=2;p.deck=[];const d=body(g,p,{hp:6,maxHp:6});const heal=spell(g,p,'ls1');assert.equal(decide(g,p).kind,'combat');d.hp=1;assert.equal(decide(g,p).card,heal);});
test('buffs go to own useful units rather than enemies',()=>{const {g,p,e}=init();p.soul=7;p.deck=[];body(g,e,{atk:20});const d=body(g,p,{atk:2});const buff=spell(g,p,'es8');assert.equal(decide(g,p).target.minion,d);assert.equal(decide(g,p).card,buff);});
test('full board and hand capacity prevent wasted summons/draws',()=>{const {g,p}=init();p.soul=10;for(let i=0;i<5;i++)body(g,p);for(let i=0;i<10;i++)handUnit(g,p);assert.equal(decide(g,p).kind,'combat');});
test('urgent visible threat prioritizes a useful removal over weak development',()=>{const {g,p,e}=init();p.soul=4;p.deck=[];p.hp=3;body(g,e,{atk:10,hp:10,maxHp:10});const kill=spell(g,p,'fs4');handUnit(g,p);assert.equal(decide(g,p).card,kill);});
test('busy AI chooses to wait, never attacks before spell resolution',()=>{const {g,p}=init();g.__s.busy=true;assert.equal(decide(g,p).kind,'wait');});
test('planning stays bounded at legal maximum hand and board sizes',()=>{const {g,p,e}=init();p.soul=30;for(let i=0;i<5;i++){body(g,p);body(g,e);}for(let i=0;i<10;i++)spell(g,p,i%2?'es8':'as3');const start=performance.now();for(let i=0;i<100;i++)decide(g,p);assert.ok(performance.now()-start<1000,'100 small decisions under1s');});
const flush=async(n=12)=>{for(let i=0;i<n;i++)await new Promise(r=>setImmediate(r));};
test('real AI loop draws first and deploys the stronger newly drawn card',async()=>{
 const {g,p}=init();const weak=handUnit(g,p);p.deck=['f5'];let combat=0;g.runAutoCombat=async()=>{combat++;return true;};g.passTurn=()=>{};
 g.aiTurn();await flush();assert.equal(p._soulDrawUsed,true);assert.ok(p.board.some(m=>m.id==='f5'));assert.ok(p.hand.includes(weak));assert.equal(combat,1);
});
test('real AI loop waits for a spell then recalculates instead of wasting the duplicate removal',async()=>{
 const {g,p,e}=init();p.soul=6;p.deck=[];body(g,e,{atk:10});spell(g,p,'fs4');spell(g,p,'fs4');let finish,combat=0;g.SpellFx={play:()=>new Promise(r=>finish=r)};g.runAutoCombat=async()=>{combat++;return true;};g.passTurn=()=>{};
 g.aiTurn();await flush(5);assert.equal(combat,0);assert.equal(g.__s.busy,true);assert.equal(p.hand.length,1);finish();await flush();assert.equal(e.board.length,0);assert.equal(p.hand.length,1);assert.equal(combat,1);
});
test('AI cancellation while waiting on a spell cannot start combat in a replacement match',async()=>{
 const {g,p,e}=init();p.soul=4;p.deck=[];body(g,e);spell(g,p,'fs4');let finish,combat=0;g.SpellFx={play:()=>new Promise(r=>finish=r)};g.runAutoCombat=async()=>{combat++;return true;};g.passTurn=()=>{};
 g.aiTurn();await flush(4);setup(g);finish();await flush();assert.equal(combat,0);
});
test('planning is read-only and does not inspect either deck order',()=>{
 const {g,p,e}=init();handUnit(g,p);body(g,e);const before=JSON.stringify({p,e});decide(g,p);assert.equal(JSON.stringify({p,e}),before);
 p.deck=new Proxy(['f5'],{get(a,k){if(k==='length')return a.length;throw Error('deck order inspection');}});assert.equal(decide(g,p).kind,'draw');
});
test('zero-base-attack charge without attack coins cannot trigger a false lethal shortcut',()=>{const {g,p,e}=init();p.deck=[];p.soul=2;body(g,p,{atk:0,def:5,hp:5,maxHp:5,atkSkill:3,atkC:0,canAttack:true,attacksLeft:1});e.hp=4;const c=handUnit(g,p);assert.equal(g.aiReadyDamage(p),0);assert.equal(decide(g,p).card,c);});
test('summon scoring uses actual count and reserves the played minion body slot',()=>{const {g,p}=init();assert.equal(g.aiFxValue(p,{type:'summon_token'},null,{type:'spell'}),3);assert.equal(g.aiFxValue(p,{type:'summon_n'},null,{type:'spell'}),3);for(let i=0;i<4;i++)body(g,p);assert.equal(g.aiFxValue(p,{type:'summon_token'},null,{type:'minion'}),0);});
