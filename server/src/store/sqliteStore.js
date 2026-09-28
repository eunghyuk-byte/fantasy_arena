"use strict";
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  steam_id     TEXT UNIQUE,            -- SteamID64 (NULL for temporary test accounts)
  dev_name     TEXT UNIQUE,            -- temporary test login name (NULL for Steam accounts)
  display_name TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS decks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  tribe      TEXT NOT NULL,
  cards_json TEXT NOT NULL,           -- JSON array of 30 card ids
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_decks_account ON decks(account_id);
`;

const acc = r => r && ({ id: r.id, steamId: r.steam_id, devName: r.dev_name, displayName: r.display_name, createdAt: r.created_at });
const deck = r => r && ({ id: r.id, name: r.name, tribe: r.tribe, cards: JSON.parse(r.cards_json), createdAt: r.created_at, updatedAt: r.updated_at });

class SqliteStore {
  constructor(file) {
    if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new Database(file);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec(SCHEMA);
  }
  findAccountBySteamId(steamId) { return acc(this.db.prepare("SELECT * FROM accounts WHERE steam_id = ?").get(String(steamId))); }
  findAccountByDevName(name) { return acc(this.db.prepare("SELECT * FROM accounts WHERE dev_name = ?").get(name)); }
  getAccount(id) { return acc(this.db.prepare("SELECT * FROM accounts WHERE id = ?").get(id)); }
  createAccount({ steamId = null, devName = null, displayName }) {
    const info = this.db.prepare("INSERT INTO accounts (steam_id, dev_name, display_name, created_at) VALUES (?, ?, ?, ?)")
      .run(steamId, devName, displayName, Date.now());
    return this.getAccount(info.lastInsertRowid);
  }
  createSession(accountId, token, expiresAt) {
    this.db.prepare("INSERT INTO sessions (token, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)").run(token, accountId, Date.now(), expiresAt);
  }
  getSession(token) {
    const r = this.db.prepare("SELECT * FROM sessions WHERE token = ?").get(token);
    return r ? { token: r.token, accountId: r.account_id, expiresAt: r.expires_at } : null;
  }
  deleteSession(token) { this.db.prepare("DELETE FROM sessions WHERE token = ?").run(token); }
  listDecks(accountId) { return this.db.prepare("SELECT * FROM decks WHERE account_id = ? ORDER BY id").all(accountId).map(deck); }
  countDecks(accountId) { return this.db.prepare("SELECT COUNT(*) AS n FROM decks WHERE account_id = ?").get(accountId).n; }
  getDeck(accountId, id) { return deck(this.db.prepare("SELECT * FROM decks WHERE account_id = ? AND id = ?").get(accountId, id)); }
  createDeck(accountId, { name, tribe, cards }) {
    const now = Date.now();
    const info = this.db.prepare("INSERT INTO decks (account_id, name, tribe, cards_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(accountId, name, tribe, JSON.stringify(cards), now, now);
    return this.getDeck(accountId, info.lastInsertRowid);
  }
  updateDeck(accountId, id, patch) {
    const cur = this.getDeck(accountId, id);
    if (!cur) return null;
    const next = { ...cur, ...patch };
    this.db.prepare("UPDATE decks SET name = ?, tribe = ?, cards_json = ?, updated_at = ? WHERE account_id = ? AND id = ?")
      .run(next.name, next.tribe, JSON.stringify(next.cards), Date.now(), accountId, id);
    return this.getDeck(accountId, id);
  }
  deleteDeck(accountId, id) { return this.db.prepare("DELETE FROM decks WHERE account_id = ? AND id = ?").run(accountId, id).changes > 0; }
  close() { this.db.close(); }
}

module.exports = { SqliteStore };
