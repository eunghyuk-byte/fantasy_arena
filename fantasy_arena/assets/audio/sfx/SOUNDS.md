# SFX 파일 (ogg 우선, 없으면 mp3/wav)

| 파일 | 실측 파일 길이 | 프롬프트 |
|---|---|---|
| sfx_death.ogg | 0.477s | card paper tear + cloth fall, not gory |
| sfx_card_play.ogg | 0.277s | thick card slap onto wood table |
| sfx_card_draw.ogg | 0.430s | single card slide from deck |
| sfx_summon.ogg | 1.000s | 직접 합성 후보 4 · 마법 응축 · 48kHz stereo |
| sfx_hero_hit.ogg | 0.649s | body thud + light grunt, not scream |
| sfx_turn.ogg | 0.697s | three rising chimes, tavern bell |
| sfx_win.ogg | 1.405s | short triumphant brass sting |
| sfx_lose.ogg | 1.200s | descending low brass, not comic |
| sfx_ui_click.ogg | 0.220s | 직접 합성 후보 1 · 부드러운 탭 · 48kHz stereo |
| sfx_coin.ogg | 0.846s | gold coin spin land |

볼륨: Sfx.setVolume(0~1) / BGM은 TavernBgm.duck

길이는 v0.397 파일의 ffprobe 실측값입니다. 현재 공격·방어·죽음 주연출은 assets/fx/combat/*/A의 0.900초 효과음을 사용합니다. sfx_death는 손패 초과 소각의 구형 대체 경로에서 유지하며, sfx_win/lose/coin도 조건부 대체 경로에 남습니다.
