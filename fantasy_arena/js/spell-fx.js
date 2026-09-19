const SpellFx = (() => {
  // Longer, smoother card showcase + VFX window
  const T = {
    in: 420,
    hold: 1200,
    out: 360,
    vfx: 2100,
    fade: 480
  };
  T.show = T.in + T.hold;
  T.vfxAt = T.show + T.out;
  T.total = T.vfxAt + T.vfx + T.fade;

  const ELEM = {
    fire: {
      fill: ["#fff2c8", "#ff9a2a", "#e23a10", "#ff6a00"],
      trail: ["#ffb347", "#ff4d00", "#ffd27a"],
      veil: "rgba(80,20,0,.45)"
    },
    water: {
      fill: ["#e8fbff", "#5ec8ff", "#1a6ad4", "#7ad8ff"],
      trail: ["#9adfff", "#3a9ae0", "#dff6ff"],
      veil: "rgba(8,30,70,.45)"
    },
    wind: {
      fill: ["#f4fff8", "#9ee8d0", "#3aa89a", "#c8fff0"],
      trail: ["#b8f0dc", "#6ad0b8", "#e8fff8"],
      veil: "rgba(10,40,36,.4)"
    },
    earth: {
      fill: ["#f0e0b8", "#b8864a", "#5a3a18", "#d4a86a"],
      trail: ["#c9a06a", "#8a6030", "#e8d0a0"],
      veil: "rgba(40,24,8,.45)"
    },
    light: {
      fill: ["#fffef6", "#ffe08a", "#f0c040", "#fff6c8"],
      trail: ["#ffe9a8", "#ffd060", "#fff"],
      veil: "rgba(50,40,10,.35)"
    },
    dark: {
      fill: ["#e8d0ff", "#7a3ab8", "#2a1048", "#b070e0"],
      trail: ["#a060d8", "#4a1878", "#d8b0ff"],
      veil: "rgba(20,6,36,.55)"
    },
    불: null, 물: null, 바람: null, 땅: null, 빛: null, 암흑: null
  };
  ELEM["불"] = ELEM.fire; ELEM["물"] = ELEM.water; ELEM["바람"] = ELEM.wind;
  ELEM["땅"] = ELEM.earth; ELEM["빛"] = ELEM.light; ELEM["암흑"] = ELEM.dark;

  function lowSpec() {
    try {
      if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
      if (navigator.deviceMemory && navigator.deviceMemory < 4) return true;
      if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) return true;
    } catch (e) {}
    return false;
  }
  function elemOf(card) {
    const id = (card && (card.tribe || card.element)) || "earth";
    return ELEM[id] ? id : "earth";
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

  function pushTrail(parts, p, pal, low) {
    if (low || Math.random() > 0.55) return;
    parts.push({
      x: p.x, y: p.y,
      vx: p.vx * 0.15, vy: p.vy * 0.15,
      r: Math.max(1.2, p.r * 0.45),
      life: 0.22 + Math.random() * 0.28,
      age: 0,
      c: (pal.trail || pal.fill)[Math.floor(Math.random() * (pal.trail || pal.fill).length)],
      trail: true,
      soft: true
    });
  }

  function burst(elem, kind, low) {
    const canvas = document.getElementById("fxCanvas");
    if (!canvas) return { stop() {} };
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, low ? 1 : 1.75);
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pal = ELEM[elem] || ELEM.earth;
    const cx = w * 0.5, cy = h * 0.46;

    // Layered counts: core burst + ring + secondary spray
    const coreN = low ? 28 : (elem === "light" || elem === "dark" ? 160 : 130);
    const ringN = low ? 10 : 48;
    const sprayN = low ? 8 : 36;
    const parts = [];

    function addRadial(n, speedMin, speedMax, sizeMin, sizeMax, lifeMin, lifeMax, vxMul, vyMul) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = speedMin + Math.random() * (speedMax - speedMin);
        parts.push({
          x: cx + (Math.random() - 0.5) * 18,
          y: cy + (Math.random() - 0.5) * 14,
          vx: Math.cos(a) * sp * vxMul,
          vy: Math.sin(a) * sp * vyMul,
          r: sizeMin + Math.random() * (sizeMax - sizeMin),
          life: lifeMin + Math.random() * (lifeMax - lifeMin),
          age: -Math.random() * 0.12,
          c: pal.fill[i % pal.fill.length],
          glow: !low && Math.random() > 0.55
        });
      }
    }

    const vxMul = elem === "wind" ? 1.75 : elem === "fire" ? 0.7 : 0.6;
    const vyMul = elem === "fire" ? -1.05 : elem === "earth" ? 0.95 : elem === "water" ? 0.55 : 0.45;
    addRadial(coreN, 50, 320, low ? 2 : 2.5, low ? 5 : 8.5, 0.6, 1.05, vxMul, vyMul);
    addRadial(ringN, 180, 420, 1.5, 4.5, 0.4, 0.75, vxMul * 1.1, Math.abs(vyMul) * 0.9 + 0.2);
    addRadial(sprayN, 20, 120, 1, 3.2, 0.7, 1.2, 0.4, 0.35);

    // Element-specific layered extras
    if (elem === "earth" && !low) {
      for (let i = 0; i < 16; i++) {
        parts.push({
          x: w * (0.16 + Math.random() * 0.68), y: -24,
          vx: (Math.random() - 0.5) * 50, vy: 200 + Math.random() * 300,
          r: 7 + Math.random() * 16, life: 1.0, age: -i * 0.035,
          c: pal.fill[2 + (i % 2)], rock: true
        });
      }
    }
    if (elem === "fire" && !low) {
      for (let i = 0; i < 24; i++) {
        parts.push({
          x: cx + (Math.random() - 0.5) * 40, y: cy + 30,
          vx: (Math.random() - 0.5) * 60,
          vy: -(120 + Math.random() * 220),
          r: 3 + Math.random() * 6, life: 0.7 + Math.random() * 0.5,
          age: -Math.random() * 0.2, c: pal.trail[i % pal.trail.length], ember: true
        });
      }
    }
    if (elem === "water" && !low) {
      for (let i = 0; i < 20; i++) {
        const a = -Math.PI * 0.2 + Math.random() * Math.PI * 1.4;
        parts.push({
          x: cx, y: cy - 10,
          vx: Math.cos(a) * (80 + Math.random() * 160),
          vy: Math.sin(a) * (40 + Math.random() * 80) - 40,
          r: 2 + Math.random() * 5, life: 0.8, age: -i * 0.02,
          c: pal.fill[i % pal.fill.length], droplet: true
        });
      }
    }
    if (elem === "wind" && !low) {
      for (let i = 0; i < 18; i++) {
        parts.push({
          x: w * 0.1, y: h * (0.25 + Math.random() * 0.5),
          vx: 280 + Math.random() * 220, vy: (Math.random() - 0.5) * 60,
          r: 1.5 + Math.random() * 3, life: 0.7, age: -i * 0.03,
          c: pal.trail[i % pal.trail.length], streak: true
        });
      }
    }
    if ((elem === "light" || elem === "dark") && !low) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        parts.push({
          x: cx, y: cy,
          vx: Math.cos(a) * 40, vy: Math.sin(a) * 40,
          r: 2, life: 1.1, age: -0.05,
          c: pal.fill[0], ray: true, rayAng: a
        });
      }
    }

    let t0 = 0, dead = false, pulse = 0;
    function frame(ts) {
      if (dead) return;
      if (!t0) t0 = ts;
      const dt = Math.min(0.033, (ts - t0) / 1000); t0 = ts;
      pulse += dt;
      ctx.clearRect(0, 0, w, h);

      // Soft layered aura
      const auraR = 160 + Math.sin(pulse * 4) * 24;
      const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, auraR + 80);
      g.addColorStop(0, pal.fill[0] + (elem === "dark" ? "99" : "bb"));
      g.addColorStop(0.35, (pal.trail ? pal.trail[0] : pal.fill[1]) + "44");
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, auraR + 60, 0, Math.PI * 2); ctx.fill();

      if (elem === "light" || elem === "dark") {
        const g2 = ctx.createRadialGradient(cx, cy, 10, cx, cy, 260);
        g2.addColorStop(0, pal.fill[0] + "cc");
        g2.addColorStop(1, "transparent");
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.arc(cx, cy, 240, 0, Math.PI * 2); ctx.fill();
      }

      const born = [];
      parts.forEach(p => {
        p.age += dt;
        if (p.age < 0) return;
        if (p.ray) {
          const len = 40 + p.age * 220;
          const k = Math.max(0, 1 - p.age / p.life);
          ctx.save();
          ctx.globalAlpha = k * 0.55;
          ctx.strokeStyle = p.c;
          ctx.lineWidth = 2 + k * 3;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(p.rayAng) * len, cy + Math.sin(p.rayAng) * len);
          ctx.stroke();
          ctx.restore();
          return;
        }
        if (p.streak) {
          const k = Math.max(0, 1 - p.age / p.life);
          ctx.globalAlpha = k * 0.7;
          ctx.strokeStyle = p.c;
          ctx.lineWidth = p.r;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.08, p.y - p.vy * 0.08);
          ctx.stroke();
          p.x += p.vx * dt; p.y += p.vy * dt;
          return;
        }

        // Element-colored motion trails (spawn soft afterimages)
        if (!p.trail && !p.rock && p.age > 0.02) pushTrail(born, p, pal, low);

        p.x += p.vx * dt; p.y += p.vy * dt;
        if (elem === "fire" || p.ember) p.vy -= 200 * dt;
        if (elem === "water" || p.droplet) p.vy += 240 * dt;
        if (elem === "earth") p.vy += 440 * dt;
        if (elem === "wind" && !p.streak) { p.vx += Math.sin(p.age * 12) * 40 * dt; }

        const k = Math.max(0, 1 - p.age / p.life);
        ctx.globalAlpha = p.soft ? k * 0.45 : k;
        if (p.glow && !low) {
          ctx.shadowColor = p.c;
          ctx.shadowBlur = 12;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.fillStyle = p.c;
        if (p.rock) {
          ctx.fillRect(p.x, p.y, p.r, p.r * 0.7);
        } else if (p.droplet) {
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.r * k * 0.7, p.r * k * 1.2, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * k, 0, Math.PI * 2); ctx.fill();
        }
      });
      if (born.length && parts.length < (low ? 80 : 420)) {
        for (let i = 0; i < born.length; i++) parts.push(born[i]);
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return { stop() { dead = true; ctx.clearRect(0, 0, w, h); } };
  }

  function cssFallback(stage, elem) {
    const ring = document.createElement("div");
    ring.className = "cast-ring fx-" + elem;
    stage.appendChild(ring);
    const ring2 = document.createElement("div");
    ring2.className = "cast-ring cast-ring-outer fx-" + elem;
    stage.appendChild(ring2);
    const n = 16;
    for (let i = 0; i < n; i++) {
      const d = document.createElement("div");
      d.className = "fx-spark fx-" + elem;
      d.style.left = (14 + Math.random() * 72) + "%";
      d.style.top = (24 + Math.random() * 48) + "%";
      d.style.animationDelay = (i * 0.035) + "s";
      stage.appendChild(d);
    }
    for (let i = 0; i < 8; i++) {
      const t = document.createElement("div");
      t.className = "fx-trail fx-" + elem;
      t.style.left = (20 + Math.random() * 60) + "%";
      t.style.top = (30 + Math.random() * 40) + "%";
      t.style.animationDelay = (i * 0.05) + "s";
      stage.appendChild(t);
    }
  }

  function play(card) {
    return new Promise(async resolve => {
      const layer = ensureLayer();
      const stage = document.getElementById("fxStage");
      const fxCard = document.getElementById("fxCard");
      const game = document.getElementById("game");
      const kind = (card.spell && card.spell.type) || "burst";
      const elem = elemOf(card);
      const low = lowSpec();
      if (stage) { stage.innerHTML = ""; stage.dataset.elem = elem; }
      layer.classList.add("on");
      layer.dataset.elem = elem;
      try { Sfx.playCardDrop(); } catch (e) {}

      // Always await composeCardFace (via resolveFace) before showcase
      const src = await resolveFace(card);
      paintCard(src, card.name || "");

      setTimeout(() => { if (fxCard) fxCard.classList.add("out"); }, T.show);
      let handle = null;
      setTimeout(() => {
        if (low) cssFallback(stage, elem);
        else handle = burst(elem, kind, false);
        if (kind === "earthquake" && game) game.classList.add("quake");
        try { Sfx.spell && Sfx.spell(elem || kind); } catch (e) {}
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

  return { play, T, elemOf, lowSpec };
})();
