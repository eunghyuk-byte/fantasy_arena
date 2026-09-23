
/** Last successful board/HUD geometry fingerprint + inline style cache. */
var _boardLayoutKey = "";
var _hudStyleCache = null;

function boardLayoutFingerprint() {
  const bg = document.getElementById("boardBgLayer");
  const main = document.querySelector("#game.active .col-main");
  if (!bg || !main || !bg.naturalWidth) return "";
  const br = bg.getBoundingClientRect();
  const mr = main.getBoundingClientRect();
  if (br.width < 8 || br.height < 8 || mr.width < 8 || mr.height < 8) return "";
  // Round to 2px to ignore subpixel thrash / mobile chrome jitter
  const q = (n) => Math.round(n * 2) / 2;
  return [q(br.left), q(br.top), q(br.width), q(br.height), q(mr.left), q(mr.top), q(mr.width), q(mr.height), bg.naturalWidth, bg.naturalHeight].join("|");
}

function cacheHudStyles() {
  const ids = ["endBtn", "oppSoulGem", "mySoulGem"];
  const sels = ["#oppStrip .hud-hero", "#myStrip .hud-hero", "#oppStrip .hero-hp", "#myStrip .hero-hp"];
  const out = { ids: {}, sels: {} };
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    out.ids[id] = {
      left: el.style.getPropertyValue("left"),
      top: el.style.getPropertyValue("top"),
      width: el.style.getPropertyValue("width"),
      height: el.style.getPropertyValue("height")
    };
  });
  sels.forEach(sel => {
    const el = document.querySelector(sel);
    if (!el) return;
    out.sels[sel] = {
      left: el.style.getPropertyValue("left"),
      top: el.style.getPropertyValue("top"),
      width: el.style.getPropertyValue("width"),
      height: el.style.getPropertyValue("height")
    };
  });
  _hudStyleCache = out;
}

/** Re-apply last good absolute seats immediately after strip DOM rebuild (prevents top-left flash). */
function restoreHudStyles() {
  if (!_hudStyleCache) return;
  const apply = (el, st) => {
    if (!el || !st) return;
    if (!st.left && !st.top) return;
    if (st.left) el.style.setProperty("left", st.left, "important");
    if (st.top) el.style.setProperty("top", st.top, "important");
    if (st.width) el.style.setProperty("width", st.width, "important");
    if (st.height) el.style.setProperty("height", st.height, "important");
    el.style.setProperty("right", "auto", "important");
    el.style.setProperty("bottom", "auto", "important");
    el.style.setProperty("transform", "none", "important");
  };
  Object.keys(_hudStyleCache.ids || {}).forEach(id => apply(document.getElementById(id), _hudStyleCache.ids[id]));
  Object.keys(_hudStyleCache.sels || {}).forEach(sel => apply(document.querySelector(sel), _hudStyleCache.sels[sel]));
}

/** Seat endBtn + hero/soul HUD from boardBg content box. Safe during coin modal. */
function layoutHudChrome() {
  try { layoutEndBtn(); } catch (e) {}
  try { layoutHudGems(); } catch (e) {}
  cacheHudStyles();
}

/** Run all board/HUD absolute layouts once geometry is measurable. */
function runBoardLayouts(force) {
  const key = boardLayoutFingerprint();
  // Skip thrash when board geometry unchanged (resize spam / coin modal dimming)
  if (!force && key && key === _boardLayoutKey) {
    // Still reseat HUD in case strip DOM was rebuilt with same geometry
    restoreHudStyles();
    layoutHudChrome();
    const g0 = document.getElementById("game");
    const bg0 = document.getElementById("boardBgLayer");
    if (g0 && bg0 && bg0.naturalWidth) g0.classList.add("hud-ready");
    return;
  }
  // Align rows FIRST so slot/deck measurements use final lane heights
  try { layoutBoardAlign(); } catch (e) {}
  try { layoutBoardSlots(); } catch (e) {}
  try { layoutBoardDecks(); } catch (e) {}
  layoutHudChrome();
  if (key) _boardLayoutKey = key;
  const g = document.getElementById("game");
  const bg = document.getElementById("boardBgLayer");
  if (g && bg && bg.naturalWidth) g.classList.add("hud-ready");
}

/** Wait until board art has naturalWidth (or error), then double-rAF layout. */
function ensureBoardLayouts(force) {
  const bg = document.getElementById("boardBgLayer");
  const kick = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { runBoardLayouts(!!force); });
    });
  };
  if (!bg) { kick(); return; }
  if (bg.complete && bg.naturalWidth > 0) { kick(); return; }
  if (bg._layoutWaitBound) { kick(); return; }
  bg._layoutWaitBound = true;
  const done = () => {
    bg._layoutWaitBound = false;
    bg.removeEventListener("load", done);
    bg.removeEventListener("error", done);
    kick();
  };
  bg.addEventListener("load", done);
  bg.addEventListener("error", done);
  // Fallback if load already raced
  setTimeout(() => { if (bg.naturalWidth > 0 || bg.complete) done(); }, 0);
}

function layoutBoardDecks() {
  const main = document.querySelector("#game.active .col-main");
  const oppB = document.getElementById("oppBoard");
  const myB = document.getElementById("myBoard");
  const oppD = document.getElementById("oppDeck");
  const myD = document.getElementById("myDeck");
  if (!main || !oppB || !myB || !oppD || !myD) return;
  const mr = main.getBoundingClientRect();
  if (mr.width < 8 || mr.height < 8) return;
  const place = (board, deck, edge) => {
    const br = board.getBoundingClientRect();
    const w = Math.max(56, Math.min(84, br.width * 0.11));
    deck.style.position = "absolute";
    // Stage-left (not board-left): board is centered/narrower than parchment
    deck.style.left = Math.max(6, Math.min(18, mr.width * 0.02)) + "px";
    deck.style.width = w + "px";
    deck.style.zIndex = "6";
    deck.style.display = "flex";
    deck.style.flexDirection = "column";
    deck.style.alignItems = "center";
    deck.style.pointerEvents = "none";
    deck.style.margin = "0";
    deck.style.boxSizing = "border-box";
    if (edge === "top") {
      // Opp deck: sit low in opp lane (near unit row), not stuck to top frame
      const pileH = Math.max(96, Math.min(120, br.height * 0.42));
      const topPad = Math.max(8, br.height * 0.52);
      // v0.225: nudge left opp deck pile UP ~20px
      deck.style.top = (br.top - mr.top + topPad - 20) + "px";
      deck.style.bottom = "auto";
      deck.style.height = pileH + "px";
      deck.style.justifyContent = "flex-start";
      deck.style.paddingTop = "0";
      deck.style.paddingBottom = "0";
    } else {
      deck.style.top = "auto";
      // v0.236: ally deck UP ~50px
      deck.style.bottom = (mr.bottom - br.bottom + 4 + 50) + "px";
      deck.style.height = Math.max(90, br.height * 0.85) + "px";
      deck.style.justifyContent = "flex-end";
      deck.style.paddingTop = "0";
      deck.style.paddingBottom = "6px";
    }
  };
  place(oppB, oppD, "top");
  place(myB, myD, "bottom");
}

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
  // HAND LAYOUT LOCK (see LAYOUT_HAND_LOCK.md) — do not shrink below 0.28; negative CSS margin forbidden
  const HAND_ROW_FRAC = 0.28; // LOCKED
  const hand = HAND_ROW_FRAC, hint = 0.015, oppHand = 0.10; // v0.225: larger so backs half-visible
  const rest = 1 - hand - hint - oppHand; // boards total
  // v0.234: equal field lanes (ignore parchment midFrac split)
  const oppBoard = rest / 2;
  const myBoard = rest / 2;
  void midFrac; // retained measurability; equal lanes override mid boundary
  const pct = (x) => (x * 100).toFixed(2) + "%";
  const rows = [oppHand, oppBoard, myBoard, hand, hint].map(pct).join(" ");
  main.style.setProperty("grid-template-rows", rows, "important");
  // Single-column areas (decks are absolute overlays — old 2-col areas skew myBoard)
  main.style.setProperty(
    "grid-template-areas",
    '"opphand" "oppboard" "myboard" "myhand" "hint"',
    "important"
  );
}

function layoutBoardSlots() {
  ["myBoard", "oppBoard"].forEach(id => {
    const board = document.getElementById(id);
    if (!board) return;
    const bh = board.clientHeight || 0;
    const bw = board.clientWidth || 0;
    // Fit up to 5 units in board width; height ~88% of lane
    let slotH = Math.floor(bh * 0.94); // v0.225: field lane a bit taller
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
    mh.innerHTML = me.hand.map(c => renderCard(c, myTurn && current() === me && c.cost <= me.soul && (c.type !== "minion" || me.board.length < 5))).join("");
  }
  document.getElementById("oppBoard").innerHTML = renderLane(opp, "opp");
  const boardDragging = dragging && _drag && _drag.kind === "board";
  if (!boardDragging) {
    document.getElementById("myBoard").innerHTML = renderLane(me, "me");
  }
  document.getElementById("oppBoard").classList.toggle("empty", !opp.board.length);
  document.getElementById("myBoard").classList.toggle("empty", !me.board.length);
  // Board chrome: wait for boardBgLayer natural size, then double-rAF so first paint is correct
  ensureBoardLayouts();

  const oppDeckEl = document.getElementById("oppDeck");
  const myDeckEl = document.getElementById("myDeck");
  if (oppDeckEl) oppDeckEl.innerHTML = renderDeckPile(opp);
  if (myDeckEl) myDeckEl.innerHTML = renderDeckPile(me);
  document.getElementById("oppStrip").innerHTML = heroStrip(opp, false, myTurn);
  document.getElementById("myStrip").innerHTML = heroStrip(me, true, myTurn);
  // Re-seat immediately — strip rebuild would otherwise flash heroes at top-left until rAF
  restoreHudStyles();
  layoutHudChrome();
  updateEndBtn(myTurn);
  const ohr = document.getElementById("oppHeroRow");
  const mhr = document.getElementById("myHeroRow");
  if (ohr) ohr.innerHTML = renderHeroBust(opp, false);
  if (mhr) mhr.innerHTML = renderHeroBust(me, true);
  const om = document.getElementById("oppSoulGem");
  const mm = document.getElementById("mySoulGem");
  if (om) om.textContent = opp.soul + "/" + opp.maxSoul;
  if (mm) mm.textContent = me.soul + "/" + me.maxSoul;
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
        el.onpointerenter = () => showPeek(el, unit);
        el.onpointerleave = hidePeek;
      }
    });
  }
  document.querySelectorAll("#oppBoard .minion").forEach(el => {
    const om = findOn(opp, el.dataset.uid);
    el.onclick = () => onMinionClick(opp, om, "opp");
    el.onpointerenter = (ev) => {
      if (ev && (ev.pointerType === "touch" || ev.pointerType === "pen")) return;
      showPeek(el, om);
    };
    el.onpointerleave = () => { hidePeek(); };
    // Tablet: hold to peek (same #cardPeek); move cancels. No reorder on enemy board.
    if (typeof bindTouchPeekHold === "function") {
      const touch = bindTouchPeekHold(el, om, { capture: false });
      el.onpointerdown = (ev) => { touch.onPointerDown(ev); };
    }
  });

  let hint = "";
  if (ui.targeting) hint = "대상을 선택하세요. 빈 곳 클릭으로 취소.";
  else if (ui.battling) hint = "자동 전투 중…";
  else if (myTurn) hint = "유닛·스펠 모두 전장으로 드래그. 스펠은 전장에 놓는 순간 시전됩니다.";
  else if (current().isAI) hint = "상대가 생각 중…";
  else hint = "상대 턴입니다. (핫시트: 화면을 넘겨 주세요)";
  const hintEl = document.getElementById("hint");
  if (hintEl) {
    hintEl.textContent = hint;
    const logEl = document.getElementById("log");
    if (logEl) {
      const top = Math.round(logEl.offsetTop + logEl.offsetHeight + 6);
      hintEl.style.setProperty("--hint-top", top + "px");
    }
  }
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
  const version = (typeof GAME_VERSION !== "undefined")
    ? GAME_VERSION
    : (typeof window !== "undefined" ? window.GAME_VERSION : "");
  const cacheSrc = (typeof src === "string" && /^assets\//.test(src) && !src.includes("?") && version)
    ? src + "?v=" + version
    : src;
  if (_imgCache[cacheSrc]) return _imgCache[cacheSrc];
  _imgCache[cacheSrc] = new Promise(res => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = cacheSrc;
  });
  return _imgCache[cacheSrc];
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

const _opaqueBBoxByUrl = new Map();
/** Opaque alpha bbox of a frame image/canvas. Cached by urlKey. */
function frameOpaqueBBox(src, urlKey) {
  if (!src) return null;
  if (urlKey && _opaqueBBoxByUrl.has(urlKey)) return _opaqueBBoxByUrl.get(urlKey);
  try {
    const w = src.naturalWidth || src.width;
    const h = src.naturalHeight || src.height;
    if (!w || !h) return null;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(src, 0, 0);
    const data = x.getImageData(0, 0, w, h).data;
    let l = w, t = h, r = 0, b = 0, found = false;
    for (let y = 0; y < h; y++) {
      for (let px = 0; px < w; px++) {
        if (data[(y * w + px) * 4 + 3] > 8) {
          found = true;
          if (px < l) l = px;
          if (px > r) r = px;
          if (y < t) t = y;
          if (y > b) b = y;
        }
      }
    }
    if (!found) {
      const full = { l: 0, t: 0, w, h, pad: false };
      if (urlKey) _opaqueBBoxByUrl.set(urlKey, full);
      return full;
    }
    const bw = r - l + 1, bh = b - t + 1;
    // Significant outer transparent pad (deck_* frames ~8%)
    const pad = (l > w * 0.02) || (t > h * 0.02) || ((w - 1 - r) > w * 0.02) || ((h - 1 - b) > h * 0.02);
    const box = { l, t, w: bw, h: bh, pad };
    if (urlKey) _opaqueBBoxByUrl.set(urlKey, box);
    return box;
  } catch (e) {
    return null;
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
  // Portrait window for deck_* frames (opaque-bbox cropped). Sized to fully cover the
  // transparent art hole so no #1a1008 bars show at top/bottom inside the arch.
  const artX = W * 0.110, artY = H * 0.088, artW = W * 0.780, artH = H * 0.475;
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
      // Unit portrait: shift illustration down ~20px inside art window (position only; scale unchanged)
      if (c.type === "minion") dy += 20;
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
    const FOCUS_X = { e22:0.38, e23:0.40, e24:0.42 };
    // Always cover the portrait hole (uniform scale, never stretch). No artZoom —
    // letterboxing was from contain / undersized hole rect, not from zoom.
    const fx = FOCUS_X[c.id] != null ? FOCUS_X[c.id] : 0.50;
    drawUniform("cover", fx, fy, 1);
    ctx.filter = "none";
    ctx.restore();
  }
  ctx.filter = "none";

  ctx.restore();
  const frame = await loadImg(frameUrl);
  if (frame) {
    const punched = await punchFrame(frame, frameUrl);
    const box = frameOpaqueBBox(punched, frameUrl);
    // Crop wider transparent outer padding so metal silhouette fills the 768x1152 face
    // (JPEG export has no alpha — uncropped pad becomes dark margins and glows sit inset/wrong)
    if (box && box.pad) ctx.drawImage(punched, box.l, box.t, box.w, box.h, 0, 0, W, H);
    else ctx.drawImage(punched, 0, 0, W, H);
  }

  ctx.save();
  ctx.font = "800 " + (Math.round(H*0.042) + 2) + "px 'Noto Sans KR', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(6, H*0.008);
  ctx.strokeStyle = "#120800";
  ctx.strokeText(c.name || "", W*0.50, H*0.590 + 2);
  ctx.fillStyle = "#fff8e8";
  ctx.fillText(c.name || "", W*0.50, H*0.590 + 2);
  ctx.restore();

  // Item/spell frames are distinct — hide top type label. Units still show race/token.
  const headerTxt = (c.type === "minion")
    ? (c.token ? "토큰" : (c.race || (typeof CARD_RACE !== "undefined" && CARD_RACE[c.id]) || ""))
    : "";
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
    ctx.strokeText(headerTxt, W*0.50, H*0.0697 - 3);
    ctx.fillText(headerTxt, W*0.50, H*0.0697 - 3);
    ctx.restore();
  }

  const txt = (c.text && c.text !== "전설" && c.text !== "레전드") ? c.text : (c.type === "spell" ? "주문" : "");
  if (txt) {
    const tSize = Math.round(H*0.037) + 2;
    ctx.save();
    // Per-tribe lore ink matched to parchment luminance (fire is light → dark ink).
    const loreInk = {
      earth: "#2a2014",
      fire: "#2a1810",
      dark: "#e6ddd0",
      water: "#1a2834",
      wind: "#243028",
      light: "#3a3228",
      metal: "#2a2014"
    };
    ctx.fillStyle = loreInk[tribe.id] || loreInk.earth;
    ctx.font = "700 " + tSize + "px 'Noto Sans KR', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const maxW = W * 0.62;
    // v0.234: prefer clause breaks at "、" / ", " so multi-effect text
    // splits between clauses (e.g. "유닛 전체 파괴" / "아군 최대 소울-3"),
    // not mid-clause. Width-wrap only when a single clause still exceeds maxW.
    const widthWrap = (s) => {
      const out = [];
      let line = "";
      for (const ch of s) {
        const test = line + ch;
        if (ctx.measureText(test).width > maxW && line) {
          out.push(line);
          line = ch;
        } else line = test;
      }
      if (line) out.push(line);
      return out;
    };
    const clauses = [];
    let buf = "";
    for (let i = 0; i < txt.length; i++) {
      const ch = txt[i];
      if (ch === "、") {
        if (buf.trim()) clauses.push(buf.trim());
        buf = "";
        continue;
      }
      if (ch === ",") {
        // Clause comma (not digit thousands): ", " or "," before non-digit
        const next = txt[i + 1];
        if (next === " " || next === undefined || (next && !/[0-9]/.test(next))) {
          if (buf.trim()) clauses.push(buf.trim());
          buf = "";
          if (next === " ") i++;
          continue;
        }
      }
      // Sentence/effect break: ". " also starts a new lore line
      if (ch === "." ) {
        const next = txt[i + 1];
        if (next === " " || next === undefined) {
          buf += ch;
          if (buf.trim()) clauses.push(buf.trim());
          buf = "";
          if (next === " ") i++;
          continue;
        }
      }
      buf += ch;
    }
    if (buf.trim()) clauses.push(buf.trim());
    const parts = clauses.length ? clauses : [txt];
    const lines = [];
    for (const clause of parts) {
      if (!clause) continue;
      if (ctx.measureText(clause).width <= maxW) lines.push(clause);
      else lines.push(...widthWrap(clause));
    }
    if (!lines.length && txt) lines.push(txt);
    const lh = tSize * 1.28;
    // v0.237: vertical center of lore panel (~was 0.743, sat too high for 2+ lines)
    const startY = H*0.778 - ((lines.length - 1) * lh) / 2;
    lines.forEach((ln, i) => ctx.fillText(ln, W*0.50, startY + i * lh));
    ctx.restore();
  }

  paintNumber(ctx, String(c.cost ?? 0), W*0.1386, H*0.0996 - 2, Math.round(H*0.070));
  const paintFrameStats = c.type === "minion" || (c.type === "item");
  if (paintFrameStats) {
    const hp = opts.hp != null ? opts.hp : c.hp;
    const atk = opts.atk != null ? opts.atk : c.atk;
    const def = opts.def != null ? opts.def : c.def;
    paintNumber(ctx, String(atk ?? 0), W*0.1343, H*0.9032, Math.round(H*0.066));
    paintNumber(ctx, String(def ?? 0), W*0.5008, H*0.9032, Math.round(H*0.066));
    paintNumber(ctx, String(hp ?? 0), W*0.8745, H*0.9032, Math.round(H*0.066));
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
  const gold = await loadImg((typeof COIN_GOLD !== "undefined" && COIN_GOLD) ? COIN_GOLD : "assets/img/coins/gold.png");
  const black = await loadImg((typeof COIN_BLACK !== "undefined" && COIN_BLACK) ? COIN_BLACK : "assets/img/coins/black.png");
  if (!gold && !black) return;
  // Larger coins (was ~3.9% W); cluster under each gem like 첨부 레퍼런스
  const size = Math.round(W * 0.072 * 0.85 * 0.80); // v0.237: another -20%
  const gap = Math.round(size * 0.08);
  // Vertical overlap between stacked rows (~45% of coin height)
  const rowStep = Math.round(size * 0.55);
  const cyBot = H * 0.978 - 1; // v0.241: up 1px
  const slots = [
    [W * 0.1343, parseCoin(c.atkC)],
    [W * 0.5008, parseCoin(c.defC)],
    [W * 0.8745, parseCoin(c.hpC)]
  ];
  // 1~4: one row; 5: 2/3 (top/bottom)
  function coinRows(n) {
    if (n <= 4) return [n];
    return [2, 3];
  }
  for (const [ax, raw] of slots) {
    if (!raw) continue;
    const img = raw > 0 ? gold : black;
    if (!img) continue;
    const n = Math.min(5, Math.abs(raw | 0));
    const rows = coinRows(n);
    const multi = rows.length > 1;
    // draw bottom → top so upper coins sit slightly in front
    for (let ri = rows.length - 1; ri >= 0; ri--) {
      const count = rows[ri];
      const total = count * size + (count - 1) * gap;
      let x0 = ax - total / 2;
      if (x0 < W * 0.01) x0 = W * 0.01;
      if (x0 + total > W * 0.99) x0 = W * 0.99 - total;
      const cy = multi ? (cyBot - (rows.length - 1 - ri) * rowStep) : cyBot;
      for (let i = 0; i < count; i++) {
        ctx.drawImage(img, x0 + i * (size + gap), cy - size / 2, size, size);
      }
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
  const shield = (c.ability === "보호") || ((c.keywords || []).includes("shield")) ? "sh1" : "sh0";
  const version = (typeof GAME_VERSION !== "undefined")
    ? GAME_VERSION
    : (typeof window !== "undefined" ? window.GAME_VERSION : "");
  return ["v106itemTipText", version, c.id, c.type || "", c.tribe || "", c.cost, c.atk, c.def, c.atkC, c.defC, c.hpC, opts && opts.atk != null ? opts.atk : c.atk, opts && opts.def != null ? opts.def : c.def, opts && opts.hp != null ? opts.hp : c.hp, c.name, c.text || "", c.ability || "", shield, c.itemWorn ? "eq" : "", (c.equippedItem && c.equippedItem.id) || ""].join("|");
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
  if (!n) return;
  const mid = (n - 1) / 2;
  // Desktop lock used -72px; mobile small cards fully stacked with fixed -72.
  // Overlap scales with width, but always leave >=28px visible strip.
  let w = cards[0].offsetWidth || 0;
  if (w < 40) {
    // layout not ready — retry next frame once
    requestAnimationFrame(() => {
      try { layoutHandFan._retrying = false; } catch (e) {}
    });
    if (!layoutHandFan._retrying) {
      layoutHandFan._retrying = true;
      requestAnimationFrame(() => { layoutHandFan._retrying = false; layoutHandFan(); });
    }
    w = 110;
  }
  const overlap = Math.min(Math.round(w * 0.62), Math.max(40, w - 28));
  cards.forEach((el, i) => {
    const t = n <= 1 ? 0 : (i - mid);
    const y = Math.round(Math.abs(t) * 7);
    const rot = (t * 2.4).toFixed(2);
    el.style.setProperty("--fan-x", "0px");
    el.style.setProperty("--fan-y", y + "px");
    el.style.setProperty("--fan-r", rot + "deg");
    el.style.setProperty("margin-left", i ? ("-" + overlap + "px") : "0", "important");
    // Keep transform in CSS so :hover lift can compose with fan vars
    el.style.removeProperty("transform");
    el.style.setProperty("z-index", String(20 + i), "important");
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
    canAtk ? "can-attack" : "",
    selected ? "selected" : "",
    targetable ? "can-target" : "",
  ].join(" ");
  const uid = "mface_" + m.uid;
  // Combat FX: bake temp atk/def/hp on face; ±Δ overlays (blue+/red−), not 「공 N」
  const faceOpts = {
    atk: m._fxAtk != null ? m._fxAtk : m.atk,
    def: m._fxDef != null ? m._fxDef : m.def,
    hp:  m._fxHp  != null ? m._fxHp  : m.hp,
  };
  const cacheKey = faceCacheKey(m, faceOpts);
  const cached = _faceDone.has(cacheKey) ? _faceDone.get(cacheKey) : "";
  setTimeout(() => {
    const el = document.getElementById(uid);
    if (el) faceSrc(m, faceOpts, el);
  }, 0);
  const hurt = m._hurt && m._hurt.dmg ? ` hurt` : "";
  const rip = m.dying ? " rip" : "";
  const tick = m._hurt && m._hurt.dmg ? `<div class="hp-tick">-${m._hurt.dmg}</div>` : "";
  function deltaChip(d, kind) {
    if (!d) return "";
    const cls = d > 0 ? "stat-delta up" : "stat-delta down";
    const txt = d > 0 ? ("+" + d) : String(d);
    return `<div class="${cls} ${kind}">${txt}</div>`;
  }
  const deltas = (m._fxAtk != null || m._fxDef != null || m._fxHp != null)
    ? (deltaChip(m._fxAtkD, "d-atk") + deltaChip(m._fxDefD, "d-def") + deltaChip(m._fxHpD, "d-hp"))
    : "";
  const pending = cached ? "" : " face-pending";
  const srcAttr = cached ? ` src="${cached}"` : "";
  return `<div class="${cls}${hurt}${rip}" data-uid="${m.uid}">
    <img class="card-face${pending}${cached ? " face-ready" : ""}" id="${uid}" alt="${m.name}"${srcAttr}>
    ${tick}${deltas}
  </div>`;
}

function renderDeckPile(p) {
  const hud = (typeof HUD_UI !== "undefined") ? HUD_UI : {};
  const nDeck = p.deck.length;
  const layers = Math.min(6, Math.max(1, Math.ceil(nDeck / 5)));
  let stack = "";
  for (let i = 0; i < layers; i++) {
    stack += `<i class="pile-layer" style="--i:${i};background-image:url('${hud.deck || ""}')"></i>`;
  }
  return `<div class="deck-pile" data-n="${nDeck}">
        <div class="pile-stack">${stack}</div>
        <div class="pile-count">${nDeck}</div>
      </div>`;
}

function heroStrip(p, isMe, myTurn) {
  const { me } = meView();
  let canTarget = false;
  if (ui.targeting) canTarget = ui.targeting.targets.some(t => t.kind === "hero" && t.owner === p);
  if (ui.attacker && !isMe) canTarget = attackTargets(me, ui.attacker).some(t => t.kind === "hero");
  const hero = `<div class="hud-hero">${renderHeroSlot(p, isMe)}</div>`;
  return `<div class="side">${hero}</div>`;
}

/** Seat soul gems, hero portraits, and HP on board-art wells (object-fit:contain content box). */
function layoutHudGems() {
  const bg = document.getElementById("boardBgLayer");
  const main = document.querySelector("#game.active .col-main");
  const hud = document.querySelector("#game.active .col-hud");
  if (!bg || !main || !bg.naturalWidth) return;
  const br = bg.getBoundingClientRect();
  const mr = main.getBoundingClientRect();
  // Keep prior seats if unmeasurable (coin modal / viewport thrash)
  if (br.width < 8 || br.height < 8 || mr.width < 8 || mr.height < 8) return;
  const nw = bg.naturalWidth, nh = bg.naturalHeight;
  const scale = Math.min(br.width / nw, br.height / nh);
  const contentW = nw * scale;
  const contentH = nh * scale;
  if (!(contentW > 8 && contentH > 8)) return;
  const contentLeft = br.left + (br.width - contentW) / 2;
  const contentTop = br.top + (br.height - contentH) / 2;

  function placeIn(el, parentRect, CX, CY, bw, bh) {
    if (!el || !parentRect) return;
    const left = contentLeft + contentW * CX - bw / 2 - parentRect.left;
    const top = contentTop + contentH * CY - bh / 2 - parentRect.top;
    // important: older corner-soul CSS used top/right !important and was pinning gems to the top rail
    el.style.setProperty("left", left + "px", "important");
    el.style.setProperty("top", top + "px", "important");
    el.style.setProperty("width", bw + "px", "important");
    el.style.setProperty("height", bh + "px", "important");
    el.style.setProperty("right", "auto", "important");
    el.style.setProperty("bottom", "auto", "important");
    el.style.setProperty("transform", "none", "important");
  }

  // 4000×3000 board — purple pill gems on right frame rail; hearts at arch BR; arches on right
  const SOUL_W = contentW * 0.055;
  const SOUL_H = Math.max(18, SOUL_W * 0.42);
  placeIn(document.getElementById("oppSoulGem"), mr, 0.828, 0.095, SOUL_W, SOUL_H);
  placeIn(document.getElementById("mySoulGem"), mr, 0.828, 0.841, SOUL_W, SOUL_H);
  // v0.236: soul cost numbers LEFT ~130px total
  ["oppSoulGem", "mySoulGem"].forEach(id => {
    const el = document.getElementById(id);
    if (!el || !el.style.left) return;
    const L = parseFloat(el.style.left);
    if (!Number.isNaN(L)) el.style.setProperty("left", (L - 130) + "px", "important");
  });

  const hr = hud ? hud.getBoundingClientRect() : null;
  if (hr && hr.width >= 8 && hr.height >= 8) {
    const HERO_W = contentW * 0.056; // v0.236: 20% smaller (was 0.070)
    const HERO_H = HERO_W * 1.28;
    const oppHero = document.querySelector("#oppStrip .hud-hero");
    const myHero = document.querySelector("#myStrip .hud-hero");
    placeIn(oppHero, hr, 0.928, 0.275, HERO_W, HERO_H);
    placeIn(myHero, hr, 0.928, 0.635, HERO_W, HERO_H);
    // v0.236: hero icons +15px right
    [oppHero, myHero].forEach(el => {
      if (!el || !el.style.left) return;
      const L = parseFloat(el.style.left);
      if (!Number.isNaN(L)) el.style.setProperty("left", (L + 15) + "px", "important");
    });

    // HP hearts — place relative to hero-slot after heroes are seated
    const HP_W = contentW * 0.032;
    const HP_H = HP_W;
    const hearts = [
      /* v0.219: nudge HP heart slightly left/down toward portrait bottom-left */
      { sel: "#oppStrip .hero-hp", CX: 0.968, CY: 0.348 },
      { sel: "#myStrip .hero-hp", CX: 0.967, CY: 0.708 }
    ];
    hearts.forEach(({ sel, CX, CY }) => {
      const hp = document.querySelector(sel);
      if (!hp) return;
      const slot = hp.closest(".hero-slot") || hp.parentElement;
      if (!slot) return;
      const sr = slot.getBoundingClientRect();
      if (sr.width < 4 || sr.height < 4) return;
      const vx = contentLeft + contentW * CX - HP_W / 2;
      const vy = contentTop + contentH * CY - HP_H / 2;
      // v0.236: hero HP numbers DOWN ~9px and LEFT ~7px
      hp.style.setProperty("left", (vx - sr.left - 7) + "px", "important");
      hp.style.setProperty("top", (vy - sr.top + 9) + "px", "important");
      hp.style.setProperty("width", HP_W + "px", "important");
      hp.style.setProperty("height", HP_H + "px", "important");
      hp.style.setProperty("right", "auto", "important");
      hp.style.setProperty("bottom", "auto", "important");
      hp.style.setProperty("transform", "none", "important");
    });

  }
}

/** Board mid-right end-turn button (single #endBtn in .col-main). */

/** Seat #endBtn on board-art mid-right well (object-fit:contain content box). */
function layoutEndBtn() {
  const btn = document.getElementById("endBtn");
  const bg = document.getElementById("boardBgLayer");
  const main = document.querySelector("#game.active .col-main");
  if (!btn || !bg || !main || !bg.naturalWidth) return;
  const br = bg.getBoundingClientRect();
  const mr = main.getBoundingClientRect();
  // Keep prior seat if metrics are unusable (coin-modal / chrome thrash) — never zero mid-frame
  if (br.width < 8 || br.height < 8 || mr.width < 8 || mr.height < 8) return;
  const nw = bg.naturalWidth, nh = bg.naturalHeight;
  const scale = Math.min(br.width / nw, br.height / nh);
  const contentW = nw * scale;
  const contentH = nh * scale;
  if (!(contentW > 8 && contentH > 8)) return;
  const contentLeft = br.left + (br.width - contentW) / 2;
  const contentTop = br.top + (br.height - contentH) / 2;
  // v0.225: button center = board mid horizontal ∩ right gold-frame vertical edge
  // content-box: CY 0.5 = battlefield center divider; CX ≈ right edge of gold board frame
  const CX = 0.968;
  const CY = 0.500;
  // Final end-turn art is 700×700 transparent PNG — fill the board well as a square
  const WIDTH_FRAC = 0.088;
  const bw = contentW * WIDTH_FRAC;
  const bh = bw;
  const left = contentLeft + contentW * CX - bw / 2 - mr.left;
  const top = contentTop + contentH * CY - bh / 2 - mr.top;
  if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(bw)) return;
  // Reject pathological seats (e.g. top-right over opp hero) from bad parent metrics
  if (top < mr.height * 0.25 || top > mr.height * 0.75) return;
  // v0.236: end-turn LEFT 50, UP 22
  btn.style.left = (left - 50) + "px";
  btn.style.top = (top - 22) + "px";
  btn.style.width = bw + "px";
  btn.style.height = bh + "px";
  btn.style.right = "auto";
  btn.style.bottom = "auto";
  btn.style.transform = "none";
}

function isHandCardPlayable(c, me) {
  return c.cost <= me.soul && (c.type !== "minion" || me.board.length < 5);
}

function endBtnHudSrcs() {
  const hud = (typeof HUD_UI !== "undefined") ? HUD_UI : {};
  return {
    off: hud.endturnOff || "assets/img/hud/endturn_off.png",
    glow: hud.endturnGlow || "assets/img/hud/endturn_glow.png",
    pressed: hud.endturnPressed || "assets/img/hud/endturn_pressed.png",
    v: (typeof GAME_VERSION !== "undefined" ? GAME_VERSION : (window.GAME_VERSION || "0"))
  };
}

function setEndBtnBg(btn, src) {
  if (!btn || !src) return;
  btn.style.backgroundImage = "url('" + src + "?v=" + endBtnHudSrcs().v + "')";
}

function updateEndBtn(myTurn) {
  const btn = document.getElementById("endBtn");
  if (!btn) return;
  const { me } = meView();
  const label = btn.querySelector(".end-btn-label");
  const { off: offSrc, glow: glowSrc, pressed: pressedSrc } = endBtnHudSrcs();
  btn.classList.remove("opp-turn", "my-turn", "glow", "go");
  if (!myTurn) {
    btn.classList.add("opp-turn");
    btn.disabled = true;
    btn._endBtnHolding = false;
    if (label) label.textContent = "상대 턴";
    // opp turn → off plate (disabled)
    btn._endBtnDesiredSrc = offSrc;
    setEndBtnBg(btn, offSrc);
    return;
  }
  const hasPlayable = me.hand.some(c => isHandCardPlayable(c, me));
  btn.disabled = false;
  btn.classList.add("my-turn");
  if (hasPlayable) {
    btn.classList.remove("glow");
  } else {
    btn.classList.add("glow");
  }
  if (label) label.textContent = "턴 종료";
  // my turn + playable → pressed; my turn + none → glow
  const src = hasPlayable ? pressedSrc : glowSrc;
  btn._endBtnDesiredSrc = src;
  // while pointer held, force off plate (visual only)
  setEndBtnBg(btn, btn._endBtnHolding ? offSrc : src);
}

(function bindEndBtnPressVisual() {
  function bind() {
    const btn = document.getElementById("endBtn");
    if (!btn || btn._endBtnPressBound) return;
    btn._endBtnPressBound = true;
    const clearHold = () => {
      if (!btn._endBtnHolding) return;
      btn._endBtnHolding = false;
      setEndBtnBg(btn, btn._endBtnDesiredSrc || endBtnHudSrcs().off);
    };
    // Hit-test by pointer coords (NOT e.target). setPointerCapture makes
    // e.target stay #endBtn even when released outside — that was the drag-off bug.
    const stillOverBtn = (e) => {
      const x = e.clientX, y = e.clientY;
      if (typeof x !== "number" || typeof y !== "number" || Number.isNaN(x) || Number.isNaN(y)) return false;
      const r = btn.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };
    btn.addEventListener("pointerdown", (e) => {
      if (btn.disabled || !btn.classList.contains("my-turn")) return;
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      btn._endBtnHolding = true;
      btn._endBtnArmed = true;
      btn._endBtnPtr = e.pointerId;
      setEndBtnBg(btn, endBtnHudSrcs().off);
      try { btn.setPointerCapture(e.pointerId); } catch (err) {}
    });
    const onUp = (e) => {
      if (btn._endBtnPtr != null && e.pointerId != null && e.pointerId !== btn._endBtnPtr) return;
      const armed = !!btn._endBtnArmed;
      const over = stillOverBtn(e);
      btn._endBtnArmed = false;
      btn._endBtnPtr = null;
      clearHold();
      try { if (e.pointerId != null) btn.releasePointerCapture(e.pointerId); } catch (err) {}
      if (!armed) return;
      if (btn.disabled || !btn.classList.contains("my-turn")) return;
      // Cancel if release point is outside #endBtn bounds
      if (!over) return;
      try { if (typeof Sfx !== "undefined" && Sfx.playTurn) Sfx.playTurn(); } catch (err) {}
      try { if (typeof endTurn === "function") endTurn(); } catch (err) {}
    };
    btn.addEventListener("pointerup", onUp);
    btn.addEventListener("pointercancel", (e) => {
      btn._endBtnArmed = false;
      btn._endBtnPtr = null;
      clearHold();
    });
    // Do NOT clear armed on lostpointercapture before pointerup — some browsers
    // fire lostcapture first; arm is cleared in onUp instead.
    // Window capture as safety if button listener misses
    window.addEventListener("pointerup", (e) => {
      if (!btn._endBtnArmed) return;
      onUp(e);
    }, true);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();


(function bindHandFanResize() {
  let t = 0;
  const kick = () => {
    clearTimeout(t);
    // Debounce: mobile browser chrome / coin-modal can spam resize
    t = setTimeout(() => {
      try {
        layoutHandFan();
        layoutOppFan();
        ensureBoardLayouts(true);
      } catch (e) {}
    }, 120);
  };
  window.addEventListener("resize", kick);
  window.addEventListener("orientationchange", kick);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", kick);
    window.visualViewport.addEventListener("scroll", kick);
  }
})();
