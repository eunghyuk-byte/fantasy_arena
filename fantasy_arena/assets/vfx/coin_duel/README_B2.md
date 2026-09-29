# Coin duel v3, layout B2: game assembly guide

B2 changes only the placement: smaller coins, and both duel cards sit inside the board frame.

These are exactly the same as v3/B, and B2 references the files there:
- coin assets (`../B/coins/*/coin.webm`, `timing.json`)
- sound (`../B/sfx/*.ogg`)
- timing (stagger, late coin, hold and outro)
- dim

Everything else in `../B/README.md` still applies. `index.json` here lists all assets with paths relative to this folder.

## Board frame (measured on the 1920x1080 battlefield screenshot)
- **Inner rect** (parchment inside the gold frame): x 324-1581, y 58-949, which is **W_in 1257 x H_in 891**.
  At the frame's middle, the inner gold lines sit at x=320-322 (left), x=1583 (right), y=56 (top) and y=950-952 (bottom).
- **Corners:** the gold corner ornaments curve about 70 px into the parchment (rounded inner corners).
- **UI touching the rect:**
  - mana badges: top-right x1416-1560, y12-75; bottom-right x1416-1565, y935-1000
  - end-turn button: x >= 1560, y 490-560
  - hand cards: centre top (y < 130) and centre bottom (y > 860)
- **safe_right = 1540 px** (0.967 of W_in from the left edge). Nothing of the coin effect may pass this line.

## Duel card boxes
Let margin = 0.045 x H_in (40 px at 1080p) and card_h = 0.432 x H_in (385 px). Then card_w = card_h x 2/3 (257 px).

| card | x | y | w x h (1080p) | as fractions [x, y, w, h] of the inner rect |
|---|---|---|---|---|
| top (opponent) | inner.x0 + margin | inner.y0 + margin | 364, 98, 257 x 385 | [0.0318, 0.0449, 0.2045, 0.4321] |
| bottom (me) | inner.x0 + margin | inner.y1 - margin - card_h | 364, 524, 257 x 385 | [0.0318, 0.5230, 0.2045, 0.4321] |

- The gap between the cards is 0.046 x H_in (41 px).
- The margin keeps the card corners clear of the corner ornaments. I checked this visually.

## Coin rows
Units are the card height.

| rule | ratio | 1080p |
|---|---|---|
| coin diameter D | 0.30 x card_h | 115.5 px (sprite scale = D / 160 = 0.722) |
| pitch (centre to centre) | 0.36 x card_h (1.2 D) | 138.6 px |
| first coin centre | card right edge + 0.24 x card_h (0.09 x card_h gap + radius 0.15) | x = 713.4 |
| row y | card centre y | 290.5 (top row), 716.5 (bottom row) |

Place each canvas so that its `timing.json` anchor (176,176, times the scale) sits on the coin centre.
The rows grow to the right, and each row takes 0-5 coins independently.

## Fit rule (explicit)
The coin effect's right extent with n coins is:

  right(n) = card.x + card_h x (2/3 + 0.24 + (n-1) x 0.36 + 0.33)

Here 0.33 x card_h is half the scaled 352 px sprite canvas. It covers the largest in-flight coin (about 1.6x size) plus its shadow.

- **Requirement:** right(5) <= safe_right, which is the same as **card_h <= (safe_right - card.x) / 2.677**.
- **At 1080p:**
  - right(5) = 1394.5 px, which is at most 1540. OK, with 145 px to spare.
  - The rest-state right edge of the 5th coin is at 1325 px.
- **Vertical:** card centre y ± 0.33 x card_h must stay inside the inner rect.
  Top row min y is 163.5 (at least 58) and bottom row max y is 843.5 (at most 949). OK.
- **If a different screen or board layout fails the rule:** reduce card_h first, or reduce the pitch to 0.33 x card_h.

## Unchanged from v3/B
- **Dim:** RGB(8,6,10) at 0.55, linear fade-in over 0.12 s. It fades out with everything over the last 0.16 s.
- **Start times:** 0.04 + 0.03 x i s, plus 0-12 ms jitter.
- **Late coin:** one per duel.
- **Result and outro:** hold 0.28 s after the last settle, then a 0.16 s outro.
- **Sound triggers and gains:** see `../B/README.md`.

## Previews
`preview_1v1.mp4`, `preview_3v2.mp4` and `preview_5v5.mp4`, each with `_layout.json` giving the exact card boxes, coin centres, start and settle times.
They also come with `_mix.ogg` (the reference audio).
Rebuild them with `../common/compose_b2.py TOP BOTTOM out.mp4`. Regenerate `meta.json` and `index.json` with `../common/gen_b2.py`.
