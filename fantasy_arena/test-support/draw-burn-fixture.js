const {loadGame,setup,vm}=require('./harness');
function fixture({width=1280,height=960,view=1}={}) {
 const g=loadGame(),{p1,p2}=setup(g),timers=new Map(),children=[],effects=[],flights=[],sources=[];
 let now=0,serial=0,cancelHook=null,generation=0;
 g.setTimeout=(fn,ms=0)=>{const id=++serial;timers.set(id,{at:now+ms,fn});return id;};g.clearTimeout=id=>timers.delete(id);
 const flush=async()=>{for(let n=0;n<12;n++)await Promise.resolve();};
 const advance=async ms=>{const until=now+ms;await flush();while(true){const entry=[...timers].filter(([,t])=>t.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];if(!entry)break;now=entry[1].at;timers.delete(entry[0]);entry[1].fn();await flush();}now=until;await flush();};
 const rect=(left,top,w,h)=>({left,top,width:w,height:h,right:left+w,bottom:top+h});
 const bounds={myDeck:rect(width-80,height-180,65,90),oppDeck:rect(width-80,80,65,90),myHand:rect(50,height-120,width-100,120),oppHand:rect(50,0,width-100,80)};
 const element=tag=>{
  const el={tag,style:{},children:[],complete:true,naturalWidth:600,appendChild(c){this.children.push(c);return c;},remove(){const i=children.indexOf(this);if(i>=0)children.splice(i,1);},getBoundingClientRect(){const css=this.style.cssText||'';const n=k=>Number(css.match(new RegExp(k+':([0-9.]+)px'))?.[1]||0);return rect(n('left'),n('top'),n('width'),n('height'));}};
  Object.defineProperty(el,'src',{get(){return this._src;},set(v){this._src=v;sources.push(v);queueMicrotask(()=>this.onload?.());}});
  el.animate=(frames,opts)=>{flights.push({frames,opts});let resolve;const finished=new Promise(r=>resolve=r);g.setTimeout(resolve,opts.duration);return {finished,cancel:resolve};};return el;
 };
 g.document={hidden:false,createElement:element,getElementById:id=>bounds[id]?{getBoundingClientRect:()=>bounds[id]}:null,querySelector:s=>{const id=s.includes('myDeck')?'myDeck':s.includes('oppDeck')?'oppDeck':null;return id?{getBoundingClientRect:()=>bounds[id]}:null;},body:{appendChild(el){children.push(el);}}};
 g.log=()=>{};g.innerWidth=width;g.innerHeight=height;g.Sfx={playDraw(){}};g.SpellFx={playUi(){},overlayBusy:()=>false};g.HUD_UI={deck:'card-back.png'};g.faceSrc=async card=>'face-'+card.id+'.png';g.meView=()=>view===1?{me:p1,opp:p2}:{me:p2,opp:p1};
 g.CombatFx={generation:()=>generation,onCancel:fn=>{cancelHook=fn;return()=>cancelHook=null;},snapshot:(_,el)=>({image:el.children[0],rect:el.getBoundingClientRect()}),play:async(kind,opts)=>{effects.push({kind,opts,src:opts.snapshot.image.src});opts.onImpact();await new Promise(r=>g.setTimeout(r,900));},clear(){generation++;cancelHook?.();}};
 const state=vm.runInContext('state',g);for(const p of[p1,p2]){p.hand=Array.from({length:10},()=>g.cloneCard('e1'));p.deck=['e2','e3'];}
 return {g,p1,p2,state,children,effects,flights,sources,advance,flush};
}
module.exports={fixture};
