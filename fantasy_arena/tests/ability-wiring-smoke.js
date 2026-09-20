#!/usr/bin/env node
/** Smoke: special abilities trigger on play/death/damage; attack skills wired. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');

function el() {
  const o = {
    onclick: null, classList: { add() {}, remove() {}, contains: () => false },
    addEventListener() {}, removeEventListener() {}, dataset: {}, innerHTML: '', textContent: '', style: {},
    appendChild() { return o; }, prepend() { return o; },
    querySelector: () => el(), querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
    children: [], parentElement: null
  };
  return o;
}
const ctx = {
  console, Math,
  window: { addEventListener() {}, removeEventListener() {} },
  document: {
    getElementById: () => el(), querySelector: () => el(), querySelectorAll: () => [],
    createElement: () => el(), body: { addEventListener() {}, appendChild() {} }, addEventListener() {}
  },
  Sfx: { playHeroHit() {}, playClick() {}, warmup() {}, playAttack() {}, playDeath() {} },
  Bgm: { toggle() {}, isOn: () => false, start() {} },
  requestAnimationFrame: () => 0,
  localStorage: { getItem: () => null, setItem() {} },
  alert: () => {}, Image: function () {}
};
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(path.join(root, 'js/cards-data.js'), 'utf8') +
  '\nthis.CARDS=CARDS;this.CARD_MAP=Object.fromEntries(CARDS.map(c=>[c.id,c]));this.TRIBES=TRIBES;this.ABILITY_KEYS=ABILITY_KEYS;',
  ctx
);
vm.runInContext(fs.readFileSync(path.join(root, 'js/combat.js'), 'utf8'), ctx);
const game = fs.readFileSync(path.join(root, 'js/game.js'), 'utf8');
const cut = game.indexOf('document.getElementById("btnAi")');
vm.runInContext(game.slice(0, cut > 0 ? cut : game.length), ctx);
vm.runInContext('function log(){}', ctx);
vm.runInContext(`state={
  p1:{name:'P1',hp:30,maxHp:30,mana:10,maxMana:10,board:[],hand:[],deck:['e1','e2','e3','e4','e5'],grave:[]},
  p2:{name:'P2',hp:30,maxHp:30,mana:10,maxMana:10,board:[],hand:[],deck:['e1','e2','e3','e4','e5'],grave:[]},
  turn:1,active:'p1'
};`, ctx);

function st() { return vm.runInContext('state', ctx); }
function summon(p, id) {
  const m = ctx.cloneCard(id);
  m.canAttack = true; m.attacksLeft = 1;
  p.board.push(m);
  return m;
}
let failed = 0;
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); failed++; } else console.log('OK:', m); };

{
  const p = st().p1; p.board = []; p.hand = []; p.deck = ['e3'];
  summon(p, 'e11');
  ctx.resolvePlayAbility(p, p.board[0]);
  assert(p.hand.length === 1, '출전 draws');
}
{
  const p = st().p1; p.board = [];
  const a = summon(p, 'e8'); a.atk = 3;
  summon(p, 'f21');
  ctx.resolvePlayAbility(p, p.board[1]);
  assert(a.atk === 4, '고무 ATK+1');
}
{
  const p = st().p1; p.board = [];
  const a = summon(p, 'e8'); a.def = 5;
  summon(p, 'a21');
  ctx.resolvePlayAbility(p, p.board[1]);
  assert(a.def === 5, '결속 clamp 0–5');
}
{
  const p = st().p1, e = st().p2; p.board = []; e.board = [];
  const foe = summon(e, 'e8'); foe.atk = 1;
  summon(p, 'e44');
  ctx.resolvePlayAbility(p, p.board[0]);
  assert(foe.atk === 0, '위압 floor 0');
}
{
  const p = st().p1; p.board = [];
  const m = summon(p, 'a24');
  const hp = m.hp;
  ctx.damageMinion(p, m, 3, {});
  assert(m.hp === hp && m.ability === null, '보호 absorb');
}
{
  const p = st().p1; p.board = []; p.hand = []; p.deck = ['e3'];
  const m = summon(p, 'e15');
  m.hp = 0; m.dying = true; m._deathCtx = { fromSpell: true };
  ctx.resolveDeath(p, m);
  assert(p.hand.length === 1, '유언 draw');
}
{
  const p = st().p1, e = st().p2; p.board = []; e.board = [];
  const victim = summon(p, 'e21');
  const killer = summon(e, 'e8');
  victim.hp = 0; victim.dying = true;
  victim._deathCtx = { killer, killerOwner: e, fromSpell: false };
  ctx.resolveDeath(p, victim);
  assert(killer.dying && killer.hp === 0, '복수 kills unit');
}
{
  const p = st().p1; p.board = [];
  const m = summon(p, 'd25');
  m.hp = 0; m.dying = true; m._deathCtx = { fromSpell: true };
  ctx.resolveDeath(p, m);
  assert(m.hp === 1 && m.ability === null, '환생 revive');
}
{
  const p = st().p1, e = st().p2; p.board = []; e.board = [];
  const thief = summon(p, 'd21');
  const prey = summon(e, 'e8');
  thief.hp = 0; thief.dying = true; thief._deathCtx = { fromSpell: true };
  ctx.resolveDeath(p, thief);
  assert(p.board.some(x => x.uid === prey.uid), '강탈 steal');
}
assert(typeof ctx.doAttack === 'function', 'doAttack wired');
assert(ctx.ABILITY_KEYS.length === 10, '10 abilities');
assert(ctx.CARDS.find(c => c.name === '마초').ability === '복수', '마초 복수');
assert(ctx.CARDS.find(c => c.name === '여포').ability === '강탈', '여포 강탈');
assert(ctx.CARDS.find(c => c.name === '라이').ability === '출전', '라이 출전');
assert(ctx.CARDS.find(c => c.name === '스파이더').ability === '유언', '스파이더 유언');

if (failed) { console.error(failed + ' failures'); process.exit(1); }
console.log('All ability wiring smoke tests passed.');
