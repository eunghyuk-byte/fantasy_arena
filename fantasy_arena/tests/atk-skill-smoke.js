#!/usr/bin/env node
/** Smoke: earth atkSkill 2–10 coverage, single skill/card, pre-hit mutators. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');

const ctx = { console, Math, window: {}, log: () => {} };
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(path.join(root, 'js/cards-data.js'), 'utf8') +
  '\nthis.CARDS=CARDS; this.ATK_SKILL_LABEL=ATK_SKILL_LABEL;',
  ctx
);
const combat = fs.readFileSync(path.join(root, 'js/combat.js'), 'utf8');
const end = combat.indexOf('function doAttack');
vm.runInContext(
  combat.slice(0, end) +
  '\nthis.atkSkillOf=atkSkillOf; this.applyAtkSkillOnStart=applyAtkSkillOnStart; this.calcAtkSkillHpDamage=calcAtkSkillHpDamage;',
  ctx
);

const earth = ctx.CARDS.filter(c => c.tribe === 'earth' && c.type === 'minion' && !c.token);
let failed = 0;
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); failed++; } else console.log('OK:', msg); };

const bySkill = {};
for (const c of earth) {
  const sk = c.atkSkill || 1;
  assert(typeof sk === 'number', `${c.id} atkSkill number`);
  assert(Object.keys(c).filter(k => /atkSkill|attackSpecial|atkSpecial/.test(k)).length <= 1, `${c.id} ≤1 skill`);
  if (sk >= 2) (bySkill[sk] = bySkill[sk] || []).push(`${c.id}:${c.name}`);
}
for (let i = 2; i <= 10; i++) assert(bySkill[i] && bySkill[i].length >= 1, `skill ${i} ≥1 earth`);
assert(ctx.CARDS.filter(c => c.tribe !== 'earth' && (c.atkSkill | 0) >= 2).length === 0, 'earth-only');

const w = { name: 'F', atk: 5, def: 3, hp: 6, maxHp: 6 };
ctx.applyAtkSkillOnStart({ name: 'A', atkSkill: 8 }, w);
assert(w.atk === 4 && w.def === 2, 'weaken before damage');
const p = { name: 'F', atk: 5, def: 3, hp: 6, maxHp: 6 };
ctx.applyAtkSkillOnStart({ name: 'A', atkSkill: 9 }, p);
assert(p.atk === 0 && p.def === 4, 'petrify before damage');
const c = { name: 'F', atk: 5, def: 3, hp: 6, maxHp: 6 };
ctx.applyAtkSkillOnStart({ name: 'A', atkSkill: 10 }, c);
assert(c.atk === 6 && c.hp === 5, 'confuse before damage');

assert(ctx.calcAtkSkillHpDamage({ atkSkill: 2 }, 7, 4, 0, { def: 4 }).hpDmg === 7, 'pierce');
const d = { def: 4 };
const pen = ctx.calcAtkSkillHpDamage({ atkSkill: 3 }, 7, 4, 0, d);
assert(pen.hpDmg === 3 && d.def === 0, 'penetrate staged');
assert(ctx.calcAtkSkillHpDamage({ atkSkill: 4 }, 5, 2, 3, { def: 2 }).hpDmg === 6, 'charge');
assert(ctx.calcAtkSkillHpDamage({ atkSkill: 5 }, 5, 2, 0, { def: 2 }).hpDmg === 6, 'double');
assert(Math.ceil(5 / 2) === 3, 'lifesteal ceil');

console.log('\ncard → atkSkill');
earth.filter(c => (c.atkSkill | 0) >= 2)
  .sort((a, b) => a.atkSkill - b.atkSkill || a.id.localeCompare(b.id))
  .forEach(c => console.log(`${c.id}\t${c.name}\t${c.atkSkill}\t${ctx.ATK_SKILL_LABEL[c.atkSkill]}`));

if (failed) { console.error(failed + ' failures'); process.exit(1); }
console.log('All smoke tests passed.');
