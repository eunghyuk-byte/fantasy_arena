const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/render.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../css/game.css'), 'utf8');

function declaration(name) {
  const start = source.indexOf('function ' + name + '(');
  const end = source.indexOf('\n}', start) + 2;
  return source.slice(start, end);
}
function rect(left, top, width, height) { return { left, top, width, height, right: left + width, bottom: top + height }; }
function element(bounds) {
  const style = { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } };
  return { style, getBoundingClientRect: () => bounds, querySelector: () => null };
}
function layout(width, height, zoom = 1.15) {
  const art = rect(width * (1 - zoom) / 2, height * (1 - zoom) / 2, width * zoom, height * zoom);
  const bg = { naturalWidth: 3840, naturalHeight: 2160, offsetWidth: width, getBoundingClientRect: () => art };
  const main = element(rect(10, 20, width - 20, height - 40));
  const hud = element(rect(0, 0, width, height));
  const ids = { boardBgLayer: bg, mySoulGem: element(), oppSoulGem: element() };
  const sels = { '#game.active .col-main': main, '#game.active .col-hud': hud };
  for (const side of ['my', 'opp']) {
    const slot = element(rect(1550, side === 'my' ? 600 : 200, 90, 115));
    const hp = element(); hp.closest = () => slot;
    sels['#' + side + 'Strip .hero-hp'] = hp;
  }
  const ctx = { document: { getElementById: id => ids[id], querySelector: sel => sels[sel] }, getComputedStyle: () => ({ fontSize: '20' }) };
  vm.createContext(ctx);
  for (const name of ['boardCoreBox', 'boardZoom', 'layoutHudGems']) vm.runInContext(declaration(name), ctx);
  ctx.layoutHudGems();
  const center = (el, parent) => ({ x: parent.left + parseFloat(el.style.left) + parseFloat(el.style.width) / 2, y: parent.top + parseFloat(el.style.top) + parseFloat(el.style.height) / 2 });
  return { art, ids, sels, center, main: main.getBoundingClientRect() };
}

for (const [width, height] of [[1920, 1080], [1280, 720], [2560, 1440]]) {
  test(`HUD numbers track artwork centers at ${width}×${height}`, () => {
    const r = layout(width, height);
    // Measured centers in the checked-in 3840×2160 board art, independent of layout code.
    for (const [id, x, y] of [['oppSoulGem', 2812, 200], ['mySoulGem', 2812, 1813]]) {
      const actual = r.center(r.ids[id], r.main);
      assert.ok(Math.abs(actual.x - (r.art.left + x * r.art.width / 3840)) < 0.01, `${id} horizontal center`);
      assert.ok(Math.abs(actual.y - (r.art.top + y * r.art.height / 2160)) < 0.01, `${id} vertical center`);
      assert.equal(parseFloat(r.ids[id].style['font-size']), Number((r.art.height * 40 / 2160).toFixed(2)), `${id} font follows artwork scale`);
    }
    for (const [side, x, y] of [['opp', 3264, 774], ['my', 3260, 1552]]) {
      const el = r.sels['#' + side + 'Strip .hero-hp'];
      const actual = r.center(el, el.closest().getBoundingClientRect());
      assert.ok(Math.abs(actual.x - (r.art.left + x * r.art.width / 3840)) < 0.01, `${side} HP horizontal center`);
      assert.ok(Math.abs(actual.y - (r.art.top + y * r.art.height / 2160)) < 0.01, `${side} HP vertical center`);
      assert.equal(parseFloat(el.style['font-size']), Number((r.art.height * 40 / 2160).toFixed(2)), `${side} HP font follows artwork scale`);
    }
  });
}

test('HUD digit boxes have no legacy percentage padding', () => {
  for (const selector of ['#game.active .col-main > .corner-soul', '#game.active .hud-hero .hero-hp']) {
    const block = css.slice(css.lastIndexOf(selector + ' {')).split('}')[0];
    assert.match(block, /padding:\s*0\s*!important/, selector);
    assert.match(block, /justify-content:\s*center\s*!important/, selector);
  }
});

test('draw cost measures and paints with the same alphabetic baseline', () => {
  let baselineAtMeasurement, paintY;
  const c = { font: '', textBaseline: 'alphabetic', clearRect() {}, save() {}, restore() {},
    measureText() { baselineAtMeasurement = this.textBaseline; return { width: 20, actualBoundingBoxAscent: this.textBaseline === 'middle' ? 4 : 22, actualBoundingBoxDescent: this.textBaseline === 'middle' ? 20 : 2 }; },
    strokeText(text, x, y) { paintY = y; }, fillText() {} };
  const cv = { getContext: () => c };
  const ctx = { SOUL_DRAW_GEM: { cx: 282, cy: 216, r: 117, font: 158 }, STAT_WHITE: '#fff', soulDrawNumberCssPx: () => ({ cssPx: 24, btnW: 90 }) };
  vm.createContext(ctx); vm.runInContext(declaration('paintSoulDrawCost'), ctx);
  ctx.paintSoulDrawCost({ querySelector: () => cv }, 3);
  assert.equal(baselineAtMeasurement, 'alphabetic');
  assert.equal(paintY, 256 * 216 / 1024 + (22 - 2) / 2);
});
