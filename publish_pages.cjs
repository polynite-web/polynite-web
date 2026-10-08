// Publish the release that deploy_dev_to_site prepared; never claim Git push deployed it.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const candidates=[process.env.POLYNITE_WRANGLER,path.join(__dirname,'node_modules/wrangler/bin/wrangler.js'),path.join(__dirname,'../majify-api/worker/node_modules/wrangler/bin/wrangler.js')].filter(Boolean);
const wrangler=candidates.find(p=>fs.existsSync(p));if(!wrangler)throw Error('Wrangler missing: set POLYNITE_WRANGLER to its bin/wrangler.js');
cp.execFileSync(process.execPath,[wrangler,'pages','deploy',path.join(__dirname,'web'),'--project-name','polynite-web','--branch','main','--commit-dirty=true'],{cwd:__dirname,stdio:'inherit'});
