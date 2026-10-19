/* Exercise user-visible viewer transitions without a GPU or a saved user scene. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Element{
 constructor(){this.children=[];this.events={};this.hidden=false;this.disabled=true;this.value='';}
 append(...items){this.children.push(...items);}replaceChildren(){this.children=[];}setAttribute(k,v){this[k]=v;}
 addEventListener(k,fn){this.events[k]=fn;}click(){return this.events.click?.();}closest(){return this;}querySelector(){return new Element();}remove(){this.removed=true;}
}
(async()=>{
 const nodes=new Map(),$=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);},calls=[],timers=[],requested=[];
 const original={initial:{architecture:[{id:'part',params:{width:1}}]},seq:[]},wide={initial:{architecture:[{id:'part',params:{width:2}}]},seq:[]};let current,recording=false,fetches=0,failFetch=false,downloads=0;
 const entry={id:'example',title:'Example',kind:'showcase',scene:'https://polynite.io/examples/data/base.scene',prompt:'Compose a variation',capabilities:['recipe_program'],variants:[{id:'wide',title:'Wide version',scene:'https://polynite.io/examples/data/wide.scene'}]};
 const engine={call(method,p={}){calls.push([method,p]);if(method==='scene.capabilities')return{commands:{recipe_program:true}};if(method==='scene.cinematic'){const c=p.request.command;if(c==='status')return{paused:true,export:{active:recording}};if(c==='load_document')current=structuredClone(p.request.document);if(c==='document')return structuredClone(current);return{};}if(method==='scene.architecture')return{recipe:structuredClone(current.initial.architecture[0]),parameter_schema:{properties:{width:{type:'number',minimum:.5,maximum:3,default:1}}}};if(method==='scene.apply')current.initial.architecture[0].params.width=p.actions[0].params.width;return{};}};
 $('viewer').contentWindow={polynite:engine,vmeshAudioGesture:async()=>true};
 class BrowserURL extends URL{static createObjectURL(){return'blob:test';}static revokeObjectURL(){}}
 const context={document:{getElementById:$,createElement:()=>{const e=new Element();e.click=()=>downloads++;return e;},querySelector:()=>new Element()},location:{href:'https://polynite.io/dev/examples/view.html?id=example'},history:{replaceState(){}},URL:BrowserURL,Blob,structuredClone,console,navigator:{clipboard:{writeText:async()=>{}}},setInterval:fn=>{timers.push(fn);return timers.length;},clearInterval(){},setTimeout,window:{addEventListener(){}},fetch:async url=>{fetches++;requested.push(url);if(failFetch)return{ok:false,status:503};return{ok:true,json:async()=>structuredClone(url==='catalog.json'?{items:[entry]}:String(url).includes('wide')?wide:original)};}};
 vm.runInNewContext(fs.readFileSync('public-site-src/example-view.js','utf8'),context);await new Promise(setImmediate);timers[0]();
 const loads=()=>calls.filter(([m,p])=>m==='scene.cinematic'&&p.request.command==='load_document').length;
 assert.equal(calls.filter(([m])=>m==='scene.architecture').length,0,'Boot must not inspect every recipe just to build closed controls');
 const controls=$('parameters').children[0];controls.open=true;controls.events.toggle();assert.equal(calls.filter(([m])=>m==='scene.architecture').length,1,'Opening one group should inspect only that recipe');
 assert.equal(loads(),1);assert.equal($('play').disabled,false);await $('play').click();assert.equal(loads(),1,'Play must not reload the reference');
 $('variant').value='wide';await $('variant').events.change();assert.equal(current.initial.architecture[0].params.width,2);assert.equal(loads(),2);assert.equal($('play').disabled,false);
 current.initial.architecture[0].params.width=2.4;$('reset').click();assert.equal(current.initial.architecture[0].params.width,2,'Reset must restore the selected variant');
 const count=loads();failFetch=true;$('variant').value='';await $('variant').events.change();assert.equal(loads(),count);assert.equal($('variant').value,'wide');assert.equal(current.initial.architecture[0].params.width,2);assert(!$('viewer').removed,'A failed variant fetch must preserve the viewer');failFetch=false;
 recording=true;const before=calls.length,requests=fetches;$('variant').value='';await $('variant').events.change();assert.equal(fetches,requests);assert.equal(loads(),count);assert(!calls.slice(before).some(([m,p])=>m==='scene.cinematic'&&p.request.command==='stop'),'Changing variants must not cancel recording');recording=false;
 $('save').click();assert.equal(downloads,1);assert.equal(loads(),count,'Saving must not reset a scene');
 assert(requested.filter(url=>url!=='catalog.json').every(url=>url.startsWith('/dev/')),'Candidate scene and variant requests must retain the deployment prefix');
 console.log('PASS viewer boot, play without reload, variant switch, selected-reference reset, failed download recovery, export guard and scene save.');
 // Two overlapping check gestures must not interleave scene seeks. Contracts
 // sharing a timestamp observe the same scene instead of replaying it twice.
 nodes.clear();calls.length=0;timers.length=0;current=undefined;
 $('viewer').contentWindow={polynite:engine,vmeshAudioGesture:async()=>true};
 const header=new Element(),observations=[];let time=0;
 entry.checks=[{type:'test',instance:'a',times:[0,2.8,5.6]},{type:'test',instance:'b',times:[0,2.8,5.6]}];entry.edit_parameter='width';
 context.location.href+='&qa=1';context.document.querySelector=()=>header;
 context.PolyniteRecipeChecks={create:c=>({observe(i){observations.push([c.instance,i,time]);},finish(){}})};
 const baseCall=engine.call;engine.call=function(method,p={}){
  if(method==='scene.cinematic'&&p.request.command==='seek')time=p.request.time;
  const r=baseCall(method,p);if(method==='scene.cinematic'&&p.request.command==='status')Object.assign(r,{time,seeking:false});
  if(method==='scene.snapshot')return{objects:1};return r;
 };
 vm.runInNewContext(fs.readFileSync('public-site-src/example-view.js','utf8'),context);await new Promise(setImmediate);
 const check=header.children.find(e=>e.id==='check-example'),report=$('controls').children.find(e=>e.id==='qa-report');assert(check&&report);
 nodes.set('check-example',check);nodes.set('qa-report',report);timers[0]();
 check.events.click();assert(check.disabled);check.events.click();
 for(let i=0;i<200&&check.disabled;i++)await new Promise(r=>setTimeout(r,10));
 assert(!check.disabled,'Check did not finish');assert.equal(JSON.parse(report.textContent).passed,true);
 assert.deepEqual(calls.filter(([m,p])=>m==='scene.cinematic'&&p.request.command==='seek').map(([,p])=>p.request.time),[0,2.8,5.6]);
 assert.equal(observations.length,6);assert.equal(current.initial.architecture[0].params.width,1,'Check must restore its independent scene');
 console.log('PASS serial example checks, shared-time observations and restoration after parameter verification.');
})().catch(error=>{console.error(error);process.exitCode=1;});
