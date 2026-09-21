import bpy, os, sys, math, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from lib_scene import *
OUT=os.path.dirname(os.path.abspath(__file__))
use_gpu()
def base(res):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc=bpy.context.scene; sc.render.engine='CYCLES'; sc.cycles.device='GPU'
    sc.cycles.samples=1024; sc.cycles.adaptive_threshold=0.005
    sc.cycles.use_denoising=True; sc.cycles.denoiser='OPENIMAGEDENOISE'
    sc.render.resolution_x=sc.render.resolution_y=res
    sc.render.image_settings.file_format='PNG'; sc.render.image_settings.color_mode='RGB'
    sc.view_settings.view_transform='Standard'
    try: sc.view_settings.look='None'
    except TypeError: pass
    w=bpy.data.worlds.new("W"); sc.world=w; w.use_nodes=True
    b=next(n for n in w.node_tree.nodes if n.type=='BACKGROUND')
    b.inputs[0].default_value=(1,1,1,1); b.inputs[1].default_value=0.0
    return sc,b
def mat(ob,hexc,rough,metallic=0.0):
    m=bpy.data.materials.new("m"); m.use_nodes=True; ob.data.materials.append(m)
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs["Base Color"].default_value=(*hex_lin(hexc),1)
    p.inputs["Roughness"].default_value=rough; p.inputs["Metallic"].default_value=metallic
    return p

########## A: penumbra law ##########
RES=1200; SPAN=8.0; MM_PX=SPAN/RES*1000
sc,bgn=base(RES)
bpy.ops.mesh.primitive_plane_add(size=40, location=(0,0,0))
mat(bpy.context.active_object,"FFFFFF",0.9)
bpy.ops.mesh.primitive_plane_add(size=1.0, location=(-1.5,0,1.0))
card=bpy.context.active_object; mat(card,"222222",0.9)
ld=bpy.data.lights.new("k",'AREA'); ld.shape='SQUARE'; ld.size=1.0; ld.energy=3000
lo=bpy.data.objects.new("k",ld); sc.collection.objects.link(lo)
tgt=bpy.data.objects.new("T",None); sc.collection.objects.link(tgt); tgt.location=(-3.3,0,0)
c=lo.constraints.new('TRACK_TO'); c.target=tgt; c.track_axis='TRACK_NEGATIVE_Z'; c.up_axis='UP_Y'
cd=bpy.data.cameras.new("C"); cd.type='ORTHO'; cd.ortho_scale=SPAN
cam=bpy.data.objects.new("C",cd); sc.collection.objects.link(cam); sc.camera=cam
cam.location=(0,0,14); cam.rotation_euler=(0,0,0)
rows=[]
for LZ in (5.0, 3.0):
    lo.location=(3.0,0,LZ)
    for S in (0.25,0.5,1.0,2.0,4.0):
        ld.size=S; ld.energy=3000*(LZ/5.0)**2
        fp=os.path.join(OUT,f"q_{S}_{LZ}.png"); sc.render.filepath=fp
        bpy.ops.render.render(write_still=True)
        L=lum(read(fp))
        line=L[RES//2].astype(np.float64)
        # scan left half (shadow lies at x<-2), find monotone shadow->lit edge
        seg=line[0:int(RES*0.42)]
        dark=float(np.percentile(seg,5)); lit=float(np.percentile(seg,95))
        if lit-dark < 0.02:
            rows.append(dict(size=S,lz=LZ,err="no shadow")); print("PEN2",json.dumps(rows[-1])); continue
        t20=dark+0.2*(lit-dark); t80=dark+0.8*(lit-dark)
        i=int(np.argmin(seg))              # deepest point of the shadow
        j=i
        while j<len(seg)-1 and seg[j]<t20: j+=1
        k=j
        while k<len(seg)-1 and seg[k]<t80: k+=1
        pen=k-j
        d = 1.0                            # occluder height above floor
        D = LZ                             # light height above floor
        pred = S*d/(D-d)*1000
        rows.append(dict(size=S, light_z=LZ, penumbra_px=pen, penumbra_mm=round(pen*MM_PX,1),
                         predicted_mm=round(pred,1), dark_255=round(dark*255,1), lit_255=round(lit*255,1)))
        print("PEN2", json.dumps(rows[-1]))
open(os.path.join(OUT,'penumbra2.json'),'w').write(json.dumps(rows,indent=1))

########## B: bevel highlight ##########
R=1400; SP=3.2
sc,bgn=base(R); bgn.inputs[1].default_value=0.03
bpy.ops.mesh.primitive_cube_add(size=2.0, location=(0,0,0), rotation=(0,0,math.radians(45)))
cu=bpy.context.active_object; mat(cu,"C9C7C3",0.30)
bev=cu.modifiers.new("bev",'BEVEL'); bev.segments=8; bev.limit_method='ANGLE'; bev.angle_limit=math.radians(30); bev.width=0.001
try: bpy.ops.object.shade_auto_smooth(angle=math.radians(30))
except Exception as e: print("autosmooth fail", e)
ld=bpy.data.lights.new("k",'AREA'); ld.shape='SQUARE'; ld.size=5.0; ld.energy=900
lo=bpy.data.objects.new("k",ld); sc.collection.objects.link(lo)
lo.location=(-4.0,-4.0,4.0)
t2=bpy.data.objects.new("T2",None); sc.collection.objects.link(t2); t2.location=(0,0,0)
cc=lo.constraints.new('TRACK_TO'); cc.target=t2; cc.track_axis='TRACK_NEGATIVE_Z'; cc.up_axis='UP_Y'
cd=bpy.data.cameras.new("C"); cd.type='ORTHO'; cd.ortho_scale=SP
cam=bpy.data.objects.new("C",cd); sc.collection.objects.link(cam); sc.camera=cam
cam.location=(0,-8,0); cam.rotation_euler=(math.radians(90),0,0)
PX_M = R/SP
brows=[]
for frac in (0.0005,0.0025,0.005,0.01,0.02,0.04):
    bev.width = frac*2.0
    fp=os.path.join(OUT,f"c_{frac}.png"); sc.render.filepath=fp
    bpy.ops.render.render(write_still=True)
    L=lum(read(fp))
    row_=L[R//2].astype(np.float64)
    mid=R//2
    win=row_[mid-120:mid+120]
    pk=int(np.argmax(win))+mid-120
    peak=float(row_[pk])
    left=float(np.median(row_[mid-260:mid-160])); right=float(np.median(row_[mid+160:mid+260]))
    plateau=(left+right)/2
    half=plateau+0.5*(peak-plateau)
    i=pk
    while i>0 and row_[i]>half: i-=1
    j=pk
    while j<R-1 and row_[j]>half: j+=1
    brows.append(dict(frac=frac, width_m=round(frac*2,4), width_px_geom=round(frac*2*PX_M,2),
                      peak_255=round(peak*255,1), plateau_255=round(plateau*255,1),
                      prominence_255=round((peak-plateau)*255,1), fwhm_px=j-i))
    print("BEV2", json.dumps(brows[-1]))
open(os.path.join(OUT,'bevel2.json'),'w').write(json.dumps(brows,indent=1))

########## C: is Blender PNG alpha straight or premultiplied? ##########
sc,bgn=base(200)
sc.render.film_transparent=True; sc.render.image_settings.color_mode='RGBA'
sc.cycles.samples=32
bpy.ops.mesh.primitive_plane_add(size=20, location=(0,0,0), rotation=(math.radians(90),0,0))
pl=bpy.context.active_object
m=bpy.data.materials.new("em"); m.use_nodes=True; pl.data.materials.append(m)
nt=m.node_tree
for n in list(nt.nodes):
    if n.type!='OUTPUT_MATERIAL': nt.nodes.remove(n)
out=next(n for n in nt.nodes if n.type=='OUTPUT_MATERIAL')
em=nt.nodes.new("ShaderNodeEmission"); em.inputs[0].default_value=(*hex_lin("3A85F0"),1); em.inputs[1].default_value=1.0
tr=nt.nodes.new("ShaderNodeBsdfTransparent")
mx=nt.nodes.new("ShaderNodeMixShader"); mx.inputs[0].default_value=0.5   # 50% transparent
nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2])
nt.links.new(mx.outputs[0], out.inputs['Surface'])
cd=bpy.data.cameras.new("C"); cd.type='ORTHO'; cd.ortho_scale=2.0
cam=bpy.data.objects.new("C",cd); sc.collection.objects.link(cam); sc.camera=cam
cam.location=(0,-5,0); cam.rotation_euler=(math.radians(90),0,0)
for fmt,ext in (('PNG','png'),('WEBP','webp')):
    sc.render.image_settings.file_format=fmt
    if fmt=='WEBP': sc.render.image_settings.quality=100
    fp=os.path.join(OUT,f"alpha_test.{ext}"); sc.render.filepath=fp
    bpy.ops.render.render(write_still=True)
    img=bpy.data.images.load(fp+("" if fp.endswith(ext) else ""))
    img.colorspace_settings.name='Non-Color'
    h,w=img.size[1],img.size[0]
    A=np.array(img.pixels[:],dtype=np.float32).reshape(h,w,4)
    bpy.data.images.remove(img)
    c=A[h//2, w//2]
    print("ALPHA_STORE", fmt, "rgb8", [round(float(x)*255,1) for x in c[:3]], "a8", round(float(c[3])*255,1))
print("EXPECT straight #3A85F0 = [58,133,240]; premultiplied at a=0.5 -> about [30,70,126] in sRGB-encoded bytes")
