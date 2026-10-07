const fs=require('node:fs'),path=require('node:path');const root=__dirname;
const config=JSON.parse(fs.readFileSync(path.join(root,'public-site-src/config.json'),'utf8'));
if(!config.operator||!config.jurisdiction||!/^[-\w.+]+@[-\w.]+$/.test(config.contactEmail))throw new Error('Missing confirmed operator/contact/jurisdiction');
const {esc,head,metadata}=require('./site_metadata.cjs');
const pages={mcp:'Create in 3D, together',docs:'A scene starts with a sentence','docs/mcp':'Your assistant, your current scene',support:'Keep your scene, find the next step',privacy:'Privacy',terms:'Terms of use'};
const nav=[['/mcp/','Product'],['/docs/','Docs'],['/docs/mcp/','AI integration'],['/support/','Support']];
for(const base of [root,path.join(root,'dev'),path.join(root,'web')]){
 const social=path.join(root,'assets/og-procedural-v1.png');if(fs.existsSync(social)){if(base!==root)fs.copyFileSync(social,path.join(base,'assets/og-procedural-v1.png'));fs.copyFileSync(social,path.join(base,'assets/og-cover.png'));}
 const assets=path.join(base,'assets/public-site');fs.mkdirSync(assets,{recursive:true});fs.copyFileSync(path.join(root,'public-site-src/style.css'),path.join(assets,'style.css'));
 for(const [route,title]of Object.entries(pages)){
  let body=fs.readFileSync(path.join(root,'public-site-src',route.replaceAll('/','-')+'.html'),'utf8');for(const [name,value]of Object.entries(config))body=body.replaceAll('{{'+name+'}}',esc(value));
  if(/\{\{/.test(body))throw new Error('Unresolved page placeholder');
  const url='/'+route+'/',dir=path.join(base,route);fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${head(route,'https://polynite.io'+url,{staging:base===path.join(root,'dev'),breadcrumbs:[['Polynite','https://polynite.io/'],[title,'https://polynite.io'+url]]})}<link rel="stylesheet" href="/assets/public-site/style.css"></head><body><a class="skip" href="#content">Skip to content</a><header><a class="brand" href="/mcp/">Poly<span>nite</span></a><nav aria-label="Main navigation">${nav.map(([href,text])=>`<a href="${href}"${href===url?' aria-current="page"':''}>${text}</a>`).join('')}<a href="/">Open app ↗</a></nav></header><main id="content">${body}</main><footer><span>Polynite · {{operator}}</span><nav aria-label="Service information"><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/support/">Support</a><a href="/docs/">Documentation</a><a href="${metadata.youtube}" rel="noopener">YouTube</a><a href="https://majify.tech/">Majify</a></nav></footer></body></html>`.replace('{{operator}}',esc(config.operator)));
 }
 const sitemap=['/','/mcp/','/docs/','/docs/mcp/','/support/','/privacy/','/terms/'].map(url=>`<url><loc>https://polynite.io${url}</loc></url>`).join('');fs.writeFileSync(path.join(base,'sitemap-app.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemap}</urlset>`);
}console.log('Built six public pages with metadata and sitemap in root/dev/web. Engine entry pages preserved.');
