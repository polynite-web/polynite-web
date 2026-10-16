/* Verify deployed bytes, including the exact versioned reproduction references. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),base='https://explore.polynite.io/docs/recipes/';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
let requests=0;
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(45000)});assert.equal(r.status,200,url);requests++;return Buffer.from(await r.arrayBuffer());}
const index=JSON.parse(await get(base+'catalog.json')),local=JSON.parse(fs.readFileSync(path.join(root,'docs/recipes/catalog.json')));assert.deepEqual(index,local);
const page=(await get(base)).toString();assert.ok(page.includes('Small operators.'));
for(const m of page.matchAll(/(?:href|src)="(\/assets\/public-site\/recipes-[^"?]+)"/g))assert.equal(digest(await get(new URL(m[1],base))),digest(fs.readFileSync(path.join(root,m[1]))));
assert.ok((await get(base+'llms.txt')).toString().includes('Progressive index'));
assert.equal(digest(await get(base+'operators.json')),digest(fs.readFileSync(path.join(root,'docs/recipes/operators.json'))));
for(const item of index.items){
 const detail=JSON.parse(await get(item.detail)),expected=JSON.parse(fs.readFileSync(path.join(root,'docs/recipes/data',item.id,`v${item.version}.json`)));assert.deepEqual(detail,expected);
 assert.equal(digest(await get(detail.scene)),detail.scene_sha256);assert.equal(digest(await get(detail.recipes)),detail.recipes_sha256);assert.ok((await get(detail.markdown)).toString().includes(detail.recipes_sha256));
 const html=(await get(item.url)).toString();assert.ok(html.includes('id="creation-prompt"'));assert.ok(html.includes(detail.scene));
 for(const asset of Object.values(detail.media)){const url=new URL(asset,base);const bytes=await get(url);assert.ok(bytes.length>1000&&bytes.length<25_000_000);if(url.origin==='https://explore.polynite.io')assert.equal(digest(bytes),digest(fs.readFileSync(path.join(root,url.pathname))));}
}
assert.ok((await get('https://explore.polynite.io/docs/')).toString().includes('/docs/recipes/'));
const result={passed:true,examples:index.items.length,requests,url:base,verified:'HTTP pages, UI assets, catalogue, Markdown, scene/recipe hashes and video/poster delivery'};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2));console.log(JSON.stringify(result));
