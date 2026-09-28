"use strict";
// Same rules as the client deck builder (fantasy_arena/js/game.js: maxCopies, sanitizeDraftDeck,
// tribeCards, saveDraftDeck):
//  - exactly 30 cards
//  - every card exists, is not a token, and belongs to the deck's tribe (units/spells/items)
//  - rare/legendary max 1 copy, common/uncommon max 2
//  - tribe must be an open tribe
const NAME_MAX = 8; // v0.334: 덱 이름 1~8자 (글자 수, 로비 덱 칸 한 줄)

function maxCopies(card) {
  return (card.rarity === "legendary" || card.rarity === "rare") ? 1 : 2;
}

function normalizeName(name) {
  if (typeof name !== "string") return null;
  const n = name.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
  if (!n || [...n].length > NAME_MAX) return null;
  return n;
}

function validateDeck(deck, cards, deckSize = 30) {
  const errors = [];
  const name = normalizeName(deck && deck.name);
  if (!name) errors.push(`덱 이름은 1~${NAME_MAX}자여야 합니다.`);
  const tribe = deck && deck.tribe;
  const t = cards.tribes.find(x => x.id === tribe);
  if (!t || !t.open) errors.push("알 수 없는 속성입니다.");
  const list = deck && deck.cards;
  if (!Array.isArray(list)) {
    errors.push("카드 목록이 없습니다.");
  } else {
    if (list.length !== deckSize) errors.push(`덱은 정확히 ${deckSize}장이어야 합니다. (지금 ${list.length}장)`);
    const counts = new Map();
    for (const id of list) {
      if (typeof id !== "string") { errors.push("카드 id 형식이 잘못되었습니다."); break; }
      const c = cards.cardMap.get(id);
      if (!c) { errors.push(`없는 카드: ${id}`); continue; }
      if (c.token) { errors.push(`토큰은 덱에 넣을 수 없습니다: ${id}`); continue; }
      if (t && c.tribe !== tribe) { errors.push(`다른 속성 카드: ${id}`); continue; }
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    for (const [id, n] of counts) {
      const c = cards.cardMap.get(id);
      if (n > maxCopies(c)) errors.push(`${c.name}(${id})는 최대 ${maxCopies(c)}장입니다. (${n}장)`);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: { name, tribe, cards: list.slice() } };
}

module.exports = { validateDeck, normalizeName, maxCopies, NAME_MAX };
