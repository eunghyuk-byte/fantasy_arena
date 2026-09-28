"use strict";
// Loads fantasy_arena/js/cards-data.js (browser script) in a sandbox so the server validates
// decks against exactly the same card list as the client.
const fs = require("fs");
const vm = require("vm");

function loadCards(file) {
  const src = fs.readFileSync(file, "utf8");
  const ctx = { console: { log() {}, warn() {}, error() {} } };
  vm.createContext(ctx);
  vm.runInContext(src + "\n;this.__out = { TRIBES, CARDS };", ctx, { filename: "cards-data.js" });
  const { TRIBES, CARDS } = ctx.__out;
  const cardMap = new Map();
  for (const c of CARDS) if (c && c.id) cardMap.set(c.id, c);
  return {
    tribes: TRIBES.map(t => ({ id: t.id, name: t.name, en: t.en, open: !!t.open })),
    cardMap,
  };
}

module.exports = { loadCards };
