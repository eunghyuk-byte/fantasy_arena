# v0.395

- Speeds only the opening-hand deal to 1.5× (480ms per card); ordinary later draws remain 720ms.
- Aligns the end-turn button with the board's right gold rail and center divider, and both hero icons with their frame centers using artwork-relative coordinates.
- Makes dragged hand cards leave their visual hand slot while preserving layout and game state until valid play. Cancel, Escape, pointer cancellation, turn transitions and resets restore cleanly.
- Gives hand and board drag sessions owned pointer listeners, preventing canceled gestures from affecting later drags. Visual proxies are excluded from accessibility and contain no duplicate IDs.
- Verified with 319 Node tests, independent code review and Chromium geometry, draw timing, mouse/touch cancellation, valid minion/spell drops and board-drag interruption. See UI_V395_QA.md. No card rules or media assets changed.

# v0.394

- Added selected Giant Seal es1 C and Earthquake es2 B, re-keyed directly from1440×1440 generation sources. Both use1440px VP9alpha at30fps; no384/512px upscale or reduced-resolution production assets.
- Preserves selected1.2second motion, card-relative placement and original sounds. Seal centers on the exact chosen UID at max(card width×2.1,card height×1.55); Earthquake plays once per opposing unit at1.65× card width. One shared decoder and one sound per cast.
- Reuses the legendary video player. Small immutable file parts reassemble the original encoded video with byte-count and SHA256 verification. Owned URLs, decoder, audio and pending work are released on failure or cancellation.
- Preserves v0.393 gameplay fixes and all existing legendary/spell packs. Verification is documented in SPELLS_V394_QA.md.

# v0.393

- Prevents an unfinished spell or its delayed summon callback from changing a restarted match or releasing its input lock.
- Retains same-turn attack/defense coin results for consecutive hits and area attacks. Base-attack-zero units can participate in automatic combat when their attack coins can provide positive attack.
- Area-attack backline and consecutive-attack retargets roll their coins on first participation; temporary HP coins apply and settle once per defender lifetime. Rebirth rolls fresh coins. A retarget dying to black HP coins consumes the remaining consecutive hit and ends the attack (user-confirmed).
- Protection blocks combat/spell damage, but not direct stat reduction or coin HP loss (user-confirmed). Falling Rock and Sandhell now preserve protection while reducing HP, matching Lu Bu's direct reduction. Rule text and in-game help agree.
- This is a gameplay-only bug release. Pending es2 B effects and other media changes are not included. Verification and remaining browser limits are recorded in GAMEPLAY_V393_QA.md.

# v0.392

- Added approved MyTurn A (1050ms), reference-contained full-canvas placement (-6,-30 at 1920x1080), explicit dim off, no duplicate label or fade.
- Loads one supported visual/audio pair: WebM/Ogg or WebP/MP3. Repeated playback owns and releases its media/audio; cancellation prevents stale legacy match playback from dimming or replacing a new overlay.
- Existing packs without reference metadata retain their 0.72 display. Combat/gameplay/legendary results unchanged. Other pending match/spell assets remain excluded.

# v0.391

- Connected the approved padded attack A and defense A videos/sounds to one awaited 900ms combat timeline. At 1080p the padded display widths are 399.36px and 561.6px; counters reuse attack A. Actual resolved HP loss selects sword sound for positive loss, defense only for zero loss; no attempted strike is silent.
- Added selected death A: six fragments of the actual pre-removal card face, with its accent video/sound. Simultaneous deaths share one decoder, sound and clock. Cancellation/restart removes owned visuals, sounds and pending work.
- Preserves gameplay, rebirth, continuous attacks and RNG. Removes duplicate legacy strike/hero-hit audio from combat only. A video failure retains the approved outcome sound and gameplay completion.
- MyTurn A, remaining spells and missing packages are excluded. Chrome headless verification is recorded in COMBAT_V391_QA.md; Safari and human audio listening were not verified.

# v0.390

- Added approved Zhao Yun n2 A and Lu Bu d7 A grouped summon presentations. The existing engine supplies actual eligible/affected UID results and final death/rebirth/DEF/HP outcomes; rendering does not rerun selection, damage, death or RNG.
- One impact decoder/frame and one main sound serve the whole event. Real composed card faces provide the six approved fragments only for actual destroyed result UIDs; zero-N Lu Bu units receive no impact or stat effect.
- Preserves deathrattle/cleanup order and exact original gameplay. Other pending combat, match and spell media remain excluded.

# v0.389

- Added approved Ma Chao e14 A with one main video/sound and a secondary arrival bound only to the token UID returned by the original battlecry. Full board means no arrival; existing Ma Dai cards are never substituted.
- Both streams share the main clock and cleanup. The actual created card face fades in above both effects at 800-940ms; native easing, padded geometry and AI vertical offsets follow the supplied package.
- No gameplay rules changed. Zhao Yun, Lu Bu, combat and other pending media remain excluded.

# v0.388

- Added approved Storm n13 B, Ice a14 B, Black d27 C and Gold l26 A two-second alpha video/audio summon packs. No card abilities or battle results changed.
- Honors padded display sizes, card-relative offsets and AI vertical flip; Black X stays -98 on both sides. Ice/Black/Gold cards remain visible and stationary; Storm uses the selected 33px vertical entrance with opposite-side reversal.
- Other pending media and combat preparation remain excluded.

# v0.387

- Replaced Zhang Fei f15 summon with approved A alpha video/audio and upright brush-calligraphic 默 sprites attached to each actual enemy.
- Video and sprites share playback/cancellation; retained silence battlecry, ring hit timing and deferred display swap. Applied the approved glyph offset without flipping enemy lettering.
- No other pending legendary, combat, match or spell media is included.

# v0.386

- Added approved Green Dragon e3 B two-second alpha video and sound, replacing no published gameplay rules. No enemy silence, damage, buff, immunity or deferred-view changes.
- Existing Red/Zhuge/MyTurn fixes are retained. Other pending media and combat preparation are excluded.

# v0.385

- Fixed unwanted background dimming during the existing MyTurn animation: explicit dim disabled/zero metadata is now respected instead of falling back to 0.3.
- Existing MyTurn video, sound, duration and centered 0.72 display scale are unchanged. The selected new MyTurn A media is NOT included.
- No combat preparation, new legendary/match media, layout-adapter or other pending changes are included.

# v0.384

- Added approved Zhuge Liang l4 A: two-second alpha video with matching sound. No gameplay, enemy silence, damage or deferred enemy views were added.
- Reuses the published Red video renderer; no Green, Zhang replacement, combat timeline, match replacement or rename changes are included.
- Validation: 156 automated tests; real headless Chrome playback twice per side, alpha and card-relative placement/AI flip checked, cancellation and missing-video cleanup passed. MP3/OGG decoded to two-second mono 48kHz audio without sample clipping.
- Not verified: Safari, human listening/perceptual sync, hidden-tab behavior, mute/volume settings and other viewports. See ZHUGE_A_QA.md.

# v0.383

- Added the approved Red Dragon A summon animation: two-second VP9 alpha video and sound, 2,271,066 runtime asset bytes. No card stats or gameplay effects changed.
- Added bounded preload, alpha-decoder validation, per-play video ownership and cancellation/failure cleanup. Existing Zhang Fei sprite summon behavior remains supported.
- Unpublished Zhuge Liang/Green Dragon replacements, project rename and combat timeline work are not included.

Validation: 152 automated tests passed. Native Chrome alpha/repeat/cancel/failure checks passed; three plays took 2.02–2.05 seconds. Controlled actual-game drag summon captured in headless Chrome at 1920×1080; enemies unchanged and busy/hidden/overlay state cleared. Actual desktop fullscreen was not manipulated for this release.
