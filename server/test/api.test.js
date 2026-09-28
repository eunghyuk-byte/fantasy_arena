"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { start } = require("../src/index");
const { loadCards } = require("../src/cards");
const config = require("../src/config");

const cards = loadCards(config.cardsDataPath);
function legalDeck(tribe) {
  const pool = [...cards.cardMap.values()].filter(c => c.tribe === tribe && !c.token);
  const out = [];
  for (const c of pool) {
    const max = (c.rarity === "rare" || c.rarity === "legendary") ? 1 : 2;
    for (let i = 0; i < max && out.length < 30; i++) out.push(c.id);
    if (out.length >= 30) break;
  }
  return out;
}

let srv, base;
test.before(async () => {
  srv = await start({ port: 0, host: "127.0.0.1", dbPath: ":memory:", staticDir: null, devLogin: true, maxDecks: 10 });
  base = `http://127.0.0.1:${srv.port}`;
});
test.after(async () => { await srv.close(); });

async function api(method, p, body, token) {
  const res = await fetch(base + p, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

test("deck API end-to-end", async (t) => {
  const h = await api("GET", "/api/health");
  assert.equal(h.status, 200); assert.equal(h.body.maxDecks, 10);

  assert.equal((await api("GET", "/api/decks")).status, 401, "no token -> 401");
  const login = await api("POST", "/api/auth/dev", { name: "테스터" });
  assert.equal(login.status, 200); const tok = login.body.token;
  const again = await api("POST", "/api/auth/dev", { name: "테스터" });
  assert.equal(again.body.account.id, login.body.account.id, "same dev name -> same account");
  const other = (await api("POST", "/api/auth/dev", { name: "다른사람" })).body.token;

  const fire = legalDeck("fire");
  assert.equal(fire.length, 30);
  // save + load
  const c = await api("POST", "/api/decks", { name: "불꽃 러시", tribe: "fire", cards: fire }, tok);
  assert.equal(c.status, 201); const id = c.body.deck.id;
  let list = await api("GET", "/api/decks", null, tok);
  assert.equal(list.body.decks.length, 1);
  assert.equal(list.body.decks[0].name, "불꽃 러시");
  assert.deepEqual(list.body.decks[0].cards, fire);
  assert.equal(list.body.decks[0].tribe, "fire");
  // other account cannot see / touch it
  assert.equal((await api("GET", "/api/decks", null, other)).body.decks.length, 0);
  assert.equal((await api("PATCH", "/api/decks/" + id, { name: "뺏기" }, other)).status, 404);
  // rename
  const r = await api("PATCH", "/api/decks/" + id, { name: "불꽃 컨트롤" }, tok);
  assert.equal(r.status, 200); assert.equal(r.body.deck.name, "불꽃 컨트롤");
  assert.deepEqual(r.body.deck.cards, fire);
  assert.equal((await api("PATCH", "/api/decks/" + id, { name: "   " }, tok)).status, 422, "empty name rejected");
  assert.equal((await api("PATCH", "/api/decks/" + id, { name: "가".repeat(9) }, tok)).status, 422, "9-char name rejected");
  const r8 = await api("PATCH", "/api/decks/" + id, { name: "가나다라마바사아" }, tok);
  assert.equal(r8.status, 200, "8-char name ok"); assert.equal(r8.body.deck.name, "가나다라마바사아");
  // delete
  assert.equal((await api("DELETE", "/api/decks/" + id, null, tok)).status, 200);
  assert.equal((await api("GET", "/api/decks", null, tok)).body.decks.length, 0);
  assert.equal((await api("DELETE", "/api/decks/" + id, null, tok)).status, 404);

  // invalid decks
  const bad = async (desc, deck) => {
    const res = await api("POST", "/api/decks", deck, tok);
    assert.equal(res.status, 422, desc + " -> " + JSON.stringify(res.body));
  };
  await bad("29 cards", { name: "a", tribe: "fire", cards: fire.slice(0, 29) });
  await bad("31 cards", { name: "a", tribe: "fire", cards: [...fire, fire[0]] });
  const common = fire.find(id => { const k = cards.cardMap.get(id).rarity; return k === "common" || k === "uncommon"; });
  await bad("3 copies of common", { name: "a", tribe: "fire", cards: [common, common, common, ...fire.filter(x => x !== common)].slice(0, 30) });
  const rare = [...cards.cardMap.values()].find(x => x.tribe === "fire" && !x.token && (x.rarity === "rare" || x.rarity === "legendary"));
  await bad("2 copies of rare", { name: "a", tribe: "fire", cards: [rare.id, rare.id, ...fire.filter(x => x !== rare.id)].slice(0, 30) });
  const water = legalDeck("water");
  await bad("other tribe card", { name: "a", tribe: "fire", cards: [...fire.slice(0, 29), water[0]] });
  const token = [...cards.cardMap.values()].find(x => x.token && x.tribe === "fire");
  if (token) await bad("token card", { name: "a", tribe: "fire", cards: [...fire.slice(0, 29), token.id] });
  await bad("unknown card", { name: "a", tribe: "fire", cards: [...fire.slice(0, 29), "zz999"] });
  await bad("unknown tribe", { name: "a", tribe: "metal", cards: fire });
  await bad("no name", { tribe: "fire", cards: fire });
  // invalid edit via PATCH is rejected too
  const keep = (await api("POST", "/api/decks", { name: "keep", tribe: "fire", cards: fire }, tok)).body.deck;
  assert.equal((await api("PATCH", "/api/decks/" + keep.id, { cards: fire.slice(0, 20) }, tok)).status, 422);
  await api("DELETE", "/api/decks/" + keep.id, null, tok);

  // limit: 10 OK, 11th rejected
  const tribes = ["earth", "fire", "wind", "water", "dark", "light"];
  for (let i = 0; i < 10; i++) {
    const tr = tribes[i % tribes.length];
    const res = await api("POST", "/api/decks", { name: "덱" + (i + 1), tribe: tr, cards: legalDeck(tr) }, tok);
    assert.equal(res.status, 201, "deck " + (i + 1));
  }
  const eleventh = await api("POST", "/api/decks", { name: "덱11", tribe: "fire", cards: fire }, tok);
  assert.equal(eleventh.status, 409); assert.equal(eleventh.body.error, "deck_limit");
  assert.equal((await api("GET", "/api/decks", null, tok)).body.decks.length, 10);

  // steam stub: not configured -> 501
  assert.equal((await api("POST", "/api/auth/steam", { ticket: "abcdef0123456789" })).status, 501);
  // logout invalidates token
  assert.equal((await api("POST", "/api/auth/logout", null, tok)).status, 200);
  assert.equal((await api("GET", "/api/me", null, tok)).status, 401);
});

test("sqlite file persists across restart", async () => {
  const os = require("os"), fs = require("fs");
  const file = path.join(os.tmpdir(), "fs-test-" + process.pid + ".db");
  try { fs.unlinkSync(file); } catch (e) {}
  let s = await start({ port: 0, host: "127.0.0.1", dbPath: file, staticDir: null, devLogin: true });
  let b = `http://127.0.0.1:${s.port}`;
  const tok = (await (await fetch(b + "/api/auth/dev", { method: "POST", body: JSON.stringify({ name: "persist" }) })).json()).token;
  await fetch(b + "/api/decks", { method: "POST", headers: { Authorization: "Bearer " + tok }, body: JSON.stringify({ name: "영속", tribe: "light", cards: legalDeck("light") }) });
  await s.close();
  s = await start({ port: 0, host: "127.0.0.1", dbPath: file, staticDir: null, devLogin: true });
  b = `http://127.0.0.1:${s.port}`;
  const list = await (await fetch(b + "/api/decks", { headers: { Authorization: "Bearer " + tok } })).json();
  assert.equal(list.decks.length, 1); assert.equal(list.decks[0].name, "영속");
  await s.close();
  for (const ext of ["", "-wal", "-shm"]) try { fs.unlinkSync(file + ext); } catch (e) {}
});
