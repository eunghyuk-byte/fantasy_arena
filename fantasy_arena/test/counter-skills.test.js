// v0.374 규칙 확장(9/29 사용자 확정): 반격할 때도 공격 능력(특수 공격)이 공격할 때와 똑같이 발동한다.
// 예외: 광역공격 — 반격은 퍼지지 않고 공격한 유닛 하나만 일반 반격.
//       연속공격 — 공격한 유닛에게 두 번 반격. 첫 반격으로 처치하면 다음 유닛으로 이어지지 않음.
// A = 공격자(상대 턴, p2), D = 반격하는 내 유닛(p1).
const test = require("node:test");
const assert = require("node:assert");
const { loadGame, setup, place, vm } = require("../test-support/harness.js");

const g = loadGame();
const unit = (p, id, o) => {
  const m = place(g, p, id);
  m.atkC = 0; m.defC = 0; m.hpC = 0; m.keywords = []; m.ability = null; m.atkSkill = null;
  m._itemFx = null; m.equippedItem = null;
  Object.assign(m, o || {});
  if (o && o.hp != null && o.maxHp == null) m.maxHp = o.hp;
  return m;
};
const oppTurn = () => vm.runInContext("state.acting = state.p2; state.turn = 2;", g);
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(r => setImmediate(r)); };
async function attack(A, D, p1, p2) {
  oppTurn();
  await g.doAttack(p2, A, { kind: "minion", owner: p1, minion: D }, true);
  await settle();
}

test("관통 반격: 공격자의 영구 방어를 먼저 깎고 남는 피해가 체력으로", async () => {
  const { p1, p2 } = setup(g);
  const A = unit(p2, "e5", { atk: 1, def: 2, hp: 10 });
  const D = unit(p1, "e8", { atk: 3, def: 0, hp: 10, atkSkill: 2 });
  await attack(A, D, p1, p2);
  assert.equal(A.def, 0, "관통: 방어 2가 반격으로 깎여 0");
  assert.equal(A.hp, 9, "3 - 흡수 2 = 체력 피해 1");
});

test("돌진 반격: 내 방어만큼 추가 피해", async () => {
  const { p1, p2 } = setup(g);
  const A = unit(p2, "e5", { atk: 1, def: 0, hp: 10 });
  const D = unit(p1, "e8", { atk: 2, def: 3, hp: 10, atkSkill: 3 });
  await attack(A, D, p1, p2);
  assert.equal(A.hp, 5, "반격 2 + 방어 3 = 5");
});

test("연속 반격: 공격한 유닛에게 두 번 반격", async () => {
  const { p1, p2 } = setup(g);
  const A = unit(p2, "e5", { atk: 1, def: 0, hp: 10 });
  const D = unit(p1, "e8", { atk: 2, def: 0, hp: 10, atkSkill: 4 });
  await attack(A, D, p1, p2);
  assert.equal(A.hp, 6, "2 + 2");
});

test("연속 반격: 첫 반격으로 처치하면 다음 유닛·영웅으로 이어지지 않음", async () => {
  const { p1, p2 } = setup(g);
  const A = unit(p2, "e5", { atk: 1, def: 0, hp: 3 });
  const B = unit(p2, "e9", { atk: 1, def: 0, hp: 10 });
  const D = unit(p1, "e8", { atk: 3, def: 0, hp: 10, atkSkill: 4 });
  await attack(A, D, p1, p2);
  assert.ok(!p2.board.includes(A), "첫 반격 3으로 처치");
  assert.equal(B.hp, 10, "옆 유닛은 반격 피해 없음");
  assert.equal(p2.hp, 30, "상대 영웅도 피해 없음");
  assert.equal(D.hp, 9);
});

test("흡혈 반격: 준 체력 피해만큼 회복", async () => {
  const { p1, p2 } = setup(g);
  const A = unit(p2, "e5", { atk: 1, def: 0, hp: 10 });
  const D = unit(p1, "e8", { atk: 3, def: 0, hp: 5, maxHp: 10, atkSkill: 6 });
  await attack(A, D, p1, p2);
  assert.equal(A.hp, 7);
  assert.equal(D.hp, 7, "5 - 1(피격) + 3(흡혈)");
});

test("흡혈 반격: 준 체력 피해까지만 (보호막에 막히면 회복 없음)", async () => {
  const { p1, p2 } = setup(g);
  const A = unit(p2, "e5", { atk: 1, def: 0, hp: 10, keywords: ["shield"] });
  const D = unit(p1, "e8", { atk: 3, def: 0, hp: 5, maxHp: 10, atkSkill: 6 });
  await attack(A, D, p1, p2);
  assert.equal(A.hp, 10, "보호막이 반격을 막음");
  assert.equal(D.hp, 4, "체력 피해 0 → 흡혈 0");
});

test("약화 반격: 반격 전에 공격자 공·방 -1 (그 반격부터 적용)", async () => {
  const { p1, p2 } = setup(g);
  const A = unit(p2, "e5", { atk: 2, def: 1, hp: 10 });
  const D = unit(p1, "e8", { atk: 3, def: 0, hp: 10, atkSkill: 7 });
  await attack(A, D, p1, p2);
  assert.equal(A.atk, 1); assert.equal(A.def, 0);
  assert.equal(A.hp, 7, "방어 1→0 이 된 뒤 반격 3");
});

test("약화 반격: 연속공격자의 2타는 낮아진 공격으로", async () => {
  const { p1, p2 } = setup(g);
  const A = unit(p2, "e5", { atk: 3, def: 0, hp: 10, atkSkill: 4 });
  const D = unit(p1, "e8", { atk: 1, def: 0, hp: 20, atkSkill: 7 });
  await attack(A, D, p1, p2);
  assert.equal(D.hp, 20 - 3 - 2, "1타 3 · 약화 후 2타 2");
  assert.equal(A.atk, 1, "반격마다 약화 (두 번)");
});

test("석화 반격: 반격 전에 공격자 공=0 · 방+1", async () => {
  const { p1, p2 } = setup(g);
  const A = unit(p2, "e5", { atk: 3, def: 0, hp: 10 });
  const D = unit(p1, "e8", { atk: 2, def: 0, hp: 10, atkSkill: 8 });
  await attack(A, D, p1, p2);
  assert.equal(A.atk, 0); assert.equal(A.def, 1);
  assert.equal(A.hp, 9, "방어 1 이 된 뒤 반격 2 → 1");
  assert.equal(D.hp, 7);
});

test("석화 반격: 연속공격자의 2타는 공격 0", async () => {
  const { p1, p2 } = setup(g);
  const A = unit(p2, "e5", { atk: 3, def: 0, hp: 10, atkSkill: 4 });
  const D = unit(p1, "e8", { atk: 2, def: 0, hp: 20, atkSkill: 8 });
  await attack(A, D, p1, p2);
  assert.equal(D.hp, 17, "1타 3 · 석화 후 2타 0");
});

test("광역 반격: 퍼지지 않고 공격한 유닛에게만 일반 반격", async () => {
  const { p1, p2 } = setup(g);
  const A = unit(p2, "e5", { atk: 1, def: 0, hp: 10 });
  const B = unit(p2, "e9", { atk: 1, def: 0, hp: 10 });
  const D = unit(p1, "e8", { atk: 2, def: 0, hp: 10, atkSkill: 9 });
  await attack(A, D, p1, p2);
  assert.equal(A.hp, 8);
  assert.equal(B.hp, 10, "옆 유닛은 피해 없음");
  assert.equal(p2.hp, 30);
});

test("광역 공격은 여전히 반격을 받지 않음", async () => {
  const { p1, p2 } = setup(g);
  const A = unit(p2, "e5", { atk: 1, def: 0, hp: 10, atkSkill: 9 });
  unit(p1, "e8", { atk: 5, def: 0, hp: 10, atkSkill: 5 });
  await attack(A, p1.board[0], p1, p2);
  assert.equal(A.hp, 10);
});

test("일반 반격 · 치명 반격은 그대로", async () => {
  let s = setup(g);
  let A = unit(s.p2, "e5", { atk: 1, def: 1, hp: 10 });
  let D = unit(s.p1, "e8", { atk: 3, def: 0, hp: 10 });
  await attack(A, D, s.p1, s.p2);
  assert.equal(A.hp, 8, "3 - 방어 1");
  s = setup(g);
  A = unit(s.p2, "e5", { atk: 1, def: 0, hp: 10 });
  D = unit(s.p1, "e8", { atk: 1, def: 0, hp: 10, atkSkill: 5 });
  await attack(A, D, s.p1, s.p2);
  assert.ok(!s.p2.board.includes(A), "치명 반격 즉사");
});

test("연속 반격: 보호막이 1타를 막아도 2타는 적중", async () => {
  const { p1, p2 } = setup(g);
  const A = unit(p2, "e5", { atk: 1, def: 0, hp: 10, keywords: ["shield"] });
  const D = unit(p1, "e8", { atk: 2, def: 0, hp: 10, atkSkill: 4 });
  await attack(A, D, p1, p2);
  assert.equal(A.hp, 8, "1타는 보호막이 막고 2타 2 적중");
});

test("도움말·규칙 문서: 반격도 공격 능력 발동 (옛 「기본 피해만」 문구 없음)", () => {
  const fs = require("node:fs"), path = require("node:path");
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.doesNotMatch(html, /반격은 능력 없이 기본 피해만/);
  assert.match(html, /<b>반격<\/b> — 반격할 때도 공격 능력이 공격할 때와 똑같이 발동합니다/);
  const H = vm.runInContext("ATK_SKILL_HELP", g);
  assert.match(H[4][1], /반격도 두 번.*반격으로 처치하면 이어지지 않습니다/);
  assert.match(H[9][1], /반격할 때는 퍼지지 않고 공격한 유닛에게만/);
  const lock = fs.readFileSync(path.join(__dirname, "..", "BALANCE_RULES_LOCK.md"), "utf8");
  assert.match(lock, /반격 = 공격 능력 그대로 \(9\/29 v0\.374/);
  assert.doesNotMatch(lock, /반격은 모든 유닛이 능력 없이/);
});
