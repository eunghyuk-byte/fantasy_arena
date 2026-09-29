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
