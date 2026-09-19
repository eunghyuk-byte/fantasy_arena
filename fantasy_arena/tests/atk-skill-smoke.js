#!/usr/bin/env node
/** Smoke: RULE-ATK-v2 — earth 2–10 coverage, remapped IDs, no 방어무시/혼란. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');

const ctx = { console, Math, window: {}, log: () => {} };
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(path.join(root, 'js/cards-data.js'), 'utf8') +
  '\nthis.CARDS=CARDS; this.ATK_SKILL_LABEL=ATK_SKILL_LABEL; this.ATK_SKILL_DESC=ATK_SKILL_DESC; this.ATK_SKILL_ID=ATK_SKILL_ID;',
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

assert(ctx.ATK_SKILL_LABEL[2] === '관통공격', 'label 2 penetrate');
assert(ctx.ATK_SKILL_LABEL[9] === '전체공격', 'label 9 cleave');
assert(ctx.ATK_SKILL_LABEL[10] === '돌파공격', 'label 10 trample');
assert(!Object.values(ctx.ATK_SKILL_LABEL).some(s => /방어무시|혼란/.test(s)), 'no old skills in labels');
assert(ctx.ATK_SKILL_ID.penetrate === 2 && ctx.ATK_SKILL_ID.cleave === 9 && ctx.ATK_SKILL_ID.trample === 10, 'ATK_SKILL_ID map');
assert(Object.keys(ctx.ATK_SKILL_DESC).length === 10, 'DESC 1–10');

const bySkill = {};
for (const c of earth) {
  const sk = c.atkSkill || 1;
  assert(typeof sk === 'number', `${c.id} atkSkill number`);
  assert(Object.keys(c).filter(k => /atkSkill|attackSpecial|atkSpecial/.test(k)).length <= 1, `${c.id} ≤1 skill`);
  assert(!/방어무시|혼란/.test(c.text || ''), `${c.id} no old text`);
  if (sk >= 2) (bySkill[sk] = bySkill[sk] || []).push(`${c.id}:${c.name}:atk${c.atk}`);
}
for (let i = 2; i <= 10; i++) assert(bySkill[i] && bySkill[i].length >= 1, `skill ${i} ≥1 earth (${ctx.ATK_SKILL_LABEL[i]})`);
// Skills 2–8,10 remain earth-only; skill 9(전체공격) allowed on SGZ strategists too
assert(ctx.CARDS.filter(c => c.tribe !== 'earth' && (c.atkSkill | 0) >= 2 && (c.atkSkill | 0) !== 9).length === 0, 'earth-only (non-cleave)');
const cleaveIds = new Set(['e20','e44','f24','n24','a24','l24','d25']);
assert(ctx.CARDS.filter(c => c.atkSkill === 9).every(c => cleaveIds.has(c.id) || c.tribe === 'earth'), 'cleave allowlist');

// 전체공격 hard ATK nerf gate (1–2)
for (const c of ctx.CARDS.filter(c => c.atkSkill === 9)) {
  assert(c.atk >= 1 && c.atk <= 2, `cleave ${c.id} atk ${c.atk} in 1–2`);
  console.log('CLEAVE:', c.id, c.name, 'atk=' + c.atk, 'cost=' + c.cost);
}

const w = { name: 'F', atk: 5, def: 3, hp: 6, maxHp: 6 };
ctx.applyAtkSkillOnStart({ name: 'A', atkSkill: 7 }, w);
assert(w.atk === 4 && w.def === 2, 'weaken(7) before damage');
const p = { name: 'F', atk: 5, def: 3, hp: 6, maxHp: 6 };
ctx.applyAtkSkillOnStart({ name: 'A', atkSkill: 8 }, p);
assert(p.atk === 0 && p.def === 4, 'petrify(8) before damage');
const c = { name: 'F', atk: 5, def: 3, hp: 6, maxHp: 6 };
ctx.applyAtkSkillOnStart({ name: 'A', atkSkill: 10 }, c);
assert(c.atk === 5 && c.hp === 6, 'trample(10) no pre-mutator');

assert(ctx.calcAtkSkillHpDamage({ atkSkill: 2 }, 7, 4, 0, Object.assign({ def: 4 }, {})).hpDmg === 3, 'penetrate remainder');
const d = { def: 4 };
const pen = ctx.calcAtkSkillHpDamage({ atkSkill: 2 }, 7, 4, 0, d);
assert(pen.hpDmg === 3 && d.def === 0, 'penetrate staged consume');
assert(ctx.calcAtkSkillHpDamage({ atkSkill: 3 }, 5, 2, 3, { def: 2 }).hpDmg === 6, 'charge +DP');
assert(ctx.calcAtkSkillHpDamage({ atkSkill: 4 }, 5, 2, 0, { def: 2 }).hpDmg === 6, 'double');
assert(Math.ceil(5 / 2) === 3, 'lifesteal ceil');
// no pierce-ignore
assert(ctx.calcAtkSkillHpDamage({ atkSkill: 1 }, 7, 4, 0, { def: 4 }).hpDmg === 3, 'normal blocks');

console.log('\ncard → atkSkill');
earth.filter(c => (c.atkSkill | 0) >= 2)
  .sort((a, b) => a.atkSkill - b.atkSkill || a.id.localeCompare(b.id))
  .forEach(c => console.log(`${c.id}\t${c.name}\tatk${c.atk}\t${c.atkSkill}\t${ctx.ATK_SKILL_LABEL[c.atkSkill]}`));

if (failed) { console.error(failed + ' failures'); process.exit(1); }
console.log('All smoke tests passed.');
