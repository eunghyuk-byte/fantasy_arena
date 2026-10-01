# Card description alignment — local review

Base: v0.4043 `05953bb875196bee77a666548a3d163c92fcad05`. No version bump, remote push or public deployment.

## Changes

The shared Canvas renderer previously anchored single-line text at the top line of a two-line block for every frame. Unit/item block centers now preserve that approved single-line seat; two-line blocks move up 29.3px on the 768x1152 source canvas. Spell blocks preserve the existing two-line center; single-line descriptions move down 29.3px. This scales proportionally with the card image. The frame, portrait, stats, soul, font size, line wrapping and card data are unchanged.

## Verification

604 Node tests pass, including three alignment tests observed failing before the fix. Real Chrome composed all 300 non-token cards at desktop and mobile 844x390: 77 empty, 158 one-line, 63 two-line, 2 three-line. Before/after records prove identical wording, font, widths and line counts; only requested Y positions differ. Mobile records equal desktop records because all views share the same 768x1152 composition.

Builder/catalogue, lore, hand and zoom use the same composed image at 1600x900 and 844x390. Representative item/spell/unit cards were visually checked, including 사마의, 블랙드래곤, 여포, 전염병, 해골던지기, 파멸, 사신의낫, 흑마법서 and 적토마. Independent reviewer found no important defect. Native Steam and other OS font fallbacks were not tested.

## Wording decision required — no text changed

| Card | Current text | Cause | Proposed two lines |
|---|---|---|---|
| 동남풍 (ns9) | 적 전체 전장 유닛을 핸드로 이동 / 손패 10장 초과분은 파괴 | First explicit line exceeds 476.16px and wraps, producing 3 lines | 적 전장 유닛 전부 핸드로 / 손패 10장 초과분은 파괴 |
| 일기토 (fs9) | 내 전장과 적 전장에서 랜덤 유닛 하나씩만 남기고 나머지 처치 | Long single sentence width-wraps into 3 lines | 각 전장 무작위 1기 외 / 나머지 유닛 처치 |

Slash means a proposed explicit newline. At the unchanged 45px font, proposed line widths are 454.86 / 456.34px and 398.61 / 310.23px. Available width is 476.16px. These proposals are not applied; final approval is required before changing card text. Until then the two existing three-line cards remain visible in full, without clipping or shrinking.

## Library before/after images

- Item: libfile_edbe973407cc8191bf2e81628181f85a
- Spell: libfile_68ae83b8abe08191b449c04d27f08739
- Unit: libfile_ee3e534fc3fc8191a4b0cf0bdfd52d52

Detailed audit JSON and context screenshots are retained in task-5/description-qa.
