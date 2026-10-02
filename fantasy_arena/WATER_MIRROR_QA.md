# Water Mirror v0.4046 verification

Base: main v0.4045, 72f141fb369e721fc032103adf318ff9e777e291.

Water Mirror copies equipped item identity (with a new instance UID), its removal bookkeeping, triggered effects, coin modifiers, acquired attack abilities, stacked death effects, current stats and cost buffs. Nested data is independent of both source and printed card. Equipment remains occupied, preventing another item until removal.

Current/max HP, fresh attack rights (one opportunity), transient-state reset and the existing silence reset are preserved. A silenced unit's erased effects retain the prior printed-card fallback, while effects acquired after silence are now copied. The latter case was caught by independent review and received a failing reproduction before correction. No other spell, stats, account/authentication or multiplayer behavior changes.

The card face reads `아군 하나를 그대로 복사`. Shared `effectDetails` provides inclusion rules and existing exceptions in detail, catalogue tooltip and hand/board ability tips. Existing lore remains compatible. No new global ability/help rule is needed. AGENTS.md records the short-face / detailed-rules policy.

Validation:
- 663/663 client/server tests passed, including 53 Water Mirror cases: all 42 items, equipment slot/removal, nested-data independence, stacked buffs/death effects, attack/kill/end-turn/death/coin triggers, protection, consecutive attacks, actual spell casting, full board, damage/action/silence preservation, post-silence new effects and cost buffs.
- Original regression tests first showed 47 failures and 1 preserved-policy pass. Additional post-silence and cost cases also failed before their fixes.
- Real Chrome renders all 300 regular cards with at most two description lines and unchanged font size. Water Mirror uses one line, measured 444.64px within 476.16px.
- Desktop 1600x900 and mobile landscape 844x390: short face, full scrollable detail/tooltip, shared hand/peek face checked and captured. Runtime equipment/copy behavior is also included in `test/water-mirror.browser.cjs` (PLAYWRIGHT_MODULE, CHROME_PATH; optional QA_BASE_URL / QA_OUTPUT).

Native Steam wrapper and non-Chrome rendering are not exercised by this browser check.

Independent review: no remaining blockers after the post-silence fix; reviewer reran all 53 new tests successfully.
