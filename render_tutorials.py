"""Render synthetic tutorial scenes through real native MCP; always restore user state."""
import copy,json,time,urllib.request,subprocess,hashlib,argparse
from pathlib import Path
ROOT=Path(__file__).parent
parser=argparse.ArgumentParser();parser.add_argument('--revision',type=int,default=1);parser.add_argument('--replace-draft',action='store_true');args=parser.parse_args();assert args.revision>=1
OUT=ROOT/f'docs/media/tutorials/r{args.revision}'
if any(OUT.glob('*.mp4')) and not args.replace_draft:raise SystemExit('Choose a new --revision for published media; --replace-draft is only for unpublished drafts')
OUT.mkdir(parents=True,exist_ok=True)
REPORT=Path(f'D:/dev/mcp-production-dry-run/tutorials-r{args.revision}')
REPORT.mkdir(parents=True,exist_ok=True)
def rpc(method,command,**kwargs):
    req={'jsonrpc':'2.0','id':1,'method':method,'params':{'request':{'command':command,**kwargs}}}
    r=urllib.request.Request('http://127.0.0.1:8790/mcp',data=json.dumps(req).encode(),headers={'Content-Type':'application/json'})
    answer=json.load(urllib.request.urlopen(r,timeout=25))
    if 'error' in answer:raise RuntimeError(answer['error'])
    return answer['result']
def film(command,**kwargs):return rpc('scene.cinematic',command,**kwargs)
def signature(seq,end):
    # Dedicated tags allow installers to replace their own clips without touching content.
    seq.extend([
      {'op':'sound','at':0,'dur':.28,'lane':'audio','branding_slot':'intro','play':{'synth':'text_appear','volume':.00065,'duration':.28,'envelop':16,'fadein':.025}},
      {'op':'text','asset':'polynite-wordmark','text':'polynite.io','mode':'screen','box':[.25,.36,.50,.14],'at':end,'dur':2,'in':.7,'out':.35,'fx':'fade','glow':.7,'hold_on_black':1,'branding_slot':'outro','branding_tail':2},
      {'op':'sound','at':end+2-.86,'dur':.86,'lane':'audio','branding_slot':'outro','play':{'synth':'polynite_signature','volume':.00196875,'duration':.86,'envelop':8,'fadein':.015}}])
def title(text,dur=2):return {'op':'text','text':text,'mode':'screen','box':[.12,.12,.76,.16],'at':0,'dur':dur,'in':.8,'out':.4,'fx':'type','glow':.025,'color':[.9,.98,1,1]}
references=json.loads((ROOT/'public-site-src/tutorial-rendered.json').read_text());reference=next(r for r in references if r['id']=='block-explosion');base=json.loads((ROOT/reference.get('media','/docs/media/tutorials/r1/').lstrip('/')/reference['scene']).read_text())
initial=copy.deepcopy(base['initial'])
initial.update(model_hidden=1,scene_only=1,scene_text=[],cr_enable=0,bd_enable=0,film_output_volume=.65,film_sound_volume=.55,film_music_volume=0,film_sounds_fade_at=-1,film_fade=0,cam_yaw=.55,cam_pitch=.5,cam_dist=6,tgt_x=0,tgt_y=1,tgt_z=0,floor_mirror=.12,bg={'r':.015,'g':.02,'b':.03,'a':1},sky_on=0,star_on=0,cloud_on=0,fog_density=0)
palette=[[.12,.8,.9],[.9,.4,.65],[.95,.72,.22]]
geo={}
for y in range(7):
 for x in range(2):
  for z in range(2):geo[f'tower_{y}_{x}_{z}']={'t':'cube','p':[(x-.5)*.44,.22+y*.44,(z-.5)*.44],'s':[.42]*3,'c':palette[y%3],'appearance':'instant'}
tower=copy.deepcopy(initial);tower.update(geo=geo,physics={'version':1,'enabled':False,'gravity':[0,-9.81,0],'substeps':4,'bodies':{}},scene_radius=2,scene_body_radius=2,scene_cx=0,scene_cy=1.5,scene_cz=0,tgt_y=1.5)
seq=[{'op':'camera','at':0,'dur':0,'dist':6,'pitch':22,'yaw':30},{'op':'orbit','at':0,'dur':5,'deg':40},title('BUILD SOMETHING')];signature(seq,5)
scenes=[('colourful-tower',{'version':1,'model':'','initial':tower,'seq':seq})]
burst=copy.deepcopy(initial);burst.update(geo=base['initial']['geo'],physics=base['initial']['physics'],cam_dist=7)
seq=[{'op':'camera','at':0,'dur':0,'dist':7,'pitch':28,'yaw':30},{'op':'freeze','at':0,'dur':1.3,'ease':0},{'op':'orbit','at':0,'dur':6,'deg':30},title('EXPLOSION',1.3)];signature(seq,6)
scenes.append(('block-explosion',{'version':1,'model':'','initial':burst,'seq':seq}))
letters=copy.deepcopy(tower);letters.update(geo={'anchor':{'t':'sphere','p':[0,1,0],'s':[.7]*3,'c':[.1,.7,.8]}},cam_dist=4,tgt_y=1,scene_radius=1.8,scene_cy=1,scene_text=[{'id':'ring','text':'CREATE / VIEW / SHARE','layout':'ring','mode':'ring','anchor':'world','p':[0,1,0],'radius':1.3,'size':.15,'height':0,'angle':90,'rotate_speed':35,'camera_follow':0,'color':[1,.8,.2,1],'glow':.03,'enabled':True}])
letters['scene_text'][0].update(style='title',appearance='none',height=.5,size=.26,camera_follow=1,angle=0)
seq=[{'op':'camera','at':0,'dur':0,'dist':4,'pitch':15,'yaw':30},{'op':'orbit','at':0,'dur':6,'deg':20}];signature(seq,6)
scenes.append(('orbiting-letters',{'version':1,'model':'','initial':letters,'seq':seq}))
status=film('status');assert status.get('branding',{}).get('outro_tail_supported'),'Reload the updated native engine before rendering the black outro'
physics=rpc('scene.physics','status')
assert not status['playing'] and not status['export']['active']
assert not physics['body_count'] or physics['paused'],'Pause physics before rendering'
assert not rpc('scene.interaction','status')['held'] and not rpc('scene.physics_test','status')['active']
original=film('document');(REPORT/'original.scene.json').write_text(json.dumps(original))
report=[]
try:
 for name,document in scenes:
  document['title']=name.replace('-',' ').title()
  raw=json.dumps(document,separators=(',',':')).encode();scene_name=name+'-'+hashlib.sha256(raw).hexdigest()[:12]+'.scene'
  (OUT/scene_name).write_bytes(raw)
  film('load_document',document=document,start_paused=True)
  film('record',directory=str(REPORT),name=name,format='landscape',resolution=720,fps=30,watermark=1,thumbnails=0)
  until=time.monotonic()+100
  while film('status')['export']['active']:
   assert time.monotonic()<until,'export timeout';time.sleep(.25)
  result=film('status')['export'];assert result['completed'],result
  movie=Path(result['files'][0]);dest=OUT/(name+'.mp4');dest.write_bytes(movie.read_bytes())
  subprocess.run(['ffmpeg','-v','error','-i',str(dest),'-f','null','-'],check=True)
  at=2 if name=='block-explosion' else 1
  subprocess.run(['ffmpeg','-v','error','-y','-ss',str(at),'-i',str(dest),'-frames:v','1',str(OUT/(name+'.jpg'))],check=True)
  preview_at=1.3 if name=='block-explosion' else .6 if name=='orbiting-letters' else .4
  subprocess.run(['ffmpeg','-v','error','-y','-ss',str(preview_at),'-i',str(dest),'-t','2','-vf','scale=480:-2,fps=15','-an','-c:v','libx264','-preset','fast','-crf','28','-movflags','+faststart',str(OUT/(name+'-preview.mp4'))],check=True)
  report.append({'id':name,'revision':args.revision,'media':f'/docs/media/tutorials/r{args.revision}/','scene':scene_name,'video':dest.name,'bytes':dest.stat().st_size,'export':result})
  print('Rendered',name,flush=True)
finally:
 if film('status')['export']['active']:film('cancel')
 film('load_document',document=original,start_paused=bool(physics['paused']))
 restored=film('document')
 assert restored['model']==original['model'] and restored['initial']['geo']==original['initial']['geo'],'Restore mismatch'
(REPORT/'report.json').write_text(json.dumps(report,indent=2))
(ROOT/'public-site-src/tutorial-rendered.json').write_text(json.dumps([{k:r[k] for k in ['id','revision','media','scene','video']} for r in report],indent=2))
print('PASS: decoded videos; original model and geometry restored',flush=True)
