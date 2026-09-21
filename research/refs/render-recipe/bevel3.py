import bpy, os, sys, math, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from lib_scene import *
OUT=os.path.dirname(os.path.abspath(__file__)); use_gpu()
R=1400; SP=3.0; PX_M=R/SP
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene; sc.render.engine='CYCLES'; sc.cycles.device='GPU'
sc.cycles.samples=512; sc.cycles.adaptive_threshold=0.005
sc.cycles.use_denoising=True; sc.cycles.denoiser='OPENIMAGEDENOISE'
sc.render.resolution_x=sc.render.resolution_y=R
sc.render.image_settings.file_format='PNG'; sc.render.image_settings.color_mode='RGB'
sc.view_settings.view_transform='Standard'
try: sc.view_settings.look='None'
except TypeError: pass
w=bpy.data.worlds.new("W"); sc.world=w; w.use_nodes=True
b=next(n for n in w.node_tree.nodes if n.type=='BACKGROUND')
b.inputs[0].default_value=(1,1,1,1); b.inputs[1].default_value=0.10
bpy.ops.mesh.primitive_cube_add(size=2.0, location=(0,0,0))
cu=bpy.context.active_object
m=bpy.data.materials.new("m"); m.use_nodes=True; cu.data.materials.append(m)
p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
p.inputs["Base Color"].default_value=(*hex_lin("C9C7C3"),1); p.inputs["Roughness"].default_value=0.35
bev=cu.modifiers.new("bev",'BEVEL'); bev.segments=8; bev.limit_method='ANGLE'
bev.angle_limit=math.radians(30); bev.width=0.001
try:
    bpy.ops.object.shade_auto_smooth(angle=math.radians(30)); print("AUTOSMOOTH ok")
except Exception as e: print("AUTOSMOOTH fail", e)
ld=bpy.data.lights.new("k",'AREA'); ld.shape='SQUARE'; ld.size=6.0; ld.energy=1200
lo=bpy.data.objects.new("k",ld); sc.collection.objects.link(lo); lo.location=(-3,-3,5)
t=bpy.data.objects.new("T",None); sc.collection.objects.link(t)
c=lo.constraints.new('TRACK_TO'); c.target=t; c.track_axis='TRACK_NEGATIVE_Z'; c.up_axis='UP_Y'
cd=bpy.data.cameras.new("C"); cd.type='ORTHO'; cd.ortho_scale=SP
cam=bpy.data.objects.new("C",cd); sc.collection.objects.link(cam); sc.camera=cam
cam.location=(0,-6,3.4); cam.rotation_euler=(math.radians(60),0,0)
rows=[]
for frac in (0.0,0.0005,0.001,0.0025,0.005,0.01,0.02,0.04):
    bev.show_render = bev.show_viewport = frac>0
    if frac>0: bev.width=frac*2.0
    fp=os.path.join(OUT,f"e_{frac}.png"); sc.render.filepath=fp
    bpy.ops.render.render(write_still=True)
    L=lum(read(fp)).astype(np.float64)
    col=L[:, R//2]
    # find the strongest vertical step in the upper half = top/front edge
    d=np.abs(np.diff(col[200:1000]))
    e=int(np.argmax(d))+200
    top=float(np.median(col[e-90:e-30])); front=float(np.median(col[e+30:e+90]))
    lo_t=min(top,front)+0.2*abs(top-front); hi_t=min(top,front)+0.8*abs(top-front)
    seg=col[e-60:e+60]
    inside=[i for i,v in enumerate(seg) if lo_t<=v<=hi_t]
    ramp=(max(inside)-min(inside)+1) if inside else 0
    rows.append(dict(frac=frac, width_m=round(frac*2,4), geom_px=round(frac*2*PX_M,2),
                     top_255=round(top*255,1), front_255=round(front*255,1),
                     step_255=round(abs(top-front)*255,1), ramp_px=ramp))
    print("BEV3", json.dumps(rows[-1]))
open(os.path.join(OUT,'bevel3.json'),'w').write(json.dumps(rows,indent=1))
