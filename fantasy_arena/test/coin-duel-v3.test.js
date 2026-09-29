// v0.369 코인 듀얼 v3 B2: 배치·타이밍·late 코인·사운드 규칙·에셋·연결
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const CD = path.join(ROOT, "assets/vfx/coin_duel");
const SRC = fs.readFileSync(path.join(ROOT, "js/coin-duel.js"), "utf8");
const ctx = { window: {}, performance: { now: () => 0, timeOrigin: 0 }, console };
vm.createContext(ctx);
vm.runInContext(SRC + "\nthis.CoinDuel = CoinDuel;", ctx);
const CDX = ctx.CoinDuel;
const coinsJson = JSON.parse(fs.readFileSync(path.join(CD, "coins.json"), "utf8"));
const COINS = coinsJson.coins;
// 1920×1080 실측 보드 코어
const CORE_1080 = { left: 132, top: -72.9, w: 1656, h: 1242 };
const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };

test("배치: 1080p에서 README B2 값과 일치 (카드 364,98 / 364,524 · 257×385, 첫 코인 713.4, right(5)=1394.5 ≤ 1540)", () => {
  const g = CDX.computeLayout(CORE_1080, { left: 1548, width: 146 }, 5);
  const r = (v) => Math.round(v);
  assert.deepEqual([r(g.top.x), r(g.top.y), r(g.top.w), r(g.top.h)], [364, 98, 257, 385]);
  assert.deepEqual([r(g.bottom.x), r(g.bottom.y)], [364, 524]);
  assert.ok(Math.abs(g.firstX - 713.4) < 1, "firstX " + g.firstX);
  assert.ok(Math.abs(g.pitch - 138.6) < 0.5);
  assert.ok(Math.abs(g.D - 115.5) < 0.5);
  assert.ok(Math.abs(g.scale - 0.7219) < 0.002);
  assert.ok(Math.abs(g.rowY.top - 290.5) < 1 && Math.abs(g.rowY.bottom - 716.5) < 1);
  assert.ok(Math.abs(g.right - 1394.5) < 1 && g.right <= g.safe);
  assert.equal(Math.round(g.safe), 1540);
});

test("배치: 넘치면 카드 높이 먼저 축소 (턴 종료 버튼이 가까운 화면)", () => {
  const g = CDX.computeLayout(CORE_1080, { left: 1200, width: 100 }, 5);
  assert.ok(g.safe <= 1192);
  assert.ok(g.cardH < 385, "카드 축소");
  assert.ok(g.right <= g.safe + 0.01, "5개 코인이 safe_right 안");
  assert.ok(Math.abs(g.pitchK - 0.36) < 1e-9, "피치는 그대로");
});

test("late 코인 규칙: 더 많은 줄(동률이면 아래), n≤3 → n-1, n≥4 → n//2+1", () => {
  assert.deepEqual({ ...CDX.pickLate(1, 1) }, { side: "bottom", idx: 0 });
  assert.deepEqual({ ...CDX.pickLate(3, 2) }, { side: "top", idx: 2 });
  assert.deepEqual({ ...CDX.pickLate(2, 3) }, { side: "bottom", idx: 2 });
  assert.deepEqual({ ...CDX.pickLate(4, 1) }, { side: "top", idx: 3 });
  assert.deepEqual({ ...CDX.pickLate(5, 5) }, { side: "bottom", idx: 3 });
  assert.equal(CDX.pickLate(0, 0), null);
});

test("코인 계획: 결과 = 실제 판정(true=앞=금 heads), 시작 0.04+0.03i(+0~12ms), 끝 = 마지막 착지+0.28+0.16 ≈ 2초", () => {
  const top = [false, true, true, true, true], bot = [true, false, true, true, false];
  const p = CDX.planCoins(top, bot, COINS, seq([0, 0.5, 1]));
  assert.equal(p.coins.length, 10);
  p.coins.forEach(c => {
    const flips = c.side === "top" ? top : bot;
    assert.equal(c.name.startsWith("heads"), flips[c.idx], "앞=금 heads / 뒤=검정 tails");
    assert.ok(c.start >= 0.04 + 0.03 * c.idx - 1e-9 && c.start <= 0.04 + 0.03 * c.idx + 0.012 + 1e-9);
  });
  assert.equal(p.coins.filter(c => c.late).length, 1);
  const late = p.coins.find(c => c.late);
  assert.equal(late.side, "bottom"); assert.equal(late.idx, 3); assert.match(late.name, /_late$/);
  const nonLate = p.coins.filter(c => !c.late);
  nonLate.forEach(c => assert.equal(c.variant, ["v1", "v2", "v3"][(c.idx + (c.side === "top" ? 1 : 0)) % 3]));
  assert.ok(Math.abs(p.total - (p.lastSettle + 0.44)) < 1e-9);
  assert.ok(p.total > 1.85 && p.total < 2.05, "5v5 총 " + p.total);
  const p11 = CDX.planCoins([true], [false], COINS, () => 0);
  assert.ok(p11.total > 1.85 && p11.total < 1.95, "1v1 총 " + p11.total);
});

test("사운드: 코인별 -6·log10(n) dB ±1.2dB · ±0.6반음 · 3개 이상이면 rattle은 late+무작위 2개", () => {
  const p = CDX.planCoins([true, false, true], [false, true], COINS, () => 0.3);
  const ev = CDX.planSound(p.coins, seq([0.1, 0.9, 0.5, 0.2, 0.7]));
  const n = 5;
  ev.forEach(e => {
    assert.ok(Math.abs(e.gainDb - (-6 * Math.log10(n))) <= 1.2 + 1e-9);
    const st = 12 * Math.log2(e.rate);
    assert.ok(Math.abs(st) <= 0.6 + 1e-9);
  });
  const rattles = ev.filter(e => /rattle/.test(e.key));
  assert.equal(rattles.length, 3, "late 1 + 무작위 2");
  assert.equal(rattles.filter(e => e.key === "coin_rattle_late").length, 1);
  assert.equal(ev.filter(e => /^coin_impact_/.test(e.key)).length, 5);
  assert.equal(ev.filter(e => /^coin_impact2_/.test(e.key)).length, 5);
  assert.equal(ev.filter(e => /slowmo/.test(e.key)).length, 5);
  const p2 = CDX.planCoins([true], [false], COINS, () => 0);
  assert.equal(CDX.planSound(p2.coins, () => 0.5).filter(e => /rattle/.test(e.key)).length, 2, "2개 이하면 모두 rattle");
  // slowmo는 이벤트 +0.01s
  const c0 = p2.coins[0];
  const sm = CDX.planSound([c0], () => 0.5).find(e => /slowmo/.test(e.key));
  assert.ok(Math.abs(sm.t - (c0.start + c0.meta.events.slowmo[0] + 0.01)) < 1e-9);
  // 볼륨 보정: 원음 합계를 레퍼런스(-17.85 LUFS)로
  assert.ok(CDX.busGainDb(2) > 2 && CDX.busGainDb(2) < 2.5);
  assert.ok(CDX.busGainDb(10) >= 0 && CDX.busGainDb(10) < CDX.busGainDb(2));
});

test("dim·타이밍 상수: RGB(8,6,10) 0.55, 인 0.12s, 유지 0.28s, 아웃 0.16s", () => {
  assert.deepEqual([...CDX.DIM.rgb], [8, 6, 10]);
  assert.equal(CDX.DIM.alpha, 0.55);
  assert.equal(CDX.T.dimIn, 0.12);
  assert.equal(CDX.T.hold, 0.28);
  assert.equal(CDX.T.outro, 0.16);
  const meta = JSON.parse(fs.readFileSync(path.join(CD, "meta.json"), "utf8"));
  assert.equal(meta.id, "coin_duel_v3_B2");
  assert.equal(meta.dim.alpha, CDX.DIM.alpha);
  assert.equal(meta.layout.cards.card_h_x_H_in, CDX.L.cardH);
  assert.equal(meta.layout.coins.coin_pitch_x_card_h, CDX.L.pitch);
});

test("에셋: 코인 8종(webm·timing·Safari sheet) · 사운드 ogg+mp3 · sheet 합계 3MB 이하 · manifest", () => {
  const names = ["heads", "tails"].flatMap(o => ["v1", "v2", "v3", "late"].map(v => o + "_" + v));
  let sheetTotal = 0;
  for (const n of names) {
    for (const f of ["coin.webm", "timing.json", "sheet.webp"]) assert.ok(fs.existsSync(path.join(CD, "coins", n, f)), n + "/" + f);
    sheetTotal += fs.statSync(path.join(CD, "coins", n, "sheet.webp")).size;
    const t = JSON.parse(fs.readFileSync(path.join(CD, "coins", n, "timing.json"), "utf8"));
    assert.equal(COINS[n].frames, t.frames);
    assert.equal(COINS[n].tSettle, t.t_settle);
  }
  assert.ok(sheetTotal <= 3 * 1024 * 1024, "sheet total " + sheetTotal);
  for (const k of Object.keys(coinsJson.sfx)) {
    for (const ext of [".ogg", ".mp3"]) assert.ok(fs.existsSync(path.join(CD, "sfx", coinsJson.sfx[k] + ext)), k + ext);
  }
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/manifest.json"), "utf8"));
  assert.equal(man.count, man.items.length);
  const paths = new Set(man.items.map(i => i.path));
  for (const n of names) assert.ok(paths.has("assets/vfx/coin_duel/coins/" + n + "/coin.webm"));
  assert.ok(paths.has("assets/vfx/coin_duel/coins.json"));
});

test("연결: 전투가 두 카드·코인을 넘기고, 베타 OK 토글 유지, 예전 창은 대체용", () => {
  const combat = fs.readFileSync(path.join(ROOT, "js/combat.js"), "utf8");
  assert.match(combat, /attacker, attackerOwner: p, defender: target\.kind === "minion" \? def : null/);
  assert.match(combat, /\}, duel\);/);
  const game = fs.readFileSync(path.join(ROOT, "js/game.js"), "utf8");
  assert.match(game, /const BETA_COIN_CONFIRM = true;/);
  assert.match(game, /CoinDuel\.play\(\{ top: atkMine \? D : A, bottom: atkMine \? A : D, confirm: confirmOnly \}\)/);
  assert.match(game, /function showCoinResultLegacy\(title, rows, done, confirmOnly\)/);
  assert.match(SRC, /b\.id = "coinOk";/);
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /<script src="js\/coin-duel\.js\?v=/);
  const css = fs.readFileSync(path.join(ROOT, "css/game.css"), "utf8");
  assert.match(css, /#coinDuel \{ position: fixed; inset: 0; z-index: 70; pointer-events: none;/);
});
