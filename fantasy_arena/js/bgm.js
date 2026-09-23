const Bgm = (() => {
  const BASE = "assets/audio/bgm/";
  const STEMS = { menu: "menu", battle: "battle" };
  const EXTS = [".ogg", ".mp3", ".m4a", ".wav"];
  let unlocked = false, wanted = true, track = "menu";
  let vol = 0.36, duckMul = 1;
  const beds = { menu: null, battle: null };
  const urls = { menu: "", battle: "" };

  function applyVol() {
    const v = wanted ? vol * duckMul : 0;
    Object.keys(beds).forEach(k => {
      const a = beds[k];
      if (a) a.volume = (k === track ? v : 0);
    });
    const tog = document.getElementById("bgmToggle");
    if (tog) tog.checked = !!wanted;
  }

  async function resolveUrl(stem) {
    for (const ext of EXTS) {
      const url = BASE + stem + ext;
      try {
        const res = await fetch(url, { method: "HEAD", cache: "force-cache" });
        if (res.ok) return url;
      } catch (e) {}
      // file:// HEAD may fail — probe with audio
      const ok = await new Promise(r => {
        const a = new Audio();
        a.preload = "metadata";
        a.oncanplaythrough = () => r(true);
        a.onerror = () => r(false);
        setTimeout(() => r(false), 600);
        a.src = url;
      });
      if (ok) return url;
    }
    return "";
  }

  function makeBed(kind, url) {
    const a = new Audio(url);
    a.loop = true;
    a.preload = "auto";
    a.volume = 0;
    beds[kind] = a;
    urls[kind] = url;
    return a;
  }

  async function ensure(kind) {
    if (beds[kind]) return beds[kind];
    const url = await resolveUrl(STEMS[kind]);
    if (!url) return null;
    return makeBed(kind, url);
  }

  function fade(audio, to, ms) {
    if (!audio) return;
    const from = audio.volume;
    const steps = Math.max(4, Math.floor(ms / 40));
    let i = 0;
    const id = setInterval(() => {
      i++;
      audio.volume = Math.max(0, Math.min(1, from + (to - from) * (i / steps)));
      if (i >= steps) clearInterval(id);
    }, 40);
  }

  async function to(kind, ms) {
    track = kind === "battle" ? "battle" : "menu";
    if (!unlocked || !wanted) { applyVol(); return; }
    const next = await ensure(track);
    const other = track === "battle" ? beds.menu : beds.battle;
    const fadeMs = ms == null ? 900 : ms;
    if (next) {
      try { await next.play(); } catch (e) {}
      fade(next, vol * duckMul, fadeMs);
    }
    if (other && other !== next) fade(other, 0, fadeMs);
    applyVol();
  }

  async function start() {
    wanted = true;
    unlocked = true;
    await ensure("menu");
    await ensure("battle");
    await to(track, 400);
  }
  function stop() {
    wanted = false;
    Object.values(beds).forEach(a => { if (a) { a.pause(); a.volume = 0; } });
    applyVol();
  }
  function toggle() {
    if (!unlocked) { start(); return; }
    if (wanted) stop(); else start();
  }
  function duck(on, ms) {
    duckMul = on ? 0.34 : 1;
    const a = beds[track];
    if (!a) return;
    fade(a, wanted ? vol * duckMul : 0, ms || 80);
  }
  function setVolume(v) { vol = Math.max(0, Math.min(1, +v || 0)); applyVol(); }
  function isOn() { return wanted && unlocked; }

  function isWanted() { return !!wanted; }
  return { start, stop, toggle, to, duck, setVolume, isOn, isWanted, track: () => track };
})();
const TavernBgm = Bgm;
