"""Render synthetic tutorial scenes through real native MCP; always restore user state."""
import copy,json,time,urllib.request,subprocess,hashlib,argparse
from pathlib import Path
ROOT=Path(__file__).parent
parser=argparse.ArgumentParser();parser.add_argument('--endpoint',default='http://127.0.0.1:8790/mcp');parser.add_argument('--only',choices=['block-explosion','colourful-tower','orbiting-letters']);parser.add_argument('--revision',type=int,default=1);parser.add_argument('--replace-draft',action='store_true');args=parser.parse_args();assert args.revision>=1
OUT=ROOT/f'docs/media/tutorials/r{args.revision}'
if any(OUT.glob('*.mp4')) and not args.replace_draft:raise SystemExit('Choose a new --revision for published media; --replace-draft is only for unpublished drafts')
OUT.mkdir(parents=True,exist_ok=True)
REPORT=Path(f'D:/dev/mcp-production-dry-run/tutorials-r{args.revision}')
REPORT.mkdir(parents=True,exist_ok=True)
def rpc(method,command,**kwargs):
    req={'jsonrpc':'2.0','id':1,'method':method,'params':{'request':{'command':command,**kwargs}}}
    r=urllib.request.Request(args.endpoint,data=json.dumps(req).encode(),headers={'Content-Type':'application/json'})
    answer=json.load(urllib.request.urlopen(r,timeout=25))
    if 'error' in answer:raise RuntimeError(answer['error'])
    return answer['result']
def film(command,**kwargs):return rpc('scene.cinematic',command,**kwargs)
def signature(seq,end):
    # Dedicated tags allow installers to replace their own clips without touching content.
    # Keep the last camera move running through the closing segment. The cut
    # anchors the content end, otherwise the longer move would push the logo later.
    for clip in reversed(seq):
      if clip['op']=='orbit' and abs(clip.get('at',0)+clip['dur']-end)<.001:
        old_duration=clip['dur'];clip['dur']+=1.1
        clip['deg']*=clip['dur']/old_duration
        break
    seq.append({'op':'hold','at':end,'dur':0,'end_film':True})

def title(text,dur=2):return {'op':'text','text':text,'mode':'screen','box':[.12,.12,.76,.16],'at':0,'dur':dur,'in':dur*.56,'out':dur*.44,'fx':'type','thickness':.035,'glow':.025,'color':[.9,.98,1,1]}
references=json.loads((ROOT/'public-site-src/tutorial-rendered.json').read_text());reference=next(r for r in references if r['id']=='block-explosion');base=json.loads((ROOT/reference.get('media','/docs/media/tutorials/r1/').lstrip('/')/reference['scene']).read_text())
initial=copy.deepcopy(base['initial'])
initial.update(model_hidden=1,scene_only=1,scene_text=[],cr_enable=0,bd_enable=0,film_output_volume=.65,film_sound_volume=.55,film_branding_mode=0,film_audio_appear=.15,film_music_volume=0,film_sounds_fade_at=-1,film_fade=0,cam_yaw=.55,cam_pitch=.5,cam_dist=6,tgt_x=0,tgt_y=1,tgt_z=0,floor_mirror=.12,bg={'r':.015,'g':.02,'b':.03,'a':1},sky_on=0,star_on=0,cloud_on=0,fog_density=0)
palette=[[.12,.8,.9],[.9,.4,.65],[.95,.72,.22]]
geo={}
for y in range(7):
 for x in range(2):
  for z in range(2):geo[f'tower_{y}_{x}_{z}']={'t':'cube','p':[(x-.5)*.44,.22+y*.44,(z-.5)*.44],'s':[.42]*3,'c':palette[y%3],'appearance':'instant'}
tower=copy.deepcopy(initial);tower.update(geo=geo,physics={'version':1,'enabled':False,'gravity':[0,-9.81,0],'substeps':4,'bodies':{}},scene_radius=2,scene_body_radius=2,scene_cx=0,scene_cy=1.5,scene_cz=0,tgt_y=1.5)
seq=[{'op':'camera','at':0,'dur':0,'dist':6,'pitch':22,'yaw':30},{'op':'orbit','at':0,'dur':3.5,'deg':28},title('BUILD SOMETHING')];signature(seq,3.5)
scenes=[('colourful-tower',{'version':1,'model':'','initial':tower,'seq':seq})]
burst=copy.deepcopy(initial);burst.update(geo=base['initial']['geo'],physics=base['initial']['physics'],cam_dist=4.2,cam_yaw=30*.017453292,cam_pitch=28*.017453292,tgt_x=0,tgt_y=1,tgt_z=0)
blast_title={'op':'text','id':'explode-title','text':'EXPLODE','at':0,'preset':'dramatic-title-v5'}
# The engine resolves this release from the full glyph geometry.
seq=[{'op':'camera','at':0,'dur':0,'dist':4.2,'pitch':28,'yaw':30},
     {'op':'freeze','at':0,'preset':'dramatic-reveal-v1','release_text':'explode-title'},
     {'op':'dolly','at':0,'preset':'dramatic-pullback-v1','release_text':'explode-title'},blast_title]
scenes.append(('block-explosion',{'version':1,'model':'','initial':burst,'seq':seq}))
letters=copy.deepcopy(tower);letters.update(geo={'anchor':{'t':'sphere','p':[0,1,0],'s':[.7]*3,'c':[.1,.7,.8],'appearance':'instant'}},cam_dist=4,tgt_y=1,scene_radius=1.8,scene_cy=1,scene_text=[{'id':'ring','text':'CREATE / VIEW / SHARE','layout':'ring','mode':'ring','anchor':'world','p':[0,1,0],'radius':1.3,'size':.15,'height':0,'angle':90,'rotate_speed':35,'camera_follow':0,'color':[1,.8,.2,1],'glow':.03,'enabled':True}])
letters['scene_text'][0].update(style='title',appearance='none',height=.5,size=.26,camera_follow=1,angle=0,thickness=.018)
seq=[{'op':'camera','at':0,'dur':0,'dist':4,'pitch':15,'yaw':30},{'op':'orbit','at':0,'dur':4,'deg':13.333333}];signature(seq,4)
scenes.append(('orbiting-letters',{'version':1,'model':'','initial':letters,'seq':seq}))
if args.only:scenes=[item for item in scenes if item[0]==args.only]
status=film('status');assert status.get('branding',{}).get('outro_tail_supported'),'Reload the updated native engine before rendering the black outro'
assert status.get('branding',{}).get('text_exit_sync_supported'),'Reload the updated native spatial text engine'
physics=rpc('scene.physics','status')
assert not status['playing'] and not status['export']['active']
assert not physics['body_count'] or physics['paused'],'Pause physics before rendering'
assert not rpc('scene.interaction','status')['held'] and not rpc('scene.physics_test','status')['active']
original=film('document');(REPORT/'original.scene.json').write_text(json.dumps(original))
report=[]
try:
 for name,document in scenes:
  document['title']=name.replace('-',' ').title()
  film('load_document',document=document,start_paused=True)
  if name=='block-explosion':
   resolved=film('document')
   blast_at=next(c['dur'] for c in resolved['seq'] if c['op']=='freeze')
   freeze_at=blast_at+.55;resume_at=freeze_at+1.8
   document['seq'].extend([
     {'op':'dolly','at':blast_at,'preset':'dramatic-impact-v1'},
     {'op':'freeze','at':freeze_at,'dur':1.8,'ease':.18},
     {'op':'orbit','at':blast_at,'dur':resume_at-blast_at,'deg':55},
     {'op':'orbit','at':resume_at,'dur':5.2-resume_at,'deg':18}])
   signature(document['seq'],5.2)
   film('load_document',document=document,start_paused=True)
   print('Spatial release:',round(blast_at,4),'seconds',flush=True)
  film('set_branding',preset='polynite-ending-v2')
  document=film('document')
  raw=json.dumps(document,separators=(',',':')).encode();scene_name=name+'-'+hashlib.sha256(raw).hexdigest()[:12]+'.scene'
  (OUT/scene_name).write_bytes(raw)
  ready_until=time.monotonic()+20
  while True:
   try:
    film('record',directory=str(REPORT),name=name,format='landscape',resolution=720,fps=60,watermark=1,thumbnails=0)
    break
   except RuntimeError as error:
    if 'wait for the model to load' not in str(error) or time.monotonic()>ready_until:raise
    time.sleep(.25)
  until=time.monotonic()+100
  while film('status')['export']['active']:
   assert time.monotonic()<until,'export timeout';time.sleep(.25)
  result=film('status')['export'];assert result['completed'],result
  movie=Path(result['files'][0]);dest=OUT/(name+'.mp4');dest.write_bytes(movie.read_bytes())
  subprocess.run(['ffmpeg','-v','error','-i',str(dest),'-f','null','-'],check=True)
  at=2.6 if name=='block-explosion' else 1
  subprocess.run(['ffmpeg','-v','error','-y','-ss',str(at),'-i',str(dest),'-frames:v','1',str(OUT/(name+'.jpg'))],check=True)
  preview_at=.8 if name=='block-explosion' else .6 if name=='orbiting-letters' else .4
  subprocess.run(['ffmpeg','-v','error','-y','-ss',str(preview_at),'-i',str(dest),'-t','2','-vf','scale=480:-2,fps=30','-an','-c:v','libx264','-preset','fast','-crf','28','-movflags','+faststart',str(OUT/(name+'-preview.mp4'))],check=True)
  report.append({'id':name,'revision':args.revision,'media':f'/docs/media/tutorials/r{args.revision}/','scene':scene_name,'video':dest.name,'bytes':dest.stat().st_size,'export':result})
  print('Rendered',name,flush=True)
finally:
 if film('status')['export']['active']:film('cancel')
 film('load_document',document=original,start_paused=bool(physics['paused']))
 restored=film('document')
 # An unloaded model may have a hidden editor placeholder; load_document
 # legitimately drops that non-rendering entry. All real geometry must match.
 def restored_geometry(doc):
  geo=copy.deepcopy(doc['initial']['geo'])
  placeholder=geo.get('model',{})
  if not doc['model'] and placeholder.get('t')=='model' and placeholder.get('sh') is False:geo.pop('model')
  return geo
 assert restored['model']==original['model'] and restored_geometry(restored)==restored_geometry(original),'Restore mismatch'
(REPORT/'report.json').write_text(json.dumps(report,indent=2))
updated={r['id']:{k:r[k] for k in ['id','revision','media','scene','video']} for r in report}
(ROOT/'public-site-src/tutorial-rendered.json').write_text(json.dumps([updated.get(r['id'],r) for r in references],indent=2))
print('PASS: decoded videos; original model and geometry restored',flush=True)
