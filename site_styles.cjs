const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const files=Object.fromEntries(['style','chrome'].map(name=>{const bytes=fs.readFileSync(path.join(__dirname,'public-site-src',name+'.css')),hash=crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12);return [name,{bytes,name:name+'-'+hash+'.css'}];}));
const stylesheetPaths={body:'/assets/public-site/'+files.style.name,chrome:'/assets/public-site/'+files.chrome.name};
function copyStyles(base){const dir=path.join(base,'assets/public-site');fs.mkdirSync(dir,{recursive:true});for(const [name,file]of Object.entries(files)){fs.writeFileSync(path.join(dir,file.name),file.bytes);fs.writeFileSync(path.join(dir,name+'.css'),file.bytes);}}
module.exports={stylesheetPaths,copyStyles};
