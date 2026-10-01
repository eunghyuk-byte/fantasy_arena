# v0.404 title reference implementation

Base: `d8e5cf9976146b978eaf332b6ca0dced0d867eda` (v0.403, including v0.402 fixes).

The unchanged approved 1672x941 reference PNG is used as a CSS sprite source. Its SHA-256 is `9cf6061894009c627bea189cfc02bc48c8de36601d4d1a5a973b1603b6458a9d`. The separate text-free portal WebP remains the background. This is not a full mockup with transparent click targets.

Logo source rectangle: `(560,60,570,385)`. Normal plate: `(590,570,492,92)`. Hover plate: `(584,444,508,110)`. Original cap and rim pixels are retained; the blank x650..720 strip supplies plate interiors without baked text. All four visible labels remain DOM text inside native buttons. Source coordinates and percentage calculations are documented in title.css.

Validation commands (serve the client at localhost:8765; browser tests accept PLAYWRIGHT_MODULE and CHROME_PATH):

- `node --test fantasy_arena/test/*.test.js` from repository root: 475 tests.
- `node fantasy_arena/test/title-menu.browser.cjs`: menu routes and return paths; hover; keyboard focus/settings focus containment; safe blocked exit; five viewport sizes; reduced motion; touch press/cancel and navigation.
- `node fantasy_arena/test/title-reference.browser.cjs <approved-original.png>`: 1672x941 geometry, resting/hover screenshots, same-resolution overlay/difference.
- `node fantasy_arena/test/title-source-pixels.browser.cjs <approved-original.png>`: original wordmark pixel regression and label-hidden screenshot. Mean RGB-channel error in the sampled wordmark rectangle is 2.353/255 (fractional-stage resampling); the previous recreation failed at 36.484/255.

Independent visual review confirmed original border and logo fidelity, no baked-label leakage, resolved horizontal row seams, and all four controls fitting at 568x320. Parent separately reviewed the resting, hover and overlay images before authorizing v0.404 publication.

Known differences: live DOM typography, stretched blank plate interiors, a faint source-background backing around the small logo, and the requested fourth Exit button. Lobby is dark at rest and gold on hover/focus. Portrait may scroll within the fixed-aspect game stage. No assertion of 100% pixel identity is made. Native Steam wrapper shutdown is not exercised by browser tests.

No combat rules, card statistics, unit definitions, item rarities, multiplayer implementation, login, purchases or account data are changed by this release.
