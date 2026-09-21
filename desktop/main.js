const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");

const PRESETS = {
  "1024x768": { w: 1024, h: 768 },
  "1280x960": { w: 1280, h: 960 },
  "1600x1200": { w: 1600, h: 1200 },
  "1920x1440": { w: 1920, h: 1440 }
};

const GAME_DIR = app.isPackaged
  ? path.join(process.resourcesPath, "fantasy_arena")
  : path.join(__dirname, "..", "fantasy_arena");

let mainWindow = null;

function clampToDisplay(w, h) {
  const disp = screen.getPrimaryDisplay();
  const wa = disp.workAreaSize;
  // Prefer exact chosen pixels when they fit; otherwise uniform downscale (HS-like).
  const scale = Math.min(1, wa.width / w, wa.height / h);
  return {
    w: Math.max(640, Math.round(w * scale)),
    h: Math.max(480, Math.round(h * scale)),
    scale,
    display: { w: wa.width, h: wa.height }
  };
}

function createWindow() {
  const start = PRESETS["1280x960"];
  const fit = clampToDisplay(start.w, start.h);
  mainWindow = new BrowserWindow({
    width: fit.w,
    height: fit.h,
    useContentSize: true,
    resizable: false,
    maximizable: false,
    fullscreenable: true,
    backgroundColor: "#000000",
    autoHideMenuBar: true,
    title: "판마스톤 — Fantasy Arena",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(GAME_DIR, "index.html"));

  mainWindow.on("closed", () => { mainWindow = null; });
}

function applyContentSize(win, w, h) {
  if (!win || win.isDestroyed()) return { w, h };
  const fit = clampToDisplay(w, h);
  if (win.isFullScreen()) win.setFullScreen(false);
  // Fixed content size — OS window chrome outside; game stage fills content
  win.setResizable(true);
  win.setContentSize(fit.w, fit.h);
  win.setResizable(false);
  win.center();
  return fit;
}

ipcMain.handle("desktop-info", () => ({
  isDesktop: true,
  presets: Object.keys(PRESETS),
  platform: process.platform
}));

ipcMain.handle("set-resolution", (event, payload) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const id = payload && payload.id;
  const preset = PRESETS[id] || { w: payload?.w || 1280, h: payload?.h || 960 };
  const fit = applyContentSize(win, preset.w, preset.h);
  return { ok: true, id: id || `${preset.w}x${preset.h}`, ...fit, logical: preset };
});

ipcMain.handle("set-fullscreen", (event, on) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { ok: false };
  win.setFullScreen(!!on);
  return { ok: true, fullscreen: win.isFullScreen() };
});

ipcMain.handle("get-bounds", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return null;
  const b = win.getContentBounds();
  return { width: b.width, height: b.height, fullscreen: win.isFullScreen() };
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
