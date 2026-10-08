// Normalize actual filenames on Windows through a unique intermediate name.
const fs=require('node:fs'),path=require('node:path');
for(const root of process.argv.slice(2))for(const name of ['app.js','app.wasm']){
 const actual=fs.readdirSync(root).find(n=>n.toLowerCase()===name);if(!actual)throw Error('Missing '+path.join(root,name));
 if(actual!==name){const temp=path.join(root,name+'.case-'+process.pid);fs.renameSync(path.join(root,actual),temp);fs.renameSync(temp,path.join(root,name));console.log('[polynite] Normalized '+actual+' to '+name);}
}

for(const root of process.argv.slice(2))for(const entry of fs.readdirSync(root,{withFileTypes:true})){
 if(!entry.isFile()||!(/\.(js|html|css|txt|json)$/.test(entry.name)||['_headers','_redirects'].includes(entry.name)))continue;
 const file=path.join(root,entry.name),bytes=fs.readFileSync(file);if(!bytes.includes(0))fs.writeFileSync(file,bytes.toString('utf8').replace(/\r\n/g,'\n'));
}

function normalize(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
 const file=path.join(dir,entry.name);if(entry.isDirectory()){if(entry.name!=='media')normalize(file);}else if(/\.(js|html|css|txt|json|pane|layout)$/.test(entry.name)){const bytes=fs.readFileSync(file);if(!bytes.includes(0))fs.writeFileSync(file,bytes.toString('utf8').replace(/\r\n/g,'\n'));}
}}
for(const root of process.argv.slice(2))for(const name of ['assets','Rc','pane','layout','docs','tutorials','tutorial-view','mcp','privacy','support','terms'])if(fs.existsSync(path.join(root,name)))normalize(path.join(root,name));
