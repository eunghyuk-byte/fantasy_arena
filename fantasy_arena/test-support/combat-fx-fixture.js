const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function fixture({bind=true}={}) {
  let now=0,id=0;const jobs=new Map(),nodes=[],events=[],listeners={};
  const draw={clearRect(){},save(){},restore(){},translate(){},rotate(){},drawImage(){events.push('pixels');}};
  const element=()=>{const classes=new Set();return {style:{},complete:true,naturalWidth:180,naturalHeight:240,width:180,height:240,classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),contains:n=>classes.has(n)},remove(){this.removed=true;},getContext:()=>draw,getBoundingClientRect:()=>({left:20,top:30,width:180,height:240}),querySelector:()=>({complete:true,naturalWidth:180,naturalHeight:240}),classes};};
  const ctx={console,Promise,Map,Set,WeakMap,Math,performance:{now:()=>now},document:{hidden:false,body:{appendChild:n=>nodes.push(n)},createElement:element,querySelector:element,addEventListener:(n,f)=>listeners[n]=f},matchMedia:()=>({matches:false}),setTimeout:(f,ms)=>{jobs.set(++id,{at:now+ms,f});return id;},clearTimeout:i=>jobs.delete(i),requestAnimationFrame:f=>ctx.setTimeout(()=>f(now),16),cancelAnimationFrame:i=>jobs.delete(i),innerWidth:1920,innerHeight:1080};ctx.window=ctx;
  vm.createContext(ctx);const file=path.join(__dirname,'../js/combat-fx.js');if(fs.existsSync(file))vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
  const provider=kind=>({draw(frame){events.push({kind,frame});},startSound(){events.push('sound:'+kind);return()=>events.push('stop:'+kind);},dispose(){events.push('dispose:'+kind);}});
  if(bind&&ctx.CombatFx?.setMedia)ctx.CombatFx.setMedia({attack:()=>provider('attack'),defend:()=>provider('defend'),death:()=>provider('death')});
  return {fx:ctx.CombatFx||{},ctx,nodes,jobs,events,listeners,element,provider,advance(ms){const end=now+ms;while(true){const next=[...jobs].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;now=next[1].at;jobs.delete(next[0]);next[1].f();}now=end;}};
}
module.exports={fixture};
