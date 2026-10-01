const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('../test-support/draw-burn-fixture');
const {setup}=require('../test-support/harness');
for(const view of[1,2])for(const seat of[1,2])for(const width of[390,1280])test(`view ${view} burns seat ${seat} visibly at width ${width}`,async()=>{
 const f=fixture({view,width,height:844});f.g.draw(seat===1?f.p1:f.p2);const done=f.g.playDrawBurnSequence();await f.flush();
 assert.equal(f.children.length,1);assert.equal(f.children[0].children[0].src,'assets/img/hud/back.png');assert.equal(f.flights[0].opts.duration,720);
 const r=f.children[0].getBoundingClientRect();assert.ok(r.left>=0&&r.right<=width&&r.top>=0&&r.bottom<=844);
 await f.advance(719);assert.equal(f.effects.length,0);await f.advance(1);assert.equal(f.children[0].children[0].src,'face-e3.png');
 await f.advance(260);assert.equal(f.effects.length,1);assert.equal(f.effects[0].kind,'death');assert.equal(f.effects[0].src,'face-e3.png');assert.equal(f.children[0].style.visibility,'hidden');
 await f.advance(900);await done;assert.equal(f.children.length,0);assert.equal(f.g.drawBurnPending(),false);assert.equal(f.p1.hand.length,10);assert.equal(f.p2.hand.length,10);
});
for(const phase of[100,800,1200])test(`clear at ${phase}ms removes ghost and remaining queue`,async()=>{const f=fixture();f.g.draw(f.p1,2);const done=f.g.playDrawBurnSequence();await f.advance(phase);f.g.CombatFx.clear();await f.advance(3000);await done;assert.equal(f.children.length,0);assert.equal(f.state._drawBurnQueue.length,0);assert.equal(f.g.drawBurnPending(),false);assert.ok(f.effects.length<=1);});
test('match replacement during flight removes ghost within next validity check',async()=>{const f=fixture();f.g.draw(f.p1,2);const done=f.g.playDrawBurnSequence();await f.advance(100);setup(f.g);await f.advance(32);await done;assert.equal(f.children.length,0);assert.equal(f.effects.length,0);});
test('both players burn multiple draws once in original event order',async()=>{const f=fixture();f.g.draw(f.p2,2);f.g.draw(f.p1,2);const done=f.g.playDrawBurnSequence();await f.advance(8000);await done;assert.deepEqual(f.effects.map(e=>e.src),['face-e3.png','face-e2.png','face-e3.png','face-e2.png']);assert.equal(f.children.length,0);assert.equal(f.p1.deck.length,0);assert.equal(f.p2.deck.length,0);});
