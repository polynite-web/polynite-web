/* Real native checks; preserve the live document, camera and OS window. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire}from'node:module';import {createHash}from'node:crypto';
const require=createRequire(import.meta.url),author=require('./author_clearance_placement.cjs'),checks=require('./public-site-src/recipe-checks.js');
const author_sha256=createHash('sha256').update(fs.readFileSync(new URL('./author_clearance_placement.cjs',import.meta.url))).digest('hex');
const dir=process.argv[2]||'D:/dev/mcp-production-dry-run/placement-2026-10-19/verified';fs.mkdirSync(dir,{recursive:true});
const write=(name,v)=>fs.writeFileSync(path.join(dir,name),JSON.stringify(v,null,2));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function raw(method,params={}){return(await fetch('http://127.0.0.1:8790/mcp',{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:921,method,params}),signal:AbortSignal.timeout(180000)})).json();}
async function rpc(method,params={}){const j=await raw(method,params);assert(!j.error&&j.result?.ok!==false,JSON.stringify(j));return j.result;}
const film=(command,extra={})=>rpc('scene.cinematic',{request:{command,...extra}}),inspect=id=>rpc('scene.architecture',{request:{command:'inspect',id,include_parts:true}}),edit=(...actions)=>rpc('scene.apply',{actions});
async function reject(actions,match){const j=await raw('scene.apply',{actions});assert(j.error||j.result?.ok===false,'Invalid edit succeeded');if(match)assert.match(JSON.stringify(j),match);}
async function capture(name){let s=await rpc('scene.capture',{request:{command:'render',gallery:false,width:1280,height:720}});for(let i=0;s.pending&&i<180;i++){await sleep(150);s=await rpc('scene.capture',{request:{command:'status',id:s.id}});}assert(s.ready);fs.copyFileSync(path.isAbsolute(s.path)?s.path:path.join('D:/dev/wnex/wk/emp/src/mesh/meshopt',s.path),path.join(dir,name+'.png'));}
const state=await film('status');assert(!state.playing&&!state.export.active,'Preserve active playback/export');assert((await rpc('scene.capabilities')).commands.recipe_footprints);
const before=await film('document',{expanded:true});write('before.scene',before);const results=[];let changed=false;
try{
 for(const kind of ['study','garden'].filter(k=>!process.argv.includes('--ids')||process.argv[process.argv.indexOf('--ids')+1].split(',').includes(k)))for(const variant of ['original','wide','space'].filter(v=>!process.argv.includes('--variants')||process.argv[process.argv.indexOf('--variants')+1].split(',').includes(v))){
  const name=kind+'-'+variant,doc=author.fixture(kind,variant);await film('load_document',{document:doc,start_paused:true});changed=true;
  const ids=kind==='study'?['place']:Array.from({length:6},(_,i)=>'slot'+i),plans=[];
  for(const id of ids){const p=await inspect(id);checks.create({type:'placement'}).observe(0,p,{});plans.push(p);}
  console.log('LOADED',name);const initial=await film('document',{expanded:true});write(name+'.scene',initial);await capture(name);
  const source=kind==='study'?'source':'temple',params=(await inspect(source)).recipe.params;
  await edit({op:'architecture',id:source,params:{width:kind==='study'?4:5.5}});
  const adapted=[];for(const id of ids){const p=await inspect(id);checks.create({type:'placement'}).observe(0,p,{});adapted.push(p);}
  if(kind==='study'&&variant==='original')assert.notDeepEqual(adapted[0].anchors,plans[0].anchors,'Growing obstacle must move placement');
  await capture(name+'-expanded');await edit({op:'architecture',id:source,params});
  for(let i=0;i<ids.length;i++)assert.deepEqual((await inspect(ids[i])).anchors,plans[i].anchors,'Returning obstacle must restore placement');
  if(variant==='original'){
   const stable=await film('document',{expanded:true});
   await reject([{op:'architecture',id:ids[0],params:{radius:3,search:.1,x:0,z:0}}],/No free candidate/);
   assert.deepEqual((await film('document',{expanded:true})).initial.architecture,stable.initial.architecture,'Rejected placement mutated recipes');
   if(kind==='garden'){
    await reject([{op:'architecture',id:'cherry',params:{spread:1.8}}],/Whole object exceeds/);
    await reject([{op:'architecture',id:'slot4',params:{x:-1,z:-.4}}],/Placed objects overlap/);
    assert.deepEqual((await film('document',{expanded:true})).initial.architecture,stable.initial.architecture,'Rejected canopy/peer overlap changed recipes');
   }
   if(kind==='study'){
    const footprint=(await inspect('source')).recipe,invalid=structuredClone(footprint);invalid.program.nodes.find(n=>n.op==='footprint').r=[1,0,0];await reject([{op:'architecture',id:'source',program:invalid.program}],/yaw-only/);
    const height=author.placement();height.context=[{name:'ground',object:'ground',point:'top'},{name:'block',instance:'source',anchor:'body000000'}];height.program.let[0].value=['height','@block',0,0];await reject([{op:'architecture',id:'bad',...height}],/distance only/);
    const point=author.placement();point.context[0]={name:'ground',object:'ground',point:'top'};point.context[1]={name:'block',instance:'place',anchor:'seat000000'};await reject([{op:'architecture',id:'bad',...point}],/point anchor/);
    const saved=await film('document',{expanded:true});await film('load_document',{document:saved,start_paused:true});checks.create({type:'placement'}).observe(0,await inspect('place'),{});
    await edit({op:'architecture',id:'object',override:{part:'top000000',offset:[0,.01,0],locked:true}});await edit({op:'architecture',id:'source',params:{width:4}});assert(JSON.stringify((await inspect('object')).recipe).includes('top000000'));await film('load_document',{document:initial,start_paused:true});
   }
  }
  write(name+'.plans.json',{initial:plans,adapted});
  if(variant==='original'&&process.argv.includes('--record')){
   await film('load_document',{document:initial,start_paused:true});await film('record',{name:'clearance-'+kind,directory:dir,format:'landscape',resolution:720,fps:30,encoder:0,loop:true,restore_initial:true,thumbnails:0});
   let s;for(let i=0;i<900;i++){await sleep(500);s=await film('status');if(i%30===0)console.log('RECORD',kind,s.export.frame+'/'+s.export.frames);if(!s.export.active)break;}assert(s.export.completed,JSON.stringify(s.export));write(name+'.record.json',s.export);
  }
  results.push({kind,variant,passed:true});write('progress.json',results);console.log('PASS',name);
 }
}finally{
 if(changed){assert(!(await film('status')).export.active,'Leave active export untouched');await film('stop');await film('load_document',{document:before,start_paused:true});await edit({op:'camera',yaw:before.initial.cam_yaw*180/Math.PI,pitch:before.initial.cam_pitch*180/Math.PI,dist:before.initial.cam_dist});const after=await film('document',{expanded:true});assert.deepEqual(after.initial.architecture,before.initial.architecture);assert.deepEqual(after.initial.geo,before.initial.geo);console.log('RESTORED live document and camera; window untouched');}
}
write('results.json',{passed:true,restored:true,author_sha256,results});
