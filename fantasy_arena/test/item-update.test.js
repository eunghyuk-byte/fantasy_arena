const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, setup, place, vm } = require('../test-support/harness');

// Approved cost / attack / defense / health; only these four rarities change.
const expected = {
  fi5:[0,1,0,0], fi1:[1,2,0,0], di2:[1,0,0,2], ai3:[2,0,1,1],
  ei3:[3,1,1,1], di5:[3,2,0,0], ni5:[4,4,0,1], ni1:[2,0,1,2],
  ai2:[4,3,1,1], ai5:[3,3,0,2], ei4:[2,0,0,1], ei5:[3,1,1,1],
  ni2:[3,0,2,1], li5:[3,0,2,1], ai4:[4,0,2,2], di3:[4,0,1,4],
  di6:[7,0,2,4], li6:[8,0,2,5], di4:[2,0,0,1], fi3:[3,4,0,0],
  ai6:[3,0,1,0], ni6:[4,1,1,2], ei6:[7,0,2,5], li7:[2,0,1,3],
  ei7:[3,0,1,4], fi7:[4,5,1,0], ni7:[4,3,1,2], ai7:[6,4,2,1], di7:[6,3,1,4]
};
for (const [id, stats] of Object.entries(expected)) test(`${id}: approved item stats`, () => {
  const c = loadGame().cloneCard(id);
  assert.deepEqual([c.cost,c.atk,c.def,c.hp],stats);
});
test('four approved rarities and replacement abilities', () => {
  const g = loadGame();
  for (const [id,rarity] of Object.entries({ni5:'uncommon',ai2:'uncommon',ni1:'common',ai5:'common'})) assert.equal(g.cloneCard(id).rarity,rarity,id);
  assert.equal(g.cloneCard('li6').ability,'보호');
  assert.equal(g.cloneCard('fi7').atkSkill,undefined,'장팔사모 no longer grants AoE');
});
function body(g,p,id='e8') {
  return Object.assign(place(g,p,id),{atk:1,def:0,hp:20,maxHp:20,atkC:0,defC:0,hpC:0,ability:null,keywords:[],atkSkill:1});
}
function equip(g,p,id,unit=body(g,p)) {
  assert.equal(g.equipItemOnUnit(p,g.cloneCard(id),unit),true); return unit;
}
function fixed(g,value=0) { g.Math=Object.create(Math); g.Math.random=()=>value; }

for (const [id,type,cardId] of [['ni1','minion','e8'],['ni2','spell','fs3']]) {
  test(`${id}: one random eligible hand instance gains permanent cumulative cost, without aura`, () => {
    const g=loadGame(),{p1,p2}=setup(g),wearer=equip(g,p1,id);
    const c=g.cloneCard(cardId),other=g.cloneCard(cardId),wrong=g.cloneCard(type==='spell'?'e8':'fs3');
    p2.hand.push(wrong,c,other);const cost=c.cost;fixed(g);
    assert.equal(g.effectiveCardCost(p2,c),cost,'no equipment aura');
    g.applyItemEndTurnFx(p1);g.applyItemEndTurnFx(p1);
    assert.equal(g.effectiveCardCost(p2,c),cost+2);assert.equal(other.cost,cost);
    assert.equal(wrong.cost,g.cloneCard(wrong.id).cost);assert.equal(g.cloneCard(cardId).cost,cost,'base is not mutated');
    g.destroyMinion(p1,wearer,{fromSpell:true});
    assert.equal(g.effectiveCardCost(p2,c),cost+2,'wearer death cannot remove prior increases');
    g.applyItemEndTurnFx(p1);assert.equal(c.cost,cost+2);
    p2.soul=cost+1;assert.equal(g.playCard(p2,c,null),false);assert.ok(p2.hand.includes(c));
    p2.isAI=true;p2.deck=[];p2.hand=[c];assert.equal(g.chooseAiAction(p2).kind,'combat','AI respects increased cost');
  });
  test(`${id}: no eligible hand card means no effect or random draw`, () => {
    const g=loadGame(),{p1,p2}=setup(g);equip(g,p1,id);p2.hand=[g.cloneCard('fi1')];
    const before=JSON.stringify(p2.hand);g.Math=Object.create(Math);g.Math.random=()=>{throw Error('unexpected selection');};
    g.applyItemEndTurnFx(p1);assert.equal(JSON.stringify(p2.hand),before);
    p2.hand=[];g.applyItemEndTurnFx(p1);
  });
}
test('multiple tax wearers each trigger once; stolen equipment now taxes its former owner', () => {
  const g=loadGame(),{p1,p2}=setup(g),a=equip(g,p1,'ni1');equip(g,p1,'ni1');
  const c=g.cloneCard('e8');p2.hand=[c];const cost=c.cost;fixed(g);g.applyItemEndTurnFx(p1);assert.equal(c.cost,cost+2);
  g.applyFx(p2,{type:'steal_minion'},{kind:'minion',owner:p1,minion:a});
  const mine=g.cloneCard('e8');p1.hand=[mine];g.applyItemEndTurnFx(p2);assert.equal(mine.cost,cost+1);assert.equal(c.cost,cost+2);
});
test('불꽃도박반지: independent coins have 30% heads, honor turn luck and reuse saved rolls', () => {
  const g=loadGame(),{p1}=setup(g),m=equip(g,p1,'fi5');m.atkC=3;
  let rolls=[0.29,0.31,0.9],calls=0;g.Math=Object.create(Math);g.Math.random=()=>{calls++;return rolls.shift();};
  const first=g.turnCoinRoll(m);assert.deepEqual(Array.from(first.flips),[true,false,false]);assert.equal(calls,3);
  assert.equal(g.turnCoinRoll(m).heads,1);assert.equal(calls,3);
  p1.coinP=0.75;fixed(g,0.54);assert.equal(g.rollSharedCoins(m).heads,3);
  p1.coinP=0.1;fixed(g,0);assert.equal(g.rollSharedCoins(m).heads,0);
  g.unequipItem(m);p1.coinP=0.5;fixed(g,0.4);assert.equal(g.rollSharedCoins(m).heads,3);
});
test('흑마법서 copies an opponent hand card as fresh base state without removing it', () => {
  const g=loadGame(),{p1,p2}=setup(g),m=equip(g,p1,'di3'),source=g.cloneCard('fs3');
  source.cost+=4;source.extraState='not copied';p2.hand=[source];fixed(g,0.25);
  g.applyItemKillFx(p1,m,p2);assert.equal(p1.hand.length,1);const copy=p1.hand[0];
  assert.equal(copy.id,'fs3');assert.equal(copy.cost,g.cloneCard('fs3').cost);assert.equal(copy.extraState,undefined);
  assert.notEqual(copy.uid,source.uid);assert.equal(p2.hand[0],source);assert.equal(p2.hand.length,1);
  p1.hand=[];p2.hand=[];g.applyItemKillFx(p1,m,p2);assert.equal(p1.hand.length,0);
});
test('맹덕신서: kills generate earth spells; enemy spell casting no longer copies', async () => {
  const g=loadGame(),{p1,p2}=setup(g),m=equip(g,p1,'ei7');fixed(g,0.6);
  await g.runSpellCast(p2,g.cloneCard('ls1'),null);assert.equal(p1.hand.length,0);
  g.applyItemKillFx(p1,m,p2);assert.equal(p1.hand.length,1);assert.equal(p1.hand[0].tribe,'earth');assert.equal(p1.hand[0].type,'spell');
  g.applyItemKillFx(p1,m,p1);assert.equal(p1.hand.length,1,'friendly destruction is not a kill trigger');
});
test('장팔사모: each consecutive attack creates 화염구 fs3, never 화염화살', async () => {
  const g=loadGame(),{p1,p2}=setup(g),m=body(g,p1);m.atkSkill=4;equip(g,p1,'fi7',m);
  await g.doAttack(p1,m,{kind:'hero',owner:p2},false);
  assert.deepEqual(p1.hand.map(c=>c.id),['fs3','fs3']);assert.equal(m.atkSkill,4);
  g.__s.turn=2;g.__s.acting=p2;g.applyItemAttackFx(p1,m);assert.equal(p1.hand.length,2,'opponent turn does not trigger attack effect');
});
for(const id of ['li5','ai2']) test(`${id}: attack effect also fires on the second consecutive hit`, async () => {
  const g=loadGame(),{p1,p2}=setup(g),m=body(g,p1);m.atkSkill=4;equip(g,p1,id,m);const def=m.def;
  await g.doAttack(p1,m,{kind:'hero',owner:p2},false);
  if(id==='li5') assert.equal(m.def,def+2);
  else assert.equal(p1.board.filter(c=>c.id==='a10').length,2);
});
test('청룡언월도: death creates three independent water minions in hand, without board damage', () => {
  const g=loadGame(),{p1,p2}=setup(g),m=equip(g,p1,'ai7'),enemy=body(g,p2);fixed(g,0.4);
  g.destroyMinion(p1,m,{fromSpell:true});assert.equal(enemy.hp,20);assert.equal(p1.board.length,0);
  assert.equal(p1.hand.length,3);assert.ok(p1.hand.every(c=>c.tribe==='water'&&c.type==='minion'&&!c.token));
});
test('적토마: destruction during rebirth grants one 여포 to hand, without horse token or loop', () => {
  const g=loadGame(),{p1}=setup(g),m=place(g,p1,'e4');equip(g,p1,'di7',m);
  g.destroyMinion(p1,m,{fromSpell:true});assert.deepEqual(p1.hand.map(c=>c.id),['d7']);assert.ok(p1.board.includes(m));assert.equal(m.equippedItem,undefined);
  g.destroyMinion(p1,m,{fromSpell:true});assert.equal(p1.hand.length,1);assert.equal(p1.board.length,0);
});
test('consecutive attacker stolen by rebirth death equipment stops attacking and generating for former owner', async () => {
  const g=loadGame(),{p1,p2}=setup(g),a=place(g,p1,'f19'),d=place(g,p2,'f26');
  equip(g,p1,'fi7',a);equip(g,p2,'di6',d);d.hp=1;
  a.atkC=a.defC=a.hpC=d.atkC=d.defC=d.hpC=0;fixed(g,0.9);
  await g.doAttack(p1,a,{kind:'minion',owner:p2,minion:d},false);
  assert.deepEqual(p1.hand.map(c=>c.id),['fs3']);assert.ok(!p1.board.includes(a));
  assert.ok(p2.board.includes(a));assert.ok(p2.board.includes(d),'reborn ally is not attacked after theft');
  g.applyItemAttackFx(p1,a);assert.equal(p1.hand.length,1,'former owner cannot trigger stolen equipment');
});
test('second attack equipment buff retains saved negative defense coin offset after clipping', async () => {
  const g=loadGame(),{p1,p2}=setup(g),a=place(g,p1,'f27'),d=body(g,p2);
  equip(g,p1,'li5',a);a.def=0;a.atkC=a.hpC=0;a.defC=-2;fixed(g,0);
  const hp=a.hp;
  await g.doAttack(p1,a,{kind:'minion',owner:p2,minion:d},false);
  assert.equal(a.def,2);assert.equal(a.hp,hp-2,'both counters deal one through zero effective defense');
});
for(const id of ['di3','ei7','fi7','ai7','di7','li7']) test(`${id}: generated/copied cards respect ten-card hand cap`, () => {
  const g=loadGame(),{p1,p2}=setup(g),m=equip(g,p1,id);p1.hand=Array.from({length:9},()=>g.cloneCard('e8'));p2.hand=[g.cloneCard('fs3')];
  const trigger=()=>id==='di3'||id==='ei7'?g.applyItemKillFx(p1,m,p2):id==='fi7'?g.applyItemAttackFx(p1,m):id==='li7'?g.applyItemEndTurnFx(p1):g.resolveItemDeathFx(p1,m._itemFx,m.def);
  trigger();assert.equal(p1.hand.length,10);trigger();assert.equal(p1.hand.length,10);assert.equal(p2.hand.length,1);
});
test('블레스트아머 grants protection that absorbs only the first damaging hit', () => {
  const g=loadGame(),{p1}=setup(g),m=equip(g,p1,'li6');const hp=m.hp;
  g.damageMinion(p1,m,10,{});assert.equal(m.hp,hp);g.damageMinion(p1,m,10,{});assert.equal(m.hp,hp-10);
});
