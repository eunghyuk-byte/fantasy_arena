const test=require('node:test'),assert=require('node:assert/strict');
const {loadGame,setup}=require('../test-support/harness');
function fixture(){const g=loadGame(),{p1,p2}=setup(g);let timers=[],ends=0;g.setTimeout=fn=>(timers.push(fn),fn);g.clearTimeout=fn=>timers=timers.filter(x=>x!==fn);g.runAutoCombat=async()=>{ends++;return true};return {g,p1,p2,ends:()=>ends,async tick(){const a=timers;timers=[];a.forEach(f=>f());for(let i=0;i<15;i++)await Promise.resolve()}};}
test('turn-end waits for an active public burn and advances exactly once after its visual',async()=>{
 const f=fixture(),{g,p1}=f;p1.hand=Array.from({length:10},()=>g.cloneCard('e1'));let release;
 g.playDrawBurnCard=()=>new Promise(r=>release=r);g.draw(p1);const burn=g.playDrawBurnSequence();
 assert.equal(g.drawBurnPending(),true);g.endTurn();g.endTurn();await f.tick();
 assert.equal(g.__s.turn,1);assert.equal(f.ends(),0);assert.ok(g.__s.endTurnRequest);
 release();await burn;await f.tick();assert.equal(g.__s.turn,2);assert.equal(f.ends(),1);await f.tick();assert.equal(f.ends(),1);
});
test('turn-end pumps a queued burn before passing, without waiting on its own request',async()=>{
 const f=fixture(),{g,p1}=f;p1.hand=Array.from({length:10},()=>g.cloneCard('e1'));let release,burn,starts=0;
 g.playDrawBurnCard=()=>new Promise(r=>release=r);g.render=()=>{starts++;burn=g.playDrawBurnSequence()};g.draw(p1);g.endTurn();await f.tick();
 assert.equal(g.__s.turn,1);assert.equal(starts,1);assert.ok(release,'queued burn starts while turn request is waiting');
 release();await burn;await f.tick();assert.equal(g.__s.turn,2);assert.equal(f.ends(),1);
});
