/* Offline authoring only: the engine receives bounded JSON, never this JS. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),{fixture:connected}=require('./author_terrain_connections.cjs');
const op=(name,...v)=>[name,...v],add=(a,b)=>op('add',a,b),mul=(a,b)=>op('mul',a,b),sub=(a,b)=>op('sub',a,b);
const input=(name,min,max,value,description)=>({name,min,max,value,description,group:'placement'});
const fold=(name,v)=>v.length===1?v[0]:op(name,fold(name,v.slice(0,Math.ceil(v.length/2))),fold(name,v.slice(Math.ceil(v.length/2))));
function placement(obstacles=['block']){
 if(!obstacles.length||obstacles.length>6)throw Error('Choose 1..6 explicit reservations');
 const inputs=[input('x',-30,30,0,'Preferred centre X, local metres'),input('z',-30,30,0,'Preferred centre Z, local metres'),input('search',.1,8,2,'Distance to four fallback candidates, metres'),input('radius',.05,3,.35,'Conservative radius of the complete attached object'),input('margin',0,2,.2,'Free space beyond the complete object, metres')];
 const candidates=[['$x','$z'],[add('$x','$search'),'$z'],[sub('$x','$search'),'$z'],['$x',add('$z','$search')],['$x',sub('$z','$search')]],calc=[];
 for(let i=0;i<5;i++){
  const [x,z]=candidates[i];calc.push({name:'d'+i,value:fold('min',obstacles.map(n=>op('distance','@'+n,x,z)))},{name:'ok'+i,value:op('gte','%d'+i,add('$radius','$margin'))},{name:'pick'+i,value:mul('%ok'+i,i?sub(1,'%used'+(i-1)):1)},{name:'used'+i,value:i?op('max','%used'+(i-1),'%ok'+i):'%ok0'});
 }
 calc.push({name:'px',value:fold('add',candidates.map(([x],i)=>mul(x,'%pick'+i)))},{name:'pz',value:fold('add',candidates.map(([,z],i)=>mul(z,'%pick'+i)))});
 return {module:'assembly',context:[{name:'ground',terrain:'infinite'},...obstacles.map(name=>({name,instance:'source',anchor:'body000000'}))],program:{version:1,inputs,let:calc,checks:[{value:'%used4',min:1,max:1,message:'No free candidate: move the preferred point or widen search; keep radius large enough for the complete object'}],nodes:[{id:'seat',op:'anchor',p:['%px',op('height','@ground','%px','%pz'),'%pz']},{id:'body',op:'footprint',p:['%px',0,'%pz'],s:[mul(2,'$radius'),1,mul(2,'$radius')]}]}};
}
function spacing(count=2){
 if(!Number.isInteger(count)||count<2||count>6)throw Error('Choose 2..6 explicitly placed objects');
 const guard={module:'assembly',context:Array.from({length:count},(_,i)=>({name:'s'+i,instance:'slot'+i,anchor:'body000000'})),program:{version:1,inputs:[input('margin',0,2,.1,'Minimum space between complete placed objects')],checks:[],nodes:[{id:'mark',op:'anchor'}]}};
 for(let i=0;i<count;i++)for(let j=i+1;j<count;j++){const dx=sub('@s'+i+'.x','@s'+j+'.x'),dz=sub('@s'+i+'.z','@s'+j+'.z');guard.program.checks.push({value:sub(op('sqrt',add(mul(dx,dx),mul(dz,dz))),add(mul(add('@s'+i+'.width','@s'+j+'.width'),.5),'$margin')),min:0,max:100,message:'Placed objects overlap: move a preferred point or increase search; preserve the complete object radius'});}
 return guard;
}
function rectangle(id,p,s,r){return {id,op:'footprint',p,s,...(r?{r}: {})};}
function reserveConnection(r){
 // Conservative single rectangle enclosing every sine-bent station and rails.
 r.program.nodes.push(rectangle('area',[mul(add('@left.x','@right.x'),.5),0,mul(add('@left.z','@right.z'),.5)],[add(add('$width',mul(2,op('abs','$bend'))),.4),1,add(add('%span','$width'),.4)],[0,mul(180/Math.PI,op('atan2','%dx','%dz')),0]));
}
function fixture(kind='garden',variant='original'){
 const doc=connected(kind==='garden'?'garden':'path'),a=doc.initial.architecture;
 doc.initial.scene_name=kind==='garden'?'A Japanese garden with room to grow':'Give every object room';doc.seq=[{op:'hold',at:0,dur:6,lane:'camera'}];
 if(kind==='study'){
  doc.initial.architecture=[];doc.initial.infinite.edits=[];doc.initial.infinite.on=false;doc.initial.geo={ground:{t:'cube',p:[1,-.1,0],s:[14,.2,12],m:'moss'}};delete doc.initial.scene_controls;
  doc.initial.cam_dist=7;doc.initial.tgt_x=1;doc.initial.tgt_y=.6;
  const source={id:'source',module:'assembly',params:{width:variant==='wide'?3.6:2},program:{version:1,inputs:[input('width',1,5,2,'Object width, metres')],nodes:[{id:'box',op:'primitive',kind:'cube',p:[0,.6,0],s:['$width',1.2,2],role:'stone',bevel:.08},rectangle('body',[0,0,0],['$width',1,2])]},materials:{stone:'garden_stone'}};
  const seat={id:'place',...placement(),params:{x:1.8,z:0,search:variant==='space'?3:2,radius:.4,margin:variant==='space'?.6:.2}};
  seat.context[0]={name:'ground',object:'ground',point:'top'};
  const lantern=structuredClone(a.find(r=>r.id==='shore_a'));lantern.id='object';lantern.program={version:1,inputs:[],nodes:[{id:'stem',op:'primitive',kind:'cylinder',p:[0,.4,0],s:[.12,.8,.12],role:'stone'},{id:'top',op:'primitive',kind:'sphere',p:[0,.9,0],s:[.55,.4,.55],role:'stone'}]};lantern.p=[0,0,0];lantern.attach={to:'place',anchor:'seat000000'};delete lantern.context;delete lantern.params;
  doc.initial.architecture.push(source,seat,lantern);
  doc.seq=[{op:'architecture',id:'source',params:{width:4},at:1.5,dur:0,lane:'scene'},{op:'architecture',id:'source',params:source.params,at:4,dur:0,lane:'scene'},{op:'hold',at:0,dur:6,lane:'camera'}];
 }else{
  const pond=doc.initial.geo.pond;delete doc.initial.geo.pond;
  a.push({id:'pondarea',module:'assembly',p:pond.p,materials:{stone:'pond'},program:{version:1,inputs:[input('width',1,8,pond.s[0],'Pond width, metres'),input('depth',1,8,pond.s[2],'Pond depth, metres')],nodes:[{id:'surf',op:'primitive',kind:'cylinder',role:'stone',s:['$width',.04,'$depth']},rectangle('body',[0,0,0],['$width',1,'$depth'])]}});
  const temple=a.find(r=>r.id==='temple');temple.program.nodes.push(rectangle('body',[0,0,0],['%roof_w',1,add('%depth',mul(2,'$overhang'))]));
  if(variant==='wide')temple.params.width=4.8;
  for(const id of ['approach','bridge','entry'])reserveConnection(a.find(r=>r.id===id));
  for(const id of ['shore_a','shore_b','gatepad']){const r=a.find(r=>r.id===id);r.program.nodes.push(rectangle('body',[0,0,0],['$width',1,'$depth']));}
  // Candidate selection and aesthetic preferences remain explicit recipe data.
  const positions=[['cherry',5,-2.5,1.25],['pine1',-6,2,1],['pine2',5,5,.8],['lamp1',-1,-.4,.38],['lamp2',3.1,4.3,.38],['lamp3',.2,-3.4,.38]];
  const sources=[['temple','body000000'],['approach','area000000'],['bridge','area000000'],['entry','area000000'],['shore_a','body000000'],['shore_b','body000000']];
  for(let i=0;i<positions.length;i++){
   const [id,x,z,radius]=positions[i],r=a.find(r=>r.id===id),slot={id:'slot'+i,...placement(sources.map((_,j)=>'r'+j)),params:{x,z,search:3,radius,margin:variant==='space'?.4:.18}};
   slot.context=[{name:'ground',terrain:'infinite'},...sources.map(([instance,anchor],j)=>({name:'r'+j,instance,anchor})),{name:'pond',instance:'pondarea',anchor:'body000000'}];
   for(let k=0;k<5;k++)slot.program.let[k*4].value=op('min',slot.program.let[k*4].value,op('distance','@pond',...([['$x','$z'],[add('$x','$search'),'$z'],[sub('$x','$search'),'$z'],['$x',add('$z','$search')],['$x',sub('$z','$search')]][k])));
   r.attach={to:slot.id,anchor:'seat000000'};r.context=[...(r.context||[]),{name:'fit',instance:slot.id,anchor:'body000000'}];
   r.program.checks=[...(r.program.checks||[]),{value:sub(mul('@fit.width',.5),i<3?op('max',.08,mul('$spread',.85)):.36),min:0,max:100,message:'Whole object exceeds its reserved radius: enlarge the placement radius before increasing canopy spread'}];a.push(slot);
  }
  const guard={id:'spacing',...spacing(6)};
  a.push(guard);doc.initial.architecture=a.filter(r=>r.id!=='site');
  doc.seq=[{op:'architecture',id:'temple',params:{width:5.5},at:1.5,dur:0,lane:'scene'},{op:'architecture',id:'temple',params:{width:temple.params.width},at:4,dur:0,lane:'scene'},{op:'hold',at:0,dur:6,lane:'camera'}];
 }
 const first=kind==='garden'?'slot5':'place';doc.initial.architecture.sort((a,b)=>(a.id===first?-1:0)-(b.id===first?-1:0));
 return doc;
}
function author(){const recipe=placement();const file=path.join(__dirname,'public-site-src/collections/clearance-placement/placement.json');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(recipe,null,2)+'\n');fs.writeFileSync(path.join(__dirname,'../majify-api/worker/polynite-auth/src/recipe_book/clearance_placement.json'),JSON.stringify({id:'structures.clearance_placement',version:1,category:'structures',summary:'Choose the first free of five explicit positions around named footprint reservations; preserve a complete object radius and margin. No global packing or pathfinding.',required_capability:'commands.recipe_footprints',recipe},null,2)+'\n');}
module.exports={placement,spacing,fixture,reserveConnection,author};if(require.main===module)author();
