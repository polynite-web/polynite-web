/* Native contract checks for named footprints, independent of a garden style. */
import fs from 'node:fs';import assert from 'node:assert/strict';
const file=process.argv[2]||'D:/dev/mcp-production-dry-run/placement-2026-10-19/footprint-contracts.json';
async function call(method,params={}){const r=await(await fetch('http://127.0.0.1:8790/mcp',{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:819,method,params}),signal:AbortSignal.timeout(180000)})).json();assert(!r.error&&r.result?.ok!==false,JSON.stringify(r));return r.result;}
const film=(command,extra={})=>call('scene.cinematic',{request:{command,...extra}}),edit=(...actions)=>call('scene.apply',{actions}),inspect=id=>call('scene.architecture',{request:{command:'inspect',id,include_parts:true}});
const state=await film('status');assert(!state.playing&&!state.export.active);const before=await film('document',{expanded:true});fs.writeFileSync(file+'.before.scene',JSON.stringify(before));
try{
 const d=structuredClone(before);d.initial.geo={};d.initial.architecture=[];d.initial.assemblies=[];d.seq=[];await film('load_document',{document:d,start_paused:true});
 const source={op:'architecture',id:'bounds',module:'assembly',p:[3,0,-2],yaw:25,program:{version:1,inputs:[],assemblies:[{id:'unit',nodes:[{id:'body',op:'footprint',p:[1,0,0],s:[2,1,4],r:[0,15,0]}]}],nodes:[{id:'nest',op:'assembly',source:'unit',p:[1,0,0],s:[2,2,2],r:[0,30,0]}]}};
 await edit(source);const p=await inspect('bounds'),a=p.anchors[0];assert(a.footprint);assert.deepEqual(a.size,[4,2,8]);assert(Math.abs(a.yaw-70)<.001);assert.equal(p.components.length,0);
 const probe={op:'architecture',id:'probe',module:'assembly',p:[-2,0,4],yaw:-20,context:[{name:'area',instance:'bounds',anchor:a.id,offset:[1,0,0]}],program:{version:1,inputs:[],nodes:[{id:'mark',op:'anchor',p:[['distance','@area','@area.x','@area.z'],0,0]}]}};
 await edit(probe);let q=await inspect('probe');assert(Math.abs(q.anchors[0].local[0]+1)<.002,'Offset point must sample the original rectangle, not a shifted shape');assert(Math.abs(q.resolved_context[0].yaw-90)<.002);
 const saved=await film('document',{expanded:true});await film('load_document',{document:saved,start_paused:true});assert.deepEqual((await inspect('bounds')).anchors,p.anchors);
 await edit({op:'architecture',id:'bounds',yaw:-10});q=await inspect('probe');assert(Math.abs(q.resolved_context[0].yaw-55)<.002,'Source rotation did not invalidate context');
 const stable=(await film('document',{expanded:true})).initial.architecture;
 const invalid=await(await fetch('http://127.0.0.1:8790/mcp',{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:820,method:'scene.apply',params:{actions:[{op:'architecture',id:'bounds',remove:true}]}})})).json();assert(invalid.error||invalid.result?.ok===false);assert.deepEqual((await film('document',{expanded:true})).initial.architecture,stable);
 const discovery=await call('scene.architecture',{request:{command:'operators',operator:'footprint'}});assert.equal(discovery.operators[0].example.op,'footprint');
 fs.writeFileSync(file,JSON.stringify({passed:true,nested_anchor:a,offset_probe:q,checks:['no render geometry','nested scale/yaw','local coordinates','offset does not shift footprint','save/reopen','source invalidation','missing-source rollback','discovery']},null,2));
}finally{await film('stop');await film('load_document',{document:before,start_paused:true});await edit({op:'camera',yaw:before.initial.cam_yaw*180/Math.PI,pitch:before.initial.cam_pitch*180/Math.PI,dist:before.initial.cam_dist});assert.deepEqual((await film('document',{expanded:true})).initial.geo,before.initial.geo);}
console.log('PASS footprint contract and restoration; native window untouched');
