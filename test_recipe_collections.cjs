/* Collection authoring checks complement native geometry and rendered proofs. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {collection}=require('./compose_recipe_collection.cjs'),file=path.join(__dirname,'public-site-src/collections/japanese-garden/collection.json'),c=collection(file);
const original=JSON.stringify(c.data),nodes=new Set(['primitive','surface','beam','anchor']);assert.equal(c.data.examples.length,5);
for(const e of c.data.examples){assert.equal(e.variants.length,2);const seen=new Set();for(const variant of [null,...e.variants]){const doc=c.compose(e,variant);assert(doc.initial.architecture.length<32);assert.equal(doc.model,'');const key=JSON.stringify(doc.initial.architecture)+JSON.stringify(doc.initial.materials);assert(!seen.has(key),'Variants must differ in recipe or materials');seen.add(key);for(const r of doc.initial.architecture){assert.equal(r.module,'assembly');assert.equal(r.program.version,1);assert(Buffer.byteLength(JSON.stringify(r.program))<32768);for(const n of r.program.nodes)assert(nodes.has(n.op));}assert.deepEqual(doc.initial.seq,doc.seq);}assert.throws(()=>c.compose(e,{instances:[{id:'missing',params:{x:1}}]}),/Unknown variant instance/);}
assert.equal(JSON.stringify(c.data),original,'Composition must not mutate shared source data');
console.log('PASS five data-only compositions, ten distinct variants, bounded recipe programs, stable source data and rejected unknown references.');
{
 const c=collection(path.join(__dirname,'public-site-src/collections/connected-assemblies/collection.json')),before=JSON.stringify(c.data);
 for(const e of c.data.examples)for(const v of [null,...e.variants]){const d=c.compose(e,v),host=d.initial.architecture.find(r=>r.id==='hall'),wing=d.initial.architecture.find(r=>r.id==='gallery');assert.equal(d.initial.mirror_enable,1);assert(d.initial.floor_mirror>0);assert.equal(wing.attach.to,'hall');assert(wing.context.some(c=>c.instance==='hall'&&c.roof==='main'));assert(host.program.assemblies.some(a=>a.nodes.some(n=>n.export==='main')));assert(wing.program.nodes.some(n=>n.join==='@hostroof'));assert(d.initial.architecture.every(r=>Buffer.byteLength(JSON.stringify(r.program))<32768));assert(d.seq.some(s=>s.op==='architecture'&&s.id==='hall'));assert(e.checks.some(c=>c.type==='roof_link'));}
 assert.equal(JSON.stringify(c.data),before);console.log('PASS nine separate-assembly compositions with explicit ports, adaptive source cues and active floor reflections.');
}

const layout=c.data.examples.flatMap(e=>e.checks).find(c=>c.type==='layout');assert(layout,'Composition needs spatial checks');
const old=JSON.parse(fs.readFileSync(path.join(__dirname,'public-site-src/recipe-examples/japanese-garden/v1.scene'))),objects=Object.entries(old.initial.geo).map(([id,o])=>({...o,id}));
assert.throws(()=>require('./public-site-src/recipe-checks.js').create({...layout,stairs:null,connections:[],pairs:[layout.pairs[0]]}).observe(0,{}, {objects}),/Layout clearance failed/,'The old bridge/foundation overlap must fail');
console.log('PASS the published overlapping garden is rejected by the new spatial contract.');

const workshop=collection(path.join(__dirname,'public-site-src/collections/operator-workshop/collection.json'));
for(const e of workshop.data.examples)for(const v of [null,...e.variants]){const doc=workshop.compose(e,v);for(const r of doc.initial.architecture){assert(r.program.prototypes.length<=32);const ids=new Set(r.program.prototypes.map(p=>p.id));assert.equal(ids.size,r.program.prototypes.length);for(const n of r.program.nodes){assert.match(n.id,/^[A-Za-z][A-Za-z0-9_]{0,3}$/);if(n.op==='instance')assert(ids.has(n.source),'Unbound mesh source');}}assert(e.checks.some(c=>c.type==='geometry'));}
const geometry=require('./public-site-src/recipe-checks.js').create({type:'geometry',rules:[{prefix:'rib',count_parameters:['bays'],path_points:3}]});
assert.throws(()=>geometry.observe(0,{recipe:{params:{bays:2}},components:[{part:'rib000000',p:[0,0,0],s:[1,1,1],surface:{path:[[0,0,0],[0,1,0],[1,1,0]]}}]},{}),/count differs/);
console.log('PASS shared-shape definitions, nine composed workshop scenes and rejected missing repetitions.');

const connections=require('./author_terrain_connections.cjs');
for(const [name,r]of Object.entries({terrain_path:connections.connection(false),terrain_bridge:connections.connection(true),terrain_landing:connections.landing()})){
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(connections.dir,name+'.json'))),r,'Regenerate authored recipe JSON');
 assert(Buffer.byteLength(JSON.stringify(r.program))<32768);assert(r.program.let.length<=32);
 const globals=r.program.let.map(v=>v.name);assert.equal(new Set(globals).size,globals.length);
 for(const n of r.program.nodes){const locals=(n.let||[]).map(v=>v.name);assert(locals.length<=32&&locals.length+globals.length<=64);assert.equal(new Set([...globals,...locals]).size,globals.length+locals.length,'Calculation names must not shadow');}
}
for(const kind of ['path','bridge','garden'])for(const variant of ['original','curved','high-bank']){
 const d=connections.fixture(kind,variant);assert(d.initial.architecture.length<=32);assert.equal(d.initial.architecture[0].id,kind==='garden'?'approach':kind);assert(d.seq.some(s=>s.op==='infinite'&&Array.isArray(s.edits)),'Restore persistent baseline terrain edits, including the lake');
 for(const r of d.initial.architecture)assert(Buffer.byteLength(JSON.stringify(r.program))<32768);
}
console.log('PASS data-only terrain connections, bounded calculation scopes and nine reproducible compositions.');

{
 const c=require('./compose_recipe_collection.cjs').collection(require('node:path').join(__dirname,'public-site-src/collections/joined-architecture/collection.json'));
 for(const e of c.data.examples)for(const variant of [null,...e.variants]){const doc=c.compose(e,variant);assert(doc.initial.architecture.every(r=>r.module==='assembly'&&JSON.stringify(r.program).length<32768));const main=doc.initial.architecture.find(r=>r.id==='hall');assert(main.program.inputs.some(p=>p.name==='size'));assert(main.program.assemblies.some(a=>a.nodes.some(n=>n.op==='roof')&&a.nodes.some(n=>n.op==='wall')));if(e.id==='joined-temple-garden')assert(doc.initial.architecture.find(r=>r.id==='yard').context.some(c=>c.instance==='hall'&&c.anchor==='door000000'));}
 console.log('PASS joined architecture: nine portable compositions, bounded programs, complete size controls and explicit entry-path dependency.');
}
{
 const {portable}=require('./import_recipe_collection.cjs'),document={version:1,initial:{scene_modules:{birds:{count:3}},unknown:{future:true}},seq:[],export:{directory:'C:/private/videos',folder:'job',fps:30,future:7}},bytes=Buffer.from(JSON.stringify(document)),saved=JSON.parse(portable(bytes));
 assert.equal(saved.export.directory,undefined);assert.equal(saved.export.folder,undefined);assert.equal(saved.export.fps,30);assert.equal(saved.export.future,7);assert.deepEqual(saved.initial,document.initial);assert.equal(document.export.directory,'C:/private/videos');assert.deepEqual(portable(portable(bytes)),portable(bytes));
 console.log('PASS public scenes preserve unknown content and portable export settings without native output locations.');
}
