# UI interaction QA for v0.395

Base: published v0.394, d7f01402e7274864547d5a733442ddb0ed631676.

## Requested changes

- Opening-hand deck-to-hand animation plays at 1.5× speed: 720ms / 1.5 = 480ms per card. A per-player opening marker is consumed once. Later turn draws retain 720ms.
- End-turn button center tracks the board artwork's right gold rail and center divider: (3030, 1012) in the 3840×2160 source. Old fixed-pixel offsets are removed. Button size and pointer hitbox are unchanged.
- Both hero icons track the arch horizontal center at source x=3186. Their vertical positions, dimensions and HP seats are unchanged.
- Dragging a hand card hides the original without removing its hand data or layout slot. The visual proxy is inaccessible and contains no duplicated IDs. Valid play consumes the card; cancellation restores it.

## Automated browser observations

Final code staging e97a96c8abcdb99fc32f4c2410d16bc00003ecf9 was exercised in Chromium with real CSS, DOM geometry, Web Animations and pointer events.

- At 1366×768, 1920×1080, 2560×1440 and 1280×960, measured button/hero center errors relative to board art were below 0.02 CSS pixels. All button centers hit the button and real clicks advanced the turn.
- Four- and five-card opening sequences requested 480ms per flight. Observed animation-finish elapsed times were approximately 477–483ms. The next draw requested 720ms, observed approximately 731–738ms. No opening card remained hidden.
- Hand drag source opacity was 0 while dragging, with identical source rectangles before/during drag and exactly one visual proxy. Invalid drop, Escape, pointercancel and touch cancellation restored opacity 1 with no leftover ghost.
- Valid minion drop changed hand 1→0 and board 0→1.
- Valid targeted Giant Seal drag consumed the hand card and removed its eligible enemy target.
- Turn transition and reset canceled dragging without consuming the source hand card.
- Board drag cancellation by blur followed by a new gesture preserved the intended [e1, e2] order and left no proxy.
- Full Node suite: 319/319 passing, including historical combat state preservation. Independent review confirmed canceled board gestures cannot capture later pointer sessions.
- No JavaScript page errors in this pass.

Four-resolution game screenshots were also inspected directly: button centers sit on the right rail and table divider, and hero icons are horizontally centered in both arches. Touch cancellation used Chromium touch emulation; actual mobile devices and Safari remain unverified. Audio assets were unchanged; direct listening was not part of this UI validation.

## Reproduction

From fantasy_arena: `node --test test/*.test.js`.

The combat state-preservation test reads the repository's historical v0.390 Git object, so a shallow or source-only download needs that history to run the complete suite.
