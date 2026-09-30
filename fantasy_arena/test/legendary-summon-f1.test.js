const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadGame, setup, place } = require('../test-support/harness');
const tick = () => new Promise(resolve => setImmediate(resolve));
const ROOT = path.join(__dirname, '..');

for (const side of ['player', 'AI']) {
  test(`f1 ${side} summon preserves enemies and never defers their views`, async () => {
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
    const card = g.cloneCard('f1');
    caster.hand.push(card);
    assert.equal(g.legendarySummonFxBase(card), 'assets/vfx/legendary/f1/');
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

function canvasPlayer(meta, width, height, enemyMute) {
  const src = fs.readFileSync(path.join(ROOT, 'js/spell-fx.js'), 'utf8');
  const start = src.indexOf('async function playLegendarySummon(');
  const end = src.indexOf('/** Dispatch a meta-driven canvas pack.', start);
  const events = {mutes: [], draws: [], scales: [], reveals: [], swaps: []};
  const ctx = {
    _legendaryEpoch:0,
    _hidden: {unit: {state:'hide'}},
    preloadLegendarySummon: async () => ({meta, frames: meta.layers.map(() => ({w:640,h:465}))}),
    fxScale: () => Math.min(width/1920,height/1080),
    legendaryAnchors: () => ({summonedUnit:{x:width*.6,y:height*.65},enemies:[{uid:'enemy',x:100,y:100}]}),
    legendaryHitMs: () => 400,
    legendaryLayerMs: L => L.durationMs,
    legendaryHost: () => ({}),metaSfxUrl: () => 'sound.mp3',legendaryDimAlpha: () => .36,
    revealUnit: id => {events.reveals.push(id);delete ctx._hidden[id];},
    muteEnemy: (id) => events.mutes.push(id),
    drawFrame: (...args) => events.draws.push(args.slice(2)),
    runCanvasFx: async (host,duration,url,at,draw,opts) => {
      events.duration=duration;events.sound=opts.sound;
      const canvas={save(){},restore(){},fillRect(){},translate(){},scale:(...a)=>events.scales.push(a)};
      for(const t of [0,500,900,1500,2000])draw(canvas,t,width,height);
      return true;
    },
  };
  vm.createContext(ctx);vm.runInContext(src.slice(start,end),ctx);
  return {ctx,events};
}

for(const [w,h] of [[1920,1080],[1280,720]]) {
  test(`legendary canvas opt-in enemy mute, consecutive pages and AI flip at ${w}x${h}`,async()=>{
    const meta={durationMs:2000,layers:[0,1,2].map(i=>({anchor:'summonedUnit',frames:20,fps:30,startMs:i*2000/3,durationMs:2000/3,'displayPx@1080p':[1920,1395],flipYWhenOppCasts:true}))};
    const {ctx,events}=canvasPlayer(meta,w,h);
    await ctx.playLegendarySummon('f1/',{unitUid:'unit',enemyUids:['enemy'],casterIsMe:false,sound:false});
    assert.deepEqual(events.mutes, [], 'metadata without enemyMute must not mute even if enemy ids are supplied');
    assert.equal(events.duration,2000);
    assert.equal(events.sound,false);
    assert.equal(events.draws.length,4);
    assert.deepEqual(events.draws.map(d=>d[0]),[0,15,7,5]);
    assert.ok(events.scales.every(s=>s[0]===1&&s[1]===-1));
    assert.equal(events.draws[0][3],w);
    assert.equal(events.draws[0][4],1395*w/1920);
    assert.deepEqual(events.reveals,['unit']);
    meta.enemyMute={swapAtMs:60};
    const old=canvasPlayer(meta,w,h);await old.ctx.playLegendarySummon('f15/',{unitUid:'unit',enemyUids:['enemy']});
    assert.deepEqual(old.events.mutes,['enemy'],'f15 explicit mute remains supported');
  });
}

test('f1 asset manifest and 60-frame two-second contract',()=>{
  const dir=path.join(ROOT,'assets/vfx/legendary/f1');
  assert.ok(fs.existsSync(dir),'f1 asset pack is installed');
  const meta=JSON.parse(fs.readFileSync(path.join(dir,'meta.json')));
  const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/manifest.json')));
  assert.equal(meta.durationMs,2000);assert.equal(meta.enemyMute,undefined);
  assert.equal(meta.video.frames,60);assert.equal(meta.video.durationMs,2000);assert.equal(meta.video.alpha,true);assert.equal(meta.layers,undefined);
  for(const name of fs.readdirSync(dir)){
    const it=manifest.items.find(i=>i.path==='assets/vfx/legendary/f1/'+name);
    assert.ok(it,name);assert.equal(it.bytes,fs.statSync(path.join(dir,name)).size);
  }
  assert.equal(manifest.count,manifest.items.length);
});
