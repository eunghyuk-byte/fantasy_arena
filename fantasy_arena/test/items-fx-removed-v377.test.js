// v0.377: 아이템 연출(assets/vfx/items 10종 · item_hover · item_equip · 상단 문구 · equip-glow 루프) 전부 삭제.
// 장착 규칙·대상 판정은 그대로, 드래그 대상 표시는 스펠 타겟 글로우(spell-glow)와 같다.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { loadGame, setup, place } = require("../test-support/harness.js");

const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");

test("v0.377 assets/vfx/items 폴더·manifest 항목 없음", () => {
  assert.ok(!fs.existsSync(path.join(root, "assets/vfx/items")));
  const man = JSON.parse(read("assets/manifest.json"));
  const s = JSON.stringify(man);
  assert.ok(!s.includes("vfx/items/"), "manifest 에 vfx/items 참조 남음");
});

test("v0.377 코드·CSS 에 아이템 연출 참조 없음", () => {
  for (const f of ["js/spell-fx.js", "js/game.js", "js/render.js", "js/vfx.js", "js/combat.js", "index.html"]) {
    const s = read(f);
    for (const bad of ["playItem(", "\"item_hover\"", "\"item_equip\"", "vfx/items"]) {
      assert.ok(!s.includes(bad), `${f} 에 ${bad} 남음`);
    }
  }
  const css = read("css/game.css");
  assert.ok(!/\.equip-glow\s*[{:,]/.test(css), "equip-glow 규칙 남음");
  assert.ok(!/equipSparkle|equipPulse/.test(css));
});

test("v0.377 장착 규칙 유지 — 장착·스탯 보너스·유닛당 1개", () => {
  const g = loadGame();
  const { p1 } = setup(g);
  const m = place(g, p1, "e8");
  const def0 = m.def, hp0 = m.hp;
  const it = g.cloneCard("ai4");
  p1.hand.push(it);
  const r = g.playCard(p1, it, { kind: "minion", owner: p1, minion: m });
  assert.notStrictEqual(r, false);
  assert.ok(m.equippedItem, "장착 안 됨");
  assert.ok(m.def >= def0 + 2 && m.hp >= hp0 + 4, "스탯 보너스 없음");
  const soul = p1.soul;
  const it2 = g.cloneCard("ai4");
  p1.hand.push(it2);
  assert.strictEqual(g.playCard(p1, it2, { kind: "minion", owner: p1, minion: m }), false);
  assert.strictEqual(p1.soul, soul, "거절 시 소울 차감");
  assert.ok(p1.hand.includes(it2));
});

function fakeEl(uid, rect) {
  const cls = new Set(["minion"]);
  return {
    uid,
    classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c) },
    has: c => cls.has(c),
    getAttribute: k => (k === "data-uid" ? uid : null),
    getBoundingClientRect: () => ({ left: rect[0], top: rect[1], right: rect[0] + rect[2], bottom: rect[1] + rect[3], width: rect[2], height: rect[3] }),
  };
}

test("v0.377 아이템 드래그 대상 = spell-glow (장착된 유닛은 글로우 없음)", () => {
  const g = loadGame();
  const { p1 } = setup(g);
  const a = place(g, p1, "e8");
  const b = place(g, p1, "e17");
  b.equippedItem = g.cloneCard("ai4");
  const els = [fakeEl(a.uid, [100, 600, 200, 300]), fakeEl(b.uid, [320, 600, 200, 300])];
  const board = {
    querySelectorAll: sel => (/\.minion/.test(sel) ? els.slice() : []),
  };
  g.document = {
    getElementById: id => (id === "myBoard" ? board : null),
    querySelector: sel => { const m = /data-uid="([^"]+)"/.exec(sel); return m ? els.find(e => e.uid === m[1]) || null : null; },
    querySelectorAll: sel => (/spell-glow|equip-glow/.test(sel) ? els.filter(e => e.has("spell-glow") || e.has("equip-glow")) : []),
  };
  g.highlightEquipHover(150, 700, true);
  assert.ok(els[0].has("spell-glow"));
  assert.ok(!els[0].has("equip-glow"));
  g.highlightEquipHover(400, 700, true);
  assert.ok(!els[0].has("spell-glow"), "이전 대상 글로우 안 지워짐");
  assert.ok(!els[1].has("spell-glow"), "이미 장착한 유닛에 글로우");
  g.highlightEquipHover(150, 700, false);
  assert.ok(!els.some(e => e.has("spell-glow")));
});
