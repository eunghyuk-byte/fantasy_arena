const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("fantasyArenaDesktop", {
  isDesktop: true,
  info: () => ipcRenderer.invoke("desktop-info"),
  setResolution: (idOrSize) => ipcRenderer.invoke("set-resolution", typeof idOrSize === "string" ? { id: idOrSize } : idOrSize),
  setFullscreen: (on) => ipcRenderer.invoke("set-fullscreen", !!on),
  getBounds: () => ipcRenderer.invoke("get-bounds")
});
