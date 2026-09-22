# 프레임 규격
- 합성 캔버스: 768 x 1152 (2:3)
- 소스 프레임: `{unit|item|spell}/deck_{tribe}_{unit|item|spell}_{rarity}_frame.png` (1300×2000, 투명 외곽 패딩 ≈8%)
- 합성 시 `frameOpaqueBBox`로 불투명 실루엣만 크롭해 768×1152에 맞춤
- 코너 반경: ≈ 42px (W*0.055)
- 아트 세이프(불투명 실루엣 기준): x ≈ 11.8%–88.3%, y ≈ 11.4%–54.9%
- 이름 리본: y ≈ 59%
- 설명: y ≈ 68%–82%
- 공/방/체: y ≈ 90.3%

# 부족 × 희귀도
- Tribes: dark, earth, fire, water, wind, light (`deck_*_{unit|item|spell}_*`)
- Rarities: common, uncommon, rare, legendary
- metal: 새 세트 없음 → earth 프레임으로 폴백
- 유닛: `unit/deck_{tribe}_unit_{rarity}_frame.png`
- 아이템: `item/deck_{tribe}_item_{rarity}_frame.png`
- 스펠: `spell/deck_{tribe}_spell_{rarity}_frame.png`

# 검정 테두리
소스 JPEG는 재압축하지 않는다. 합성 시 punchFrame이 가장자리 근접검정만 알파 0.
포토샵으로 손볼 때: 매직완드 검정 > 삭제 > PNG-24 저장. JPEG로 다시 말지 말 것.

# 보강 계획
1. deck_metal_{unit|item|spell}_{common,uncommon,rare,legendary}_frame.png
2. icons/metal.png 정사각 엠블럼
