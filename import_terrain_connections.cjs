/* Import only completed native evidence into new immutable public examples. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=__dirname,source=path.join(root,'public-site-src/recipe-examples'),dir=path.resolve(process.argv[2]||'D:/dev/mcp-production-dry-run/terrain-connections-2026-10-19/final');
const result=JSON.parse(fs.readFileSync(path.join(dir,'results.json')));assert(result.passed&&result.restored);
const checks=require('./public-site-src/recipe-checks.js');
const ffmpeg=process.env.POLYNITE_FFMPEG||'D:/dev/wnex/Module/wake-tools_old/vid-0.1/libs-w64/ffmpeg.exe';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),write=(file,data)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');};
assert.equal(result.author_sha256,hash(fs.readFileSync(path.join(root,'author_terrain_connections.cjs'))),'Author data changed since the native proof');
const catalog=JSON.parse(fs.readFileSync(path.join(source,'catalog.json'))),showcase=JSON.parse(fs.readFileSync(path.join(root,'public-site-src/showcase.json')));
const titles={path:'A path that meets the ground',bridge:'A bridge between living shores',garden:'A Japanese garden, connected'};
for(const kind of ['path','bridge','garden']){
 const id='terrain-linked-'+kind,folder=path.join(source,id);assert(!catalog.items.some(e=>e.id===id),'Published example already exists; increment its version explicitly');
 for(const v of ['original','curved','high-bank'])assert(result.results.some(e=>e.kind===kind&&e.variant===v&&e.passed),'Missing native variant proof');
 for(const variant of ['original','curved','high-bank']){
  const states=JSON.parse(fs.readFileSync(path.join(dir,kind+'-'+variant+'.plans.json')));
  for(let j=0;j<states[0].length;j++){const check=checks.create({type:'connection',must_adapt:true,returns:true});for(let i=0;i<states.length;i++)check.observe(i,states[i][j],{});check.finish();}
 }
 const recording=JSON.parse(fs.readFileSync(path.join(dir,kind+'-original.record.json')));assert(recording.completed);
 const movies=fs.readdirSync(recording.folder).filter(n=>n.endsWith('.mp4'));assert.equal(movies.length,1);
 const movie=path.join(recording.folder,movies[0]);assert(fs.statSync(movie).size<25_000_000);
 fs.mkdirSync(folder,{recursive:true});fs.copyFileSync(movie,path.join(source,'media',id+'.mp4'));
 const variants=[];let original;
 for(const variant of ['original','curved','high-bank']){
  // This is the exact engine-expanded initial document used by the native run.
  const recordingScene=path.join(recording.folder,movies[0].replace(/\.mp4$/,'.scene'));
  const document=JSON.parse(fs.readFileSync(variant==='original'?recordingScene:path.join(dir,kind+'-'+variant+'.scene')));delete document.export.directory;
  assert(!/[A-Z]:[\\/]/.test(JSON.stringify(document)),'Local path in published document');
  const name='v1'+(variant==='original'?'':'-'+variant)+'.scene',bytes=JSON.stringify(document)+'\n';fs.writeFileSync(path.join(folder,name),bytes);
  const poster='media/'+id+(variant==='original'?'':'-'+variant)+'.jpg';
  const convert=spawnSync(ffmpeg,['-v','error','-y','-i',path.join(dir,kind+'-'+variant+'.png'),'-frames:v','1','-q:v','3',path.join(source,poster)],{windowsHide:true,encoding:'utf8'});assert.equal(convert.status,0,convert.stderr);
  if(variant==='original')original={document,bytes,poster};else variants.push({id:variant,title:variant==='curved'?'Curved route':'Raised arrival',poster,scene_sha256:hash(bytes)});
 }
 const recipes={version:1,recipes:original.document.initial.architecture};write(path.join(folder,'v1.recipes.json'),recipes);
 const ids=kind==='garden'?['approach','bridge','entry']:[kind];
 const item={id,version:1,title:titles[kind],category:'Architecture',level:'Build on it',summary:kind==='garden'?'A connected Japanese garden: pavilion, curved approach, terrain-fitted bridge, landings and planting share explicit construction anchors. Change the land or a landing and the connections adapt.':kind==='bridge'?'An editable arched bridge follows two construction anchors and clears sampled terrain. Deck, rails and feet share one profile; the same operators can compose a different crossing.':'An editable stone path follows sampled ground and smoothly joins raised construction anchors. Change its bend, width or landing height without replacing its recipe.',operators:['spatial','context','let','primitive','beam','anchor','repeat'],capabilities:['recipe_program','recipe_context','recipe_spatial','recipe_terrain'],instances:recipes.recipes.map(r=>r.id),prompt:'In Polynite, create '+(kind==='garden'?'a Japanese garden with a pavilion, paths and a bridge':'an editable terrain-adaptive '+kind)+'. Discover commands.recipe_terrain and architecture operators context/spatial/let. Bind named left and right references to real construction anchors and ground to the enabled infinite terrain. Compose shared primitives, beams, expressions and stable anchors as editable JSON recipes. Sample the centre and both edges. Keep construction tops above ground plus thickness and clearance; preserve manual edits. Expose width, bend, arch and rail_height. Estimate, apply, inspect the connections, then verify the actual pixels. Keep the current user scene; invent a variation instead of adding a native generator for this style.',try:['Press Play to compare the initial ground, a raised patch and its restored state.','Under Adjust, change '+ids[0]+' width or bend. Change shore_b lift to raise the arrival and watch dependent connections follow.','Use reusable landings to compose a longer route; keep sharp turns and obstacle avoidance explicit.'],steps:['Bind existing terrain and construction anchors explicitly.','Evaluate one sampled profile at the centre and both edges; join segments and reuse its heights for rails and feet.','Keep the shape, materials and connection policy in editable recipe data; terrain/source edits revalidate declared dependants.'],settings:'Adjust > '+ids[0]+' · recipe controls: width, bend, arch, thickness, clearance, rail_height and segments. Adjust > shore_a/shore_b: lift, width and depth. The same controls live under Scene settings > Living architecture.',checks:ids.map(instance=>({type:'connection',instance,times:[0,2.8,5.6],must_adapt:true,returns:true})),tested_at:'2026-10-19',revision:'69e941e53',compatibility:{desktop:'verified',browser:'not_verified'},media:{video:'media/'+id+'.mp4',poster:original.poster},limits:'Uses explicit local bindings and sampled near-field terrain, not arbitrary mesh raycasts, continuous collision or automatic pathfinding. Span 0.5..20m; 8..20 segments. max_grade limits end-to-end rise, not every local segment. Inspect steep relief and bends, increase samples or add intermediate landings. Invalid references, buried ends and invalid spans reject without changing the last valid scene.',seed:17,duration:6,edit_parameter:'width',variants,scene_sha256:hash(original.bytes),recipes_sha256:hash(fs.readFileSync(path.join(folder,'v1.recipes.json')))};
 catalog.items.push(item);showcase.items.push({recipe:id,category:kind==='garden'?'Japanese garden':'Living landscapes',environment:'Garden',tags:['Terrain','Adaptive',kind==='path'?'Path':'Bridge','Editable']});
}
write(path.join(source,'catalog.json'),catalog);write(path.join(root,'public-site-src/showcase.json'),showcase);
console.log('Imported three complete native films, nine immutable scenes/posters and editable recipes.');
