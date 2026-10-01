const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const render = fs.readFileSync(path.join(__dirname, '../js/render.js'), 'utf8');
const game = fs.readFileSync(path.join(__dirname, '../js/game.js'), 'utf8');
function decl(src, name) { const s=src.indexOf('function '+name+'('); return src.slice(s,src.indexOf('\n}',s)+2); }
const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
function el(bounds) { return {style:{setProperty(k,v){this[k]=v;}},getBoundingClientRect:()=>bounds,querySelector:()=>null}; }
for (const [w,h] of [[1366,768],[1920,1080],[2560,1440],[1280,960]]) {
 test(`art-anchored button and hero centers at ${w}x${h}`,()=>{
  const zoom=1.15, br=rect(w*(1-zoom)/2,h*(1-zoom)/2,w*zoom,h*zoom), mr=rect(10,20,w-20,h-40), hr=rect(0,0,w,h);
  const bg={naturalWidth:3840,naturalHeight:2160,offsetWidth:w,getBoundingClientRect:()=>br};
  const btn=el(), heroes=[el(),el()], main=el(mr), hud=el(hr);
  const ids={boardBgLayer:bg,endBtn:btn};
  const sels={'#game.active .col-main':main,'#game.active .col-hud':hud,'#oppStrip .hud-hero':heroes[0],'#myStrip .hud-hero':heroes[1]};
  const c={document:{getElementById:id=>ids[id],querySelector:s=>sels[s]}};vm.createContext(c);
  for(const name of ['boardCoreBox','boardZoom','layoutEndBtn','layoutHudGems'])vm.runInContext(decl(render,name),c);
  c.layoutEndBtn();c.layoutHudGems();
  const scale=Math.min(br.width/3840,br.height/2160), ax=br.left+(br.width-3840*scale)/2,ay=br.top+(br.height-2160*scale)/2;
  const center=(e,p)=>({x:p.left+parseFloat(e.style.left)+parseFloat(e.style.width)/2,y:p.top+parseFloat(e.style.top)+parseFloat(e.style.height)/2});
  const b=center(btn,mr);
  assert.ok(Math.abs(b.x-(ax+3030*scale))<.01,'button center on right frame');
  assert.ok(Math.abs(b.y-(ay+1012*scale))<.01,'button center on table divider');
  for(const hero of heroes) assert.ok(Math.abs(center(hero,hr).x-(ax+3186*scale))<.01,'hero centered inside arch');
 });
}
test('opening flies take 480ms while normal draws retain 720ms',async()=>{
 const durations=[],timers=[];
 const target={style:{setProperty(){},opacity:''},getBoundingClientRect:()=>rect(10,10,70,100)};
 const c={Sfx:{},document:{querySelector:()=>({getBoundingClientRect:()=>rect(0,0,70,100)}),getElementById:()=>({querySelectorAll:()=>[target]}),body:{appendChild(){}},createElement:()=>({style:{},remove(){},animate(frames,opts){durations.push(opts.duration);const a={};queueMicrotask(()=>a.onfinish());return a;}})},window:{},setTimeout:(fn,ms)=>timers.push(ms),DRAW_FLY_MS:720};
 vm.createContext(c);vm.runInContext(decl(game,'flyDrawCard'),c);
 await c.flyDrawCard(target,1.5);await c.flyDrawCard(target);
 assert.deepEqual(durations,[480,720]);assert.deepEqual(timers,[560,800]);
});
test('sequence propagates opening rate to each card',async()=>{
 const rates=[],cards=Array.from({length:5},()=>({style:{setProperty(){},removeProperty(){}}}));
 const c={document:{getElementById:()=>({querySelectorAll:()=>cards})},flyDrawCard:async(el,rate)=>rates.push(rate)};vm.createContext(c);
 vm.runInContext('async '+decl(game,'playDrawSequence'),c);
 await c.playDrawSequence(5,1.5);assert.deepEqual(rates,[1.5,1.5,1.5,1.5,1.5]);
});
test('opening marker is consumed once and next render uses normal draw speed',async()=>{
 const start=render.indexOf('  if ((me._drewCount || 0) > 0 && !me._drawingAnim) {');
 const end=render.indexOf('  // v0.372: 드로우 대기 중',start);
 const block=render.slice(start,end),rates=[],queued=[];
 const me={_drewCount:4,_openingDrawPending:true};
 const c={me,requestAnimationFrame:fn=>queued.push(fn),playDrawSequence:async(n,rate)=>rates.push({n,rate})};
 vm.createContext(c);vm.runInContext(block,c);queued.shift()();await new Promise(setImmediate);
 assert.equal(me._openingDrawPending,false);assert.equal(me._drawingAnim,false);
 me._drewCount=1;vm.runInContext(block,c);queued.shift()();await new Promise(setImmediate);
 assert.deepEqual(rates,[{n:4,rate:1.5},{n:1,rate:1}]);
});
