# 분리 마이그레이션

1. `runestone.html`에서 `<style>` → `css/game.css`
2. data URI 바이트를 재인코딩 없이 `assets/img/**`로 덤프 (JPEG/PNG/WebP/SVG 원본)
3. const 값은 경로 문자열로 치환 (`HUD_UI.board`, `CARD_FACE`, `CARD_ART`, 프레임 등)
4. 로직 분할: `cards-data.js` → `vfx.js` → `sfx.js` → `combat.js` → `render.js` → `game.js`
5. `index.html`이 위 순서로 스크립트 로드
6. 동작 확인: 타이틀 → 덱 → 전투 배경/카드 얼굴/코인/마법 쇼케이스
