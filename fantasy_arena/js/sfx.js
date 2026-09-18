
const Sfx = (() => {
  let ctx = null;
  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function envGain(c, t, a, d, peak) {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    return g;
  }
  function playCardDrop() {
    const c = ac(); const t = c.currentTime;
    const o1 = c.createOscillator(); o1.type = "sine";
    o1.frequency.setValueAtTime(520, t);
    o1.frequency.exponentialRampToValueAtTime(180, t + 0.22);
    const g1 = envGain(c, t, 0.012, 0.28, 0.09);
    const f1 = c.createBiquadFilter(); f1.type = "lowpass"; f1.frequency.value = 1400;
    o1.connect(f1); f1.connect(g1); g1.connect(c.destination);
    o1.start(t); o1.stop(t + 0.32);
    const o2 = c.createOscillator(); o2.type = "triangle";
    o2.frequency.setValueAtTime(220, t);
    o2.frequency.exponentialRampToValueAtTime(90, t + 0.18);
    const g2 = envGain(c, t, 0.01, 0.2, 0.07);
    o2.connect(g2); g2.connect(c.destination);
    o2.start(t); o2.stop(t + 0.24);
    const len = Math.floor(c.sampleRate * 0.16);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
    const n = c.createBufferSource(); n.buffer = buf;
    const nf = c.createBiquadFilter(); nf.type = "highpass"; nf.frequency.value = 900;
    const ng = envGain(c, t, 0.008, 0.14, 0.045);
    n.connect(nf); nf.connect(ng); ng.connect(c.destination); n.start(t);
  }
  function playTurn() {
    const c = ac(); const t = c.currentTime;
    [392, 494, 587].forEach((f, i) => {
      const o = c.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(f, t + i * 0.07);
      const g = envGain(c, t + i * 0.07, 0.02, 0.22, 0.06);
      o.connect(g); g.connect(c.destination);
      o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.28);
    });
  }
  function playCoin() {
    const c = ac(); const t = c.currentTime;
    const o = c.createOscillator(); o.type = "triangle";
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(240, t + 0.18);
    const g = envGain(c, t, 0.008, 0.2, 0.07);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.22);
    const o2 = c.createOscillator(); o2.type = "sine";
    o2.frequency.setValueAtTime(1320, t + 0.04);
    o2.frequency.exponentialRampToValueAtTime(420, t + 0.16);
    const g2 = envGain(c, t + 0.04, 0.006, 0.14, 0.035);
    o2.connect(g2); g2.connect(c.destination); o2.start(t + 0.04); o2.stop(t + 0.2);
  }
  function playSpell(kind) {
    const c = ac(); const t = c.currentTime;
    const table = {
      aoe_enemy: [110, 0.22, "sawtooth"],
      earthquake: [48, 0.32, "sawtooth"],
      tornado: [240, 0.28, "sine"],
      magnet: [520, 0.24, "triangle"],
      smash: [70, 0.18, "square"],
      petrify: [150, 0.24, "triangle"],
      maze: [280, 0.2, "sine"],
      sandtrap: [90, 0.22, "sawtooth"],
      sandhell: [80, 0.26, "sawtooth"],
      seal_giant: [130, 0.22, "square"],
    };
    const [f, d, typ] = table[kind] || [170, 0.18, "sine"];
    const o = c.createOscillator(); o.type = typ;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, f * 0.45), t + d);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + d + 0.02);
  }
  playSpell.spell = playSpell;

  function noiseBurst(c, t, dur, hpFreq, peak) {
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/len, 2.2);
    const n = c.createBufferSource(); n.buffer = buf;
    const f = c.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hpFreq;
    const g = envGain(c, t, 0.004, dur, peak);
    n.connect(f); f.connect(g); g.connect(c.destination); n.start(t);
  }

  function playSlash() {
    const c = ac(); const t = c.currentTime;
    function swipe(off, f0, f1, peak) {
      const len = Math.floor(c.sampleRate * 0.16);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const p = i / len;
        d[i] = (Math.random()*2-1) * Math.pow(1-p, 1.6);
      }
      const src = c.createBufferSource(); src.buffer = buf;
      const bp = c.createBiquadFilter(); bp.type = "bandpass";
      bp.frequency.setValueAtTime(f0, t+off);
      bp.frequency.exponentialRampToValueAtTime(f1, t+off+0.14);
      bp.Q.value = 1.8;
      const g = envGain(c, t+off, 0.004, 0.15, peak);
      src.connect(bp); bp.connect(g); g.connect(c.destination);
      src.start(t+off);
      const o = c.createOscillator(); o.type = "triangle";
      o.frequency.setValueAtTime(f0*0.55, t+off);
      o.frequency.exponentialRampToValueAtTime(180, t+off+0.11);
      const og = envGain(c, t+off, 0.002, 0.10, peak*0.45);
      o.connect(og); og.connect(c.destination); o.start(t+off); o.stop(t+off+0.12);
    }
    swipe(0, 2400, 420, 0.11);
    swipe(0.07, 1800, 280, 0.08);
  }
  function playParry() {
    const c = ac(); const t = c.currentTime;
    const len = Math.floor(c.sampleRate * 0.22);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/len, 2.0);
    const src = c.createBufferSource(); src.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = "bandpass";
    bp.frequency.setValueAtTime(900, t);
    bp.frequency.exponentialRampToValueAtTime(220, t+0.16);
    bp.Q.value = 2.4;
    const g = envGain(c, t, 0.002, 0.18, 0.13);
    src.connect(bp); bp.connect(g); g.connect(c.destination); src.start(t);
    [0, 0.045].forEach((off, i) => {
      const o = c.createOscillator(); o.type = "square";
      o.frequency.setValueAtTime(i ? 210 : 340, t+off);
      o.frequency.exponentialRampToValueAtTime(70, t+off+0.09);
      const og = envGain(c, t+off, 0.002, 0.10, 0.07);
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1400;
      o.connect(lp); lp.connect(og); og.connect(c.destination);
      o.start(t+off); o.stop(t+off+0.11);
    });
  }
  function playDeath() {
    const c = ac(); const t = c.currentTime;
    const len = Math.floor(c.sampleRate * 0.55);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const p = i / len;
      const flutter = (p < 0.18 || (p > 0.28 && p < 0.42) || (p > 0.55 && p < 0.7)) ? 1 : 0.25;
      d[i] = (Math.random()*2-1) * Math.pow(1-p, 1.15) * flutter;
    }
    const src = c.createBufferSource(); src.buffer = buf;
    const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1600;
    const g = envGain(c, t, 0.006, 0.48, 0.10);
    src.connect(hp); hp.connect(g); g.connect(c.destination); src.start(t);
    const o = c.createOscillator(); o.type = "sawtooth";
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(40, t+0.4);
    const og = envGain(c, t, 0.01, 0.38, 0.035);
    o.connect(og); og.connect(c.destination); o.start(t); o.stop(t+0.42);
  }
  return { playCardDrop, playTurn, playCoin, playSpell, spell: playSpell, playSlash, playParry, playDeath };

})();
