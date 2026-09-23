
const Vfx = (() => {
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
    setTimeout(() => n.remove(), 1800);
    return n;
  }
  function shake(ms) {
    const g = document.getElementById("game");
    if (!g) return;
    g.classList.remove("fx-shake");
    void g.offsetWidth;
    g.classList.add("fx-shake");
    setTimeout(() => g.classList.remove("fx-shake"), ms || 280);
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
    setTimeout(() => el.classList.remove("fx-lunge"), 520);
  }
  function recoil(el) {
    if (!el) return;
    el.classList.remove("fx-recoil"); void el.offsetWidth; el.classList.add("fx-recoil");
    setTimeout(() => el.classList.remove("fx-recoil"), 480);
  }
  function slash(from, to) {
    if (!from || !to) return;
    const a = center(from), b = center(to);
    const ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    spawn("slash-arc", mx, my, { transform: "translate(-50%,-50%) rotate("+ang+"deg)" });
    spawn("slash-arc2", mx, my, { transform: "translate(-50%,-50%) rotate("+(ang+18)+"deg)" });
    for (let i = 0; i < 8; i++) {
      const dx = (Math.random()-0.5)*80, dy = (Math.random()-0.5)*80;
      spawn("spark", b.x+dx, b.y+dy, { animationDelay: (i*0.02)+"s" });
    }
    spawn("impact-flash", b.x, b.y);
  }
  function dmgPop(el, n) {
    if (!el || !n) return;
    const r = el.getBoundingClientRect();
    // v0.253: above HP gem digit on minions (not covering baked face numbers)
    const isMinion = el.classList && el.classList.contains("minion");
    const x = isMinion ? (r.left + r.width * 0.78) : (r.left + r.width / 2);
    const y = isMinion ? (r.top + r.height * 0.72) : (r.top + r.height / 2 - 10);
    const p = spawn("dmg-pop", x, y);
    p.textContent = "-"+n;
  }
  async function attackSeq(atkEl, defEl, dmg, crit) {
    lunge(atkEl);
    await waitMs(180);
    slash(atkEl, defEl, crit);
    try { Sfx.playSlash(); } catch(e) {}
    shake(crit ? 340 : 220);
    recoil(defEl);
    dmgPop(defEl, dmg);
    await hitstop(crit ? 110 : 70);
    await waitMs(crit ? 280 : 180);
  }
  async function parrySeq(defEl, atkEl, dmg) {
    spawn("shield-burst", ...(() => { const c = center(defEl); return [c.x, c.y]; })());
    try { Sfx.playParry(); } catch(e) {}
    slash(defEl, atkEl, false);
    recoil(atkEl);
    dmgPop(atkEl, dmg);
    shake(180);
    await waitMs(260);
  }
  function death(el) {
    if (!el) return;
    const c = center(el);
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      spawn("shard", c.x, c.y, {
        ["--dx"]: Math.cos(ang)*90+"px",
        ["--dy"]: Math.sin(ang)*70+"px"
      });
    }
    el.classList.add("fx-dissolve");
    try { Sfx.playDeath(); } catch(e) {}
  }
  return { layer, elOf, heroOf, attackSeq, parrySeq, death, shake, slash, spawn, center };
})();
