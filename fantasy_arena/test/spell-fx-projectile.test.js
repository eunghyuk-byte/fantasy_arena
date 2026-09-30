// v0.352 fs1 화염화살: 발사체 스펠 공용 팩(meta.type="projectile") 스키마·용량·타이밍 확인
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const PACK = path.join(ROOT, "assets/vfx/spells/fs1");
const meta = JSON.parse(fs.readFileSync(path.join(PACK, "meta.json"), "utf8"));

test("fs1 팩: projectile 스키마 + 파일 존재", () => {
  assert.equal(meta.id, "fs1");
  assert.equal(meta.type, "projectile");
  assert.equal(meta.targetMode, "unit");
  for (const k of ["projectile", "impact", "sfx"]) {
    assert.ok(meta[k] && meta[k].file, k + ".file");
    assert.ok(fs.existsSync(path.join(PACK, meta[k].file)), meta[k].file + " 존재");
  }
  assert.equal(meta.projectile.frames, 15);
  assert.equal(meta.impact.frames, 18);
});

test("fs1 팩: 타격 350ms 동기 (비행 350ms, 임팩트 330ms 시작, 사운드 hit 350ms)", () => {
  assert.equal(meta.projectile.flightMs, 350);
  assert.equal(meta.sfx.hitAtMs, 350);
  assert.equal(meta.sfx.startMs, 0);
  assert.equal(meta.impact.startMs, 330);
  assert.equal(meta.impact.durationMs, 600);
});

test("fs1 팩: 에셋 총 용량 2MB 이하, 구 cast/impact 에셋 제거", () => {
  const total = fs.readdirSync(PACK).reduce((s, f) => s + fs.statSync(path.join(PACK, f)).size, 0);
  assert.ok(total <= 2 * 1024 * 1024, "total " + total);
  for (const old of ["cast.webp", "cast_strip.png", "impact.webp", "impact_strip.png"]) {
    assert.ok(!fs.existsSync(path.join(PACK, old)), old + " 제거");
  }
});

test("SpellFx: 발사체 공용 함수 노출 + 전장 전체 기준 시작점(화면 중앙)", () => {
  const src = fs.readFileSync(path.join(ROOT, "js/spell-fx.js"), "utf8");
  assert.match(src, /async function playProjectile\(stage, meta, base, to, opts\)/);
  assert.match(src, /playProjectile, preloadProjectile, isProjectileMeta/);
  assert.match(src, /function screenCenter\(\)/);
  const sfx = fs.readFileSync(path.join(ROOT, "js/sfx.js"), "utf8");
  assert.match(sfx, /loadUrl, playUrl/);
});

// v0.354 fs2 화염폭풍: overlay+perUnit 광역 팩 (양쪽 유닛)
test("fs2 팩: aoe_all · overlay+perUnit · 유닛별 지연식 · 2MB 이하", () => {
  const P2 = path.join(ROOT, "assets/vfx/spells/fs2");
  const m = JSON.parse(fs.readFileSync(path.join(P2, "meta.json"), "utf8"));
  assert.equal(m.id, "fs2");
  assert.equal(m.targetMode, "aoe_all", "양쪽 유닛 모두 (옛 aoe_enemy 아님)");
  assert.equal(m.playMode, "overlay+perUnit");
  assert.equal(m.overlay.layout, "vertical");
  assert.equal(m.overlay.frames, 20);
  assert.equal(m.overlay.durationMs, 833);
  assert.equal(m.unitImpact.durationMs, 500);
  assert.deepEqual(m.unitImpact.delay, { baseMs: 60, "perPx@1080p": 0.25, origin: "center" });
  // 기준 보드 지연값이 식과 일치 (임프 @(480,719) → 188ms)
  const d = 60 + 0.25 * Math.hypot(480 - 960, 719 - 540);
  assert.equal(Math.round(d), 188);
  for (const k of ["overlay", "unitImpact", "sfx"]) assert.ok(fs.existsSync(path.join(P2, m[k].file)), m[k].file);
  const total = fs.readdirSync(P2).reduce((s, f) => s + fs.statSync(path.join(P2, f)).size, 0);
  assert.ok(total <= 2 * 1024 * 1024, "total " + total);
  for (const old of ["cast.webp", "cast_strip.png", "aoe.webp", "aoe_strip.png"]) assert.ok(!fs.existsSync(path.join(P2, old)), old);
});

test("SpellFx: 광역 공용 함수(overlay+perUnit) + 세로 스트립 + 공용 캔버스 러너", () => {
  const src = fs.readFileSync(path.join(ROOT, "js/spell-fx.js"), "utf8");
  assert.match(src, /async function playOverlayPerUnit\(stage, meta, base, opts\)/);
  assert.match(src, /function runCanvasFx\(/);
  assert.match(src, /function aoeUnitPoints\(targetMode, casterIsMe\)/);
  assert.match(src, /vertical \? createImageBitmap\(full, 0, i \* h, w, h\)/);
});

// v0.355 fs3 화염구: fs1과 같은 projectile 팩 (컨셉 B 고리 화염구)
test("fs3 팩: projectile · 350ms 비행 · 타격 330~930ms · 2MB 이하", () => {
  const P3 = path.join(ROOT, "assets/vfx/spells/fs3");
  const m = JSON.parse(fs.readFileSync(path.join(P3, "meta.json"), "utf8"));
  assert.equal(m.id, "fs3");
  assert.equal(m.type, "projectile");
  assert.equal(m.targetMode, "unit");
  assert.equal(m.projectile.flightMs, 350);
  assert.equal(m.projectile.from, "center");
  assert.equal(m.projectile["displayLengthPx@1080p"], 440);
  assert.equal(m.impact.startMs, 330);
  assert.equal(m.impact.startMs + m.impact.durationMs, 930);
  assert.equal(m.impact["displayBoxPx@1080p"], 460);
  assert.equal(m.sfx.hitAtMs, 350);
  for (const k of ["projectile", "impact", "sfx"]) assert.ok(fs.existsSync(path.join(P3, m[k].file)), m[k].file);
  const total = fs.readdirSync(P3).reduce((s, f) => s + fs.statSync(path.join(P3, f)).size, 0);
  assert.ok(total <= 2 * 1024 * 1024, "total " + total);
  for (const old of ["cast.webp", "cast_strip.png", "impact.webp", "impact_strip.png"]) assert.ok(!fs.existsSync(path.join(P3, old)), old);
});

// v0.356 fs4 화염탄: projectile 팩 (컨셉 B 붕괴탄)
test("fs4 팩: projectile · 350ms 비행 · 타격 330~930ms · 2MB 이하", () => {
  const P4 = path.join(ROOT, "assets/vfx/spells/fs4");
  const m = JSON.parse(fs.readFileSync(path.join(P4, "meta.json"), "utf8"));
  assert.equal(m.id, "fs4");
  assert.equal(m.type, "projectile");
  assert.equal(m.targetMode, "unit");
  assert.equal(m.projectile.flightMs, 350);
  assert.equal(m.projectile.from, "center");
  assert.equal(m.projectile.headX, 0.975);
  assert.equal(m.projectile["displayLengthPx@1080p"], 420);
  assert.equal(m.impact.startMs, 330);
  assert.equal(m.impact.startMs + m.impact.durationMs, 930);
  assert.equal(m.impact["displayBoxPx@1080p"], 460);
  assert.equal(m.sfx.hitAtMs, 350);
  for (const k of ["projectile", "impact", "sfx"]) assert.ok(fs.existsSync(path.join(P4, m[k].file)), m[k].file);
  const total = fs.readdirSync(P4).reduce((s, f) => s + fs.statSync(path.join(P4, f)).size, 0);
  assert.ok(total <= 2 * 1000 * 1000, "total " + total);
  for (const old of ["cast.webp", "cast_strip.png", "impact.webp", "impact_strip.png"]) assert.ok(!fs.existsSync(path.join(P4, old)), old);
});

// v0.357 턴 시작 연출: 상대 턴 연출 삭제 · 내 턴 상단 문구 없음 · 첫 턴은 match_start 뒤
test("턴 시작 연출: turn_start_enemy 삭제, 내 턴만 문구 없이, 첫 턴은 match_start 뒤", () => {
  const src = fs.readFileSync(path.join(ROOT, "js/game.js"), "utf8");
  assert.doesNotMatch(src, /turn_start_enemy/);
  assert.match(src, /SpellFx\.playMatch\("turn_start_me", \{ label: "", dim: false \}\)/);
  assert.match(src, /beginTurn\(first, \{ noTurnFx: true \}\)/);
  const ms = src.indexOf('SpellFx.playMatch("match_start")');
  const after = src.indexOf("playTurnStartFx(first)");
  assert.ok(ms > 0 && after > ms, "첫 턴 연출은 match_start 뒤");
  assert.ok(!fs.existsSync(path.join(ROOT, "assets/vfx/match/turn_start_enemy")), "폴더 삭제");
  const fx = fs.readFileSync(path.join(ROOT, "js/spell-fx.js"), "utf8");
  assert.match(fx, /hasOwnProperty\.call\(opts, "label"\)/);
});

// v0.359 fs5 폭염: perUnit+flow (컨셉 B 불씨 낙인 → 손패로 발사체 → 도착)
test("fs5 팩: perUnit+flow · aoe_ally · 발사체 280ms · 도착 590~990ms · 2MB 이하", () => {
  const P5 = path.join(ROOT, "assets/vfx/spells/fs5");
  const m = JSON.parse(fs.readFileSync(path.join(P5, "meta.json"), "utf8"));
  assert.equal(m.id, "fs5");
  assert.equal(m.concept, "B");
  assert.equal(m.targetMode, "aoe_ally");
  assert.equal(m.playMode, "perUnit+flow");
  for (const k of ["unitImpact", "flow", "arrival", "sfx"]) {
    assert.ok(m[k] && m[k].file, k + ".file");
    assert.ok(fs.existsSync(path.join(P5, m[k].file)), m[k].file + " 존재");
  }
  assert.equal(m.flow.flightMs, 280);
  assert.equal(m.flow.startMs, 330);
  assert.equal(m.flow.plusUnitDelay, true);
  assert.equal(m.flow.to.selector, "#myHand");
  assert.equal(m.arrival.startMs, 590);
  assert.equal(m.arrival.durationMs, 400);
  assert.equal(m.unitImpact.delay.axis, "x");
  const total = fs.readdirSync(P5).reduce((s, f) => s + fs.statSync(path.join(P5, f)).size, 0);
  assert.ok(total <= 2 * 1024 * 1024, "total " + total);
  for (const old of ["cast.webp", "cast_strip.png", "aoe.webp", "aoe_strip.png", "preview.mp4"]) {
    assert.ok(!fs.existsSync(path.join(P5, old)), old + " 없음");
  }
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/manifest.json"), "utf8"));
  const inMan = man.items.filter(i => i.path.startsWith("assets/vfx/spells/fs5/")).map(i => i.path.split("/").pop()).sort();
  assert.deepEqual(inMan, fs.readdirSync(P5).sort());
  assert.equal(man.count, man.items.length);
});

test("SpellFx: perUnit+flow 공용 재생 모드 (flow를 overlay보다 먼저 판정, 가로 지연축, 유닛 없으면 발사체 2개)", () => {
  const src = fs.readFileSync(path.join(ROOT, "js/spell-fx.js"), "utf8");
  assert.match(src, /async function playPerUnitFlow\(stage, meta, base, opts\)/);
  assert.match(src, /playPerUnitFlow, preloadFlow, isFlowMeta/);
  assert.match(src, /!isFlowMeta\(meta\) && \(pm\.indexOf\("overlay"\)/, "perUnit+flow는 overlay 모드로 가지 않음");
  assert.match(src, /d\.axis === "x"/);
  assert.match(src, /opts\.emptyFlows \|\| 2/);
  assert.match(src, /#oppHand/, "상대 시전 시 상대 손패로");
});

// v0.360 fs6 광분: anchored (컨셉 C 영웅 기운 0~700ms → 소울 폭발 400~900ms)
test("fs6 팩: anchored · self · 영웅 기운 0~700ms · 소울 폭발 400~900ms · 2MB 이하", () => {
  const P6 = path.join(ROOT, "assets/vfx/spells/fs6");
  const m = JSON.parse(fs.readFileSync(path.join(P6, "meta.json"), "utf8"));
  assert.equal(m.id, "fs6");
  assert.equal(m.concept, "C");
  assert.equal(m.targetMode, "self");
  assert.equal(m.playMode, "anchored");
  const [hero, soul] = m.layers;
  assert.equal(hero.anchor.selector, ".hero-portrait.mine");
  assert.deepEqual([hero.startMs, hero.startMs + hero.durationMs], [0, 700]);
  assert.equal(soul.anchor.selector, "#mySoulGem");
  assert.equal(soul.anchor.opp, "#oppSoulGem");
  assert.deepEqual([soul.startMs, soul.startMs + soul.durationMs], [400, 900]);
  for (const f of [hero.file, soul.file, m.sfx.file]) assert.ok(fs.existsSync(path.join(P6, f)), f + " 존재");
  const total = fs.readdirSync(P6).reduce((s, f) => s + fs.statSync(path.join(P6, f)).size, 0);
  assert.ok(total <= 2 * 1024 * 1024, "total " + total);
  for (const old of ["cast.webp", "cast_strip.png", "impact.webp", "impact_strip.png", "preview.mp4"]) {
    assert.ok(!fs.existsSync(path.join(P6, old)), old + " 없음");
  }
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/manifest.json"), "utf8"));
  const inMan = man.items.filter(i => i.path.startsWith("assets/vfx/spells/fs6/")).map(i => i.path.split("/").pop()).sort();
  assert.deepEqual(inMan, fs.readdirSync(P6).sort());
  assert.equal(man.count, man.items.length);
});

test("SpellFx: anchored 공용 재생 모드 (시전자 선택자 · 상대면 opp 선택자/좌표 · 사운드)", () => {
  const src = fs.readFileSync(path.join(ROOT, "js/spell-fx.js"), "utf8");
  assert.match(src, /async function playAnchored\(stage, meta, base, opts\)/);
  assert.match(src, /playAnchored, preloadAnchored, isAnchoredMeta/);
  assert.match(src, /const sel = opp \? A\.opp : A\.selector;/);
  assert.match(src, /oppFallbackPx@1080p/);
  assert.match(src, /if \(isAnchoredMeta\(meta\)\) return playAnchored\(stage, meta, base, opts\);/);
});

// v0.361 fs7 화염방패: projectile 팩 (컨셉 A 태양 방패, fs3·fs4와 같은 playProjectile)
test("fs7 팩: projectile · 화면 중앙→대상 350ms · 버프 330~930ms · 2MB 이하", () => {
  const P7 = path.join(ROOT, "assets/vfx/spells/fs7");
  const m = JSON.parse(fs.readFileSync(path.join(P7, "meta.json"), "utf8"));
  assert.equal(m.id, "fs7");
  assert.equal(m.concept, "A");
  assert.equal(m.type, "projectile");
  assert.equal(m.targetMode, "unit");
  assert.equal(m.projectile.from, "center");
  assert.equal(m.projectile.flightMs, 350);
  assert.equal(m.impact.startMs, 330);
  assert.equal(m.impact.durationMs, 600);
  assert.equal(m.sfx.hitAtMs, 350);
  for (const k of ["projectile", "impact", "sfx"]) assert.ok(fs.existsSync(path.join(P7, m[k].file)), m[k].file + " 존재");
  const total = fs.readdirSync(P7).reduce((s, f) => s + fs.statSync(path.join(P7, f)).size, 0);
  assert.ok(total <= 2 * 1024 * 1024, "total " + total);
  for (const old of ["cast.webp", "cast_strip.png", "impact.webp", "impact_strip.png", "preview.mp4"]) {
    assert.ok(!fs.existsSync(path.join(P7, old)), old + " 없음");
  }
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/manifest.json"), "utf8"));
  const inMan = man.items.filter(i => i.path.startsWith("assets/vfx/spells/fs7/")).map(i => i.path.split("/").pop()).sort();
  assert.deepEqual(inMan, fs.readdirSync(P7).sort());
});

// v0.362 fs8 메테오: overlay+perUnit (aoe_all) + screenShake → #game quake
test("fs8 팩: aoe_all · overlay+perUnit · 흔들림 260~610ms · 2MB 이하", () => {
  const P8 = path.join(ROOT, "assets/vfx/spells/fs8");
  const m = JSON.parse(fs.readFileSync(path.join(P8, "meta.json"), "utf8"));
  assert.equal(m.id, "fs8");
  assert.equal(m.concept, "A");
  assert.equal(m.targetMode, "aoe_all");
  assert.equal(m.playMode, "overlay+perUnit");
  assert.equal(m.overlay.frames, 22);
  assert.equal(m.overlay.durationMs, 917);
  assert.deepEqual(m.unitImpact.delay, { baseMs: 250, "perPx@1080p": 0.08, origin: "center" });
  assert.deepEqual([m.screenShake.startMs, m.screenShake.durationMs, m.screenShake["amplitudePx@1080p"]], [260, 350, 10]);
  for (const k of ["overlay", "unitImpact", "sfx"]) assert.ok(fs.existsSync(path.join(P8, m[k].file)), m[k].file + " 존재");
  const total = fs.readdirSync(P8).reduce((s, f) => s + fs.statSync(path.join(P8, f)).size, 0);
  assert.ok(total <= 2 * 1024 * 1024, "total " + total);
  for (const old of ["cast.webp", "cast_strip.png", "aoe.webp", "aoe_strip.png", "preview.mp4"]) {
    assert.ok(!fs.existsSync(path.join(P8, old)), old + " 없음");
  }
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/manifest.json"), "utf8"));
  const inMan = man.items.filter(i => i.path.startsWith("assets/vfx/spells/fs8/")).map(i => i.path.split("/").pop()).sort();
  assert.deepEqual(inMan, fs.readdirSync(P8).sort());
});

test("SpellFx: meta.screenShake → 보드 #game 기존 quake 클래스 (길이·세기 CSS 변수)", () => {
  const src = fs.readFileSync(path.join(ROOT, "js/spell-fx.js"), "utf8");
  assert.match(src, /function startScreenShake\(S\)/);
  assert.match(src, /if \(meta && meta\.screenShake && !opts\.shake\)/);
  assert.match(src, /game\.classList\.add\("quake"\)/);
  const css = fs.readFileSync(path.join(ROOT, "css/game.css"), "utf8");
  assert.match(css, /#game\.quake \{ animation: boardQuake var\(--quake-dur, 1\.4s\)/);
  assert.match(css, /var\(--quake-k, 1\)/);
});
