import bpy, os, sys, math, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from lib_scene import *
OUT = os.path.dirname(os.path.abspath(__file__))
use_gpu()
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine='CYCLES'; sc.cycles.device='GPU'
sc.render.resolution_x = sc.render.resolution_y = 700
sc.render.image_settings.file_format='PNG'; sc.render.image_settings.color_mode='RGB'
sc.view_settings.view_transform='Standard'
try: sc.view_settings.look='None'
except TypeError: pass
sc.cycles.denoiser='OPENIMAGEDENOISE'
sc.cycles.denoising_input_passes='RGB_ALBEDO_NORMAL'
sc.cycles.denoising_prefilter='ACCURATE'

w=bpy.data.worlds.new("W"); sc.world=w; w.use_nodes=True
bg=next(n for n in w.node_tree.nodes if n.type=='BACKGROUND')
bg.inputs[0].default_value=(1,1,1,1); bg.inputs[1].default_value=0.08

bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=96, ring_count=48, location=(0,0,1))
sph=bpy.context.active_object; bpy.ops.object.shade_smooth()
bpy.ops.mesh.primitive_plane_add(size=30, location=(0,0,0))
gp=bpy.context.active_object

def clay(ob, hexc, rough):
    m=bpy.data.materials.new("m"); m.use_nodes=True; ob.data.materials.append(m)
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs["Base Color"].default_value=(*hex_lin(hexc),1)
    p.inputs["Roughness"].default_value=rough
    return m
clay(sph,"E8E6E2",0.5); clay(gp,"F2F1EF",0.6)

def area(name, loc, rot, size, energy):
    ld=bpy.data.lights.new(name,'AREA'); ld.shape='SQUARE'; ld.size=size; ld.energy=energy
    o=bpy.data.objects.new(name,ld); sc.collection.objects.link(o)
    o.location=loc; o.rotation_euler=rot; return o
area("key",(-2.6,-2.2,3.2),(math.radians(48),0,math.radians(-50)),3.0,180)
area("fill",(3.0,-1.8,1.8),(math.radians(70),0,math.radians(58)),4.0,60)
area("rim",(1.2,3.2,2.6),(math.radians(115),0,math.radians(160)),2.0,120)

cd=bpy.data.cameras.new("C"); cd.lens=85
cam=bpy.data.objects.new("C",cd); sc.collection.objects.link(cam); sc.camera=cam
cam.location=(0,-7.0,1.7); cam.rotation_euler=(math.radians(88),0,0)

def render(tag, samples, thr, denoise, timelimit=0):
    sc.cycles.samples=samples
    sc.cycles.use_adaptive_sampling = thr > 0
    sc.cycles.adaptive_threshold=thr
    sc.cycles.use_denoising=denoise
    fp=os.path.join(OUT,f"n_{tag}.png"); sc.render.filepath=fp
    t=time.time(); bpy.ops.render.render(write_still=True); dt=time.time()-t
    return read(fp), dt

ref, tref = render("ref", 8192, 0.0, False)
print("REF time", round(tref,1))
Lref = lum(ref)
# shadow region: darkest 15% of the ground plane area (bottom third of frame)
ground = Lref[430:660, 120:580]
thr_dark = np.percentile(ground, 20)
mask_shadow = np.zeros_like(Lref, dtype=bool)
mask_shadow[430:660,120:580] = ground <= thr_dark
print("SHADOWPX", int(mask_shadow.sum()), "mean", round(float(Lref[mask_shadow].mean()*255),1))

rows=[]
cases=[]
for s in (32,64,128,256,512,1024,2048):
    cases.append((f"s{s}_t0.01_dn1", s, 0.01, True))
    cases.append((f"s{s}_t0.01_dn0", s, 0.01, False))
for thr in (0.05,0.02,0.01,0.005,0.002,0.001):
    cases.append((f"s1024_t{thr}_dn1", 1024, thr, True))
for tag,s,thr,dn in cases:
    a,dt = render(tag,s,thr,dn)
    L=lum(a)
    rmse_all=float(np.sqrt(((L-Lref)**2).mean())*255)
    rmse_sh=float(np.sqrt(((L[mask_shadow]-Lref[mask_shadow])**2).mean())*255)
    # high frequency residual (grain) in shadow box
    box=L[470:620,160:540]; boxr=Lref[470:620,160:540]
    hp=float(((box-boxblur(box,2))-(boxr-boxblur(boxr,2))).std()*255)
    row=dict(tag=tag,samples=s,threshold=thr,denoise=dn,sec=round(dt,1),
             rmse_all_255=round(rmse_all,3),rmse_shadow_255=round(rmse_sh,3),hf_shadow_255=round(hp,3))
    rows.append(row); print("NOISE", json.dumps(row))
open(os.path.join(OUT,'noise.json'),'w').write(json.dumps(rows,indent=1))
