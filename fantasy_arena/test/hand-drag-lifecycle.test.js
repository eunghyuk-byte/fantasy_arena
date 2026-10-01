const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { fixture, vm } = require('../test-support/hand-drag-fixture');
const drop = { clientX: 400, clientY: 350 };
function restored(f) {
  assert.equal(f.drag(), null);
  assert.equal(f.ghosts().length, 0);
  assert.equal(f.source.classList.contains('dragging'), false);
  assert.equal(f.document.body.classList.contains('dragging-card'), false);
  assert.ok(f.p1.hand.includes(f.card));
}
test('hand drag source overrides playable opacity without removing its layout footprint', () => {
  const css = fs.readFileSync(path.join(__dirname, '../css/game.css'), 'utf8');
  const rule = css.match(/#game\.active \.my-hand \.card\.dragging\s*\{([^}]+)\}/);
  assert.ok(rule, 'hand-specific dragging style is required');
  assert.match(rule[1], /opacity:\s*0\s*!important/);
  assert.match(rule[1], /transition:\s*none\s*!important/);
  assert.doesNotMatch(rule[1], /display:\s*none|position:|margin:|width:|height:/);
  const f = fixture(); const before = f.source.getBoundingClientRect(); f.start();
  assert.ok(f.p1.hand.includes(f.card)); assert.equal(f.ids.myHand.children[0], f.source);
  assert.deepEqual(f.source.getBoundingClientRect(), before);
});
test('ghost is inert, hidden from accessibility and has no duplicate IDs', () => {
  const f = fixture(); f.start(); const ghost = f.ghosts()[0];
  assert.equal(ghost.getAttribute('aria-hidden'), 'true');
  assert.notEqual(ghost.getAttribute('inert'), null);
  assert.equal(ghost.getAttribute('id'), null); assert.equal(ghost.querySelectorAll('[id]').length, 0);
});
test('valid drop consumes the real hand card once despite duplicate pointer and mouse events', () => {
  const f = fixture(); f.start(); assert.equal(f.p1.hand.length, 1);
  f.g.emit('pointerup', drop); f.g.emit('mouseup', drop); f.g.emit('pointerup', drop);
  assert.equal(f.p1.hand.length, 0); assert.equal(f.p1.board.length, 1); assert.equal(f.p1.board[0], f.card); assert.equal(f.p1.soul, 9);
  assert.equal(f.drag(), null); assert.equal(f.ghosts().length, 0);
});
test('invalid drop restores source without changing hand or soul', () => {
  const f = fixture(); f.start(); f.g.emit('pointerup', { clientX: 900, clientY: 750 }); restored(f); assert.equal(f.p1.soul, 10);
});
for (const coordinates of [drop, { clientX: 0, clientY: 0 }]) test('pointercancel never commits a drop: ' + JSON.stringify(coordinates), () => {
  const f = fixture(); f.start(); f.g.emit('pointermove', drop); f.g.emit('pointercancel', coordinates); restored(f); assert.equal(f.p1.board.length, 0);
});
test('clearDrag removes every session listener and a delayed old event cannot affect a new drag', () => {
  const f = fixture(); const before = [...f.g.listeners].reduce((n, [, v]) => n + v.size, 0); f.start();
  const oldUp = [...f.g.listeners.get('pointerup')][0];
  f.g.clearDrag(); restored(f);
  assert.equal([...f.g.listeners].reduce((n, [, v]) => n + v.size, 0), before);
  f.start(); const newer = f.drag(); oldUp({ type: 'pointerup', pointerId: 1, ...drop }); assert.equal(f.drag(), newer); assert.equal(f.p1.hand.length, 1);
});
for (const action of ['escape', 'blur', 'hidden', 'lostcapture', 'passTurn', 'endTurn', 'backTitle', 'startGame', 'finish']) test(action + ' restores hand drag and prevents a later accidental play', () => {
  const f = fixture(); f.start();
  if (action === 'escape') f.document.emit('keydown', { key: 'Escape' });
  else if (action === 'blur') f.g.emit('blur');
  else if (action === 'hidden') { f.document.hidden = true; f.document.emit('visibilitychange'); }
  else if (action === 'lostcapture') f.source.emit('lostpointercapture');
  else if (action === 'endTurn') { vm.runInContext('runAutoCombat = async function () { return false; };', f.g); f.g.endTurn(); }
  else if (action === 'startGame') f.g.startGame(false);
  else if (action === 'finish') f.g.finish('P1');
  else f.g[action]();
  restored(f); f.g.emit('pointerup', drop); assert.ok(f.p1.hand.includes(f.card));
});
test('an unrelated pointer cannot move, release or cancel the active drag', () => {
  const f = fixture(); f.start(); const drag = f.drag();
  f.g.emit('pointermove', { pointerId: 2, ...drop }); assert.equal(drag.lastY, 600);
  f.g.emit('pointercancel', { pointerId: 2, ...drop }); assert.equal(f.drag(), drag);
  f.g.emit('pointerup', { pointerId: 2, ...drop }); assert.equal(f.drag(), drag);
  f.g.emit('pointerup', drop); assert.equal(f.p1.board.length, 1);
});
test('compatibility mouse events cannot commit a pointer-owned drag', () => {
  const f = fixture(); f.start(); f.g.emit('mouseup', { pointerId: undefined, ...drop }); assert.equal(f.p1.hand.length, 1); assert.ok(f.drag());
  f.g.emit('pointerup', drop); assert.equal(f.p1.board.length, 1);
});
test('touch drag begins only past its movement threshold and cancellation restores it', () => {
  const f = fixture(); f.start({ pointerType: 'touch' }); assert.equal(f.drag(), null);
  f.g.emit('pointermove', { pointerType: 'touch', clientX: 403, clientY: 603 }); assert.equal(f.drag(), null);
  f.g.emit('pointermove', { pointerType: 'touch', ...drop }); assert.equal(f.drag().kind, 'hand');
  f.g.emit('pointercancel', { pointerType: 'touch', ...drop }); restored(f);
});
test('legacy mouse-only input still moves and drops once', () => {
  const f = fixture(); f.g.PointerEvent = undefined;
  f.source.onmousedown({ button: 0, clientX: 400, clientY: 600, preventDefault() {}, stopPropagation() {} });
  f.g.emit('mousemove', { pointerId: undefined, ...drop });
  f.g.emit('mouseup', { pointerId: undefined, ...drop });
  assert.equal(f.p1.board.length, 1); assert.equal(f.p1.hand.length, 0); assert.equal(f.ghosts().length, 0);
});
test('cost or board eligibility changing mid-drag restores without spending', () => {
  for (const mutate of [f => { f.p1.soul = 0; }, f => { f.p1.board = Array.from({ length: 5 }, (_, i) => ({ uid: 'full-' + i })); }]) {
    const f = fixture(); f.start(); mutate(f); f.g.emit('pointerup', drop); restored(f);
  }
});
test('a stale session cannot play a card after its match is replaced', () => {
  const f = fixture(); f.start(); vm.runInContext('state = { ...state };', f.g); f.g.emit('pointerup', drop); restored(f);
});
test('cancellation clears the insertion preview index before a later action', () => {
  const f = fixture(); f.start(); f.g.emit('pointermove', drop); assert.equal(f.g._dropSlot, 0);
  f.document.emit('keydown', { key: 'Escape' }); assert.equal(f.g._dropSlot, null); restored(f);
});
