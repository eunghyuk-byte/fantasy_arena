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
  async function playAssetPack(card, layer, stage, opts) {
    opts = opts || {};
    const target = opts.target || null;
    const meta = await loadSpellMeta(card && card.id);
    if (!meta) return false;
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
    if (t === "aoe_pack" || t === "aoe_enemy" || t === "aoe_all_enemy" || t === "earthquake" || t === "sandhell") return "aoe";
    if (t === "dmg" || t === "face") return "bolt";
    if (t === "heal_hero" || t === "buff" || t === "buff_all" || t === "grant_extra" || t === "grant_kw") return "buff";
    if (t === "kill" || t === "kill_if" || t === "wipe_all") return "kill";
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
          try { Sfx.spell && Sfx.spell(kind); } catch (e) {}
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

  let _packQueue = Promise.resolve();

  async function _playPackInner(kind, id, opts) {
    opts = opts || {};
    if (!kind || !id) return false;
    const meta = await loadPackMeta(kind, id);
    const base = packBase(kind, id);
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
    try {
      if (fxCard) {
        fxCard.innerHTML = "";
        fxCard.classList.remove("in", "out");
        fxCard.style.opacity = "0";
      }
      const lab = document.getElementById("fxName");
      if (lab) {
        // Combat packs: hide concept labels (opts.label only)
        const fxLabel = (kind === "combat")
          ? (opts.label || "")
          : (opts.label || (meta && (meta.name || meta.concept)) || "");
        lab.textContent = fxLabel;
        lab.style.opacity = lab.textContent ? "1" : "0";
      }
      layer.classList.add("on", "pack-play");
      layer.style.display = "";
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
    if (lab) lab.textContent = "";
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

  return { play, clear, T, elemOf, spellKind, playPack, playUi, playCombat, playCoin, playItem, playMatch, resolveFxAnchor, pointFromOpts };
})();
window.SpellFx = SpellFx;
