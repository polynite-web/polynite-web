/* Contracts complement real native/browser observations. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{placement,spacing,fixture}=require('./author_clearance_placement.cjs'),checks=require('./public-site-src/recipe-checks.js');
assert.throws(()=>placement([]));assert.throws(()=>placement(Array(7).fill('x')));assert.throws(()=>spacing(7));
for(const kind of ['study','garden'])for(const variant of ['original','wide','space']){
 const d=fixture(kind,variant);assert(d.initial.architecture.length<=32);
 for(const r of d.initial.architecture){assert.equal(r.module,'assembly');assert(Buffer.byteLength(JSON.stringify(r.program))<32768);assert((r.context||[]).length<=8);assert((r.program.checks||[]).length<=16);assert((r.program.let||[]).length<=32);}
 const ids=d.initial.architecture.map(r=>r.id);assert.equal(new Set(ids).size,ids.length);
 if(kind==='garden'){assert.equal(d.initial.architecture.find(r=>r.id==='spacing').program.checks.length,15);assert(d.initial.architecture.find(r=>r.id==='slot5').context.some(c=>c.instance==='pondarea'));}
}
const plan={recipe:{params:{x:0,z:0,search:3,radius:.4,margin:.2}},resolved_context:[{name:'block',origin:[0,0,0],yaw:0,size:[2,1,2]}],anchors:[{id:'seat000000',local:[3,0,0]}]};
checks.create({type:'placement'}).observe(0,plan,{});
for(const wrong of [[0,0,0],[1.5,0,0],[-3,0,0]])assert.throws(()=>checks.create({type:'placement'}).observe(0,{...plan,anchors:[{id:'seat000000',local:wrong}]},{}),/first clear candidate|intersects/);
assert.deepEqual(JSON.parse(fs.readFileSync('public-site-src/collections/clearance-placement/placement.json')),placement());
console.log('PASS six bounded compositions, explicit pond/reservation bindings, spacing constraints and independent rejection of intersecting/wrong-priority placement.');
