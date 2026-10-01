# Selected spell effects v0.394 QA

Base: cdafd61700f7e3f87f31d791db83e89064d5ddbf (published v0.393). Game rules match that base byte-for-byte after removing the version change; combat.js is unchanged.

## High-resolution source and runtime

- Both selected generation sources are1440×1440,24fps,73frames,approximately3.042seconds. Alpha is processed directly at that resolution, not upscaled from the earlier384/512px previews.
- Runtime uses1440×1440 VP9alpha CRF18,30fps. The selected complete motion remains1200ms/36frames. Fully transparent tail frames let the original sound finish without a frozen visual.
- Giant Seal es1 C: job24b89835-e5dd-4987-bfe6-3d4cb70f4279,41frames,2,535,903bytes,SHA256 be8cfafc25bf2d0b86e9ad1f62db8a07bc83900d583976983c506626e3ba9a7b. Exact selected UID centered at max(card width×2.1,card height×1.55). The approved normalized native sound starts538ms; timeline ends1338ms.
- Earthquake es2 B: job2134c554-8db8-4d4a-967b-43e3baeb8d8a,49frames,3,985,896bytes,SHA2564203d9a27b048ff0bab14c2c4a9c8c9cb9a70f9e164ef42c30e422efb2453d4f. Each opposing unit is drawn at1.65× its actual card width. One natural-speed original sound starts785ms; timeline ends1607ms.
- Actual decoded alpha is zero in the first/final frames, all four outer edges, and the transparent tail. Bright/dark-background contact checks show no opaque gray rectangular background. Source clipping in Earthquake’s late debris and Giant Seal’s keyed dark/shadow details cannot be restored simply by increasing resolution; in-game inspection remains important.
- Sound bytes match the selected WAVs. Seal is48kHz stereo/800ms; Earthquake is44.1kHz stereo/821.814ms. No pitch/time change. Game master volume remains user-controlled; there is no extra per-target sound.

## Loader and regression checks

- Reuses LegendaryVideoFx with optional exact-byte part assembly and explicit target anchors. One decoder/frame/clock/audio instance serves the full cast. Existing single-file legendary playback keeps its previous scale and zero-delay sound.
-19/29 small immutable video parts reassemble to the full original byte count and SHA256 before a Blob URL is created. Missing, wrong-size, reordered or wrong-hash parts fail without playing partial data.
- Cancellation stops pending loads, decoder, audio and frame callbacks; owned Blob URLs are revoked. Metadata loading and video readiness have bounded deadlines. Stale spell callbacks cannot erase a newer card showcase or alter a restarted game.
- Full Node suite:284/284 passed. Added contracts cover wrong media, cancellation, URL release, legacy scaling, exact selected target, empty enemy sets, one decoder/audio for multiple units and metadata/showcase lifecycle.
- Real Chromium browser verification passed on staging commit39a61b634c05293bbe537fad12dc13a2f7e5abae: all19/29 parts reassembled to the approved SHA;1440×1440 transparent decoding succeeded.
- Real playCard results: Seal consumed soul10→7 and removed the selected unit (enemy5→4); Earthquake consumed soul10→4 and drew the shared video on all5 opposing units. Measured display sizes were500.65px and354.75px, matching selected previews.
- Sfx.playBuf was invoked exactly once per cast with538/785ms delays and800/821.814ms source durations. No direct human listening was performed.
- Showcase300ms and active1100ms cancellation followed by immediate replay both completed with zero remaining effect canvases. The state object stayed identical during ordinary casts; no JavaScript page errors occurred.
- Existing11 legendary packs and other spell assets remain unchanged. These browser checks are automated rendering/state/timing checks; actual Safari, exhaustive manual visual review and direct listening remain unverified.

Actual Safari and direct human audio listening were not performed. Track, waveform and timing checks are not a claim of listening.
