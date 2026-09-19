
const Vfx = (() => {
  function lowSpec() {
    try {
      if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
      if (navigator.deviceMemory && navigator.deviceMemory < 4) return true;
      if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) return true;
    } catch (e) {}
    return false;
  }
  function layer() {
    let el = document.getElementById("battleFx");
    if (!el) {
      el = document.createElement("div");
      el.id = "battleFx";
      const g = document.getElementById("game") || document.body;
      g.appendChild(el);
    }
    return el;
  }
  function elOf(uid) {
    return document.querySelector('.minion[data-uid="'+uid+'"]');
  }
  function heroOf(isMe) {
    const strip = document.getElementById(isMe ? "myStrip" : "oppStrip");
    return strip ? strip.querySelector(".hero-slot") : null;
  }
  function center(el) {
    if (!el) return { x: innerWidth/2, y: innerHeight/2 };
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2, w: r.width, h: r.height };
  }
  function spawn(cls, x, y, extra) {
    const n = document.createElement("div");
    n.className = "vfx " + cls;
    n.style.left = x + "px";
    n.style.top = y + "px";
    if (extra) Object.assign(n.style, extra);
    layer().appendChild(n);
    setTimeout(() => n.remove(), 2200);
    return n;
  }
  function shake(ms, intense) {
    const g = document.getElementById("game");
    if (!g) return;
    g.classList.remove("fx-shake", "fx-shake-soft", "fx-shake-hard");
    void g.offsetWidth;
    const cls = intense ? "fx-shake-hard" : "fx-shake-soft";
    g.classList.add("fx-shake", cls);
    setTimeout(() => g.classList.remove("fx-shake", "fx-shake-soft", "fx-shake-hard"), ms || 300);
  }
  function hitstop(ms) {
    const g = document.getElementById("game");
    if (!g) return Promise.resolve();
    g.classList.add("fx-stop");
    return new Promise(res => setTimeout(() => { g.classList.remove("fx-stop"); res(); }, ms));
  }
  function lunge(el) {
    if (!el) return;
    el.classList.remove("fx-lunge"); void el.offsetWidth; el.classList.add("fx-lunge");
    setTimeout(() => el.classList.remove("fx-lunge"), 560);
  }
  function recoil(el) {
    if (!el) return;
    el.classList.remove("fx-recoil"); void el.offsetWidth; el.classList.add("fx-recoil");
    setTimeout(() => el.classList.remove("fx-recoil"), 520);
  }
  function slash(from, to, crit) {
    if (!from || !to) return;
    const low = lowSpec();
    const a = center(from), b = center(to);
    const ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    // Multi-frame slash arcs
    spawn(crit ? "slash-arc crit" : "slash-arc", mx, my, {
      transform: "translate(-50%,-50%) rotate("+ang+"deg)"
    });
    spawn("slash-arc2", mx, my, {
      transform: "translate(-50%,-50%) rotate("+(ang+16)+"deg)",
      animationDelay: "0.03s"
    });
    if (!low) {
      spawn("slash-arc3", mx, my, {
        transform: "translate(-50%,-50%) rotate("+(ang-14)+"deg)",
        animationDelay: "0.05s"
      });
      spawn(crit ? "slash-glow crit" : "slash-glow", mx, my, {
        transform: "translate(-50%,-50%) rotate("+ang+"deg)"
      });
    }
    const sparkN = low ? (crit ? 8 : 5) : (crit ? 22 : 14);
    for (let i = 0; i < sparkN; i++) {
      const dx = (Math.random()-0.5)*100, dy = (Math.random()-0.5)*100;
      spawn(i % 3 === 0 ? "spark spark-hot" : "spark", b.x+dx, b.y+dy, {
        animationDelay: (i*0.018)+"s"
      });
    }
    if (!low) {
      for (let i = 0; i < (crit ? 8 : 4); i++) {
        const dx = (Math.random()-0.5)*40, dy = (Math.random()-0.5)*40;
        spawn("spark-trail", b.x+dx, b.y+dy, { animationDelay: (i*0.025)+"s" });
      }
    }
    spawn(crit ? "impact-flash crit" : "impact-flash", b.x, b.y);
    if (!low) spawn("impact-ring", b.x, b.y);
  }
  function dmgPop(el, n) {
    if (!el || !n) return;
    const c = center(el);
    const p = spawn("dmg-pop", c.x, c.y - 10);
    p.textContent = "-"+n;
  }
  async function attackSeq(atkEl, defEl, dmg, crit) {
    lunge(atkEl);
    await waitMs(190);
    slash(atkEl, defEl, crit);
    try { Sfx.playSlash(); } catch(e) {}
    shake(crit ? 360 : 240, !!crit);
    recoil(defEl);
    dmgPop(defEl, dmg);
    await hitstop(crit ? 120 : 75);
    await waitMs(crit ? 300 : 200);
  }
  async function parrySeq(defEl, atkEl, dmg) {
    const low = lowSpec();
    const c = center(defEl);
    spawn("shield-burst", c.x, c.y);
    if (!low) {
      spawn("shield-burst shield-burst-inner", c.x, c.y);
      spawn("shield-flash", c.x, c.y);
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * Math.PI * 2;
        spawn("spark spark-ice", c.x + Math.cos(ang)*28, c.y + Math.sin(ang)*28, {
          animationDelay: (i*0.02)+"s"
        });
      }
    }
    try { Sfx.playParry(); } catch(e) {}
    slash(defEl, atkEl, false);
    recoil(atkEl);
    dmgPop(atkEl, dmg);
    shake(200, false);
    await waitMs(280);
  }
  function death(el) {
    if (!el) return;
    const low = lowSpec();
    const c = center(el);
    const shardN = low ? 10 : 28;
    for (let i = 0; i < shardN; i++) {
      const ang = (i / shardN) * Math.PI * 2 + Math.random() * 0.2;
      const dist = low ? 70 : 90 + Math.random() * 50;
      spawn(i % 4 === 0 ? "shard shard-glow" : "shard", c.x, c.y, {
        ["--dx"]: Math.cos(ang)*dist+"px",
        ["--dy"]: Math.sin(ang)*dist*0.85+"px",
        animationDelay: (i * 0.012) + "s"
      });
    }
    if (!low) {
      for (let i = 0; i < 12; i++) {
        spawn("death-ember", c.x + (Math.random()-0.5)*30, c.y + (Math.random()-0.5)*30, {
          animationDelay: (i * 0.03) + "s"
        });
      }
      spawn("death-flash", c.x, c.y);
    }
    el.classList.add("fx-dissolve");
    try { Sfx.playDeath(); } catch(e) {}
  }
  return { layer, elOf, heroOf, attackSeq, parrySeq, death, shake, slash, spawn, center, lowSpec };
})();
