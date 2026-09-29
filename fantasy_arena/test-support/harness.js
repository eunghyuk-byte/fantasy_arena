// 테스트용: 브라우저 스크립트(cards-data·combat·game)를 vm 컨텍스트에 올린다 (DOM·연출은 빈 스텁)
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

function loadGame() {
  const noop = () => {};
  const el = () => ({ prepend: noop, children: [], lastChild: { remove: noop }, appendChild: noop, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, style: {}, dataset: {}, addEventListener: noop, setAttribute: noop });
  const proxy = new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => "" : proxy, apply: () => proxy, construct: () => proxy });
  const document = new Proxy({}, { get: (t, k) => (k === "getElementById" || k === "createElement" || k === "querySelector") ? () => el() : proxy });
  const ctx = { console: { log: noop, warn: noop, error: console.error }, setTimeout: (f) => setImmediate(f), clearTimeout, Math, JSON, Date, Promise };
  ctx.window = ctx; ctx.document = document;
  ctx.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
  ctx.addEventListener = noop; ctx.requestAnimationFrame = noop;
  vm.createContext(ctx);
  const root = path.join(__dirname, "..");
  for (const f of ["js/cards-data.js", "js/combat.js", "js/game.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
  }
  // 연출 스텁 (전투 로직만 검증)
  vm.runInContext(`
    Vfx = { elOf: () => null, heroOf: () => null, attackSeq: async () => {}, parrySeq: async () => {}, death: () => {} };
    render = function () {};
    showCoinResult = function (t, rows, done) { if (done) done(); };
    meView = function () { return { me: state.p1, opp: state.p2 }; };
    ui = { battling: false };
  `, ctx);
  return ctx;
}

function setup(g, opts) {
  opts = opts || {};
  const mk = (name) => ({ name, hp: 30, maxHp: 30, soul: 10, maxSoul: 10, board: [], hand: [], deck: ["l12", "l12", "l12", "l12", "l12"], fatigue: 0, hero: { id: "light" } });
  const p1 = mk("P1"), p2 = mk("P2");
  g.__s = { p1, p2, turn: 1, turnSerial: 1, turnCount: 1, acting: p1 };
  vm.runInContext("state = __s", g);
  return { p1, p2 };
}
function place(g, p, id) {
  const m = g.cloneCard(id);
  m.canAttack = true; m.attacksLeft = 1;
  p.board.push(m);
  return m;
}
function card(g, name) {
  const c = vm.runInContext("CARDS", g).find(x => x.name === name);
  if (!c) throw new Error("no card " + name);
  return c;
}
module.exports = { loadGame, setup, place, card, vm };
