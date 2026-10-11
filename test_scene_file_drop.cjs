const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
async function run(){
 const handlers={},elements={},calls=[];let exporting=false,held=false;
 const engine={call(method,params){calls.push([method,params?.request]);if(method==='scene.cinematic'&&params.request.command==='status')return {export:{active:exporting}};if(method==='scene.interaction')return {held};return {};}};
 const window={polynite:engine,addEventListener:(name,fn)=>handlers[name]=fn,dispatchEvent(){}};
 const document={getElementById:id=>elements[id],createElement:()=>({style:{},setAttribute(){}}),body:{append:box=>elements[box.id]=box}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/scene-file-drop.js','utf8'),{window,document,JSON,Error,CustomEvent:function(){},setTimeout:()=>1,clearTimeout(){}});
 const file=(text,name='example.scene')=>({name,size:text.length,text:async()=>text});
 async function drop(f){let prevented=false,stopped=false;handlers.drop({dataTransfer:{files:[f]},preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;}});await new Promise(r=>setImmediate(r));return {prevented,stopped};}
 const good=JSON.stringify({version:1,initial:{},seq:[]});
 assert.deepEqual(await drop(file(good,'EXAMPLE.SCENE')),{prevented:true,stopped:true});assert.ok(calls.some(([m,r])=>m==='scene.cinematic'&&r.command==='load_document'&&r.start_paused));
 const count=()=>calls.filter(([m,r])=>r?.command==='load_document').length;const initial=count();
 await drop(file('{invalid'));assert.equal(count(),initial);assert.match(elements['scene-file-notice'].textContent,/Could not open scene/);
 await drop(file(JSON.stringify({version:1,initial:[],seq:[]})));assert.equal(count(),initial);
 exporting=true;await drop(file(good));assert.equal(count(),initial);exporting=false;
 held=true;await drop(file(good));assert.equal(count(),initial);held=false;
 assert.deepEqual(await drop(file(good,'example.glb')),{prevented:false,stopped:false});
 handlers.change({target:{files:[file(good)]},stopImmediatePropagation(){}});await new Promise(r=>setImmediate(r));assert.equal(count(),initial+1);
 for(const base of ['dev','web'])assert.equal(fs.readFileSync(__dirname+'/'+base+'/scene-file-drop.js','utf8'),fs.readFileSync(__dirname+'/scene-file-drop.js','utf8'));
 console.log('PASS: scene-only drop and picker, case-insensitive extension, paused load, invalid document/export/gesture refusal and identical deployment copies');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
