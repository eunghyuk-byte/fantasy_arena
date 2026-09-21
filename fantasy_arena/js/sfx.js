const Sfx = (() => {
  const BASE = "assets/audio/sfx/";
  const FILES = {
    slash: "sfx_slash",
    slashCrit: "sfx_slash_crit",
    parry: "sfx_parry",
    death: "sfx_death",
    cardDrop: "sfx_card_play",
    draw: "sfx_card_draw",
    summon: "sfx_summon",
    heroHit: "sfx_hero_hit",
    turn: "sfx_turn",
    win: "sfx_win",
    lose: "sfx_lose",
    click: "sfx_ui_click",
    cast: "sfx_cast_charge",
    coin: "sfx_coin",
    spell_fire: "sfx_spell_fire",
    spell_water: "sfx_spell_water",
    spell_wind: "sfx_spell_wind",
    spell_earth: "sfx_spell_earth",
    spell_light: "sfx_spell_light",
    spell_dark: "sfx_spell_dark"
  };
  const EXTS = [".ogg", ".mp3", ".wav"];
  let ctx = null, sfxGain = null, muted = false, vol = 0.85;
  const cache = new Map();
  function ac() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      sfxGain = ctx.createGain();
      sfxGain.gain.value = vol;
      sfxGain.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function duck(ms) {
    try { if (window.TavernBgm && TavernBgm.duck) TavernBgm.duck(true, 60); } catch (e) {}
    setTimeout(() => {
      try { if (window.TavernBgm && TavernBgm.duck) TavernBgm.duck(false, 180); } catch (e) {}
    }, ms || 280);
  }
  function envGain(c, t, a, d, peak) {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    return g;
  }
  async function load(stem) {
    if (cache.has(stem)) return cache.get(stem);
    const c = ac();
    let buf = null;
    for (const ext of EXTS) {
      try {
        const res = await fetch(BASE + stem + ext, { cache: "force-cache" });
        if (!res.ok) continue;
        buf = await c.decodeAudioData(await res.arrayBuffer());
        break;
      } catch (e) {}
    }
    cache.set(stem, buf);
    return buf;
  }
  function playBuf(buf, opts) {
    opts = opts || {};
    if (!buf || muted) return false;
    const c = ac();
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.value = opts.gain == null ? 1 : opts.gain;
    src.connect(g); g.connect(sfxGain);
    src.start(c.currentTime + (opts.when || 0));
    return true;
  }
  async function playKey(key, opts) {
    if (muted) return false;
    const stem = FILES[key];
    if (!stem) return false;
    const buf = await load(stem);
    if (!buf) return false;
    opts = opts || {};
    if (!opts.noDuck && opts.duckMs !== 0) duck(opts.duckMs);
    return playBuf(buf, opts);
  }
  function synthTone(freqs, peak, dur) {
    const c = ac(); const t = c.currentTime;
    freqs.forEach((f, i) => {
      const o = c.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(f, t + i * 0.04);
      const g = envGain(c, t + i * 0.04, 0.015, dur, peak);
      o.connect(g); g.connect(sfxGain);
      o.start(t + i * 0.04); o.stop(t + i * 0.04 + dur + 0.05);
    });
  }
  function synthNoise(dur, peak, hp) {
    const c = ac(); const t = c.currentTime;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const n = c.createBufferSource(); n.buffer = buf;
    const f = c.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp || 800;
    const g = envGain(c, t, 0.008, dur, peak);
    n.connect(f); f.connect(g); g.connect(sfxGain); n.start(t);
  }
  function playSlash(crit) {
    playKey(crit ? "slashCrit" : "slash", { duckMs: 220 }).then(ok => {
      if (ok) return;
      synthNoise(0.12, crit ? 0.12 : 0.08, 1200);
      synthTone(crit ? [740, 420] : [520], 0.07, 0.16);
    });
  }
  function playParry() {
    playKey("parry", { duckMs: 200 }).then(ok => {
      if (ok) return;
      synthTone([980, 640], 0.08, 0.12);
      synthNoise(0.08, 0.05, 1800);
    });
  }
  function playDeath() {
    playKey("death", { duckMs: 420 }).then(ok => {
      if (ok) return;
      synthTone([180, 110], 0.06, 0.35);
      synthNoise(0.28, 0.05, 400);
    });
  }
  function playCardDrop() {
    playKey("cardDrop", { duckMs: 160 }).then(ok => {
      if (ok) return;
      synthTone([520, 180], 0.07, 0.2);
      synthNoise(0.14, 0.04, 900);
    });
  }
  function playDraw() {
    playKey("draw", { duckMs: 140 }).then(ok => { if (!ok) synthTone([660, 440], 0.05, 0.14); });
  }
  function playSummon() {
    playKey("summon", { duckMs: 260 }).then(ok => { if (!ok) synthTone([392, 523, 659], 0.06, 0.22); });
  }
  function playHeroHit() {
    playKey("heroHit", { duckMs: 240 }).then(ok => {
      if (!ok) { synthTone([140], 0.08, 0.2); synthNoise(0.16, 0.06, 300); }
    });
  }
  function playTurn() {
    playKey("turn", { duckMs: 180 }).then(ok => { if (!ok) synthTone([392, 494, 587], 0.055, 0.2); });
  }
  function playWin() {
    playKey("win", { duckMs: 600 }).then(ok => { if (!ok) synthTone([523, 659, 784, 1046], 0.07, 0.28); });
  }
  function playLose() {
    playKey("lose", { duckMs: 600 }).then(ok => { if (!ok) synthTone([392, 311, 247], 0.06, 0.32); });
  }
  let _clickAt = 0;
  function playClick() {
    const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    if (now - _clickAt < 45) return;
    _clickAt = now;
    // UI click must NOT duck BGM — rapid ducking sounds like crackle/static
    playKey("click", { noDuck: true, gain: 0.32 }).then(ok => {
      if (!ok) synthTone([880], 0.025, 0.05);
    });
  }
  function playCast() {
    playKey("cast", { duckMs: 200 }).then(ok => { if (!ok) synthTone([300, 480], 0.05, 0.25); });
  }
  function playCoin() {
    playKey("coin", { duckMs: 120 }).then(ok => { if (!ok) synthTone([880, 240], 0.06, 0.16); });
  }
  function playSpell(kind) {
    const map = {
      fire: "spell_fire", water: "spell_water", wind: "spell_wind",
      earth: "spell_earth", light: "spell_light", dark: "spell_dark",
      earthquake: "spell_earth", burst: "spell_earth"
    };
    playCast();
    playKey(map[kind] || "spell_earth", { duckMs: 500 }).then(ok => {
      if (!ok) synthTone([240, 180], 0.05, 0.3);
    });
  }
  function setVolume(v) {
    vol = Math.max(0, Math.min(1, +v || 0));
    if (sfxGain) sfxGain.gain.value = muted ? 0 : vol;
  }
  function setMuted(m) {
    muted = !!m;
    if (sfxGain) sfxGain.gain.value = muted ? 0 : vol;
  }
  function warmup() { Object.values(FILES).forEach(stem => load(stem)); }
  return {
    playSlash, playParry, playDeath, playCardDrop, playDraw, playSummon,
    playHeroHit, playTurn, playWin, playLose, playClick, playCast, playCoin,
    playSpell, spell: playSpell, setVolume, setMuted, warmup, FILES
  };
})();
