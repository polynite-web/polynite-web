/* Extreme corridor caps must fit the declared horizontal reservation. */
import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire}from'node:module';
const require=createRequire(import.meta.url),{fixture}=require('./author_terrain_connections.cjs'),{reserveConnection}=require('./author_clearance_placement.cjs');
const file=process.argv[2]||'D:/dev/mcp-production-dry-run/placement-2026-10-19/corridor-envelope.json';
async function rpc(method,params={}){const j=await(await fetch('http://127.0.0.1:8790/mcp',{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:814,method,params}),signal:AbortSignal.timeout(180000)})).json();assert(!j.error&&j.result?.ok!==false,JSON.stringify(j));return j.result;}
const film=(command,extra={})=>rpc('scene.cinematic',{request:{command,...extra}}),edit=(...actions)=>rpc('scene.apply',{actions});
const s=await film('status');assert(!s.playing&&!s.export.active);const before=await film('document',{expanded:true});fs.writeFileSync(file+'.before.scene',JSON.stringify(before));const results=[];
try{
 const d=fixture('bridge');d.initial.geo={};d.initial.infinite.edits=[];d.seq=[];
 for(const [id,z]of [['shore_a',-1],['shore_b',1]]){const r=d.initial.architecture.find(r=>r.id===id);r.p=[0,0,z];r.params={lift:.4};}
 const bridge=d.initial.architecture.find(r=>r.id==='bridge');bridge.params={width:2.4,bend:2,arch:2,thickness:.25,clearance:.04,post_width:.2,rail_height:1.5,segments:20};reserveConnection(bridge);
 await film('load_document',{document:d,start_paused:true});
 for(const bend of [2,-2]){
  await edit({op:'architecture',id:'bridge',params:{bend}});const p=await rpc('scene.architecture',{request:{command:'inspect',id:'bridge',include_parts:true}}),a=p.anchors.find(a=>a.id==='area000000');assert(a?.footprint);assert(Math.abs(a.yaw)<.001);
  for(const k of [0,2]){const lo=a.world[k]-a.size[k]/2,hi=a.world[k]+a.size[k]/2;assert(p.world_bounds.min[k]>=lo-.002&&p.world_bounds.max[k]<=hi+.002,'Complete bridge bounds exceed its reservation');}
  const span=1,oldHalf=span/2+.1;assert(p.components.filter(c=>c.part.startsWith('post')).some(c=>Math.abs(c.p[2])>oldHalf+.5),'Extreme test must detect the former under-sized cap');
  results.push({bend,footprint:a,bounds:p.world_bounds});
 }
}finally{await film('stop');await film('load_document',{document:before,start_paused:true});await edit({op:'camera',yaw:before.initial.cam_yaw*180/Math.PI,pitch:before.initial.cam_pitch*180/Math.PI,dist:before.initial.cam_dist});assert.deepEqual((await film('document',{expanded:true})).initial.geo,before.initial.geo);}
fs.writeFileSync(file,JSON.stringify({passed:true,restored:true,results},null,2));console.log('PASS complete extreme bridge bounds, both bend directions, detects former short cap; scene restored');
