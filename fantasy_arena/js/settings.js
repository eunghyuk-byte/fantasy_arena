/* Fixed 16:9 stage (v0.327, 기준 1920×1080) — web letterbox/pillarbox OR Electron native window */
(function () {
  const STORAGE_RES = "fantasy-arena-resolution";
  const STORAGE_FS = "fantasy-arena-fullscreen";

  const PRESETS = [
    { id: "1280x720", w: 1280, h: 720, label: "1280 × 720 (16:9)" },
    { id: "1600x900", w: 1600, h: 900, label: "1600 × 900 (16:9)" },
    { id: "1920x1080", w: 1920, h: 1080, label: "1920 × 1080 (16:9 · 권장)" },
    { id: "2560x1440", w: 2560, h: 1440, label: "2560 × 1440 (16:9)" }
  ];
  const DEFAULT_RES = "1920x1080";

  function desktop() {
    return (typeof window !== "undefined" && window.fantasyArenaDesktop) || null;
  }

  function getPreset(id) {
    return PRESETS.find(p => p.id === id) || PRESETS.find(p => p.id === DEFAULT_RES);
  }

  function loadResId() {
    try {
      const v = localStorage.getItem(STORAGE_RES);
      if (v && PRESETS.some(p => p.id === v)) return v;   // 옛 4:3 값(1280x960 등)은 무시 → 기본값
    } catch (e) {}
    return DEFAULT_RES;
  }

  function loadFsWanted() {
    try { return localStorage.getItem(STORAGE_FS) === "1"; } catch (e) { return false; }
  }

  function saveResId(id) {
    try { localStorage.setItem(STORAGE_RES, id); } catch (e) {}
  }

  function saveFsWanted(on) {
    try { localStorage.setItem(STORAGE_FS, on ? "1" : "0"); } catch (e) {}
  }

  function isFullscreen() {
    const d = desktop();
    // Prefer document fullscreen (web); Electron also sets this when native FS is on in many builds
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function stageScale() {
    const app = document.getElementById("app");
    if (!app) return 1;
    const n = parseFloat(app.dataset.stageScale || "1");
    return n > 0 ? n : 1;
  }

  function applyWebStage(preset) {
    const app = document.getElementById("app");
    if (!app) return;
    document.documentElement.classList.remove("is-desktop");
    document.body.classList.remove("is-desktop");
    app.classList.remove("desktop-fill");

    const logicalW = preset.w;
    const logicalH = preset.h;
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    // Fit inside viewport WITHOUT CSS transform:scale (that broke card drag hit-tests).
    // Shrink the actual stage box uniformly; cq units keep layout proportions.
    const fit = Math.min(1, vw / logicalW, vh / logicalH);
    const w = Math.round(logicalW * fit);
    const h = Math.round(logicalH * fit);
    const sizeKey = w + "x" + h + "@" + preset.id;
    if (app.dataset.resSize === sizeKey) return;
    app.style.width = w + "px";
    app.style.height = h + "px";
    app.style.left = "50%";
    app.style.top = "50%";
    app.style.transform = "translate(-50%, -50%)";
    app.style.setProperty("--stage-w", w + "px");
    app.style.setProperty("--stage-h", h + "px");
    app.dataset.res = preset.id;
    app.dataset.stageScale = "1";
    app.dataset.resSize = sizeKey;
    app.dataset.logical = logicalW + "x" + logicalH;
    document.documentElement.style.setProperty("--stage-scale", "1");
  }

  function applyDesktopStage(preset) {
    const app = document.getElementById("app");
    if (!app) return;
    document.documentElement.classList.add("is-desktop");
    document.body.classList.add("is-desktop");
    app.classList.add("desktop-fill");
    // v0.327: window content is normally exactly the preset (16:9) → stage fills it.
    // Fullscreen / other-ratio window → aspect-fit (may scale up) + black bars, never stretch. No CSS scale.
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const fit = Math.min(vw / preset.w, vh / preset.h) || 1;
    const w = Math.round(preset.w * fit);
    const h = Math.round(preset.h * fit);
    app.style.width = w + "px";
    app.style.height = h + "px";
    app.style.left = Math.round((vw - w) / 2) + "px";
    app.style.top = Math.round((vh - h) / 2) + "px";
    app.style.transform = "none";
    app.style.setProperty("--stage-w", w + "px");
    app.style.setProperty("--stage-h", h + "px");
    app.dataset.res = preset.id;
    app.dataset.stageScale = "1";
    app.dataset.resSize = w + "x" + h + "@" + preset.id;
    app.dataset.logical = preset.w + "x" + preset.h;
    document.documentElement.style.setProperty("--stage-scale", "1");
  }

  async function applyStageResolution() {
    const preset = getPreset(loadResId());
    const d = desktop();
    if (d && d.setResolution) {
      try {
        // v0.327: 전체화면 중에는 창 크기를 바꾸지 않는다 (main.js setResolution이 전체화면을 풀어 버림) → 레터박스만
        let fsNow = false;
        try { const bnd = d.getBounds ? await d.getBounds() : null; fsNow = !!(bnd && bnd.fullscreen); } catch (e) {}
        // id + size: older desktop shells without the new 16:9 preset ids still get the right size
        if (!fsNow) await d.setResolution({ id: preset.id, w: preset.w, h: preset.h });
      } catch (e) {
        console.warn("desktop setResolution", e);
      }
      applyDesktopStage(preset);
      return;
    }
    applyWebStage(preset);
  }

  async function setFullscreen(want) {
    saveFsWanted(!!want);
    const d = desktop();
    try {
      if (d && d.setFullscreen) {
        await d.setFullscreen(!!want);
      } else if (want && !isFullscreen()) {
        const el = document.documentElement;
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      } else if (!want && isFullscreen()) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      }
    } catch (e) {
      console.warn("fullscreen", e);
    }
    await applyStageResolution();
    syncSettingsUI();
  }

  function fillResolutionSelect(sel) {
    if (!sel || sel.dataset.ready === "1") return;
    sel.innerHTML = PRESETS.map(p =>
      '<option value="' + p.id + '">' + p.label + "</option>"
    ).join("");
    sel.dataset.ready = "1";
  }

  async function syncSettingsUI() {
    const sel = document.getElementById("resSelect");
    const fs = document.getElementById("fsToggle");
    if (sel) {
      fillResolutionSelect(sel);
      sel.value = loadResId();
    }
    let fsOn = isFullscreen() || loadFsWanted();
    const d = desktop();
    if (d && d.getBounds) {
      try {
        const b = await d.getBounds();
        if (b && typeof b.fullscreen === "boolean") fsOn = b.fullscreen;
      } catch (e) {}
    }
    if (fs) fs.checked = !!fsOn;
    const bgm = document.getElementById("bgmToggle");
    if (bgm && window.Bgm) {
      try { bgm.checked = !!(Bgm.isWanted ? Bgm.isWanted() : Bgm.isOn()); } catch (e) {}
    }
    const vs = document.getElementById("bgmVol"), vv = document.getElementById("bgmVolVal");
    if (vs && window.Bgm && Bgm.getVolume) {
      const p = Math.round(Bgm.getVolume() * 100);
      vs.value = p; if (vv) vv.textContent = p;
    }
  }

  function syncCombatSettings() {
    const inCombat = !!(document.getElementById("game") && document.getElementById("game").classList.contains("active")
      && typeof state !== "undefined" && state && !state.over);
    const head = document.getElementById("settingsCombatHead");
    const btn = document.getElementById("btnSurrender");
    if (head) head.style.display = inCombat ? "" : "none";
    if (btn) btn.style.display = inCombat ? "" : "none";
  }
  function openSettings() {
    syncSettingsUI();
    syncCombatSettings();
    const pop = document.getElementById("settingsPop");
    if (pop) pop.classList.add("show");
  }

  function closeSettings() {
    const pop = document.getElementById("settingsPop");
    if (pop) pop.classList.remove("show");
  }

  function bindSettingsUI() {
    const btn = document.getElementById("btnSettings");
    const gear = document.getElementById("settingsGearBtn");
    const close = document.getElementById("btnSettingsClose");
    const pop = document.getElementById("settingsPop");
    const sel = document.getElementById("resSelect");
    const fs = document.getElementById("fsToggle");
    const bgm = document.getElementById("bgmToggle");

    if (btn) btn.onclick = openSettings;
    if (gear) gear.onclick = (e) => { e.stopPropagation(); openSettings(); };
    if (close) close.onclick = closeSettings;
    const surrender = document.getElementById("btnSurrender");
    if (surrender) surrender.onclick = () => {
      closeSettings();
      try { if (typeof confirmGiveUp === "function") confirmGiveUp(); } catch (e) {}
    };
    if (pop) pop.addEventListener("click", e => {
      if (e.target.id === "settingsPop") closeSettings();
    });
    if (sel) sel.onchange = async () => {
      saveResId(sel.value);
      await applyStageResolution();
    };
    if (fs) fs.onchange = () => { setFullscreen(fs.checked); };
    if (bgm) {
      const applyBgm = (ev) => {
        try {
          const api = (typeof Bgm !== "undefined") ? Bgm : window.Bgm;
          if (!api) return;
          // Read from the input itself (ev target) for reliability
          const on = !!(ev && ev.target ? ev.target.checked : bgm.checked);
          if (on) api.start();
          else api.stop();
        } catch (e) { console.warn("bgm toggle failed", e); }
      };
      bgm.addEventListener("change", applyBgm);
      bgm.addEventListener("click", applyBgm);
    }
    const vs = document.getElementById("bgmVol"), vv = document.getElementById("bgmVolVal");
    if (vs) vs.addEventListener("input", () => {
      const p = Math.max(0, Math.min(100, +vs.value || 0));
      if (vv) vv.textContent = p;
      try { const api = (typeof Bgm !== "undefined") ? Bgm : window.Bgm; if (api) api.setVolume(p / 100); } catch (e) {}
      try { const api = (typeof Sfx !== "undefined") ? Sfx : window.Sfx; if (api) api.setVolume(p / 100); } catch (e) {}
    });
  }

  window.StageSettings = {
    PRESETS,
    apply: applyStageResolution,
    stageScale,
    open: openSettings,
    close: closeSettings,
    setFullscreen,
    isDesktop: () => !!desktop()
  };

  window.__stageScale = stageScale;

  function onReady() {
    bindSettingsUI();
    applyStageResolution();
    syncSettingsUI();
  }

  let _resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => {
      applyStageResolution();
      // Full HUD/board reseat — partial slots/decks left endBtn+heroes stranded after coin modal
      try {
        if (typeof ensureBoardLayouts === "function") ensureBoardLayouts(true);
        else if (typeof runBoardLayouts === "function") runBoardLayouts(true);
      } catch (e) {}
    }, 120);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => {
      clearTimeout(_resizeTimer);
      _resizeTimer = setTimeout(() => {
        applyStageResolution();
        try {
          if (typeof ensureBoardLayouts === "function") ensureBoardLayouts(true);
          else if (typeof runBoardLayouts === "function") runBoardLayouts(true);
        } catch (e) {}
      }, 120);
    });
  }
  document.addEventListener("fullscreenchange", () => {
    applyStageResolution();
    syncSettingsUI();
  });
  document.addEventListener("webkitfullscreenchange", () => {
    applyStageResolution();
    syncSettingsUI();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    onReady();
  }
})();
