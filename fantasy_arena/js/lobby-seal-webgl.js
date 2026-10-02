/* Front-facing, genuinely extruded seal. Local mesh rotates under fixed lights.
 * No networking, scene library, remote dependency or matching state lives here. */
(function(root){
  // One orbit and one profile. Order preserves the reference's six positions.
  const MEDALLIONS=['earth','fire','wind','water','dark','light'].map((id,i)=>{
    const angle=[-90,90,150,30,210,330][i]*Math.PI/180;
    return {id,x:Math.cos(angle)*.70,y:Math.sin(angle)*.70};
  });
  const centersGLSL=`vec2 medallionCenter(float id){${MEDALLIONS.map((m,i)=>`if(id<${(i+.5).toFixed(1)})return vec2(${m.x.toFixed(9)},${m.y.toFixed(9)});`).join('')}return vec2(0.);}`;
  // Use the official bitmap ONLY as relief height. No source RGB reaches the
  // gold material. Reject its surrounding coin rim and dark background stone.
  function glyphHeight(pixels,width,height,id){
    const out=new Uint8ClampedArray(pixels.length),signal=new Float32Array(width*height);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const k=(y*width+x)*4,r=pixels[k]/255,g=pixels[k+1]/255,b=pixels[k+2]/255;
      const radius=Math.hypot((x+.5)/width-.5,(y+.5)/height-.5)*2;
      let value=0;
      if(id==='earth'||id==='light')value=Math.max(0,r-b*1.2-.025);
      else if(id==='fire')value=Math.max(0,r-Math.max(g,b)*.58-.065);
      else if(id==='wind')value=Math.max(0,Math.max(g,b)-r*1.15-.04);
      else if(id==='water')value=Math.max(0,b-r*1.15-.045);
      else value=Math.max(0,Math.min(r,b)-g*1.12-.025);
      const edge=Math.max(0,Math.min(1,((id==='earth'?.85:.90)-radius)/.035));
      signal[y*width+x]=value*edge*pixels[k+3]/255;
    }
    // Separate the official silhouette from glow/grit, then form a bevel from
    // its distance to the contour. Brightness alone is never stamped as gold.
    const smooth=new Float32Array(signal.length),mask=new Uint8Array(signal.length);
    for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
      const p=y*width+x;let sum=0;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)sum+=signal[p+dy*width+dx]*(dx===0?2:1)*(dy===0?2:1);
      smooth[p]=sum/16;mask[p]=smooth[p]>(id==='earth'?.050:id==='fire'?.14:id==='dark'?.028:id==='wind'?.045:.075)?1:0;
    }
    // Close hairline gaps in rock and flame without retaining detached glow.
    if(id==='earth'||id==='fire'){
      const expanded=new Uint8Array(mask.length);
      for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){const p=y*width+x;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)expanded[p]=Math.max(expanded[p],mask[p+dy*width+dx]);}
      for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){const p=y*width+x;let v=1;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)v=Math.min(v,expanded[p+dy*width+dx]);mask[p]=v;}
    }
    // A small majority filter regularizes ragged glow edges into a clean cut
    // contour. It works on the silhouette, not on the finished material.
    const contour=new Uint8Array(mask);
    for(let y=2;y<height-2;y++)for(let x=2;x<width-2;x++){const p=y*width+x;let sum=0;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)sum+=mask[p+dy*width+dx];contour[p]=sum>=12?1:0;}
    mask.set(contour);
    // Drop detached sparks and one-pixel scratches without inventing a symbol.
    const visited=new Uint8Array(mask.length),minimum=Math.max(3,Math.round(width*height*.0007));
    for(let p=0;p<mask.length;p++)if(mask[p]&&!visited[p]){
      const component=[p];visited[p]=1;
      for(let q=0;q<component.length;q++){const at=component[q],x=at%width,y=Math.floor(at/width);
        for(const n of [x>0?at-1:-1,x<width-1?at+1:-1,y>0?at-width:-1,y<height-1?at+width:-1])if(n>=0&&mask[n]&&!visited[n]){visited[n]=1;component.push(n);}}
      let stray=false;
      if(id==='earth'&&component.length<width*height*.004){
        const xs=component.map(at=>at%width),ys=component.map(at=>Math.floor(at/width)),w=Math.max(...xs)-Math.min(...xs)+1,h=Math.max(...ys)-Math.min(...ys)+1;
        stray=Math.max(w/h,h/w)>5;
      }
      if(component.length<minimum||stray)for(const at of component)mask[at]=0;
    }
    const distance=new Float32Array(mask.length);for(let i=0;i<mask.length;i++)distance[i]=mask[i]?1000:0;
    for(let y=1;y<height;y++)for(let x=1;x<width-1;x++){const p=y*width+x;distance[p]=Math.min(distance[p],distance[p-1]+1,distance[p-width]+1,distance[p-width-1]+1.414,distance[p-width+1]+1.414);}
    for(let y=height-2;y>=0;y--)for(let x=width-2;x>0;x--){const p=y*width+x;distance[p]=Math.min(distance[p],distance[p+1]+1,distance[p+width]+1,distance[p+width+1]+1.414,distance[p+width-1]+1.414);}
    // Broad rock planes use a wider height filter; photographic grit must not
    // become hundreds of little specular bumps in the gold relief.
    const planes=new Float32Array(smooth);
    if(id==='earth')for(let y=4;y<height-4;y++)for(let x=4;x<width-4;x++){
      const p=y*width+x;let sum=0,weight=0;
      for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const sample=smooth[(y+dy)*width+x+dx],difference=(sample-smooth[p])/.05,w=Math.exp(-difference*difference-(dx*dx+dy*dy)/16);sum+=sample*w;weight+=w;}
      planes[p]=sum/weight;
    }
    for(let p=0;p<mask.length;p++){
      const bevel=Math.min(1,distance[p]/2.5),facets=(id==='earth'?.72:.84)+Math.min(1,planes[p]*1.7)*(id==='earth'?.28:.16);
      const value=Math.round(bevel*facets*255);out[p*4]=out[p*4+1]=out[p*4+2]=value;out[p*4+3]=255;
    }
    return out;
  }
  // Quilted from clean, unoccluded stone pixels in the approved source. Unlike
  // a mirrored micro-tile, each overlapping patch has its own source position;
  // original grain/contrast survive without a repeated wallpaper pattern.
  function stoneRepair(image){
    const source=document.createElement('canvas');source.width=image.naturalWidth;source.height=image.naturalHeight;
    const context=source.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
    const pixels=context.getImageData(0,0,source.width,source.height).data;
    const result=document.createElement('canvas');result.width=result.height=512;const dst=result.getContext('2d'),frame=dst.createImageData(512,512);
    const patches=[[1180,290,40,64],[911,285,39,66],[926,356,49,48]];
    function origin(x,y){let n=((x+37)*73856093^(y+71)*19349663)>>>0;const p=patches[n%patches.length];n=(Math.imul(n,1664525)+1013904223)>>>0;return[p[0]+n%(p[2]-32),p[1]+(n>>>10)%(p[3]-32),(n>>>23)&3];}
    const nodes=Array.from({length:33},(_,y)=>Array.from({length:33},(_,x)=>origin(x,y)));
    for(let y=0;y<512;y++)for(let x=0;x<512;x++){
      const gx=Math.floor(x/16),gy=Math.floor(y/16),u=x%16,v=y%16,tx=u/16,ty=v/16,wx=tx*tx*(3-2*tx),wy=ty*ty*(3-2*ty),at=(y*512+x)*4;
      for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
        const [sx,sy,turn]=nodes[gy+dy][gx+dx];let a=u+(1-dx)*16,b=v+(1-dy)*16;
        if(turn===1)[a,b]=[b,31-a];else if(turn===2)[a,b]=[31-a,31-b];else if(turn===3)[a,b]=[31-b,a];
        const src=((sy+b)*source.width+sx+a)*4,w=(dx?wx:1-wx)*(dy?wy:1-wy);
        for(let c=0;c<3;c++)frame.data[at+c]+=pixels[src+c]*w;
      }
      frame.data[at+3]=255;
    }
    dst.putImageData(frame,0,0);return result;
  }
  function mesh(){
    const data=[];
    function tri(a,b,c,metal){
      const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);
      const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1;
      for(const p of [a,b,c])data.push(...p,...n.map(x=>x/l),metal);
    }
    // Radius/Z pairs form stone face, recessed channels, raised metal tiers,
    // broad chamfers, a thick cylindrical edge and the back lip.
    const profile=[[0,.014,0],[.63,.014,0],[.642,.008,0],[.656,.034,1],[.668,.061,1],[.684,.032,1],[.704,.020,0],[.825,.020,0],[.845,.027,1],[.853,.057,1],[.868,.072,1],[.883,.033,1],[.904,.022,0],[.919,.041,1],[.931,.078,1],[.951,.088,1],[.969,.062,1],[.989,.006,1],[1,-.06,0],[.995,-.155,0],[.974,-.19,1],[.947,-.19,0]];
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
    // All six raised medallions use identical face, annulus and bevel dimensions.
    for(let i=0;i<6;i++) {
      const {x:cx,y:cy}=MEDALLIONS[i];
      const relief=[[0,.105],[.098,.105],[.101,.118],[.105,.124],[.109,.105],[.115,.039]];
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
      ${centersGLSL}
      void main(){float c=cos(angle),s=sin(angle);mat3 spin=mat3(c,s,0.,-s,c,0.,0.,0.,1.);
      float t=.105;mat3 tilt=mat3(1.,0.,0.,0.,cos(t),sin(t),0.,-sin(t),cos(t));
      vec3 p=tilt*spin*position;N=tilt*spin*normal;
      // Orthographic medal faces keep exact circles under every rotation. The
      // stone retains its shallow tilt, thick edge and original lighting.
      if(metal>1.5){vec3 center=vec3(medallionCenter(floor(metal+.1)-2.),0.);
        p=tilt*spin*center+spin*(position-center);N=spin*normal;}
      P=p;UV=position.xy*.5+.5;M=metal;
      gl_Position=vec4(p.x*.96,(p.y-.006)*.96,-p.z*.5,1.);}`;
    const fragmentPrecision=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT).precision>0?'highp':'mediump';
    const fragment=`precision ${fragmentPrecision} float;varying vec3 P;varying vec3 N;varying vec2 UV;varying float M;
      uniform sampler2D reference;uniform sampler2D glyphs;uniform sampler2D stone;uniform vec2 sourceSize;uniform float angle;uniform float energy;uniform float detailFilter;
      ${centersGLSL}
      float glyphAt(vec2 uv,float id){return texture2D(glyphs,vec2((id+clamp(uv.x,0.,1.))/6.,clamp(uv.y,0.,1.))).r;}
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
      float portrait=1.-smoothstep(121.,133.,length(xy-vec2(1065.,273.)));
      float playerBox=(1.-smoothstep(79.,84.,abs(xy.x-1065.)))*smoothstep(376.,382.,xy.y)*(1.-smoothstep(409.,416.,xy.y));
      float rankBox=(1.-smoothstep(107.,113.,abs(xy.x-1065.)))*smoothstep(410.,416.,xy.y)*(1.-smoothstep(503.,510.,xy.y));
      float plinthHalf=153.+clamp((xy.y-510.)/90.,0.,1.)*86.;
      float plinthBox=(1.-smoothstep(plinthHalf,plinthHalf+5.,abs(xy.x-1065.)))*smoothstep(505.,511.,xy.y);
      float erase=max(max(portrait,playerBox),max(rankBox,plinthBox));
      erase=max(erase,smoothstep(1218.,1235.,xy.x)*(1.-smoothstep(120.,140.,xy.y)));
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
      // Repair only hidden UI and the baked curved rim; retain real source stone
      // between them. Grain is sampled at source-pixel scale, never blurred into
      // a dark disc or multiplied down to eighteen percent of its contrast.
      vec3 centerStone=texture2D(stone,(xy-vec2(809.,74.))/512.).rgb;
      rebuilt=mix(centerStone,rebuilt,smoothstep(.62,.65,radius));
      tex=mix(tex,rebuilt,erase);
      float bowlRim=smoothstep(.47,.505,radius)*(1.-smoothstep(.615,.642,radius));
      tex=mix(tex,centerStone,bowlRim);
      // Erase the five uneven painted coins before placing the exact circles.
      // Only their old footprints change; surrounding runes and outer rim stay.
      float oldBadge=0.;
      oldBadge=max(oldBadge,1.-smoothstep(43.,48.,length(xy-vec2(1065.,95.))));
      oldBadge=max(oldBadge,1.-smoothstep(48.,54.,length(xy-vec2(850.,211.))));
      oldBadge=max(oldBadge,1.-smoothstep(48.,54.,length(xy-vec2(1280.,211.))));
      oldBadge=max(oldBadge,1.-smoothstep(51.,57.,length(xy-vec2(850.,421.))));
      oldBadge=max(oldBadge,1.-smoothstep(51.,57.,length(xy-vec2(1280.,421.))));
      tex=mix(tex,centerStone*vec3(.77,.94,1.04),oldBadge);
      float material=clamp(M,0.,1.);
      if(M>1.5){
        float id=floor(M+.1)-2.;
        vec2 rel=local-medallionCenter(id);float r=length(rel);
        vec2 uv=vec2(rel.x,-rel.y)/.196+.5;
        float h=glyphAt(uv,id)*(1.-smoothstep(.092,.098,r));
        float mark=smoothstep(.025,.20,h);
        vec3 face=texture2D(stone,(rel*350.+vec2(128.+id*43.,160.+id*21.))/512.).rgb*.70;
        float annulus=smoothstep(.097,.100,r);
        tex=mix(face,vec3(.36,.28,.16),annulus);
        float contact=glyphAt(uv+vec2(-.008,-.010),id)*(1.-mark);
        tex*=1.-contact*.48;
        tex=mix(tex,vec3(.40,.31,.17)+h*vec3(.085,.065,.035),mark);
        // Emboss the official contour and internal facets in the same fixed
        // warm/cool lights as the rim. Neither bitmap color nor its coin survives.
        if(r<.098){
          float d=1./256.;
          vec2 slope=vec2(glyphAt(uv-vec2(d,0.),id)-glyphAt(uv+vec2(d,0.),id),glyphAt(uv+vec2(0.,d),id)-glyphAt(uv-vec2(0.,d),id))*9.;
          float c=cos(angle),s=sin(angle);vec2 rotated=mat2(c,s,-s,c)*slope;
          n=normalize(vec3(rotated,1.));
        }
        material=mix(.1,.88,max(mark,annulus));
      }
      float diffuse=max(0.,dot(n,key)),cool=max(0.,dot(n,fill));
      float spec=pow(max(0.,dot(n,normalize(key+view))),mix(14.,56.,material));
      float occlusion=smoothstep(-.17,.07,P.z)*.3+.7;
      vec3 color=tex*(vec3(.70)+diffuse*vec3(.32,.28,.22)+cool*vec3(.025,.055,.055))*occlusion;
      color+=spec*mix(vec3(.008),vec3(.075,.058,.027),material);
      if(M>1.5){color=tex*(vec3(.36)+diffuse*vec3(.72,.66,.53)+cool*vec3(.045,.09,.10));color+=spec*material*vec3(.24,.18,.095);}
      float rim=smoothstep(.95,1.,radius);color+=rim*energy*vec3(.009,.07,.06);
      gl_FragColor=vec4(color,1.);}`;
    function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
    const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);const geometry=mesh(),buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,geometry.vertices,gl.STATIC_DRAW);
    for(const [name,size,offset] of [['position',3,0],['normal',3,12],['metal',1,24]]){const a=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,28,offset);}
    function texture(unit,name){const tex=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([50,48,39,255]));
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.uniform1i(gl.getUniformLocation(program,name),unit);return tex;}
    const ref=texture(0,'reference'),glyphTexture=texture(1,'glyphs'),stoneTexture=texture(2,'stone');
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,glyphTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));
    const detailFilter=gl.getUniformLocation(program,'detailFilter');
    const sourceSize=gl.getUniformLocation(program,'sourceSize');gl.uniform2f(sourceSize,1672,940);
    gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);
    const angle=gl.getUniformLocation(program,'angle'),energy=gl.getUniformLocation(program,'energy');let lastAngle=0,lastEnergy=0,lost=false;
    const renderLimit=Math.min(4096,gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),...gl.getParameter(gl.MAX_VIEWPORT_DIMS));
    const stats={fragmentPrecision,sourceWidth:0,sourceHeight:0,bufferWidth:0,triangles:geometry.triangles,zMin:geometry.zMin,zMax:geometry.zMax,frames:0,maxSubmitMs:0,textureReady:false,glyphsReady:false,medallions:6,referenceReconstruction:true,continuousCenter:true,glyphSources:MEDALLIONS.map(m=>'assets/img/icons/'+m.id+'.png')};
    function render(degrees,power=0){
      lastAngle=degrees;lastEnergy=power;if(lost)return;
      const start=performance.now(),rect=canvas.getBoundingClientRect(),size=Math.max(1,Math.min(renderLimit,Math.ceil(rect.width*Math.min(2,devicePixelRatio||1))));
      if(canvas.width!==size||canvas.height!==size){canvas.width=canvas.height=size;gl.viewport(0,0,size,size);}
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform1f(detailFilter,size>=700?1:0);gl.uniform1f(angle,-degrees*Math.PI/180);gl.uniform1f(energy,power);gl.drawArrays(gl.TRIANGLES,0,geometry.vertices.length/7);
      stats.bufferWidth=size;stats.frames++;stats.maxSubmitMs=Math.max(stats.maxSubmitMs,performance.now()-start);canvas.dataset.renderer='webgl';
    }
    function fallback(){lost=true;stats.textureReady=false;canvas.dataset.renderer='fallback';canvas.parentElement.classList.remove('seal-webgl-ready');}
    const img=new Image();img.onerror=fallback;img.onload=()=>{try{
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,ref);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
      const repair=stoneRepair(img);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,stoneTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,repair);
      stats.sourceWidth=img.naturalWidth;stats.sourceHeight=img.naturalHeight;
      gl.uniform2f(sourceSize,img.naturalWidth,img.naturalHeight);stats.textureReady=stats.glyphsReady;render(lastAngle,lastEnergy);
    }catch(e){fallback();}};img.src='assets/img/lobby/approved-lobby-source.png';
    const atlas=document.createElement('canvas');atlas.width=256*6;atlas.height=256;
    const ctx=atlas.getContext('2d',{willReadFrequently:true});
    Promise.all(MEDALLIONS.map((m,i)=>new Promise((resolve,reject)=>{
      const icon=new Image();icon.onload=()=>{try{ctx.clearRect(i*256,0,256,256);ctx.drawImage(icon,i*256,0,256,256);
        const pixels=ctx.getImageData(i*256,0,256,256);pixels.data.set(glyphHeight(pixels.data,256,256,m.id));ctx.putImageData(pixels,i*256,0);resolve();}catch(e){reject(e);}};
      icon.onerror=reject;icon.src=stats.glyphSources[i];
    }))).then(()=>{
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,glyphTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlas);
      stats.glyphsReady=true;stats.textureReady=stats.sourceWidth>0;render(lastAngle,lastEnergy);
    }).catch(fallback);
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;canvas.dataset.renderer='fallback';canvas.parentElement.classList.remove('seal-webgl-ready');});
    canvas.addEventListener('webglcontextrestored',()=>{canvas.dataset.renderer='fallback';});
    new ResizeObserver(()=>render(lastAngle,lastEnergy)).observe(canvas);
    canvas.parentElement.classList.add('seal-webgl-ready');render(0);return {render,stats};
  }
  const api={create,mesh,glyphHeight};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LobbySeal3D=api;
})(typeof window==='undefined'?globalThis:window);
