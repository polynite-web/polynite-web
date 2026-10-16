/* The player owns a fresh MEMFS viewer. Opening/replaying never loads user storage. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),frame=$('viewer'),status=$('status'),buttons=['play','pause','adjust','save','reset','settings','variant'];
 let entry,reference,engine,timer,poll,objectUrl,disposed=false,ready=false,selectedVariant="";
 const notice=text=>status.textContent=text;
 const call=(method,params={})=>{try{const r=engine.call(method,params);if(r?.error||r?.ok===false)throw Error(r.error?.message||r.errors?.join('; ')||'The viewer refused this change');return r;}catch(error){console.error('[example RPC]',method,params.request?.command||'',error.stack||error.message);throw Error(method+' '+(params.request?.command||'')+': '+error.message);}};
 const film=(command,extra={})=>call('scene.cinematic',{request:{command,...extra}});
 const idle=()=>{if(film('status').export?.active)throw Error('A recording is in progress. Wait for it to finish.');};
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 async function checkExample(){
  const report=$('qa-report');await frame.contentWindow.vmeshAudioGesture?.();report.hidden=false;report.textContent='Checking…';idle();const saved=film('document',{expanded:true});const checks=[];
  try{
   for(const c of entry.checks||[]){const check=PolyniteRecipeChecks.create(c);for(const [i,time]of c.times.entries()){
    film('seek',{time});let settled=false,state;for(let k=0;k<600;k++){await sleep(100);state=film('status');report.textContent='Checking '+c.type+' at '+time+'s: '+state.time.toFixed(2)+'s';if(!state.seeking&&Math.abs(state.time-time)<.05){settled=true;break;}}if(!settled)throw Error('Seek did not settle');
    check.observe(i,call('scene.architecture',{request:{command:'inspect',id:c.instance,include_parts:true}}),call('scene.describe'));
   }check.finish();checks.push(c.type);}
   if(!call('scene.snapshot').objects)throw Error('Scene is empty');
   if(reference.initial.architecture?.length){const r=reference.initial.architecture[0],name=entry.edit_parameter||r.program.inputs[0].name,schema=call('scene.architecture',{request:{command:'inspect',id:r.id}}).parameter_schema.properties[name],value=schema.type==='integer'?Math.min(schema.maximum,schema.minimum+1):schema.minimum+(schema.maximum-schema.minimum)*.4;film('stop');call('scene.apply',{actions:[{op:'architecture',id:r.id,params:{[name]:value}}]});const changed=call('scene.architecture',{request:{command:'inspect',id:r.id}}).recipe.params[name];if(Math.abs(changed-value)>.001)throw Error('Parameter edit did not apply');checks.push('parameter edit');}
   report.textContent=JSON.stringify({passed:true,id:entry.id,checks,objects:call('scene.snapshot').objects},null,2);
  }catch(error){report.textContent=JSON.stringify({passed:false,id:entry.id,error:error.message},null,2);}finally{film('stop');film('load_document',{document:saved,start_paused:true});makeParameters();}
 }
 const enable=()=>{for(const id of buttons)$(id).disabled=!ready;};
 async function fetchJson(url){const r=await fetch(url);if(!r.ok)throw Error('Could not download '+new URL(url,location.href).pathname+' (HTTP '+r.status+')');return r.json();}
 function fail(error){ready=false;enable();notice('Could not open this example: '+error.message);if(entry?.media?.video){$('fallback').hidden=false;$('fallback').querySelector('video').src=entry.media.video;$('fallback-reason').textContent=error.message+'. The original film and scene download remain available.';}frame.remove();}
 function makeParameters(){
  const container=$('parameters');container.replaceChildren();
  for(const r of reference.initial.architecture||[]){
   const inspect=call('scene.architecture',{request:{command:'inspect',id:r.id,include_parts:false}}),fields=inspect.parameter_schema?.properties||{};
   const group=document.createElement('details');const summary=document.createElement('summary');summary.textContent=r.id+' · recipe controls';group.append(summary);container.append(group);
   for(const [name,schema]of Object.entries(fields)){
    const label=document.createElement('label'),text=document.createElement('span'),input=document.createElement('input'),value=document.createElement('output');text.textContent=name.replaceAll('_',' ');input.type='range';input.min=schema.minimum;input.max=schema.maximum;input.step=schema.type==='integer'?1:.001;input.value=inspect.recipe.params?.[name]??schema.default;input.setAttribute('aria-label',r.id+' '+name);value.textContent=Number(input.value).toFixed(schema.type==='integer'?0:3);label.append(text,input,value);group.append(label);
    input.addEventListener('input',()=>value.textContent=Number(input.value).toFixed(schema.type==='integer'?0:3));
    input.addEventListener('change',()=>{const old=inspect.recipe.params?.[name]??schema.default;try{idle();film('stop');call('scene.apply',{actions:[{op:'architecture',id:r.id,params:{[name]:Number(input.value)}}]});film('capture');inspect.recipe.params[name]=Number(input.value);notice('Updated '+r.id+' · '+name.replaceAll('_',' '));}catch(error){input.value=old;value.textContent=old;notice(error.message);}});
   }
  }
  if(!container.childElementCount){const p=document.createElement('p');p.textContent='Use Scene settings to adjust this creation’s saved controls, camera, lighting and atmosphere.';container.append(p);}
 }
 function loadReference(document=reference){idle();film('stop');film('load_document',{document:structuredClone(document),start_paused:true});reference=document;makeParameters();$('fallback').hidden=true;frame.hidden=false;ready=true;enable();notice('Ready · your independent copy. Play or adjust to explore.');}
 async function boot(){
  const id=new URL(location.href).searchParams.get('id');if(!id||!/^[a-z][a-z0-9-]*$/.test(id))throw Error('Choose an example from Showcase or Learn');
  const catalog=await fetchJson('catalog.json');entry=catalog.items.find(e=>e.id===id);if(!entry)throw Error('This example was not found');
  $('title').textContent=entry.title;document.title=entry.title+' · Polynite';$('back').href=entry.kind==='recipe'?entry.url:'https://explore.polynite.io/showcase/';$('back').textContent=entry.kind==='recipe'?'← Recipe':'← Showcase';$('original').href=entry.scene;$('prompt').textContent=entry.prompt;$('try-ideas').hidden=!entry.try?.length;for(const tip of entry.try||[]){const li=document.createElement('li');li.textContent=tip;$('try-ideas').append(li);}
  if(entry.recipes){$('recipe').hidden=false;$('recipe').href=entry.url;}
  const options=entry.variants||[];$('variant-label').hidden=!options.length;
  for(const v of [{id:'',title:'Original'},...options]){const option=document.createElement('option');option.value=v.id;option.textContent=v.title;$('variant').append(option);}
  selectedVariant=new URL(location.href).searchParams.get('variant')||'';const choice=selectedVariant?options.find(v=>v.id===selectedVariant):entry;if(!choice)throw Error('This variant was not found');$('variant').value=selectedVariant;
  reference=await fetchJson(new URL(choice.scene).pathname);
  if(new URL(location.href).searchParams.get('qa')==='1'){const button=document.createElement('button');button.textContent='Check example';button.id='check-example';button.disabled=true;document.querySelector('header').append(button);const report=document.createElement('pre');report.id='qa-report';report.hidden=true;$('controls').append(report);button.addEventListener('click',()=>{$('controls').hidden=false;checkExample().catch(error=>notice(error.message));});}
  frame.src='runtime/?example_view=1';
  const deadline=Date.now()+120000;
  timer=setInterval(()=>{if(disposed)return;try{const w=frame.contentWindow;if(w.__pnEngineFailure)throw Error('The graphics engine stopped: '+(w.__pnEngineFailure.message||w.__pnEngineFailure));if(!w.polynite?.call){if(Date.now()>deadline)throw Error('The graphics engine took too long to start. Check WebGPU support and retry.');return;}engine=w.polynite;const capabilities=call('scene.capabilities').commands||{};const missing=(entry.capabilities||[]).filter(k=>!capabilities[k]);if(missing.length)throw Error('This engine needs an update for '+missing.join(', '));clearInterval(timer);loadReference();if($('check-example'))$('check-example').disabled=false;poll=setInterval(()=>{if(!ready)return;try{const s=film('status');$('pause').textContent=s.paused?'Continue':'Pause';$('save').disabled=!!s.export?.active;$('play').textContent=s.playing?'Restart':'Play';}catch(error){clearInterval(poll);fail(error);}},500);}catch(error){clearInterval(timer);fail(error);}},250);
 }
 $('variant').addEventListener('change',async()=>{const id=$('variant').value;try{idle();ready=false;enable();const choice=id?(entry.variants||[]).find(v=>v.id===id):entry;if(!choice)throw Error('Unknown variant');const doc=await fetchJson(new URL(choice.scene).pathname);loadReference(doc);selectedVariant=id;const url=new URL(location.href);if(id)url.searchParams.set('variant',id);else url.searchParams.delete('variant');history.replaceState(null,'',url);notice('Ready · '+(choice.title||'Original')+' · your independent copy.');}catch(error){$('variant').value=selectedVariant;ready=true;enable();notice(error.message);}});
 $('play').addEventListener('click',async()=>{try{idle();await frame.contentWindow.vmeshAudioGesture?.();call('scene.ui',{request:{command:'click',target:'scene_replay'}});notice('Playing · you can orbit and explore the scene.');}catch(error){notice(error.message);}});
 $('pause').addEventListener('click',()=>{try{idle();call('scene.ui',{request:{command:'click',target:'scene_pause'}});}catch(error){notice(error.message);}});
 $('adjust').addEventListener('click',()=>{$('controls').hidden=!$('controls').hidden;});$('close-controls').addEventListener('click',()=>{$('controls').hidden=true;});
 $('reset').addEventListener('click',()=>{try{loadReference();$('reset').closest('details').open=false;}catch(error){notice(error.message);}});
 $('settings').addEventListener('click',()=>{try{call('scene.ui',{request:{command:'click',target:'scene_settings'}});$('settings').closest('details').open=false;}catch(error){notice(error.message);}});
 $('save').addEventListener('click',()=>{try{idle();const doc=film('document',{expanded:true}),url=URL.createObjectURL(new Blob([JSON.stringify(doc)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=entry.id+'-my-version.scene';link.click();if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=url;notice('Your scene has been downloaded.');}catch(error){notice(error.message);}});
 $('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('prompt').textContent);notice('Prompt copied. Paste it into your connected assistant.');}catch{notice('Select and copy the creation prompt.');}});
 window.addEventListener('pagehide',()=>{disposed=true;clearInterval(timer);clearInterval(poll);if(objectUrl)URL.revokeObjectURL(objectUrl);});
 boot().catch(fail);
})();
