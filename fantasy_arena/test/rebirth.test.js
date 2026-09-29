// 환생 규칙 테스트 (9/29 v0.347): 환생으로 다시 나타날 때 카드 기본 능력은 그대로, 환생만 사라진다.
// 실행: node --test fantasy_arena/test/
const test = require("node:test");
const assert = require("node:assert");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

function loadGame() {
  const noop = () => {};
  const el = () => ({ prepend: noop, children: [], lastChild: { remove: noop }, appendChild: noop, classList: { add: noop, remove: noop, toggle: noop }, style: {}, addEventListener: noop, setAttribute: noop });
  const proxy = new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => "" : proxy, apply: () => proxy, construct: () => proxy });
  const document = new Proxy({}, { get: (t, k) => (k === "getElementById" || k === "createElement" || k === "querySelector") ? () => el() : proxy });
  const ctx = { console: { log: noop, warn: noop, error: console.error }, setTimeout, clearTimeout, Math, JSON, Date };
  ctx.window = ctx; ctx.document = document;
  ctx.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
  ctx.addEventListener = noop; ctx.requestAnimationFrame = noop;
  vm.createContext(ctx);
  const root = path.join(__dirname, "..");
  for (const f of ["js/cards-data.js", "js/combat.js", "js/game.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
  }
  return ctx;
}

function setup(g) {
  const mk = (name) => ({ name, hp: 30, board: [], hand: [], deck: ["l12", "l12", "l12"], fatigue: 0, hero: { id: "light" } });
  const p1 = mk("P1"), p2 = mk("P2");
  vm.runInContext("state = {}", g);
  g.__s = { p1, p2, turn: 1, turnSerial: 1 };
  vm.runInContext("state = __s", g);
  return { p1, p2 };
}
function place(g, p, id) {
  const m = g.cloneCard(id);
  p.board.push(m);
  return m;
}
function kill(g, owner, m) {
  g.damageMinion(owner, m, 99, {});
  if (m.dying) g.resolveDeath(owner, m);
}
const hasShield = (m) => m.ability === "보호" || (m.keywords || []).includes("shield");
const hasRebirth = (m) => String(m.ability || "").includes("환생") || (m.keywords || []).includes("rebirth") || !!(m._itemBonuses && m._itemBonuses.extraAbility === "환생");

const g = loadGame();

test("성기사(보호) + 소생초(환생): 보호 소모 → 사망 → 환생 시 보호 다시 있음, 환생 없음", () => {
  const { p1 } = setup(g);
  const m = place(g, p1, "l12");
  assert.equal(m.ability, "보호");
  assert.ok(g.equipItemOnUnit(p1, g.cloneCard("li1"), m));
  assert.ok(hasRebirth(m));
  g.damageMinion(p1, m, 1, {}); // 보호 소모
  assert.ok(!hasShield(m), "보호 소모됨");
  kill(g, p1, m);
  assert.ok(p1.board.includes(m), "환생으로 살아남");
  assert.equal(m.hp, 1);
  assert.ok(hasShield(m), "보호 다시 생김");
  assert.ok(!hasRebirth(m), "환생 사라짐");
  assert.ok(!m.equippedItem, "아이템 해제 (기존 규칙)");
  // 다시 보호가 실제로 작동: 첫 피해는 막힘
  g.damageMinion(p1, m, 3, {});
  assert.equal(m.hp, 1);
  assert.ok(!m.dying);
  // 두 번째 사망은 진짜 사망 (환생 1회)
  kill(g, p1, m);
  assert.ok(!p1.board.includes(m), "두 번째 사망은 제거");
});

test("성기사 보호 미소모 + 환생: 부활 후에도 보호 유지, 환생 없음", () => {
  const { p1 } = setup(g);
  const m = place(g, p1, "l12");
  g.equipItemOnUnit(p1, g.cloneCard("ei5"), m);
  m.hp = 0; m.dying = true; m._deathCtx = {};
  g.resolveDeath(p1, m);
  assert.ok(p1.board.includes(m));
  assert.ok(hasShield(m));
  assert.ok(!hasRebirth(m));
});

test("스펠로 능력이 환생으로 덮인 성기사: 부활 시 인쇄 능력 보호 복원", () => {
  const { p1 } = setup(g);
  const m = place(g, p1, "l12");
  m.ability = "환생"; m.keywords.push("rebirth"); // 스펠 부여 (fx.ability 덮어쓰기)
  kill(g, p1, m);
  assert.ok(p1.board.includes(m));
  assert.equal(m.ability, "보호");
  assert.ok(!hasRebirth(m));
});

test("인쇄 환생 유닛(피닉스): 부활 후 환생 없음, 문구에서도 환생 제거, 두 번째 사망은 제거", () => {
  const { p1 } = setup(g);
  const m = place(g, p1, "f26");
  kill(g, p1, m);
  assert.ok(p1.board.includes(m));
  assert.equal(m.hp, 1);
  assert.ok(!hasRebirth(m));
  assert.ok(!String(m.text || "").includes("환생"));
  kill(g, p1, m);
  assert.ok(!p1.board.includes(m));
});

test("공격 능력(atkSkill) 인쇄 유닛 + 환생: 스펠로 바뀐 공격 능력 → 인쇄 공격 능력 복원, 버프는 기존 규칙대로 유지", () => {
  const { p1 } = setup(g);
  const m = place(g, p1, "e8"); // 나무궁수 관통공격(2)
  g.equipItemOnUnit(p1, g.cloneCard("li1"), m);
  m.atkSkill = 4; // 스펠로 연속 부여
  m.atk += 2; // 버프
  const atkBefore = m.atk;
  kill(g, p1, m);
  assert.ok(p1.board.includes(m));
  assert.equal(m.atkSkill, 2);
  assert.ok(m.keywords.includes("pierce"));
  assert.equal(m.atk, atkBefore, "버프(공격력)는 기존 환생 규칙대로 유지");
  assert.ok(!hasRebirth(m));
});

test("면역 인쇄 유닛 + 환생 아이템: 부활 후 면역 유지, 환생 없음", () => {
  const immune = vm.runInContext("CARDS", g).find(c => c.type === "minion" && c.ability === "면역");
  assert.ok(immune, "면역 인쇄 유닛 존재");
  const { p1 } = setup(g);
  const m = place(g, p1, immune.id);
  g.equipItemOnUnit(p1, g.cloneCard("fi4"), m);
  m.hp = 0; m.dying = true; m._deathCtx = {};
  g.resolveDeath(p1, m);
  assert.ok(p1.board.includes(m));
  assert.equal(m.ability, "면역");
  assert.ok(!hasRebirth(m));
});

test("환생 없는 성기사: 사망 시 제거 (변화 없음)", () => {
  const { p1 } = setup(g);
  const m = place(g, p1, "l12");
  g.damageMinion(p1, m, 1, {});
  kill(g, p1, m);
  assert.ok(!p1.board.includes(m));
});
