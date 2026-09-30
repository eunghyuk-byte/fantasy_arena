// v0.381 전설 유닛 소환 연출 (playMode "legendarySummon") — f15 장비 「장판교 일갈」 A안
// · 카드 id → 에셋 폴더 표(LEGENDARY_SUMMON_FX) · 장비 소환 때만 재생 · 침묵 로직은 그대로(즉시 해결) · AI가 내면 역할 반대
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { loadGame, setup, place } = require("../test-support/harness.js");

const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "assets/vfx/legendary/f15");
const man = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/manifest.json"), "utf8"));
const meta = JSON.parse(fs.readFileSync(path.join(DIR, "meta.json"), "utf8"));
const tick = () => new Promise(r => setImmediate(r));

function loadSpellFx(w, h) {
  const noop = () => {};
  const document = { readyState: "loading", getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
  const ctx = { console, setTimeout, clearTimeout, Math, JSON, Promise, innerWidth: w, innerHeight: h, document, addEventListener: noop, requestAnimationFrame: noop };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js/spell-fx.js"), "utf8"), ctx, { filename: "spell-fx.js" });
  return ctx.SpellFx;
}

/** 연출 스텁: 호출 기록 + 끝내기(resolve)를 테스트가 제어 */
function stubFx(g) {
  const calls = [], hidden = [], revealed = [];
  let holds = 0;
  g.__fx = {
    calls, hidden, revealed, get holds() { return holds; },
    playLegendarySummon(base, opts) {
      let done; const p = new Promise(r => { done = r; });
      calls.push({ base, opts, done });
      return p;
    },
    hideUnits: u => hidden.push(...u),
    revealUnit: u => revealed.push(u),
    whenOverlayIdle: () => Promise.resolve(),
    overlayHold: () => { holds++; return () => { holds--; }; },
    overlayBusy: () => holds > 0,
  };
  vm.runInContext("SpellFx = __fx", g);
  return g.__fx;
}
function abilityUnits(g, n) {
  const all = vm.runInContext("CARDS", g).filter(c => c.type === "minion" && c.ability && !c.battlecry && c.rarity !== "legendary" && c.id !== "f15");
  return all.slice(0, n).map(c => c.id);
}

test("f15 approved video and upright brush sprite are manifest-listed", () => {
  assert.equal(meta.durationMs,2000); assert.equal(meta.dim.opacity,.32);
  assert.equal(meta.video.file,'summon.webm'); assert.equal(meta.video.flipYWhenOppCasts,true);
  assert.equal(meta.layers.length,1); const L=meta.layers[0];
  assert.equal(L.anchor,'eachEnemy'); assert.deepEqual(L['offsetPx@1080p'],[0,-20.5]);
  for(const file of ['meta.json','summon.webm','seal_strip.webp','sfx.mp3','sfx.ogg','FONT_LICENSE.txt']) {
    const item=man.items.find(i=>i.path==='assets/vfx/legendary/f15/'+file);
    assert.ok(item,file);assert.equal(item.bytes,fs.statSync(path.join(DIR,file)).size);
  }
});
test("ring timing scales with actual positions and dim follows selected metadata",()=>{
  const S=loadSpellFx(1920,1080);
  assert.ok(S.isLegendarySummonMeta(meta));
  assert.equal(S.legendaryHitMs(meta,{x:0,y:0},{x:160,y:0},1),480);
  assert.equal(S.legendaryHitMs(meta,{x:0,y:0},{x:80,y:0},.5),480);
  assert.equal(S.legendaryDimAlpha(meta.dim,80),.16);
  assert.equal(S.legendaryDimAlpha(meta.dim,800),.32);
  assert.equal(S.legendaryDimAlpha(meta.dim,2000),0);
});

test("표: LEGENDARY_SUMMON_FX = { f15 → assets/vfx/legendary/f15/ } · 유닛 카드만", () => {
  const g = loadGame();
  const T = vm.runInContext("LEGENDARY_SUMMON_FX", g);
  assert.equal(T.f15, "assets/vfx/legendary/f15/");
  Object.values(T).forEach(b => assert.ok(fs.existsSync(path.join(ROOT, b, "meta.json")), b));
  assert.equal(g.legendarySummonFxBase(g.cloneCard("f15")), "assets/vfx/legendary/f15/");
  assert.equal(g.legendarySummonFxBase(g.cloneCard("ls3")), null);
  assert.equal(g.legendarySummonFxBase(g.cloneCard("e8")), null);
});

test("내가 장비 소환: 침묵 즉시 해결 · legendarySummon 1회(적 uid·새 유닛 uid) · 히트 전 표시는 이전 문구 · 연출 중 입력 잠금", async () => {
  const g = loadGame();
  const fx = stubFx(g);
  const { p1, p2 } = setup(g);
  const ids = abilityUnits(g, 3);
  const foes = ids.map(id => place(g, p2, id));
  const texts = foes.map(f => f.text);
  const f15 = g.cloneCard("f15");
  p1.hand.push(f15);
  const r = g.playCard(p1, f15, null);
  assert.notStrictEqual(r, false);
  assert.ok(p1.board.includes(f15));
  // 로직: 즉시 침묵
  foes.forEach(f => { assert.equal(f.silenced, true); assert.equal(f.text, "침묵"); assert.equal(f.ability, null); });
  assert.deepEqual(fx.hidden, [f15.uid], "render 전에 새 유닛 숨김");
  assert.equal(g.__s.busy, true);
  // 표시: 히트 전까지 이전 문구
  foes.forEach((f, i) => assert.equal(g.fxDisplayUnit(f).text, texts[i]));
  await tick();
  assert.equal(fx.calls.length, 1);
  const c = fx.calls[0];
  assert.equal(c.base, "assets/vfx/legendary/f15/");
  assert.equal(c.opts.unitUid, f15.uid);
  assert.deepEqual(Array.from(c.opts.enemyUids), foes.map(f => f.uid));
  assert.equal(c.opts.casterIsMe, true);
  assert.equal(fx.holds, 1, "오버레이 게이트");
  c.opts.onEnemySwap(foes[0].uid);
  assert.equal(g.fxDisplayUnit(foes[0]).text, "침묵");
  assert.equal(g.fxDisplayUnit(foes[1]).text, texts[1]);
  c.done(true);
  await tick(); await tick();
  assert.equal(g.__s.busy, false);
  assert.equal(fx.holds, 0);
  foes.forEach(f => assert.equal(g.fxDisplayUnit(f), f, "끝나면 표시 = 실제 상태"));
});

test("다른 카드는 legendarySummon 안 함 (일반 유닛·다른 전설·침묵 스펠 정화)", async () => {
  const g = loadGame();
  const fx = stubFx(g);
  const { p1, p2 } = setup(g);
  place(g, p2, abilityUnits(g, 1)[0]);
  const plain = g.cloneCard("e8");
  p1.hand.push(plain);
  g.playCard(p1, plain, null);
  const otherLegend = vm.runInContext("CARDS", g).find(c => c.type === "minion" && c.rarity === "legendary" && c.id !== "f15" && !c.battlecry);
  if (otherLegend) { const o = g.cloneCard(otherLegend.id); p1.hand.push(o); g.playCard(p1, o, null); }
  const ls3 = g.cloneCard("ls3");
  p1.hand.push(ls3);
  g.playCard(p1, ls3, null);
  await tick(); await tick();
  assert.equal(fx.calls.length, 0);
  assert.ok(!g.__s.busy);
  assert.deepEqual(fx.hidden, []);
});

test("AI가 장비 소환: 역할 반대 (casterIsMe false · 적 = 내 전장 유닛)", async () => {
  const g = loadGame();
  const fx = stubFx(g);
  const { p1, p2 } = setup(g);
  const mine = abilityUnits(g, 2).map(id => place(g, p1, id));
  vm.runInContext("state.turn = 2; state.acting = state.p2", g);
  const f15 = g.cloneCard("f15");
  p2.hand.push(f15);
  g.playCard(p2, f15, null);
  mine.forEach(m => assert.equal(m.silenced, true));
  await tick();
  assert.equal(fx.calls.length, 1);
  assert.equal(fx.calls[0].opts.casterIsMe, false);
  assert.deepEqual(Array.from(fx.calls[0].opts.enemyUids), mine.map(m => m.uid));
  fx.calls[0].done(true);
  await tick(); await tick();
  assert.equal(g.__s.busy, false);
});

test("연출 모듈 없음(헤드리스): 장비 침묵 로직만 그대로 · 잠금 없음", () => {
  const g = loadGame();
  const { p1, p2 } = setup(g);
  const foes = abilityUnits(g, 2).map(id => place(g, p2, id));
  const f15 = g.cloneCard("f15");
  p1.hand.push(f15);
  g.playCard(p1, f15, null);
  foes.forEach(f => { assert.equal(f.silenced, true); assert.equal(g.fxDisplayUnit(f), f); });
  assert.ok(!g.__s.busy);
});
