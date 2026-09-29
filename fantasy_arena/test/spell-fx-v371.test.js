// v0.371 ns9 동남풍(A, overlay+perUnit aoe_enemy) · fs9 일기토(C, 새 duelKeep) · as9 연환계(C, overlay+perUnit aoe_enemy) · es9 팔진도(A, 새 summon)
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { loadGame, setup, place, card } = require("../test-support/harness.js");

const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "js/spell-fx.js"), "utf8");
const man = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/manifest.json"), "utf8"));
const packFiles = (id) => fs.readdirSync(path.join(ROOT, "assets/vfx/spells", id)).sort();
const inMan = (id) => man.items.filter(i => i.path.startsWith("assets/vfx/spells/" + id + "/")).map(i => i.path.split("/").pop()).sort();
const packSize = (id) => packFiles(id).reduce((s, f) => s + fs.statSync(path.join(ROOT, "assets/vfx/spells", id, f)).size, 0);

// SpellFx를 창 크기만 흉내 낸 vm에 올려 순수 계산(지연식)만 확인
function loadSpellFx(w, h) {
  const noop = () => {};
  const ctx = { console, setTimeout, clearTimeout, Math, JSON, Promise, innerWidth: w, innerHeight: h,
    document: { readyState: "loading", getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
    addEventListener: noop, requestAnimationFrame: noop };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: "spell-fx.js" });
  return ctx.SpellFx;
}

test("ns9 팩: concept A · aoe_enemy · overlay+perUnit · 오버레이 72% · 1초 이하 · 2MB 이하 · manifest", () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/vfx/spells/ns9/meta.json"), "utf8"));
  assert.equal(m.id, "ns9");
  assert.equal(m.concept, "A");
  assert.equal(m.targetMode, "aoe_enemy");
  assert.equal(m.playMode, "overlay+perUnit");
  assert.equal(m.overlay.opacity, 0.72);
  assert.ok(m.overlay.opacity >= 0.7 && m.overlay.opacity <= 0.75);
  assert.equal(m.overlay.flipYWhenOppCasts, true);
  assert.deepEqual(m.unitImpact.delay, { baseMs: -250, "perPx@1080p": 0.25, origin: "corner", corner: "bottomRight", metric: "manhattan", minMs: 0, mirrorYWhenOppCasts: true });
  for (const k of ["overlay", "unitImpact", "sfx"]) assert.ok(fs.existsSync(path.join(ROOT, "assets/vfx/spells/ns9", m[k].file)), m[k].file);
  assert.ok(m.overlay.durationMs <= 1000 && m.durationMs <= 1000);
  assert.ok(packSize("ns9") <= 2 * 1024 * 1024);
  assert.ok(!packFiles("ns9").includes("preview.mp4"));
  assert.deepEqual(inMan("ns9"), packFiles("ns9"));
  assert.equal(man.count, man.items.length);
});

test("ns9 지연식: 오른쪽 아래 모서리에서 쓸기 (meta 기준 보드값과 일치), 상대 시전이면 오른쪽 위 기준", () => {
  const S = loadSpellFx(1920, 1080);
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/vfx/spells/ns9/meta.json"), "utf8"));
  const ref = m.unitImpact.delaysMsAtReferenceBoard;
  const pts = m["referencePointsPx@1080p"].enemyUnits;
  const want = Object.values(ref);
  pts.forEach(([x, y], i) => assert.ok(Math.abs(S.unitDelayMs(m.unitImpact, { x, y }, 1) - want[i]) <= 1, x + "," + y));
  // 반쯤 크기 화면에서도 같은 지연 (px@1080p 환산)
  const S2 = loadSpellFx(960, 540);
  assert.ok(Math.abs(S2.unitDelayMs(m.unitImpact, { x: 240, y: 155.5 }, 0.5) - 302) <= 1);
  // 상대 시전 (내 보드 y=719): 오른쪽 위 모서리 기준 → (1920-480)+719-250
  assert.ok(Math.abs(S.unitDelayMs(m.unitImpact, { x: 480, y: 719 }, 1, { casterIsMe: false }) - (1440 + 719) * 0.25 + 250) <= 1);
  // 모서리 가까운 유닛은 0 미만으로 가지 않음
  assert.equal(S.unitDelayMs(m.unitImpact, { x: 1900, y: 1060 }, 1), 0);
  const maxEnd = Math.max(...pts.map(([x, y]) => S.unitDelayMs(m.unitImpact, { x, y }, 1))) + m.unitImpact.durationMs;
  assert.ok(maxEnd <= 1000, "end " + maxEnd);
});

test("fs9 팩: concept C · duelKeep · keep 900ms/kill 533ms · 1초 이하 · 2MB 이하 · manifest", () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/vfx/spells/fs9/meta.json"), "utf8"));
  assert.equal(m.id, "fs9");
  assert.equal(m.concept, "C");
  assert.equal(m.playMode, "duelKeep");
  assert.equal(m.targetMode, "aoe_all");
  assert.deepEqual([m.keep.frames, m.keep.durationMs, m.keep["displayBoxPx@1080p"], m.keep["anchorOffsetYPx@1080p"]], [27, 900, 420, -60]);
  assert.deepEqual([m.kill.frames, m.kill.durationMs, m.kill["displayBoxPx@1080p"]], [16, 533, 330]);
  assert.deepEqual(m.kill.delay, { baseMs: 100, "perPx@1080p": 0.12, origin: "center" });
  for (const k of ["keep", "kill", "sfx"]) assert.ok(fs.existsSync(path.join(ROOT, "assets/vfx/spells/fs9", m[k].file)), m[k].file);
  const S = loadSpellFx(1920, 1080);
  Object.entries(m.kill.delaysMsAtReferenceBoard).forEach(([k, v]) => {
    const [x, y] = k.match(/\[(\d+), (\d+)\]/).slice(1).map(Number);
    assert.ok(Math.abs(S.unitDelayMs(m.kill, { x, y }, 1) - v) <= 1, k);
    assert.ok(v + m.kill.durationMs <= 1000);
  });
  assert.ok(packSize("fs9") <= 2 * 1024 * 1024);
  assert.deepEqual(inMan("fs9"), packFiles("fs9"));
});

test("SpellFx: duelKeep 공용 모드 (keepUids → keep 레이어, 나머지 kill), overlay opacity·flipY, corner 지연", () => {
  assert.match(SRC, /async function playDuelKeep\(stage, meta, base, opts\)/);
  assert.match(SRC, /String\(meta\.playMode \|\| ""\) === "duelKeep"/);
  assert.match(SRC, /if \(isDuelKeepMeta\(meta\)\) return playDuelKeep\(stage, meta, base, opts\);/);
  assert.match(SRC, /isProjectileMeta\(meta\) \|\| isOverlayMeta\(meta\) \|\| isFlowMeta\(meta\) \|\| isAnchoredMeta\(meta\) \|\| isDuelKeepMeta\(meta\) \|\| isSummonMeta\(meta\)/);
  assert.match(SRC, /const keepSet = new Set\(\(opts\.keepUids \|\| \[\]\)\.map\(String\)\);/);
  assert.match(SRC, /if \(opts\.keepUids\) mOpts\.keepUids = opts\.keepUids;/);
  assert.match(SRC, /ctx\.globalAlpha = oAlpha;/);
  assert.match(SRC, /if \(oFlip\) \{ ctx\.translate\(0, 2 \* by \+ bh\); ctx\.scale\(1, -1\); \}/);
  const S = loadSpellFx(1920, 1080);
  const fs9 = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/vfx/spells/fs9/meta.json"), "utf8"));
  const ns9 = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/vfx/spells/ns9/meta.json"), "utf8"));
  assert.equal(S.isDuelKeepMeta(fs9), true);
  assert.equal(S.isOverlayMeta(fs9), false);
  assert.equal(S.isOverlayMeta(ns9), true);
  assert.equal(S.isDuelKeepMeta(ns9), false);
});

test("일기토: 생존 유닛을 연출 전에 뽑아 연출(keepUids)과 해결에 같은 uid 사용", async () => {
  const g = loadGame();
  for (let round = 0; round < 6; round++) {
    const { p1, p2 } = setup(g);
    const mk = (p) => { const m = place(g, p, "l12"); m.ability = null; m.keywords = []; m.atkC = 0; m.defC = 0; m.hpC = 0; m.hp = 3; m.maxHp = 3; return m; };
    for (let i = 0; i < 4; i++) mk(p1);
    for (let i = 0; i < 5; i++) mk(p2);
    let seen = null;
    g.__cap = (plan) => { seen = plan && plan.keepUids ? plan.keepUids.slice() : null; };
    vm.runInContext("playSpellFx = function (c, t, caster, plan) { __cap(plan); return Promise.resolve(); }", g);
    await g.runSpellCast(p1, card(g, "일기토"), null);
    assert.ok(seen && seen.length === 2, "keepUids 2개");
    assert.equal(p1.board.length, 1);
    assert.equal(p2.board.length, 1);
    assert.deepEqual([p1.board[0].uid, p2.board[0].uid], seen, "연출 생존 = 실제 생존");
  }
  // 한쪽 전장이 비면 생존 uid 1개
  const { p1 } = setup(g);
  place(g, p1, "l12"); place(g, p1, "l12");
  const ids = g.pickDuelKeepUids(p1);
  assert.equal(ids.length, 1);
  assert.ok(p1.board.some(m => m.uid === ids[0]));
  // 연출 없이 바로 쓰는 예전 경로(keepUids 없음)도 그대로 랜덤 하나씩
  const s2 = setup(g);
  const plain = (p) => { const m = place(g, p, "l12"); m.ability = null; m.keywords = []; m.atkC = 0; m.defC = 0; m.hpC = 0; m.hp = 3; m.maxHp = 3; return m; };
  for (let i = 0; i < 3; i++) plain(s2.p1);
  for (let i = 0; i < 3; i++) plain(s2.p2);
  g.applyFx(s2.p1, card(g, "일기토").spell, null);
  assert.equal(s2.p1.board.length, 1);
  assert.equal(s2.p2.board.length, 1);
});

test("동남풍: 기존 해결 로직 유지 (적 전장 → 핸드), 연출 옵션에 keepUids 없음", async () => {
  const g = loadGame();
  const { p1, p2 } = setup(g);
  for (let i = 0; i < 3; i++) place(g, p2, "l12");
  let seen = "x";
  g.__cap = (plan) => { seen = plan && plan.keepUids; };
  vm.runInContext("playSpellFx = function (c, t, caster, plan) { __cap(plan); return Promise.resolve(); }", g);
  await g.runSpellCast(p1, card(g, "동남풍"), null);
  assert.equal(seen, undefined);
  assert.equal(p2.board.length, 0);
  assert.equal(p2.hand.length, 3);
});

test("as9 팩: concept C · aoe_enemy · overlay+perUnit · 대상 보드 상자 1280x720 · 왼→오 70ms 간격 · 1초 이하 · manifest", () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/vfx/spells/as9/meta.json"), "utf8"));
  assert.equal(m.id, "as9");
  assert.equal(m.concept, "C");
  assert.equal(m.targetMode, "aoe_enemy");
  assert.equal(m.playMode, "overlay+perUnit");
  assert.deepEqual(m.overlay.fitBox, { "sizePx@1080p": [1280, 720], anchor: "targetBoard", "offsetYPx@1080p": -20 });
  assert.equal(m.overlay.flipYWhenOppCasts, true);
  assert.deepEqual(m.unitImpact.delay, { baseMs: 40, staggerMs: 70, order: "x" });
  for (const k of ["overlay", "unitImpact", "sfx"]) assert.ok(fs.existsSync(path.join(ROOT, "assets/vfx/spells/as9", m[k].file)), m[k].file);
  assert.ok(40 + 4 * 70 + m.unitImpact.durationMs <= 1000);
  assert.ok(m.overlay.durationMs <= 1000);
  assert.ok(packSize("as9") <= 2 * 1024 * 1024);
  assert.deepEqual(inMan("as9"), packFiles("as9"));
  assert.match(SRC, /if \(st\) upts\.sort\(\(a, b\) => a\.x - b\.x\);/);
  assert.match(SRC, /at: st \? \(st\.baseMs \|\| 0\) \+ i \* st\.staggerMs : unitDelayMs\(U, pt, k, opts\)/);
  assert.match(SRC, /if \(O && O\.fitBox\)/);
});

test("es9 팩: concept A · summon 모드 · formation 767ms · rise 300+i*100ms · 토큰 fade+실제 카드 팝 · 1초 이하 · manifest", () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/vfx/spells/es9/meta.json"), "utf8"));
  assert.equal(m.id, "es9");
  assert.equal(m.concept, "A");
  assert.equal(m.playMode, "summon");
  assert.deepEqual([m.formation.frames, m.formation.durationMs, m.formation["displayWidthPx@1080p"], m.formation.squashY], [23, 767, 520, 0.72]);
  assert.deepEqual([m.rise.frames, m.rise.durationMs, m.rise.startMs, m.rise.staggerMs], [17, 567, 300, 100]);
  assert.deepEqual(m.rise.tokenFadeIn, { startMs: 220, durationMs: 200 });
  assert.equal(m.rise.solidReveal.durationMs, 180);
  for (const k of ["formation", "rise", "sfx"]) assert.ok(fs.existsSync(path.join(ROOT, "assets/vfx/spells/es9", m[k].file)), m[k].file);
  const lastRise = m.rise.startMs + m.rise.staggerMs;
  assert.ok(lastRise + m.rise.durationMs <= 1000);
  assert.ok(lastRise + 220 + 200 + m.rise.solidReveal.durationMs <= 1000, "토큰 드러내기까지 1초 이하");
  assert.ok(packSize("es9") <= 2 * 1024 * 1024);
  assert.deepEqual(inMan("es9"), packFiles("es9"));
  const S = loadSpellFx(1920, 1080);
  assert.equal(S.isSummonMeta(m), true);
  assert.equal(S.isOverlayMeta(m), false);
  assert.match(SRC, /if \(isSummonMeta\(meta\)\) return playSummon\(stage, meta, base, opts\);/);
  assert.match(SRC, /uids = opts\.resolveNow\(\) \|\| \[\];/);
  assert.match(SRC, /hideUnits\(uids\);/);
  assert.match(SRC, /opacity:0!important;/);
});

test("팔진도: 연출이 먼저 해결(resolveNow)해 새 토큰 uid를 받고, 해결은 한 번만", async () => {
  const g = loadGame();
  const { p1 } = setup(g);
  place(g, p1, "l12"); place(g, p1, "l12");
  let got = null, again = null;
  g.__cap2 = (plan) => { got = plan.resolveNow(); again = plan.resolveNow(); };
  vm.runInContext("playSpellFx = function (c, t, caster, plan) { __cap2(plan); return Promise.resolve(); }", g);
  await g.runSpellCast(p1, card(g, "팔진도"), null);
  assert.equal(p1.board.length, 4, "토큰 2기 (중복 해결 없음)");
  assert.equal(got.length, 2);
  assert.deepEqual(got, p1.board.slice(2).map(m => m.uid));
  assert.ok(p1.board.slice(2).every(m => m.id === "e43"));
  assert.deepEqual(again, []);
  // 연출이 resolveNow를 안 부르는 스펠(또는 연출 실패)은 그 뒤에 해결
  const s2 = setup(g);
  place(g, s2.p1, "l12");
  vm.runInContext("playSpellFx = function () { return Promise.resolve(); }", g);
  await g.runSpellCast(s2.p1, card(g, "팔진도"), null);
  assert.equal(s2.p1.board.length, 3);
});
