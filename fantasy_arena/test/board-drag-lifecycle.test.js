const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, element } = require('../test-support/hand-drag-fixture');
function boardFixture() {
  const f = fixture();
  const a = f.g.cloneCard('e1'), b = f.g.cloneCard('e2');
  f.p1.board = [a, b];
  const slots = [], minions = [];
  [a, b].forEach((card, i) => {
    const slot = element(), el = slot.appendChild(element());
    slot.className = 'slot filled'; el.className = 'minion'; el.setAttribute('data-uid', card.uid);
    el.rect = { left: 200 + i * 150, right: 300 + i * 150, top: 250, bottom: 400, width: 100, height: 150 };
    el.closest = selector => selector === '.slot' ? slot : null;
    slot.querySelector = selector => selector === '.minion' ? el : null;
    f.ids.myBoard.appendChild(slot); slots.push(slot); minions.push(el); f.g.bindBoardMinion(el, card);
  });
  f.ids.myBoard.querySelectorAll = selector => selector === '.slot.filled .minion' ? minions : selector === '.slot' || selector === '.slot.filled' ? slots : [];
  const start = i => minions[i].onpointerdown({ button: 0, pointerId: 1, pointerType: 'mouse', clientX: 250 + i * 150, clientY: 325, preventDefault() {}, stopPropagation() {} });
  return { ...f, a, b, minions, slots, start };
}
const first = { clientX: 110, clientY: 325 };
for (const reason of ['Escape', 'blur without an in-page release']) test(reason + ': cancelled board B cannot hijack a new board A drop', () => {
  const f = boardFixture(); f.start(1);
  if (reason === 'Escape') f.document.emit('keydown', { key: 'Escape' }); else f.g.emit('blur');
  f.start(0); f.g.emit('pointerup', first);
  assert.deepEqual(f.p1.board.map(c => c.uid), [f.a.uid, f.b.uid], 'A at index zero must not reorder cancelled B');
});
test('board clearDrag unregisters listeners and invalidates an already queued old event', () => {
  const f = boardFixture(); f.start(1); const staleUp = [...f.g.listeners.get('pointerup')][0];
  f.g.clearDrag(); assert.equal(f.g.listeners.get('pointerup').size, 0); assert.equal(f.minions[1].capture, null);
  f.start(0); const newer = f.drag(); staleUp({ type: 'pointerup', pointerId: 1, ...first });
  assert.equal(f.drag(), newer); assert.deepEqual(f.p1.board.map(c => c.uid), [f.a.uid, f.b.uid]);
});
test('board pointercancel and capture loss restore without committing a reorder', () => {
  for (const type of ['pointercancel', 'lostpointercapture']) {
    const f = boardFixture(); f.start(1); f.g.emit('pointermove', first);
    if (type === 'pointercancel') f.g.emit(type, first); else f.minions[1].emit(type);
    assert.equal(f.drag(), null); assert.equal(f.ghosts().length, 0); assert.equal(f.minions[1].classList.contains('dragging'), false);
    assert.deepEqual(f.p1.board.map(c => c.uid), [f.a.uid, f.b.uid]);
  }
});
test('board drag ignores other pointers and still applies its one valid reorder', () => {
  const f = boardFixture(); f.start(1); const session = f.drag();
  f.g.emit('pointerup', { pointerId: 2, ...first }); assert.equal(f.drag(), session);
  f.g.emit('pointercancel', { pointerId: 2, ...first }); assert.equal(f.drag(), session);
  f.g.emit('pointerup', first); f.g.emit('mouseup', first);
  assert.deepEqual(f.p1.board.map(c => c.uid), [f.b.uid, f.a.uid]); assert.equal(f.drag(), null);
});
