/* Reference-contained match packs: one chosen visual and audio format per playback. */
var MatchReferenceFx=(()=>{
  const blobs=new Map(),jobs=new Set();let epoch=0;
  function files(meta,safari){return {visual:safari?meta.overlay.safariFile:meta.overlay.file,audio:safari?(meta.sfx.fallbackFile||meta.sfx.file):meta.sfx.file};}
  async function prepare(base,meta,safari,signal){
    const f=files(meta,safari),url=base+f.visual;let blob=blobs.get(url);
    if(!blob){const r=await fetch(url,{signal,cache:'force-cache'});if(!r.ok)throw Error('Missing match visual');blob=await r.blob();if(signal.aborted)throw Error('Cancelled');blobs.set(url,blob);}
    return {blob,audio:base+f.audio};
  }
  async function preload(base,meta,safari){
    const c=new AbortController(),cancel=()=>c.abort(),timer=setTimeout(cancel,2500);jobs.add(cancel);
    try{const p=await prepare(base,meta,safari,c.signal);Sfx.loadUrl(p.audio).catch(()=>{});return true;}catch(e){return false;}finally{clearTimeout(timer);jobs.delete(cancel);}
  }
  function play(base,meta,opts,hooks){
    const token=epoch,c=new AbortController();let visual=null,url=null,audio=null,timer=null,ended=false,resolve;
    const result=new Promise(r=>resolve=r);
    function finish(ok){if(ended)return;ended=true;c.abort();clearTimeout(timer);try{audio?.stop();}catch(e){}
      if(visual){try{visual.pause?.();visual.removeAttribute('src');visual.load?.();visual.remove();}catch(e){}}
      if(url)URL.revokeObjectURL(url);jobs.delete(cancel);hooks.finish();resolve(ok);
    }
    const cancel=()=>finish(false);jobs.add(cancel);timer=setTimeout(cancel,3000);
    (async()=>{try{
      const p=await prepare(base,meta,opts.safari,c.signal);if(ended||token!==epoch)return;
      const soundP=opts.sound===false?Promise.resolve(null):Sfx.loadUrl(p.audio);
      let soundTimer;const sound=await Promise.race([soundP,new Promise(r=>soundTimer=setTimeout(()=>r(null),400))]);clearTimeout(soundTimer);
      if(ended||token!==epoch)return;
      visual=opts.safari?new Image():document.createElement('video');visual.className='mfx-overlay';
      if(!opts.safari){visual.muted=true;visual.playsInline=true;visual.preload='auto';}else visual.alt='';
      url=URL.createObjectURL(p.blob);const ready=new Promise((res,rej)=>{visual.addEventListener(opts.safari?'load':'loadeddata',res,{once:true});visual.addEventListener('error',()=>rej(Error('Decode failed')),{once:true});c.signal.addEventListener('abort',()=>rej(Error('Cancelled')),{once:true});});
      visual.style.opacity='0';hooks.mount(visual);visual.src=url;if(!opts.safari)visual.load();await ready;
      if(ended||token!==epoch)return;
      if(!opts.safari)await visual.play();if(ended)return;
      visual.style.opacity='1';hooks.start();
      if(sound)audio=Sfx.playBuf(sound,{returnHandle:true,durationMs:meta.durationMs});
      clearTimeout(timer);timer=setTimeout(()=>finish(opts.sound===false||!!sound),meta.durationMs);
      visual.addEventListener('error',cancel,{once:true});
    }catch(e){finish(false);}})();
    return result;
  }
  function clear(){epoch++;for(const cancel of [...jobs])cancel();}
  return {play,preload,clear,files,pending:()=>jobs.size};
})();
