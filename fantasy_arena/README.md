# Fantasy Arena / 판타지 아레나

`fantasy_arena` 패키지 — 카드 배틀 웹 게임.

## 실행
이 폴더에서 `index.html`을 브라우저로 연다.
(파일 프로토콜에서도 상대경로 이미지가 로드된다. 로컬 서버 권장: `python3 -m http.server`)

## 규칙
- 이미지 바이트는 data URI에서 **재인코딩 없이** 그대로 저장했다.
- JPEG quality 100 / 해상도 축소 금지 (프로젝트 메모리).
- 기존 const 이름(HUD_UI, CARD_ART, DECK_FRAMES 등)은 유지하고 값만 경로로 바꿨다.
