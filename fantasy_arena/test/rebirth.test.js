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
const hasShield = (m) => String(m.ability || "").split(",").map(x => x.trim()).includes("보호") || (m.keywords || []).includes("shield");
const hasRebirth = (m) => String(m.ability || "").includes("환생") || (m.keywords || []).includes("rebirth") || !!(m._itemBonuses && m._itemBonuses.extraAbility === "환생");

const g = loadGame();

test("골드골렘(보호) + 소생초(환생): 보호 소모 → 사망 → 환생 시 보호 다시 있음, 환생 없음", () => {
  const { p1 } = setup(g);
  const m = place(g, p1, "l11");
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

test("골드골렘 보호 미소모 + 환생: 부활 후에도 보호 유지, 환생 없음", () => {
  const { p1 } = setup(g);
  const m = place(g, p1, "l11");
  g.equipItemOnUnit(p1, g.cloneCard("ei5"), m);
  m.hp = 0; m.dying = true; m._deathCtx = {};
  g.resolveDeath(p1, m);
  assert.ok(p1.board.includes(m));
  assert.ok(hasShield(m));
  assert.ok(!hasRebirth(m));
});

test("스펠로 능력이 환생으로 덮인 골드골렘: 부활 시 인쇄 능력 보호 복원", () => {
  const { p1 } = setup(g);
  const m = place(g, p1, "l11");
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

test("공격 능력(atkSkill) 인쇄 유닛 + 환생: 스펠로 바뀐 공격 능력 → 인쇄 공격 능력 복원, 버프는 제거", () => {
  const { p1 } = setup(g);
  const m = place(g, p1, "n6"); // 매사냥꾼 관통공격(2) (v0.358: 나무궁수는 관통 제거)
  g.equipItemOnUnit(p1, g.cloneCard("li1"), m);
  m.atkSkill = 4; // 스펠로 연속 부여
  m.atk += 2; // 버프
  const atkBefore = m.atk;
  kill(g, p1, m);
  assert.ok(p1.board.includes(m));
  assert.equal(m.atkSkill, 2);
  assert.ok(m.keywords.includes("pierce"));
  assert.equal(m.atk, g.cloneCard("n6").atk, "버프 제거 후 인쇄 공격력 복원");
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

test("환생 없는 골드골렘: 사망 시 제거 (변화 없음)", () => {
  const { p1 } = setup(g);
  const m = place(g, p1, "l11");
  g.damageMinion(p1, m, 1, {});
  kill(g, p1, m);
  assert.ok(!p1.board.includes(m));
});

// ---- v0.348 (9/29, 하스스톤 방식): 소환: 미발동 / 파괴: 첫 파괴·재파괴 모두 발동 ----

test("소환: 효과 카드(여령기) + 환생: 부활 시 소환 효과 미발동", () => {
  const { p1, p2 } = setup(g);
  const foe = place(g, p2, "l12");
  foe.ability = null; foe.keywords = []; // 보호 없는 적 (피해 확인용)
  const hpBefore = foe.hp;
  const m = place(g, p1, "f12");
  assert.ok(m.battlecry, "소환: 효과 있는 카드");
  g.equipItemOnUnit(p1, g.cloneCard("li1"), m);
  let bc = 0;
  const orig = g.resolveBattlecry, origPlay = g.resolvePlayAbility;
  g.resolveBattlecry = function () { bc++; return orig.apply(this, arguments); };
  g.resolvePlayAbility = function () { bc++; return origPlay.apply(this, arguments); };
  try {
    kill(g, p1, m);
  } finally { g.resolveBattlecry = orig; g.resolvePlayAbility = origPlay; }
  assert.ok(p1.board.includes(m), "환생함");
  assert.equal(bc, 0, "소환 처리 호출 없음");
  assert.equal(foe.hp, hpBefore, "적 전체 피해 1 미발동");
});

test("파괴: 효과 카드(대교, 소교 생성) + 환생: 첫 파괴 발동, 부활 후 재파괴 시 또 발동", () => {
  const { p1 } = setup(g);
  const m = place(g, p1, "a13");
  g.equipItemOnUnit(p1, g.cloneCard("li1"), m);
  const tokens = () => p1.board.filter(x => x.id === "a40").length;
  kill(g, p1, m);
  assert.ok(p1.board.includes(m), "환생함");
  assert.equal(tokens(), 1, "첫 파괴: 소교 생성");
  assert.ok(m.deathrattle, "파괴: 효과 남아 있음");
  kill(g, p1, m);
  assert.ok(!p1.board.includes(m), "두 번째는 제거");
  assert.equal(tokens(), 2, "재파괴: 소교 또 생성");
});

test("파괴: 효과 인쇄 환생 없는 카드(전위)는 기존대로 한 번 발동", () => {
  const { p1, p2 } = setup(g);
  const foe = place(g, p2, "e18"); foe.hp = 10; foe.maxHp = 10;
  const m = place(g, p1, "f29");
  kill(g, p1, m);
  assert.ok(!p1.board.includes(m));
  assert.equal(foe.hp, 10 - Math.max(0, 4 - (foe.def || 0)));
});

test("파괴: 드로우 1(유언) + 환생: 첫 파괴 드로우, 재파괴 드로우 또", () => {
  const { p1 } = setup(g);
  const m = place(g, p1, "e18");
  g.equipItemOnUnit(p1, g.cloneCard("li1"), m);
  const d0 = p1.deck.length;
  kill(g, p1, m);
  assert.ok(p1.board.includes(m));
  assert.equal(p1.deck.length, d0 - 1, "첫 파괴 드로우");
  kill(g, p1, m);
  assert.equal(p1.deck.length, d0 - 2, "재파괴 드로우");
});

test("파괴: 나를 파괴한 적을 탈취(조조) + 환생: 첫 파괴에 탈취 발동, 조조도 환생", () => {
  const { p1, p2 } = setup(g);
  const m = place(g, p1, "e23");
  g.equipItemOnUnit(p1, g.cloneCard("li1"), m);
  const killer = place(g, p2, "e18");
  g.damageMinion(p1, m, 99, { killer, killerOwner: p2, fromSpell: false });
  g.resolveDeath(p1, m);
  assert.ok(p1.board.includes(m), "조조 환생");
  assert.ok(p1.board.includes(killer), "죽인 적 탈취");
  assert.ok(!p2.board.includes(killer));
});

test("침묵된 골드골렘 + 소생초(환생): 부활 시 침묵 풀리고 보호 돌아옴, 환생 없음", () => {
  const { p1 } = setup(g);
  const m = place(g, p1, "l11");
  g.silenceMinion(m, p1);
  assert.ok(m.silenced && !hasShield(m));
  assert.ok(g.equipItemOnUnit(p1, g.cloneCard("li1"), m));
  kill(g, p1, m);
  assert.ok(p1.board.includes(m), "환생함");
  assert.ok(!m.silenced, "침묵 풀림");
  assert.ok(hasShield(m), "보호 돌아옴");
  assert.equal(m.text, "보호");
  assert.ok(!hasRebirth(m));
});

test("침묵된 대교 + 환생: 첫 파괴는 침묵 상태라 파괴: 미발동, 부활 후 파괴: 돌아와 재파괴 시 발동", () => {
  const { p1 } = setup(g);
  const m = place(g, p1, "a13");
  g.silenceMinion(m, p1);
  g.equipItemOnUnit(p1, g.cloneCard("li1"), m);
  const tokens = () => p1.board.filter(x => x.id === "a40").length;
  kill(g, p1, m);
  assert.ok(p1.board.includes(m));
  assert.equal(tokens(), 0);
  assert.ok(m.deathrattle);
  kill(g, p1, m);
  assert.equal(tokens(), 1);
});

// ---- v0.349 (9/29): 환생하는 유닛이 낀 아이템의 파괴: 효과 발동, 아이템 없이 환생 ----

test("적토마 장착 + 환생(피닉스): 여포 핸드 생성, 아이템 없이 부활", () => {
  const { p1 } = setup(g);
  const m = place(g, p1, "f26");
  assert.ok(g.equipItemOnUnit(p1, g.cloneCard("di7"), m));
  kill(g, p1, m);
  assert.ok(p1.board.includes(m), "환생함");
  assert.equal(m.hp, 1);
  assert.ok(!m.equippedItem && !m._itemFx, "아이템 없이 부활");
  assert.equal(p1.board.filter(x => x.id === "d40").length, 0, "적토마 토큰 생성 없음");
  assert.equal(p1.hand.filter(x => x.id === "d7").length, 1, "여포 핸드 생성");
  assert.ok(!hasRebirth(m));
  kill(g, p1, m); // 재파괴: 아이템 없으니 여포 추가 없음
  assert.ok(!p1.board.includes(m));
  assert.equal(p1.hand.filter(x => x.id === "d7").length, 1);
});

test("인어의하프 장착 + 환생(피닉스): 적 전체 공=0, 아이템 없이 부활", () => {
  const { p1, p2 } = setup(g);
  const f1 = place(g, p2, "f29"), f2 = place(g, p2, "e8");
  assert.ok(f1.atk > 0 && f2.atk > 0);
  const m = place(g, p1, "f26");
  assert.ok(g.equipItemOnUnit(p1, g.cloneCard("ai6"), m));
  kill(g, p1, m);
  assert.ok(p1.board.includes(m), "환생함");
  assert.ok(!m.equippedItem, "아이템 없이 부활");
  assert.equal(f1.atk, 0);
  assert.equal(f2.atk, 0);
});
