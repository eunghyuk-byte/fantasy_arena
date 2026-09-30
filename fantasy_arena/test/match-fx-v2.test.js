// v0.364 매치 연출 v2: match_start(A_final)·turn_start_me(B_final) 알파 비디오 팩 + 공용 dim 레이어
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const MATCH = path.join(ROOT, "assets/vfx/match");
const SRC = fs.readFileSync(path.join(ROOT, "js/spell-fx.js"), "utf8");
const readMeta = (id) => JSON.parse(fs.readFileSync(path.join(MATCH, id, "meta.json"), "utf8"));

// resolveDim 등 순수 함수만 떼어서 평가 (DOM 불필요)
function loadDimFns() {
  const a = SRC.indexOf("  const DIM_DEFAULT_OPACITY");
  const b = SRC.indexOf("  /** Safari: VP9");
  assert.ok(a > 0 && b > a, "dim 블록 존재");
  return new Function(SRC.slice(a, b) + "\nreturn { resolveDim, isVideoPackMeta, packFadeOutWindow };")();
}

test("match_start·turn_start_me·victory·defeat: v2 비디오 팩 파일 + 구 스트립 제거", () => {
  for (const [id, dur, fo] of [["match_start", 2000, [1500, 1983]], ["turn_start_me", 800, [500, 783]],
    ["victory", 1800, [1350, 1783]], ["defeat", 1800, [1350, 1783]]]) {
    const m = readMeta(id);
    assert.equal(m.durationMs, dur, id + " durationMs");
    assert.equal(m.fps, 60);
    assert.equal(m.frames, dur * 60 / 1000, id + " frames");
    assert.equal(m.overlay.file, "overlay.webm");
    assert.equal(m.overlay.width, 1920);
    assert.equal(m.overlay.height, 1080);
    assert.deepEqual([m.fadeOut.startMs, m.fadeOut.endMs], fo, id + " fadeOut");
    for (const f of ["overlay.webm", "overlay_safari.webp", "sfx.ogg", "sfx.mp3", "meta.json"]) {
      assert.ok(fs.existsSync(path.join(MATCH, id, f)), id + "/" + f);
    }
    assert.equal(fs.statSync(path.join(MATCH, id, "overlay.webm")).size, m.overlay.bytes, id + " webm bytes");
    for (const old of ["cast.webp", "cast_strip.png", "impact.webp", "impact_strip.png", "preview.mp4", "final_sheet.png"]) {
      assert.ok(!fs.existsSync(path.join(MATCH, id, old)), id + "/" + old + " 없음");
    }
  }
});

test("manifest: 매치 v2 파일 등록·구 파일 제거·count 일치", () => {
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/manifest.json"), "utf8"));
  assert.equal(man.count, man.items.length);
  const paths = new Set(man.items.map(i => i.path));
  for (const id of ["match_start", "turn_start_me", "victory", "defeat"]) {
    for (const f of fs.readdirSync(path.join(MATCH, id))) {
      const p = "assets/vfx/match/" + id + "/" + f;
      assert.ok(paths.has(p), p);
      assert.equal(man.items.find(i => i.path === p).bytes, fs.statSync(path.join(MATCH, id, f)).size, p + " bytes");
    }
    assert.ok(!paths.has("assets/vfx/match/" + id + "/cast_strip.png"));
  }
});

test("dim: match_start(2초판)는 meta 값(0.6, 0→180ms, 1500→2000ms 페이드아웃)", () => {
  const { resolveDim, isVideoPackMeta } = loadDimFns();
  const m = readMeta("match_start");
  assert.ok(isVideoPackMeta(m));
  const d = resolveDim("match_start", m);
  assert.equal(d.opacity, 0.6);
  assert.equal(d.fromMeta, true);
  assert.deepEqual([d.fadeInStartMs, d.fadeInEndMs, d.fadeOutStartMs, d.fadeOutEndMs], [0, 180, 1500, 2000]);
  assert.equal(d.hold, false);
});

test("dim: MY TURN explicit metadata off preserves no dim", () => {
  const { resolveDim } = loadDimFns();
  assert.equal(resolveDim("turn_start_me", readMeta("turn_start_me")), null);
  for (const dim of [false, 0, {enabled:false,opacity:0.4}, {doInCode:false,opacity:0.4}, {opacity:0}]) assert.equal(resolveDim("turn_start_me", {dim}), null);
  for (const opts of [{dim:false},{dim:0},{dimOpacity:0}]) assert.equal(resolveDim("turn_start_me", {}, opts), null);
  assert.equal(resolveDim("turn_start_me", {}).opacity, 0.3);
});

test("dim: 승리·패배 v2는 meta 값(0.4, 페이드인 250/350ms, 1350→1800ms 페이드아웃, 유지 안 함)", () => {
  const { resolveDim } = loadDimFns();
  for (const [id, fin] of [["victory", 250], ["defeat", 350]]) {
    const m = readMeta(id);
    const d = resolveDim(id, m);
    assert.equal(d.opacity, 0.4, id);
    assert.equal(d.fromMeta, true);
    assert.deepEqual([d.fadeInStartMs, d.fadeInEndMs, d.fadeOutStartMs, d.fadeOutEndMs], [0, fin, 1350, 1800], id);
    assert.equal(d.hold, false, id + " 연출 끝나면 dim 해제 → 결과 화면");
  }
  assert.equal(readMeta("defeat").lastFrameAlphaMax, 2, "DEFEAT 마지막 프레임 알파 2/255 → 코드에서 제거");
  assert.match(SRC, /meta\.lastFrameAlphaMax >= 128/);
});

test("dim: 기본 0.4, meta dim 없는 구형 승리·패배는 결과 화면까지 유지(hold), meta.dim.fadeOut:null도 hold", () => {
  const { resolveDim } = loadDimFns();
  const plain = { durationMs: 1000, fadeOut: { startMs: 700, endMs: 980 } };
  const d = resolveDim("some_match_fx", plain);
  assert.equal(d.opacity, 0.4);
  assert.deepEqual([d.fadeInEndMs, d.fadeOutStartMs, d.fadeOutEndMs], [150, 700, 980]);
  for (const id of ["victory", "defeat"]) {
    const v = resolveDim(id, { durationMs: 1500 });
    assert.equal(v.opacity, 0.4);
    assert.equal(v.hold, true);
    assert.equal(v.fadeOutStartMs, null);
  }
  // 나중에 victory_v2/A_final 형식이 들어와도 그대로 (dim 0.6, 0→250ms, fadeOut null → 유지)
  const v2 = resolveDim("victory", { durationMs: 1500, overlay: { file: "overlay.webm" },
    dim: { doInCode: true, opacity: 0.6, fadeIn: { startMs: 0, endMs: 250 }, fadeOut: null } });
  assert.equal(v2.opacity, 0.6);
  assert.equal(v2.fadeInEndMs, 250);
  assert.equal(v2.hold, true);
  assert.equal(resolveDim("match_start", readMeta("match_start"), { dim: false }), null);
});

test("SpellFx: 비디오 모드·dim 레이어·Safari 폴백·결과 화면 해제 연결", () => {
  assert.match(SRC, /if \(isVideoPackMeta\(meta\)\) return _playVideoPack\(kind, id, meta, base, opts\);/);
  assert.match(SRC, /v\.muted = true;/);
  assert.match(SRC, /v\.playsInline = true;/);
  assert.match(SRC, /canPlayType\('video\/webm; codecs="vp09\.00\.10\.08"'\)/);
  assert.match(SRC, /overlay_safari\.webp/);
  assert.match(SRC, /resolveDim, releaseDim, preloadMatch, matchDurationMs, isVideoPackMeta, needsSafariFallback/);
  const css = fs.readFileSync(path.join(ROOT, "css/game.css"), "utf8");
  const block = css.slice(css.indexOf("#matchFx {"), css.indexOf("#matchFx .mfx-overlay"));
  assert.match(block, /pointer-events: none/);
  assert.match(block, /z-index: 79/, "#spellFx(80) 아래·전장 위");
  assert.match(css, /#matchFx\.held \{ z-index: 19; \}/, "결과 모달(20) 아래에서 유지");
  const combat = fs.readFileSync(path.join(ROOT, "js/combat.js"), "utf8");
  assert.match(combat, /SpellFx\.releaseDim\(\)/);
  // 결과 화면은 승리·패배 연출이 끝난 뒤 (최대 3.2s 대기)
  const fin = combat.slice(combat.indexOf("function finish(winner)"), combat.indexOf("function clearDrag()"));
  // v0.372: 다른 매치 연출이 끝난 뒤 재생, 결과 화면은 연출이 완전히 끝난 뒤(상한 = 길이 + 2초)
  assert.match(fin, /const fxId = winner === "나" \? "victory" : "defeat";/);
  assert.match(fin, /SpellFx\.playMatch\(fxId, \{ skipQueue: true \}\)/);
  assert.match(fin, /setTimeout\(r, \(durMs \|\| 1800\) \+ 2000\)/);
  assert.match(fin, /fxP\.then\(showResult, showResult\)/);
  const game = fs.readFileSync(path.join(ROOT, "js/game.js"), "utf8");
  assert.match(game, /SpellFx\.playMatch\("match_start"\)/);
  assert.match(game, /SpellFx\.playMatch\("turn_start_me", \{ label: "" \}\)/);
});

// v0.366: MATCH START 2초판 — 대기값은 meta 기반, 타이틀에서 미리 로드(첫 판 지연 제거)
test("match_start 2초판: 고정 1.5초 대기 없음 · meta durationMs 기반 · 미리 로드", () => {
  const game = fs.readFileSync(path.join(ROOT, "js/game.js"), "utf8");
  const sg = game.slice(game.indexOf("function startGame("), game.indexOf("const SOUL_DRAW_COST"));
  assert.doesNotMatch(sg, /setTimeout\(r, (1500|2200|2600)\)/, "고정 대기값 제거");
  assert.match(sg, /SpellFx\.matchDurationMs\("match_start"\)/);
  assert.match(sg, /\(startMs \|\| 2000\) \+ 1100/);
  assert.match(SRC, /const _readyVideo = \{\};/);
  assert.match(SRC, /SpellFx\.preloadMatch\("match_start"\); SpellFx\.preloadMatch\("turn_start_me"\);/);
  assert.match(SRC, /matchDurationMs, isVideoPackMeta/);
  const M = path.join(MATCH, "match_start");
  assert.equal(fs.statSync(path.join(M, "overlay.webm")).size, readMeta("match_start").overlay.bytes);
});

// v0.367: 매치 오버레이 0.85 축소(중앙 기준), dim은 전체 화면
test("매치 오버레이 scale 0.72 (비디오·Safari 폴백 공통 .mfx-overlay), dim은 inset:0 그대로", () => {
  const css = fs.readFileSync(path.join(ROOT, "css/game.css"), "utf8");
  const ov = css.slice(css.indexOf("#matchFx .mfx-overlay {"));
  const blk = ov.slice(0, ov.indexOf("}"));
  assert.match(blk, /transform: translate\(-50%, -50%\) scale\(var\(--mfx-scale, 0\.72\)\);/);
  assert.match(blk, /transform-origin: 50% 50%;/);
  const dim = css.slice(css.indexOf("#matchFx .mfx-dim {"));
  assert.match(dim.slice(0, dim.indexOf("}")), /inset: 0/);
  assert.doesNotMatch(dim.slice(0, dim.indexOf("}")), /scale/);
  assert.equal((SRC.match(/className = "mfx-overlay"/g) || []).length, 2, "video·img 둘 다 같은 클래스");
});
