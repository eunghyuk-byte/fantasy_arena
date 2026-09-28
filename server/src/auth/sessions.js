"use strict";
const crypto = require("crypto");

async function issueSession(store, config, accountId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + config.sessionDays * 86400000;
  await store.createSession(accountId, token, expiresAt);
  return { token, expiresAt };
}

async function resolveSession(store, token) {
  if (!token) return null;
  const s = await store.getSession(token);
  if (!s) return null;
  if (s.expiresAt < Date.now()) { await store.deleteSession(token); return null; }
  return store.getAccount(s.accountId);
}

module.exports = { issueSession, resolveSession };
