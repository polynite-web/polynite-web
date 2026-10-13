'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),http=require('node:http'),zlib=require('node:zlib');
const base=require('node:path').resolve(__dirname,'../web');
const html=fs.readFileSync(base+'/index.html','utf8'),version=fs.readFileSync(base+'/version.js','utf8'),loader=fs.readFileSync(base+'/engine_loader.js','utf8');
function store(initial={}){return{getItem:k=>initial[k]||'',setItem:(k,v)=>initial[k]=v};}
async function versions(host,page,remote,last=''){
 let redirected='';const context={window:{__pnBuildVersion:'v0267',__pnDeployTier:'release'},URL,Date,console,
  location:{hostname:host,pathname:'/',search:'?debug',href:'https://'+host+'/?debug'+(page?'&_v='+page:''),replace:u=>redirected=u},
  localStorage:store(),sessionStorage:store({'lastReloadVersion:/':last}),fetch:()=>Promise.resolve({ok:true,text:()=>Promise.resolve(remote)})};
 vm.runInNewContext(version,context);await context.window.pnVersionReady;
 assert.equal(context.window.getCurrentVersion(),remote);return{context,redirected};
}
function functionBody(name,next){const start=html.indexOf('  function '+name+'('),end=html.indexOf('\n  '+next,start);assert(start>=0&&end>start);return html.slice(start,end);}
async function main(){
 let v=await versions('polynite.io','v0268','v0269');assert(v.redirected.includes('_v=v0269'));assert.equal(v.context.window.pnVersionReloading,true);
 v=await versions('polynite.io','v0269','v0269');assert.equal(v.redirected,'');
 v=await versions('polynite.io','v0268','v0269','v0269');assert.equal(v.redirected,'');
 let expire,cleared=false;
 const timeout={window:{__pnBuildVersion:'v0267',__pnDeployTier:'release'},URL,Date,AbortController,
  console:{warn:()=>{}},location:{hostname:'polynite.io',pathname:'/',search:'',href:'https://polynite.io/',replace:()=>assert.fail('Timeout redirected')},
  localStorage:store(),sessionStorage:store(),setTimeout:fn=>{expire=fn;return 1;},clearTimeout:()=>cleared=true,
  fetch:(_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('timeout'))))};
 vm.runInNewContext(version,timeout);expire();await timeout.window.pnVersionReady;
 assert(cleared);assert.equal(timeout.window.getCurrentVersion(),'v0267');
 const cacheCode=functionBody('bootToken','function cacheBust')+functionBody('cacheBust','/* Label only');
 for(const tier of ['dev','release']){
  const c={window:{__pnDeployTier:tier},Date,getCurrentVersion:()=> 'v0269'};vm.createContext(c);vm.runInContext(cacheCode,c);
  const first=vm.runInContext('cacheBust("app.wasm")',c);c.window.__spinBootTok=999;
  const second=vm.runInContext('cacheBust("app.wasm")',c);
  assert.equal(first.includes('_t='),tier==='dev');assert.equal(first===second,tier==='release');assert(first.includes('_v=v0269'));
 }
 const immutable={window:{__pnDeployTier:'release',__pnEngineBase:'engine/'+'a'.repeat(64)+'/'},Date,getCurrentVersion:()=> 'v1'};
 vm.createContext(immutable);vm.runInContext(cacheCode,immutable);
 const url=vm.runInContext('cacheBust("app.wasm")',immutable);immutable.getCurrentVersion=()=> 'v2';
 assert.equal(url,vm.runInContext('cacheBust("app.wasm")',immutable));assert(!url.includes('_v='));
 const hideCode=html.slice(html.indexOf('  function loaderFailed('),html.indexOf('  window.vmeshHideLoader'));
 const notices=[],watchdog={window:{__spinNoticeShown:false},engineAborted:false,FR:false,Module:{},gpuNotice:(...args)=>notices.push(args)};
 vm.createContext(watchdog);vm.runInContext(hideCode,watchdog);vm.runInContext('hideLoader(true)',watchdog);
 assert(watchdog.engineAborted);assert.equal(notices.length,1);assert.equal(notices[0][2],'Loading interrupted');
 const wasm=Buffer.from([0,97,115,109,1,0,0,0]),packed=zlib.gzipSync(wasm);
 const server=http.createServer((req,res)=>{
  if(req.url==='/stall'){res.writeHead(200,{'Content-Type':'application/wasm'});res.flushHeaders();return;}
  if(req.url==='/slow'){
   res.writeHead(200,{'Content-Type':'application/wasm'});let i=0;
   const tick=setInterval(()=>{if(i<wasm.length){res.write(wasm.subarray(i,i+1));i++;}else{clearInterval(tick);res.end();}},20);
   res.on('close',()=>clearInterval(tick));return;
  }
  if(req.url==='/missing'){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':req.url==='/fallback'?'application/octet-stream':'application/wasm','Content-Encoding':'gzip'});res.end(packed);
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 try{
  for(const suffix of ['/engine.wasm','/fallback']){
   const phases=[],c={window:{__pnDeployTier:'release'},navigator:{language:'fr'},location:{href:origin+'/'},URL,WebAssembly,AbortController,setTimeout,clearTimeout,fetch:(url,options)=>fetch(new URL(url,origin),options),
    performance:{getEntriesByName:()=>[{name:origin+suffix,encodedBodySize:packed.length,decodedBodySize:wasm.length,transferSize:packed.length+300,duration:10}]}};
   let requests=0;const nativeFetch=c.fetch;c.fetch=(...args)=>{requests++;return nativeFetch(...args);};
   vm.runInNewContext(loader,c);let received=false;
   c.window.pnPrefetchWasm(suffix);assert.equal(requests,1,'download starts before engine imports are ready');
   c.window.pnPrefetchWasm(suffix);assert.equal(requests,1,'prefetch does not duplicate a request');
   await c.window.pnLoadWasm(suffix,{},instance=>{assert(instance instanceof WebAssembly.Instance);received=true;},(phase,detail)=>phases.push([phase,detail]));
   assert.equal(requests,1,'native response reused without a second fetch');
   assert(received);assert(phases.some(([phase])=>phase&&phase.includes('decompression')));assert.equal(c.window.pnEngineTransfer.encoding,'gzip');
   await assert.rejects(c.window.pnLoadWasm('/missing',{},()=>assert.fail('404 instantiated'),()=>{}),/HTTP 404/);
   await assert.rejects(c.window.pnLoadWasm('/stall',{},()=>assert.fail('Stalled response instantiated'),()=>{}, {idleMs:50,totalMs:1000}),/timed out|ne progresse/);
   assert.equal(c.window.pnEngineLoading,false);
   await c.window.pnLoadWasm('/slow',{},()=>{},()=>{}, {idleMs:100,totalMs:2000});
  }
 }finally{await new Promise(resolve=>server.close(resolve));}
 console.log('PASS: fresh-version gating, stable release URLs, dev bypass, browser HTTP gzip decoding, streaming/fallback instantiation and HTTP errors.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
