/* Check actual serialized primitive geometry against each declared object radius. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=process.argv[2]||'D:/dev/mcp-production-dry-run/placement-2026-10-19/verified',results=[];
for(const kind of ['study','garden'])for(const variant of ['original','wide','space']){
 const file=path.join(dir,kind+'-'+variant+'.scene'),d=JSON.parse(fs.readFileSync(file)),objects=Object.entries(d.initial.geo),recipes=d.initial.architecture;
 for(const r of recipes.filter(r=>r.attach?.anchor==='seat000000')){
  const slot=recipes.find(s=>s.id===r.attach.to),root=objects.find(([id,o])=>o.t==='group'&&id.endsWith('_'+r.id+'_root'));assert(root,'Attached root missing');let radius=0,count=0;
  for(const [id,o]of objects.filter(([,o])=>o.parent===root[0])){
   assert(['cube','sphere','cylinder','cone'].includes(o.t),'Extend verification for this geometry type');assert(!o.r||Math.abs(o.r[0])+Math.abs(o.r[2])<.0001,'Tilt needs transformed bounds');
   const bound=o.t==='cube'?.5*Math.hypot(o.s[0],o.s[2]):.5*Math.max(o.s[0],o.s[2]);radius=Math.max(radius,Math.hypot(o.p[0],o.p[2])+bound);count++;
  }
  assert(count>0);assert(radius<=slot.params.radius+.001,'Declared radius does not enclose complete '+r.id+': '+radius+' > '+slot.params.radius);results.push({kind,variant,instance:r.id,actual_radius:radius,reserved_radius:slot.params.radius});
 }
 const p=JSON.parse(fs.readFileSync(path.join(dir,kind+'-'+variant+'.plans.json')));
 for(const state of [p.initial,p.adapted])for(let i=0;i<state.length;i++)for(let j=i+1;j<state.length;j++){
  const a=state[i],b=state[j],x=a.anchors.find(a=>a.id==='seat000000').world,z=b.anchors.find(a=>a.id==='seat000000').world;
  assert(Math.hypot(x[0]-z[0],x[2]-z[2])>=a.recipe.params.radius+b.recipe.params.radius+.099,'Placed object circles intersect');
 }
}
fs.writeFileSync(path.join(dir,'whole-object-bounds.json'),JSON.stringify({passed:true,results},null,2));console.log('PASS actual primitive bounds fit declared radii and all placement pairs clear in initial/expanded scenes');
