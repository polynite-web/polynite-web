const fs=require('node:fs'),path=require('node:path');const file=path.resolve(process.argv[2]);let source=fs.readFileSync(file,'utf8');
if(!source.includes("import {renderHeader,renderFooter}"))source="import {renderHeader,renderFooter} from './site_chrome.js';\n"+source;
source=source.replace('max-width:64rem','max-width:1120px').replaceAll('/assets/og-procedural-v1.png','/assets/og-create-view-share-v2.png');
source=source.replace(/\t\t'<header class="site">[\s\S]*?<\/header>' \+/,"\t\t renderHeader({section:'Explore',current:opts.nav==='/discover/'?'Discover':opts.nav==='/create/'?'Create':'',app,explore:ex}) +");
source=source.replace(/\t\t'<footer class="site">[\s\S]*?<\/footer>' \+/,"\t\t renderFooter({app,explore:ex}) +");
source=source.replace("'<style>' + MP_STYLE + '</style></head><body>'",`'<style>' + MP_STYLE + '</style><link rel="stylesheet" href="' + app + '/assets/public-site/chrome.css"></head><body>'`);
source=source.replace(/\tconst nav = \(cur, go\) =>[\s\S]*?\treturn \(/,"\treturn (");
fs.writeFileSync(file,source);console.log('Dynamic Discover/model chrome synchronized.');

