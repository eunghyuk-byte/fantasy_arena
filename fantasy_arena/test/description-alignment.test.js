const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../js/render.js'), 'utf8');
function layout(type, count) {
  const declaration = source.match(/function descriptionTextStartY\([^]*?\n\}/);
  assert.ok(declaration, 'shared description block alignment exists');
  return vm.runInNewContext(declaration[0] + `;descriptionTextStartY('${type}',1152,45,${count})`);
}
test('unit and item descriptions preserve single-line seat and center two-line blocks there', () => {
  const oldSingle = 1152 * .778 - (45 * 1.28 + 1) / 2;
  for (const type of ['minion', 'item']) {
    assert.equal(layout(type, 1), oldSingle);
    assert.equal(layout(type, 2) + (45 * 1.28 + 1) / 2, oldSingle);
  }
});
test('spell descriptions preserve two-line seat and move single lines to its center', () => {
  assert.equal(layout('spell', 1), 1152 * .778);
  assert.equal(layout('spell', 2), 1152 * .778 - (45 * 1.28 + 1) / 2);
});
test('overlong descriptions remain fully laid out for reporting, without truncation', () => {
  assert.equal(layout('item', 3), layout('item', 1) - (45 * 1.28 + 1));
});
