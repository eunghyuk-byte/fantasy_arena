function atkSkillOf(m) {
  const v = m && m.atkSkill;
  return (v >= 2 && v <= 10) ? (v | 0) : 1;
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
  if (sk === 7) { // weaken
    def.atk = Math.max(0, (def.atk || 0) - 1);
    def.def = Math.max(0, (def.def || 0) - 1);
    log(`${attacker.name} 약화공격 → ${def.name} 공·방 -1`);
  } else if (sk === 8) { // petrify
    def.atk = 0;
    def.def = (def.def || 0) + 1;
    log(`${attacker.name} 석화공격 → ${def.name} 공=0 방+1`);
  }
}

/**
 * Resolve outbound HP damage for attacker specials (RULE-ATK-v2).
 * 2 penetrate · 3 charge · 4 double · else normal block.
 * Returns { hpDmg, absorbed, skill, raw } — counterattacks must NOT use attacker skill.
 */
function calcAtkSkillHpDamage(attacker, aAtk, blocked, aDefVal, def) {
  const sk = atkSkillOf(attacker);
  let raw = Math.max(0, aAtk);
  if (sk === 3) { // charge: + attacker DP
    raw += Math.max(0, aDefVal || 0);
  }
  let hpDmg = 0;
  let absorbed = 0;
  if (sk === 2) { // penetrate: DP pool first (consume), remainder to HP
    const pool = Math.max(0, (def && def.def) || 0);
    absorbed = Math.min(pool, raw);
    if (def) def.def = pool - absorbed;
    hpDmg = raw - absorbed;
  } else {
    // normal / charge / double / lethal / lifesteal / cleave / trample / pre-only
    absorbed = Math.min(Math.max(0, blocked || 0), raw);
    hpDmg = Math.max(0, raw - Math.max(0, blocked || 0));
  }
  if (sk === 4) { // double
    hpDmg *= 2;
  }
  return { hpDmg, absorbed, skill: sk, raw };
}

/** Apply one outbound hit (shared aAtk) to a minion; returns { hpDealt, killed }. */
async function resolveMinionHit(p, attacker, owner, def, aAtk, aDefVal, opts) {
  opts = opts || {};
  const skipStart = !!opts.skipStart;
  const skipVfx = !!opts.skipVfx;
  if (!skipStart) applyAtkSkillOnStart(attacker, def);
  const blocked = Math.max(0, def.def || 0);
  const calc = calcAtkSkillHpDamage(attacker, aAtk, blocked, aDefVal, def);
  let hpDmg = calc.hpDmg;
  const sk = calc.skill;
  const note = sk === 2 ? ` (관통 흡수 ${calc.absorbed})` : "";
  log(`${def.name} 방어 ${blocked}${note} → 체력피해 ${hpDmg}`);
  if (!skipVfx) {
    const atkEl = Vfx.elOf(attacker.uid);
    const defEl = Vfx.elOf(def.uid);
    const crit = hpDmg >= attacker.atk + 2 || sk === 5;
    await Vfx.attackSeq(atkEl, defEl, hpDmg, crit);
  }
  const hpBefore = def.hp;
  if (sk === 5 && hpDmg >= 1) {
    damageMinion(owner, def, Math.max(hpDmg, def.hp));
    log(`${attacker.name} 치명공격 → ${def.name} 즉사`);
  } else {
    damageMinion(owner, def, hpDmg);
  }
  const hpDealt = Math.max(0, hpBefore - Math.max(0, def.hp));
  if (sk === 6) applyLifesteal(attacker, hpDealt);
  const killed = !(def.hp > 0 && !def.dying);
  return { hpDealt, killed, hpDmg, calc };
}

function doAttack(p, attacker, target, auto) {
  return new Promise(resolve => {
  if (!attacker || attacker.hp <= 0) { resolve(); return; }
  if (!attacker.canAttack || attacker.attacksLeft <= 0) { resolve(); return; }
  const legal = attackTargets(p, attacker);
  const ok = legal.some(t => t.kind === target.kind && (t.kind === "hero" || t.minion.uid === target.minion.uid));
  if (!ok) { resolve(); return; }
  attacker.attacksLeft -= 1;
  attacker.canAttack = attacker.attacksLeft > 0;

  const sk0 = atkSkillOf(attacker);
  // ON ATTACK START: weaken / petrify before rolls (primary only; cleave applies per-target later without 7/8)
  if (target.kind === "minion" && target.minion && sk0 !== 9) {
    applyAtkSkillOnStart(attacker, target.minion);
  }

  const aRoll = rollCoins(attacker.atkC);
  const aAtk = Math.max(0, attacker.atk + aRoll.delta);
  const rows = [];
  if (aRoll.flips && aRoll.flips.length) {
    rows.push({
      label: attacker.name + " 공격",
      modLabel: fmtC(attacker.atkC),
      flips: aRoll.flips,
      delta: aRoll.delta,
      base: attacker.atk,
      value: aAtk
    });
  }
  let dAtk = 0, dRoll = { flips: [], delta: 0 }, def = null;
  if (target.kind === "minion") {
    def = target.minion;
    dRoll = rollCoins(def.atkC);
    dAtk = Math.max(0, def.atk + dRoll.delta);
    if (dRoll.flips && dRoll.flips.length) {
      rows.push({
        label: def.name + " 반격",
        modLabel: fmtC(def.atkC),
        flips: dRoll.flips,
        delta: dRoll.delta,
        base: def.atk,
        value: dAtk
      });
    }
    const defRoll = rollCoins(def.defC);
    const defVal = Math.max(0, (def.def || 0) + defRoll.delta);
    if (defRoll.flips && defRoll.flips.length) {
      rows.push({
        label: def.name + " 방어",
        modLabel: fmtC(def.defC),
        flips: defRoll.flips,
        delta: defRoll.delta,
        base: def.def || 0,
        value: defVal
      });
    }
    const aDefRoll = rollCoins(attacker.defC);
    const aDefVal = Math.max(0, (attacker.def || 0) + aDefRoll.delta);
    if (def.hpC) {
      const hRoll = rollCoins(def.hpC);
      const hpBase = def.hp;
      def.hp += hRoll.delta;
      if (hRoll.flips && hRoll.flips.length) {
        rows.push({
          label: def.name + " 체력",
          modLabel: fmtC(def.hpC),
          flips: hRoll.flips,
          delta: hRoll.delta,
          base: hpBase,
          value: def.hp
        });
      }
    }
    if (attacker.hpC) {
      const ahRoll = rollCoins(attacker.hpC);
      const ahpBase = attacker.hp;
      attacker.hp += ahRoll.delta;
      if (ahRoll.flips && ahRoll.flips.length) {
        rows.push({
          label: attacker.name + " 체력",
          modLabel: fmtC(attacker.hpC),
          flips: ahRoll.flips,
          delta: ahRoll.delta,
          base: ahpBase,
          value: attacker.hp
        });
      }
    }
    window._pendingDef = defVal;
    window._pendingAtkDef = aDefVal;
  } else {
    // hero target: still roll attacker DP (charge skill 3)
    const aDefRoll = rollCoins(attacker.defC);
    const aDefVal = Math.max(0, (attacker.def || 0) + aDefRoll.delta);
    if (aDefRoll.flips && aDefRoll.flips.length) {
      rows.push({
        label: attacker.name + " 방어",
        modLabel: fmtC(attacker.defC),
        flips: aDefRoll.flips,
        delta: aDefRoll.delta,
        base: attacker.def || 0,
        value: aDefVal
      });
    }
    window._pendingDef = 0;
    window._pendingAtkDef = aDefVal;
  }
  const skLabel = (typeof ATK_SKILL_LABEL !== "undefined" && ATK_SKILL_LABEL[atkSkillOf(attacker)]) || "";
  log(`${attacker.name} 코인 공격 ${fmtC(attacker.atkC) || ""} → ${aAtk}` + (atkSkillOf(attacker) > 1 ? ` [${skLabel}]` : ""));
  showCoinResult("코인 배틀", rows, async () => {
    attacker._fxAtk = aAtk;
    if (target.kind === "minion" && def) def._fxAtk = dAtk;
    render();
    await waitMs(280);
    const atkEl = Vfx.elOf(attacker.uid);
    const aDefVal = window._pendingAtkDef || 0;
    const sk = atkSkillOf(attacker);
    const foe = opponent(p);

    // —— 9 광역공격: one shared roll → all enemy board minions (heroes excluded) ——
    if (sk === 9 && foe.board.some(m => m.hp > 0 && !m.dying)) {
      const victims = foe.board.filter(m => m.hp > 0 && !m.dying).slice();
      log(`${attacker.name} 광역공격 → 적 하수인 ${victims.length}체`);
      let totalDealt = 0;
      for (const vic of victims) {
        if (attacker.hp <= 0 || attacker.dying) break;
        // shared aAtk/aDefVal; per-target current DP as block (no 7/8 on cleave cards)
        const blocked = Math.max(0, vic.def || 0);
        const calc = calcAtkSkillHpDamage(attacker, aAtk, blocked, aDefVal, vic);
        const hpDmg = calc.hpDmg;
        log(`${vic.name} 방어 ${blocked} → 체력피해 ${hpDmg}`);
        const defEl = Vfx.elOf(vic.uid);
        await Vfx.attackSeq(atkEl, defEl, hpDmg, hpDmg >= attacker.atk + 2);
        const hpBefore = vic.hp;
        damageMinion(foe, vic, hpDmg);
        totalDealt += Math.max(0, hpBefore - Math.max(0, vic.hp));
        if (!(vic.hp > 0 && !vic.dying)) {
          Vfx.death(Vfx.elOf(vic.uid));
        }
        render();
        await waitMs(220);
      }
      if (totalDealt > 0 && attacker.hp > 0 && !attacker.dying && sk === 6) {
        /* cleave cards are skill 9 only; lifesteal N/A */
      }
      render();
      await waitMs(360);
    } else if (target.kind === "hero") {
      const isMeHero = target.owner === meView().me;
      const defEl = Vfx.heroOf(isMeHero);
      const calc = calcAtkSkillHpDamage(attacker, aAtk, 0, aDefVal, null);
      let hpDmg = calc.hpDmg;
      const crit = hpDmg >= attacker.atk + 3;
      await Vfx.attackSeq(atkEl, defEl, hpDmg, crit);
      if (sk === 5 && hpDmg >= 1) {
        dealHero(target.owner, Math.max(hpDmg, target.owner.hp));
        log(`${attacker.name} 치명공격 → 영웅 즉사급 피해`);
      } else {
        dealHero(target.owner, hpDmg);
      }
      if (sk === 6) applyLifesteal(attacker, hpDmg);
      render();
      await waitMs(420);
    } else {
      // single minion (skills 1–8, 10 primary)
      const blocked = window._pendingDef || 0;
      const backBlock = window._pendingAtkDef || 0;
      const calc = calcAtkSkillHpDamage(attacker, aAtk, blocked, aDefVal, def);
      let hpDmg = calc.hpDmg;
      log(`${def.name} 방어 ${blocked}` + (sk === 2 ? ` (관통 흡수 ${calc.absorbed})` : "") + ` → 체력피해 ${hpDmg}`);
      const defEl = Vfx.elOf(def.uid);
      const crit = hpDmg >= attacker.atk + 2 || sk === 5;
      await Vfx.attackSeq(atkEl, defEl, hpDmg, crit);

      const hpBefore = def.hp;
      if (sk === 5 && hpDmg >= 1) {
        damageMinion(target.owner, def, Math.max(hpDmg, def.hp));
        log(`${attacker.name} 치명공격 → ${def.name} 즉사`);
      } else {
        damageMinion(target.owner, def, hpDmg);
      }
      const hpDealt = Math.max(0, hpBefore - Math.max(0, def.hp));
      if (sk === 6) applyLifesteal(attacker, hpDealt);
      render();
      await waitMs(360);
      const survived = def && def.hp > 0 && !def.dying;
      // Counterattack: primary survivor only; normal formula (no attacker specials)
      if (survived && dAtk && attacker.hp > 0 && !attacker.dying) {
        const dmgBack = Math.max(0, dAtk - backBlock);
        if (dmgBack > 0) {
          log(`${def.name} 반격`);
          const atkNow = Vfx.elOf(attacker.uid);
          const defNow = Vfx.elOf(def.uid);
          await Vfx.parrySeq(defNow, atkNow, dmgBack);
          damageMinion(p, attacker, dmgBack);
          render();
          await waitMs(360);
        }
      } else if (!survived) {
        log(`${def.name} 격파 · 반격 없음`);
        const deadEl = Vfx.elOf(def.uid);
        Vfx.death(deadEl);
        await waitMs(520);

        // —— 10 돌파공격: leftover-ATK trample (Monster Train–style); NOT full aAtk re-strike ——
        // leftover = max(0, primaryHpDmgPotential - hpAbsorbed); each hop uses leftover as ATK vs that target's DEF.
        if (sk === 10 && attacker.hp > 0 && !attacker.dying) {
          let leftover = Math.max(0, hpDmg - hpBefore);
          const boardCap = Math.max(1, foe.board.length + 1);
          let hops = 0;
          let lastUid = def.uid;
          while (leftover > 0 && hops < boardCap && attacker.hp > 0 && !attacker.dying) {
            const living = foe.board.filter(m => m.hp > 0 && !m.dying && m.uid !== lastUid);
            // prefer next-in-row (index after last), else first living
            let next = null;
            const all = foe.board;
            const idx = all.findIndex(m => m.uid === lastUid);
            if (idx >= 0) {
              for (let i = idx + 1; i < all.length; i++) {
                if (all[i].hp > 0 && !all[i].dying) { next = all[i]; break; }
              }
            }
            if (!next) next = living[0] || null;
            if (!next) {
              // board empty → hero face with leftover only
              if (!foe.board.some(m => m.hp > 0 && !m.dying)) {
                log(`${attacker.name} 돌파 → 영웅 (잔여 ${leftover})`);
                const isMeHero = foe === meView().me;
                const hEl = Vfx.heroOf(isMeHero);
                await Vfx.attackSeq(Vfx.elOf(attacker.uid), hEl, leftover, false);
                dealHero(foe, leftover);
                render();
                await waitMs(300);
              }
              break;
            }
            const nBlocked = Math.max(0, next.def || 0);
            if (leftover <= nBlocked) {
              log(`${attacker.name} 돌파 → ${next.name} 잔여 ${leftover} ≤ 방어 ${nBlocked} · 돌파 종료`);
              break;
            }
            hops++;
            const nDmg = Math.max(0, leftover - nBlocked);
            log(`${attacker.name} 돌파 → ${next.name} (${hops}) 잔여ATK ${leftover}`);
            log(`${next.name} 방어 ${nBlocked} → 체력피해 ${nDmg}`);
            await Vfx.attackSeq(Vfx.elOf(attacker.uid), Vfx.elOf(next.uid), nDmg, false);
            const nb = next.hp;
            damageMinion(foe, next, nDmg);
            // chain hops: pure leftover HP dmg only (no lifesteal / other skill effects)
            render();
            await waitMs(280);
            if (next.hp > 0 && !next.dying) {
              log(`${next.name} 생존 · 돌파 종료`);
              break;
            }
            log(`${next.name} 격파`);
            Vfx.death(Vfx.elOf(next.uid));
            await waitMs(400);
            leftover = Math.max(0, nDmg - nb);
            lastUid = next.uid;
          }
        }
      }
    }
    await waitMs(240);
    [state.p1, state.p2].forEach(pl => {
      pl.board.filter(mm => mm.dying).forEach(mm => {
        const el = Vfx.elOf(mm.uid);
        if (el && !el.classList.contains("fx-dissolve")) Vfx.death(el);
        destroyMinion(pl, mm);
      });
      pl._hurt = null;
      pl.board.forEach(mm => { mm._hurt = null; mm._fxAtk = null; });
    });
    attacker._fxAtk = null;
    cleanupBoards();
    checkWin();
    render();
    resolve();
  });
  });
}

function useHeroPower(p) {
  if (p.powerUsed || p.mana < 2) return;
  p.mana -= 2;
  p.powerUsed = true;
  const fx = p.hero.power;
  if (fx.type === "summon") {
    if (p.board.length >= MAX_BOARD) { log("전장이 가득 차 소환 실패"); return; }
    const rec = cloneCard("recruit");
    rec.atk = fx.value[0]; rec.hp = fx.value[1]; rec.maxHp = fx.value[1];
    rec.canAttack = false; rec.attacksLeft = 0;
    p.board.push(rec);
    log(`${p.name} 영웅 능력: 신병 소환`);
  } else {
    applyFx(p, fx, { kind: "hero", owner: opponent(p) });
    log(`${p.name} 영웅 능력: ${p.hero.powerName}`);
  }
  checkWin();
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
  if (typeof placeDropGlow === "function") placeDropGlow(false);
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
  document.getElementById("game").classList.add("active");
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
      .filter(c => c.cost <= p.mana)
      .filter(c => c.type !== "minion" || p.board.length < MAX_BOARD)
      .sort((a, b) => scorePlay(p, b) - scorePlay(p, a));
    for (const card of plays) {
      let target = null;
      if (needsTarget(card)) {
        const fx = card.type === "spell" ? card.spell : null;
        const ts = validTargets(p, fx);
        if (!ts.length && fx.target) continue;
        target = pickAiTarget(p, fx, ts);
        if (!target && fx.target) continue;
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
  // taunt deprecated: board-empty-hero rule in attackTargets (R4-A)
  /* charge AI bias disabled */
  if (card.spell && card.spell.type === "dmg") {
    const e = opponent(p);
    if (e.hp <= card.spell.value) s += 50;
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
