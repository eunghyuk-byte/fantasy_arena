const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('../test-support/combat-fx-fixture');
test('full defense never recoils the protected card',async()=>{const f=fixture(),el=f.element();const p=f.fx.play('attack',{uid:'x',el,onImpact:()=>0});f.advance(200);assert.equal(el.classes.has('fx-recoil'),false);f.advance(700);await p;});
test('death uses the selected provider once on the same owned clock',async()=>{const f=fixture();f.fx.setMedia({death:()=>f.provider('death')});const p=f.fx.play('death',{uid:'x'});f.advance(500);assert.equal(f.events.filter(x=>x==='sound:death').length,1);assert.ok(f.events.some(x=>x.kind==='death'));f.fx.clear();await p;assert.equal(f.events.filter(x=>x==='stop:death').length,1);assert.equal(f.fx.pending(),0);});

test('cancel during media preparation aborts without applying damage or retaining jobs',async()=>{const f=fixture();let signal,resolve,n=0;f.ctx.AbortController=AbortController;f.ctx.CombatMedia={prepare:(k,s)=>{signal=s;return new Promise(r=>resolve=r);}};const p=f.fx.play('attack',{onImpact:()=>n++});f.fx.clear();assert.equal((await p).cancelled,true);assert.equal(signal.aborted,true);assert.equal(n,0);assert.equal(f.fx.pending(),0);resolve({providers:{},dispose(){}});await Promise.resolve();});
test('hiding during preparation settles actual damage once without starting sound',async()=>{const f=fixture();let resolve,n=0;f.ctx.AbortController=AbortController;f.ctx.CombatMedia={prepare:()=>new Promise(r=>resolve=r)};const p=f.fx.play('attack',{onImpact:()=>n++});f.ctx.document.hidden=true;f.listeners.visibilitychange();await p;assert.equal(n,1);assert.equal(f.events.length,0);resolve({providers:{},dispose(){}});});

test('death A clips six pieces from the supplied live face and clears by 850ms',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const m=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/fx/combat/death/A/meta.json')));const g={};vm.createContext(g);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/combat-media.js'),'utf8'),g);
 const face={},draws=[],ctx={save(){},restore(){},translate(){},rotate(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){},drawImage(x){draws.push(x);}};const shot={image:face,rect:{left:100,top:80,width:198,height:297}};
 g.CombatMedia.fragments(ctx,shot,m,400);assert.equal(draws.length,6);assert.ok(draws.every(x=>x===face));draws.length=0;g.CombatMedia.fragments(ctx,shot,m,850);assert.equal(draws.length,0);
});

test('metadata body remains abortable after response headers arrive',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),controller=new AbortController();let bodies=0;
 const g={AbortController,setTimeout,clearTimeout,Sfx:{loadUrl:async()=>null},fetch:async(u,{signal})=>({ok:true,json:()=>new Promise((r,j)=>{bodies++;signal.addEventListener('abort',()=>j(Error('aborted')),{once:true});})})};vm.createContext(g);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/combat-media.js'),'utf8'),g);
 const p=g.CombatMedia.prepare('attack',controller.signal);await new Promise(r=>setImmediate(r));assert.equal(bodies,2);controller.abort();const done=await Promise.race([p.then(()=>true),new Promise(r=>setTimeout(()=>r(false),40))]);assert.equal(done,true);
});
