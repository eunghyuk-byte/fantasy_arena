// v0.379 (9/29 사용자): 연속공격 1타로 환생 유닛을 처치하면 바로 환생하고, 2타는 뒤 유닛이 아니라 다시 나타난 그 유닛을 때린다.
const test = require("node:test");
const assert = require("node:assert");
const { loadGame, setup, place, vm } = require("../test-support/harness.js");

const g = loadGame();
const unit = (p, id, o) => {
  const m = place(g, p, id);
  m.atkC = 0; m.defC = 0; m.hpC = 0; m.keywords = []; m.ability = null; m.atkSkill = null;
  m._itemFx = null; m.equippedItem = null; m.deathrattle = null; m.deathrattles = null;
  Object.assign(m, o || {});
  if (o && o.hp != null && o.maxHp == null) m.maxHp = o.hp;
  return m;
};
const myTurn = () => vm.runInContext("state.acting = state.p1; state.turn = 1;", g);
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(r => setImmediate(r)); };

test("연속 1타로 환생 유닛 처치 → 2타는 환생한 그 유닛에게", async () => {
  const { p1, p2 } = setup(g);
  const A = unit(p1, "e8", { atk: 5, def: 0, hp: 10, atkSkill: 4 });
  const R = unit(p2, "e5", { atk: 1, def: 0, hp: 3, ability: "환생" });
  const B = unit(p2, "e9", { atk: 1, def: 0, hp: 10 });
  myTurn();
  await g.doAttack(p1, A, { kind: "minion", owner: p2, minion: R }, true);
  await settle();
  assert.equal(B.hp, 10, "뒤 유닛은 맞지 않음");
  assert.ok(!p2.board.includes(R), "환생한 유닛이 2타에 다시 처치됨");
  assert.equal(p2.hp, 30, "영웅 피해 없음");
});

test("환생+보호 유닛: 1타는 보호, 2타 처치 — 뒤 유닛은 안 맞음", async () => {
  const { p1, p2 } = setup(g);
  const A = unit(p1, "e8", { atk: 3, def: 0, hp: 10, atkSkill: 4 });
  const R = unit(p2, "e5", { atk: 2, def: 0, hp: 3, ability: "환생,보호" });
  const B = unit(p2, "e9", { atk: 1, def: 0, hp: 10 });
  myTurn();
  await g.doAttack(p1, A, { kind: "minion", owner: p2, minion: R }, true);
  await settle();
  assert.equal(B.hp, 10, "뒤 유닛은 맞지 않음");
});
