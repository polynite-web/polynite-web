/* Explicit opt-in regression against an idle native viewer. Never resize a window. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{catalog,source}=require('./build_recipe_examples.cjs');
const args=process.argv.slice(2),arg=name=>args[args.indexOf(name)+1];
assert.ok(args.includes('--endpoint')&&args.includes('--pin'),'Pass --endpoint <native MCP URL> and --pin <current model scene JSON path> to preserve disk state.');
const endpoint=arg('--endpoint'),pin=arg('--pin'),pinBytes=fs.readFileSync(pin),report=args.includes('--report')?arg('--report'):null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function rpc(method,params={}){const j=await(await fetch(endpoint,{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:719,method,params}),signal:AbortSignal.timeout(45000)})).json();assert.ok(!j.error&&j.result?.ok!==false,JSON.stringify(j));return j.result;}
const film=(command,extra={})=>rpc('scene.cinematic',{request:{command,...extra}}),inspect=id=>rpc('scene.architecture',{request:{command:'inspect',id,include_parts:true}});
async function seek(time){await film('seek',{time});for(let i=0;i<200;i++){await sleep(150);const s=await film('status');if(!s.seeking&&Math.abs(s.time-time)<.05)return;}assert.fail('Seek timed out');}
const status=await film('status');assert.ok(!status.playing&&!status.export.active,'Viewer must be idle; never interrupt an export.');
const before=await film('document',{expanded:true}),cap=(await rpc('scene.capabilities')).commands,results=[];
if(report)fs.writeFileSync(report+'.before.scene',JSON.stringify(before,null,2));
try{
 const toolbox=JSON.parse(fs.readFileSync(path.join(source,'operators.json')));
 for(const op of toolbox.items)assert.equal((await rpc('scene.architecture',{request:{command:'operators',operator:op.id}})).operators[0].id,op.id);
 assert.equal((await rpc('scene.architecture',{request:{command:'estimate',recipe:toolbox.starter}})).executed,false);
 console.log('PASS operator discovery and starter recipe estimate');
 for(const e of catalog().items){
  for(const c of e.capabilities)assert.equal(cap[c],true,'Missing capability '+c);
  const doc=JSON.parse(fs.readFileSync(path.join(source,e.id,`v${e.version}.scene`)));await film('load_document',{document:doc});
  for(const check of e.checks){let first,last;
   for(const [i,t]of check.times.entries()){
    await seek(t);const plan=await inspect(check.instance),live=await rpc('scene.describe');
    if(check.type==='motion'){const object=live.objects.find(o=>o.id===check.object);assert.ok(object);if(i===0)first=object.r;if(i===1)assert.ok(object.r.some((v,k)=>Math.abs(v-first[k])>check.min_degrees));last=object.r;}
    if(check.type==='support'){const context=plan.resolved_context[0],posts=plan.components.filter(p=>p.part.startsWith(check.part_prefix));assert.equal(posts.length,4);if(i===1)assert.ok(Math.max(...posts.map(p=>p.s[1]))-Math.min(...posts.map(p=>p.s[1]))>check.min_height_spread);assert.ok(live.objects.some(o=>o.id===check.source));assert.ok(context.slope);}
    if(check.type==='corridor'){
     const context=plan.resolved_context[0],p=live.objects.find(o=>o.id===check.object);assert.ok(p);const x=context.points[0][0],width=context.size[0];if(i===0){assert.ok(Math.abs(p.p[0]-x)<.02);first=plan.components.map(p=>p.part);}if(i===1){assert.ok(x>1.39);assert.ok(Math.abs(p.p[0]-x)<.02);}if(i===3){assert.ok(Math.abs(p.p[0]-x)<.02);assert.deepEqual(plan.components.map(p=>p.part),first);}
     for(const part of plan.components.filter(p=>p.part.startsWith('post'))){const [a,b]=context.points,dx=b[0]-a[0],dz=b[2]-a[2],t=Math.max(0,Math.min(1,((part.p[0]-a[0])*dx+(part.p[2]-a[2])*dz)/(dx*dx+dz*dz))),distance=Math.hypot(part.p[0]-a[0]-t*dx,part.p[2]-a[2]-t*dz);assert.ok(distance>=width/2-.002);}
    }
   }
   if(check.type==='motion')assert.ok(last.every((v,i)=>Math.abs(v-first[i])<.03),'Loop endpoint differs');
  }
  results.push({id:e.id,version:e.version,passed:true,checks:e.checks.map(c=>c.type)});await film('stop');console.log('PASS',e.id);
 }
}finally{
 const s=await film('status');assert.ok(!s.export.active,'Preserve active export');if(s.playing)await film('stop');await film('load_document',{document:before});await rpc('scene.apply',{actions:[{op:'camera',yaw:before.initial.cam_yaw*180/Math.PI,pitch:before.initial.cam_pitch*180/Math.PI,dist:before.initial.cam_dist}]});await sleep(1300);fs.writeFileSync(pin,pinBytes);const after=await film('document',{expanded:true});assert.deepEqual(after.initial.geo,before.initial.geo);assert.deepEqual(after.initial.architecture,before.initial.architecture);assert.equal(after.model,before.model);console.log('Original scene/camera and pinned file restored; OS window untouched.');
}
if(report)fs.writeFileSync(report,JSON.stringify({passed:true,results,restored:true},null,2));
