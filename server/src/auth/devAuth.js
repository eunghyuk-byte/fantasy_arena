"use strict";
// TEMPORARY test login: a name is enough. Replaced by Steam login for release (DEV_LOGIN=0).
const { normalizeName } = require("../deckRules");

async function devLogin(store, rawName) {
  const name = normalizeName(rawName);
  if (!name) return { error: "이름은 1~20자여야 합니다." };
  let account = await store.findAccountByDevName(name);
  if (!account) account = await store.createAccount({ devName: name, displayName: name });
  return { account };
}

module.exports = { devLogin };
