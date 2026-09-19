# Fantasy Arena FINAL CHECKOUT — Checklist

**User:** 김응혁 / PM  
**Date:** 2026-09-19 (KST)  
**Base HEAD at start:** `57c4727` (SGZ30 already on main)  
**Evidence:** `qa_final/*.png`, `playtest_results.json`

| ID | Item | Status | Notes |
|----|------|--------|-------|
| A | Branding Fantasy Arena / 판타지 아레나 (no Runestone in UI) | **PASS** | Title/subtitle OK; no Runestone/룬스톤 in DOM. `01_title.png` |
| B | Board max 5/side; parchment; center-line symmetry; slot-fill~1 | **PASS** | `MAX_BOARD=5`; 5 slots/side inside parchment; CSS `--slot-fill: 1.0`; `10_board5.png` |
| C | Hand max 10; 11th burns; tight HS fan; centered; no yellow borders | **PASS** | `MAX_HAND=10` + burn; overlap fan (`margin-left` negative); card border/outline none (playable glow on face only) |
| D | End Turn visible/clickable | **PASS** | `#endBtn` visible; clicked in playtest `06_after_endturn.png` |
| E | Attack skills 10 (…전체·돌파); NO 방어무시/혼란; bold; help; hover tip; 전체 DEF; 돌파 chain; 전체 low ATK | **PASS** | Labels 1–10; help lists all; peek tip shows skill+desc (`09_skill_peek.png`); combat per-target DEF (`atk≤def→0`); SGZ 전체 ATK≤2 |
| F | Earth deck skills 2–10 (≥1 each) | **PASS** | Skills present: 2–10 on earth minions |
| G | Three Kingdoms 30; legends 9-cost martial; 전체 on 6 strategists; in cards-data + playable | **PASS** | All 30 IDs in `CARDS`; deck pool shows 마초/곽가/…; art placeholders reuse legend art (IMAGE follow-up) |
| H | Attribute rules documented | **PASS** | `js/cards-data.js` ATTRIBUTE IDENTITIES comment; `BALANCE.md` + `BALANCE_SGZ30.md` |
| I | Fantasy cards rebalanced to attribute identities | **PASS** | Pass applied this checkout (earth HP↑, fire ATK+minus coins, water DEF↑, wind stable±1, light plus-only, dark gamble±) |
| J | Audio BGM/SFX present; no SyntaxError on load | **PASS** | `assets/audio/bgm|sfx`; Bgm/Sfx globals; `node --check` clean; no pageerrors |
| K | Double-click/tap play works | **PASS** | Hand 5→4 after dblclick playtest |

## Critical gate (A–G, J, K)

**ALL PASS**

## IMAGE follow-up

New SGZ non-legend cards (`e41–e44`, `f22–f25`, …) reuse tribe-legend art via `CARD_ART` placeholders. Replace with unique art later.

## Playtest

- Local: `python3 -m http.server 8765` + Playwright
- Screenshots under `qa_final/`
