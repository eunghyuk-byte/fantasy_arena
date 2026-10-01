// Authoring/validation only; gameplay does not rescore or rebalance cards.
const common = [[4,4.6],[5.6,6.2],[7.2,7.9],[8.9,9.6],[10.6,11.4],[12.4,13.2],[14.2,15.1],[16.1,17],[18,19],[20,21]];
const rarityBonus = {common:0,uncommon:0.1,rare:0.2,legendary:0.3};
function soulBand(card) {
  if (card.type === 'item' || card.token) return null;
  const band = common[card.cost-1];
  if (!band) return undefined; // The locked table defines only souls 1–10.
  return band.map(value => Math.round((value + card.cost * (rarityBonus[card.rarity] || 0)) * 10) / 10);
}
module.exports = {soulBand};
