function atkSkillOf(m) {
  const v = m && m.atkSkill;
  return (v >= 2 && v <= 11) ? (v | 0) : 1;
}


/** 서량백마 등: 공격할 때마다 체력 +N */
function applyItemAttackHooks(attacker) {
  if (!attacker || attacker.hp <= 0 || attacker.dying) return;
  const n = attacker._onAttackHeal | 0;
  if (n <= 0) return;
  const cap = (attacker.maxHp != null && attacker.maxHp > 0) ? attacker.maxHp + n : attacker.hp + n;
  // permanent growth: raise maxHp too
  attacker.maxHp = Math.max(attacker.maxHp || attacker.hp, attacker.hp) + n;
  attacker.hp += n;
  if (typeof log === "function") log(`${attacker.name} 서량백마 · 체+${n}`);
}

function applyLifesteal(attacker, hpDealt) {
  if (!attacker || hpDealt <= 0 || attacker.hp <= 0 || attacker.dying) return 0;
  const heal = Math.ceil(hpDealt / 2);
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
    def.def = Math.max(0, Math.min(5, (def.def || 0) + 1));
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

function doAttack(p, attacker, target, auto) {
  return new Promise(resolve => {
  if (!attacker || attacker.hp <= 0) { resolve(); return; }
  // R7: auto combat must obey the same attack rights as manual attacks
  if (!attacker.canAttack || attacker.attacksLeft <= 0) { resolve(); return; }
  const legal = attackTargets(p, attacker);
  const ok = legal.some(t => t.kind === target.kind && (t.kind === "hero" || t.minion.uid === target.minion.uid));
  if (!ok) { resolve(); return; }
  attacker.attacksLeft -= 1;
  attacker.canAttack = attacker.attacksLeft > 0;

  const sk0 = atkSkillOf(attacker);
  // ON ATTACK START: weaken / petrify before rolls (primary only; aoe applies per-target without 7/8)
  if (target.kind === "minion" && target.minion && sk0 !== 9) {
    applyAtkSkillOnStart(attacker, target.minion);
  }

  function sharedDetail(unit, roll, atkVal, defVal, hpVal) {
    const bits = [];
    if (unit.atkC) bits.push(`공 ${unit.atk}→<b>${atkVal}</b> (${roll.dAtk >= 0 ? "+" : ""}${roll.dAtk})`);
    if (unit.defC) bits.push(`방 ${unit.def || 0}→<b>${defVal}</b> (${roll.dDef >= 0 ? "+" : ""}${roll.dDef})`);
    if (unit.hpC) bits.push(`체 ${hpVal - roll.dHp}→<b>${hpVal}</b> (${roll.dHp >= 0 ? "+" : ""}${roll.dHp})`);
    return bits.join(" · ") || `앞면 ${roll.heads}/${roll.n}`;
  }

  const aShared = rollSharedCoins(attacker);
  const aAtk = clampAtk((Number(attacker.atk) || 0) + aShared.dAtk);
  const aDefVal = clampDef((Number(attacker.def) || 0) + aShared.dDef);
  const aHpSnap = beginCombatHpCoin(attacker, aShared.dHp);
  const rows = [];
  if (aShared.flips.length) {
    rows.push({
      label: attacker.name,
      modLabel: "",
      flips: aShared.flips,
      delta: aShared.heads,
      detail: sharedDetail(attacker, aShared, aAtk, aDefVal, attacker.hp)
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
    dShared = rollSharedCoins(def);
    dAtk = clampAtk((Number(def.atk) || 0) + dShared.dAtk);
    defVal = clampDef((Number(def.def) || 0) + dShared.dDef);
    dHpSnap = beginCombatHpCoin(def, dShared.dHp);
    if (dShared.flips.length) {
      rows.push({
        label: def.name,
        modLabel: "",
        flips: dShared.flips,
        delta: dShared.heads,
        detail: sharedDetail(def, dShared, dAtk, defVal, def.hp)
      });
    }
    window._pendingDef = defVal;
    window._pendingAtkDef = aDefVal;
  } else {
    // hero face: still roll attacker shared coin (already done); keep attacker DEF for charge
    window._pendingDef = 0;
    window._pendingAtkDef = aDefVal;
  }

  const skLabel = (typeof ATK_SKILL_HELP !== "undefined" && ATK_SKILL_HELP[atkSkillOf(attacker)])
    ? ATK_SKILL_HELP[atkSkillOf(attacker)][0] : "";
  log(`${attacker.name} 공유코인 N=${aShared.n} 앞면${aShared.heads} → 공 ${aAtk}` + (atkSkillOf(attacker) > 1 ? ` [${skLabel}]` : ""));
  showCoinResult("코인 배틀", rows, async () => {
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
    armFx(attacker, aAtk, aDefVal, aShared.dAtk, aShared.dDef, aShared.dHp);
    if (target.kind === "minion" && def) {
      armFx(def, dAtk, defVal, (dShared && dShared.dAtk) || 0, (dShared && dShared.dDef) || 0, (dShared && dShared.dHp) || 0);
    }
    render();
    await waitMs(280);
    const atkEl = Vfx.elOf(attacker.uid);
    const aDefNow = window._pendingAtkDef || 0;
    const sk = atkSkillOf(attacker);
    const foe = opponent(p);

    // —— 9 광역공격: shared roll → all enemy board minions; counter = front only ——
    if (sk === 9 && foe.board.some(m => m.hp > 0 && !m.dying)) {
      const victims = foe.board.filter(m => m.hp > 0 && !m.dying).slice();
      log(`${attacker.name} 광역공격 → 적 하수인 ${victims.length}체`);
      for (const vic of victims) {
        if (attacker.hp <= 0 || attacker.dying) break;
        const blocked = Math.max(0, vic.def || 0);
        const calc = calcAtkSkillHpDamage(attacker, aAtk, blocked, aDefNow, vic);
        const hpDmg = calc.hpDmg;
        log(`${vic.name} 방어 ${blocked} → 체력피해 ${hpDmg}`);
        const defEl = Vfx.elOf(vic.uid);
        try { if (typeof SpellFx !== "undefined" && SpellFx.playCombat) SpellFx.playCombat("attack", { uid: vic.uid }); } catch (e) {}
        await Vfx.attackSeq(atkEl, defEl, hpDmg, hpDmg >= attacker.atk + 2);
        damageMinion(foe, vic, hpDmg, combatKillCtx(attacker, p));
        if (!(vic.hp > 0 && !vic.dying)) {
          try { if (typeof SpellFx !== "undefined" && SpellFx.playCombat) SpellFx.playCombat("death", { uid: vic.uid }); } catch (e) {}
          Vfx.death(Vfx.elOf(vic.uid));
        }
        render();
        await waitMs(220);
      }
      const primary = victims[0];
      const primarySurvived = primary && primary.hp > 0 && !primary.dying;
      if (primarySurvived && dAtk && attacker.hp > 0 && !attacker.dying) {
        const dmgBack = Math.max(0, dAtk - aDefNow);
        if (dmgBack > 0) {
          log(`${primary.name} 반격`);
          const atkNow = Vfx.elOf(attacker.uid);
          const defNow = Vfx.elOf(primary.uid);
          try { if (typeof SpellFx !== "undefined" && SpellFx.playCombat) SpellFx.playCombat("counter", { uid: attacker.uid }); } catch (e) {}
          await Vfx.parrySeq(defNow, atkNow, dmgBack);
          damageMinion(p, attacker, dmgBack, combatKillCtx(primary, foe));
          render();
          await waitMs(360);
        }
      } else if (primary && !primarySurvived) {
        log(`${primary.name} 격파 · 반격 없음`);
      }
      render();
      await waitMs(360);
    } else if (target.kind === "hero") {
      const hits = (sk === 4) ? 2 : 1;
      for (let hit = 1; hit <= hits; hit++) {
        if (attacker.hp <= 0 || attacker.dying) break;
        if (target.owner.hp <= 0) break;
        const isMeHero = target.owner === meView().me;
        const defEl = Vfx.heroOf(isMeHero);
        const calc = calcAtkSkillHpDamage(attacker, aAtk, 0, aDefNow, null);
        let hpDmg = calc.hpDmg;
        if (hits > 1) log(`${attacker.name} 연속 ${hit}/${hits}`);
        const crit = hpDmg >= attacker.atk + 3 || sk === 5;
        try { if (typeof SpellFx !== "undefined" && SpellFx.playCombat) SpellFx.playCombat("attack", { hero: isMeHero ? "me" : "opp" }); } catch (e) {}
        await Vfx.attackSeq(atkEl, defEl, hpDmg, crit);
        if (sk === 5 && hpDmg >= 1) {
          dealHero(target.owner, Math.max(hpDmg, target.owner.hp));
          log(`${attacker.name} 치명공격 → 영웅 즉사급 피해`);
        } else {
          dealHero(target.owner, hpDmg);
        }
        if (sk === 6) applyLifesteal(attacker, hpDmg);
        applyItemAttackHooks(attacker);
        render();
        await waitMs(hits > 1 ? 300 : 420);
      }
    } else {
      // single minion: 연속(4)=two hits with counter each (kill→retarget next living)
      const hits = (sk === 4) ? 2 : 1;
      for (let hit = 1; hit <= hits; hit++) {
        if (attacker.hp <= 0 || attacker.dying) break;
        // 연속: 1타 처치 후 남은 타는 다음 생존 적(하수인→영웅)으로 재지정. 시체/스킵 금지.
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
            const critH = hpDmgH >= attacker.atk + 3 || sk === 5;
            try { if (typeof SpellFx !== "undefined" && SpellFx.playCombat) SpellFx.playCombat("attack", { hero: isMeHero ? "me" : "opp" }); } catch (e) {}
            await Vfx.attackSeq(atkEl, defElH, hpDmgH, critH);
            if (sk === 5 && hpDmgH >= 1) {
              dealHero(nextH.owner, Math.max(hpDmgH, nextH.owner.hp));
              log(`${attacker.name} 치명공격 → 영웅 즉사급 피해`);
            } else {
              dealHero(nextH.owner, hpDmgH);
            }
            if (sk === 6) applyLifesteal(attacker, hpDmgH);
            applyItemAttackHooks(attacker);
            render();
            await waitMs(hits > 1 ? 300 : 420);
            continue;
          } else {
            break;
          }
        }
        const blocked = (hit === 1 && def === (target && target.minion)) ? (window._pendingDef || 0) : Math.max(0, def.def || 0);
        const backBlock = window._pendingAtkDef || 0;
        const calc = calcAtkSkillHpDamage(attacker, aAtk, blocked, aDefNow, def);
        let hpDmg = calc.hpDmg;
        if (hits > 1) log(`${attacker.name} 연속 ${hit}/${hits}`);
        log(`${def.name} 방어 ${blocked}` + (sk === 2 ? ` (관통 흡수 ${calc.absorbed})` : "") + ` → 체력피해 ${hpDmg}`);
        const defEl = Vfx.elOf(def.uid);
        const crit = hpDmg >= attacker.atk + 2 || sk === 5;
        try {
          if (typeof SpellFx !== "undefined" && SpellFx.playCombat) {
            SpellFx.playCombat("attack", { uid: def.uid });
            SpellFx.playCombat("defend", { uid: def.uid });
          }
        } catch (e) {}
        await Vfx.attackSeq(atkEl, defEl, hpDmg, crit);

        const hpBefore = def.hp;
        if (sk === 5 && hpDmg >= 1) {
          damageMinion(target.owner, def, Math.max(hpDmg, def.hp), combatKillCtx(attacker, p));
          log(`${attacker.name} 치명공격 → ${def.name} 즉사`);
        } else {
          damageMinion(target.owner, def, hpDmg, combatKillCtx(attacker, p));
        }
        const hpDealt = Math.max(0, hpBefore - Math.max(0, def.hp));
        if (sk === 6) applyLifesteal(attacker, hpDealt);
        applyItemAttackHooks(attacker);
        render();
        await waitMs(360);
        const survived = def && def.hp > 0 && !def.dying;
        // counter uses this hit's defender current atk if retargeted mid-연속
        const counterAtk = (hit === 1) ? dAtk : clampAtk(Number(def.atk) || 0);
        if (survived && counterAtk && attacker.hp > 0 && !attacker.dying) {
          const dmgBack = Math.max(0, counterAtk - backBlock);
          if (dmgBack > 0) {
            log(`${def.name} 반격`);
            const atkNow = Vfx.elOf(attacker.uid);
            const defNow = Vfx.elOf(def.uid);
            try { if (typeof SpellFx !== "undefined" && SpellFx.playCombat) SpellFx.playCombat("counter", { uid: attacker.uid }); } catch (e) {}
            await Vfx.parrySeq(defNow, atkNow, dmgBack);
            damageMinion(p, attacker, dmgBack, combatKillCtx(def, target.owner));
            render();
            await waitMs(360);
          }
        } else if (!survived) {
          log(`${def.name} 격파 · 반격 없음`);
          const deadEl = Vfx.elOf(def.uid);
          try { if (typeof SpellFx !== "undefined" && SpellFx.playCombat) SpellFx.playCombat("death", { uid: def.uid }); } catch (e) {}
          Vfx.death(deadEl);
          await waitMs(520);
          // 연속: 남은 타가 있으면 break하지 않고 다음 루프에서 재지정
          if (!(sk === 4 && hit < hits)) break;
        }
      }

    }
    // Fantasy Masters: strip remaining gold HP coin bonus; black/damage already stuck
    settleCombatHpCoin(aHpSnap);
    settleCombatHpCoin(dHpSnap);
    await waitMs(240);
    [state.p1, state.p2].forEach(pl => {
      pl.board.filter(mm => mm.dying).forEach(mm => {
        const el = Vfx.elOf(mm.uid);
        if (el && !el.classList.contains("fx-dissolve")) {
          try { if (typeof SpellFx !== "undefined" && SpellFx.playCombat) SpellFx.playCombat("death", { uid: mm.uid }); } catch (e) {}
          Vfx.death(el);
        }
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
    resolve();
  });
  });
}


function checkWin() {
  if (state.over) return;
  if (state.p1.hp <= 0 && state.p2.hp <= 0) finish("무승부");
  else if (state.p1.hp <= 0) finish(state.p2.name);
  else if (state.p2.hp <= 0) finish(state.p1.name);
}

function finish(winner) {
  state.over = true;
  state.winner = winner;
  try {
    if (winner === "무승부") Sfx.playLose && Sfx.playLose();
    else if (winner === "나") Sfx.playWin && Sfx.playWin();
    else Sfx.playLose && Sfx.playLose();
  } catch (e) {}
  try {
    if (typeof SpellFx !== "undefined" && SpellFx.playMatch) {
      if (winner === "나") SpellFx.playMatch("victory");
      else if (winner !== "무승부") SpellFx.playMatch("defeat");
      else SpellFx.playMatch("defeat");
    }
  } catch (e) {}
  render();
  const meWin = winner === "나";
  document.getElementById("modal").innerHTML = `
    <h2>${winner === "무승부" ? "무승부" : winner + " 승리"}</h2>
    <p>${meWin ? "상대 영웅을 쓰러뜨렸다." : winner === "무승부" ? "둘 다 쓰러졌다." : "이번엔 패배."}</p>
    <button class="menu-btn" onclick="backTitle()">로비로</button>
  `;
  document.getElementById("overlay").classList.add("show");
}

function clearDrag() {
  document.querySelectorAll(".drag-ghost").forEach(el => el.remove());
  const peek = document.getElementById("cardPeek");
  if (peek) peek.remove();
  if (typeof _drag !== "undefined" && _drag) {
    if (_drag.el) _drag.el.classList.remove("dragging");
    _drag = null;
  }
  try { document.body.classList.remove("dragging-card"); } catch (err) {}
  if (typeof placeDropGlow === "function") placeDropGlow(false);
  if (typeof clearEquipHover === "function") clearEquipHover();
  if (typeof clearInsertPreview === "function") clearInsertPreview();
}
function hideScreens() {
  clearDrag();
  document.getElementById("title").classList.remove("active");
  document.getElementById("game").classList.remove("active");
  const db = document.getElementById("deckBuilder");
  if (db) db.classList.remove("active");
  document.getElementById("overlay").classList.remove("show");
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
function aiTurn() {
  if (state.over) return;
  const p = current();
  if (!p.isAI) return;

  const tryPlay = () => {
    const plays = p.hand
      .filter(c => c.cost <= p.soul)
      .filter(c => c.type !== "minion" || p.board.length < 5)
      .sort((a, b) => scorePlay(p, b) - scorePlay(p, a));
    for (const card of plays) {
      let target = null;
      if (needsTarget(card)) {
        const fx = (card.type === "item" && typeof isEquipItem === "function" && isEquipItem(card))
          ? { _itemEquip: true }
          : (card.type === "spell" ? card.spell : card.battlecry);
        const ts = validTargets(p, fx);
        if (!ts.length) {
          if (card.type === "item") continue;
          if (fx && fx.target) continue;
        }
        if (fx && fx._itemEquip) target = ts[0] || null;
        else target = pickAiTarget(p, fx, ts);
        if (!target && ((fx && fx.target) || (fx && fx._itemEquip))) continue;
      }
      playCard(p, card, target);
      render();
      return true;
    }

    return false;
  };

  const step = () => {
    if (state.over) return;
    if (tryPlay()) { setTimeout(step, 420); return; }
    runAutoCombat(p).then(() => passTurn());
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
      if (!p.board.length) s -= 100;
      else s += 4 + (card.atk || 0) + (card.def || 0) + (card.hp || 0);
    } else s += 5;
  }
  return s;
}

function pickAiTarget(p, fx, ts) {
  const e = opponent(p);
  if (fx.type === "kill" || fx.type === "dmg") {
    const lethalHero = ts.find(t => t.kind === "hero" && t.owner.hp <= (fx.value || 99));
    if (lethalHero && fx.type === "dmg") return lethalHero;
    const kill = ts.filter(t => t.kind === "minion").sort((a, b) => (b.minion.atk + b.minion.hp) - (a.minion.atk + a.minion.hp));
    if (kill[0]) return kill[0];
    return ts.find(t => t.kind === "hero") || ts[0];
  }
  if (fx.type === "buff") {
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
