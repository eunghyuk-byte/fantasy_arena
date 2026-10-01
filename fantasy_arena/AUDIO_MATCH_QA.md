# Independent sound channels and private matching preview

Base: main v0.404 `ee86c0017345e800ee70ff3ed25661b9a9da9cd4`.

The legacy `fa_bgm_vol` remains master volume. New BGM/SFX channel gains default to 100%, so existing saved master levels preserve playback loudness. Each channel uses the existing squared volume curve, has its own saved level and enabled flag, and updates playing audio immediately. The first gesture unlocks audio without overriding a saved BGM-off preference. Music, UI/card sounds, synthetic fallbacks, URL effects and coin/combat buses retain their shared routing. No audio files or card data change.

The random 10–100 matching count is NOT a real population measurement. It is hidden by default, and only exact localhost/127.0.0.1/[::1] hosts with `?match-preview=1` may enable the private visual preview. Public hosts cannot activate it with that query. Its private screenshot/GIF omits the test badge per user request; delivery captions must identify virtual population. Count interval: 4 seconds; dots: 700ms in a fixed-width span. Reduced motion holds three dots. Lobby exit, document hiding and pagehide stop timers; return/pageshow resume. No server count or matching service is implemented.

Validation:

- Full client suite: 481 tests, including prior 475 regressions, 3 channel tests and 3 preview guard/lifecycle tests.
- `test/audio-match.browser.cjs`: Chrome real Audio/WebAudio output-gain measurements, independent channel changes, saved switches/reload, first-gesture behavior, keyboard and mobile touch, demo range/dot phases/stable layout, reduced motion and lobby-exit cleanup.
- Selected-deck fixture and reachable 44px matching/AI/Return controls at 568x320, 844x390 and 360x640. Private preview panel scrolls on small screens. The fixture exists only in the isolated test browser, not user data.
- Existing title/menu browser regression suite passed. Independent reviewer confirmed audio routing and caught a small-screen overflow, which was corrected and rechecked.

Limits: native Steam audio/output hardware and subjective listening were not tested. The 8.4-second GIF is a silent screen demonstration, not an audio recording. Real purchases, matching counts and multiplayer changes are outside this patch.

Likely integration conflicts: index.html, js/settings.js, js/bgm.js, js/sfx.js and one first-gesture line in js/game.js. cards-data.js and item/combat rules remain unchanged.
