/* Author declarative connection recipes. This script never runs in the engine. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=__dirname,dir=path.join(root,'public-site-src/collections/terrain-connections');
const clone=structuredClone,op=(name,...args)=>[name,...args],add=(a,b)=>op('add',a,b),sub=(a,b)=>op('sub',a,b),mul=(a,b)=>op('mul',a,b),div=(a,b)=>op('div',a,b),mix=(a,b,t)=>op('mix',a,b,t);
const input=(name,min,max,value,description,integer=false)=>({name,min,max,value,description,integer,group:'shape'});
const letValue=(name,value)=>({name,value});
const materials={wood:'lacquer',stone:'garden_stone',metal:'dark_metal'};
function connection(bridge){
 const inputs=[input('width',.4,2.4,bridge?1.1:.8,'Usable deck width, metres'),input('segments',8,20,16,'Stable segments; more samples on uneven ground',true),input('thickness',.04,.25,bridge?.1:.09,'Deck thickness, metres'),input('clearance',.01,.3,.04,'Minimum sampled ground clearance below deck, metres'),input('bend',-2,2,0,'Horizontal bend at the midpoint, metres'),input('arch',0,2,bridge?.45:0,'Additional arch above the shore line, metres'),input('rail_height',0,1.5,bridge?.65:0,'Zero removes rails and posts'),input('post_width',.03,.2,.065,'Rail and post width, metres'),input('max_grade',.1,2,1,'Maximum end-to-end rise divided by horizontal span')];
 const calc=[letValue('dx',sub('@right.x','@left.x')),letValue('dz',sub('@right.z','@left.z')),letValue('span',op('sqrt',add(mul('%dx','%dx'),mul('%dz','%dz')))),letValue('safe_span',op('max',.001,'%span')),letValue('nx',div('%dz','%safe_span')),letValue('nz',div(op('neg','%dx'),'%safe_span'))];
 // Each station samples the centre and both deck edges. Split calculations keep
 // the native expression depth bounded; no second terrain function is embedded.
 function station(prefix,t,list,ends=false){
  const ref=n=>'%'+prefix+n,put=(n,v)=>list.push(letValue(prefix+n,v));
  put('t',t);put('bow',mul('$bend',op('sin',mul(Math.PI,ref('t')))));
  put('x',add(mix('@left.x','@right.x',ref('t')),mul('%nx',ref('bow'))));
  put('z',add(mix('@left.z','@right.z',ref('t')),mul('%nz',ref('bow'))));
  const derivative=mul('$bend',mul(Math.PI,op('cos',mul(Math.PI,ref('t')))));
  put('dir',op('atan2',add('%dx',mul('%nx',derivative)),add('%dz',mul('%nz',derivative))));
  put('nx',op('cos',ref('dir')));put('nz',op('neg',op('sin',ref('dir'))));
  put('edge',mul('$width',.5));
  put('g',op('max',op('height','@ground',ref('x'),ref('z')),op('max',op('height','@ground',add(ref('x'),mul(ref('nx'),ref('edge'))),add(ref('z'),mul(ref('nz'),ref('edge')))),op('height','@ground',sub(ref('x'),mul(ref('nx'),ref('edge'))),sub(ref('z'),mul(ref('nz'),ref('edge')))))));
  put('base',add(ref('g'),add('$thickness','$clearance')));
  if(ends)return ref('base');
  if(bridge){put('line',add(mix('@left.y','@right.y',ref('t')),mul('$arch',op('sin',mul(Math.PI,ref('t'))))));put('y',op('max',ref('line'),ref('base')));}
  else {put('lift',add(mul('%lift_a',op('pow',sub(1,ref('t')),4)),mul('%lift_b',op('pow',ref('t'),4))));put('y',add(ref('base'),add(ref('lift'),mul('$arch',op('sin',mul(Math.PI,ref('t')))))));}
  return [ref('x'),ref('y'),ref('z')];
 }
 const a=station('a',0,calc,true),b=station('b',1,calc,true);
 calc.push(letValue('lift_a',sub('@left.y',a)),letValue('lift_b',sub('@right.y',b)));
 const checks=[{value:'%span',min:.5,max:20,message:'Connection span must be 0.5..20m; move its end supports apart'},...['a','b'].map(side=>({value:'%lift_'+side,min:-.002,max:20,message:'Connection end '+side+' is buried: raise its support or reduce width/thickness/clearance'})),{value:div(op('abs',sub('@right.y','@left.y')),'%safe_span'),min:0,max:2,message:'Connection end slope exceeds the supported range'}, {value:sub('$max_grade',div(op('abs',sub('@right.y','@left.y')),'%safe_span')),min:0,max:2,message:'Connection exceeds max_grade; lengthen the approach or lower its support'}];
 const nodes=[];
 function segment(id,rail=false){
  const locals=[],p0=station('s',div('@i','$segments'),locals),p1=station('e',div(add('@i',1),'$segments'),locals);
  locals.push(letValue('seg_dx',sub(p1[0],p0[0])),letValue('seg_dz',sub(p1[2],p0[2])),letValue('len',op('sqrt',add(mul('%seg_dx','%seg_dx'),mul('%seg_dz','%seg_dz')))),letValue('dy',sub(p1[1],p0[1])),letValue('heading',op('atan2','%seg_dx','%seg_dz')));
  if(rail){
   const side=mul(sub(mul('@j',2),1),mul('$width',.5));
   nodes.push({id,op:'beam',role:'wood',repeat:{count:'$segments',rows:2},when:op('gte','$rail_height',.01),let:locals,a:[add(p0[0],mul(side,'%snx')),add(p0[1],'$rail_height'),add(p0[2],mul(side,'%snz'))],b:[add(p1[0],mul(side,'%enx')),add(p1[1],'$rail_height'),add(p1[2],mul(side,'%enz'))],width:'$post_width'});
  }else nodes.push({id,op:'primitive',kind:'cube',role:bridge?'wood':'stone',repeat:{count:'$segments'},let:locals,p:[mul(add(p0[0],p1[0]),.5),sub(mul(add(p0[1],p1[1]),.5),mul('$thickness',.5)),mul(add(p0[2],p1[2]),.5)],s:['$width','$thickness',add(op('sqrt',add(mul('%len','%len'),mul('%dy','%dy'))),.008)],r:[mul(-180/Math.PI,op('atan2','%dy','%len')),mul(180/Math.PI,'%heading'),0],orient:'radial',bevel:.008});
 }
 segment('deck');segment('rail',true);
 const postLet=[],post=station('p','@u',postLet);
 // The same tangent frame places rails, posts and sampled deck edges.
 const edge=mul(sub(mul('@j',2),1),mul('$width',.5));
 nodes.push({id:'post',op:'beam',role:'wood',repeat:{count:add('$segments',1),rows:2},let:postLet,when:op('gte','$rail_height',.01),a:[add(post[0],mul('%pnx',edge)),post[1],add(post[2],mul('%pnz',edge))],b:[add(post[0],mul('%pnx',edge)),add(post[1],'$rail_height'),add(post[2],mul('%pnz',edge))],width:'$post_width'});
 const footLet=[],foot=station('f',div(add('@i',.5),'$segments'),footLet);
 footLet.push(letValue('foot_x',add(foot[0],mul('%fnx',edge))),letValue('foot_z',add(foot[2],mul('%fnz',edge))),letValue('foot_y',op('height','@ground','%foot_x','%foot_z')),letValue('foot_top',sub(foot[1],'$thickness')));
 nodes.push({id:'foot',op:'beam',role:bridge?'stone':'stone',repeat:{count:'$segments',rows:2},let:footLet,when:op('gte',sub('%foot_top','%foot_y'),.02),a:['%foot_x','%foot_y','%foot_z'],b:['%foot_x','%foot_top','%foot_z'],width:bridge?.09:.075});
 const stationLet=[],stationP=station('v','@u',stationLet);
 nodes.push({id:'mark',op:'anchor',repeat:{count:add('$segments',1)},let:stationLet,p:stationP});
 for(const [id,t]of [['left',0],['rght',1]]){const locals=[],p=station('k',t,locals);nodes.push({id,op:'anchor',let:locals,p});}
 return {module:'assembly',style:'japanese',context:[{name:'left',object:'pad_a',point:'top'},{name:'right',object:'pad_b',point:'top'},{name:'ground',terrain:'infinite'}],program:{version:1,inputs,let:calc,checks,nodes},materials};
}
function landing(){
 const inputs=[input('width',.5,3,1.6,'Landing width, metres'),input('depth',.4,3,1,'Landing depth, metres'),input('lift',.15,2,.25,'Level top above the highest sampled ground corner, metres')];
 const half=mul('$width',.5),depth=mul('$depth',.5),heights=[];
 for(const x of [-1,1])for(const z of [-1,1])heights.push(op('height','@ground',mul(x,half),mul(z,depth)));
 const edges=[{id:'in',op:'anchor',p:[0,'%top',mul('$depth',-.5)]},{id:'out',op:'anchor',p:[0,'%top',mul('$depth',.5)]},{id:'side',op:'anchor',p:[mul('$width',-.5),'%top',0]}];
 return {module:'assembly',context:[{name:'ground',terrain:'infinite'}],materials,program:{version:1,inputs,let:[letValue('top',add(op('max',op('max',heights[0],heights[1]),op('max',heights[2],heights[3])),'$lift'))],nodes:[{id:'pad',op:'primitive',kind:'cube',role:'stone',p:[0,sub('%top',.07),0],s:['$width',.14,'$depth'],bevel:.03},{id:'foot',op:'beam',role:'stone',repeat:{count:2,rows:2},let:[letValue('x',mul(sub(mul('@i',2),1),mul('$width',.4))),letValue('z',mul(sub(mul('@j',2),1),mul('$depth',.4)))],a:['%x',op('height','@ground','%x','%z'),'%z'],b:['%x',sub('%top',.14),'%z'],width:.12},{id:'top',op:'anchor',p:[0,'%top',0]},...edges]}};
}
function write(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');}
function author(){
 fs.mkdirSync(dir,{recursive:true});
 const recipes={terrain_path:connection(false),terrain_bridge:connection(true),terrain_landing:landing()};
 for(const [id,recipe]of Object.entries(recipes)){
  write(path.join(dir,id+'.json'),recipe);
  write(path.join(root,'../majify-api/worker/polynite-auth/src/recipe_book',id+'.json'),{id:'structures.'+id,version:1,category:'structures',summary:{terrain_path:'Editable ground-following path linking two support or construction anchors, with sampled edge clearance and optional rails.',terrain_bridge:'Editable arched crossing linking two persistent construction anchors; sampled terrain clearance, rails and feet adapt together.',terrain_landing:'Reusable level landing with independent terrain feet and a top anchor for paths, bridges or other constructions.'}[id],required_capability:'commands.recipe_terrain',recipe});
 }
 return recipes;
}
function fixture(kind,variant='original'){
 const base=JSON.parse(fs.readFileSync(path.join(root,'public-site-src/recipe-examples/terrain-aware-pavilion/v1.scene')));
 const old=JSON.parse(fs.readFileSync(path.join(root,'public-site-src/recipe-examples/japanese-garden/v2.scene')));
 const initial=base.initial;
 initial.geo={};initial.assemblies=[];initial.architecture=[];
 initial.materials=clone(old.initial.materials);initial.scene_controls={version:1,title:'Ground',controls:{ground_height:{type:'slider',label:'Ground height',min:0,max:2,step:.1,default:0,value:0,unit:'m',bindings:[{target:'infinite',property:'base_height'}]}}};
 Object.assign(initial,{scene_name:kind==='garden'?'The garden of connected paths':kind==='bridge'?'A bridge between living shores':'A path that meets the ground',cam_dist:kind==='garden'?18:12,cam_pitch:.57,cam_yaw:.55,tgt_x:0,tgt_y:1,tgt_z:0});
 Object.assign(initial.infinite,{base_height:0,edits:[],forest:0,trees:false,oceans:0,rocky:0,shore_cut:0,water:-2000});
 const land=(id,p,params={})=>({id,...landing(),p,params});
 const connect=(id,bridge,left,right,params={})=>({id,...connection(bridge),context:[{name:'left',...left},{name:'right',...right},{name:'ground',terrain:'infinite'}],params});
 const anchor=(instance,name='top000000')=>({instance,anchor:name});
 const arch=initial.architecture;
 if(kind==='garden'){
  const temple=clone(old.initial.architecture.find(r=>r.id==='temple'));temple.context=[{name:'base',terrain:'infinite'}];temple.program.let.find(v=>v.name==='width').value='$width';temple.program.let.find(v=>v.name==='depth').value='$depth';
  Object.assign(temple,{p:[-3.4,0,-3.8],params:{...temple.params,width:3.5,depth:3,height:2.3,access_steps:0,floor_clearance:.22}});
  arch.push(temple,land('shore_a',[1.5,0,-1],{lift:.8}),land('shore_b',[1.5,0,4],{lift:variant==='high-bank'?1.1:.8}),land('gatepad',[1.5,0,6.5],{width:1.4,depth:.8,lift:.25}));
  arch.push(connect('bridge',true,anchor('shore_a','out000000'),anchor('shore_b','in000000'),{arch:.45,width:1.1,segments:20}),connect('approach',false,anchor('temple','door000000'),anchor('shore_a','side000000'),{bend:variant==='curved'?.8:.45,width:.85,segments:20}),connect('entry',false,anchor('shore_b','out000000'),anchor('gatepad','in000000'),{width:.85,segments:12}));
  // Reuse the garden's existing flora and lantern recipes. A small data-only
  // anchor assembly seats them on the same terrain; no native garden generator.
  const layout={id:'site',module:'assembly',context:[{name:'ground',terrain:'infinite'}],program:{version:1,inputs:[],nodes:[]}};
  for(const [id,pos]of [['cherry',[5,-2.5]],['pine1',[-6,2]],['pine2',[5,5]],['lamp1',[-1,-.4]],['lamp2',[3.1,4.3]],['lamp3',[.2,-3.4]]]){
   layout.program.nodes.push({id:id.slice(0,4),op:'anchor',p:[pos[0],op('height','@ground',pos[0],pos[1]),pos[1]]});
   const r=clone(old.initial.architecture.find(r=>r.id===id));r.p=[0,0,0];r.attach={to:'site',anchor:id.slice(0,4)+'000000'};arch.push(r);
  }
  // Lantern prefixes would collide; use stable unique names explicitly.
  layout.program.nodes.forEach((n,i)=>n.id='p'+i);
  for(let i=0;i<6;i++)arch[arch.length-6+i].attach.anchor='p'+i+'000000';
  arch.push(layout);
  // Small garden ponds use a local PBR surface over a real terrain basin.
  // The world's sea/shore/foam treatment is intentionally not imposed on it.
 for(const id of ['lotus','bloom2','bloom3']){
   const r=clone(old.initial.architecture.find(r=>r.id===id));r.p[1]=-.1;r.p[2]-=.4;
   r.program.inputs.push(input('stamens',4,32,8,'Small central details; lower values suit a wide garden view',true));
   const density=value=>Array.isArray(value)?value.map((v,i)=>value[0]==='div'&&i===2&&v===32?'$stamens':density(v)):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,density(v)])):value;
   for(const node of r.program.nodes)if(['fil','ant'].includes(node.id)){node.repeat.count='$stamens';for(const key of ['p','a','b'])if(node[key])node[key]=density(node[key]);}
   r.params.stamens=8;arch.push(r);
  }
 }else{
  arch.push(land('shore_a',[0,0,-4],{lift:.25}),land('shore_b',[0,0,4],{lift:variant==='high-bank'?.8:.25}));
  arch.push(connect(kind==='bridge'?'bridge':'path',kind==='bridge',anchor('shore_a','out000000'),anchor('shore_b','in000000'),{bend:variant==='curved'?1.2:kind==='path'?.65:0,width:kind==='bridge'?1.2:.95,segments:20,arch:kind==='bridge'?.55:0}));
 }
 const lake=kind==='path'?[]:[{kind:'lake',radius:kind==='garden'?3.5:3,depth:.8,sx:'0',sz:'0',local:kind==='garden'?[1.6,0,1.5]:[0,0,0]}];
 initial.infinite.edits=clone(lake);
 if(lake.length){initial.geo.pond=clone(old.initial.geo.pond);initial.geo.pond.p=kind==='garden'?[1.6,-.1,1.5]:[0,-.1,0];initial.geo.pond.s=kind==='garden'?[4.4,.04,3.8]:[4,.04,3.2];}
 const edit={kind:'raise',radius:16,depth:variant==='high-bank'?1.5:1,sx:'0',sz:'0',local:[-6,0,-7]};
 base.seq=[{op:'infinite',edit,at:1.6,dur:0,lane:'scene'},{op:'infinite',edits:clone(lake),at:4.1,dur:0,lane:'scene'},{op:'hold',at:0,dur:6,lane:'camera'}];
 // The edited connection is first for generic UI/QA; dependency resolution is
 // topological and must not depend on serialized array order.
 const order=kind==='garden'?['approach','bridge','entry']:[kind];
 initial.architecture.sort((a,b)=>{const ai=order.indexOf(a.id),bi=order.indexOf(b.id);return(ai<0?100:ai)-(bi<0?100:bi);});
 delete initial.scene_filename;delete base.export.directory;base.export.loop=1;base.export.watermark=1;
 return base;
}
module.exports={author,connection,landing,fixture,dir};
if(require.main===module){const r=author();console.log(Object.fromEntries(Object.entries(r).map(([id,r])=>[id,{bytes:JSON.stringify(r.program).length,globals:r.program.let.length,nodes:r.program.nodes.length}])));}
