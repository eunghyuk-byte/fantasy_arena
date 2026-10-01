const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,element}=require('../test-support/hand-drag-fixture');
function scene(){
 const f=fixture();Object.assign(f.card,f.g.cloneCard('es10'));f.p1.soul=10;
 const red=f.g.cloneCard('f1'),foe=f.g.cloneCard('e8'),back=f.g.cloneCard('e9'),ally=f.g.cloneCard('e1');
 for(const u of [red,foe,back,ally])Object.assign(u,{def:4,hp:10,maxHp:10});
 f.p2.board.push(red,foe,back);f.p1.board.push(ally);
 const els=[[red,100,0],[foe,240,0],[back,380,0],[ally,100,300]].map(([u,left,top])=>{const el=element();el.className='minion';el.setAttribute('data-uid',u.uid);el.rect={left,right:left+130,top,bottom:top+200,width:130,height:200};return el;});
 const query=f.document.querySelectorAll.bind(f.document);f.document.querySelectorAll=s=>s.includes('#myBoard .minion')?els:s.includes('.minion.spell-valid')?els.filter(e=>e.classList.contains('spell-valid')):s.includes('.minion.equip-glow')?els:query(s);
 f.document.querySelector=s=>{const uid=/data-uid="([^"]+)"/.exec(s);return uid?els.find(e=>e.getAttribute('data-uid')===uid[1])||null:null;};
 const originalFx=f.g.playSpellFx;let casts=0;f.g.playSpellFx=(...args)=>{casts++;return originalFx(...args);};
 return {...f,red,foe,back,ally,els,casts:()=>casts};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function unchanged(f,before){assert.deepEqual(f.p2.board,before);assert.equal(f.p1.soul,10);assert.ok(f.p1.hand.includes(f.card));assert.equal(f.casts(),0);assert.equal(f.drag(),null);assert.equal(f.ghosts().length,0);assert.equal(f.source.classList.contains('dragging'),false);for(const u of [...f.p1.board,...f.p2.board])assert.equal(u.def,4);}
for(const [label,x,y] of [['immune red dragon',220,100],['friendly unit',220,400],['empty gap between enemies',235,100],['outside card boundary',515,100]])test(`es10 drop on ${label} cancels without spending or whole-board effects`,async()=>{
 const f=scene(),before=f.p2.board.slice();assert.equal(f.card.name,'지각균열');assert.ok(f.g.isImmune(f.red));f.start();f.g.emit('pointermove',{clientX:x,clientY:y});f.g.emit('pointerup',{clientX:x,clientY:y});await flush();unchanged(f,before);
});
test('target UID removed before release cannot redirect to another unit',async()=>{const f=scene();f.start();f.p2.board=f.p2.board.filter(u=>u!==f.foe);const before=f.p2.board.slice();f.g.emit('pointerup',{clientX:360,clientY:100});await flush();unchanged(f,before);});
test('legal es10 drop destroys exactly selected enemy and reduces all remaining enemy DEF including immune red',async()=>{
 const f=scene();f.start();f.g.emit('pointerup',{clientX:300,clientY:100});await flush();assert.equal(f.casts(),1);assert.equal(f.p1.soul,5);assert.ok(!f.p1.hand.includes(f.card));assert.deepEqual(f.p2.board,[f.red,f.back]);assert.equal(f.red.hp,10);assert.equal(f.red.def,2);assert.equal(f.back.def,2);assert.equal(f.ally.def,4);assert.equal(f.ghosts().length,0);assert.equal(f.drag(),null);
});
for(const label of ['immune','friendly','missing','stale object','wrong owner','dead','dying','malformed','null'])test(`playCard rejects ${label} target before consuming hand or soul`,async()=>{
 const f=scene();let target={kind:'minion',owner:f.p2,minion:f.foe};
 if(label==='immune')target.minion=f.red;if(label==='friendly')target={kind:'minion',owner:f.p1,minion:f.ally};if(label==='missing')f.p2.board=f.p2.board.filter(u=>u!==f.foe);if(label==='stale object')target.minion={...f.foe};if(label==='wrong owner')target.owner=f.p1;if(label==='dead')f.foe.hp=0;if(label==='dying')f.foe.dying=true;if(label==='malformed')delete target.minion;if(label==='null')target=null;
 const before=f.p2.board.slice();assert.equal(f.g.playCard(f.p1,f.card,target),false);await flush();unchanged(f,before);
});
test('touch drop on immune red dragon cancels without redirect and restores source',async()=>{const f=scene(),before=f.p2.board.slice();f.start({pointerType:'touch'});f.g.emit('pointermove',{pointerType:'touch',clientX:220,clientY:100});f.g.emit('pointerup',{pointerType:'touch',clientX:220,clientY:100});await flush();unchanged(f,before);});
test('immune hover never lights nearby legal enemy as the selected target',()=>{const f=scene();f.g.highlightSpellHover(220,100,f.g.spellDragTargets(f.card));for(const el of f.els)assert.equal(el.classList.contains('spell-glow'),false);assert.equal(f.els[0].classList.contains('spell-valid'),false);assert.equal(f.els[1].classList.contains('spell-valid'),true);});
test('any-minion spell still casts normally on the explicitly selected friendly unit',async()=>{const f=scene();Object.assign(f.card,f.g.cloneCard('fs3'));f.ally.def=0;const hp=f.ally.hp,cost=f.g.effectiveCardCost(f.p1,f.card),damage=f.card.spell.value;f.start();f.g.emit('pointerup',{clientX:160,clientY:400});await flush();assert.equal(f.casts(),1);assert.equal(f.p1.soul,10-cost);assert.equal(f.ally.hp,hp-damage);assert.deepEqual(f.p2.board,[f.red,f.foe,f.back]);for(const u of f.p2.board)assert.equal(u.def,4);});
test('target gaining immunity between hover and release cancels instead of choosing a neighbor',async()=>{const f=scene();f.start();f.g.emit('pointermove',{clientX:360,clientY:100});f.foe.ability='면역';const before=f.p2.board.slice();f.g.emit('pointerup',{clientX:360,clientY:100});await flush();unchanged(f,before);});
