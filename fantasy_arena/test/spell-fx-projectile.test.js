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
  assert.match(src, /SpellFx\.playMatch\("turn_start_me", \{ label: "" \}\)/);
  assert.match(src, /beginTurn\(first, \{ noTurnFx: true \}\)/);
  const ms = src.indexOf('SpellFx.playMatch("match_start")');
  const after = src.indexOf("playTurnStartFx(first)");
  assert.ok(ms > 0 && after > ms, "첫 턴 연출은 match_start 뒤");
  assert.ok(!fs.existsSync(path.join(ROOT, "assets/vfx/match/turn_start_enemy")), "폴더 삭제");
  const fx = fs.readFileSync(path.join(ROOT, "js/spell-fx.js"), "utf8");
  assert.match(fx, /hasOwnProperty\.call\(opts, "label"\)/);
});
