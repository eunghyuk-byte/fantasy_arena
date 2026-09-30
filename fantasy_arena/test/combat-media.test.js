const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('../test-support/combat-fx-fixture');
test('concurrent effects cancel together and repeated restarts leave only current audio',async()=>{
 const f=fixture();let impacts=0;
 for(let round=0;round<5;round++){
  const old=[f.fx.play('attack',{uid:'a',onImpact:()=>{impacts++;return 2;}}),f.fx.play('death',{uid:'b'})];
  f.advance(32);f.fx.clear();f.fx.clear();
  const next=f.fx.play('counter',{uid:'c',onImpact:()=>{impacts++;return 0;}});
  f.advance(1000);
  assert.ok((await Promise.all(old)).every(r=>r.cancelled));assert.equal((await next).cancelled,false);
  assert.equal(f.fx.pending(),0);assert.equal(f.jobs.size,0);
 }
 assert.equal(impacts,10);assert.equal(f.events.filter(x=>x==='sound:attack').length,5);
 assert.equal(f.events.filter(x=>x==='sound:defend').length,5);
 assert.equal(f.events.filter(x=>typeof x==='string'&&x.startsWith('stop:')).length,15);
 assert.ok(f.nodes.every(n=>n.removed));
});
test('bound audio survives missing snapshot, reduced motion and failed rendering',async()=>{
 for(const mode of ['missing snapshot','reduced motion','renderer failure','canvas failure'])for(const damage of [0,2]){
  const f=fixture();if(mode==='missing snapshot')f.ctx.document.querySelector=()=>null;else f.ctx.matchMedia=()=>({matches:true});
  if(mode==='renderer failure'){f.ctx.matchMedia=()=>({matches:false});f.fx.setMedia(Object.fromEntries(['attack','defend'].map(k=>[k,()=>({...f.provider(k),draw(){throw Error('decode')}})])));}
  if(mode==='canvas failure'){f.ctx.matchMedia=()=>({matches:false});const create=f.ctx.document.createElement;f.ctx.document.createElement=()=>({...create(),getContext:()=>null});}
  let impacts=0;const p=f.fx.play('attack',{uid:'a',onImpact:()=>{impacts++;return damage;}});
  f.advance(100);const want=damage?'attack':'defend';assert.equal(impacts,1);
  assert.deepEqual(f.events.filter(x=>typeof x==='string'&&x.startsWith('sound:')),['sound:'+want]);
  assert.equal(f.events.filter(x=>typeof x==='string'&&x.startsWith('stop:')).length,0);
  f.advance(800);await p;assert.equal(f.events.filter(x=>x==='stop:'+want).length,1);
  assert.equal(f.fx.pending(),0);assert.equal(f.jobs.size,0);
 }
});
test('combat exposes an explicit unbound media connection point',()=>{const f=fixture({bind:false});assert.equal(typeof f.fx.setMedia,'function');assert.deepEqual(JSON.parse(JSON.stringify(f.fx.mediaReady())),{attack:false,defend:false});});
test('unbound media settles once silently without placeholder effects or fetches',async()=>{const f=fixture({bind:false});let impacts=0;assert.equal(typeof f.fx.play,'function');const result=await f.fx.play('attack',{uid:'x',onImpact:()=>{impacts++;return 2;}});assert.equal(impacts,1);assert.equal(result.mediaMissing,true);assert.equal(f.nodes.length,0);assert.equal(f.jobs.size,0);});
test('counter uses attack A and attack audio; zero actual damage uses defense only',async()=>{for(const [kind,damage,want] of [['attack',3,'attack'],['counter',3,'attack'],['attack',0,'defend'],['counter',0,'defend']]){const f=fixture();const p=f.fx.play(kind,{uid:'x',damage:99,onImpact:()=>damage});f.advance(1000);await p;assert.deepEqual(f.events.filter(x=>typeof x==='string'&&x.startsWith('sound:')),['sound:'+want]);assert.equal(f.jobs.size,0);assert.equal(f.fx.pending(),0);}});
test('no attempted strike is silent and cannot apply damage',async()=>{const f=fixture();let n=0;await f.fx.play('attack',{uid:'x',attempted:false,onImpact:()=>n++});assert.equal(n,0);assert.equal(f.events.length,0);assert.equal(f.jobs.size,0);});
test('clear before impact prevents damage and sound; repeats leave no resources',async()=>{const f=fixture();let n=0;const p=f.fx.play('attack',{uid:'x',onImpact:()=>{n++;return 1;}});f.fx.clear();f.advance(5000);assert.equal((await p).cancelled,true);assert.equal(n,0);for(let i=0;i<5;i++){const p=f.fx.play('attack',{uid:'x',onImpact:()=>{n++;return 1;}});f.advance(900);await p;assert.equal(f.jobs.size,0);assert.equal(f.fx.pending(),0);}assert.equal(n,5);assert.ok(f.nodes.every(x=>x.removed));});
test('owned sound stops on clear; no sound starts when hidden',async()=>{const f=fixture();const p=f.fx.play('attack',{uid:'x',onImpact:()=>1});f.advance(200);f.fx.clear();await p;assert.equal(f.events.filter(x=>x==='stop:attack').length,1);f.ctx.document.hidden=true;await f.fx.play('counter',{uid:'x',onImpact:()=>1});assert.equal(f.events.filter(x=>x==='sound:attack').length,1);});
test('missing decoder or throwing renderer cannot hold input ownership',async()=>{for(const provider of [()=>null,()=>{throw Error('missing media')},()=>({draw(){throw Error('decode')},startSound(){return()=>{}}})]){const f=fixture();f.fx.setMedia({attack:provider,defend:provider});let n=0;const p=f.fx.play('attack',{uid:'x',onImpact:()=>{n++;return 1;}});f.advance(1000);await p;assert.equal(n,1);assert.equal(f.jobs.size,0);assert.equal(f.fx.pending(),0);assert.ok(f.nodes.every(x=>x.removed));}});
test('death fragments retain actual face pixels after source removal',async()=>{const f=fixture();const shot=f.fx.snapshot('x');f.ctx.document.querySelector=()=>null;const p=f.fx.play('death',{snapshot:shot});f.advance(900);await p;assert.ok(f.events.includes('pixels'));assert.equal(f.fx.pending(),0);assert.ok(f.nodes.every(x=>x.removed));});
test('900ms watchdog settles stalled RAF and never starts late sound',async()=>{const f=fixture();f.ctx.requestAnimationFrame=()=>0;let n=0;const p=f.fx.play('attack',{uid:'x',onImpact:()=>{n++;return 1;}});f.advance(900);await p;assert.equal(n,1);assert.equal(f.events.filter(x=>typeof x==='string'&&x.startsWith('sound:')).length,0);assert.equal(f.jobs.size,0);});
test('approved padded canvas dimensions are passed to the provider',async()=>{for(const [damage,width,effect] of [[1,399.36,307.2],[0,561.6,432]]){const f=fixture();const p=f.fx.play('attack',{uid:'x',onImpact:()=>damage});f.advance(200);const frame=f.events.find(x=>typeof x==='object').frame;assert.equal(frame.canvasWidth,832);assert.equal(frame.displayWidth,width);assert.equal(frame.effectWidth,effect);assert.equal(frame.durationMs,900);f.advance(700);await p;}});
