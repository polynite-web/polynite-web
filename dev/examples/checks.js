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
 function prismCaps(plan){return plan.components.filter(p=>p.surface?.kind===4).map(p=>{const angle=(p.r?.[1]||0)*Math.PI/180,co=Math.cos(angle),si=Math.sin(angle),shape=p.surface;const top=shape.path.map(v=>[p.p[0]+co*v[0]*p.s[0]+si*v[2]*p.s[2],p.p[1]+v[1]*p.s[1],p.p[2]-si*v[0]*p.s[0]+co*v[2]*p.s[2]]);assert(top.length>=3&&top.length<=16,'Invalid junction polygon');const a=top[0],b=top[1],d=top[2],u=b.map((v,k)=>v-a[k]),v=d.map((v,k)=>v-a[k]),normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];assert(Math.abs(normal[1])>1e-8,'Degenerate junction');const height=q=>a[1]-(normal[0]*(q[0]-a[0])+normal[2]*(q[2]-a[2]))/normal[1];const inside=(q,strict=false)=>{let sign=0;for(let j=0;j<top.length;j++){const a=top[j],b=top[(j+1)%top.length],cross=(b[0]-a[0])*(q[2]-a[2])-(b[2]-a[2])*(q[0]-a[0]);if(Math.abs(cross)<(strict?1e-5:1e-6)){if(strict)return false;continue;}if(sign&&sign*cross<0)return false;sign=cross;}return true;};for(const v of top)assert(Math.abs(v[1]-height(v))<.0001,'Junction cap not planar');return {...p,top,height,inside,base:q=>shape.base_mode?p.p[1]+shape.base*p.s[1]:height(q)-shape.thickness*p.s[1]};});}
 function create(c){let first,last;
  return {observe(i,plan,live,source){
   if(c.type==='motion'){const o=live.objects.find(o=>o.id===c.object);assert(o,'Animated part missing');if(i===0)first=o.r;if(i===1)assert(o.r.some((v,k)=>Math.abs(v-first[k])>c.min_degrees),'Petals did not articulate');last=o.r;}
   else if(c.type==='support'){const posts=plan.components.filter(p=>p.part.startsWith(c.part_prefix));assert(posts.length===4,'Support count differs');if(i===1)assert(Math.max(...posts.map(p=>p.s[1]))-Math.min(...posts.map(p=>p.s[1]))>c.min_height_spread,'Feet did not adapt');}
   else if(c.type==='corridor'){const context=plan.resolved_context[0],o=live.objects.find(o=>o.id===c.object);assert(o,'Path geometry missing');if([0,1,3].includes(i))assert(Math.abs(o.p[0]-context.points[0][0])<.02,'Path and declared context differ');const [a,b]=context.points,dx=b[0]-a[0],dz=b[2]-a[2];for(const p of plan.components.filter(p=>p.part.startsWith('post'))){const t=Math.max(0,Math.min(1,((p.p[0]-a[0])*dx+(p.p[2]-a[2])*dz)/(dx*dx+dz*dz)));assert(Math.hypot(p.p[0]-a[0]-t*dx,p.p[2]-a[2]-t*dz)>=context.size[0]/2-.002,'Post obstructs path');}if(i===0)first=plan.components.map(p=>p.part);if(i===3)assert(JSON.stringify(first)===JSON.stringify(plan.components.map(p=>p.part)),'Opening did not return');}
   else if(c.type==='span'){const ends=plan.anchors.filter(a=>/^(left|rght)/.test(a.id)),context=plan.resolved_context;assert(ends.length===2&&context.length===2,'Bridge endpoints missing');for(let j=0;j<2;j++)assert(distance(ends[j].local,context[j].p)<.01,'Bridge endpoint detached from shore');const deck=plan.components.filter(p=>p.part.startsWith(c.part_prefix));assert(deck.length===plan.recipe.params.segments,'Deck segment count differs');assert(deck.every(p=>p.s.every(v=>Number.isFinite(v)&&v>0)),'Invalid deck geometry');}
   else if(c.type==='connection'){
    const p=plan.recipe.params,marks=plan.anchors.filter(a=>a.id.startsWith('mark')).map(a=>a.local),deck=plan.components.filter(a=>a.part.startsWith('deck'));
    assert(marks.length===p.segments+1&&deck.length===p.segments,'Connection stations or deck segments missing');
    for(const [id,name,index]of [['left000000','left',0],['rght000000','right',p.segments]]){const end=plan.anchors.find(a=>a.id===id),source=plan.resolved_context.find(a=>a.name===name);assert(end&&source&&distance(end.local,source.p)<.004&&distance(marks[index],source.p)<.004,'Connection end detached from its construction');}
    for(let j=0;j<deck.length;j++){const a=marks[j],b=marks[j+1],tile=deck[j];assert(tile.p.concat(tile.s).every(Number.isFinite)&&tile.s.every(v=>v>0),'Invalid connection tile');assert(distance(tile.p,[(a[0]+b[0])/2,(a[1]+b[1])/2-p.thickness/2,(a[2]+b[2])/2])<.004,'Deck does not follow its stations');assert(Math.abs(tile.s[2]-distance(a,b)-.008)<.004,'Deck length does not join its stations');}
    assert(plan.components.filter(p=>p.part.startsWith('rail')).length===(p.rail_height>=.01?2*p.segments:0),'Connection rails missing');assert(plan.components.filter(p=>p.part.startsWith('post')).length===(p.rail_height>=.01?2*(p.segments+1):0),'Connection rail posts missing');
    if(i===0)first=marks;if(c.must_adapt&&i===1)assert(marks.some((p,j)=>distance(p,first[j])>.03),'Connection did not adapt to the terrain');if(c.returns&&i===2)assert(marks.every((p,j)=>distance(p,first[j])<.004),'Connection did not return with its terrain');
   }
   else if(c.type==='placement'){
    const p=plan.recipe.params,seat=plan.anchors.find(a=>a.id==='seat000000'),sources=plan.resolved_context.filter(a=>a.name!=='ground');
    assert(seat&&sources.length,'Placement sources missing');
    const signed=(source,x,z)=>{const a=-source.yaw*Math.PI/180,dx=x-source.origin[0],dz=z-source.origin[2],qx=Math.abs(Math.cos(a)*dx+Math.sin(a)*dz)-source.size[0]/2,qz=Math.abs(-Math.sin(a)*dx+Math.cos(a)*dz)-source.size[2]/2;return Math.hypot(Math.max(qx,0),Math.max(qz,0))+Math.min(0,Math.max(qx,qz));};
    const candidates=[[p.x,p.z],[p.x+p.search,p.z],[p.x-p.search,p.z],[p.x,p.z+p.search],[p.x,p.z-p.search]],selected=candidates.find(([x,z])=>sources.every(s=>signed(s,x,z)>=p.radius+p.margin-.0001));
    assert(selected&&Math.hypot(selected[0]-seat.local[0],selected[1]-seat.local[2])<.004,'Placement did not select the first clear candidate');
    for(const s of sources)assert(s.size[0]>0&&s.size[2]>0&&signed(s,seat.local[0],seat.local[2])>=p.radius+p.margin-.002,'Complete object or margin intersects a reservation');
    if(i===0)first=seat.local;if(c.must_adapt&&i===1)assert(distance(first,seat.local)>.1,'Placement did not react to the reservation');if(c.returns&&i===2)assert(distance(first,seat.local)<.004,'Placement did not return');
   }
   else if(c.type==='geometry'){
    for(const rule of c.rules){const parts=plan.components.filter(p=>p.part.startsWith(rule.prefix));const count=(rule.count_parameters||[]).reduce((n,key)=>n*plan.recipe.params[key],rule.multiplier||1);assert(parts.length===count,'Repeated component count differs: '+rule.prefix);
     for(const p of parts){assert(p.p.concat(p.s).every(Number.isFinite)&&p.s.every(v=>v>0),'Invalid component pose');if(rule.profile_points)assert(p.surface?.profile?.length===rule.profile_points,'Custom profile missing');if(rule.path_points)assert(p.surface?.path?.length===rule.path_points,'Custom sweep path missing');}
    }
   }
   else if(c.type==='roof_link'){
    assert(source?.roof_ports?.some(p=>p.id===c.port),'Provider roof port missing');assert(plan.recipe.attach?.to===c.source,'Attachment provider differs');assert(plan.resolved_context?.some(p=>p.roof===c.port&&p.source_faces>0),'Resolved roof snapshot missing');
    const world=p=>{const yaw=(p.world_yaw||0)*Math.PI/180,co=Math.cos(yaw),si=Math.sin(yaw),origin=p.world_position;return {...p,components:p.components.map(o=>({...o,p:[origin[0]+co*o.p[0]+si*o.p[2],origin[1]+o.p[1],origin[2]-si*o.p[0]+co*o.p[2]],r:[0,(o.r?.[1]||0)+(p.world_yaw||0),0]}))};};
    const local=prismCaps(world(plan)),host=prismCaps(world(source)).filter(p=>p.role==='roof'),roofs=local.filter(p=>p.role==='roof'),walls=local.filter(p=>p.role==='paper');assert(roofs.length&&walls.length&&host.length,'Linked shell geometry missing');
    for(const r of roofs){const q=r.top.reduce((s,p)=>s.map((v,j)=>v+p[j]/r.top.length),[0,0,0]);for(const h of host.filter(h=>h.inside(q,true)))assert(r.height(q)>h.height(q)+.00001,'Consumer roof did not yield to its provider');}
    for(const w of walls)if(!w.top.every(p=>Math.abs(p[1]-(plan.world_position[1]+.65))<.004))for(const q of w.top){const over=[...host,...roofs].filter(r=>r.inside(q));assert(over.length,'Linked wall outside both roofs');assert(Math.min(...over.map(r=>Math.abs(q[1]-r.base(q)+.002)))<.006,'Linked wall cap does not follow the combined roof');}
    const ground=plan.resolved_context.find(p=>p.roof===c.port).p[1],steps=plan.components.filter(p=>p.part.startsWith('step')).sort((a,b)=>b.p[2]-a.p[2]);assert(steps.length===(ground<=-.03?3:0),'Gallery stair count differs');for(const p of steps)assert(Math.abs(p.p[1]-p.s[1]/2-ground)<.003,'Gallery steps float above their declared ground');if(steps.length){assert(Math.abs(steps[0].p[1]+steps[0].s[1]/2)<.003,'Gallery steps do not reach the deck');const deck=plan.components.find(p=>p.part.startsWith('deck'));assert(Math.abs(steps[0].p[2]+steps[0].s[2]/2-(deck.p[2]-deck.s[2]/2))<.003,'Gallery steps miss the deck edge');}
    if(i===0)first=JSON.stringify(plan.components);else assert(JSON.stringify(plan.components)!==first,'Source edit did not adapt its independent neighbour');
   }
   else if(c.type==='junction'){
    const scale=c.uniform_scale?plan.recipe.params[c.uniform_scale]:1;const prisms=prismCaps(plan);
    const roofs=prisms.filter(p=>p.role==='roof'),walls=prisms.filter(p=>p.role==='paper');assert(roofs.length>=2&&walls.length>=8,'Joined shell missing');assert(new Set(plan.components.map(p=>p.part)).size===plan.components.length,'Junction IDs collide');
    for(const w of walls)if(!(c.sill_tops||[]).some(y=>w.top.every(v=>Math.abs(v[1]-y*scale)<.004)))for(const v of w.top){const over=roofs.filter(r=>r.inside(v));assert(over.length,'Wall escapes roof');const error=Math.min(...over.map(r=>Math.abs(v[1]-r.base(v)+.002*scale)));assert(error<.006,'Wall does not follow roof underside '+w.part+' at '+JSON.stringify(v));}
    for(const point of c.voids||[]){const q=point.map(v=>v*scale);assert(!walls.some(w=>w.inside(q)&&q[1]>w.base(q)+.001&&q[1]<w.height(q)-.001),'Opening is filled');}
    for(const point of c.solids||[]){const q=point.map(v=>v*scale);assert(walls.some(w=>w.inside(q)&&q[1]>w.base(q)&&q[1]<w.height(q)),'Jamb is missing');}
    const xs=roofs.flatMap(r=>r.top.map(v=>v[0])),zs=roofs.flatMap(r=>r.top.map(v=>v[2])),x0=Math.min(...xs),z0=Math.min(...zs),dx=Math.max(...xs)-x0,dz=Math.max(...zs)-z0;
    for(let x=0;x<19;x++)for(let z=0;z<19;z++){const q=[x0+dx*(x+.371)/19,0,z0+dz*(z+.613)/19];assert(roofs.filter(r=>r.inside(q,true)).length<=1,'Roof upper faces overlap');}
    if(c.stairs){const steps=plan.components.filter(p=>p.role==='stone'&&Math.abs(p.s[0]-2.4*scale)<.003&&Math.abs(p.s[2]-.34*scale)<.003).sort((a,b)=>a.p[2]-b.p[2]);assert(steps.length===3,'Access stairs missing');let top=0;for(let j=0;j<steps.length;j++){const p=steps[j],next=p.p[1]+p.s[1]/2;assert(Math.abs(p.p[1]-p.s[1]/2)<.003&&next>top&&next-top<=.15*scale,'Stairs must rise from ground toward the door');if(j){const previous=steps[j-1],gap=p.p[2]-p.s[2]/2-previous.p[2]-previous.s[2]/2;assert(gap<=.02*scale&&gap>=-.03*scale,'Stair tread gap or overlap');}top=next;}const end=steps.at(-1);assert(Math.abs(top-.42*scale)<.003&&Math.abs(end.p[2]+end.s[2]/2+4.5*scale)<.03*scale,'Stairs do not meet the entry floor');}
    if(i===0)first=plan.components.map(p=>p.part);else assert(JSON.stringify(first)===JSON.stringify(plan.components.map(p=>p.part)),'Static junction IDs drift');
   }
   else if(c.type==='nested'){
    const p=plan.recipe.params,perStorey=62+16*p.balcony+20*p.roof_ribs;assert(plan.components.length===16+p.storeys*perStorey,'Nested expansion count differs');
    assert(new Set(plan.components.map(p=>p.part)).size===plan.components.length,'Nested component IDs collide');
    const surfaces=plan.components.filter(p=>p.surface);assert(surfaces.length===p.storeys*(4+20*p.roof_ribs),'Nested roof detail differs');
    for(const part of plan.components){assert(part.p.concat(part.s).every(Number.isFinite)&&part.s.every(v=>v>0),'Invalid nested transform');assert(part.p[1]>=0&&part.p[1]<40,'Nested vertical placement is invalid');}
    assert(plan.recipe.program.assemblies.length===3,'Assembly definitions missing');
   }
   else if(c.type==='layout'){
    for(const p of c.pairs){const d=gap(footprint(live.objects,p.a),footprint(live.objects,p.b));assert(d>=p.gap,'Layout clearance failed: '+JSON.stringify(p)+' actual '+d.toFixed(3));}
    for(const p of c.connections||[])assert(gap(footprint(live.objects,p.a),footprint(live.objects,p.b))<=p.max_gap,'Access path is disconnected');
    if(c.boundary)for(const o of live.objects.filter(o=>o.t!=='group'&&o.id.startsWith(c.boundary.prefix))){const b=footprint(live.objects,{id:o.id});for(const x of [b[0],b[2]])for(const z of [b[1],b[3]])assert(Math.hypot(x-c.boundary.center[0],z-c.boundary.center[1])<=c.boundary.radius,'Boundary extends beyond its support');}
    if(c.stairs){const steps=live.objects.filter(o=>o.id.startsWith(c.stairs.prefix)).sort((a,b)=>a.p[1]-b.p[1]),deck=live.objects.find(o=>o.id===c.stairs.deck);assert(steps.length===c.stairs.count&&deck,'Access steps missing');let top=c.stairs.ground||0;for(const s of steps){const next=s.p[1]+s.s[1]/2;assert(next>top&&next-top<=c.stairs.max_rise,'Stair rise is unsafe');top=next;}assert(Math.abs(top-deck.p[1]-deck.s[1]/2)<.015,'Steps do not reach the deck');}
   }
   else throw Error('Unknown check type '+c.type);
  },finish(){if(c.type==='motion')assert(last.every((v,i)=>Math.abs(v-first[i])<.03),'Loop did not close');}};
 }
 function materials(expected,actual){for(const [id,o]of Object.entries(expected.initial?.geo||{}))if(!id.startsWith('_')&&o.m)assert((actual.initial?.geo?.[id]?.m||'plain')===o.m,'Reload changed material '+id);}
 return {create,materials};
});
