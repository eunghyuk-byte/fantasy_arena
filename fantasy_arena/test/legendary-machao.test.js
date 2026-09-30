const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {loadGame,setup,place}=require('../test-support/harness');
const tick=()=>new Promise(r=>setImmediate(r));
for(const side of [1,2])for(const initialCount of [0,1,2,3,4])test(`e14 side ${side} slots ${initialCount}: original token result binding and gameplay equality`,async()=>{
 const run=async(fx)=>{const g=loadGame(),{p1,p2}=setup(g);const p=side===1?p1:p2;const old=[];for(let i=0;i<initialCount;i++)old.push(place(g,p,i===0?'e41':'e8'));
 const hidden=[],calls=[];g.__fx=fx?{hideUnits:ids=>hidden.push(...ids),revealUnit(){},whenOverlayIdle:async()=>{},overlayHold:()=>()=>{},playLegendarySummon:async(b,o)=>{calls.push(o);return false}}:null;vm.runInContext('SpellFx=__fx; state.turn='+side+';state.acting=state.p'+side,g);
 const c=g.cloneCard('e14');p.hand.push(c);g.playCard(p,c,null);await tick();await tick();
 const born=p.board.filter(u=>!old.includes(u)&&u!==c);
 if(fx){assert.equal(calls.length,1);assert.deepEqual(Array.from(calls[0].enemyUids),[]);if(initialCount<4){assert.equal(born.length,1);assert.equal(born[0].id,'e41');assert.equal(calls[0].tokenUid,born[0].uid);assert.ok(!old.some(u=>u.uid===calls[0].tokenUid));assert.ok(hidden.includes(born[0].uid));assert.equal(calls[0].isUnitPresent(born[0].uid),true);p.board=p.board.filter(u=>u!==born[0]);assert.equal(calls[0].isUnitPresent(born[0].uid),false);p.board.push(born[0]);}else{assert.equal(born.length,0);assert.equal(calls[0].tokenUid,undefined);}assert.equal(g.__s.busy,false);}
 return JSON.stringify({p1,p2},(k,v)=>k==='uid'?undefined:v);
 };
 assert.equal(await run(true),await run(false));
});

test('token result is returned only after original board cleanup, without reserving a freed slot',()=>{
 for(const full of [false,true]) {
  const g=loadGame(),{p1}=setup(g);const dead=place(g,p1,'e8');dead.hp=0;dead.dying=true;
  if(full)for(let i=1;i<5;i++)place(g,p1,'e8');
  const result=g.applyFx(p1,{type:'summon_token',summonId:'e41'},null);
  assert.ok(!p1.board.includes(dead));
  if(full){assert.equal(result,undefined);assert.ok(!p1.board.some(u=>u.id==='e41'));}
  else {assert.ok(result.createdUid);assert.ok(p1.board.some(u=>u.uid===result.createdUid));}
 }
});

test('clear during face/queue preparation cannot start a stale summon',async()=>{
 const g=loadGame(),{p1}=setup(g);let epoch=0,starts=0;g.__fx={legendaryEpoch:()=>epoch,hideUnits(){},revealUnit(){},whenOverlayIdle:async()=>{},overlayHold:()=>()=>{},playLegendarySummon:async()=>{starts++;return true}};
 vm.runInContext('SpellFx=__fx',g);const c=g.cloneCard('e14');p1.hand.push(c);g.playCard(p1,c,null);epoch++;await tick();await tick();assert.equal(starts,0);assert.equal(g.__s.busy,false);assert.equal(p1.board.length,2);
});
