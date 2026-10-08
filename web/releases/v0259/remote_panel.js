/* Native HUD controller. Only the connected badge lives in the DOM;
   settings, input, scroll and dismissal belong to the regular canvas HUD. */
import {createRemoteRelay} from './remote_relay.js';
export function installRemotePanel({doc=document,win=window,fetcher=fetch}={}){
  if(doc.getElementById('pn-remote-control'))return;
  const host=doc.createElement('div');host.id='pn-remote-control';host.hidden=true;
  const root=host.attachShadow({mode:'open'});
  root.innerHTML=`<style>
    :host{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));z-index:10001}
    :host([hidden]){display:none}button{font:11px/1.5 system-ui;color:#b7dfcb;background:#18212de6;border:1px solid #7da993;border-radius:8px;min-height:32px;padding:4px 9px;cursor:pointer;touch-action:manipulation}
    @media(pointer:coarse){button{min-height:44px}}
  </style><button id="open" title="Open MCP connection settings in Studio">MCP connected</button>`;
  doc.body.append(host);
  const local=['localhost','127.0.0.1','[::1]'].includes(win.location.hostname);
  let server=local?'http://localhost:8792':(win.__pnApiBase||win.location.origin);
  let relay=null,session=null,working=false,disposed=false,state='off',proof='';
  let message='Sign in using Account at the top right, then allow control here.';
  let openRequested=false;
  function paint(next,error){
    state=next;
    message=error||({connected:'Connected - this scene is available for control.',off:'Off - no remote control.',disconnected:'Disconnected - reconnect manually.'}[next]||'Connecting...');
    host.hidden=disposed||!!win.vmeshStudio||state!=='connected';
  }
  const explain=e=>/HTTP 401/.test(e)||e==='sign in first'
    ? 'The relay at '+server+' has no usable sign-in session. Sign in on that relay, then allow control again. Account may be connected to a different server. From localhost, browser privacy settings can also block relay cookies.' : e;
  async function connect(){
    if(working||state==='connected')return;
    working=true;proof='';paint('connecting');
    try{
      if(!win.polynite?.rpc)throw new Error('Wait for the scene to finish loading.');
      if(relay)await relay.stop();
      relay=createRemoteRelay({api:server,rpc:t=>win.polynite.rpc(t),fetcher,changed:s=>{if(!disposed)paint(s.state,s.error&&explain(s.error));}});
      session=await relay.start();
    }catch(e){try{await relay?.stop();}catch{}session=null;paint('off',explain(e.message));}
    finally{working=false;}
  }
  async function stop(){
    if(working)return;working=true;
    try{await relay?.stop();}finally{working=false;session=null;paint('off');}
  }
  async function check(){
    if(working||state!=='connected'||!session)return;
    working=true;proof='Checking the connection...';
    try{
      const r=await fetcher(new URL('/api/remote/'+session.session_id+'/command',server),{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({jsonrpc:'2.0',id:'panel-'+win.crypto.randomUUID(),method:'scene.describe',params:{}}),signal:AbortSignal.timeout(18000)});
      const out=await r.json();if(!r.ok||out.error||!Array.isArray(out.result?.objects)||!out.result.camera)throw new Error(out.error?.message||out.error||`Unexpected scene response (HTTP ${r.status})`);
      proof=`Round trip verified: ${out.result.objects.length} scene objects. Read only; nothing changed.`;
    }catch(e){proof='Check failed: '+explain(e.message);}
    finally{working=false;}
  }
  const studioChanged=()=>{host.hidden=disposed||!!win.vmeshStudio||state!=='connected';};
  const hud={
    get state(){return (state==='connected'?1:0)|(working?2:0);},
    read(field){if(field===0)return message;if(field===1)return server;if(field===2)return session?.session_id||'';if(field===3)return proof;return '';},
    takeOpen(){const requested=openRequested;openRequested=false;return requested;},
    async action(command,value){
      if(disposed)return;
      if(command===0)return connect();
      if(command===1)return stop();
      if(command===2)return check();
      if(command===3&&session){try{await win.navigator.clipboard.writeText(session.session_id);proof='Session ID copied. No credentials included.';}catch{proof='Could not copy. Select the ID in Advanced options.';}}
      if(command===4&&!working&&state!=='connected'&&typeof value==='string'&&value.length<256)server=value;
    },
  };
  win.polyniteMCPHUD=hud;
  root.getElementById('open').onclick=()=>{
    if(win.vmeshStudioSet)win.vmeshStudioSet(true);
    openRequested=true;studioChanged();
  };
  win.addEventListener('polynite:studio-changed',studioChanged);
  return {async dispose(){disposed=true;if(win.polyniteMCPHUD===hud)delete win.polyniteMCPHUD;win.removeEventListener('polynite:studio-changed',studioChanged);await relay?.stop();host.remove();}};
}
if(typeof window!=='undefined')installRemotePanel();
