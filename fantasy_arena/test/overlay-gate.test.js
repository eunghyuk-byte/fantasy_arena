// v0.372 매치 연출 게이트: MATCH START·MY TURN·VICTORY·DEFEAT 중에는 드로우 모션·AI·결과 화면·입력이 기다림
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { loadGame, setup, place } = require("../test-support/harness.js");

const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

function loadSpellFx() {
  const noop = () => {};
  const els = {};
  const mkEl = () => ({ style: {}, setAttribute: noop, addEventListener: noop, classList: { toggle: noop, add: noop, remove: noop } });
  const document = {
    readyState: "loading", addEventListener: noop,
    getElementById: id => els[id] || null, querySelector: () => null, querySelectorAll: () => [],
    createElement: () => mkEl(),
    body: { appendChild: el => { els.fxInputBlock = el; }, classList: { toggle: noop } }
  };
  const ctx = { console, setTimeout, clearTimeout, Math, JSON, Promise, innerWidth: 1920, innerHeight: 1080, document, addEventListener: noop, requestAnimationFrame: noop };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read("js/spell-fx.js"), ctx, { filename: "spell-fx.js" });
  return { S: ctx.SpellFx, els, ctx };
}
const tick = (ms) => new Promise(r => setTimeout(r, ms || 0));

test("게이트: hold 중엔 대기, 풀리면 진행 · 연속 연출(MATCH START→MY TURN)은 사이가 비지 않음 · 입력 차단 레이어", async () => {
  const { S, els } = loadSpellFx();
  assert.equal(S.overlayBusy(), false);
  let idle = 0;
  const r1 = S.overlayHold();
  assert.equal(S.overlayBusy(), true);
  assert.equal(els.fxInputBlock.style.display, "block", "연출 중 입력 차단");
  S.whenOverlayIdle().then(() => idle++);
  // 첫 연출이 끝나는 같은 순간 다음 연출이 잡힘 → 대기 계속
  r1();
  const r2 = S.overlayHold();
  await tick(5);
  assert.equal(idle, 0, "이어지는 연출 동안 계속 대기");
  r2();
  await tick(5);
  assert.equal(idle, 1, "모든 연출이 끝나면 진행");
  assert.equal(els.fxInputBlock.style.display, "none", "입력 차단 해제");
  r2(); // 두 번 풀어도 카운트가 음수가 되지 않음
  assert.equal(S.overlayBusyCount(), 0);
  await S.whenOverlayIdle(); // 비어 있으면 바로
});

test("게이트: playMatch가 재생 동안 hold를 잡음 + 상한(7초)으로 영원히 잠기지 않음", () => {
  const src = read("js/spell-fx.js");
  assert.match(src, /const OVERLAY_HOLD_CAP_MS = 7000;/);
  assert.match(src, /document\.addEventListener\("keydown", \(e\) => \{ if \(_ovCount > 0\)/);
});

test("시작: MATCH START → MY TURN 이 잡힐 때까지 게이트 유지, 드로우 모션은 연출 뒤 · AI는 연출 뒤 시작", () => {
  const game = read("js/game.js");
  assert.match(game, /releaseIntro = SpellFx\.overlayHold\(\);[\s\S]*showGame\(\);\s*render\(\);/);
  assert.match(game, /playTurnStartFx\(first\);\s*releaseIntro\(\);/);
  const render = read("js/render.js");
  assert.match(render, /me\._drawHideN = n;[\s\S]*await SpellFx\.whenOverlayIdle\(\);[\s\S]*me\._drawHideN = 0;[\s\S]*await playDrawSequence\(n, drawPlaybackRate\);/);
  assert.match(render, /if \(\(me\._drawHideN \|\| 0\) > 0 && !dragging\)/);
});

test("AI 턴: 매치 연출 중이면 시작하지 않고, 연출이 끝나면 한 번만 시작", async () => {
  const g = loadGame();
  const { p1, p2 } = setup(g);
  p2.isAI = true;
  vm.runInContext("state.turn = 2; state.acting = state.p2; state.over = false;", g);
  let busy = true, waiters = [];
  g.SpellFx = { overlayBusy: () => busy, whenOverlayIdle: () => new Promise(r => waiters.push(r)) };
  vm.runInContext("SpellFx = window.SpellFx;", g);
  let steps = 0;
  g.__step = () => steps++;
  // runAutoCombat/passTurn 대신 카운트 (setTimeout은 harness에서 setImmediate)
  vm.runInContext("runAutoCombat = async function () { __step(); }; passTurn = function () {};", g);
  g.aiTurn(); g.aiTurn();
  await tick(5);
  assert.equal(steps, 0, "연출 중엔 AI 진행 없음");
  assert.equal(waiters.length, 1, "대기는 한 번만 등록");
  busy = false;
  waiters[0]();
  await tick(20);
  assert.equal(steps, 1, "연출이 끝난 뒤 AI 진행");
});

test("승리·패배: 다른 연출이 끝난 뒤 재생, 결과 화면 버튼은 연출이 끝난 뒤에만 (고정 3.2초 타임아웃 제거)", () => {
  const combat = read("js/combat.js");
  const fin = combat.slice(combat.indexOf("function finish(winner)"), combat.indexOf("function clearDrag()"));
  assert.match(fin, /releaseEnd = SpellFx\.overlayHold\(\);/);
  assert.match(fin, /await Promise\.race\(\[waitOthersIdle\(\), new Promise\(r => setTimeout\(r, 3500\)\)\]\);/);
  assert.match(fin, /fxP\.then\(showResult, showResult\);/);
  assert.doesNotMatch(fin, /setTimeout\(r, 3200\)/);
});

test("드로우 대기·모션 중 새 카드 숨김은 inline important (playable 카드의 opacity:1 !important 를 이김) · 끝나면 해제", () => {
  const fs = require("node:fs"), path = require("node:path");
  const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
  const render = R("js/render.js"), game = R("js/game.js");
  assert.match(render, /cardsNow\[i\]\.style\.setProperty\("opacity", "0", "important"\)/);
  const seq = game.slice(game.indexOf("async function playDrawSequence"), game.indexOf("function pickEnemyTribe"));
  assert.match(seq, /cards\[i\]\.style\.setProperty\("opacity", "0", "important"\)/);
  assert.match(seq, /el\.style\.removeProperty\("opacity"\)/);
});

test('clearing a stalled match metadata load releases its input hold immediately',async()=>{const {S,ctx,els}=loadSpellFx();ctx.fetch=()=>new Promise(()=>{});const p=S.playMatch('turn_start_me');await tick();assert.equal(S.overlayBusy(),true);S.clear();assert.equal(await p,false);await tick();assert.equal(S.overlayBusy(),false);assert.equal(els.fxInputBlock.style.display,'none');});
