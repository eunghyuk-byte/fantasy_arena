function render() {
  if (!state) return;
  const { me, opp } = meView();
  const myTurn = current() === me && !current().isAI && !state.over;

  const g = document.getElementById("game");
  const bg = document.getElementById("boardBgLayer");
  if (bg && typeof HUD_UI !== "undefined" && HUD_UI.board && bg.dataset.ok !== "1") {
    bg.src = HUD_UI.board;
    bg.dataset.ok = "1";
  }
  if (g && typeof HUD_UI !== "undefined" && HUD_UI.board) {
    g.style.setProperty("--board-img", "none");
  }
  document.getElementById("oppHand").innerHTML = opp.hand.map(() => `<div class="back"></div>`).join("");
  const mh = document.getElementById("myHand");
  mh.style.setProperty("--n", String(Math.max(me.hand.length, 1)));
  mh.innerHTML = me.hand.map(c => renderCard(c, myTurn && current() === me && c.cost <= me.mana && (c.type !== "minion" || me.board.length < MAX_BOARD))).join("");
  document.getElementById("oppBoard").innerHTML = renderLane(opp, "opp");
  document.getElementById("myBoard").innerHTML = renderLane(me, "me");
  document.getElementById("oppBoard").classList.toggle("empty", !opp.board.length);
  document.getElementById("myBoard").classList.toggle("empty", !me.board.length);

  document.getElementById("oppStrip").innerHTML = heroStrip(opp, false, myTurn);
  document.getElementById("myStrip").innerHTML = heroStrip(me, true, myTurn);
  const ohr = document.getElementById("oppHeroRow");
  const mhr = document.getElementById("myHeroRow");
  if (ohr) ohr.innerHTML = renderHeroBust(opp, false);
  if (mhr) mhr.innerHTML = renderHeroBust(me, true);
  const om = document.getElementById("oppManaGem");
  const mm = document.getElementById("myManaGem");
  if (om) om.textContent = opp.mana + "/" + opp.maxMana;
  if (mm) mm.textContent = me.mana + "/" + me.maxMana;
  layoutHandFan();
  layoutOppFan();
  if (me._drew) {
    me._drew = false;
    requestAnimationFrame(() => { try { flyDrawCard(); } catch (e) {} });
  }
  if (me._burned) {
    const burned = me._burned;
    me._burned = null;
    const hintEl = document.getElementById("hint");
    if (hintEl) {
      hintEl.textContent = `손패 가득 — ${burned} 파괴됨`;
      hintEl.classList.add("burn-flash");
      setTimeout(() => hintEl.classList.remove("burn-flash"), 1600);
    }
    try {
      const pile = document.querySelector("#myStrip .pile-stack") || document.querySelector("#myStrip .deck-pile");
      if (pile && typeof Vfx !== "undefined" && Vfx.spawn) {
        const r = pile.getBoundingClientRect();
        Vfx.spawn("death-flash", r.left + r.width/2, r.top + r.height/2);
        Vfx.spawn("death-ember", r.left + r.width/2, r.top + r.height/2);
      }
    } catch (e) {}
  }

  const handEls = document.querySelectorAll("#myHand .card");
  const nHand = handEls.length;
  handEls.forEach((el, i) => {
    const t = nHand <= 1 ? 0 : (i - (nHand - 1) / 2);
    el.style.transform = "rotate(" + (t * 4.2) + "deg) translateY(" + (Math.abs(t) * 8) + "px)";
    el.style.zIndex = String(20 + i);
    bindHandCard(el, me.hand[i]);
  });
  document.querySelectorAll("#myBoard .minion").forEach(el => {
    el.onclick = () => onMinionClick(me, findOn(me, el.dataset.uid), "me");
    el.onpointerenter = () => showPeek(el);
    el.onpointerleave = hidePeek;
  });
  document.querySelectorAll("#oppBoard .minion").forEach(el => {
    el.onclick = () => onMinionClick(opp, findOn(opp, el.dataset.uid), "opp");
    el.onpointerenter = () => showPeek(el);
    el.onpointerleave = hidePeek;
  });

  let hint = "";
  if (ui.targeting) hint = "대상을 선택하세요. 빈 곳 클릭으로 취소.";
  else if (ui.battling) hint = "자동 전투 중…";
  else if (myTurn) hint = "하수인·마법 모두 전장으로 드래그. 마법은 전장에 놓는 순간 시전됩니다.";
  else if (current().isAI) hint = "상대가 생각 중…";
  else hint = "상대 턴입니다. (핫시트: 화면을 넘겨 주세요)";
  document.getElementById("hint").textContent = hint;
}

function kwLabel(m) {
  const k = []; // keywords stripped
  const parts = [];
  if (k.includes("charge")) parts.push("돌진");
  if (k.includes("shield")) parts.push("보호막");
  return parts.join(" · ");
}

function artUrl(id) {
  if (typeof CARD_ART !== "undefined" && CARD_ART[id]) return CARD_ART[id];
  const c = CARD_MAP[id] || {};
  const tdef = TRIBES.find(x => x.id === c.tribe) || { color: "#6a5428", icon: "◆", name: "" };
  const bg = tdef.color;
  const label = (c.name || id).slice(0, 4);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 110">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${bg}"/>
      <stop offset="1" stop-color="#1a1008"/>
    </linearGradient></defs>
    <rect width="160" height="110" fill="url(#g)"/>
    <text x="80" y="52" text-anchor="middle" font-size="28">${tdef.icon}</text>
    <text x="80" y="86" text-anchor="middle" font-size="13" fill="#f4ead2">${label}</text>
  </svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}


const _imgCache = {};
function loadImg(src) {
  if (!src) return Promise.resolve(null);
  if (_imgCache[src]) return _imgCache[src];
  _imgCache[src] = new Promise(res => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
  return _imgCache[src];
}
function rr(ctx, x, y, w, h, r) {
  const R = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+R, y);
  ctx.arcTo(x+w, y, x+w, y+h, R);
  ctx.arcTo(x+w, y+h, x, y+h, R);
  ctx.arcTo(x, y+h, x, y, R);
  ctx.arcTo(x, y, x+w, y, R);
  ctx.closePath();
}
function paintNumber(ctx, text, x, y, size) {
  ctx.save();
  ctx.font = `900 ${size}px "Noto Sans KR", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = Math.max(4, size*0.18);
  ctx.strokeStyle = "#120800";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = "#fff";
  ctx.fillText(text, x, y);
  ctx.restore();
}
function paintSmall(ctx, text, x, y, neg) {
  if (!text) return;
  ctx.save();
  ctx.font = `900 16px "Noto Sans KR", Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#000";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = neg ? "#ff8a8a" : "#9dffb0";
  ctx.fillText(text, x, y);
  ctx.restore();
}




async function punchFrame(img) {
  try {
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    const id = x.getImageData(0, 0, c.width, c.height);
    const d = id.data;
    const w = c.width, h = c.height;
    for (let i = 0; i < d.length; i += 4) {
      const px = ((i / 4) % w), py = ((i / 4) / w) | 0;
      const edge = px < w * 0.04 || px > w * 0.96 || py < h * 0.025 || py > h * 0.975;
      if (edge && d[i] < 22 && d[i+1] < 18 && d[i+2] < 16) d[i+3] = 0;
    }
    x.putImageData(id, 0, 0);
    return c;
  } catch (e) { return img; }
}
async function composeCardFace(c, opts={}) {
  const W = 768, H = 1152;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const tribe = TRIBES.find(x => x.id === c.tribe) || { color:"#8b5a2b", name:"", id:"earth" };
  const frameUrl = pickFrameUrl(c, tribe);

  ctx.fillStyle = "#1a1008";
  ctx.fillRect(0, 0, W, H);
  const artX = W * 0.112, artY = H * 0.122, artW = W * 0.776, artH = H * 0.448;
  ctx.fillStyle = tribe.color || "#1a1008";
  ctx.fillRect(artX, artY, artW, artH);
  ctx.save();
  ctx.beginPath();
  const rr = W * 0.055;
  const bx = W * 0.028, by = H * 0.016, bw = W * 0.944, bh = H * 0.968;
  ctx.moveTo(bx+rr, by);
  ctx.arcTo(bx+bw, by, bx+bw, by+bh, rr);
  ctx.arcTo(bx+bw, by+bh, bx, by+bh, rr*1.15);
  ctx.arcTo(bx, by+bh, bx, by, rr*1.15);
  ctx.arcTo(bx, by, bx+bw, by, rr);
  ctx.closePath();
  ctx.clip();

  let art = null;
  if (typeof CARD_ART !== "undefined" && CARD_ART[c.id]) art = await loadImg(CARD_ART[c.id]);
  if (!art && typeof CARD_FACE !== "undefined" && CARD_FACE[c.id]) art = await loadImg(CARD_FACE[c.id]);
  if (art) {
    if (tribe.id === "dark") ctx.filter = "brightness(1.48) contrast(1.10) saturate(1.12)";
    const isFull = !!(typeof CARD_ART !== "undefined" && CARD_ART[c.id]);
    let sx=0, sy=0, sw=art.width, sh=art.height;
    if (!isFull) {
      sx = Math.floor(art.width * 0.13);
      sy = Math.floor(art.height * 0.15);
      sw = Math.floor(art.width * 0.74);
      sh = Math.floor(art.height * 0.42);
    }
    const FOCUS = {
      e1:0.32, e2:0.30, e3:0.22, e4:0.36, e5:0.30, e6:0.34, e7:0.28, e8:0.30,
      e9:0.32, e10:0.30, e11:0.30, e12:0.28, e13:0.28, e14:0.30, e15:0.34,
      e16:0.38, e17:0.28, e18:0.30, e19:0.32, e20:0.28, e21:0.52, e22:0.46, e23:0.46, e24:0.44, f21:0.52, n21:0.50, a21:0.52, l21:0.52, d21:0.52, e17:0.48,
      f1:0.28, f2:0.28, f4:0.32, f5:0.28, f7:0.26, f10:0.30, f19:0.30,
      n1:0.28, n5:0.28, a1:0.36
    };
    const fy = FOCUS[c.id] != null ? FOCUS[c.id] : 0.42;
    const landscape = sw / sh >= 1.05;
    const cover = Math.max(artW / sw, artH / sh);
    const contain = Math.min(artW / sw, artH / sh);
    const FOCUS_X = { e22:0.38, e23:0.40, e24:0.42 };
    if (landscape) {
      const scale = cover;
      const dw = sw * scale, dh = sh * scale;
      const fx = FOCUS_X[c.id] != null ? FOCUS_X[c.id] : 0.50;
      let dx = artX + artW * 0.50 - dw * fx;
      let dy = artY + (artH - dh) / 2;
      dx = Math.max(artX + artW - dw, Math.min(artX, dx));
      ctx.drawImage(art, sx, sy, sw, sh, dx, dy, dw, dh);
    } else {
      const bs = cover * 1.12;
      const bdw = sw * bs, bdh = sh * bs;
      const bdx = artX + (artW - bdw) / 2;
      const bdy = artY + artH * 0.42 - bdh * fy;
      ctx.save();
      ctx.filter = "blur(12px)";
      ctx.drawImage(art, sx, sy, sw, sh, bdx, bdy, bdw, bdh);
      ctx.restore();
      const scale = contain;
      const dw = sw * scale, dh = sh * scale;
      const dx = artX + (artW - dw) / 2;
      const dy = artY + (artH - dh) / 2;
      ctx.drawImage(art, sx, sy, sw, sh, dx, dy, dw, dh);
    }
  }
    ctx.filter = "none";

  ctx.restore();
  const frame = await loadImg(frameUrl);
  if (frame) ctx.drawImage(await punchFrame(frame), 0, 0, W, H);

  ctx.save();
  ctx.font = "800 " + Math.round(H*0.042) + "px 'Noto Sans KR', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(6, H*0.008);
  ctx.strokeStyle = "#120800";
  ctx.strokeText(c.name || "", W*0.50, H*0.590);
  ctx.fillStyle = "#fff8e8";
  ctx.fillText(c.name || "", W*0.50, H*0.590);
  ctx.restore();

  const headerTxt = (c.type === "minion")
    ? (c.race || (typeof CARD_RACE !== "undefined" && CARD_RACE[c.id]) || "")
    : ((typeof SPELL_SCHOOL !== "undefined" && SPELL_SCHOOL[c.tribe]) || "주문");
  if (headerTxt) {
    ctx.save();
    const hs = Math.round(H*0.026) + 2;
    ctx.font = "800 " + hs + "px 'Noto Sans KR', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(4, hs*0.22);
    ctx.strokeStyle = "#120800";
    ctx.fillStyle = "#f3e2b0";
    ctx.strokeText(headerTxt, W*0.50, H*0.074);
    ctx.fillText(headerTxt, W*0.50, H*0.074);
    ctx.restore();
  }

  let txt = (c.text && c.text !== "전설") ? c.text : (c.type === "spell" ? "주문" : "");
  const skill = (c.atkSkill >= 2 && c.atkSkill <= 10) ? (c.atkSkill | 0) : 0;
  if (skill && typeof ATK_SKILL_LABEL !== "undefined" && ATK_SKILL_LABEL[skill]) {
    txt = ATK_SKILL_LABEL[skill];
  }
  if (txt) {
    const tSize = Math.round(H*0.037) + 2;
    const isSkill = skill >= 2;
    ctx.save();
    // Attack specials: bold + darker keyword (FA 판마-style)
    ctx.fillStyle = isSkill ? "#140c04" : "#2a2014";
    ctx.font = (isSkill ? "900 " : "700 ") + tSize + "px 'Noto Sans KR', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const maxW = W * 0.62;
    const lines = [];
    let line = "";
    for (const ch of txt) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = ch;
      } else line = test;
    }
    if (line) lines.push(line);
    const lh = tSize * 1.28;
    const startY = H*0.743 - ((lines.length - 1) * lh) / 2;
    lines.forEach((ln, i) => {
      if (isSkill) {
        ctx.strokeStyle = "#140c04";
        ctx.lineWidth = Math.max(1.5, tSize * 0.06);
        ctx.lineJoin = "round";
        ctx.strokeText(ln, W*0.50, startY + i * lh);
      }
      ctx.fillText(ln, W*0.50, startY + i * lh);
    });
    ctx.restore();
  }

  paintNumber(ctx, String(c.cost ?? 0), W*0.1542, H*0.103, Math.round(H*0.070));
  if (c.type === "minion") {
    const hp = opts.hp != null ? opts.hp : c.hp;
    paintNumber(ctx, String(c.atk ?? 0), W*0.1525, H*0.9032, Math.round(H*0.066));
    paintNumber(ctx, String(c.def ?? 0), W*0.5008, H*0.9032, Math.round(H*0.066));
    paintNumber(ctx, String(hp ?? 0), W*0.8628, H*0.9032, Math.round(H*0.066));
    await paintStatCoins(ctx, c, W, H);
  }
  try {
    return canvas.toDataURL("image/jpeg", 0.92);
  } catch (err) {
    console.warn("card face export failed", err);
    if (typeof CARD_ART !== "undefined" && CARD_ART[c.id]) return CARD_ART[c.id];
    if (typeof CARD_FACE !== "undefined" && CARD_FACE[c.id]) return CARD_FACE[c.id];
    return canvas.toDataURL();
  }
}
async function paintStatCoins(ctx, c, W, H) {
  const plus = await loadImg(typeof COIN_PLUS !== "undefined" ? COIN_PLUS : "");
  const minus = await loadImg(typeof COIN_MINUS !== "undefined" ? COIN_MINUS : "");
  if (!plus && !minus) return;
  const size = Math.round(W * 0.03872);
  const gap = Math.round(size * 0.06);
  const cy = H * 0.972;
  const slots = [
    [W * 0.1525, parseCoin(c.atkC)],
    [W * 0.5008, parseCoin(c.defC)],
    [W * 0.8628, parseCoin(c.hpC)]
  ];
  for (const [ax, raw] of slots) {
    if (!raw) continue;
    const img = raw > 0 ? plus : minus;
    if (!img) continue;
    const n = Math.min(5, Math.abs(raw | 0));
    const total = n * size + (n - 1) * gap;
    let x0 = ax - total / 2;
    if (x0 < W * 0.02) x0 = W * 0.02;
    if (x0 + total > W * 0.98) x0 = W * 0.98 - total;
    for (let i = 0; i < n; i++) {
      ctx.drawImage(img, x0 + i * (size + gap), cy - size / 2, size, size);
    }
  }
}

const _faceWait = new Map();
function faceSrc(c, opts, el) {
  const key = ["v64atk", c.id, c.cost, c.atk, c.def, c.atkC, c.defC, c.hpC, opts && opts.hp != null ? opts.hp : c.hp, c.name, c.atkSkill || 1, c.text || ""].join("|");
  if (_faceWait.has(key)) {
    _faceWait.get(key).then(src => { if (el) el.src = src; });
    return _faceWait.get(key);
  }
  const p = composeCardFace(c, opts || {}).catch(err => {
    console.warn("composeCardFace", err);
    return (typeof CARD_FACE !== "undefined" && CARD_FACE[c.id]) ? CARD_FACE[c.id] : "";
  });
  _faceWait.set(key, p);
  p.then(src => { if (el && src) el.src = src; });
  return p;
}

function renderCard(c, playable) {
  const uid = "face_" + Math.random().toString(36).slice(2,8);
  setTimeout(() => {
    const el = document.getElementById(uid);
    if (el) faceSrc(c, {}, el);
  }, 0);
  return `<div class="card ${playable ? "playable" : ""}" data-id="${c.id}">
    <img class="card-face" id="${uid}" alt="${c.name}">
    ${playable ? '<span class="play-glow" aria-hidden="true"></span>' : ""}
  </div>`;
}


function renderHeroBust(p, isMe) {
  const icon = (typeof TRIBE_ICONS !== "undefined" && TRIBE_ICONS[p.hero.id]) || "";
  return `<div class="hero-bust ${isMe ? "mine" : "opp"}" title="${p.name}">
    <div class="frame">${icon ? `<img src="${icon}" alt="">` : ""}</div>
    <div class="gem">${p.hp}</div>
  </div>`;
}
function layoutOppFan() {
  const wrap = document.getElementById("oppHand");
  if (!wrap) return;
  const cards = [...wrap.querySelectorAll(".back")];
  const n = cards.length;
  cards.forEach((el, i) => {
    const t = n <= 1 ? 0 : (i - (n - 1) / 2);
    el.style.transform = `translateY(${Math.abs(t)*4}px) rotate(${t*6}deg)`;
    el.style.marginLeft = i ? "-16px" : "0";
    el.style.zIndex = String(5 + i);
  });
}
function layoutHandFan() {
  const wrap = document.getElementById("myHand");
  if (!wrap) return;
  const cards = [...wrap.querySelectorAll(".card")];
  const n = cards.length;
  // Hearthstone-like: tighter than 0.42; denser as hand grows (paper fan, not spread)
  const overlap = n <= 1 ? 0 : (n <= 4 ? 0.52 : n <= 7 ? 0.58 : 0.64);
  const rotStep = n <= 5 ? 3.6 : 2.8;
  wrap.style.setProperty("--hand-overlap", String(overlap));
  cards.forEach((el, i) => {
    const t = n <= 1 ? 0 : (i - (n - 1) / 2);
    el.style.transform = `translateY(${Math.abs(t)*7}px) rotate(${t*rotStep}deg)`;
    el.style.zIndex = String(20 + i);
    // Prefer layout width (offsetWidth) so rotate AABB does not inflate the margin
    const w = el.offsetWidth || el.getBoundingClientRect().width || 80;
    el.style.setProperty("margin-left", i ? Math.round(-w * overlap) + "px" : "0", "important");
  });
}

function renderLane(p, who) {
  const cells = [];
  for (let i = 0; i < MAX_BOARD; i++) {
    const inner = p.board[i] ? renderMinion(p.board[i], who) : "";
    cells.push(`<div class="slot ${p.board[i] ? "filled" : "empty"}" data-n="${i+1}">${inner}</div>`);
  }
  return cells.join("");
}

function renderMinion(m, side) {
  const me = meView().me;
  const mine = side === "me";
  const canAtk = mine && current() === me && !current().isAI && m.canAttack && m.attacksLeft > 0 && m.atk > 0 && !ui.targeting;
  const selected = ui.attacker && ui.attacker.uid === m.uid;
  let targetable = false;
  if (ui.targeting) {
    targetable = ui.targeting.targets.some(t => t.kind === "minion" && t.minion.uid === m.uid);
  } else if (ui.attacker && !mine) {
    targetable = attackTargets(me, ui.attacker).some(t => t.kind === "minion" && t.minion.uid === m.uid);
  }
  const cls = [
    "minion",
    "",
    "",
    targetable ? "can-target" : "",
  ].join(" ");
  const uid = "mface_" + m.uid;
  setTimeout(() => {
    const el = document.getElementById(uid);
    if (el) faceSrc(m, { hp: m.hp }, el);
  }, 0);
  const hurt = m._hurt && m._hurt.dmg ? ` hurt` : "";
  const rip = m.dying ? " rip" : "";
  const tick = m._hurt && m._hurt.dmg ? `<div class="hp-tick">-${m._hurt.dmg}</div>` : "";
  const stat = m._fxAtk != null ? `<div class="stat-pop">공 ${m._fxAtk}</div>` : "";
  return `<div class="${cls}${hurt}${rip}" data-uid="${m.uid}">
    <img class="card-face" id="${uid}" alt="${m.name}">
    ${tick}${stat}
  </div>`;
}

function heroStrip(p, isMe, myTurn) {
  const { me } = meView();
  let canTarget = false;
  if (ui.targeting) canTarget = ui.targeting.targets.some(t => t.kind === "hero" && t.owner === p);
  if (ui.attacker && !isMe) canTarget = attackTargets(me, ui.attacker).some(t => t.kind === "hero");
  const powerReady = isMe && myTurn && !p.powerUsed && p.mana >= 2;
  const endReady = isMe && myTurn;
  const icon = (typeof TRIBE_ICONS !== "undefined" && TRIBE_ICONS[p.hero.id]) || "";
  const hud = (typeof HUD_UI !== "undefined") ? HUD_UI : {};
  const nDeck = p.deck.length;
  const layers = Math.min(8, Math.max(1, nDeck ? Math.ceil(nDeck / 4) : 1));
  let stack = "";
  for (let i = 0; i < layers; i++) {
    stack += `<i class="pile-layer" style="--i:${i};background-image:url('${hud.deck || ""}')"></i>`;
  }
  const pile = `
      <div class="deck-pile" data-n="${nDeck}">
        <div class="pile-stack">${stack}</div>
        <div class="pile-count">${nDeck}</div>
      </div>`;
  const hero = `<div class="hud-hero">${renderHeroSlot(p, isMe)}</div>`;
  if (!isMe) return `<div class="side">${pile}${hero}</div>`;
  return `<div class="side">
      ${pile}
      ${hero}
      <button class="end-btn ${endReady ? "go" : ""}" id="endBtn" ${endReady ? "" : "disabled"}>턴 종료</button>
      <button class="give-btn" id="giveBtn">게임 종료</button>
    </div>`;
}


