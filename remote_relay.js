/* Opt-in authenticated relay. No saved credential, automatic reconnection or
   mutation retry. Engine RPC must be installed before start(). */
export function createRemoteRelay({api, rpc, fetcher=fetch, changed=()=>{}, now=()=>performance.now()}){
  const base=new URL(api);if(!['http:','https:'].includes(base.protocol)||base.username||base.password)throw new Error('invalid API origin');
  if(base.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw new Error('HTTPS required outside localhost');
  let session=null,abort=null,running=false,starting=false,loop=null,ownsGrab=false,startDone=null,clockStart=0;
  // Anchor to the server timestamp using a monotonic clock; device clock skew
  // cannot keep an expired command alive. Starting before fetch is conservative.
  const serverNow=()=>session.issued_at+Math.max(0,now()-clockStart);
  const emit=(state,error)=>changed({state,error,session_id:session?.session_id||null});
  async function post(route,body,signal){
    const r=await fetcher(new URL('/api/remote/'+route,base),{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
    if(r.status===204)return null;
    if(!r.ok)throw new Error(`remote HTTP ${r.status}`);
    return r.json();
  }
  const call=async(method)=>{const r=await rpc(JSON.stringify({jsonrpc:'2.0',id:0,method,params:['scene.cinematic','scene.interaction'].includes(method)?{request:{command:'status'}}:{}}));if(!r?.result)throw new Error('engine RPC unavailable');return r.result;};
  async function listen(){
    const seen=new Set();
    try{
      while(running){
        const d=await call('scene.describe'),f=await call('scene.cinematic'),i=await call('scene.interaction');
        const s=d.sound;if(!s)throw new Error('engine sound status missing');
        const envelope=await post(session.session_id+'/pull',{browser_key:session.browser_key,context:{samples:s.samples||[],audio_live:!!s.live,muted:!!s.muted,loading_cut:!!s.loading_cut,music_on:!!s.musical?.music_on,busy:!!f.export?.active||!!f.playing||!!i.held}},abort.signal);
        if(!running||!envelope)continue;
        if(!envelope.command_id||seen.has(envelope.command_id))throw new Error('duplicate command');
        seen.add(envelope.command_id);if(seen.size>512)throw new Error('session command limit reached');
        let response;
        if(serverNow()>=envelope.expires_at)response={jsonrpc:'2.0',id:envelope.rpc.id,error:{code:-32000,message:'expired before execution'}};
        else{
          const fresh=await call('scene.cinematic'),grab=await call('scene.interaction');
          if(!running||serverNow()>=envelope.expires_at||fresh.export?.active||fresh.playing||(grab.held&&envelope.rpc.method!=='scene.interaction'))response={jsonrpc:'2.0',id:envelope.rpc.id,error:{code:-32000,message:'scene busy, disconnected or expired; no execution'}};
          else{
            response=await rpc(JSON.stringify(envelope.rpc));
            if(envelope.rpc.method==='scene.interaction'&&!response?.error){
              const command=envelope.rpc.params.request.command;
              if(command==='grab'&&response.result?.held)ownsGrab=true;
              if(['release','cancel'].includes(command))ownsGrab=false;
            }
          }
        }
        // An answer delivery failure is terminal, even if the engine succeeded.
        await post(session.session_id+'/answer',{browser_key:session.browser_key,command_id:envelope.command_id,response},abort.signal);
      }
    }catch(e){if(running){running=false;emit('disconnected',e.message);}}
    finally{
      if(ownsGrab){ownsGrab=false;await rpc(JSON.stringify({jsonrpc:'2.0',id:0,method:'scene.interaction',params:{request:{command:'cancel'}}}));}
      if(!running&&session&&!abort.signal.aborted){try{await post(session.session_id+'/close',{browser_key:session.browser_key});}catch{}}
    }
  }
  return {
    async start(){if(running||session||starting)throw new Error('relay already started; stop first');
      if(globalThis.__pnRelay?.on||globalThis.__pnRelay?.want)throw new Error('turn off the legacy Build agent before connecting');
      starting=true;abort=new AbortController();let settle;startDone=new Promise(r=>{settle=r;});
      try{await call('scene.describe');clockStart=now();session=await post('session',{},abort.signal);if(!Number.isFinite(session.issued_at))throw new Error('server timestamp required');if(abort.signal.aborted)throw new Error('start cancelled');running=true;emit('connected');loop=listen();return {session_id:session.session_id,expires_at:session.expires_at};}finally{starting=false;settle();}},
    async stop(){abort?.abort();if(starting)await startDone;running=false;await loop;
      try{if(session)await post(session.session_id+'/close',{browser_key:session.browser_key});}catch(e){emit('off',e.message);}finally{session=null;emit('off');}},
    status(){return {state:running?'connected':'off',session_id:session?.session_id||null};},
  };
}
if(typeof window!=='undefined')window.createPolyniteRemoteRelay=createRemoteRelay;
