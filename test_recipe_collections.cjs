/* Collection authoring checks complement native geometry and rendered proofs. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {collection}=require('./compose_recipe_collection.cjs'),file=path.join(__dirname,'public-site-src/collections/japanese-garden/collection.json'),c=collection(file);
const original=JSON.stringify(c.data),nodes=new Set(['primitive','surface','beam','anchor']);assert.equal(c.data.examples.length,5);
for(const e of c.data.examples){assert.equal(e.variants.length,2);const seen=new Set();for(const variant of [null,...e.variants]){const doc=c.compose(e,variant);assert(doc.initial.architecture.length<32);assert.equal(doc.model,'');const key=JSON.stringify(doc.initial.architecture)+JSON.stringify(doc.initial.materials);assert(!seen.has(key),'Variants must differ in recipe or materials');seen.add(key);for(const r of doc.initial.architecture){assert.equal(r.module,'assembly');assert.equal(r.program.version,1);assert(Buffer.byteLength(JSON.stringify(r.program))<32768);for(const n of r.program.nodes)assert(nodes.has(n.op));}assert.deepEqual(doc.initial.seq,doc.seq);}assert.throws(()=>c.compose(e,{instances:[{id:'missing',params:{x:1}}]}),/Unknown variant instance/);}
assert.equal(JSON.stringify(c.data),original,'Composition must not mutate shared source data');
console.log('PASS five data-only compositions, ten distinct variants, bounded recipe programs, stable source data and rejected unknown references.');

const layout=c.data.examples.flatMap(e=>e.checks).find(c=>c.type==='layout');assert(layout,'Composition needs spatial checks');
const old=JSON.parse(fs.readFileSync(path.join(__dirname,'public-site-src/recipe-examples/japanese-garden/v1.scene'))),objects=Object.entries(old.initial.geo).map(([id,o])=>({...o,id}));
assert.throws(()=>require('./public-site-src/recipe-checks.js').create({...layout,stairs:null,connections:[],pairs:[layout.pairs[0]]}).observe(0,{}, {objects}),/Layout clearance failed/,'The old bridge/foundation overlap must fail');
console.log('PASS the published overlapping garden is rejected by the new spatial contract.');

const workshop=collection(path.join(__dirname,'public-site-src/collections/operator-workshop/collection.json'));
for(const e of workshop.data.examples)for(const v of [null,...e.variants]){const doc=workshop.compose(e,v);for(const r of doc.initial.architecture){assert(r.program.prototypes.length<=32);const ids=new Set(r.program.prototypes.map(p=>p.id));assert.equal(ids.size,r.program.prototypes.length);for(const n of r.program.nodes){assert.match(n.id,/^[A-Za-z][A-Za-z0-9_]{0,3}$/);if(n.op==='instance')assert(ids.has(n.source),'Unbound mesh source');}}assert(e.checks.some(c=>c.type==='geometry'));}
const geometry=require('./public-site-src/recipe-checks.js').create({type:'geometry',rules:[{prefix:'rib',count_parameters:['bays'],path_points:3}]});
assert.throws(()=>geometry.observe(0,{recipe:{params:{bays:2}},components:[{part:'rib000000',p:[0,0,0],s:[1,1,1],surface:{path:[[0,0,0],[0,1,0],[1,1,0]]}}]},{}),/count differs/);
console.log('PASS shared-shape definitions, nine composed workshop scenes and rejected missing repetitions.');
