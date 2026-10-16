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
