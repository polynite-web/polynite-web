/* Publish compact collection indexes before optional composition/recipe data. */
const fs=require('node:fs'),path=require('node:path');
const root=__dirname,origin='https://explore.polynite.io/docs/recipes/collections/';
function build(out,examples){
 const source=path.join(root,'public-site-src/collections');if(!fs.existsSync(source))return;
 for(const name of fs.readdirSync(source)){
  const file=path.join(source,name,'collection.json');if(!fs.existsSync(file))continue;
  const c=JSON.parse(fs.readFileSync(file)),url=origin+c.id+'/v'+c.version+'/',dest=path.join(out,'docs/recipes/collections',c.id,'v'+c.version);fs.mkdirSync(dest,{recursive:true});
  for(const relative of Object.values(c.recipes)){if(!/^[a-z][a-z0-9_-]*\.json$/.test(relative))throw Error('Invalid collection recipe path');fs.copyFileSync(path.join(path.dirname(file),relative),path.join(dest,relative));}
  fs.copyFileSync(file,path.join(dest,'source.json'));fs.writeFileSync(path.join(dest,'materials.json'),JSON.stringify(c.scene_defaults.initial.materials,null,2));
  const index={id:c.id,version:c.version,title:c.title,principle:'Recipes compose existing local operators. These examples are starting points, not a closed list of shapes.',source:url+'source.json',materials:url+'materials.json',recipes:Object.entries(c.recipes).map(([id,file])=>({id,url:url+file})),examples:c.examples.map(e=>{const r=examples.find(r=>r.id===e.id);if(!r)throw Error('Collection example not registered: '+e.id);return{id:e.id,title:e.title,detail:r.detail,open:r.open,variants:r.variants.map(v=>({id:v.id,title:v.title,scene:v.scene}))};}),workflow:'Read this compact index, then only the recipes or scene details needed. Bind supports and paths to the current scene, estimate, apply, inspect and observe. Composition source is authoring data: first load authored geometry without generated instances, build the declared assemblies, then estimate/apply the recipe instances and capture before exporting. Downloadable .scene files already include those paths. Preserve user edits; do not clear their scene.'};
  fs.writeFileSync(path.join(dest,'index.json'),JSON.stringify(index,null,2));
 }
}
module.exports={build};
