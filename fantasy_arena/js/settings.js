/* Fixed 4:3 stage — web letterbox OR Electron native window */
(function () {
  const STORAGE_RES = "fantasy-arena-resolution";
  const STORAGE_FS = "fantasy-arena-fullscreen";

  const PRESETS = [
    { id: "1024x768", w: 1024, h: 768, label: "1024 × 768 (4:3)" },
    { id: "1280x960", w: 1280, h: 960, label: "1280 × 960 (4:3)" },
    { id: "1600x1200", w: 1600, h: 1200, label: "1600 × 1200 (4:3)" },
    { id: "1920x1440", w: 1920, h: 1440, label: "1920 × 1440 (4:3)" }
  ];

  function desktop() {
    return (typeof window !== "undefined" && window.fantasyArenaDesktop) || null;
  }

  function getPreset(id) {
    return PRESETS.find(p => p.id === id) || PRESETS[1];
  }

  function loadResId() {
    try {
      const v = localStorage.getItem(STORAGE_RES);
      if (v && PRESETS.some(p => p.id === v)) return v;
    } catch (e) {}
    return "1280x960";
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
    // Window content size IS the stage — fill 100%, no CSS scale (drag/layout stable)
    app.style.width = "100%";
    app.style.height = "100%";
    app.style.left = "0";
    app.style.top = "0";
    app.style.transform = "none";
    app.style.setProperty("--stage-w", "100%");
    app.style.setProperty("--stage-h", "100%");
    app.dataset.res = preset.id;
    app.dataset.stageScale = "1";
    app.dataset.resSize = preset.w + "x" + preset.h;
    document.documentElement.style.setProperty("--stage-scale", "1");
  }

  async function applyStageResolution() {
    const preset = getPreset(loadResId());
    const d = desktop();
    if (d && d.setResolution) {
      try {
        await d.setResolution(preset.id);
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
      const applyBgm = () => {
        try {
          if (!window.Bgm) return;
          if (bgm.checked) Bgm.start();
          else Bgm.stop(); // immediate mute+pause
        } catch (e) {}
      };
      bgm.addEventListener("change", applyBgm);
      bgm.addEventListener("input", applyBgm);
    }
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
