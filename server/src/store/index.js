"use strict";
/**
 * Storage layer. The app only talks to this interface, so SQLite can later be swapped for
 * MySQL/PostgreSQL (e.g. on the Cafe24 VPS) by adding another implementation.
 *
 * Store interface (all synchronous in the SQLite version; an async DB can return Promises —
 * app.js awaits every call):
 *   findAccountBySteamId(steamId) -> account|null
 *   findAccountByDevName(name) -> account|null
 *   createAccount({ steamId?, devName?, displayName }) -> account
 *   getAccount(id) -> account|null
 *   createSession(accountId, token, expiresAt) / getSession(token) / deleteSession(token)
 *   listDecks(accountId) -> deck[]
 *   countDecks(accountId) -> number
 *   getDeck(accountId, deckId) -> deck|null
 *   createDeck(accountId, { name, tribe, cards }) -> deck
 *   updateDeck(accountId, deckId, { name?, tribe?, cards? }) -> deck|null
 *   deleteDeck(accountId, deckId) -> boolean
 *   close()
 * account: { id, steamId, devName, displayName, createdAt }
 * deck:    { id, name, tribe, cards: string[], createdAt, updatedAt }
 */
function createStore(config) {
  const { SqliteStore } = require("./sqliteStore");
  return new SqliteStore(config.dbPath);
}
module.exports = { createStore };
