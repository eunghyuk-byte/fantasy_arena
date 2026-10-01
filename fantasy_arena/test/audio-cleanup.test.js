const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
test('retired slash/parry assets and warmup references are removed while death fallback survives',async()=>{
 const fetched=[];class AudioContext {constructor(){this.state='running';this.destination={};}createGain(){return {gain:{},connect(){}};}}
 const g={window:{AudioContext},fetch:async url=>{fetched.push(url);return {ok:false};},setTimeout,clearTimeout,console};vm.createContext(g);vm.runInContext(fs.readFileSync(path.join(root,'js/sfx.js'),'utf8')+'\nthis.sfx=Sfx;',g);g.sfx.warmup();await new Promise(r=>setImmediate(r));
 assert.ok(!fetched.some(x=>/sfx_(slash|parry)/.test(x)));assert.ok(fetched.some(x=>x.includes('sfx_death')));assert.equal(typeof g.sfx.playDeath,'function');assert.equal(g.sfx.playSlash,undefined);assert.equal(g.sfx.playParry,undefined);
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json')));
 for(const name of ['sfx_slash','sfx_parry']){assert.equal(fs.existsSync(path.join(root,'assets/audio/sfx',name+'.ogg')),false);assert.ok(!manifest.items.some(x=>x.path.includes(name)));}
 assert.ok(fs.existsSync(path.join(root,'assets/audio/sfx/sfx_death.ogg')));
});
test('no live script uses retired legacy sequence names or dynamic Sfx/Vfx lookups',()=>{
 const source=fs.readdirSync(path.join(root,'js')).filter(x=>x.endsWith('.js')).map(x=>fs.readFileSync(path.join(root,'js',x),'utf8')).join('\n');
 assert.doesNotMatch(source,/attackSeq|parrySeq|playSlash|playParry|(?:Vfx|Sfx)\s*\[/);assert.match(source,/Vfx\.death\(ghost\)/);assert.match(source,/Sfx\.playDeath\(\)/);
});
