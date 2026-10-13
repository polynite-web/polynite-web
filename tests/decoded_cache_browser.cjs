const http=require('node:http'),fs=require('node:fs'),zlib=require('node:zlib');
const src=require('node:path').resolve(__dirname,'../web'),wasm=Buffer.from([0,97,115,109,1,0,0,0]);
const test=String.raw`
(async function(){
 const results=[],assert=(value,name)=>{if(!value)throw Error(name);results.push('PASS '+name);};
 let requests=0;const network=window.fetch;window.fetch=(...args)=>{requests++;return network(...args);};
 const url=n=>'/rel/engine/'+n.repeat(64)+'/app.wasm';
 async function load(id){await pnLoadWasm(url(id),{},instance=>assert(instance instanceof WebAssembly.Instance,'Wasm instance '+id),()=>{});await window.pnEngineCacheReady;}
 try{
  await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase('polynite-engine-cache');r.onsuccess=resolve;r.onerror=reject;});
  window.__pnDeployTier='release';window.__pnBuildVersion='v1';await load('a');
  assert(requests===1,'first compressed download');
  const stored=await pnWasmCache.read(url('a'));assert(stored.byteLength===8,'decoded bytes stored without gzip wrapper');
  await load('a');assert(requests===1,'warm engine uses zero network requests');
  assert(pnEngineTransfer.decodedCache&&pnEngineTransfer.encoding==='','decoded cache identified correctly');
  // Recreate the cache helper to verify persistence beyond its JS instance.
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/engine_cache.js';script.onload=resolve;script.onerror=reject;document.head.appendChild(script);});
  assert((await pnWasmCache.read(url('a'))).byteLength===8,'IndexedDB record survives helper recreation');
  window.__pnBuildVersion='v2';await load('b');
  assert(await pnWasmCache.read(url('a'))===null,'previous release replaced');
  assert((await pnWasmCache.read(url('b'))).byteLength===8,'new release retained');
  let failed=false;try{await load('c');}catch(_){failed=true;}
  assert(failed,'invalid network Wasm rejected');assert((await pnWasmCache.read(url('b'))).byteLength===8,'failed update preserves last valid record');
  await pnWasmCache.save(url('b'),new Uint8Array([1,2,3]).buffer);const before=requests;
  await load('b');assert(requests===before+1,'corrupt decoded cache retries network once');
  window.__pnBuildVersion='v1';await pnWasmCache.save(url('a'),stored);
  assert((await pnWasmCache.read(url('b'))).byteLength===8,'older tab cannot replace newer release');
  window.__pnDeployTier='dev';const devBefore=requests;await load('b');await load('b');
  assert(requests===devBefore+2,'dev always fetches fresh engine');
  window.__pnDeployTier='release';const now=Date.now;Date.now=()=>now()+356*86400000;
  assert((await pnWasmCache.read(url('b'))).byteLength===8,'decoded engine remains valid after 356 days');
  Date.now=()=>now()+366*86400000;
  assert(await pnWasmCache.read(url('b'))===null,'expired decoded entry removed');Date.now=now;
  assert((await pnWasmCache.read(url('b')))===null,'expiry deletion persisted');
  document.body.textContent=results.join('\n')+'\nALL TESTS PASSED';
 }catch(error){document.body.textContent=results.join('\n')+'\nFAIL '+error.stack;}
})();`;
http.createServer((req,res)=>{
 if(req.url==='/engine_cache.js'||req.url==='/engine_loader.js'){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});res.end(fs.readFileSync(src+req.url));return;}
 if(req.url.includes('/engine/')){const bytes=req.url.includes('/'+'c'.repeat(64)+'/')?Buffer.from([1,2,3]):wasm;res.writeHead(200,{'Content-Type':'application/wasm','Content-Encoding':'gzip','Cache-Control':'no-store'});res.end(zlib.gzipSync(bytes));return;}
 res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});res.end('<html><head><script src="/engine_cache.js"></script><script src="/engine_loader.js"></script></head><body style="white-space:pre;font:14px monospace">Testing...<script>'+test+'</script></body></html>');
}).listen(Number(process.env.PORT)||0,'127.0.0.1',function(){console.log('Decoded-cache regression: http://127.0.0.1:'+this.address().port+'/');});
