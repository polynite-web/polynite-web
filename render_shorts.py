"""Build reusable explosion variants and render through the user's existing native engine."""
import argparse,copy,hashlib,json,subprocess,time,urllib.request
from pathlib import Path
ROOT=Path(__file__).parent
P=argparse.ArgumentParser();P.add_argument('--proof',action='store_true');P.add_argument('--publish-doc',action='store_true');P.add_argument('--format',choices=['both','portrait','landscape'],default='both');P.add_argument('--suffix',default='',help='Optional filename suffix when an existing master is open');A=P.parse_args()
OUT=ROOT/'shorts/make-it-explode';OUT.mkdir(parents=True,exist_ok=True)
REPORT=Path('D:/dev/mcp-production-dry-run/short-make-it-explode');REPORT.mkdir(parents=True,exist_ok=True)
def rpc(method,command,**kw):
 q={'jsonrpc':'2.0','id':1,'method':method,'params':{'request':{'command':command,**kw}}}
 r=json.load(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8790/mcp',json.dumps(q).encode(),{'Content-Type':'application/json'}),timeout=30))
 if 'error' in r:raise RuntimeError(r['error'])
 return r['result']
def film(cmd,**kw):return rpc('scene.cinematic',cmd,**kw)
source=json.loads((OUT/'explosion-master.scene').read_text())
base={k:copy.deepcopy(source[k]) for k in ['version','model','initial','seq']}
base['seq']=[c for c in base['seq'] if not c.get('branding_slot')]
for c in base['seq']:
 if c.get('preset') in ('explosion-sound-v1','explosion-sound-v2'):
  c['preset']='explosion-sound-v2';c.pop('play',None)
base['initial']['scene_text']=[]
base['initial'].update(film_branding_mode=0,film_fade=0)
# All variants derive from this one authored master; no repeated effect settings.
def variant(offset,command=False):
 doc=copy.deepcopy(base)
 for g in doc['initial']['geo'].values():
  if g.get('t'):g['appearance']='tech' if offset else 'instant'
 for c in doc['seq']:
  if c['op']=='camera':continue
  c['at']=c.get('at',0)+offset
  if c['op']=='freeze' and c['at']==offset:c.update(at=0,dur=c['dur']+offset)
 if offset:doc['seq'].insert(1,{'op':'appear','at':0,'preset':'scene-build-v1'})
 if command:doc['seq'].append({'op':'text','text':'Make it explode','at':1.2,'preset':'command-input-v1'})
 doc['title']='Make it explode' if command else 'A burst of colour'
 return doc
variants={'short':variant(2.85,True),'tutorial':variant(1.85),'preview':variant(0)}
(OUT/'explosion-master.scene').write_text(json.dumps(base,indent=2))
for name,doc in variants.items():(OUT/(name+'.scene')).write_text(json.dumps(doc,indent=2))
original=film('document');physics=rpc('scene.physics','status');status=film('status')
assert not status['playing'] and not status['export']['active'],'Finish current playback/export first'
assert not rpc('scene.interaction','status')['held'],'Finish current gesture first'
(REPORT/'original.scene.json').write_text(json.dumps(original))
report=[]
try:
 jobs=[('short','portrait',720 if A.proof else 2160),('short','landscape',720 if A.proof else 2160)]
 jobs=[job for job in jobs if A.format=='both' or job[1]==A.format]
 if A.publish_doc:jobs.extend([('tutorial','landscape',1080),('preview','landscape',720)])
 for name,fmt,res in jobs:
  doc=copy.deepcopy(variants[name])
  if name=='short' and fmt=='landscape':
   doc['initial']['cam_dist']=2.8
   for c in doc['seq']:
    if c['op']=='camera':c['dist']=2.8
  if name=='short':(OUT/(fmt+'.scene')).write_text(json.dumps(doc,indent=2))
  film('load_document',document=doc,start_paused=True)
  film('set_branding',preset='polynite-ending-v3')
  resolved=film('document');resolved.pop('export',None)
  (OUT/(name+'-'+fmt+'-resolved.scene')).write_text(json.dumps(resolved,indent=2))
  ready=time.monotonic()+20
  while True:
   try:film('record',directory=str(REPORT),name=name+('-proof' if A.proof else '-master'),format=fmt,resolution=res,quality=2,fps=60,watermark=1,thumbnails=0,encoder=1);break
   except RuntimeError as e:
    if 'wait for the model to load' not in str(e) or time.monotonic()>ready:raise
    time.sleep(.25)
  until=time.monotonic()+900
  while film('status')['export']['active']:
   assert time.monotonic()<until,'Export timeout';time.sleep(.5)
  result=film('status')['export'];assert result['completed'],result
  for f in result['files']:
   src=Path(f);orientation='portrait' if '.9x16.' in src.name else 'landscape'
   dest=OUT/(name+('-proof' if A.proof else '')+'-'+orientation+('-'+A.suffix if A.suffix else '')+'.mp4');dest.write_bytes(src.read_bytes())
   # Preserve maximum-quality video; master the summed impact peaks with headroom.
   mastered=dest.with_name(dest.stem+'-audio.mp4')
   subprocess.run(['ffmpeg','-v','error','-y','-i',str(dest),'-c:v','copy','-af','alimiter=limit=0.79:level=false:latency=true','-c:a','aac','-b:a','320k','-movflags','+faststart',str(mastered)],check=True)
   mastered.replace(dest)
   subprocess.run(['ffmpeg','-v','error','-i',str(dest),'-f','null','-'],check=True)
   info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(dest)]))
   for t,label in [(1,'build'),(2.1,'prompt'),(3.3,'title'),(4.1,'impact'),(8.3,'signature')] if name=='short' else [(2.2,'title'),(4.4,'impact')]:
    subprocess.run(['ffmpeg','-v','error','-y','-ss',str(t),'-i',str(dest),'-frames:v','1','-vf','scale=960:-2',str(REPORT/(name+'-'+orientation+'-'+label+'.jpg'))],check=True)
   if name=='short':subprocess.run(['ffmpeg','-v','error','-y','-ss','2.4','-i',str(dest),'-frames:v','1',str(OUT/('short-'+orientation+'-cover.jpg'))],check=True)
   report.append({'variant':name,'orientation':orientation,'path':str(dest),'info':info})
  print('Rendered',name,res,flush=True)
finally:
 if film('status')['export']['active']:film('cancel')
 film('load_document',document=original,start_paused=bool(physics['paused']))
 restored=film('document')
 assert restored['model']==original['model'],'Scene restore mismatch'
 assert {k:v for k,v in restored['initial']['geo'].items() if k!='model'}=={k:v for k,v in original['initial']['geo'].items() if k!='model'},'Geometry restore mismatch'
 assert restored['seq']==original['seq'],'Timeline restore mismatch'
 print('Original scene restored',flush=True)
(REPORT/('proof-report.json' if A.proof else 'master-report.json')).write_text(json.dumps(report,indent=2))
