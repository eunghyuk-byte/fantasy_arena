const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadGame, setup, place } = require('../test-support/harness');
const tick = () => new Promise(resolve => setImmediate(resolve));
const ROOT = path.join(__dirname, '..');

for (const id of ['n13','a14','d27','l26']) for (const side of ['player', 'AI']) {
  test(`${id} ${side} summon preserves enemies and never defers their views`, async () => {
    const g = loadGame();
    const { p1, p2 } = setup(g);
    const caster = side === 'player' ? p1 : p2;
    const enemy = side === 'player' ? p2 : p1;
    const foe = place(g, enemy, 'e8');
    const before = JSON.stringify(foe);
    const calls = [], hidden = [], revealed = [];
    let holds = 0;
    g.__fx = {
      hideUnits: ids => hidden.push(...ids), revealUnit: id => revealed.push(id),
      whenOverlayIdle: () => Promise.resolve(),
      overlayHold: () => { holds++; return () => holds--; },
      playLegendarySummon: (base, opts) => new Promise(resolve => calls.push({base, opts, resolve})),
    };
    vm.runInContext('SpellFx = __fx', g);
    if (side === 'AI') vm.runInContext('state.turn=2; state.acting=state.p2', g);
    const card = g.cloneCard(id);
    caster.hand.push(card);
    assert.equal(g.legendarySummonFxBase(card), 'assets/vfx/legendary/'+id+'/');
    g.playCard(caster, card, null);
    assert.equal(JSON.stringify(foe), before);
    assert.deepEqual(Object.keys(vm.runInContext('_fxDeferredView', g)), []);
    assert.deepEqual(hidden, id === "n13" ? [card.uid] : []);
    await tick(); await tick();
    assert.equal(calls.length, 1);
    assert.deepEqual(Array.from(calls[0].opts.enemyUids), []);
    assert.equal(calls[0].opts.casterIsMe, side === 'player');
    assert.equal(g.__s.busy, true);
    assert.equal(holds, 1);
    calls[0].resolve(false); // asset failure must also release busy and reveal
    await tick(); await tick();
    assert.equal(g.__s.busy, false);
    assert.equal(holds, 0);
    assert.ok(revealed.includes(card.uid));
    assert.equal(JSON.stringify(foe), before);

    
  });
}


for(const [id,size,offset] of [['n13',[1725,1068.75],[0,-168.75]],['a14',[1610,997.5],[0,-291.375]],['d27',[1610,997.5],[-98,-236.25]],['l26',[1610,997.5],[0,-47.25]]]) {
 test(`${id} approved padded metadata, manifest and synchronous visibility contract`,()=>{
  const dir=path.join(ROOT,'assets/vfx/legendary',id),meta=JSON.parse(fs.readFileSync(path.join(dir,'meta.json')));
  const man=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/manifest.json')));const g=loadGame();
  assert.equal(meta.durationMs,2000);assert.equal(meta.enemyMute,undefined);assert.equal(meta.video.width,1472);assert.equal(meta.video.height,912);
  assert.deepEqual(meta.video['displayPx@1080p'],size);assert.deepEqual(meta.video['offsetPx@1080p'],offset);assert.equal(meta.video.flipYWhenOppCasts,true);
  assert.equal(vm.runInContext('LEGENDARY_KEEP_VISIBLE',g).has(id),meta.summonedReveal.keepSummonedCardVisible===true);
  for(const f of fs.readdirSync(dir)){const item=man.items.find(i=>i.path===`assets/vfx/legendary/${id}/${f}`);assert.ok(item,f);assert.equal(item.bytes,fs.statSync(path.join(dir,f)).size);}
 });
}
