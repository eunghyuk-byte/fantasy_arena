/* Streaming alpha video for summon packs. Sprite packs retain their existing renderer. */
var LegendaryVideoFx = (() => {
  let epoch = 0;
  const jobs = new Set(), warmed = new Map();
  const url = (base,file) => base.replace(/\/?$/, '/') + file;
  function dispose(video) { try { video.pause();video.removeAttribute('src');video.load();video.remove(); } catch(e) {} }
  function ready(base, meta, signal) {
    return new Promise(resolve => {
      const v=document.createElement('video');v.muted=true;v.playsInline=true;v.preload='auto';
      let done=false;
      const finish=ok=>{if(done)return;done=true;clearTimeout(timer);v.removeEventListener('loadeddata',check);v.removeEventListener('error',fail);signal.removeEventListener('abort',fail);if(!ok)dispose(v);resolve(ok?v:null);};
      const fail=()=>finish(false);
      const check=()=>{
        try {
          if(signal.aborted||v.videoWidth!==meta.video.width||v.videoHeight!==meta.video.height) return finish(false);
          const c=document.createElement('canvas');c.width=2;c.height=2;
          const ctx=c.getContext('2d');ctx.drawImage(v,0,0,2,2);
          // The approved pack has transparent border pixels. Reject opaque VP9 decoding.
          const alpha=ctx.getImageData(0,0,2,2).data;
          const transparent=[3,7,11,15].some(i=>alpha[i]<250);
          finish(!meta.video.alpha||transparent);
        } catch(e){finish(false);}
      };
      const timer=setTimeout(fail,1800);
      signal.addEventListener('abort',fail,{once:true});
      if(signal.aborted)return fail();
      v.addEventListener('loadeddata',check);v.addEventListener('error',fail);
      if(!v.canPlayType('video/webm; codecs="vp9"'))return fail();
      v.src=url(base,meta.video.file);v.load();
    });
  }
  async function preload(base,meta) {
    try { if(typeof Sfx!=='undefined'&&meta.sfx)Sfx.loadUrl(url(base,meta.sfx.file)).catch(()=>{}); } catch(e) {}
    const key=url(base,meta.video.file);
    if(warmed.has(key))return warmed.get(key);
    const controller=new AbortController();const token=epoch;
    const cancel=()=>controller.abort();jobs.add(cancel);
    const promise=(async()=>{try{
      const v=await ready(base,meta,controller.signal);if(!v)return false;dispose(v);
      return token===epoch;
    }finally{jobs.delete(cancel);}})();
    warmed.set(key,promise);const ok=await promise;if(!ok)warmed.delete(key);return ok;
  }
  async function play(base,meta,opts={}) {
    const token=epoch,controller=new AbortController();let video=null,canvas=null,raf=null,cap=null,audio=null,settle;
    let ended=false;
    const finish=ok=>{if(ended)return;ended=true;controller.abort();if(raf!=null)cancelAnimationFrame(raf);if(cap!=null)clearTimeout(cap);if(video)dispose(video);if(canvas)canvas.remove();try{if(audio&&audio.stop)audio.stop();}catch(e){}if(settle)settle(ok);};
    const cancel=()=>finish(false);jobs.add(cancel);
    try {
      if(document.hidden)return false;
      video=await ready(base,meta,controller.signal);
      if(!video||token!==epoch||ended)return false;
      const soundPromise=opts.sound===false||typeof Sfx==='undefined'?Promise.resolve(null):Sfx.loadUrl(url(base,meta.sfx.file));
      // Audio preparation cannot hold gameplay indefinitely.
      let soundTimer;
      const sound=await Promise.race([soundPromise,new Promise(r=>{soundTimer=setTimeout(()=>r(null),250);})]);clearTimeout(soundTimer);
      if(token!==epoch||ended)return false;
      const result=new Promise(r=>settle=r);
      cap=setTimeout(()=>finish(false),meta.durationMs+500);
      canvas=document.createElement('canvas');canvas.width=window.innerWidth;canvas.height=window.innerHeight;
      canvas.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2147482000';document.body.appendChild(canvas);
      const ctx=canvas.getContext('2d');if(!ctx)return false;
      const V=meta.video,k=opts.scale||Math.min(canvas.width/1920,canvas.height/1080);
      const a=opts.anchor||{x:canvas.width/2,y:canvas.height*.66},off=V['offsetPx@1080p']||[0,0],size=V['displayPx@1080p'];
      const flip=opts.casterIsMe===false&&V.flipYWhenOppCasts;
      video.currentTime=0;
      video.play().then(()=>{
        if(ended||token!==epoch)return;
        if(sound&&typeof Sfx!=='undefined')audio=Sfx.playBuf(sound,{returnHandle:true,durationMs:meta.durationMs});
        try{if(opts.onStart)opts.onStart();}catch(e){}
        const draw=()=>{
          if(ended)return;
          if(token!==epoch||document.hidden){finish(false);return;}
          const t=video.currentTime*1000,D=meta.dim||{};
          ctx.clearRect(0,0,canvas.width,canvas.height);
          const dim=t<(D.inMs||1)?t/(D.inMs||1):t<(D.outStartMs||0)?1:Math.max(0,1-(t-D.outStartMs)/Math.max(1,(D.endMs||meta.durationMs)-D.outStartMs));
          if(D.opacity){ctx.fillStyle=D.color||'#000';ctx.globalAlpha=D.opacity*dim;ctx.fillRect(0,0,canvas.width,canvas.height);}
          ctx.globalAlpha=1;ctx.save();ctx.translate(a.x+off[0]*k,a.y+(flip?-off[1]:off[1])*k);if(flip)ctx.scale(1,-1);
          ctx.drawImage(video,-size[0]*k/2,-size[1]*k/2,size[0]*k,size[1]*k);ctx.restore();
          // Upright enemy sprites share the video clock and cleanup.
          try { if(opts.drawOverlay)opts.drawOverlay(ctx,t); } catch(e){finish(false);return;}
          if(ended||token!==epoch)return;
          if(video.ended||t>=meta.durationMs-1)finish(true);else raf=requestAnimationFrame(draw);
        };
        raf=requestAnimationFrame(draw);
      }).catch(()=>finish(false));
      video.addEventListener('ended',()=>finish(true),{once:true});video.addEventListener('error',()=>finish(false),{once:true});
      return await result;
    } catch(e){return false;}
    finally{finish(false);if(video)dispose(video);jobs.delete(cancel);}
  }
  function clear(){epoch++;for(const cancel of [...jobs])cancel();}
  return {preload,play,clear,pending:()=>jobs.size};
})();
window.LegendaryVideoFx=LegendaryVideoFx;
