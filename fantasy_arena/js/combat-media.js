/* Approved combat A packs: bounded streaming decoders, one sound per outcome. */
var CombatMedia = (() => {
  const root = 'assets/fx/combat/', metadata = new Map();
  const dispose = v => { if(v)try{v.pause();v.removeAttribute('src');v.load();v.remove();}catch(e){} };
  async function meta(kind, signal) {
    if(metadata.has(kind))return metadata.get(kind);
    const controller=new AbortController(),abort=()=>controller.abort();
    signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
    const timeout=setTimeout(abort,1800);let m;
    try{const r=await fetch(root+kind+'/A/meta.json',{signal:controller.signal});
      if(!r.ok)throw Error('Combat metadata unavailable: '+kind);
      m=await r.json();
    }finally{clearTimeout(timeout);signal.removeEventListener('abort',abort);}
    if(m.concept!=='A'||m.durationMs!==900||!m.video?.alpha)throw Error('Invalid combat contract');
    metadata.set(kind,m);return m;
  }
  function videoReady(base,m,signal) {
    return new Promise(resolve=>{
      const v=document.createElement('video');v.muted=true;v.playsInline=true;v.preload='auto';let done=false;
      const finish=ok=>{if(done)return;done=true;clearTimeout(timer);signal.removeEventListener('abort',fail);v.removeEventListener('loadeddata',check);v.removeEventListener('error',fail);if(!ok)dispose(v);resolve(ok?v:null);};
      const fail=()=>finish(false),check=()=>{try{
        if(signal.aborted||v.videoWidth!==m.video.width||v.videoHeight!==m.video.height)return fail();
        const c=document.createElement('canvas');c.width=c.height=2;const x=c.getContext('2d');x.drawImage(v,0,0,2,2);
        const a=x.getImageData(0,0,2,2).data;finish([3,7,11,15].some(i=>a[i]<250));
      }catch(e){fail();}};
      const timer=setTimeout(fail,1800);signal.addEventListener('abort',fail,{once:true});
      if(signal.aborted)return fail();v.addEventListener('loadeddata',check);v.addEventListener('error',fail);
      v.src=base+m.video.file;v.load();
    });
  }
  function fragments(ctx,shot,m,t) {
    if(!shot?.image)return;
    const f=m.fragments,r=shot.rect;
    if(t>=f.clearAtMs)return;
    if(t<f.splitAtMs){ctx.drawImage(shot.image,r.left,r.top,r.width,r.height);return;}
    for(const piece of f.pieces){
      const u=Math.max(0,Math.min(1,(t-f.splitAtMs-(piece.delayMs||0))/(f.clearAtMs-f.splitAtMs)));
      const eased=1-Math.pow(1-u,3),poly=piece.polygon;
      const cx=poly.reduce((s,p)=>s+p[0],0)/poly.length,cy=poly.reduce((s,p)=>s+p[1],0)/poly.length;
      ctx.save();ctx.globalAlpha=t<=f.opacityHoldUntilMs?1:Math.max(0,(f.clearAtMs-t)/(f.clearAtMs-f.opacityHoldUntilMs));
      ctx.translate(r.left+cx*r.width+piece.translateCardWidths*r.width*eased,r.top+cy*r.height+piece.translateCardHeights*r.height*eased);
      ctx.rotate(piece.rotationDeg*Math.PI/180*eased);ctx.beginPath();poly.forEach((p,i)=>ctx[i?'lineTo':'moveTo']((p[0]-cx)*r.width,(p[1]-cy)*r.height));ctx.closePath();ctx.clip();
      ctx.drawImage(shot.image,-cx*r.width,-cy*r.height,r.width,r.height);ctx.restore();
    }
  }
  async function prepare(requested,signal) {
    const kinds=requested==='death'?['death']:['attack','defend'],owned=[],providers={};
    const stop=()=>owned.forEach(x=>x.dispose());signal.addEventListener('abort',stop,{once:true});
    await Promise.all(kinds.map(async kind=>{
      let m;try{m=await meta(kind,signal);}catch(e){return;}
      if(signal.aborted)return;
      const base=root+kind+'/A/';let audioTimer;
      const [v,buf]=await Promise.all([videoReady(base,m,signal),Promise.race([Sfx.loadUrl(base+m.sfx.file),new Promise(r=>{audioTimer=setTimeout(()=>r(null),1800);})])]);clearTimeout(audioTimer);
      let started=false,closed=false,failed=!v,sound=null;
      const provider={
        get mediaMissing(){return failed||!buf;},
        startSound(){if(buf)sound=Sfx.playBuf(buf,{returnHandle:true,durationMs:900});return()=>{try{sound?.stop();}catch(e){}};},
        draw(frame){if(closed)return;const {ctx,elapsedMs:t}=frame;
          if(v&&!failed){if(!started){started=true;v.play().catch(()=>{failed=true;});}if(Math.abs(v.currentTime-t/1000)>.075&&!v.seeking)v.currentTime=t/1000;}
          const shots=frame.snapshots||[{image:frame.image,rect:frame.rect}];
          for(const shot of shots){if(!shot?.rect)continue;const r=shot.rect;
            const width=kind==='death'?r.height*m.cardHeightScale:frame.displayWidth;
            if(v&&!failed&&v.readyState>=2){ctx.save();ctx.globalAlpha=m.video.opacity??1;ctx.drawImage(v,r.left+r.width/2-width/2,r.top+r.height/2-width/2,width,width);ctx.restore();}
            if(kind==='death')fragments(ctx,shot,m,t);
          }
        },
        dispose(){if(closed)return;closed=true;dispose(v);try{sound?.stop();}catch(e){}}
      };
      if(v)v.addEventListener('error',()=>{failed=true;},{once:true});owned.push(provider);
      if(signal.aborted)provider.dispose();else providers[kind]=()=>provider;
    }));
    return {providers,dispose(){signal.removeEventListener('abort',stop);stop();}};
  }
  return {prepare,fragments};
})();
