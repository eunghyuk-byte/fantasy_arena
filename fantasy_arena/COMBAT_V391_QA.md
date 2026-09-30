# Combat final A integration (v0.391)

Base: 322b6392498c2eee42d9b92f559cb6db9edf3994 (v0.390). Isolated branch: combat-final-v391.

## Scope and decisions
- Only combat timeline and attack A / defend A / death A. No match, spell, new legendary or server changes.
- User-supplied source ZIPs: combat soft edge SHA256 d131589cc8547db84109038bd3584b44a288e647d43c1f378ffea71c444ad2fe; death candidates SHA256 e1d4c92624e256bd28153100809dfcb2e2549799e9c9823c605e12b57cb0f9cb. All nine installed files match the selected original ZIP bytes. B/C death excluded.
- Viewport reference scaling implements the requested padded widths 399.36/561.6 at 1920x1080, preserving content widths 307.2/432. Current victim bounds supply the center; defense does not recoil the victim. Existing caster motion remains.
- Damage is applied once by the existing engine. The measured HP reduction chooses attack or defense sound after shields/critical effects. Counter reuses attack. No attempted strike plays no sound.
- Metadata/decoder/audio preparation has bounded waits; no whole decoded RGBA frame cache. Missing video retains available approved audio. A fully unavailable audio resource cannot be perceptually recovered; no substitute legacy sound is layered.
- Death uses the captured actual rendered face with six approved polygons, clears fragments at 850ms and ends the shared clock at 900ms. Coin deaths and final simultaneous deaths share one presentation/decoder/sound.

## Evidence
- Node suite: 238 passing, zero failures. Includes 360 deterministic full-player-state/RNG comparisons against v0.390 across both sides, skills, coins, shield/rebirth; only recursive death context excluded from serialization.
- Focused regression reproduced and fixed protected-card recoil, death provider ownership, preload cancellation, hiding during preload, and metadata-body cancellation after headers. The latter was independently identified by a separate code reviewer; no additional Important/Critical finding.
- Approved video decode: attack/defend 832x832, death 512x512, 0.9s, actual transparent and partial-alpha pixels. Ogg decoded duration ~897.3ms; attack peak .430 / last sample above -50dB ~507ms, defense peak .398 / ~437ms, death peak .558. These are numerical checks, not human listening.
- Final combat headless: 26 scenarios passed on GAME_VERSION 0.391, zero page errors and zero retained combat decoders/canvases. Both sides: normal, full block, zero-damage counter, shield, death, rebirth, continuous attack, no attempt, hero, simultaneous coin deaths, and consecutive actions in one match; plus cancellation/restart/mute/missing attack video. Sound file routing is checked against actual HP loss; combat decoders/canvases are required to be zero after completion.
- Existing Zhao Yun grouped legendary regression: ten real headless runs, both sides/counts, cancellation and failure; no page errors.
- Evidence outside repository: combat-v391-tests.log, combat-v391-evidence/report.json and death-true.png/death-false.png; combat-v391-legendary-n2-evidence/report.json; combat-v391-assets.json.

## Limits
Chrome 154 headless at 1920x1080 was used with installed browser, sandbox enabled, loopback app only. Safari, other viewport layouts and human sound audition are not verified. No new browser/runtime installation or server ABI change. Deployment uses the existing main Pages workflow only.
