/** v0.379: 이 유닛이 지금 죽으면 환생하는지 (game.js resolveDeath의 hasRebirth와 같은 판정 · 아이템 능력 포함). */
function combatWillRebirth(m) {
  if (!m) return false;
  const ab = (typeof abilityOf === "function") ? abilityOf(m) : m.ability;
  const abs = (typeof abilityList === "function") ? abilityList(m) : String(ab || "").split(",").map(x => x.trim()).filter(Boolean);
  return (ab && String(ab).includes("환생")) || abs.includes("환생") || (m.keywords || []).includes("rebirth");
}
function atkSkillOf(m) {
  const v = m && m.atkSkill;
  return (v >= 2 && v <= 11) ? (v | 0) : 1;
}


function applyLifesteal(attacker, hpDealt) {
  if (!attacker || hpDealt <= 0 || attacker.hp <= 0 || attacker.dying) return 0;
  const heal = hpDealt; // v0.353 확정 규칙: 준 체력 피해만큼 회복 (옛: 절반 올림)
  const cap = (attacker.maxHp != null && attacker.maxHp > 0) ? attacker.maxHp : attacker.hp;
  const before = attacker.hp;
  attacker.hp = Math.min(cap, before + heal);
  const got = attacker.hp - before;
  if (got > 0) log(`${attacker.name} 흡혈 +${got}`);
  else log(`${attacker.name} 흡혈 0 (풀피)`);
  return got;
}

/** Pre-hit foe mutators: weaken(7) / petrify(8). Minion targets only. */
function applyAtkSkillOnStart(attacker, def) {
  if (!def) return;
  const sk = atkSkillOf(attacker);
  if (sk === 7) {
    def.atk = Math.max(0, (def.atk || 0) - 1);
    def.def = Math.max(0, (def.def || 0) - 1);
    log(`${attacker.name} 약화공격 → ${def.name} 공·방 -1`);
  } else if (sk === 8) {
    def.atk = 0;
    // 석화 방+1은 5까지만 올리되, 이미 5를 넘는 방어(아이템·스펠)는 깎지 않음
    def.def = Math.max(0, Math.max(def.def || 0, Math.min(5, (def.def || 0) + 1)));
    log(`${attacker.name} 석화공격 → ${def.name} 공=0 방+1`);
  }
}

/**
 * Resolve outbound HP damage for attacker specials.
 * 2 penetrate · 3 charge · else normal block with rolled/current DP.
 * Continuous(4) is two separate hits in doAttack — not ×2 here.
 */
function calcAtkSkillHpDamage(attacker, aAtk, blocked, aDefVal, def) {
  const sk = atkSkillOf(attacker);
  let raw = Math.max(0, aAtk);
  if (sk === 3) raw += Math.max(0, aDefVal || 0); // charge: + attacker DP
  let hpDmg = 0;
  let absorbed = 0;
  if (sk === 2) { // pierce: consume permanent DEF pool, remainder to HP
    const pool = Math.max(0, (def && def.def) || 0);
    absorbed = Math.min(pool, raw);
    if (def) def.def = pool - absorbed;
    hpDmg = raw - absorbed;
  } else {
    absorbed = Math.min(Math.max(0, blocked || 0), raw);
    hpDmg = Math.max(0, raw - Math.max(0, blocked || 0));
  }
  return { hpDmg, absorbed, skill: sk, raw };
}

function combatKillCtx(attacker, owner) {
  return { killer: attacker, killerOwner: owner, fromSpell: false };
}

const combatOwners = new WeakMap();
const combatDeathPending = new WeakSet();
function combatDeathClass(unit) { return combatDeathPending.has(unit) ? 'combat-death-hidden' : 'rip'; }
async function doAttack(p, attacker, target, auto) {
  const owner = state;
  if (combatOwners.has(owner)) return;
  const token = {};
  const hiddenDeaths = new Set();
  const gen = typeof CombatFx !== 'undefined' ? CombatFx.generation() : 0;
  const valid = () => state === owner && combatOwners.get(owner) === token && (typeof CombatFx === 'undefined' || CombatFx.generation() === gen);
  const guard = () => { if (!valid()) throw new Error('Combat cancelled'); };
  combatOwners.set(owner, token);
  const wasBusy = owner.busy;
  owner.busy = true;
  let unsubscribe = () => {};
  const cancelled = new Promise(resolve => { if(typeof CombatFx !== 'undefined') unsubscribe = CombatFx.onCancel(resolve); });
  try { await Promise.race([doAttackCore(p, attacker, target, auto, {valid,guard,hiddenDeaths}), cancelled]); }
  catch (e) { if (valid()) console.warn('Combat action failed', e); }
  finally {
    unsubscribe();
    for (const unit of hiddenDeaths) combatDeathPending.delete(unit);
    if (combatOwners.get(owner) === token) { combatOwners.delete(owner); if (state === owner) owner.busy = wasBusy; }
  }
}
function doAttackCore(p, attacker, target, auto, action) {
  return new Promise(resolve => {
  if (!attacker || attacker.hp <= 0) { resolve(); return; }
  // R7: auto combat must obey the same attack rights as manual attacks
  if (!attacker.canAttack || attacker.attacksLeft <= 0) { resolve(); return; }
  const legal = attackTargets(p, attacker);
  const ok = legal.some(t => t.kind === target.kind && (t.kind === "hero" || t.minion.uid === target.minion.uid));
  if (!ok) { resolve(); return; }
  attacker.attacksLeft -= 1;
  attacker.canAttack = attacker.attacksLeft > 0;
  try { attacker._atkTurn = (state.turnSerial | 0); } catch (e) {} // v0.342: 이번 턴 공격함 (침묵 즉시 공격권 판정)

  // v0.317 「공격:」 아이템 (내 턴 공격 선언 시 · 코인 판정 전)
  if (attacker._itemFx && typeof applyItemAttackFx === "function") {
    applyItemAttackFx(p, attacker);
    if (!(attacker.hp > 0) || attacker.dying || !p.board.includes(attacker)) { render(); resolve(); return; }
    if (target.kind === "minion" && !(target.minion && target.minion.hp > 0 && !target.minion.dying && target.owner.board.includes(target.minion))) {
      // 선공 효과로 대상이 사라지면 다음 생존 적(유닛, 없으면 영웅)으로 재지정
      const nextL = attackTargets(p, attacker);
      const nm = nextL.find(t => t.kind === "minion" && t.minion.hp > 0 && !t.minion.dying);
      const nh = nextL.find(t => t.kind === "hero");
      if (nm) target = nm;
      else if (nh) target = nh;
      else { render(); resolve(); return; }
      log(`${attacker.name} 대상 재지정 → ${target.kind === "hero" ? "영웅" : target.minion.name}`);
    }
  }

  const deaths = new Map();
  const shots = new Map();
  function holdDeath(unit) {
    if (!shots.has(unit) && typeof CombatFx !== 'undefined') shots.set(unit, CombatFx.snapshot(unit.uid));
    combatDeathPending.add(unit); action.hiddenDeaths.add(unit);
  }
  async function pause(ms) { await waitMs(ms); action.guard(); }
  async function deathGroup(units) {
    action.guard();
    const fresh=units.filter(unit=>!(deaths.has(unit)&&deaths.get(unit)===unit._deathCtx));
    if(!fresh.length)return;
    for(const unit of fresh){deaths.set(unit,unit._deathCtx);holdDeath(unit);}
    render();
    if(typeof CombatFx !== 'undefined'){
      const snapshots=fresh.map(unit=>shots.get(unit)).filter(Boolean);
      const result=await CombatFx.play('death',{snapshots,valid:action.valid});
      action.guard();if(result.error)throw result.error;
    }
  }
  async function death(unit) { return deathGroup([unit]); }
  async function strike(kind, unit, el, amount, apply) {
    action.guard();
    const shield = unit && (hasOwnAbility(unit, '보호') || (unit.keywords || []).includes('shield'));
    const blocked = amount <= 0 || shield;
    const shot = typeof CombatFx !== 'undefined' ? CombatFx.snapshot(unit && unit.uid, el) : null;
    if (unit) shots.set(unit, shot);
    let applied = false, dealt = 0;
    const health = unit || target.owner;
    const impact = () => {
      if (applied) return dealt;
      action.guard(); applied = true;
      const before = Math.max(0, Number(health.hp) || 0);
      apply();
      dealt = Math.max(0, before - Math.max(0, Number(health.hp) || 0));
      return dealt;
    };
    if (typeof CombatFx !== 'undefined') {
      const sourceEl = kind === 'counter' ? Vfx.elOf(def && def.uid) : Vfx.elOf(attacker.uid);
      const result = await CombatFx.play(blocked ? 'defend' : 'attack', {snapshot:shot,el,sourceEl,attempted:true,damage:blocked?0:amount,valid:action.valid,onImpact:impact});
      action.guard(); if(result.error)throw result.error;
    } else impact();
    if(unit && (unit.hp<=0 || unit.dying)) await death(unit);
  }
  const sk0 = atkSkillOf(attacker);
  // ON ATTACK START: weaken / petrify before rolls (primary only; aoe applies per-target without 7/8)
  if (target.kind === "minion" && target.minion && sk0 !== 9) {
    applyAtkSkillOnStart(attacker, target.minion);
  }

  function sharedDetail(unit, roll, atkVal, defVal, hpVal, hpFrom) {
    const bits = [];
    if (hpFrom == null) hpFrom = hpVal - roll.dHp;
    const L = (typeof effectiveCoinLinks === "function") ? effectiveCoinLinks(unit) : unit; // v0.322
    if (L.atkC) bits.push(`공 ${unit.atk}→<b>${atkVal}</b> (${roll.dAtk >= 0 ? "+" : ""}${roll.dAtk})`);
    if (L.defC) bits.push(`방 ${unit.def || 0}→<b>${defVal}</b> (${roll.dDef >= 0 ? "+" : ""}${roll.dDef})`);
    if (L.hpC) bits.push(`체 ${hpFrom}→<b>${hpVal}</b> (${roll.dHp >= 0 ? "+" : ""}${roll.dHp})`);
    return bits.join(" · ") || `앞면 ${roll.heads}/${roll.n}`;
  }

  const aShared = turnCoinRoll(attacker);
  let aAtk = clampAtk((Number(attacker.atk) || 0) + aShared.dAtk);
  // v0.350 「공격: 공격+2」(불꽃검·분노의해머): 연속공격은 타격마다 발동 → 두 번째 타격 전에 한 번 더
  const retriggerAtkPlus = () => {
    if (attacker._itemFx !== "attack_atk_plus2" || p !== current()) return;
    applyItemAttackFx(p, attacker);
    aAtk += 2;
    if (attacker._fxAtk != null) attacker._fxAtk = aAtk;
  };
  const aDefVal = clampDef((Number(attacker.def) || 0) + aShared.dDef, attacker.def);
  const aHpSnap = beginCombatHpCoin(attacker, aShared.dHp);
  const rows = [];
  if (aShared.flips.length && !aShared.reused) {
    rows.push({
      label: attacker.name,
      modLabel: "",
      flips: aShared.flips,
      delta: aShared.heads,
      detail: sharedDetail(attacker, aShared, aAtk, aDefVal, attacker.hp, aHpSnap ? aHpSnap.pre : null)
    });
  }

  let dAtk = 0, def = null, dHpSnap = null, dShared = null, defVal = 0;
  if (target.kind === "minion") {
    def = target.minion;
    // 광역(9): counter primary = board front (first living)
    if (sk0 === 9) {
      const front = opponent(p).board.find(m => m.hp > 0 && !m.dying);
      if (front) def = front;
    }
    dShared = turnCoinRoll(def);
    dAtk = clampAtk((Number(def.atk) || 0) + dShared.dAtk);
    defVal = clampDef((Number(def.def) || 0) + dShared.dDef, def.def);
    dHpSnap = beginCombatHpCoin(def, dShared.dHp);
    if (dShared.flips.length && !dShared.reused) {
      rows.push({
        label: def.name,
        modLabel: "",
        flips: dShared.flips,
        delta: dShared.heads,
        detail: sharedDetail(def, dShared, dAtk, defVal, def.hp, dHpSnap ? dHpSnap.pre : null)
      });
    }
    window._pendingDef = defVal;
    window._pendingAtkDef = aDefVal;
  } else {
    // hero face: still roll attacker shared coin (already done); keep attacker DEF for charge
    window._pendingDef = 0;
    window._pendingAtkDef = aDefVal;
  }

  // Each defender lifetime gets one temporary HP application per exchange.
  // Rebirth clears _turnRoll, so the same object becomes a fresh participant.
  const defenderCoins = new Map();
  if (def) defenderCoins.set(def, { roll: def._turnRoll, snap: dHpSnap });

  const skLabel = (typeof ATK_SKILL_HELP !== "undefined" && ATK_SKILL_HELP[atkSkillOf(attacker)])
    ? ATK_SKILL_HELP[atkSkillOf(attacker)][0] : "";
  log(`${attacker.name} 공유코인 N=${aShared.n} 앞면${aShared.heads}` + (aShared.reused ? " (이번 턴 결과)" : "") + ` → 공 ${aAtk}` + (atkSkillOf(attacker) > 1 ? ` [${skLabel}]` : ""));
  // v0.369: 코인 듀얼 오버레이용 — 두 카드(공격자·방어자)와 코인 전 체력
  if (rows[0] && aShared.flips.length && !aShared.reused) rows[0].unit = attacker;
  if (def && dShared && dShared.flips.length && !dShared.reused) rows[rows.length - 1].unit = def;
  const duel = {
    attacker, attackerOwner: p, defender: target.kind === "minion" ? def : null,
    aHpPre: aHpSnap ? aHpSnap.pre : attacker.hp, dHpPre: dHpSnap ? dHpSnap.pre : (def ? def.hp : null),
    aStats: { atk: aAtk, def: aDefVal, hp: attacker.hp },
    dStats: def ? { atk: dAtk, def: defVal, hp: def.hp } : null
  };
  for (const snap of [aHpSnap, dHpSnap]) if (snap && snap.coinKilled) holdDeath(snap.unit);
  showCoinResult("코인 배틀", rows, async () => {
    try {
    action.guard();
    // Temp combat presentation: bake rolled values on face numbers + ±Δ overlays ABOVE gems (no 「공 N」)
    function armFx(u, atkVal, defV, dA, dD, dH) {
      if (!u) return;
      u._fxAtk = atkVal;
      u._fxDef = defV;
      u._fxHp = u.hp; // beginCombatHpCoin already applied dHp
      u._fxAtkD = dA || 0;
      u._fxDefD = dD || 0;
      u._fxHpD = dH || 0;
    }
    async function prepareDefenderCoins(unit) {
      action.guard();
      const existing = defenderCoins.get(unit);
      if (existing && existing.roll === unit._turnRoll) return existing;
      const roll = turnCoinRoll(unit);
      const snap = beginCombatHpCoin(unit, roll.dHp);
      const entry = { roll: unit._turnRoll, snap };
      defenderCoins.set(unit, entry);
      const atk = clampAtk((Number(unit.atk) || 0) + roll.dAtk);
      const dp = clampDef((Number(unit.def) || 0) + roll.dDef, unit.def);
      armFx(unit, atk, dp, roll.dAtk, roll.dDef, roll.dHp);
      if (snap && snap.coinKilled) holdDeath(unit);
      if (roll.flips.length && !roll.reused) {
        const extraRows = [{ label: unit.name, unit, modLabel: "", flips: roll.flips,
          delta: roll.heads, detail: sharedDetail(unit, roll, atk, dp, unit.hp, snap ? snap.pre : null) }];
        await new Promise(done => showCoinResult("코인 배틀", extraRows, done, {
          attacker, attackerOwner: p, defender: unit,
          aHpPre: attacker.hp, dHpPre: snap ? snap.pre : unit.hp,
          aStats: { atk: aAtk, def: window._pendingAtkDef ?? aDefVal, hp: attacker.hp },
          dStats: { atk, def: dp, hp: unit.hp }
        }));
        action.guard();
      }
      if (snap && snap.coinKilled) {
        log(`${unit.name} 코인으로 체력 0 · 전투 전 파괴`);
        await death(unit);
      }
      return entry;
    }
    armFx(attacker, aAtk, aDefVal, aShared.dAtk, aShared.dDef, aShared.dHp);
    if (target.kind === "minion" && def) {
      armFx(def, dAtk, defVal, (dShared && dShared.dAtk) || 0, (dShared && dShared.dDef) || 0, (dShared && dShared.dHp) || 0);
    }
    render();
    await pause(280);
    const atkEl = Vfx.elOf(attacker.uid);
    let aDefNow = window._pendingAtkDef || 0;
    const sk = atkSkillOf(attacker);
    const foe = opponent(p);

    /**
     * v0.374 반격: 반격하는 유닛(cu)의 공격 능력을 공격할 때와 같게 적용해 공격자에게 반격.
     * - 관통·돌진·치명·흡혈·약화·석화: 공격 때와 같은 계산 (calcAtkSkillHpDamage / applyAtkSkillOnStart 공용)
     * - 연속: 공격자에게 두 번 (첫 반격으로 처치하면 끝 · 다음 유닛·영웅으로 이어지지 않음)
     * - 광역: 퍼지지 않음 → 공격자 하나에게 일반 반격
     * 약화·석화·관통으로 공격자의 공·방이 바뀌면 이번 전투의 남은 타격(연속 2타·다음 반격 방어)에도 반영.
     */
    async function counterAttack(cu, cuOwner, cAtk, cDefVal) {
      const csk = atkSkillOf(cu);
      const hits = csk === 4 ? 2 : 1;
      const skName = (csk > 1 && csk !== 9 && typeof ATK_SKILL_HELP !== "undefined" && ATK_SKILL_HELP[csk]) ? ATK_SKILL_HELP[csk][0] : "";
      for (let h = 1; h <= hits; h++) {
        if (!(attacker.hp > 0) || attacker.dying || !p.board.includes(attacker)) break;
        if (!(cu.hp > 0) || cu.dying) break;
        const oa = Number(attacker.atk) || 0, od = Number(attacker.def) || 0;
        const syncAttackerStats = () => {
          const dA = (Number(attacker.atk) || 0) - oa;
          const dD = (Number(attacker.def) || 0) - od;
          if (dA) { aAtk = Math.max(0, aAtk + dA); attacker._fxAtk = aAtk; }
          if (dD) {
            window._pendingAtkDef = Math.max(0, (window._pendingAtkDef || 0) + dD);
            aDefNow = window._pendingAtkDef;
            attacker._fxDef = aDefNow;
          }
        };
        if (csk === 7 || csk === 8) { applyAtkSkillOnStart(cu, attacker); syncAttackerStats(); }
        const backBlock = window._pendingAtkDef || 0;
        const odPierce = Number(attacker.def) || 0;
        const calc = calcAtkSkillHpDamage(cu, cAtk, backBlock, cDefVal, attacker);
        if (csk === 2 && (Number(attacker.def) || 0) !== odPierce) {
          const dD = (Number(attacker.def) || 0) - odPierce;
          window._pendingAtkDef = Math.max(0, (window._pendingAtkDef || 0) + dD);
          aDefNow = window._pendingAtkDef;
          attacker._fxDef = aDefNow;
        }
        const dmg = calc.hpDmg;
        if (hits > 1) log(`${cu.name} 연속 반격 ${h}/${hits}`);
        if (dmg <= 0) {
          await strike('counter', attacker, Vfx.elOf(attacker.uid), 0, () => {});
          render();
          log(`${cu.name} 반격` + (skName ? ` [${skName}]` : "") + (csk === 2 ? ` (관통 흡수 ${calc.absorbed})` : "") + ` → 체력피해 0`);
          continue;
        }
        log(`${cu.name} 반격` + (skName ? ` [${skName}]` : "") + (csk === 2 ? ` (관통 흡수 ${calc.absorbed})` : ""));
        const atkNow = Vfx.elOf(attacker.uid);
        const defNow = Vfx.elOf(cu.uid);
        const cCrit = csk === 5 || dmg >= cAtk + 2;
        await strike("counter", attacker, atkNow, dmg, () => {
        const hpBefore = attacker.hp;
        if (csk === 5) {
          const shielded = hasOwnAbility(attacker, "보호") || (attacker.keywords || []).includes("shield");
          damageMinion(p, attacker, Math.max(dmg, attacker.hp), combatKillCtx(cu, cuOwner));
          if (!shielded) log(`${cu.name} 치명 반격 → ${attacker.name} 즉사`);
        } else {
          damageMinion(p, attacker, dmg, combatKillCtx(cu, cuOwner));
        }
        const dealt = Math.max(0, hpBefore - Math.max(0, attacker.hp));
        if (csk === 6) applyLifesteal(cu, dealt);
        });
        render();
        action.guard();
      }
      if (!(attacker.hp > 0) || attacker.dying) log(`${attacker.name} 반격으로 격파`);
    }

    // v0.311: 체 코인으로 0 이하 → 공격·방어 피해 교환 전에 파괴 (공격은 사용됨, 반격·영웅 피해 없음)
    // v0.312: 광역(9)은 맨 앞 방어자만 코인 사망이면 나머지 적에게 그대로 발동 (공격자 코인 사망이면 전부 취소)
    const aCoinDead = !!(aHpSnap && aHpSnap.coinKilled);
    const coinDead = [aHpSnap, dHpSnap].filter(sn => sn && sn.coinKilled).map(sn => sn.unit);
    if (coinDead.length) {
      for(const cu of coinDead) log(`${cu.name} 코인으로 체력 0 · 전투 전 파괴`);
      await deathGroup(coinDead);
      render();
      action.guard();
    }
    const aoeAfterCoin = coinDead.length && !aCoinDead && sk === 9;
    if (coinDead.length && !aoeAfterCoin) {
      // exchange skipped; cleanup below resolves the coin deaths
    } else if (sk === 9 && foe.board.some(m => m.hp > 0 && !m.dying)) {
      // One attacker/front roll; backline never opens a duel or consumes new RNG.
      const victims = foe.board.filter(m => m.hp > 0 && !m.dying).slice();
      const coinDeaths = [];
      for (const vic of victims) {
        if (defenderCoins.has(vic)) continue;
        const saved = storedTurnCoins(vic);
        if (!saved) continue;
        const snap = beginCombatHpCoin(vic, saved.dHp);
        defenderCoins.set(vic, { roll: vic._turnRoll, snap });
        armFx(vic, clampAtk((Number(vic.atk) || 0) + saved.dAtk),
          clampDef((Number(vic.def) || 0) + saved.dDef, vic.def), saved.dAtk, saved.dDef, saved.dHp);
        if (snap && snap.coinKilled) coinDeaths.push(vic);
      }
      if (coinDeaths.length) await deathGroup(coinDeaths);
      action.guard();
      const hits = victims.filter(vic => vic.hp > 0 && !vic.dying).map(vic => {
        const roll = storedTurnCoins(vic);
        const blocked = clampDef((Number(vic.def) || 0) + (roll ? roll.dDef : 0), vic.def);
        const amount = calcAtkSkillHpDamage(attacker, aAtk, blocked, aDefNow, vic).hpDmg;
        const el = Vfx.elOf(vic.uid);
        const snapshot = typeof CombatFx !== 'undefined' ? CombatFx.snapshot(vic.uid, el) : null;
        shots.set(vic, snapshot);
        return { vic, el, snapshot, amount, dealt: 0 };
      });
      log(`${attacker.name} 광역공격 공 ${aAtk} → 적 유닛 ${hits.length}체 동시 피해 · 추가 코인 없음`);
      let applied = false;
      const impactAll = () => {
        if (applied) return;
        action.guard(); applied = true;
        for (const hit of hits) {
          const before = Math.max(0, Number(hit.vic.hp) || 0);
          damageMinion(foe, hit.vic, hit.amount, combatKillCtx(attacker, p));
          hit.dealt = Math.max(0, before - Math.max(0, Number(hit.vic.hp) || 0));
          if (hit.vic.hp <= 0 || hit.vic.dying) holdDeath(hit.vic);
        }
        render();
      };
      if (typeof CombatFx !== 'undefined') {
        // All jobs start together. Their shared, idempotent impact commits all HP changes once.
        const entries = hits.map(hit => {
          const shield = hasOwnAbility(hit.vic, "보호") || (hit.vic.keywords || []).includes("shield");
          const blocked = hit.amount <= 0 || shield;
          return { kind: blocked ? 'defend' : 'attack', opts: {
            snapshot: hit.snapshot, el: hit.el, sourceEl: Vfx.elOf(attacker.uid),
            attempted: true, damage: blocked ? 0 : hit.amount, valid: action.valid,
            onImpact: () => { impactAll(); return hit.dealt; }
          }};
        });
        const results = CombatFx.playBatch ? await CombatFx.playBatch(entries)
          : await Promise.all(entries.map(entry => CombatFx.play(entry.kind, entry.opts)));
        action.guard();
        const failed = results.find(result => result && result.error);
        if (failed) throw failed.error;
      } else impactAll();
      await deathGroup(hits.filter(hit => hit.vic.hp <= 0 || hit.vic.dying).map(hit => hit.vic));
      log(`${attacker.name} 광역공격 · 반격 없음`);
      render();
      action.guard();
    } else if (target.kind === "hero") {
      const hits = (sk === 4) ? 2 : 1;
      for (let hit = 1; hit <= hits; hit++) {
        if (attacker.hp <= 0 || attacker.dying) break;
        if (target.owner.hp <= 0) break;
        if (hit > 1) retriggerAtkPlus();
        const isMeHero = target.owner === meView().me;
        const defEl = Vfx.heroOf(isMeHero);
        const calc = calcAtkSkillHpDamage(attacker, aAtk, 0, aDefNow, null);
        let hpDmg = calc.hpDmg;
        if (hits > 1) log(`${attacker.name} 연속 ${hit}/${hits}`);
        // 영웅: 치명·관통·약화·석화·광역 안 통함 (돌진·흡혈·연속은 통함)
        const crit = hpDmg >= attacker.atk + 3;
        await strike("attack", null, defEl, hpDmg, () => {
        dealHero(target.owner, hpDmg, { sound: false });
        if (sk === 6) applyLifesteal(attacker, hpDmg);
        });
        render();
        action.guard();
      }
    } else {
      // single minion: 연속(4)=two hits with counter each (kill→retarget next living)
      const hits = (sk === 4) ? 2 : 1;
      for (let hit = 1; hit <= hits; hit++) {
        if (attacker.hp <= 0 || attacker.dying) break;
        if (hit > 1) retriggerAtkPlus();
        // 연속: 1타 처치 후 남은 타는 다음 생존 적(유닛→영웅)으로 재지정. 시체/스킵 금지.
        if (!(def && def.hp > 0 && !def.dying)) {
          if (sk !== 4) break;
          const legalNext = attackTargets(p, attacker);
          const nextM = legalNext.find(t => t.kind === "minion" && t.minion && t.minion.hp > 0 && !t.minion.dying);
          const nextH = legalNext.find(t => t.kind === "hero" && t.owner && t.owner.hp > 0);
          if (nextM) {
            def = nextM.minion;
            target = nextM;
            dAtk = clampAtk(Number(def.atk) || 0);
            log(`${attacker.name} 연속 재지정 → ${def.name}`);
          } else if (nextH) {
            log(`${attacker.name} 연속 재지정 → 영웅`);
            const isMeHero = nextH.owner === meView().me;
            const defElH = Vfx.heroOf(isMeHero);
            const calcH = calcAtkSkillHpDamage(attacker, aAtk, 0, aDefNow, null);
            let hpDmgH = calcH.hpDmg;
            if (hits > 1) log(`${attacker.name} 연속 ${hit}/${hits}`);
            const critH = hpDmgH >= attacker.atk + 3;
            await strike("attack", null, defElH, hpDmgH, () => {
            dealHero(nextH.owner, hpDmgH, { sound: false });
            if (sk === 6) applyLifesteal(attacker, hpDmgH);
            });
            render();
            await pause(hits > 1 ? 300 : 420);
            continue;
          } else {
            break;
          }
        }
        const coinState = await prepareDefenderCoins(def);
        action.guard();
        // A retarget that dies to its own HP coin consumes the remaining hit.
        if (coinState.snap && coinState.snap.coinKilled) break;
        const hitRoll = storedTurnCoins(def);
        const blocked = hit === 1 ? (window._pendingDef || 0) : clampDef((Number(def.def) || 0) + (hitRoll ? hitRoll.dDef : 0), def.def);
        const backBlock = window._pendingAtkDef || 0;
        const calc = calcAtkSkillHpDamage(attacker, aAtk, blocked, aDefNow, def);
        let hpDmg = calc.hpDmg;
        if (hits > 1) log(`${attacker.name} 연속 ${hit}/${hits}`);
        log(`${def.name} 방어 ${blocked}` + (sk === 2 ? ` (관통 흡수 ${calc.absorbed})` : "") + ` → 체력피해 ${hpDmg}`);
        const defEl = Vfx.elOf(def.uid);
        const crit = hpDmg >= attacker.atk + 2 || sk === 5;

        await strike("attack", def, defEl, hpDmg, () => {

        const hpBefore = def.hp;
        if (sk === 5 && hpDmg >= 1) {
          damageMinion(target.owner, def, Math.max(hpDmg, def.hp), combatKillCtx(attacker, p));
          log(`${attacker.name} 치명공격 → ${def.name} 즉사`);
        } else {
          damageMinion(target.owner, def, hpDmg, combatKillCtx(attacker, p));
        }
        const hpDealt = Math.max(0, hpBefore - Math.max(0, def.hp));
        if (sk === 6) applyLifesteal(attacker, hpDealt);
        });
        render();
        action.guard();
        const survived = def && def.hp > 0 && !def.dying;
        // counter uses this hit's defender current atk if retargeted mid-연속
        const counterAtk = hit === 1 ? dAtk : clampAtk((Number(def.atk) || 0) + (hitRoll ? hitRoll.dAtk : 0));
        if (survived && counterAtk && attacker.hp > 0 && !attacker.dying) {
          // v0.374: 반격도 공격 능력이 공격할 때와 똑같이 발동 (치명 v0.372 → 전체 확장, 9/29 사용자 확정)
          //   광역 → 퍼지지 않고 공격자에게만 일반 반격 · 연속 → 공격자에게 두 번, 처치하면 이어지지 않음
          const counterDefVal = hit === 1 ? defVal : clampDef((Number(def.def) || 0) + (hitRoll ? hitRoll.dDef : 0), def.def);
          await counterAttack(def, target.owner, counterAtk, counterDefVal);
          // v0.317 「반격:」 아이템 (상대 턴에 반격할 때)
          if (def._itemFx && typeof applyItemCounterFx === "function") applyItemCounterFx(target.owner, def);
        } else if (!survived) {
          log(`${def.name} 격파 · 반격 없음`);
          const deadEl = Vfx.elOf(def.uid);
          await death(def);
          action.guard();
          // v0.379 (9/29 사용자): 연속 1타로 환생 유닛을 처치하면 그 자리에서 바로 환생시키고,
          // 남은 타는 다음 유닛이 아니라 다시 나타난 그 유닛을 때린다.
          if (sk === 4 && hit < hits && combatWillRebirth(def)) {
            combatDeathPending.delete(def); action.hiddenDeaths.delete(def);
            destroyMinion(target.owner, def, { fromSpell: false });
            deaths.delete(def); shots.delete(def);
            render();
            await pause(260);
          }
          // 연속: 남은 타가 있으면 break하지 않고 다음 루프에서 재지정
          if (!(sk === 4 && hit < hits)) break;
        }
      }

    }
    // Fantasy Masters: strip remaining gold HP coin bonus; black/damage already stuck
    settleCombatHpCoin(aHpSnap);
    for (const [unit, entry] of defenderCoins) {
      if (entry.roll === unit._turnRoll) settleCombatHpCoin(entry.snap);
    }
    action.guard();
    const dying = [state.p1,state.p2].flatMap(pl => pl.board.filter(mm => mm.dying));
    await deathGroup(dying);
    action.guard();
    [state.p1, state.p2].forEach(pl => {
      pl.board.filter(mm => mm.dying).forEach(mm => {

        destroyMinion(pl, mm, { fromSpell: false });
      });
      pl._hurt = null;
      pl.board.forEach(mm => {
        mm._hurt = null;
        mm._fxAtk = mm._fxDef = mm._fxHp = null;
        mm._fxAtkD = mm._fxDefD = mm._fxHpD = null;
      });
    });
    attacker._fxAtk = attacker._fxDef = attacker._fxHp = null;
    attacker._fxAtkD = attacker._fxDefD = attacker._fxHpD = null;
    cleanupBoards();
    checkWin();
    render();
    } catch (e) { if(action.valid()) console.warn("Combat callback failed", e); }
    finally { resolve(); }
  }, duel);
  });
}


function checkWin() {
  if (state.over) return;
  if (state.p1.hp <= 0 && state.p2.hp <= 0) finish("무승부");
  else if (state.p1.hp <= 0) finish(state.p2.name);
  else if (state.p2.hp <= 0) finish(state.p1.name);
}

function finish(winner) {
  if (typeof _drag !== "undefined" && _drag) clearDrag();
  state.over = true;
  state.winner = winner;
  const endState = state;
  // v0.365: 승리·패배 v2 연출(비디오+sfx.ogg+dim)이 끝난 뒤 결과 화면. 연출 사운드가 있으니 기존 승/패 효과음은 팩이 없을 때만
  // v0.372: 다른 매치 연출(MY TURN 등)이 재생 중이면 끝난 뒤 시작 · 결과 화면(버튼)은 연출이 완전히 끝난 뒤에만
  const hasFx = typeof SpellFx !== "undefined" && !!SpellFx.playMatch;
  const fxId = winner === "나" ? "victory" : "defeat";
  let releaseEnd = () => {};
  try { if (hasFx && SpellFx.overlayHold) releaseEnd = SpellFx.overlayHold(); } catch (e) {}
  const fxP = !hasFx ? null : (async () => {
    try {
      await Promise.race([waitOthersIdle(), new Promise(r => setTimeout(r, 3500))]);
    } catch (e) {}
    let durMs = 0;
    try { if (SpellFx.matchDurationMs) durMs = await SpellFx.matchDurationMs(fxId); } catch (e) {}
    const p = SpellFx.playMatch(fxId, { skipQueue: true });
    releaseEnd();
    // 연출 끝까지 기다림 (비디오 로드 대기 포함 상한: 길이 + 2초)
    await Promise.race([p, new Promise(r => setTimeout(r, (durMs || 1800) + 2000))]);
  })();
  function waitOthersIdle() {
    // 내 hold(releaseEnd) 하나만 남을 때까지: MY TURN 등 이미 재생 중인 매치 연출이 끝날 때까지
    return new Promise(res => {
      const tick = () => { if (!SpellFx.overlayBusyCount || SpellFx.overlayBusyCount() <= 1) res(); else setTimeout(tick, 50); };
      tick();
    });
  }
  if (!fxP) {
    try {
      if (winner === "나") Sfx.playWin && Sfx.playWin();
      else Sfx.playLose && Sfx.playLose();
    } catch (e) {}
  }
  render();
  const meWin = winner === "나";
  let shown = false;
  const showResult = () => {
    if (shown || state !== endState) return; // 그새 로비로 나갔거나 새 판이면 생략
    shown = true;
    document.getElementById("modal").innerHTML = `
    <h2>${winner === "무승부" ? "무승부" : winner + " 승리"}</h2>
    <p>${meWin ? "상대 영웅을 쓰러뜨렸다." : winner === "무승부" ? "둘 다 쓰러졌다." : "이번엔 패배."}</p>
    <button class="menu-btn" onclick="backTitle()">로비로</button>
  `;
    document.getElementById("overlay").classList.add("show");
  };
  if (fxP && typeof fxP.then === "function") {
    fxP.then(showResult, showResult);
  } else showResult();
}

function clearDrag() {
  document.querySelectorAll(".drag-ghost").forEach(el => el.remove());
  const peek = document.getElementById("cardPeek");
  if (peek) peek.remove();
  if (typeof _drag !== "undefined" && _drag) {
    const session = _drag;
    _drag = null; // Invalidate first: releasing capture can synchronously dispatch lostpointercapture.
    if (session.cleanup) session.cleanup();
    if (session.el) session.el.classList.remove("dragging");
  }
  window._dropSlot = null;
  try { document.body.classList.remove("dragging-card"); } catch (err) {}
  if (typeof placeDropGlow === "function") placeDropGlow(false);
  if (typeof clearEquipHover === "function") clearEquipHover();
  if (typeof clearSpellValid === "function") clearSpellValid();
  if (typeof clearInsertPreview === "function") clearInsertPreview();
}
function hideScreens() {
  try { if (typeof CombatFx !== 'undefined') CombatFx.clear(); } catch (e) {}
  clearDrag();
  document.getElementById("title").classList.remove("active");
  document.getElementById("game").classList.remove("active");
  const db = document.getElementById("deckBuilder");
  if (db) db.classList.remove("active");
  const lb = document.getElementById("lobby"); // v0.331
  if (lb) lb.classList.remove("active");
  const ts = document.getElementById("tribeSelect"); // v0.333
  if (ts) ts.classList.remove("active");
  const sh = document.getElementById("shop"); // v0.334
  if (sh) sh.classList.remove("active");
  document.getElementById("overlay").classList.remove("show");
  // v0.364: 결과 화면이 닫히면 승리·패배 dim 해제
  try { if (typeof SpellFx !== "undefined" && SpellFx.releaseDim) SpellFx.releaseDim(); } catch (e) {}
}
function showGame() {
  hideScreens();
  const g = document.getElementById("game");
  g.classList.add("active");
  g.classList.remove("hud-ready"); // wait for ensureBoardLayouts
  try { Bgm.to("battle", 900); } catch (e) {}
}
function backTitle() {
  hideScreens();
  document.getElementById("title").classList.add("active");
  try { Bgm.to("menu", 800); } catch (e) {}
}
function showBuilder() {
  hideScreens();
  document.getElementById("deckBuilder").classList.add("active");
  try { Bgm.to("menu", 600); } catch (e) {}
  if (!draftDeck.length) {
    const saved = loadSavedDecks()[selectedHero.id];
    draftDeck = Array.isArray(saved) ? saved.slice() : [];
  }
  renderBuilder();
}

/* ---------- AI ---------- */
// Small deterministic AI heuristics. Only our hand and public board/HP/resources are read.
function aiUnitValue(m) { return Math.max(0, m.atk || 0) + Math.max(0, m.hp || 0) * 0.6 + Math.max(0, m.def || 0) + 1; }
function aiDamageValue(m, raw) {
  const n = Math.max(0, raw - Math.max(0, m.def || 0));
  if (!n) return 0;
  if (hasOwnAbility(m, "보호") || (m.keywords || []).includes("shield")) return 1;
  return Math.min(n, Math.max(0, m.hp)) * 1.5 + (n >= m.hp ? aiUnitValue(m) : 0);
}
function aiReadyDamage(p) {
  return p.board.reduce((sum, m) => {
    if (m.hp <= 0 || m.dying || !m.canAttack || m.attacksLeft <= 0 || unitCannotAttack(m)) return sum;
    const roll = storedTurnCoins(m), links = effectiveCoinLinks(m);
    if ((Number(m.atk) || 0) <= 0 && (roll ? roll.dAtk : links.atkC) <= 0) return sum;
    // A lethal shortcut must not assume a favorable unseen coin outcome.
    const delta = roll ? roll.dAtk : Math.min(0, links.atkC);
    let attack = clampAtk((m.atk || 0) + delta);
    const hpDelta = roll ? roll.dHp : Math.min(0, links.hpC);
    if (m.hp + hpDelta <= 0) return sum;
    if (atkSkillOf(m) === 3) attack += clampDef((m.def || 0) + (roll ? roll.dDef : Math.min(0, links.defC)), m.def);
    return sum + attack * (atkSkillOf(m) === 4 ? 2 : 1);
  }, 0);
}
function aiFxValue(p, fx, target, card) {
  if (!fx) return 0;
  const e = opponent(p), foes = e.board.filter(m => m.hp > 0 && !m.dying), mine = p.board.filter(m => m.hp > 0 && !m.dying);
  const t = target && target.minion;
  const enemy = target && target.owner === e;
  const lost = m => Math.max(0, (m.maxHp || m.hp) - m.hp);
  const drawValue = n => Math.min(Math.max(0, n || 0), p.deck.length, Math.max(0, 11 - p.hand.length)) * 2;
  const damageAll = (units, n) => units.reduce((sum, m) => sum + aiDamageValue(m, n), 0);
  const buffValue = m => {
    const attack = Math.max(0, fx.atk || 0) * (m.canAttack && m.attacksLeft > 0 && !unitCannotAttack(m) ? 1.8 : 0.7);
    return attack + Math.max(0, fx.def || 0) * 1.2 + Math.max(0, fx.hp || 0) + (fx.atkSkill && fx.atkSkill !== atkSkillOf(m) ? 2 : 0) + (fx.addDeathrattle ? 2 : 0);
  };
  switch (fx.type) {
    case "dmg": return enemy && t ? aiDamageValue(t, fx.value || 0) + (fx.skipAttack && !t.skipAttack ? Math.max(0, t.atk || 0) : 0) : 0;
    case "kill": case "kill_if": return enemy && t ? aiUnitValue(t) + 4 : 0;
    case "heal_all_full": return mine.reduce((s, m) => s + lost(m), 0) * 1.5;
    case "heal_hero": return Math.min(lost(p), fx.value || 0) * 2;
    case "buff": return target && target.owner === p && t ? buffValue(t) : 0;
    case "buff_all": return mine.reduce((s, m) => s + buffValue(m), 0);
    case "grant_kw": return mine.filter(m => !hasOwnAbility(m, fx.ability) && !(m.keywords || []).includes(fx.kw)).length * 3;
    case "grant_extra": return t && target.owner === p && !unitCannotAttack(t) ? Math.max(0, t.atk || 0) * 2 : 0;
    case "double_def": return t && target.owner === p ? Math.max(0, t.def || 0) * 2 : 0;
    case "draw": return drawValue(fx.value);
    case "draw_ex": return drawValue(fx.drawBoard ? mine.length : fx.draw || 0) + Math.min(lost(p), fx.healHero || 0) - (fx.payHp || 0) * (p.hp <= (fx.payHp || 0) + 3 ? 20 : 1) - damageAll(mine, fx.ownAllHp || 0) + (enemy && t ? aiDamageValue(t, fx.enemyDmg || 0) : 0) - (t && target.owner === p && fx.sacOwn ? aiUnitValue(t) : 0);
    case "aoe_pack": return damageAll(foes, fx.all || fx.enemy || 0) - damageAll(mine, fx.all || fx.own || 0) + mine.length * (fx.ownHp || 0) + drawValue(fx.draw) + (fx.skipAttack ? foes.filter(m => !m.skipAttack).reduce((s, m) => s + Math.max(0, m.atk || 0), 0) : 0);
    case "aoe_enemy": case "aoe_all_enemy": return damageAll(foes, fx.value || 0);
    case "earthquake": return damageAll(foes, fx.by === "hand" ? Math.max(0, p.hand.length - 1) : Math.floor(p.maxSoul / 2));
    case "sandtrap": return damageAll(foes.slice(0, Math.max(0, 5 - mine.length)), 3);
    case "enemy_def_hp_down": case "sandhell": return foes.reduce((s, m) => s + Math.min(m.hp, fx.value || 1) * 1.5 + Math.min(m.def || 0, fx.value || 1) + (fx.type === "sandhell" ? Math.min(m.atk || 0, fx.value || 1) : 0), 0);
    case "wipe_all": return foes.reduce((s, m) => s + aiUnitValue(m), 0) - mine.reduce((s, m) => s + aiUnitValue(m), 0) - Math.abs(fx.maxSoul || 0);
    case "tornado": return foes.filter(m => printedSoul(m) <= fx.maxCost).reduce((s, m) => s + aiUnitValue(m), 0) - mine.filter(m => printedSoul(m) <= fx.maxCost).reduce((s, m) => s + aiUnitValue(m), 0);
    case "sac_own_aoe": return t && target.owner === p ? damageAll(foes, fx.value || 3) - aiUnitValue(t) : 0;
    case "summon_n": case "summon_islands": case "summon_token": {
      const slots = Math.max(0, 5 - mine.length - (card?.type === "minion" ? 1 : 0));
      const count = fx.type === "summon_islands" ? slots : fx.type === "summon_token" ? 1 : (fx.count || 1);
      return Math.min(slots, count) * 3;
    }
    case "copy_own": return t && target.owner === p && mine.length < 5 ? aiUnitValue(t) : 0;
    case "set_one": {
      if (!enemy || !t) return 0;
      if (fx.coinZero) { const l = effectiveCoinLinks(t); return Math.max(0, l.atkC + l.defC + l.hpC); }
      return Math.max(0, (t.atk || 0) - (fx.atk == null ? t.atk : fx.atk)) + Math.max(0, (t.hp || 0) - (fx.hp == null ? t.hp : fx.hp));
    }
    case "soul": return 0; // Coins need a concrete newly affordable follow-up, handled by chooseAiAction.
    case "soul_next": return Math.max(0, fx.value || 0);
    case "hand_cost": return p.hand.filter(c => c !== card && c.type === "minion" && effectiveCardCost(p, c) > 0).length * Math.abs(fx.delta || 0);
    case "enemy_skip_attack": return foes.filter(m => !m.skipAttack).reduce((s, m) => s + Math.max(0, m.atk || 0), 0);
    case "silence_enemy_board": return foes.filter(m => m.ability || m.atkSkill > 1 || m.deathrattle || m.deathrattles?.length).reduce((s, m) => s + 2 + Math.max(0, m.atk || 0) * 0.2, 0);
    default: return 1; // Preserve support for less common effects without expanding the planner.
  }
}
function aiPlayOptions(p, budget = p.soul) {
  const e = opponent(p), urgent = p.hp <= e.board.reduce((s, m) => s + Math.max(0, m.atk || 0), 0);
  const options = [];
  for (const card of p.hand) {
    const cost = effectiveCardCost(p, card);
    if (cost > budget || (card.spell && card.spell.type === "soul")) continue;
    if (card.type === "minion" && (p.noPlayMinion || p.board.length >= 5)) continue;
    const equip = card.type === "item" && isEquipItem(card);
    const fx = equip ? { _itemEquip: true } : card.type === "spell" ? card.spell : card.battlecry;
    const targets = needsTarget(card) ? validTargets(p, fx) : [null];
    if (!targets.length) continue;
    let best = null;
    for (const target of targets) {
      let score;
      if (card.type === "minion") score = 2 + aiUnitValue(card) + aiFxValue(p, fx, target, card);
      else if (equip) score = target ? 2 + Math.max(0, card.atk || 0) * (target.minion.canAttack ? 1.5 : 0.7) + Math.max(0, card.def || 0) + Math.max(0, card.hp || 0) : 0;
      else score = aiFxValue(p, fx, target, card);
      if (urgent && score > 0 && card.type === "spell" && /^(kill|dmg|aoe_|earthquake|sandtrap|enemy_def|sandhell|heal_|enemy_skip)/.test(fx?.type || "")) score *= 1.5;
      if (score > 0 && (!best || score > best.score)) best = { kind: "play", card, target, cost, score };
    }
    if (best) options.push(best);
  }
  return options.sort((a, b) => b.score - a.score || a.cost - b.cost);
}
function aiPlannedRemainder(p, options, budget) {
  let remaining = budget, slots = Math.max(0, 5 - p.board.length);
  const removed = new Set();
  for (const option of options) {
    if (option.cost > remaining || option.card.type === "minion" && slots <= 0) continue;
    if (option.target?.minion && removed.has(option.target.minion.uid)) continue;
    remaining -= option.cost;
    if (option.card.type === "minion") slots--;
    const fx = option.card.spell, target = option.target?.minion;
    if (target && (fx?.type === "kill" || fx?.type === "kill_if" || fx?.type === "dmg" && !hasOwnAbility(target, "보호") && (fx.value || 0) - (target.def || 0) >= target.hp)) removed.add(target.uid);
  }
  return remaining;
}
function chooseAiAction(p) {
  if (state.busy || ui.battling) return { kind: "wait" };
  const e = opponent(p);
  if (!e.board.some(m => m.hp > 0 && !m.dying) && aiReadyDamage(p) >= e.hp) return { kind: "combat" };
  let options = aiPlayOptions(p), budget = p.soul, coin = null;
  const token = p.hand.find(c => c.spell?.type === "soul" && c.spell.value > effectiveCardCost(p, c));
  if (token) {
    const boosted = p.soul + token.spell.value - effectiveCardCost(p, token);
    const more = aiPlayOptions(p, boosted), witness = more.find(o => o.cost > p.soul);
    if (witness && (!options.length || witness.score > options[0].score)) { options = more; budget = boosted; coin = token; }
  }
  const leftover = aiPlannedRemainder(p, options, budget);
  if (canSoulDraw(p) && p.hand.length < 10 && p.deck.length > 0 && leftover >= soulDrawCost(p)) return { kind: "draw" };
  if (coin) return { kind: "play", card: coin, target: null };
  return options[0] || { kind: "combat" };
}

function aiTurn() {
  if (state.over) return;
  const owner = state;
  const generation = typeof CombatFx !== 'undefined' ? CombatFx.generation() : 0;
  const valid = () => state === owner && (typeof CombatFx === 'undefined' || CombatFx.generation() === generation);
  const p = current();
  if (!p.isAI) return;
  // v0.372: 매치 연출(MATCH START·MY TURN·승패) 중이면 끝난 뒤 시작 (연출과 AI 행동·사운드가 겹치지 않게)
  if (typeof SpellFx !== "undefined" && SpellFx.overlayBusy && SpellFx.overlayBusy()) {
    if (p._aiWaitFx) return;
    p._aiWaitFx = true;
    const st = state;
    SpellFx.whenOverlayIdle().then(() => { p._aiWaitFx = false; if (state === st) aiTurn(); });
    return;
  }

  const step = () => {
    if (!valid() || state.over) return;
    // v0.381: 전설 소환 연출 등 오버레이 게이트 중이면 끝난 뒤 다음 행동 (연출끼리·전투와 겹치지 않게)
    if (typeof SpellFx !== "undefined" && SpellFx.overlayBusy && SpellFx.overlayBusy()) {
      const st = state;
      SpellFx.whenOverlayIdle().then(() => { if (state === st) setTimeout(step, 280); });
      return;
    }
    if (current() !== p) return;
    const action = chooseAiAction(p);
    if (action.kind === "wait") { setTimeout(step, 120); return; }
    if (action.kind === "draw") {
      if (useSoulDraw(p)) { render(); setTimeout(step, 420); return; }
    } else if (action.kind === "play" && playCard(p, action.card, action.target)) {
      render(); setTimeout(step, 420); return;
    }
    runAutoCombat(p).then(ok => { if (ok && valid()) passTurn(); }).catch(e => console.warn(e));
  };
  setTimeout(step, 280);
}

function scorePlay(p, card) {
  let s = card.cost * 2 + (card.atk || 0) + (card.hp || 0);
  // taunt deprecated (R4-A): board-empty-hero rule in attackTargets
  if ((card.keywords || []).includes("charge")) s += 3;
  if (card.spell && card.spell.type === "dmg") {
    const e = opponent(p);
    if (e.hp <= card.spell.value) s += 50;
  }
  if (card.type === "item") {
    if (typeof isEquipItem === "function" && isEquipItem(card)) {
      if (!p.board.some(m => !m.equippedItem)) s -= 100;
      else s += 4 + (card.atk || 0) + (card.def || 0) + (card.hp || 0);
    } else s += 5;
  }
  return s;
}

function pickAiTarget(p, fx, ts) {
  const e = opponent(p);
  if (fx.type === "kill" || fx.type === "dmg") {
    // 유닛 하나(any_minion) 대상이면 적 유닛 우선
    const foes = ts.filter(t => t.kind === "minion" && t.owner === e);
    if (foes.length && foes.length < ts.length) ts = foes;
    const lethalHero = ts.find(t => t.kind === "hero" && t.owner.hp <= (fx.value || 99));
    if (lethalHero && fx.type === "dmg") return lethalHero;
    const kill = ts.filter(t => t.kind === "minion").sort((a, b) => (b.minion.atk + b.minion.hp) - (a.minion.atk + a.minion.hp));
    if (kill[0]) return kill[0];
    return ts.find(t => t.kind === "hero") || ts[0];
  }
  if (fx.type === "sac_own_aoe") {
    // 헬게이트: 가장 약한 아군을 바친다
    return ts.filter(t => t.kind === "minion" && t.owner === p)
      .sort((a, b) => ((a.minion.atk || 0) + (a.minion.hp || 0)) - ((b.minion.atk || 0) + (b.minion.hp || 0)))[0] || null;
  }
  if (fx.type === "buff") {
    const mine = ts.filter(t => t.kind === "minion" && t.owner === p);
    if (mine.length) ts = mine;
    return ts.sort((a, b) => b.minion.atk - a.minion.atk)[0] || null;
  }
  return ts[0] || null;
}

function aiAttacks(p) {
  const e = opponent(p);
  const atkers = p.board.filter(m => m.canAttack && m.attacksLeft > 0 && m.atk > 0);
  for (const m of atkers) {
    const ts = attackTargets(p, m);
    if (!ts.length) continue;
    const face = ts.find(t => t.kind === "hero");
    if (face && e.hp <= m.atk) { doAttack(p, m, face); continue; }
    const trades = ts.filter(t => t.kind === "minion")
      .filter(t => t.minion.hp <= m.atk)
      .sort((a, b) => (b.minion.atk) - (a.minion.atk));
    if (trades[0]) doAttack(p, m, trades[0]);
    else if (face) doAttack(p, m, face);
    else if (ts[0]) doAttack(p, m, ts[0]);
  }
}

/* ---------- UI ---------- */
function meView() {
  if (!state.vsAI && state.turn === 2) return { me: state.p2, opp: state.p1 };
  return { me: state.p1, opp: state.p2 };
}
