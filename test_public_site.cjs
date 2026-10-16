const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const root=__dirname;
for(const route of ['mcp','docs','docs/mcp','docs/sharing','support','privacy','terms']){
 const html=fs.readFileSync(path.join(root,route,'index.html'),'utf8');assert.match(html,/<h1>/);assert.match(html,/<main(?:\s|>)/);assert.match(html,/<nav\b[^>]*aria-label=/);assert.ok(!html.includes('{{'));
 assert.ok(html.includes((route==='docs'?'https://explore.polynite.io/learn/':(route.startsWith('docs')?'https://explore.polynite.io/':'https://polynite.io/')+route+'/')));assert.ok(!html.includes('autoplay'));
 for(const match of html.matchAll(/(?:href|src|poster)="(\/[^"#]*)"/g)){
  const url=match[1].split('#')[0];const file=path.join(root,url.endsWith('/')?url+'index.html':url);assert.ok(fs.existsSync(file),'Broken local reference '+route+': '+url);
 }
}
assert.ok(!/^\/mcp(?:[ /])/m.test(fs.readFileSync(path.join(root,'_redirects'),'utf8')),'Product page cannot redirect away');
for(const file of ['explosion.mp4','title.mp4']){assert.ok(fs.statSync(path.join(root,'docs/media/v1',file)).size<26214400);}
for(const base of [root,path.join(root,'web')]){
 const version=fs.readFileSync(path.join(base,'version.txt'),'utf8').trim();
 assert.match(version,/^v\d+$/,'Invalid engine version in '+base);
 // The legacy root and the published site have independent engine versions.
 const manifest=path.join(base,'deploy-manifest.json');
 if(fs.existsSync(manifest))assert.equal(JSON.parse(fs.readFileSync(manifest,'utf8')).version,version,'Engine version differs from its deployment manifest in '+base);
 for(const name of ['app.html','app.js','app.wasm','backend.js']){
  const size=fs.statSync(path.join(base,name)).size;assert.ok(size>0&&size<=26214400,'Invalid current engine asset size: '+name);
 }
}
console.log('Seven pages, local links, stable movie assets and current engine assets verified. Visual/browser tests remain separate.');
