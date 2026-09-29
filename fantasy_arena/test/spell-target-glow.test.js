// v0.372: 아군·적 모두 대상 가능한 단일 대상 스펠(화염구 fs3)을 드래그할 때
// 가리키는 유효 대상이 아군이어도 글로우가 붙고(spell-glow), 유효 대상 전체에 은은한 글로우(spell-valid)가 붙어야 함.
// 옛 버그: 공격 가능한 아군 유닛은 `.minion.can-attack` filter 가 spell-glow filter 를 덮어써서 아군만 변화가 없었다.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { loadGame, setup, place, vm } = require("../test-support/harness.js");

const g = loadGame();

function fakeEl(uid, side, rect) {
  const cls = new Set(["minion"]);
  return {
    side, uid,
    classList: {
      add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c),
      toggle: (c, on) => { if (on === undefined ? !cls.has(c) : on) cls.add(c); else cls.delete(c); },
    },
    has: c => cls.has(c),
    getAttribute: k => (k === "data-uid" ? uid : null),
    getBoundingClientRect: () => ({ left: rect[0], top: rect[1], right: rect[0] + rect[2], bottom: rect[1] + rect[3], width: rect[2], height: rect[3] }),
  };
}
function installDom(els) {
  const noop = () => {};
  g.document = {
    body: { classList: { add: noop, remove: noop, toggle: noop, contains: () => false } },
    getElementById: () => null,
    querySelector(sel) {
      const m = /data-uid="([^"]+)"/.exec(sel);
      if (m) return els.find(e => e.uid === m[1]) || null;
      return null;
    },
    querySelectorAll(sel) {
      if (sel === ".minion.spell-valid") return els.filter(e => e.has("spell-valid"));
      if (/spell-glow|equip-glow/.test(sel)) return els.filter(e => e.has("spell-glow") || e.has("equip-glow"));
      if (/#myBoard \.minion/.test(sel)) return els.slice();
      return [];
    },
  };
}

function scene() {
  const { p1, p2 } = setup(g);
  const ally = place(g, p1, "e8");
  const ally2 = place(g, p1, "e17");
  const foe = place(g, p2, "e9");
  // 아군은 공격 가능 상태(can-attack) — 옛 버그 재현 조건
  [ally, ally2].forEach(m => { m.canAttack = true; m.attacksLeft = 1; });
  const els = [
    fakeEl(ally.uid, "me", [100, 600, 200, 300]),
    fakeEl(ally2.uid, "me", [320, 600, 200, 300]),
    fakeEl(foe.uid, "opp", [100, 150, 200, 300]),
  ];
  installDom(els);
  const fs3 = g.cloneCard("fs3");
  return { p1, p2, ally, ally2, foe, els, fs3 };
}

test("화염구(fs3)는 아군·적 유닛 모두 유효 대상", () => {
  const { p1, ally, ally2, foe, fs3 } = scene();
  assert.equal(fs3.spell.target, "any_minion");
  const uids = g.validTargets(p1, fs3.spell).map(t => t.minion.uid);
  for (const m of [ally, ally2, foe]) assert.ok(uids.includes(m.uid), "유효 대상에 " + m.name + " 포함");
  const drag = g.spellDragTargets(fs3).map(t => t.minion.uid);
  assert.deepStrictEqual(drag.sort(), uids.sort());
});

test("드래그로 아군 유닛 위를 가리키면 아군에 spell-glow (적에는 없음) · 유효 대상 전체 spell-valid", () => {
  const { fs3, els } = scene();
  const [allyEl, ally2El, foeEl] = els;
  g.highlightSpellHover(200, 750, g.spellDragTargets(fs3));
  assert.ok(allyEl.has("spell-glow"), "가리킨 아군 유닛이 빛나야 함");
  assert.ok(!foeEl.has("spell-glow") && !ally2El.has("spell-glow"), "가리키지 않은 유닛은 강한 글로우 없음");
  for (const e of els) assert.ok(e.has("spell-valid"), e.side + " 유효 대상 은은한 글로우");
});

test("적 유닛 위를 가리키면 적에 spell-glow · 다시 아군으로 옮기면 아군으로 이동", () => {
  const { fs3, els } = scene();
  const [allyEl, , foeEl] = els;
  const targets = g.spellDragTargets(fs3);
  g.highlightSpellHover(200, 300, targets);
  assert.ok(foeEl.has("spell-glow") && !allyEl.has("spell-glow"));
  g.highlightSpellHover(200, 750, targets);
  assert.ok(allyEl.has("spell-glow") && !foeEl.has("spell-glow"));
});

test("드래그 종료(clearDrag) 시 spell-glow·spell-valid 모두 제거", () => {
  const { fs3, els } = scene();
  g.highlightSpellHover(200, 750, g.spellDragTargets(fs3));
  vm.runInContext("clearDrag()", g);
  for (const e of els) assert.ok(!e.has("spell-glow") && !e.has("spell-valid"));
});

test("CSS: 대상 글로우는 전장 유닛 리셋·can-attack 보다 강한 선택자 + filter 애니메이션(아군도 보임)", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "css/game.css"), "utf8");
  const i = css.indexOf("v0.372: 스펠 대상 글로우");
  assert.ok(i > 0, "v0.372 글로우 블록 존재");
  const block = css.slice(i, i + 6000);
  // `#game.active .board .slot .minion { outline/box-shadow:none!important }` 보다 구체적인 선택자
  assert.match(block, /#game\.active \.board \.slot \.minion\.spell-glow \{[^}]*animation:\s*spellHoverBreath/);
  assert.match(block, /#game\.active \.board \.slot \.minion\.spell-valid,\s*#game\.active \.board \.slot \.minion\.can-target \{[^}]*animation:\s*spellValidBreath/);
  // 애니메이션 filter 는 can-attack 의 일반 filter 선언을 이김 → filter 에 !important 를 쓰면 안 됨(애니메이션을 막음)
  const kf = /@keyframes spellHoverBreath \{([\s\S]*?)\n\}/.exec(block);
  assert.ok(kf && /drop-shadow/.test(kf[1]), "강한 drop-shadow 맥동");
  assert.ok(!/spell-glow \{[^}]*filter:[^;]*!important/.test(block), "spell-glow filter !important 금지");
  // 테두리는 overflow:hidden 안쪽 ::after 링(inset)으로 — 바깥 box-shadow 는 잘림
  assert.match(block, /\.minion\.spell-glow::after \{[^}]*inset 0 0 0 4px/);
  // 대상 위에서 드래그 카드 반투명
  assert.match(css, /\.drag-ghost\.over-target \{[^}]*opacity/);
});
