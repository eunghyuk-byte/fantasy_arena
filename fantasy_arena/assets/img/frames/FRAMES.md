# 프레임 규격
- 캔버스: 768 x 1152 (2:3)
- 코너 반경: ≈ 42px (W*0.055)
- 아트 세이프: x 11.2%–88.8%, y 12.2%–57.0%
- 이름 리본: y ≈ 59%
- 설명: y ≈ 68%–82%
- 공/방/체: y ≈ 89.8%

# 검정 테두리
소스 JPEG는 재압축하지 않는다. 합성 시 punchFrame이 가장자리 근접검정만 알파 0.
포토샵으로 손볼 때: 매직완드 검정 > 삭제 > PNG-24 저장. JPEG로 다시 말지 말 것.

# 전수
| 파일 | 상태 |
| unit/earth.jpg | 깨짐 8x12 → rarity PNG로 우회 |
| unit/* 나머지 | 900x1350 JPEG, 알파 없음 |
| spell/earth | 없음 → earth_spell_common.png |
| spell/metal | 없음 → metal unit 임시 |
| rarity/earth_* | 768x1152 PNG OK |
| icons/metal | 없음 → metal unit 임시 |

# 보강 계획 metal
1. deck_metal_unit_{common,rare,heroic,legendary}.png 768x1152
2. deck_metal_magic_* 동일
3. icons/metal.png 정사각 엠블럼
