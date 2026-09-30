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
