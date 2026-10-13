'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),zlib=require('node:zlib'),crypto=require('node:crypto');
const {prepare,publish,verify}=require('../deploy_site.cjs');
const root=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'polynite-deploy-'));fs.mkdirSync(path.join(root,'dev'),{recursive:true});fs.mkdirSync(path.join(root,'web'),{recursive:true});
const write=(name,text)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
// Valid empty Wasm with a compressible custom section; no real project assets needed.
function leb(value){const out=[];do{let byte=value&127;value>>>=7;if(value)byte|=128;out.push(byte);}while(value);return out;}
const custom=Buffer.concat([Buffer.from([7]),Buffer.from('fixture'),Buffer.alloc(2048)]);
write('dev/app.wasm',Buffer.concat([Buffer.from([0,97,115,109,1,0,0,0,0,...leb(custom.length)]),custom]));
write('dev/app.js','var wasmImports={};function getWasmImports(){var imports={a:wasmImports};return imports;}/*'+'fixture '.repeat(256)+'*/');
const html='<html><head><meta name="robots" content="index, follow"></head><body><script src="backend.js"></script></body></html>';
write('dev/index.html',html);write('dev/app.html',html);write('dev/version.txt','v0010\n');write('dev/tier.txt','dev\n');write('dev/backend.js','window.backend="webgpu";');
write('dev/models/a model.glb','model');write('dev/models/index.txt','stale.glb 5\n');write('dev/app_before_jolt.wasm','old');write('dev/demo/new.json','{"scene":1}\r\n');
write('site.webmanifest',JSON.stringify({id:'/',start_url:'/',scope:'/',icons:[{src:'/assets/icon.png'}]}));write('assets/icon.png','icon');
write('web/version.txt','v0267\n');write('web/app.js','old public js');write('web/app.wasm','old public wasm');write('web/robots.txt','public robots');write('web/custom.txt','keep');
const before=hash(fs.readFileSync(path.join(root,'web/app.wasm')));
// Recompilation after the first directory swap must not affect the second stage.
const rename=fs.renameSync;let changedDuringPrepare=false;
fs.renameSync=function(source,target){const result=rename(source,target);if(target===path.join(root,'web/dev')&&!changedDuringPrepare){changedDuringPrepare=true;fs.appendFileSync(path.join(root,'dev/app.js'),'/* concurrent build */');}return result;};
try{prepare(root);}finally{fs.renameSync=rename;}
assert(changedDuringPrepare);
const dev=verify(path.join(root,'web/dev')),rel=verify(path.join(root,'web/rel'));
function cachePolicy(url){
 const text=fs.readFileSync(path.join(root,'web/_headers'),'utf8');let match=false,values=[];
 for(const line of text.split(/\r?\n/)){
  if(line.startsWith('/'))match=new RegExp('^'+line.replace(/[.+?^$(){}|[\]\\]/g,'\\$&').replace(/\*/g,'.*')+'$').test(url);
  else if(match && /^\s+Cache-Control:/i.test(line))values.push(line.split(':').slice(1).join(':').trim());
 }
 return values.join(', ');
}
for(const url of ['/rel/'+rel.engineBase+'app.wasm','/'+rel.engineBase+'app.js'])
 assert.equal(cachePolicy(url),'public, max-age=31536000, immutable','hashed engine must not also inherit no-cache');
assert.equal(cachePolicy('/rel/version.txt'),'no-cache');assert.equal(cachePolicy('/rel/'),'no-cache');
assert.equal(cachePolicy('/dev/'+dev.engineBase+'app.wasm'),'no-cache');
assert.equal(dev.version,'v0268');assert.equal(rel.version,dev.version);assert.equal(dev.tier,'dev');assert.equal(rel.tier,'release');
assert.equal(hash(fs.readFileSync(path.join(root,'web/app.wasm'))),before);
assert.equal(dev.files['app.wasm'].sha256,rel.files['app.wasm'].sha256);
assert.equal(dev.files['app.js'].sha256,rel.files['app.js'].sha256);
assert.equal(rel.files['app.wasm.br'].sha256,dev.files['app.wasm.br'].sha256);
assert(!fs.existsSync(path.join(root,'web/rel/app_before_jolt.wasm')));
assert.equal(fs.readFileSync(path.join(root,'web/rel/models/index.txt'),'utf8'),'a model.glb 5\n');
assert.equal(fs.readFileSync(path.join(root,'web/rel/demo/new.json'),'utf8'),'{"scene":1}\n');
assert(fs.readFileSync(path.join(root,'web/rel/index.html'),'utf8').includes('window.__pnDeployTier="release"'));
assert.equal(JSON.parse(fs.readFileSync(path.join(root,'web/rel/site.webmanifest'),'utf8')).scope,'./');
assert.equal(hash(zlib.brotliDecompressSync(fs.readFileSync(path.join(root,'web/rel/app.wasm.br')))),rel.files['app.wasm'].sha256);
const original=fs.readFileSync(path.join(root,'web/rel/app.js'));fs.appendFileSync(path.join(root,'web/rel/app.js'),'tampered');
assert.throws(()=>publish(root),/Candidate changed/);assert.equal(hash(fs.readFileSync(path.join(root,'web/app.wasm'))),before);
fs.writeFileSync(path.join(root,'web/rel/app.js'),original);
// Failure after moving the public directory must restore the complete old site.
let rejectedSwap=false;
fs.renameSync=function(source,target){if(target===path.join(root,'web')&&source.includes('public-full-')&&!rejectedSwap){rejectedSwap=true;throw Error('simulated promotion failure');}return rename(source,target);};
try{assert.throws(()=>publish(root),/simulated promotion failure/);}finally{fs.renameSync=rename;}
assert(rejectedSwap);assert.equal(hash(fs.readFileSync(path.join(root,'web/app.wasm'))),before);
assert.equal(fs.readFileSync(path.join(root,'web/custom.txt'),'utf8'),'keep');
publish(root);
assert.equal(hash(fs.readFileSync(path.join(root,'web/app.wasm'))),rel.files['app.wasm'].sha256);
assert.equal(hash(fs.readFileSync(path.join(root,'web/app.js'))),rel.files['app.js'].sha256);
assert.equal(fs.readFileSync(path.join(root,'web/version.txt'),'utf8').trim(),rel.version);
assert.equal(fs.readFileSync(path.join(root,'web/custom.txt'),'utf8'),'keep');
assert(fs.readFileSync(path.join(root,'web/index.html'),'utf8').includes('content="index, follow"'));
assert.equal(verify(path.join(root,'web/rel')).version,rel.version);
assert.equal(verify(path.join(root,'web/dev')).tier,'dev');
console.log('PASS: dev/rel modes, versions, identical engines, compression, public isolation, tamper rejection and promotion.');

assert(rel.engineBase.startsWith('engine/'));
assert.equal(rel.files[rel.engineBase+'app.wasm'].sha256,rel.files['app.wasm'].sha256);
const firstEngine=rel.engineBase;
// A new publication keeps the old immutable URLs available to open pages.
prepare(root);publish(root);
const next=verify(path.join(root,'web/rel'));
assert.notEqual(next.engineBase,firstEngine);
assert(fs.existsSync(path.join(root,'web',firstEngine,'app.wasm')));
for(let i=0;i<3;i++){fs.appendFileSync(path.join(root,'dev/app.js'),'/* revision '+i+' */');prepare(root);publish(root);}
const publicManifest=JSON.parse(fs.readFileSync(path.join(root,'web/deploy-manifest.json'),'utf8'));
assert.equal(publicManifest.engineHistory.length,3);
assert(!fs.existsSync(path.join(root,'web',firstEngine,'app.wasm')));
console.log('PASS: recompilation race fixed, complete publication rollback, immutable engine URLs and bounded archive retention.');
// Changes during snapshot capture are rejected before replacing either stage.
const stageVersion=verify(path.join(root,'web/rel')).version;
const sourceJS=fs.readFileSync(path.join(root,'dev/app.js')),writeFile=fs.writeFileSync;
let changedDuringCapture=false;
fs.writeFileSync=function(file,...args){const result=writeFile(file,...args);if(String(file).includes('snapshot-')&&String(file).endsWith('app.js')&&!changedDuringCapture){changedDuringCapture=true;fs.appendFileSync(path.join(root,'dev/app.js'),'/* changed during capture */');}return result;};
try{assert.throws(()=>prepare(root),/Build changed during snapshot/);}finally{fs.writeFileSync=writeFile;fs.writeFileSync(path.join(root,'dev/app.js'),sourceJS);}
assert(changedDuringCapture);assert.equal(verify(path.join(root,'web/rel')).version,stageVersion);
// The first replacement is restored if the second replacement cannot be installed.
const devVersion=verify(path.join(root,'web/dev')).version;
let failedRel=false;
fs.renameSync=function(source,target){if(target===path.join(root,'web/rel')&&String(source).includes('.deploy-work')&&!failedRel){failedRel=true;throw Error('simulated rel swap failure');}return rename(source,target);};
try{assert.throws(()=>prepare(root),/simulated rel swap failure/);}finally{fs.renameSync=rename;}
assert(failedRel);assert.equal(verify(path.join(root,'web/dev')).version,devVersion);assert.equal(verify(path.join(root,'web/rel')).version,stageVersion);
console.log('PASS: changing snapshot inputs rejected; both prior stage directories restored after a partial stage swap.');