# Elemental gate title — v0.403

Base: `76c655ab535a866ff9a3ea70d1c3fdabdf2f7cbd` (v0.402).
Approved artwork only imported from `e7ec9dc13d5460ae3b7e0a9ebb6203bdd6df056e`:
`assets/img/ui/element-portal-background.webp`, 1672 × 941, 519060 bytes.

## Scope

- Existing logo/emblem and online lobby/shop/settings routes retained; four real buttons include Game Exit.
- Title-only background, gold hover/focus, pointer hold/cancel feedback, reduced motion and small-screen containment.
- Exit uses the existing optional `fantasyArenaDesktop.quit()` contract; otherwise `window.close()` and a polite Korean status message if still open. No navigation, storage clearing, native process control or new desktop permissions.
- Title-origin settings/help dialogs manage focus, Tab wrapping, Escape and focus restoration.
- No login, payments, combat, fatigue or card-stat changes. Desktop wrapper code is unchanged; a real packaged Steam/Electron session was not available for native exit validation.

## Verification

- `node --test fantasy_arena/test/*.test.js`: 475 passing, zero failures.
- Initial Windows checkout had 11 environment failures: ten manifest byte-size mismatches from CRLF conversion and one missing historical commit used by combat-state-preservation. Restoring original LF bytes and fetching `322b6392498c2eee42d9b92f559cb6db9edf3994` resolved them; no unrelated source changes were retained.
- New exit tests exercise both buttons, desktop bridge, rejected bridge and closed-window behavior.
- `test/title-menu.browser.cjs`: Chrome menu labels/order, hover change, focus-visible, shop/settings/lobby return, settings forward/reverse Tab wrap, nested Help, Escape/return focus, blocked browser exit, touch hold/cancel/tap, reduced motion and JS error checks.
- Desktop sizes: 1600×900, 1280×720; landscape: 844×390, 640×360, 568×320; narrow fallback: 360×640 (scrollable title, no overlap). Buttons remain at least 44px high.
- Independent review found settings and nested-help focus issues; both corrected and independently rechecked.

## Re-running browser QA

Serve the client directory (`fantasy_arena/`) at `http://127.0.0.1:8765`.
Run `node fantasy_arena/test/title-menu.browser.cjs` from the repository root.
Requires an available Playwright module and Chrome; set `PLAYWRIGHT_MODULE` to a module path if it is not installed locally, and optionally `CHROME_PATH` to the browser executable.
The script saves actual browser screenshots in `screenshots/` under its working directory. The blocked-exit case deliberately substitutes `window.close` so the automation-owned page remains available to assert the fallback; native bridge behavior is covered by unit tests.

Publication remains with the parent task: verify main is still the agreed base, then coordinate the v0.403 release. This checkout does not push or merge main.
