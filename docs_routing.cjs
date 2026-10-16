const DOCS_ORIGIN='https://explore.polynite.io',APP_ORIGIN='https://polynite.io';
const recipeItems=require('./public-site-src/recipe-examples/catalog.json').items;
const DOC_ROUTES=['docs','docs/mcp','docs/sharing','docs/recipes',...recipeItems.map(e=>'docs/recipes/'+e.id)];
function rewriteDocsBody(html){
 return html.replace(/(href|src|poster)="(\/[^"]*)"/g,(full,attribute,url)=>{
  if(url.startsWith('/docs/media/'))return `${attribute}="${APP_ORIGIN}${url}"`;
  if(/^\/docs(?:\/?(?:[?#]|$))/.test(url))return `${attribute}="${DOCS_ORIGIN}${url.replace(/^\/docs\/?/,'/learn/')}"`;
  if(url.startsWith('/docs/')||url==='/docs')return `${attribute}="${DOCS_ORIGIN}${url}"`;
  return `${attribute}="${APP_ORIGIN}${url}"`;
 });
}
function migrateDocLinks(html){return html.replace(/https:\/\/polynite\.io\/docs\/(?=[#?"])/g,DOCS_ORIGIN+'/learn/').replace(/href="\/docs\/(?=[#?"])/g,'href="'+DOCS_ORIGIN+'/learn/').replace(/https:\/\/polynite\.io\/docs\/(?!media\/)/g,DOCS_ORIGIN+'/docs/').replace(/href="(\/docs\/(?!media\/)[^"]*)"/g,(_,url)=>`href="${DOCS_ORIGIN}${url}"`);}
function docTarget(route){return DOCS_ORIGIN+'/'+(route==='docs'?'learn':route)+'/';}
function docRedirects(){return DOC_ROUTES.flatMap(route=>[`/${route} ${docTarget(route)} 301`,`/${route}/ ${docTarget(route)} 301`,`/${route}/index.html ${docTarget(route)} 301`]).join('\n');}
module.exports={DOCS_ORIGIN,APP_ORIGIN,DOC_ROUTES,rewriteDocsBody,migrateDocLinks,docRedirects,docTarget};
