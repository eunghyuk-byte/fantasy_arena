# FantasySoul (판타지소울) 서버 — 계정 · 덱 저장 (1단계)

Node.js 18+ / SQLite(better-sqlite3). 외부 프레임워크 없이 `node:http`만 사용해서 VPS(카페24 등)로 옮기기 쉽게 했습니다.

## 실행

```bash
cd server
npm install          # better-sqlite3 설치 (node_modules는 커밋하지 않음)
npm start            # http://localhost:8787
npm test             # API 자동 테스트 (메모리 DB)
```

`npm start` 하면 게임 파일(`../fantasy_arena`)도 같은 주소로 서빙합니다 → 브라우저에서 `http://localhost:8787/` 로 바로 플레이.
클라이언트(`js/net.js`)는 서버를 이 순서로 찾습니다: `localStorage["fs-server-url"]`(있으면 이것만) → `window.FS_SERVER_URL` → 같은 주소(origin) → `http://localhost:8787`.
서버가 없으면 기존처럼 로컬(localStorage) 덱으로 동작합니다.

## 환경 변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `PORT` / `HOST` | 8787 / 0.0.0.0 | 리슨 주소 |
| `DB_PATH` | `server/data/fantasysoul.db` | SQLite 파일 (`data/`는 .gitignore) |
| `CARDS_DATA_PATH` | `../fantasy_arena/js/cards-data.js` | 덱 검증용 카드 데이터 (클라이언트와 같은 파일) |
| `STATIC_DIR` | `../fantasy_arena` | 게임 파일 서빙. 빈 문자열이면 끔 |
| `MAX_DECKS` | 10 | 계정당 덱 최대 개수 |
| `SESSION_DAYS` | 30 | 로그인 토큰 유효기간 |
| `DEV_LOGIN` | production이 아니면 1 | 임시 테스트 로그인(이름만) 허용 |
| `STEAM_WEB_API_KEY` / `STEAM_APP_ID` | (없음) | 스팀 로그인용 (나중에) |
| `CORS_ORIGIN` | `*` | 토큰은 Authorization 헤더라 쿠키 없음 |

## 구조

```
server/
  src/index.js          진입점 (start())
  src/config.js         환경 변수
  src/app.js            HTTP 라우팅 · API
  src/cards.js          cards-data.js를 vm으로 읽어 카드 목록 로드
  src/deckRules.js      덱 규칙 검증 (덱빌더와 동일)
  src/auth/devAuth.js   임시 테스트 로그인
  src/auth/steamAuth.js 스팀 로그인 자리 (AuthenticateUserTicket)
  src/auth/sessions.js  토큰 발급·확인
  src/store/index.js    저장소 인터페이스 (DB 교체 지점)
  src/store/sqliteStore.js  SQLite 구현
  test/api.test.js      자동 테스트
```

DB 테이블: `accounts(id, steam_id NULL, dev_name NULL, display_name, created_at)`, `sessions(token, account_id, expires_at)`, `decks(id, account_id, name, tribe, cards_json, …)`.
MySQL/PostgreSQL로 바꿀 때는 `store/`에 같은 메서드를 가진 구현을 추가하고 `store/index.js`에서 고르면 됩니다(app.js는 모든 호출을 await).

## API (JSON)

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/health` | 서버 확인 `{service:"fantasysoul", maxDecks, devLogin, steamLogin}` |
| POST | `/api/auth/dev` | `{name}` → `{token, account}` (임시, 같은 이름 = 같은 계정) |
| POST | `/api/auth/steam` | `{ticket}` → `{token, account}` (키 없으면 501) |
| POST | `/api/auth/logout` | 토큰 폐기 |
| GET | `/api/me` | 내 계정 |
| GET | `/api/decks` | 내 덱 목록 |
| POST | `/api/decks` | `{name, tribe, cards[30]}` 저장 (규칙 위반 422, 11번째 409 `deck_limit`) |
| PATCH | `/api/decks/:id` | `{name}` 이름 변경, 또는 `{name?, tribe?, cards?}` 편집(다시 검증) |
| DELETE | `/api/decks/:id` | 삭제 |

인증: `Authorization: Bearer <token>`. 다른 계정의 덱은 404.

덱 규칙(클라이언트 `game.js`의 maxCopies/tribeCards/saveDraftDeck과 동일): 정확히 30장 · 덱 속성 카드만(유닛·스펠·아이템) · 토큰/없는 카드 금지 · 레어·전설 1장, 커먼·언커먼 2장 · 이름 1~20자.

## 스팀 로그인으로 바꿀 때

1. 클라이언트(Electron + steamworks.js 등): `GetAuthTicketForWebApi("fantasysoul")` → 티켓(hex) → `POST /api/auth/steam {ticket}`.
2. 서버: `STEAM_WEB_API_KEY`(퍼블리셔 키), `STEAM_APP_ID` 설정 → `ISteamUserAuth/AuthenticateUserTicket`로 SteamID64 확인 → `accounts.steam_id`로 계정 찾기/생성. (`src/auth/steamAuth.js`에 구현돼 있음, 실키로는 미검증)
3. 출시 서버는 `NODE_ENV=production`(테스트 로그인 자동 꺼짐).

## VPS 배포 메모

`git clone` → `cd server && npm ci --omit=dev` → `NODE_ENV=production PORT=8787 node src/index.js` (pm2/systemd로 상시 실행) → nginx에서 HTTPS 리버스 프록시. DB 파일(`data/`)은 백업 대상.
