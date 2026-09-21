

function layoutBoardAlign() {
  const bg = document.getElementById("boardBgLayer");
  const main = document.querySelector("#game.active .col-main");
  if (!bg || !main || !bg.naturalWidth) return;
  const br = bg.getBoundingClientRect();
  const mr = main.getBoundingClientRect();
  if (br.width < 8 || br.height < 8 || mr.height < 8) return;
  // object-fit:contain content box inside the img element
  const nw = bg.naturalWidth, nh = bg.naturalHeight;
  const scale = Math.min(br.width / nw, br.height / nh);
  const contentH = nh * scale;
  const contentTop = br.top + (br.height - contentH) / 2;
  const midY = contentTop + contentH / 2; // parchment center line ≈ image mid
  // Fraction of col-main where opp/my boundary should sit
  let midFrac = (midY - mr.top) / mr.height;
  midFrac = Math.max(0.38, Math.min(0.58, midFrac));
  // Rows: oppHand | oppBoard | myBoard | myHand | hint
  // Keep hand sizable; split remaining around midFrac
  const hand = 0.28, hint = 0.015, oppHand = 0.06;
  const rest = 1 - hand - hint - oppHand; // boards total
  // Boundary after oppHand+oppBoard == midFrac
  let oppBoard = midFrac - oppHand;
  let myBoard = rest - oppBoard;
  if (oppBoard < 0.18) { oppBoard = 0.18; myBoard = rest - oppBoard; }
  if (myBoard < 0.16) { myBoard = 0.16; oppBoard = rest - myBoard; }
  const pct = (x) => (x * 100).toFixed(2) + "%";
  const rows = [oppHand, oppBoard, myBoard, hand, hint].map(pct).join(" ");
  main.style.setProperty("grid-template-rows", rows, "important");
}

function layoutBoardSlots() {
  ["myBoard", "oppBoard"].forEach(id => {
    const board = document.getElementById(id);
    if (!board) return;
    const bh = board.clientHeight || 0;
    const bw = board.clientWidth || 0;
    // Fit up to 5 units in board width; height ~88% of lane
    let slotH = Math.floor(bh * 0.88);
    if (!slotH || slotH < 120) slotH = 160;
    if (slotH > 220) slotH = 220;
    let slotW = Math.floor(slotH * 2 / 3);
    const maxW = Math.floor((bw - 24) / 5.15);
    if (maxW > 40 && slotW > maxW) {
      slotW = maxW;
      slotH = Math.floor(slotW * 3 / 2);
    }
    board.style.setProperty("--slot-h", slotH + "px");
    board.style.setProperty("--slot-w", slotW + "px");
  });
}

function render() {
  if (!state) return;
  try { if (typeof hidePeek === "function") hidePeek(); } catch (e) {}
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
  // Do not rebuild hand DOM mid-drag — destroys pointer target and breaks drops
  const dragging = (typeof _drag !== "undefined" && _drag);
  if (!dragging) {
    mh.innerHTML = me.hand.map(c => renderCard(c, myTurn && current() === me && c.cost <= me.mana && (c.type !== "minion" || me.board.length < 5))).join("");
  }
  document.getElementById("oppBoard").innerHTML = renderLane(opp, "opp");
  const boardDragging = dragging && _drag && _drag.kind === "board";
  if (!boardDragging) {
    document.getElementById("myBoard").innerHTML = renderLane(me, "me");
  }
  document.getElementById("oppBoard").classList.toggle("empty", !opp.board.length);
  document.getElementById("myBoard").classList.toggle("empty", !me.board.length);
  layoutBoardSlots();
  layoutBoardAlign();
  requestAnimationFrame(() => { layoutBoardSlots(); layoutBoardAlign(); });

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

  if (!(typeof _drag !== "undefined" && _drag)) {
    const handEls = document.querySelectorAll("#myHand .card");
    handEls.forEach((el, i) => {
      bindHandCard(el, me.hand[i]);
    });
    layoutHandFan();
  }
  if (!(typeof _drag !== "undefined" && _drag && _drag.kind === "board")) {
    document.querySelectorAll("#myBoard .minion").forEach(el => {
      const unit = findOn(me, el.dataset.uid);
      el.onclick = () => onMinionClick(me, unit, "me");
      if (typeof bindBoardMinion === "function" && unit) bindBoardMinion(el, unit);
      else {
        el.onpointerenter = () => showPeek(el);
        el.onpointerleave = hidePeek;
      }
    });
  }
  document.querySelectorAll("#oppBoard .minion").forEach(el => {
    el.onclick = () => onMinionClick(opp, findOn(opp, el.dataset.uid), "opp");
    el.onpointerenter = () => showPeek(el);
    el.onpointerleave = hidePeek;
    // Never bind reorder on enemy board
  });

  let hint = "";
  if (ui.targeting) hint = "대상을 선택하세요. 빈 곳 클릭으로 취소.";
  else if (ui.battling) hint = "자동 전투 중…";
  else if (myTurn) hint = "유닛·스펠 모두 전장으로 드래그. 스펠은 전장에 놓는 순간 시전됩니다.";
  else if (current().isAI) hint = "상대가 생각 중…";
  else hint = "상대 턴입니다. (핫시트: 화면을 넘겨 주세요)";
  document.getElementById("hint").textContent = hint;
}

function kwLabel(m) {
  const k = m.keywords || [];
  const parts = [];
  if (k.includes("taunt")) parts.push("도발");
  if (k.includes("charge")) parts.push("돌진");
  if (k.includes("shield")) parts.push("보호막");
  if (k.includes("rebirth") || (m.ability && String(m.ability).includes("환생"))) parts.push("환생");
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




const _punchCache = new WeakMap();
const _punchByUrl = new Map();
async function punchFrame(img, urlKey) {
  // Punch near-white art windows + near-black JPEG bleed to alpha. Cached per URL.
  // Pre-keyed PNG/WebP (unit/*.png) already transparent — skip heavy scan.
  if (!img) return img;
  if (urlKey && _punchByUrl.has(urlKey)) return _punchByUrl.get(urlKey);
  if (_punchCache.has(img)) return _punchCache.get(img);
  if (urlKey && /\.(png|webp)(\?|$)/i.test(urlKey)) {
    _punchCache.set(img, img);
    _punchByUrl.set(urlKey, img);
    return img;
  }
  try {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    const id = x.getImageData(0, 0, c.width, c.height);
    const d = id.data;
    const w = c.width, h = c.height;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (r >= 228 && g >= 228 && b >= 228) { d[i + 3] = 0; continue; }
      const px = (i / 4) % w, py = ((i / 4) / w) | 0;
      const edge = px < w * 0.045 || px > w * 0.955 || py < h * 0.03 || py > h * 0.97;
      if (edge && r < 24 && g < 20 && b < 18) d[i + 3] = 0;
    }
    x.putImageData(id, 0, 0);
    _punchCache.set(img, c);
    if (urlKey) _punchByUrl.set(urlKey, c);
    return c;
  } catch (e) {
    _punchCache.set(img, img);
    if (urlKey) _punchByUrl.set(urlKey, img);
    return img;
  }
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
  if (!art && c.type !== "spell" && typeof CARD_FACE !== "undefined" && CARD_FACE[c.id]) art = await loadImg(CARD_FACE[c.id]);
  if (art) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(artX, artY, artW, artH);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    try { ctx.imageSmoothingQuality = "high"; } catch (e) {}
    if (tribe.id === "dark") ctx.filter = "brightness(1.48) contrast(1.10) saturate(1.12)";
    const isFull = !!(typeof CARD_ART !== "undefined" && CARD_ART[c.id]);
    let sx=0, sy=0, sw=art.width, sh=art.height;
    if (!isFull) {
      // Crop source region only — still drawn with uniform scale (never stretch)
      sx = Math.floor(art.width * 0.13);
      sy = Math.floor(art.height * 0.15);
      sw = Math.floor(art.width * 0.74);
      sh = Math.floor(art.height * 0.42);
    }
    // HARD RULE: one scale for both axes (cover or contain). Never stretch.
    const drawUniform = (mode, focusX, focusY, scaleMul) => {
      const base = mode === "cover"
        ? Math.max(artW / sw, artH / sh)
        : Math.min(artW / sw, artH / sh);
      const scale = base * (scaleMul || 1);
      const dw = sw * scale;
      const dh = sh * scale;
      let dx = artX + artW * focusX - dw * focusX;
      let dy = artY + artH * focusY - dh * focusY;
      if (mode === "cover") {
        dx = Math.max(artX + artW - dw, Math.min(artX, dx));
        dy = Math.max(artY + artH - dh, Math.min(artY, dy));
      }
      ctx.drawImage(art, sx, sy, sw, sh, dx, dy, dw, dh);
    };
    const FOCUS = {
      e1:0.32, e2:0.30, e3:0.22, e4:0.36, e5:0.30, e6:0.34, e7:0.28, e8:0.30,
      e9:0.32, e10:0.30, e11:0.30, e12:0.28, e13:0.28, e14:0.30, e15:0.34,
      e16:0.38, e17:0.28, e18:0.30, e19:0.32, e20:0.28, e21:0.52, e22:0.46, e23:0.46, e24:0.44, f21:0.52, n21:0.50, a21:0.52, l21:0.52, d21:0.52, e17:0.48,
      f1:0.28, f2:0.28, f4:0.32, f5:0.28, f7:0.26, f10:0.30, f19:0.30,
      n1:0.28, n5:0.28, a1:0.36
    };
    const fy = FOCUS[c.id] != null ? FOCUS[c.id] : 0.42;
    const landscape = sw / sh >= 1.05;
    const FOCUS_X = { e22:0.38, e23:0.40, e24:0.42 };
    if (landscape) {
      const fx = FOCUS_X[c.id] != null ? FOCUS_X[c.id] : 0.50;
      drawUniform("cover", fx, 0.50, 1);
    } else {
      // Soft cover blur fill (uniform) + contain subject (uniform)
      ctx.save();
      ctx.filter = (tribe.id === "dark" ? "brightness(1.48) contrast(1.10) saturate(1.12) " : "") + "blur(12px)";
      drawUniform("cover", 0.50, fy, 1.12);
      ctx.restore();
      if (tribe.id === "dark") ctx.filter = "brightness(1.48) contrast(1.10) saturate(1.12)";
      drawUniform("contain", 0.50, 0.50, 1);
    }
    ctx.filter = "none";
    ctx.restore();
  }
  ctx.filter = "none";

  ctx.restore();
  const frame = await loadImg(frameUrl);
  if (frame) ctx.drawImage(await punchFrame(frame, frameUrl), 0, 0, W, H);

  ctx.save();
  ctx.font = "800 " + (Math.round(H*0.042) + 2) + "px 'Noto Sans KR', sans-serif";
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
    ? (c.token ? "토큰" : (c.race || (typeof CARD_RACE !== "undefined" && CARD_RACE[c.id]) || ""))
    : (c.type === "item" ? "아이템" : "스펠");
  if (headerTxt) {
    ctx.save();
    const hs = Math.round(H*0.042);
    ctx.font = "800 " + hs + "px 'Noto Sans KR', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(6, H*0.008);
    if (c.type === "item") {
      // sapphire gem blue
      ctx.strokeStyle = "#061428";
      ctx.fillStyle = "#6ec0ff";
    } else if (c.type === "spell") {
      // arcane violet
      ctx.strokeStyle = "#1a0628";
      ctx.fillStyle = "#e4b4ff";
    } else {
      // unit race — warm title cream
      ctx.strokeStyle = "#120800";
      ctx.fillStyle = "#fff8e8";
    }
    ctx.strokeText(headerTxt, W*0.50, H*0.074);
    ctx.fillText(headerTxt, W*0.50, H*0.074);
    ctx.restore();
  }

  const txt = (c.text && c.text !== "전설" && c.text !== "레전드") ? c.text : (c.type === "spell" ? "주문" : "");
  if (txt) {
    const tSize = Math.round(H*0.037) + 2;
    ctx.save();
    // 대지·빛 등 밝은 프레임: 짙은 갈흑. 암·불 어두운 프레임: 채도 낮은 밝은 회(순백 X).
    const darkFrame = (tribe.id === "dark" || tribe.id === "fire");
    ctx.fillStyle = darkFrame ? "#c9c2b6" : "#2a2014";
    ctx.font = "700 " + tSize + "px 'Noto Sans KR', sans-serif";
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
    lines.forEach((ln, i) => ctx.fillText(ln, W*0.50, startY + i * lh));
    ctx.restore();
  }

  paintNumber(ctx, String(c.cost ?? 0), W*0.1542, H*0.103, Math.round(H*0.070));
  const paintFrameStats = c.type === "minion" || (c.type === "item" && !c.instant);
  if (paintFrameStats) {
    const hp = opts.hp != null ? opts.hp : c.hp;
    paintNumber(ctx, String(c.atk ?? 0), W*0.1525, H*0.9032, Math.round(H*0.066));
    paintNumber(ctx, String(c.def ?? 0), W*0.5008, H*0.9032, Math.round(H*0.066));
    paintNumber(ctx, String(hp ?? 0), W*0.8628, H*0.9032, Math.round(H*0.066));
    if (c.type === "minion") await paintStatCoins(ctx, c, W, H);
  }
  try {
    return canvas.toDataURL("image/jpeg", 0.92);
  } catch (err) {
    console.warn("card face export failed", err);
    if (typeof CARD_ART !== "undefined" && CARD_ART[c.id]) return CARD_ART[c.id];
    // Spells/items: never fall back to CARD_FACE (coin was baked on a unit frame)
    if (c && (c.type === "spell" || c.type === "item")) return canvas.toDataURL();
    if (typeof CARD_FACE !== "undefined" && CARD_FACE[c.id]) return CARD_FACE[c.id];
    return canvas.toDataURL();
  }
}
async function paintStatCoins(ctx, c, W, H) {
  const plus = await loadImg((typeof COIN_PLUS !== "undefined" && COIN_PLUS) ? COIN_PLUS : "assets/img/coins/plus.png");
  const minus = await loadImg((typeof COIN_MINUS !== "undefined" && COIN_MINUS) ? COIN_MINUS : "assets/img/coins/minus.png");
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
const _faceDone = new Map();
const _composeQ = [];
let _composeActive = 0;
const COMPOSE_MAX = 6;
function enqueueCompose(fn) {
  return new Promise((resolve, reject) => {
    const run = () => {
      _composeActive++;
      Promise.resolve()
        .then(fn)
        .then(v => { _composeActive--; resolve(v); pump(); })
        .catch(err => { _composeActive--; reject(err); pump(); });
    };
    const pump = () => {
      while (_composeActive < COMPOSE_MAX && _composeQ.length) _composeQ.shift()();
    };
    _composeQ.push(run);
    pump();
  });
}
function faceCacheKey(c, opts) {
  return ["v89descink", c.id, c.type || "", c.cost, c.atk, c.def, c.atkC, c.defC, c.hpC, opts && opts.hp != null ? opts.hp : c.hp, c.name, c.itemWorn ? "eq" : "", (c.equippedItem && c.equippedItem.id) || ""].join("|");
}
function faceSrc(c, opts, el) {
  const key = faceCacheKey(c, opts);
  if (_faceDone.has(key)) {
    const src = _faceDone.get(key);
    if (el && src) {
      el.src = src;
      el.classList.remove("face-pending");
      el.classList.add("face-ready");
    }
    return Promise.resolve(src);
  }
  if (_faceWait.has(key)) {
    _faceWait.get(key).then(src => {
      if (el && src) {
        el.src = src;
        el.classList.remove("face-pending");
        el.classList.add("face-ready");
      }
    });
    return _faceWait.get(key);
  }
  const p = enqueueCompose(() => composeCardFace(c, opts || {})).then(src => {
    if (src) _faceDone.set(key, src);
    return src;
  }).catch(err => {
    console.warn("composeCardFace", err);
    if (typeof CARD_ART !== "undefined" && CARD_ART[c.id]) return CARD_ART[c.id];
    // Spells/items: skip CARD_FACE fallback (avoids unit-framed coin.jpg)
    if (c && (c.type === "spell" || c.type === "item")) return "";
    return (typeof CARD_FACE !== "undefined" && CARD_FACE[c.id]) ? CARD_FACE[c.id] : "";
  });
  _faceWait.set(key, p);
  p.then(src => {
    if (!el) return;
    if (src) {
      el.src = src;
      el.classList.remove("face-pending");
      el.classList.add("face-ready");
    } else {
      // Compose failed — tribe SVG stub, never bare CARD_ART (prevents art→frame flash)
      const fb = (typeof artUrl === "function") ? artUrl(c.id) : "";
      if (fb) {
        el.src = fb;
        el.classList.remove("face-pending");
        el.classList.add("face-ready");
      }
    }
  });
  return p;
}

function renderCard(c, playable) {
  const uid = "face_" + Math.random().toString(36).slice(2,8);
  const cacheKey = faceCacheKey(c, {});
  const cached = _faceDone.has(cacheKey) ? _faceDone.get(cacheKey) : "";
  setTimeout(() => {
    const el = document.getElementById(uid);
    if (el) faceSrc(c, {}, el);
  }, 0);
  const pending = cached ? "" : " face-pending";
  const srcAttr = cached ? ` src="${cached}"` : "";
  return `<div class="card ${playable ? "playable" : ""}" data-id="${c.id}">
    <img class="card-face${pending}${cached ? " face-ready" : ""}" id="${uid}" alt="${c.name}"${srcAttr}>
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
    el.style.transform = `translateY(${Math.abs(t)*2}px) rotate(${t*6}deg)`;
    el.style.marginLeft = i ? "-16px" : "0";
    el.style.zIndex = String(5 + i);
  });
}
function layoutHandFan() {
  const wrap = document.getElementById("myHand");
  if (!wrap) return;
  const cards = [...wrap.querySelectorAll(".card")];
  const n = cards.length;
  const mid = (n - 1) / 2;
  cards.forEach((el, i) => {
    const t = n <= 1 ? 0 : (i - mid);
    el.style.transform = `translateY(${Math.abs(t)*7}px) rotate(${t*2.4}deg)`;
    // LTR z-order (Hearthstone): rightmost visually on top. Left crescent of each card is the hit target.
    // !important beats any CSS .playable { z-index } flattening.
    el.style.setProperty("z-index", String(20 + i), "important");
    el.style.setProperty("margin-left", i ? "-72px" : "0", "important");
  });
}

function renderLane(p, who) {
  const cells = [];
  for (let i = 0; i < 5; i++) {
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
    (m.keywords || []).includes("taunt") ? "taunt" : "",
    "",
    targetable ? "can-target" : "",
  ].join(" ");
  const uid = "mface_" + m.uid;
  const cacheKey = faceCacheKey(m, { hp: m.hp });
  const cached = _faceDone.has(cacheKey) ? _faceDone.get(cacheKey) : "";
  setTimeout(() => {
    const el = document.getElementById(uid);
    if (el) faceSrc(m, { hp: m.hp }, el);
  }, 0);
  const hurt = m._hurt && m._hurt.dmg ? ` hurt` : "";
  const rip = m.dying ? " rip" : "";
  const tick = m._hurt && m._hurt.dmg ? `<div class="hp-tick">-${m._hurt.dmg}</div>` : "";
  const stat = m._fxAtk != null ? `<div class="stat-pop">공 ${m._fxAtk}</div>` : "";
  const pending = cached ? "" : " face-pending";
  const srcAttr = cached ? ` src="${cached}"` : "";
  return `<div class="${cls}${hurt}${rip}" data-uid="${m.uid}">
    <img class="card-face${pending}${cached ? " face-ready" : ""}" id="${uid}" alt="${m.name}"${srcAttr}>
    ${tick}${stat}
  </div>`;
}

function heroStrip(p, isMe, myTurn) {
  const { me } = meView();
  let canTarget = false;
  if (ui.targeting) canTarget = ui.targeting.targets.some(t => t.kind === "hero" && t.owner === p);
  if (ui.attacker && !isMe) canTarget = attackTargets(me, ui.attacker).some(t => t.kind === "hero");
  const endReady = isMe && myTurn;
  const icon = (typeof TRIBE_ICONS !== "undefined" && TRIBE_ICONS[p.hero.id]) || "";
  const hud = (typeof HUD_UI !== "undefined") ? HUD_UI : {};
  const nDeck = p.deck.length;
  const layers = Math.min(6, Math.max(1, Math.ceil(nDeck / 5)));
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


