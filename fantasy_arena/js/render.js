
/** v0.327: board art content box (object-fit:contain) narrowed to its 4:3 core.
 *  16:9 art (3840×2160) keeps the original 4:3 board pixel-identical in x 480~3360 → core = centered 4:3 of the content box.
 *  All HUD fractions (CX/CY) were authored against the 4:3 board, so they use this core. 4:3 art → core = whole content. */
function boardCoreBox(bg, br) {
  const nw = bg.naturalWidth, nh = bg.naturalHeight;
  if (!nw || !nh || !br) return null;
  const scale = Math.min(br.width / nw, br.height / nh);
  const contentW = nw * scale, contentH = nh * scale;
  const contentLeft = br.left + (br.width - contentW) / 2;
  const contentTop = br.top + (br.height - contentH) / 2;
  const coreW = Math.min(contentW, contentH * 4 / 3);
  return { left: contentLeft + (contentW - coreW) / 2, top: contentTop, w: coreW, h: contentH };
}
/** v0.328: 보드 배경 확대 배율 (CSS --board-zoom, 기본 1.15). 배경 기준 px 보정값(−170 등)도 같이 곱한다. */
function boardZoom(bg) {
  try {
    const r = bg.getBoundingClientRect();
    const w0 = bg.offsetWidth;
    if (w0 > 8 && r.width > 8) return r.width / w0;
  } catch (e) {}
  return 1;
}

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
  const ids = ["endBtn", "oppSoulGem", "mySoulGem", "oppSoulDraw", "mySoulDraw"];
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
  const bg = document.getElementById("boardBgLayer");
  const oppD = document.getElementById("oppDeck");
  const myD = document.getElementById("myDeck");
  if (!main || !bg || !oppD || !myD || !bg.naturalWidth) return;
  const mr = main.getBoundingClientRect();
  if (mr.width < 8 || mr.height < 8) return;
  const core = boardCoreBox(bg, bg.getBoundingClientRect());
  if (!core || core.w < 8) return;
  // v0.328: 덱 더미는 보드 배경(4:3 코어) 기준 비율로 — 배경 확대(1.15)와 같이 스케일·이동.
  // 값은 v0.327 1920×1080(코어 1440×1080, 확대 없음)에서의 자리: 왼쪽 32px · 상대 덱 top 346 h 238 · 내 덱 top 464 h 324 · 폭 84
  const u = core.h / 1080;
  const DECK_SCALE = 0.9; // v0.351: 덱 더미(스택·숫자) 10% 축소 — 자리·세로 칸은 그대로
  // v0.340: 덱 더미 2배 (폭 84→168, 스택 72×104→144×208, 숫자 13→26px) — 금테 바깥 화면 왼쪽으로
  const place = (deck, top, h, justify) => {
    deck.style.setProperty("position", "absolute", "important");
    deck.style.setProperty("left", Math.max(core.left + core.w * (-62 / 1440), 8) - mr.left + "px", "important");
    deck.style.setProperty("top", (core.top + top * u - mr.top) + "px", "important");
    deck.style.setProperty("bottom", "auto", "important");
    deck.style.setProperty("width", (168 * u) + "px", "important");
    deck.style.setProperty("height", (h * u) + "px", "important");
    deck.style.setProperty("z-index", "6", "important");
    deck.style.setProperty("display", "flex", "important");
    deck.style.setProperty("flex-direction", "column", "important");
    deck.style.setProperty("align-items", "center", "important");
    deck.style.setProperty("justify-content", justify, "important");
    deck.style.setProperty("pointer-events", "none", "important");
    deck.style.setProperty("margin", "0", "important");
    deck.style.setProperty("box-sizing", "border-box", "important");
    deck.style.setProperty("padding-top", "0", "important");
    deck.style.setProperty("padding-bottom", justify === "flex-end" ? (6 * u) + "px" : "0", "important");
    deck.style.setProperty("--deck-u", String(u * DECK_SCALE));
    deck.style.setProperty("--deck-scale", String(DECK_SCALE));
  };
  place(oppD, 262, 262, "flex-start");
  place(myD, 540, 300, "flex-end");
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
  // v0.328: oppHand 0.14→0.105 — 전장 카드 1.44배(높이 ≈0.299H)가 레인 안에 들어가게 (손패 행 0.28은 그대로)
  const hand = HAND_ROW_FRAC, hint = 0.015, oppHand = 0.105;
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

const FIELD_CARD_H_FRAC = 0.299;
function layoutBoardSlots() {
  ["myBoard", "oppBoard"].forEach(id => {
    const board = document.getElementById(id);
    if (!board) return;
    const bh = board.clientHeight || 0;
    const bw = board.clientWidth || 0;
    // v0.328: 전장 카드 = 화면 높이의 29.9% (1080 기준 216×323, v0.327 대비 ≈1.44배 · 사용자 변경안)
    const mainEl = board.closest(".col-main");
    const mh = (mainEl && mainEl.clientHeight) || 0;
    let slotH = mh > 200 ? Math.round(mh * FIELD_CARD_H_FRAC) : Math.floor(bh * 0.94);
    if (!slotH || slotH < 120) slotH = 160;
    let slotW = Math.floor(slotH * 2 / 3);
    // v0.328: 가능한 폭 = col-main의 82% (CSS .board width cap) — 현재 bw로 재면 이전 작은 slot에 묶임
    const availW = (mainEl && mainEl.clientWidth) ? mainEl.clientWidth * 0.82 : bw;
    const maxW = Math.floor((availW - 68) / 5);
    if (maxW > 40 && slotW > maxW) {
      slotW = maxW;
      slotH = Math.floor(slotW * 3 / 2);
    }
    // v0.328: important — 예전 CSS .board { --slot-h: clamp(...) !important }가 JS 값을 덮고 있었음
    board.style.setProperty("--slot-h", slotH + "px", "important");
    board.style.setProperty("--slot-w", slotW + "px", "important");
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
    // v0.317: 올빼미의눈 등 실효 소울을 핸드 카드 숫자에 반영 (비싸지면 빨강 · statColor)
    mh.innerHTML = me.hand.map(c => {
      const eff = handCardCost(c, me);
      const shown = eff !== c.cost ? Object.assign({}, c, { cost: eff }) : c;
      // v0.339: 테두리 = isHandCardPlayable (소울 + 유닛 칸 + 아이템은 장착 가능한 아군 유닛 있음)
      return renderCard(shown, myTurn && current() === me && isHandCardPlayable(c, me));
    }).join("");
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
  updateSoulDrawBtns(me, opp);
  layoutHandFan();
  layoutOppFan();
  if ((me._drewCount || 0) > 0 && !me._drawingAnim) {
    const n = me._drewCount;
    const drawPlaybackRate = me._openingDrawPending ? 1.5 : 1;
    me._openingDrawPending = false;
    me._drewCount = 0;
    me._drawingAnim = true;
    // v0.372: 매치 연출(MATCH START·MY TURN·승패) 중에는 드로우 모션·사운드를 미루고, 새 카드는 그동안 숨김
    me._drawHideN = n;
    requestAnimationFrame(() => {
      (async () => {
        try {
          if (typeof SpellFx !== "undefined" && SpellFx.whenOverlayIdle) await SpellFx.whenOverlayIdle();
        } catch (e) {}
        me._drawHideN = 0;
        try {
          if (typeof playDrawSequence === "function") await playDrawSequence(n, drawPlaybackRate);
          else if (typeof flyDrawCard === "function") await flyDrawCard(undefined, drawPlaybackRate);
        } catch (e) {}
        me._drawingAnim = false;
        if (me._drewCount > 0 && typeof render === "function") render();
      })();
    });
  }
  if (typeof playDrawBurnSequence === "function") playDrawBurnSequence();
  // v0.372: 드로우 대기 중 다시 그려도(render) 아직 날아오지 않은 새 카드는 숨긴 채 (투명도만 · 레이아웃 변화 없음)
  //   playable 카드의 `opacity:1 !important` CSS 를 이기도록 inline important
  if ((me._drawHideN || 0) > 0 && !dragging) {
    const cardsNow = mh.querySelectorAll(".card");
    for (let i = Math.max(0, cardsNow.length - me._drawHideN); i < cardsNow.length; i++) cardsNow[i].style.setProperty("opacity", "0", "important");
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
  else if (myTurn) hint = "유닛·스펠 모두 전장으로 드래그.\n스펠은 전장에 놓는 순간 시전됩니다.";
  else if (current().isAI) hint = "상대가 생각 중…";
  else hint = "상대 턴입니다. (핫시트: 화면을 넘겨 주세요)";
  const hintEl = document.getElementById("hint");
  if (hintEl) {
    hintEl.textContent = hint; // may include \n
    const logEl = document.getElementById("log");
    if (logEl) {
      // v0.340: 로그/힌트 패널을 화면 맨 왼쪽 끝(6px)에 붙임 — 부모 오프셋만큼 음수 left
      const lr = logEl.getBoundingClientRect();
      if (lr.width > 0) {
        const cur = parseFloat(getComputedStyle(logEl).left) || 0;
        const left = Math.round((cur - lr.left + 6) * 10) / 10;
        const g = document.getElementById("game");
        if (g && g.style.getPropertyValue("--edge-left") !== left + "px") g.style.setProperty("--edge-left", left + "px");
      }
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
const STAT_WHITE = "#ffffff";
const STAT_UP = "#3dff3d";
const STAT_DOWN = "#ff3b3b";
function statColor(cur, base, invert) {
  cur = Number(cur) || 0; base = Number(base);
  if (!Number.isFinite(base) || cur === base) return STAT_WHITE;
  const up = cur > base;
  return (invert ? !up : up) ? STAT_UP : STAT_DOWN;
}
function paintNumber(ctx, text, x, y, size, color) {
  ctx.save();
  ctx.font = `900 ${size}px "Noto Sans KR", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = Math.max(4, size*0.18);
  ctx.strokeStyle = "#120800";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color || STAT_WHITE;
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

// Preserve approved single-line seats for stat frames, and the two-line spell seat.
// The shield tip narrows the usable unit/item panel above the full rectangle center.
function descriptionTextStartY(type, height, fontSize, lineCount) {
  const twoLineHeight = fontSize * 1.28 + 1;
  const center = height * 0.778 - (type === "spell" ? 0 : twoLineHeight / 2);
  const lineHeight = fontSize * 1.28 + (lineCount >= 2 ? 1 : 0);
  return center - ((lineCount - 1) * lineHeight) / 2;
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
  // Shared unit/spell/item portrait rect extends below the wavy frame hole troughs.
  const artX = W * 0.110, artY = H * 0.088, artW = W * 0.780, artH = H * 0.490;
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
      dy += 10; // all types: unit/spell/item same
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

  const txt = (c.text && c.text !== "전설") ? c.text : (c.type === "spell" ? "주문" : "");
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
    // v0.256: "소울 4 이상 유닛 전체 공=1 체=1" → prefix / "공=1 체=1"
    // v0.309: "2소울 이하 유닛 전체 파괴" → prefix / "파괴" (소울 접두 분할)
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
    const soulHeadRe = /^((?:소울\s*\d+\s*(?:이상|이하)|\d+\s*소울\s*(?:이상|이하))\s+유닛\s+전체)\s+(.*)$/;
    const soulHeadM = txt.match(soulHeadRe);
    const setStatRe = /^(.*?)\s+((?:공|방|체|코인)=\d+(?:\s*,?\s*(?:공|방|체|코인)=\d+)*)\s*$/;
    const setStatM = txt.match(setStatRe);
    let clauses = [];
    if (soulHeadM && soulHeadM[2] && soulHeadM[2].trim()) {
      clauses.push(soulHeadM[1].trim());
      clauses.push(soulHeadM[2].trim().replace(/\s*,\s*/g, " "));
    } else if (setStatM && setStatM[1].trim()) {
      clauses.push(setStatM[1].trim());
      clauses.push(setStatM[2].trim().replace(/\s*,\s*/g, " "));
    }
    let buf = "";
    if (!clauses.length) for (let i = 0; i < txt.length; i++) {
      const ch = txt[i];
      if (ch === "\n") { // v0.302: 카드 설명 줄바꿈
        if (buf.trim()) clauses.push(buf.trim());
        buf = "";
        continue;
      }
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
    const lh = tSize * 1.28 + (lines.length >= 2 ? 1 : 0); // v0.251: 2+ lines gap +1px
    const startY = descriptionTextStartY(c.type, H, tSize, lines.length);
    lines.forEach((ln, i) => ctx.fillText(ln, W*0.50, startY + i * lh));
    ctx.restore();
  }

  // v0.316: 「보호」 전장 오버레이 — 아트/프레임/텍스트 위, 소울·공/방/체 숫자·배지 아래.
  // opts.fieldShield 는 renderMinion(전장)에서만 켜짐 (핸드/덱/상세/도감은 절대 없음).
  if (opts.fieldShield) await paintProtectOverlay(ctx, W, H);
  // v0.326: 「환생」 전장 오버레이 (1번 불사조 깃털) — 보호 위, 숫자·배지 아래. 환생 소모·침묵 시 사라짐.
  // v0.332: 면역+환생 겹침 시 깃털(불꽃 면적 큼)이 면역 룬을 가리지 않도록 환생을 먼저 그리고 면역을 위에 올린다.
  if (opts.fieldRebirth) await paintRebirthOverlay(ctx, W, H);
  // v0.337: 「아이템 착용중」 장비 배지 (가죽 고리 청동 방패·검, 컨셉 1안) — 보호·환생·면역 위(가장 위). v0.338: 그림 오른쪽 아래.
  // 전장 유닛(renderMinion)에서 equippedItem 있을 때만. 해제·환생(해제)·사망 시 사라짐.
  if (opts.fieldEquip) await paintEquipBadge(ctx, W, H);
  // v0.323: 「면역」 전장 오버레이 (3번 비전 봉인진) — 보호·환생 위, 숫자·배지 아래. renderMinion(전장) 전용.
  if (opts.fieldImmune) await paintImmuneOverlay(ctx, W, H);

  const baseCard = (typeof CARD_MAP !== "undefined" && c && CARD_MAP[c.id]) || null;
  paintNumber(ctx, String(c.cost ?? 0), W*0.1386, H*0.0996 - 2, Math.round(H*0.070) + 12,
    baseCard ? statColor(c.cost, baseCard.cost, true) : STAT_WHITE);
  const paintFrameStats = c.type === "minion" || (c.type === "item");
  if (paintFrameStats) {
    const hp = opts.hp != null ? opts.hp : c.hp;
    const atk = opts.atk != null ? opts.atk : c.atk;
    const def = opts.def != null ? opts.def : c.def;
    paintNumber(ctx, String(atk ?? 0), W*0.1343, H*0.9032, Math.round(H*0.066) + 12, baseCard ? statColor(atk, baseCard.atk) : STAT_WHITE);
    paintNumber(ctx, String(def ?? 0), W*0.5008, H*0.9032, Math.round(H*0.066) + 12, baseCard ? statColor(def, baseCard.def) : STAT_WHITE);
    paintNumber(ctx, String(hp ?? 0), W*0.8745, H*0.9032, Math.round(H*0.066) + 12, baseCard ? statColor(hp, baseCard.hp) : STAT_WHITE);
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
let PROTECT_OVERLAY_BLEND = "source-over"; // v0.316: normal — screen washed out on light/gold frames
const PROTECT_OVERLAY_SRC = "assets/img/fx/protect_overlay.webp?v=0.316";
/** Live shield state (same rule the engine uses to consume a hit in game.js damage path). */
function unitHasActiveShield(m) {
  if (!m) return false;
  return String(m.ability || "").split(",").map(x => x.trim()).includes("보호") || (m.keywords || []).includes("shield");
}
let IMMUNE_OVERLAY_BLEND = "source-over"; // v0.323
const IMMUNE_OVERLAY_SRC = "assets/img/fx/immune_overlay.webp?v=0.323";
/** Live immune state (same rule as isImmune() in game.js; silence clears ability+keywords). */
function unitHasActiveImmune(m) {
  if (!m) return false;
  return String(m.ability || "").split(",").map(x => x.trim()).includes("면역") || (m.keywords || []).includes("immune");
}
async function paintImmuneOverlay(ctx, W, H) {
  // 상단 중앙 룬 원이 종족 헤더(H*0.0697) 글자를 덮지 않도록 타원형 소프트 홀 추가
  return paintFieldOverlay(ctx, W, H, IMMUNE_OVERLAY_SRC,
    (typeof window !== "undefined" && window.IMMUNE_OVERLAY_BLEND) || IMMUNE_OVERLAY_BLEND,
    [[W * 0.50, H * 0.0660, W * 0.17, H * 0.034, 0.85]]);
}
let REBIRTH_OVERLAY_BLEND = "source-over"; // v0.326
const REBIRTH_OVERLAY_SRC = "assets/img/fx/rebirth_overlay.webp?v=0.326";
/** Live unused-rebirth state (same rule as resolveDeath hasRebirth in game.js; consumed/silenced → false). */
function unitHasActiveRebirth(m) {
  if (!m) return false;
  return (m.ability != null && String(m.ability).includes("환생")) || (m.keywords || []).includes("rebirth");
}
async function paintRebirthOverlay(ctx, W, H) {
  return paintFieldOverlay(ctx, W, H, REBIRTH_OVERLAY_SRC,
    (typeof window !== "undefined" && window.REBIRTH_OVERLAY_BLEND) || REBIRTH_OVERLAY_BLEND,
    [[W * 0.50, H * 0.0660, W * 0.17, H * 0.034, 0.85]]);
}
async function paintProtectOverlay(ctx, W, H) {
  return paintFieldOverlay(ctx, W, H, PROTECT_OVERLAY_SRC,
    (typeof window !== "undefined" && window.PROTECT_OVERLAY_BLEND) || PROTECT_OVERLAY_BLEND);
}
/* v0.337 장비 배지: 768×1152 전장 카드 비율 오버레이에서 배지 영역만 잘라낸 에셋 (원본 158×306).
 * v0.338: 효과 문구를 가리지 않게 카드 그림 오른쪽 아래(이름 띠 바로 위)로 이동, 원본의 75% 크기.
 * 카드 W/H 비율 기준 박스 — 오른쪽 끝 0.89W, 아래 끝 0.565H. */
const EQUIP_BADGE_SRC = "assets/img/fx/equip_badge.webp?v=0.337";
const EQUIP_BADGE_SCALE = 0.75;
const EQUIP_BADGE_BOX = (() => {
  const w = 158 / 768 * EQUIP_BADGE_SCALE, h = 306 / 1152 * EQUIP_BADGE_SCALE;
  return { x: 0.89 - w, y: 0.565 - h, w, h };
})();
async function paintEquipBadge(ctx, W, H) {
  const img = await loadImg(EQUIP_BADGE_SRC);
  if (!img) return;
  const b = EQUIP_BADGE_BOX;
  ctx.save();
  ctx.drawImage(img, W * b.x, H * b.y, W * b.w, H * b.h);
  ctx.restore();
}
async function paintFieldOverlay(ctx, W, H, src, blend, ellipseHoles) {
  const img = await loadImg(src);
  if (!img) return;
  // Offscreen: overlay minus soft holes over the soul-cost gem and ATK/DEF/HP gems,
  // so badges + numbers stay fully readable (numbers are painted afterwards).
  const oc = document.createElement("canvas");
  oc.width = W; oc.height = H;
  const o = oc.getContext("2d");
  o.drawImage(img, 0, 0, W, H);
  o.globalCompositeOperation = "destination-out";
  const holes = [
    [W * 0.1386, H * 0.0996, W * 0.115],
    [W * 0.1343, H * 0.9032, W * 0.108],
    [W * 0.5008, H * 0.9032, W * 0.108],
    [W * 0.8745, H * 0.9032, W * 0.108],
  ];
  for (const [x, y, r] of holes) {
    const g = o.createRadialGradient(x, y, r * 0.55, x, y, r);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    o.fillStyle = g;
    o.beginPath(); o.arc(x, y, r, 0, Math.PI * 2); o.fill();
  }
  for (const [x, y, rx, ry, k] of (ellipseHoles || [])) {
    o.save();
    o.translate(x, y); o.scale(1, ry / rx);
    const g = o.createRadialGradient(0, 0, rx * 0.5, 0, 0, rx);
    g.addColorStop(0, `rgba(0,0,0,${k})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    o.fillStyle = g;
    o.beginPath(); o.arc(0, 0, rx, 0, Math.PI * 2); o.fill();
    o.restore();
  }
  ctx.save();
  ctx.globalCompositeOperation = blend || "source-over";
  ctx.drawImage(oc, 0, 0);
  ctx.restore();
}
/** v0.322: 얼굴에 그릴 코인 링크 — effectiveCoinLinks(game.js)가 있으면 그것, 없으면 인쇄값 */
function coinLinksForFace(c) {
  if (typeof effectiveCoinLinks === "function") {
    const e = effectiveCoinLinks(c);
    return { atkC: e.atkC | 0, defC: e.defC | 0, hpC: e.hpC | 0 };
  }
  return { atkC: parseCoin(c.atkC), defC: parseCoin(c.defC), hpC: parseCoin(c.hpC) };
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
  const cyBot = H * 0.978 - 2; // v0.244: up 1 more
  // v0.322: 전장 유닛은 장착 코인 아이템을 반영한 실제 링크 (조작된주화 → 골드 등). 코인 판정과 같은 함수.
  const L = coinLinksForFace(c);
  const slots = [
    [W * 0.1343, L.atkC],
    [W * 0.5008, L.defC],
    [W * 0.8745, L.hpC]
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
      let cy = multi ? (cyBot - (rows.length - 1 - ri) * rowStep) : cyBot;
      // 5 coins: top row (behind 2) +1px up to slightly open the gap
      if (multi && n === 5 && ri === 0) cy -= 2; // v0.250: +1 more gap
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
  const shield = (String(c.ability || "").split(",").map(x => x.trim()).includes("보호")) || ((c.keywords || []).includes("shield")) ? "sh1" : "sh0";
  const version = (typeof GAME_VERSION !== "undefined")
    ? GAME_VERSION
    : (typeof window !== "undefined" ? window.GAME_VERSION : "");
  const fsh = opts && opts.fieldShield ? "fsh1" : "fsh0";
  const fim = opts && opts.fieldImmune ? "fim1" : "fim0";
  const frb = opts && opts.fieldRebirth ? "frb1" : "frb0";
  const feq = opts && opts.fieldEquip ? "feq1" : "feq0";
  return ["v107statColor", version, fsh, fim, frb, feq, c.id, c.type || "", c.tribe || "", c.cost, c.atk, c.def, c.atkC, c.defC, c.hpC, (() => { const L = coinLinksForFace(c); return "ec" + L.atkC + "," + L.defC + "," + L.hpC; })(), c._itemFx || "", opts && opts.atk != null ? opts.atk : c.atk, opts && opts.def != null ? opts.def : c.def, opts && opts.hp != null ? opts.hp : c.hp, c.name, c.text || "", c.ability || "", shield, c.itemWorn ? "eq" : "", (c.equippedItem && c.equippedItem.id) || ""].join("|");
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
  if (!n) return;
  const mid = (n - 1) / 2;
  let w = cards[0].offsetWidth || 0;
  if (w < 24) {
    if (!layoutOppFan._retrying) {
      layoutOppFan._retrying = true;
      requestAnimationFrame(() => { layoutOppFan._retrying = false; layoutOppFan(); });
    }
    w = 48;
  }
  // Mirror of ally fan: same overlap/arc, opposite side (edges up, origin top)
  const overlap = Math.min(Math.round(w * 0.62), Math.max(24, w - 16));
  cards.forEach((el, i) => {
    const t = n <= 1 ? 0 : (i - mid);
    const y = Math.round(Math.abs(t) * 7); // edges go UP
    const rot = (-t * 2.4).toFixed(2); // mirrored rotation vs ally
    el.style.setProperty("transform-origin", "top center", "important");
    el.style.setProperty(
      "transform",
      "translateY(" + (-y) + "px) rotate(" + rot + "deg)",
      "important"
    );
    el.style.setProperty("margin-left", i ? ("-" + overlap + "px") : "0", "important");
    el.style.setProperty("z-index", String(5 + i), "important");
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

/** v0.381: 전장 카드 얼굴 옵션 (renderMinion · 전설 소환 연출의 히트 시점 얼굴 교체 공용) */
function minionFaceOpts(m) {
  return {
    atk: m._fxAtk != null ? m._fxAtk : m.atk,
    def: m._fxDef != null ? m._fxDef : m.def,
    hp: m.hp, // HP coins already live on m; always include later damage/healing.
    // v0.316: 전장 유닛 현재 보호막 상태로만 오버레이 (인쇄 텍스트 X)
    fieldShield: unitHasActiveShield(m),
    // v0.323: 전장 유닛 현재 면역 상태 (침묵 등으로 잃으면 사라짐)
    fieldImmune: unitHasActiveImmune(m),
    // v0.326: 전장 유닛 미사용 환생 (아이템 모래시계·피닉스깃털·소생초 포함, 소모·침묵 시 사라짐)
    fieldRebirth: unitHasActiveRebirth(m),
    // v0.337: 아이템 착용중 장비 배지 (전장 전용)
    fieldEquip: !!m.equippedItem,
  };
}
/** v0.381: 얼굴 미리 합성 (캐시만) */
function warmMinionFace(m) {
  const v = (typeof fxDisplayUnit === "function") ? fxDisplayUnit(m) : m;
  return faceSrc(v, minionFaceOpts(v), null);
}
/** v0.381: DOM을 다시 만들지 않고 그 전장 카드 얼굴만 현재 상태로 교체 */
function refreshMinionFace(m) {
  const el = document.getElementById("mface_" + m.uid);
  const v = (typeof fxDisplayUnit === "function") ? fxDisplayUnit(m) : m;
  return faceSrc(v, minionFaceOpts(v), el || null);
}

function renderMinion(m, side) {
  const liveUnit = m;
  // v0.381 전설 소환 연출: 히트 전까지 이전 표시(문구·능력)로 — 로직 상태는 그대로
  if (typeof fxDisplayUnit === "function") m = fxDisplayUnit(m);
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
  // Combat FX: bake temp atk/def/hp on face; ±Δ overlays ABOVE gems (blue+/red−), not 「공 N」
  const faceOpts = minionFaceOpts(m);
  const cacheKey = faceCacheKey(m, faceOpts);
  const cached = _faceDone.has(cacheKey) ? _faceDone.get(cacheKey) : "";
  setTimeout(() => {
    const el = document.getElementById(uid);
    if (el) faceSrc(m, faceOpts, el);
  }, 0);
  const hurt = m._hurt && m._hurt.dmg ? ` hurt` : "";
  const rip = m.dying ? " " + (typeof combatDeathClass === 'function' ? combatDeathClass(m) : 'rip') : "";
  const tick = damageNumberHtml(liveUnit);
  const deltas = combatStatDeltaHtml(liveUnit);
  const pending = cached ? "" : " face-pending";
  const srcAttr = cached ? ` src="${cached}"` : "";
  // v0.318: 이번 턴에 굴린 코인 결과 (앞면 H/N) — 카드 위쪽 가장자리 작은 배지, 클릭 통과
  const tr = (typeof storedTurnCoins === "function") ? storedTurnCoins(m) : null;
  const turnCoin = (tr && tr.n > 0)
    ? `<div class="turn-coin${tr.heads > 0 ? " has-heads" : ""}" title="이번 턴 코인: 앞면 ${tr.heads}/${tr.n}"><i class="tc-g"></i>${tr.heads}<span>/${tr.n}</span></div>`
    : "";
  return `<div class="${cls}${hurt}${rip}" data-uid="${m.uid}">
    <img class="card-face${pending}${cached ? " face-ready" : ""}" id="${uid}" alt="${m.name}"${srcAttr}>
    ${tick}${deltas}${turnCoin}
  </div>`;
}

function renderDeckPile(p) {
  const hud = (typeof HUD_UI !== "undefined") ? HUD_UI : {};
  const nDeck = p.deck.length;
  const layers = Math.min(6, Math.max(0, Math.ceil(nDeck / 5)));
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
  const core = boardCoreBox(bg, br);
  if (!core) return;
  const contentW = core.w;
  const contentH = core.h;
  if (!(contentW > 8 && contentH > 8)) return;
  const contentLeft = core.left;
  const contentTop = core.top;
  const Z = boardZoom(bg); // v0.328: 배경 확대만큼 px 보정값도 확대

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

  // Digit seats measured in board_169.jpg (3840×2160); its 4:3 core is x=480..3360.
  // Use art coordinates for every resolution, rather than viewport-pixel nudges.
  const SOUL_W = contentW * 0.055;
  const SOUL_H = SOUL_W * 0.42;
  placeIn(document.getElementById("oppSoulGem"), mr, (2812 - 480) / 2880, 200 / 2160, SOUL_W, SOUL_H);
  placeIn(document.getElementById("mySoulGem"), mr, (2812 - 480) / 2880, 1813 / 2160, SOUL_W, SOUL_H);
  ["oppSoulGem", "mySoulGem"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.setProperty("font-size", (contentH * 40 / 2160).toFixed(2) + "px", "important");
  });
  // v0.321 소울 드로우 버튼 (~92px @1280×800, v0.319의 2배) → v0.324 보이는 판 ~46px (요소 ~62px, 왼쪽 위 기준 동일 위치). 내 버튼: 소울 표시 바로 아래(핸드 10장 오른쪽 끝 바깥 · 5번째 유닛 칸 아래).
  // 소울 표시 왼쪽은 핸드 10장 오른쪽 카드와, 위쪽은 5번째 유닛 칸과 겹쳐 빈 자리가 없다. 상대 버튼: 상대 소울 왼쪽, 비율 축소.
  // v0.351: 내 버튼은 10% 크게 · 자리는 내 영웅 초상 바로 아래 (영웅 자리 잡은 뒤 아래에서 다시 옮김)
  const SOUL_DRAW_MY_SCALE = 1.1;
  [["mySoulDraw", "mySoulGem", SOUL_DRAW_MY_SCALE, "below"], ["oppSoulDraw", "oppSoulGem", 0.6, "left"]].forEach(([bid, gid, k, mode]) => {
    const b = document.getElementById(bid);
    const g = document.getElementById(gid);
    if (!b || !g || !g.style.left) return;
    const gl = parseFloat(g.style.left), gt = parseFloat(g.style.top);
    if (Number.isNaN(gl) || Number.isNaN(gt)) return;
    // v0.324: 3상태 아트(판 지름 757/1024) — 보이는 판이 v0.321 버튼(~92px)의 절반(~46px)이 되도록 요소 크기 = 이전 × 0.5 ÷ (757/1024)
    const D = Math.round(Math.max(60 * Z, SOUL_W * 1.56) * k * 0.5 / SOUL_DRAW_PLATE_FRAC);
    // 보이는 소울 숫자(텍스트) 기준으로 붙인다 — #…SoulGem 상자는 숫자보다 넓다
    let textL = null, textCY = null, textB = null;
    try {
      const tn = g.firstChild;
      if (tn && document.createRange) {
        const rg = document.createRange(); rg.selectNodeContents(g);
        const tr = rg.getBoundingClientRect();
        if (tr && tr.width > 2) { textL = tr.left - mr.left; textCY = tr.top + tr.height / 2 - mr.top; textB = tr.bottom - mr.top; }
      }
    } catch (e) {}
    let left, top;
    if (mode === "below") {
      // 소울 알약 왼쪽 끝(숫자 왼쪽 −8px)에 맞춰 바로 아래
      left = (textL != null ? textL : gl) - 8 * Z;
      top = (textB != null ? textB : gt + SOUL_H) + 6 * Z;
    } else {
      left = (textL != null ? textL : gl) - D - 3;
      top = (textCY != null ? textCY : gt + SOUL_H / 2) - D / 2;
    }
    b.style.setProperty("left", left + "px", "important");
    b.style.setProperty("top", top + "px", "important");
    b.style.setProperty("width", D + "px", "important");
    b.style.setProperty("height", D + "px", "important");
    b.style.setProperty("right", "auto", "important");
    b.style.setProperty("bottom", "auto", "important");
  });
  // v0.326: 버튼 크기가 바뀌면 숫자(소울 표시와 같은 CSS 크기)를 다시 그림
  ["mySoulDraw", "oppSoulDraw"].forEach(bid => {
    const b = document.getElementById(bid);
    const cv = b && b.querySelector("canvas.sd-cost");
    if (cv && cv._txt != null) { try { paintSoulDrawCost(b, cv._txt); } catch (e) {} }
  });

  const hr = hud ? hud.getBoundingClientRect() : null;
  if (hr && hr.width >= 8 && hr.height >= 8) {
    const HERO_W = contentW * 0.056; // v0.236: 20% smaller (was 0.070)
    const HERO_H = HERO_W * 1.28;
    const oppHero = document.querySelector("#oppStrip .hud-hero");
    const myHero = document.querySelector("#myStrip .hud-hero");
    // Arch centers in board_169.jpg; art coordinates scale with every viewport.
    const HERO_CX = (3186 - 480) / 2880;
    placeIn(oppHero, hr, HERO_CX, 0.275, HERO_W, HERO_H);
    placeIn(myHero, hr, HERO_CX, 0.635, HERO_W, HERO_H);
    // v0.351: 소울 드로우(내 버튼) — 내 영웅 초상 바로 아래 가운데
    const sdb = document.getElementById("mySoulDraw");
    if (sdb && myHero && sdb.style.width) {
      const hb = myHero.getBoundingClientRect();
      const D = parseFloat(sdb.style.width) || 0;
      if (hb.width > 4 && D > 4) {
        sdb.style.setProperty("left", (hb.left + hb.width / 2 - D / 2 - mr.left) + "px", "important");
        // 영웅 아치 테두리·체력 하트 아래 (보드 아트 기준 세로 0.80 — 금테 아치 끝)
        const archBottom = contentTop + contentH * 0.80 - mr.top;
        sdb.style.setProperty("top", Math.max(hb.bottom - mr.top + 4 * Z, archBottom) + "px", "important");
      }
    }

    // HP hearts — place relative to hero-slot after heroes are seated
    const HP_W = contentW * 0.032;
    const HP_H = HP_W;
    const hearts = [
      { sel: "#oppStrip .hero-hp", CX: (3264 - 480) / 2880, CY: 774 / 2160 },
      { sel: "#myStrip .hero-hp", CX: (3260 - 480) / 2880, CY: 1552 / 2160 }
    ];
    hearts.forEach(({ sel, CX, CY }) => {
      const hp = document.querySelector(sel);
      if (!hp) return;
      const slot = hp.closest(".hero-slot") || hp.parentElement;
      if (!slot) return;
      const sr = slot.getBoundingClientRect();
      if (sr.width < 4 || sr.height < 4) return;
      placeIn(hp, sr, CX, CY, HP_W, HP_H);
      hp.style.setProperty("font-size", (contentH * 40 / 2160).toFixed(2) + "px", "important");
    });

  }
}

/** v0.324 소울 드로우 3상태 버튼 (endBtn과 같은 방식: idle / hold(누르는 중) / used).
 *  내 버튼: 클릭 · 상대 버튼: 표시만(항상 used 아트). 세 아트는 윤곽이 같아 교체 시 흔들리지 않는다. */
const SOUL_DRAW_SRCS = {
  idle: "assets/img/ui/soul_draw_idle.webp",
  hold: "assets/img/ui/soul_draw_hold.webp",
  used: "assets/img/ui/soul_draw_used.webp",
};
/** 판(plate) 지름 / 캔버스 (1024 기준 757px) — 버튼 크기 계산용 */
const SOUL_DRAW_PLATE_FRAC = 757 / 1024;
/** 아이콘(1024 기준)의 소울 보석 중심·평면 반지름 · 숫자 글자 크기 — 아이콘 교체 시 여기만 맞춘다 */
const SOUL_DRAW_GEM = { cx: 282, cy: 216, r: 117, font: 158 };
function soulDrawSrc(kind) {
  const v = (typeof GAME_VERSION !== "undefined") ? GAME_VERSION : "";
  return (SOUL_DRAW_SRCS[kind] || SOUL_DRAW_SRCS.idle) + "?v=" + v;
}
function setSoulDrawArt(btn, kind) {
  if (!btn) return;
  const img = btn.querySelector("img.sd-icon");
  if (!img) return;
  const src = soulDrawSrc(kind);
  if (img.getAttribute("src") !== src) img.setAttribute("src", src);
  btn.dataset.sdArt = kind;
  const cv = btn.querySelector("canvas.sd-cost");
  if (cv) cv.classList.toggle("dim", kind === "used");
}
function paintSoulDrawCost(btn, cost) {
  const cv = btn && btn.querySelector("canvas.sd-cost");
  if (!cv) return;
  const txt = String(cost != null ? cost : (typeof SOUL_DRAW_COST !== "undefined" ? SOUL_DRAW_COST : 3));
  // v0.326: 숫자 크기 = 위 소울 표시(#mySoulGem 「10/10」)의 실제 CSS 글자 크기. 상대 버튼은 버튼 크기 비율만큼.
  const { cssPx, btnW } = soulDrawNumberCssPx(btn);
  const key = txt + "|" + cssPx.toFixed(2) + "|" + btnW.toFixed(1);
  if (cv._painted && cv._key === key) return;   // v0.321: 비용 값·크기가 바뀌면 다시 그림
  cv._txt = txt;
  cv._key = key;
  // 캔버스 = 아이콘 전체(1024 기준 좌표 비율). 보석 중심 (282,216)
  const S = 256;
  cv.width = S; cv.height = S;
  const c2 = cv.getContext && cv.getContext("2d");
  if (!c2) return;
  const G = SOUL_DRAW_GEM;
  const cx = S * G.cx / 1024, cy = S * G.cy / 1024;
  // 버튼 폭(btnW CSS px)에 canvas S가 늘어나므로 canvas 글자 = cssPx × S / btnW (측정 불가 시 158@1024)
  let size = btnW > 4 ? Math.round(cssPx * S / btnW) : Math.round(S * G.font / 1024);
  // 두 자리 숫자만 너무 넓으면 축소 (보석 테두리 조금 넘는 것은 허용)
  // 카드 소울 숫자와 같은 글꼴·색 (900 Noto Sans KR · #120800 외곽선 · 흰색), 외곽선만 얇게
  c2.clearRect(0, 0, S, S);
  c2.save();
  const setFont = () => { c2.font = `900 ${size}px "Noto Sans KR", Arial, sans-serif`; };
  setFont();
  try {
    const maxW = S * G.r * 2.9 / 1024;
    const w = c2.measureText(txt).width;
    if (w > maxW) { size = Math.max(8, Math.floor(size * maxW / w)); setFont(); }
  } catch (e) {}
  c2.textAlign = "center";
  // actualBoundingBox metrics are relative to the current baseline. Measure and
  // draw in alphabetic mode so the glyph's ink, not its line box, is centered.
  c2.textBaseline = "alphabetic";
  c2.lineJoin = "round";
  c2.lineWidth = Math.max(2, size * 0.10);
  c2.strokeStyle = "#120800";
  // Center the visible numeral vertically within the gem.
  let dy = 0;
  try { const m = c2.measureText(txt); if (m.actualBoundingBoxAscent != null) dy = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2; } catch (e) {}
  c2.textBaseline = dy ? "alphabetic" : "middle";
  const yy = dy ? cy + dy : cy;
  c2.strokeText(txt, cx, yy);
  c2.fillStyle = STAT_WHITE;
  c2.fillText(txt, cx, yy);
  c2.restore();
  cv._painted = true;
}
/** 소울 드로우 숫자 CSS 크기: 내 버튼 = 내 소울 표시 글자 크기, 상대 버튼 = 그 × (상대 버튼 폭 / 내 버튼 폭). */
function soulDrawNumberCssPx(btn) {
  let base = 16;
  try {
    const g = document.getElementById("mySoulGem");
    const f = g ? parseFloat(getComputedStyle(g).fontSize) : NaN;
    if (f > 4) base = f;
  } catch (e) {}
  let btnW = 0, myW = 0;
  try {
    btnW = btn.getBoundingClientRect().width || parseFloat(btn.style.width) || 0;
    const mb = document.getElementById("mySoulDraw");
    myW = mb ? (mb.getBoundingClientRect().width || parseFloat(mb.style.width) || 0) : 0;
  } catch (e) {}
  const k = (btn && btn.id !== "mySoulDraw" && myW > 4 && btnW > 4) ? btnW / myW : 1;
  return { cssPx: base * k, btnW };
}
function initSoulDrawBtn(btn, clickable) {
  if (!btn || btn._sdInit) return;
  btn._sdInit = true;
  btn.innerHTML = `<img class="sd-icon" src="${soulDrawSrc(clickable ? "idle" : "used")}" alt="" draggable="false"><canvas class="sd-cost" aria-hidden="true"></canvas>`;
  // 3상태 아트 미리 로드 (누르는 순간 깜빡임 방지)
  try { Object.keys(SOUL_DRAW_SRCS).forEach(k => { const im = new Image(); im.src = soulDrawSrc(k); }); } catch (e) {}
  paintSoulDrawCost(btn);
  // 웹폰트 로드 후 다시 그림 (첫 그림이 Arial 대체 글꼴일 수 있음)
  try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { const cv = btn.querySelector("canvas.sd-cost"); if (cv) { cv._painted = false; paintSoulDrawCost(btn, cv._txt); } }); } catch (e) {}
  if (clickable) bindSoulDrawPress(btn);
}
/** endBtn(bindEndBtnPressVisual)과 같은 누름 처리: pointerdown → hold 아트, 떼거나 벗어나면 복원.
 *  떼는 위치는 e.target이 아니라 좌표로 판정 (setPointerCapture 때문에 밖에서 떼도 target이 버튼 → 드래그-오프 버그). */
function bindSoulDrawPress(btn) {
  if (!btn || btn._sdPressBound) return;
  btn._sdPressBound = true;
  // v0.332: 키보드 포커스 제외 (Tab으로 못 잡고, Space/Enter 오발동 없음)
  btn.tabIndex = -1;
  const clearHold = () => {
    if (!btn._sdHolding) return;
    btn._sdHolding = false;
    setSoulDrawArt(btn, btn._sdDesired || "used");
  };
  const stillOverBtn = (e) => {
    const x = e.clientX, y = e.clientY;
    if (typeof x !== "number" || typeof y !== "number" || Number.isNaN(x) || Number.isNaN(y)) return false;
    const r = btn.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };
  btn.addEventListener("pointerdown", (e) => {
    if (btn.disabled || btn._sdDesired !== "idle") return;
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    btn._sdHolding = true;
    btn._sdArmed = true;
    btn._sdPtr = e.pointerId;
    setSoulDrawArt(btn, "hold");
    try { btn.setPointerCapture(e.pointerId); } catch (err) {}
  });
  const onUp = (e) => {
    if (btn._sdPtr != null && e.pointerId != null && e.pointerId !== btn._sdPtr) return;
    const armed = !!btn._sdArmed;
    const over = stillOverBtn(e);
    btn._sdArmed = false;
    btn._sdPtr = null;
    clearHold();
    try { if (e.pointerId != null) btn.releasePointerCapture(e.pointerId); } catch (err) {}
    try { btn.blur(); } catch (err) {}   // v0.332: 포커스가 남아 Space/Enter로 재발동하지 않게
    if (!armed || !over) return;          // 버튼 밖에서 떼면 취소
    if (btn.disabled || btn._sdDesired !== "idle") return;
    btn._sdFiredAt = Date.now();
    if (typeof onSoulDrawClick === "function") onSoulDrawClick();
  };
  btn.addEventListener("pointerup", onUp);
  btn.addEventListener("pointercancel", () => { btn._sdArmed = false; btn._sdPtr = null; clearHold(); });
  // 포인터가 버튼 밖으로 나가면 hold 아트만 해제 (떼기 판정은 onUp 좌표로)
  btn.addEventListener("pointerleave", (e) => { if (!btn._sdArmed) clearHold(); else if (!stillOverBtn(e)) { btn._sdHolding = false; setSoulDrawArt(btn, btn._sdDesired || "used"); } });
  btn.addEventListener("pointerenter", (e) => { if (btn._sdArmed && stillOverBtn(e)) { btn._sdHolding = true; setSoulDrawArt(btn, "hold"); } });
  window.addEventListener("pointerup", (e) => { if (btn._sdArmed) onUp(e); }, true);
  // 마우스/터치는 pointerup에서만 발동. click은 #game 클릭 핸들러로 번지지 않게만 막는다.
  // v0.332: 키보드(Enter/Space → click detail 0) 발동 경로 제거 — 카드 드래그 소환 후 Space로 3소울 드로우되던 버그.
  btn.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); });
  btn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") { e.preventDefault(); e.stopPropagation(); }
  });
}
/* v0.353: 내 소울 드로우 툴팁 + 호버 강조.
 * disabled 버튼은 마우스 이벤트를 안 받을 수 있어 window pointermove 좌표로 판정한다. */
function soulDrawTipInfo() {
  let me = null;
  try { me = meView().me; } catch (e) {}
  const cost = (typeof soulDrawCost === "function") ? soulDrawCost(me) : 3;
  let why = "";
  try {
    if (!state || state.over || !me) why = "";
    else if (me.isAI || (typeof current === "function" && current() !== me)) why = "내 턴이 아닙니다";
    else if (me._soulDrawUsed) why = "이번 턴에 이미 사용했습니다";
    else if ((me.soul | 0) < cost) why = `소울 부족 (${me.soul | 0}/${cost})`;
    else if (state.busy || (typeof ui !== "undefined" && ui && ui.battling)) why = "진행 중에는 사용할 수 없습니다";
  } catch (e) {}
  return { title: "카드 드로우", desc: `${cost}소울을 내고 카드 1장을 드로우합니다.`, why };
}
function placeSoulDrawTip(tip, btn) {
  const r = btn.getBoundingClientRect();
  const vw = window.innerWidth || 1920, vh = window.innerHeight || 1080;
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  const gap = 10;
  // 기본: 버튼 왼쪽, 아래 끝을 버튼 아래 끝에 맞춰 위로 펼침
  let left = r.left - gap - tw;
  let top = r.bottom - th;
  if (left < 8) { left = Math.max(8, r.left + r.width / 2 - tw / 2); top = r.top - gap - th; } // 왼쪽 자리 없으면 위쪽
  left = Math.min(Math.max(8, left), vw - tw - 8);
  top = Math.min(Math.max(8, top), vh - th - 8);
  tip.style.left = Math.round(left) + "px";
  tip.style.top = Math.round(top) + "px";
}
function bindSoulDrawTip() {
  if (window._sdTipBound) return;
  window._sdTipBound = true;
  let tip = null, on = false;
  const ensure = () => {
    if (!tip) {
      tip = document.createElement("div");
      tip.id = "soulDrawTip";
      tip.setAttribute("role", "tooltip");
      document.body.appendChild(tip);
    }
    return tip;
  };
  const hide = () => {
    if (!on) return;
    on = false;
    const b = document.getElementById("mySoulDraw");
    if (b) b.classList.remove("sd-hover");
    if (tip) tip.classList.remove("show");
  };
  const show = (b) => {
    const t = ensure();
    const info = soulDrawTipInfo();
    const html = `<div class="peek-tip"><b>${info.title}</b><span>${info.desc}</span>`
      + (info.why ? `<span class="sd-tip-why">${info.why}</span>` : "") + `</div>`;
    if (t._html !== html) { t.innerHTML = html; t._html = html; }
    b.classList.add("sd-hover");
    t.classList.add("show");
    placeSoulDrawTip(t, b);
    on = true;
  };
  window._soulDrawTipRefresh = () => { if (on) { const b = document.getElementById("mySoulDraw"); if (b) show(b); } };
  window.addEventListener("pointermove", (e) => {
    if (e.pointerType && e.pointerType !== "mouse") return; // 터치: 툴팁 없음
    const b = document.getElementById("mySoulDraw");
    const g = document.getElementById("game");
    if (!b || !g || !g.classList.contains("active") || b.offsetParent === null) { hide(); return; }
    if (document.body.classList.contains("dragging-card")) { hide(); return; }
    const r = b.getBoundingClientRect();
    // 확대(1.08) 전 원래 크기 기준으로 판정 — 가장자리에서 깜빡임 방지
    const k = b.classList.contains("sd-hover") ? 1.08 : 1;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hw = r.width / 2 / k * (on ? 1.04 : 1), hh = r.height / 2 / k * (on ? 1.04 : 1);
    const inside = Math.abs(e.clientX - cx) <= hw && Math.abs(e.clientY - cy) <= hh;
    if (inside) show(b); else hide();
  }, { passive: true });
  window.addEventListener("blur", hide);
  document.addEventListener("pointerleave", hide);
}
function updateSoulDrawBtns(me, opp) {
  const mb = document.getElementById("mySoulDraw");
  const ob = document.getElementById("oppSoulDraw");
  initSoulDrawBtn(mb, true);
  initSoulDrawBtn(ob, false);
  bindSoulDrawTip();
  const costOf = (p) => (typeof soulDrawCost === "function") ? soulDrawCost(p) : 3;
  if (mb) {
    paintSoulDrawCost(mb, costOf(me));
    // v0.353: 브라우저 기본 title 툴팁 대신 #soulDrawTip (겹쳐 뜨지 않게 title 비움)
    if (mb.title) mb.title = "";
    mb.setAttribute("aria-label", `카드 드로우: ${costOf(me)}소울을 내고 카드 1장을 드로우합니다.`);
  }
  if (ob) paintSoulDrawCost(ob, costOf(opp));
  if (mb) {
    // canSoulDraw: 내 턴 · 이번 턴 미사용 · 소울 충분 → idle, 아니면 used (상대 턴 포함)
    const can = typeof canSoulDraw === "function" && !me.isAI && canSoulDraw(me);
    mb.disabled = !can;
    mb.classList.toggle("used", !can);
    mb.classList.toggle("ready", can);
    mb._sdDesired = can ? "idle" : "used";
    if (!can) { mb._sdHolding = false; mb._sdArmed = false; }
    setSoulDrawArt(mb, mb._sdHolding ? "hold" : mb._sdDesired);
  }
  if (ob) {
    // 상대 버튼은 표시만 — 항상 used 아트
    ob.classList.add("used");
    ob.classList.toggle("ready", typeof canSoulDraw === "function" && canSoulDraw(opp));
    ob._sdDesired = "used";
    setSoulDrawArt(ob, "used");
  }  try { window._soulDrawTipRefresh && window._soulDrawTipRefresh(); } catch (e) {}
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
  const core = boardCoreBox(bg, br);
  if (!core) return;
  const contentW = core.w;
  const contentH = core.h;
  if (!(contentW > 8 && contentH > 8)) return;
  const contentLeft = core.left;
  const contentTop = core.top;
  // Measured right gold rail / central table divider in board_169.jpg.
  // Anchor the button center to the artwork, with no viewport-pixel offsets.
  const CX = (3030 - 480) / 2880;
  const CY = 1012 / 2160;
  // Final end-turn art is 700×700 transparent PNG — fill the board well as a square
  const WIDTH_FRAC = 0.088;
  const bw = contentW * WIDTH_FRAC;
  const bh = bw;
  const left = contentLeft + contentW * CX - bw / 2 - mr.left;
  const top = contentTop + contentH * CY - bh / 2 - mr.top;
  if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(bw)) return;
  // Reject pathological seats (e.g. top-right over opp hero) from bad parent metrics
  if (top < mr.height * 0.25 || top > mr.height * 0.75) return;
  btn.style.left = left + "px";
  btn.style.top = top + "px";
  btn.style.width = bw + "px";
  btn.style.height = bh + "px";
  btn.style.right = "auto";
  btn.style.bottom = "auto";
  btn.style.transform = "none";
}

function handCardCost(c, me) {
  return (typeof effectiveCardCost === "function") ? effectiveCardCost(me, c) : c.cost;
}
function isHandCardPlayable(c, me) {
  if (handCardCost(c, me) > me.soul) return false;
  if (c.type === "minion" && me.board.length >= 5) return false;
  // v0.339: 장착 아이템은 아직 아이템 없는 아군 유닛이 1개 이상일 때만 (game.js itemHasEquipTarget = 실제 장착 대상 판정)
  if (c.type === "item" && typeof itemHasEquipTarget === "function" && !itemHasEquipTarget(me, c)) return false;
  return true;
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
  btn.classList.remove("opp-turn", "my-turn", "glow", "go", "end-pending");
  btn.setAttribute("aria-busy", "false");
  btn.classList.toggle("holding", !!(myTurn && btn._endBtnHolding));
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
  if (state.endTurnRequest) {
    btn.classList.add("my-turn", "end-pending", "holding");
    btn.disabled = true;
    btn._endBtnHolding = false;
    btn.setAttribute("aria-busy", "true");
    if (label) label.textContent = state.endTurnRequest.phase === "waiting" ? "종료 대기" : "종료 중";
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
  if (label) label.textContent = state.endTurnError ? "종료 재시도" : "턴 종료";
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
    btn.tabIndex = -1; // v0.332: 키보드 포커스/Space·Enter 오발동 방지 (턴 종료는 마우스 누름+뗌만)
    const clearHold = () => {
      btn.classList.remove("holding");
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
      btn.classList.add("holding"); // v0.351: 누름 글자색
      setEndBtnBg(btn, endBtnHudSrcs().off);
      try { btn.setPointerCapture(e.pointerId); } catch (err) {}
    });
    const onUp = (e) => {
      if (btn._endBtnPtr != null && e.pointerId != null && e.pointerId !== btn._endBtnPtr) return;
      const armed = !!btn._endBtnArmed;
      if (!armed) return; // window capture may already have accepted this same release
      const over = stillOverBtn(e);
      btn._endBtnArmed = false;
      btn._endBtnPtr = null;
      clearHold();
      try { if (e.pointerId != null) btn.releasePointerCapture(e.pointerId); } catch (err) {}
      try { btn.blur(); } catch (err) {}
      if (btn.disabled || !btn.classList.contains("my-turn")) return;
      // Cancel if release point is outside #endBtn bounds
      if (!over) return;
      try { if (typeof endTurn === "function" && endTurn() && typeof Sfx !== "undefined" && Sfx.playTurn) Sfx.playTurn(); } catch (err) {}
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
