const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const {element} = require('../test-support/hand-drag-fixture');
const {loadGame, setup} = require('../test-support/harness');
const src = fs.readFileSync(path.join(__dirname, '../js/spell-fx.js'), 'utf8');
function extract(g, name) {
  const a=src.indexOf('function '+name+'('), b=src.indexOf('\n  }',a)+4;
  vm.runInContext((src.slice(a-6,a)==='async '?'async ':'')+src.slice(a,b),g);
}
async function flush(){for(let i=0;i<30;i++)await Promise.resolve();}
function fixture() {
  let now=0, id=0, finishFace; const timers=new Map(), face=element(), stage=element(), layer=element(), label=element(), events=[];
  face.innerHTML='';
  const g={_legendaryEpoch:0,_legendaryPreloads:new Set(),_hidden:{},Promise,Object,
    setTimeout:(f,ms)=>{timers.set(++id,{f,at:now+ms});return id;},clearTimeout:id=>timers.delete(id),
    document:{getElementById:id=>({fxCard:face,fxStage:stage,fxName:label})[id]},ensureLayer:()=>layer,
    spellKind:()=>'',elemOf:()=>'',lowSpec:()=>false,loadSpellMeta:async()=>null,isCanvasMeta:()=>false,
    resolveFace:()=>new Promise(r=>finishFace=r),playAssetPack:async()=>{events.push('effect');return true;}};
  vm.createContext(g);for(const n of ['waitSpellMeta','paintCard','cleanupFx','play'])extract(g,n);
  return {g,face,events,finish:v=>finishFace(v),async advance(ms){now+=ms;for(const [i,t] of [...timers])if(t.at<=now){timers.delete(i);t.f();}await flush();}};
}
test('cold opponent face arriving after 300ms is shown before the effect',async()=>{
  const f=fixture(),p=f.g.play({id:'fs1',name:'Fire Arrow'});await flush();await f.advance(650);
  f.finish('data:image/png;base64,card');await flush();
  assert.match(f.face.innerHTML,/data:image\/png;base64,card/);assert.deepEqual(f.events,[]);
  await f.advance(650);await f.advance(220);await p;assert.deepEqual(f.events,['effect']);assert.equal(f.face.innerHTML,'');
});
test('clear cancels pending face without a late card or effect',async()=>{
  const f=fixture();let settled=false;const p=f.g.play({id:'fs1',name:'Fire Arrow'}).then(()=>settled=true);await flush();
  f.g._legendaryEpoch++;for(const cancel of [...f.g._legendaryPreloads])cancel();await flush();
  assert.equal(settled,true);f.finish('late');await flush();assert.equal(f.face.innerHTML,'');assert.deepEqual(f.events,[]);await p;
});
test('failed or never-settling face still identifies the used card and finishes',async()=>{
  const f=fixture(),p=f.g.play({id:'fs1',name:'Fire Arrow'});await flush();await f.advance(3000);
  assert.equal(f.face.textContent,'Fire Arrow');assert.deepEqual(f.events,[]);
  await f.advance(650);await f.advance(220);await p;assert.deepEqual(f.events,['effect']);
});
test('cancelled spell in the same game cannot resolve damage and releases busy',async()=>{
  const g=loadGame(),{p1,p2}=setup(g);let finish,epoch=0;g.SpellFx={legendaryEpoch:()=>epoch,play:()=>new Promise(r=>finish=r)};
  const c=g.cloneCard('fs2'),before=p2.hp;let resolves=0;const original=g.resolveSpell;g.resolveSpell=(...args)=>{resolves++;return original(...args);};
  const done=g.runSpellCast(p1,c,null);epoch++;finish();await done;
  assert.equal(resolves,0);assert.equal(p2.hp,before);assert.equal(vm.runInContext('state.busy',g),false);
});
test('game ending during a pending spell prevents resolution and releases busy',async()=>{
  const g=loadGame(),{p1}=setup(g);let finish;g.SpellFx={play:()=>new Promise(r=>finish=r)};
  let resolves=0;g.resolveSpell=()=>resolves++;const done=g.runSpellCast(p1,g.cloneCard('fs2'),null);
  vm.runInContext('state.over=true',g);finish();await done;assert.equal(resolves,0);assert.equal(vm.runInContext('state.busy',g),false);
});
