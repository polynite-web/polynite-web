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
write('examples/runtime/index.html','<html><head><base href="/"><script id="pn-build-version">window.__pnBuildVersion="v0001";</script></head><body>isolated viewer</body></html>');
write('web/version.txt','v0267\n');write('web/app.js','old public js');write('web/app.wasm','old public wasm');write('web/robots.txt','public robots');write('web/custom.txt','keep');
const before=hash(fs.readFileSync(path.join(root,'web/app.wasm')));
// Recompilation after the first directory swap must not affect the second stage.
const rename=fs.renameSync;let changedDuringPrepare=false;
fs.renameSync=function(source,target){const result=rename(source,target);if(target===path.join(root,'web/dev')&&!changedDuringPrepare){changedDuringPrepare=true;fs.appendFileSync(path.join(root,'dev/app.js'),'/* concurrent build */');}return result;};
try{prepare(root);}finally{fs.renameSync=rename;}
assert(changedDuringPrepare);
const dev=verify(path.join(root,'web/dev')),rel=verify(path.join(root,'web/rel'));
assert.ok(fs.readFileSync(path.join(root,'web/dev/examples/runtime/index.html'),'utf8').includes('<base href="/dev/">'));
assert.ok(fs.readFileSync(path.join(root,'web/rel/examples/runtime/index.html'),'utf8').includes('<base href="/rel/">'));
assert.ok(fs.readFileSync(path.join(root,'web/rel/examples/runtime/index.html'),'utf8').includes('window.__pnEngineBase='+JSON.stringify(rel.engineBase)));
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
// A locked Explorer folder must not prevent publication. A failure partway
// through that fallback must restore every changed file and retain custom data.
let locked=false,partial=false;
const publicDir=path.join(root,'web'),oldFiles=new Map();
function snapshot(dir,prefix=''){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const name=prefix+e.name;if(e.isDirectory())snapshot(path.join(dir,e.name),name+'/');else oldFiles.set(name,hash(fs.readFileSync(path.join(dir,e.name))));}}
snapshot(publicDir);
function folderLock(source,target){if(source===publicDir){locked=true;const error=Error('simulated Explorer folder lock');error.code='EPERM';throw error;}return rename(source,target);}
fs.renameSync=function(source,target){if(String(source).includes('public-files-')&&path.basename(source)==='next'&&target===path.join(publicDir,'app.js')&&!partial){partial=true;throw Error('simulated file installation failure');}return folderLock(source,target);};
try{assert.throws(()=>publish(root),/simulated file installation failure/);}finally{fs.renameSync=rename;}
assert(locked&&partial);for(const [name,digest]of oldFiles)assert.equal(hash(fs.readFileSync(path.join(publicDir,name))),digest,name);
const afterFiles=new Map(oldFiles);oldFiles.clear();snapshot(publicDir);assert.deepEqual(oldFiles,afterFiles,'Rollback must remove newly installed files');
fs.renameSync=folderLock;
try{publish(root);}finally{fs.renameSync=rename;}
console.log('PASS: Explorer folder lock fallback and complete rollback after a partial file installation.');
assert.ok(fs.readFileSync(path.join(root,'web/examples/runtime/index.html'),'utf8').includes('<base href="/">'));
assert.ok(fs.readFileSync(path.join(root,'web/examples/runtime/index.html'),'utf8').includes('window.__pnBuildVersion='+JSON.stringify(rel.version)));
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
// Exercise the actual batch wrappers with a stub: no real Git publication.
if(process.platform==='win32'){
 const {spawnSync}=require('node:child_process'),cli=path.join(root,'cli');fs.mkdirSync(cli);
 for(const name of ['deploy_dev_to_site.bat','deploy_rel_to_site.bat'])fs.copyFileSync(path.join(__dirname,'..',name),path.join(cli,name));
 fs.writeFileSync(path.join(cli,'deploy_site.cjs'),'require("node:fs").appendFileSync(__dirname+"/calls.txt",process.argv[2]+"\\n");if(process.argv[2]===process.env.PN_TEST_FAIL)process.exitCode=1;');
 function run(script,args,expected,status=0,fail=''){
  const calls=path.join(cli,'calls.txt');fs.writeFileSync(calls,'');
  const result=spawnSync('cmd.exe',['/d','/c',script,...args],{cwd:cli,encoding:'utf8',timeout:10000,windowsHide:true,env:{...process.env,PN_TEST_FAIL:fail}});
  assert.ifError(result.error);assert.equal(result.status,status,result.stdout+result.stderr);
  assert.equal(fs.readFileSync(calls,'utf8'),expected.map(action=>action+'\n').join(''));
 }
 run('deploy_dev_to_site.bat',['--no-pause'],['prepare','sync-dev']);
 run('deploy_rel_to_site.bat',['--no-pause'],['publish','sync-rel']);
 run('deploy_dev_to_site.bat',['--no-pause','--local'],['prepare']);
 run('deploy_rel_to_site.bat',['--local','--no-pause'],['publish']);
 for(const script of ['deploy_dev_to_site.bat','deploy_rel_to_site.bat']){
  run(script,['--help'],[]);run(script,['--no-pause','--unknown'],[],1);
 }
 run('deploy_dev_to_site.bat',['--no-pause'],['prepare'],1,'prepare');
 run('deploy_dev_to_site.bat',['--no-pause'],['prepare','sync-dev'],1,'sync-dev');
 run('deploy_rel_to_site.bat',['--no-pause'],['publish'],1,'publish');
 run('deploy_rel_to_site.bat',['--no-pause'],['publish','sync-rel'],1,'sync-rel');
 console.log('PASS: unattended batch publication, local-only mode, option validation and failure exit codes.');
}
