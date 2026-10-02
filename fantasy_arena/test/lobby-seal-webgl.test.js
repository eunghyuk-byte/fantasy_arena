const test=require('node:test'),assert=require('node:assert/strict');
const {mesh}=require('../js/lobby-seal-webgl');
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
