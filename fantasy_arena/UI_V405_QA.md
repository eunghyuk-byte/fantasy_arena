# v0.405 shop and sound controls

Base: v0.404, ee86c0017345e800ee70ff3ed25661b9a9da9cd4. Scoped implementation: f8d6a01 (sound/private preview), b74cf9e (shop).

Approved pack-shop composition with accessible DOM prices and actions; clear unavailable commerce/inventory state. Independent BGM/SFX levels and saved switches retain legacy master volume and first-gesture playback rules. Virtual matching population remains disabled on public hosts, including requests with the private-preview query parameter.

Verification: 481 client tests; Chrome audio gain/persistence/first-gesture/touch tests; shop price/state/storage/dialog/responsive tests; title hover, keyboard, touch, route and exit regression tests. Independent review found no remaining blocking issue after responsive corrections. See AUDIO_MATCH_QA.md and SHOP_QA.md for evidence and practical limits.

No login, multiplayer service, card statistics, combat, payments or inventory implementation is included.
