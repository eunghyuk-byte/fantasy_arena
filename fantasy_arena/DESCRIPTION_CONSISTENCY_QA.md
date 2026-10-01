# v0.4044 description consistency

The user reported an outdated Red Hare hover story after its effect changed to create Lu Bu. Audited 29 changed items, 11 changed spells and 24 new units against implemented fields and current approved rules, plus a related stale Rage Hammer entry.

## Corrections

- Twelve flavor entries implied outdated or misleading mechanics: fi1, fi5, fi6, ni1, di3, di6, di7, ei7, ai7, fi7, ds4, ds7. Updated only flavor text to match current effects.
- Item/spell effect summaries were missing from standalone details/hover and some peeks. The shared cardEffectText path now uses current card text; no duplicated hard-coded card effects in UI.
- Petrify help now states the existing defense cap of 5 and preserves values already above it. Protection and Rebirth rules help match their detailed explanations.
- Long hover explanations scroll on short screens, remain open while hovered/focused, and dismiss with Escape with anchor focus restored.
- Repository AGENTS.md records the persistent requirement to synchronize descriptions whenever effects change.

## Evidence

- Full client/server regression: 610 passed, zero failures, using Node22 and the unchanged locked server dependencies. No dependency definition or server source changes.
- Three new consistency tests were observed failing before the fix; all pass afterward. They verify shared descriptions for all300 regular cards, removed-effect lore and Petrify's cap.
- Actual Chrome detailed-card loop: all64 requested cards show their current effect. Representative desktop/mobile hover and detail screenshots; no overflow beyond viewport, long-text wheel scrolling and focus/Escape restoration pass.
- New24 units: 13 with supported abilities and11 basic cards; all match current data, no stale custom lore.
- Independent review caught and verified correction of the related fi6 lore and tooltip focus lifecycle. No remaining important issue found.
- Card-face audit: 77 empty /158 single-line /65 two-line; zero overlong descriptions at the original font and width.

Gameplay rules, stats, costs, artwork and the300-card pool are unchanged except the separately approved two card-text values and shop prices. Native Steam and other OS font fallback paths were not tested. Public deployment verification is recorded separately for the exact release SHA.
