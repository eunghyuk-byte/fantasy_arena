# Fantasy Arena Desktop (Electron)

Fixed 4:3 game window shell (Hearthstone-style). Wraps `../fantasy_arena` web build.

## Run (dev)
```bash
cd desktop
npm install
npm start
```

## Build Windows installer (from desktop/)
Requires Node.js. Cross-build from Linux/macOS is supported by electron-builder (downloads Windows Electron binary).

```bash
cd desktop
npm install
npm run dist          # NSIS setup + portable .exe → dist/
# or
npm run pack          # unpacked dir only (faster smoke test)
```

Artifacts (version from package.json):
- `dist/Fantasy Arena Setup <version>.exe` — NSIS installer (choose install folder)
- `dist/Fantasy Arena <version>.exe` — portable (no install)

Copy renamed builds for distribution, e.g.:
- `FantasyArena-Setup-0.0.83.exe`
- `FantasyArena-Portable-0.0.83.exe`

## Install / play (Windows)
1. Run the Setup `.exe`, pick a folder (or use Portable).
2. Launch **Fantasy Arena** — window is fixed 4:3 (default 1280×960 content).
3. In-game **설정 · 해상도**: 1024×768, 1280×960, 1600×1200, 1920×1440 (+ fullscreen).

## Resolutions
On desktop the **OS window content size** changes; the web stage fills 100% (no fluid browser layout).

## GitHub Pages
Unaffected — open `fantasy_arena/index.html` on the web as before. Desktop APIs are optional. Packaged apps load game files from `resources/fantasy_arena` (extraResources); Pages still uses the web tree.

## Linux cross-build notes
Building `--win` on Linux needs Wine (incl. wine32/i386) for rcedit/NSIS. Example (Debian/Ubuntu):
```bash
sudo dpkg --add-architecture i386
sudo apt-get update
sudo apt-get install -y wine wine64 wine32:i386
cd desktop && CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist
```
Set `CSC_IDENTITY_AUTO_DISCOVERY=false` if you are not code-signing.
