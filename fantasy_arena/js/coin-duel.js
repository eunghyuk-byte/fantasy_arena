/**
 * v0.369 코인 듀얼 v3 B2 (사용자 픽스) — 실제 전장 위 오버레이, 손 없음.
 * 규칙 출처: assets/vfx/coin_duel/README_B2.md · meta.json (v3/B README 포함)
 *  - dim RGB(8,6,10) 0.55, 0.12s 선형 인, 끝 0.16s 아웃 (전장 위 · 카드·코인 아래)
 *  - 왼쪽 전장 안쪽에 두 카드(위=상대, 아래=나) 실제 카드 렌더, 각 카드 오른쪽에 코인 0~5개
 *  - 배치는 보드 틀 안쪽 사각형을 실시간 측정해 B2 비율 적용 (코인 5개가 safe_right 안, 넘치면 카드 높이 먼저 축소)
 *  - 시작 0.04+0.03i(+0~12ms), late 코인 1개, 마지막 착지+0.28 유지 → 0.16 페이드
 *  - 사운드: 코인별 -6·log10(n) dB ±1.2dB, ±0.6반음, 3개 이상이면 rattle은 late+무작위 2개
 *  - 결과는 실제 판정(flips)과 동일: 앞(true)=금 heads, 뒤(false)=검정 tails
 *  - Safari(VP9 알파 불가): coin.webm 대신 sheet.webp(192px 셀 스프라이트) · sfx는 ogg 실패 시 mp3
 */
const CoinDuel = (() => {
  const BASE = "assets/vfx/coin_duel/";
  // 1920×1080 실측: 보드 코어(배경 3840×2160 · 1.15 확대) = left 132, top -72.9, 1656×1242.
  // README 안쪽 사각형 x 324-1581, y 58-949 · safe_right 1540 을 코어 비율로 저장 → 어떤 화면에서도 실시간 환산
  const INNER_FRAC = { x0: (324 - 132) / 1656, x1: (1581 - 132) / 1656, y0: (58 + 72.9) / 1242, y1: (949 + 72.9) / 1242 };
  const SAFE_RIGHT_FRAC = (1540 - 132) / 1656;
  const L = { cardH: 0.432, margin: 0.045, coinD: 0.30, pitch: 0.36, pitchMin: 0.33, first: 0.24, halfCanvas: 0.33 };
  const T = { first: 0.04, stagger: 0.03, jitter: 0.012, hold: 0.28, outro: 0.16, dimIn: 0.12 };
  const DIM = { rgb: [8, 6, 10], alpha: 0.55 };
  const CYCLE = ["v1", "v2", "v3"];
  const SND = { k: -6, gainJitter: 1.2, pitchJitter: 0.6, maxExtraRattles: 2, refLufs: -17.85 };
  const CANVAS = 352, ANCHOR = 176, REST = 160, FPS = 30;

  /** late 코인: 코인이 더 많은 줄(같으면 아래), n≤3 → n-1, n≥4 → n//2+1 */
  function pickLate(nTop, nBot) {
    if (!nTop && !nBot) return null;
    const side = nBot >= nTop ? "bottom" : "top";
    const n = Math.max(nTop, nBot);
    return { side, idx: n <= 3 ? n - 1 : Math.floor(n / 2) + 1 };
  }
  /** 코인 계획: top/bottom = 실제 판정 flips 배열 (true=앞=금) */
  function planCoins(top, bottom, coinsMeta, rnd) {
    rnd = rnd || Math.random;
    const late = pickLate(top.length, bottom.length);
    const coins = [];
    [["top", top], ["bottom", bottom]].forEach(([side, flips]) => {
      flips.forEach((h, i) => {
        const isLate = !!late && late.side === side && late.idx === i;
        const variant = isLate ? "late" : CYCLE[(i + (side === "top" ? 1 : 0)) % CYCLE.length];
        const name = (h ? "heads" : "tails") + "_" + variant;
        const m = coinsMeta[name];
        const start = T.first + T.stagger * i + rnd() * T.jitter;
        coins.push({ side, idx: i, heads: !!h, variant, name, late: isLate, start,
          impact: start + m.events.impact[0], settle: start + m.tSettle, meta: m });
      });
    });
    const lastSettle = coins.reduce((a, c) => Math.max(a, c.settle), 0);
    return { coins, lastSettle, outroStart: lastSettle + T.hold, total: lastSettle + T.hold + T.outro };
  }
  /** 사운드 계획 (각 코인 timing.json 이벤트 + 코인 시작 오프셋) */
  function planSound(coins, rnd) {
    rnd = rnd || Math.random;
    const n = coins.length;
    const others = coins.filter(c => !c.late);
    let rattlers = coins.filter(c => c.late);
    if (n > 2) {
      const sh = others.slice();
      for (let i = sh.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = sh[i]; sh[i] = sh[j]; sh[j] = t; }
      rattlers = rattlers.concat(sh.slice(0, SND.maxExtraRattles));
    } else rattlers = rattlers.concat(others);
    const ev = [];
    coins.forEach(c => {
      const gainDb = SND.k * Math.log10(Math.max(n, 1)) + (rnd() * 2 - 1) * SND.gainJitter;
      const st = (rnd() * 2 - 1) * SND.pitchJitter;
      const rate = Math.pow(2, st / 12);
      const E = c.meta.events;
      const pick3 = () => 1 + Math.min(2, Math.floor(rnd() * 3));
      ev.push({ t: c.start + E.impact[0], key: "coin_impact_" + pick3(), gainDb, rate, coin: c.name });
      ev.push({ t: c.start + E.slowmo[0] + 0.01, key: c.late ? "coin_slowmo_late" : "coin_slowmo", gainDb, rate, coin: c.name });
      ev.push({ t: c.start + E.impact2[0], key: "coin_impact2_" + pick3(), gainDb, rate, coin: c.name });
      if (rattlers.indexOf(c) >= 0) ev.push({ t: c.start + E.rattle[0], key: c.late ? "coin_rattle_late" : "coin_rattle", gainDb, rate, coin: c.name });
    });
    return ev.sort((a, b) => a.t - b.t);
  }
  /** 전체 볼륨 보정: 게임 원음 합계 -20.1(1v1)~-18.3(5v5) LUFS → 레퍼런스 -17.85 LUFS (리미터 버스) */
  function busGainDb(n) {
    const raw = -20.1 + 1.8 * Math.log10(Math.max(1, n) / 2) / Math.log10(5);
    return Math.max(0, Math.min(4, SND.refLufs - raw));
  }
  /** 배치: core = 보드 코어 박스, endRect = 턴 종료 버튼 rect, maxCoins = 가장 긴 줄 */
  function computeLayout(core, endRect, maxCoins) {
    const x0 = core.left + core.w * INNER_FRAC.x0, x1 = core.left + core.w * INNER_FRAC.x1;
    const y0 = core.top + core.h * INNER_FRAC.y0, y1 = core.top + core.h * INNER_FRAC.y1;
    const Hin = y1 - y0;
    let safe = core.left + core.w * SAFE_RIGHT_FRAC;
    if (endRect && endRect.width > 4) safe = Math.min(safe, endRect.left - 8);
    const margin = L.margin * Hin;
    const cardX = x0 + margin;
    const n = Math.max(5, maxCoins || 0);
    let cardH = L.cardH * Hin, pitchK = L.pitch;
    const extent = (h, k) => cardX + h * (2 / 3 + L.first + (n - 1) * k + L.halfCanvas);
    // 넘치면 카드 높이 먼저 축소 (피치는 기본값 유지). 그래도 안 되면(카드가 너무 작아지면) 피치 0.33
    if (extent(cardH, pitchK) > safe) {
      const h1 = (safe - cardX) / (2 / 3 + L.first + (n - 1) * pitchK + L.halfCanvas);
      if (h1 >= cardH * 0.7) cardH = h1;
      else { pitchK = L.pitchMin; cardH = Math.min(cardH, (safe - cardX) / (2 / 3 + L.first + (n - 1) * pitchK + L.halfCanvas)); }
    }
    const cardW = cardH * 2 / 3;
    const top = { x: cardX, y: y0 + margin, w: cardW, h: cardH };
    const bottom = { x: cardX, y: y1 - margin - cardH, w: cardW, h: cardH };
    return {
      inner: { x0, y0, x1, y1, w: x1 - x0, h: Hin }, safe, cardH, cardW, top, bottom,
      D: L.coinD * cardH, pitch: pitchK * cardH, pitchK, firstX: cardX + cardW + L.first * cardH,
      scale: (L.coinD * cardH) / REST, rowY: { top: top.y + cardH / 2, bottom: bottom.y + cardH / 2 },
      right: extent(cardH, pitchK)
    };
  }
  function measure(maxCoins) {
    let core = null;
    try {
      const bg = document.getElementById("boardBgLayer");
      if (bg && bg.naturalWidth && typeof boardCoreBox === "function") core = boardCoreBox(bg, bg.getBoundingClientRect());
    } catch (e) {}
    if (!core || !(core.w > 50)) {
      // 보드를 못 재면 1920×1080 기준값을 화면 크기로 환산
      const vw = window.innerWidth || 1920, vh = window.innerHeight || 1080;
      const u = Math.min(vw / 1920, vh / 1080);
      core = { left: (vw - 1920 * u) / 2 + 132 * u, top: (vh - 1080 * u) / 2 - 72.9 * u, w: 1656 * u, h: 1242 * u };
    }
    let endRect = null;
    try { const e = document.getElementById("endBtn"); if (e && e.offsetParent !== null) endRect = e.getBoundingClientRect(); } catch (e) {}
    return computeLayout(core, endRect, maxCoins);
  }

  // ─── 에셋 로드 ───
  const ver = () => (window.GAME_VERSION || "0");
  let _coins = null, _loadP = null;
  const _src = {}, _sheet = {}, _buf = {};
  function useSheets() {
    try { if (typeof SpellFx !== "undefined" && SpellFx.needsSafariFallback) return !!SpellFx.needsSafariFallback(); } catch (e) {}
    return false;
  }
  function preload() {
    if (_loadP) return _loadP;
    _loadP = (async () => {
      const r = await fetch(BASE + "coins.json?v=" + ver(), { cache: "no-cache" });
      if (!r.ok) throw new Error("coins.json");
      _coins = await r.json();
      const sheets = useSheets();
      const names = Object.keys(_coins.coins);
      await Promise.all(names.map(async n => {
        const url = BASE + "coins/" + n + "/" + (sheets ? _coins.sheet.file : "coin.webm") + "?v=" + ver();
        if (sheets) {
          const img = new Image();
          img.decoding = "async";
          img.src = url;
          try { await img.decode(); } catch (e) {}
          _sheet[n] = img;
        } else {
          try {
            const res = await fetch(url, { cache: "force-cache" });
            _src[n] = res.ok ? URL.createObjectURL(await res.blob()) : url;
          } catch (e) { _src[n] = url; }
        }
      }));
      if (typeof Sfx !== "undefined" && Sfx.loadUrl) {
        await Promise.all(Object.keys(_coins.sfx).map(async k => {
          const stem = BASE + "sfx/" + _coins.sfx[k];
          let b = await Sfx.loadUrl(stem + ".ogg?v=" + ver());
          if (!b) b = await Sfx.loadUrl(stem + ".mp3?v=" + ver());
          _buf[k] = b;
        }));
      }
      return true;
    })().catch(() => { _loadP = null; return false; });
    return _loadP;
  }

  // ─── 재생 ───
  const sleep = ms => new Promise(r => setTimeout(r, Math.max(0, ms)));
  function ensureLayer() {
    let el = document.getElementById("coinDuel");
    if (!el) {
      el = document.createElement("div");
      el.id = "coinDuel";
      document.body.appendChild(el);
    }
    el.innerHTML = "";
    el.style.opacity = "1";
    el.style.transition = "none";
    return el;
  }
  function faceFor(side) {
    const u = side && side.unit;
    if (!u) return Promise.resolve("");
    try {
      const img = document.querySelector('.minion[data-uid="' + u.uid + '"] img.card-face');
      if (img && img.src && img.classList.contains("face-ready")) return Promise.resolve(img.src);
    } catch (e) {}
    try {
      if (typeof faceSrc === "function") {
        const opts = { atk: u.atk, def: u.def, hp: side.hpPre != null ? side.hpPre : u.hp };
        return Promise.race([faceSrc(u, opts).then(s => s || ""), sleep(400).then(() => "")]);
      }
    } catch (e) {}
    return Promise.resolve("");
  }
  function waitReady(v, ms) {
    return new Promise(res => {
      if (v.readyState >= 3) { res(true); return; }
      let done = false;
      const fin = ok => { if (done) return; done = true; v.removeEventListener("canplay", h); v.removeEventListener("error", e2); res(ok); };
      const h = () => fin(true), e2 = () => fin(false);
      v.addEventListener("canplay", h); v.addEventListener("error", e2);
      setTimeout(() => fin(false), ms);
    });
  }
  let _playing = null;

  /**
   * spec = { top: {unit, hpPre, flips, detail} | null, bottom: {...} | null, confirm: bool }
   * 반환 Promise<boolean> — false면 재생 못 함(호출 쪽이 예전 코인 창으로 대체)
   */
  async function play(spec) {
    const ok = await Promise.race([preload(), sleep(1500).then(() => false)]);
    if (!ok || !_coins) return false;
    const topFlips = (spec.top && spec.top.flips) || [];
    const botFlips = (spec.bottom && spec.bottom.flips) || [];
    if (!topFlips.length && !botFlips.length) return false;
    const sheets = useSheets();
    const g = measure(Math.max(topFlips.length, botFlips.length));
    const layer = ensureLayer();
    const token = {};
    _playing = token;

    const dim = document.createElement("div");
    dim.className = "cd-dim";
    dim.style.background = "rgb(" + DIM.rgb.join(",") + ")";
    layer.appendChild(dim);

    const faces = await Promise.all([faceFor(spec.top), faceFor(spec.bottom)]);
    const cardEls = [];
    [["top", spec.top, faces[0]], ["bottom", spec.bottom, faces[1]]].forEach(([side, s, src]) => {
      if (!s || !s.unit) return;
      const box = g[side];
      const c = document.createElement("div");
      c.className = "cd-card cd-" + side;
      c.style.cssText = `left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px;`;
      if (src) c.innerHTML = `<img alt="" src="${src}">`;
      else c.innerHTML = `<div class="cd-card-stub">${(s.unit.name || "")}</div>`;
      layer.appendChild(c);
      cardEls.push(c);
    });

    const plan = planCoins(topFlips, botFlips, _coins.coins);
    const cs = CANVAS * g.scale;
    const coinEls = plan.coins.map(c => {
      const cx = g.firstX + c.idx * g.pitch;
      const cy = g.rowY[c.side];
      let el;
      if (!sheets) {
        el = document.createElement("video");
        el.muted = true; el.defaultMuted = true; el.playsInline = true;
        el.setAttribute("muted", ""); el.setAttribute("playsinline", "");
        el.preload = "auto";
        el.src = _src[c.name];
      } else {
        el = document.createElement("div");
        const img = _sheet[c.name];
        const cols = _coins.sheet.cols, rows = Math.ceil(c.meta.frames / cols);
        el.style.backgroundImage = `url("${img ? img.src : ""}")`;
        el.style.backgroundSize = `${cols * cs}px ${rows * cs}px`;
        el.style.backgroundRepeat = "no-repeat";
        el._cols = cols;
      }
      el.className = "cd-coin";
      el.style.cssText += `left:${cx - ANCHOR * g.scale}px;top:${cy - ANCHOR * g.scale}px;width:${cs}px;height:${cs}px;visibility:hidden;z-index:3;`;
      layer.appendChild(el);
      return el;
    });
    if (!sheets) await Promise.all(coinEls.map(v => { try { v.load(); } catch (e) {} return waitReady(v, 450); }));
    if (_playing !== token) return true;

    // t0: dim·카드 인, 사운드 예약, 코인 시작
    const t0 = performance.now();
    const n = plan.coins.length;
    const log = (window._coinDuelLog = window._coinDuelLog || []);
    log.push({ ev: "t0", wall: performance.timeOrigin + t0, n, top: topFlips.map(h => h ? "G" : "B").join(""), bottom: botFlips.map(h => h ? "G" : "B").join(""), layout: { cardH: g.cardH, firstX: g.firstX, pitch: g.pitch, right: g.right, safe: g.safe, top: g.top, bottom: g.bottom }, coins: plan.coins.map(c => ({ name: c.name, side: c.side, start: +c.start.toFixed(3), settle: +c.settle.toFixed(3) })), total: plan.total, sheets });
    try {
      if (typeof Sfx !== "undefined" && Sfx.playBuf && Sfx.makeBus) {
        const bus = Sfx.makeBus(busGainDb(n), true);
        const busDb = busGainDb(n);
        planSound(plan.coins).forEach(e => {
          const b = _buf[e.key];
          if (!b) return;
          Sfx.playBuf(b, { when: e.t, gain: Math.pow(10, e.gainDb / 20), rate: e.rate, dest: bus });
          log.push({ ev: "sfx", key: e.key, file: _coins.sfx[e.key], t: +e.t.toFixed(4), gainDb: +(e.gainDb + busDb).toFixed(2), rate: +e.rate.toFixed(4), wall: performance.timeOrigin + t0 + e.t * 1000 });
        });
      }
    } catch (e) {}
    requestAnimationFrame(() => {
      dim.style.transition = `opacity ${T.dimIn * 1000}ms linear`;
      dim.style.opacity = String(DIM.alpha);
      cardEls.forEach(c => { c.style.transition = `opacity ${T.dimIn * 1000}ms linear`; c.style.opacity = "1"; });
    });
    plan.coins.forEach((c, i) => {
      const el = coinEls[i];
      setTimeout(() => {
        if (_playing !== token) return;
        el.style.visibility = "visible";
        if (!sheets) { try { const p = el.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
      }, c.start * 1000);
      // 공중 코인은 착지한 코인 위에: 첫 충돌(impact) 후 한 단계 아래로
      setTimeout(() => { el.style.zIndex = "2"; }, c.impact * 1000);
    });
    let raf = 0;
    if (sheets) {
      const step = () => {
        const t = (performance.now() - t0) / 1000;
        plan.coins.forEach((c, i) => {
          const el = coinEls[i];
          const f = Math.max(0, Math.min(c.meta.frames - 1, Math.floor((t - c.start) * FPS)));
          const col = f % el._cols, row = Math.floor(f / el._cols);
          el.style.backgroundPosition = `${-col * cs}px ${-row * cs}px`;
        });
        if (t < plan.total + 0.1 && _playing === token) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }
    await sleep(plan.outroStart * 1000 - (performance.now() - t0));

    if (spec.confirm && _playing === token) {
      // 베타: OK를 눌러야 진행 (window.BETA_COIN_CONFIRM) — 결과를 그대로 보여준 채 대기
      await new Promise(res => {
        [["top", spec.top], ["bottom", spec.bottom]].forEach(([side, s]) => {
          if (!s || !s.detail || !(s.flips && s.flips.length)) return;
          const d = document.createElement("div");
          d.className = "cd-detail";
          d.style.cssText = `left:${g.firstX - g.D / 2}px;top:${g.rowY[side] + g.D * 0.62}px;font-size:${Math.max(12, g.cardH * 0.05)}px;`;
          d.innerHTML = s.detail;
          layer.appendChild(d);
        });
        const b = document.createElement("button");
        b.className = "menu-btn cd-ok";
        b.id = "coinOk";
        b.textContent = "OK";
        b.style.cssText = `left:${g.firstX - g.D / 2}px;top:${(g.top.y + g.top.h + g.bottom.y) / 2}px;`;
        b.onclick = () => res();
        layer.appendChild(b);
      });
    }
    layer.style.transition = `opacity ${T.outro * 1000}ms linear`;
    layer.style.opacity = "0";
    await sleep(T.outro * 1000 + 20);
    if (raf) cancelAnimationFrame(raf);
    if (_playing === token) {
      layer.innerHTML = "";
      layer.style.transition = "none";
      layer.style.opacity = "1";
      _playing = null;
    }
    log.push({ ev: "end", wall: performance.timeOrigin + performance.now() });
    return true;
  }

  return { play, preload, planCoins, planSound, pickLate, computeLayout, busGainDb, measure, INNER_FRAC, SAFE_RIGHT_FRAC, L, T, DIM };
})();
window.CoinDuel = CoinDuel;
