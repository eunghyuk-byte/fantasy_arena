## v0.4048
- Launch the approved elemental sanctuary lobby with an optimized3840x2160 background and smaller mobile delivery, original six element icons, independent rotating seal, fixed selected-deck panel and touch-accessible actions.
- Preserve saved-deck CRUD and scrolling, public population simulation, and all v0.4047 card changes. Respect reduced motion and server-confirmed room lifecycle callbacks; no simulated match success.
- Actual matchmaking queue and rank backend remain separate work. Matching stays disabled until a real room session is bound; no account-branch implementation is included.

## v0.4047
- Eight Trigrams creates two 4/0/9 stones (previously 4/0/10). Keep both the stat tuple and closing parenthesis on the first description line.
- Review all 65 two-line card faces and improve 43 descriptions with semantic line breaks. Keep existing font size, at most two lines and unchanged mechanics for all other cards; brief summaries retain full rules in shared details/tooltips.

## v0.4046
- Water Mirror independently copies equipped items, item effects, current stat/cost buffs, acquired attack abilities and stacked death effects. Copied equipment occupies its slot and nested effect data is no longer shared with the source or printed card.
- Preserve current/max HP and the prior action/silence reset policy; effects acquired after silence are retained.
- Keep the face summary brief and place complete rules in shared detail/tooltip descriptions.

## v0.4045
- Show the existing simulated matching count on public and local lobby pages without a preview query. Keep the 10–100 range, 4-second count update, 700ms dot animation, reduced-motion behavior and timer cleanup. This is not real server population.
- No card mechanics, authentication or multiplayer service changes.

## v0.4044
- Synchronize current effect summaries across detail/hover/peek, correct stale flavor lore and ability rules help, and keep long hover explanations scrollable with keyboard focus/Escape support.
- Center card descriptions within each frame type while preserving approved single-line unit/item and two-line spell positions.
- Apply approved two-line wording for 동남풍 and 일기토; no effect-rule changes.
- Pack prices: 1,500 / 5,900 / 9,900 won; bundle discounts approximately 21% / 34%. Commerce remains unconnected.

## v0.4043

- Adds the approved 24 units using existing abilities and the 24 previously approved illustrations. Each tribe now has 33 units, 10 spells and 7 items: 50 regular cards, excluding tokens.
- Preserves all 285 previous card records and art mappings, the six default decks, and the v0.4041 item/spell and v0.4042 shop/audio updates. No new combat mechanics or pack probabilities.
- Adds approval-contract, summon, AI, shared-coin, ability, art-checksum and server deck-validation coverage. Verification: 601 client tests, 2 server API tests, 24 rendered cards and six deck builders; 198 unit band checks and 4,644 duplicate comparisons. See APPROVED_24_UNITS_QA.md.
- Refreshes the version and asset cache keys to v0.4043.

## v0.4042

- Approved pack-shop presentation with DOM prices/actions and explicit unavailable payment/inventory notices.
- Independent saved BGM/SFX levels and switches, retaining master volume and gesture playback.
- Local-only virtual matching preview; disabled on public hosts.
- 572 regression tests and desktop/mobile browser QA. See UI_V4042_QA.md.

# v0.4041

- Applies the approved update to 29 existing items, including four rarity changes. Harpy and wave-spearman summons remain 2/0/3 and 2/0/2; their item descriptions now agree with the source cards.
- Boots and owl equipment now increase one random eligible opponent hand instance's soul cost at turn end. Increases stack and survive equipment loss; global cost auras are removed. Black Grimoire copies a fresh base card without removing the opponent's card.
- Updates the ring's independent coin probability, kill/attack/death hand generation and Blessed Armor protection. Consecutive attacks trigger attack equipment on each hit. Generated/copied cards use the existing ten-card hand limit.
- Applies the additionally approved soul costs and two rarity changes to 11 existing spells; Fire Shield now grants +3 attack/defense/health. Zero-soul spells retain legal casting, deck membership and AI availability.
- Exempts all items from authoring soul bands while preserving unit/spell bands. Unit definitions, other spells/items, shop, multiplayer and audio files are unchanged.
- Advances the version by 0.0001 as specified in VERSIONING.md. Validation and release evidence: ITEMS_V4041_QA.md.

# v0.404

- Matches the approved elemental-gate title composition using unchanged reference pixels for the emblem, FantasySoul wordmark, underline and ornamental button borders.
- Reuses text-free source strips behind four real DOM buttons: online lobby, shop, settings and game exit. Preserves existing routes, keyboard focus, touch feedback, reduced motion and safe browser exit guidance.
- Retains 44px targets on short landscape screens. The fourth button is an authorized addition; DOM typography, stretched plate interiors and a faint small-screen logo backing remain minor differences from the mockup. This is not a claim of pixel-identical rendering.
- Refreshes release/cache versions. No unit, card-stat, item-rarity, multiplayer, login or payment changes.
- Verification: 475 client tests, Chrome menu/keyboard/touch/responsive checks, source-pixel regression and independent visual review. See TITLE_V404_QA.md.

# v0.403

- Replaces the title backdrop with the approved elemental portal artwork and retains the existing FantasySoul emblem and wordmark.
- Keeps online lobby, shop and settings routes, with a fourth accessible Game Exit button. Gold hover/focus, touch press/cancel feedback and reduced-motion support are scoped to the title.
- Shares safe exit handling between title and settings: uses an available desktop quit bridge, otherwise requests window close and explains when the browser tab must be closed manually. No blank-page navigation or account data deletion.
- Contains keyboard focus in settings when opened from the title, restores the opener on close, and supports Escape.
- Verified with 475 client tests and Chrome desktop, keyboard, touch, short landscape and narrow viewport checks. No combat, card-stat, login or payment changes.

# v0.402

- Waits for an uncached opponent spell face before the existing central reveal and effect sequence. Loading is bounded and cancellable; failed media identifies the used card by name. Cancellation and game end cannot apply a pending spell again.
- Scales only the MY TURN presentation to 80% around its existing centre, preserving animation and audio.
- Empty decks no longer display card backs or their shadows; the count remains and replenishing the deck restores the pile.
- Preserves independent escalating fatigue on empty draw attempts and stops multi-draw after lethal fatigue. Hand overflow burning remains separate.
- Verification: 471 client tests, 2 server API tests, independent review, and Chrome game scenarios covering both perspectives, single-target/AOE/instant spells, consecutive AI spells, cancellation/restart/end, empty decks and fatigue. Existing 24 artwork assets are unchanged.

# v0.401

- Registers the 24 user-selected planned-unit artworks under assets/img/art/new-units/: four each for earth, fire, wind, water, light and dark. Only the 1000x800 JPEG quality-90 game files are included; high-resolution originals are excluded.
- Adds a separate art catalog with approved names, elements, soul labels, selected variants, relative paths, measured byte sizes and SHA-256 hashes. All 24 files match the catalog and approved-art commit; existing artwork is preserved.
- This release prepares artwork only. These units are not playable cards: game IDs, stats, abilities, rarities and runtime card connections remain pending and are not inferred from the catalog.
- Verification: all 460 existing client tests passed with original repository bytes; all 24 JPEG dimensions, decoding, Q90 quantization tables and hashes passed, with an independent scope review.

# v0.400

- Fixes rebirth retaining spell buffs and negative depleted equipment defense. Reborn units restore printed attack, defense, maximum HP, coins and abilities at 1 current HP; granted effects and equipment are cleared, and rebirth is consumed.
- Preserves death-trigger ordering, printed abilities, object identity and spent attack rights. Summon effects do not fire again.
- Makes the volume slider control effects as well as music. A square output curve gives a quiet low end, exact mute at 0 and the existing maximum at 100, with saved positions and live updates preserved.
- Replaces the UI click sound with selected procedural candidate 1, 부드러운 탭 (0.22 seconds); the selected summon sound and all other media remain unchanged. Existing click gain and rate limiting remain. Automated regression verification: 460 tests passed.

# v0.399

- Replaces the default summon sound with the selected procedural candidate 4, "마법 응축", encoded as 48kHz stereo OGG from its one-second PCM source.
- Keeps the existing summon trigger, volume/mute settings and fallback behavior. No other sound or gameplay rules change.
- Refreshes asset cache version and measured sound inventory. Verification details: SUMMON_V399_QA.md.

# v0.398

- Removes two unused legacy sword/parry sound files and their unreachable presentation helpers, warmup entries and manifest entries (29,312 bytes).
- Retains the legacy death sound used by the overflow-burn fallback, current combat/match/spell/coin audio, codec fallbacks, all thirteen legendary alternate encodes and the MY TURN lossless reference.
- Updates the general sound inventory with measured file durations. No replacement audio or newly generated sound is introduced.
- Verification: 445 Node tests and unchanged SHA256 for all 83 retained audio files. See AUDIO_V398_QA.md.

# v0.397

- Adds twelve bounded AI decision principles using its own hand and public game state only, without looking at hidden cards or consuming extra random rolls.
- Projects useful card spending before acting. If at least 3 souls would remain, uses the soul draw first and recalculates from the new hand. Saves the coin when no worthwhile newly affordable follow-up needs it.
- Prefers certain automatic-combat lethal, responds to urgent visible threats, avoids invalid immune targets and duplicate removal, and values effective area damage, missing-HP healing and friendly buffs.
- Respects board/hand capacity, waits for pending spell resolution and recalculates after each action. Existing automatic attacks and match cancellation remain in charge.
- Uses a small deterministic heuristic rather than a search engine. This release does not claim optimal strategy or a measured win-rate improvement. Verified with 443 Node tests, independent review and six actual Chromium AI scenarios. Details: V397_QA.md.

# v0.396

- Queues a visible end-turn request during current actions, including ordinary draws and full-hand burns, and advances once after completion. Repeated input, restart and cancellation cannot duplicate a turn.
- Shows overflow deck draws from either player's seat: deck flight, public card reveal and the existing torn-card effect, without hand entry or gameplay death triggers.
- Uses calculated combat values in repeated coin overlays, preserves current damaged HP and improves floating-value size, contrast and 1.8s readability. Moves the stored-coin badge slightly left and enlarges it.
- Rejects targeted spell drops on immune or otherwise invalid cards instead of redirecting to neighbors. Exact valid targets and existing all-enemy effects are preserved.
- Area attacks use one attacker/front roll, no fresh backline rolls, one simultaneous damage commit and grouped deaths. All target media prepare before a shared animation clock; the batch owns one outcome sound.
- Lowers the resting hand another 5cqh so desktop battlefield numbers remain clear. Card size, hover/touch-hold detail and drag behavior remain; bottom clipping is intentional.
- Verified with 420 Node tests and exact-candidate Chromium interaction, timing, stat and target checks. See V396_QA.md, including existing narrow portrait-layout limitations. AI changes and media replacements are not included.

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
