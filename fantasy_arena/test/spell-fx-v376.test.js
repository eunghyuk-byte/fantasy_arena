// v0.376 fs10 재폭풍(A) — es9 팔진도와 같은 summon 모드 (spell.type summon_n · 화산재 f40 ×3)
// + formation 크기 공용 계산(squashY·프레임 비율) · handGuard(폭풍 띠가 손패를 가리지 않게) · es9 동작 유지
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { loadGame, setup, place, card } = require("../test-support/harness.js");

const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "js/spell-fx.js"), "utf8");
const man = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/manifest.json"), "utf8"));
const packDir = id => path.join(ROOT, "assets/vfx/spells", id);
const packFiles = id => fs.readdirSync(packDir(id)).sort();
const inMan = id => man.items.filter(i => i.path.startsWith("assets/vfx/spells/" + id + "/")).map(i => i.path.split("/").pop()).sort();
const meta = id => JSON.parse(fs.readFileSync(path.join(packDir(id), "meta.json"), "utf8"));

function loadSpellFx(w, h, els) {
  const noop = () => {};
  const rect = r => ({ getBoundingClientRect: () => ({ left: 0, right: 100, top: r[0], bottom: r[1], width: 100, height: r[1] - r[0] }) });
  els = els || {};
  const document = {
    readyState: "loading",
    getElementById: id => (els[id] ? rect(els[id]) : null),
    querySelector: () => null,
    querySelectorAll: sel => (els[sel] || []).map(rect),
  };
  const ctx = { console, setTimeout, clearTimeout, Math, JSON, Promise, innerWidth: w, innerHeight: h, document, addEventListener: noop, requestAnimationFrame: noop };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: "spell-fx.js" });
  return ctx.SpellFx;
}

test("fs10 팩: concept A · summon 모드 · formation 640x360 900px squashY 1.0 · rise 300+i*90 · 1초 이하 · 게임 파일만 · manifest", () => {
  const m = meta("fs10");
  assert.equal(m.id, "fs10");
  assert.equal(m.concept, "A");
  assert.deepEqual([m.type, m.playMode, m.targetMode, m.count], ["summon", "summon", "self", 3]);
  const F = m.formation, R = m.rise;
  assert.deepEqual([F.frames, F.w, F.h, F.durationMs, F["displayWidthPx@1080p"], F.squashY], [23, 640, 360, 767, 900, 1.0]);
  assert.deepEqual([R.frames, R.durationMs, R.startMs, R.staggerMs], [15, 500, 300, 90]);
  assert.deepEqual(R.tokenFadeIn, { startMs: 180, durationMs: 160 });
  assert.equal(R.solidReveal.durationMs, 180);
  const last = R.startMs + 2 * R.staggerMs;
  assert.ok(last + R.durationMs <= 1000);
  assert.ok(last + 180 + 160 + 180 <= 1000, "마지막 토큰 팝까지 1초 이하");
  assert.deepEqual(packFiles("fs10"), ["formation_strip.webp", "meta.json", "rise_strip.webp", "sfx.mp3"], "preview.mp4 없음");
  assert.deepEqual(inMan("fs10"), packFiles("fs10"));
  for (const f of packFiles("fs10")) {
    const it = man.items.find(i => i.path === "assets/vfx/spells/fs10/" + f);
    assert.equal(it.bytes, fs.statSync(path.join(packDir("fs10"), f)).size, f + " bytes");
  }
  assert.equal(F.handGuard["fadePx@1080p"], 70);
  const S = loadSpellFx(1920, 1080);
  assert.equal(S.isSummonMeta(m), true);
  assert.equal(S.isOverlayMeta(m), false);
});

test("formation 크기: 폭 × squashY × (h/w) — es9 520×374 (그대로) · fs10 900×506 · 화면 비율 k", () => {
  const S = loadSpellFx(1920, 1080);
  const e = S.summonFormationBox(meta("es9"), 1, null);
  assert.equal(e.fw, 520); assert.ok(Math.abs(e.fh - 520 * 0.72) < 1e-9, "es9 448² → 520 × 374.4");
  const f = S.summonFormationBox(meta("fs10"), 1, { w: 640, h: 360 });
  assert.equal(f.fw, 900); assert.ok(Math.abs(f.fh - 506.25) < 1e-9);
  const h = S.summonFormationBox(meta("fs10"), 2 / 3, null);
  assert.ok(Math.abs(h.fw - 600) < 1e-9 && Math.abs(h.fh - 337.5) < 1e-9);
  assert.match(SRC, /const \{ fw, fh \} = summonFormationBox\(meta, k, fFr\);/);
});

test("handGuard: fs10 내 시전 = 손패 카드 윗선 · 상대 시전 = 상대 손패 아랫선 · es9는 없음(기존 동작)", () => {
  const els = { "#myHand .card": [[870, 1070], [862, 1072]], "#oppHand > *": [[-60, 140], [-67, 146]], myHand: [769, 1071], oppHand: [6, 119] };
  const S = loadSpellFx(1920, 1080, els);
  assert.equal(S.summonHandGuard(meta("es9"), true, 1), null);
  const me = S.summonHandGuard(meta("fs10"), true, 1);
  assert.deepEqual([me.edge, me.fade, me.below], [862, 70, true]);
  const op = S.summonHandGuard(meta("fs10"), false, 1);
  assert.deepEqual([op.edge, op.fade, op.below], [146, 70, false]);
  const S2 = loadSpellFx(1920, 1080, { myHand: [769, 1071] });
  assert.equal(S2.summonHandGuard(meta("fs10"), true, 1).edge, 769, "카드가 없으면 손패 영역 윗선");
  assert.match(SRC, /applyHandGuard\(ctx, guard, cw, ch\); \/\/ formation만 지움/);
});

function captureCast(g, caster, name) {
  const seen = {};
  g.SpellFx = { play: (c, o) => { seen.card = c.id; seen.casterIsMe = o.casterIsMe; seen.uids = o.resolveNow(); seen.again = o.resolveNow(); return Promise.resolve(); } };
  return g.runSpellCast(caster, card(g, name), null).then(() => seen);
}

test("재폭풍: 연출이 먼저 해결 → 새 화산재 3기 uid · 해결은 한 번 · 전장 자리만큼만", async () => {
  const g = loadGame();
  let s = setup(g);
  place(g, s.p1, "f1"); place(g, s.p1, "f2");
  let seen = await captureCast(g, s.p1, "재폭풍");
  assert.equal(seen.card, "fs10");
  assert.equal(seen.casterIsMe, true);
  assert.equal(s.p1.board.length, 5);
  assert.deepEqual(seen.uids, s.p1.board.slice(2).map(m => m.uid));
  assert.ok(s.p1.board.slice(2).every(m => m.id === "f40"));
  assert.deepEqual(seen.again, []);
  s = setup(g);
  ["f1", "f2", "f3"].forEach(id => place(g, s.p1, id));
  seen = await captureCast(g, s.p1, "재폭풍");
  assert.equal(seen.uids.length, 2, "빈 자리 2개 → 2기");
});

test("재폭풍 상대 시전: casterIsMe false · 상대 전장 새 토큰 uid", async () => {
  const g = loadGame();
  const s = setup(g);
  place(g, s.p2, "f1");
  vm.runInContext("state.acting = state.p2; state.turn = 2;", g);
  const seen = await captureCast(g, s.p2, "재폭풍");
  assert.equal(seen.casterIsMe, false);
  assert.equal(s.p2.board.length, 4);
  assert.deepEqual(seen.uids, s.p2.board.slice(1).map(m => m.uid));
  assert.equal(s.p1.board.length, 0);
});

test("es9 팔진도 회귀: 같은 summon 경로로 팔진석 2기 · meta(520·0.72·handGuard 없음) 그대로", async () => {
  const m = meta("es9");
  assert.deepEqual([m.formation["displayWidthPx@1080p"], m.formation.squashY, m.formation.handGuard], [520, 0.72, undefined]);
  const g = loadGame();
  const s = setup(g);
  place(g, s.p1, "l12");
  const seen = await captureCast(g, s.p1, "팔진도");
  assert.equal(seen.card, "es9");
  assert.equal(seen.uids.length, 2);
  assert.ok(s.p1.board.slice(1).every(u => u.id === "e43"));
  assert.match(SRC, /if \(isSummonMeta\(meta\)\) return playSummon\(stage, meta, base, opts\);/);
  assert.match(SRC, /hideUnits\(uids\);/);
});
