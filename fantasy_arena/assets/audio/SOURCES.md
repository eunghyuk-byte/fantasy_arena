# Audio asset sources

All binary media under `assets/audio/` are free for commercial use. Prefer CC0 where noted.

## BGM (`bgm/`)

| File | Source | License | Notes |
|------|--------|---------|-------|
| `menu.ogg` | [Town Theme RPG](https://opengameart.org/content/town-theme-rpg) by cynicmusic (pixelsphere.org) — converted from MP3 to Ogg Vorbis stereo 48 kHz | CC0 | ~195s (2× seamless self-concat), loudnorm ≈−16 LUFS |
| `battle.ogg` | [Heartfelt Battle](https://opengameart.org/content/heartfelt-battle-loopable-fantasy-stringspianohorn) by request — re-encoded Ogg Vorbis stereo 48 kHz | CC0 | ~180s (self-concat then trim), loudnorm ≈−16 LUFS |

## SFX (`sfx/`) — Kenney.nl CC0 (primary)

Downloaded via [gamesounds.xyz Kenney Sound Pack](https://gamesounds.xyz/?dir=Kenney%27s+Sound+Pack) mirrors of [Kenney.nl](https://kenney.nl) CC0 packs (RPG Audio, Interface Sounds, Impact Sounds, Sci-Fi Sounds, Music Jingles, Music Loops).

| File | Source file(s) | Pack |
|------|----------------|------|
| `sfx_slash.ogg` | `knifeSlice.ogg` | RPG Audio |
| `sfx_slash_crit.ogg` | `knifeSlice2.ogg` + `impactMetal_heavy_000.ogg` (mix) | RPG + Impact |
| `sfx_parry.ogg` | `metalClick.ogg` | RPG Audio |
| `sfx_death.ogg` | `cloth3.ogg` + `dropLeather.ogg` (mix) | RPG Audio |
| `sfx_card_play.ogg` | `bookPlace1.ogg` | RPG Audio |
| `sfx_card_draw.ogg` | `bookFlip2.ogg` | RPG Audio |
| `sfx_summon.ogg` | `forceField_001.ogg` | Sci-Fi Sounds |
| `sfx_hero_hit.ogg` | `impactPunch_heavy_000.ogg` | Impact Sounds |
| `sfx_turn.ogg` | `impactBell_heavy_002.ogg` + `confirmation_004.ogg` (mix) | Impact + Interface |
| `sfx_win.ogg` | first ~1.4s of `Serious ident.ogg` | Music Loops / Idents |
| `sfx_lose.ogg` | first ~1.2s of `Sad Descent.ogg` (fade out) | Music Loops |
| `sfx_ui_click.ogg` | `tick_001.ogg` | Interface Sounds |
| `sfx_cast_charge.ogg` | `thrusterFire_001.ogg` trimmed ~0.45s | Sci-Fi Sounds |
| `sfx_coin.ogg` | `handleCoins.ogg` | RPG Audio |

Kenney license: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) — credit “Kenney.nl” appreciated, not required.

## SFX — generated beds (spell elements)

When no matching free download was available for elemental spell hits, short multi-second stereo WAVs were synthesized with Python/NumPy (noise + tonal layers) and encoded to Ogg Vorbis. These are original temporary beds, not silent placeholders:

- `sfx_spell_fire.ogg`, `sfx_spell_water.ogg`, `sfx_spell_wind.ogg`
- `sfx_spell_earth.ogg`, `sfx_spell_light.ogg`, `sfx_spell_dark.ogg`

## Also considered / not shipped

- [Fairy Battles](https://opengameart.org/content/fairy-battles) (CC0) and [Hope orchestral battle](https://opengameart.org/content/hopeorchestral-battle-music) (CC0) — strong battle candidates; Heartfelt Battle chosen for length/feel.
- Pleasant Creek / Medieval Town (CC-BY 3.0) — skipped to keep BGM CC0-only.



## Loudness balance (post-91a8b47 SOUND review)

Applied with ffmpeg on 2026-09-19 based on listen review of `91a8b47`:

| Asset | Before (approx.) | After |
|-------|------------------|-------|
| `bgm/menu.ogg` | −13 LUFS, ~97s | ≈−16 LUFS, ~195s (seamless 2× concat) |
| `bgm/battle.ogg` | −21 LUFS, ~157s | ≈−16 LUFS, 180s (2× concat, trim ≥180) |
| `sfx_slash_crit.ogg` | −16 LUFS (quieter than slash −14) | ≈−12 LUFS (louder than slash ≈−15) |
| `sfx_parry.ogg` | −28 LUFS | ≈−16 LUFS (+20 dB then true-peak limit) |
| Other short SFX | mixed −11…−31 / some hot peaks | roughly −14…−16 LUFS, peak-aware (`volume`/`acompressor` + `alimiter`, TP ≲ −0.1 dB) |

No files removed. Spell beds and Kenney sources unchanged aside from gain/limiting/re-encode.

## Encoding

Most SFX: stereo, 44.1 kHz, `libvorbis` q≈5. BGM: stereo, 48 kHz, `libvorbis` q≈6 via ffmpeg. BGM two-pass `loudnorm` I=−16 TP=−1.5; SFX gain/limit as in Loudness balance note.
