const test = require('node:test');
const assert = require('node:assert/strict');
const {loadGame, card} = require('../test-support/harness.js');
test('approved compact spell descriptions retain their original effects', () => {
  const g = loadGame();
  const wind = card(g, '동남풍'), duel = card(g, '일기토');
  assert.equal(wind.text, '적 전장 유닛 전부 핸드로\n손패 10장 초과분은 파괴');
  assert.equal(duel.text, '각 전장 무작위 1기 외\n나머지 유닛 처치');
  assert.equal(wind.spell.type, 'bounce_enemy_board');
  assert.equal(duel.spell.type, 'duel_random_keep');
});
