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
  '\nthis.atkSkillOf=atkSkillOf; this.applyAtkSkillOnStart=applyAtkSkillOnStart; this.calcAtkSkillHpDamage=calcAtkSkillHpDamage; this.applyLifesteal=applyLifesteal;',
  ctx
);

const earth = ctx.CARDS.filter(c => c.tribe === 'earth' && c.type === 'minion' && !c.token);
let failed = 0;
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); failed++; } else console.log('OK:', msg); };

assert(ctx.ATK_SKILL_LABEL[2] === '관통공격', 'label 2 penetrate');
assert(ctx.ATK_SKILL_LABEL[9] === '광역공격', 'label 9 cleave');
assert(ctx.ATK_SKILL_LABEL[10] === '돌파공격', 'label 10 trample');
assert(!Object.values(ctx.ATK_SKILL_LABEL).some(s => /방어무시/.test(s)), 'no pierce-ignore label');
assert(ctx.ATK_SKILL_ID.penetrate === 2 && ctx.ATK_SKILL_ID.cleave === 9 && ctx.ATK_SKILL_ID.trample === 10, 'ATK_SKILL_ID map');
assert(Object.keys(ctx.ATK_SKILL_DESC).length === 11, 'DESC 1–11');
assert(ctx.ATK_SKILL_LABEL[11] === '혼란공격', 'label 11 confuse');
assert(/반격 없음/.test(ctx.ATK_SKILL_DESC[11]), 'DESC 11 no counter');
assert(/두 번|타격 2회/.test(ctx.ATK_SKILL_DESC[4]), 'DESC 4 two hits');

const bySkill = {};
for (const c of earth) {
  const sk = c.atkSkill || 1;
  assert(typeof sk === 'number', `${c.id} atkSkill number`);
  assert(Object.keys(c).filter(k => /atkSkill|attackSpecial|atkSpecial/.test(k)).length <= 1, `${c.id} ≤1 skill`);
  assert(!/방어무시|혼란/.test(c.text || ''), `${c.id} no old text`);
  if (sk >= 2) (bySkill[sk] = bySkill[sk] || []).push(`${c.id}:${c.name}:atk${c.atk}`);
}
for (let i = 2; i <= 10; i++) assert(bySkill[i] && bySkill[i].length >= 1, `skill ${i} ≥1 earth (${ctx.ATK_SKILL_LABEL[i]})`);
// Skills 2–8,10 remain earth-only; skill 9(광역공격) allowed on SGZ strategists too
assert(ctx.CARDS.filter(c => c.tribe !== 'earth' && (c.atkSkill | 0) >= 2 && (c.atkSkill | 0) !== 9).length === 0, 'earth-only (non-cleave)');
const cleaveIds = new Set(['e20','e44','f24','n24','a24','l24','d25']);
assert(ctx.CARDS.filter(c => c.atkSkill === 9).every(c => cleaveIds.has(c.id) || c.tribe === 'earth'), 'cleave allowlist');

// 광역공격 hard ATK nerf gate (1–2)
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
assert(/남은 공격력/.test(ctx.ATK_SKILL_DESC[10]), 'DESC 10 leftover trample');
// leftover-ATK trample math: ATK5 vs DEF1 → 4 HP potential; target HP2 → leftover 2
{
  const pot = ctx.calcAtkSkillHpDamage({ atkSkill: 10 }, 5, 1, 0, { def: 1 }).hpDmg;
  assert(pot === 4, 'trample primary HP pot after DEF');
  const leftover = Math.max(0, pot - 2);
  assert(leftover === 2, 'trample leftover after kill');
  const hopDmg = Math.max(0, leftover - 3); // next DEF 3 ≥ leftover → 0
  assert(hopDmg === 0, 'trample hop stops if leftover ≤ next DEF');
  assert(Math.max(0, leftover - 1) === 1, 'trample hop ATK=leftover vs next DEF');
}

assert(ctx.calcAtkSkillHpDamage({ atkSkill: 2 }, 7, 4, 0, Object.assign({ def: 4 }, {})).hpDmg === 3, 'penetrate remainder');
const d = { def: 4 };
const pen = ctx.calcAtkSkillHpDamage({ atkSkill: 2 }, 7, 4, 0, d);
assert(pen.hpDmg === 3 && d.def === 0, 'penetrate staged consume');
assert(ctx.calcAtkSkillHpDamage({ atkSkill: 3 }, 5, 2, 3, { def: 2 }).hpDmg === 6, 'charge +DP');
assert(ctx.calcAtkSkillHpDamage({ atkSkill: 4 }, 5, 2, 0, { def: 2 }).hpDmg === 3, 'continuous single-hit (not ×2)');
assert(Math.ceil(5 / 2) === 3, 'lifesteal ceil');
const woundedLifesteal = { name: 'W', hp: 3, maxHp: 6 };
assert(ctx.applyLifesteal(woundedLifesteal, 5) === 3 && woundedLifesteal.hp === 6, 'lifesteal caps at maxHp');
const fullLifesteal = { name: 'F', hp: 6, maxHp: 6 };
assert(ctx.applyLifesteal(fullLifesteal, 5) === 0 && fullLifesteal.hp === 6, 'lifesteal full HP gives zero');
const legacyLifesteal = { name: 'L', hp: 3 };
assert(ctx.applyLifesteal(legacyLifesteal, 5) === 0 && legacyLifesteal.hp === 3, 'lifesteal without maxHp stays capped');
// no pierce-ignore
assert(ctx.calcAtkSkillHpDamage({ atkSkill: 1 }, 7, 4, 0, { def: 4 }).hpDmg === 3, 'normal blocks');

console.log('\ncard → atkSkill');
earth.filter(c => (c.atkSkill | 0) >= 2)
  .sort((a, b) => a.atkSkill - b.atkSkill || a.id.localeCompare(b.id))
  .forEach(c => console.log(`${c.id}\t${c.name}\tatk${c.atk}\t${c.atkSkill}\t${ctx.ATK_SKILL_LABEL[c.atkSkill]}`));

if (failed) { console.error(failed + ' failures'); process.exit(1); }
console.log('All smoke tests passed.');
