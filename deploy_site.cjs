// Prepare dev/rel together; promote the exact validated rel snapshot.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),{spawnSync}=require('node:child_process');
const MAX_FILE=25*1024*1024,MANIFEST='deploy-manifest.json';
const started=Date.now();
const progress=message=>console.log('[polynite +'+((Date.now()-started)/1000).toFixed(1)+'s] '+message);
const siteFiles=['robots.txt','sitemap.xml','sitemap-app.xml','site.webmanifest','sw.js','404.html','_redirects','favicon.ico'];
const siteDirs=['docs','mcp','support','privacy','terms','tutorials','tutorial-view','atelier','examples','showcase'];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function inside(base,relative){
 if(path.isAbsolute(relative)||relative.split(/[\\/]/).some(p=>p==='..'||p===''))throw Error('Invalid payload path: '+relative);
 const file=path.resolve(base,relative),prefix=path.resolve(base)+path.sep;
 if(!file.startsWith(prefix))throw Error('Path escapes destination: '+file);
 return file;
}
function files(dir,prefix=''){
 const result=[];
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const name=prefix+entry.name;
  if(entry.isSymbolicLink())throw Error('Symlinks are not deployable: '+name);
  if(entry.isDirectory())result.push(...files(path.join(dir,entry.name),name+'/'));
  else if(entry.isFile())result.push(name);
 }
 return result.sort();
}
function write(dir,name,bytes){const file=inside(dir,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);}
function copy(source,target,name){write(target,name,fs.readFileSync(inside(source,name)));}
function removeWork(root,dir){
 const base=path.resolve(root,'.deploy-work'),resolved=path.resolve(dir);
 if(!resolved.startsWith(base+path.sep))throw Error('Unsafe temporary directory: '+dir);
 if(fs.existsSync(resolved))fs.rmSync(resolved,{recursive:true});
}
function checkPair(dir){
 const result=spawnSync(process.execPath,[path.join(__dirname,'check_engine_pair.cjs'),dir],{encoding:'utf8',windowsHide:true});
 if(result.error)throw result.error;
 if(result.status!==0)throw Error(result.stderr||result.stdout||'Engine pair validation failed');
}
function payload(source){
 return files(source).filter(name=>{
  const parts=name.split('/'),base=path.basename(name);
  if(parts.some(p=>p.startsWith('.'))||['dev','rel','engine'].includes(parts[0])||siteDirs.includes(parts[0]))return false;
  if(base===MANIFEST||base==='tier.txt'||base==='version.txt'||base==='index.txt'&&parts[0]==='models')return false;
  if(/\.(?:bat|cmd|cwc|cwmake|cjs|log|map|symbols|gz|br)$/i.test(base)||/^app_before_|^appGL\./i.test(base))return false;
  return fs.statSync(inside(source,name)).size<=MAX_FILE;
 });
}
function configure(dir,tier,version,publicPage=false,engineBase=''){
 write(dir,'tier.txt',tier+'\n');write(dir,'version.txt',version+'\n');
 for(const name of ['index.html','app.html','tutorial-view/index.html','examples/runtime/index.html']){
  const file=inside(dir,name);if(!fs.existsSync(file))continue;
  let html=fs.readFileSync(file,'utf8');
  html=html.replace(/<script id="pn-(?:build-version|deploy-config)">[^]*?<\/script>/g,'');
  html=html.replace('<head>','<head><script id="pn-deploy-config">window.__pnDeployTier='+JSON.stringify(tier)+';window.__pnBuildVersion='+JSON.stringify(version)+';window.__pnEngineBase='+JSON.stringify(engineBase)+';</script>');
  if(name.endsWith('/index.html'))html=html.replace(/<base href="[^"]*">/,'<base href="'+(publicPage?'/':tier==='dev'?'/dev/':'/rel/')+'">');
  html=html.replace(/<meta name="robots"[^>]*>/,'<meta name="robots" content="'+(publicPage?'index':'noindex')+', follow">');
  html=html.replace(/href="\/(assets\/[^" ]+|site\.webmanifest)"/g,'href="$1"');
  html=html.replace('navigator.serviceWorker.register("/sw.js", { scope: "/" })','navigator.serviceWorker.register("sw.js", { scope: "./" })');
  write(dir,name,html);
 }
 const manifest=inside(dir,'site.webmanifest');
 if(fs.existsSync(manifest)){
  const pwa=JSON.parse(fs.readFileSync(manifest,'utf8'));
  pwa.id='./';pwa.start_url='./';pwa.scope='./';
  for(const icon of pwa.icons||[])icon.src=icon.src.replace(/^\//,'');
  write(dir,'site.webmanifest',JSON.stringify(pwa,null,2)+'\n');
 }
}
function compress(dir,cache=new Map(),selected=files(dir)){
 progress('Compressing '+selected.length+' files (gzip + Brotli quality 6).');
 let reported=Date.now();
 for(const name of selected){
  if(name===MANIFEST||!(/\.(?:wasm|js|css|html|json|txt|svg|pane|layout|webmanifest)$/i.test(name)))continue;
  const bytes=fs.readFileSync(inside(dir,name));if(bytes.length<512)continue;
  const key=hash(bytes);let pair=cache.get(key);
  if(!pair){
   if(bytes.length>=1024*1024||Date.now()-reported>=2000){progress('Compressing '+name+' ('+(bytes.length/1048576).toFixed(1)+' MiB)');reported=Date.now();}
   pair={gz:zlib.gzipSync(bytes,{level:9}),br:zlib.brotliCompressSync(bytes,{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:6}})};cache.set(key,pair);
  }
  for(const [ext,packed]of Object.entries(pair))if(packed.length<bytes.length)write(dir,name+'.'+ext,packed);
 }
}
function normalize(dir){
 for(const name of files(dir))if(/\.(?:js|css|html|json|txt|svg|pane|layout|webmanifest)$/i.test(name)||['_headers','_redirects'].includes(path.basename(name))){
  const bytes=fs.readFileSync(inside(dir,name));if(bytes.includes(0))continue;
  const text=bytes.toString('utf8');if(text.includes('\r\n'))write(dir,name,text.replace(/\r\n/g,'\n'));
 }
}
function manifest(dir,tier,version,sourceVersion,engineHistory=[]){
 const entries={};for(const name of files(dir))if(name!==MANIFEST){const bytes=fs.readFileSync(inside(dir,name));if(bytes.length>MAX_FILE)throw Error('Cloudflare Pages file limit exceeded: '+name);entries[name]={bytes:bytes.length,sha256:hash(bytes)};}
 const value={format:1,tier,version,sourceVersion,engineBase:engineHistory[0]||'',engineHistory,files:entries};write(dir,MANIFEST,JSON.stringify(value,null,2)+'\n');return value;
}
function verify(dir){
 const value=JSON.parse(fs.readFileSync(inside(dir,MANIFEST),'utf8'));
 if(value.format!==1||!value.files||!/^v\d+$/.test(value.version))throw Error('Invalid deployment manifest');
 for(const [name,entry]of Object.entries(value.files)){
  const bytes=fs.readFileSync(inside(dir,name));if(bytes.length!==entry.bytes||hash(bytes)!==entry.sha256)throw Error('Candidate changed after preparation: '+name);
 }
 const actual=files(dir).filter(name=>name!==MANIFEST);if(actual.length!==Object.keys(value.files).length)throw Error('Unexpected files in candidate');
 if(fs.readFileSync(inside(dir,'tier.txt'),'utf8').trim()!==value.tier||fs.readFileSync(inside(dir,'version.txt'),'utf8').trim()!==value.version)throw Error('Candidate mode/version mismatch');
 for(const name of ['app.js','app.wasm'])for(const ext of ['gz','br']){
  const packed=inside(dir,name+'.'+ext);if(!fs.existsSync(packed))throw Error('Missing compressed engine: '+name+'.'+ext);
  const unpacked=ext==='gz'?zlib.gunzipSync(fs.readFileSync(packed)):zlib.brotliDecompressSync(fs.readFileSync(packed));
  if(hash(unpacked)!==value.files[name].sha256)throw Error('Compression mismatch: '+name+'.'+ext);
 }
 if(value.engineBase){
  if(!/^engine\/[0-9a-f]{64}\/$/.test(value.engineBase))throw Error('Invalid versioned engine path');
  for(const name of ['app.js','app.wasm']){
   const mapped=value.engineBase+name;
   if(!value.files[mapped]||value.files[mapped].sha256!==value.files[name].sha256)throw Error('Versioned engine mismatch: '+name);
  }
 }
 checkPair(dir);return value;
}
function replaceDirectories(root,entries){
 const records=[];
 try{
  for(const {name,source}of entries){
   if(!['dev','rel','web'].includes(name))throw Error('Invalid deployment directory');
   const target=path.resolve(root,'web',...(name==='web'?[]:[name])),backup=path.resolve(root,'.deploy-work',name+'-old-'+process.pid);
   if(!path.resolve(source).startsWith(path.resolve(root,'.deploy-work')+path.sep))throw Error('Unsafe staging path');
   const record={target,backup,source,installed:false};records.push(record);
   // All recursive moves stay inside the named site's web/ and .deploy-work/ folders.
   if(fs.existsSync(target))fs.renameSync(target,backup);
   fs.renameSync(source,target);record.installed=true;
  }
 }catch(error){
  for(const record of records.reverse()){
   if(record.installed)fs.renameSync(record.target,record.source);
   if(fs.existsSync(record.backup))fs.renameSync(record.backup,record.target);
  }
  throw error;
 }
 for(const record of records)removeWork(root,record.backup);
}
// Explorer can lock a directory while its files remain replaceable. Commit
// checked payload files atomically, with rollback; leave unrelated files alone.
function publishFiles(root,source,target,release){
 const backup=path.join(root,'.deploy-work','public-files-'+process.pid),records=[];
 fs.mkdirSync(backup,{recursive:true});let keep=false;
 const names=[...new Set([...Object.keys(release.files),...(release.removedFiles||[])])].filter(n=>n!==MANIFEST).concat(MANIFEST);
 function install(name,from){
  const dest=inside(target,name),temp=path.join(backup,'next');
  fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(from,temp);fs.renameSync(temp,dest);
 }
 try{
  for(const name of names){
   const from=inside(source,name),dest=inside(target,name),exists=fs.existsSync(dest),next=fs.existsSync(from);
   if(!exists&&!next || exists&&next&&hash(fs.readFileSync(dest))===hash(fs.readFileSync(from)))continue;
   if(exists)copy(target,path.join(backup,'old'),name);
   if(next)install(name,from);else fs.unlinkSync(dest);
   records.push({name,exists});
  }
  for(const [name,entry]of Object.entries(release.files))if(hash(fs.readFileSync(inside(target,name)))!==entry.sha256)throw Error('Published file differs from validated release: '+name);
  checkPair(target);
 }catch(error){
  const errors=[];
  for(const r of records.reverse())try{if(r.exists)install(r.name,inside(path.join(backup,'old'),r.name));else fs.unlinkSync(inside(target,r.name));}catch(e){errors.push(e.message);}
  if(errors.length){keep=true;throw Error(error.message+'; rollback incomplete. Backups retained at '+backup+': '+errors.join('; '));}
  throw error;
 }finally{if(!keep)removeWork(root,backup);}
}
function capture(root,source,target){
 const inputs=new Map();for(const name of payload(source))inputs.set(name,inside(source,name));
 for(const name of siteFiles)if(fs.existsSync(path.join(root,name)))inputs.set(name,path.join(root,name));
 for(const dir of ['assets',...siteDirs])if(fs.existsSync(path.join(root,dir)))for(const file of files(path.join(root,dir))){const name=dir+'/'+file;if(fs.statSync(inside(root,name)).size<=MAX_FILE)inputs.set(name,inside(root,name));}
 const versionFile=path.join(source,'version.txt'),versionBytes=fs.readFileSync(versionFile);
 const signatures=new Map([...inputs].map(([name,file])=>[name,hash(fs.readFileSync(file))]));
 for(const [name,file]of inputs)write(target,name,fs.readFileSync(file));
 for(const [name,file]of inputs)if(hash(fs.readFileSync(file))!==signatures.get(name)||hash(fs.readFileSync(inside(target,name)))!==signatures.get(name))throw Error('Build changed during snapshot: '+name);
 if(!fs.readFileSync(versionFile).equals(versionBytes)||payload(source).some(name=>!inputs.has(name)))throw Error('Build changed during snapshot');
 checkPair(target);return versionBytes.toString('utf8').trim();
}
function engineId(dir){return hash(fs.readFileSync(inside(dir,'app.js')))+hash(fs.readFileSync(inside(dir,'app.wasm')));}
function engines(dir,previous){
 const base='engine/'+hash(engineId(dir))+'/',old=path.join(previous,MANIFEST);
 const history=[base,...(fs.existsSync(old)?JSON.parse(fs.readFileSync(old,'utf8')).engineHistory||[]:[])].filter((p,i,a)=>a.indexOf(p)===i).slice(0,3);
 for(const entry of history){
  if(!/^engine\/[0-9a-f]{64}\/$/.test(entry))throw Error('Invalid engine archive');
  const source=entry===base?dir:inside(previous,entry.slice(0,-1));
  if('engine/'+hash(engineId(source))+'/'!==entry)throw Error('Engine archive changed: '+entry);
  for(const name of ['app.js','app.wasm'])for(const ext of ['', '.gz','.br'])if(fs.existsSync(inside(source,name+ext)))write(dir,entry+name+ext,fs.readFileSync(inside(source,name+ext)));
 }
 const archive=inside(dir,'engine');
 for(const name of fs.readdirSync(archive))if(/^[0-9a-f]{64}$/.test(name)&&!history.includes('engine/'+name+'/')){
  const obsolete=inside(archive,name);fs.rmSync(obsolete,{recursive:true});
 }
 return history;
}
function stageHeaders(root,dir=path.join(root,'web')){
 const file=path.join(dir,'_headers');let text=fs.existsSync(file)?fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'):'';
 text=text.replace(/\n?# Polynite test deployments\n[^]*?(?=\n# |$)/,'').replace(/\n?# Polynite engine cache\n[^]*?# End Polynite engine cache\n?/,'');
 text+='\n# Polynite engine cache\n/dev/*\n  X-Robots-Tag: noindex\n  Cache-Control: no-cache\n/rel/*\n  X-Robots-Tag: noindex\n';
 for(const prefix of ['', '/rel']){
  for(const name of ['/', '/index.html', '/app.html', '/version.txt', '/version.js', '/engine_loader.js', '/engine_cache.js', '/welcome.js', '/welcome.css', '/backend.js', '/startup_profile.js'])
   text+=prefix+name+'\n  Cache-Control: no-cache\n';
  text+=prefix+'/engine/*\n  Cache-Control: public, max-age=31536000, immutable\n';
 }
 text+='# End Polynite engine cache\n';
 fs.writeFileSync(file,text);
}
function prepare(root){
 progress('Checking the compiled engine in dev/.');
 const source=path.join(root,'dev');checkPair(source);
 const work=path.join(root,'.deploy-work');fs.mkdirSync(work,{recursive:true});fs.mkdirSync(path.join(root,'web'),{recursive:true});
 const snapshot=path.join(work,'snapshot-'+process.pid);fs.mkdirSync(snapshot,{recursive:true});
 const pending=[];
 try{
 progress('Capturing and checking the source snapshot.');
 const sourceVersion=capture(root,source,snapshot);
 const counters=[sourceVersion,...['version.txt','web/version.txt','web/dev/version.txt','web/rel/version.txt'].map(name=>{const file=path.join(root,name);return fs.existsSync(file)?fs.readFileSync(file,'utf8').trim():'';})];
 const version='v'+String(Math.max(...counters.map(v=>/^v\d+$/.test(v)?Number(v.slice(1)):0))+1).padStart(4,'0');
 const cache=new Map();
 for(const tier of ['dev','release']){
  progress('Preparing '+(tier==='dev'?'/dev/':'/rel/')+' '+version+'.');
  const name=tier==='dev'?'dev':'rel',temp=path.join(work,name+'-'+process.pid);fs.mkdirSync(temp,{recursive:true});
  pending.push({name,source:temp});
   for(const file of files(snapshot))copy(snapshot,temp,file);
   const models=path.join(temp,'models');fs.mkdirSync(models,{recursive:true});
   const index=fs.readdirSync(models,{withFileTypes:true}).filter(e=>e.isFile()&&/\.(?:glb|gltf)$/i.test(e.name)).map(e=>e.name+' '+fs.statSync(path.join(models,e.name)).size).sort().join('\n');
   write(temp,'models/index.txt',index+(index?'\n':''));
   normalize(temp);const history=engines(temp,path.join(root,'web',name));
   configure(temp,tier,version,false,history[0]);compress(temp,cache);
   progress('Checking '+name+' manifest and compressed engine.');manifest(temp,tier,version,sourceVersion,history);verify(temp);
 }
 progress('Installing the checked dev/rel candidates.');replaceDirectories(root,pending);
 stageHeaders(root);
 console.log('[polynite] Prepared '+version+': /dev/ (dev) and /rel/ (release); public engine unchanged.');
 }finally{for(const entry of pending)removeWork(root,entry.source);removeWork(root,snapshot);}
}
function publish(root){
 progress('Checking the validated rel candidate before public promotion.');
 const source=path.join(root,'web','rel'),target=path.join(root,'web'),candidate=verify(source);
 if(candidate.tier!=='release')throw Error('Only a release candidate can be published');
 const temp=path.join(root,'.deploy-work','public-'+process.pid);fs.mkdirSync(temp,{recursive:true});
 const full=path.join(root,'.deploy-work','public-full-'+process.pid);fs.mkdirSync(full,{recursive:true});
 try{
  progress('Preparing public files from the frozen rel snapshot.');
  for(const name of Object.keys(candidate.files))copy(source,temp,name);
  const history=engines(temp,target);
  configure(temp,'release',candidate.version,true,history[0]);stageHeaders(root,temp);
  compress(temp,new Map(),['index.html','app.html','site.webmanifest']);
  // New archive copies must carry the same compression as their canonical engine.
  for(const name of ['app.js','app.wasm'])for(const ext of ['.gz','.br'])write(temp,history[0]+name+ext,fs.readFileSync(inside(temp,name+ext)));
  const release=manifest(temp,'release',candidate.version,candidate.sourceVersion,history);verify(temp);
  // Clone the complete local site first; no public file changes until the final swap.
  progress('Copying the complete site before the public swap.');
  for(const name of files(target))copy(target,full,name);
  const old=path.join(target,MANIFEST);
  release.removedFiles=fs.existsSync(old)?Object.keys(JSON.parse(fs.readFileSync(old,'utf8')).files).filter(name=>!release.files[name]):[];
  for(const name of release.removedFiles)if(fs.existsSync(inside(full,name)))fs.unlinkSync(inside(full,name));
  write(temp,MANIFEST,JSON.stringify(release,null,2)+'\n');
  for(const name of Object.keys(release.files))copy(temp,full,name);
  copy(temp,full,MANIFEST);
  for(const name of ['app.js','app.wasm'])if(hash(fs.readFileSync(inside(full,name)))!==candidate.files[name].sha256)throw Error('Published engine differs from validated rel');
  checkPair(full);
  try{replaceDirectories(root,[{name:'web',source:full}]);}catch(error){
   if(!['EPERM','EACCES','EBUSY'].includes(error.code)||!fs.existsSync(target)||!fs.existsSync(full))throw error;
   progress('Directory is locked; installing checked files with backup and rollback.');
   publishFiles(root,full,target,release);
  }
  console.log('[polynite] Published local web/ from validated rel '+candidate.version+'; engine/version preserved.');
 }finally{removeWork(root,temp);removeWork(root,full);}
}
function sync(root,stage){
 progress('Checking Git and the '+stage+' snapshot before publication.');
 function git(args,allowed=[0]){const result=spawnSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true});if(!allowed.includes(result.status))throw Error(result.stderr||result.stdout||'Git failed');return result;}
 if(git(['branch','--show-current']).stdout.trim()!=='main')throw Error('Switch to main before publishing');
 if(git(['diff','--cached','--quiet'],[0,1]).status!==0)throw Error('Existing staged changes: review them before publishing');
 const snapshot=verify(path.join(root,'web','rel'));
 let release;
 if(stage==='rel'){
  const target=path.join(root,'web');release=JSON.parse(fs.readFileSync(path.join(target,MANIFEST),'utf8'));
  if(release.version!==snapshot.version)throw Error('Public files are not the current validated rel');
  for(const [name,entry]of Object.entries(release.files))if(hash(fs.readFileSync(inside(target,name)))!==entry.sha256)throw Error('Public file changed before Git publication: '+name);
  checkPair(target);
 }
 const names=stage==='dev'?['web/dev','web/rel','web/_headers']:Object.keys(release.files).map(name=>'web/'+name).concat(['web/'+MANIFEST,'web/_headers']);
 names.push('deploy_site.cjs','deploy_dev_to_site.bat','deploy_rel_to_site.bat','deploy_cloudflare.cjs','deploy_cloudflare.bat','README.md','.gitignore');
 if(stage==='rel'){
  const tracked=new Set(git(['ls-files','-z']).stdout.split('\0'));
  for(const name of release.removedFiles||[])if(tracked.has('web/'+name))names.push('web/'+name);
 }
 names.push('tests');
 const specs=path.join(root,'.deploy-work','git-paths-'+process.pid);
 fs.writeFileSync(specs,names.map(name=>':(literal)'+name).join('\0')+'\0');
 progress('Staging deployment files in Git.');
 try{git(['add','-A','--pathspec-from-file='+specs,'--pathspec-file-nul']);}finally{fs.unlinkSync(specs);}
 if(git(['diff','--cached','--quiet'],[0,1]).status===0){console.log('[polynite] No changes to publish');return;}
 progress('Committing '+snapshot.version+'.');
 git(['commit','-m',(stage==='dev'?'Prepare dev/rel ':'Publish validated rel ')+snapshot.version]);
 progress('Pushing to origin/main; waiting for the network.');
 const pushed=git(['push','--progress','origin','main:main']);process.stdout.write(pushed.stdout);process.stderr.write(pushed.stderr);
}
if(require.main===module){
 try{
  const args=process.argv.slice(2),action=args[0],i=args.indexOf('--root'),root=path.resolve(i>=0?args[i+1]:__dirname);
  if(action==='prepare')prepare(root);else if(action==='publish')publish(root);else if(action==='sync-dev'||action==='sync-rel')sync(root,action.slice(5));else throw Error('Usage: node deploy_site.cjs prepare|publish|sync-dev|sync-rel');
 }catch(error){console.error('[polynite] '+error.message);process.exitCode=1;}
}
module.exports={prepare,publish,verify};
