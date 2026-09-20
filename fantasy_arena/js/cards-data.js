
const TRIBES = [
  { id: "earth", name: "땅", en: "Earth", icon: "🪨", open: true, color: "#8b5a2b",
    powerName: "암석 방패", powerText: "1/2 암석 소환", power: { type: "summon", value: [1,2] } },
  { id: "fire", name: "불", en: "Fire", icon: "🔥", open: true, color: "#d44512",
    powerName: "불씨", powerText: "적 영웅에게 피해 1", power: { type: "face", value: 1 } },
  { id: "wind", name: "바람", en: "Wind", icon: "🌬️", open: true, color: "#7ec8c8",
    powerName: "돌풍", powerText: "적 영웅에게 피해 1", power: { type: "face", value: 1 } },
  { id: "water", name: "물", en: "Water", icon: "💧", open: true, color: "#2a7ad4",
    powerName: "샘물", powerText: "내 영웅 회복 2", power: { type: "heal_hero", value: 2 } },
  { id: "dark", name: "암흑", en: "Dark", icon: "🌑", open: true, color: "#5a2a7a",
    powerName: "암흑검", powerText: "적 영웅에게 피해 1", power: { type: "face", value: 1 } },
  { id: "light", name: "빛", en: "Light", icon: "✨", open: true, color: "#f0e0a0",
    powerName: "성광", powerText: "내 영웅 회복 2", power: { type: "heal_hero", value: 2 } },
];

const TRIBE_ICONS = {
  earth:"assets/img/icons/earth.png",
  fire:"assets/img/icons/fire.png",
  wind:"assets/img/icons/wind.png",
  water:"assets/img/icons/water.png",
  light:"assets/img/icons/light.png",
  dark:"assets/img/icons/dark.png",
  metal:"assets/img/icons/metal.png"
};
const HUD_UI = {
  board:"assets/img/hud/board.jpg",
  hp:"assets/img/hud/hp.jpg",
  mana:"assets/img/hud/mana.jpg",
  deck:"assets/img/hud/deck.jpg"
};



/* =============================================================================
 * ATTRIBUTE IDENTITIES (밸런스 LOCK) — Fantasy Arena
 * 땅체: Earth = HP 특화 (체↑ · 공/방 상대적으로 ↓ · 체 코인 위주)
 * 불공+마코인: Fire = ATK 특화 · 베이스 공↑ · 코인 헤비 마이너스(후면 급락)
 * 물방: Water = DEF 특화 · 방↑ · 방+ 코인 · 공/체 상대적으로 ↓
 * 바람안정: Wind = atk≈def≈hp 균형 · 코인 저분산(±0~1)
 * 빛+코인: Light = 성장형 · 전원 플러스 코인만 · 베이스 스탯 낮게
 * 암도박베이스↑: Dark = 도박 · ±5급 코인 · 리스크 보상으로 베이스 스탯 강함
 * 광역공격(9): ATK 1–2 only · 대상별 DEF · atk≤def → HP피해 0 · 생존 시 반격은 맨 앞 대상만
 * 반격 공통: 혼란을 제외한 모든 공격은 대상 생존 시 반격 · 연속은 각 hit마다 반격
 * =============================================================================
 */
const ATK_SKILL_LABEL = {
  1: "일반공격",
  2: "관통공격",
  3: "돌진공격",
  4: "연속공격",
  5: "치명공격",
  6: "흡혈공격",
  7: "약화공격",
  8: "석화공격",
  9: "광역공격",
  10: "돌파공격",
  11: "혼란공격"
};
const ATK_SKILL_DESC = {
  1: "자신의 공격만큼 데미지. 대상 생존 시 반격",
  2: "먼저 방어를 깎고 남는 피해가 체력으로. 대상 생존 시 반격",
  3: "자신의 방어만큼 추가 데미지. 대상 생존 시 반격",
  4: "두 번 공격 (1타→반격→2타→반격). 데미지 배수가 아니라 타격 2회. 각 타격마다 대상 생존 시 반격",
  5: "방어를 넘어 체력 1이라도 깎이면 즉사 (ATK 보통 1, 최대 3; 고공 치명 금지). 대상 생존 시 반격",
  6: "준 체력 데미지 절반(올림) 회복 (풀피 초과 불가). 대상 생존 시 반격",
  7: "공격 시 먼저 공/방 −1 후 타격. 대상 생존 시 반격",
  8: "공격 시 먼저 공=0·방+1 후 타격. 대상 생존 시 반격",
  9: "적 하수인 전체 광역(대상별 방어, 막히면 HP 0). 생존 시 반격은 맨 앞 대상만",
  10: "처치하면 남은 공격력으로 다음 적 공격. 각 대상 생존 시 반격",
  11: "타격. 반격 없음"
};
const ATK_SKILL_ID = {
  normal: 1,
  penetrate: 2,
  charge: 3,
  double: 4,
  lethal: 5,
  lifesteal: 6,
  weaken: 7,
  petrify: 8,
  cleave: 9,
  aoe: 9,
  trample: 10,
  confuse: 11,
  chaos: 11
};

/** Special abilities (특수능력) — separate from atkSkill (특수공격). Korean keys. */
const ABILITY_KEYS = ["보호","출전","고무","활력","결속","위압","유언","강탈","환생","복수"];
const ABILITY_DESC = {
  "보호": "항상. 체력이 실제로 깎일 뻔한 피해 1회만 무시하고 사라짐. 방어로 막힌 0뎀은 안 사라짐.",
  "출전": "낼 때 카드 1장 뽑기(손10이면 번).",
  "고무": "낼 때 이미 있는 다른 아군 공격 +1(영구).",
  "활력": "낼 때 다른 아군 현재·최대 체력 +1(영구).",
  "결속": "낼 때 다른 아군 방어 +1(영구, 0–5).",
  "위압": "낼 때 적 유닛 전원 공격 −1(영구, 최저 0). 영웅 제외.",
  "유언": "죽을 때 카드 1장 뽑기.",
  "강탈": "죽을 때 적 유닛 무작위 1장을 내 전장으로(상태 유지). 보드 풀이어도 사망 슬롯으로 발동.",
  "환생": "죽을 때 체력 1로 1회 부활하며 환생은 사라짐. 사망 능력은 그때도 발동. 다시 죽으면 사망 능력 또 발동.",
  "복수": "죽을 때 죽인 유닛도 사망(광역 포함). 마법으로 죽으면 미발동."
};
const ABILITY_COST = {
  "유언": 1.25,
  "출전": 1.5,
  "고무": 1.5,
  "활력": 1.75,
  "위압": 1.75,
  "보호": 2.0,
  "복수": 2.0,
  "결속": 2.25,
  "환생": 2.5,
  "강탈": 3.0
};

const CARDS = [
  // --- Minions (Grok overlay export; no skills) ---
  { id:"e1", tribe:"earth", name:"놀", cost:1, type:"minion", atk:1, def:0, hp:2, atkC:1, defC:0, hpC:0, text:"" },
  { id:"e2", tribe:"earth", name:"모래지네", cost:1, type:"minion", atk:1, def:0, hp:2, atkC:1, defC:0, hpC:0, text:"" },
  { id:"e3", tribe:"earth", name:"미믹", cost:1, type:"minion", atk:1, def:0, hp:2, atkC:1, defC:0, hpC:0, text:"" },
  { id:"e4", tribe:"earth", name:"드라이어드", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"e5", tribe:"earth", name:"드워프", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"e6", tribe:"earth", name:"만드라고라", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"e7", tribe:"earth", name:"샌드맨", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"e8", tribe:"earth", name:"엘프", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"e9", tribe:"earth", name:"오크", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"e10", tribe:"earth", name:"전투드워프", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"e11", tribe:"earth", name:"순욱", cost:3, type:"minion", atk:3, def:1, hp:4, atkC:0, defC:0, hpC:1, text:"" },
  { id:"e12", tribe:"earth", name:"스톤골렘", cost:3, type:"minion", atk:1, def:2, hp:5, atkC:0, defC:1, hpC:1, text:"" },
  { id:"e13", tribe:"earth", name:"오우거", cost:3, type:"minion", atk:1, def:2, hp:5, atkC:0, defC:1, hpC:1, text:"" },
  { id:"e14", tribe:"earth", name:"울프라이더", cost:3, type:"minion", atk:3, def:1, hp:4, atkC:0, defC:0, hpC:1, text:"" },
  { id:"e15", tribe:"earth", name:"전투멧돼지", cost:3, type:"minion", atk:3, def:1, hp:4, atkC:0, defC:0, hpC:1, text:"" },
  { id:"e16", tribe:"earth", name:"켄타우로스", cost:3, type:"minion", atk:3, def:1, hp:4, atkC:0, defC:0, hpC:1, text:"" },
  { id:"e17", tribe:"earth", name:"고르곤", cost:4, type:"minion", atk:4, def:1, hp:5, atkC:0, defC:0, hpC:1, text:"" },
  { id:"e18", tribe:"earth", name:"대지의 정령", cost:4, type:"minion", atk:4, def:1, hp:5, atkC:0, defC:0, hpC:1, text:"" },
  { id:"e19", tribe:"earth", name:"덴드로이드", cost:4, type:"minion", atk:4, def:1, hp:5, atkC:0, defC:0, hpC:1, text:"" },
  { id:"e20", tribe:"earth", name:"전투코끼리", cost:4, type:"minion", atk:2, def:3, hp:6, atkC:0, defC:1, hpC:1, text:"" },
  { id:"e21", tribe:"earth", name:"록마운틴킹", cost:5, type:"minion", atk:5, def:2, hp:6, atkC:1, defC:0, hpC:0, text:"" },
  { id:"e22", tribe:"earth", name:"스핑크스", cost:5, type:"minion", atk:5, def:2, hp:6, atkC:1, defC:0, hpC:0, text:"" },
  { id:"e23", tribe:"earth", name:"조조", cost:5, type:"minion", atk:5, def:2, hp:6, atkC:1, defC:0, hpC:0, text:"" },
  { id:"e24", tribe:"earth", name:"티라노", cost:5, type:"minion", atk:5, def:2, hp:6, atkC:1, defC:0, hpC:0, text:"" },
  { id:"e25", tribe:"earth", name:"대지자이언트", cost:6, type:"minion", atk:4, def:4, hp:8, atkC:0, defC:0, hpC:2, text:"" },
  { id:"e26", tribe:"earth", name:"사이클롭스", cost:6, type:"minion", atk:4, def:4, hp:8, atkC:0, defC:0, hpC:2, text:"" },
  { id:"e27", tribe:"earth", name:"샌드웜", cost:6, type:"minion", atk:6, def:2, hp:7, atkC:1, defC:0, hpC:0, text:"" },
  { id:"e28", tribe:"earth", name:"포레스트웜", cost:6, type:"minion", atk:6, def:2, hp:7, atkC:1, defC:0, hpC:0, text:"" },
  { id:"e29", tribe:"earth", name:"하후돈", cost:7, type:"minion", atk:7, def:2, hp:8, atkC:0, defC:0, hpC:1, text:"" },
  { id:"e30", tribe:"earth", name:"곽가", cost:8, type:"minion", atk:8, def:3, hp:9, atkC:0, defC:0, hpC:1, text:"" },
  { id:"e31", tribe:"earth", name:"베헤모스", cost:8, type:"minion", atk:6, def:5, hp:10, atkC:0, defC:0, hpC:2, text:"" },
  { id:"e32", tribe:"earth", name:"그린드래곤", cost:9, type:"minion", atk:9, def:3, hp:10, atkC:0, defC:0, hpC:1, text:"" },
  { id:"e33", tribe:"earth", name:"마초", cost:9, type:"minion", atk:9, def:3, hp:10, atkC:0, defC:0, hpC:1, text:"" },
  { id:"f1", tribe:"fire", name:"고그", cost:1, type:"minion", atk:1, def:0, hp:1, atkC:1, defC:0, hpC:0, text:"" },
  { id:"f2", tribe:"fire", name:"그렘린", cost:1, type:"minion", atk:1, def:0, hp:1, atkC:1, defC:0, hpC:0, text:"" },
  { id:"f3", tribe:"fire", name:"임프", cost:1, type:"minion", atk:1, def:0, hp:1, atkC:1, defC:0, hpC:0, text:"" },
  { id:"f4", tribe:"fire", name:"고블린", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"f5", tribe:"fire", name:"불꽃여우", cost:2, type:"minion", atk:2, def:0, hp:2, atkC:1, defC:0, hpC:0, text:"" },
  { id:"f6", tribe:"fire", name:"불꽃전사", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"f7", tribe:"fire", name:"샐러맨더", cost:2, type:"minion", atk:2, def:0, hp:2, atkC:1, defC:0, hpC:0, text:"" },
  { id:"f8", tribe:"fire", name:"잿빛늑대", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"f9", tribe:"fire", name:"퓨리울프", cost:2, type:"minion", atk:2, def:0, hp:2, atkC:1, defC:0, hpC:0, text:"" },
  { id:"f10", tribe:"fire", name:"헬하운드", cost:2, type:"minion", atk:2, def:0, hp:2, atkC:1, defC:0, hpC:0, text:"" },
  { id:"f11", tribe:"fire", name:"바바리안", cost:3, type:"minion", atk:3, def:1, hp:4, atkC:0, defC:0, hpC:1, text:"" },
  { id:"f12", tribe:"fire", name:"여몽", cost:3, type:"minion", atk:3, def:1, hp:4, atkC:0, defC:0, hpC:1, text:"" },
  { id:"f13", tribe:"fire", name:"파이어골렘", cost:3, type:"minion", atk:1, def:2, hp:5, atkC:0, defC:1, hpC:1, text:"" },
  { id:"f14", tribe:"fire", name:"파이어아머", cost:3, type:"minion", atk:3, def:1, hp:4, atkC:0, defC:0, hpC:1, text:"" },
  { id:"f15", tribe:"fire", name:"횃불약탈자", cost:3, type:"minion", atk:3, def:1, hp:4, atkC:0, defC:0, hpC:1, text:"" },
  { id:"f16", tribe:"fire", name:"미노타우로스", cost:4, type:"minion", atk:4, def:1, hp:5, atkC:0, defC:0, hpC:1, text:"" },
  { id:"f17", tribe:"fire", name:"불의 정령", cost:4, type:"minion", atk:4, def:1, hp:5, atkC:0, defC:0, hpC:1, text:"" },
  { id:"f18", tribe:"fire", name:"이프리트", cost:4, type:"minion", atk:4, def:1, hp:5, atkC:0, defC:0, hpC:1, text:"" },
  { id:"f19", tribe:"fire", name:"케르베로스", cost:4, type:"minion", atk:4, def:1, hp:5, atkC:0, defC:0, hpC:1, text:"" },
  { id:"f20", tribe:"fire", name:"네메아사자", cost:5, type:"minion", atk:5, def:2, hp:6, atkC:1, defC:0, hpC:0, text:"" },
  { id:"f21", tribe:"fire", name:"데몬", cost:5, type:"minion", atk:5, def:2, hp:6, atkC:1, defC:0, hpC:0, text:"" },
  { id:"f22", tribe:"fire", name:"문추", cost:5, type:"minion", atk:5, def:2, hp:6, atkC:1, defC:0, hpC:0, text:"" },
  { id:"f23", tribe:"fire", name:"발록", cost:5, type:"minion", atk:5, def:2, hp:6, atkC:1, defC:0, hpC:0, text:"" },
  { id:"f24", tribe:"fire", name:"키메라", cost:5, type:"minion", atk:5, def:2, hp:6, atkC:1, defC:0, hpC:0, text:"" },
  { id:"f25", tribe:"fire", name:"드래곤나이트", cost:6, type:"minion", atk:6, def:2, hp:7, atkC:1, defC:0, hpC:0, text:"" },
  { id:"f26", tribe:"fire", name:"피닉스", cost:6, type:"minion", atk:6, def:2, hp:7, atkC:1, defC:0, hpC:0, text:"" },
  { id:"f27", tribe:"fire", name:"화염자이언트", cost:6, type:"minion", atk:4, def:4, hp:8, atkC:0, defC:0, hpC:2, text:"" },
  { id:"f28", tribe:"fire", name:"허저", cost:7, type:"minion", atk:7, def:2, hp:8, atkC:0, defC:0, hpC:1, text:"" },
  { id:"f29", tribe:"fire", name:"가후", cost:8, type:"minion", atk:8, def:3, hp:9, atkC:0, defC:0, hpC:1, text:"" },
  { id:"f30", tribe:"fire", name:"데빌", cost:8, type:"minion", atk:8, def:3, hp:9, atkC:0, defC:0, hpC:1, text:"" },
  { id:"f31", tribe:"fire", name:"타이폰", cost:8, type:"minion", atk:8, def:3, hp:9, atkC:0, defC:0, hpC:1, text:"" },
  { id:"f32", tribe:"fire", name:"레드드래곤", cost:9, type:"minion", atk:9, def:3, hp:10, atkC:0, defC:0, hpC:1, text:"" },
  { id:"f33", tribe:"fire", name:"장비", cost:9, type:"minion", atk:9, def:3, hp:10, atkC:0, defC:0, hpC:1, text:"" },
  { id:"a1", tribe:"water", name:"개울개구리", cost:1, type:"minion", atk:1, def:0, hp:2, atkC:1, defC:0, hpC:0, text:"" },
  { id:"a2", tribe:"water", name:"슬라임", cost:1, type:"minion", atk:1, def:0, hp:2, atkC:1, defC:0, hpC:0, text:"" },
  { id:"a3", tribe:"water", name:"연못거북", cost:1, type:"minion", atk:1, def:0, hp:2, atkC:1, defC:0, hpC:0, text:"" },
  { id:"a4", tribe:"water", name:"피라냐", cost:1, type:"minion", atk:1, def:0, hp:2, atkC:1, defC:0, hpC:0, text:"" },
  { id:"a5", tribe:"water", name:"나가", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"a6", tribe:"water", name:"독두꺼비", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"a7", tribe:"water", name:"리자드맨", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"a8", tribe:"water", name:"스파이더", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"a9", tribe:"water", name:"전기해파리", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"a10", tribe:"water", name:"파도창병", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"a11", tribe:"water", name:"해파리", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"a12", tribe:"water", name:"머메이드", cost:3, type:"minion", atk:3, def:1, hp:4, atkC:0, defC:0, hpC:1, text:"" },
  { id:"a13", tribe:"water", name:"산호수호자", cost:3, type:"minion", atk:3, def:1, hp:4, atkC:0, defC:0, hpC:1, text:"" },
  { id:"a14", tribe:"water", name:"샤크맨", cost:3, type:"minion", atk:3, def:1, hp:4, atkC:0, defC:0, hpC:1, text:"" },
  { id:"a15", tribe:"water", name:"손권", cost:3, type:"minion", atk:3, def:1, hp:4, atkC:0, defC:0, hpC:1, text:"" },
  { id:"a16", tribe:"water", name:"아이스골렘", cost:3, type:"minion", atk:1, def:2, hp:5, atkC:0, defC:1, hpC:1, text:"" },
  { id:"a17", tribe:"water", name:"물의 정령", cost:4, type:"minion", atk:4, def:1, hp:5, atkC:0, defC:0, hpC:1, text:"" },
  { id:"a18", tribe:"water", name:"세이렌", cost:4, type:"minion", atk:4, def:1, hp:5, atkC:0, defC:0, hpC:1, text:"" },
  { id:"a19", tribe:"water", name:"켈피", cost:4, type:"minion", atk:4, def:1, hp:5, atkC:0, defC:0, hpC:1, text:"" },
  { id:"a20", tribe:"water", name:"해마라이더", cost:4, type:"minion", atk:4, def:1, hp:5, atkC:0, defC:0, hpC:1, text:"" },
  { id:"a21", tribe:"water", name:"감녕", cost:5, type:"minion", atk:5, def:2, hp:6, atkC:1, defC:0, hpC:0, text:"" },
  { id:"a22", tribe:"water", name:"강가무녀", cost:5, type:"minion", atk:5, def:2, hp:6, atkC:1, defC:0, hpC:0, text:"" },
  { id:"a23", tribe:"water", name:"바다기사", cost:5, type:"minion", atk:5, def:2, hp:6, atkC:1, defC:0, hpC:0, text:"" },
  { id:"a24", tribe:"water", name:"심해상어", cost:5, type:"minion", atk:5, def:2, hp:6, atkC:1, defC:0, hpC:0, text:"" },
  { id:"a25", tribe:"water", name:"트롤", cost:5, type:"minion", atk:5, def:2, hp:6, atkC:1, defC:0, hpC:0, text:"" },
  { id:"a26", tribe:"water", name:"바다자이언트", cost:6, type:"minion", atk:4, def:4, hp:8, atkC:0, defC:0, hpC:2, text:"" },
  { id:"a27", tribe:"water", name:"크라켄", cost:6, type:"minion", atk:6, def:2, hp:7, atkC:1, defC:0, hpC:0, text:"" },
  { id:"a28", tribe:"water", name:"히드라", cost:6, type:"minion", atk:6, def:2, hp:7, atkC:1, defC:0, hpC:0, text:"" },
  { id:"a29", tribe:"water", name:"손책", cost:7, type:"minion", atk:7, def:2, hp:8, atkC:0, defC:0, hpC:1, text:"" },
  { id:"a30", tribe:"water", name:"시서펜트", cost:8, type:"minion", atk:8, def:3, hp:9, atkC:0, defC:0, hpC:1, text:"" },
  { id:"a31", tribe:"water", name:"주유", cost:8, type:"minion", atk:8, def:3, hp:9, atkC:0, defC:0, hpC:1, text:"" },
  { id:"a32", tribe:"water", name:"관우", cost:9, type:"minion", atk:9, def:3, hp:10, atkC:0, defC:0, hpC:1, text:"" },
  { id:"a33", tribe:"water", name:"아이스드래곤", cost:9, type:"minion", atk:9, def:3, hp:10, atkC:0, defC:0, hpC:1, text:"" },
  { id:"n1", tribe:"wind", name:"깃털도마뱀", cost:1, type:"minion", atk:1, def:0, hp:2, atkC:1, defC:0, hpC:0, text:"" },
  { id:"n2", tribe:"wind", name:"바람요정", cost:1, type:"minion", atk:1, def:0, hp:1, atkC:1, defC:0, hpC:0, text:"" },
  { id:"n3", tribe:"wind", name:"스프라이트", cost:1, type:"minion", atk:1, def:0, hp:2, atkC:1, defC:0, hpC:0, text:"" },
  { id:"n4", tribe:"wind", name:"픽시", cost:1, type:"minion", atk:1, def:0, hp:1, atkC:1, defC:0, hpC:0, text:"" },
  { id:"n5", tribe:"wind", name:"구름사슴", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"n6", tribe:"wind", name:"매사냥꾼", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"n7", tribe:"wind", name:"바람늑대", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"n8", tribe:"wind", name:"선풍무사", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"n9", tribe:"wind", name:"손상향", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"n10", tribe:"wind", name:"하피", cost:2, type:"minion", atk:2, def:0, hp:2, atkC:1, defC:0, hpC:0, text:"" },
  { id:"n11", tribe:"wind", name:"그리핀", cost:3, type:"minion", atk:3, def:1, hp:4, atkC:0, defC:0, hpC:1, text:"" },
  { id:"n12", tribe:"wind", name:"윈드골렘", cost:3, type:"minion", atk:1, def:2, hp:5, atkC:0, defC:1, hpC:1, text:"" },
  { id:"n13", tribe:"wind", name:"질풍기수", cost:3, type:"minion", atk:3, def:1, hp:4, atkC:0, defC:0, hpC:1, text:"" },
  { id:"n14", tribe:"wind", name:"폭풍창병", cost:3, type:"minion", atk:3, def:1, hp:4, atkC:0, defC:0, hpC:1, text:"" },
  { id:"n15", tribe:"wind", name:"회오리무희", cost:3, type:"minion", atk:3, def:1, hp:4, atkC:0, defC:0, hpC:1, text:"" },
  { id:"n16", tribe:"wind", name:"가루다", cost:4, type:"minion", atk:4, def:1, hp:5, atkC:0, defC:0, hpC:1, text:"" },
  { id:"n17", tribe:"wind", name:"바람의 정령", cost:4, type:"minion", atk:4, def:1, hp:5, atkC:0, defC:0, hpC:1, text:"" },
  { id:"n18", tribe:"wind", name:"창공기수", cost:4, type:"minion", atk:4, def:1, hp:5, atkC:0, defC:0, hpC:1, text:"" },
  { id:"n19", tribe:"wind", name:"페가수스", cost:4, type:"minion", atk:4, def:1, hp:5, atkC:0, defC:0, hpC:1, text:"" },
  { id:"n20", tribe:"wind", name:"호크라이더", cost:4, type:"minion", atk:4, def:1, hp:5, atkC:0, defC:0, hpC:1, text:"" },
  { id:"n21", tribe:"wind", name:"샤프슈터", cost:5, type:"minion", atk:5, def:0, hp:5, atkC:1, defC:0, hpC:0, text:"" },
  { id:"n22", tribe:"wind", name:"안량", cost:5, type:"minion", atk:5, def:2, hp:6, atkC:1, defC:0, hpC:0, text:"" },
  { id:"n23", tribe:"wind", name:"템페스트", cost:5, type:"minion", atk:5, def:2, hp:6, atkC:1, defC:0, hpC:0, text:"" },
  { id:"n24", tribe:"wind", name:"하늘도적", cost:5, type:"minion", atk:5, def:2, hp:6, atkC:1, defC:0, hpC:0, text:"" },
  { id:"n25", tribe:"wind", name:"썬더버드", cost:6, type:"minion", atk:6, def:2, hp:7, atkC:1, defC:0, hpC:0, text:"" },
  { id:"n26", tribe:"wind", name:"와이번", cost:6, type:"minion", atk:6, def:2, hp:7, atkC:1, defC:0, hpC:0, text:"" },
  { id:"n27", tribe:"wind", name:"태사자", cost:6, type:"minion", atk:6, def:2, hp:7, atkC:1, defC:0, hpC:0, text:"" },
  { id:"n28", tribe:"wind", name:"위자드", cost:7, type:"minion", atk:7, def:2, hp:8, atkC:0, defC:0, hpC:1, text:"" },
  { id:"n29", tribe:"wind", name:"지니", cost:7, type:"minion", atk:7, def:2, hp:8, atkC:0, defC:0, hpC:1, text:"" },
  { id:"n30", tribe:"wind", name:"폭풍자이언트", cost:7, type:"minion", atk:5, def:4, hp:9, atkC:0, defC:0, hpC:2, text:"" },
  { id:"n31", tribe:"wind", name:"육손", cost:8, type:"minion", atk:8, def:3, hp:9, atkC:0, defC:0, hpC:1, text:"" },
  { id:"n32", tribe:"wind", name:"조운", cost:9, type:"minion", atk:9, def:3, hp:10, atkC:0, defC:0, hpC:1, text:"" },
  { id:"n33", tribe:"wind", name:"폭풍드래곤", cost:9, type:"minion", atk:9, def:3, hp:10, atkC:0, defC:0, hpC:1, text:"" },
  { id:"l1", tribe:"light", name:"궁수", cost:1, type:"minion", atk:1, def:0, hp:2, atkC:1, defC:0, hpC:0, text:"" },
  { id:"l2", tribe:"light", name:"빛나방", cost:1, type:"minion", atk:1, def:0, hp:1, atkC:1, defC:0, hpC:0, text:"" },
  { id:"l3", tribe:"light", name:"창병", cost:1, type:"minion", atk:1, def:0, hp:2, atkC:1, defC:0, hpC:0, text:"" },
  { id:"l4", tribe:"light", name:"광명술사", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"l5", tribe:"light", name:"법정", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"l6", tribe:"light", name:"빛늑대", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"l7", tribe:"light", name:"성녀", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"l8", tribe:"light", name:"신관", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"l9", tribe:"light", name:"예언자", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"l10", tribe:"light", name:"태양창병", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"l11", tribe:"light", name:"골드골렘", cost:3, type:"minion", atk:1, def:2, hp:5, atkC:0, defC:1, hpC:1, text:"" },
  { id:"l12", tribe:"light", name:"성기사", cost:3, type:"minion", atk:3, def:1, hp:4, atkC:0, defC:0, hpC:1, text:"" },
  { id:"l13", tribe:"light", name:"성전사", cost:3, type:"minion", atk:3, def:1, hp:4, atkC:0, defC:0, hpC:1, text:"" },
  { id:"l14", tribe:"light", name:"수도사", cost:3, type:"minion", atk:3, def:1, hp:4, atkC:0, defC:0, hpC:1, text:"" },
  { id:"l15", tribe:"light", name:"인챈터", cost:3, type:"minion", atk:3, def:1, hp:4, atkC:0, defC:0, hpC:1, text:"" },
  { id:"l16", tribe:"light", name:"금빛사자", cost:4, type:"minion", atk:4, def:1, hp:5, atkC:0, defC:0, hpC:1, text:"" },
  { id:"l17", tribe:"light", name:"빛의기사단", cost:4, type:"minion", atk:4, def:1, hp:5, atkC:0, defC:0, hpC:1, text:"" },
  { id:"l18", tribe:"light", name:"십자군", cost:4, type:"minion", atk:4, def:1, hp:5, atkC:0, defC:0, hpC:1, text:"" },
  { id:"l19", tribe:"light", name:"유비", cost:4, type:"minion", atk:4, def:1, hp:5, atkC:0, defC:0, hpC:1, text:"" },
  { id:"l20", tribe:"light", name:"기병", cost:5, type:"minion", atk:5, def:2, hp:6, atkC:1, defC:0, hpC:0, text:"" },
  { id:"l21", tribe:"light", name:"발키리", cost:5, type:"minion", atk:5, def:2, hp:6, atkC:1, defC:0, hpC:0, text:"" },
  { id:"l22", tribe:"light", name:"빛의 정령", cost:5, type:"minion", atk:5, def:2, hp:6, atkC:1, defC:0, hpC:0, text:"" },
  { id:"l23", tribe:"light", name:"신전기사", cost:5, type:"minion", atk:5, def:2, hp:6, atkC:1, defC:0, hpC:0, text:"" },
  { id:"l24", tribe:"light", name:"유니콘", cost:5, type:"minion", atk:5, def:2, hp:6, atkC:1, defC:0, hpC:0, text:"" },
  { id:"l25", tribe:"light", name:"성령기사", cost:6, type:"minion", atk:6, def:2, hp:7, atkC:1, defC:0, hpC:0, text:"" },
  { id:"l26", tribe:"light", name:"심판관", cost:6, type:"minion", atk:6, def:2, hp:7, atkC:1, defC:0, hpC:0, text:"" },
  { id:"l27", tribe:"light", name:"엔젤", cost:6, type:"minion", atk:6, def:2, hp:7, atkC:1, defC:0, hpC:0, text:"" },
  { id:"l28", tribe:"light", name:"태양자이언트", cost:6, type:"minion", atk:4, def:4, hp:8, atkC:0, defC:0, hpC:2, text:"" },
  { id:"l29", tribe:"light", name:"강유", cost:7, type:"minion", atk:7, def:2, hp:8, atkC:0, defC:0, hpC:1, text:"" },
  { id:"l30", tribe:"light", name:"타이탄", cost:7, type:"minion", atk:5, def:4, hp:9, atkC:0, defC:0, hpC:2, text:"" },
  { id:"l31", tribe:"light", name:"골드드래곤", cost:8, type:"minion", atk:8, def:3, hp:9, atkC:0, defC:0, hpC:1, text:"" },
  { id:"l32", tribe:"light", name:"제갈량", cost:9, type:"minion", atk:9, def:3, hp:10, atkC:0, defC:0, hpC:1, text:"" },
  { id:"l33", tribe:"light", name:"황충", cost:9, type:"minion", atk:9, def:3, hp:10, atkC:0, defC:0, hpC:1, text:"" },
  { id:"d1", tribe:"dark", name:"로그", cost:1, type:"minion", atk:1, def:0, hp:1, atkC:1, defC:0, hpC:0, text:"" },
  { id:"d2", tribe:"dark", name:"시프", cost:1, type:"minion", atk:1, def:0, hp:1, atkC:1, defC:0, hpC:0, text:"" },
  { id:"d3", tribe:"dark", name:"트로그", cost:1, type:"minion", atk:1, def:0, hp:2, atkC:1, defC:0, hpC:0, text:"" },
  { id:"d4", tribe:"dark", name:"해골나방", cost:1, type:"minion", atk:1, def:0, hp:2, atkC:1, defC:0, hpC:0, text:"" },
  { id:"d5", tribe:"dark", name:"고스트", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"d6", tribe:"dark", name:"구울", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"d7", tribe:"dark", name:"다크조커", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"d8", tribe:"dark", name:"사형집행인", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"d9", tribe:"dark", name:"스켈레톤", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"d10", tribe:"dark", name:"워킹데드", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"d11", tribe:"dark", name:"초선", cost:2, type:"minion", atk:2, def:0, hp:3, atkC:1, defC:0, hpC:0, text:"" },
  { id:"d12", tribe:"dark", name:"다크골렘", cost:3, type:"minion", atk:1, def:2, hp:5, atkC:0, defC:1, hpC:1, text:"" },
  { id:"d13", tribe:"dark", name:"미라", cost:3, type:"minion", atk:3, def:1, hp:4, atkC:0, defC:0, hpC:1, text:"" },
  { id:"d14", tribe:"dark", name:"서큐버스", cost:3, type:"minion", atk:3, def:1, hp:4, atkC:0, defC:0, hpC:1, text:"" },
  { id:"d15", tribe:"dark", name:"나이트메어", cost:4, type:"minion", atk:4, def:1, hp:5, atkC:0, defC:0, hpC:1, text:"" },
  { id:"d16", tribe:"dark", name:"듀라한", cost:4, type:"minion", atk:4, def:1, hp:5, atkC:0, defC:0, hpC:1, text:"" },
  { id:"d17", tribe:"dark", name:"원소", cost:4, type:"minion", atk:4, def:1, hp:5, atkC:0, defC:0, hpC:1, text:"" },
  { id:"d18", tribe:"dark", name:"코카트리스", cost:4, type:"minion", atk:4, def:1, hp:5, atkC:0, defC:0, hpC:1, text:"" },
  { id:"d19", tribe:"dark", name:"흑표범", cost:4, type:"minion", atk:4, def:1, hp:5, atkC:0, defC:0, hpC:1, text:"" },
  { id:"d20", tribe:"dark", name:"가고일", cost:5, type:"minion", atk:3, def:3, hp:7, atkC:0, defC:0, hpC:1, text:"" },
  { id:"d21", tribe:"dark", name:"네크로맨서", cost:5, type:"minion", atk:5, def:2, hp:6, atkC:1, defC:0, hpC:0, text:"" },
  { id:"d22", tribe:"dark", name:"만티코어", cost:5, type:"minion", atk:5, def:2, hp:6, atkC:1, defC:0, hpC:0, text:"" },
  { id:"d23", tribe:"dark", name:"메두사", cost:5, type:"minion", atk:5, def:2, hp:6, atkC:1, defC:0, hpC:0, text:"" },
  { id:"d24", tribe:"dark", name:"암흑의 정령", cost:5, type:"minion", atk:5, def:2, hp:6, atkC:1, defC:0, hpC:0, text:"" },
  { id:"d25", tribe:"dark", name:"뱀파이어", cost:6, type:"minion", atk:6, def:2, hp:7, atkC:1, defC:0, hpC:0, text:"" },
  { id:"d26", tribe:"dark", name:"본맘모스", cost:6, type:"minion", atk:6, def:2, hp:7, atkC:1, defC:0, hpC:0, text:"" },
  { id:"d27", tribe:"dark", name:"암흑의기사단", cost:6, type:"minion", atk:6, def:2, hp:7, atkC:1, defC:0, hpC:0, text:"" },
  { id:"d28", tribe:"dark", name:"암흑자이언트", cost:6, type:"minion", atk:4, def:4, hp:8, atkC:0, defC:0, hpC:2, text:"" },
  { id:"d29", tribe:"dark", name:"장료", cost:6, type:"minion", atk:6, def:2, hp:7, atkC:1, defC:0, hpC:0, text:"" },
  { id:"d30", tribe:"dark", name:"리치", cost:7, type:"minion", atk:7, def:2, hp:8, atkC:0, defC:0, hpC:1, text:"" },
  { id:"d31", tribe:"dark", name:"블랙드래곤", cost:8, type:"minion", atk:8, def:3, hp:9, atkC:0, defC:0, hpC:1, text:"" },
  { id:"d32", tribe:"dark", name:"사마의", cost:9, type:"minion", atk:9, def:3, hp:10, atkC:0, defC:0, hpC:1, text:"" },
  { id:"d33", tribe:"dark", name:"여포", cost:9, type:"minion", atk:9, def:3, hp:10, atkC:0, defC:0, hpC:1, text:"" },
  // --- Spells (preserved; remapped ids if collided with overlay minions) ---
  { id:"e34", tribe:"earth", name:"토네이도", cost:4, type:"spell", text:"양쪽 전장의 비용 2 이하 하수인을 모두 파괴", rarity:"heroic", spell:{ type:"tornado" } },
  { id:"e35", tribe:"earth", name:"격파", cost:1, type:"spell", text:"아군 전체 공+1", rarity:"common", spell:{ type:"smash" } },
  { id:"e36", tribe:"earth", name:"낙석", cost:2, type:"spell", text:"적 하수인 전체에게 피해 2", rarity:"common", spell:{ type:"aoe_enemy", value:2 } },
  { id:"e37", tribe:"earth", name:"거인의힘", cost:1, type:"spell", text:"아군 전체 공+2", rarity:"common", spell:{ type:"giant_str" } },
  { id:"e38", tribe:"earth", name:"모래지옥", cost:2, type:"spell", text:"적 하수인 전체 공·방·체 -1", rarity:"rare", spell:{ type:"sandhell" } },
  { id:"e39", tribe:"earth", name:"석화", cost:3, type:"spell", text:"공 3 이하 적 하수인 공=0, 방+1", rarity:"rare", spell:{ type:"petrify" } },
  { id:"coin", name:"동전", cost:0, type:"spell", text:"이번 턴 마나 +1", spell:{ type:"mana", value:1 }, token:true },
  { id:"f34", tribe:"fire", name:"화염화살", cost:2, type:"spell", text:"대상에게 피해 3", spell:{ type:"dmg", value:3, target:"any_enemy" } },
  { id:"f35", tribe:"fire", name:"작열", cost:3, type:"spell", text:"적 하수인 전체 피해 1", spell:{ type:"aoe_enemy", value:1 } },
  { id:"f36", tribe:"fire", name:"화염구", cost:4, type:"spell", text:"대상에게 피해 6", spell:{ type:"dmg", value:6, target:"any_enemy" } },
  { id:"f37", tribe:"fire", name:"불꽃채찍", cost:1, type:"spell", text:"대상에게 피해 2", spell:{ type:"dmg", value:2, target:"any_enemy" } },
  { id:"f38", tribe:"fire", name:"지옥불꽃", cost:5, type:"spell", text:"적 전체 피해 2", spell:{ type:"aoe_all_enemy", value:2 } },
  { id:"f39", tribe:"fire", name:"탄환", cost:2, type:"spell", text:"하수인 하나 처치", spell:{ type:"kill", target:"any_minion" } },
  { id:"f40", tribe:"fire", name:"폭염", cost:3, type:"spell", text:"카드 2장 뽑기", spell:{ type:"draw", value:2 } },
  { id:"n34", tribe:"wind", name:"돌풍칼", cost:2, type:"spell", text:"대상에게 피해 3", spell:{ type:"dmg", value:3, target:"any_enemy" } },
  { id:"n35", tribe:"wind", name:"칼바람", cost:3, type:"spell", text:"적 하수인 전체 피해 1", spell:{ type:"aoe_enemy", value:1 } },
  { id:"n36", tribe:"wind", name:"바람망토", cost:2, type:"spell", text:"아군 하수인 +2/+1", spell:{ type:"buff", atk:2, hp:1, target:"own_minion" } },
  { id:"n37", tribe:"wind", name:"태풍", cost:4, type:"spell", text:"적 전체 피해 2", spell:{ type:"aoe_all_enemy", value:2 } },
  { id:"n38", tribe:"wind", name:"속삭임", cost:1, type:"spell", text:"카드 1장 뽑기", spell:{ type:"draw", value:1 } },
  { id:"n39", tribe:"wind", name:"진공베기", cost:5, type:"spell", text:"하수인 하나 처치", spell:{ type:"kill", target:"any_minion" } },
  { id:"n40", tribe:"wind", name:"상승기류", cost:3, type:"spell", text:"카드 2장 뽑기", spell:{ type:"draw", value:2 } },
  { id:"a34", tribe:"water", name:"치유의 샘", cost:1, type:"spell", text:"내 영웅 회복 3", spell:{ type:"heal_hero", value:3 } },
  { id:"a35", tribe:"water", name:"냉기화살", cost:2, type:"spell", text:"대상에게 피해 3", spell:{ type:"dmg", value:3, target:"any_enemy" } },
  { id:"a36", tribe:"water", name:"밀물", cost:3, type:"spell", text:"적 하수인 전체 피해 1", spell:{ type:"aoe_enemy", value:1 } },
  { id:"a37", tribe:"water", name:"해일", cost:4, type:"spell", text:"적 전체 피해 2", spell:{ type:"aoe_all_enemy", value:2 } },
  { id:"a38", tribe:"water", name:"물거울", cost:2, type:"spell", text:"아군 하수인 +1/+2", spell:{ type:"buff", atk:1, hp:2, target:"own_minion" } },
  { id:"a39", tribe:"water", name:"익사", cost:5, type:"spell", text:"하수인 하나 처치", spell:{ type:"kill", target:"any_minion" } },
  { id:"a40", tribe:"water", name:"물의 지혜", cost:3, type:"spell", text:"카드 2장 뽑기", spell:{ type:"draw", value:2 } },
  { id:"e41", tribe:"earth", name:"공중낙석", cost:3, type:"spell", text:"적 하수인 전체에게 피해 3", rarity:"rare", spell:{ type:"aoe_enemy", value:3 } },
  { id:"e42", tribe:"earth", name:"공중부유", cost:3, type:"spell", text:"양쪽 빈 칸 수만큼 모든 하수인 방어력 감소", rarity:"common", spell:{ type:"float_def" } },
  { id:"e43", tribe:"earth", name:"거인의봉인", cost:3, type:"spell", text:"체력 6 이상 적 하수인 공격력 0, 공격 코인 제거", rarity:"rare", spell:{ type:"seal_giant" } },
  { id:"e44", tribe:"earth", name:"떠오르는섬", cost:3, type:"spell", text:"내 빈 칸만큼 섬의파편(1/0/2)을 소환", rarity:"common", spell:{ type:"summon_islands" } },
  { id:"e45", tribe:"earth", name:"자력흡입", cost:2, type:"spell", text:"코인이 있는 적 하수인의 공·방을 0으로", rarity:"common", spell:{ type:"magnet" } },
  { id:"e46", tribe:"earth", name:"어스퀘이크", cost:6, type:"spell", text:"적 하수인 전체 체력을 내 최대 마나 절반(내림)만큼 감소", rarity:"legendary", spell:{ type:"earthquake" } },
  { id:"e47", tribe:"earth", name:"샌드트랩", cost:4, type:"spell", text:"내 빈 칸 수만큼 적 하수인에게 피해 3", rarity:"common", spell:{ type:"sandtrap" } },
  { id:"e48", tribe:"earth", name:"미로생성", cost:3, type:"spell", text:"내 최대 마나보다 비용이 높은 적 하수인을 모두 파괴", rarity:"heroic", spell:{ type:"maze" } },
  { id:"e49", tribe:"earth", name:"땅굴숨기", cost:1, type:"spell", text:"비용 2 이하 아군 공-2 방+3", rarity:"common", spell:{ type:"tunnel" } },
  { id:"l34", tribe:"light", name:"성광탄", cost:2, type:"spell", text:"대상에게 피해 2", spell:{ type:"dmg", value:2, target:"any_enemy" } },
  { id:"l35", tribe:"light", name:"치유의빛", cost:2, type:"spell", text:"내 영웅 회복 3", spell:{ type:"heal_hero", value:3 } },
  { id:"l36", tribe:"light", name:"심판", cost:4, type:"spell", text:"적에게 피해 4", spell:{ type:"dmg", value:4, target:"any_enemy" } },
  { id:"l37", tribe:"light", name:"축복", cost:1, type:"spell", text:"아군 영웅 회복 2", spell:{ type:"heal_hero", value:2 } },
  { id:"l38", tribe:"light", name:"정화", cost:3, type:"spell", text:"적에게 피해 3", spell:{ type:"dmg", value:3, target:"any_enemy" } },
  { id:"d34", tribe:"dark", name:"암흑화살", cost:2, type:"spell", text:"대상에게 피해 2", spell:{ type:"dmg", value:2, target:"any_enemy" } },
  { id:"d35", tribe:"dark", name:"저주", cost:3, type:"spell", text:"적에게 피해 3", spell:{ type:"dmg", value:3, target:"any_enemy" } },
  { id:"d36", tribe:"dark", name:"영혼흡수", cost:5, type:"spell", text:"적에게 피해 4", spell:{ type:"dmg", value:4, target:"any_enemy" } },
  { id:"d37", tribe:"dark", name:"파멸", cost:6, type:"spell", text:"적 전체 피해 2", spell:{ type:"aoe_all_enemy", value:2 } },
  // --- Tokens ---
  { id:"e40", tribe:"earth", name:"섬의파편", cost:1, type:"minion", atk:1, def:0, hp:2, atkC:0, defC:0, hpC:0, text:"토큰", token:true, rarity:"common" },
  { id:"recruit", tribe:"earth", name:"암석", cost:1, type:"minion", atk:0, def:0, hp:2, atkC:2, defC:2, hpC:2, text:"영웅 능력", token:true },
];

const SPELL_SCHOOL = { fire:"염술", wind:"풍술", water:"물술", light:"성술", dark:"암술", earth:"지술" };
const CARD_RACE = {"e1":"거인","e2":"벌레","e3":"짐승","e4":"짐승","e5":"짐승","e6":"짐승","e7":"부족","e8":"부족","e9":"부족","e10":"부족","e11":"정령","e12":"짐승","e13":"짐승","e14":"짐승","e15":"벌레","e16":"벌레","e17":"짐승","e18":"거인","e19":"정령","e20":"짐승","e21":"명장","e22":"장수","e23":"장수","e24":"장수","f1":"정령","f2":"짐승","f4":"짐승","f5":"부족","f7":"부족","f8":"부족","f10":"짐승","f11":"부족","f14":"거인","f15":"기수","f17":"짐승","f19":"거인","f20":"정령","f21":"명장","n1":"정령","n2":"짐승","n4":"기수","n5":"정령","n7":"기수","n9":"기수","n11":"짐승","n13":"부족","n15":"정령","n16":"기수","n17":"짐승","n19":"정령","n20":"정령","n21":"명장","a1":"정령","a2":"짐승","a4":"기수","a6":"짐승","a7":"기사","a9":"기사","a10":"짐승","a13":"기사","a15":"거인","a16":"정령","a17":"짐승","a19":"기사","a20":"기사","a21":"명장","l1":"벌레","l2":"짐승","l4":"기수","l7":"기사","l8":"기사","l10":"기사","l11":"짐승","l15":"거인","l17":"짐승","l21":"명장","d1":"벌레","d2":"짐승","d6":"해골","d11":"짐승","d13":"기사","d19":"해골","d21":"명장","e41":"장수","e42":"명장","e43":"장수","e44":"장수","f22":"장수","f23":"장수","f24":"장수","f25":"장수","n22":"장수","n23":"장수","n24":"장수","n25":"장수","a22":"장수","a23":"장수","a24":"장수","a25":"명장","l22":"장수","l23":"명장","l24":"장수","l25":"장수","d22":"장수","d23":"장수","d24":"명장","d25":"장수"};
const RACE_LORE = [
  ["거인","바위·용암·심해처럼 큰 몸. 한 걸음이면 땅이 흔들린다."],
  ["짐승","날개·발톱·이빨을 가진 생물."],
  ["벌레","땅속과 어둠에서 기어 나오는 벌레와 날벌레."],
  ["정령","속성 그 자체인 작은 영혼."],
  ["부족","황야에서 무기를 들고 사는 사람들."],
  ["기수","창과 말에 삶을 건 전사."],
  ["기사","성벽과 서약을 지키는 갑옷의 전사."],
  ["해골","무덤에서 일어난 뼈의 군대."],
  ["명장","역사에 이름이 남은 전설 장수."],
  ["장수","지금 이 땅을 지키는 살아 있는 장군."]
];

const COIN_PLUS = "assets/img/coins/plus.png";
const COIN_MINUS = "assets/img/coins/minus.png";
function parseCoin(v) {
  if (v == null || v === "") return 0;
  if (typeof v === "number" && isFinite(v)) return Math.max(-5, Math.min(5, v | 0));
  const s = String(v).trim();
  const neg = /^-/.test(s) || /−/.test(s) || /-\s*c/i.test(s);
  const nums = s.replace(/[xX×*]/g, " ").match(/-?\d+/g);
  if (!nums) return 0;
  let n = parseInt(nums[nums.length - 1], 10);
  if (/^-\d+$/.test(s)) n = parseInt(s, 10);
  if (neg && n > 0) n = -n;
  if (!isFinite(n)) return 0;
  return Math.max(-5, Math.min(5, n));
}
const EARTH_RARE = new Set([]); // overlay minions have no rarity flags; spells keep own rarity
const CARD_MAP = Object.fromEntries(CARDS.map(c => {
  c.atkC = parseCoin(c.atkC);
  c.defC = parseCoin(c.defC);
  c.hpC = parseCoin(c.hpC);
  if (!c.rarity) {
    if (c.tribe === "earth" && EARTH_RARE.has(c.id)) c.rarity = "rare";
    else c.rarity = "common";
  }
  return [c.id, c];
}));

const ART_FOCUS = {"e2":0.58,"e11":0.78,"e15":0.7,"e16":0.72,"e5":0.42,"e12":0.38,"e3":0.4,"e20":0.35,"f2":0.7,"f4":0.45,"f10":0.55,"f17":0.4,"n2":0.55,"n11":0.45,"a1":0.62,"a2":0.68,"a6":0.55,"a10":0.5,"a17":0.6};


const DECK_FRAMES = {
  earth: "assets/img/frames/unit/earth.png",
  fire: "assets/img/frames/unit/fire.jpg",
  wind: "assets/img/frames/unit/wind.jpg",
  water: "assets/img/frames/unit/water.jpg",
  light: "assets/img/frames/unit/light.jpg",
  dark: "assets/img/frames/unit/dark.jpg",
  metal: "assets/img/frames/unit/metal.jpg"
};

const SPELL_FRAMES = {
  earth: "assets/img/frames/rarity/earth_spell_common.png",
  metal: "assets/img/frames/spell/metal.webp",
  fire: "assets/img/frames/spell/fire.webp",
  wind: "assets/img/frames/spell/wind.webp",
  water: "assets/img/frames/spell/water.webp",
  light: "assets/img/frames/spell/light.webp",
  dark: "assets/img/frames/spell/dark.webp"
};
const CARD_TEMPLATE = '';
const BADGE_ART = {
  'mana': "assets/img/badges/mana.svg",
  'atk': "assets/img/badges/atk.svg",
  'def': "assets/img/badges/def.svg",
  'hp': "assets/img/badges/hp.svg",
};

const CARD_FACE = {"e1":"assets/img/faces/e1.jpg","e2":"assets/img/faces/e2.jpg","e3":"assets/img/faces/e3.jpg","e4":"assets/img/faces/e4.jpg","e5":"assets/img/faces/e5.jpg","e6":"assets/img/faces/e6.jpg","e7":"assets/img/faces/e7.jpg","e8":"assets/img/faces/e8.jpg","e9":"assets/img/faces/e9.jpg","e10":"assets/img/faces/e10.jpg","e11":"assets/img/faces/e11.jpg","e12":"assets/img/faces/e12.jpg","e13":"assets/img/faces/e13.jpg","e14":"assets/img/faces/e14.jpg","e15":"assets/img/faces/e15.jpg","e16":"assets/img/faces/e16.jpg","e17":"assets/img/faces/e17.jpg","e18":"assets/img/faces/e18.jpg","e19":"assets/img/faces/e19.jpg","e20":"assets/img/faces/e20.jpg","f1":"assets/img/faces/f1.jpg","f2":"assets/img/faces/f2.jpg","f3":"assets/img/faces/f3.jpg","f4":"assets/img/faces/f4.jpg","f5":"assets/img/faces/f5.jpg","f6":"assets/img/faces/f6.jpg","f7":"assets/img/faces/f7.jpg","f8":"assets/img/faces/f8.jpg","f9":"assets/img/faces/f9.jpg","f10":"assets/img/faces/f10.jpg","f11":"assets/img/faces/f11.jpg","f12":"assets/img/faces/f12.jpg","f13":"assets/img/faces/f13.jpg","f14":"assets/img/faces/f14.jpg","f15":"assets/img/faces/f15.jpg","f16":"assets/img/faces/f16.jpg","f17":"assets/img/faces/f17.jpg","f18":"assets/img/faces/f18.jpg","f19":"assets/img/faces/f19.jpg","f20":"assets/img/faces/f20.jpg","n1":"assets/img/faces/n1.jpg","n2":"assets/img/faces/n2.jpg","n3":"assets/img/faces/n3.jpg","n4":"assets/img/faces/n4.jpg","n5":"assets/img/faces/n5.jpg","n6":"assets/img/faces/n6.jpg","n7":"assets/img/faces/n7.jpg","n8":"assets/img/faces/n8.jpg","n9":"assets/img/faces/n9.jpg","n10":"assets/img/faces/n10.jpg","n11":"assets/img/faces/n11.jpg","n12":"assets/img/faces/n12.jpg","n13":"assets/img/faces/n13.jpg","n14":"assets/img/faces/n14.jpg","n15":"assets/img/faces/n15.jpg","n16":"assets/img/faces/n16.jpg","n17":"assets/img/faces/n17.jpg","n18":"assets/img/faces/n18.jpg","n19":"assets/img/faces/n19.jpg","n20":"assets/img/faces/n20.jpg","a1":"assets/img/faces/a1.jpg","a2":"assets/img/faces/a2.jpg","a3":"assets/img/faces/a3.jpg","a4":"assets/img/faces/a4.jpg","a5":"assets/img/faces/a5.jpg","a6":"assets/img/faces/a6.jpg","a7":"assets/img/faces/a7.jpg","a8":"assets/img/faces/a8.jpg","a9":"assets/img/faces/a9.jpg","a10":"assets/img/faces/a10.jpg","a11":"assets/img/faces/a11.jpg","a12":"assets/img/faces/a12.jpg","a13":"assets/img/faces/a13.jpg","a14":"assets/img/faces/a14.jpg","a15":"assets/img/faces/a15.jpg","a16":"assets/img/faces/a16.jpg","a17":"assets/img/faces/a17.jpg","a18":"assets/img/faces/a18.jpg","a19":"assets/img/faces/a19.jpg","a20":"assets/img/faces/a20.jpg","coin":"assets/img/faces/coin.jpg","recruit":"assets/img/faces/recruit.jpg","f34":"assets/img/faces/f3.jpg","f35":"assets/img/faces/f6.jpg","f36":"assets/img/faces/f9.jpg","f37":"assets/img/faces/f12.jpg","f38":"assets/img/faces/f13.jpg","f39":"assets/img/faces/f16.jpg","f40":"assets/img/faces/f18.jpg","n34":"assets/img/faces/n3.jpg","n35":"assets/img/faces/n6.jpg","n36":"assets/img/faces/n8.jpg","n37":"assets/img/faces/n10.jpg","n38":"assets/img/faces/n12.jpg","n39":"assets/img/faces/n14.jpg","n40":"assets/img/faces/n18.jpg","a34":"assets/img/faces/a3.jpg","a35":"assets/img/faces/a5.jpg","a36":"assets/img/faces/a8.jpg","a37":"assets/img/faces/a11.jpg","a38":"assets/img/faces/a12.jpg","a39":"assets/img/faces/a14.jpg","a40":"assets/img/faces/a18.jpg"};

const RARITY_FRAMES = {
  "earth|minion|common": "assets/img/frames/rarity/earth_minion_common.png",
  "earth|minion|rare": "assets/img/frames/rarity/earth_minion_rare.png",
  "earth|minion|heroic": "assets/img/frames/rarity/earth_minion_heroic.png",
  "earth|minion|legendary": "assets/img/frames/rarity/earth_minion_legendary.png",
  "earth|spell|common": "assets/img/frames/rarity/earth_spell_common.png",
  "earth|spell|rare": "assets/img/frames/rarity/earth_spell_rare.png",
  "earth|spell|heroic": "assets/img/frames/rarity/earth_spell_heroic.png",
  "earth|spell|legendary": "assets/img/frames/rarity/earth_spell_legendary.png"
};
function pickFrameUrl(c, tribe) {
  const rare = (c && c.rarity) || "common";
  const typ = (c && c.type === "spell") ? "spell" : "minion";
  const key = (tribe && tribe.id ? tribe.id : "earth") + "|" + typ + "|" + rare;
  if (typeof RARITY_FRAMES !== "undefined" && RARITY_FRAMES[key]) return RARITY_FRAMES[key];
  if (c && c.type === "spell" && typeof SPELL_FRAMES !== "undefined") return SPELL_FRAMES[tribe.id] || SPELL_FRAMES.earth;
  return (typeof DECK_FRAMES !== "undefined" && (DECK_FRAMES[tribe.id] || DECK_FRAMES.earth)) || "";
}
const CARD_ART = {"e41":"assets/img/art/e25.jpg","e42":"assets/img/art/e26.jpg","e43":"assets/img/art/e27.jpg","e44":"assets/img/art/e28.jpg","f22":"assets/img/art/f22.jpg","f23":"assets/img/art/f23.jpg","f24":"assets/img/art/f24.jpg","f25":"assets/img/art/f25.jpg","n22":"assets/img/art/n22.jpg","n23":"assets/img/art/n23.jpg","n24":"assets/img/art/n24.jpg","n25":"assets/img/art/n25.jpg","a22":"assets/img/art/a22.jpg","a23":"assets/img/art/a23.jpg","a24":"assets/img/art/a24.jpg","a25":"assets/img/art/a25.jpg","l22":"assets/img/art/l22.jpg","l23":"assets/img/art/l23.jpg","l24":"assets/img/art/l24.jpg","l25":"assets/img/art/l25.jpg","d22":"assets/img/art/d22.jpg","d23":"assets/img/art/d23.jpg","d24":"assets/img/art/d24.jpg","d25":"assets/img/art/d25.jpg","coin":"assets/img/coins/plus.png","e25":"assets/img/art/e25.jpg","e26":"assets/img/art/e26.jpg","e27":"assets/img/art/e27.jpg","e28":"assets/img/art/e28.jpg","e29":"assets/img/art/e29.jpg","e30":"assets/img/art/e30.jpg","e31":"assets/img/art/e31.jpg","e32":"assets/img/art/e32.jpg","e33":"assets/img/art/e33.jpg","e34":"assets/img/art/e34.jpg","e35":"assets/img/art/e35.jpg","e36":"assets/img/art/e36.jpg","e37":"assets/img/art/e37.jpg","e38":"assets/img/art/e38.jpg","e39":"assets/img/art/e39.jpg","e40":"assets/img/art/e28.jpg","e24":"assets/img/art/e24.jpg","e23":"assets/img/art/e23.jpg","e22":"assets/img/art/e22.jpg","d18":"assets/img/art/d18.jpg","d14":"assets/img/art/d14.jpg","d8":"assets/img/art/d8.jpg","d3":"assets/img/art/d3.jpg","l12":"assets/img/art/l12.jpg","l18":"assets/img/art/l18.jpg","l9":"assets/img/art/l9.jpg","l5":"assets/img/art/l5.jpg","l3":"assets/img/art/l3.jpg","a18":"assets/img/art/a18.jpg","a14":"assets/img/art/a14.jpg","a12":"assets/img/art/a12.jpg","a11":"assets/img/art/a11.jpg","a8":"assets/img/art/a8.jpg","a5":"assets/img/art/a5.jpg","a3":"assets/img/art/a3.jpg","n18":"assets/img/art/n18.jpg","n14":"assets/img/art/n14.jpg","n12":"assets/img/art/n12.jpg","n10":"assets/img/art/n10.jpg","n8":"assets/img/art/n8.jpg","n6":"assets/img/art/n6.jpg","n3":"assets/img/art/n3.jpg","f18":"assets/img/art/f18.jpg","f16":"assets/img/art/f16.jpg","f13":"assets/img/art/f13.jpg","f12":"assets/img/art/f12.jpg","f9":"assets/img/art/f9.jpg","f6":"assets/img/art/f6.jpg","f3":"assets/img/art/f3.jpg","e21":"assets/img/art/e21.jpg","a21":"assets/img/art/a21.jpg","f21":"assets/img/art/f21.jpg","n21":"assets/img/art/n21.jpg","l21":"assets/img/art/l21.jpg","d21":"assets/img/art/d21.jpg","e17":"assets/img/art/e17.jpg","e5":"assets/img/art/e5.jpg","n2":"assets/img/art/n2.jpg","a2":"assets/img/art/a2.jpg","f14":"assets/img/art/f14.jpg","l1":"assets/img/art/l1.jpg","l2":"assets/img/art/l2.jpg","l4":"assets/img/art/l4.jpg","l7":"assets/img/art/l7.jpg","l10":"assets/img/art/l10.jpg","l11":"assets/img/art/l11.jpg","l15":"assets/img/art/l15.jpg","l17":"assets/img/art/l17.jpg","d1":"assets/img/art/d1.jpg","d2":"assets/img/art/d2.jpg","d6":"assets/img/art/d6.jpg","d11":"assets/img/art/d11.jpg","d13":"assets/img/art/d13.jpg","d19":"assets/img/art/d19.jpg","e1":"assets/img/art/e1.jpg","e2":"assets/img/art/e2.jpg","e3":"assets/img/art/e3.jpg","e4":"assets/img/art/e4.jpg","e6":"assets/img/art/e6.jpg","e7":"assets/img/art/e7.jpg","e8":"assets/img/art/e8.jpg","e9":"assets/img/art/e9.jpg","e10":"assets/img/art/e10.jpg","e11":"assets/img/art/e11.jpg","e12":"assets/img/art/e12.jpg","e13":"assets/img/art/e13.jpg","e14":"assets/img/art/e14.jpg","e15":"assets/img/art/e15.jpg","e16":"assets/img/art/e16.jpg","e18":"assets/img/art/e18.jpg","e19":"assets/img/art/e19.jpg","e20":"assets/img/art/e20.jpg","f1":"assets/img/art/f1.jpg","f2":"assets/img/art/f2.jpg","f4":"assets/img/art/f4.jpg","f7":"assets/img/art/f7.jpg","f10":"assets/img/art/f10.jpg","f11":"assets/img/art/f11.jpg","f19":"assets/img/art/f19.jpg","f20":"assets/img/art/f20.jpg","n1":"assets/img/art/n1.jpg","n19":"assets/img/art/n19.jpg","a1":"assets/img/art/a1.jpg","a15":"assets/img/art/a15.jpg","a17":"assets/img/art/a17.jpg","f34":"assets/img/art/f3.jpg","f35":"assets/img/art/f6.jpg","f36":"assets/img/art/f9.jpg","f37":"assets/img/art/f12.jpg","f38":"assets/img/art/f13.jpg","f39":"assets/img/art/f16.jpg","f40":"assets/img/art/f18.jpg","n34":"assets/img/art/n3.jpg","n35":"assets/img/art/n6.jpg","n36":"assets/img/art/n8.jpg","n37":"assets/img/art/n10.jpg","n38":"assets/img/art/n12.jpg","n39":"assets/img/art/n14.jpg","n40":"assets/img/art/n18.jpg","a34":"assets/img/art/a3.jpg","a35":"assets/img/art/a5.jpg","a36":"assets/img/art/a8.jpg","a37":"assets/img/art/a11.jpg","a38":"assets/img/art/a12.jpg","a39":"assets/img/art/a14.jpg","a40":"assets/img/art/a18.jpg","e45":"assets/img/art/e29.jpg","e46":"assets/img/art/e30.jpg","e47":"assets/img/art/e31.jpg","e48":"assets/img/art/e32.jpg","e49":"assets/img/art/e33.jpg","l34":"assets/img/art/l3.jpg","l35":"assets/img/art/l5.jpg","l36":"assets/img/art/l9.jpg","l37":"assets/img/art/l18.jpg","l38":"assets/img/art/l12.jpg","d34":"assets/img/art/d3.jpg","d35":"assets/img/art/d8.jpg","d36":"assets/img/art/d14.jpg","d37":"assets/img/art/d18.jpg"};

let selectedHero = TRIBES.find(x => x.open);
let state = null;
let ui = { targeting: null, attacker: null, battling: false, rarityFilter: "all" };


const CARD_LORE = {"e34":"회오리는 가벼운 것부터 집어 올린다. 작은 목숨은 모래가 된다.","e35":"주먹을 모으면 방패도 돌이 된다. 한 번 내리치면 가죽이 아니라 뼈를 본다.","e36":"절벽은 언제나 무너질 준비를 한다. 작은 돌도 투구는 깬다.","e37":"거인의 숨이 가슴으로 들어온다. 주먹이 두 배로 무거워진다.","e38":"발이 빠지면 힘도, 가죽도, 숨도 같이 빠진다.","e39":"살았던 것이 돌이 되면 주먹은 멈추고 등만 단단해진다.","e40":"떠오른 섬에서 떨어진 한 조각. 작아도 땅은 땅이다.","e1":"바위 산맥이 걸어 다니기 시작했다. 발이 땅에 닿을 때마다 돌이 솟고, 주먹은 절벽이다. 한 번 자리를 잡으면 산이 된 것처럼 잘 움직이지 않는다.","e2":"사막 아래에 강처럼 긴 것이 산다. 모래가 갈라지면 입이 열리고, 그 입 안에는 또 사막이 있다.","e3":"닭의 머리와 뱀의 꼬리를 가진 짐승. 눈빛이 스치면 근육이 돌처럼 굳는다. 석화는 저주가 아니라 이 새의 숨결이다.","e4":"백 개의 눈을 가진 돌사자. 잠든 척하지만 모든 방향을 동시에 본다. 한 눈이 감겨도 아흔아홉이 남는다.","e5":"사자의 몸, 전갈의 꼬리. 사막의 왕좌를 가시로 지킨다. 독침이 땅에 꽂히면 모래가 끓는다.","e6":"보물상자로 위장한 황금 짐승. 뚜껑을 여는 손만 기다린다. 탐욕이 미끼고, 이빨이 덫이다.","e7":"가시만 남은 사람 꼴. 안으면 피가 난다. 그래서 아무도 안지 않고, 그 점이 이 자의 갑옷이다.","e8":"거친 언덕의 전사. 투박한 도끼와 더 투박한 맹세. 화려한 주문은 못 하지만 한 대는 정직하다.","e9":"모래를 등 위에 지고 달리는 멧돼지 인간. 돌진이 시작되면 제동은 없다.","e10":"늪이 사람으로 일어선 것. 발이 빠지는 곳이 이 자의 집이고, 집 전체가 무기이다.","e11":"모래 바람 속의 작은 정령. 작아서 무시당하지만, 눈에 들어가면 폭풍이 된다.","e12":"바위 절벽을 나는 날개 달린 도마뱀. 그림자가 땅을 덮으면 이미 늦다.","e13":"허리 아래가 뱀인 사막의 무희. 노래가 끝나면 뼈만 남는다.","e14":"낮에는 표범, 밤에도 표범. 사람 가죽은 축제 때나 입는다.","e15":"동굴 천장의 여덟 다리. 거미줄은 지도이고, 지도의 한가운데가 입이다.","e16":"백 마디가 따로 움직이는 모래 지네. 한 마디를 잘라내도 아흔아홉이 기어온다.","e17":"콜키스의 청동 황소. 콧구멍에서 증기가 나고, 발굽이 신전 기둥을 가루로 만든다. 돌진은 저주가 아니라 이 황소의 걸음이다.","e18":"머리가 둘인 거인. 한쪽이 잠들면 다른 쪽이 싸운다. 합의가 안 될 때는 둘 다 도끼를 든다.","e19":"모래가 사람 모양을 유지하는 동안만 산다. 바람이 거세면 흩어지고, 다시 모이면 또 싸운다.","e20":"사자의 몸에 사람의 얼굴을 한 수호자. 수수께끼를 못 맞히면 돌이 되고, 맞춰도 쉽게 길을 열어주지 않는다.","e21":"서량의 먼지를 먹고 자란 기병. 말발굽이 닿는 땅마다 바위가 창처럼 일어난다. 창과 갑옷을 함께 쓰는 서량의 화신.","e22":"대지 전선을 이끄는 장군. 창끝이 땅을 찍으면 병사들의 발도 굳어진다.","e23":"모래 바람을 읽는 여장군. 한 번의 손짓으로 전열이 다시 선다.","e24":"아직 어린 어깨에 갑옷을 맞춘 신예 장수. 작은 창이지만 흙을 가르는 힘은 분명하다.","f1":"난로에서 튀어나온 작은 불씨. 장난처럼 붙지만, 커튼을 만나면 진지해진다.","f2":"재 더미에서 태어난 쥐. 타다 남은 것을 먹고, 아직 안 탄 것을 찾아 다닌다.","f4":"꼬리가 횃불인 여우. 달릴 때마다 들판에 점이 찍힌다. 점이 이어지면 산불이다.","f5":"주먹이 식기 전에 휘두르는 용암. 한 대가 벽을 녹인다.","f7":"불꽃을 갑옷처럼 두른 전사. 다가가면 눈썹이 먼저 탄다.","f8":"마을을 약탈하고 지붕을 횃불로 남긴다. 남는 것은 재와 웃는 얼굴이다.","f10":"용암 강에서 나온 사냥개. 숨결이 쇳물을 말린다.","f11":"재를 점으로 읽는 주술사. 타버린 뼈로 미래를 말하고, 미래는 항상 뜨겁다.","f14":"화산이 거인으로 일어선 것. 한 걸음에 능선이 무너진다.","f15":"창끝에 태양을 꽂은 기사. 돌진하는 길이 곧 낙화다.","f17":"털 대신 재를 두른 늑대. 울음이 끝나면 숲이 검게 남는다.","f19":"돌과 불이 한 몸으로 굳은 골렘. 식으면 석상이고, 달아오르면 요새다.","f20":"가슴에 심장을 불로 갈아 넣은 자. 고동이 한 번 칠 때마다 전장이 밝아진다.","f21":"장판교의 고함이 불길이 된 장수. 창은 화산이고 갑옷은 거의 없다. 한 수가 전장을 태운다.","n1":"바람보다 가벼운 요정. 손바닥에 올려도 티끌만 남지만, 그 티끌이 폭풍의 씨앗이다.","n2":"깃털이 돛인 작은 도마뱀. 절벽에서 뛰어내려도 떨어지지 않는다. 떨어지는 것은 적이다.","n4":"매와 한 몸을 이룬 사냥꾼. 창보다 먼저 그림자가 내려앉는다.","n5":"회오리를 치마처럼 두른 무희. 한 바퀴 돌면 진형이 흩어진다.","n7":"말 대신 돌풍을 탄 기수. 지나간 자리의 깃발이 모두 반대쪽을 본다.","n9":"창에 태풍을 묶은 창병. 찌르지 않아도 적이 흔들린다.","n11":"구름을 발굽 삼아 달리는 사슴. 잡히려는 손에는 안개만 남는다.","n13":"하늘 길을 훔치는 도적. 발자국이 구름에만 찍힌다.","n15":"폭풍을 왕관으로 쓴 군주. 명령은 천둥이고, 신하는 비바람이다.","n16":"연에 올라탄 기사. 실이 끊기면 적이 떨어지고, 자신은 더 높이 간다.","n17":"울음이 바람인 늑대. 울음이 골짜기를 한 바퀴 돌면 사냥이 시작된다.","n19":"바람의 이름만 남은 정령. 만지면 손만 차갑고, 놓치면 집이 날아간다.","n20":"바람으로 짠 방패. 창을 받아내면 창이 방향을 잃는다.","n21":"장판의 창기병. 일곱 번 적진을 드나들어도 흰 갑옷의 먼지만 남을 뿐, 창끝은 늘 바람을 먼저 가른다.","a1":"물방울이 점액이 된 작은 생명. 밟으면 퍼지고, 퍼진 자리에서 다시 모인다.","a2":"개울 돌 위의 개구리. 울음이 비가 되고, 비가 되면 개울이 강이 된다.","a4":"파도를 창처럼 쓰는 병사. 한 번 찌르면 두 번째 파도가 따라온다.","a6":"투명한 우산 아래 독이 있다. 예쁜 것을 먼저 보고, 독은 나중에 본다.","a7":"강가에서 달을 부르는 무녀. 물이 차오르면 적의 발목이 먼저 잠긴다.","a9":"산호로 된 갑옷의 수호자. 산호초가 성벽이고, 성벽이 숨 쉰다.","a10":"심해에서 올라온 상어. 빛이 없는 곳에서 이빨만 빛난다.","a13":"파도를 망토로 두른 기사. 말이 없어도 물길이 길이 된다.","a15":"해구에서 일어난 거인. 한 손이 배를 집어 든다.","a16":"빗방울이 사람으로 모인 정령. 맑은 날에는 약하고, 장마에는 왕이다.","a17":"연못을 집으로 아는 거북. 등딱지가 방패고, 방패가 섬이다.","a19":"얼어붙은 강이 방패가 된 수호자. 녹을 때까지는 뚫리지 않는다.","a20":"조수를 읽는 술사. 밀물과 썰물을 한 손에 쥐고 전장을 흔든다.","a21":"의형제의 맹세를 강물에 새긴 장군. 청룡언월도가 물을 가르면 적의 기세가 썰물처럼 빠진다. 강이 제방을 지키듯, 관우는 전장의 한가운데를 지킨다.","l1":"햇살을 날개에 묻힌 나방. 어두운 곳에 앉으면 그곳이 잠시 낮이 된다.","l2":"뿔에 아침을 인 사슴. 숲이 길을 열고, 짐승들이 고개를 숙인다.","l4":"창끝에 정오를 단 창병. 찌르는 방향이 곧 동쪽이다.","l7":"흰 갑옷에 태양을 새긴 기사. 방패가 빛이면, 칼은 그 빛의 가장자리이다.","l8":"빛으로 짠 방패를 세운 자. 앞을 가리면 화살이 길을 잃고 무릎을 꿇는다.","l10":"날개로 아군을 가리는 천사. 그림자가 덮인 자는 한 번 더 일어선다.","l11":"갈기에 아침이 걸린 사자. 포효가 골짜기를 금빛으로 물들인다.","l15":"대리석과 태양이 한 몸이 된 골렘. 금이 간 자리에 빛이 맥동한다.","l17":"흰 털에 금빛 문양을 새긴 늑대. 눈 위를 달려도 발자국이 빛으로 남는다.","l21":"정오의 태양을 시위에 매는 노궁수. 갑옷은 얇아도 화살 한 대가 갑옷을 무시하고 들어간다. 빛은 숨기지 않는다.","d1":"달 없는 밤의 박쥐. 날개 소리가 들리면 이미 목덜미에 있다.","d2":"저주를 먹고 커진 쥐. 빨간 눈이 곡식보다 심장을 먼저 찾는다.","d6":"무덤에서 일어난 해골 병사. 명령은 잊었고, 베는 법만 기억한다.","d11":"정글 밤의 흑표범. 얼룩이 없어서 달빛도 이 짐승 위에서는 길을 잃는다.","d13":"성스러운 서약을 거꾸로 읽은 기사. 갑옷은 남고 빛은 빠져나갔다.","d19":"영혼을 촛불처럼 켜 두는 리치. 지팡이의 해골이 웃으면 전장에 겨울이 온다.","d21":"방천화극을 든 채 맹세를 갈아탄 무신. 창과 갑옷은 최상이나 마음은 얇다. 암흑은 힘을 빌려주고 충성은 빌려주지 않는다.","e41":"하늘이 갈라지고 산이 떨어진다. 독수리가 먼저 알고, 병사들은 나중에 안다.","e42":"땅이 제 무게를 잊으면 성도 떠오른다. 발밑이 비는 만큼 방어도 얇아진다.","e43":"거인을 묶는 사슬은 살이 아니라 이름을 묶는다. 힘이 있어도 주먹을 펼 수 없다.","e44":"바다 위로 섬이 솟는다. 빈 전장은 곧 새로운 땅이다.","f22":"호분. 주먹이 불덩이고 갑옷은 장식에 가깝다. 맞으면 뼈가 먼저 탄다.","f23":"창끝이 불꽃인 돌격장. 멈추는 법이 없어 적진이 재가 될 때까지 달린다.","f24":"독과 불을 같은 붓으로 쓰는 모사. 계책이 터지면 아군도 뜨겁고 적도 타버린다.","f25":"책을 태워 칼이 된 장수. 한때의 학문이 지금의 화염이다.","n22":"동오의 창기. 균형 잡힌 창과 방패로 바람처럼 서되, 흔들리지는 않는다.","n23":"하북의 호걸. 공·방·체가 한 줄로 선 창법. 과장 없는 한 수가 치명이다.","n24":"젊은 대도독. 작은 불씨로 적진 전체를 태우는 전체의 바람.","n25":"활시위에 바람을 매는 여장수. 화살보다 먼저 깃발이 기울어진다.","a22":"소패왕. 물결처럼 밀고 들어가도 방패는 강물처럼 남는다.","a23":"강동의 해적 장수. 갑옷보다 배짱이 두껍고, 창보다 물길이 길다.","a24":"적벽을 설계한 도독. 한 번의 광역공격이 강 위의 불길을 부른다.","a25":"강동을 지키는 군주. 칼보다 방패를 먼저 고르는 물의 왕.","l22":"촉의 후계 무인. 낮은 출발을 빛의 코인으로 끌어올린다.","l23":"인자한 군주. 베이스는 약해도 플러스만 쌓이면 전장이 밝아진다.","l24":"와룡. 부채 한 자락이 적진 전체를 가른다. 빛은 숨기지 않는다.","l25":"법과 계책의 씨앗. 작은 빛이 나중에 큰 해가 된다.","d22":"합비를 공포로 물들인 장수. 강한 몸으로 도박 판에 올라 창을 ±5로 흔든다.","d23":"미모가 함정인 무희. 베이스는 두툼하나 코인이 운명을 가른다.","d24":"사백만을 말한 군주. 강한 진영을 깔고도 한 번의 동전으로 무너질 수 있다.","d25":"죽은 척하며 판을 뒤집는 책사. 광역공격은 약해도 도박 코인이 전장을 기울인다.","f34":"시위에 불꽃을 매는 한 발. 맞은 자리는 검게 남고, 연기는 이름을 지운다.","f35":"하늘이 노을이 아니라 분노로 물드는 주문. 그늘이 없어진다.","f36":"손바닥에서 굴러가는 작은 태양. 던지면 커지고, 맞으면 밤이 된다.","f37":"채찍이 불꽃의 혀다. 한 번 휘두르면 세 곳이 동시에 운다.","f38":"땅속에서 올라온 지옥의 꽃. 향기가 아니라 비명으로 핀다.","f39":"작은 불덩이를 탄환처럼 쏜다. 한 발은 약해 보여도, 두 번째가 숨통이다.","f40":"한낮을 한순간에 정오로 만드는 폭염. 그늘을 찾는 자는 이미 늦다.","n34":"칼이 아니라 칼 모양의 돌풍. 베인 줄도 모르게 옷깃이 갈라진다.","n35":"칼날이 된 바람. 방향만 있고 손잡이는 없다.","n36":"망토가 방패인 자. 펼치면 화살이 길을 잃고, 접으면 칼이 된다.","n37":"하늘이 낮아지는 주문. 지붕이 먼저 항복한다.","n38":"귀에만 들리는 바람. 속삭임이 끝나면 칼이 이미 등 뒤에 있다.","n39":"공기를 베어 진공을 남기는 일격. 막으려는 방패가 먼저 풀려 나간다.","n40":"발밑을 들어 올리는 기류. 서 있던 자가 갑자기 하늘 손님이 된다.","a34":"상처에 손을 담그면 물이 피를 밀어낸다. 샘은 질문이 없고, 치유만 한다.","a35":"화살촉이 얼음인 한 발. 맞은 자리는 움직임을 잃는다.","a36":"썰물이 끝난 자리에 밀물이 밀고 들어온다. 이 주문은 그 밀물이다.","a37":"지평선이 일어서는 해일. 막으려는 방벽이 장난감이 된다.","a38":"물 위에 비친 자신을 찌르면, 진짜가 다친다. 거울은 공평하다.","a39":"허파에 물을 채우는 저주. 발은 땅에 있어도 숨은 바다에 있다.","a40":"물을 오래 바라본 자의 지혜. 물결 하나에 전장의 흐름이 보인다.","e45":"쇠와 돌이 제 자리를 버리고 한곳으로 빨려든다. 무기를 든 손은 빈손이 된다.","e46":"산맥이 허리를 꺾으면 골짜기가 생기고, 그 골짜기가 적을 삼킨다.","e47":"모래는 기다린다. 빈자리가 많을수록 손이 많이 올라온다.","e48":"미로는 강한 자를 가둔다. 지금 이 땅의 한계를 넘는 것들은 길을 잃는다.","e49":"작은 것들은 땅속으로 숨는다. 주먹은 약해져도 등은 돌이 된다.","l34":"손에서 터지는 작은 태양. 그림자가 숨을 곳이 없어진다.","l35":"상처 위에 내려앉는 빛. 피가 멈추고, 이름이 다시 또렷해진다.","l36":"죄의 무게를 재는 빛. 저울이 기울면 적이 먼저 쓰러진다.","l37":"짧게 스치는 축복. 숨이 한 칸 더 길어진다.","l38":"어둠을 씻어 내는 빛. 남은 것은 이름과 뼈다.","d34":"빛 없이 날아가는 화살. 맞은 자리에 구멍이 아니라 그늘이 남는다.","d35":"이름이 지워지는 말. 저주가 끝나면 적에게 내일의 몫이 없다.","d36":"적의 숨결을 빨아 자기 맥으로 넣는 주문. 한쪽이 옅어지면 다른 쪽이 진해진다.","d37":"이름이 파멸인 밤. 하늘이 닫히고, 남은 것은 발소리뿐이다."};
