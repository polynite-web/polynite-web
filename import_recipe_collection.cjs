/* Import only a completely verified native run into immutable public fixtures. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {collection}=require('./compose_recipe_collection.cjs');
const root=__dirname,source=path.join(root,'public-site-src/recipe-examples'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function publish(file,proof,ids=null,revision=null){
 revision=revision||require("node:child_process").execFileSync("git",["-C","D:/dev/wnex","rev-parse","HEAD"],{encoding:"utf8",windowsHide:true}).trim();
 const c=collection(file),report=JSON.parse(fs.readFileSync(path.join(proof,'results.json')));if(!report.passed||!report.restored)throw Error('Complete verified/restored native run required');
 if(report.collection_sha256!==hash(JSON.stringify({data:c.data,recipes:c.recipes})))throw Error('Collection changed since verification; rerun the selected examples');
 const catalog=JSON.parse(fs.readFileSync(path.join(source,'catalog.json'))),version=c.data.version;
 function immutable(file,bytes){if(fs.existsSync(file)&&hash(fs.readFileSync(file))!==hash(bytes))throw Error('Published reference changed; increment version: '+file);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);}
 const selected=ids?c.data.examples.filter(e=>ids.includes(e.id)):c.data.examples;if(ids&&selected.length!==new Set(ids).size)throw Error('Unknown import example');
 for(const e of selected){
  for(const v of ['original',...e.variants.map(v=>v.id)])if(!report.results.some(r=>r.id===e.id&&r.variant===v&&r.passed&&e.checks.every(c=>r.checks.includes(c.type))))throw Error('Variant was not verified: '+e.id+'/'+v);
  const dir=path.join(source,e.id),bytes=fs.readFileSync(path.join(proof,e.id+'.scene')),doc=JSON.parse(bytes),recipes=Buffer.from(JSON.stringify({version:1,recipes:doc.initial.architecture},null,2)+'\n');
  immutable(path.join(dir,'v'+version+'.scene'),bytes);immutable(path.join(dir,'v'+version+'.recipes.json'),recipes);
  const variants=e.variants.map(v=>{const bytes=fs.readFileSync(path.join(proof,e.id+'-'+v.id+'.scene'));immutable(path.join(dir,'v'+version+'-'+v.id+'.scene'),bytes);return{id:v.id,title:v.title,poster:'media/'+e.id+'-v'+version+'-'+v.id+'.jpg',scene_sha256:hash(bytes)};});
  const record=JSON.parse(fs.readFileSync(path.join(proof,e.id+'.record.json')));if(!record.completed||record.files.length!==1)throw Error('Completed landscape video required');
  immutable(path.join(source,'media',e.id+'-v'+version+'.mp4'),fs.readFileSync(record.files[0]));
  const operators=new Set(['expression']);function visit(value){if(!value||typeof value!=='object')return;if(Array.isArray(value)&&['height','distance'].includes(value[0]))operators.add('spatial');for(const [k,v]of Object.entries(value)){if(k==='op'&&['primitive','surface','beam','anchor','instance'].includes(v))operators.add(v);if(['repeat','motion','let','when','context'].includes(k))operators.add(k);if(k==='prototypes')operators.add('prototype');if(k==='profile')operators.add('profile');if(k==='path'&&Array.isArray(v)&&v.length&&Array.isArray(v[0]))operators.add('sweep');visit(v);}}visit(doc.initial.architecture);
  const {scene,variants:raw,...metadata}=e,item={...metadata,operators:[...operators],version,collection:c.data.id,instances:doc.initial.architecture.map(r=>r.id),variants,compatibility:{desktop:'verified',browser:'not_verified'},tested_at:new Date().toISOString().slice(0,10),revision,scene_sha256:hash(bytes),recipes_sha256:hash(recipes),media:{video:'media/'+e.id+'-v'+version+'.mp4',poster:'media/'+e.id+'-v'+version+'.jpg'}};
  const i=catalog.items.findIndex(r=>r.id===e.id);if(i<0)catalog.items.push(item);else catalog.items[i]=item;
 }
 fs.writeFileSync(path.join(source,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');
 const config=JSON.parse(fs.readFileSync(path.join(root,'public-site-src/showcase.json')));config.featured=c.data.featured||config.featured;config.items=config.items.filter(e=>!c.data.examples.some(r=>r.id===e.recipe));config.items.unshift(...[...c.data.examples].reverse().map(e=>({recipe:e.id,category:c.data.category||'Japanese garden',environment:c.data.category?'Studio':e.id==='japanese-garden'?'Spring':e.id==='japanese-lotus'?'Pond':'Garden',tags:[c.data.category||'Japanese',e.category,e.checks.map(c=>c.type).join(' · '),'Editable']})));fs.writeFileSync(path.join(root,'public-site-src/showcase.json'),JSON.stringify(config,null,2)+'\n');
}
module.exports={publish};if(require.main===module)publish(path.resolve(process.argv[2]),path.resolve(process.argv[3]),process.argv.includes('--ids')?process.argv[process.argv.indexOf('--ids')+1].split(','):null);
