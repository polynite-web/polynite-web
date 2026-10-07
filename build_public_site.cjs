const fs=require('node:fs'),path=require('node:path');const root=__dirname;
const config=JSON.parse(fs.readFileSync(path.join(root,'public-site-src/config.json'),'utf8'));
if(!config.operator||!config.jurisdiction||!/^[-\w.+]+@[-\w.]+$/.test(config.contactEmail))throw new Error('Missing confirmed operator/contact/jurisdiction');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pages={mcp:'Create in 3D, together',docs:'A scene starts with a sentence','docs/mcp':'Your assistant, your current scene',support:'Keep your scene, find the next step',privacy:'Privacy',terms:'Terms of use'};
const nav=[['/mcp/','Product'],['/docs/','Docs'],['/docs/mcp/','AI integration'],['/support/','Support']];
for(const base of [root,path.join(root,'dev'),path.join(root,'web')]){
 const assets=path.join(base,'assets/public-site');fs.mkdirSync(assets,{recursive:true});fs.copyFileSync(path.join(root,'public-site-src/style.css'),path.join(assets,'style.css'));
 for(const [route,title]of Object.entries(pages)){
  let body=fs.readFileSync(path.join(root,'public-site-src',route.replaceAll('/','-')+'.html'),'utf8');for(const [name,value]of Object.entries(config))body=body.replaceAll('{{'+name+'}}',esc(value));
  if(/\{\{/.test(body))throw new Error('Unresolved page placeholder');
  const url='/'+route+'/',dir=path.join(base,route);fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Polynite</title><meta name="description" content="${esc(title)}. Practical Polynite service information and conversational 3D workflows."><link rel="canonical" href="https://polynite.io${url}"><link rel="stylesheet" href="/assets/public-site/style.css"></head><body><header><a class="brand" href="/mcp/">Poly<span>nite</span></a><nav aria-label="Main navigation">${nav.map(([href,text])=>`<a href="${href}"${href===url?' aria-current="page"':''}>${text}</a>`).join('')}</nav></header><main>${body}</main><footer><span>Polynite · {{operator}}</span><nav aria-label="Service information"><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/support/">Support</a><a href="/docs/">Documentation</a></nav></footer></body></html>`.replace('{{operator}}',esc(config.operator)));
 }
}console.log('Built six public pages in root/dev/web. Engine entry pages preserved.');
