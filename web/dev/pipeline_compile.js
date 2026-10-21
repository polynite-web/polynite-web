/* Opt-in bridge for Sokol's asynchronous WebGPU pipeline state. */
(function () {
  'use strict';
  if(globalThis.__pnPipelineCompile)return;
  const device = globalThis.GPUDevice && GPUDevice.prototype;
  if (!device || !device.createRenderPipelineAsync || !device.createComputePipelineAsync) return;
  const options = new URLSearchParams(location.search), profiling = options.has('pipeline_profile');
  const native = { render: device.createRenderPipelineAsync, compute: device.createComputePipelineAsync };
  const shaders = new WeakMap(), layouts = new WeakMap(), seen = new WeakMap(), descriptors = [], rows = [], queue = [];
  let active = 0, scheduled = false, serial = 0, lastTick = 0, burstStart = 0, deadline = 0, indicator;
  const state = globalThis.__pnPipelineCompile = { enabled: options.get('pipeline_async') !== '0', pending: 0, completed: 0, failed: false, ticks: 0, max_frame_gap_ms: 0, waitingForLoader: false };
  const hash = text => { let h=2166136261; for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619); return (h>>>0).toString(16); };
  const canonical = value => {
    if (!value || typeof value !== 'object') return value;
    if (shaders.has(value)) return {shader:shaders.get(value)};
    if (layouts.has(value)) return {layout:layouts.get(value)};
    if (Array.isArray(value)) return value.map(canonical);
    return Object.fromEntries(Object.keys(value).sort().filter(k=>k!=='label').map(k=>[k,canonical(value[k])]));
  };
  const shaderOriginal=device.createShaderModule;
  device.createShaderModule=function(desc){const value=shaderOriginal.call(this,desc);shaders.set(value,hash(desc.code));return value;};
  for(const name of ['createBindGroupLayout','createPipelineLayout']) {
    const original=device[name]; device[name]=function(desc){const value=original.call(this,desc);layouts.set(value,hash(JSON.stringify(canonical(desc))));return value;};
  }
  function update() {
    if(!document.body)return;
    if(!indicator){indicator=document.createElement('div');indicator.id='pipeline-progress';indicator.setAttribute('role','status');indicator.setAttribute('aria-live','polite');indicator.style.cssText='position:fixed;z-index:99990;left:50%;bottom:28px;transform:translateX(-50%);padding:12px 18px;border:1px solid #536878;border-radius:12px;background:#101c2fed;color:#e3eef5;font:14px system-ui;pointer-events:none';document.body.appendChild(indicator);}
    indicator.hidden=!state.pending&&!state.failed;
    const fr=/^fr/i.test(navigator.language||'');
    indicator.textContent=state.failed?(fr?'Preparation interrompue':'Preparation failed'):(fr?"Preparation de l'affichage":'Preparing display')+' - '+state.completed+'/'+(state.completed+state.pending)+' - '+((performance.now()-burstStart)/1000).toFixed(1)+' s';
    if(state.pending){const text=document.getElementById('loaderText');if(text)text.textContent=indicator.textContent;}
  }
  function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(tick);}}
  function tick(now){
    scheduled=false;state.ticks++;if(lastTick)state.max_frame_gap_ms=Math.max(state.max_frame_gap_ms,now-lastTick);lastTick=now;update();
    deadline=performance.now()+12;startNext();
    if(state.pending)schedule();else lastTick=0;
  }
  function startNext(){
    if(active||!queue.length||state.failed)return;
    const job=queue.shift();active=1;job.row.start_ms=performance.now();job.row.queue_ms=job.row.start_ms-job.row.queued_ms;
    let result;try{result=native[job.kind].call(job.device,job.desc);}catch(error){result=Promise.reject(error);}
    Promise.resolve(result).then(value=>finish(job,null,value),error=>finish(job,error));
  }
  function finish(job,error,value){
    active=0;state.pending--;state.completed++;
    Object.assign(job.row,{ready_ms:performance.now(),ok:!error});job.row.prepare_ms=job.row.ready_ms-job.row.start_ms;
    if(error){state.failed=true;job.row.error=String(error.message||error);globalThis.__pnEngineFailure=job.row.error;globalThis.vmeshRuntimeInitialized=false;globalThis.dispatchEvent(new CustomEvent('polynite:engine-failed',{detail:{message:job.row.error}}));}
    console.info('[pipeline-ready] '+JSON.stringify(job.row));update();schedule();error?job.reject(error):job.resolve(value);
    // Reuse this paint's remaining budget for short cached jobs; long work yields.
    if(!error&&performance.now()<deadline)startNext();
  }
  function enqueue(device,kind,desc,phase,round=0){
    const signature=hash(JSON.stringify(canonical(desc)));
    let keys=seen.get(device);if(!keys){keys=new Set();seen.set(device,keys);}
    if(phase==='first'){const key=kind+signature;if(keys.has(key))phase='reuse';else keys.add(key);}
    const row={id:++serial,label:desc.label||'(unlabelled)',kind,phase,round,signature,queued_ms:performance.now()};
    if(profiling)rows.push(row);if(profiling&&phase==='first')descriptors.push({device,kind,desc});
    if(!state.pending){burstStart=performance.now();lastTick=burstStart;}state.pending++;schedule();
    return new Promise((resolve,reject)=>queue.push({device,kind,desc,row,resolve,reject}));
  }
  for(const [kind,name] of [['render','createRenderPipelineAsync'],['compute','createComputePipelineAsync']])
    device[name]=function(desc){return state.enabled?enqueue(this,kind,desc,'first'):native[kind].call(this,desc);};
  state.read=()=>({enabled:state.enabled,pending:state.pending,completed:state.completed,failed:state.failed,ticks:state.ticks,max_frame_gap_ms:state.max_frame_gap_ms,rows:rows.map(r=>({...r}))});
  state.warm=async(rounds=3)=>{if(!profiling)throw Error('Enable pipeline_profile to retain descriptors');if(state.pending)throw Error('Wait for pipeline preparation');if(!Number.isInteger(rounds)||rounds<1||rounds>5)throw Error('rounds must be 1..5');const jobs=descriptors.slice();for(let r=0;r<rounds;r++)for(let i=0;i<jobs.length;i++){const d=jobs[(i+r)%jobs.length];await enqueue(d.device,d.kind,d.desc,'warm',r);}return state.read();};
  state.present=()=>{if(state.pending||state.failed)return;update();if(state.waitingForLoader){state.waitingForLoader=false;globalThis.vmeshHideLoader?.(false);}globalThis.vmeshWorldFrame?.();};
})();
