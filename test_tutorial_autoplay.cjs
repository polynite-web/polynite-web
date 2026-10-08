const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
async function test(){
 const calls=[],handlers={},timers=[];let playing=false,audio=false,gestures=0;
 const elements=Object.fromEntries(['iframe','#status','#replay','#pause','#reset','#save'].map(k=>[k,{textContent:'',disabled:true,addEventListener(event,fn){handlers[k+event]=fn;}}]));
 elements.iframe.contentWindow={vmeshAudioGesture:async()=>{gestures++;audio=true;return true;},polynite:{call(method,params){const command=params?.request?.command;calls.push([method,command]);if(method==='scene.describe')return {sound:{live:audio}};if(method==='scene.capabilities')return {commands:{cinematic_continue_scene:true},cinematic:{branding:true}};if(method==='scene.physics')return {body_count:1,steps:0};if(command==='status')return {playing,export:{active:false},branding:{}};if(command==='play')playing=true;if(command==='document')return {seq:[]};return {};}}};
 const context={document:{querySelector:k=>elements[k],body:{dataset:{scene:'/example.scene'}}},window:{addEventListener(){}},console:{info(){}},Date,setInterval:fn=>(timers.push(fn),timers.length),clearInterval(){},setTimeout,clearTimeout,fetch:async()=>({ok:true,json:async()=>({seq:[]})}),prepareTutorialDocument:x=>x,restoreTutorialCues:x=>x,URL};
 vm.runInNewContext(fs.readFileSync(__dirname+'/public-site-src/tutorial-view.js','utf8'),context);
 assert.equal(calls.length,0,'Wait for engine readiness');await timers[0]();
 assert.equal(playing,true,'Open scene starts the film');assert.equal(gestures,0,'Autoplay does not fabricate an audio gesture');
 assert.equal(elements['#replay'].textContent,'Replay');assert.equal(elements['#save'].disabled,true);
 await handlers['#replayclick']();assert.equal(gestures,1,'Replay unlocks audio through the user gesture');
 assert.ok(calls.some(([m,c])=>m==='scene.cinematic'&&c==='capture'),'Physics initial state is captured before play');
 console.log('PASS: ready-gated autoplay, physics capture, replay audio gesture and transport controls');
}
test().catch(e=>{console.error(e);process.exitCode=1;});
