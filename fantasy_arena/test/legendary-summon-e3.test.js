const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadGame, setup, place } = require('../test-support/harness');
const tick = () => new Promise(resolve => setImmediate(resolve));
const ROOT = path.join(__dirname, '..');

for (const side of ['player', 'AI']) {
  test(`e3 ${side} summon preserves enemies and never defers their views`, async () => {
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
    const card = g.cloneCard('e3');
    caster.hand.push(card);
    assert.equal(g.legendarySummonFxBase(card), 'assets/vfx/legendary/e3/');
    g.playCard(caster, card, null);
    assert.equal(JSON.stringify(foe), before);
    assert.deepEqual(Object.keys(vm.runInContext('_fxDeferredView', g)), []);
    assert.deepEqual(hidden, [card.uid]);
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

    assert.equal(card.battlecry, undefined);
  });
}

test('e3 asset manifest and 60-frame two-second contract',()=>{
  const dir=path.join(ROOT,'assets/vfx/legendary/e3');
  assert.ok(fs.existsSync(dir),'e3 asset pack is installed');
  const meta=JSON.parse(fs.readFileSync(path.join(dir,'meta.json')));
  const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/manifest.json')));
  assert.equal(meta.durationMs,2000);assert.equal(meta.enemyMute,undefined);
  assert.equal(meta.video.frames,60);assert.equal(meta.video.durationMs,2000);assert.equal(meta.video.alpha,true);assert.equal(meta.layers,undefined);
  for(const name of fs.readdirSync(dir)){
    const it=manifest.items.find(i=>i.path==='assets/vfx/legendary/e3/'+name);
    assert.ok(it,name);assert.equal(it.bytes,fs.statSync(path.join(dir,name)).size);
  }
  assert.equal(manifest.count,manifest.items.length);
});
