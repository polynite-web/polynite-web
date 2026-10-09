"""Render a bounded set of new site tutorials in the existing Wake instance."""
import argparse,copy,hashlib,json,math,subprocess,time,urllib.request
from pathlib import Path
ROOT=Path(__file__).parent
P=argparse.ArgumentParser();P.add_argument('--revision',type=int,default=34);P.add_argument('--only');P.add_argument('--resolution',type=int,default=1080);P.add_argument('--draft',action='store_true');A=P.parse_args()
OUT=ROOT/f'docs/media/tutorials/r{A.revision}';OUT.mkdir(parents=True,exist_ok=True)
REPORT=Path(f'D:/dev/mcp-production-dry-run/tutorial-library-r{A.revision}');REPORT.mkdir(parents=True,exist_ok=True)
def rpc(method,command,**kw):
 q={'jsonrpc':'2.0','id':1,'method':method,'params':{'request':{'command':command,**kw}}}
 r=json.load(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8790/mcp',json.dumps(q).encode(),{'Content-Type':'application/json'}),timeout=30))
 if 'error' in r:raise RuntimeError(r['error'])
 return r['result']
def film(command,**kw):return rpc('scene.cinematic',command,**kw)
refs=json.loads((ROOT/'public-site-src/tutorial-rendered.json').read_text());ref=next(x for x in refs if x['id']=='colourful-tower')
base=json.loads((ROOT/ref['media'].lstrip('/')/ref['scene']).read_text())['initial']
C=[[.1,.78,.9],[.91,.35,.61],[.95,.73,.2],[.33,.8,.49],[.58,.33,.85]]
def shape(kind,p,size,color,**kw):return {'t':kind,'p':p,'s':size,'c':color,'appearance':'instant',**kw}
def body(dynamic=True,**kw):
 return ({'motion':'dynamic','mass':.2,'friction':.65,'restitution':.16,'grabbable':True,'linear_velocity':[0,0,0],'angular_velocity':[0,0,0]} if dynamic else {'motion':'static','friction':.65,'restitution':.16})|kw
def document(name,geo,bodies=None,dist=4.5,pitch=24,yaw=30,target=1.1,end=4.5,seq=None):
 initial=copy.deepcopy(base);initial.update(geo=geo,scene_text=[],model_hidden=1,scene_only=1,cam_dist=dist,cam_yaw=math.radians(yaw),cam_pitch=math.radians(pitch),tgt_x=0,tgt_y=target,tgt_z=0,scene_radius=3,scene_body_radius=3,scene_cx=0,scene_cy=target,scene_cz=0,cr_enable=0,bd_enable=0,film_branding_mode=0,film_fade=0,film_audio_appear=.12,film_audio_air=.25,film_music_volume=0,film_output_volume=.65,film_sound_volume=.55)
 initial['physics']={'version':1,'enabled':bool(bodies),'gravity':[0,-9.81,0],'substeps':8 if bodies else 4,'bodies':bodies or {},'joints':{}}
 clips=[{'op':'camera','at':0,'dur':0,'dist':dist,'pitch':pitch,'yaw':yaw}]+(seq if seq is not None else [{'op':'orbit','at':0,'dur':end+1.7,'deg':24*(end+1.7)/end}])
 clips.append({'op':'hold','at':end,'dur':0,'end_film':True})
 return {'version':1,'model':'','title':name,'initial':initial,'seq':clips}
scenes={}
g={'cube':shape('cube',[-1,.4,0],[.75]*3,C[0]),'sphere':shape('sphere',[0,.4,0],[.75]*3,C[1]),'cone':shape('cone',[1,.5,0],[.8,1,.8],C[2])}
scenes['three-shapes']=document('Your first three shapes',g,end=4,seq=[{'op':'appear','at':0,'preset':'scene-build-v1'},{'op':'orbit','at':0,'dur':5.7,'deg':34}])
for v in g.values():v['appearance']='tech'
g={};b={}
for n in range(12):
 x=(n%3-1)*.7;y=.65+(n//3)*.75;z=(n%2-.5)*.55
 g[f'drop_{n}']=shape('sphere' if n%3==1 else 'cube',[x,y,z],[.45]*3,C[n%5]);b[f'drop_{n}']=body(restitution=.25 if n%3==1 else .12)
scenes['falling-blocks']=document('Let gravity do the work',g,b,dist=5.2,end=5,target=1.1,seq=[{'op':'freeze','at':0,'dur':.55,'ease':0},{'op':'orbit','at':0,'dur':6.7,'deg':28}])
g={f'sculpt_{n}':shape('cube',[(n%2-.5)*.65,.28+(n//2)*.57,0],[.55]*3,C[n%5]) for n in range(6)}
scenes['camera-reveal']=document('A closer look',g,dist=2.4,pitch=15,target=.85,end=4.8,seq=[{'op':'dolly','at':0,'dur':2.4,'by':1.8},{'op':'orbit','at':2.4,'dur':4.1,'deg':42}])
g= {'sculpture':shape('cube',[0,.65,0],[1.15]*3,C[1]),'top':shape('sphere',[0,1.45,0],[.6]*3,C[2])}
scenes['command-input']=document('A command comes to life',g,end=4.6,seq=[{'op':'text','preset':'command-input-v2','text':'Make it blue','at':.4},{'op':'create','id':'sculpture',**g['sculpture'],'c':C[0],'at':2.15,'dur':0},{'op':'create','id':'top',**g['top'],'c':C[0],'at':2.15,'dur':0},{'op':'orbit','at':0,'dur':6.3,'deg':24}])
scenes['ending-signature']=document('Make the ending yours',g,dist=3.8,end=2.8,seq=[{'op':'orbit','at':0,'dur':4.5,'deg':24}])
g={f'petal_{n}':shape('sphere',[math.cos(n*math.tau/8)*.8,.65,math.sin(n*math.tau/8)*.8],[.42,.65,.42],C[n%5]) for n in range(8)}
g['centre']=shape('sphere',[0,.65,0],[.8]*3,C[2])
scenes['record-mp4']=document('From scene to MP4',g,end=4.5,dist=4,seq=[{'op':'appear','at':0,'preset':'scene-build-v1'},{'op':'orbit','at':0,'dur':6.2,'deg':40}])
for v in g.values():v['appearance']='tech'
g={};b={}
for n in range(6):
 x=(n%3-1)*1.35;z=(n//3-.5)*1.6;h=1.1+(n%3)*.15
 trunk=f'trunk_{n}';crown=f'crown_{n}'
 g[trunk]=shape('cube',[x,h/2,z],[.25,h,.25],[.48,.31,.18]);g[crown]=shape('cube',[x,h+.3,z],[.9,.75,.9],[.23+.035*n,.57+.025*n,.37]);b[trunk]=body(False);b[crown]=body(False)
for n in range(20):
 k=f'rain_{n}';x=(n%5-2)*.59;z=(n%4-1.5)*.49;y=3.15+(n//5)*.65
 g[k]=shape('sphere' if n%2 else 'cube',[x,y,z],[.24]*3,C[n%5]);b[k]=body(restitution=.3)
scenes['forest-rain']=document('A forest under colourful rain',g,b,dist=8.2,pitch=25,target=1.5,end=5.5,seq=[{'op':'freeze','at':0,'dur':.5,'ease':0},{'op':'orbit','at':0,'dur':7.2,'deg':28}])
g={};b={}
for n in range(20):
 k=f'domino_{n}';g[k]=shape('cube',[(n-9.5)*.27,.45,0],[.12,.9,.38],C[n%5],r=[0,0,-.11 if n==0 else 0]);b[k]=body(restitution=.03,angular_velocity=[0,0,-2.0] if n==0 else [0,0,0])
scenes['domino-chain']=document('One push, a chain reaction',g,b,dist=6.5,pitch=24,yaw=15,target=.5,end=6,seq=[{'op':'freeze','at':0,'dur':.45,'ease':0},{'op':'orbit','at':0,'dur':7.7,'deg':10}])
if A.only:scenes={A.only:scenes[A.only]}
status=film('status');assert not status['playing'] and not status['export']['active'],'Finish current film first'
assert status['branding'].get('signature_layout_supported') and 'command-input-v2' in status['branding']['title_presets'],'Updated presets required'
original=film('document');paused=rpc('scene.physics','status')['paused'];(REPORT/'original.scene.json').write_text(json.dumps(original));results=[];prior_results=json.loads((REPORT/'report.json').read_text()) if (REPORT/'report.json').exists() else []
try:
 for name,doc in scenes.items():
  if (OUT/(name+'.mp4')).exists():
   prior=next((r for r in prior_results if r['id']==name),None)
   if not prior or not (OUT/(name+'-preview.mp4')).exists():raise RuntimeError('Use a new revision for '+name)
   results.append(prior);continue
  print('Loading',name,flush=True);film('load_document',document=doc,start_paused=True)
  film('set_branding',preset='polynite-ending-v4',layout='short-portrait' if name=='ending-signature' else 'default',**({'volume':.5} if name=='ending-signature' else {}))
  resolved=film('document');resolved.pop('export',None)
  raw=json.dumps(resolved,separators=(',',':')).encode();scene=name+'-'+hashlib.sha256(raw).hexdigest()[:12]+'.scene';(OUT/scene).write_bytes(raw)
  for c in resolved['seq']:
   if c.get('preset')=='command-input-v2':print('Command timing',c,flush=True)
  fmt='portrait' if name=='ending-signature' else 'landscape'
  until=time.monotonic()+25
  while True:
   try:film('record',directory=str(REPORT),name=name,format=fmt,resolution=A.resolution,quality=2,encoder=1,fps=60,watermark=1,thumbnails=0);break
   except RuntimeError as e:
    if 'wait for the model to load' not in str(e) or time.monotonic()>until:raise
    time.sleep(.25)
  until=time.monotonic()+240
  while film('status')['export']['active']:
   if time.monotonic()>until:raise RuntimeError('Export timeout')
   time.sleep(.3)
  result=film('status')['export'];assert result['completed'],result
  movie=OUT/(name+'.mp4');movie.write_bytes(Path(result['files'][0]).read_bytes())
  compressed=OUT/(name+'-web.mp4')
  subprocess.run(['ffmpeg','-v','error','-y','-i',str(movie),'-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',str(compressed)],check=True)
  assert compressed.stat().st_size<26214400,'Video exceeds Pages asset limit'
  compressed.replace(movie)
  subprocess.run(['ffmpeg','-v','error','-i',str(movie),'-f','null','-'],check=True)
  at=3.1 if name=='ending-signature' else .95 if name=='command-input' else .85
  subprocess.run(['ffmpeg','-v','error','-y','-ss',str(at),'-i',str(movie),'-frames:v','1',str(OUT/(name+'.jpg'))],check=True)
  subprocess.run(['ffmpeg','-v','error','-y','-ss','0.25','-i',str(movie),'-t','2.5','-vf','scale=480:-2,fps=30','-an','-c:v','libx264','-preset','fast','-crf','26','-movflags','+faststart',str(OUT/(name+'-preview.mp4'))],check=True)
  result_meta={'id':name,'revision':A.revision,'media':f'/docs/media/tutorials/r{A.revision}/','scene':scene,'video':movie.name}
  results.append(result_meta);(REPORT/'report.json').write_text(json.dumps(results,indent=2));print('Rendered',name,'bytes',movie.stat().st_size,flush=True)
finally:
 if film('status')['export']['active']:film('cancel')
 film('load_document',document=original,start_paused=bool(paused))
 restored=film('document');assert restored['model']==original['model'],'Original document restore failed'
if not A.draft:
 updates={r['id']:r for r in results};refs=[updates.pop(r['id'],r) for r in refs]+list(updates.values());(ROOT/'public-site-src/tutorial-rendered.json').write_bytes((json.dumps(refs,indent=2)+'\n').encode())
print('PASS: real native renders decoded; original scene restored',flush=True)
