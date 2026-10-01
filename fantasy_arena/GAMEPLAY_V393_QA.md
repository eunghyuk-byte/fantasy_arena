# Gameplay v0.393 QA

Base: d453ab3191fa92cb510871d7aaa8690a6a3a38e1 (v0.392). This release includes only gameplay fixes, rule/help synchronization, regression tests, and version metadata. No es2 B or other media files are included.

## Verified

- Full Node suite: 266 tests passed, 0 failed after the version bump. Run `node --test fantasy_arena/test/*.test.js` from the repository root. The historical parity test requires the v0.390 commit object 322b6392498c2eee42d9b92f559cb6db9edf3994.
- `node --check` passed for js/game.js and js/combat.js.
- Added 23 focused regressions: stale spell completion/resolveNow, one-time spell resolution, consecutive and area attack cached coin modifiers, base-ATK-0 automatic attacks, secondary targets' first rolls and temporary HP, same-turn reuse, fresh rebirth rolls, black-HP-coin death, restart while secondary coin UI is pending, and protection versus damage/stat reduction.
- 340 unaffected deterministic exchanges retain state and RNG equality with v0.390. The 20 consecutive-plus-coin combinations are intentionally excluded from historical equality because the old version lost second-hit modifiers; focused rule tests cover the corrected behavior.
- Independent code review and focused test reruns completed. A review identified the sibling Sandhell reduction path; a failing regression was added, then the same stat-reduction flag was applied and verified.
- Approved rules: a retarget dying to black HP coins consumes the remaining consecutive hit and stops; protection blocks combat/spell damage but not direct stat reductions or HP coins. Falling Rock and Sandhell now retain protection while reducing stats, consistent with Lu Bu.

## Verification limits

Automated logic tests stub DOM/media. These results do not certify human audio perception, Safari, mobile layouts, or rendered secondary coin/death animation quality. Deployment status and public-site version must be checked separately for the final commit.
