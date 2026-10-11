/* Local scene imports use the public engine document loader, never model intake. */
(function(){
  let importing=false,noticeTimer;
  const isScene=file=>file&&/\.scene$/i.test(file.name||'');
  function notice(message){
    let box=document.getElementById('scene-file-notice');
    if(!box){box=document.createElement('div');box.id='scene-file-notice';box.setAttribute('role','status');box.style.cssText='position:fixed;bottom:20px;left:20px;z-index:10000;max-width:420px;padding:10px 14px;border:1px solid #354557;border-radius:8px;background:#101720ee;color:#e8eef7;font:13px/1.5 system-ui;pointer-events:none';document.body.append(box);}
    clearTimeout(noticeTimer);box.textContent=message;box.hidden=false;noticeTimer=setTimeout(()=>box.hidden=true,6500);
  }
  async function open(file){
    if(importing){notice('A scene is already being opened.');return;}
    importing=true;
    try{
      if(file.size>8*1024*1024)throw Error('Scene file is too large.');
      const document=JSON.parse(await file.text());
      if(document.version!==1||!document.initial||typeof document.initial!=='object'||Array.isArray(document.initial)||!Array.isArray(document.seq))throw Error('A .scene needs version 1, initial and seq.');
      const engine=window.polynite;if(!engine?.call)throw Error('Wait for Polynite to finish loading, then drop the scene again.');
      const film=engine.call('scene.cinematic',{request:{command:'status'}});
      if(film.export?.active)throw Error('Finish recording before opening another scene.');
      try{const interaction=engine.call('scene.interaction',{request:{command:'status'}});if(interaction.held||interaction.editor_interaction?.busy)throw Error('Finish the active gesture before opening another scene.');}catch(error){if(/Finish/.test(error.message))throw error;}
      engine.call('scene.cinematic',{request:{command:'load_document',document,start_paused:true}});
      window.dispatchEvent(new CustomEvent('polynite:scene-file-opened',{detail:{name:file.name}}));
      notice('Scene opened — Play to start.');
    }catch(error){notice('Could not open scene: '+error.message);}
    finally{importing=false;}
  }
  window.addEventListener('dragover',event=>{if(event.dataTransfer?.types?.includes('Files'))event.preventDefault();},true);
  window.addEventListener('drop',event=>{
    const file=event.dataTransfer?.files?.[0];if(!isScene(file))return;
    event.preventDefault();event.stopImmediatePropagation();open(file);
  },true);
  window.addEventListener('change',event=>{
    const file=event.target?.files?.[0];if(!isScene(file))return;
    event.stopImmediatePropagation();open(file);
  },true);
})();
