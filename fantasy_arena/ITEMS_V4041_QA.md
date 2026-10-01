# v0.4041 item and spell verification

Base: `ee86c0017345e800ee70ff3ed25661b9a9da9cd4` (v0.404).

## Scope

- Exactly 29 existing items and 11 existing spells change. Semantic comparison of all 285 card definitions confirms no minion changes and no unapproved card fields changed.
- Item rarity changes: ni1/ai5 common, ni5/ai2 uncommon. Spell rarity changes: ds4 common, ds7 uncommon.
- Harpy n10 and wave-spearman a10 retain printed 2/0/3 and 2/0/2 stats; ni5/ai2 descriptions match their summoned units.
- All 42 items are excluded from authoring soul bands. Unit/spell bands and rarity offsets remain unchanged.
- No audio, shop, multiplayer, new unit or artwork implementation changes.

## Automated verification

Full client and server suite: **568 tests passed, 0 failed** on Node 22.23.3, using the existing server dependencies (no dependency changes). Run from the repository root with `node --test fantasy_arena/test/*.test.js server/test/*.test.js`; the server dependency directory must be installed or available through NODE_PATH. `git diff --check` passed.

Coverage includes cumulative instance hand costs, correct payment and AI affordability, fresh base-state copies, independent coin rolls, valid generation pools, ten-card overflow, rebirth/destruction, stolen equipment ownership, protection, summon-description consistency, all 11 spells' casting costs and AI thresholds, zero-cost deck membership, rarity deck limits, and Fire Shield's actual +3 buff.

Two independent-review findings were reproduced with failing regression tests and corrected: a stolen consecutive attacker must stop attacking for its former owner, and second-hit equipment buffs must retain negative saved coin offsets even after effective stats were clipped to zero. Both regression tests pass. The reviewer independently reran the complete suite: **568/568 passed**, with no remaining blocking findings.

## Browser verification

Used an isolated headless Chrome process, temporary profile and local HTTP server on an automatically assigned loopback port. No shared browser/CDP session was used.

- Opened all 40 changed cards in the real card detail UI. Verified actual canvas effect text and soul numbers, with representative screenshots for ni1, ni5, ai2, di3, ai7, fi5, ds4 and fs7.
- Applied boots and owl effects twice, then rendered the real hand. Taxed minion/spell costs displayed **4 and 2**; new copies of the same cards displayed **2 and 0**. All were legally playable at the available 10 souls, and CARD_MAP.ds4 remained zero.
- Visually inspected representative card details and the hand screenshot. No page JavaScript errors occurred.

Browser fixtures only inject local test state; no account, match or saved player data is modified. Live publication is verified separately after the normal main push.
