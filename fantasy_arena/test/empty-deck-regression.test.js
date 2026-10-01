const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {loadGame,setup}=require('../test-support/harness');
const src=fs.readFileSync(path.join(__dirname,'../js/render.js'),'utf8');
test('empty deck has no back layers and restores them after replenishment',()=>{
  const a=src.indexOf('function renderDeckPile('),b=src.indexOf('\n}',a)+2,g={};vm.createContext(g);vm.runInContext(src.slice(a,b),g);
  const p={deck:[]};assert.doesNotMatch(g.renderDeckPile(p),/class="pile-layer"/);assert.match(g.renderDeckPile(p),/pile-count">0/);
  p.deck.push('e1');assert.match(g.renderDeckPile(p),/class="pile-layer"/);
});
test('fatigue is independent, incremental, and only occurs on an empty draw attempt',()=>{
  const g=loadGame(),{p1,p2}=setup(g);p1.deck=['e1'];p2.deck=[];g.draw(p1);assert.equal(p1.hp,30);assert.equal(p1.fatigue,0);
  g.draw(p1,3);g.draw(p2);assert.equal(p1.hp,24);assert.equal(p1.fatigue,3);assert.equal(p2.hp,29);assert.equal(p2.fatigue,1);
});
test('multi draw stops after lethal fatigue instead of damaging an ended game',()=>{
  const g=loadGame(),{p1}=setup(g);p1.deck=[];p1.hp=2;
  g.draw(p1,4);assert.equal(p1.hp,-1);assert.equal(p1.fatigue,2);assert.equal(vm.runInContext('state.over',g),true);
});
test('turn start and optional soul draw share the same fatigue counter',()=>{
  const g=loadGame(),{p1}=setup(g);p1.deck=[];g.beginTurn(p1,{noTurnFx:true});assert.equal(p1.hp,29);
  assert.equal(g.useSoulDraw(p1),true);assert.equal(p1.hp,27);assert.equal(p1.fatigue,2);
});
test('new player starts with zero fatigue after a prior player exhausted its deck',()=>{
  const g=loadGame(),{p1}=setup(g);p1.deck=[];g.draw(p1,3);const fresh=g.makePlayer({id:'earth'},false,'New');assert.equal(fresh.fatigue,0);
});
