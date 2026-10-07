// Preserve a coherent JS/WASM/resource release; never mutate an existing archive.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');const root=__dirname;
const version=fs.readFileSync(path.join(root,'version.txt'),'utf8').trim();if(!/^v\d{4,6}$/.test(version))throw new Error('Invalid release label');
const exec=require('node:child_process');exec.execFileSync(process.execPath,[path.join(root,'check_engine_pair.cjs'),root],{stdio:'inherit'});
const files=[];function collect(dir,prefix=''){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const name=prefix+entry.name;if(entry.isDirectory())collect(path.join(dir,entry.name),name+'/');else if(entry.isFile())files.push({name,bytes:fs.readFileSync(path.join(dir,entry.name))});}}
for(const entry of fs.readdirSync(root,{withFileTypes:true}))if(entry.isFile()&&/\.(js|css|wasm|txt|json)$/.test(entry.name)&&!/^app_before|^package|^check_|^build_|^archive_|^site/.test(entry.name))files.push({name:entry.name,bytes:fs.readFileSync(path.join(root,entry.name))});
files.push({name:'app.html',bytes:fs.readFileSync(path.join(root,'app.html'))});
for(const folder of ['Rc','pane','layout','assets'])if(fs.existsSync(path.join(root,folder)))collect(path.join(root,folder),folder+'/');
const manifest={version,format:1,files:Object.fromEntries(files.map(f=>[f.name,{bytes:f.bytes.length,sha256:crypto.createHash('sha256').update(f.bytes).digest('hex')}]))};
for(const base of [root,path.join(root,'web')]){
 const dir=path.join(base,'releases',version),existing=path.join(dir,'manifest.json');
 if(fs.existsSync(existing)){if(JSON.stringify(JSON.parse(fs.readFileSync(existing)))!==JSON.stringify(manifest))throw new Error('Immutable archive already exists with different content: '+dir);continue;}
 fs.mkdirSync(dir,{recursive:true});for(const file of files){const dest=path.join(dir,file.name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,file.bytes);}fs.writeFileSync(existing,JSON.stringify(manifest,null,2));
}
console.log('Archived '+version+' ('+files.length+' files), models remain external dependencies.');
