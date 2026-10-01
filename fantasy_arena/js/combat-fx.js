/* One cancellable 900ms combat clock; final media is prepared before impact. */
var CombatFx = (() => {
  let generation = 0;
  const active = new Set(), cancellations = new Set();
  const DURATION = 900;
  let media = Object.freeze({});
  const contract = Object.freeze({
    durationMs: DURATION, canvasWidth: 832,
    attack: Object.freeze({ displayWidth: 399.36, effectWidth: 307.2 }),
    defend: Object.freeze({ displayWidth: 561.6, effectWidth: 432 })
  });
  function snapshot(uid, el) {
    try {
      el = el || document.querySelector('.minion[data-uid="' + uid + '"]');
      if (!el) return null;
      const face = el.querySelector('.card-face') || el.querySelector('img');
      const rect = (face && face.getBoundingClientRect ? face : el).getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      if (!face || !face.complete || !face.naturalWidth) return {image:null,rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height}};
      const image = document.createElement('canvas');
      image.width = Math.ceil(rect.width); image.height = Math.ceil(rect.height);
      image.getContext('2d').drawImage(face, 0, 0, image.width, image.height);
      return { image, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } };
    } catch (e) { return null; }
  }
  function clear() {
    generation++;
    for (const job of [...active]) job.cancel();
    for (const notify of [...cancellations]) { try { notify(); } catch (e) {} }
  }
  // Test and preloaded provider injection; production uses CombatMedia.prepare.
  // factory -> {draw(frame), startSound(): stopFn, dispose()}; attack also handles counters.
  function setMedia(providers = {}) {
    clear();
    media = Object.freeze({ attack: providers.attack, defend: providers.defend, death: providers.death });
  }
  function mediaReady() { return { attack: typeof media.attack === 'function', defend: typeof media.defend === 'function' }; }
  function play(requestedKind, opts = {}) {
    if(typeof CombatMedia === 'undefined')return playPrepared(requestedKind,opts);
    if(opts.attempted===false)return Promise.resolve({cancelled:false,damage:0});
    const token=generation,controller=new AbortController();let prepared=null,resolveCancel,playing=false;
    const cancelled=new Promise(r=>resolveCancel=r);
    const job={cancel:()=>{controller.abort();prepared?.dispose();resolveCancel({cancelled:true});},complete:()=>{if(!playing&&(!opts.valid||opts.valid()))opts.onImpact?.();controller.abort();resolveCancel({cancelled:false});}};
    active.add(job);
    const work=(async()=>{try{
      prepared=await CombatMedia.prepare(requestedKind,controller.signal);
      if(controller.signal.aborted||token!==generation||opts.valid&&!opts.valid())return {cancelled:true};
      playing=true;return await playPrepared(requestedKind,{...opts,providers:prepared.providers});
    }finally{prepared?.dispose();active.delete(job);}})();
    return Promise.race([work,cancelled]).finally(()=>active.delete(job));
  }
  // Prepare every target before releasing a shared clock. One batch owns one sound.
  function playBatch(entries = []) {
    const token = generation, controller = new AbortController(), prepared = [];
    let settled = false, playing = false, resolveStop;
    const stopped = new Promise(resolve => { resolveStop = resolve; });
    const valid = entry => token === generation && (!entry.opts?.valid || entry.opts.valid());
    const dispose = pack => { try { pack?.dispose(); } catch (e) {} };
    const finishEarly = cancelled => {
      if (settled) return;
      settled = true;
      const results = entries.map(entry => {
        let error = null;
        if (!cancelled && !playing && entry.opts?.attempted !== false && valid(entry)) {
          try { entry.opts?.onImpact?.(); } catch (e) { error = e; }
        }
        return { cancelled, error };
      });
      controller.abort(); prepared.forEach(dispose); prepared.length = 0;
      resolveStop(results);
    };
    const job = { cancel: () => finishEarly(true), complete: () => finishEarly(false) };
    active.add(job);
    const work = (async () => {
      const packs = await Promise.all(entries.map(async entry => {
        if (entry.opts?.attempted === false || typeof CombatMedia === 'undefined') return null;
        let pack;
        try { pack = await CombatMedia.prepare(entry.kind, controller.signal); }
        catch (e) { pack = { providers: {} }; }
        if (settled || controller.signal.aborted) { dispose(pack); return null; }
        prepared.push(pack); return pack;
      }));
      if (settled || entries.some(entry => !valid(entry))) return entries.map(() => ({cancelled:true}));
      playing = true;
      const startedAt = performance.now();
      const canSound = (entry, index) => {
        const providers = packs[index]?.providers || media;
        const kind = entry.opts?.damage > 0 ? 'attack' : 'defend';
        return entry.opts?.attempted !== false && entry.opts?.sound !== false && typeof providers[kind] === 'function';
      };
      const audible = entries.findIndex((entry, index) => canSound(entry, index) && entry.opts?.damage > 0);
      const soundIndex = audible >= 0 ? audible : entries.findIndex(canSound);
      return await Promise.all(entries.map((entry, index) => playPrepared(entry.kind, {
        ...entry.opts, providers: packs[index]?.providers || media, startedAt, batch: true,
        sound: index === soundIndex && entry.opts?.sound !== false
      })));
    })();
    return Promise.race([work, stopped]).finally(() => {
      active.delete(job); prepared.forEach(dispose); prepared.length = 0;
    });
  }
  function playPrepared(requestedKind, opts = {}) {
    const token = generation, providers = opts.providers || media;
    const isDeath = requestedKind === 'death';
    const kind = requestedKind === 'counter' ? 'attack' : requestedKind;
    let impacted = false, finished = false, visualFailed = false, actualDamage = Math.max(0, Number(opts.damage) || 0);
    let raf = null, timer = null, canvas = null, mask = null, stopSound = null, presentation = null;
    let resolve;
    const result = new Promise(r => { resolve = r; });
    const job = { cancel: () => finish(true), complete: () => { impact(); finish(false); } };
    const valid = () => token === generation && (!opts.valid || opts.valid());
    function removeMotion() {
      try { opts.sourceEl?.classList.remove('fx-lunge'); } catch (e) {}
      try { opts.el?.classList.remove('fx-recoil'); } catch (e) {}
    }
    function finish(cancelled, error, mediaMissing = visualFailed) {
      if (finished) return;
      finished = true;
      if (raf != null) cancelAnimationFrame(raf);
      if (timer != null) clearTimeout(timer);
      try { if (stopSound) stopSound(); } catch (e) {}
      try { if (presentation?.dispose) presentation.dispose(); } catch (e) {}
      try { if (canvas) canvas.remove(); if (mask) mask.remove(); } catch (e) {}
      removeMotion(); active.delete(job);
      resolve({ cancelled: !!cancelled, error: error || null, mediaMissing: mediaMissing || !!presentation?.mediaMissing, damage: actualDamage });
    }
    function impact() {
      if (impacted || finished || !valid()) return;
      impacted = true;
      try {
        const measured = opts.onImpact?.();
        if (Number.isFinite(measured)) actualDamage = Math.max(0, measured);
      } catch (e) { finish(false, e); }
    }
    if (!valid() || opts.attempted === false || !['attack', 'defend', 'death'].includes(kind)) {
      finish(!valid()); return result;
    }
    active.add(job);
    const shot = opts.snapshot || opts.snapshots?.[0] || snapshot(opts.uid, opts.el);
    let reduced = false;
    try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    if (document.hidden || (!opts.batch && !isDeath && !providers.attack && !providers.defend)) {
      impact(); finish(false, null, !isDeath); return result;
    }
    try {
      let ctx = null;
      visualFailed = !shot;
      if (shot && !reduced) try {
      canvas = document.createElement('canvas');
      canvas.width = window.innerWidth; canvas.height = window.innerHeight;
      canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147482000';
      document.body.appendChild(canvas);
      ctx = canvas.getContext('2d');
      if (!ctx) throw Error('Canvas unavailable');
      if (isDeath && opts.uid) {
        mask = document.createElement('style');
        mask.textContent = '.minion[data-uid="' + String(opts.uid).replace(/[^a-zA-Z0-9_-]/g, '') + '"]{visibility:hidden!important}';
        document.body.appendChild(mask);
      }
      } catch (e) {
        visualFailed = true; ctx = null;
        if (canvas) canvas.remove(); if (mask) mask.remove();
      }
      const started = opts.startedAt ?? performance.now(), r = shot && shot.rect;
      let selectedKind = null;
      if (!isDeath && ctx) opts.sourceEl?.classList.add('fx-lunge');
      function draw(now) {
        if (finished) return;
        if (!valid()) { finish(true); return; }
        if (document.hidden) { impact(); finish(false); return; }
        const elapsed = Math.max(0, now - started), t = Math.min(1, elapsed / DURATION);
        impact();
        if (finished) return;
        try {
          if (selectedKind === null) {
            // Decide AFTER applying damage: a shield/zero-HP hit must never start a sword sound.
            selectedKind = isDeath ? 'death' : actualDamage > 0 ? 'attack' : 'defend';
            presentation = providers[selectedKind]?.();
            if (!presentation || typeof presentation.draw !== 'function' || typeof presentation.startSound !== 'function') {
              finish(false, null, true); return;
            }
            if (opts.sound !== false) stopSound = presentation.startSound();
            if (ctx && selectedKind==='attack') opts.el?.classList.add('fx-recoil');
          }
          // Missing/disabled visuals must not mute an available, owned sound.
          if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const dimensions = contract[selectedKind] || {displayWidth:540,effectWidth:540};
          const scale = Math.min(canvas.width / 1920, canvas.height / 1080);
          let currentRect=r;
          if(!isDeath&&opts.el?.isConnected)currentRect=opts.el.getBoundingClientRect();
          presentation.draw({ ctx, elapsedMs: Math.min(elapsed, DURATION), durationMs: DURATION,
            rect: currentRect, image:shot?.image, snapshots:opts.snapshots, damage: actualDamage, kind: selectedKind, canvasWidth:832,
            displayWidth: dimensions.displayWidth * scale, effectWidth: dimensions.effectWidth * scale });
          }
          if (elapsed >= 520) opts.sourceEl?.classList.remove('fx-lunge');
          if (elapsed >= 480) opts.el?.classList.remove('fx-recoil');
        } catch (e) {
          if (!presentation) { finish(false, null, true); return; }
          // A failed visual decoder cannot cut off audio already playing.
          visualFailed = true; ctx = null; removeMotion();
          if (canvas) canvas.remove(); if (mask) mask.remove();
        }
        if (elapsed >= DURATION) finish(false); else raf = requestAnimationFrame(draw);
      }
      // One owner, one clock, no trailing queue. Throttled RAF must not start late audio.
      timer = setTimeout(() => { if (!valid()) finish(true); else { impact(); finish(false); } }, DURATION);
      raf = requestAnimationFrame(draw);
    } catch (e) { impact(); finish(false, null, true); }
    return result;
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
    if (document.hidden) for (const job of [...active]) job.complete();
  });
  return { play, playBatch, clear, snapshot, setMedia, mediaReady, contract, pending: () => active.size,
    generation: () => generation, DURATION,
    onCancel(fn) { cancellations.add(fn); return () => cancellations.delete(fn); } };
})();
if (typeof window !== 'undefined') window.CombatFx = CombatFx;
