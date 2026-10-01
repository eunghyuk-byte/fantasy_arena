const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function fixture(bridge, closed = false) {
  const nodes = Object.fromEntries(['btnTitleQuit', 'btnQuit', 'exitNotice'].map(id => [id, {textContent: ''}]));
  const timers = [];
  const window = { fantasyArenaDesktop: bridge, closed, close() { this.calls = (this.calls || 0) + 1; } };
  const context = { window, document: {getElementById: id => nodes[id]}, setTimeout: fn => timers.push(fn) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/menu-exit.js'), 'utf8'), context);
  return {window, nodes, flush: () => timers.splice(0).forEach(fn => fn())};
}
test('both exit buttons attempt close and give accurate blocked-browser guidance', async () => {
  const f = fixture();
  await f.nodes.btnTitleQuit.onclick(); f.flush();
  assert.equal(f.window.calls, 1);
  assert.equal(f.nodes.exitNotice.textContent, '브라우저 탭을 닫아 종료해주세요.');
  await f.nodes.btnQuit.onclick(); f.flush();
  assert.equal(f.window.calls, 2);
});
test('supported desktop quit bridge is used without browser close', async () => {
  let calls = 0;
  const f = fixture({quit: async () => {calls++;}});
  await f.nodes.btnTitleQuit.onclick(); f.flush();
  assert.equal(calls, 1);
  assert.equal(f.window.calls, undefined);
  assert.equal(f.nodes.exitNotice.textContent, '');
});
test('rejected desktop bridge falls back safely', async () => {
  const f = fixture({quit: async () => {throw Error('unavailable');}});
  await f.nodes.btnTitleQuit.onclick(); f.flush();
  assert.equal(f.window.calls, 1);
  assert.match(f.nodes.exitNotice.textContent, /탭을 닫아/);
});
test('closed window does not report failure', async () => {
  const f = fixture(undefined, true);
  await f.nodes.btnTitleQuit.onclick(); f.flush();
  assert.equal(f.nodes.exitNotice.textContent, '');
});
