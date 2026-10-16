/* The same small invariants drive browser and native recipe regressions. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PolyniteRecipeChecks=api;})(typeof window==='object'?window:this,()=>{
 const assert=(ok,message)=>{if(!ok)throw Error(message);},distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
 function footprint(objects,selector){
  const parts=objects.filter(o=>o.t!=='group'&&(selector.id?o.id===selector.id:o.id.startsWith(selector.prefix)));assert(parts.length,'Layout group missing: '+JSON.stringify(selector));
  const box=[Infinity,Infinity,-Infinity,-Infinity];
  const byId=new Map(objects.map(o=>[o.id,o]));
  const transform=(p,o)=>{const [x,y,z]=(o.r||[0,0,0]).map(v=>v*Math.PI/180),q=p.map((v,i)=>v*(o.s?.[i]??1));let [a,b,c]=q;[b,c]=[b*Math.cos(x)-c*Math.sin(x),b*Math.sin(x)+c*Math.cos(x)];[a,c]=[a*Math.cos(y)+c*Math.sin(y),-a*Math.sin(y)+c*Math.cos(y)];[a,b]=[a*Math.cos(z)-b*Math.sin(z),a*Math.sin(z)+b*Math.cos(z)];return [a,b,c].map((v,i)=>v+(o.p?.[i]||0));};
  for(const o of parts){assert(o.p&&o.s,'Layout dimensions missing: '+o.id);
   for(let bits=0;bits<8;bits++){let p=[0,1,2].map(i=>bits&(1<<i)?.5:-.5),node=o,depth=0;while(node){assert(++depth<=16,'Layout parent cycle');p=transform(p,node);if(node.parent)assert(byId.has(node.parent),'Layout parent missing: '+node.parent);node=node.parent?byId.get(node.parent):null;}box[0]=Math.min(box[0],p[0]);box[1]=Math.min(box[1],p[2]);box[2]=Math.max(box[2],p[0]);box[3]=Math.max(box[3],p[2]);}
  }return box;
 }
 const gap=(a,b)=>Math.max(b[0]-a[2],a[0]-b[2],b[1]-a[3],a[1]-b[3]);
 function create(c){let first,last;
  return {observe(i,plan,live){
   if(c.type==='motion'){const o=live.objects.find(o=>o.id===c.object);assert(o,'Animated part missing');if(i===0)first=o.r;if(i===1)assert(o.r.some((v,k)=>Math.abs(v-first[k])>c.min_degrees),'Petals did not articulate');last=o.r;}
   else if(c.type==='support'){const posts=plan.components.filter(p=>p.part.startsWith(c.part_prefix));assert(posts.length===4,'Support count differs');if(i===1)assert(Math.max(...posts.map(p=>p.s[1]))-Math.min(...posts.map(p=>p.s[1]))>c.min_height_spread,'Feet did not adapt');}
   else if(c.type==='corridor'){const context=plan.resolved_context[0],o=live.objects.find(o=>o.id===c.object);assert(o,'Path geometry missing');if([0,1,3].includes(i))assert(Math.abs(o.p[0]-context.points[0][0])<.02,'Path and declared context differ');const [a,b]=context.points,dx=b[0]-a[0],dz=b[2]-a[2];for(const p of plan.components.filter(p=>p.part.startsWith('post'))){const t=Math.max(0,Math.min(1,((p.p[0]-a[0])*dx+(p.p[2]-a[2])*dz)/(dx*dx+dz*dz)));assert(Math.hypot(p.p[0]-a[0]-t*dx,p.p[2]-a[2]-t*dz)>=context.size[0]/2-.002,'Post obstructs path');}if(i===0)first=plan.components.map(p=>p.part);if(i===3)assert(JSON.stringify(first)===JSON.stringify(plan.components.map(p=>p.part)),'Opening did not return');}
   else if(c.type==='span'){const ends=plan.anchors.filter(a=>/^(left|rght)/.test(a.id)),context=plan.resolved_context;assert(ends.length===2&&context.length===2,'Bridge endpoints missing');for(let j=0;j<2;j++)assert(distance(ends[j].local,context[j].p)<.01,'Bridge endpoint detached from shore');const deck=plan.components.filter(p=>p.part.startsWith(c.part_prefix));assert(deck.length===plan.recipe.params.segments,'Deck segment count differs');assert(deck.every(p=>p.s.every(v=>Number.isFinite(v)&&v>0)),'Invalid deck geometry');}
   else if(c.type==='layout'){
    for(const p of c.pairs){const d=gap(footprint(live.objects,p.a),footprint(live.objects,p.b));assert(d>=p.gap,'Layout clearance failed: '+JSON.stringify(p)+' actual '+d.toFixed(3));}
    for(const p of c.connections||[])assert(gap(footprint(live.objects,p.a),footprint(live.objects,p.b))<=p.max_gap,'Access path is disconnected');
    if(c.boundary)for(const o of live.objects.filter(o=>o.t!=='group'&&o.id.startsWith(c.boundary.prefix))){const b=footprint(live.objects,{id:o.id});for(const x of [b[0],b[2]])for(const z of [b[1],b[3]])assert(Math.hypot(x-c.boundary.center[0],z-c.boundary.center[1])<=c.boundary.radius,'Boundary extends beyond its support');}
    if(c.stairs){const steps=live.objects.filter(o=>o.id.startsWith(c.stairs.prefix)).sort((a,b)=>a.p[1]-b.p[1]),deck=live.objects.find(o=>o.id===c.stairs.deck);assert(steps.length===c.stairs.count&&deck,'Access steps missing');let top=c.stairs.ground||0;for(const s of steps){const next=s.p[1]+s.s[1]/2;assert(next>top&&next-top<=c.stairs.max_rise,'Stair rise is unsafe');top=next;}assert(Math.abs(top-deck.p[1]-deck.s[1]/2)<.015,'Steps do not reach the deck');}
   }
   else throw Error('Unknown check type '+c.type);
  },finish(){if(c.type==='motion')assert(last.every((v,i)=>Math.abs(v-first[i])<.03),'Loop did not close');}};
 }
 return {create};
});
