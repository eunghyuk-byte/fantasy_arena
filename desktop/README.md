# Fantasy Arena Desktop (Electron)

Fixed 4:3 game window shell (Hearthstone-style). Wraps `../fantasy_arena` web build.

## Run
```bash
cd desktop
npm install
npm start
```

## Resolutions
In-game **설정 · 해상도**: 1024×768, 1280×960, 1600×1200, 1920×1440 (+ fullscreen).
On desktop the **OS window content size** changes; the web stage fills 100% (no fluid browser layout).

## GitHub Pages
Unaffected — open `fantasy_arena/index.html` on the web as before. Desktop APIs are optional.

## Steam / installer
Packaging (electron-builder / Steamworks) is out of scope for this pass; this shell is the fixed-window foundation.
