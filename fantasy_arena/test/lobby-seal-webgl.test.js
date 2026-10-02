const test=require('node:test'),assert=require('node:assert/strict');
const {mesh,glyphHeight}=require('../js/lobby-seal-webgl');
test('seal is finite extruded geometry with front bevels, back wall and directional normals',()=>{
 const {vertices:v,triangles}=mesh();assert.ok(triangles>10000);let min=Infinity,max=-Infinity,side=0;
 for(let i=0;i<v.length;i+=7){for(let k=0;k<7;k++)assert.ok(Number.isFinite(v[i+k]));min=Math.min(min,v[i+2]);max=Math.max(max,v[i+2]);if(Math.abs(v[i+5])<.8&&Math.hypot(v[i+3],v[i+4])>.5)side++;}
 assert.ok(max-min>.27,'actual front-to-back thickness');assert.ok(side>1000,'bevel/side faces react to fixed light');
});

test('all six reference reliefs have independent face and bevel triangles in one mesh',()=>{
 const {vertices:v}=mesh(),counts=new Map();
 for(let i=0;i<v.length;i+=7)if(v[i+6]>=2)counts.set(v[i+6],(counts.get(v[i+6])||0)+1);
 assert.deepEqual([...counts.keys()],[2,3,4,5,6,7]);
 for(const n of counts.values())assert.ok(n>1000);
});

test('six medallions share one circular profile and an evenly spaced orbit',()=>{
 const {vertices:v}=mesh(),centers=[],profiles=[];
 for(let id=2;id<8;id++){
  const points=[];for(let i=0;i<v.length;i+=7)if(v[i+6]===id)points.push([v[i],v[i+1],v[i+2]]);
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
  centers.push([cx,cy]);
  assert.ok(Math.abs(Math.hypot(cx,cy)-.70)<1e-6,'each center lies on the same orbit');
  const radii=points.map(p=>Math.hypot(p[0]-cx,p[1]-cy));
  assert.ok(Math.abs(Math.max(...radii)-.115)<1e-6,'same exact circular outer radius');
  profiles.push([...new Set(points.map((p,i)=>radii[i].toFixed(5)+':'+p[2].toFixed(5)))].sort());
 }
 for(const p of profiles)assert.deepEqual(p,profiles[0],'one shared face/bevel profile');
 const angles=centers.map(([x,y])=>(Math.atan2(y,x)+2*Math.PI)%(2*Math.PI)).sort((a,b)=>a-b);
 for(let i=0;i<6;i++)assert.ok(Math.abs((angles[(i+1)%6]-angles[i]+2*Math.PI)%(2*Math.PI)-Math.PI/3)<1e-6);
});

test('central rotating surface has no recessed bowl or raised eccentric rim',()=>{
 const {vertices:v}=mesh();let checked=0;
 for(let i=0;i<v.length;i+=7){const r=Math.hypot(v[i],v[i+1]);if(v[i+6]<2&&r<.63){assert.ok(Math.abs(v[i+2]-.014)<1e-6);checked++;}}
 assert.ok(checked>500);
});

test('official emblem colors become monochrome height while the original coin rim is excluded',()=>{
 const colors={earth:[180,120,35],fire:[220,80,12],wind:[25,165,120],water:[20,150,245],dark:[110,30,170],light:[245,185,70]};
 for(const [id,color] of Object.entries(colors)){
  const pixels=new Uint8ClampedArray(9*9*4);for(let k=0;k<pixels.length;k+=4)pixels.set([...color,255],k);
  const converted=glyphHeight(pixels,9,9,id),center=(4*9+4)*4;
  assert.ok(converted[center]>0,id+' retains its official colored shape as height');
  assert.equal(converted[0],0,id+' outer coin is excluded');
  for(let k=0;k<converted.length;k+=4){assert.equal(converted[k],converted[k+1]);assert.equal(converted[k],converted[k+2]);}
 }
});

test('relief contour discards a detached spark and bevels the retained solid shape',()=>{
 const width=64,pixels=new Uint8ClampedArray(width*width*4);
 for(let y=20;y<45;y++)for(let x=20;x<45;x++)pixels.set([230,90,10,255],(y*width+x)*4);
 pixels.set([255,100,10,255],(16*width+16)*4);
 const h=glyphHeight(pixels,width,width,'fire'),at=(x,y)=>h[(y*width+x)*4];
 assert.equal(at(16,16),0,'isolated spark is not a raised gold fleck');
 assert.ok(at(32,32)>at(20,32),'outer contour has a slope into a solid cap');
 assert.ok(at(32,32)>180,'retained flame body remains legible');
});
