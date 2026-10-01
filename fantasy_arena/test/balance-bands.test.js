const test = require('node:test');
const assert = require('node:assert/strict');
const {loadGame,vm} = require('../test-support/harness');

test('all equipment is exempt from soul bands, including plain stats, coin and keyword items', () => {
  const {soulBand} = require('../tools/balance-bands.cjs');
  const cards=vm.runInContext('CARDS',loadGame());
  const items=cards.filter(c=>c.type==='item');assert.equal(items.length,42);
  for(const item of items) assert.equal(soulBand(item),null,item.id);
});
test('unit and spell soul bands retain the locked table and rarity offsets', () => {
  const {soulBand} = require('../tools/balance-bands.cjs');
  const common=[[4,4.6],[5.6,6.2],[7.2,7.9],[8.9,9.6],[10.6,11.4],[12.4,13.2],[14.2,15.1],[16.1,17],[18,19],[20,21]];
  for(const type of ['minion','spell']) for(const [rarity,factor] of Object.entries({common:0,uncommon:0.1,rare:0.2,legendary:0.3})) for(let cost=1;cost<=10;cost++) {
    assert.deepEqual(soulBand({type,rarity,cost}),common[cost-1].map(v=>Math.round((v+cost*factor)*10)/10));
  }
  assert.equal(soulBand({type:'minion',cost:10,rarity:'legendary',token:true}),null);
  assert.equal(soulBand({type:'spell',cost:0}),undefined,'no undocumented zero-soul band invented');
});
