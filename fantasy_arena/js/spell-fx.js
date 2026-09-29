const SpellFx = (() => {
  const T = {
    in: 280,
    hold: 720,
    out: 240,
    vfx: 1500,
    fade: 360
  };
  T.show = T.in + T.hold;
  T.vfxAt = T.show + T.out;
  T.total = T.vfxAt + T.vfx + T.fade;

  const ELEM = {
    fire: { fill: ["#fff2c8", "#ffb040", "#ff6a18", "#e22a08"], veil: "rgba(90,18,0,.5)", glow: "#ff6a18" },
    water: { fill: ["#e8fbff", "#8ad8ff", "#3a98e8", "#1458b8"], veil: "rgba(6,28,70,.5)", glow: "#3a98e8" },
    wind: { fill: ["#f4fff8", "#c8f0e0", "#6ec8b0", "#2a8878"], veil: "rgba(8,40,36,.42)", glow: "#6ec8b0" },
    earth: { fill: ["#f0e0b8", "#d0a060", "#8a5a28", "#4a3010"], veil: "rgba(40,22,6,.5)", glow: "#b8864a" },
    light: { fill: ["#fffef8", "#ffe8a0", "#f0c848", "#e0a020"], veil: "rgba(50,40,8,.38)", glow: "#ffe08a" },
    dark: { fill: ["#f0e0ff", "#b878e0", "#6828a8", "#280848"], veil: "rgba(18,4,32,.58)", glow: "#8a40c8" },
  };
  ELEM["불"] = ELEM.fire; ELEM["물"] = ELEM.water; ELEM["바람"] = ELEM.wind;
  ELEM["땅"] = ELEM.earth; ELEM["빛"] = ELEM.light; ELEM["암흑"] = ELEM.dark;

  const KIND_BASE = {
    spells: "assets/vfx/spells/",
    combat: "assets/vfx/combat/",
    ui: "assets/vfx/ui/",
    coins: "assets/vfx/coins/",
    items: "assets/vfx/items/",
    match: "assets/vfx/match/"
  };
  const ASSET_BASE = KIND_BASE.spells;
  const _metaCache = {};
  function packBase(kind, id) {
    const root = KIND_BASE[kind] || ("assets/vfx/" + kind + "/");
    return root + id + "/";
  }
  async function loadPackMeta(kind, id) {
    if (!id) return null;
    const key = (kind || "spells") + "/" + id;
    if (_metaCache[key] !== undefined) return _metaCache[key];
    try {
      const res = await fetch(packBase(kind, id) + "meta.json", { cache: "no-store" });
      if (!res.ok) { _metaCache[key] = null; return null; }
      const meta = await res.json();
      _metaCache[key] = meta;
      return meta;
    } catch (e) {
      _metaCache[key] = null;
      return null;
    }
  }
  async function loadSpellMeta(id) {
    return loadPackMeta("spells", id);
  }
  function boardCenterPoint() {
    const board = document.getElementById("myBoard")
      || document.querySelector(".board:not(.opp)")
      || document.querySelector(".board")
      || document.getElementById("game");
    if (board) {
      const r = board.getBoundingClientRect();
      return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5 };
    }
    return { x: (window.innerWidth || 800) * 0.5, y: (window.innerHeight || 600) * 0.48 };
  }

  function resolveFxAnchor(meta, target) {
    const mode = (meta && meta.targetMode) || "";
    const wantsUnit = mode === "unit" || (meta && meta.anchor === "target");
    if (wantsUnit && target && target.minion && target.minion.uid != null) {
      const el = document.querySelector('.minion[data-uid="' + target.minion.uid + '"]');
      if (el) {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5 };
      }
    }
    if (wantsUnit && target && target.kind === "hero") {
      const heroEl = document.querySelector(".hero-row.opp .hero-slot, .hero-portrait.opp, #oppHeroRow")
        || document.querySelector(".hero-row.me .hero-slot, .hero-portrait.mine, #myHeroRow");
      if (heroEl) {
        const r = heroEl.getBoundingClientRect();
        return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5 };
      }
    }
    return boardCenterPoint();
  }

  function rectCenter(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5 };
  }

  function heroElForSide(side) {
    const isMe = side === "me" || side === true;
    if (typeof Vfx !== "undefined" && Vfx.heroOf) {
      const el = Vfx.heroOf(!!isMe);
      if (el) return el;
    }
    if (isMe) {
      return document.querySelector(".hero-row.me .hero-slot, .hero-portrait.mine, #myHeroRow .hero-slot, #myHeroRow")
        || document.getElementById("myHeroRow");
    }
    return document.querySelector(".hero-row.opp .hero-slot, .hero-portrait.opp, #oppHeroRow .hero-slot, #oppHeroRow")
      || document.getElementById("oppHeroRow");
  }

  /** Resolve a screen point from playPack / playCombat opts (uid / hero / el / target). */
  function pointFromOpts(opts) {
    opts = opts || {};
    if (opts.el) {
      const pt = rectCenter(opts.el);
      if (pt) return pt;
    }
    if (opts.uid != null && opts.uid !== "") {
      const el = document.querySelector('.minion[data-uid="' + opts.uid + '"]');
      const pt = rectCenter(el);
      if (pt) return pt;
    }
    if (opts.hero === "me" || opts.hero === "opp") {
      const pt = rectCenter(heroElForSide(opts.hero));
      if (pt) return pt;
    }
    if (opts.target) {
      const t = opts.target;
      if (t.minion && t.minion.uid != null) {
        const el = document.querySelector('.minion[data-uid="' + t.minion.uid + '"]');
        const pt = rectCenter(el);
        if (pt) return pt;
      }
      if (t.kind === "hero") {
        let side = null;
        if (t.owner != null && typeof meView === "function") {
          try { side = (t.owner === meView().me) ? "me" : "opp"; } catch (e) {}
        }
        if (side == null && (t.side === "me" || t.side === "opp")) side = t.side;
        if (side == null && (t.hero === "me" || t.hero === "opp")) side = t.hero;
        const heroEl = side
          ? heroElForSide(side)
          : (document.querySelector(".hero-row.opp .hero-slot, .hero-portrait.opp, #oppHeroRow")
            || document.querySelector(".hero-row.me .hero-slot, .hero-portrait.mine, #myHeroRow"));
        const pt = rectCenter(heroEl);
        if (pt) return pt;
      }
      return resolveFxAnchor({ targetMode: "unit", anchor: "target" }, t);
    }
    return null;
  }

  function resolveFlightStart() {
    const hero = document.getElementById("myHeroRow") || document.querySelector(".hero-row.me");
    const hand = document.getElementById("myHand") || document.querySelector(".my-hand");
    const game = document.getElementById("game");
    const el = hero || hand || game;
    if (el) {
      const r = el.getBoundingClientRect();
      // Bottom-center of play area / slightly above hand — cast origin
      return { x: r.left + r.width * 0.5, y: r.top + Math.min(r.height * 0.4, 48) };
    }
    return { x: (window.innerWidth || 800) * 0.5, y: (window.innerHeight || 600) * 0.78 };
  }

  function flightAngleDeg(from, to) {
    return Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
  }

  function placeFlightBox(el, x, y, angleDeg, box) {
    const half = box * 0.5;
    el.style.width = box + "px";
    el.style.height = box + "px";
    el.style.transform = "translate(" + (x - half) + "px," + (y - half) + "px) rotate(" + angleDeg + "deg)";
  }

  function playStrip(stage, url, frameW, frameH, frames, fps, layoutHint, opts) {
    opts = opts || {};
    return new Promise(resolve => {
      if (!stage || !url) { resolve(); return; }
      const wrap = document.createElement("div");
      wrap.className = "fx-strip";
      const img = document.createElement("img");
      img.alt = "";
      img.draggable = false;
      // JS drives frames — kill any CSS steps() animation that double-plays
      img.style.animation = "none";
      wrap.appendChild(img);

      const flight = opts.flight || null;
      const anchor = opts.anchor || null;
      const boxSize = opts.boxSize || 0;
      let host = wrap;
      let flightEl = null;

      // Avoid blank flash: keep prior strip until this one mounts
      const mount = () => {
        const olds = stage.querySelectorAll(":scope > .fx-strip, :scope > .fx-flight");
        olds.forEach(el => { if (el !== host) try { el.remove(); } catch (e) {} });
        if (flight && flight.from && flight.to) {
          if (!flightEl.parentNode) stage.appendChild(flightEl);
        } else if (!wrap.parentNode) {
          stage.appendChild(wrap);
        }
      };

      if (flight && flight.from && flight.to) {
        flightEl = document.createElement("div");
        flightEl.className = "fx-flight";
        flightEl.appendChild(wrap);
        host = flightEl;
        const box = boxSize || 300;
        const ang = flightAngleDeg(flight.from, flight.to);
        placeFlightBox(flightEl, flight.from.x, flight.from.y, ang, box);
      } else if (anchor) {
        wrap.classList.add("fx-anchored");
        wrap.style.setProperty("--fx-x", anchor.x + "px");
        wrap.style.setProperty("--fx-y", anchor.y + "px");
        if (boxSize) {
          wrap.style.setProperty("width", boxSize + "px", "important");
          wrap.style.setProperty("height", boxSize + "px", "important");
          wrap.style.setProperty("max-width", boxSize + "px", "important");
          wrap.style.setProperty("max-height", boxSize + "px", "important");
        }
      }

      const finish = () => {
        try { host.remove(); } catch (e) {}
        resolve();
      };
      let started = false;
      const begin = () => {
        if (started) return;
        started = true;
        mount();
        void wrap.offsetWidth;
        const box = Math.max(1, boxSize || wrap.clientWidth || (flightEl && flightEl.clientWidth) || 560);
        const natH = img.naturalHeight || frameH || 720;
        const natW = img.naturalWidth || frameW || 720;
        const vertical = layoutHint === "vertical" || (layoutHint !== "horizontal" && natH > natW);
        const n = Math.max(1, frames || Math.round((vertical ? natH : natW) / Math.max(1, vertical ? natW : natH)) || 1);
        // Floor ~28 so pack 2× (fps*2≈24) is real; spell path at fps12 stays ~83ms
        const frameMs = (opts.frameMs != null)
          ? opts.frameMs
          : Math.max(28, Math.round(1000 / Math.max(1, fps || 12)));
        const fadeMs = 280;
        const softEnd = !!opts.softEnd; // skip end-fade when chaining cast→impact
        let i = 0;
        if (vertical) {
          img.style.width = box + "px";
          img.style.height = "auto";
        } else {
          img.style.height = box + "px";
          img.style.width = "auto";
        }
        img.style.maxWidth = "none";
        img.style.maxHeight = "none";
        img.style.display = "block";
        img.style.willChange = "transform";
        img.style.animation = "none";

        if (flightEl && flight && flight.from && flight.to) {
          const flightMs = Math.max(450, Math.min(650, flight.durationMs || 550));
          const ang = flightAngleDeg(flight.from, flight.to);
          placeFlightBox(flightEl, flight.from.x, flight.from.y, ang, box);
          void flightEl.offsetWidth;
          flightEl.style.transition = "transform " + flightMs + "ms ease-out";
          requestAnimationFrame(() => {
            placeFlightBox(flightEl, flight.to.x, flight.to.y, ang, box);
          });
        }

        requestAnimationFrame(() => {
          wrap.classList.add("show");
          wrap.style.opacity = "1";
        });

        // rAF + timestamp frame advance (smoother than nested setTimeout)
        let lastTs = 0;
        let acc = 0;
        const paint = () => {
          img.style.transform = vertical
            ? ("translateY(" + (-i * box) + "px)")
            : ("translateX(" + (-i * box) + "px)");
        };
        paint();
        const step = (ts) => {
          if (!lastTs) lastTs = ts;
          acc += (ts - lastTs);
          lastTs = ts;
          while (acc >= frameMs && i < n - 1) {
            acc -= frameMs;
            i += 1;
            paint();
          }
          if (i >= n - 1) {
            // Hold last frame; fade only after playback (never early-hide at n-2)
            if (softEnd) {
              finish();
            } else {
              wrap.classList.remove("show");
              wrap.classList.add("hide");
              setTimeout(finish, fadeMs);
            }
            return;
          }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      };
      img.onerror = finish;
      img.onload = begin;
      img.src = url;
      if (img.complete && img.naturalWidth) begin();
    });
  }

  function assetUrl(base, file) {
    return base + file + "?v=" + (window.GAME_VERSION || "0");
  }
  function probeUrl(url) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }
  function playWebp(stage, url, ms) {
    return new Promise(resolve => {
      if (!stage || !url) { resolve(); return; }
      const img = document.createElement("img");
      img.className = "fx-asset";
      img.alt = "";
      stage.innerHTML = "";
      stage.appendChild(img);
      img.src = url;
      requestAnimationFrame(() => img.classList.add("show"));
      const life = Math.max(700, ms || 900);
      const t1 = setTimeout(() => { img.classList.remove("show"); img.classList.add("hide"); }, Math.max(200, life - 280));
      const t2 = setTimeout(() => { try { img.remove(); } catch (e) {} resolve(); }, life);
      img.onerror = () => { clearTimeout(t1); clearTimeout(t2); resolve(); };
    });
  }
  // ─────────────────────────────────────────────────────────────────────────
  // v0.352/v0.354 Meta-driven canvas spell FX (공용) — one full-screen canvas over
  // the whole battlefield (never clipped to the card), frames sliced once into
  // ImageBitmaps, sfx preloaded and started on the first drawn frame.
  // All sizes in meta are @1080p and scale with the viewport.
  //
  // A) meta.type === "projectile"  (fs1 화염화살)
  //   projectile: { file, frames, w, h, headX, displayLengthPx@1080p, flightMs, easePow, fps? }
  //   impact:     { file, frames, w, h, displayBoxPx@1080p, startMs, durationMs, fps? }
  // B) meta.playMode "overlay" | "perUnit" | "overlay+perUnit"  (fs2 화염폭풍 · 광역 공용)
  //   targetMode: "aoe_all" (양쪽) | "aoe_enemy" | "aoe_ally"
  //   overlay:    { file, layout: "vertical"|"horizontal", frames, w, h, fps, startMs, durationMs }
  //               → stretched to the full stage (0,0 → viewport)
  //   unitImpact: { file, layout, frames, w, h, fps, durationMs, displayBoxPx@1080p,
  //                 anchorOffsetYPx@1080p, delay: { baseMs, perPx@1080p, origin: "center" } }
  //               → every unit on the targeted boards, each at its own delay
  //   sfx:        { file, startMs }
  // C) meta.playMode "perUnit+flow"  (fs5 폭염 · 드로우형 공용, v0.359)
  //   unitImpact: B와 같음 (delay.axis "x" → 가로 거리만 사용)
  //   flow:       { file, frames, w, h, fps, headX, displayLengthPx@1080p, from: "... offsetYPx@1080p -20",
  //                 to: { selector: "#myHand", offsetYPx@1080p, fallbackPx@1080p }, startMs, plusUnitDelay,
  //                 flightMs, easePow }  → 유닛마다 발사체 1개 (유닛 → 손패). 유닛이 없으면 보드 중앙에서 2개
  //   arrival:    { file, frames, w, h, fps, displayBoxPx@1080p, startMs, durationMs } → 손패 도착 지점
  //   AI(상대)가 쓰면 상대 보드 → #oppHand
  // D) meta.playMode "anchored"  (fs6 광분 · 대상 없는 자기 강화 공용, v0.360)
  //   targetMode: "self"
  //   layers: [{ file, layout, frames, w, h, fps, startMs, durationMs, displayBoxPx@1080p, anchorOffsetYPx@1080p,
  //              oppAnchorOffsetYPx@1080p?, anchor: { selector, opp, fallbackPx@1080p, oppFallbackPx@1080p } }]
  //   → 시전자 UI 요소(선택자 rect 중심 + offsetY) 위에 한 번씩 재생. 상대가 쓰면 opp 선택자·opp 좌표
  // 공통) meta.screenShake (선택, v0.362 fs8): { startMs, durationMs, amplitudePx@1080p }
  //   → 캔버스가 아니라 보드(#game)의 기존 quake 클래스를 그 시각·길이·세기로 재생
  // ─────────────────────────────────────────────────────────────────────────
  const _imgCache = {};
  function loadImg(url) {
    if (_imgCache[url]) return _imgCache[url];
    _imgCache[url] = new Promise(resolve => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        const done = () => resolve(img);
        if (img.decode) img.decode().then(done, done); else done();
      };
      img.onerror = () => { delete _imgCache[url]; resolve(null); };
      img.src = url;
    });
    return _imgCache[url];
  }
  function isProjectileMeta(meta) {
    return !!(meta && meta.type === "projectile" && meta.projectile && meta.impact);
  }
  function isFlowMeta(meta) {
    const pm = String((meta && meta.playMode) || "");
    return !!(meta && pm.indexOf("flow") >= 0 && meta.flow && meta.flow.file);
  }
  function isOverlayMeta(meta) {
    const pm = String((meta && meta.playMode) || "");
    return !!(meta && !isFlowMeta(meta) && (pm.indexOf("overlay") >= 0 || pm.indexOf("perUnit") >= 0) && (meta.overlay || meta.unitImpact));
  }
  function isAnchoredMeta(meta) {
    return !!(meta && String(meta.playMode || "") === "anchored" && Array.isArray(meta.layers) && meta.layers.length);
  }
  function isCanvasMeta(meta) { return isProjectileMeta(meta) || isOverlayMeta(meta) || isFlowMeta(meta) || isAnchoredMeta(meta); }
  function metaSfxUrl(meta, base) { return meta && meta.sfx && meta.sfx.file ? assetUrl(base, meta.sfx.file) : ""; }
  function projectileUrls(meta, base) {
    return {
      proj: assetUrl(base, meta.projectile.file || "projectile_strip.webp"),
      imp: assetUrl(base, meta.impact.file || "impact_strip.webp"),
      sfx: metaSfxUrl(meta, base)
    };
  }
  // Strip → per-frame ImageBitmaps (decoded once) so the first frame never hitches.
  const _frameCache = {};
  function loadFrames(url, frames, fw, fh, layout) {
    const vertical = layout === "vertical";
    const key = url + "#" + frames + (vertical ? "v" : "h");
    if (_frameCache[key]) return _frameCache[key];
    const n = Math.max(1, frames || 1);
    _frameCache[key] = (async () => {
      // Decode the strip ONCE into an ImageBitmap, then slice (slicing an <img> re-decodes per call).
      if (typeof createImageBitmap === "function" && typeof fetch === "function") {
        try {
          const res = await fetch(url, { cache: "force-cache" });
          if (res.ok) {
            const full = await createImageBitmap(await res.blob());
            const w = fw || (vertical ? full.width : Math.floor(full.width / n));
            const h = fh || (vertical ? Math.floor(full.height / n) : full.height);
            const list = await Promise.all(Array.from({ length: n }, (_, i) =>
              vertical ? createImageBitmap(full, 0, i * h, w, h) : createImageBitmap(full, i * w, 0, w, h)));
            try { full.close && full.close(); } catch (e) {}
            return { list, w, h, vertical };
          }
        } catch (e) {}
      }
      // Fallback: draw slices straight from the strip <img>
      const img = await loadImg(url);
      if (!img) { delete _frameCache[key]; return null; }
      return {
        img, list: null, vertical,
        w: fw || (vertical ? img.naturalWidth : Math.floor(img.naturalWidth / n)),
        h: fh || (vertical ? Math.floor(img.naturalHeight / n) : img.naturalHeight)
      };
    })();
    return _frameCache[key];
  }
  function drawFrame(ctx, fr, i, dx, dy, dw, dh) {
    if (fr.list) ctx.drawImage(fr.list[i], dx, dy, dw, dh);
    else if (fr.vertical) ctx.drawImage(fr.img, 0, i * fr.h, fr.w, fr.h, dx, dy, dw, dh);
    else ctx.drawImage(fr.img, i * fr.w, 0, fr.w, fr.h, dx, dy, dw, dh);
  }
  function loadSfx(url) {
    return (url && typeof Sfx !== "undefined" && Sfx.loadUrl) ? Sfx.loadUrl(url) : Promise.resolve(null);
  }
  /** Warm frames + decoded audio so launch is instant (call during card showcase). */
  function preloadProjectile(meta, base) {
    if (!isProjectileMeta(meta)) return Promise.resolve(null);
    const u = projectileUrls(meta, base);
    const P = meta.projectile, I = meta.impact;
    return Promise.all([loadFrames(u.proj, P.frames, P.w, P.h, P.layout), loadFrames(u.imp, I.frames, I.w, I.h, I.layout), loadSfx(u.sfx)]);
  }
  function preloadOverlay(meta, base) {
    if (!isOverlayMeta(meta)) return Promise.resolve(null);
    const O = meta.overlay, U = meta.unitImpact;
    return Promise.all([
      O ? loadFrames(assetUrl(base, O.file), O.frames, O.w, O.h, O.layout) : Promise.resolve(null),
      U ? loadFrames(assetUrl(base, U.file), U.frames, U.w, U.h, U.layout) : Promise.resolve(null),
      loadSfx(metaSfxUrl(meta, base))
    ]);
  }
  function preloadFlow(meta, base) {
    if (!isFlowMeta(meta)) return Promise.resolve(null);
    const U = meta.unitImpact, F = meta.flow, A = meta.arrival;
    return Promise.all([
      U && U.file ? loadFrames(assetUrl(base, U.file), U.frames, U.w, U.h, U.layout) : Promise.resolve(null),
      loadFrames(assetUrl(base, F.file), F.frames, F.w, F.h, F.layout),
      A && A.file ? loadFrames(assetUrl(base, A.file), A.frames, A.w, A.h, A.layout) : Promise.resolve(null),
      loadSfx(metaSfxUrl(meta, base))
    ]);
  }
  function preloadAnchored(meta, base) {
    if (!isAnchoredMeta(meta)) return Promise.resolve(null);
    return Promise.all([
      Promise.all(meta.layers.map(L => L && L.file ? loadFrames(assetUrl(base, L.file), L.frames, L.w, L.h, L.layout) : Promise.resolve(null))),
      loadSfx(metaSfxUrl(meta, base))
    ]);
  }
  function preloadMetaFx(meta, base) {
    if (isProjectileMeta(meta)) return preloadProjectile(meta, base);
    if (isAnchoredMeta(meta)) return preloadAnchored(meta, base);
    if (isFlowMeta(meta)) return preloadFlow(meta, base);
    if (isOverlayMeta(meta)) return preloadOverlay(meta, base);
    return Promise.resolve(null);
  }
  function fxScale() {
    const w = window.innerWidth || 1920, h = window.innerHeight || 1080;
    return Math.min(w / 1920, h / 1080);
  }
  function screenCenter() {
    return { x: (window.innerWidth || 1920) * 0.5, y: (window.innerHeight || 1080) * 0.5 };
  }
  /**
   * Shared timeline runner: full-viewport canvas in `stage`, rAF loop, sfx on the first
   * drawn frame. draw(ctx, tMs, cw, ch) paints one frame. Resolves true when t >= endMs.
   */
  /** meta.screenShake → #game 의 기존 quake 클래스 (길이·세기는 CSS 변수로) */
  function startScreenShake(S) {
    const game = document.getElementById("game");
    if (!game || !S) return;
    const dur = Math.max(50, S.durationMs || 350);
    const amp = (S["amplitudePx@1080p"] != null ? S["amplitudePx@1080p"] : 8) * fxScale();
    game.style.setProperty("--quake-dur", dur + "ms");
    game.style.setProperty("--quake-k", String(Math.round(amp / 8 * 100) / 100)); // boardQuake 최대 이동 8px 기준
    game.classList.remove("quake");
    void game.offsetWidth; // 애니메이션 재시작
    game.classList.add("quake");
    setTimeout(() => {
      game.classList.remove("quake");
      game.style.removeProperty("--quake-dur");
      game.style.removeProperty("--quake-k");
    }, dur + 40);
  }
  function runCanvasFx(stage, endMs, sfxUrl, sfxStartMs, draw, opts) {
    opts = opts || {};
    const shake = opts.shake || null;
    let shaken = !shake;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = window.innerWidth || 1920, ch = window.innerHeight || 1080;
    const cv = document.createElement("canvas");
    cv.className = "fx-canvas-pack";
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    cv.style.cssText = "position:absolute;left:0;top:0;width:" + cw + "px;height:" + ch + "px;pointer-events:none;z-index:5;";
    stage.appendChild(cv);
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    return new Promise(resolve => {
      let t0 = 0, done = false;
      const finish = () => {
        if (done) return; done = true;
        try { cv.remove(); } catch (e) {}
        resolve(true);
      };
      const step = (now) => {
        if (done) return;
        if (!t0) {
          t0 = now;
          if (opts.sound !== false && sfxUrl && typeof Sfx !== "undefined" && Sfx.playUrl) {
            try { Sfx.playUrl(sfxUrl, { when: Math.max(0, sfxStartMs || 0) / 1000, duckMs: endMs }); } catch (e) {}
          }
        }
        const t = now - t0;
        if (!shaken && t >= (shake.startMs || 0)) { shaken = true; try { startScreenShake(shake); } catch (e) {} }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cw, ch);
        try { draw(ctx, t, cw, ch); } catch (e) {}
        if (t >= endMs) { finish(); return; }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      // Safety: never hang the turn if rAF is throttled (background tab)
      setTimeout(finish, endMs + 1500);
    });
  }
  /**
   * Generic projectile spell player.
   * @param stage  full-screen host (#fxStage)
   * @param meta   pack meta (type "projectile")
   * @param base   pack base url
   * @param to     target point {x,y} in client px
   * @param opts   { from?: {x,y}, onHit?: fn, sound?: bool }
   */
  async function playProjectile(stage, meta, base, to, opts) {
    opts = opts || {};
    if (!stage || !isProjectileMeta(meta)) return false;
    const u = projectileUrls(meta, base);
    const [projFr, impFr] = await preloadProjectile(meta, base);
    if (!projFr || !impFr) return false;
    const P = meta.projectile, I = meta.impact, S = meta.sfx || {};
    const k = fxScale();
    const from = opts.from || screenCenter();
    to = to || boardCenterPoint();
    const dx = to.x - from.x, dy = to.y - from.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ang = Math.atan2(dy, dx);
    const cos = Math.cos(ang), sin = Math.sin(ang);
    const pFrames = Math.max(1, P.frames || 1);
    const pW = projFr.w, pH = projFr.h;
    const L = (P["displayLengthPx@1080p"] || 380) * k;
    const Hh = L * pH / pW;
    const headOff = ((P.headX != null ? P.headX : 1) - 0.5) * L;
    const flightMs = P.flightMs || 350;
    const easePow = P.easePow || 1.7;
    const pFps = P.fps || meta.fps || 30;
    const iFrames = Math.max(1, I.frames || 1);
    const iW = impFr.w, iH = impFr.h;
    const box = (I["displayBoxPx@1080p"] || 380) * k;
    const iStart = I.startMs != null ? I.startMs : flightMs - 20;
    const iDur = I.durationMs || 600;
    const iFps = I.fps || meta.fps || 30;
    const endMs = iStart + iDur;
    let hitFired = false;
    return runCanvasFx(stage, endMs, u.sfx, S.startMs, (ctx, t) => {
      // projectile: accelerate into target (head reaches target centre at flightMs)
      if (t < flightMs + 50) {
        const uu = Math.min(1, t / flightMs);
        const trav = dist * Math.pow(uu, easePow);
        const cx = from.x + cos * (trav - headOff);
        const cy = from.y + sin * (trav - headOff);
        const grow = 0.55 + 0.45 * Math.min(1, t / 120);
        const op = Math.min(1, t / 60) * (1 - Math.max(0, (t - flightMs) / 50));
        const fi = Math.floor(t * pFps / 1000) % pFrames;
        if (op > 0) {
          ctx.save();
          ctx.globalAlpha = op;
          ctx.translate(cx, cy);
          ctx.rotate(ang);
          ctx.scale(grow, grow);
          drawFrame(ctx, projFr, fi, -L / 2, -Hh / 2, L, Hh);
          ctx.restore();
        }
      }
      // impact bloom on the target
      const ti = t - iStart;
      if (ti >= 0 && ti < iDur) {
        if (!hitFired) { hitFired = true; try { opts.onHit && opts.onHit(); } catch (e) {} }
        const fi = Math.min(iFrames - 1, Math.floor(ti * iFps / 1000));
        const bw = box, bh = box * iH / iW;
        drawFrame(ctx, impFr, fi, to.x - bw / 2, to.y - bh / 2, bw, bh);
      }
    }, opts);
  }
  /** Unit centres (client px) for an AOE targetMode. casterIsMe decides which board is "enemy". */
  function aoeUnitPoints(targetMode, casterIsMe) {
    const my = document.getElementById("myBoard"), opp = document.getElementById("oppBoard");
    const enemyB = casterIsMe === false ? my : opp, allyB = casterIsMe === false ? opp : my;
    const boards = targetMode === "aoe_enemy" ? [enemyB] : targetMode === "aoe_ally" ? [allyB] : [opp, my];
    const pts = [];
    boards.forEach(b => {
      if (!b) return;
      b.querySelectorAll(".minion[data-uid]").forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return;
        pts.push({ uid: el.getAttribute("data-uid"), x: r.left + r.width / 2, y: r.top + r.height / 2 });
      });
    });
    return pts;
  }
  /** Per-unit start delay (ms). meta delay distance is @1080p px from the stage centre. */
  function unitDelayMs(U, pt, k) {
    const d = (U && U.delay) || {};
    const base = d.baseMs != null ? d.baseMs : 0;
    const per = d["perPx@1080p"] != null ? d["perPx@1080p"] : 0;
    const c = screenCenter();
    const dist = d.axis === "x" ? Math.abs(pt.x - c.x) : d.axis === "y" ? Math.abs(pt.y - c.y) : Math.hypot(pt.x - c.x, pt.y - c.y);
    return base + per * dist / (k || 1);
  }
  /**
   * Generic full-screen overlay + per-unit impact player (AOE spells).
   * @param opts { casterIsMe?: bool, points?: [{x,y}], sound?: bool }
   */
  async function playOverlayPerUnit(stage, meta, base, opts) {
    opts = opts || {};
    if (!stage || !isOverlayMeta(meta)) return false;
    const pm = String(meta.playMode || "");
    const [ovFr, unFr] = await preloadOverlay(meta, base);
    const O = pm.indexOf("overlay") >= 0 && ovFr ? meta.overlay : null;
    const U = pm.indexOf("perUnit") >= 0 && unFr ? meta.unitImpact : null;
    if (!O && !U) return false;
    const k = fxScale();
    const S = meta.sfx || {};
    const oStart = O ? (O.startMs || 0) : 0;
    const oDur = O ? (O.durationMs || Math.round((O.frames || 1) * 1000 / (O.fps || 24))) : 0;
    const oFps = O ? (O.fps || meta.fps || 24) : 24;
    const oN = O ? Math.max(1, O.frames || 1) : 1;
    const hits = [];
    let uDur = 0, uFps = 30, uN = 1, uBox = 0, uOffY = 0;
    if (U) {
      uDur = U.durationMs || 500;
      uFps = U.fps || meta.fps || 30;
      uN = Math.max(1, U.frames || 1);
      uBox = (U["displayBoxPx@1080p"] || 300) * k;
      uOffY = (U["anchorOffsetYPx@1080p"] || 0) * k;
      (opts.points || aoeUnitPoints(meta.targetMode || "aoe_all", opts.casterIsMe)).forEach(pt => {
        hits.push({ x: pt.x, y: pt.y + uOffY, at: unitDelayMs(U, pt, k) });
      });
    }
    const endMs = Math.max(O ? oStart + oDur : 0, hits.reduce((m, h) => Math.max(m, h.at + uDur), 0));
    return runCanvasFx(stage, endMs, metaSfxUrl(meta, base), S.startMs, (ctx, t, cw, ch) => {
      if (O) {
        const to = t - oStart;
        if (to >= 0 && to < oDur) drawFrame(ctx, ovFr, Math.min(oN - 1, Math.floor(to * oFps / 1000)), 0, 0, cw, ch);
      }
      if (U) {
        const bw = uBox, bh = uBox * unFr.h / unFr.w;
        hits.forEach(h => {
          const ti = t - h.at;
          if (ti < 0 || ti >= uDur) return;
          drawFrame(ctx, unFr, Math.min(uN - 1, Math.floor(ti * uFps / 1000)), h.x - bw / 2, h.y - bh / 2, bw, bh);
        });
      }
    }, opts);
  }
  /** "offsetYPx@1080p -20" 같은 문자열/숫자에서 @1080p 오프셋 값 읽기 */
  function metaOffsetY(obj, key) {
    if (!obj) return 0;
    if (typeof obj === "object") {
      const v = obj[key || "offsetYPx@1080p"];
      return typeof v === "number" ? v : 0;
    }
    const m = /offsetYPx@1080p\s*(-?\d+(?:\.\d+)?)/.exec(String(obj));
    return m ? parseFloat(m[1]) : 0;
  }
  /** 시전자 보드 중앙 (내가 쓰면 #myBoard, 상대가 쓰면 #oppBoard) */
  function casterBoardCenter(casterIsMe) {
    const b = document.getElementById(casterIsMe === false ? "oppBoard" : "myBoard");
    const r = b && b.getBoundingClientRect();
    if (r && r.width > 4 && r.height > 4) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    return boardCenterPoint();
  }
  /** flow 도착점: 시전자 손패 (meta.flow.to.selector, 상대 시전이면 #oppHand) */
  function flowTargetPoint(F, casterIsMe, k) {
    const T = (F && F.to) || {};
    const cw = window.innerWidth || 1920, ch = window.innerHeight || 1080;
    let sel = T.selector || "#myHand";
    if (casterIsMe === false) sel = sel.replace("#myHand", "#oppHand").replace(".my-hand", ".opp-hand");
    const el = document.querySelector(sel);
    const r = el && el.getBoundingClientRect();
    const offY = metaOffsetY(T) * k;
    if (r && r.width > 4 && r.height > 4) return { x: r.left + r.width / 2, y: r.top + r.height / 2 + (casterIsMe === false ? -offY : offY) };
    const fb = T["fallbackPx@1080p"] || [960, 905];
    const y = casterIsMe === false ? (1080 - fb[1]) : fb[1];
    return { x: fb[0] * cw / 1920, y: y * ch / 1080 };
  }
  /**
   * Generic per-unit impact + flow-to-hand player (드로우형: 내 유닛마다 타격 → 각 유닛에서 손패로 발사체 → 손패 도착 효과).
   * @param opts { casterIsMe?: bool, points?: [{x,y}], to?: {x,y}, sound?: bool, emptyFlows?: number }
   */
  async function playPerUnitFlow(stage, meta, base, opts) {
    opts = opts || {};
    if (!stage || !isFlowMeta(meta)) return false;
    const [unFr, flFr, arFr] = await preloadFlow(meta, base);
    if (!flFr) return false;
    const U = unFr ? meta.unitImpact : null, F = meta.flow, A = arFr ? meta.arrival : null, S = meta.sfx || {};
    const k = fxScale();
    const casterIsMe = opts.casterIsMe;
    const pts = opts.points || aoeUnitPoints(meta.targetMode || "aoe_ally", casterIsMe);
    const to = opts.to || flowTargetPoint(F, casterIsMe, k);
    // 1) 유닛 타격
    const hits = [];
    let uDur = 0, uFps = 30, uN = 1, uBox = 0;
    if (U) {
      uDur = U.durationMs || 500;
      uFps = U.fps || meta.fps || 30;
      uN = Math.max(1, U.frames || 1);
      uBox = (U["displayBoxPx@1080p"] || 300) * k;
      const offY = (U["anchorOffsetYPx@1080p"] || 0) * k;
      pts.forEach(pt => hits.push({ x: pt.x, y: pt.y + offY, at: (U.startMs || 0) + unitDelayMs(U, pt, k), delay: unitDelayMs(U, pt, k) }));
    }
    // 2) 발사체: 유닛마다 1개 (없으면 보드 중앙에서 emptyFlows개, 기본 2)
    const fOffY = metaOffsetY(F.from) * k;
    const fStart = F.startMs || 0, flightMs = F.flightMs || 280, easePow = F.easePow || 1.5;
    const fFps = F.fps || meta.fps || 30, fN = Math.max(1, F.frames || 1);
    const L = (F["displayLengthPx@1080p"] || 230) * k;
    const Hh = L * flFr.h / flFr.w;
    const headOff = ((F.headX != null ? F.headX : 1) - 0.5) * L;
    const flows = [];
    const addFlow = (from, delay) => {
      const dx = to.x - from.x, dy = to.y - from.y;
      const ang = Math.atan2(dy, dx);
      flows.push({ from, at: fStart + (F.plusUnitDelay === false ? 0 : delay), dist: Math.hypot(dx, dy) || 1, ang, cos: Math.cos(ang), sin: Math.sin(ang) });
    };
    if (pts.length) {
      pts.forEach((pt, i) => addFlow({ x: pt.x, y: pt.y + fOffY }, hits[i] ? hits[i].delay : 0));
    } else {
      const c = casterBoardCenter(casterIsMe);
      const n = Math.max(1, opts.emptyFlows || 2);
      const gap = 90 * k;
      for (let i = 0; i < n; i++) addFlow({ x: c.x + (i - (n - 1) / 2) * gap, y: c.y + fOffY }, i * 40);
    }
    // 3) 손패 도착
    let aStart = 0, aDur = 0, aFps = 30, aN = 1, aBox = 0;
    if (A) {
      aStart = A.startMs != null ? A.startMs : fStart + flightMs;
      aDur = A.durationMs || Math.round((A.frames || 1) * 1000 / (A.fps || 30));
      aFps = A.fps || meta.fps || 30;
      aN = Math.max(1, A.frames || 1);
      aBox = (A["displayBoxPx@1080p"] || 300) * k;
    }
    const endMs = Math.max(
      hits.reduce((m, h) => Math.max(m, h.at + uDur), 0),
      flows.reduce((m, f) => Math.max(m, f.at + flightMs + 50), 0),
      A ? aStart + aDur : 0);
    return runCanvasFx(stage, endMs, metaSfxUrl(meta, base), S.startMs, (ctx, t) => {
      if (U) {
        const bw = uBox, bh = uBox * unFr.h / unFr.w;
        hits.forEach(h => {
          const ti = t - h.at;
          if (ti < 0 || ti >= uDur) return;
          drawFrame(ctx, unFr, Math.min(uN - 1, Math.floor(ti * uFps / 1000)), h.x - bw / 2, h.y - bh / 2, bw, bh);
        });
      }
      flows.forEach(f => {
        const tf = t - f.at;
        if (tf < 0 || tf >= flightMs + 50) return;
        const uu = Math.min(1, tf / flightMs);
        const trav = f.dist * Math.pow(uu, easePow);
        const op = Math.min(1, tf / 60) * (1 - Math.max(0, (tf - flightMs) / 50));
        if (op <= 0) return;
        ctx.save();
        ctx.globalAlpha = op;
        ctx.translate(f.from.x + f.cos * (trav - headOff), f.from.y + f.sin * (trav - headOff));
        ctx.rotate(f.ang);
        drawFrame(ctx, flFr, Math.floor(tf * fFps / 1000) % fN, -L / 2, -Hh / 2, L, Hh);
        ctx.restore();
      });
      if (A) {
        const ta = t - aStart;
        if (ta >= 0 && ta < aDur) {
          const bw = aBox, bh = aBox * arFr.h / arFr.w;
          drawFrame(ctx, arFr, Math.min(aN - 1, Math.floor(ta * aFps / 1000)), to.x - bw / 2, to.y - bh / 2, bw, bh);
        }
      }
    }, opts);
  }
  /** anchored 레이어 기준점: 시전자 쪽 선택자 rect 중심 (없으면 @1080p 좌표를 화면 비율로) */
  function anchorPoint(A, casterIsMe) {
    A = A || {};
    const opp = casterIsMe === false;
    const cw = window.innerWidth || 1920, ch = window.innerHeight || 1080;
    const sel = opp ? A.opp : A.selector;
    let el = null;
    if (sel) { try { el = document.querySelector(sel); } catch (e) { el = null; } }
    const r = el && el.getBoundingClientRect();
    if (r && r.width > 2 && r.height > 2) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const fb = (opp ? A["oppFallbackPx@1080p"] : A["fallbackPx@1080p"]) || A["fallbackPx@1080p"] || [960, 540];
    return { x: fb[0] * cw / 1920, y: fb[1] * ch / 1080 };
  }
  /**
   * Generic anchored player (대상 없는 스펠: 시전자 영웅·소울 등 UI 요소 위에 레이어별 1회 재생).
   * @param opts { casterIsMe?: bool, sound?: bool }
   */
  async function playAnchored(stage, meta, base, opts) {
    opts = opts || {};
    if (!stage || !isAnchoredMeta(meta)) return false;
    const [frs] = await preloadAnchored(meta, base);
    const k = fxScale();
    const opp = opts.casterIsMe === false;
    const layers = [];
    meta.layers.forEach((L, i) => {
      const fr = frs && frs[i];
      if (!L || !fr) return;
      const pt = anchorPoint(L.anchor, opts.casterIsMe);
      const offKey = opp && L["oppAnchorOffsetYPx@1080p"] != null ? "oppAnchorOffsetYPx@1080p" : "anchorOffsetYPx@1080p";
      const box = (L["displayBoxPx@1080p"] || 300) * k;
      const bw = box, bh = box * fr.h / fr.w;
      let y = pt.y + (L[offKey] || 0) * k;
      if (opp) y = Math.max(bh * 0.3, y); // 상대 쪽(화면 위 가장자리)에서 잘리지 않게
      const fps = L.fps || meta.fps || 30, n = Math.max(1, L.frames || 1);
      layers.push({ fr, x: pt.x, y, bw, bh, at: L.startMs || 0, dur: L.durationMs || Math.round(n * 1000 / fps), fps, n });
    });
    if (!layers.length) return false;
    const endMs = layers.reduce((m, l) => Math.max(m, l.at + l.dur), 0);
    return runCanvasFx(stage, endMs, metaSfxUrl(meta, base), (meta.sfx || {}).startMs, (ctx, t) => {
      layers.forEach(l => {
        const tl = t - l.at;
        if (tl < 0 || tl >= l.dur) return;
        drawFrame(ctx, l.fr, Math.min(l.n - 1, Math.floor(tl * l.fps / 1000)), l.x - l.bw / 2, l.y - l.bh / 2, l.bw, l.bh);
      });
    }, opts);
  }
  /** Dispatch a meta-driven canvas pack. */
  function playMetaFx(stage, meta, base, opts) {
    opts = opts || {};
    if (meta && meta.screenShake && !opts.shake) opts = Object.assign({}, opts, { shake: meta.screenShake });
    if (isAnchoredMeta(meta)) return playAnchored(stage, meta, base, opts);
    if (isProjectileMeta(meta)) return playProjectile(stage, meta, base, opts.to, opts);
    if (isFlowMeta(meta)) return playPerUnitFlow(stage, meta, base, opts);
    if (isOverlayMeta(meta)) return playOverlayPerUnit(stage, meta, base, opts);
    return Promise.resolve(false);
  }

  async function playAssetPack(card, layer, stage, opts) {
    opts = opts || {};
    const target = opts.target || null;
    const meta = await loadSpellMeta(card && card.id);
    if (!meta) return false;
    if (isCanvasMeta(meta)) {
      const fxCardP = document.getElementById("fxCard");
      if (fxCardP) { fxCardP.classList.add("out"); fxCardP.style.opacity = "0"; }
      const labP = document.getElementById("fxName");
      if (labP) { labP.textContent = ""; labP.style.opacity = "0"; }
      layer.classList.add("pack-play");
      const mOpts = { casterIsMe: opts.casterIsMe };
      if (isProjectileMeta(meta)) mOpts.to = resolveFxAnchor(Object.assign({ targetMode: "unit" }, meta), target);
      const ok = await playMetaFx(stage, meta, ASSET_BASE + (meta.id || card.id) + "/", mOpts);
      if (fxCardP) fxCardP.style.opacity = "";
      if (ok) return true;
    }
    const base = ASSET_BASE + meta.id + "/";
    const fps = meta.fps || 12;
    const cast = meta.cast || {};
    const hit = meta.impact || meta.aoe || {};
    const castFrames = cast.frames || 12;
    const hitFrames = hit.frames || 8;
    const castW = cast.w || 720, castH = cast.h || 720;
    const hitW = hit.w || 560, hitH = hit.h || 560;
    const castStrip = assetUrl(base, "cast_strip.png");
    const hitStrip = assetUrl(base, meta.aoe ? "aoe_strip.png" : "impact_strip.png");

    try { Sfx.playCardDrop && Sfx.playCardDrop(); } catch (e) {}
    if (meta.sfxHint === "coin_flip") { try { Sfx.playCoin && Sfx.playCoin(); } catch (e) {} }
    // Card showcase already handled by play(); keep fxCard faded during strips
    const fxCard = document.getElementById("fxCard");
    if (fxCard) { fxCard.classList.add("out"); fxCard.style.opacity = "0"; }
    const lab = document.getElementById("fxName");
    if (lab) { lab.textContent = (card && card.name) || meta.name || ""; lab.style.opacity = "1"; }
    layer.classList.add("pack-play");

    const mode = meta.targetMode || "";
    const isUnit = mode === "unit" || meta.anchor === "target";
    const endPt = resolveFxAnchor(meta, target);
    const canFly = meta.flight === true && isUnit && target && target.minion;
    const anchorAtTarget = isUnit && target && (target.minion || target.kind === "hero");

    // Strips only. Chroma-keyed webp is often fully transparent — never fall back to it.
    let played = false;
    const layoutHint = meta.layout || null;
    const impactBox = 320;
    const flightBox = 300;

    const hasHitStrip = await probeUrl(hitStrip);
    const hasAoeStrip = !!(meta.aoe && await probeUrl(assetUrl(base, "aoe_strip.png")));
    const hasHit = hasHitStrip || hasAoeStrip;
    if (await probeUrl(castStrip)) {
      if (canFly) {
        const startPt = resolveFlightStart();
        await playStrip(stage, castStrip, castW, castH, castFrames, fps, layoutHint, {
          flight: { from: startPt, to: endPt, durationMs: 550 },
          boxSize: flightBox,
          softEnd: !!hasHit
        });
      } else if (anchorAtTarget) {
        await playStrip(stage, castStrip, castW, castH, castFrames, fps, layoutHint, {
          anchor: endPt,
          boxSize: impactBox,
          softEnd: !!hasHit
        });
      } else {
        // AOE / board-centered — keep full-stage strip playback
        await playStrip(stage, castStrip, castW, castH, castFrames, fps, layoutHint, {
          softEnd: !!hasHit
        });
      }
      played = true;
    }

    const hitOpts = (canFly || anchorAtTarget)
      ? { anchor: endPt, boxSize: impactBox }
      : null;
    if (hasHitStrip) {
      await playStrip(stage, hitStrip, hitW, hitH, hitFrames, fps, layoutHint, hitOpts);
      played = true;
    } else if (hasAoeStrip) {
      await playStrip(stage, assetUrl(base, "aoe_strip.png"), hitW, hitH, hitFrames, fps, layoutHint, null);
      played = true;
    }
    if (!played) {
      // Guaranteed visible burst if strips fail to load (mobile/network)
      cssFallback(stage, elemOf(card), spellKind(card));
      await new Promise(r => setTimeout(r, 900));
    }
    if (fxCard) { fxCard.style.opacity = ""; }
    return true;
  }


  function lowSpec() {
    try {
      if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
    } catch (e) {}
    return false;
  }
  function elemOf(card) {
    const id = (card && (card.tribe || card.element)) || "earth";
    return ELEM[id] ? id : "earth";
  }
  function spellKind(card) {
    const sp = (card && card.spell) || {};
    const t = sp.type || "burst";
    if (t === "aoe_pack" || t === "aoe_enemy" || t === "aoe_all_enemy" || t === "earthquake" || t === "sandhell" || t === "enemy_def_hp_down") return "aoe";
    if (t === "dmg" || t === "face") return "bolt";
    if (t === "heal_hero" || t === "buff" || t === "buff_all" || t === "grant_extra" || t === "grant_kw" || t === "heal_all_full") return "buff";
    if (t === "kill" || t === "kill_if" || t === "wipe_all" || t === "sac_own_aoe" || t === "duel_random_keep") return "kill";
    if (t === "draw" || t === "draw_ex" || t === "soul" || t === "soul_next" || t === "coin_luck") return "utility";
    if (t === "petrify" || t === "set_one" || t === "set_enemy" || t === "magnet") return "control";
    return t;
  }

  function ensureLayer() {
    let layer = document.getElementById("spellFx");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "spellFx";
      layer.innerHTML = '<div class="fx-veil"></div><div class="fx-card" id="fxCard"></div><canvas id="fxCanvas"></canvas><div class="fx-stage" id="fxStage"></div><div class="fx-name" id="fxName"></div>';
      document.body.appendChild(layer);
    } else if (layer.parentElement !== document.body) {
      document.body.appendChild(layer);
    }
    if (!document.getElementById("fxCanvas")) {
      const c = document.createElement("canvas");
      c.id = "fxCanvas";
      layer.appendChild(c);
    }
    const veil = layer.querySelector(".fx-veil");
    if (veil) veil.style.pointerEvents = "none";
    return layer;
  }

  function paintCard(src, name) {
    const fxCard = document.getElementById("fxCard");
    const label = document.getElementById("fxName");
    if (label) label.textContent = name || "";
    if (!fxCard) return;
    if (src && typeof src === "string" && src.indexOf("[object") < 0) {
      fxCard.innerHTML = '<img src="' + src + '" alt="">';
    }
    fxCard.classList.remove("out");
    void fxCard.offsetWidth;
    fxCard.classList.add("in");
  }

  async function resolveFace(card) {
    // Spells/items (incl. spell tokens like coin): always compose — CARD_FACE may be a stale unit-framed bake
    if (card && (card.type === "spell" || card.type === "item") && typeof composeCardFace === "function") {
      try {
        const src = await composeCardFace(card);
        if (src && typeof src === "string") return src;
      } catch (e) {}
    }
    const ready = (card && card.face) || (typeof CARD_FACE !== "undefined" && CARD_FACE[card && card.id]) || "";
    if (ready && typeof ready === "string" && ready.indexOf("[object") < 0) return ready;
    if (typeof composeCardFace === "function") {
      try {
        const src = await composeCardFace(card);
        if (src && typeof src === "string") return src;
      } catch (e) {}
    }
    return "";
  }

  function seedParts(elem, kind, low, w, h) {
    const pal = ELEM[elem] || ELEM.earth;
    const cx = w * 0.5, cy = h * 0.46;
    const parts = [];
    const baseN = low ? 28 : (kind === "aoe" || kind === "kill" ? 160 : kind === "bolt" ? 120 : 100);
    const n = elem === "light" || elem === "dark" ? Math.floor(baseN * 1.15) : baseN;

    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      let sp = 50 + Math.random() * 300;
      let vx = Math.cos(a) * sp;
      let vy = Math.sin(a) * sp;
      let x = cx, y = cy;
      let r = 2 + Math.random() * (low ? 4 : 8);
      let shape = "dot";
      let grav = 0;

      if (elem === "fire") {
        vx *= 0.45; vy = -Math.abs(vy) * 0.85 - 40;
        grav = -220;
        shape = Math.random() > 0.55 ? "ember" : "dot";
        r = 2 + Math.random() * 9;
      } else if (elem === "water") {
        vx *= 0.7; vy = Math.abs(vy) * 0.35 + 30;
        grav = 280;
        shape = Math.random() > 0.5 ? "drop" : "dot";
        if (kind === "aoe") { x = w * Math.random(); y = -10 - Math.random() * 80; vx = (Math.random() - 0.5) * 40; vy = 180 + Math.random() * 320; }
      } else if (elem === "wind") {
        vx = (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 420);
        vy = (Math.random() - 0.5) * 120;
        y = h * (0.25 + Math.random() * 0.45);
        x = vx > 0 ? -20 : w + 20;
        shape = "slash";
        r = 10 + Math.random() * 28;
      } else if (elem === "earth") {
        vx *= 0.35; vy = Math.abs(vy) * 0.5;
        grav = 520;
        shape = Math.random() > 0.4 ? "rock" : "dot";
        r = 4 + Math.random() * 14;
        if (kind === "aoe" || kind === "earthquake") {
          x = w * (0.12 + Math.random() * 0.76);
          y = -30 - Math.random() * 60;
          vx = (Math.random() - 0.5) * 50;
          vy = 200 + Math.random() * 340;
          shape = "rock";
        }
      } else if (elem === "light") {
        const ring = a;
        const rad = 20 + Math.random() * 160;
        x = cx + Math.cos(ring) * rad * 0.2;
        y = cy + Math.sin(ring) * rad * 0.2;
        vx = Math.cos(ring) * (60 + Math.random() * 180);
        vy = Math.sin(ring) * (60 + Math.random() * 180);
        shape = Math.random() > 0.6 ? "ray" : "star";
        r = 2 + Math.random() * 6;
      } else if (elem === "dark") {
        vx *= 0.55; vy *= 0.55;
        // inward suck then outward
        const pull = 0.35 + Math.random() * 0.5;
        x = cx + Math.cos(a) * (80 + Math.random() * 200);
        y = cy + Math.sin(a) * (60 + Math.random() * 160);
        vx = (cx - x) * pull * 2.2;
        vy = (cy - y) * pull * 2.2;
        shape = Math.random() > 0.5 ? "wisp" : "dot";
        r = 3 + Math.random() * 10;
      }

      if (kind === "bolt" && i < n * 0.35) {
        // concentrated beam toward upper third
        x = cx + (Math.random() - 0.5) * 40;
        y = cy + 40;
        vx = (Math.random() - 0.5) * 60;
        vy = -280 - Math.random() * 220;
        if (elem === "fire") shape = "ember";
      }
      if (kind === "buff") {
        vx *= 0.25; vy = -40 - Math.random() * 120; grav = -40;
        shape = elem === "light" ? "star" : "dot";
      }
      if (kind === "kill") {
        vx *= 1.3; vy *= 1.3; r *= 1.2;
      }

      parts.push({
        x, y, vx, vy, r, grav, shape,
        life: 0.5 + Math.random() * 0.85,
        age: -Math.random() * 0.12,
        c: pal.fill[i % pal.fill.length],
        spin: (Math.random() - 0.5) * 8,
        ang: Math.random() * Math.PI * 2
      });
    }
    return { parts, cx, cy, pal };
  }

  function drawPart(ctx, p, k) {
    const rr = p.r * (0.55 + 0.45 * k);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.ang);
    ctx.fillStyle = p.c;
    ctx.strokeStyle = p.c;
    if (p.shape === "rock") {
      ctx.fillRect(-rr * 0.5, -rr * 0.35, rr, rr * 0.7);
    } else if (p.shape === "ember") {
      ctx.beginPath();
      ctx.moveTo(0, -rr);
      ctx.quadraticCurveTo(rr * 0.7, 0, 0, rr * 0.8);
      ctx.quadraticCurveTo(-rr * 0.7, 0, 0, -rr);
      ctx.fill();
    } else if (p.shape === "drop") {
      ctx.beginPath();
      ctx.moveTo(0, -rr);
      ctx.bezierCurveTo(rr, -rr * 0.2, rr * 0.6, rr, 0, rr);
      ctx.bezierCurveTo(-rr * 0.6, rr, -rr, -rr * 0.2, 0, -rr);
      ctx.fill();
    } else if (p.shape === "slash") {
      ctx.globalAlpha *= 0.7;
      ctx.lineWidth = Math.max(1.5, rr * 0.12);
      ctx.beginPath();
      ctx.moveTo(-rr, 0);
      ctx.quadraticCurveTo(0, -rr * 0.25, rr, 0);
      ctx.stroke();
    } else if (p.shape === "ray") {
      ctx.globalAlpha *= 0.55;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(rr * 6, 0);
      ctx.stroke();
    } else if (p.shape === "star") {
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        ctx.lineTo(Math.cos(a + Math.PI / 4) * rr * 0.35, Math.sin(a + Math.PI / 4) * rr * 0.35);
      }
      ctx.closePath();
      ctx.fill();
    } else if (p.shape === "wisp") {
      ctx.globalAlpha *= 0.75;
      ctx.beginPath();
      ctx.ellipse(0, 0, rr * 1.4, rr * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function burst(elem, kind, low) {
    const canvas = document.getElementById("fxCanvas");
    if (!canvas) return { stop() {} };
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, low ? 1 : 1.5);
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { parts, cx, cy, pal } = seedParts(elem, kind, low, w, h);
    let t0 = 0, dead = false, elapsed = 0;

    function frame(ts) {
      if (dead) return;
      if (!t0) t0 = ts;
      const dt = Math.min(0.033, (ts - t0) / 1000);
      t0 = ts;
      elapsed += dt;
      ctx.clearRect(0, 0, w, h);

      // Element veil / shock rings
      const pulse = Math.sin(elapsed * 6) * 0.5 + 0.5;
      if (elem === "light" || elem === "dark" || kind === "aoe" || kind === "kill") {
        const rad = 80 + elapsed * 220 + pulse * 30;
        const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, rad);
        g.addColorStop(0, pal.fill[0] + (elem === "dark" ? "99" : "bb"));
        g.addColorStop(0.45, pal.glow + "44");
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
      if (elem === "fire" && !low) {
        const g2 = ctx.createRadialGradient(cx, cy + 20, 4, cx, cy + 20, 160);
        g2.addColorStop(0, "#ffaa3088");
        g2.addColorStop(1, "transparent");
        ctx.fillStyle = g2;
        ctx.fillRect(cx - 180, cy - 160, 360, 320);
      }
      if (elem === "wind" && !low) {
        ctx.save();
        ctx.globalAlpha = 0.18 + pulse * 0.12;
        ctx.strokeStyle = pal.fill[1];
        ctx.lineWidth = 3;
        for (let i = 0; i < 5; i++) {
          const yy = h * (0.28 + i * 0.1);
          ctx.beginPath();
          ctx.moveTo(0, yy);
          for (let x = 0; x <= w; x += 24) {
            ctx.lineTo(x, yy + Math.sin(x * 0.02 + elapsed * 8 + i) * 14);
          }
          ctx.stroke();
        }
        ctx.restore();
      }

      parts.forEach(p => {
        p.age += dt;
        if (p.age < 0) return;
        p.vy += (p.grav || 0) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.ang += p.spin * dt;
        if (elem === "dark" && p.age > 0.35) {
          // reverse to outward bloom
          p.vx += (p.x - cx) * 0.8 * dt;
          p.vy += (p.y - cy) * 0.8 * dt;
        }
        const k = Math.max(0, 1 - p.age / p.life);
        if (k <= 0) return;
        ctx.globalAlpha = k;
        drawPart(ctx, p, k);
      });
      ctx.globalAlpha = 1;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return {
      stop() {
        dead = true;
        try { ctx.clearRect(0, 0, w, h); } catch (e) {}
      }
    };
  }

  function cssFallback(stage, elem, kind) {
    if (!stage) return;
    const ring = document.createElement("div");
    ring.className = "cast-ring fx-" + elem;
    stage.appendChild(ring);
    if (kind === "aoe" || elem === "earth") {
      for (let i = 0; i < 6; i++) {
        const rock = document.createElement("div");
        rock.className = "rock";
        rock.style.left = (12 + Math.random() * 70) + "%";
        rock.style.animationDelay = (i * 0.06) + "s";
        stage.appendChild(rock);
      }
    }
    if (elem === "wind" || kind === "control") {
      const v = document.createElement("div");
      v.className = "vortex";
      stage.appendChild(v);
    }
    if (elem === "dark" || kind === "kill") {
      const hole = document.createElement("div");
      hole.className = "hole";
      stage.appendChild(hole);
    }
    if (elem === "light" || kind === "buff") {
      const aura = document.createElement("div");
      aura.className = "aura";
      stage.appendChild(aura);
    }
    if (elem === "water") {
      const shock = document.createElement("div");
      shock.className = "shock";
      stage.appendChild(shock);
    }
    if (elem === "fire") {
      const shock = document.createElement("div");
      shock.className = "shockwave";
      stage.appendChild(shock);
    }
    for (let i = 0; i < (kind === "aoe" ? 18 : 12); i++) {
      const d = document.createElement("div");
      d.className = "fx-spark fx-" + elem;
      d.style.left = (10 + Math.random() * 80) + "%";
      d.style.top = (20 + Math.random() * 55) + "%";
      d.style.animationDelay = (i * 0.03) + "s";
      stage.appendChild(d);
    }
  }

  function play(card, opts) {
    opts = opts || {};
    return new Promise(async resolve => {
      const layer = ensureLayer();
      const stage = document.getElementById("fxStage");
      const fxCard = document.getElementById("fxCard");
      const game = document.getElementById("game");
      const kind = spellKind(card);
      const elem = elemOf(card);
      const low = lowSpec();
      // v0.352: fetch pack meta + warm projectile assets during the card showcase
      loadSpellMeta(card && card.id).then(m => {
        if (isCanvasMeta(m)) preloadMetaFx(m, ASSET_BASE + (m.id || card.id) + "/");
        return m;
      }, () => null);
      try {
        if (stage) { stage.innerHTML = ""; stage.dataset.elem = elem; stage.dataset.kind = kind; }
        layer.classList.add("on");
        layer.dataset.elem = elem;
        layer.dataset.kind = kind;
        const veil = layer.querySelector(".fx-veil");
        if (veil) veil.style.setProperty("background", "transparent", "important");

        let faceSrc = "";
        try {
          faceSrc = await Promise.race([
            resolveFace(card),
            new Promise(r => setTimeout(() => r(""), 300))
          ]);
        } catch (e) { faceSrc = ""; }
        paintCard(faceSrc || "", card.name || "");
        if (fxCard) {
          fxCard.classList.remove("out");
          fxCard.style.opacity = "";
          fxCard.classList.add("in");
        }
        await new Promise(r => setTimeout(r, 650));

        if (fxCard) {
          fxCard.classList.add("out");
          await new Promise(r => setTimeout(r, 220));
          fxCard.style.opacity = "0";
        }

        const usedPack = await playAssetPack(card, layer, stage, opts);
        if (!usedPack) {
          try { Sfx.playCardDrop && Sfx.playCardDrop(); } catch (e) {}
          let handle = null;
          if (low) cssFallback(stage, elem, kind);
          else {
            handle = burst(elem, kind, false);
            if (kind === "aoe" || kind === "kill" || kind === "earthquake") {
              cssFallback(stage, elem, kind);
            }
          }
          if ((kind === "aoe" || kind === "earthquake" || elem === "earth") && game) {
            game.classList.add("quake");
          }
          await new Promise(r => setTimeout(r, Math.max(900, T.vfx)));
          if (handle) handle.stop();
          if (game) game.classList.remove("quake");
        }
      } finally {
        cleanupFx(layer, stage, fxCard);
        resolve();
      }
    });
  }

  // ─── v0.364 매치 연출 v2: 알파 비디오 오버레이(overlay.webm) + 공용 dim 레이어 ───
  // dim = 오버레이 아래·전장 위의 검은 레이어 (pointer-events:none, 클릭 막지 않음).
  // meta.dim(doInCode!==false && opacity>0)이 있으면 그 값·시간, 없으면 기본값:
  // 불투명도 0.4 (turn_start_me 0.3) · 150ms 페이드인 · 애니 페이드아웃 구간에 맞춰 페이드아웃.
  // meta.dim.fadeOut 이 있으면 그대로 페이드아웃(v2 승리·패배: 1350→1800ms, 이후 결과 화면).
  // meta.dim.fadeOut === null 이거나 meta dim 없는 구형 victory/defeat 팩만 결과 화면까지 유지 (hideScreens → releaseDim).
  const DIM_DEFAULT_OPACITY = 0.4;
  const DIM_DEFAULT_BY_ID = { turn_start_me: 0.3 };
  const DIM_DEFAULT_FADE_IN_MS = 150;
  const DIM_HOLD_IDS = { victory: true, defeat: true };
  function isVideoPackMeta(meta) {
    return !!(meta && meta.overlay && typeof meta.overlay.file === "string" && /\.webm$/i.test(meta.overlay.file));
  }
  function packFadeOutWindow(meta) {
    const dur = (meta && meta.durationMs) || 1500;
    const fo = meta && meta.fadeOut;
    if (fo && fo.startMs != null && fo.endMs != null) return [fo.startMs, fo.endMs];
    const tl = meta && meta.timelineMs && meta.timelineMs.fadeOutMs;
    if (Array.isArray(tl) && tl.length === 2) return [tl[0], tl[1]];
    return [Math.max(0, dur - 300), dur];
  }
  /** 순수 함수 (테스트용): 연출 id + meta + opts → dim 타임라인. null = dim 없음 */
  function resolveDim(id, meta, opts) {
    opts = opts || {};
    if (opts.dim === false) return null;
    const dur = (meta && meta.durationMs) || 1500;
    const d = meta && meta.dim;
    const useMeta = !!(d && d.doInCode !== false && typeof d.opacity === "number" && d.opacity > 0);
    const opacity = useMeta ? d.opacity
      : (typeof opts.dimOpacity === "number" ? opts.dimOpacity
        : (DIM_DEFAULT_BY_ID[id] != null ? DIM_DEFAULT_BY_ID[id] : DIM_DEFAULT_OPACITY));
    if (!(opacity > 0)) return null;
    let fadeInStartMs = 0, fadeInEndMs = DIM_DEFAULT_FADE_IN_MS;
    if (useMeta && d.fadeIn && d.fadeIn.endMs != null) {
      fadeInStartMs = d.fadeIn.startMs || 0;
      fadeInEndMs = d.fadeIn.endMs;
    }
    const hold = opts.holdDim != null ? !!opts.holdDim
      : (useMeta ? d.fadeOut === null : !!DIM_HOLD_IDS[id]);
    let fadeOutStartMs = null, fadeOutEndMs = null;
    if (!hold) {
      if (useMeta && d.fadeOut && d.fadeOut.endMs != null) {
        fadeOutStartMs = d.fadeOut.startMs;
        fadeOutEndMs = d.fadeOut.endMs;
      } else {
        const w = packFadeOutWindow(meta);
        fadeOutStartMs = w[0];
        fadeOutEndMs = w[1];
      }
    }
    return {
      color: (useMeta && d.color) || "#000000",
      opacity, fadeInStartMs, fadeInEndMs, fadeOutStartMs, fadeOutEndMs, hold,
      durationMs: dur, fromMeta: useMeta
    };
  }
  /** Safari: VP9 알파 webm 미지원(검은 배경) → overlay_safari.webp(애니 WebP 알파) + sfx.mp3 (sfx/bgm의 EXTS 폴백과 같은 방식) */
  function needsSafariFallback() {
    try {
      const ua = navigator.userAgent || "";
      const isSafari = /Safari\//.test(ua) && !/(Chrome|Chromium|CriOS|Edg|OPR|Android|FxiOS|Firefox)\//.test(ua);
      if (isSafari) return true;
      const v = document.createElement("video");
      return !(v.canPlayType && v.canPlayType('video/webm; codecs="vp09.00.10.08"'));
    } catch (e) { return true; }
  }
  function ensureMatchLayer() {
    let layer = document.getElementById("matchFx");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "matchFx";
      layer.innerHTML = '<div class="mfx-dim" id="matchDim"></div><div class="mfx-stage" id="matchStage"></div>';
      document.body.appendChild(layer);
    }
    layer.style.pointerEvents = "none";
    return layer;
  }
  let _dimTimers = [];
  let _dimToken = 0;
  function clearDimTimers() { _dimTimers.forEach(t => clearTimeout(t)); _dimTimers = []; }
  function dimTo(el, opacity, ms, easing) {
    el.style.transition = ms > 0 ? ("opacity " + ms + "ms " + (easing || "ease-out")) : "none";
    el.style.opacity = String(opacity);
  }
  /** dim 타임라인 시작 (t0 = 애니 첫 프레임). hold면 releaseDim()까지 유지 */
  function startDim(dim) {
    const layer = ensureMatchLayer();
    const el = document.getElementById("matchDim");
    clearDimTimers();
    const token = ++_dimToken;
    layer.classList.remove("held");
    layer.classList.add("on");
    if (!dim) { dimTo(el, 0, 0); return token; }
    el.style.background = dim.color || "#000";
    const cur = parseFloat(getComputedStyle(el).opacity) || 0;
    dimTo(el, cur, 0);
    void el.offsetWidth;
    const fin = () => dimTo(el, dim.opacity, Math.max(0, dim.fadeInEndMs - dim.fadeInStartMs), "cubic-bezier(.33,1,.68,1)");
    if (dim.fadeInStartMs > 0) _dimTimers.push(setTimeout(fin, dim.fadeInStartMs)); else fin();
    if (!dim.hold && dim.fadeOutStartMs != null) {
      _dimTimers.push(setTimeout(() => {
        if (token === _dimToken) dimTo(el, 0, Math.max(0, dim.fadeOutEndMs - dim.fadeOutStartMs), "ease-in-out");
      }, dim.fadeOutStartMs));
    }
    return token;
  }
  /** 결과 화면이 닫힐 때(hideScreens) 호출: 유지 중인 dim·마지막 프레임 해제 */
  function releaseDim(ms) {
    const layer = document.getElementById("matchFx");
    if (!layer || !layer.classList.contains("held")) return false;
    const el = document.getElementById("matchDim");
    const stage = document.getElementById("matchStage");
    const token = ++_dimToken;
    clearDimTimers();
    if (stage) stage.innerHTML = "";
    if (el) dimTo(el, 0, ms == null ? 250 : ms, "ease-in-out");
    _dimTimers.push(setTimeout(() => {
      if (token !== _dimToken) return;
      layer.classList.remove("on", "held");
    }, (ms == null ? 250 : ms) + 30));
    return true;
  }
  function pickMatchSfxUrl(base, meta) {
    const file = (meta && meta.sfx && meta.sfx.file) || "sfx.ogg";
    const ogg = assetUrl(base, file);
    const mp3 = assetUrl(base, file.replace(/\.ogg$/i, ".mp3"));
    if (typeof Sfx === "undefined" || !Sfx.loadUrl) return Promise.resolve(null);
    return Sfx.loadUrl(ogg).then(buf => (buf ? ogg : (mp3 !== ogg ? Sfx.loadUrl(mp3).then(b => (b ? mp3 : null)) : null)), () => null);
  }
  function waitEvent(el, names, ms) {
    return new Promise(res => {
      let done = false;
      const fin = (v) => { if (done) return; done = true; names.forEach(n => el.removeEventListener(n, h)); res(v); };
      const h = (e) => fin(e.type);
      names.forEach(n => el.addEventListener(n, h));
      setTimeout(() => fin("timeout"), ms);
    });
  }
  /** 매치 팩 사전 로드 (비디오 캐시 + sfx 디코드) */
  async function preloadMatch(id) {
    try {
      const meta = await loadPackMeta("match", id);
      if (!isVideoPackMeta(meta)) return false;
      const base = packBase("match", id);
      const file = needsSafariFallback() ? (meta.overlay.safariFile || "overlay_safari.webp") : meta.overlay.file;
      await Promise.all([fetch(assetUrl(base, file), { cache: "force-cache" }).then(r => r.blob()).catch(() => null), pickMatchSfxUrl(base, meta)]);
      return true;
    } catch (e) { return false; }
  }
  const _sleep = (ms) => new Promise(r => setTimeout(r, ms));
  async function _playVideoPack(kind, id, meta, base, opts) {
    const dur = meta.durationMs || 1500;
    const layer = ensureMatchLayer();
    const stage = document.getElementById("matchStage");
    // 이전 판에서 유지 중이던 dim/마지막 프레임 정리
    if (stage) stage.innerHTML = "";
    const safari = needsSafariFallback();
    let visual = null;
    let video = null;
    if (!safari) {
      video = document.createElement("video");
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "");
      video.setAttribute("muted", "");
      video.preload = "auto";
      video.className = "mfx-overlay";
      video.src = assetUrl(base, meta.overlay.file);
      visual = video;
    } else {
      const sf = meta.overlay.safariFile || "overlay_safari.webp";
      const url = assetUrl(base, sf);
      if (await probeUrl(url)) {
        const img = new Image();
        img.className = "mfx-overlay";
        img.alt = "";
        img.decoding = "async";
        img.src = url + (url.indexOf("?") >= 0 ? "&" : "?") + "r=" + Date.now(); // 애니 WebP 처음부터 재생
        visual = img;
      }
    }
    const sfxP = opts.sound === false ? Promise.resolve(null) : pickMatchSfxUrl(base, meta);
    if (visual && stage) {
      visual.style.opacity = "0";
      stage.appendChild(visual);
      if (video) {
        try { video.load(); } catch (e) {}
        await waitEvent(video, ["canplaythrough", "canplay", "error"], 700);
      } else {
        await (visual.decode ? visual.decode().catch(() => {}) : Promise.resolve());
      }
    }
    const sfxUrl = await Promise.race([sfxP, _sleep(400).then(() => null)]);
    let ok = !!visual;
    if (video) {
      try { await video.play(); } catch (e) { ok = false; }
      if (!ok) { try { video.remove(); } catch (e) {} visual = null; }
    }
    if (visual) visual.style.opacity = "1";
    // t0: 비디오·dim·사운드 동시 시작
    const dim = resolveDim(id, meta, opts);
    startDim(dim);
    if (sfxUrl && typeof Sfx !== "undefined" && Sfx.playUrl) {
      try { Sfx.playUrl(sfxUrl, { duckMs: dur }); } catch (e) {}
    }
    if (video && ok) await Promise.race([waitEvent(video, ["ended"], dur + 250), _sleep(dur + 250)]);
    else await _sleep(dur);
    if (dim && dim.hold) {
      // 결과 화면까지 유지: 모달(.overlay z20) 아래로 내림. 마지막 프레임이 실제로 보이는 팩(lastFrameAlphaMax≥128)만 남김
      // (DEFEAT v2 처럼 알파 2/255 잔상만 남는 팩은 제거)
      layer.classList.add("held");
      if (!(meta.lastFrameAlphaMax >= 128) && stage) stage.innerHTML = "";
    } else {
      if (stage && visual && visual.parentNode === stage) stage.removeChild(visual);
      const tailMs = dim && dim.fadeOutEndMs != null ? Math.max(0, dim.fadeOutEndMs - dur) : 0;
      const token = _dimToken;
      _dimTimers.push(setTimeout(() => {
        if (token === _dimToken && !layer.classList.contains("held")) layer.classList.remove("on");
      }, tailMs + 40));
    }
    return ok;
  }

  let _packQueue = Promise.resolve();

  async function _playPackInner(kind, id, opts) {
    opts = opts || {};
    if (!kind || !id) return false;
    const meta = await loadPackMeta(kind, id);
    const base = packBase(kind, id);
    // v0.364: 매치 팩 v2 = 알파 비디오 오버레이 + 공용 dim
    if (isVideoPackMeta(meta)) return _playVideoPack(kind, id, meta, base, opts);
    const fps = (meta && meta.fps) || 12;
    const layoutHint = (meta && meta.layout) || opts.layout || null;
    const cast = (meta && meta.cast) || {};
    const hit = (meta && (meta.impact || meta.aoe)) || {};
    const castFrames = cast.frames || 12;
    const hitFrames = hit.frames || 8;
    const castW = cast.w || 720, castH = cast.h || 720;
    const hitW = hit.w || 720, hitH = hit.h || 720;
    const castStrip = assetUrl(base, "cast_strip.png");
    const hitStripName = (meta && meta.aoe) ? "aoe_strip.png" : "impact_strip.png";
    const hitStrip = assetUrl(base, hitStripName);

    const layer = ensureLayer();
    const stage = document.getElementById("fxStage");
    const fxCard = document.getElementById("fxCard");
    let matchDim = null;
    try {
      if (fxCard) {
        fxCard.innerHTML = "";
        fxCard.classList.remove("in", "out");
        fxCard.style.opacity = "0";
      }
      const lab = document.getElementById("fxName");
      if (lab) {
        // Combat packs: hide concept labels (opts.label only)
        // v0.357: opts.label === "" → 문구 없음 (턴 시작 등). 없을 때만 팩 이름/concept로 대체
        const hasLabel = Object.prototype.hasOwnProperty.call(opts, "label");
        const fxLabel = (kind === "combat" || hasLabel)
          ? (opts.label || "")
          : ((meta && (meta.name || meta.concept)) || "");
        lab.textContent = fxLabel;
        lab.style.opacity = lab.textContent ? "1" : "0";
      }
      layer.classList.add("on", "pack-play");
      layer.style.display = "";
      // v0.364: 구형(스트립) 매치 팩(승리·패배 최종본 대기)도 공용 dim — 결과 화면까지 유지
      if (kind === "match") { matchDim = resolveDim(id, meta, opts); startDim(matchDim); }
      const veil = layer.querySelector(".fx-veil");
      if (veil) veil.style.setProperty("background", "transparent", "important");
      // Keep stage until first strip mounts (avoid mid-spell blank flash)

      const anchorPt = pointFromOpts(opts);
      const stripOptsBase = anchorPt
        ? { anchor: anchorPt, boxSize: opts.boxSize || 220 }
        : {};

      let played = false;
      // Strip-first only — never fall back to empty/chroma webp.
      // Pack VFX at 2× speed (half duration); size via CSS .pack-play
      const packFps = Math.max(1, fps) * 2;
      const hasHit = await probeUrl(hitStrip);
      if (await probeUrl(castStrip)) {
        const castOpts = Object.assign({}, stripOptsBase, { softEnd: !!hasHit });
        await playStrip(stage, castStrip, castW, castH, castFrames, packFps, layoutHint, castOpts);
        played = true;
      }
      if (hasHit) {
        await playStrip(stage, hitStrip, hitW, hitH, hitFrames, packFps, layoutHint, stripOptsBase);
        played = true;
      }
      return played;
    } finally {
      cleanupFx(layer, stage, fxCard);
      if (layer) layer.classList.remove("pack-play");
      if (kind === "match") {
        const ml = document.getElementById("matchFx");
        if (ml && matchDim && matchDim.hold) ml.classList.add("held");
        else if (ml) { const el = document.getElementById("matchDim"); if (el) dimTo(el, 0, 250, "ease-in-out"); setTimeout(() => { if (!ml.classList.contains("held")) ml.classList.remove("on"); }, 300); }
      }
    }
  }

  // Disabled overlay packs: mute instantly (no queue, no play)
  const PACK_MUTE_IDS = {
    ui: { deck_draw: true, hero_intro: true }
  };
  function isPackMuted(kind, id) {
    if (kind === "coins") return true; // all coin packs
    const map = PACK_MUTE_IDS[kind];
    return !!(map && id && map[id]);
  }

  function playPack(kind, id, opts) {
    opts = opts || {};
    // Early-resolve before enqueue so muted packs never block the queue
    if (isPackMuted(kind, id)) return Promise.resolve(false);
    const run = () => _playPackInner(kind, id, opts);
    if (opts.skipQueue) return run();
    const p = _packQueue.then(run, run);
    _packQueue = p.catch(() => {});
    return p;
  }
  function playUi(id, opts) { return playPack("ui", id, opts); }
  function playCombat(id, opts) { return playPack("combat", id, opts); }
  function playCoin(id, opts) { return Promise.resolve(false); }
  function playItem(id, opts) { return playPack("items", id, opts); }
  function playMatch(id, opts) { return playPack("match", id, opts); }

  function cleanupFx(layer, stage, fxCard) {
    if (layer) layer.classList.remove("on");
    if (stage) stage.innerHTML = "";
    if (fxCard) {
      fxCard.innerHTML = "";
      fxCard.classList.remove("in", "out");
      fxCard.style.opacity = "";
    }
    const lab = document.getElementById("fxName");
    if (lab) { lab.textContent = ""; lab.style.opacity = ""; }
  }

  function clear() {
    const layer = document.getElementById("spellFx");
    const stage = document.getElementById("fxStage");
    const fxCard = document.getElementById("fxCard");
    cleanupFx(layer, stage, fxCard);
    if (layer) {
      layer.classList.remove("on", "pack-play");
      layer.style.display = "none";
      // restore stylesheet control next frame
      requestAnimationFrame(() => { try { layer.style.display = ""; } catch (e) {} });
    }
  }

  return { play, clear, T, playProjectile, preloadProjectile, isProjectileMeta, playOverlayPerUnit, preloadOverlay, isOverlayMeta, playPerUnitFlow, preloadFlow, isFlowMeta, playAnchored, preloadAnchored, isAnchoredMeta, playMetaFx, preloadMetaFx, aoeUnitPoints, elemOf, spellKind, playPack, playUi, playCombat, playCoin, playItem, playMatch, resolveFxAnchor, pointFromOpts, resolveDim, releaseDim, preloadMatch, isVideoPackMeta, needsSafariFallback };
})();
window.SpellFx = SpellFx;
