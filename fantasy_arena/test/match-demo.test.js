const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function fixture({hostname='127.0.0.1',search=''}={}){
  let active=false, observer, id=0;
  const timers=new Map(), events={}, media={matches:false,addEventListener(t,fn){this.change=fn;}};
  const nodes={lobby:{classList:{contains:()=>active}},matchDemo:{hidden:true},matchDemoCount:{textContent:''},matchDemoDots:{textContent:''}};
  const math=Object.create(Math);math.random=()=>0;
  const doc={hidden:false,getElementById:id=>nodes[id],addEventListener:(t,fn)=>events[t]=fn};
  const ctx={document:doc,Math:math,location:{hostname,search},URLSearchParams,matchMedia:()=>media,addEventListener:(t,fn)=>events[t]=fn,
    MutationObserver:class{constructor(fn){observer=fn;}observe(){}},
    setInterval:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearInterval:id=>timers.delete(id)};
  ctx.window=ctx;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/match-demo.js'),'utf8'),ctx);
  return {nodes,timers,doc,events,media,math,activate(value){active=value;if(observer)observer();},tick(ms){for(const t of [...timers.values()])if(t.ms===ms)t.fn();}};
}
test('visual count is enabled on public and local hosts without a preview query',()=>{
  for(const options of [{search:''},{hostname:'eunghyuk-byte.github.io',search:''},{hostname:'eunghyuk-byte.github.io',search:'?match-preview=1'}]){
    const f=fixture(options);f.activate(true);assert.equal(f.nodes.matchDemo.hidden,false);assert.equal(f.timers.size,2);assert.equal(f.nodes.matchDemoCount.textContent,'10');
  }
});
test('demo is bounded to 10..100 and only updates while lobby is visible',()=>{
  const f=fixture();assert.equal(f.timers.size,0);
  f.activate(true);assert.equal(f.nodes.matchDemoCount.textContent,'10');assert.equal(f.timers.size,2);
  f.math.random=()=>.999999;f.tick(4000);assert.equal(f.nodes.matchDemoCount.textContent,'100');
  f.tick(700);assert.equal(f.nodes.matchDemoDots.textContent,'..');
  f.tick(700);assert.equal(f.nodes.matchDemoDots.textContent,'...');
  f.tick(700);assert.equal(f.nodes.matchDemoDots.textContent,'.');
  f.activate(true);assert.equal(f.timers.size,2,'no duplicated timers');
  f.activate(false);assert.equal(f.timers.size,0);
});
test('hidden pages, reduced motion and page lifecycle cleanly stop/restart timers',()=>{
  const f=fixture();f.activate(true);f.doc.hidden=true;f.events.visibilitychange();assert.equal(f.timers.size,0);
  f.doc.hidden=false;f.events.visibilitychange();assert.equal(f.timers.size,2);
  f.media.matches=true;f.media.change();assert.equal(f.timers.size,1);assert.equal(f.nodes.matchDemoDots.textContent,'...');
  f.events.pagehide();assert.equal(f.timers.size,0);
  f.events.pageshow();assert.equal(f.timers.size,1);
});
