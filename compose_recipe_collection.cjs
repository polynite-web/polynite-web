/* Collection composition is data-only; native operators remain authoritative. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
function merge(a,b){if(!b||Array.isArray(b)||typeof b!=='object')return structuredClone(b);const out=structuredClone(a||{});for(const [k,v]of Object.entries(b)){if(['__proto__','constructor','prototype'].includes(k))throw Error('Invalid collection key');out[k]=v&&typeof v==='object'&&!Array.isArray(v)?merge(out[k],v):structuredClone(v);}return out;}
function collection(file){
 const dir=path.dirname(file),data=JSON.parse(fs.readFileSync(file)),recipes={};if(data.version!==1||!Array.isArray(data.examples))throw Error('Unsupported recipe collection format');
 for(const [name,relative]of Object.entries(data.recipes)){const source=path.resolve(dir,relative);if(!source.startsWith(path.resolve(dir)+path.sep))throw Error('Recipe path escapes collection');recipes[name]=JSON.parse(fs.readFileSync(source));if(recipes[name].module!=='assembly')throw Error('Collections must compose shared operators');}
 function compose(example,variant){
  const spec=merge(example.scene,variant||{}),doc=merge(data.scene_defaults,spec);delete doc.instances;delete doc.id;delete doc.title;
  const instances=example.scene.instances.map(r=>structuredClone(r));
  for(const patch of variant?.instances||[]){const i=instances.findIndex(r=>r.id===patch.id);if(i<0)throw Error('Unknown variant instance '+patch.id);instances[i]=merge(instances[i],patch);}
  doc.initial.architecture=instances.map(({recipe,...r})=>{if(!recipes[recipe])throw Error('Unknown recipe '+recipe);return merge(recipes[recipe],r);});
  doc.initial.seq=structuredClone(doc.seq);doc.initial.scene_name=variant?example.title+' / '+variant.title:example.title;return doc;
 }
 return {data,recipes,compose};
}
module.exports={collection,merge};
