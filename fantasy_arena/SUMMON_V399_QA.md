# v0.399 summon audio verification

Base v0.398 f200e9c4993b08b27e6cca7e75f0dccba82bdb03.

Selected source: procedural candidate 4, 마법 응축. PCM24, 48kHz stereo, 1.000 seconds. Encoded with libvorbis quality 7 without gain, normalization, time stretch or trimming.

Source SHA256: b38f636c28948f4599b20778b9f2785c935582b19bc2cf2fba52e92e262a05f0
Published OGG SHA256: f7cd20c7057aa97d2c8cbd90441a39bd510f4b7aff73beb931ce307beaa16f50

Runtime path remains assets/audio/sfx/sfx_summon.ogg, loaded by Sfx.playSummon via FILES.summon. The same master volume, mute handling and duck behavior apply. Only the media, inventory, cache/version and release documentation change.

Verification:
- ffprobe: Vorbis, stereo, 48kHz, container duration 1.000000 seconds; ffmpeg full decode completed without errors.
- Full automated suite: 445/445 passed. All 82 other audio files are byte-identical.
- Exact candidate 25fb68177e1f6e96ade832ed3a183bd958cd431f was checked in Chromium: ordinary e1 summon called Sfx.playSummon once, fetched the exact OGG with HTTP 200, decoded stereo, and started/ended playback once at rate 1.
- Chromium's 44.1kHz AudioContext decoded a 1.014648526-second buffer (peak 0.63988), so actual playback is approximately 1.015 seconds. This differs from the 1.000-second encoded container length; no runtime trim or gain compensation was introduced. The browser test's initial strict 1.000±0.010-second duration assertion failed on this measured difference, while playback-path assertions passed.
- The first isolated full test run also found stale untracked slash/parry files left by copying the previous baseline. Removing those already-deleted files restored the exact released baseline; final 445 tests passed.


Independent browser follow-up: 48kHz offline decode produced 48,704 samples (1.0146667 seconds), while 44.1kHz produced 44,746 samples. The decoder tail difference is not solely resampling. Measured start-to-ended time was 1.0143 seconds. A documented ±20ms tolerance rerun passed with zero page errors and exit 0. No listening-quality claim is made.
