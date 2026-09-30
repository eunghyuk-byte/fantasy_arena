# Zhao Yun / Lu Bu A, v0.390

- n2: zhaoyun_n2_A_runtime.zip, 6390685 bytes, SHA256 37b9f367f26c5e7b72b55afdb2ce2f57eb951e451232c3cceb7a36d50777347a.
- d7: FantasySoul_LuBu_A_runtime.zip, 3353376 bytes, SHA256 35820fa8d7c2e9091ddd90169abc930298f0146a542b52f53e72d3098af2afa7.

All 13 installed assets exactly match the user-provided archives. Original metadata is preserved; the Lu Bu schema is adapted in code. Experimental packed-H264 alternatives are not installed or advertised as Safari support.

202 Node regression tests pass. Engine reports current-ATK eligible actual results for Zhao Yun and nonzero coin-pool actual DEF/HP results for Lu Bu, after original cleanup/deathrattle/rebirth ordering. The renderer does not call RNG, damage, destruction or target-selection APIs. 720 comparisons with published v0.389 across both cards, both sides, 0..5 targets, 30 seeds, rebirth/deathrattle/random-steal scenarios matched complete state and RNG position.

Real Chrome 154 headless, 1920x1080, fresh local-only contexts: 8 normal plays per card (both sides; 0/1/3/5 units), plus sound:false, clear/screen cancellation, missing-main and missing-impact cases. Actual alpha decode, one owned sound/no legacy death sound, one shared impact stream across all returned UIDs, maximum 2 active video decoders, zero retained decoders/canvases, input release and final hidden-style removal verified. Missing-media recovery retains the existing 120ms card-reveal animation before styles clear.

Approved main/impact timing, padded geometry, upright real card textures, six real-face polygon fragments only for destroyed results, current attack/coin outcomes, unaffected-card layer and AI video flip verified with synthetic tests and real screenshots. The initially missing Zhao Yun unaffected-card layer was corrected before publication. Lu Bu uses actual card width/198 scale and engine-rendered after-stat faces at the approved display time; no recomputation of HP/DEF or coin edits occurs in presentation.

Existing Ma Chao two-stream playback, token disappearance, missing arrival/main, initial cancellation and MyTurn dim-off also passed real headless regression on final v0.390 (../generals-v390-machao-regression/report.json).

Local evidence: ../generals-v390-{n2,d7}-evidence/report.json and player/opponent screenshots; ../generals-v390-state-comparison.json. Safari, other viewport sizes and human audio listening remain unverified. Combat, remaining match/spell replacements and missing large packages are excluded.
