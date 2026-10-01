// v0.350 (9/29) 사용자 지정 스펠·아이템 수정 + 아이템 장착 대상(아군만) 확인
const test = require("node:test");
const assert = require("node:assert");
const { loadGame, setup, place, card, vm } = require("../test-support/harness.js");

const g = loadGame();
const inst = (name) => g.cloneCard(card(g, name).id);
const tick = () => new Promise(r => setImmediate(r));
const plain = (p, id, hp) => { const m = place(g, p, id); m.ability = null; m.keywords = []; m.atkC = 0; m.defC = 0; m.hpC = 0; m.def = 0; if (hp) { m.hp = hp; m.maxHp = hp; } return m; };

// ---- 0) 아이템은 아군 유닛에만 장착 ----
test("아이템: 적 유닛에는 장착 불가 (playCard 대상 소유자 위조 포함 · equipItemOnUnit 직접 호출)", () => {
  const { p1, p2 } = setup(g);
  const foe = place(g, p2, "l12");
  const it = inst("불꽃검");
  p1.hand.push(it);
  const soul = p1.soul;
  assert.equal(g.playCard(p1, it, { kind: "minion", owner: p2, minion: foe }), false);
  assert.equal(g.playCard(p1, it, { kind: "minion", owner: p1, minion: foe }), false, "owner를 나로 위조해도 적 전장 유닛이면 거부");
  assert.equal(g.equipItemOnUnit(p1, it, foe), false);
  assert.ok(!foe.equippedItem);
  assert.equal(p1.soul, soul);
  assert.ok(p1.hand.includes(it), "손패에 그대로");
  const ts = g.validTargets(p1, { _itemEquip: true });
  assert.ok(ts.every(t => t.owner === p1));
  const mine = place(g, p1, "l12");
  assert.equal(g.playCard(p1, it, { kind: "minion", owner: p1, minion: mine }), true);
  assert.ok(mine.equippedItem);
});

// ---- 카드 데이터 ----
test("카드 수치: 소울·스탯·능력 (사용자 지정)", () => {
  const c = (n) => card(g, n);
  assert.equal(c("미로생성").cost, 4);
  assert.deepEqual([c("거대화").cost, c("거대화").spell.atk, c("거대화").spell.hp], [8, 9, 9]);
  assert.deepEqual([c("골렘의심장").atk, c("골렘의심장").def, c("골렘의심장").hp, c("골렘의심장").itemFx], [0, 0, 1, "eot_hp_plus3"]);
  assert.deepEqual([c("돌도끼").atk, c("돌도끼").def, c("돌도끼").hp, c("돌도끼").atkSkill], [3, 0, 2, undefined]);
  assert.deepEqual([c("대지의팔찌").cost, c("대지의팔찌").atk, c("대지의팔찌").def, c("대지의팔찌").hp, c("대지의팔찌").ability], [7, 0, 2, 5, undefined]);
  assert.equal(c("화염폭풍").cost, 4);
  assert.equal(c("메테오").cost, 6);
  assert.deepEqual([c("불꽃검").atk, c("불꽃검").def, c("불꽃검").hp], [2, 0, 0]);
  assert.deepEqual([c("불꽃도끼").atk, c("불꽃도끼").def, c("불꽃도끼").hp, c("불꽃도끼").atkSkill], [4, 0, 1, undefined]);
  assert.deepEqual([c("분노의해머").cost, c("분노의해머").atk, c("분노의해머").def, c("분노의해머").hp], [3, 3, 0, 2]);
  assert.equal(c("토네이도").cost, 3);
  assert.equal(c("폭풍우").cost, 5);
  assert.deepEqual([c("요정의부츠").cost, c("요정의부츠").atk, c("요정의부츠").def, c("요정의부츠").hp, c("요정의부츠").ability], [2, 0, 1, 2, undefined]);
  assert.deepEqual([c("하피의손톱").cost, c("하피의손톱").atk, c("하피의손톱").def, c("하피의손톱").hp, c("하피의손톱").atkSkill], [4, 4, 0, 1, undefined]);
  assert.deepEqual([c("청룡언월도").cost, c("청룡언월도").atk, c("청룡언월도").def, c("청룡언월도").hp], [6, 4, 2, 1]);
  assert.equal(c("불길한예감").cost, 0);
  assert.deepEqual([c("다크아머").cost, c("다크아머").atk, c("다크아머").def, c("다크아머").hp, c("다크아머").ability], [7, 0, 2, 4, undefined]);
  // 문구: 쉼표·마침표 없음 (카드 효과 표기 규칙)
  ["어스퀘이크","미로생성","낙석","거대화","골렘의심장","대지의팔찌","화염폭풍","메테오","일기토","불꽃검","분노의해머","진공베기","폭풍우","요정의부츠","하피의손톱","수정호수","청룡언월도","헬게이트","불길한예감","조작된주화","다크아머","치유의빛"]
    .forEach(n => assert.ok(!/[,.]/.test(c(n).text || ""), n + " 문구"));
});

// ---- 스펠 ----
test("어스퀘이크: 낸 뒤 남은 손패 장수만큼 적 전체 피해", async () => {
  const { p1, p2 } = setup(g);
  const foe = plain(p2, "l12", 10);
  const eq = inst("어스퀘이크");
  p1.hand.push(eq, g.cloneCard("l12"), g.cloneCard("l12"), g.cloneCard("l12"));
  assert.ok(g.playCard(p1, eq, null));
  await tick(); await tick();
  assert.equal(foe.hp, 10 - 3);
});

test("낙석: 적 전체 방-1 체-1 (아군 영향 없음)", () => {
  const { p1, p2 } = setup(g);
  const foe = plain(p2, "l12", 5); foe.def = 2;
  const mine = plain(p1, "l12", 5);
  g.applyFx(p1, card(g, "낙석").spell, null);
  assert.deepEqual([foe.def, foe.hp], [1, 4]);
  assert.equal(mine.hp, 5);
});

test("거대화: 유닛 하나 공+9 체+9", () => {
  const { p1 } = setup(g);
  const m = plain(p1, "l12", 3); const a = m.atk;
  g.applyFx(p1, card(g, "거대화").spell, { kind: "minion", owner: p1, minion: m });
  assert.deepEqual([m.atk, m.hp, m.maxHp], [a + 9, 12, 12]);
});

test("화염폭풍·메테오: 양쪽 유닛 전체 피해 3·4", () => {
  for (const [n, d] of [["화염폭풍", 3], ["메테오", 4]]) {
    const { p1, p2 } = setup(g);
    const mine = plain(p1, "l12", 10), foe = plain(p2, "l12", 10);
    g.applyFx(p1, card(g, n).spell, null);
    assert.equal(mine.hp, 10 - d, n + " 아군");
    assert.equal(foe.hp, 10 - d, n + " 적");
  }
});

test("일기토: 내 전장·적 전장에서 랜덤 하나씩만 남음", () => {
  const { p1, p2 } = setup(g);
  for (let i = 0; i < 3; i++) plain(p1, "l12", 3);
  for (let i = 0; i < 4; i++) plain(p2, "l12", 3);
  assert.equal(g.needsTarget(card(g, "일기토")), false);
  g.applyFx(p1, card(g, "일기토").spell, null);
  assert.equal(p1.board.length, 1);
  assert.equal(p2.board.length, 1);
});

test("진공베기: 코인 2개 이상인 적만 대상", () => {
  const { p1, p2 } = setup(g);
  const c1 = plain(p2, "l12", 3); c1.atkC = 1;
  const c2 = plain(p2, "l12", 3); c2.atkC = 2; c2.hpC = -2;
  const c0 = plain(p2, "l12", 3);
  const ts = g.validTargets(p1, card(g, "진공베기").spell).map(t => t.minion);
  assert.deepEqual(ts.map(m => m.uid), [c2.uid]);
  g.applyFx(p1, card(g, "진공베기").spell, { kind: "minion", owner: p2, minion: c2 });
  assert.ok(!p2.board.includes(c2));
  assert.ok(p2.board.includes(c1) && p2.board.includes(c0));
});

test("폭풍우: 적 전체 피해 2 + 드로우 1", () => {
  const { p1, p2 } = setup(g);
  const foe = plain(p2, "l12", 5);
  const h = p1.hand.length;
  g.applyFx(p1, card(g, "폭풍우").spell, null);
  assert.equal(foe.hp, 3);
  assert.equal(p1.hand.length, h + 1);
});

test("수정호수: 드로우 2 + 적 전체 다음 턴 공격 불가", () => {
  const { p1, p2 } = setup(g);
  const foe = plain(p2, "l12", 5);
  const h = p1.hand.length;
  g.applyFx(p1, card(g, "수정호수").spell, null);
  assert.equal(p1.hand.length, h + 2);
  assert.equal(foe.skipAttack, true);
  g.beginTurn(p2);
  assert.equal(foe.canAttack, false);
});

test("헬게이트: 아군 하나 처치 후 적 전체 피해 3 · 아군 없으면 사용 불가", () => {
  const { p1, p2 } = setup(g);
  const hg = card(g, "헬게이트");
  assert.equal(g.needsTarget(hg), true);
  assert.equal(g.validTargets(p1, hg.spell).length, 0, "아군 없으면 대상 없음");
  const mine = plain(p1, "l12", 3);
  const foe = plain(p2, "l12", 5);
  assert.ok(g.validTargets(p1, hg.spell).every(t => t.owner === p1));
  g.applyFx(p1, hg.spell, { kind: "minion", owner: p1, minion: mine });
  assert.ok(!p1.board.includes(mine));
  assert.equal(foe.hp, 2);
});

test("불길한예감: 이번 턴 코인 뒷면 확률 +50% (앞면 25%)", () => {
  const { p1 } = setup(g);
  g.applyFx(p1, card(g, "불길한예감").spell, null);
  assert.equal(p1.coinP, 0.25);
  assert.equal(g.needsTarget(card(g, "불길한예감")), false);
});

test("치유의빛: 아군 전체 체력 완전 회복", () => {
  const { p1, p2 } = setup(g);
  const a = plain(p1, "l12", 6); a.hp = 2;
  const b = plain(p1, "l12", 4); b.hp = 1;
  const foe = plain(p2, "l12", 5); foe.hp = 1;
  g.applyFx(p1, card(g, "치유의빛").spell, null);
  assert.deepEqual([a.hp, b.hp, foe.hp], [6, 4, 1]);
});

// ---- 아이템 ----
test("골렘의심장·대지의팔찌: 내 턴 종료 체+3, 보호 없음", () => {
  for (const n of ["골렘의심장", "대지의팔찌"]) {
    const { p1 } = setup(g);
    const m = plain(p1, "l12", 3);
    assert.ok(g.equipItemOnUnit(p1, inst(n), m));
    const hp = m.hp, mx = m.maxHp;
    assert.ok(!(m.keywords || []).includes("shield") && m.ability !== "보호", n + " 보호 없음");
    g.applyItemEndTurnFx(p1);
    assert.deepEqual([m.hp, m.maxHp], [hp + 3, mx + 3], n);
  }
});

test("돌도끼·불꽃도끼: 관통 부여 없음", () => {
  for (const n of ["돌도끼", "불꽃도끼"]) {
    const { p1 } = setup(g);
    const m = plain(p1, "l12", 3); m.atkSkill = undefined;
    g.equipItemOnUnit(p1, inst(n), m);
    assert.ok(m.atkSkill == null && !(m.keywords || []).includes("pierce"), n);
  }
});

test("불꽃검·분노의해머: 공격 시 공격+2", () => {
  for (const n of ["불꽃검", "분노의해머"]) {
    const { p1 } = setup(g);
    const m = plain(p1, "l12", 5);
    g.equipItemOnUnit(p1, inst(n), m);
    const a = m.atk;
    g.applyItemAttackFx(p1, m);
    assert.equal(m.atk, a + 2, n);
  }
});

test("불꽃검 + 연속공격 유닛: 공격마다 발동 (+2 두 번) · 영웅 피해 반영", async () => {
  const { p1, p2 } = setup(g);
  const m = plain(p1, "l12", 5); m.atk = 3; m.atkSkill = 4;
  g.equipItemOnUnit(p1, inst("불꽃검"), m); // 공 5
  const hp0 = p2.hp;
  await g.doAttack(p1, m, { kind: "hero", owner: p2 }, false);
  assert.equal(m.atk, 5 + 4, "공격+2 두 번");
  assert.equal(hp0 - p2.hp, 7 + 9, "1타 7 · 2타 9");
});

test("요정의부츠: 턴 종료마다 상대 손패 유닛 소울 +1 (스펠은 그대로 · 누적)", () => {
  const { p1, p2 } = setup(g);
  const u = g.cloneCard("l12"), sp = inst("낙석");
  const base = u.cost;
  p2.hand.push(u, sp);
  const m = plain(p1, "l12", 3);
  g.equipItemOnUnit(p1, inst("요정의부츠"), m);
  assert.equal(g.effectiveCardCost(p2, u), base, "장착 즉시 비용 오라 없음");
  g.applyItemEndTurnFx(p1);
  assert.equal(g.effectiveCardCost(p2, u), base + 1);
  assert.equal(g.effectiveCardCost(p2, sp), sp.cost);
  assert.equal(g.cloneCard(u.id).cost, base, "원본 유닛은 영향 없음");
  const m2 = plain(p1, "l12", 3);
  g.equipItemOnUnit(p1, inst("요정의부츠"), m2);
  g.applyItemEndTurnFx(p1);
  assert.equal(g.effectiveCardCost(p2, u), base + 3);
  g.destroyMinion(p1, m, { fromSpell: true });
  g.destroyMinion(p1, m2, { fromSpell: true });
  assert.equal(g.effectiveCardCost(p2, u), base + 3);
});

test("하피의손톱: 처치 시 하피 1기 생성", () => {
  const { p1, p2 } = setup(g);
  const m = plain(p1, "l12", 5);
  g.equipItemOnUnit(p1, inst("하피의손톱"), m);
  const foe = plain(p2, "l12", 1);
  g.damageMinion(p2, foe, 5, { killer: m, killerOwner: p1, fromSpell: false });
  g.resolveDeath(p2, foe);
  assert.equal(p1.board.filter(x => x.id === "n10").length, 1);
});

test("청룡언월도: 파괴 시 랜덤 물 유닛 3장 생성 · 공격 시엔 발동 안 함", () => {
  const { p1, p2 } = setup(g);
  const m = plain(p1, "l12", 3); // 방 0 + 아이템 2
  g.equipItemOnUnit(p1, inst("청룡언월도"), m);
  const foe = plain(p2, "l12", 5);
  g.applyItemAttackFx(p1, m);
  assert.equal(foe.hp, 5, "공격: 미발동");
  assert.equal(p1.hand.length, 0);
  g.destroyMinion(p1, m, { fromSpell: true });
  assert.equal(foe.hp, 5);
  assert.equal(p1.hand.length, 3);
  assert.ok(p1.hand.every(c => c.type === "minion" && c.tribe === "water"));
});

test("다크아머: 파괴 시 랜덤 적 하나 탈취", () => {
  const { p1, p2 } = setup(g);
  const m = plain(p1, "l12", 3);
  g.equipItemOnUnit(p1, inst("다크아머"), m);
  const foe = plain(p2, "l12", 3);
  g.destroyMinion(p1, m, { fromSpell: true });
  assert.ok(p1.board.includes(foe));
  assert.ok(!p2.board.includes(foe));
});

test("조작된주화: 모든 코인을 골드로", () => {
  const { p1 } = setup(g);
  const m = plain(p1, "l12", 3); m.atkC = -2; m.hpC = 2;
  g.equipItemOnUnit(p1, inst("조작된주화"), m);
  const L = g.effectiveCoinLinks(m);
  assert.deepEqual([L.atkC, L.hpC], [2, 2]);
});
