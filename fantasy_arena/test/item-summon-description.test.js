const test = require("node:test");
const assert = require("node:assert/strict");
const { loadGame, setup, place, vm } = require("../test-support/harness.js");

for (const [itemId, summonId, trigger] of [
  ["ni5", "n10", "처치"],
  ["ai2", "a10", "공격"],
]) {
  test(`${itemId}: 소환 설명의 수치가 원본 데이터와 실제 소환 유닛에 일치`, () => {
    const g = loadGame();
    const { p1, p2 } = setup(g);
    const cards = vm.runInContext("CARD_MAP", g);
    const item = cards[itemId];
    const summon = cards[summonId];
    const stats = [summon.atk, summon.def, summon.hp];
    assert.equal(item.text, `${trigger}: ${summon.name} (${stats.join("/")}) 1기 생성`);

    const wearer = place(g, p1, "l12");
    assert.equal(g.equipItemOnUnit(p1, g.cloneCard(itemId), wearer), true);
    if (trigger === "처치") g.applyItemKillFx(p1, wearer, p2);
    else g.applyItemAttackFx(p1, wearer);

    const spawned = p1.board.filter(unit => unit !== wearer);
    assert.equal(spawned.length, 1);
    assert.equal(spawned[0].id, summonId);
    assert.deepEqual([spawned[0].atk, spawned[0].def, spawned[0].hp], stats);
  });
}
