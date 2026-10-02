/* Front-facing, genuinely extruded seal. Local mesh rotates under fixed lights.
 * No networking, scene library, remote dependency or matching state lives here. */
(function(root){
  function mesh(){
    const data=[];
    function tri(a,b,c,metal){
      const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);
      const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1;
      for(const p of [a,b,c])data.push(...p,...n.map(x=>x/l),metal);
    }
    // Radius/Z pairs form stone face, recessed channels, raised metal tiers,
    // broad chamfers, a thick cylindrical edge and the back lip.
    const profile=[[0,.014,0],[.48,.014,0],[.53,.018,0],[.55,.035,1],[.562,.085,1],[.58,.095,1],[.599,.044,1],[.617,.006,0],[.642,.008,0],[.656,.034,1],[.668,.061,1],[.684,.032,1],[.704,.020,0],[.825,.020,0],[.845,.027,1],[.853,.057,1],[.868,.072,1],[.883,.033,1],[.904,.022,0],[.919,.041,1],[.931,.078,1],[.951,.088,1],[.969,.062,1],[.989,.006,1],[1,-.06,0],[.995,-.155,0],[.974,-.19,1],[.947,-.19,0]];
    const segments=256;
    for(let k=0;k<profile.length-1;k++)for(let j=0;j<segments;j++){
      const a=j/segments*Math.PI*2,b=(j+1)/segments*Math.PI*2;
      const [r,z,m]=profile[k],[r2,z2,m2]=profile[k+1];
      const p=(rad,zz,t)=>[rad*Math.cos(t),rad*Math.sin(t),zz];
      tri(p(r,z,a),p(r2,z2,a),p(r2,z2,b),Math.max(m,m2));tri(p(r,z,a),p(r2,z2,b),p(r,z,b),Math.max(m,m2));
    }
    // Raised outer-rim diamond facets follow the reference's restrained ornament.
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6,r=.91,sz=.018;
      const p=(rr,t,z)=>[rr*Math.cos(t),rr*Math.sin(t),z];
      const pts=[p(r-sz,a,.044),p(r,a-sz/r,.044),p(r+sz,a,.044),p(r,a+sz/r,.044)],tip=p(r,a,.076);
      for(let j=0;j<4;j++)tri(pts[j],pts[(j+1)%4],tip,1);
    }
    // Six recessed metal medallions are geometry in the SAME rotating object.
    // Five retain the original reference's whole medallion surface, not deck art.
    for(let i=0;i<6;i++) {
      const pointInReference=[[1065,565],[1065,95],[850,211],[1280,211],[850,421],[1280,421]][i];
      const cx=(pointInReference[0]-1065)/350,cy=(330-pointInReference[1])/350;
      const relief=[[0,.11],[.082,.11],[.096,.124],[.107,.10],[.115,.039]];
      for(let k=0;k<relief.length-1;k++) for(let j=0;j<96;j++) {
        const a=j/96*Math.PI*2,b=(j+1)/96*Math.PI*2;
        const point=(q,t)=>[cx+q[0]*Math.cos(t),cy+q[0]*Math.sin(t),q[1]];
        tri(point(relief[k],a),point(relief[k+1],a),point(relief[k+1],b),i+2);
        tri(point(relief[k],a),point(relief[k+1],b),point(relief[k],b),i+2);
      }
    }
    return {vertices:new Float32Array(data),triangles:data.length/21,zMin:-.19,zMax:.124};
  }
  function create(canvas){
    const gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false,powerPreference:'low-power'});
    if(!gl)return null;
    const vertex=`attribute vec3 position;attribute vec3 normal;attribute float metal;
      uniform float angle;varying vec3 P;varying vec3 N;varying vec2 UV;varying float M;
      void main(){float c=cos(angle),s=sin(angle);mat3 spin=mat3(c,s,0.,-s,c,0.,0.,0.,1.);
      float t=.105;mat3 tilt=mat3(1.,0.,0.,0.,cos(t),sin(t),0.,-sin(t),cos(t));
      vec3 p=tilt*spin*position;P=p;N=tilt*spin*normal;UV=position.xy*.5+.5;M=metal;
      gl_Position=vec4(p.x*.96,(p.y-.006)*.96,-p.z*.5,1.);}`;
    const fragmentPrecision=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT).precision>0?'highp':'mediump';
    const fragment=`precision ${fragmentPrecision} float;varying vec3 P;varying vec3 N;varying vec2 UV;varying float M;
      uniform sampler2D reference;uniform vec2 sourceSize;uniform float energy;uniform float detailFilter;
      // Catmull-Rom reconstruction retains native engraving edges under fractional
      // UV rotation/scale. Nine bilinear taps; low-resolution displays use one.
      vec3 sourceSample(vec2 pixel){
        if(detailFilter<.5)return texture2D(reference,pixel/sourceSize).rgb;
        vec2 base=floor(pixel-.5)+.5,t=pixel-base;
        vec2 w0=t*(-.5+t*(1.-.5*t));
        vec2 w1=1.+t*t*(-2.5+1.5*t);
        vec2 w2=t*(.5+t*(2.-1.5*t));
        vec2 w3=t*t*(-.5+.5*t),w12=w1+w2;
        vec2 p0=(base-1.)/sourceSize,p12=(base+w2/w12)/sourceSize,p3=(base+2.)/sourceSize;
        vec3 c=texture2D(reference,p0).rgb*w0.x*w0.y;
        c+=texture2D(reference,vec2(p12.x,p0.y)).rgb*w12.x*w0.y;
        c+=texture2D(reference,vec2(p3.x,p0.y)).rgb*w3.x*w0.y;
        c+=texture2D(reference,vec2(p0.x,p12.y)).rgb*w0.x*w12.y;
        c+=texture2D(reference,p12).rgb*w12.x*w12.y;
        c+=texture2D(reference,vec2(p3.x,p12.y)).rgb*w3.x*w12.y;
        c+=texture2D(reference,vec2(p0.x,p3.y)).rgb*w0.x*w3.y;
        c+=texture2D(reference,vec2(p12.x,p3.y)).rgb*w12.x*w3.y;
        c+=texture2D(reference,p3).rgb*w3.x*w3.y;
        return clamp(c,0.,1.);
      }
      void main(){vec3 n=normalize(N);vec3 key=normalize(vec3(-.48,.7,1.05));
      vec3 fill=normalize(vec3(.75,-.45,.55));vec3 view=vec3(0.,0.,1.);
      vec2 local=UV*2.-1.;float radius=length(local);
      vec2 xy=vec2(1065.,330.)+vec2(local.x,-local.y)*350.;
      vec3 tex=sourceSample(xy);
      // Erase only fixed UI footprints. The former whole-center mask discarded
      // valid source stone and replaced it with an enlarged 46x74px repair tile.
      float portrait=1.-smoothstep(108.,113.,length(xy-vec2(1065.,273.)));
      float playerBox=(1.-smoothstep(79.,84.,abs(xy.x-1065.)))*smoothstep(376.,382.,xy.y)*(1.-smoothstep(409.,416.,xy.y));
      float rankBox=(1.-smoothstep(107.,113.,abs(xy.x-1065.)))*smoothstep(410.,416.,xy.y)*(1.-smoothstep(503.,510.,xy.y));
      float plinthHalf=153.+clamp((xy.y-510.)/90.,0.,1.)*86.;
      float plinthBox=(1.-smoothstep(plinthHalf,plinthHalf+5.,abs(xy.x-1065.)))*smoothstep(505.,511.,xy.y);
      float erase=max(max(portrait,playerBox),max(rankBox,plinthBox));
      erase=max(erase,smoothstep(1218.,1235.,xy.x)*(1.-smoothstep(85.,100.,xy.y)));
      // Architectural brackets belong to fixed foreground pillars, never the rotor.
      float bracketY=smoothstep(285.,303.,xy.y)*(1.-smoothstep(426.,443.,xy.y));
      float bracketX=max(1.-smoothstep(776.,792.,xy.x),smoothstep(1338.,1354.,xy.x));
      erase=max(erase,bracketY*bracketX);
      // Hidden areas have no source pixels. Reconstruct from a clean radial
      // sector of THIS reference, keeping band radii and original stone grain.
      float sector=-2.08+asin(sin(atan(-local.y,local.x)*3.))*.14;
      vec2 repair=vec2(1065.,330.)+vec2(cos(sector),sin(sector))*radius*350.;
      vec3 rebuilt=texture2D(reference,repair/sourceSize).rgb;
      vec2 stoneXY=vec2(1177.,283.)+abs(fract((local+1.)*1.5)*2.-1.)*vec2(46.,74.);
      vec3 inner=texture2D(reference,stoneXY/sourceSize).rgb;
      rebuilt=mix(inner,rebuilt,smoothstep(.5,.56,radius));
      tex=mix(tex,rebuilt,erase);
      float material=clamp(M,0.,1.);
      if(M>1.5){
        float id=floor(M+.1)-2.;
        vec2 source=vec2(1065.,95.);
        if(id<.5)source=vec2(1065.,565.);
        if(id>1.5&&id<2.5)source=vec2(850.,211.);
        if(id>2.5&&id<3.5)source=vec2(1280.,211.);
        if(id>3.5&&id<4.5)source=vec2(850.,421.);
        if(id>4.5)source=vec2(1280.,421.);
        vec2 center=vec2(source.x-1065.,330.-source.y)/350.;
        vec2 rel=vec2(local.x-center.x,center.y-local.y)*350.;
        if(id<.5)source=vec2(1065.,95.);
        tex=sourceSample(source+rel);
        // Earth is absent from the approved five-glyph drawing. Its sixth
        // engraving is an explicit reconstructed mountain motif, not deck art.
        if(id<.5){
          float r=length(rel),x=rel.x,y=rel.y;
          float mountain=min(abs(y-(abs(x)*1.35-15.)),min(abs(y-(abs(x+9.)*1.25-5.)),abs(y-(abs(x-9.)*1.25-5.))));
          float mark=(1.-smoothstep(.5,1.5,mountain))*(1.-smoothstep(18.,22.,r));
          vec3 field=texture2D(reference,(vec2(1200.,320.)+rel*.35)/sourceSize).rgb*.72;
          field=mix(field,vec3(.41,.32,.17),mark*.9);
          tex=mix(field,tex,smoothstep(23.,27.,r));
        }
        material=.65;
      }
      float diffuse=max(0.,dot(n,key)),cool=max(0.,dot(n,fill));
      float spec=pow(max(0.,dot(n,normalize(key+view))),mix(14.,56.,material));
      float occlusion=smoothstep(-.17,.07,P.z)*.3+.7;
      vec3 color=tex*(vec3(.70)+diffuse*vec3(.32,.28,.22)+cool*vec3(.025,.055,.055))*occlusion;
      color+=spec*mix(vec3(.008),vec3(.075,.058,.027),material);
      float rim=smoothstep(.95,1.,radius);color+=rim*energy*vec3(.009,.07,.06);
      gl_FragColor=vec4(color,1.);}`;
    function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
    const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);const geometry=mesh(),buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,geometry.vertices,gl.STATIC_DRAW);
    for(const [name,size,offset] of [['position',3,0],['normal',3,12],['metal',1,24]]){const a=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,28,offset);}
    function texture(unit,name){const tex=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([50,48,39,255]));
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.uniform1i(gl.getUniformLocation(program,name),unit);return tex;}
    const ref=texture(0,'reference');
    const detailFilter=gl.getUniformLocation(program,'detailFilter');
    const sourceSize=gl.getUniformLocation(program,'sourceSize');gl.uniform2f(sourceSize,1672,940);
    gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);
    const angle=gl.getUniformLocation(program,'angle'),energy=gl.getUniformLocation(program,'energy');let lastAngle=0,lastEnergy=0,lost=false;
    const renderLimit=Math.min(4096,gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),...gl.getParameter(gl.MAX_VIEWPORT_DIMS));
    const stats={fragmentPrecision,sourceWidth:0,sourceHeight:0,bufferWidth:0,triangles:geometry.triangles,zMin:geometry.zMin,zMax:geometry.zMax,frames:0,maxSubmitMs:0,textureReady:false,medallions:6,referenceReconstruction:true};
    function render(degrees,power=0){
      lastAngle=degrees;lastEnergy=power;if(lost)return;
      const start=performance.now(),rect=canvas.getBoundingClientRect(),size=Math.max(1,Math.min(renderLimit,Math.ceil(rect.width*Math.min(2,devicePixelRatio||1))));
      if(canvas.width!==size||canvas.height!==size){canvas.width=canvas.height=size;gl.viewport(0,0,size,size);}
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform1f(detailFilter,size>=700?1:0);gl.uniform1f(angle,-degrees*Math.PI/180);gl.uniform1f(energy,power);gl.drawArrays(gl.TRIANGLES,0,geometry.vertices.length/7);
      stats.bufferWidth=size;stats.frames++;stats.maxSubmitMs=Math.max(stats.maxSubmitMs,performance.now()-start);canvas.dataset.renderer='webgl';
    }
    const img=new Image();img.onload=()=>{
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,ref);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
      stats.sourceWidth=img.naturalWidth;stats.sourceHeight=img.naturalHeight;
      gl.uniform2f(sourceSize,img.naturalWidth,img.naturalHeight);stats.textureReady=true;render(lastAngle,lastEnergy);
    };img.src='assets/img/lobby/approved-lobby-source.png';
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;canvas.dataset.renderer='fallback';canvas.parentElement.classList.remove('seal-webgl-ready');});
    canvas.addEventListener('webglcontextrestored',()=>{canvas.dataset.renderer='fallback';});
    new ResizeObserver(()=>render(lastAngle,lastEnergy)).observe(canvas);
    canvas.parentElement.classList.add('seal-webgl-ready');render(0);return {render,stats};
  }
  const api={create,mesh};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LobbySeal3D=api;
})(typeof window==='undefined'?globalThis:window);
