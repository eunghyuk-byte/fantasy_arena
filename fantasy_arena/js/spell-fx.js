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

  const ASSET_BASE = "assets/vfx/spells/";
  const _metaCache = {};
  async function loadSpellMeta(id) {
    if (!id) return null;
    if (_metaCache[id] !== undefined) return _metaCache[id];
    try {
      const res = await fetch(ASSET_BASE + id + "/meta.json", { cache: "no-store" });
      if (!res.ok) { _metaCache[id] = null; return null; }
      const meta = await res.json();
      _metaCache[id] = meta;
      return meta;
    } catch (e) {
      _metaCache[id] = null;
      return null;
    }
  }
  function playStrip(stage, url, frameW, frameH, frames, fps) {
    return new Promise(resolve => {
      if (!stage || !url) { resolve(); return; }
      const ms = Math.max(200, Math.round((frames || 1) / Math.max(1, fps || 12) * 1000));
      const wrap = document.createElement("div");
      wrap.className = "fx-strip";
      wrap.style.setProperty("--fw", frameW + "px");
      wrap.style.setProperty("--fh", frameH + "px");
      wrap.style.setProperty("--frames", String(Math.max(1, frames || 1)));
      wrap.style.setProperty("--ms", ms + "ms");
      const img = document.createElement("img");
      img.alt = "";
      img.src = url;
      wrap.appendChild(img);
      stage.innerHTML = "";
      stage.appendChild(wrap);
      img.onload = () => {
        // ensure layout
        wrap.classList.add("run");
      };
      img.onerror = () => { resolve(); };
      setTimeout(() => { try { wrap.remove(); } catch (e) {} resolve(); }, ms + 40);
    });
  }
  async function playAssetPack(card, layer, stage) {
    const meta = await loadSpellMeta(card && card.id);
    if (!meta) return false;
    const base = ASSET_BASE + meta.id + "/";
    const fps = meta.fps || 12;
    const cast = meta.cast || {};
    const impact = meta.impact || {};
    const castFrames = cast.frames || 12;
    const impactFrames = impact.frames || 8;
    const castW = cast.w || 720, castH = cast.h || 720;
    const impactW = impact.w || 560, impactH = impact.h || 560;
    // Prefer horizontal strip PNG (reliable). Fall back to webp file name.
    const castUrl = base + "cast_strip.png?v=" + (window.GAME_VERSION || "0");
    const impactUrl = base + "impact_strip.png?v=" + (window.GAME_VERSION || "0");
    try { Sfx.playCardDrop && Sfx.playCardDrop(); } catch (e) {}
    if (meta.sfxHint === "coin_flip") { try { Sfx.playCoin && Sfx.playCoin(); } catch (e) {} }
    // Hide card showcase so it does not cover VFX
    const fxCard = document.getElementById("fxCard");
    if (fxCard) { fxCard.classList.add("out"); fxCard.style.opacity = "0"; }
    await playStrip(stage, castUrl, castW, castH, castFrames, fps);
    await playStrip(stage, impactUrl, impactW, impactH, impactFrames, fps);
    if (fxCard) { fxCard.style.opacity = ""; }
    return true;
  }


  function lowSpec() {
    try {
      if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
      if (navigator.deviceMemory && navigator.deviceMemory < 4) return true;
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
    if (t === "draw" || t === "draw_ex" || t === "mana" || t === "mana_next" || t === "coin_luck") return "utility";
    if (t === "petrify" || t === "set_one" || t === "set_enemy" || t === "magnet") return "control";
    return t;
  }

  function ensureLayer() {
    let layer = document.getElementById("spellFx");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "spellFx";
      layer.innerHTML = '<div class="fx-veil"></div><div class="fx-card" id="fxCard"></div><canvas id="fxCanvas"></canvas><div class="fx-stage" id="fxStage"></div><div class="fx-name" id="fxName"></div>';
      (document.getElementById("game") || document.body).appendChild(layer);
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
    const ready = card.face || (typeof CARD_FACE !== "undefined" && CARD_FACE[card.id]) || "";
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

  function play(card) {
    return new Promise(async resolve => {
      const layer = ensureLayer();
      const stage = document.getElementById("fxStage");
      const fxCard = document.getElementById("fxCard");
      const game = document.getElementById("game");
      const kind = spellKind(card);
      const elem = elemOf(card);
      const low = lowSpec();
      if (stage) { stage.innerHTML = ""; stage.dataset.elem = elem; stage.dataset.kind = kind; }
      layer.classList.add("on");
      layer.dataset.elem = elem;
      layer.dataset.kind = kind;
      const veil = layer.querySelector(".fx-veil");
      if (veil) {
        const pal = ELEM[elem] || ELEM.earth;
        veil.style.background = pal.veil;
      }
      const src = await resolveFace(card);
      paintCard(src, card.name || "");

      const usedPack = await playAssetPack(card, layer, stage);
      if (usedPack) {
        if (fxCard) fxCard.classList.add("out");
        layer.classList.remove("on");
        if (stage) stage.innerHTML = "";
        if (fxCard) { fxCard.innerHTML = ""; fxCard.classList.remove("in", "out"); }
        const lab = document.getElementById("fxName");
        if (lab) lab.textContent = "";
        resolve();
        return;
      }

      try { Sfx.playCardDrop(); } catch (e) {}

      setTimeout(() => { if (fxCard) fxCard.classList.add("out"); }, T.show);
      let handle = null;
      setTimeout(() => {
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
      }, T.vfxAt);
      setTimeout(() => {
        if (handle) handle.stop();
        layer.classList.remove("on");
        if (game) game.classList.remove("quake");
        if (stage) stage.innerHTML = "";
        if (fxCard) { fxCard.innerHTML = ""; fxCard.classList.remove("in", "out"); }
        const lab = document.getElementById("fxName");
        if (lab) lab.textContent = "";
        resolve();
      }, T.total);
    });
  }

  return { play, T, elemOf, spellKind };
})();
