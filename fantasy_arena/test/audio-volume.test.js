const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const flush = () => new Promise(resolve => setImmediate(resolve));
const closeTo = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-12, `${message}: ${actual} != ${expected}`);

function fixture(saved = null, { missingSounds = false, blockedStorage = false, savedValues = {} } = {}) {
  const nodes = [], audios = [], intervals = new Map(), values = new Map(), elements = new Map();
  if (saved !== null) values.set('fa_bgm_vol', String(saved));
  for (const [key,value] of Object.entries(savedValues)) values.set(key,String(value));
  let timerId = 0;
  function node(kind) {
    const n = { kind, connections: [], connect(dest) { this.connections.push(dest); }, disconnect() { this.connections = []; } };
    nodes.push(n);
    return n;
  }
  function param(value = 0) {
    return { value, setValueAtTime(v) { this.value = v; }, exponentialRampToValueAtTime(v) { this.value = v; } };
  }
  class AudioContext {
    constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 100; this.destination = node('destination'); }
    createGain() { return Object.assign(node('gain'), { gain: param(1) }); }
    createBufferSource() { return Object.assign(node('buffer'), { playbackRate: param(1), start(t) { this.startedAt = t; }, stop() { this.stopped = true; } }); }
    createOscillator() { return Object.assign(node('oscillator'), { frequency: param(), start(t) { this.startedAt = t; }, stop() {} }); }
    createBiquadFilter() { return Object.assign(node('filter'), { frequency: param() }); }
    createDynamicsCompressor() { return Object.assign(node('compressor'), { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }); }
    createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    async decodeAudioData() { return {}; }
  }
  class Audio {
    constructor(url) { this.src = url; this.volume = 1; this.paused = true; audios.push(this); }
    async play() { this.paused = false; }
    pause() { this.paused = true; }
  }
  function element(id, value) {
    const el = { id, value, textContent: '', checked: false, listeners: {}, dataset: {}, style: {}, classList: { add() {}, remove() {}, contains: () => false }, addEventListener(name, fn) { this.listeners[name] = fn; } };
    elements.set(id, el);
    return el;
  }
  const slider = element('bgmVol', '50'), label = element('bgmVolVal'), toggle = element('bgmToggle');
  const ctx = {
    AudioContext, Audio, console, performance: { now: () => 100 },
    localStorage: { getItem(k) { if (blockedStorage) throw Error('blocked'); return values.get(k) ?? null; }, setItem(k, v) { if (blockedStorage) throw Error('blocked'); values.set(k, v); } },
    document: { readyState: 'complete', getElementById: id => elements.get(id) || null, addEventListener() {} },
    addEventListener() {},
    fetch: async () => ({ ok: !missingSounds, arrayBuffer: async () => new ArrayBuffer(0) }),
    setTimeout: () => ++timerId, clearTimeout() {},
    setInterval: fn => { const id = ++timerId; intervals.set(id, fn); return id; }, clearInterval: id => intervals.delete(id)
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  const load = name => vm.runInContext(fs.readFileSync(path.join(root, 'js', name), 'utf8'), ctx, { filename: name });
  load('bgm.js');
  load('sfx.js');
  vm.runInContext('this.sfx = Sfx;', ctx);
  return {
    bgm: ctx.Bgm, sfx: ctx.sfx, values, nodes, audios, slider, label, toggle, element,
    loadSettings() { load('settings.js'); },
    input(value) { slider.value = String(value); slider.listeners.input(); },
    tick() { for (let i = 0; i < 100 && intervals.size; i++) for (const fn of [...intervals.values()]) fn(); },
    master() { return nodes.find(n => n.kind === 'gain' && n.connections.some(d => d.kind === 'destination')); },
    bed(kind = 'menu') { return audios.find(a => a.src?.includes(`/${kind}.`)); }
  };
}

function outputGain(node) {
  if (node.kind === 'destination') return 1;
  assert.equal(node.connections.length, 1, 'every source has exactly one route to the output');
  return (node.gain?.value ?? 1) * outputGain(node.connections[0]);
}

test('channel levels and switches survive reload without changing the legacy master', async () => {
  const f=fixture(50);
  await f.bgm.start(); f.sfx.playBuf({});
  f.bgm.setChannelVolume(.4); f.sfx.setChannelVolume(.2);
  closeTo(f.bed().volume,.25*.16,'independent BGM');
  closeTo(f.master().gain.value,.85*.25*.04,'independent SFX');
  f.bgm.stop(); f.sfx.setMuted(true);
  const restored=fixture(50,{savedValues:Object.fromEntries(f.values)});
  assert.equal(restored.bgm.isWanted(),false);
  assert.equal(restored.sfx.isMuted(),true);
  assert.equal(restored.bgm.getChannelVolume(),.4);
  assert.equal(restored.sfx.getChannelVolume(),.2);
  await restored.bgm.unlock();
  assert.equal(restored.audios.length,0,'first gesture respects saved BGM off');
  restored.sfx.playBuf({});
  restored.sfx.setMuted(false); restored.sfx.playBuf({});
  closeTo(restored.master().gain.value,.85*.25*.04,'unmute restores SFX setting');
});

test('live channel changes affect active ordinary and bus effects independently of music', async () => {
  const f=fixture(100); await f.bgm.start();
  f.sfx.playBuf({}); const regular=f.nodes.find(n=>n.kind==='buffer');
  const bus=f.sfx.makeBus(-6,true);f.sfx.playBuf({},{dest:bus});
  const coin=f.nodes.filter(n=>n.kind==='buffer').at(-1);
  f.sfx.setChannelVolume(.3);
  closeTo(outputGain(regular),.85*.09,'active ordinary effect');
  closeTo(outputGain(coin),Math.pow(10,-6/20)*.85*.09,'active bus effect');
  closeTo(f.bed().volume,1,'BGM unchanged');
  f.sfx.setMuted(true);assert.equal(outputGain(regular),0);assert.equal(outputGain(coin),0);
  f.bgm.setChannelVolume(.2);f.tick();closeTo(f.bed().volume,.04,'BGM live update');
});

test('settings channel inputs do not change the other channel or master', async () => {
  const f=fixture(50);
  const bg=f.element('bgmChannelVol','100'), sf=f.element('sfxChannelVol','100');
  f.element('bgmChannelVolVal'); f.element('sfxChannelVolVal');const toggle=f.element('sfxToggle');
  f.loadSettings();await f.bgm.start();f.sfx.playBuf({});
  sf.value='20';sf.listeners.input();
  closeTo(f.master().gain.value,.85*.25*.04,'SFX slider');closeTo(f.bed().volume,.25,'music unchanged');
  bg.value='70';bg.listeners.input();closeTo(f.bed().volume,.25*.49,'BGM slider');
  assert.equal(f.values.get('fa_bgm_vol'),'50');
  toggle.checked=false;toggle.listeners.change();assert.equal(f.master().gain.value,0);
});

test('BGM uses a smooth perceptual curve with exact mute and the existing maximum', async () => {
  const f = fixture();
  await f.bgm.start();
  let previous = -1;
  for (let position = 0; position <= 100; position++) {
    f.bgm.setVolume(position / 100);
    const gain = f.bed().volume;
    closeTo(gain, (position / 100) ** 2, `BGM position ${position}`);
    assert.ok(gain > previous, `position ${position} increases output`);
    assert.equal(f.bgm.getVolume(), position / 100, 'the UI reads position, not gain');
    assert.equal(f.values.get('fa_bgm_vol'), String(position));
    previous = gain;
  }
});

test('SFX master applies the same curve once and keeps its 0.85 full-scale mix', () => {
  const f = fixture();
  f.sfx.playBuf({});
  let previous = -1;
  for (let position = 0; position <= 100; position++) {
    f.sfx.setVolume(position / 100);
    const gain = f.master().gain.value;
    closeTo(gain, 0.85 * (position / 100) ** 2, `SFX position ${position}`);
    assert.ok(gain > previous, `position ${position} increases output`);
    previous = gain;
  }
});

test('settings restore saved positions to music and effects before their first playback', async () => {
  for (const position of [0, 1, 10, 50, 100]) {
    const f = fixture(position);
    f.loadSettings();
    await f.bgm.start();
    f.sfx.playBuf({});
    const gain = (position / 100) ** 2;
    closeTo(f.bed().volume, gain, `restored BGM ${position}`);
    closeTo(f.master().gain.value, 0.85 * gain, `restored SFX ${position}`);
    assert.equal(+f.slider.value, position);
    assert.equal(+f.label.textContent, position);
  }
});

test('slider changes update playing music, ordinary effects and the coin bus immediately', async () => {
  const f = fixture();
  f.loadSettings();
  await f.bgm.start();
  f.sfx.playBuf({}, { gain: 0.6 });
  const regular = f.nodes.find(n => n.kind === 'buffer');
  const bus = f.sfx.makeBus(-6, true);
  f.sfx.playBuf({}, { gain: 0.4, dest: bus });
  const coin = f.nodes.filter(n => n.kind === 'buffer').at(-1);
  for (const position of [100, 50, 1, 0, 75]) {
    f.input(position);
    f.tick();
    const gain = (position / 100) ** 2;
    closeTo(f.bed().volume, gain, `live BGM ${position}`);
    closeTo(outputGain(regular), 0.6 * 0.85 * gain, `live ordinary effect ${position}`);
    closeTo(outputGain(coin), 0.4 * Math.pow(10, -6 / 20) * 0.85 * gain, `live coin ${position}`);
    assert.equal(f.values.get('fa_bgm_vol'), String(position));
    assert.equal(+f.label.textContent, position);
  }
});

test('music fades and ducking preserve the user curve and cannot undo a live mute', async () => {
  const f = fixture();
  await f.bgm.start();
  f.bgm.setVolume(0.5);
  f.bgm.duck(true, 80);
  f.tick();
  closeTo(f.bed().volume, 0.25 * 0.34, 'duck applies after the user curve');
  f.bgm.duck(false, 180);
  f.bgm.setVolume(0);
  f.tick();
  assert.equal(f.bed().volume, 0);
  await f.bgm.to('battle');
  f.tick();
  assert.equal(f.bed('battle').volume, 0);
  assert.equal(f.bed('menu').volume, 0);
  f.bgm.setVolume(1);
  assert.equal(f.bed('battle').volume, 1);
});

test('music checkbox stays independent of the shared volume and sound effects', async () => {
  const f = fixture(50);
  f.loadSettings();
  await f.bgm.start();
  f.sfx.playBuf({});
  f.toggle.listeners.change({ target: { checked: false } });
  assert.equal(f.bed().volume, 0);
  closeTo(f.master().gain.value, 0.85 * 0.25, 'effects continue at the chosen position');
  f.input(1);
  assert.equal(f.bed().volume, 0);
  assert.equal(f.bgm.isWanted(), false);
  closeTo(f.master().gain.value, 0.85 * 0.0001, 'effects follow volume while music is off');
});

test('WebAudio master starts muted even when missing media triggers synthesized fallback', async () => {
  const f = fixture(null, { missingSounds: true });
  f.sfx.setMuted(true);
  f.sfx.playDeath();
  await flush();
  assert.ok(f.master(), 'fallback exercises lazy context creation');
  assert.equal(f.master().gain.value, 0);
  f.sfx.setVolume(0.01);
  assert.equal(f.master().gain.value, 0);
  f.sfx.setMuted(false);
  closeTo(f.master().gain.value, 0.85 * 0.0001, 'unmuting restores the quiet position');
});

test('URL effects share the master and retain their per-effect gains', async () => {
  const f = fixture(1);
  f.loadSettings();
  for (const url of ['assets/fx/combat/attack/A/sfx.ogg', 'assets/vfx/legendary/l4/sfx.ogg', 'assets/vfx/spells/fs1/sfx.mp3', 'assets/vfx/match/victory/sfx.ogg']) {
    await f.sfx.playUrl(url, { gain: 0.7, returnHandle: true });
    const source = f.nodes.filter(n => n.kind === 'buffer').at(-1);
    closeTo(outputGain(source), 0.7 * 0.85 * 0.0001, url);
  }
});

test('volume input preserves zero and safely clamps strings and out-of-range values', async () => {
  const f = fixture();
  await f.bgm.start();
  f.sfx.playBuf({});
  for (const [value, position] of [['0', 0], ['0.01', 0.01], ['1', 1], [-1, 0], [2, 1], [NaN, 0]]) {
    f.bgm.setVolume(value);
    f.sfx.setVolume(value);
    closeTo(f.bed().volume, position ** 2, `BGM ${value}`);
    closeTo(f.master().gain.value, 0.85 * position ** 2, `SFX ${value}`);
  }
});

test('unavailable localStorage keeps the default slider usable for both audio engines', async () => {
  const f = fixture(null, { blockedStorage: true });
  f.loadSettings();
  await f.bgm.start();
  f.sfx.playBuf({});
  assert.equal(+f.slider.value, 50);
  closeTo(f.master().gain.value, 0.85 * 0.25, 'default effects');
  f.input(0);
  assert.equal(f.master().gain.value, 0);
  assert.equal(f.bed().volume, 0);
});
