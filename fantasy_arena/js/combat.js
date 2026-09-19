function doAttack(p, attacker, target, auto) {
  return new Promise(resolve => {
  if (!attacker || attacker.hp <= 0) { resolve(); return; }
  if (!attacker.canAttack || attacker.attacksLeft <= 0) { resolve(); return; }
  const legal = attackTargets(p, attacker);
  const ok = legal.some(t => t.kind === target.kind && (t.kind === "hero" || t.minion.uid === target.minion.uid));
  if (!ok) { resolve(); return; }
  attacker.attacksLeft -= 1;
  attacker.canAttack = attacker.attacksLeft > 0;
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
  } else { window._pendingDef = 0; window._pendingAtkDef = 0; }
  log(`${attacker.name} 코인 공격 ${fmtC(attacker.atkC) || ""} → ${aAtk}`);
  showCoinResult("코인 배틀", rows, async () => {
    attacker._fxAtk = aAtk;
    if (target.kind === "minion" && def) def._fxAtk = dAtk;
    render();
    await waitMs(280);
    const atkEl = Vfx.elOf(attacker.uid);
    if (target.kind === "hero") {
      const isMeHero = target.owner === meView().me;
      const defEl = Vfx.heroOf(isMeHero);
      const crit = aAtk >= attacker.atk + 3;
      await Vfx.attackSeq(atkEl, defEl, aAtk, crit);
      dealHero(target.owner, aAtk);
      render();
      await waitMs(420);
    } else {
      const blocked = window._pendingDef || 0;
      const backBlock = window._pendingAtkDef || 0;
      const pierce = (attacker.keywords || []).includes("pierce");
      const dmgIn = Math.max(0, aAtk - (pierce ? 0 : blocked));
      const dmgBack = Math.max(0, dAtk - backBlock);
      log(`${def.name} 방어 ${blocked} → 체력피해 ${dmgIn}`);
      const defEl = Vfx.elOf(def.uid);
      const crit = dmgIn >= attacker.atk + 2;
      await Vfx.attackSeq(atkEl, defEl, dmgIn, crit);
      damageMinion(target.owner, def, dmgIn);
      render();
      await waitMs(360);
      const survived = def && def.hp > 0 && !def.dying;
      if (survived && dmgBack && attacker.hp > 0 && !attacker.dying) {
        log(`${def.name} 반격`);
        const atkNow = Vfx.elOf(attacker.uid);
        const defNow = Vfx.elOf(def.uid);
        await Vfx.parrySeq(defNow, atkNow, dmgBack);
        damageMinion(p, attacker, dmgBack);
        render();
        await waitMs(360);
      } else if (!survived) {
        log(`${def.name} 격파 · 반격 없음`);
        const deadEl = Vfx.elOf(def.uid);
        Vfx.death(deadEl);
        await waitMs(520);
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
    if (p.board.length >= 6) { log("전장이 가득 차 소환 실패"); return; }
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
      .filter(c => c.type !== "minion" || p.board.length < 6)
      .sort((a, b) => scorePlay(p, b) - scorePlay(p, a));
    for (const card of plays) {
      let target = null;
      if (needsTarget(card)) {
        const fx = card.type === "spell" ? card.spell : card.battlecry;
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
  if ((card.keywords || []).includes("charge")) s += 3;
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
