/* One quiet status surface for startup, scene preparation and GPU work. */
(function(){
 'use strict';
 let card,label,fill,stage='',next='',changed=0,busySince=0,shown=0,frame=0,progress=0,painted=-1,gpu=null,sceneBusy=true,sceneStage='',sceneProgress=-1,ending=0,compact=false,batch=0,batchStart=0;
 const words=['Preparing files','Downloading the model','Reading the model','Reading the scene','Preparing textures','Building shapes','Preparing shadows','Organizing the scene','Finishing textures','Preparing the view','Finishing touches'];
 function build(){
  if(card||!document.body)return;
  document.body.classList.add('loading-status-enabled');
  card=document.createElement('div');card.id='loading-status';card.setAttribute('role','status');card.setAttribute('aria-live','polite');card.setAttribute('aria-atomic','true');
  card.innerHTML='<div class="loading-emblem" aria-hidden="true"><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="12"/><ellipse cx="24" cy="24" rx="21" ry="7" transform="rotate(-28 24 24)"/></svg></div><div class="loading-copy"><div class="loading-title"></div><div class="loading-step"></div><div class="loading-track" aria-hidden="true"><i></i></div></div>';
  card.querySelector('.loading-title').textContent='Your scene is taking shape';label=card.querySelector('.loading-step');fill=card.querySelector('i');document.body.appendChild(card);
 }
 /* What the GPU is compiling, named for a person: the pipeline label's family, then how
    many of this batch are done. A static model's first appearance compiles its surface
    shader; on a phone that is the longest wait of the load. */
 function gpuStep(){
  const name=gpu?.label||'';
  const what=/audio|sound|synth/i.test(name)?'Preparing sound'
   :/scatter-forest|scatter-crown/i.test(name)?'Preparing trees'
   :/scatter|grass/i.test(name)?'Preparing plants and particles'
   :/water|surface-water/i.test(name)?'Preparing water'
   :/window/i.test(name)?'Preparing windows'
   :/cutout/i.test(name)?'Preparing foliage cards'
   :/^vmesh-pipeline|^vmesh-shadow-pipeline/i.test(name)?'Preparing the model materials'
   :/skin|tech-edge|dust/i.test(name)?'Preparing objects'
   :/floor|shadow|depth|light/i.test(name)?'Lighting and ground'
   :/sdf|text|stamp/i.test(name)?'Preparing drawings and text'
   :/post|blur|taa|fog|vol|velocity|motion/i.test(name)?'Finishing touches'
   :'Preparing the view';
  return batch>1?what+' \u00b7 '+Math.min((gpu.completed-batchStart)+1,batch)+'/'+batch:what;
 }
 function tick(now){
  frame=0;build();if(!card)return;
  const initial=!document.body.classList.contains('world-visible'),busy=initial||sceneBusy||!!gpu?.pending;
  if(busy&&!busySince)compact=!initial&&!sceneBusy;
  const failed=gpu?.failed||document.body.classList.contains('arrival-failed');
  card.classList.toggle('compact',compact);
  const wanted=failed?'Loading interrupted':gpu?.pending?gpuStep():sceneStage||(document.getElementById('loaderText')?.textContent||'Opening your scene').replace(/\s*[·-]?\s*v\d+.*$/,'');
  if(wanted!==next)next=wanted;
  if(!stage||failed||now-changed>=700){if(stage!==next){stage=next;label.textContent=stage;changed=now;}}
  if(busy||failed){
   ending=0;
   if(!busySince)busySince=now;
   if(failed||now-busySince>=300){if(!shown)shown=now;card.classList.add('visible');}
   const total=(gpu?.completed||0)+(gpu?.pending||0),known=gpu?.pending&&total?gpu.completed/total:sceneProgress>=0?sceneProgress/100:-1;
   card.classList.toggle('indeterminate',known<0);if(known>=0)progress=Math.max(progress,Math.min(.94,known));
   if(Math.abs(progress-painted)>.002){fill.style.transform='scaleX('+progress+')';painted=progress;}
  }else if(!shown||now-shown>=700){
   card.classList.remove('visible');if(!ending)ending=now;
   if(!shown||now-ending>=240){busySince=shown=progress=ending=0;stage='';}
  }
  document.body.classList.toggle('loading-status-busy',!compact&&(busy||!!shown));
  if(!failed&&(busy||shown))frame=requestAnimationFrame(tick);
 }
 function wake(){if(!frame)frame=requestAnimationFrame(tick);}
 window.pnLoading={pipeline(state,name){if(gpu&&gpu.pending===state.pending&&gpu.completed===state.completed&&gpu.failed===state.failed&&gpu.label===name)return;if(state.pending>0&&!(gpu&&gpu.pending>0))batchStart=state.completed;batch=state.pending>0?state.completed-batchStart+state.pending:0;gpu={pending:state.pending,completed:state.completed,failed:state.failed,label:name};wake();},scene(phase,value,index){if(phase!==1&&phase!==2)return;sceneStage=(words[index]||words[0]);sceneProgress=phase===1?value:-1;wake();},arrival(value){value=!!value;if(sceneBusy===value)return;sceneBusy=value;if(!sceneBusy){sceneStage='';sceneProgress=-1;}wake();}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wake,{once:true});else wake();
})();
