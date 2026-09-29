// v0.353 흡혈공격 확정 규칙: 준 체력 피해만큼 회복 (최대 체력까지) — 옛 「절반(올림)」 회귀 방지
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { loadGame, setup, place, vm } = require("../test-support/harness.js");

const g = loadGame();
const plain = (p, id, hp) => { const m = place(g, p, id); m.ability = null; m.keywords = []; m.atkC = 0; m.defC = 0; m.hpC = 0; m.def = 0; m.hp = hp; m.maxHp = hp; return m; };

test("applyLifesteal: 준 체력 피해 전부 회복, 최대 체력 넘지 않음", () => {
  const a = { name: "a", hp: 2, maxHp: 10 };
  assert.equal(g.applyLifesteal(a, 5), 5);
  assert.equal(a.hp, 7);
  assert.equal(g.applyLifesteal(a, 1), 1, "홀수 1도 1 회복 (절반 아님)");
  assert.equal(a.hp, 8);
  assert.equal(g.applyLifesteal(a, 9), 2, "최대 체력 10에서 멈춤");
  assert.equal(a.hp, 10);
  assert.equal(g.applyLifesteal({ name: "d", hp: 3, maxHp: 9, dying: true }, 4), 0, "죽는 중이면 회복 없음");
  assert.equal(g.applyLifesteal(a, 0), 0);
});

test("전투: 흡혈 유닛이 유닛에게 준 체력 피해 4 → 체력 4 회복", async () => {
  const { p1, p2 } = setup(g);
  const atk = plain(p1, "l12", 10); atk.atk = 4; atk.atkSkill = 6; atk.hp = 3;
  const foe = plain(p2, "l12", 9); foe.atk = 0;
  await g.doAttack(p1, atk, { kind: "minion", owner: p2, minion: foe }, false);
  assert.equal(9 - foe.hp, 4, "준 체력 피해 4");
  assert.equal(atk.hp, 3 + 4, "회복 4 (옛 규칙이면 2)");
});

test("전투: 흡혈 유닛이 영웅에게 준 피해 5 → 체력 5 회복", async () => {
  const { p1, p2 } = setup(g);
  const atk = plain(p1, "l12", 10); atk.atk = 5; atk.atkSkill = 6; atk.hp = 4;
  const hp0 = p2.hp;
  await g.doAttack(p1, atk, { kind: "hero", owner: p2 }, false);
  assert.equal(hp0 - p2.hp, 5);
  assert.equal(atk.hp, 9);
});

test("툴팁·도움말 문구: 준 체력 피해만큼 회복 (절반 문구 없음)", () => {
  const help = vm.runInContext("ATK_SKILL_HELP[6]", g);
  assert.equal(help[0], "흡혈공격");
  assert.equal(help[1], "준 체력 피해만큼 체력을 회복합니다.");
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /<b>흡혈공격<\/b> — 준 체력 피해만큼 체력을 회복합니다\./);
  assert.doesNotMatch(html, /흡혈[^<]*절반/);
});
