const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {experiences}=require('./build_experiences.cjs'),{hash}=require('./build_recipe_examples.cjs');
const root=__dirname,entries=experiences(),ids=new Set(entries.map(e=>e.id));assert.equal(ids.size,entries.length);
assert.ok(entries.filter(e=>e.kind==='showcase').length>=3);
for(const e of entries){assert.match(e.id,/^[a-z][a-z0-9-]*$/);assert.ok(Number.isInteger(e.version)&&e.version>0);assert.equal(hash(fs.readFileSync(e.scene_file)),e.scene_sha256);assert.ok(e.open.startsWith('https://polynite.io/examples/view.html?id='));assert.ok(e.prompt&&e.media.video&&e.media.poster);}
for(const base of [root,path.join(root,'web'),path.join(root,'dev')]){
 const registry=JSON.parse(fs.readFileSync(path.join(base,'examples/catalog.json')));assert.equal(registry.items.length,entries.length);
 assert.ok(!JSON.stringify(registry).includes('scene_file'),'Private source paths must not be published');
 for(const e of entries)assert.equal(hash(fs.readFileSync(path.join(base,new URL(e.scene).pathname))),e.scene_sha256);
 for(const e of registry.items)for(const v of e.variants||[])assert.equal(hash(fs.readFileSync(path.join(base,new URL(v.scene).pathname))),v.scene_sha256);
 const runtime=fs.readFileSync(path.join(base,'examples/runtime/index.html'),'utf8');assert.ok(runtime.includes('FS.mount=function'));assert.ok(runtime.includes('type===IDBFS?MEMFS:type'));assert.ok(runtime.includes('window.vmeshAutoDiscover=false'));
 const viewer=fs.readFileSync(path.join(base,'examples/view.html'),'utf8');assert.ok(viewer.includes('id="variant"'));assert.ok(viewer.includes('checks.js?v='));assert.ok(viewer.includes('id="reset"'));assert.ok(viewer.includes('id="save"'));assert.ok(viewer.includes('title="Interactive Polynite example"'));
 const showcase=fs.readFileSync(path.join(base,'showcase/index.html'),'utf8');for(const field of ['data-category-filter','data-environment-filter','data-search-input'])assert.ok(showcase.includes(field));assert.ok(showcase.includes('aria-current="page">Showcase'));assert.ok(!showcase.includes('autoplay'));
}
const code=fs.readFileSync(path.join(root,'public-site-src/example-view.js'),'utf8');assert.ok(code.includes('entry.capabilities'));assert.ok(code.includes('export?.active'));assert.ok(code.includes('start_paused:true'));assert.ok(!code.includes('eval('));
console.log(`PASS ${entries.length} shared experiences: exact scenes, private viewer isolation, controls, compatibility guards, Showcase filters and active navigation.`);
