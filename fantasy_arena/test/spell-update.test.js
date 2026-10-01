const test=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,setup,place,vm}=require('../test-support/harness');
const serverRules=require('../../server/src/deckRules');
const spec={ds2:['굶주림',0,'common'],es8:['거대화',8,'common'],ls4:['성역축복',0,'common'],ds4:['불길한예감',0,'common'],ds7:['전염병',4,'uncommon'],fs7:['화염방패',6,'uncommon'],ls3:['정화',2,'rare'],ls9:['허허실실',2,'legendary'],fs9:['일기토',3,'legendary'],ns9:['동남풍',5,'legendary'],ds9:['미인계',8,'legendary']};
for(const [id,[name,cost,rarity]] of Object.entries(spec)) {
  test(`${id}: approved name, soul and rarity`,()=>{
    const g=loadGame(),c=g.cloneCard(id);
    assert.deepEqual([c.name,c.cost,c.rarity],[name,cost,rarity]);
    const cap=['rare','legendary'].includes(rarity)?1:2;
    assert.equal(g.maxCopies(id),cap);assert.equal(serverRules.maxCopies(c),cap);
    const info=g.cardInfoParts(c);assert.ok(info.metaHtml.includes(cost+'소울'));
  });
  test(`${id}: real cast consumes current soul cost and removes only the cast instance`,async()=>{
    const g=loadGame(),{p1,p2}=setup(g),c=g.cloneCard(id);
    for(const p of [p1,p2]) Object.assign(place(g,p,'e8'),{ability:null,keywords:[],hp:20,maxHp:20});
    p1.hand=[c,g.cloneCard('a3')];p1.soul=cost+1;
    const target=g.validTargets(p1,c.spell)[0]||null;
    assert.equal(g.playCard(p1,c,target),true);
    assert.equal(p1.soul,1);assert.ok(!p1.hand.includes(c));
    for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));
    assert.equal(g.__s.busy,false);
  });
  test(`${id}: AI uses the new soul threshold including zero`,()=>{
    const g=loadGame(),{p1,p2}=setup(g),c=g.cloneCard(id);
    Object.assign(place(g,p1,'e8'),{atk:0,def:0,hp:1,maxHp:1,ability:null,keywords:[],atkC:0,defC:0,hpC:0});
    Object.assign(place(g,p2,'e8'),{ability:null,atkSkill:2,atk:8,hp:20});
    p1.hand=[c];p1.soul=cost;p1.isAI=true;
    const option=g.aiPlayOptions(p1).find(o=>o.card===c);assert.ok(option,'legal AI choice');assert.equal(option.cost,cost);
    if(cost>0) assert.ok(!g.aiPlayOptions(p1,cost-1).some(o=>o.card===c));
    else assert.equal(g.chooseAiAction(p1).card,c);
  });
}
test('화염방패 applies +3 to attack, defense, health and maximum health',()=>{
  const g=loadGame(),{p1}=setup(g),m=place(g,p1,'e8'),c=g.cloneCard('fs7');
  const before=[m.atk,m.def,m.hp,m.maxHp];
  g.applyFx(p1,c.spell,{kind:'minion',owner:p1,minion:m});
  assert.deepEqual([m.atk,m.def,m.hp,m.maxHp],before.map(v=>v+3));assert.equal(c.text,'유닛 하나 공·방·체 +3');
});
test('zero-soul spells remain in builder filters and current-cost calculation',()=>{
  const g=loadGame(),{p1}=setup(g);
  for(const id of ['ds2','ls4','ds4']) {
    const c=g.cloneCard(id);g.__tribe=c.tribe;
    vm.runInContext('selectedHero=TRIBES.find(t=>t.id===__tribe);ui.typeFilter="spell";ui.rarityFilter="all";ui.costFilter="all"',g);
    assert.ok(g.tribeCards().some(x=>x.id===id));assert.equal(g.effectiveCardCost(p1,c),0);
    c.cost+=1;assert.equal(g.effectiveCardCost(p1,c),1);assert.equal(g.cloneCard(id).cost,0,'instance cost cannot pollute base');
  }
});
