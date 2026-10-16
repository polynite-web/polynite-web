/* Deployed delivery checks complement the visible WebGPU regression. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=new URL('./',import.meta.url),site='https://polynite.io',explore='https://explore.polynite.io';
const hash=b=>createHash('sha256').update(b).digest('hex');let requests=0;
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(45000)});assert.equal(r.status,200,url);requests++;return Buffer.from(await r.arrayBuffer());}
const registry=JSON.parse(await get(site+'/examples/catalog.json'));assert.deepEqual(registry,JSON.parse(fs.readFileSync(new URL('web/examples/catalog.json',root))));
for(const entry of registry.items){assert.equal(hash(await get(entry.scene)),entry.scene_sha256);for(const url of Object.values(entry.media)){const r=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(45000)});assert.equal(r.status,200,url);requests++;}}
for(const name of ['view.html','view.css','view.js','runtime/index.html'])assert.equal(hash(await get(site+'/examples/'+name)),hash(fs.readFileSync(new URL('web/examples/'+name,root))));
const showcase=(await get(explore+'/showcase/')).toString();assert.ok(showcase.includes('aria-current="page">Showcase'));assert.ok(showcase.includes('data-environment-filter'));assert.ok(showcase.includes('/examples/view.html?id=refuge'));assert.ok((await get(explore+'/')).toString().includes('/showcase/'));
const version=fs.readFileSync(new URL('web/version.txt',root),'utf8').trim();const runtime=(await get(site+'/examples/runtime/')).toString();assert.ok(runtime.includes(version));
for(const name of ['app.js','app.wasm'])assert.equal(hash(await get(site+'/'+name+'?verify='+version)),hash(fs.readFileSync(new URL('web/'+name,root))));
const result={passed:true,requests,examples:registry.items.length,version,verified:'Published navigation, Showcase, exact scene hashes, media delivery, isolated runtime and JS/WASM engine bytes'};if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2));console.log(JSON.stringify(result));
