# Zhang Fei A / v0.387

Input: user-provided zhang_f15_A_brush_runtime.zip, 4,966,999 bytes.
SHA256: 06b8679dd0ea2be17db5a6ad668c41d9cf88789b66d4643dfce9d740575c87e4.
Six installed runtime/license files exactly match the ZIP; old shock/roar files remain stored but are not referenced or played.

167 Node regression tests pass. Existing immediate silence and deferred enemy view tests retained. Synthetic tests cover dynamic anchors, upright offsets, ring hit/swap timing, bounded/cancelled preload and missing sprites.

Real installed Chrome headless, 1920x1080, fresh local-only context: 4 normal plays plus 12 plays (0..5 enemies, both sides, second summon slot); actual video alpha decoding, card-relative offset/AI flip, upright 204px glyphs with -20.5px offset, one owned sound, gameplay silence and cleanup verified. Clear/screen cancellation after mute activation and missing video release busy/pending/canvas. Final cancellation confirms no residual mute CSS. Existing MyTurn dim-off/0.72 scale preserved.
Audio MP3/OGG decoded and measured; this is not a human listening assessment. Safari, other viewport sizes and hidden-tab behavior not newly verified.

Local evidence: ../zhang-v387-evidence/report.json, player.png, opponent.png; ../zhang-v387-counts-evidence/report.json. QA scripts remain outside the published repo.
