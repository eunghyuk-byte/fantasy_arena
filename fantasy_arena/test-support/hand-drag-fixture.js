const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { setup } = require('./harness');
function events(target = {}) {
  const listeners = new Map();
  target.addEventListener = (type, fn) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); };
  target.removeEventListener = (type, fn) => listeners.get(type)?.delete(fn);
  target.emit = (type, init = {}) => { const e = { type, button: 0, pointerId: 1, pointerType: 'mouse', clientX: 400, clientY: 600, cancelable: true, preventDefault() {}, stopPropagation() {}, ...init }; for (const fn of [...(listeners.get(type) || [])]) fn(e); return e; };
  target.listeners = listeners;
  return target;
}
function element(tag = 'div') {
  const attrs = new Map(), styles = new Map();
  const el = events({ tagName: tag.toUpperCase(), children: [], dataset: {}, className: '', parentNode: null,
    style: { setProperty(k, v, p) { styles.set(k, [v, p || '']); }, removeProperty(k) { styles.delete(k); }, getPropertyValue(k) { return styles.get(k)?.[0] || ''; }, getPropertyPriority(k) { return styles.get(k)?.[1] || ''; } },
    setAttribute(k, v) { attrs.set(k, String(v)); }, getAttribute(k) { return attrs.get(k) ?? null; }, removeAttribute(k) { attrs.delete(k); },
    appendChild(child) { this.children.push(child); child.parentNode = this; return child; }, prepend() {},
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(c => c !== this); this.parentNode = null; },
    getBoundingClientRect() { return this.rect || { left: 350, right: 450, top: 550, bottom: 700, width: 100, height: 150 }; },
    querySelectorAll(selector) { const all = this.children.flatMap(c => [c, ...c.querySelectorAll('*')]); if (selector === '*') return all; if (selector === '[id]') return all.filter(c => c.getAttribute('id') !== null); if (selector === 'img') return all.filter(c => c.tagName === 'IMG'); return []; },
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }, closest() { return null; },
    cloneNode(deep) { const copy = element(tag); copy.className = this.className; for (const [k, v] of attrs) copy.setAttribute(k, v); if (deep) for (const child of this.children) copy.appendChild(child.cloneNode(true)); return copy; },
    setPointerCapture(id) { this.capture = id; }, releasePointerCapture(id) { if (this.capture === id) { this.capture = null; this.emit('lostpointercapture', { pointerId: id }); } }
  });
  const classes = () => new Set(el.className.split(/\s+/).filter(Boolean));
  el.classList = { add(...xs) { el.className = [...new Set([...classes(), ...xs])].join(' '); }, remove(...xs) { el.className = [...classes()].filter(x => !xs.includes(x)).join(' '); }, contains(x) { return classes().has(x); }, toggle(x, on) { if (on ?? !this.contains(x)) this.add(x); else this.remove(x); } };
  return el;
}
function fixture() {
  const body = element('body'), ids = {};
  for (const id of ['myHand', 'myBoard', 'oppBoard', 'game', 'title', 'overlay', 'modal', 'log']) ids[id] = body.appendChild(element());
  ids.myBoard.rect = { left: 100, right: 800, top: 250, bottom: 500, width: 700, height: 250 };
  ids.oppBoard.rect = { left: 100, right: 800, top: 0, bottom: 200, width: 700, height: 200 };
  const document = events({ body, hidden: false, createElement: element, getElementById: id => id === 'cardPeek' ? null : (ids[id] || (ids[id] = element())), querySelector: () => null,
    querySelectorAll(selector) { return selector === '.drag-ghost' ? body.children.filter(el => el.classList.contains('drag-ghost')) : []; }
  });
  const timers = new Map(); let timerId = 0;
  const g = events({ console, document, Math, JSON, Date, Promise, PointerEvent: function () {},
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; }, clearTimeout(id) { timers.delete(id); }, requestAnimationFrame() {},
    getComputedStyle: () => ({ getPropertyValue: () => '100', gap: '10px' }), localStorage: { getItem: () => null, setItem() {}, removeItem() {} }
  });
  g.window = g; vm.createContext(g);
  for (const file of ['js/cards-data.js', 'js/combat.js', 'js/game.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), g, { filename: file });
  vm.runInContext('render = function () {}; meView = function () { return { me: state.p1, opp: state.p2 }; };', g);
  const { p1, p2 } = setup(g);
  const card = { id: 'drag-test', uid: 'drag-card', type: 'minion', name: 'Test', cost: 1, atk: 1, hp: 2, maxHp: 2, def: 0, keywords: [] };
  p1.hand.push(card);
  const source = ids.myHand.appendChild(element()); source.className = 'card playable'; source.setAttribute('id', 'source-card');
  const face = source.appendChild(element('img')); face.setAttribute('id', 'source-face');
  g.bindHandCard(source, card);
  const start = (init = {}) => source.onpointerdown({ button: 0, pointerId: 1, pointerType: 'mouse', clientX: 400, clientY: 600, preventDefault() {}, stopPropagation() {}, ...init });
  return { g, p1, p2, card, source, ids, document, start, timers, drag: () => vm.runInContext('_drag', g), ghosts: () => document.querySelectorAll('.drag-ghost') };
}
module.exports = { fixture, element, vm };
