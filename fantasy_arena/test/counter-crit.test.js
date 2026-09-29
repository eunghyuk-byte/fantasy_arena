// v0.372 버그 수정: 치명공격 유닛이 반격으로 체력 피해를 1 이상 주면 공격한 적이 즉사해야 함
// (옛: 반격은 치명 판정 없이 기본 피해만 → 피해만 들어가고 살아남음)
const test = require("node:test");
const assert = require("node:assert");
const { loadGame, setup, place, card, vm } = require("../test-support/harness.js");

const g = loadGame();
const plain = (p, id, o) => {
  const m = place(g, p, id);
  m.atkC = 0; m.defC = 0; m.hpC = 0; m.keywords = [];
  if (id !== "n16") m.ability = null;
  Object.assign(m, o || {});
  if (o && o.hp) m.maxHp = o.hp;
  return m;
};
const oppTurn = () => vm.runInContext("state.acting = state.p2; state.turn = 2;", g);
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(r => setImmediate(r)); };

test("반격 치명: 가루다(치명 2/0/3)가 체력 4인 적의 공격에 반격 → 적 즉사", async () => {
  const { p1, p2 } = setup(g);
  const foe = plain(p2, "e5", { atk: 1, def: 0, hp: 4, atkSkill: null });
  const mine = plain(p1, "n16");
  assert.equal(mine.atkSkill, 5);
  oppTurn();
  await g.doAttack(p2, foe, { kind: "minion", owner: p1, minion: mine }, true);
  await settle();
  assert.ok(!p2.board.includes(foe), "치명 반격(피해 2 ≥ 1)으로 즉사 → 전장에서 제거");
  assert.ok(p1.board.includes(mine) && mine.hp === 2, "가루다는 1 피해만 받고 생존");
});

test("반격 치명: 방어로 반격 피해가 0이면 즉사 없음 · 보호막은 한 번 막음", async () => {
  let s = setup(g);
  const tank = plain(s.p2, "e5", { atk: 1, def: 3, hp: 4, atkSkill: null });
  plain(s.p1, "n16");
  oppTurn();
  await g.doAttack(s.p2, tank, { kind: "minion", owner: s.p1, minion: s.p1.board[0] }, true);
  await settle();
  assert.ok(s.p2.board.includes(tank) && tank.hp === 4, "반격 2 - 방어 3 = 0 → 체력 피해 없음 → 생존");

  s = setup(g);
  const sh = plain(s.p2, "e5", { atk: 1, def: 0, hp: 4, atkSkill: null, keywords: ["shield"] });
  plain(s.p1, "n16");
  oppTurn();
  await g.doAttack(s.p2, sh, { kind: "minion", owner: s.p1, minion: s.p1.board[0] }, true);
  await settle();
  assert.ok(s.p2.board.includes(sh) && sh.hp === 4 && !(sh.keywords || []).includes("shield"), "보호막이 반격을 막고 생존 (공격 치명과 같은 규칙)");
});

test("반격 일반: 치명 없는 유닛의 반격은 기본 피해만 (살아남음)", async () => {
  const { p1, p2 } = setup(g);
  const foe = plain(p2, "e5", { atk: 1, def: 0, hp: 4, atkSkill: null });
  const mine = plain(p1, "e8", { atk: 2, def: 0, hp: 3, atkSkill: null });
  oppTurn();
  await g.doAttack(p2, foe, { kind: "minion", owner: p1, minion: mine }, true);
  await settle();
  assert.ok(p2.board.includes(foe) && foe.hp === 2, "기본 반격 피해 2 → 체력 2로 생존");
});

test("공격 치명은 그대로: 내 턴 가루다 공격 → 체력 피해 1 이상이면 즉사", async () => {
  const { p1, p2 } = setup(g);
  const mine = plain(p1, "n16");
  const foe = plain(p2, "e5", { atk: 1, def: 0, hp: 9, atkSkill: null });
  vm.runInContext("state.acting = state.p1; state.turn = 1;", g);
  await g.doAttack(p1, mine, { kind: "minion", owner: p2, minion: foe }, true);
  await settle();
  assert.ok(!p2.board.includes(foe));
});
