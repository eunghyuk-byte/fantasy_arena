# Approved four-dragon summon QA

- n13: storm_n13_B_runtime.zip, 6273117 bytes, SHA256 8f3cf975f8cc94e2f25ec165d3f7d82342b3d8bb0e7d892b3eb21453ed34bef1
- a14: ice_a14_B_runtime.zip, 7807507 bytes, SHA256 ef7e0d403ef1a64c4b3b144ba4d3773734a36f89708c1e62c7d80adc64ebf2d1
- d27: black_d27_C_runtime.zip, 2568212 bytes, SHA256 04c28348011b2c7fe37a7992874798c4be63d516235a5c06410470e2120add4c
- l26: gold_l26_A_runtime.zip, 3997423 bytes, SHA256 a9f438146338997a4ca7eb37861bd475b86747a16892e80914503520e90909dd

All 16 installed runtime files match the user-provided ZIP bytes. 180 automated tests cover published regressions, metadata/display/manifest parity, no added enemy effects, input lock release, fixed-card pre-render contract and Storm reveal direction/scaling.

Real Chrome 154 headless at 1920x1080, local-only fresh contexts: 4 plays per dragon (both sides, first/second slots), 16 normal plays total. Alpha decoding, full padded display dimensions, card-relative offsets including Black X=-98 on both sides, AI flipY, one sound per summon, fixed card styles or Storm translation, enemy state preservation and zero retained active legendary video decoders verified. Clear/screen cancellation and missing video settle without input/overlay lock for every pack. Existing MyTurn dim-off/0.72 scale preserved. Audio decoded to 2-second mono 48kHz and measured, not human-auditioned.

Evidence outside repo: ../dragons-v388-{n13,a14,d27,l26}-evidence/report.json and player/opponent screenshots. Safari, other screen sizes and human sound assessment remain unverified.
