# Card line-break and Eight Trigrams QA — v0.4047

Base: public v0.4046, `5f335c06aee93dd1fee63bb0a885a0237681998e`. Separate worktree/branch: fantasy-card-wrap / fix/card-description-wrap. User authorized publication after validation. Lobby and account branches are excluded.

- Only mechanical change: e43 HP 10 → 9. es9 still creates two stones; 4 ATK, 0 DEF and cannot-attack remain unchanged.
- All 65 two-line descriptions reviewed visually. 43 changed: 39 whitespace/line-break adjustments and 4 compact wording/stat summaries (di3, li7, ls10, es9). Complete inclusion/trigger rules remain in shared details. Existing lore and global rules help need no mechanical change.
- Explicit author line breaks take precedence over automatic soul/stat clauses. Font size (45 at 768×1152), frame coordinates and width are unchanged. No clipping, shrinking or omitted text.
- 708/708 client/server regression tests passed. Added 45 cases covering approved lines, actual two-token 4/0/9 summoning and shared tooltip/detail descriptions. Existing item-summon text regression accepts whitespace differences while retaining its full semantic/stat comparison.
- Real Chrome renders all 300 regular cards plus 9 tokens: maximum two lines, each parenthesis pair stays on the same line, no isolated split Korean syllable or orphan 생성/파괴/처치/탈취. Paljindo first line measures 468.94px within 476.16px; closing parenthesis is intact. Both spawned stones independently have 4/0/9 and max HP 9.
- Desktop 1600×900 and mobile landscape 844×390 detail/tooltip and shared hand/peek face checked; all 65 two-line cards captured in five contact sheets and visually reviewed.
- Independent review compared card objects against the base and confirmed that only e43 HP changes mechanics; related 47 tests passed with no blockers.

Native Steam wrapper and non-Chrome/font-fallback rendering are not covered.

## Changed card descriptions

| ID | Card | Before | After |
|---|---|---|---|
| e13 | 마운록 | 파괴: 나를 파괴한 적을 제거 | 파괴: 나를 파괴한 / 적을 제거 |
| e14 | 마초 | 소환: 마대 (5/1/5) 1기 생성 | 소환: 마대 (5/1/5) / 1기 생성 |
| e21 | 록마운틴킹 | 파괴: 나를 파괴한 적을 제거 | 파괴: 나를 파괴한 / 적을 제거 |
| e23 | 조조 | 파괴: 나를 파괴한 적을 탈취 | 파괴: 나를 파괴한 / 적을 탈취 |
| e29 | 순욱 | 소환: 무작위 땅 스펠 2장을 핸드에 생성 | 소환: 무작위 땅 스펠 / 2장을 핸드에 생성 |
| n2 | 조운 | 소환: 공격력 5 이상 적 전체 파괴 | 소환: 공격력 5 이상 / 적 전체 파괴 |
| n29 | 감녕 | 소환: 랜덤 바람 유닛 1기를 전장에 생성 | 소환: 랜덤 바람 유닛 / 1기를 전장에 생성 |
| a1 | 관우 | 소환: 이 유닛의 방어만큼 적 전체에 피해 | 소환: 이 유닛의 방어만큼 / 적 전체에 피해 |
| a13 | 대교 | 파괴: 소교 (1/1/1) 1기 생성 | 파괴: 소교 (1/1/1) / 1기 생성 |
| a15 | 손권 | 파괴: 나를 파괴한 적을 탈취 | 파괴: 나를 파괴한 / 적을 탈취 |
| a29 | 손책 | 처치: 랜덤 물 카드를 핸드에 생성 | 처치: 랜덤 물 카드를 / 핸드에 생성 |
| l29 | 방통 | 소환: 공격력 3 이하 랜덤 적 하나를 탈취 | 소환: 공격력 3 이하 / 랜덤 적 하나를 탈취 |
| d7 | 여포 | 소환: 적 전체 각자의 코인 수만큼 방·체 감소 | 소환: 적 전체 각자의 / 코인 수만큼 방·체 감소 |
| d11 | 초선 | 소환: 랜덤 적 유닛 1기 영구 탈취 | 소환: 랜덤 적 유닛 / 1기 영구 탈취 |
| d28 | 암흑자이언트 | 파괴: 나를 파괴한 적을 탈취 | 파괴: 나를 파괴한 / 적을 탈취 |
| d29 | 허저 | 소환: 랜덤 적 유닛 1기 처치 | 소환: 랜덤 적 유닛 / 1기 처치 |
| l17 | 황월영 | 소환: 코인이 있는 아군 전체의 코인 수를 5로 | 소환: 코인이 있는 아군 / 전체의 코인 수를 5로 |
| ns1 | 바람망토 | 아군 핸드 전체 유닛 소울-1 | 아군 핸드 전체 유닛 / 소울-1 |
| ns2 | 진공베기 | 코인 2개 이상인 적 하나 파괴 | 코인 2개 이상인 / 적 하나 파괴 |
| as3 | 익사 | 공격력 5 이하 적 하나 파괴 | 공격력 5 이하 / 적 하나 파괴 |
| ns4 | 떠오르는섬 | 내 전장 빈칸 수만큼 섬의 파편 (1/0/2) 생성 | 내 전장 빈칸 수만큼 / 섬의 파편 (1/0/2) 생성 |
| es2 | 어스퀘이크 | 적 전체에 내 핸드 수만큼 피해 | 적 전체에 / 내 핸드 수만큼 피해 |
| es3 | 샌드트랩 | 내 전장 빈칸 수만큼 적에게 피해 3 | 내 전장 빈칸 수만큼 / 적에게 피해 3 |
| es4 | 미로생성 | 내 전장에 미로 (0/2/2) 2기 생성 | 내 전장에 미로 (0/2/2) / 2기 생성 |
| ns5 | 토네이도 | 2소울 이하 유닛 전체 파괴 | 2소울 이하 유닛 / 전체 파괴 |
| ni1 | 요정의부츠 | 내 턴 종료: 상대 핸드의 랜덤 유닛 소울+1 | 내 턴 종료: 상대 핸드의 / 랜덤 유닛 소울+1 |
| ni2 | 올빼미의눈 | 내 턴 종료: 상대 핸드의 랜덤 스펠 소울+1 | 내 턴 종료: 상대 핸드의 / 랜덤 스펠 소울+1 |
| ni5 | 하피의손톱 | 처치: 하피 (2/0/3) 1기 생성 | 처치: 하피 (2/0/3) / 1기 생성 |
| ai2 | 얼음창 | 공격: 파도창병 (2/0/2) 1기 생성 | 공격: 파도창병 (2/0/2) / 1기 생성 |
| di3 | 흑마법서 | 처치: 상대 핸드의 랜덤 카드 1장을 내 핸드로 복사 | 처치: 상대 핸드 카드 1장 / 무작위로 내 핸드에 복사 |
| di4 | 조작된주화 | 모든 코인을 골드 코인으로 변경 | 모든 코인을 / 골드 코인으로 변경 |
| ls4 | 성역축복 | 이번 턴 코인 앞면 확률 +50% | 이번 턴 코인 앞면 / 확률 +50% |
| ls6 | 심판 | 공격력 3 이상 적 하나 파괴 | 공격력 3 이상 / 적 하나 파괴 |
| ds4 | 불길한예감 | 이번 턴 코인 뒷면 확률 +50% | 이번 턴 코인 뒷면 / 확률 +50% |
| di7 | 적토마 | 파괴: 여포 1장을 내 핸드에 생성 | 파괴: 여포 1장을 / 내 핸드에 생성 |
| li7 | 백우선 | 내 턴 종료: 랜덤 빛 카드를 내 핸드에 생성 | 내 턴 종료: 랜덤 빛 카드 / 1장을 내 핸드에 생성 |
| ei7 | 맹덕신서 | 처치: 랜덤 땅 스펠 1장을 내 핸드에 생성 | 처치: 랜덤 땅 스펠 1장을 / 내 핸드에 생성 |
| ai7 | 청룡언월도 | 파괴: 랜덤 물 유닛 3장을 내 핸드에 생성 | 파괴: 랜덤 물 유닛 3장을 / 내 핸드에 생성 |
| fi7 | 장팔사모 | 공격: 화염구 1장을 내 핸드에 생성 | 공격: 화염구 1장을 / 내 핸드에 생성 |
| as9 | 연환계 | 적 전체에게 적 유닛 수만큼 피해 | 적 전체에게 / 적 유닛 수만큼 피해 |
| es9 | 팔진도 | 내 전장에 팔진석 (4/0/10) 2기 생성 | 내 전장에 팔진석 (4/0/9) / 2기 생성 |
| ls10 | 성흔 | 유닛 하나에 파괴: 성흔사 (6/1/6) 1기 생성 부여 | 유닛 하나에 파괴 능력: / 성흔사 (6/1/6) 1기 생성 |
| ds10 | 시체더미 | 내 전장 빈칸 수만큼 스켈레톤 (2/0/3) 생성 | 내 전장 빈칸 수만큼 / 스켈레톤 (2/0/3) 생성 |
