"use strict";
const http = require("http");
const config = require("./config");
const { createStore } = require("./store");
const { loadCards } = require("./cards");
const { createApp } = require("./app");

function start(overrides = {}) {
  const cfg = { ...config, ...overrides, steam: { ...config.steam, ...(overrides.steam || {}) } };
  const cards = loadCards(cfg.cardsDataPath);
  const store = createStore(cfg);
  const server = http.createServer(createApp({ store, cards, config: cfg }));
  return new Promise(resolve => {
    server.listen(cfg.port, cfg.host, () => {
      const addr = server.address();
      resolve({ server, store, port: addr.port, close: () => new Promise(r => server.close(() => { store.close(); r(); })) });
    });
  });
}

if (require.main === module) {
  start().then(({ port }) => {
    console.log(`[fantasysoul] http://localhost:${port}  (db: ${config.dbPath}, devLogin: ${config.devLogin}, maxDecks: ${config.maxDecks})`);
  });
}

module.exports = { start };
