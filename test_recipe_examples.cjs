/* Integrity tests for the same versioned recipes used by pages and live replay. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {catalog,source,hash}=require('./build_recipe_examples.cjs');
const root=__dirname,items=catalog().items,ids=new Set();
const operators=new Set(['surface','primitive','beam','anchor','repeat','motion','expression','context','let','spatial','when','prototype','instance','profile','sweep']);
const kinds=new Set(['motion','support','corridor','span','layout','geometry']);
const toolbox=JSON.parse(fs.readFileSync(path.join(source,'operators.json')));assert.deepEqual(new Set(toolbox.items.map(op=>op.id)),operators);assert.equal(toolbox.starter.module,'assembly');
for(const e of items){
 assert.match(e.id,/^[a-z][a-z0-9-]*$/);assert.ok(!ids.has(e.id));ids.add(e.id);assert.ok(Number.isInteger(e.version)&&e.version>0);
 assert.ok(e.prompt&&e.summary&&e.settings&&e.try.length&&e.steps.length);assert.equal(e.compatibility.desktop,'verified');assert(['not_verified','verified'].includes(e.compatibility.browser));if(e.compatibility.browser==='verified'){assert(e.browser_validation.scope);assert.match(e.browser_validation.engine_sha256,/^[a-f0-9]{64}$/);}
 e.operators.forEach(op=>assert.ok(operators.has(op),'Unknown operator '+op));assert.ok(e.capabilities.includes('recipe_program'));
 const sceneBytes=fs.readFileSync(path.join(source,e.id,`v${e.version}.scene`)),recipeBytes=fs.readFileSync(path.join(source,e.id,`v${e.version}.recipes.json`));
 for(const v of e.variants||[]){assert.match(v.id,/^[a-z][a-z0-9-]*$/);assert.ok(v.title&&v.poster);assert.equal(hash(fs.readFileSync(path.join(source,e.id,`v${e.version}-${v.id}.scene`))),v.scene_sha256);}
 assert.equal(hash(sceneBytes),e.scene_sha256,'Scene changed without a new version');assert.equal(hash(recipeBytes),e.recipes_sha256,'Recipe changed without a new version');
 const scene=JSON.parse(sceneBytes),recipes=JSON.parse(recipeBytes).recipes;assert.ok(scene.initial&&Array.isArray(scene.seq));
 assert.ok(Number.isFinite(e.duration)&&e.duration>0);assert.ok(recipes[0].program.inputs.some(i=>i.name===e.edit_parameter),'Example edit parameter is not exposed');
 assert.deepEqual(recipes,scene.initial.architecture.filter(r=>e.instances.includes(r.id)),'Recipe differs from its actual film');assert.equal(recipes.length,e.instances.length);
 for(const r of recipes){assert.equal(r.module,'assembly');assert.equal(r.program.version,1);for(const input of r.program.inputs){assert.ok(input.min<=input.max);if(r.params[input.name]!==undefined)assert.ok(r.params[input.name]>=input.min-1e-6&&r.params[input.name]<=input.max+1e-6);}}
 for(const c of e.checks){assert.ok(kinds.has(c.type));assert.ok(e.instances.includes(c.instance));assert.ok(c.times.length>=3&&c.times.every(Number.isFinite));if(c.source)assert.ok(['support','span'].includes(c.type)?scene.initial.geo[c.source]:scene.initial.assemblies.some(a=>a.id===c.source));}
 for(const value of Object.values(e.media)){assert.ok(value.startsWith('https://polynite.io/atelier/media/')||/^media\/[a-z0-9-]+\.(mp4|jpg)$/.test(value));if(!value.startsWith('https:'))assert.ok(fs.statSync(path.join(source,value)).size<25_000_000);}
}
for(const base of [root,path.join(root,'web'),path.join(root,'dev'),...(process.argv[2]?[path.resolve(process.argv[2])]:[])]){
 const dir=path.join(base,'docs/recipes'),index=JSON.parse(fs.readFileSync(path.join(dir,'catalog.json')));
 assert.equal(index.items.length,items.length);assert.ok(!JSON.stringify(index).includes('"program"'),'Progressive index must remain compact');
 for(const e of items){const version=`v${e.version}`,detail=JSON.parse(fs.readFileSync(path.join(dir,'data',e.id,version+'.json')));assert.equal(detail.scene_sha256,e.scene_sha256);assert.ok(fs.readFileSync(path.join(dir,e.id,'index.html'),'utf8').includes('id="creation-prompt"'));assert.ok(fs.readFileSync(path.join(dir,'data',e.id,version+'.md'),'utf8').includes(e.recipes_sha256));assert.equal(hash(fs.readFileSync(path.join(dir,'data',e.id,version+'.scene'))),e.scene_sha256);}
 const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');assert.ok(html.includes('data-search-input'));assert.ok(!html.includes('autoplay'));
 for(const match of html.matchAll(/(?:href|src)="(\/assets\/[^"?]*)"/g))assert.ok(fs.existsSync(path.join(base,match[1])),'Missing style/script '+match[1]);
}
console.log(`PASS ${items.length} versioned examples: scene/recipe hashes, input bounds, executable check contracts, progressive index and generated page assets.`);
