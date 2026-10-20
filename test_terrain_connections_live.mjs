/* Native recipe regression. Preserve the live document and never resize windows. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash}from'node:crypto';import {createRequire}from'node:module';
const require=createRequire(import.meta.url),{fixture}=require('./author_terrain_connections.cjs'),checks=require('./public-site-src/recipe-checks.js');
const dir=process.argv[2]||'D:/dev/mcp-production-dry-run/terrain-connections-2026-10-19';fs.mkdirSync(dir,{recursive:true});
const author_sha256=createHash('sha256').update(fs.readFileSync(new URL('./author_terrain_connections.cjs',import.meta.url))).digest('hex');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function raw(method,params={}){return(await fetch('http://127.0.0.1:8790/mcp',{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:720,method,params}),signal:AbortSignal.timeout(30000)})).json();}
async function rpc(method,params={}){const j=await raw(method,params);assert(!j.error&&j.result?.ok!==false,JSON.stringify(j.error||j.result));return j.result;}
const film=(command,extra={})=>rpc('scene.cinematic',{request:{command,...extra}}),inspect=id=>rpc('scene.architecture',{request:{command:'inspect',id,include_parts:true}}),edit=(...actions)=>rpc('scene.apply',{actions});
async function reject(actions,pattern){const j=await raw('scene.apply',{actions});assert(j.error||j.result?.ok===false,'Invalid transaction succeeded');if(pattern)assert.match(JSON.stringify(j),pattern);return j;}
async function seek(time){await film('seek',{time});for(let i=0;i<160;i++){await sleep(150);const s=await film('status');if(!s.seeking&&Math.abs(s.time-time)<.05)return;}assert.fail('Seek timed out');}
async function capture(name){let s=await rpc('scene.capture',{request:{command:'render',gallery:false,width:1280,height:720}});for(let i=0;s.pending&&i<120;i++){await sleep(150);s=await rpc('scene.capture',{request:{command:'status',id:s.id}});}assert(s.ready,JSON.stringify(s));fs.copyFileSync(path.isAbsolute(s.path)?s.path:path.join('D:/dev/wnex/wk/emp/src/mesh/meshopt',s.path),path.join(dir,name+'.png'));}
function verify(plan){
 checks.create({type:'connection'}).observe(0,plan,{});
 return plan.anchors.filter(a=>a.id.startsWith('mark')).map(a=>a.local);
}
const status=await film('status');assert(!status.playing&&!status.export.active,'Viewer must be idle');
const before=await film('document',{expanded:true});fs.writeFileSync(path.join(dir,'before.scene'),JSON.stringify(before));
const results=[];let changed=false;
try{
 assert((await rpc('scene.capabilities')).commands.recipe_terrain);
 for(const kind of ['path','bridge','garden'].filter(k=>!process.argv.includes('--ids')||process.argv[process.argv.indexOf('--ids')+1].split(',').includes(k)))for(const variant of ['original','curved','high-bank'].filter(v=>!process.argv.includes('--variants')||process.argv[process.argv.indexOf('--variants')+1].split(',').includes(v))){
  const name=kind+'-'+variant,doc=fixture(kind,variant);await film('load_document',{document:doc,start_paused:true});changed=true;
  const ids=kind==='garden'?['approach','bridge','entry']:[kind];
  const initial=await film('document',{expanded:true});fs.writeFileSync(path.join(dir,name+'.scene'),JSON.stringify(initial));
  const states=[];for(const time of [0,2.8,5.6]){if(process.argv.includes('--quick')){if(time===2.8)await edit({op:'infinite',edit:doc.seq[0].edit});if(time===5.6)await edit({op:'infinite',edits:doc.initial.infinite.edits});}else await seek(time);const plans=[];for(const id of ids){const p=await inspect(id);verify(p);plans.push(p);}states.push(plans);console.log('CHECK',name,time);}
  assert(states[1].some((p,i)=>JSON.stringify(p.anchors)!==JSON.stringify(states[0][i].anchors)),'Terrain did not update connections');
  fs.writeFileSync(path.join(dir,name+'.plans.json'),JSON.stringify(states));
  for(let i=0;i<ids.length;i++)assert.deepEqual(states[2][i].components,states[0][i].components,'Ground reset did not restore connection');
  if(!process.argv.includes('--quick')){await film('stop');await film('load_document',{document:initial,start_paused:true});}
  const first=ids[0],p=await inspect(first),mutate={op:'architecture',id:'shore_b',p:kind==='garden'?[2,0,4.2]:[1,0,4.8]};
  if(variant==='original'){
   await reject([{op:'architecture',id:first,params:{thickness:.25,clearance:.3}}],/buried/);
   await reject([{op:'architecture',id:'shore_a',attach:{to:kind==='garden'?'bridge':first,anchor:'left000000'}}],/cycle|cyclic/);
   assert.deepEqual((await inspect(first)).recipe.params,p.recipe.params,'Rejected connection changed its parameters');
  }
  if(variant==='original'&&!process.argv.includes('--quick')){
  await edit(mutate);for(const id of ids)verify(await inspect(id));assert.notDeepEqual((await inspect(kind==='garden'?'bridge':first)).anchors,states[0][ids.indexOf(kind==='garden'?'bridge':first)].anchors);
  await film('load_document',{document:initial,start_paused:true});await edit({op:'architecture',id:first,params:{width:.8,bend:.35}});verify(await inspect(first));
  await film('load_document',{document:initial,start_paused:true});
  const stable=(await film('document',{expanded:true})).initial;
  const source=(await inspect('shore_a')).recipe.p;
  await reject([{op:'architecture',id:'shore_b',p:source}],/span/);
  await reject([{op:'architecture',id:first,context:[{name:'left',instance:'missing',anchor:'top000000'},{name:'right',instance:'shore_b',anchor:'top000000'},{name:'ground',terrain:'infinite'}]}],/missing/);
  await reject([{op:'infinite',on:false}],/terrain/);
  assert.deepEqual((await film('document',{expanded:true})).initial.architecture,stable.architecture,'Failed transaction changed recipes');
  // A locked/overridden part survives normal dependency changes and save/reopen.
  await edit({op:'architecture',id:first,override:{part:'deck000000',offset:[0,.01,0],locked:true}});await edit({op:'architecture',id:'shore_b',params:{lift:.5}});assert((await inspect(first)).recipe.overrides?.length||JSON.stringify((await inspect(first)).recipe).includes('deck000000'));
  }
  if(process.argv.includes('--quick')){await capture(name);await edit({op:'infinite',edit:doc.seq[0].edit});await capture(name+'-raised');}else{await film('load_document',{document:initial,start_paused:true});await seek(2.8);await capture(name);await film('stop');}
  if(variant==='original'&&process.argv.includes('--record')){
   await film('load_document',{document:initial,start_paused:true});await film('record',{name:'terrain-'+kind,directory:dir,format:'landscape',resolution:720,fps:30,encoder:0,loop:true,restore_initial:true,thumbnails:0});
   let s;for(let i=0;i<900;i++){await sleep(500);s=await film('status');if(i%20===0)console.log('RECORD',kind,s.export.frame+'/'+s.export.frames);if(!s.export.active)break;}assert(s.export.completed,JSON.stringify(s.export));fs.writeFileSync(path.join(dir,name+'.record.json'),JSON.stringify(s.export));
  }
  results.push({kind,variant,passed:true,instances:ids});fs.writeFileSync(path.join(dir,'progress.json'),JSON.stringify(results,null,2));console.log('PASS',name);
 }
}finally{
 if(changed){const s=await film('status');assert(!s.export.active,'Preserve active export');await film('stop');await film('load_document',{document:before,start_paused:true});await rpc('scene.apply',{actions:[{op:'camera',yaw:before.initial.cam_yaw*180/Math.PI,pitch:before.initial.cam_pitch*180/Math.PI,dist:before.initial.cam_dist}]});const after=await film('document',{expanded:true});assert.deepEqual(after.initial.architecture,before.initial.architecture);assert.deepEqual(after.initial.geo,before.initial.geo);console.log('RESTORED live document and camera; OS window untouched');}
}
fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify({passed:true,restored:true,author_sha256,results},null,2));
