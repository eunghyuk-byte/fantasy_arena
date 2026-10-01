# v0.398 audio cleanup verification

Base: v0.397 a5bcc26599b3cc7dc719aaa02a72f3fd2bf12963.

## Scope

Removed assets/audio/sfx/sfx_slash.ogg (15,473 bytes, 0.599546 seconds) and sfx_parry.ogg (13,839 bytes, 0.445850 seconds). Their only references were FILES warmup and unreachable Vfx.attackSeq/parrySeq -> Sfx.playSlash/playParry. Direct calls, string names and dynamic Sfx/Vfx property lookup were checked. The unused helpers/exports are removed together, preventing fallback synth sounds or new failed requests.

The overflow-burn fallback still calls Vfx.death -> Sfx.playDeath when CombatFx is unavailable. The corresponding file is retained. Current combat/match/spell/coin sounds, ordinary UI sounds, 13 legendary alternate encodes, MY TURN lossless reference and two background tracks are retained. No new media is added.

Manifest changes remove only the two deleted entries, adjust count and update the edited SOUNDS.md size. Its timing column now shows ffprobe-measured file durations rather than old intended durations.

## Verification

- Two initial regression tests failed before the cleanup, then passed: warmup cannot request retired assets; runtime has no retired sequence names or dynamic lookup while death fallback stays connected.
- Full suite: 445/445 passed.
- All 83 retained audio files have identical SHA256 before/after (81 SFX files plus two BGM).
- Independent review confirms both unused chains and the required death fallback.
- Exact candidate 5b5cf48e16f14b99f473f32c5842ee4e6678835f passed actual Chromium checks with zero page errors: five-target same-frame AoE with one sound and grouped deaths, consecutive-combat coin reuse and values, and four viewport stat-display checks.
- With CombatFx deliberately absent, overflow-burn fallback called Sfx.playDeath exactly once and removed the ghost. Slash/parry APIs were absent while the death FILES entry remained.
- Independent full rerun: 445/445. Only this QA document changes after the exact-code browser check.

File length includes codec padding and silent tails. Playback can be capped by media metadata, altered by coin playback rate, or shortened by cancellation. This cleanup does not alter playback timing or volume.
