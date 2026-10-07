const DOCS_ORIGIN='https://explore.polynite.io',APP_ORIGIN='https://polynite.io';
const DOC_ROUTES=['docs','docs/mcp','docs/sharing'];
function rewriteDocsBody(html){
 return html.replace(/(href|src|poster)="(\/[^"]*)"/g,(full,attribute,url)=>{
  if(url.startsWith('/docs/media/'))return `${attribute}="${APP_ORIGIN}${url}"`;
  if(url.startsWith('/docs/')||url==='/docs')return `${attribute}="${DOCS_ORIGIN}${url}"`;
  return `${attribute}="${APP_ORIGIN}${url}"`;
 });
}
function migrateDocLinks(html){return html.replace(/https:\/\/polynite\.io\/docs\/(?!media\/)/g,DOCS_ORIGIN+'/docs/').replace(/href="(\/docs\/(?!media\/)[^"]*)"/g,(_,url)=>`href="${DOCS_ORIGIN}${url}"`);}
function docRedirects(){return DOC_ROUTES.flatMap(route=>[`/${route} ${DOCS_ORIGIN}/${route}/ 301`,`/${route}/ ${DOCS_ORIGIN}/${route}/ 301`,`/${route}/index.html ${DOCS_ORIGIN}/${route}/ 301`]).join('\n');}
module.exports={DOCS_ORIGIN,APP_ORIGIN,DOC_ROUTES,rewriteDocsBody,migrateDocLinks,docRedirects};
