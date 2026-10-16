/* The same small invariants drive browser and native recipe regressions. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PolyniteRecipeChecks=api;})(typeof window==='object'?window:this,()=>{
 const assert=(ok,message)=>{if(!ok)throw Error(message);},distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
 function create(c){let first,last;
  return {observe(i,plan,live){
   if(c.type==='motion'){const o=live.objects.find(o=>o.id===c.object);assert(o,'Animated part missing');if(i===0)first=o.r;if(i===1)assert(o.r.some((v,k)=>Math.abs(v-first[k])>c.min_degrees),'Petals did not articulate');last=o.r;}
   else if(c.type==='support'){const posts=plan.components.filter(p=>p.part.startsWith(c.part_prefix));assert(posts.length===4,'Support count differs');if(i===1)assert(Math.max(...posts.map(p=>p.s[1]))-Math.min(...posts.map(p=>p.s[1]))>c.min_height_spread,'Feet did not adapt');}
   else if(c.type==='corridor'){const context=plan.resolved_context[0],o=live.objects.find(o=>o.id===c.object);assert(o,'Path geometry missing');if([0,1,3].includes(i))assert(Math.abs(o.p[0]-context.points[0][0])<.02,'Path and declared context differ');const [a,b]=context.points,dx=b[0]-a[0],dz=b[2]-a[2];for(const p of plan.components.filter(p=>p.part.startsWith('post'))){const t=Math.max(0,Math.min(1,((p.p[0]-a[0])*dx+(p.p[2]-a[2])*dz)/(dx*dx+dz*dz)));assert(Math.hypot(p.p[0]-a[0]-t*dx,p.p[2]-a[2]-t*dz)>=context.size[0]/2-.002,'Post obstructs path');}if(i===0)first=plan.components.map(p=>p.part);if(i===3)assert(JSON.stringify(first)===JSON.stringify(plan.components.map(p=>p.part)),'Opening did not return');}
   else if(c.type==='span'){const ends=plan.anchors.filter(a=>/^(left|rght)/.test(a.id)),context=plan.resolved_context;assert(ends.length===2&&context.length===2,'Bridge endpoints missing');for(let j=0;j<2;j++)assert(distance(ends[j].local,context[j].p)<.01,'Bridge endpoint detached from shore');const deck=plan.components.filter(p=>p.part.startsWith(c.part_prefix));assert(deck.length===plan.recipe.params.segments,'Deck segment count differs');assert(deck.every(p=>p.s.every(v=>Number.isFinite(v)&&v>0)),'Invalid deck geometry');}
   else throw Error('Unknown check type '+c.type);
  },finish(){if(c.type==='motion')assert(last.every((v,i)=>Math.abs(v-first[i])<.03),'Loop did not close');}};
 }
 return {create};
});
