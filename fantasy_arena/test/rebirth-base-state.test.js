const test=require('node:test'),assert=require('node:assert/strict');
const {loadGame,setup,place,vm}=require('../test-support/harness');
const flush=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));};
function fixture(){const g=loadGame(),{p1,p2}=setup(g);g.CombatFx={generation:()=>0,onCancel:()=>()=>{},snapshot:()=>null,play:async(k,o)=>{o.onImpact?.();return {};}};vm.runInContext('turnCoinRoll=()=>({n:0,heads:0,dAtk:0,dDef:0,dHp:0,flips:[]})',g);return {g,p1,p2};}
test('reported feather + flame shield then repeated Wyvern combat rebirth restores printed 2/2/1',async()=>{
 const {g,p1,p2}=fixture(),m=place(g,p2,'f17'),id=m.uid;p2.soul=20;
 for(const cardId of ['fi4','fs7']){const c=g.cloneCard(cardId);p2.hand.push(c);assert.equal(g.playCard(p2,c,{kind:'minion',owner:p2,minion:m}),true);await flush();}
 assert.deepEqual([m.atk,m.def,m.hp],[5,7,11]);
 for(let i=0;i<3;i++){p1.board=[];const a=place(g,p1,'n26');await g.doAttack(p1,a,{kind:'minion',owner:p2,minion:m});}
 assert.ok(p2.board.includes(m));assert.equal(m.uid,id);assert.deepEqual([m.atk,m.def,m.hp,m.maxHp],[2,2,1,5]);assert.ok(!m.equippedItem);assert.ok(!g.combatWillRebirth(m));assert.equal(m.atkC,-2);assert.equal(m.defC,-2);assert.equal(m._turnRoll,undefined);
 g.destroyMinion(p2,m,{fromSpell:true});assert.ok(!p2.board.includes(m));
});
test('rebirth discards added stats abilities coins debuffs and deathrattles while keeping printed card traits',()=>{
 const {g,p1}=fixture(),m=place(g,p1,'f26'),base=g.cloneCard('f26');Object.assign(m,{atk:99,def:-4,maxHp:40,atkC:8,defC:7,hpC:6,skipAttack:2,cannotAttack:true,coinLuckBonus:1,deathrattles:[{type:'draw',value:1}],text:'환생\nadded',keywords:['rebirth','immune','shield'],attacksLeft:0,canAttack:false});m.hp=0;m.dying=true;
 g.resolveDeath(p1,m);assert.deepEqual([m.atk,m.def,m.hp,m.maxHp,m.atkC,m.defC,m.hpC],[base.atk,base.def,1,base.hp,base.atkC,base.defC,base.hpC]);for(const k of ['skipAttack','cannotAttack','coinLuckBonus','deathrattles'])assert.equal(m[k],undefined,k);assert.ok(!m.keywords.includes('shield'));assert.ok(!m.keywords.includes('immune'));assert.ok(!g.combatWillRebirth(m));assert.equal(m.attacksLeft,0);assert.equal(m.canAttack,false);assert.equal(m.atkSkill,base.atkSkill);
});
test('black HP coin death restores printed stats and clears the stored roll before later combat',async()=>{const {g,p1,p2}=fixture(),m=place(g,p2,'f17'),a=place(g,p1,'n26');g.equipItemOnUnit(p2,g.cloneCard('fi4'),m);m.atk=9;m.def=8;m.hpC=-20;vm.runInContext('turnCoinRoll=u=>({n:1,heads:0,dAtk:0,dDef:0,dHp:u.hpC||0,flips:[false]})',g);await g.doAttack(p1,a,{kind:'minion',owner:p2,minion:m});assert.deepEqual([m.atk,m.def,m.hp,m.hpC],[2,2,1,0]);assert.equal(m._turnRoll,undefined);assert.ok(!g.combatWillRebirth(m));});
test('spell removal fires acquired deathrattle once but does not carry it into rebirth',()=>{const {g,p1,p2}=fixture(),m=place(g,p2,'f17');g.equipItemOnUnit(p2,g.cloneCard('fi4'),m);m.deathrattles=[{type:'draw',value:1}];const before=p2.deck.length;g.resolveSpell(p1,g.cloneCard('fs4'),{kind:'minion',owner:p2,minion:m});assert.deepEqual([m.atk,m.def,m.hp],[2,2,1]);assert.equal(p2.deck.length,before-1);assert.equal(m.deathrattles,undefined);g.destroyMinion(p2,m,{fromSpell:true});assert.equal(p2.deck.length,before-1);assert.ok(!p2.board.includes(m));});
test('rebirth keeps spent-attack ownership so later silence cannot grant a duplicate attack',()=>{const {g,p1}=fixture(),m=place(g,p1,'f26');m.canAttack=false;m.attacksLeft=0;m._atkTurn=1;m._sickTurn=1;g.destroyMinion(p1,m,{fromSpell:true});assert.equal(m._atkTurn,1);assert.equal(m._sickTurn,1);m.skipAttack=true;g.silenceMinion(m,p1);assert.equal(m.attacksLeft,0);assert.equal(m.canAttack,false);});
