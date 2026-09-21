
function uid() { return Math.random().toString(36).slice(2, 9); }
function cloneCard(id) {
  const b = CARD_MAP[id];
  if (!b) {
    console.warn("cloneCard missing id", id);
    return {
      id: id || "missing",
      name: "?",
      cost: 0,
      type: "minion",
      tribe: "earth",
      atk: 0,
      def: 0,
      hp: 1,
      atkC: 0,
      defC: 0,
      hpC: 0,
      keywords: [],
      uid: uid(),
      maxHp: 1,
      canAttack: false,
      attacksLeft: 0,
      damaged: false,
      token: true,
    };
  }
  return {
    ...b,
    keywords: [...(b.keywords || [])],
    uid: uid(),
    maxHp: b.hp || 0,
    canAttack: false,
    attacksLeft: 0,
    damaged: false,
  };
}
function shuffle(a) {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}
function buildDeck(tribeId) {
  // Items included (max 2 via copies)
  const pool = CARDS.filter(c => !c.token && c.tribe === tribeId).map(c => c.id);
  const d = [];
  while (d.length < 30) {
    const id = pool[d.length % pool.length];
    const count = d.filter(x => x === id).length;
    if (count < 2) d.push(id);
    else {
      const alt = pool.find(p => d.filter(x => x === p).length < 2) || pool[0];
      d.push(alt);
    }
  }
  return shuffle(d);
}

function loadSavedDecks() {
  try { return JSON.parse(localStorage.getItem("runestone-decks") || "{}"); }
  catch (e) { return {}; }
}
function persistDecks(map) {
  localStorage.setItem("runestone-decks", JSON.stringify(map));
}
function deckFor(hero, isAI) {
  if (!isAI) {
    const saved = loadSavedDecks()[hero.id];
    if (Array.isArray(saved) && saved.length === 30) return shuffle(saved.slice());
  }
  return buildDeck(hero.id);
}
function makePlayer(hero, isAI, name) {
  return {
    name, hero, isAI,
    hp: 40, maxHp: 40,
    mana: 0, maxMana: 0,
    powerUsed: false,
    deck: deckFor(hero, isAI),
    hand: [],
    board: [],
    fatigue: 0,
  };
}

function log(msg) {
  const el = document.getElementById("log");
  const line = document.createElement("div");
  line.textContent = msg;
  el.prepend(line);
  while (el.children.length > 3) el.lastChild.remove();
}

function opponent(p) { return p === state.p1 ? state.p2 : state.p1; }
function current() { return state.turn === 1 ? state.p1 : state.p2; }
function other() { return state.turn === 1 ? state.p2 : state.p1; }

function draw(p, n = 1) {
  for (let i = 0; i < n; i++) {
    if (!p.deck.length) {
      p.fatigue += 1;
      p.hp -= p.fatigue;
      log(`${p.name} 덱이 바닥나 피로 피해 ${p.fatigue}`);
      checkWin();
      continue;
    }
    const id = p.deck.pop();
    if (p.hand.length >= 10) {
      const nm = (CARD_MAP[id] && CARD_MAP[id].name) || id;
      log(`${p.name}의 손패가 가득 차 ${nm}이(가) 불탔다`);
    } else {
      p.hand.push(cloneCard(id));
      if (!p.isAI) p._drew = true;
    }
  }
}



function flyDrawCard() {
  try { Sfx.playDraw && Sfx.playDraw(); } catch (e) {}
  const pile = document.querySelector("#myStrip .pile-stack") || document.querySelector("#myStrip .deck-pile");
  const hand = document.getElementById("myHand");
  if (!pile || !hand) return;
  const cards = [...hand.querySelectorAll(".card")];
  const last = cards[cards.length - 1];
  const a = pile.getBoundingClientRect();
  const b = last ? last.getBoundingClientRect() : hand.getBoundingClientRect();
  if (last) last.style.opacity = "0";
  const ghost = document.createElement("div");
  ghost.className = "draw-ghost";
  const face = last && last.querySelector(".card-face");
  if (face && face.src) ghost.innerHTML = '<img src="'+face.src+'" alt="">';
  const w = last ? b.width : 72;
  const h = last ? b.height : 108;
  ghost.style.cssText = "position:fixed;left:"+a.left+"px;top:"+a.top+"px;width:"+w+"px;height:"+h+"px;z-index:120;pointer-events:none;transform-origin:center center;";
  document.body.appendChild(ghost);
  const dx = (b.left + b.width/2) - (a.left + a.width/2);
  const dy = (b.top + b.height/2) - (a.top + a.height/2);
  const anim = ghost.animate([
    { transform: "translate(0,0) rotate(-18deg) scale(.72)", offset: 0 },
    { transform: "translate("+(dx*0.45)+"px,"+(dy*0.35-90)+"px) rotate(12deg) scale(.92)", offset: 0.45 },
    { transform: "translate("+dx+"px,"+dy+"px) rotate(0deg) scale(1)", offset: 1 }
  ], { duration: 720, easing: "cubic-bezier(.2,.72,.12,1)", fill: "forwards" });
  const done = () => {
    ghost.remove();
    if (last) last.style.opacity = "";
  };
  anim.onfinish = done;
  setTimeout(done, 800);
}


function pickEnemyTribe(mine, vsAI) {
  if (vsAI) return TRIBES.find(tr => tr.id === "earth") || mine;
  const open = TRIBES.filter(tr => tr.open && tr.id !== mine.id);
  return open[Math.floor(Math.random() * open.length)] || mine;
}

function startGame(vsAI) {
  state = {
    vsAI,
    turn: 1,
    turnCount: 1,
    over: false,
    winner: null,
    p1: makePlayer(selectedHero, false, "나"),
    p2: makePlayer(pickEnemyTribe(selectedHero, vsAI), vsAI, vsAI ? "상대 컴퓨터" : "플레이어 2"),
  };
  draw(state.p1, 3);
  draw(state.p2, 4);
  state.p2.hand.push(cloneCard("coin"));
  beginTurn(state.p1);
  showGame();
  render();
  if (state.p1.isAI) aiTurn();
}

function beginTurn(p) {
  state.acting = p;
  p.maxMana = Math.min(10, p.maxMana + 1);
  p.mana = p.maxMana;
  if (p.manaNext) { p.mana += p.manaNext; p.manaNext = 0; }
  p.noPlayMinion = false;
  p.coinP = null;
  p.powerUsed = false;
  p.board.forEach(m => {
    if (m.skipAttack) { m.canAttack = false; m.attacksLeft = 0; m.skipAttack = false; }
    else { m.canAttack = true; m.attacksLeft = 1; }
  });
  draw(p, 1);
  log(`${p.name}의 턴 · 마나 ${p.mana}`);
}

function renderHeroSlot(p, isMe) {
  const icon = (typeof TRIBE_ICONS !== "undefined" && TRIBE_ICONS[p.hero.id]) || "";
  const hurt = p._hurt && p._hurt.dmg ? " hurt" : "";
  const tick = p._hurt && p._hurt.dmg ? `<div class="hp-tick">-${p._hurt.dmg}</div>` : "";
  let canTarget = false;
  try {
    if (ui.targeting) canTarget = ui.targeting.targets.some(t => t.kind === "hero" && t.owner === p);
    if (ui.attacker && !isMe) canTarget = attackTargets(meView().me, ui.attacker).some(t => t.kind === "hero");
  } catch (e) {}
  return `<div class="hero-slot hero-portrait ${isMe ? "mine" : ""}${hurt}${canTarget ? " can-target" : ""}" data-hero="${isMe ? "me" : "opp"}" title="${p.name}">
    ${icon ? `<img src="${icon}" alt="${p.name}">` : ""}
    <div class="hero-hp">${p.hp}</div>
    <div class="hero-mana">${p.mana}/${p.maxMana}</div>
    ${tick}
  </div>`;
}
function waitMs(ms) { return new Promise(res => setTimeout(res, ms)); }
async function runAutoCombat(p) {
  if (!p || state.over) return;
  ui.battling = true;
  render();
  const e = opponent(p);
  const wave = p.board.slice();
  for (const m of wave) {
    if (state.over) break;
    if (!p.board.includes(m) || m.hp <= 0) continue;
    // R7: skip units without attack rights (e.g. summoned this turn without charge)
    if (!m.canAttack || m.attacksLeft <= 0 || (Number(m.atk) || 0) <= 0) continue;
    const legal = attackTargets(p, m);
    if (!legal.length) continue;
    const foe = e.board.find(x => x.hp > 0);
    const target = foe ? { kind: "minion", owner: e, minion: foe } : { kind: "hero", owner: e };
    const ok = legal.some(t => t.kind === target.kind && (t.kind === "hero" || t.minion.uid === target.minion.uid));
    if (!ok) continue;
    await doAttack(p, m, target, true);
    render();
    await waitMs(480);
  }
  ui.battling = false;
}
function endTurn() {
  if (state.over || ui.battling || state.busy) return;
  const p = current();
  if (p.isAI) return;
  ui.targeting = null; ui.attacker = null;
  runAutoCombat(p).then(() => passTurn());
}

function passTurn() {
  if (state.over) return;
  state.turn = state.turn === 1 ? 2 : 1;
  if (state.turn === 1) state.turnCount++;
  beginTurn(current());
  render();
  if (current().isAI) setTimeout(aiTurn, 350);
}


function isEquipItem(card) {
  return !!(card && card.type === "item" && String(card.text || "").startsWith("장착:"));
}
function isInstantItem(card) {
  return !!(card && card.type === "item" && !isEquipItem(card));
}
function unitCoinTotal(m) {
  if (!m) return 0;
  return Math.abs(m.atkC || 0) + Math.abs(m.defC || 0) + Math.abs(m.hpC || 0);
}
function unequipItem(m) {
  if (!m || !m.equippedItem) return;
  const b = m._itemBonuses || {};
  m.atk = Math.max(0, (Number(m.atk) || 0) - (b.atk || 0));
  m.def = (Number(m.def) || 0) - (b.def || 0);
  m.hp = Math.max(1, (Number(m.hp) || 0) - (b.hp || 0));
  m.maxHp = Math.max(m.hp, (Number(m.maxHp) || 0) - (b.hp || 0));
  if (b.atkSkill != null) {
    if (b.prevAtkSkill == null) delete m.atkSkill;
    else m.atkSkill = b.prevAtkSkill;
  }
  if (b.ability != null) {
    if (b.prevAbility == null) delete m.ability;
    else m.ability = b.prevAbility;
  }
  if (b.grantedCharge) {
    m.keywords = (m.keywords || []).filter(k => k !== "charge");
  }
  if (b.grantedKw) {
    m.keywords = (m.keywords || []).filter(k => k !== b.grantedKw);
  }
  delete m.equippedItem;
  delete m._itemBonuses;
  m.itemWorn = false;
  if (m._baseText != null) { m.text = m._baseText; delete m._baseText; }
}
function equipItemOnUnit(p, card, unit) {
  if (!unit || !p || !p.board.includes(unit)) return false;
  unequipItem(unit);
  let dAtk = Number(card.atk) || 0;
  let dDef = Number(card.def) || 0;
  let dHp = Number(card.hp) || 0;
  if (card.id === "ei4") {
    const n = unitCoinTotal(unit);
    dAtk = n; dHp = n; dDef = 0;
  } else if (card.id === "ai4") {
    dDef = unitCoinTotal(unit); dAtk = 0; dHp = 0;
  }
  const prevAtkSkill = unit.atkSkill;
  const prevAbility = unit.ability;
  let grantedCharge = false;
  let grantedKw = null;
  unit.atk = Math.max(0, (Number(unit.atk) || 0) + dAtk);
  unit.def = (Number(unit.def) || 0) + dDef;
  unit.hp = Math.max(1, (Number(unit.hp) || 0) + dHp);
  unit.maxHp = Math.max(unit.hp, (Number(unit.maxHp) || unit.hp) + dHp);
  if (card.atkSkill != null) {
    unit.atkSkill = card.atkSkill;
    if (card.atkSkill === 3) {
      unit.keywords = [...(unit.keywords || [])];
      if (!unit.keywords.includes("charge")) {
        unit.keywords.push("charge");
        grantedCharge = true;
        unit.canAttack = true;
        unit.attacksLeft = Math.max(unit.attacksLeft || 0, 1);
      }
    }
  }
  if (card.ability) {
    unit.ability = card.ability;
    const kwMap = { "보호": "shield", "활력": "vital", "환생": "rebirth", "강탈": "steal", "위압": "awe", "혼란": "confuse" };
    const kw = kwMap[card.ability];
    if (kw) {
      unit.keywords = [...(unit.keywords || [])];
      if (!unit.keywords.includes(kw)) { unit.keywords.push(kw); grantedKw = kw; }
    }
  }
  unit.equippedItem = { id: card.id, name: card.name, uid: card.uid };
  unit._itemBonuses = {
    atk: dAtk, def: dDef, hp: dHp,
    atkSkill: card.atkSkill, prevAtkSkill,
    ability: card.ability, prevAbility,
    grantedCharge, grantedKw
  };
  unit.itemWorn = true;
  if (unit._baseText == null) unit._baseText = unit.text || "";
  unit.text = "아이템착용중" + (unit._baseText ? " · " + unit._baseText : "");
  if (card.id === "ni1") draw(p, 1);
  log(`${p.name}이(가) ${unit.name}에게 ${card.name} 장착`);
  return true;
}
function resolveInstantItem(p, card) {
  const e = opponent(p);
  if (card.id === "ni4") {
    [...p.board, ...e.board].forEach(m => { m.atkC = 0; m.defC = 0; m.hpC = 0; });
    log("무풍: 모든 유닛 코인 0");
  } else if (card.id === "li3") {
    const base = (p.coinP != null) ? p.coinP : 0.5;
    p.coinP = Math.min(1, base + 0.2);
    log("행운의빛: 이번 턴 앞면 확률 +20%p");
  } else if (card.id === "di4") {
    const mark = (m) => {
      if (!m) return;
      if ((m.atkC || 0) || (m.defC || 0) || (m.hpC || 0)) m.coinGold = true;
    };
    [...p.board, ...e.board].forEach(mark);
    [...p.hand, ...e.hand].forEach(mark);
    log("황금저주: 코인이 금화로(앞면 고정)");
  } else {
    log(`${card.name} 효과`);
  }
}

function playCard(p, card, target) {
  if (p.mana < card.cost) return false;
  if (card.type === "minion" && p.noPlayMinion) {
    log("이번 턴에는 유닛을 낼 수 없습니다");
    return false;
  }
  if (card.type === "minion" && p.board.length >= 5) {
    log("전장이 가득 찼습니다 (최대 5장)");
    return false;
  }
  if (card.type === "item" && isEquipItem(card)) {
    const unit = target && target.kind === "minion" && target.owner === p ? target.minion : null;
    if (!unit || !p.board.includes(unit)) {
      log("장착할 아군 유닛이 없습니다");
      return false;
    }
  }
  p.mana -= card.cost;
  p.hand = p.hand.filter(c => c.uid !== card.uid);
  if (card.type === "minion") {
    try { Sfx.playSummon && Sfx.playSummon(); } catch (e) {}
    const m = card;
    m.canAttack = (m.keywords || []).includes("charge");
    m.attacksLeft = m.canAttack ? 1 : 0;
    const at = Math.max(0, Math.min(p.board.length, (typeof window._dropSlot === "number") ? window._dropSlot : p.board.length));
    p.board.splice(at, 0, m);
    window._dropSlot = null;
    log(`${p.name}이(가) ${m.name}을(를) 소환`);
    resolveBattlecry(p, m, target);
  } else if (card.type === "item") {
    if (isEquipItem(card)) {
      const unit = target.minion;
      equipItemOnUnit(p, card, unit);
    } else {
      log(`${p.name}이(가) ${card.name} 사용`);
      resolveInstantItem(p, card);
    }
  } else {
    log(`${p.name}이(가) ${card.name} 사용`);
    runSpellCast(p, card, target);
    return true;
  }
  checkWin();
  return true;
}

async function runSpellCast(p, card, target) {
  state.busy = true;
  try {
    await playSpellFx(card);
    resolveSpell(p, card, target);
  } finally {
    state.busy = false;
  }
  checkWin();
  render();
}

function playSpellFx(card) {
  if (window.SpellFx && SpellFx.play) return SpellFx.play(card);
  return Promise.resolve();
}
function buildSpellFx(stage, kind, card) {
  if (window.SpellFx && stage) {
    const elem = SpellFx.elemOf(card);
    stage.dataset.elem = elem;
  }
}


function needsTarget(card) {
  if (card && card.type === "item" && isEquipItem(card)) return true;
  if (card && card.type === "item") return false;
  const fx = card.type === "spell" ? card.spell : card.battlecry;
  if (!fx) return false;
  if (fx.type === "draw_ex" && (fx.sacOwn || fx.bounceOwn || fx.enemyDmg)) return true;
  if (fx.type === "kill_if" || fx.type === "set_one" || fx.type === "grant_extra" || fx.type === "double_def" || fx.type === "copy_own") return true;
  return ["dmg", "kill", "buff"].includes(fx.type) && fx.target;
}

function validTargets(p, fx) {
  const e = opponent(p);
  const list = [];
  if (fx && fx._itemEquip) {
    p.board.forEach(m => list.push({ kind: "minion", owner: p, minion: m }));
    return list;
  }
  if (!fx) return list;
  if (fx.type === "draw_ex" && (fx.sacOwn || fx.bounceOwn)) {
    p.board.forEach(m => list.push({ kind: "minion", owner: p, minion: m }));
    return list;
  }
  if (fx.type === "draw_ex" && fx.enemyDmg) {
    e.board.forEach(m => list.push({ kind: "minion", owner: e, minion: m }));
    return list;
  }
  if (fx.type === "kill_if") {
    e.board.forEach(m => {
      if (fx.minAtk != null && (m.atk || 0) < fx.minAtk) return;
      if (fx.maxAtk != null && (m.atk || 0) > fx.maxAtk) return;
      if (fx.maxCost != null && (m.cost || 0) > fx.maxCost) return;
      if (fx.anyCoin && !((m.atkC || 0) || (m.defC || 0) || (m.hpC || 0))) return;
      list.push({ kind: "minion", owner: e, minion: m });
    });
    return list;
  }
  if (fx.type === "set_one") {
    const sides = fx.target === "any_minion" ? [p, e] : fx.target === "own_minion" ? [p] : [e];
    sides.forEach(pl => pl.board.forEach(m => list.push({ kind: "minion", owner: pl, minion: m })));
    return list;
  }
  if (fx.type === "grant_extra" || fx.type === "double_def" || fx.type === "copy_own") {
    p.board.forEach(m => list.push({ kind: "minion", owner: p, minion: m }));
    return list;
  }
  if (fx.target === "any_enemy") {
    list.push({ kind: "hero", owner: e });
    e.board.forEach(m => list.push({ kind: "minion", owner: e, minion: m }));
  } else if (fx.target === "any_minion") {
    p.board.concat(e.board).forEach(m => list.push({ kind: "minion", owner: m === findOn(p, m.uid) ? p : e, minion: m }));
  } else if (fx.target === "own_minion") {
    p.board.forEach(m => list.push({ kind: "minion", owner: p, minion: m }));
  } else if (fx.target === "enemy_minion") {
    e.board.forEach(m => list.push({ kind: "minion", owner: e, minion: m }));
  }
  return list;
}

function findOn(p, uid) { return p.board.find(m => m.uid === uid); }

function resolveBattlecry(p, m, target) {
  const fx = m.battlecry;
  if (!fx) return;
  if (fx.type === "self_buff") {
    m.atk += fx.atk; m.hp += fx.hp; m.maxHp += fx.hp;
  } else {
    applyFx(p, fx, target);
  }
}

function resolveSpell(p, card, target) {
  applyFx(p, card.spell, target);
}

function applyFx(p, fx, target) {
  const e = opponent(p);
  if (!fx) return;
  if (fx.type === "dmg") {
    dealToTarget(p, target, fx.value);
    if (target && target.kind === "minion") {
      if (fx.skipAttack) target.minion.skipAttack = true;
      if (fx.coin) {
        target.minion.atkC = (target.minion.atkC || 0) + fx.coin;
        target.minion.defC = (target.minion.defC || 0) + fx.coin;
        target.minion.hpC = (target.minion.hpC || 0) + fx.coin;
      }
    }
  } else if (fx.type === "heal_hero") {
    p.hp = Math.min(p.maxHp, p.hp + fx.value);
  } else if (fx.type === "mana_next") {
    p.manaNext = (p.manaNext || 0) + (fx.value || 0);
  } else if (fx.type === "draw") {
    draw(p, fx.value);
  } else if (fx.type === "draw_ex") {
    if (fx.payHp) dealHero(p, fx.payHp);
    if (fx.healHero) p.hp = Math.min(p.maxHp, p.hp + fx.healHero);
    if (fx.manaNext) p.manaNext = (p.manaNext || 0) + fx.manaNext;
    if (fx.ownAllHp) [...p.board].forEach(m => damageMinion(p, m, fx.ownAllHp));
    if (fx.enemyDef) [...e.board].forEach(m => { m.def = Math.max(0, (m.def || 0) + fx.enemyDef); });
    if (fx.enemyDmg && target && target.kind === "minion") damageMinion(target.owner, target.minion, fx.enemyDmg);
    if (fx.noPlayMinion) p.noPlayMinion = true;
    if ((fx.sacOwn || fx.bounceOwn) && target && target.kind === "minion" && target.owner === p) {
      const m = target.minion;
      if (fx.bounceOwn) {
        p.board = p.board.filter(x => x !== m);
        p.hand.push(m);
      } else {
        destroyMinion(p, m);
      }
    }
    let n = fx.draw || 0;
    if (fx.drawBoard) n = p.board.length;
    if (n > 0) draw(p, n);
  } else if (fx.type === "aoe_pack") {
    const hit = (pl, m, dmg) => {
      if (dmg) damageMinion(pl, m, dmg);
      if (fx.coin) {
        m.atkC = (m.atkC || 0) + fx.coin;
        m.defC = (m.defC || 0) + fx.coin;
        m.hpC = (m.hpC || 0) + fx.coin;
      }
      if (fx.atkC) m.atkC = (m.atkC || 0) + fx.atkC;
      if (fx.defC) m.defC = (m.defC || 0) + fx.defC;
      if (fx.hpC) m.hpC = (m.hpC || 0) + fx.hpC;
      if (fx.skipAttack) m.skipAttack = true;
    };
    const edmg = fx.enemy || 0;
    const odmg = fx.own || 0;
    const both = fx.all || 0;
    if (both) {
      [...p.board].forEach(m => hit(p, m, both));
      [...e.board].forEach(m => hit(e, m, both));
    } else {
      [...e.board].forEach(m => hit(e, m, edmg));
      if (odmg) [...p.board].forEach(m => damageMinion(p, m, odmg));
      if (fx.ownHp) [...p.board].forEach(m => { m.hp += fx.ownHp; m.maxHp = (m.maxHp || m.hp) + fx.ownHp; });
    }
  } else if (fx.type === "aoe_enemy") {
    [...e.board].forEach(m => damageMinion(e, m, fx.value));
  } else if (fx.type === "aoe_all_enemy") {
    dealHero(e, fx.value);
    [...e.board].forEach(m => damageMinion(e, m, fx.value));
  } else if (fx.type === "kill") {
    if (target && target.kind === "minion") destroyMinion(target.owner, target.minion);
  } else if (fx.type === "kill_if") {
    if (target && target.kind === "minion") destroyMinion(target.owner, target.minion);
  } else if (fx.type === "set_one") {
    if (target && target.kind === "minion") {
      const m = target.minion;
      if (fx.atk != null) m.atk = fx.atk;
      if (fx.def != null) m.def = fx.def;
      if (fx.hp != null) { m.hp = fx.hp; m.maxHp = fx.hp; }
      if (fx.coinZero) { m.atkC = 0; m.defC = 0; m.hpC = 0; }
    }
  } else if (fx.type === "copy_own") {
    if (target && target.kind === "minion" && p.board.length < 5) {
      const o = target.minion;
      const c = cloneCard(o.id);
      c.atk = o.atk;
      c.def = o.def || 0;
      c.hp = o.hp;
      c.maxHp = o.maxHp || o.hp;
      c.atkC = o.atkC || 0;
      c.defC = o.defC || 0;
      c.hpC = o.hpC || 0;
      c.keywords = [...(o.keywords || [])];
      c.ability = o.ability;
      if (fx.kw) c.keywords = Array.from(new Set([...(c.keywords || []), fx.kw]));
      if (fx.ability) c.ability = fx.ability;
      c.canAttack = false;
      c.attacksLeft = 0;
      const idx = p.board.indexOf(o);
      p.board.splice(idx >= 0 ? idx + 1 : p.board.length, 0, c);
    }
  } else if (fx.type === "buff") {
    if (target && target.kind === "minion") {
      const m = target.minion;
      if (fx.atk) m.atk += fx.atk;
      if (fx.def) m.def = (m.def || 0) + fx.def;
      if (fx.hp) { m.hp += fx.hp; m.maxHp = (m.maxHp || m.hp) + fx.hp; }
      if (fx.kws && fx.kws.length) {
        m.keywords = Array.from(new Set([...(m.keywords || []), ...fx.kws]));
      }
      if (fx.ability) m.ability = fx.ability;
    }
  } else if (fx.type === "wipe_all") {
    [...p.board].forEach(m => destroyMinion(p, m));
    [...e.board].forEach(m => destroyMinion(e, m));
    if (fx.maxMana) p.maxMana = Math.max(0, (p.maxMana || 0) + fx.maxMana);
  } else if (fx.type === "coin_luck") {
    p.coinP = fx.value;
  } else if (fx.type === "buff_all") {
    p.board.forEach(m => {
      if (fx.atk) m.atk += fx.atk;
      if (fx.def) m.def = (m.def || 0) + fx.def;
      if (fx.hp) { m.hp += fx.hp; m.maxHp = (m.maxHp || m.hp) + fx.hp; }
    });
  } else if (fx.type === "grant_extra") {
    if (target && target.kind === "minion") {
      const m = target.minion;
      if (fx.atk) m.atk += fx.atk;
      if (fx.hp) { m.hp += fx.hp; m.maxHp = (m.maxHp || m.hp) + fx.hp; }
      m.canAttack = true;
      m.attacksLeft = (m.attacksLeft || 0) + 1;
    }
  } else if (fx.type === "set_enemy") {
    e.board.forEach(m => {
      if (fx.atk != null) m.atk = fx.atk;
      if (fx.coinZero) { m.atkC = 0; m.defC = 0; m.hpC = 0; }
    });
  } else if (fx.type === "grant_kw") {
    const add = (m) => {
      m.keywords = Array.from(new Set([...(m.keywords || []), fx.kw]));
      if (fx.ability) m.ability = fx.ability;
      if (fx.kw === "shield" && !(m.keywords || []).includes("shield")) m.keywords.push("shield");
    };
    if (fx.where === "hand") p.hand.filter(c => c.type === "minion").forEach(add);
    else p.board.forEach(add);
  } else if (fx.type === "double_def") {
    if (target && target.kind === "minion") target.minion.def = (target.minion.def || 0) * 2;
  } else if (fx.type === "mana") {
    p.mana += fx.value;
  } else if (fx.type === "face") {
    dealHero(e, fx.value);
  } else if (fx.type === "float_def") {
    const n = Math.max(0, 5 - p.board.length) + Math.max(0, 5 - e.board.length);
    [...p.board, ...e.board].forEach(m => { m.def = Math.max(0, (m.def || 0) - n); });
  } else if (fx.type === "seal_giant") {
    e.board.forEach(m => {
      if ((m.hp || 0) >= 6) { m.atk = 0; m.atkC = 0; }
    });
  } else if (fx.type === "summon_islands") {
    const slots = Math.max(0, 5 - p.board.length);
    for (let i = 0; i < slots; i++) {
      const tok = cloneCard("e40");
      tok.canAttack = false; tok.attacksLeft = 0;
      p.board.push(tok);
    }
  } else if (fx.type === "magnet") {
    e.board.forEach(m => {
      if (m.atkC || m.defC || m.hpC) { m.atk = 0; m.def = 0; }
    });
  } else if (fx.type === "earthquake") {
    const n = Math.floor((p.maxMana || 0) / 2);
    [...e.board].forEach(m => damageMinion(e, m, n));
  } else if (fx.type === "sandtrap") {
    const n = Math.max(0, 5 - p.board.length);
    e.board.slice(0, n).forEach(m => damageMinion(e, m, 3));
  } else if (fx.type === "maze") {
    [...e.board].forEach(m => { if ((m.cost || 0) > (p.maxMana || 0)) m.dying = true; });
    e.board.filter(m => m.dying).forEach(m => destroyMinion(e, m));
  } else if (fx.type === "tunnel") {
    p.board.forEach(m => {
      if ((m.cost || 0) <= 2) { m.atk = Math.max(0, m.atk - 2); m.def = (m.def || 0) + 3; }
    });
  } else if (fx.type === "tornado") {
    [...p.board, ...e.board].forEach(m => { if ((m.cost || 0) <= 2) m.dying = true; });
    [p, e].forEach(pl => pl.board.filter(m => m.dying).forEach(m => destroyMinion(pl, m)));
  } else if (fx.type === "smash") {
    p.board.forEach(m => {
      m.atk += 1;
      m.keywords = Array.from(new Set([...(m.keywords || []), "pierce"]));
    });
  } else if (fx.type === "giant_str") {
    p.board.forEach(m => { m.atk += 2; });
  } else if (fx.type === "sandhell") {
    const n = fx.value || 1;
    [...e.board].forEach(m => {
      m.atk = Math.max(0, (m.atk || 0) - n);
      m.def = Math.max(0, (m.def || 0) - n);
      damageMinion(e, m, n);
    });
  } else if (fx.type === "petrify") {
    e.board.forEach(m => {
      if ((m.atk || 0) <= 3) { m.atk = 0; m.def = (m.def || 0) + 1; }
    });
  }
  cleanupBoards();
}

function dealToTarget(srcOwner, target, n) {
  if (!target) {
    dealHero(opponent(srcOwner), n);
    return;
  }
  if (target.kind === "hero") dealHero(target.owner, n);
  else damageMinion(target.owner, target.minion, n);
}

function dealHero(p, n) {
  n = Number(n) || 0;
  if (!n) return;
  try { Sfx.playHeroHit && Sfx.playHeroHit(); } catch (e) {}
  const from = p.hp;
  p.hp -= n;
  p._hurt = { from, to: p.hp, dmg: n };
  log(`${p.name} 영웅이 ${n} 피해 (남은 체력 ${p.hp})`);
}

function damageMinion(owner, m, n) {
  if (!m) return;
  if ((m.keywords || []).includes("shield")) {
    m.keywords = m.keywords.filter(k => k !== "shield");
    log(`${m.name}의 보호막이 깨졌다`);
    return;
  }
  const from = m.hp;
  m.hp -= n;
  m.damaged = true;
  m._hurt = { from, to: m.hp, dmg: n };
  if (m.hp <= 0) m.dying = true;
}

function destroyMinion(owner, m) {
  if (!owner || !m) return;
  if (!owner.board.some(x => x.uid === m.uid)) return;
  if (typeof unequipItem === "function") unequipItem(m);
  const rebirth = (m.ability && String(m.ability).includes("환생")) || (m.keywords || []).includes("rebirth");
  if (rebirth) {
    m.keywords = (m.keywords || []).filter(k => k !== "rebirth");
    if (m.ability) m.ability = String(m.ability).replace(/,?환생/, "").replace(/^,/, "");
    m.hp = 1;
    m.dying = false;
    m.damaged = true;
    log(`${m.name}이(가) 환생했다 (체력 1)`);
    return;
  }
  owner.board = owner.board.filter(x => x.uid !== m.uid);
  log(`${m.name} 사망`);
  if (m.deathrattle) applyFx(owner, m.deathrattle, null);
}

function cleanupBoards() {
  [state.p1, state.p2].forEach(p => {
    const dead = p.board.filter(m => m.hp <= 0 || m.dying);
    dead.forEach(m => destroyMinion(p, m));
    p.board = p.board.filter(m => m.hp > 0 && !m.dying);
  });
}

function attackTargets(p, attacker) {
  const e = opponent(p);
  const list = [];
  e.board.forEach(m => list.push({ kind: "minion", owner: e, minion: m }));
  if (!e.board.length) list.push({ kind: "hero", owner: e });
  return list;
}

function fmtC(n) {
  if (!n) return "";
  return (n > 0 ? "+" : "-") + "C" + Math.abs(n);
}
function rollCoins(mod, unit) {
  const n = Math.abs(mod || 0);
  let luck = (state.acting && state.acting.coinP != null) ? state.acting.coinP : 0.5;
  if (unit && unit.coinGold) luck = 1;
  const flips = Array.from({ length: n }, () => Math.random() < luck);
  const heads = flips.filter(Boolean).length;
  const delta = n ? ((mod > 0 ? 1 : -1) * heads) : 0;
  return { flips, heads, delta };
}
function showCoinResult(title, rows, done) {
  rows = (rows || []).filter(r => r && r.flips && r.flips.length);
  if (!rows.length) { if (done) done(); return; }
  const layer = document.getElementById("coinLayer");
  const box = document.getElementById("coinBox");
  const plus = (typeof COIN_PLUS !== "undefined" && COIN_PLUS) ? COIN_PLUS : "assets/img/coins/plus.png";
  const minus = (typeof COIN_MINUS !== "undefined" && COIN_MINUS) ? COIN_MINUS : "assets/img/coins/minus.png";
  let flipsN = 0;
  box.innerHTML = `<h3>${title}</h3>` + rows.map(r => {
    if (!r.flips.length) return "";
    const coins = r.flips.map((h, i) => {
      flipsN++;
      const delay = (flipsN - 1) * 0.28;
      return `<div class="flip-coin" data-h="${h?1:0}"><img class="coin-flat flip-inner" src="${plus}" alt="" style="animation-delay:${delay}s"></div>`;
    }).join("");
    const sign = r.delta >= 0 ? "+" + r.delta : String(r.delta);
    return `<div>${r.label} ${r.modLabel || ""}</div><div class="coins">${coins}</div><div>${r.base} → <b>${r.value}</b> (${sign})</div>`;
  }).join("<hr style='border-color:#4a3a20'>");
  box.innerHTML += `<button class="menu-btn" id="coinOk" style="margin-top:14px;min-width:120px">OK</button>`;
  layer.classList.add("show");
  if (flipsN && window.Sfx && Sfx.playCoin) {
    for (let i = 0; i < flipsN; i++) setTimeout(() => Sfx.playCoin(), 80 + i * 280);
  }
  box.querySelectorAll(".flip-coin").forEach((el, idx) => {
    const h = el.getAttribute("data-h") === "1";
    const img = el.querySelector("img");
    const delay = idx * 280 + 400;
    setTimeout(() => { if (img) img.src = h ? plus : minus; }, delay);
    setTimeout(() => { el.innerHTML = `<img class="coin-flat" src="${h ? plus : minus}" alt="">`; }, delay + 480);
  });
  let settled = false;
  const finishCoin = () => {
    if (settled) return;
    settled = true;
    layer.classList.remove("show");
    if (done) done();
  };
  const btn = document.getElementById("coinOk");
  if (btn) btn.onclick = finishCoin;
  // Auto-advance so AI / end-turn combat never softlocks waiting for OK
  const autoMs = Math.max(900, 520 + flipsN * 300 + 380);
  setTimeout(finishCoin, autoMs);
}

function confirmGiveUp() {
  if (!state || state.over) return;
  const ov = document.getElementById("overlay");
  const md = document.getElementById("modal");
  md.innerHTML = `<h2>항복하시겠습니까?</h2>
    <p>지금 게임을 끝내고 메뉴로 돌아갑니다.</p>
    <button class="menu-btn" id="yesGive">예</button>
    <button class="menu-btn ghost" id="noGive">아니오</button>`;
  ov.classList.add("show");
  document.getElementById("yesGive").onclick = () => {
    ov.classList.remove("show");
    const { opp } = meView();
    finish(opp.name);
  };
  document.getElementById("noGive").onclick = () => ov.classList.remove("show");
}

function hidePeek() {
  const p = document.getElementById("cardPeek");
  if (p) p.remove();
}
function showPeek(el) {
  if (_drag || !el) return;
  const img = el.querySelector("img.card-face, img");
  if (!img || !img.src) return;
  hidePeek();
  const peek = document.createElement("div");
  peek.id = "cardPeek";
  peek.innerHTML = `<img src="${img.src}" alt="">`;
  document.body.appendChild(peek);
  const w = Math.min(300, window.innerHeight * 0.42);
  peek.style.cssText = "position:fixed;left:50%;top:46%;width:"+w+"px;transform:translate(-50%,-50%);z-index:200;pointer-events:none;margin:0;";
}

function placeDropGlow(on, x, y) {
  const glow = document.getElementById("dropGlow");
  const game = document.getElementById("game");
  if (!glow || !game) return;
  if (!on) { glow.classList.remove("on"); return; }
  const mine = document.getElementById("myBoard");
  if (!mine) { glow.classList.remove("on"); return; }
  const gr = game.getBoundingClientRect();
  const b = mine.getBoundingClientRect();
  const s = (window.StageSettings && StageSettings.stageScale)
    ? StageSettings.stageScale()
    : (parseFloat((document.getElementById("app") || {}).dataset && document.getElementById("app").dataset.stageScale || "1") || 1);
  const top = b.top - 8;
  const bottom = b.bottom + 8;
  const left = b.left - 8;
  const right = b.right + 8;
  glow.style.top = ((top - gr.top) / s) + "px";
  glow.style.left = ((left - gr.left) / s) + "px";
  glow.style.width = ((right - left) / s) + "px";
  glow.style.height = ((bottom - top) / s) + "px";
  glow.classList.add("on");
}

let _drag = null;

function unitFromPoint(x, y) {
  const me = meView().me;
  const board = document.getElementById("myBoard");
  if (!board || !me) return null;
  const slots = [...board.querySelectorAll(".slot.filled .minion, .slot .minion")];
  for (const el of slots) {
    const r = el.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
      const uid = el.getAttribute("data-uid");
      const m = me.board.find(u => u.uid === uid);
      if (m) return { kind: "minion", owner: me, minion: m };
    }
  }
  // nearest filled slot by center
  let best = null, bestD = 1e9;
  board.querySelectorAll(".slot.filled").forEach(sl => {
    const r = sl.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const d = Math.hypot(x - cx, y - cy);
    if (d < bestD && d < Math.max(r.width, r.height) * 0.75) {
      bestD = d;
      const minion = sl.querySelector(".minion");
      if (minion) {
        const uid = minion.getAttribute("data-uid");
        const m = me.board.find(u => u.uid === uid);
        if (m) best = { kind: "minion", owner: me, minion: m };
      }
    }
  });
  return best;
}
function clearEquipHover() {
  document.querySelectorAll(".minion.equip-glow").forEach(el => el.classList.remove("equip-glow"));
}
function highlightEquipHover(x, y, allowed) {
  clearEquipHover();
  if (!allowed) return;
  const hit = unitFromPoint(x, y);
  if (!hit) return;
  const el = document.querySelector('.minion[data-uid="' + hit.minion.uid + '"]');
  if (el) el.classList.add("equip-glow");
}

function canDropCard(card) {
  if (!state || !card) return false;
  if (state.busy) return false;
  const me = meView().me;
  if (state.over || current() !== me || me.isAI) return false;
  if (me.mana < card.cost) return false;
  if (card.type === "minion" && me.board.length >= 5) return false;
  if (card.type === "item" && isEquipItem(card) && !me.board.length) return false;
  return true;
}
function overBoard(x, y) {
  const mine = document.getElementById("myBoard");
  const opp = document.getElementById("oppBoard");
  if (!mine) return false;
  const r = mine.getBoundingClientRect();
  // Pad hit box — scaled stages + hand fan made exact rect drops flaky
  const padX = Math.max(12, r.width * 0.04);
  const padY = Math.max(16, r.height * 0.08);
  if (x < r.left - padX || x > r.right + padX || y < r.top - padY || y > r.bottom + padY) return false;
  if (opp) {
    const o = opp.getBoundingClientRect();
    // Only reject if clearly still in the enemy lane (not merely near the shared midline)
    const mid = (o.bottom + r.top) / 2;
    if (y < mid) return false;
  }
  return true;
}
function setDropGlow(on) {
  const g = document.getElementById("game");
  if (g) g.classList.toggle("drop-ready", !!on);
  const b = document.getElementById("myBoard");
  if (b) b.classList.toggle("drop-glow", !!on);
}
function slotIndexFromPoint(x, y) {
  const board = document.getElementById("myBoard");
  if (!board) return 0;
  const slots = [...board.querySelectorAll(".slot")];
  if (!slots.length) return 0;
  let best = 0, bestD = 1e9;
  slots.forEach((sl, i) => {
    const r = sl.getBoundingClientRect();
    if (r.width < 2) return;
    const d = Math.abs(x - (r.left + r.width / 2));
    if (d < bestD) { bestD = d; best = i; }
  });
  return Math.max(0, Math.min(5, best));
}
function bindHandCard(el, card) {
  el.onpointerenter = () => showPeek(el);
  el.onpointerleave = hidePeek;
  // Prefer pointer events; also bind mouse* so headless/Electron drags never miss
  const startDrag = (ev) => {
    hidePeek();
    if (ev.button != null && ev.button !== 0) return;
    if (!canDropCard(card)) return;
    if (_drag) return;
    ev.preventDefault();
    ev.stopPropagation();
    clearDrag();
    try { if (ev.pointerId != null && el.setPointerCapture) el.setPointerCapture(ev.pointerId); } catch (err) {}
    const r = el.getBoundingClientRect();
    const ghost = el.cloneNode(true);
    ghost.classList.add("drag-ghost");
    ghost.style.cssText = "position:fixed;left:"+ev.clientX+"px;top:"+ev.clientY+"px;width:"+r.width+"px;height:"+r.height+"px;margin:0;transform:translate(-50%,-60%);z-index:200;pointer-events:none;";
    document.body.appendChild(ghost);
    el.classList.add("dragging");
    _drag = { card, el, ghost, pid: ev.pointerId, x0: ev.clientX, y0: ev.clientY };
    const move = (e) => {
      if (!_drag) return;
      _drag.ghost.style.left = e.clientX + "px";
      _drag.ghost.style.top = e.clientY + "px";
      const cardRef = _drag.card;
      if (cardRef && cardRef.type === "item" && isEquipItem(cardRef)) {
        placeDropGlow(false);
        highlightEquipHover(e.clientX, e.clientY, canDropCard(cardRef));
      } else {
        clearEquipHover();
        placeDropGlow(overBoard(e.clientX, e.clientY) && canDropCard(cardRef), e.clientX, e.clientY);
      }
    };
    const up = (e) => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
      window.removeEventListener("mousemove", move, true);
      window.removeEventListener("mouseup", up, true);
      try { if (ev.pointerId != null && el.releasePointerCapture) el.releasePointerCapture(ev.pointerId); } catch (err) {}
      if (!_drag) return;
      const cardRef = _drag.card;
      let ok = false;
      if (cardRef && cardRef.type === "item" && isEquipItem(cardRef)) {
        const hit = unitFromPoint(e.clientX, e.clientY);
        clearEquipHover();
        clearDrag();
        if (hit && canDropCard(cardRef)) {
          try { Sfx.playCardDrop && Sfx.playCardDrop(); } catch (err) {}
          playCard(meView().me, cardRef, hit);
          render();
        }
        return;
      }
      ok = overBoard(e.clientX, e.clientY) && canDropCard(cardRef);
      if (ok) window._dropSlot = slotIndexFromPoint(e.clientX, e.clientY);
      else window._dropSlot = null;
      clearDrag();
      if (ok) {
        try { Sfx.playCardDrop && Sfx.playCardDrop(); } catch (err) {}
        onHandClick(cardRef);
      }
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    window.addEventListener("mousemove", move, true);
    window.addEventListener("mouseup", up, true);
  };
  el.onpointerdown = startDrag;
  el.onmousedown = startDrag;
}

function onHandClick(card) {
  const me = meView().me;
  if (state.over || current() !== me || current().isAI) return;
  if (ui.targeting || ui.attacker) { ui.targeting = null; ui.attacker = null; render(); }
  if (me.mana < card.cost) return;
  if (card.type === "minion" && me.board.length >= 5) return;
  if (needsTarget(card)) {
    const fx = (card.type === "item" && isEquipItem(card))
      ? { _itemEquip: true }
      : (card.type === "spell" ? card.spell : card.battlecry);
    const targets = validTargets(me, fx);
    if (!targets.length) {
      if (card.type === "minion") { playCard(me, card, null); render(); }
      else log(card.type === "item" ? "장착할 아군 유닛이 없습니다" : "마땅한 대상이 없습니다");
      return;
    }
    ui.targeting = { card, targets };
    render();
    return;
  }
  playCard(me, card, null);
  render();
}

function onMinionClick(owner, minion, side) {
  const me = meView().me;
  if (!minion) return;
  if (ui.targeting) {
    const hit = ui.targeting.targets.find(t => t.kind === "minion" && t.minion.uid === minion.uid);
    if (!hit) return;
    const card = ui.targeting.card;
    ui.targeting = null;
    playCard(me, card, hit);
    render();
    return;
  }
  // 전투는 턴 종료 후 자동. 클릭 공격 없음.
}

document.getElementById("game").addEventListener("click", (e) => {
  if (e.target.id === "endBtn") { Sfx.playTurn && Sfx.playTurn(); endTurn(); return; }
  if (e.target.id === "giveBtn") { confirmGiveUp(); return; }
  if (e.target.id === "powerBtn" || e.target.closest("#powerBtn")) { return; }
  const portrait = e.target.closest(".hero-portrait, .hero-slot, .hud-hero");
  if (portrait) {
    const { me, opp } = meView();
    const side = portrait.dataset.hero || (portrait.closest("#myStrip") ? "me" : "opp");
    const who = side === "me" ? me : opp;
    if (ui.targeting) {
      const hit = ui.targeting.targets.find(t => t.kind === "hero" && t.owner === who);
      if (hit) {
        const card = ui.targeting.card;
        ui.targeting = null;
        playCard(me, card, hit);
        render();
      }
      return;
    }
    if (ui.attacker && who === opp) {
      doAttack(me, ui.attacker, { kind: "hero", owner: opp });
      ui.attacker = null;
      render();
      return;
    }
    if (who === me && current() === me && !current().isAI) {
      useHeroPower(me); render();
    }
  }
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") { ui.targeting = null; ui.attacker = null; render(); }
});


let draftDeck = [];

function tribeCards() {
  // Deck builder: units + spells + items
  return CARDS.filter(c => !c.token && c.tribe === selectedHero.id)
    .filter(c => {
      if (!ui.rarityFilter || ui.rarityFilter === "all") return true;
      return (c.rarity || "common") === ui.rarityFilter;
    })
    .sort((a,b) => (a.cost||0) - (b.cost||0) || a.name.localeCompare(b.name, "ko"));
}
function copiesInDraft(id) { return draftDeck.filter(x => x === id).length; }
function maxCopies(id) {
  const c = CARD_MAP[id];
  return (c && (c.rarity === "legendary" || c.rarity === "heroic")) ? 1 : 2;
}

function addToDraft(id) {
  if (draftDeck.length >= 30) return;
  if (copiesInDraft(id) >= maxCopies(id)) return;
  draftDeck.push(id);
  renderBuilder();
}
function removeFromDraft(id) {
  const i = draftDeck.lastIndexOf(id);
  if (i >= 0) draftDeck.splice(i, 1);
  renderBuilder();
}
function autoFillDraft() {
  const pool = tribeCards().map(c => c.id);
  let guard = 0;
  while (draftDeck.length < 30 && guard++ < 400) {
    const id = pool[Math.floor(Math.random() * pool.length)];
    if (copiesInDraft(id) < maxCopies(id)) draftDeck.push(id);
  }
  renderBuilder();
}
function saveDraftDeck() {
  if (draftDeck.length !== 30) {
    alert("덱은 정확히 30장이어야 저장됩니다. 지금 " + draftDeck.length + "장입니다.");
    return false;
  }
  const map = loadSavedDecks();
  map[selectedHero.id] = draftDeck.slice();
  persistDecks(map);
  alert(selectedHero.name + " 종족 덱을 저장했습니다.");
  return true;
}


function loreOf(id) {
  if (CARD_LORE[id]) return CARD_LORE[id];
  const c = CARD_MAP[id];
  if (!c) return "";
  return (c.text ? c.text + " — " : "") + (c.rarity === "legendary" ? "전설 카드." : "종족의 힘을 담은 카드.");
}

let _popCardId = null;
function closeCardPops() {
  document.getElementById("cardMenuPop").classList.remove("show");
  document.getElementById("cardLorePop").classList.remove("show");
  _popCardId = null;
}
function openCardMenu(id) {
  const c = CARD_MAP[id];
  if (!c) return;
  _popCardId = id;
  document.getElementById("cardMenuTitle").textContent = c.name;
  document.getElementById("cardMenuPop").classList.add("show");
}
async function openCardLore(id) {
  const c = CARD_MAP[id];
  if (!c) return;
  _popCardId = id;
  document.getElementById("cardMenuPop").classList.remove("show");
  const slot = document.getElementById("loreCardSlot");
  slot.innerHTML = renderCard(c, false);
  const face = await composeCardFace(c);
  const img = slot.querySelector("img.card-face");
  if (img && face) img.src = face;
  document.getElementById("loreName").textContent = c.name;
  const raceNm = c.type === "minion" ? (c.race || (CARD_RACE && CARD_RACE[c.id]) || "") : (c.type === "item" ? "아이템" : ((SPELL_SCHOOL && SPELL_SCHOOL[c.tribe]) || "주문"));
  const RARITY_KO = { common:"일반", rare:"희귀", heroic:"영웅", legendary:"전설" };
  const rareKo = RARITY_KO[c.rarity || "common"] || "일반";
  const cap = (c.rarity === "legendary" || c.rarity === "heroic") ? "덱당 1장" : "최대 2장";
  const bits = [c.cost + "마나", (TRIBES.find(t => t.id === c.tribe) || {}).name || "", raceNm, c.type === "minion" ? (c.atk + "/" + (c.def||0) + "/" + c.hp) : "주문", rareKo, cap];
  document.getElementById("loreMeta").textContent = bits.filter(Boolean).join(" · ");
  document.getElementById("loreText").textContent = loreOf(id);
  document.getElementById("cardLorePop").classList.add("show");
}


function renderBuilder() {
  document.getElementById("poolTitle").textContent = selectedHero.name + " 카드 (" + selectedHero.en + ")";
  const meta = document.getElementById("deckMeta");
  meta.textContent = draftDeck.length + " / 30  ·  일반·희귀 2장, 영웅·전설 1장";
  meta.className = "deck-meta " + (draftDeck.length === 30 ? "ok" : "bad");
  const pool = document.getElementById("cardPool");
  pool.innerHTML = tribeCards().map(c => {
    const n = copiesInDraft(c.id);
    const cap = maxCopies(c.id);
    return `<div class="pool-item ${n>=cap?"full":""}" data-id="${c.id}">
      <span class="pool-count">${n}/${cap}</span>
      ${renderCard(c, n < cap && draftDeck.length < 30)}
    </div>`;
  }).join("");
  document.querySelectorAll("#rarityBar button").forEach(btn => {
    btn.classList.toggle("on", btn.dataset.r === ui.rarityFilter);
    btn.onclick = (ev) => { ev.stopPropagation(); ui.rarityFilter = btn.dataset.r; renderBuilder(); };
  });
    pool.querySelectorAll(".pool-item").forEach(el => {
    el.onclick = () => openCardMenu(el.dataset.id);
  });
  const counts = {};
  draftDeck.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
  const list = document.getElementById("deckList");
  const rows = Object.keys(counts).sort((a,b) => (CARD_MAP[a].cost||0) - (CARD_MAP[b].cost||0));
  list.innerHTML = rows.map(id => {
    const c = CARD_MAP[id];
    return `<div class="deck-row" data-id="${id}">
      <span>${c.cost} · ${c.name}</span><b>x${counts[id]}</b>
    </div>`;
  }).join("") || `<div class="deck-meta">왼쪽 카드를 눌러 넣으세요.</div>`;
  list.querySelectorAll(".deck-row").forEach(el => {
    el.onclick = () => removeFromDraft(el.dataset.id);
  });
}


function renderHeroPicks() {
  const box = document.getElementById("heroPicks");
  box.innerHTML = TRIBES.map(h => `
    <div class="hero-card ${h.open && selectedHero.id === h.id ? "sel" : ""} ${h.open ? "" : "lock"}" data-id="${h.id}" style="--tc:${h.color}">
      <div class="art"><img src="${(typeof TRIBE_ICONS!=="undefined" && TRIBE_ICONS[h.id]) || ""}" alt="${h.name}"></div>
      <h3>${h.name}<small>${h.en}</small></h3>
    </div>`).join("");
  box.querySelectorAll(".hero-card").forEach(el => {
    el.onclick = () => {
      const h = TRIBES.find(x => x.id === el.dataset.id);
      if (!h.open) return;
      selectedHero = h;
      renderHeroPicks();
    };
  });
}
renderHeroPicks();
document.getElementById("btnAi").onclick = () => startGame(true);
document.getElementById("btnPvp").onclick = () => startGame(false);
document.getElementById("btnDeck").onclick = () => { draftDeck = (loadSavedDecks()[selectedHero.id] || []).slice(); showBuilder(); };
document.getElementById("btnBackMenu").onclick = () => backTitle();
document.getElementById("btnClearDeck").onclick = () => { draftDeck = []; renderBuilder(); };
document.getElementById("btnAutoFill").onclick = () => autoFillDraft();
document.getElementById("btnSaveDeck").onclick = () => saveDraftDeck();
document.getElementById("btnPlaySaved").onclick = () => {
  if (!saveDraftDeck()) return;
  startGame(true);
};


/* 약 3분 모험 BGM — 오리지널 Web Audio 악보, 구간이 바뀌며 루프 */

function openHelp() {
  const box = document.getElementById("raceHelpList");
  if (box && !box.dataset.ready) {
    box.innerHTML = "<h3>종족 도감 (" + RACE_LORE.length + ")</h3>" + RACE_LORE.map(r =>
      '<div class="race-item"><b>' + r[0] + '</b><p>' + r[1] + '</p></div>'
    ).join("");
    box.dataset.ready = "1";
  }
  document.getElementById("helpPop").classList.add("show");
}
function closeHelp() {
  document.getElementById("helpPop").classList.remove("show");
}
document.getElementById("btnHelp").onclick = openHelp;
document.getElementById("btnHelpClose").onclick = closeHelp;
document.getElementById("helpPop").addEventListener("click", e => {
  if (e.target.id === "helpPop") closeHelp();
});

document.getElementById("bgmBtn").onclick = (e) => {
  e.stopPropagation();
  Bgm.toggle();
};
document.body.addEventListener("click", () => {
  if (!Bgm.isOn()) Bgm.start();
  try { Sfx.warmup && Sfx.warmup(); } catch (e) {}
}, { once: true });


document.getElementById("btnCardAdd").onclick = () => {
  if (_popCardId) addToDraft(_popCardId);
  closeCardPops();
};
document.getElementById("btnCardLore").onclick = () => {
  if (_popCardId) openCardLore(_popCardId);
};
document.getElementById("btnCardMenuClose").onclick = closeCardPops;
document.getElementById("btnLoreAdd").onclick = () => {
  if (_popCardId) addToDraft(_popCardId);
  closeCardPops();
};
document.getElementById("btnLoreClose").onclick = closeCardPops;
document.getElementById("cardMenuPop").addEventListener("click", e => {
  if (e.target.id === "cardMenuPop") closeCardPops();
});
document.getElementById("cardLorePop").addEventListener("click", e => {
  if (e.target.id === "cardLorePop") closeCardPops();
});


document.addEventListener("click", (e) => {
  if (e.target.closest("button,.menu-btn,.end-btn,.give-btn,.hero-card")) {
    try { Sfx.playClick && Sfx.playClick(); } catch (err) {}
  }
}, true);
