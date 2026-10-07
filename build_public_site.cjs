const {DOCS_ORIGIN,rewriteDocsBody,migrateDocLinks,docRedirects}=require('./docs_routing.cjs');
const {stylesheetPaths,copyStyles}=require('./site_styles.cjs');
const fs=require('node:fs'),path=require('node:path');const root=__dirname;
const config=JSON.parse(fs.readFileSync(path.join(root,'public-site-src/config.json'),'utf8'));
if(!config.operator||!config.jurisdiction||!/^[-\w.+]+@[-\w.]+$/.test(config.contactEmail))throw new Error('Missing confirmed operator/contact/jurisdiction');
const {esc,head,metadata}=require('./site_metadata.cjs'); const {renderHeader,renderFooter}=require('./site_chrome.mjs');
const pages={mcp:'Create in 3D, together',docs:'A scene starts with a sentence','docs/mcp':'Your assistant, your current scene','docs/sharing':'Share an interactive scene',support:'Keep your scene, find the next step',privacy:'Privacy',terms:'Terms of use'};

for(const base of [root,path.join(root,'dev'),path.join(root,'web')]){copyStyles(base);
 const social=path.join(root,'assets/og-create-view-share-v2.png');if(fs.existsSync(social)){if(base!==root)fs.copyFileSync(social,path.join(base,'assets/og-create-view-share-v2.png'));fs.copyFileSync(social,path.join(base,'assets/og-cover.png'));}
 const assets=path.join(base,'assets/public-site');fs.mkdirSync(assets,{recursive:true});fs.copyFileSync(path.join(root,'public-site-src/style.css'),path.join(assets,'style.css'));fs.copyFileSync(path.join(root,'public-site-src/chrome.css'),path.join(assets,'chrome.css'));
 for(const [route,title]of Object.entries(pages)){
  let body=fs.readFileSync(path.join(root,'public-site-src',route.replaceAll('/','-')+'.html'),'utf8');for(const [name,value]of Object.entries(config))body=body.replaceAll('{{'+name+'}}',esc(value));
  body=route.startsWith('docs')?rewriteDocsBody(body):migrateDocLinks(body);
  if(/\{\{/.test(body))throw new Error('Unresolved page placeholder');
  const url='/'+route+'/',dir=path.join(base,route);fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${head(route,(route.startsWith('docs')?DOCS_ORIGIN:'https://polynite.io')+url,{staging:base===path.join(root,'dev')||route.startsWith('docs'),breadcrumbs:[['Polynite','https://polynite.io/'],[title,(route.startsWith('docs')?DOCS_ORIGIN:'https://polynite.io')+url]]})}<link rel="stylesheet" href="${stylesheetPaths.body}"><link rel="stylesheet" href="${stylesheetPaths.chrome}"></head><body><a class="skip" href="#content">Skip to content</a>${renderHeader({section:route.startsWith("docs")?"Docs":"",current:route==="docs/mcp"?"AI & MCP":route.startsWith("docs")?"Docs":""})}<main id="content">${body}</main>${renderFooter()}</body></html>`.replace('{{operator}}',esc(config.operator)));
 }
 const sitemap=['/','/mcp/','/support/','/privacy/','/terms/'].map(url=>`<url><loc>https://polynite.io${url}</loc></url>`).join('');fs.writeFileSync(path.join(base,'sitemap-app.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemap}</urlset>`);
 const redirectsPath=path.join(base,'_redirects');let redirects=fs.existsSync(redirectsPath)?fs.readFileSync(redirectsPath,'utf8'):fs.readFileSync(path.join(root,'_redirects'),'utf8');redirects=redirects.split(/\r?\n/).filter(line=>!/^\/docs(?:[ /]|\/mcp|\/sharing)/.test(line)).join('\n');fs.writeFileSync(redirectsPath,redirects.trim()+'\n'+docRedirects()+'\n');
}console.log('Built seven public pages with metadata and sitemap in root/dev/web. Engine entry pages preserved.');
