
function uid() { return Math.random().toString(36).slice(2, 9); }
function cloneCard(id) {
  const b = CARD_MAP[id];
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
    hp: 50, maxHp: 50,
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
      log(`${p.name}의 손패가 가득 차 ${CARD_MAP[id].name}이(가) 불탔다`);
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
  p.powerUsed = false;
  p.board.forEach(m => { m.canAttack = true; m.attacksLeft = 1; });
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
    const foe = e.board.find(x => x.hp > 0);
    const target = foe ? { kind: "minion", owner: e, minion: foe } : { kind: "hero", owner: e };
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

function playCard(p, card, target) {
  if (p.mana < card.cost) return false;
  if (card.type === "minion" && p.board.length >= 6) {
    log("전장이 가득 찼습니다 (최대 6장)");
    return false;
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
  const fx = card.type === "spell" ? card.spell : card.battlecry;
  if (!fx) return false;
  return ["dmg", "kill", "buff"].includes(fx.type) && fx.target;
}

function validTargets(p, fx) {
  const e = opponent(p);
  const list = [];
  if (!fx) return list;
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
  } else if (fx.type === "heal_hero") {
    p.hp = Math.min(p.maxHp, p.hp + fx.value);
  } else if (fx.type === "draw") {
    draw(p, fx.value);
  } else if (fx.type === "aoe_enemy") {
    [...e.board].forEach(m => damageMinion(e, m, fx.value));
  } else if (fx.type === "aoe_all_enemy") {
    dealHero(e, fx.value);
    [...e.board].forEach(m => damageMinion(e, m, fx.value));
  } else if (fx.type === "kill") {
    if (target && target.kind === "minion") destroyMinion(target.owner, target.minion);
  } else if (fx.type === "buff") {
    if (target && target.kind === "minion") {
      target.minion.atk += fx.atk;
      target.minion.hp += fx.hp;
      target.minion.maxHp += fx.hp;
    }
  } else if (fx.type === "mana") {
    p.mana += fx.value;
  } else if (fx.type === "face") {
    dealHero(e, fx.value);
  } else if (fx.type === "float_def") {
    const n = Math.max(0, 6 - p.board.length) + Math.max(0, 6 - e.board.length);
    [...p.board, ...e.board].forEach(m => { m.def = Math.max(0, (m.def || 0) - n); });
  } else if (fx.type === "seal_giant") {
    e.board.forEach(m => {
      if ((m.hp || 0) >= 6) { m.atk = 0; m.atkC = 0; }
    });
  } else if (fx.type === "summon_islands") {
    const slots = Math.max(0, 6 - p.board.length);
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
    const n = Math.max(0, 6 - p.board.length);
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
    [...e.board].forEach(m => {
      m.atk = Math.max(0, m.atk - 1);
      m.def = Math.max(0, (m.def || 0) - 1);
      damageMinion(e, m, 1);
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
  owner.board = owner.board.filter(x => x.uid !== m.uid);
  log(`${m.name} 사망`);
  if (m.deathrattle) applyFx(owner, m.deathrattle, null);
}

function cleanupBoards() {
  [state.p1, state.p2].forEach(p => {
    p.board = p.board.filter(m => m.hp > 0);
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
function rollCoins(mod) {
  const n = Math.abs(mod || 0);
  const flips = Array.from({ length: n }, () => Math.random() < 0.5);
  const heads = flips.filter(Boolean).length;
  const delta = n ? ((mod > 0 ? 1 : -1) * heads) : 0;
  return { flips, heads, delta };
}
function showCoinResult(title, rows, done) {
  rows = (rows || []).filter(r => r && r.flips && r.flips.length);
  if (!rows.length) { if (done) done(); return; }
  const layer = document.getElementById("coinLayer");
  const box = document.getElementById("coinBox");
  const plus = (typeof COIN_PLUS !== "undefined") ? COIN_PLUS : "";
  const minus = (typeof COIN_MINUS !== "undefined") ? COIN_MINUS : "";
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
  const btn = document.getElementById("coinOk");
  if (btn) btn.onclick = () => { layer.classList.remove("show"); if (done) done(); };
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
  const top = b.top - 8;
  const bottom = b.bottom + 8;
  const left = b.left - 8;
  const right = b.right + 8;
  glow.style.top = (top - gr.top) + "px";
  glow.style.left = (left - gr.left) + "px";
  glow.style.width = (right - left) + "px";
  glow.style.height = (bottom - top) + "px";
  glow.classList.add("on");
}

let _drag = null;
function canDropCard(card) {
  if (!state || !card) return false;
  if (state.busy) return false;
  const me = meView().me;
  if (state.over || current() !== me || me.isAI) return false;
  if (me.mana < card.cost) return false;
  if (card.type === "minion" && me.board.length >= 6) return false;
  return true;
}
function overBoard(x, y) {
  const mine = document.getElementById("myBoard");
  const opp = document.getElementById("oppBoard");
  if (!mine) return false;
  const r = mine.getBoundingClientRect();
  if (x < r.left || x > r.right || y < r.top || y > r.bottom) return false;
  if (opp) {
    const o = opp.getBoundingClientRect();
    if (y <= o.bottom + 8) return false;
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
  el.onpointerdown = (ev) => {
    hidePeek();
    if (ev.button != null && ev.button !== 0) return;
    if (!canDropCard(card)) return;
    ev.preventDefault();
    ev.stopPropagation();
    clearDrag();
    const r = el.getBoundingClientRect();
    const ghost = el.cloneNode(true);
    ghost.classList.add("drag-ghost");
    ghost.style.cssText = "position:fixed;left:"+ev.clientX+"px;top:"+ev.clientY+"px;width:"+r.width+"px;height:"+r.height+"px;margin:0;transform:translate(-50%,-60%);z-index:200;pointer-events:none;";
    document.body.appendChild(ghost);
    el.classList.add("dragging");
    _drag = { card, el, ghost, pid: ev.pointerId };
    const move = (e) => {
      if (!_drag) return;
      _drag.ghost.style.left = e.clientX + "px";
      _drag.ghost.style.top = e.clientY + "px";
      placeDropGlow(overBoard(e.clientX, e.clientY) && canDropCard(_drag.card), e.clientX, e.clientY);
    };
    const up = (e) => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
      if (!_drag) return;
      const cardRef = _drag.card;
      const ok = overBoard(e.clientX, e.clientY) && canDropCard(cardRef);
      if (ok) window._dropSlot = slotIndexFromPoint(e.clientX, e.clientY);
      else window._dropSlot = null;
      clearDrag();
      if (ok) {
        Sfx.playCardDrop();
        onHandClick(cardRef);
      }
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
  };
}

function onHandClick(card) {
  const me = meView().me;
  if (state.over || current() !== me || current().isAI) return;
  if (ui.targeting || ui.attacker) { ui.targeting = null; ui.attacker = null; render(); }
  if (me.mana < card.cost) return;
  if (card.type === "minion" && me.board.length >= 6) return;
  if (needsTarget(card)) {
    const fx = card.type === "spell" ? card.spell : card.battlecry;
    const targets = validTargets(me, fx);
    if (!targets.length) {
      if (card.type === "minion") { playCard(me, card, null); render(); }
      else log("마땅한 대상이 없습니다");
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
  const raceNm = c.type === "minion" ? (c.race || (CARD_RACE && CARD_RACE[c.id]) || "") : ((SPELL_SCHOOL && SPELL_SCHOOL[c.tribe]) || "주문");
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
