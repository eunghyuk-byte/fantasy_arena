const GAME_VERSION = "0.219";
window.GAME_VERSION = GAME_VERSION;

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
  const kws = [...(b.keywords || [])];
  const hasPierceText = String(b.text || "").includes("관통");
  if ((b.atkSkill === 2 || hasPierceText) && !kws.includes("pierce")) kws.push("pierce");
  return {
    ...b,
    keywords: kws,
    uid: uid(),
    maxHp: b.hp || 0,
    canAttack: false,
    attacksLeft: 0,
    damaged: false,
  };
}
function cloneCoinFor(p) {
  const c = cloneCard("coin");
  let tid = (p && p.hero && p.hero.id) || "earth";
  if (tid === "metal") tid = "earth";
  c.tribe = tid;
  return c;
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
    // Drop deleted/token/unknown ids (e.g. post-hero-power leftovers, empty autoFill).
    // cloneCard missing-id stub otherwise shows as 「?」/토큰 0/0/1 in hand.
    if (Array.isArray(saved) && saved.length === 30) {
      const clean = saved.filter(id => {
        const c = CARD_MAP[id];
        return c && !c.token;
      });
      if (clean.length === 30) return shuffle(clean);
    }
  }
  return buildDeck(hero.id);
}
function makePlayer(hero, isAI, name) {
  return {
    name, hero, isAI,
    hp: 40, maxHp: 40,
    soul: 0, maxSoul: 0,
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
  while (el.children.length > 6) el.lastChild.remove();
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
  try { if (typeof SpellFx !== "undefined" && SpellFx.playUi) SpellFx.playUi("deck_draw"); } catch (e) {}
  const pile = document.querySelector("#myDeck .pile-stack") || document.querySelector("#myDeck .deck-pile");
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
  // AI·핫시트 모두: 열린 종족 중 랜덤 (내 종족 제외, 없으면 전체 열린 종족)
  const others = TRIBES.filter(tr => tr.open && tr.id !== (mine && mine.id));
  const pool = others.length ? others : TRIBES.filter(tr => tr.open);
  if (!pool.length) return mine;
  return pool[Math.floor(Math.random() * pool.length)] || mine;
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
  // 선공 랜덤: 후공은 손패 +1 + 동전
  const p1First = Math.random() < 0.5;
  const first = p1First ? state.p1 : state.p2;
  const second = p1First ? state.p2 : state.p1;
  draw(first, 3);
  draw(second, 4);
  second.hand.push(cloneCoinFor(second));
  state.turn = p1First ? 1 : 2;
  beginTurn(first);
  showGame();
  render();
  try {
    (async () => {
      try {
        if (typeof SpellFx !== "undefined" && SpellFx.playMatch) {
          await Promise.race([
            SpellFx.playMatch("match_start"),
            new Promise(r => setTimeout(r, 2200))
          ]);
        }
      } catch (e) {}
      try {
        if (typeof SpellFx !== "undefined" && SpellFx.playUi) SpellFx.playUi("hero_intro");
      } catch (e) {}
    })();
  } catch (e) {}
  if (first.isAI) aiTurn();
}

function beginTurn(p) {
  try { hidePeek(); } catch (e) {}
  try { if (typeof SpellFx !== "undefined" && SpellFx.clear) SpellFx.clear(); } catch (e) {}
  state.acting = p;
  p.maxSoul = Math.min(10, p.maxSoul + 1);
  p.soul = p.maxSoul;
  if (p.soulNext) { p.soul += p.soulNext; p.soulNext = 0; }
  p.noPlayMinion = false;
  p.coinP = null;
  p.board.forEach(m => {
    if (m.skipAttack || unitCannotAttack(m)) { m.canAttack = false; m.attacksLeft = 0; m.skipAttack = false; }
    else { m.canAttack = true; m.attacksLeft = 1; }
  });
  draw(p, 1);
  log(`${p.name}의 턴 · 소울 ${p.soul}`);
  try {
    if (typeof SpellFx !== "undefined" && SpellFx.playMatch) {
      let isMe = !p.isAI;
      try {
        if (typeof meView === "function") isMe = (p === meView().me);
      } catch (e) {}
      // Fire-and-forget — do not delay AI
      SpellFx.playMatch(isMe ? "turn_start_me" : "turn_start_enemy");
    }
  } catch (e) {}
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
    <div class="hero-soul">${p.soul}/${p.maxSoul}</div>
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
    // R7: 공격권 없는 유닛만 스킵 (판마: 소환 직후에도 canAttack=true)
    // 공격불가(cannotAttack): 턴 종료 자동전투에서 공격 피해를 주지 않음
    if (unitCannotAttack(m) || !m.canAttack || m.attacksLeft <= 0 || (Number(m.atk) || 0) <= 0) continue;
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
  try { hidePeek(); } catch (e) {}
  try { if (typeof SpellFx !== "undefined" && SpellFx.clear) SpellFx.clear(); } catch (e) {}
  if (state.over || ui.battling || state.busy) return;
  const p = current();
  if (p.isAI) return;
  ui.targeting = null; ui.attacker = null;
  runAutoCombat(p).then(() => passTurn());
}

function passTurn() {
  if (state.over) return;
  try { hidePeek(); } catch (e) {}
  try { if (typeof SpellFx !== "undefined" && SpellFx.clear) SpellFx.clear(); } catch (e) {}
  state.turn = state.turn === 1 ? 2 : 1;
  if (state.turn === 1) state.turnCount++;
  beginTurn(current());
  render();
  if (current().isAI) setTimeout(aiTurn, 350);
}


function isEquipItem(card) {
  return !!(card && card.type === "item" && !card.instant);
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
  if (b.savedCoins) {
    m.atkC = b.savedCoins.atkC || 0;
    m.defC = b.savedCoins.defC || 0;
    m.hpC = b.savedCoins.hpC || 0;
  }
  if (b.clearedCoinGold) delete m.coinGold;
  if (b.grantedCoinLuck) delete m.coinLuckBonus;
  delete m.equippedItem;
  delete m._itemBonuses;
  m.itemWorn = false;
  if (m._baseText != null) { m.text = m._baseText; delete m._baseText; }
}
function equipItemOnUnit(p, card, unit) {
  if (!unit || !p || !p.board.includes(unit)) return false;
  const replacing = !!(unit.equippedItem);
  if (replacing) {
    try { if (typeof SpellFx !== "undefined" && SpellFx.playItem) SpellFx.playItem("item_replace"); } catch (e) {}
  } else {
    try { if (typeof SpellFx !== "undefined" && SpellFx.playItem) SpellFx.playItem("item_equip"); } catch (e) {}
  }
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
      // 돌진 = DEF bonus damage in combat; not a can-attack / haste flag
      unit.keywords = [...(unit.keywords || [])];
      if (!unit.keywords.includes("charge")) {
        unit.keywords.push("charge");
        grantedCharge = true;
      }
    }
  }
  if (card.ability) {
    unit.ability = card.ability;
    const kwMap = { "보호": "shield", "환생": "rebirth", "강탈": "steal", "출전": "battlecry", "복수": "revenge", "유언": "deathrattle", "면역": "immune" };
    const kw = kwMap[card.ability];
    if (kw) {
      unit.keywords = [...(unit.keywords || [])];
      if (!unit.keywords.includes(kw)) { unit.keywords.push(kw); grantedKw = kw; }
    }
  }
  unit.equippedItem = { id: card.id, name: card.name, uid: card.uid };
  const bonuses = {
    atk: dAtk, def: dDef, hp: dHp,
    atkSkill: card.atkSkill, prevAtkSkill,
    ability: card.ability, prevAbility,
    grantedCharge, grantedKw
  };
  if (card.id === "ni4") {
    bonuses.savedCoins = { atkC: unit.atkC || 0, defC: unit.defC || 0, hpC: unit.hpC || 0 };
    unit.atkC = 0; unit.defC = 0; unit.hpC = 0;
  }
  if (card.id === "fi5") {
    bonuses.savedCoins = { atkC: unit.atkC || 0, defC: unit.defC || 0, hpC: unit.hpC || 0 };
    const a = unit.atkC || 0, d = unit.defC || 0, h = unit.hpC || 0;
    const n = Math.max(Math.abs(a), Math.abs(d), Math.abs(h));
    if (n <= 0) {
      unit.atkC = -5; unit.defC = 0; unit.hpC = 0;
    } else {
      const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
      const sa = sign(a), sd = sign(d), sh = sign(h);
      unit.atkC = sa ? sa * 5 : 0;
      unit.defC = sd ? sd * 5 : 0;
      unit.hpC = sh ? sh * 5 : 0;
    }
  }
  if (card.id === "di4") {
    if ((unit.atkC || 0) || (unit.defC || 0) || (unit.hpC || 0)) {
      unit.coinBlack = false;
      unit.coinGold = true;
      bonuses.clearedCoinGold = true;
    }
  }
  if (card.id === "li3") {
    unit.coinLuckBonus = 0.2;
    bonuses.grantedCoinLuck = true;
  }
  unit._itemBonuses = bonuses;
  unit.itemWorn = true;
  if (unit._baseText == null) unit._baseText = unit.text || "";
  {
    const itemBits = [];
    if (card.ability) itemBits.push(String(card.ability).split(",")[0].trim());
    else if (card.atkSkill != null && typeof ATK_SKILL_HELP !== "undefined" && ATK_SKILL_HELP[card.atkSkill]) {
      itemBits.push(ATK_SKILL_HELP[card.atkSkill][0]);
    } else if (card.text) {
      const raw = String(card.text).replace(/\s*부여\s*$/, "").trim();
      if (raw) itemBits.push(raw);
    }
    const parts = ["아이템 착용중", ...itemBits];
    if (unit._baseText) parts.push(unit._baseText);
    const uniq = [];
    parts.forEach(p => { if (p && !uniq.includes(p)) uniq.push(p); });
    unit.text = uniq.join(" · ");
  }
  if (card.id === "ni1") draw(p, 1);
  log(`${p.name}이(가) ${unit.name}에게 ${card.name} 장착`);
  return true;
}
function resolveInstantItem(p, card) {
  log(`${card.name} 효과`);
}

function playCard(p, card, target) {
  if (p.soul < card.cost) return false;
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
  p.soul -= card.cost;
  p.hand = p.hand.filter(c => c.uid !== card.uid);
  if (card.type === "minion") {
    try { Sfx.playSummon && Sfx.playSummon(); } catch (e) {}
    const m = card;
    // 판마: 소환 수면 없음 — 이번 턴에 낸 유닛도 공격 가능 (공격불가 제외)
    if (unitCannotAttack(m)) { m.canAttack = false; m.attacksLeft = 0; }
    else { m.canAttack = true; m.attacksLeft = 1; }
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
    await playSpellFx(card, target);
    resolveSpell(p, card, target);
  } finally {
    state.busy = false;
  }
  checkWin();
  render();
}

function playSpellFx(card, target) {
  if (typeof SpellFx !== "undefined" && SpellFx.play) return SpellFx.play(card, { target });
  return Promise.resolve();
}
function buildSpellFx(stage, kind, card) {
  if (typeof SpellFx !== "undefined" && stage) {
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
  if (fx.type === "kill_if" || fx.type === "set_one" || fx.type === "grant_extra" || fx.type === "double_def" || fx.type === "copy_own" || fx.type === "own_black_buff") return true;
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

function abilityOf(m) {
  return (m && m.ability) || null;
}
/** Permanent: skip dealing attack in end-of-turn combat / no attack rights. Still takes damage. */
function unitCannotAttack(m) {
  if (!m) return false;
  return !!(m.cannotAttack || abilityOf(m) === "공격불가");
}
function isImmune(m) {
  if (!m) return false;
  return abilityOf(m) === "면역" || (m.keywords || []).includes("immune");
}

function resolveBattlecry(p, m, target) {
  resolvePlayAbility(p, m);
  const fx = m.battlecry;
  if (!fx) return;
  if (fx.type === "self_buff") {
    m.atk += fx.atk; m.hp += fx.hp; m.maxHp += fx.hp;
  } else {
    applyFx(p, fx, target);
  }
}

/** Play-time special abilities (낼 때). */
function resolvePlayAbility(p, m) {
  const ab = abilityOf(m);
  if (!ab) return;
  if (ab === "출전") {
    log(`${m.name} 출전 → 드로우1`);
    draw(p, 1);
  }
}

function resolveSpell(p, card, target) {
  applyFx(p, card.spell, target);
}


function adjustSharedCoinN(m, delta) {
  // 공유 물리 코인 N만 증감. 골드/블랙 변환 아님. 링크 부호 유지, |링크|=newN 또는 0.
  if (!m || !delta) return;
  const links = [m.atkC || 0, m.defC || 0, m.hpC || 0];
  const nz = links.filter(v => v !== 0).map(Math.abs);
  const N = nz.length ? Math.max(...nz) : 0;
  let newN = Math.max(0, Math.min(5, N + delta));
  if (N === 0 && delta > 0) {
    // 링크 없는 유닛에 코인+ : 기본적으로 공+ 링크 부여(최소 의미 있는 N)
    m.atkC = newN; m.defC = 0; m.hpC = 0;
    return;
  }
  const scale = (v) => {
    if (!v) return 0;
    const sign = v > 0 ? 1 : -1;
    return newN === 0 ? 0 : sign * newN;
  };
  m.atkC = scale(m.atkC || 0);
  m.defC = scale(m.defC || 0);
  m.hpC = scale(m.hpC || 0);
}

function applyFx(p, fx, target) {
  const e = opponent(p);
  if (!fx) return;
  if (fx.type === "dmg") {
    dealToTarget(p, target, fx.value);
    if (target && target.kind === "minion") {
      if (fx.skipAttack) target.minion.skipAttack = true;
      if (fx.coin) {
        adjustSharedCoinN(target.minion, fx.coin);
      }
    }
  } else if (fx.type === "heal_hero") {
    p.hp = Math.min(p.maxHp, p.hp + fx.value);
  } else if (fx.type === "soul_next") {
    p.soulNext = (p.soulNext || 0) + (fx.value || 0);
  } else if (fx.type === "draw") {
    draw(p, fx.value);
  } else if (fx.type === "draw_ex") {
    if (fx.payHp) dealHero(p, fx.payHp);
    if (fx.healHero) p.hp = Math.min(p.maxHp, p.hp + fx.healHero);
    if (fx.soulNext) p.soulNext = (p.soulNext || 0) + fx.soulNext;
    if (fx.ownAllHp) [...p.board].forEach(m => damageMinion(p, m, fx.ownAllHp, { fromSpell: true }));
    if (fx.enemyDef) [...e.board].forEach(m => { m.def = Math.max(0, (m.def || 0) + fx.enemyDef); });
    if (fx.enemyDmg && target && target.kind === "minion") damageMinion(target.owner, target.minion, fx.enemyDmg, { fromSpell: true });
    if (fx.noPlayMinion) p.noPlayMinion = true;
    if ((fx.sacOwn || fx.bounceOwn) && target && target.kind === "minion" && target.owner === p) {
      const m = target.minion;
      if (fx.bounceOwn) {
        p.board = p.board.filter(x => x !== m);
        p.hand.push(m);
      } else {
        destroyMinion(p, m, { fromSpell: true });
      }
    }
    let n = fx.draw || 0;
    if (fx.drawBoard) n = p.board.length;
    if (n > 0) draw(p, n);
  } else if (fx.type === "aoe_pack") {
    const hit = (pl, m, dmg) => {
      if (dmg) damageMinion(pl, m, dmg, { fromSpell: true });
      if (fx.coin) {
        adjustSharedCoinN(m, fx.coin);
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
      if (odmg) [...p.board].forEach(m => damageMinion(p, m, odmg, { fromSpell: true }));
      if (fx.ownHp) [...p.board].forEach(m => { m.hp += fx.ownHp; m.maxHp = (m.maxHp || m.hp) + fx.ownHp; });
    }
  } else if (fx.type === "aoe_enemy") {
    [...e.board].forEach(m => damageMinion(e, m, fx.value, { fromSpell: true }));
  } else if (fx.type === "aoe_all_enemy") {
    dealHero(e, fx.value);
    [...e.board].forEach(m => damageMinion(e, m, fx.value, { fromSpell: true }));
  } else if (fx.type === "kill") {
    if (target && target.kind === "minion") destroyMinion(target.owner, target.minion, { fromSpell: true });
  } else if (fx.type === "kill_if") {
    if (target && target.kind === "minion") destroyMinion(target.owner, target.minion, { fromSpell: true });
  } else if (fx.type === "set_one") {
    if (target && target.kind === "minion") {
      if (isImmune(target.minion)) { log(`${target.minion.name} 면역 · 스펠 효과 무시`); }
      else {
        const m = target.minion;
        if (fx.atk != null) m.atk = fx.atk;
        if (fx.def != null) m.def = fx.def;
        if (fx.hp != null) { m.hp = fx.hp; m.maxHp = fx.hp; }
        if (fx.coinZero) { m.atkC = 0; m.defC = 0; m.hpC = 0; if (typeof log === "function") log(`${m.name}의 코인이 사라졌다`); }
      }
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
      c.canAttack = true;
      c.attacksLeft = 1;
      const idx = p.board.indexOf(o);
      p.board.splice(idx >= 0 ? idx + 1 : p.board.length, 0, c);
    }
  } else if (fx.type === "buff") {
    if (target && target.kind === "minion") {
      if (isImmune(target.minion)) { log(`${target.minion.name} 면역 · 스펠 효과 무시`); }
      else {
        const m = target.minion;
        if (fx.atk) m.atk += fx.atk;
        if (fx.def) m.def = (m.def || 0) + fx.def;
        if (fx.hp) { m.hp += fx.hp; m.maxHp = (m.maxHp || m.hp) + fx.hp; }
        if (fx.kws && fx.kws.length) {
          m.keywords = Array.from(new Set([...(m.keywords || []), ...fx.kws]));
        }
        if (fx.ability) m.ability = fx.ability;
      }
    }
  } else if (fx.type === "wipe_all") {
    [...p.board].forEach(m => destroyMinion(p, m, { fromSpell: true }));
    [...e.board].forEach(m => destroyMinion(e, m, { fromSpell: true }));
    if (fx.maxSoul) p.maxSoul = Math.max(0, (p.maxSoul || 0) + fx.maxSoul);
  } else if (fx.type === "coin_luck") {
    p.coinP = fx.value;
  } else if (fx.type === "own_black_buff") {
    if (target && target.kind === "minion") {
      const m = target.minion;
      if (isImmune(m)) { log(`${m.name} 면역 · 스펠 효과 무시`); }
      else {
        if ((m.atkC || 0) || (m.defC || 0) || (m.hpC || 0)) {
          m.coinGold = false;
          m.coinBlack = true;
        }
        if (fx.atk) m.atk += fx.atk;
        if (fx.def) m.def = (m.def || 0) + fx.def;
        if (fx.hp) { m.hp += fx.hp; m.maxHp = (m.maxHp || m.hp) + fx.hp; }
        if (typeof log === "function") log(`불길한예감: ${m.name} 코인 블랙, 공방체+${fx.atk || 0}`);
      }
    }
  } else if (fx.type === "buff_all") {
    p.board.forEach(m => {
      if (fx.atk) m.atk += fx.atk;
      if (fx.def) m.def = (m.def || 0) + fx.def;
      if (fx.hp) { m.hp += fx.hp; m.maxHp = (m.maxHp || m.hp) + fx.hp; }
    });
  } else if (fx.type === "grant_extra") {
    if (target && target.kind === "minion") {
      if (isImmune(target.minion)) { log(`${target.minion.name} 면역 · 스펠 효과 무시`); }
      else {
        const m = target.minion;
        if (fx.atk) m.atk += fx.atk;
        if (fx.hp) { m.hp += fx.hp; m.maxHp = (m.maxHp || m.hp) + fx.hp; }
        m.atkSkill = 4; // 연속 부여
        m.canAttack = true;
        m.attacksLeft = (m.attacksLeft || 0) + 1;
      }
    }
  } else if (fx.type === "set_enemy") {
    e.board.forEach(m => {
      if (isImmune(m)) return;
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
    if (target && target.kind === "minion") {
      if (isImmune(target.minion)) log(`${target.minion.name} 면역 · 스펠 효과 무시`);
      else target.minion.def = (target.minion.def || 0) * 2;
    }
  } else if (fx.type === "soul") {
    p.soul += fx.value;
  } else if (fx.type === "face") {
    dealHero(e, fx.value);
  } else if (fx.type === "float_def") {
    const n = Math.max(0, 5 - p.board.length) + Math.max(0, 5 - e.board.length);
    [...p.board, ...e.board].forEach(m => { if (!isImmune(m)) m.def = Math.max(0, (m.def || 0) - n); });
  } else if (fx.type === "seal_giant") {
    e.board.forEach(m => {
      if (isImmune(m)) return;
      if ((m.hp || 0) >= 6) { m.atk = 0; m.atkC = 0; }
    });
  } else if (fx.type === "summon_islands") {
    const slots = Math.max(0, 5 - p.board.length);
    for (let i = 0; i < slots; i++) {
      const tok = cloneCard("e40");
      // e40 공격불가: 턴 종료 전투에서 공격하지 않음
      tok.canAttack = false; tok.attacksLeft = 0;
      p.board.push(tok);
    }
  } else if (fx.type === "magnet") {
    e.board.forEach(m => {
      if (isImmune(m)) return;
      if (m.atkC || m.defC || m.hpC) { m.atk = 0; m.def = 0; }
    });
  } else if (fx.type === "earthquake") {
    const n = Math.floor((p.maxSoul || 0) / 2);
    [...e.board].forEach(m => damageMinion(e, m, n, { fromSpell: true }));
  } else if (fx.type === "sandtrap") {
    const n = Math.max(0, 5 - p.board.length);
    e.board.slice(0, n).forEach(m => damageMinion(e, m, 3, { fromSpell: true }));
  } else if (fx.type === "maze") {
    [...e.board].forEach(m => { if ((m.cost || 0) > (p.maxSoul || 0)) m.dying = true; });
    e.board.filter(m => m.dying).forEach(m => destroyMinion(e, m, { fromSpell: true }));
  } else if (fx.type === "tunnel") {
    p.board.forEach(m => {
      if ((m.cost || 0) <= 2) { m.atk = Math.max(0, m.atk - 2); m.def = (m.def || 0) + 3; }
    });
  } else if (fx.type === "tornado") {
    [...p.board, ...e.board].forEach(m => { if ((m.cost || 0) <= 2) m.dying = true; });
    [p, e].forEach(pl => pl.board.filter(m => m.dying).forEach(m => destroyMinion(pl, m, { fromSpell: true })));
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
      damageMinion(e, m, n, { fromSpell: true });
    });
  } else if (fx.type === "plague") {
    const minC = fx.minCost != null ? fx.minCost : 0;
    [...p.board, ...e.board].forEach(m => {
      if ((m.cost || 0) < minC) return;
      if (isImmune(m)) return;
      if (fx.atk != null) m.atk = fx.atk;
      else m.atk = 1;
      if (fx.hp != null) { m.hp = fx.hp; m.maxHp = fx.hp; }
      else { m.hp = 1; m.maxHp = 1; }
    });
  } else if (fx.type === "petrify") {
    e.board.forEach(m => {
      if (isImmune(m)) return;
      if ((m.atk || 0) <= 3) { m.atk = 0; m.def = (m.def || 0) + 1; }
    });
  }
  cleanupBoards();
}

function dealToTarget(srcOwner, target, n, ctx) {
  ctx = ctx || { fromSpell: true };
  if (!target) {
    dealHero(opponent(srcOwner), n);
    return;
  }
  if (target.kind === "hero") dealHero(target.owner, n);
  else damageMinion(target.owner, target.minion, n, ctx);
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

function damageMinion(owner, m, n, ctx) {
  if (!m || m.dying) return;
  ctx = ctx || {};
  n = Math.max(0, Number(n) || 0);
  if (ctx.fromSpell && isImmune(m)) {
    log(`${m.name} 면역 · 스펠 효과 무시`);
    return;
  }
  // 보호: only real HP≥1 hits consume; 0-dmg & black-coin HP loss do not
  const hasShield = abilityOf(m) === "보호" || (m.keywords || []).includes("shield");
  if (n > 0 && hasShield) {
    if (abilityOf(m) === "보호") m.ability = null;
    m.keywords = (m.keywords || []).filter(k => k !== "shield");
    // Drop 「보호」 from on-card text so the face matches live shield state.
    if (m.text) {
      m.text = String(m.text)
        .replace(/\s*·\s*보호/g, "")
        .replace(/보호\s*·\s*/g, "")
        .replace(/^보호$/g, "")
        .trim();
      if (!m.text) m.text = "";
    }
    log(`${m.name}의 보호막이 깨졌다`);
    m._hurt = { from: m.hp, to: m.hp, dmg: 0, shielded: true };
    return;
  }
  if (!n) return;
  const from = m.hp;
  m.hp -= n;
  m.damaged = true;
  m._hurt = { from, to: m.hp, dmg: n };
  if (m.hp <= 0) {
    m.dying = true;
    m._deathCtx = Object.assign({}, m._deathCtx || {}, ctx);
  }
}

/**
 * Resolve one lethal death. Order (locked):
 * 1) death abilities (유언/복수) fire
 * 2) 환생 → revive at 1 HP (환생 consumed); death triggers again on 2nd death
 * 3) else remove; 강탈 steals the killer unit (not random)
 */
function resolveDeath(owner, m) {
  if (!m || !owner || !owner.board.some(x => x.uid === m.uid)) return;
  if (typeof unequipItem === "function") unequipItem(m);
  const ctx = m._deathCtx || {};
  const ab = abilityOf(m);
  const fromSpell = !!ctx.fromSpell;
  const hasRebirth = (ab && String(ab).includes("환생")) || (m.keywords || []).includes("rebirth");

  if (ab === "유언") {
    log(`${m.name} 유언 → 드로우1`);
    draw(owner, 1);
  } else if (ab === "복수") {
    if (fromSpell) {
      log(`${m.name} 복수 · 스펠 사망이라 미발동`);
    } else if (ctx.killer && ctx.killerOwner && ctx.killer.hp > 0 && !ctx.killer.dying) {
      log(`${m.name} 복수 → ${ctx.killer.name} 사망`);
      ctx.killer.hp = 0;
      ctx.killer.dying = true;
      ctx.killer._deathCtx = Object.assign({}, ctx.killer._deathCtx || {}, {
        killer: m, killerOwner: owner, fromSpell: false, fromRevenge: true
      });
    } else {
      log(`${m.name} 복수 · 죽인 유닛 없음`);
    }
  }

  if (hasRebirth) {
    m.keywords = (m.keywords || []).filter(k => k !== "rebirth");
    if (m.ability) m.ability = String(m.ability).replace(/,?환생/g, "").replace(/^,/, "").replace(/,$/, "");
    if (m.ability === "") m.ability = null;
    m.hp = 1;
    m.dying = false;
    m.damaged = true;
    m._deathCtx = null;
    log(`${m.name}이(가) 환생했다 (체력 1)`);
    return;
  }

  const deadSlot = owner.board.findIndex(x => x.uid === m.uid);
  owner.board = owner.board.filter(x => x.uid !== m.uid);
  log(`${m.name} 사망`);
  if (m.deathrattle) applyFx(owner, m.deathrattle, null);

  if (ab === "강탈") {
    const killer = ctx.killer;
    const killerOwner = ctx.killerOwner;
    if (fromSpell || !killer || !killerOwner) {
      log(`${m.name} 강탈 · 훔칠 적 유닛 없음`);
    } else if (!killerOwner.board.some(x => x.uid === killer.uid) || killer.hp <= 0 || killer.dying) {
      log(`${m.name} 강탈 · 죽인 유닛이 이미 없음`);
    } else if (owner.board.length >= 5) {
      log(`${m.name} 강탈 · 전장 가득 참`);
    } else {
      killerOwner.board = killerOwner.board.filter(x => x.uid !== killer.uid);
      const at = (deadSlot >= 0 && deadSlot <= owner.board.length) ? deadSlot : owner.board.length;
      owner.board.splice(at, 0, killer);
      log(`${m.name} 강탈 → ${killer.name}을(를) 내 전장으로`);
    }
  }
}

function destroyMinion(owner, m, opts) {
  if (!m || !owner) return;
  if (!owner.board.some(x => x.uid === m.uid)) return;
  opts = opts || {};
  // Spell/effect destroy vs immune
  if (opts.fromSpell === true || (opts.fromSpell !== false && !m._deathCtx)) {
    if (isImmune(m)) {
      log(`${m.name} 면역 · 스펠 파괴 무시`);
      return;
    }
  }
  m.hp = Math.min(m.hp, 0);
  m.dying = true;
  if (opts.fromSpell === false) {
    // keep existing _deathCtx from damageMinion
  } else if (opts.fromSpell === true || !m._deathCtx) {
    m._deathCtx = Object.assign({}, m._deathCtx || {}, { fromSpell: true });
  }
  resolveDeath(owner, m);
}

function cleanupBoards() {
  for (let guard = 0; guard < 32; guard++) {
    let progressed = false;
    for (const p of [state.p1, state.p2]) {
      const dead = p.board.filter(m => m.hp <= 0 || m.dying);
      for (const m of dead) {
        if (!p.board.some(x => x.uid === m.uid)) continue;
        if (m.hp > 0 && !m.dying) continue;
        resolveDeath(p, m);
        progressed = true;
      }
      p.board = p.board.filter(m => m.hp > 0 && !m.dying);
    }
    if (!progressed) break;
  }
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
function coinSign(v) {
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}
/** Shared-coin pool size N = max(|atkC|,|defC|,|hpC|). */
function coinPoolN(m) {
  if (!m) return 0;
  return Math.max(Math.abs(m.atkC || 0), Math.abs(m.defC || 0), Math.abs(m.hpC || 0));
}
/**
 * Flip N coins once. Heads H applies ±H to every linked stat (sign of atkC/defC/hpC).
 * Respects turn luck (coinP) and coinGold (forced heads).
 */
function rollSharedCoins(m) {
  const n = coinPoolN(m);
  let luck = (state.acting && state.acting.coinP != null) ? state.acting.coinP : 0.5;
  if (m && m.coinLuckBonus) luck = Math.min(1, luck + m.coinLuckBonus);
  if (m && m.coinGold) luck = 1;
  if (m && m.coinBlack) luck = 0;
  const flips = Array.from({ length: n }, () => Math.random() < luck);
  const heads = flips.filter(Boolean).length;
  return {
    flips,
    heads,
    n,
    dAtk: coinSign(m && m.atkC) * heads,
    dDef: coinSign(m && m.defC) * heads,
    dHp: coinSign(m && m.hpC) * heads
  };
}
function clampAtk(v) { return Math.max(0, v | 0); }
function clampDef(v) { return Math.max(0, Math.min(5, v | 0)); }
/** After coin: HP floor 1 (coin alone cannot kill). */
function clampHp(v) { return Math.max(1, v | 0); }
/**
 * Fantasy Masters–style HP coin for one attack exchange.
 * Apply dHp temporarily; after the exchange call settleCombatHpCoin.
 * Gold (+): bonus evaporates; only net damage (minus heals during fight) sticks vs pre-HP.
 * Black (−): keep resulting HP (cut + damage stick).
 */
function beginCombatHpCoin(unit, dHp) {
  if (!unit || !dHp) return null;
  const pre = Number(unit.hp) || 0;
  const start = clampHp(pre + dHp);
  unit.hp = start;
  return { unit, pre, dHp, start };
}
function settleCombatHpCoin(snap) {
  if (!snap || !snap.unit) return;
  const u = snap.unit;
  if (!(u.hp > 0) || u.dying) return;
  if (snap.dHp > 0) {
    const lost = Math.max(0, snap.start - (Number(u.hp) || 0));
    u.hp = clampHp(snap.pre - lost);
  }
  // dHp < 0: leave u.hp as-is (already includes black cut + damage/heal)
}
/** Legacy single-mod roll (non-combat). */
function rollCoins(mod, unit) {
  const n = Math.abs(mod || 0);
  let luck = (state.acting && state.acting.coinP != null) ? state.acting.coinP : 0.5;
  if (unit && unit.coinLuckBonus) luck = Math.min(1, luck + unit.coinLuckBonus);
  if (unit && unit.coinGold) luck = 1;
  if (unit && unit.coinBlack) luck = 0;
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
    const detail = r.detail || (() => {
      const sign = r.delta >= 0 ? "+" + r.delta : String(r.delta);
      return `${r.base} → <b>${r.value}</b> (${sign})`;
    })();
    return `<div>${r.label} ${r.modLabel || ""}</div><div class="coins">${coins}</div><div>${detail}</div>`;
  }).join("<hr style='border-color:#4a3a20'>");
  box.innerHTML += `<button class="menu-btn" id="coinOk" style="margin-top:14px;min-width:120px">OK</button>`;
  layer.classList.add("show");
  if (flipsN && window.Sfx && Sfx.playCoin) {
    for (let i = 0; i < flipsN; i++) setTimeout(() => Sfx.playCoin(), 80 + i * 280);
  }
  try {
    if (flipsN && typeof SpellFx !== "undefined" && SpellFx.playCoin) {
      const all = [];
      rows.forEach(r => { (r.flips || []).forEach(h => all.push(!!h)); });
      const heads = all.filter(Boolean).length;
      const tails = all.length - heads;
      SpellFx.playCoin("coin_toss").then(async () => {
        try {
          await SpellFx.playCoin(heads >= tails ? "coin_land_gold" : "coin_land_black");
          if (heads > tails) SpellFx.playCoin("coin_burst_good");
          else if (tails > heads) SpellFx.playCoin("coin_burst_bad");
        } catch (e) {}
      }).catch(() => {});
    }
  } catch (e) {}
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
/** HS-style keyword tips for board/hand peek (unit + equipped item abilities). */
function collectAbilityTips(c) {
  const tips = [];
  const seen = new Set();
  const add = (title, desc) => {
    const t = String(title || "").trim();
    if (!t || t === "일반공격" || seen.has(t)) return;
    seen.add(t);
    tips.push({ title: t, desc: String(desc || "") });
  };
  if (!c) return tips;
  if (c.atkSkill != null && typeof ATK_SKILL_HELP !== "undefined" && ATK_SKILL_HELP[c.atkSkill]) {
    const [nm, desc] = ATK_SKILL_HELP[c.atkSkill];
    add(nm, desc);
  }
  String(c.ability || "").split(",").map(s => s.trim()).filter(Boolean).forEach(ab => {
    add(ab, (typeof ABI_HELP !== "undefined" && ABI_HELP[ab]) || "");
  });
  const blob = [c.text, c._baseText].filter(Boolean).join(" · ");
  if (typeof ATK_SKILL_HELP !== "undefined") {
    Object.values(ATK_SKILL_HELP).forEach(([nm, desc]) => { if (blob.includes(nm)) add(nm, desc); });
  }
  if (typeof ABI_HELP !== "undefined") {
    Object.keys(ABI_HELP).forEach(ab => { if (blob.includes(ab)) add(ab, ABI_HELP[ab]); });
  }
  if (c.equippedItem && typeof CARD_MAP !== "undefined") {
    const it = CARD_MAP[c.equippedItem.id];
    if (it) {
      if (it.atkSkill != null && ATK_SKILL_HELP && ATK_SKILL_HELP[it.atkSkill]) {
        const [nm, desc] = ATK_SKILL_HELP[it.atkSkill];
        add(nm, desc);
      }
      String(it.ability || "").split(",").map(s => s.trim()).filter(Boolean).forEach(ab => {
        add(ab, (ABI_HELP && ABI_HELP[ab]) || "");
      });
      const itx = String(it.text || "").trim();
      if (itx) {
        const stripped = itx.replace(/\s*부여\s*$/, "").trim();
        const covered = (ATK_SKILL_HELP && Object.values(ATK_SKILL_HELP).some(([nm]) => stripped.includes(nm)))
          || (ABI_HELP && Object.keys(ABI_HELP).some(ab => stripped.includes(ab)));
        if (!covered && stripped) add(it.name || "아이템", stripped);
      }
    }
  }
  return tips;
}
function showPeek(el, card) {
  if (_drag || !el) return;
  // Never showcase during AI turn / busy — leftover center card after endTurn
  try {
    if (state && (state.busy || state.over)) return;
    if (typeof current === "function" && current() && current().isAI) return;
  } catch (e) {}
  const img = el.querySelector("img.card-face, img");
  if (!img || !img.src) return;
  hidePeek();
  let c = card || null;
  if (!c) {
    const uid = el.getAttribute("data-uid")
      || (el.closest && el.closest("[data-uid]") && el.closest("[data-uid]").getAttribute("data-uid"));
    if (uid && typeof state !== "undefined" && state) {
      const boards = [].concat((state.p1 && state.p1.board) || [], (state.p2 && state.p2.board) || []);
      const hit = boards.find(m => m && m.uid === uid);
      if (hit) c = hit;
    }
  }
  const tips = collectAbilityTips(c);
  const peek = document.createElement("div");
  peek.id = "cardPeek";
  const tipsHtml = tips.length
    ? `<div class="peek-tips">${tips.map(t => `<div class="peek-tip"><b>${t.title}</b><span>${t.desc}</span></div>`).join("")}</div>`
    : "";
  peek.innerHTML = `<img class="peek-face" src="${img.src}" alt="">` + tipsHtml;
  document.body.appendChild(peek);
  const w = Math.min(300, window.innerHeight * 0.42);
  const hasTips = tips.length > 0;
  peek.style.cssText = hasTips
    ? "position:fixed;left:36%;top:46%;transform:translate(-50%,-50%);z-index:200;pointer-events:none;margin:0;display:flex;flex-direction:row;align-items:center;gap:14px;width:auto;max-width:min(96vw,920px);"
    : "position:fixed;left:50%;top:46%;transform:translate(-50%,-50%);z-index:200;pointer-events:none;margin:0;";
  const face = peek.querySelector(".peek-face");
  if (face) face.style.cssText = "width:"+w+"px;height:auto;display:block;border-radius:16px;flex-shrink:0;";
}

function placeDropGlow(on, x, y) {
  // Full-board yellow chrome (#dropGlow) stretches off the parchment — never show it.
  const glow = document.getElementById("dropGlow");
  if (glow) { glow.classList.remove("on"); glow.style.cssText = "display:none!important"; }
  setDropGlow(!!on);
}

let _drag = null;

/** Remember last good pointer coords — pointercancel often reports 0,0. */
function trackDragXY(e) {
  if (!_drag || !e) return;
  const x = e.clientX, y = e.clientY;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  if (x === 0 && y === 0 && e.type === "pointercancel") return;
  _drag.lastX = x;
  _drag.lastY = y;
}
function dragPointerXY(e) {
  let x = e && e.clientX;
  let y = e && e.clientY;
  const invalid = !Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0);
  if (invalid && _drag) {
    if (_drag.lastX != null && _drag.lastY != null) return { x: _drag.lastX, y: _drag.lastY };
    if (_drag.x0 != null && _drag.y0 != null) return { x: _drag.x0, y: _drag.y0 };
  }
  return { x: x || 0, y: y || 0 };
}

function unitFromPoint(x, y) {
  // Ally board only (item equip)
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
function spellTargetFromPoint(x, y, allowed) {
  if (!allowed || !allowed.length) return null;
  const allowMinion = new Map();
  const allowHero = [];
  allowed.forEach(t => {
    if (t.kind === "minion" && t.minion) allowMinion.set(t.minion.uid, t);
    if (t.kind === "hero") allowHero.push(t);
  });
  const els = [...document.querySelectorAll("#myBoard .minion, #oppBoard .minion")];
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
      const uid = el.getAttribute("data-uid");
      if (allowMinion.has(uid)) return allowMinion.get(uid);
    }
  }
  let best = null, bestD = 1e9;
  els.forEach(el => {
    const uid = el.getAttribute("data-uid");
    if (!allowMinion.has(uid)) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const d = Math.hypot(x - cx, y - cy);
    if (d < bestD && d < Math.max(r.width, r.height) * 0.85) {
      bestD = d; best = allowMinion.get(uid);
    }
  });
  if (best) return best;
  for (const t of allowHero) {
    const side = (t.owner === meView().me) ? "me" : "opp";
    const el = document.querySelector('.hero-slot[data-hero="' + (side === "me" ? "me" : "opp") + '"], .hero-portrait.' + (side === "me" ? "mine" : "opp"));
    // try hero rows
    const row = document.getElementById(side === "me" ? "myHeroRow" : "oppHeroRow");
    const hitEl = row || el;
    if (!hitEl) continue;
    const r = hitEl.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return t;
  }
  return null;
}
let _equipHoverUid = null;
function clearEquipHover() {
  document.querySelectorAll(".minion.equip-glow, .minion.spell-glow, .hero-slot.spell-glow, .hero-portrait.spell-glow").forEach(el => {
    el.classList.remove("equip-glow");
    el.classList.remove("spell-glow");
  });
  _equipHoverUid = null;
}
function highlightEquipHover(x, y, allowed) {
  // Clear glow classes only — keep _equipHoverUid so we do not re-fire item_hover every move
  document.querySelectorAll(".minion.equip-glow, .minion.spell-glow, .hero-slot.spell-glow, .hero-portrait.spell-glow").forEach(el => {
    el.classList.remove("equip-glow");
    el.classList.remove("spell-glow");
  });
  if (!allowed) { _equipHoverUid = null; return; }
  const hit = unitFromPoint(x, y);
  if (!hit) { _equipHoverUid = null; return; }
  const el = document.querySelector('.minion[data-uid="' + hit.minion.uid + '"]');
  if (el) el.classList.add("equip-glow");
  if (hit.minion.uid !== _equipHoverUid) {
    _equipHoverUid = hit.minion.uid;
    try { if (typeof SpellFx !== "undefined" && SpellFx.playItem) SpellFx.playItem("item_hover"); } catch (e) {}
  }
}
function highlightSpellHover(x, y, targets) {
  clearEquipHover();
  const hit = spellTargetFromPoint(x, y, targets);
  if (!hit) return;
  if (hit.kind === "minion" && hit.minion) {
    const el = document.querySelector('.minion[data-uid="' + hit.minion.uid + '"]');
    if (el) el.classList.add("spell-glow");
  } else if (hit.kind === "hero") {
    const side = (hit.owner === meView().me) ? "me" : "opp";
    document.querySelectorAll('.hero-slot[data-hero="' + side + '"], .hero-portrait.' + (side === "me" ? "mine" : "opp")).forEach(el => el.classList.add("spell-glow"));
  }
}
function overPlayfield(x, y) {
  // Any battlefield drop (own or enemy lane) for untargeted spells
  if (overBoard(x, y)) return true;
  const opp = document.getElementById("oppBoard");
  if (!opp) return false;
  const r = opp.getBoundingClientRect();
  const touch = !!(typeof _drag !== "undefined" && _drag && (_drag.pointerType === "touch" || _drag.pointerType === "pen"));
  const padX = Math.max(touch ? 28 : 12, r.width * (touch ? 0.08 : 0.04));
  const padY = Math.max(touch ? 48 : 16, r.height * (touch ? 0.22 : 0.08));
  return x >= r.left - padX && x <= r.right + padX && y >= r.top - padY && y <= r.bottom + padY;
}
function spellDragTargets(card) {
  if (!card || card.type !== "spell" || !needsTarget(card)) return null;
  const me = meView().me;
  return validTargets(me, card.spell);
}

function canDropCard(card) {
  if (!state || !card) return false;
  if (state.busy) return false;
  const me = meView().me;
  if (state.over || current() !== me || me.isAI) return false;
  if (me.soul < card.cost) return false;
  if (card.type === "minion" && me.board.length >= 5) return false;
  if (card.type === "item" && isEquipItem(card) && !me.board.length) return false;
  return true;
}
function overBoard(x, y) {
  const mine = document.getElementById("myBoard");
  const opp = document.getElementById("oppBoard");
  if (!mine) return false;
  const r = mine.getBoundingClientRect();
  // Pad hit box — scaled stages + hand fan made exact rect drops flaky;
  // touch gets a larger pad (fat-finger / tablet aiming).
  const touch = !!(typeof _drag !== "undefined" && _drag && (_drag.pointerType === "touch" || _drag.pointerType === "pen"));
  const padX = Math.max(touch ? 28 : 12, r.width * (touch ? 0.08 : 0.04));
  const padY = Math.max(touch ? 48 : 16, r.height * (touch ? 0.22 : 0.08));
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
  const game = document.getElementById("game");
  if (game) game.classList.toggle("drop-ready", !!on);
  const mine = document.getElementById("myBoard");
  if (mine) mine.classList.toggle("drop-glow", !!on);
  // Never mark opp board — prevents vertical jump / shared chrome stretch
  const opp = document.getElementById("oppBoard");
  if (opp) opp.classList.remove("drop-glow");
}
/** Insert index among own board minions from pointer X (Hearthstone-style). */
function insertIndexFromPoint(x, y, excludeUid) {
  const board = document.getElementById("myBoard");
  if (!board) return 0;
  const mins = [...board.querySelectorAll(".slot.filled .minion")].filter(el => {
    if (excludeUid && el.getAttribute("data-uid") === excludeUid) return false;
    if (el.closest(".slot") && el.closest(".slot").classList.contains("board-drag-source")) return false;
    return true;
  });
  if (!mins.length) return 0;
  for (let i = 0; i < mins.length; i++) {
    const r = mins[i].getBoundingClientRect();
    if (x < r.left + r.width / 2) return i;
  }
  return mins.length;
}
/** @deprecated alias — keep call sites working */
function slotIndexFromPoint(x, y) {
  return insertIndexFromPoint(x, y, null);
}

function clearInsertPreview() {
  const board = document.getElementById("myBoard");
  if (!board) return;
  board.classList.remove("is-inserting");
  board.querySelectorAll(".slot").forEach(sl => {
    sl.classList.remove("shift-right", "shift-left", "board-drag-source", "insert-gap-after");
    sl.style.removeProperty("transform");
    sl.style.removeProperty("margin-left");
    sl.style.removeProperty("margin-right");
  });
  board.querySelectorAll(".board-insert-spacer").forEach(el => el.remove());
}

function updateInsertPreview(insertIdx, excludeUid) {
  const board = document.getElementById("myBoard");
  if (!board) return;
  clearInsertPreview();
  if (insertIdx == null || insertIdx < 0) return;
  board.classList.add("is-inserting");
  const filled = [...board.querySelectorAll(".slot.filled")];
  const slotW = parseFloat(getComputedStyle(board).getPropertyValue("--slot-w")) || 112;
  const gap = parseFloat(getComputedStyle(board).gap) || 10;
  const shift = Math.round(slotW * 0.5 + gap * 0.5);
  let logical = 0;
  filled.forEach(sl => {
    const minion = sl.querySelector(".minion");
    const uid = minion && minion.getAttribute("data-uid");
    if (excludeUid && uid === excludeUid) {
      sl.classList.add("board-drag-source");
      return;
    }
    if (logical >= insertIdx) {
      sl.classList.add("shift-right");
      sl.style.setProperty("transform", "translateX(" + shift + "px)", "important");
    }
    logical++;
  });
}

function reorderOwnBoard(fromUid, toIdx) {
  const me = meView().me;
  if (!me || !me.board) return false;
  const fromIdx = me.board.findIndex(m => m.uid === fromUid);
  if (fromIdx < 0) return false;
  // toIdx = insert index among remaining units after removal (0..n-1)
  const [m] = me.board.splice(fromIdx, 1);
  const dest = Math.max(0, Math.min(me.board.length, toIdx));
  me.board.splice(dest, 0, m);
  return fromIdx !== dest;
}
function bindHandCard(el, card) {
  el.onpointerenter = () => showPeek(el, card);
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
    document.body.classList.add("dragging-card");
    _drag = {
      kind: "hand", card, el, ghost, pid: ev.pointerId,
      x0: ev.clientX, y0: ev.clientY, lastX: ev.clientX, lastY: ev.clientY,
      pointerType: ev.pointerType || "mouse"
    };
    const move = (e) => {
      if (!_drag) return;
      if (e.cancelable) try { e.preventDefault(); } catch (err) {}
      trackDragXY(e);
      const { x, y } = dragPointerXY(e);
      _drag.ghost.style.left = x + "px";
      _drag.ghost.style.top = y + "px";
      const cardRef = _drag.card;
      if (cardRef && cardRef.type === "item" && isEquipItem(cardRef)) {
        placeDropGlow(false);
        highlightEquipHover(x, y, canDropCard(cardRef));
      } else if (cardRef && cardRef.type === "spell" && needsTarget(cardRef)) {
        placeDropGlow(false);
        const targets = spellDragTargets(cardRef) || [];
        highlightSpellHover(x, y, targets);
      } else if (cardRef && cardRef.type === "spell") {
        clearEquipHover();
        placeDropGlow(overPlayfield(x, y) && canDropCard(cardRef), x, y);
      } else {
        clearEquipHover();
        const on = overBoard(x, y) && canDropCard(cardRef);
        placeDropGlow(on, x, y);
        if (on && cardRef && cardRef.type === "minion") {
          const idx = insertIndexFromPoint(x, y, null);
          window._dropSlot = idx;
          updateInsertPreview(idx, null);
        } else {
          window._dropSlot = null;
          clearInsertPreview();
        }
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
      trackDragXY(e);
      const { x, y } = dragPointerXY(e);
      const cardRef = _drag.card;
      let ok = false;
      if (cardRef && cardRef.type === "item" && isEquipItem(cardRef)) {
        const hit = unitFromPoint(x, y);
        clearEquipHover();
        clearDrag();
        if (hit && canDropCard(cardRef)) {
          try { Sfx.playCardDrop && Sfx.playCardDrop(); } catch (err) {}
          playCard(meView().me, cardRef, hit);
          render();
        }
        return;
      }
      if (cardRef && cardRef.type === "spell" && needsTarget(cardRef)) {
        const targets = spellDragTargets(cardRef) || [];
        const hit = spellTargetFromPoint(x, y, targets);
        clearEquipHover();
        clearDrag();
        if (hit && canDropCard(cardRef)) {
          try { Sfx.playCardDrop && Sfx.playCardDrop(); } catch (err) {}
          playCard(meView().me, cardRef, hit);
          render();
        } else if (!targets.length) {
          log("마땅한 대상이 없습니다");
        }
        return;
      }
      if (cardRef && cardRef.type === "spell") {
        ok = overPlayfield(x, y) && canDropCard(cardRef);
        clearEquipHover();
        clearDrag();
        if (ok) {
          try { Sfx.playCardDrop && Sfx.playCardDrop(); } catch (err) {}
          playCard(meView().me, cardRef, null);
          render();
        }
        return;
      }
      ok = overBoard(x, y) && canDropCard(cardRef);
      if (ok && cardRef && cardRef.type === "minion") {
        window._dropSlot = insertIndexFromPoint(x, y, null);
      } else {
        window._dropSlot = null;
      }
      clearInsertPreview();
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

function canReorderBoard() {
  if (!state || state.busy || state.over) return false;
  const me = meView().me;
  if (!me || me.isAI) return false;
  if (current() !== me) return false;
  return true;
}

function bindBoardMinion(el, minion) {
  if (!el || !minion) return;
  el.onpointerenter = () => { if (!_drag) showPeek(el, minion); };
  el.onpointerleave = hidePeek;
  const startDrag = (ev) => {
    hidePeek();
    if (ev.button != null && ev.button !== 0) return;
    if (!canReorderBoard()) return;
    if (_drag) return;
    if (ui.targeting || ui.attacker) return;
    ev.preventDefault();
    ev.stopPropagation();
    clearDrag();
    clearInsertPreview();
    try { if (ev.pointerId != null && el.setPointerCapture) el.setPointerCapture(ev.pointerId); } catch (err) {}
    const r = el.getBoundingClientRect();
    const ghost = el.cloneNode(true);
    ghost.classList.add("drag-ghost");
    ghost.style.cssText = "position:fixed;left:"+ev.clientX+"px;top:"+ev.clientY+"px;width:"+r.width+"px;height:"+r.height+"px;margin:0;transform:translate(-50%,-60%);z-index:200;pointer-events:none;";
    document.body.appendChild(ghost);
    el.classList.add("dragging");
    document.body.classList.add("dragging-card");
    const slot = el.closest(".slot");
    if (slot) slot.classList.add("board-drag-source");
    _drag = {
      kind: "board", minion, el, ghost, pid: ev.pointerId,
      x0: ev.clientX, y0: ev.clientY, lastX: ev.clientX, lastY: ev.clientY,
      pointerType: ev.pointerType || "mouse"
    };
    const move = (e) => {
      if (!_drag || _drag.kind !== "board") return;
      if (e.cancelable) try { e.preventDefault(); } catch (err) {}
      trackDragXY(e);
      const { x, y } = dragPointerXY(e);
      _drag.ghost.style.left = x + "px";
      _drag.ghost.style.top = y + "px";
      if (overBoard(x, y)) {
        placeDropGlow(true, x, y);
        const idx = insertIndexFromPoint(x, y, minion.uid);
        window._dropSlot = idx;
        updateInsertPreview(idx, minion.uid);
      } else {
        placeDropGlow(false);
        window._dropSlot = null;
        clearInsertPreview();
        if (slot) slot.classList.add("board-drag-source");
      }
    };
    const up = (e) => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
      window.removeEventListener("mousemove", move, true);
      window.removeEventListener("mouseup", up, true);
      try { if (ev.pointerId != null && el.releasePointerCapture) el.releasePointerCapture(ev.pointerId); } catch (err) {}
      if (!_drag || _drag.kind !== "board") return;
      trackDragXY(e);
      const { x, y } = dragPointerXY(e);
      const ok = overBoard(x, y);
      const idx = ok ? insertIndexFromPoint(x, y, minion.uid) : null;
      clearInsertPreview();
      clearDrag();
      if (ok && idx != null) {
        const changed = reorderOwnBoard(minion.uid, idx);
        if (changed) {
          try { Sfx.playCardDrop && Sfx.playCardDrop(); } catch (err) {}
        }
        render();
      } else {
        render();
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
  if (me.soul < card.cost) return;
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
  const endBtnEl = e.target.id === "endBtn" ? e.target : e.target.closest("#endBtn");
  if (endBtnEl && !endBtnEl.disabled) { Sfx.playTurn && Sfx.playTurn(); endTurn(); return; }
  if (e.target.id === "giveBtn") { confirmGiveUp(); return; }
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
  }
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") { ui.targeting = null; ui.attacker = null; render(); }
});


let draftDeck = [];


function cardMatchesSearch(c, q) {
  if (!q) return true;
  const needle = String(q).trim().toLowerCase();
  if (!needle) return true;
  const hay = [];
  if (c.name) hay.push(c.name);
  if (c.text) hay.push(c.text);
  if (c.ability) hay.push(String(c.ability));
  const race = (c.race || (typeof CARD_RACE !== "undefined" && CARD_RACE[c.id]) || "");
  if (race) hay.push(race);
  if (c.atkSkill != null && typeof ATK_SKILL_HELP !== "undefined" && ATK_SKILL_HELP[c.atkSkill]) {
    hay.push(ATK_SKILL_HELP[c.atkSkill][0]);
  }
  // also match ability keywords listed in text like "보호 부여"
  return hay.some(s => String(s).toLowerCase().includes(needle));
}

function tribeCards() {
  // Deck builder: units + spells + items
  return CARDS.filter(c => !c.token && c.tribe === selectedHero.id)
    .filter(c => {
      if (!ui.typeFilter || ui.typeFilter === "all") return true;
      return c.type === ui.typeFilter;
    })
    .filter(c => {
      if (!ui.rarityFilter || ui.rarityFilter === "all") return true;
      return (c.rarity || "common") === ui.rarityFilter;
    })
    .filter(c => cardMatchesSearch(c, ui.searchQuery || ""))
    .sort((a,b) => (a.cost||0) - (b.cost||0) || a.name.localeCompare(b.name, "ko"));
}
function copiesInDraft(id) { return draftDeck.filter(x => x === id).length; }
function maxCopies(id) {
  const c = CARD_MAP[id];
  return (c && (c.rarity === "legendary" || c.rarity === "rare")) ? 1 : 2;
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
  // Prefer current builder filters; if empty (search/rarity wipe), fall back to full tribe pool.
  let pool = tribeCards().map(c => c.id).filter(Boolean);
  if (!pool.length) {
    pool = CARDS.filter(c => !c.token && c.tribe === selectedHero.id).map(c => c.id);
  }
  if (!pool.length) return;
  let guard = 0;
  while (draftDeck.length < 30 && guard++ < 400) {
    const id = pool[Math.floor(Math.random() * pool.length)];
    if (!id || !CARD_MAP[id] || CARD_MAP[id].token) continue;
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
  return (c.text ? c.text + " — " : "") + (c.rarity === "legendary" ? "레전드 카드." : "속성의 힘을 담은 카드.");
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
const ATK_SKILL_HELP = {
  1: ["일반공격", "공격력만큼 공격합니다."],
  2: ["관통공격", "방어를 먼저 깎으며 공격합니다."],
  3: ["돌진공격", "내 방어력만큼 추가하여 공격합니다."],
  4: ["연속공격", "두 번 공격합니다."],
  5: ["치명공격", "체력을 1 이상 깎으면 적이 바로 죽습니다."],
  6: ["흡혈공격", "준 피해의 절반만큼 체력을 회복합니다."],
  7: ["약화공격", "공격 전에 적 공격·방어를 1씩 낮춥니다."],
  8: ["석화공격", "공격 전에 적 공격을 0으로 만들고 방어를 +1 합니다."],
  9: ["광역공격", "적 전체를 한 번에 공격합니다."],
  10: ["돌파공격", "적 처치 후 남은 공격력으로 다음 적을 공격합니다."],
  11: ["혼란공격", "반격을 받지 않습니다."]
};
const ABI_HELP = {
  "보호": "피해를 한 번만 막아 줍니다. (코인으로 체력이 깎일 때는 안 막힘)",
  "복수": "나를 죽인 적 유닛도 같이 죽습니다.",
  "환생": "죽으면 체력 1로 한 번 다시 살아납니다.",
  "강탈": "나를 죽인 적을 내 편으로 가져옵니다.",
  "출전": "낼 때 드로우1",
  "유언": "죽을 때 드로우1",
  "면역": "스펠 효과를 받지 않습니다.",
  "공격불가": "내 턴 종료 시 공격하지 않습니다. 전장에 남으며 피격은 받습니다."
};
function fmtCoinLinks(c) {
  const parts = [];
  const one = (label, v) => { if (!v) return; parts.push(label + (v > 0 ? "+" : "") + v); };
  one("공", c.atkC || 0); one("방", c.defC || 0); one("체", c.hpC || 0);
  return parts.length ? parts.join(" ") : "";
}
function buildLoreSkillsHtml(c) {
  const rows = [];
  if (c.atkSkill != null && ATK_SKILL_HELP[c.atkSkill]) {
    const [nm, desc] = ATK_SKILL_HELP[c.atkSkill];
    rows.push(`<div class="lore-skill"><b>${nm}</b><span>${desc}</span></div>`);
  }
  // dual text may mention second atk; also parse ability list
  const abs = String(c.ability || "").split(",").map(s => s.trim()).filter(Boolean);
  // if text lists extra atk names not in atkSkill, still show ability only here
  abs.forEach(ab => {
    const desc = ABI_HELP[ab];
    if (desc) rows.push(`<div class="lore-skill"><b>${ab}</b><span>${desc}</span></div>`);
    else if (ab) rows.push(`<div class="lore-skill"><b>${ab}</b><span></span></div>`);
  });
  // also surface second atk from text like "돌파공격 · 관통공격" when only first is in atkSkill
  const t = String(c.text || "");
  Object.values(ATK_SKILL_HELP).forEach(([nm, desc]) => {
    if (t.includes(nm) && !(c.atkSkill != null && ATK_SKILL_HELP[c.atkSkill] && ATK_SKILL_HELP[c.atkSkill][0] === nm)) {
      if (!rows.some(r => r.includes(`<b>${nm}</b>`))) {
        rows.push(`<div class="lore-skill"><b>${nm}</b><span>${desc}</span></div>`);
      }
    }
  });
  return rows.join("") || "";
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
  const raceNm = c.type === "minion" ? (c.token ? "토큰" : (c.race || (CARD_RACE && CARD_RACE[c.id]) || "")) : (c.type === "item" ? "아이템" : "스펠");
  const RARITY_KO = { common:"커먼", uncommon:"언커먼", rare:"레어", legendary:"레전드" };
  const rareKo = RARITY_KO[c.rarity || "common"] || "커먼";
  const cap = (c.rarity === "legendary" || c.rarity === "rare") ? "덱당 1장" : "최대 2장";
  const tribeNm = (TRIBES.find(t => t.id === c.tribe) || {}).name || "";
  const stats = c.type === "minion" ? (c.atk + "/" + (c.def||0) + "/" + c.hp) : (c.type === "item" ? ((c.atk||0) + "/" + (c.def||0) + "/" + (c.hp||0)) : "-");
  const coin = (c.type === "minion") ? fmtCoinLinks(c) : "";
  const top = [c.cost + "소울", tribeNm, raceNm, stats, coin ? ("코인 " + coin) : ""].filter(Boolean).join(" · ");
  const bot = [rareKo, cap].filter(Boolean).join(" · ");
  const metaEl = document.getElementById("loreMeta");
  metaEl.innerHTML = top + (bot ? "<br><br>" + bot : "");
  const skEl = document.getElementById("loreSkills");
  if (skEl) skEl.innerHTML = buildLoreSkillsHtml(c);
  document.getElementById("loreText").textContent = loreOf(id);
  document.getElementById("cardLorePop").classList.add("show");
}


function renderBuilder() {
  const _pool = tribeCards();
  const _ic = _pool.filter(c => c.type === "item").length;
  const _typeKo = { all:"전체", minion:"유닛", spell:"스펠", item:"아이템" }[ui.typeFilter || "all"] || "전체";
  document.getElementById("poolTitle").textContent = selectedHero.name + " · " + _typeKo + " (" + _pool.length + "장" + (ui.typeFilter==="all" ? " · 아이템 "+_ic : "") + ")";
  const meta = document.getElementById("deckMeta");
  meta.textContent = draftDeck.length + " / 30  ·  커먼·언커먼 2장, 레어·레전드 1장";
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
  document.querySelectorAll("#typeBar button").forEach(btn => {
    btn.classList.toggle("on", btn.dataset.t === (ui.typeFilter || "all"));
    btn.onclick = (ev) => { ev.stopPropagation(); ui.typeFilter = btn.dataset.t; renderBuilder(); };
  });
  document.querySelectorAll("#rarityBar button").forEach(btn => {
    btn.classList.toggle("on", btn.dataset.r === ui.rarityFilter);
    btn.onclick = (ev) => { ev.stopPropagation(); ui.rarityFilter = btn.dataset.r; renderBuilder(); };
  });
  const search = document.getElementById("poolSearch");
  if (search) {
    const q = ui.searchQuery || "";
    if (search.value !== q) search.value = q;
    if (!search._bound) {
      search._bound = true;
      search.addEventListener("input", () => {
        ui.searchQuery = search.value;
        renderBuilder();
      });
    }
  }
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
  updateDeckStats();
}



function updateDeckStats() {
  const curveBox = document.getElementById("soulCurve");
  const compBox = document.getElementById("deckComp");
  const avgEl = document.getElementById("soulAvg");
  if (!curveBox || !compBox || !avgEl) return;
  const n = draftDeck.length;
  const buckets = [0, 0, 0, 0, 0, 0, 0, 0]; // 1,2,3,4,5,6,7,8+
  let sumCost = 0;
  const types = { minion: 0, spell: 0, item: 0 };
  draftDeck.forEach(id => {
    const c = CARD_MAP[id];
    if (!c) return;
    const cost = Math.max(0, c.cost | 0);
    sumCost += cost;
    const idx = cost >= 8 ? 7 : Math.max(0, cost - 1);
    buckets[idx] += 1;
    if (c.type === "minion") types.minion++;
    else if (c.type === "spell") types.spell++;
    else if (c.type === "item") types.item++;
  });
  const maxB = Math.max(1, ...buckets);
  const labels = ["1", "2", "3", "4", "5", "6", "7", "8+"];
  curveBox.innerHTML = labels.map((lab, i) => {
    const cnt = buckets[i];
    const pct = n ? (cnt * 100 / n) : 0;
    const w = Math.round((cnt / maxB) * 100);
    return `<div class="deck-stat-row"><span class="lbl">${lab}</span><div class="deck-stat-bar"><i style="width:${w}%"></i></div><span class="val">${pct.toFixed(1)}% (${cnt}장)</span></div>`;
  }).join("");
  avgEl.textContent = n ? ("평균 비용: " + (sumCost / n).toFixed(1)) : "평균 비용: —";
  const maxT = Math.max(1, types.minion, types.spell, types.item);
  const comps = [["유닛", types.minion], ["스펠", types.spell], ["아이템", types.item]];
  compBox.innerHTML = comps.map(([lab, cnt]) => {
    const pct = n ? (cnt * 100 / n) : 0;
    const w = Math.round((cnt / maxT) * 100);
    return `<div class="deck-stat-row"><span class="lbl">${lab}</span><div class="deck-stat-bar comp"><i style="width:${w}%"></i></div><span class="val">${pct.toFixed(1)}% (${cnt}장)</span></div>`;
  }).join("");
}

function renderHeroPicks() {
  const box = document.getElementById("heroPicks");
  box.innerHTML = TRIBES.map(h => `
    <div class="hero-card ${h.open && selectedHero.id === h.id ? "sel" : ""} ${h.open ? "" : "lock"}" data-id="${h.id}" style="--tc:${h.color}">
      <div class="art"><img src="${(typeof TRIBE_ICONS!=="undefined" && TRIBE_ICONS[h.id]) || ""}" alt="${h.en}"></div>
      <h3 class="en">${h.en}</h3>
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
function paintBuildVer() {
  const el = document.getElementById("buildVer");
  if (el) el.textContent = "v" + GAME_VERSION;
}
paintBuildVer();
renderHeroPicks();
document.getElementById("btnAi").onclick = () => startGame(true);
document.getElementById("btnPvp").onclick = () => {
  try { document.getElementById("settingsPop").classList.remove("show"); } catch (e) {}
  startGame(false);
};
document.getElementById("btnDeck").onclick = () => { draftDeck = (loadSavedDecks()[selectedHero.id] || []).slice(); showBuilder(); };
document.getElementById("btnBackMenu").onclick = () => backTitle();
document.getElementById("btnClearDeck").onclick = () => { draftDeck = []; renderBuilder(); };
document.getElementById("btnAutoFill").onclick = () => autoFillDraft();
document.getElementById("btnSaveDeck").onclick = () => saveDraftDeck();
document.getElementById("btnPlaySaved").onclick = () => {
  if (!saveDraftDeck()) return;
  startGame(true);
};



const TRIBE_SPEC = {
  earth: "특화: 체력. 체 코인 링크.",
  fire: "특화: 공격. 기본 스탯이 높고 공 −코인이 많음.",
  water: "특화: 방어. 방 코인 링크.",
  wind: "특화: 안정. 코인 N≤2.",
  light: "특화: 코인(전부 +).",
  dark: "특화: 승부. 코인 N 3~5 맞교환."
};
const RACE_LORE = (typeof TRIBES !== "undefined" ? TRIBES : []).map(h => [
  h.name + " (" + h.en + ")",
  TRIBE_SPEC[h.id] || "오픈 속성"
]);

function openHelp() {
  const box = document.getElementById("raceHelpList");
  const lore = (typeof RACE_LORE !== "undefined" && Array.isArray(RACE_LORE)) ? RACE_LORE : [];
  if (box && !box.dataset.ready) {
    // 속성 도움말 섹션 제거됨 — raceHelpList 없으면 skip
    box.innerHTML = lore.map(r =>
      '<div class="race-item"><b>' + r[0] + '</b><p>' + r[1] + '</p></div>'
    ).join("");
    box.dataset.ready = "1";
  }
  const pop = document.getElementById("helpPop");
  if (pop) pop.classList.add("show");
}
function closeHelp() {
  document.getElementById("helpPop").classList.remove("show");
}
document.getElementById("btnHelp").onclick = openHelp;
const _btnQuit = document.getElementById("btnQuit");
if (_btnQuit) _btnQuit.onclick = () => {
  try {
    if (window.fantasyArenaDesktop && fantasyArenaDesktop.quit) { fantasyArenaDesktop.quit(); return; }
  } catch (e) {}
  try { window.close(); } catch (e) {}
  location.href = "about:blank";
};
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
