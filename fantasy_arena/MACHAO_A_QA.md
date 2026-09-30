# Ma Chao A / v0.389

Input: user-provided machao_e14_A_runtime.zip, 6,964,630 bytes.
SHA256: 0ad6487d02e6d73f3e9824ac2335baf6cc541156b676bdb4e57d3b012cd5ee6b.
All six installed runtime files match the ZIP. Uses primary approved M4A only; MP3/Ogg are retained alternate source assets, never played simultaneously.

195 Node tests pass, including 10 side/board-size comparisons of gameplay with/without presentation, preservation of original cleanup order, pre-playback cancellation epoch, actual returned UID binding, full-board omission, vanished UID validity, shared secondary decoder/audio/cancel lifetime and native easing.

400 additional comparisons against published v0.388 (20 RNG seeds, both sides, 0..4 existing units, with/without a pending death) produced identical complete state and RNG position. Evidence: ../machao-v389-evidence/state-comparison.json.

Real Chrome 154 at 1920x1080 in a fresh local-only context: 10 normal plays (both sides, 0..4 existing units including an old e41). New token arrival follows its own actual UID/rectangle, main and arrival padded sizes/offsets and AI flip verified. Eight arrival cases had maximum observed shared-clock drift about 14.1ms; full-board cases created/played no arrival. Main alpha, one sound, no retained legendary decoders, unchanged enemies and released input locks verified. Token removal/replacement, missing main/arrival media, clear and screen cancellation passed. Snapshot card image decoding and visible image opacity verified; player/AI screenshots inspected. Initial snapshot readiness issue was fixed before publishing.

Primary card and token face preparation is bounded; missing faces/media fall back to normal gameplay/visible cards. Existing Red/Green/Zhang and MyTurn regression suite retained. Audio alternatives decode to stereo 48kHz, two seconds; no human listening or Safari QA claimed. Other viewports remain unverified.

Local evidence: ../machao-v389-evidence/report.json, player.png, opponent.png and ../machao-v389-qa.cjs. No full RGBA frame cache is used.
