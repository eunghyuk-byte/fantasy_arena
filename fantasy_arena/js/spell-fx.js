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
  // E) meta.playMode "duelKeep"  (fs9 일기토, v0.371)
  //   keep: { file, frames, w, h, fps, durationMs, displayBoxPx@1080p, anchorOffsetYPx@1080p } → 생존 유닛마다
  //   kill: { ... , delay: { baseMs, perPx@1080p, origin: "center" } } → 양쪽 보드의 나머지 유닛마다
  //   생존 uid는 게임이 효과 전에 정해 opts.keepUids로 넘기고, 같은 uid로 해결한다 (연출 = 실제 결과)
  // F) meta.playMode "summon"  (es9 팔진도, v0.371)
  //   formation: { file, frames, w, h, fps, durationMs, displayWidthPx@1080p, squashY } → 새 토큰 자리 중점에 납작한 타원
  //   rise: { file, ..., displayBoxPx@1080p, anchorOffsetYPx@1080p, startMs, staggerMs, tokenFadeIn: { startMs, durationMs },
  //           solidReveal: { durationMs } } → 토큰마다. 게임은 opts.resolveNow()로 먼저 해결하고 새 토큰 uid를 돌려준다
  //   v0.376 (fs10 재폭풍): 높이 = 폭 × squashY × (프레임 h/w) · formation.handGuard { fadePx@1080p } → 손패 앞에서 formation만 페이드
  // B 추가) overlay.fitBox { sizePx@1080p, anchor: "targetBoard", offsetYPx@1080p } · unitImpact.delay.staggerMs (X 순서) (as9)
  // B 추가) unitImpact.delay.origin "corner" (+corner, metric "manhattan", minMs, mirrorYWhenOppCasts) ·
  //   overlay.opacity (0~1) · overlay.flipYWhenOppCasts  (v0.371 ns9 동남풍)
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
  function isDuelKeepMeta(meta) {
    return !!(meta && String(meta.playMode || "") === "duelKeep" && meta.keep && meta.keep.file && meta.kill && meta.kill.file);
  }
  function isSummonMeta(meta) {
    return !!(meta && String(meta.playMode || "") === "summon" && meta.formation && meta.formation.file && meta.rise && meta.rise.file);
  }
  function isCanvasMeta(meta) { return isProjectileMeta(meta) || isOverlayMeta(meta) || isFlowMeta(meta) || isAnchoredMeta(meta) || isDuelKeepMeta(meta) || isSummonMeta(meta); }
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
  function preloadDuelKeep(meta, base) {
    if (!isDuelKeepMeta(meta)) return Promise.resolve(null);
    const K = meta.keep, X = meta.kill;
    return Promise.all([
      loadFrames(assetUrl(base, K.file), K.frames, K.w, K.h, K.layout),
      loadFrames(assetUrl(base, X.file), X.frames, X.w, X.h, X.layout),
      loadSfx(metaSfxUrl(meta, base))
    ]);
  }
  function preloadSummon(meta, base) {
    if (!isSummonMeta(meta)) return Promise.resolve(null);
    const F = meta.formation, R = meta.rise;
    return Promise.all([
      loadFrames(assetUrl(base, F.file), F.frames, F.w, F.h, F.layout),
      loadFrames(assetUrl(base, R.file), R.frames, R.w, R.h, R.layout),
      loadSfx(metaSfxUrl(meta, base))
    ]);
  }
  function preloadMetaFx(meta, base) {
    if (isProjectileMeta(meta)) return preloadProjectile(meta, base);
    if (isSummonMeta(meta)) return preloadSummon(meta, base);
    if (isDuelKeepMeta(meta)) return preloadDuelKeep(meta, base);
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
  function unitDelayMs(U, pt, k, opts) {
    const d = (U && U.delay) || {};
    const base = d.baseMs != null ? d.baseMs : 0;
    const per = d["perPx@1080p"] != null ? d["perPx@1080p"] : 0;
    let dist;
    if (d.origin === "corner") {
      // v0.371 ns9: 화면 모서리에서 쓸고 지나가는 지연 (기본 오른쪽 아래, manhattan = |dx|+|dy|).
      // mirrorYWhenOppCasts: 상대가 쓰면 오버레이와 같이 위아래 반전 → 오른쪽 위 모서리 기준
      const cw = window.innerWidth || 1920, ch = window.innerHeight || 1080;
      let cn = String(d.corner || "bottomRight");
      if (d.mirrorYWhenOppCasts && opts && opts.casterIsMe === false) cn = cn.indexOf("bottom") === 0 ? cn.replace("bottom", "top") : cn.replace("top", "bottom");
      const cx = /Left$/.test(cn) ? 0 : cw, cy = cn.indexOf("top") === 0 ? 0 : ch;
      const dx = Math.abs(pt.x - cx), dy = Math.abs(pt.y - cy);
      dist = d.metric === "manhattan" ? dx + dy : Math.hypot(dx, dy);
    } else {
      const c = screenCenter();
      dist = d.axis === "x" ? Math.abs(pt.x - c.x) : d.axis === "y" ? Math.abs(pt.y - c.y) : Math.hypot(pt.x - c.x, pt.y - c.y);
    }
    const ms = base + per * dist / (k || 1);
    return d.minMs != null ? Math.max(d.minMs, ms) : ms;
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
    // v0.371: overlay.opacity (선택, 0~1) · overlay.flipYWhenOppCasts (상대 시전이면 위아래 반전)
    const oAlpha = O && O.opacity != null ? Math.max(0, Math.min(1, +O.opacity || 0)) : 1;
    const oFlip = !!(O && O.flipYWhenOppCasts && opts.casterIsMe === false);
    // v0.371 as9: overlay.fitBox → 대상 보드 중심에 고정 크기 상자 (없으면 화면 전체)
    let oBox = null;
    if (O && O.fitBox) {
      const F = O.fitBox, sz = F["sizePx@1080p"] || [1280, 720];
      const c = F.anchor === "casterBoard" ? casterBoardCenter(opts.casterIsMe) : casterBoardCenter(opts.casterIsMe === false ? true : false);
      const oy = (F["offsetYPx@1080p"] || 0) * k * (oFlip ? -1 : 1);
      oBox = { w: sz[0] * k, h: sz[1] * k };
      oBox.x = c.x - oBox.w / 2; oBox.y = c.y + oy - oBox.h / 2;
    }
    const hits = [];
    let uDur = 0, uFps = 30, uN = 1, uBox = 0, uOffY = 0;
    if (U) {
      uDur = U.durationMs || 500;
      uFps = U.fps || meta.fps || 30;
      uN = Math.max(1, U.frames || 1);
      uBox = (U["displayBoxPx@1080p"] || 300) * k;
      uOffY = (U["anchorOffsetYPx@1080p"] || 0) * k;
      const upts = (opts.points || aoeUnitPoints(meta.targetMode || "aoe_all", opts.casterIsMe)).slice();
      const st = U.delay && U.delay.staggerMs != null ? U.delay : null;
      // v0.371 as9: delay.staggerMs → 화면 X 순서(왼→오)로 baseMs + i*staggerMs
      if (st) upts.sort((a, b) => a.x - b.x);
      upts.forEach((pt, i) => {
        hits.push({ x: pt.x, y: pt.y + uOffY, at: st ? (st.baseMs || 0) + i * st.staggerMs : unitDelayMs(U, pt, k, opts) });
      });
    }
    const endMs = Math.max(O ? oStart + oDur : 0, hits.reduce((m, h) => Math.max(m, h.at + uDur), 0));
    return runCanvasFx(stage, endMs, metaSfxUrl(meta, base), S.startMs, (ctx, t, cw, ch) => {
      if (O) {
        const to = t - oStart;
        if (to >= 0 && to < oDur && oAlpha > 0) {
          ctx.save();
          ctx.globalAlpha = oAlpha;
          const bx = oBox ? oBox.x : 0, by = oBox ? oBox.y : 0, bw = oBox ? oBox.w : cw, bh = oBox ? oBox.h : ch;
          if (oFlip) { ctx.translate(0, 2 * by + bh); ctx.scale(1, -1); }
          drawFrame(ctx, ovFr, Math.min(oN - 1, Math.floor(to * oFps / 1000)), bx, by, bw, bh);
          ctx.restore();
        }
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
  /**
   * v0.371 duelKeep player (fs9 일기토): 살아남을 유닛(uid)을 효과 전에 정해서 받는다.
   * keep 레이어 = 생존 유닛마다(양쪽, 최대 2) · kill 레이어 = 양쪽 보드의 나머지 유닛마다 각자 지연.
   * @param opts { keepUids: [uid...], sound?: bool }  (keepUids 없으면 전부 kill)
   */
  async function playDuelKeep(stage, meta, base, opts) {
    opts = opts || {};
    if (!stage || !isDuelKeepMeta(meta)) return false;
    const [kFr, xFr] = await preloadDuelKeep(meta, base);
    if (!kFr && !xFr) return false;
    const K = meta.keep, X = meta.kill, S = meta.sfx || {};
    const k = fxScale();
    const keepSet = new Set((opts.keepUids || []).map(String));
    const pts = opts.points || aoeUnitPoints(meta.targetMode || "aoe_all", opts.casterIsMe);
    const layer = (L, fr) => ({
      fr, dur: L.durationMs || Math.round((L.frames || 1) * 1000 / (L.fps || 30)), fps: L.fps || meta.fps || 30,
      n: Math.max(1, L.frames || 1), box: (L["displayBoxPx@1080p"] || 320) * k, offY: (L["anchorOffsetYPx@1080p"] || 0) * k, start: L.startMs || 0
    });
    const KL = kFr ? layer(K, kFr) : null, XL = xFr ? layer(X, xFr) : null;
    const keeps = [], kills = [];
    pts.forEach(pt => {
      if (keepSet.has(String(pt.uid))) { if (KL) keeps.push({ x: pt.x, y: pt.y + KL.offY, at: KL.start }); }
      else if (XL) kills.push({ x: pt.x, y: pt.y + XL.offY, at: XL.start + unitDelayMs(X, pt, k, opts) });
    });
    if (!keeps.length && !kills.length) return false;
    const endMs = Math.max(
      keeps.reduce((m, h) => Math.max(m, h.at + KL.dur), 0),
      kills.reduce((m, h) => Math.max(m, h.at + XL.dur), 0));
    const drawSet = (ctx, t, L, list) => {
      const bw = L.box, bh = L.box * L.fr.h / L.fr.w;
      list.forEach(h => {
        const ti = t - h.at;
        if (ti < 0 || ti >= L.dur) return;
        drawFrame(ctx, L.fr, Math.min(L.n - 1, Math.floor(ti * L.fps / 1000)), h.x - bw / 2, h.y - bh / 2, bw, bh);
      });
    };
    return runCanvasFx(stage, endMs, metaSfxUrl(meta, base), S.startMs, (ctx, t) => {
      if (XL) drawSet(ctx, t, XL, kills);   // 불꽃 장막 (나머지)
      if (KL) drawSet(ctx, t, KL, keeps);   // 스포트라이트 (생존) — 위에
    }, opts);
  }
  // v0.371 summon: 새 토큰을 연출 동안 숨겼다가 드러내기. render()로 DOM이 다시 만들어져도 유지되게 uid 선택자 스타일로 처리
  const _hidden = {};
  function hideStyleEl() {
    let st = document.getElementById("spellFxHide");
    if (!st) {
      st = document.createElement("style");
      st.id = "spellFxHide";
      (document.head || document.body).appendChild(st);
    }
    return st;
  }
  function syncHideStyle() {
    let css = "";
    const kfs = {};
    Object.keys(_hidden).forEach(uid => {
      const h = _hidden[uid], sel = '.minion[data-uid="' + String(uid).replace(/"/g, "") + '"]';
      if (h.state === "hide") { css += sel + "{opacity:0!important;}"; return; }
      const pct = Math.max(1, Math.min(99, Math.round(h.fadeMs / h.total * 100)));
      let name = "fxTokenReveal" + pct;
      if (h.brightnessFrom != null || h.scaleFrom != null) {
        // v0.381 legendarySummon summonedReveal: brightnessFrom·scaleFrom 에서 fade 후 pop 으로 1 복귀 (ease-out)
        const b = h.brightnessFrom != null ? h.brightnessFrom : 1.8, sc = h.scaleFrom != null ? h.scaleFrom : 1.08;
        name = "fxUnitReveal" + pct + "_" + Math.round(b * 100) + "_" + Math.round(sc * 100);
        kfs[name] = "@keyframes " + name + "{0%{opacity:0;filter:brightness(" + b + ");scale:" + sc + "}" + pct +
          "%{opacity:1;filter:brightness(" + b + ");scale:" + sc + ";animation-timing-function:cubic-bezier(.33,1,.68,1)}100%{opacity:1;filter:brightness(1);scale:1}}";
      } else kfs[name] = "@keyframes " + name + "{0%{opacity:0;filter:brightness(1.9);scale:.94}" + pct +
        "%{opacity:1;filter:brightness(1.7);scale:1.06}100%{opacity:1;filter:brightness(1);scale:1}}";
      css += sel + "{animation:" + name + " " + h.total + "ms linear both;}";
    });
    hideStyleEl().textContent = Object.values(kfs).join("") + css;
  }
  function hideUnits(uids) {
    (uids || []).forEach(u => { _hidden[u] = { state: "hide" }; });
    syncHideStyle();
  }
  /** 토큰 드러내기: fadeMs 동안 나타나고 popMs 동안 실제 카드가 단단하게 튀어 보임(밝기·크기 복귀) */
  function revealUnit(uid, fadeMs, popMs, look) {
    if (!_hidden[uid]) return;
    const total = Math.max(1, (fadeMs || 0) + (popMs || 0));
    _hidden[uid] = { state: "reveal", fadeMs: fadeMs || 0, total };
    if (look) { _hidden[uid].brightnessFrom = look.brightnessFrom; _hidden[uid].scaleFrom = look.scaleFrom; }
    syncHideStyle();
    setTimeout(() => { if (_hidden[uid] && _hidden[uid].state === "reveal") { delete _hidden[uid]; syncHideStyle(); } }, total + 30);
  }
  function releaseHidden() {
    const any = Object.keys(_hidden).length;
    Object.keys(_hidden).forEach(u => delete _hidden[u]);
    if (any) syncHideStyle();
  }
  /** v0.376 summon formation 크기: 폭 displayWidthPx × squashY × (프레임 h/w). es9 448² ×0.72 → 520×374 · fs10 640×360 ×1.0 → 900×506 */
  function summonFormationBox(meta, k, fr) {
    const F = (meta && meta.formation) || {};
    const fw = (F["displayWidthPx@1080p"] || 520) * (k || 1);
    const w = (fr && fr.w) || F.w || 1, h = (fr && fr.h) || F.h || w;
    const sq = (F.squashY != null && F.squashY > 0) ? F.squashY : 1;
    return { fw, fh: fw * sq * (h / w) };
  }
  /**
   * v0.376 formation.handGuard { "fadePx@1080p" }: 시전자 손패 쪽으로 번지는 formation(폭풍 띠)을 손패 카드 윗선(상대면 아랫선) 앞에서
   * 부드럽게 지움 — 손패 레이아웃은 그대로, 연출 캔버스에서만. meta에 없으면 null (es9 등 기존 동작 그대로)
   * @returns { edge, fade, below } below=true: edge 아래(내 손패)를 지움 · false: edge 위(상대 손패)를 지움
   */
  function summonHandGuard(meta, casterIsMe, k) {
    const G = meta && meta.formation && meta.formation.handGuard;
    if (!G) return null;
    const fade = (G["fadePx@1080p"] != null ? G["fadePx@1080p"] : 70) * (k || 1);
    const opp = casterIsMe === false;
    const cards = [...document.querySelectorAll(opp ? "#oppHand > *" : "#myHand .card")]
      .map(el => el.getBoundingClientRect()).filter(r => r && r.width > 2 && r.height > 2);
    const hand = document.getElementById(opp ? "oppHand" : "myHand");
    const hr = hand && hand.getBoundingClientRect();
    let edge = null;
    if (cards.length) edge = opp ? Math.max(...cards.map(r => r.bottom)) : Math.min(...cards.map(r => r.top));
    else if (hr && hr.height > 2) edge = opp ? hr.bottom : hr.top;
    if (edge == null) return null;
    return { edge, fade, below: !opp };
  }
  function applyHandGuard(ctx, g, cw, ch) {
    if (!g) return;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    if (g.below) {
      const y0 = g.edge - g.fade;
      const gr = ctx.createLinearGradient(0, y0, 0, g.edge);
      gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,1)");
      ctx.fillStyle = gr; ctx.fillRect(0, y0, cw, ch - y0 + 1);
    } else {
      const y1 = g.edge + g.fade;
      const gr = ctx.createLinearGradient(0, g.edge, 0, y1);
      gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gr; ctx.fillRect(0, 0, cw, y1);
    }
    ctx.restore();
  }
  /**
   * v0.371 summon player (es9 팔진도 · v0.376 fs10 재폭풍, 둘 다 spell.type summon_n): 게임이 먼저 해결(토큰 소환)하고 숨긴 뒤 호출.
   * 상대가 쓰면 상대 전장의 새 토큰 rect 기준 (토큰이 없으면 시전자 보드 중앙) · squashY·handGuard는 meta에서
   * formation = 새 토큰 자리들의 중점(없으면 시전자 보드 중앙)에 납작한 타원 · rise = 토큰마다 startMs + i*staggerMs
   * 토큰은 rise 시작 + tokenFadeIn.startMs 부터 fade, 이어서 solidReveal(실제 카드 팝)
   * @param opts { tokenUids: [uid...], casterIsMe?, sound? }
   */
  async function playSummon(stage, meta, base, opts) {
    opts = opts || {};
    const uids = (opts.tokenUids || []).slice();
    try {
      if (!stage || !isSummonMeta(meta)) return false;
      const [fFr, rFr] = await preloadSummon(meta, base);
      if (!fFr && !rFr) return false;
      const F = meta.formation, R = meta.rise, S = meta.sfx || {};
      const k = fxScale();
      const pts = [];
      uids.forEach(u => {
        const el = document.querySelector('.minion[data-uid="' + u + '"]');
        const pt = rectCenter(el);
        if (pt) pts.push({ uid: u, x: pt.x, y: pt.y });
      });
      const c = pts.length ? { x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length } : casterBoardCenter(opts.casterIsMe);
      const { fw, fh } = summonFormationBox(meta, k, fFr);
      const guard = summonHandGuard(meta, opts.casterIsMe, k); // v0.376 fs10: 폭풍 띠가 손패를 가리지 않게
      const fStart = F.startMs || 0, fDur = F.durationMs || Math.round((F.frames || 1) * 1000 / (F.fps || 30));
      const fFps = F.fps || meta.fps || 30, fN = Math.max(1, F.frames || 1);
      const rBox = (R["displayBoxPx@1080p"] || 380) * k, rOff = (R["anchorOffsetYPx@1080p"] || 0) * k;
      const rDur = R.durationMs || Math.round((R.frames || 1) * 1000 / (R.fps || 30));
      const rFps = R.fps || meta.fps || 30, rN = Math.max(1, R.frames || 1);
      const fi = R.tokenFadeIn || { startMs: 220, durationMs: 200 };
      const popMs = (R.solidReveal && R.solidReveal.durationMs) || 0;
      const rises = pts.map((p, i) => ({ x: p.x, y: p.y + rOff, uid: p.uid, at: (R.startMs || 0) + i * (R.staggerMs || 0) }));
      rises.forEach(r => setTimeout(() => revealUnit(r.uid, fi.durationMs || 200, popMs), r.at + (fi.startMs || 0)));
      const endMs = Math.max(fFr ? fStart + fDur : 0,
        rFr ? rises.reduce((m, r) => Math.max(m, r.at + rDur), 0) : 0,
        rises.reduce((m, r) => Math.max(m, r.at + (fi.startMs || 0) + (fi.durationMs || 200) + popMs), 0));
      return await runCanvasFx(stage, endMs, metaSfxUrl(meta, base), S.startMs, (ctx, t, cw, ch) => {
        const tf = t - fStart;
        if (fFr && tf >= 0 && tf < fDur) {
          drawFrame(ctx, fFr, Math.min(fN - 1, Math.floor(tf * fFps / 1000)), c.x - fw / 2, c.y - fh / 2, fw, fh);
          applyHandGuard(ctx, guard, cw, ch); // formation만 지움 (rise는 뒤에 그림)
        }
        if (rFr) {
          const bh = rBox * rFr.h / rFr.w;
          rises.forEach(r => {
            const tr = t - r.at;
            if (tr < 0 || tr >= rDur) return;
            drawFrame(ctx, rFr, Math.min(rN - 1, Math.floor(tr * rFps / 1000)), r.x - rBox / 2, r.y - bh / 2, rBox, bh);
          });
        }
      }, opts);
    } finally {
      // 어떤 경우에도 토큰이 숨은 채로 남지 않게 (드러내는 중인 토큰은 애니메이션 끝까지 둠)
      uids.forEach(u => { if (_hidden[u] && _hidden[u].state === "hide") revealUnit(u, 120, 0); });
    }
  }
  // ─── v0.381 legendarySummon: 전설 유닛 소환 연출 (f15 장비 「장판교 일갈」, 이후 전설 유닛도 같은 모드 · 2초 이내) ───
  // 게임(playCard 유닛 분기)이 먼저 해결(소환 효과: 침묵 등)하고, 새 유닛을 숨긴 채 render → 여기서 전체 화면 캔버스 1장을 durationMs(2000) 동안 재생.
  // 그리는 순서: dim(코드, 검정) → meta.layers 순서. 레이어 anchor:
  //   summonedUnit = 새 유닛 카드 중심 · enemyBoard = 적 전장 중심 · boardDivider = 두 전장 사이 · eachEnemy = 적 유닛마다(링 도달 hitMs부터)
  // 적마다 hitMs(enemyHit ring 공식)에 enemyMute(채도·밝기 CSS 필터) + onEnemyHit, hitMs+swapAtMs 에 onEnemySwap(침묵 표시 갱신).
  // 상대(AI)가 내면 역할 반대: 적 = 내 전장(#myBoard), flipYWhenOppCasts 레이어는 위아래 반전.
  const _legendMetaCache = {};
  function loadLegendaryMeta(base) {
    if (!base) return Promise.resolve(null);
    if (_legendMetaCache[base]) return _legendMetaCache[base];
    _legendMetaCache[base] = (async () => {
      try {
        const res = await fetch(base + "meta.json", { cache: "no-store" });
        if (!res.ok) return null;
        return await res.json();
      } catch (e) { return null; }
    })().then(m => { if (!m) delete _legendMetaCache[base]; return m; });
    return _legendMetaCache[base];
  }
  let _legendaryEpoch = 0;
  const _legendaryPreloads = new Set();
  function isLegendarySummonMeta(meta) {
    return !!(meta && String(meta.playMode || "") === "legendarySummon" && ((Array.isArray(meta.layers) && meta.layers.length) || (meta.video && meta.video.file)));
  }
  function legendaryLayerMs(L, meta) {
    const fps = L.fps || meta.fps || 30, n = Math.max(1, L.frames || 1);
    return L.durationMs || Math.round(n * 1000 / fps);
  }
  /** 에셋 폴더(base)의 meta + 스트립 프레임 + sfx 미리 디코드. → { meta, frames[] } | null */
  async function preloadLegendarySummon(base) {
    const meta = await loadLegendaryMeta(base);
    if (!isLegendarySummonMeta(meta)) return null;
    if (meta.video) {
      if(typeof LegendaryVideoFx === "undefined") return null;
      const work = Promise.all([
        LegendaryVideoFx.preload(base, meta),
        Promise.all((meta.layers || []).map(L => L && L.anchor === 'eachEnemy' && L.file
          ? loadFrames(assetUrl(base, L.file), L.frames, L.w, L.h, L.layout) : Promise.resolve(null)))
      ]);
      let cancel, timer;
      const cancelled = new Promise(resolve => {
        cancel = () => resolve(null);
        _legendaryPreloads.add(cancel);
        timer = setTimeout(cancel, 2500);
      });
      try {
        const result = await Promise.race([work, cancelled]);
        if (!result || !result[0]) return null;
        if ((meta.layers || []).some((L,i) => L && L.anchor === 'eachEnemy' && L.file && !result[1][i])) return null;
        return {meta, video:true, frames:result[1]};
      } catch (e) { return null; }
      finally { clearTimeout(timer); _legendaryPreloads.delete(cancel); }
    }
    const [frames] = await Promise.all([
      Promise.all(meta.layers.map(L => (L && L.file) ? loadFrames(assetUrl(base, L.file), L.frames, L.w, L.h, L.layout) : Promise.resolve(null))),
      loadSfx(metaSfxUrl(meta, base))
    ]);
    return { meta, frames };
  }
  /** 순수 함수: enemyHit ring — hitMs = baseMs + hypot(dx, dy/squashY) / pxPerMs (dx·dy는 1080p px, k = 화면 배율) */
  function legendaryHitMs(meta, from, to, k) {
    const H = (meta && meta.enemyHit) || {};
    const base = H.baseMs != null ? H.baseMs : 380;
    const px = H.pxPerMs > 0 ? H.pxPerMs : 1.6;
    const sq = H.squashY > 0 ? H.squashY : 1;
    const kk = k > 0 ? k : 1;
    const dx = (to.x - from.x) / kk, dy = (to.y - from.y) / kk;
    return base + Math.hypot(dx, dy / sq) / px;
  }
  /** 순수 함수: 코드 dim 불투명도 (0→opacity over inMs, 유지, outStartMs→endMs 에 0) */
  function legendaryDimAlpha(D, t) {
    if (!D || !(D.opacity > 0)) return 0;
    const op = D.opacity, inMs = D.inMs != null ? D.inMs : 200;
    const outS = D.outStartMs != null ? D.outStartMs : 1450, end = D.endMs != null ? D.endMs : 2000;
    if (t < 0 || t >= end) return 0;
    if (t < inMs) return op * t / Math.max(1, inMs);
    if (t < outS) return op;
    return Math.max(0, op * (1 - (t - outS) / Math.max(1, end - outS)));
  }
  function boardRect(id) {
    const b = document.getElementById(id);
    const r = b && b.getBoundingClientRect();
    return (r && r.width > 4 && r.height > 4) ? r : null;
  }
  /** 앵커 좌표 (client px). casterIsMe=false 면 적 = 내 전장 */
  function legendaryAnchors(meta, opts) {
    const opp = opts.casterIsMe === false;
    const cw = window.innerWidth || 1920, ch = window.innerHeight || 1080;
    const R = (meta && meta["referencePointsPx@1080p"]) || {};
    const ref = (pt, dflt) => { const p = pt || dflt; return { x: p[0] * cw / 1920, y: opp ? ch - p[1] * ch / 1080 : p[1] * ch / 1080 }; };
    const unitEl = opts.unitUid != null ? document.querySelector('.minion[data-uid="' + String(opts.unitUid).replace(/"/g, "") + '"]') : null;
    const summonedUnit = rectCenter(unitEl) || casterBoardCenter(opts.casterIsMe) || ref(R.summonedUnit, [960, 719]);
    const er = boardRect(opp ? "myBoard" : "oppBoard"), ar = boardRect(opp ? "oppBoard" : "myBoard");
    const enemyBoard = er ? { x: er.left + er.width / 2, y: er.top + er.height / 2 } : ref(R.enemyBoardCentre, [942, 320]);
    const top = boardRect("oppBoard"), bot = boardRect("myBoard");
    const boardDivider = (top && bot)
      ? { x: (top.left + top.width / 2 + bot.left + bot.width / 2) / 2, y: (top.bottom + bot.top) / 2 }
      : ref(R.boardDivider, [942, 514]);
    const enemies = [];
    (opts.enemyUids || []).forEach(u => {
      const el = document.querySelector((opp ? "#myBoard" : "#oppBoard") + ' .minion[data-uid="' + String(u).replace(/"/g, "") + '"]');
      const r = el && el.getBoundingClientRect();
      if (r && r.width > 4 && r.height > 4) enemies.push({ uid: u, x: r.left + r.width / 2, y: r.top + r.height / 2 });
    });
    return { summonedUnit, enemyBoard, boardDivider, enemies, allyBoard: ar };
  }
  // 적 카드 enemyMute: uid 선택자 스타일(render로 DOM이 다시 만들어져도 유지) · 채도·밝기 낮췄다 복귀
  const _muted = {};
  function syncMuteStyle() {
    let st = document.getElementById("legendFxMute");
    if (!st) { st = document.createElement("style"); st.id = "legendFxMute"; (document.head || document.body).appendChild(st); }
    const kfs = {};
    let css = "";
    Object.keys(_muted).forEach(uid => {
      const M = _muted[uid];
      const a = Math.round(M.inMs / M.total * 1000) / 10, b = Math.round((M.inMs + M.holdMs) / M.total * 1000) / 10;
      const name = ("fxEnemyMute_" + a + "_" + b + "_" + M.saturate + "_" + M.brightness).replace(/\./g, "p");
      kfs[name] = "@keyframes " + name + "{0%{filter:saturate(1) brightness(1)}" + a + "%{filter:saturate(" + M.saturate + ") brightness(" + M.brightness + ")}" +
        b + "%{filter:saturate(" + M.saturate + ") brightness(" + M.brightness + ")}100%{filter:saturate(1) brightness(1)}}";
      css += '.minion[data-uid="' + String(uid).replace(/"/g, "") + '"]{animation:' + name + " " + M.total + "ms linear both!important;}";
    });
    st.textContent = Object.values(kfs).join("") + css;
  }
  function muteEnemy(uid, E) {
    E = E || {};
    const inMs = E.inMs != null ? E.inMs : 80, holdMs = E.holdMs != null ? E.holdMs : 350, outMs = E.outMs != null ? E.outMs : 420;
    const total = Math.max(1, inMs + holdMs + outMs);
    const tok = {};
    _muted[uid] = { inMs, holdMs, outMs, total, saturate: E.saturate != null ? E.saturate : 0.35, brightness: E.brightness != null ? E.brightness : 0.78, tok };
    syncMuteStyle();
    setTimeout(() => { if (_muted[uid] && _muted[uid].tok === tok) { delete _muted[uid]; syncMuteStyle(); } }, total + 30);
  }
  function legendaryHost() {
    let el = document.getElementById("legendFx");
    if (!el) {
      el = document.createElement("div");
      el.id = "legendFx";
      el.style.cssText = "position:fixed;inset:0;z-index:80;pointer-events:none;overflow:hidden;";
      document.body.appendChild(el);
    }
    return el;
  }
  /**
   * @param base  에셋 폴더 (예: "assets/vfx/legendary/f15/")
   * @param opts  { unitUid, enemyUids:[uid], casterIsMe?, onStart?(), onEnemyHit?(uid, ms), onEnemySwap?(uid), sound? }
   * 새 유닛은 게임이 hideUnits([unitUid]) 로 숨겨 두면 t=0 에 summonedReveal 로 드러냄 (없어도 동작).
   * @returns Promise<boolean> — durationMs(2000) 후 true, 에셋 실패면 false (숨긴 유닛·콜백은 어떤 경우에도 정리)
   */
  function legendaryVideoOverlay(meta, frames, anchors, scale) {
    // Video replaces main sprite layers. Enemy glyphs remain upright for both casters.
    const layers = (meta.layers || []).map((L, i) => {
      const fr = frames && frames[i];
      if (!L || L.anchor !== 'eachEnemy' || !fr) return null;
      const d = L['displayPx@1080p'];
      const w = (Array.isArray(d) ? d[0] : (L['displayBoxPx@1080p'] || 300)) * scale;
      const h = (Array.isArray(d) ? d[1] : (L['displayBoxPx@1080p'] || 300) * fr.h / fr.w) * scale;
      const offset = L['offsetPx@1080p'] || [0, 0];
      return {L, fr, w, h, dx:offset[0]*scale, dy:offset[1]*scale, duration:legendaryLayerMs(L, meta)};
    }).filter(Boolean);
    return (ctx, videoMs) => {
      layers.forEach(({L, fr, w, h, dx, dy, duration}) => {
        const t = videoMs - (L.startMs || 0);
        if (t < 0 || t >= duration) return;
        const frame = Math.min(Math.max(1, L.frames || 1) - 1, Math.floor(t * (L.fps || meta.fps || 30) / 1000));
        anchors.enemies.forEach(p => drawFrame(ctx, fr, frame, p.x + dx - w/2, p.y + dy - h/2, w, h));
      });
    };
  }
  async function playLegendarySummon(base, opts) {
    const epoch = _legendaryEpoch;
    opts = opts || {};
    const uid = opts.unitUid;
    const swapped = new Set();
    const videoMutes = new Map();
    const fireSwap = (u) => { if (swapped.has(u)) return; swapped.add(u); try { opts.onEnemySwap && opts.onEnemySwap(u); } catch (e) {} };
    try {
      const pack = await preloadLegendarySummon(base);
      if (!pack || epoch !== _legendaryEpoch) return false;
      const meta = pack.meta;
      if (pack.video) {
        const anchors = legendaryAnchors(meta,opts), scale = fxScale();
        const overlay = legendaryVideoOverlay(meta, pack.frames, anchors, scale);
        const E = meta.enemyMute;
        const hits = E ? anchors.enemies.map(p => ({uid:p.uid, hitMs:legendaryHitMs(meta, anchors.summonedUnit, p, scale), hit:false})) : [];

        return await LegendaryVideoFx.play(base, meta, Object.assign({}, opts, {
          anchor: anchors.summonedUnit, scale,
          drawOverlay:(ctx, t)=>{
            hits.forEach(h => {
              if (!h.hit && t >= h.hitMs) { h.hit=true; muteEnemy(h.uid,E); videoMutes.set(h.uid,_muted[h.uid]); try { opts.onEnemyHit && opts.onEnemyHit(h.uid,h.hitMs); } catch(e) {} }
              if (t >= h.hitMs + (E.swapAtMs != null ? E.swapAtMs : 60)) fireSwap(h.uid);
            });
            overlay(ctx,t);
          },
          onStart:()=>{ const rv=meta.summonedReveal||{}; if(uid!=null)revealUnit(uid,rv.fadeMs||120,rv.popMs||0,rv);try{opts.onStart&&opts.onStart();}catch(e){} }
        }));
      }
      const k = fxScale();
      const opp = opts.casterIsMe === false;
      const A = legendaryAnchors(meta, opts);
      const E = meta.enemyMute || {};
      const hits = A.enemies.map(p => {
        const ms = legendaryHitMs(meta, A.summonedUnit, p, k);
        return { uid: p.uid, x: p.x, y: p.y, hitMs: ms, swapMs: ms + (E.swapAtMs != null ? E.swapAtMs : 60), hit: false };
      });
      const layers = [];
      meta.layers.forEach((L, i) => {
        const fr = pack.frames[i];
        if (!L || !fr) return;
        const d = L["displayPx@1080p"];
        const w = (Array.isArray(d) ? d[0] : (L["displayBoxPx@1080p"] || 300)) * k;
        const h = (Array.isArray(d) ? d[1] : (L["displayBoxPx@1080p"] || 300) * fr.h / fr.w) * k;
        const pts = L.anchor === "eachEnemy" ? hits.map(hh => ({ x: hh.x, y: hh.y, at: hh.hitMs + (L.startMs || 0) }))
          : [Object.assign({ at: L.startMs || 0 }, A[L.anchor] || A.summonedUnit)];
        layers.push({ fr, w, h, pts, dur: legendaryLayerMs(L, meta), fps: L.fps || meta.fps || 30, n: Math.max(1, L.frames || 1), flip: opp && !!L.flipYWhenOppCasts });
      });
      const endMs = meta.durationMs || 2000;
      const D = Object.assign({ endMs }, meta.dim || {});
      const rv = meta.summonedReveal || null;
      let started = false;
      const host = legendaryHost();
      const runOpts = { sound: opts.sound, shake: meta.screenShake || null };
      const ok = await runCanvasFx(host, endMs, metaSfxUrl(meta, base), (meta.sfx || {}).startMs, (ctx, t, cw, ch) => {
        if (!started) {
          started = true;
          if (uid != null) revealUnit(uid, rv ? rv.fadeMs : 120, rv ? rv.popMs : 0, rv || null);
          try { opts.onStart && opts.onStart(); } catch (e) {}
        }
        hits.forEach(hh => {
          if (!hh.hit && t >= hh.hitMs) { hh.hit = true; if (meta.enemyMute) muteEnemy(hh.uid, E); try { opts.onEnemyHit && opts.onEnemyHit(hh.uid, hh.hitMs); } catch (e) {} }
          if (t >= hh.swapMs) fireSwap(hh.uid);
        });
        const da = legendaryDimAlpha(D, t);
        if (da > 0) { ctx.save(); ctx.globalAlpha = da; ctx.fillStyle = D.color || "#000"; ctx.fillRect(0, 0, cw, ch); ctx.restore(); }
        layers.forEach(l => {
          l.pts.forEach(p => {
            const tl = t - p.at;
            if (tl < 0 || tl >= l.dur) return;
            const fi = Math.min(l.n - 1, Math.floor(tl * l.fps / 1000));
            if (l.flip) {
              ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, -1);
              drawFrame(ctx, l.fr, fi, -l.w / 2, -l.h / 2, l.w, l.h);
              ctx.restore();
            } else drawFrame(ctx, l.fr, fi, p.x - l.w / 2, p.y - l.h / 2, l.w, l.h);
          });
        });
      }, runOpts);
      hits.forEach(hh => fireSwap(hh.uid));
      return ok;
    } finally {
      if (videoMutes.size) { for (const [u,owned] of videoMutes) if (_muted[u] === owned) delete _muted[u]; syncMuteStyle(); }
      (opts.enemyUids || []).forEach(u => fireSwap(u)); // 실패·중단해도 침묵 표시는 반드시 갱신
      if (uid != null && _hidden[uid] && _hidden[uid].state === "hide") revealUnit(uid, 120, 0);
    }
  }
  /** Dispatch a meta-driven canvas pack. */
  function playMetaFx(stage, meta, base, opts) {
    opts = opts || {};
    if (meta && meta.screenShake && !opts.shake) opts = Object.assign({}, opts, { shake: meta.screenShake });
    if (isAnchoredMeta(meta)) return playAnchored(stage, meta, base, opts);
    if (isDuelKeepMeta(meta)) return playDuelKeep(stage, meta, base, opts);
    if (isSummonMeta(meta)) return playSummon(stage, meta, base, opts);
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
      if (opts.keepUids) mOpts.keepUids = opts.keepUids; // v0.371 duelKeep: 결과와 같은 생존 유닛
      if (isSummonMeta(meta)) {
        // v0.371 summon: 먼저 해결(토큰 소환·render) → 같은 동기 구간에서 새 토큰 숨김 → 연출 → 드러내기
        let uids = [];
        if (typeof opts.resolveNow === "function") { try { uids = opts.resolveNow() || []; } catch (e) { uids = []; } }
        hideUnits(uids);
        mOpts.tokenUids = uids;
      }
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
        // v0.371 summon 안전장치: 연출이 실패해도 숨긴 토큰은 보이게
        setTimeout(() => { try { Object.keys(_hidden).forEach(u => { if (_hidden[u].state === "hide") revealUnit(u, 120, 0); }); } catch (e) {} }, 0);
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
    if (opts.dim === false || opts.dim === 0 || opts.dimOpacity === 0) return null;
    const dur = (meta && meta.durationMs) || 1500;
    const d = meta && meta.dim;
    if (d === false || d === 0 || (d && (d.enabled === false || d.doInCode === false || d.opacity === 0))) return null;
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
  // v0.366: 미리 버퍼링해 둔 <video> (id별 1개, 재사용). 첫 판 시작 연출 지연(손패·보드 이미지 로딩과 경쟁) 제거용
  const _readyVideo = {};
  function makeOverlayVideo(src) {
    const v = document.createElement("video");
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.setAttribute("muted", "");
    v.preload = "auto";
    v.className = "mfx-overlay";
    v.src = src;
    return v;
  }
  const _preloading = {};
  function preloadMatch(id) {
    if (_preloading[id]) return _preloading[id];
    const p = (async () => {
      try {
        const meta = await loadPackMeta("match", id);
        if (!isVideoPackMeta(meta)) return false;
        const base = packBase("match", id);
        const sfxP = pickMatchSfxUrl(base, meta);
        if (needsSafariFallback()) {
          const file = meta.overlay.safariFile || "overlay_safari.webp";
          await Promise.all([fetch(assetUrl(base, file), { cache: "force-cache" }).then(r => r.blob()).catch(() => null), sfxP]);
        } else {
          if (!_readyVideo[id]) {
            // 파일 전체를 메모리(blob URL)로 받아 둠 → 재생 중 네트워크 대기(손패·보드 이미지와 경쟁) 없음
            const url = assetUrl(base, meta.overlay.file);
            let src = url;
            try {
              const res = await fetch(url, { cache: "force-cache" });
              if (res.ok) src = URL.createObjectURL(await res.blob());
            } catch (e) {}
            if (!_readyVideo[id]) {
              const v = makeOverlayVideo(src);
              try { v.load(); } catch (e) {}
              _readyVideo[id] = v;
            }
          }
          const rv = _readyVideo[id];
          await Promise.all([rv.readyState >= 4 ? null : waitEvent(rv, ["canplaythrough", "error"], 5000), sfxP]);
        }
        return true;
      } catch (e) { return false; }
    })();
    _preloading[id] = p;
    p.then(ok => { if (!ok) delete _preloading[id]; });
    return p;
  }
  /** meta 기반 연출 길이(ms). 대기 시간 계산용 — 코드에 1.5초 등 고정값을 두지 않는다 */
  async function matchDurationMs(id) {
    const meta = await loadPackMeta("match", id);
    return (meta && meta.durationMs) || 0;
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
    let reused = false;
    if (!safari) {
      // 미리 버퍼링된 비디오가 있으면 그대로 사용 (처음부터 재생)
      const rv = _readyVideo[id];
      if (rv && !rv.parentNode && !rv.error) {
        video = rv;
        reused = true;
        try { if (video.currentTime > 0) video.currentTime = 0; } catch (e) {}
      } else {
        video = makeOverlayVideo(assetUrl(base, meta.overlay.file));
        if (!rv) _readyVideo[id] = video;
      }
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
        if (!reused || video.readyState < 3) {
          if (!reused) { try { video.load(); } catch (e) {} }
          await waitEvent(video, ["canplaythrough", "canplay", "error"], 700);
        }
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
  // v0.377: 아이템 연출(아이템 팩 10종) 전부 삭제 — 사용자 요청. playItem 없음
  // ─── v0.372 매치 연출 게이트: MATCH START·MY TURN·VICTORY·DEFEAT 재생 중에는 다른 진행(드로우 모션·AI·결과 화면·입력)을 막는다 ───
  let _ovCount = 0;
  const _ovWaiters = [];
  const OVERLAY_HOLD_CAP_MS = 7000; // 연출이 멈춰도 게임이 영원히 잠기지 않게
  function syncInputBlock() {
    let el = document.getElementById("fxInputBlock");
    if (!el && _ovCount > 0) {
      el = document.createElement("div");
      el.id = "fxInputBlock";
      el.setAttribute("aria-hidden", "true");
      el.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:transparent;pointer-events:auto;cursor:default;touch-action:none;";
      const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
      ["pointerdown", "pointerup", "click", "dblclick", "contextmenu", "touchstart", "wheel"].forEach(t => el.addEventListener(t, stop, { passive: false }));
      document.body.appendChild(el);
    }
    if (el) el.style.display = _ovCount > 0 ? "block" : "none";
    try { document.body.classList.toggle("fx-overlay-busy", _ovCount > 0); } catch (e) {}
  }
  function overlayHold() {
    let released = false;
    _ovCount++;
    syncInputBlock();
    let capT = null;
    const release = () => {
      if (released) return;
      released = true;
      if (capT) clearTimeout(capT);
      _ovCount = Math.max(0, _ovCount - 1);
      // 한 틱 뒤에 판정: 연출이 끝나자마자 이어지는 연출(MATCH START → MY TURN)이 먼저 잡히게
      setTimeout(() => {
        syncInputBlock();
        if (_ovCount === 0) _ovWaiters.splice(0).forEach(f => { try { f(); } catch (e) {} });
      }, 0);
    };
    capT = setTimeout(release, OVERLAY_HOLD_CAP_MS);
    return release;
  }
  function overlayBusy() { return _ovCount > 0; }
  function overlayBusyCount() { return _ovCount; }
  function whenOverlayIdle() { return _ovCount > 0 ? new Promise(r => _ovWaiters.push(r)) : Promise.resolve(); }
  // 연출 중 키 입력(단축키) 차단
  try {
    document.addEventListener("keydown", (e) => { if (_ovCount > 0) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  } catch (e) {}
  function playMatch(id, opts) {
    const release = overlayHold();
    const p = playPack("match", id, opts);
    p.then(release, release);
    return p;
  }

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
    _legendaryEpoch++;
    for (const cancel of [..._legendaryPreloads]) cancel();
    if(typeof LegendaryVideoFx !== "undefined") LegendaryVideoFx.clear();
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

  return { play, clear, T, playProjectile, preloadProjectile, isProjectileMeta, playOverlayPerUnit, preloadOverlay, isOverlayMeta, playPerUnitFlow, preloadFlow, isFlowMeta, playAnchored, preloadAnchored, isAnchoredMeta, playDuelKeep, preloadDuelKeep, isDuelKeepMeta, playSummon, preloadSummon, isSummonMeta, summonFormationBox, summonHandGuard, releaseHidden, hideUnits, revealUnit, playLegendarySummon, preloadLegendarySummon, isLegendarySummonMeta, legendaryHitMs, legendaryDimAlpha, unitDelayMs, playMetaFx, preloadMetaFx, aoeUnitPoints, elemOf, spellKind, playPack, playUi, playCombat, playCoin, playMatch, overlayHold, overlayBusy, overlayBusyCount, whenOverlayIdle, resolveFxAnchor, pointFromOpts, resolveDim, releaseDim, preloadMatch, matchDurationMs, isVideoPackMeta, needsSafariFallback };
})();
window.SpellFx = SpellFx;
// v0.366: 타이틀 화면에서 미리 로드 → 첫 판 시작 연출이 로딩 없이 바로 뜨게
try {
  const _mfxPre = () => setTimeout(() => {
    try { SpellFx.preloadMatch("match_start"); SpellFx.preloadMatch("turn_start_me"); } catch (e) {}
  }, 300);
  if (document.readyState === "complete") _mfxPre(); else window.addEventListener("load", _mfxPre, { once: true });
} catch (e) {}
