// User-approved proposal: Library libfile_0072ca18af8c8191a95129e7966fdd9c.
// Contract fixtures are independent of the live card definitions.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {loadGame, setup, place, vm} = require('../test-support/harness');
const approved = require('../test-support/approved-24-units.json');
const oldDecks = require('../test-support/default-decks-before-units.json');
const {loadCards} = require('../../server/src/cards');
const {validateDeck} = require('../../server/src/deckRules');
const root = path.join(__dirname, '..');
const prefixes = {earth:'e', fire:'f', wind:'n', water:'a', light:'l', dark:'d'};
const skills = {2:'관통공격', 3:'돌진공격', 4:'연속공격', 5:'치명공격', 6:'흡혈공격', 8:'석화공격'};
const proposals = approved.map((c,i) => ({id:prefixes[c.tribe]+(30+i%4), ...c}));
const plain = x => JSON.parse(JSON.stringify(x));
const flush = async () => { for(let i=0;i<12;i++) await new Promise(r=>setImmediate(r)); };

test('approved release has exactly 33 units + 10 spells + 7 items per tribe, excluding tokens', () => {
  const g=loadGame(), cards=vm.runInContext('CARDS',g);
  assert.equal(cards.length,309);
  assert.equal(new Set(cards.map(c=>c.id)).size,cards.length);
  assert.equal(cards.filter(c=>c.token).length,9);
  for(const tribe of Object.keys(prefixes)) {
    const pool=cards.filter(c=>!c.token&&c.tribe===tribe);
    assert.deepEqual(['minion','spell','item'].map(type=>pool.filter(c=>c.type===type).length),[33,10,7],tribe);
    assert.deepEqual(Array.from(g.buildDeck(tribe)).sort(),oldDecks[tribe],tribe+' default deck unchanged');
    vm.runInContext(`selectedHero=TRIBES.find(t=>t.id==='${tribe}');ui.typeFilter='all';ui.rarityFilter='all';ui.searchQuery=''`,g);
    assert.equal(g.tribeCards().length,50);
    vm.runInContext("ui.typeFilter='minion'",g);
    assert.equal(g.tribeCards().length,33);
  }
});

test('24 approved arts retain their bytes and connect to exactly the approved cards', () => {
  const g=loadGame(), arts=vm.runInContext('CARD_ART',g), catalog=require('../assets/img/art/new-units/catalog.json');
  assert.equal(catalog.status,'implemented-card-definitions');
  assert.equal(catalog.units.length,24);
  for(const c of proposals) {
    const art=catalog.units.find(a=>a.name===c.name);
    assert.ok(art,c.name); assert.equal(art.cardId,c.id);
    assert.equal(art.element,c.tribe); assert.equal(art.soul,c.cost);
    assert.equal(arts[c.id],art.path.replace(/^fantasy_arena\//,''));
    const bytes=fs.readFileSync(path.join(root,'..',art.path));
    assert.equal(bytes.length,art.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),art.sha256);
    assert.equal(bytes.readUInt16BE(0),0xffd8,'JPEG');
  }
});

for(const expected of proposals) {
  test(expected.id+' '+expected.name+' matches approval and real summon/AI/coin consumers', async () => {
    const g=loadGame(), c=vm.runInContext(`CARD_MAP['${expected.id}']`,g);
    assert.ok(c,'approved card exists');
    const text=expected.ability==='출전'?'소환: 드로우 1':expected.ability||skills[expected.atkSkill]||'';
    assert.deepEqual(plain(c),{...expected,type:'minion',text});
    const info=g.cardInfoParts(c);
    assert.equal(info.name,c.name);
    assert.ok(info.metaHtml.includes(`${c.cost}소울`));
    assert.ok(info.metaHtml.includes(`${c.atk}/${c.def}/${c.hp}`));
    assert.ok(info.metaHtml.includes('최대 2장'));
    if(text) assert.ok(info.skillsHtml.includes(c.ability==='출전'?'소환':text));
    assert.equal(g.maxCopies(c.id),2);

    let {p1:p}=setup(g); p.soul=c.cost;
    const hand=g.cloneCard(c.id); p.hand=[hand];
    assert.equal(g.playCard(p,hand,null),true);
    assert.equal(p.soul,0); assert.equal(p.board[0],hand);
    assert.equal(hand.canAttack,true); assert.equal(hand.attacksLeft,1);
    assert.equal(p.hand.length,c.ability==='출전'?1:0);
    assert.equal(p.deck.length,c.ability==='출전'?4:5);

    ({p1:p}=setup(g)); p.isAI=true; p.soul=c.cost; p.deck=[];
    const aiCard=g.cloneCard(c.id); p.hand=[aiCard];
    assert.equal(g.chooseAiAction(p).card,aiCard);
    let combat=0; g.runAutoCombat=async()=>{combat++;return true;}; g.passTurn=()=>{};
    g.aiTurn(); await flush();
    assert.equal(p.board[0],aiCard); assert.equal(p.soul,0); assert.equal(combat,1);

    const n=Math.max(Math.abs(c.atkC),Math.abs(c.defC),Math.abs(c.hpC));
    g.Math=Object.create(Math);
    for(let mask=0;mask<(1<<n);mask++) {
      setup(g); const unit=g.cloneCard(c.id); let calls=0;
      g.Math.random=()=> (mask&(1<<calls++))?0:0.99;
      const roll=g.turnCoinRoll(unit), heads=mask.toString(2).replace(/0/g,'').length;
      assert.deepEqual([roll.n,roll.heads,roll.dAtk,roll.dDef,roll.dHp],[n,heads,Math.sign(c.atkC)*heads,Math.sign(c.defC)*heads,Math.sign(c.hpC)*heads]);
      assert.equal(calls,n,'only N coin draws, with shared results');
      const repeat=g.turnCoinRoll(unit);
      assert.equal(repeat.reused,true); assert.equal(calls,n,'same-turn roll is reused');
    }
  });
}

test('server accepts every new unit at two copies and rejects three copies or a foreign tribe', () => {
  const cards=loadCards(path.join(root,'js/cards-data.js'));
  for(const c of proposals) {
    const others=[...cards.cardMap.values()].filter(x=>!x.token&&x.tribe===c.tribe&&x.id!==c.id&&['common','uncommon'].includes(x.rarity));
    const list=[c.id,c.id,...others.slice(0,14).flatMap(x=>[x.id,x.id])];
    assert.equal(validateDeck({name:'신규유닛',tribe:c.tribe,cards:list},cards).ok,true,c.id);
    list[2]=c.id;
    assert.equal(validateDeck({name:'신규유닛',tribe:c.tribe,cards:list},cards).ok,false,c.id+' third copy');
    list[2]=proposals.find(x=>x.tribe!==c.tribe).id;
    assert.equal(validateDeck({name:'신규유닛',tribe:c.tribe,cards:list},cards).ok,false,c.id+' foreign tribe');
  }
});

function combatFixture(id) {
  const g=loadGame(),{p1,p2}=setup(g),a=place(g,p1,id);
  a.coinBlack=true; // Existing deterministic all-tails effect, no printed stats modified.
  const d=Object.assign(place(g,p2,'e1'),{atk:0,def:0,hp:20,maxHp:20,atkC:0,defC:0,hpC:0,ability:null,keywords:[],atkSkill:1});
  return {g,p1,p2,a,d,attack:()=>g.doAttack(p1,a,{kind:'minion',owner:p2,minion:d},true)};
}
test('new attack skills resolve through existing combat, including pierce/charge/two hits/lethal/petrify', async () => {
  for(const [id,damage] of [['n30',2],['n33',3],['a32',4],['f32',8]]) {
    const f=combatFixture(id);await f.attack();assert.equal(f.d.hp,20-damage,id);
  }
  let f=combatFixture('n33');f.d.def=2;await f.attack();assert.equal(f.d.def,0);assert.equal(f.d.hp,19);
  f=combatFixture('f33');await f.attack();assert.ok(!f.p2.board.includes(f.d),'lethal removes high-HP defender');
  f=combatFixture('f33');f.d.def=4;await f.attack();assert.ok(f.p2.board.includes(f.d),'no HP damage means no lethal');
  f=combatFixture('e33');f.d.atk=4;await f.attack();assert.equal(f.d.atk,0);assert.equal(f.d.def,1);assert.equal(f.d.hp,19);
});
test('new lifesteal caps at printed HP; protection consumes once; rebirth cannot loop', async () => {
  let f=combatFixture('d33');f.a.hp=1;await f.attack();assert.equal(f.a.hp,3);assert.equal(f.d.hp,18);
  for(const id of ['l31','l33']) {
    const g=loadGame(),{p1}=setup(g),m=place(g,p1,id),hp=m.hp;
    if(m.def>0) { g.spellDamageMinion(p1,m,m.def,{fromSpell:true});assert.equal(g.hasOwnAbility(m,'보호'),true,'DEF-only damage preserves protection'); }
    g.spellDamageMinion(p1,m,m.def+1,{fromSpell:true});assert.equal(m.hp,hp);assert.equal(g.hasOwnAbility(m,'보호'),false);
    g.spellDamageMinion(p1,m,m.def+1,{fromSpell:true});assert.equal(m.hp,hp-1);
  }
  for(const id of ['e31','d32']) {
    const g=loadGame(),{p1}=setup(g),m=place(g,p1,id),base=g.cloneCard(id),deck=p1.deck.length;
    m.atk=99;g.destroyMinion(p1,m,{fromSpell:true});
    assert.ok(p1.board.includes(m));assert.equal(m.atk,base.atk);assert.equal(m.hp,1);assert.equal(g.combatWillRebirth(m),false);
    g.destroyMinion(p1,m,{fromSpell:true});assert.ok(!p1.board.includes(m));assert.equal(p1.deck.length,deck);
  }
});
