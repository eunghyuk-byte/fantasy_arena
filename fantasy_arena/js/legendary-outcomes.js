/* Presentation of immutable engine outcomes. No gameplay selection or RNG here. */
var LegendaryOutcomeFx = (() => {
  const easing='cubic-bezier(0.215,0.61,0.355,1)';
  function normalize(m) {
    if(!m || m.id!=='d7_summon_A')return m;
    const video=v=>Object.assign({},v,{'displayPx@1080p':v.displayPxAt1080p,'offsetPx@1080p':v.centerOffsetRelativeToAnchorPxAt1080p,flipYWhenOppCasts:true});
    return Object.assign({},m,{playMode:'legendarySummon',video:video(m.main),impact:{video:video(m.impact),startMs:m.impact.startMs,endMs:m.impact.hardClearMs},
      fragments:{file:'death_fragments.json',splitAtMs:m.death.splitAtMs,invisibleAtMs:m.death.invisibleAtMs,clearAtMs:m.death.removeAllFragmentsAtMs},
      dim:{color:m.dim.color,opacity:m.dim.keyframesMs[1][1],inMs:m.dim.keyframesMs[1][0],outStartMs:m.dim.keyframesMs[2][0],endMs:m.dim.keyframesMs[3][0],easing},summonedReveal:{fadeMs:m.casterCard.opacityKeyframesMs[1][0],popMs:0,scaleFrom:1,brightnessFrom:1,easing},outcomeScale:'card',statDisplayResolveMs:m.outcomeContract.statDisplayResolveMs});
  }
  function capture(units) {
    return units.map(unit=>{
      const el=document.querySelector('.minion[data-uid="'+String(unit.uid).replace(/"/g,'')+'"]');
      if(!el)return null;
      const r=el.getBoundingClientRect(), face=el.querySelector('.card-face');
      const copy=JSON.parse(JSON.stringify(unit,(k,v)=>k==='_deathCtx'?undefined:v));
      const source=face && face.getAttribute('src');
      const facePromise=source?Promise.resolve(source):typeof warmMinionFace==='function'?Promise.resolve(warmMinionFace(copy)).catch(()=>null):Promise.resolve(null);
      return {uid:unit.uid,rect:{x:r.x,y:r.y,width:r.width,height:r.height},facePromise};
    }).filter(Boolean);
  }
  async function imageOf(src) {
    if(!src)throw Error('Missing actual card face');
    const image=new Image();image.src=src;await image.decode();return image;
  }
  async function prepare(base,meta,opts) {
    if(!meta.impact)return null;
    const results=new Map((opts.outcome && opts.outcome.targets || []).map(r=>[r.uid,r]));
    const rows=await Promise.all((opts.snapshots||[]).map(async s=>{
      const outcome=results.get(s.uid);
      if(!outcome && opts.isEnemyPresent && !opts.isEnemyPresent(s.uid))return null;
      const before=await imageOf(await s.facePromise);
      let after=before;
      if(outcome && typeof warmMinionFace==='function')after=await imageOf(await warmMinionFace(outcome.after));
      return {...s,before,after,outcome};
    }));
    const cards=rows.filter(Boolean),targets=cards.filter(s=>s.outcome);
    const response=await fetch(base+meta.fragments.file);if(!response.ok)throw Error('Missing fragment definitions');
    const fragments=await response.json();
    const caster=document.querySelector('.minion[data-uid="'+String(opts.unitUid).replace(/"/g,'')+'"]');
    const k=meta.outcomeScale==='card'&&caster?caster.getBoundingClientRect().width/198:null;
    const secondary=targets.length?Object.assign({},meta.impact,{anchors:targets.map(s=>({x:s.rect.x+s.rect.width/2,y:s.rect.y+s.rect.height/2,scale:meta.outcomeScale==='card'?s.rect.width/198:undefined}))}):null;
    const visible=cards.filter(s=>!s.outcome || !s.outcome.destroyed).map(s=>s.uid);
    const frame=(ctx,s,t)=>ctx.drawImage(meta.id==='n2_summon'&&s.outcome&&s.outcome.destroyed?s.before:t>=(meta.statDisplayResolveMs||0)?s.after:s.before,s.rect.x,s.rect.y,s.rect.width,s.rect.height);
    function whole(ctx,t,under) {
      cards.forEach(s=>{
        const dying=!!(s.outcome && s.outcome.destroyed);
        if(dying && t>=meta.fragments.splitAtMs)return;
        // Zhao Yun victims remain below dim/main until split; survivors stay above ambience.
        const below=meta.id==='n2_summon'&&dying;
        if(below===under)frame(ctx,s,t);
      });
    }
    function pieces(ctx,t) {
      const F=meta.fragments;
      if(t<F.splitAtMs||t>=F.clearAtMs)return;
      const local=t-F.splitAtMs,progress=LegendaryVideoFx.ease(local/(fragments.motionDurationMs||fragments.motion.translationDurationMs));
      const alpha=t>=F.invisibleAtMs?0:local<=300?1:1-LegendaryVideoFx.ease((local-300)/(F.invisibleAtMs-F.splitAtMs-300));
      if(!alpha)return;
      targets.filter(s=>s.outcome.destroyed).forEach(s=>{
        const r=s.rect,img=meta.id==='n2_summon'?s.before:s.after;
        fragments.pieces.forEach(p=>{
          ctx.save();ctx.globalAlpha=alpha;ctx.translate(r.x+p.translateCardWidths*r.width*progress,r.y+p.translateCardHeights*r.height*progress);ctx.rotate(p.rotationDeg*Math.PI/180*progress);ctx.scale(1-.25*progress,1-.25*progress);
          ctx.beginPath();p.polygon.forEach(([x,y],i)=>i?ctx.lineTo(x*r.width,y*r.height):ctx.moveTo(x*r.width,y*r.height));ctx.closePath();ctx.clip();ctx.drawImage(img,0,0,r.width,r.height);ctx.restore();
        });
      });
    }
    return {secondary,scale:k,visible,under:(ctx,t)=>whole(ctx,t,true),over:(ctx,t)=>whole(ctx,t,false),pieces};
  }
  return {normalize,capture,prepare};
})();
window.LegendaryOutcomeFx=LegendaryOutcomeFx;
