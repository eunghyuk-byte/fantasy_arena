const SpellFx = (() => {
  const T = {
    in: 320,
    hold: 900,
    out: 280,
    vfx: 1700,
    fade: 400
  };
  T.show = T.in + T.hold;
  T.vfxAt = T.show + T.out;
  T.total = T.vfxAt + T.vfx + T.fade;

  const ELEM = {
    fire: { fill: ["#fff2c8", "#ff9a2a", "#e23a10"], veil: "rgba(80,20,0,.45)" },
    water: { fill: ["#e8fbff", "#5ec8ff", "#1a6ad4"], veil: "rgba(8,30,70,.45)" },
    wind: { fill: ["#f4fff8", "#9ee8d0", "#3aa89a"], veil: "rgba(10,40,36,.4)" },
    earth: { fill: ["#f0e0b8", "#b8864a", "#5a3a18"], veil: "rgba(40,24,8,.45)" },
    light: { fill: ["#fffef6", "#ffe08a", "#f0c040"], veil: "rgba(50,40,10,.35)" },
    dark: { fill: ["#e8d0ff", "#7a3ab8", "#2a1048"], veil: "rgba(20,6,36,.55)" },
    불: null, 물: null, 바람: null, 땅: null, 빛: null, 암흑: null
  };
  ELEM["불"] = ELEM.fire; ELEM["물"] = ELEM.water; ELEM["바람"] = ELEM.wind;
  ELEM["땅"] = ELEM.earth; ELEM["빛"] = ELEM.light; ELEM["암흑"] = ELEM.dark;

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
    const pal = ELEM[elem] || ELEM.earth;
    const n = low ? 36 : (elem === "light" || elem === "dark" ? 140 : 110);
    const parts = [];
    const cx = w * 0.5, cy = h * 0.46;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 280;
      parts.push({
        x: cx, y: cy,
        vx: Math.cos(a) * sp * (elem === "wind" ? 1.6 : 0.55),
        vy: Math.sin(a) * sp * (elem === "fire" ? -0.9 : elem === "earth" ? 0.8 : 0.4),
        r: 2 + Math.random() * (low ? 4 : 7),
        life: 0.55 + Math.random() * 0.7,
        age: -Math.random() * 0.15,
        c: pal.fill[(i % pal.fill.length)]
      });
    }
    if (elem === "earth" && !low) {
      for (let i = 0; i < 10; i++) {
        parts.push({
          x: w * (0.18 + Math.random() * 0.64), y: -20,
          vx: (Math.random() - 0.5) * 40, vy: 220 + Math.random() * 260,
          r: 8 + Math.random() * 14, life: 0.9, age: -i * 0.04,
          c: pal.fill[2], rock: true
        });
      }
    }
    let t0 = 0, dead = false;
    function frame(ts) {
      if (dead) return;
      if (!t0) t0 = ts;
      const dt = Math.min(0.033, (ts - t0) / 1000); t0 = ts;
      ctx.clearRect(0, 0, w, h);
      if (elem === "light" || elem === "dark") {
        const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, 220);
        g.addColorStop(0, pal.fill[0] + "cc");
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, 200, 0, Math.PI * 2); ctx.fill();
      }
      parts.forEach(p => {
        p.age += dt;
        if (p.age < 0) return;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (elem === "fire") p.vy -= 180 * dt;
        if (elem === "water") p.vy += 220 * dt;
        if (elem === "earth") p.vy += 420 * dt;
        const k = Math.max(0, 1 - p.age / p.life);
        ctx.globalAlpha = k;
        ctx.fillStyle = p.c;
        if (p.rock) {
          ctx.fillRect(p.x, p.y, p.r, p.r * 0.7);
        } else {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * k, 0, Math.PI * 2); ctx.fill();
        }
      });
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
    for (let i = 0; i < 12; i++) {
      const d = document.createElement("div");
      d.className = "fx-spark fx-" + elem;
      d.style.left = (18 + Math.random() * 64) + "%";
      d.style.top = (28 + Math.random() * 40) + "%";
      d.style.animationDelay = (i * 0.04) + "s";
      stage.appendChild(d);
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

      const src = await resolveFace(card);
      paintCard(src, card.name || "");

      setTimeout(() => { if (fxCard) fxCard.classList.add("out"); }, T.show);
      let handle = null;
      setTimeout(() => {
        if (low) cssFallback(stage, elem);
        else handle = burst(elem, kind, false);
        if (kind === "earthquake" && game) game.classList.add("quake");
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

  return { play, T, elemOf };
})();
