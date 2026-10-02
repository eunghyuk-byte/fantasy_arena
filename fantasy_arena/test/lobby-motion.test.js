const test = require('node:test');
const assert = require('node:assert/strict');
const { SealMotion, rankProfile, roomCallbacks } = require('../js/lobby-motion.js');

test('seal accelerates smoothly and reaches a constant speed without rotating fixed UI', () => {
  const m = new SealMotion();
  m.transition('searching', 0);
  assert.equal(m.sample(0).velocity, 0);
  const early = m.sample(300), late = m.sample(1200), steady = m.sample(1600);
  assert.ok(early.velocity > 0 && early.velocity < late.velocity);
  assert.equal(steady.velocity, 42);
  assert.ok(Math.abs(m.sample(2600).angle - steady.angle - 42) < 1e-9);
});
test('success and cancellation decelerate from current angle and never snap back', () => {
  for (const reason of ['matched', 'idle', 'error', 'disconnected']) {
    const m = new SealMotion(); m.transition('searching', 0);
    const before = m.sample(2000);
    m.transition(reason, 2000);
    assert.deepEqual(m.sample(2000), before);
    assert.ok(m.sample(2150).velocity < before.velocity);
    const end = m.sample(2600);
    assert.equal(end.velocity, 0);
    assert.ok(end.angle > before.angle);
    assert.equal(m.sample(6000).angle, end.angle);
    m.transition('searching', 6000);
    assert.equal(m.sample(6000).angle, end.angle);
  }
});
test('repeated start does not restart acceleration; mid-stop rematch is continuous', () => {
  const m = new SealMotion(); m.transition('searching', 0);
  m.transition('searching', 800);
  assert.equal(m.sample(1600).velocity, 42);
  m.transition('idle', 1800);
  const before = m.sample(1900);
  m.transition('searching', 1900);
  assert.deepEqual(m.sample(1900), before);
});
test('freeze and reduced motion preserve angle with no hidden animation', () => {
  const m = new SealMotion(); m.transition('searching', 0);
  const a = m.sample(1000).angle;
  m.freeze(1000); assert.equal(m.sample(9000).angle, a);
  m.transition('searching', 9000, true);
  assert.equal(m.sample(10000).velocity, 0);
  assert.equal(m.sample(10000).angle, a);
});
test('rank view uses actual values and explicit next tier, never demo diamond or a guessed promotion', () => {
  assert.equal(rankProfile(null), null);
  assert.equal(rankProfile({displayName:'Player'}), null);
  const p = rankProfile({rank:{tier:'gold',div:1,progress:72.5,next:{tier:'platinum',div:5}}});
  assert.deepEqual(p,{tier:'gold',div:1,progress:72.5,next:{tier:'platinum',div:5}});
  assert.equal(rankProfile({rank:{tier:'silver',div:3,progress:250}}).progress,100);
  assert.equal(rankProfile({rank:{tier:'silver',div:3,progress:20}}).next,null);
  assert.equal(rankProfile({rank:{tier:'bogus',div:2,progress:35}}),null);
});
test('room adapter follows authoritative callbacks; cancelling is not confirmation or success', () => {
  const calls=[];
  const cb=roomCallbacks(state=>calls.push(state),{onMatch:id=>calls.push('battle:'+id),onWaiting:r=>calls.push('room:'+r.code)});
  cb.onStatus('connecting');cb.onWaiting({code:'ABCDEFGH'});cb.onStatus('cancelling');
  assert.deepEqual(calls,['searching','searching','room:ABCDEFGH','cancelling']);
  cb.onStatus('closed');assert.equal(calls.at(-1),'idle');
  cb.onStatus('disconnected');assert.equal(calls.at(-1),'disconnected');
  cb.onStatus('authRequired');assert.equal(calls.at(-1),'disconnected');
  cb.onStatus('deck_invalid');assert.equal(calls.at(-1),'error');
  cb.onMatch('real-server-id');
  assert.deepEqual(calls.slice(-2),['matched','battle:real-server-id'],'battle starts synchronously; animation adds no delay');
});
