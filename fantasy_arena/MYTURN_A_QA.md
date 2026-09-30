# MyTurn A v0.392 QA

Base be2339233ccc9549415c81944c1e9e914038926a. Source user-provided FantasySoul_MyTurn_A_runtime.zip, SHA256 928f24f1eac016f589fb27fb36c613bc1d23e59836127d109f8dd670f8e3bc39. All six installed files match source bytes.

- New reference-contain packs use actual matchStage dimensions. At 1920x1080 the canvas is 1920x1080 at (-6,-30); at 1000x1000 it is 1000x562.5 at (-3.125,203.125); at 960x540 it is 960x540 at (-3,-15). Derived canvasTopLeft is not applied twice. Legacy packs keep CSS0.72.
- Metadata/runtimeOptions and explicit game call dim:false preserve no dim; no extra label or opacity envelope. Duration1050ms; decoded audio1050ms.
- Real Chrome headless WebM/Ogg and forced-Safari-selection WebP/MP3 routes: three viewport layouts, repeat/cancel/mute, missing visual, legacy readiness cancellation followed by MyTurn, real game entry. One requested visual format and one audio format only, no WAV runtime request. Owned audible source starts and stops once; no remaining overlay/job/input lock.
- Independent review identified legacy in-flight playback after clear. A headless regression reproduced unwanted dim0.6; generation guards and owned audio/visual cancellation fixed it to0 without erasing the new overlay. Cancellation is idempotent even when a legacy cached video is reused.
- Real game entry preserves serialized state, consumes zero RNG and plays audio once only for the local player; opponent entry is silent.
- Full Node suite includes360 deterministic combat state/RNG comparisons. Real combat26 scenarios and Zhao Yun grouped legendary10 scenarios passed on this branch with zero page errors.
- Evidence: task-2/myturn-v392-evidence/report.json, myturn-v392-webp-evidence/report.json, myturn-v392-combat-evidence/report.json, myturn-v392-legendary-n2-evidence/report.json, myturn-v392-tests.log.

WebP was tested by selecting its branch in Chrome154; this is not actual Safari certification. Human audio listening was not performed. Missing big match packs and four pending spells are not in this commit.
