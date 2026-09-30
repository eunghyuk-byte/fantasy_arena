# v0.386 Green Dragon B

Input: user-provided green_e3_B_runtime_v2.zip, 3143203 bytes,
SHA256 114700a1ae36701148021589e046d728b5fa75a69deb2e0617f6b811b5df241e.
ZIP CRC passes; four installed runtime files are byte-identical to the archive.

Isolated base: v0.385 / 1a4e23e3e6bde190932d9269c7f0ef43f4b26eb7.
Only e3 registration, its four assets, manifest, version/cache, tests and release/QA notes are included. No old native Green, combat preparation or other pending media. Card data and immunity/gameplay behavior are unchanged; enemyUids is empty and enemyMute is absent.

Validation: 159 automated tests passed. Preinstalled headless Chrome 154 rendered the real game with actual files, twice per side at both first and second board slots (8 successful plays). The 1500x843.75 display and -168.75/+168.75 offset with opponent flip matched actual card centers. Alpha decoded at 1280x720 over 2 seconds. Clear, screen exit and missing-video failure release busy/overlay/canvas state, enemies remain unchanged, and no page errors occurred. Existing MyTurn dim remains 0 and scale 0.72; no combat preparation is loaded.

MP3/OGG both decode to 2 seconds, mono 48kHz. Sample peaks 0.52071/0.55673, RMS 0.09567/0.09972. This is numeric audio QA, not human listening/perceptual synchronization approval. Safari, hidden-tab lifecycle, device sizes and mute/volume settings remain unverified.

Local evidence: task-2/green-v386-evidence and green-v386-slot2-evidence contain report.json and screenshots. Runners are task-2/green-v386-qa.cjs and green-v386-slot2-qa.cjs. No new generation, installation or user browser session access.
