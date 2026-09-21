# fantasy_arena (판마스톤)

단일 `runestone.html`을 모듈 트리로 분리한 패키지.

## 실행
이 폴더에서 `index.html`을 브라우저로 연다.
(파일 프로토콜에서도 상대경로 이미지가 로드된다. 로컬 서버 권장: `python3 -m http.server`)

## 규칙
- 이미지 바이트는 data URI에서 **재인코딩 없이** 그대로 저장했다.
- JPEG quality 100 / 해상도 축소 금지 (프로젝트 메모리).
- 기존 const 이름(HUD_UI, CARD_ART, DECK_FRAMES 등)은 유지하고 값만 경로로 바꿨다.

## Desktop (Electron)
Fixed 4:3 native window (Hearthstone-style). From repo root:
```bash
cd desktop && npm install && npm start
```
Web/GitHub Pages preview is unchanged — open this folder's `index.html`.
In-game **설정 · 해상도**: 1024×768 / 1280×960 / 1600×1200 / 1920×1440 + fullscreen.
