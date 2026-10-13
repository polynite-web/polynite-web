// Prepare dev/rel together; promote the exact validated rel snapshot.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),{spawnSync}=require('node:child_process');
const MAX_FILE=25*1024*1024,MANIFEST='deploy-manifest.json';
const siteFiles=['robots.txt','sitemap.xml','sitemap-app.xml','site.webmanifest','sw.js','404.html','_redirects','favicon.ico'];
const siteDirs=['docs','mcp','support','privacy','terms','tutorials','tutorial-view'];
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
 if(result.status!==0)throw Error(result.stderr||result.stdout||'Engine pair validation failed');
}
function payload(source){
 return files(source).filter(name=>{
  const parts=name.split('/'),base=path.basename(name);
  if(parts.some(p=>p.startsWith('.')||p==='dev'||p==='rel')||siteDirs.includes(parts[0]))return false;
  if(base===MANIFEST||base==='tier.txt'||base==='version.txt'||base==='index.txt'&&parts[0]==='models')return false;
  if(/\.(?:bat|cmd|cwc|cwmake|cjs|log|map|symbols|gz|br)$/i.test(base)||/^app_before_|^appGL\./i.test(base))return false;
  return fs.statSync(inside(source,name)).size<=MAX_FILE;
 });
}
function configure(dir,tier,version,publicPage=false){
 write(dir,'tier.txt',tier+'\n');write(dir,'version.txt',version+'\n');
 for(const name of ['index.html','app.html']){
  const file=inside(dir,name);if(!fs.existsSync(file))continue;
  let html=fs.readFileSync(file,'utf8');
  html=html.replace(/<script id="pn-(?:build-version|deploy-config)">[^]*?<\/script>/g,'');
  html=html.replace('<head>','<head><script id="pn-deploy-config">window.__pnDeployTier='+JSON.stringify(tier)+';window.__pnBuildVersion='+JSON.stringify(version)+';</script>');
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
 for(const name of selected){
  if(name===MANIFEST||!(/\.(?:wasm|js|css|html|json|txt|svg|pane|layout|webmanifest)$/i.test(name)))continue;
  const bytes=fs.readFileSync(inside(dir,name));if(bytes.length<512)continue;
  const key=hash(bytes);let pair=cache.get(key);
  if(!pair){pair={gz:zlib.gzipSync(bytes,{level:9}),br:zlib.brotliCompressSync(bytes,{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:11}})};cache.set(key,pair);}
  for(const [ext,packed]of Object.entries(pair))if(packed.length<bytes.length)write(dir,name+'.'+ext,packed);
 }
}
function normalize(dir){
 for(const name of files(dir))if(/\.(?:js|css|html|json|txt|svg|pane|layout|webmanifest)$/i.test(name)||['_headers','_redirects'].includes(path.basename(name))){
  const bytes=fs.readFileSync(inside(dir,name));if(bytes.includes(0))continue;
  const text=bytes.toString('utf8');if(text.includes('\r\n'))write(dir,name,text.replace(/\r\n/g,'\n'));
 }
}
function manifest(dir,tier,version,sourceVersion){
 const entries={};for(const name of files(dir))if(name!==MANIFEST){const bytes=fs.readFileSync(inside(dir,name));if(bytes.length>MAX_FILE)throw Error('Cloudflare Pages file limit exceeded: '+name);entries[name]={bytes:bytes.length,sha256:hash(bytes)};}
 const value={format:1,tier,version,sourceVersion,files:entries};write(dir,MANIFEST,JSON.stringify(value,null,2)+'\n');return value;
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
 checkPair(dir);return value;
}
function replaceStage(root,name,source){
 if(!['dev','rel'].includes(name))throw Error('Invalid stage');
 const target=path.resolve(root,'web',name),backup=path.resolve(root,'.deploy-work',name+'-old-'+process.pid);
 // Both resolved paths are constrained to the selected site's stage/work folders.
 if(fs.existsSync(target))fs.renameSync(target,backup);
 try{fs.renameSync(source,target);}catch(error){if(fs.existsSync(backup))fs.renameSync(backup,target);throw error;}
 removeWork(root,backup);
}
function stageHeaders(root,dir=path.join(root,'web')){
 const file=path.join(dir,'_headers');let text=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
 if(!text.includes('# Polynite test deployments'))text+='\n# Polynite test deployments\n/dev/*\n  X-Robots-Tag: noindex\n  Cache-Control: no-cache\n/rel/*\n  X-Robots-Tag: noindex\n  Cache-Control: no-cache\n';
 fs.writeFileSync(file,text);
}
function prepare(root){
 const source=path.join(root,'dev');checkPair(source);
 const sourceVersion=fs.readFileSync(path.join(source,'version.txt'),'utf8').trim();
 const counters=[sourceVersion,...['version.txt','web/version.txt','web/dev/version.txt','web/rel/version.txt'].map(name=>{const file=path.join(root,name);return fs.existsSync(file)?fs.readFileSync(file,'utf8').trim():'';})];
 const version='v'+String(Math.max(...counters.map(v=>/^v\d+$/.test(v)?Number(v.slice(1)):0))+1).padStart(4,'0');
 const work=path.join(root,'.deploy-work');fs.mkdirSync(work,{recursive:true});fs.mkdirSync(path.join(root,'web'),{recursive:true});
 const cache=new Map();
 for(const tier of ['dev','release']){
  const name=tier==='dev'?'dev':'rel',temp=path.join(work,name+'-'+process.pid);fs.mkdirSync(temp,{recursive:true});
  try{
   for(const file of payload(source))copy(source,temp,file);
   for(const file of siteFiles)if(fs.existsSync(path.join(root,file)))copy(root,temp,file);
   const assets=path.join(root,'assets');if(fs.existsSync(assets))for(const file of files(assets))copy(root,temp,'assets/'+file);
   for(const dir of siteDirs)if(fs.existsSync(path.join(root,dir)))for(const file of files(path.join(root,dir)))if(fs.statSync(inside(root,dir+'/'+file)).size<=MAX_FILE)copy(root,temp,dir+'/'+file);
   const models=path.join(temp,'models');fs.mkdirSync(models,{recursive:true});
   const index=fs.readdirSync(models,{withFileTypes:true}).filter(e=>e.isFile()&&/\.(?:glb|gltf)$/i.test(e.name)).map(e=>e.name+' '+fs.statSync(path.join(models,e.name)).size).sort().join('\n');
   write(temp,'models/index.txt',index+(index?'\n':''));
   configure(temp,tier,version);normalize(temp);compress(temp,cache);manifest(temp,tier,version,sourceVersion);verify(temp);replaceStage(root,name,temp);
  }finally{removeWork(root,temp);}
 }
 stageHeaders(root);
 console.log('[polynite] Prepared '+version+': /dev/ (dev) and /rel/ (release); public engine unchanged.');
}
function publish(root){
 const source=path.join(root,'web','rel'),target=path.join(root,'web'),candidate=verify(source);
 if(candidate.tier!=='release')throw Error('Only a release candidate can be published');
 const temp=path.join(root,'.deploy-work','public-'+process.pid);fs.mkdirSync(temp,{recursive:true});
 try{
  for(const name of Object.keys(candidate.files))copy(source,temp,name);
  configure(temp,'release',candidate.version,true);stageHeaders(root,temp);
  compress(temp,new Map(),['index.html','app.html','site.webmanifest']);
  const release=manifest(temp,'release',candidate.version,candidate.sourceVersion);verify(temp);
  // Only files owned by this deployment are replaced; dev/rel and site pages survive.
  for(const name of Object.keys(release.files))copy(temp,target,name);
  copy(temp,target,MANIFEST);stageHeaders(root);
  for(const name of ['app.js','app.wasm'])if(hash(fs.readFileSync(inside(target,name)))!==candidate.files[name].sha256)throw Error('Published engine differs from validated rel');
  console.log('[polynite] Published local web/ from validated rel '+candidate.version+'; engine/version preserved.');
 }finally{removeWork(root,temp);}
}
function sync(root,stage){
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
 names.push('deploy_site.cjs','deploy_dev_to_site.bat','deploy_rel_to_site.bat','README.md','.gitignore');
 git(['add','-A','--',...names]);
 if(git(['diff','--cached','--quiet'],[0,1]).status===0){console.log('[polynite] No changes to publish');return;}
 git(['commit','-m',(stage==='dev'?'Prepare dev/rel ':'Publish validated rel ')+snapshot.version]);
 const pushed=git(['push','--progress','origin','main:main']);process.stdout.write(pushed.stdout);process.stderr.write(pushed.stderr);
}
if(require.main===module){
 try{
  const args=process.argv.slice(2),action=args[0],i=args.indexOf('--root'),root=path.resolve(i>=0?args[i+1]:__dirname);
  if(action==='prepare')prepare(root);else if(action==='publish')publish(root);else if(action==='sync-dev'||action==='sync-rel')sync(root,action.slice(5));else throw Error('Usage: node deploy_site.cjs prepare|publish|sync-dev|sync-rel');
 }catch(error){console.error('[polynite] '+error.message);process.exitCode=1;}
}
module.exports={prepare,publish,verify};
