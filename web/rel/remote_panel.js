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
  /* //cld the relay chosen in Advanced options is kept for the next visit (an address only, no credential);
     Allow control stays a click each time - the relay never reconnects by itself */
  const SERVER_KEY='polynite.mcp.relay';
  try{const kept=win.localStorage?.getItem(SERVER_KEY);if(kept&&/^https?:\/\/[^\s]{1,240}$/.test(kept))server=kept;}catch{}
  /* //cld the address an AI adds as its MCP connector (the gateway's root; polynite-auth mcp_gateway.js) */
  /* //cld it follows the relay in use: api-staging -> mcp-staging, api -> mcp, the local relay -> the local MCP */
  const mcpAddressFor=s=>{try{const u=new URL(s);
    if(u.hostname==='api-staging.polynite.io')return 'https://mcp-staging.polynite.io';
    if(u.hostname==='api.polynite.io'||u.hostname==='polynite.io')return 'https://mcp.polynite.io';
    if(['localhost','127.0.0.1'].includes(u.hostname))return 'http://localhost:8793';}catch{}
    return local?'http://localhost:8793':'https://mcp.polynite.io';};
  const mcpAddress=()=>win.__pnMcpOrigin||mcpAddressFor(server);
  let relay=null,session=null,working=false,disposed=false,state='off',proof='';
  let message='Sign in using Account at the top right, then allow control here.';
  let openRequested=false;
  /* //cld WHAT THE AI DID: the last calls, in plain words, newest first - seen in the panel (field 5) */
  const activity=[];let calls=0;
  const plain={'scene.describe':'read the scene','scene.capture':'looked at the view','scene.capabilities':'read what it can do'};
  function logCall(rpc,res){
    const q=rpc?.params?.request||rpc?.params||{},m=String(rpc?.method||'?');
    let s=plain[m]||m.replace(/^scene\./,'');
    const name0=typeof (q.label??q.id)==='string'?String(q.label??q.id).slice(0,32):'';
    if(m==='scene.ui'&&q.command==='click'&&q.target==='generator_bar')s='pressed "'+name0+'"'+(typeof q.generator==='string'?' ('+q.generator+')':'');
    else if(m==='scene.ui'&&q.command==='click'&&q.target==='row')s='opened "'+name0+'"';
    else if(!plain[m]){if(typeof q.command==='string')s+=' '+q.command;if(typeof q.target==='string')s+=' '+q.target;
      const name=q.label??q.id;if(typeof name==='string'&&name)s+=' "'+name.slice(0,32)+'"';
      const acts=rpc?.params?.actions??q.actions;if(Array.isArray(acts))s+=' ('+acts.length+(acts.length===1?' action)':' actions)');}
    const err=res?.error?.message;
    calls++;activity.unshift({at:Date.now(),text:s.slice(0,72),err:typeof err==='string'?err.slice(0,90):''});
    if(activity.length>8)activity.length=8;
  }
  function activityText(){
    if(!activity.length)return '';
    const ago=t=>{const s=Math.max(0,Math.round((Date.now()-t)/1000));return s<60?s+'s':Math.round(s/60)+'m';};
    return calls+(calls===1?' call':' calls')+' so far:\n'+activity.map(a=>ago(a.at)+'  '+a.text+(a.err?'\n      refused: '+a.err:'')).join('\n');
  }
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
      relay=createRemoteRelay({api:server,rpc:t=>win.polynite.rpc(t),fetcher,executed:logCall,changed:s=>{if(!disposed)paint(s.state,s.error&&explain(s.error));}});
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
    read(field){if(field===0)return message;if(field===1)return server;if(field===2)return session?.session_id||'';if(field===3)return proof;if(field===4)return mcpAddress();if(field===5)return activityText();return '';},
    takeOpen(){const requested=openRequested;openRequested=false;return requested;},
    async action(command,value){
      if(disposed)return;
      if(command===0)return connect();
      if(command===1)return stop();
      if(command===2)return check();
      if(command===3&&session){try{await win.navigator.clipboard.writeText(session.session_id);proof='Session ID copied. No credentials included.';}catch{proof='Could not copy. Select the ID in Advanced options.';}}
      if(command===6){const a=doc.createElement('a');a.href='polynite-skill.md';a.download='SKILL.md';doc.body.append(a);a.click();a.remove();proof='The Polynite skill was saved as SKILL.md: add it to your AI app skills (Claude: a folder named polynite with this file).';}   //cld the skill, for an AI app
      if(command===5){try{await win.navigator.clipboard.writeText(mcpAddress());proof='Address copied: paste it in your AI as a custom connector.';}catch{proof='Could not copy: the address is '+mcpAddress();}}   //cld step 1
      if(command===4&&!working&&state!=='connected'&&typeof value==='string'&&value.length<256){server=value;try{if(/^https?:\/\/[^\s]{1,240}$/.test(value))win.localStorage?.setItem(SERVER_KEY,value);else win.localStorage?.removeItem(SERVER_KEY);}catch{}}
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
