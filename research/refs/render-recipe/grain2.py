import bpy, os, sys, math, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from lib_scene import *

OUT = os.path.dirname(os.path.abspath(__file__))
use_gpu()
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'GPU'
sc.cycles.samples = 256
sc.cycles.adaptive_threshold = 0.01
sc.cycles.use_denoising = True
sc.cycles.denoiser = 'OPENIMAGEDENOISE'
sc.render.resolution_x = sc.render.resolution_y = 1400
sc.render.image_settings.file_format='PNG'; sc.render.image_settings.color_mode='RGB'
sc.view_settings.view_transform = 'Standard'
try: sc.view_settings.look = 'None'
except TypeError: pass

w = bpy.data.worlds.new("W"); sc.world = w; w.use_nodes = True
bg = next(n for n in w.node_tree.nodes if n.type=='BACKGROUND')
bg.inputs[0].default_value = (1,1,1,1); bg.inputs[1].default_value = 0.12

bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, segments=128, ring_count=64, location=(0,0,0))
ob = bpy.context.active_object
bpy.ops.object.shade_smooth()

mat = bpy.data.materials.new("clay"); mat.use_nodes=True; ob.data.materials.append(mat)
nt = mat.node_tree
p = next(n for n in nt.nodes if n.type=='BSDF_PRINCIPLED')
bs(p,"Base Color").default_value = (*hex_lin("E6E4E0"),1)
bs(p,"Roughness").default_value = 0.55
bs(p,"Metallic").default_value = 0.0
noise = nt.nodes.new("ShaderNodeTexNoise")
bump = nt.nodes.new("ShaderNodeBump")
nt.links.new(noise.outputs['Fac'], bump.inputs['Height'])
nt.links.new(bump.outputs['Normal'], bs(p,"Normal"))

# key light
ld = bpy.data.lights.new("key", 'AREA'); ld.shape='SQUARE'; ld.size=3.0; ld.energy=60
lo = bpy.data.objects.new("key", ld); sc.collection.objects.link(lo)
lo.location=(-2.5,-2.0,2.8); lo.rotation_euler=(math.radians(52), 0, math.radians(-50))

cd = bpy.data.cameras.new("C"); cd.lens = 85
cam = bpy.data.objects.new("C", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location=(0,-6.0,0.6); cam.rotation_euler=(math.radians(84.3),0,0)

PATCH = {}
def metric(a, pick=False):
    L = lum(a)
    H,W = L.shape
    if pick or not PATCH:
        best=None
        for cy in range(300, 1100, 40):
            for cx in range(300, 1100, 40):
                P = L[cy-90:cy+90, cx-90:cx+90]
                if P.shape != (180,180): continue
                m = P.mean()
                if m < 0.35 or m > 0.72: continue
                # prefer low large-scale gradient
                g = abs(P[:, :90].mean()-P[:, 90:].mean()) + abs(P[:90].mean()-P[90:].mean())
                sc_ = g
                if best is None or sc_ < best[0]: best=(sc_, cy, cx, m)
        if best: PATCH['cy'], PATCH['cx'] = best[1], best[2]
        else: PATCH['cy'], PATCH['cx'] = 700, 560
    P = L[PATCH['cy']-90:PATCH['cy']+90, PATCH['cx']-90:PATCH['cx']+90]
    hp = P - boxblur(P, 3)
    return float(hp.std()*255), float(P.mean()*255)

rows=[]
import math as _m
PXPM = 1400.0/(36.0/85.0*6.0)   # px per metre at the object plane
combos = [("base",0,0,0,0.0,0.0,True)]
for scale in (60,120,240,480,960):
    combos.append(("scale",scale,2.0,0.0,1.0,0.002,True))
for D in (0.0002,0.0005,0.001,0.002,0.005,0.010):
    combos.append(("height",240,2.0,0.0,1.0,D,True))
combos.append(("detail",240,8.0,0.0,1.0,0.002,True))
combos.append(("detail",240,0.0,0.0,1.0,0.002,True))
combos.append(("distort",240,2.0,2.0,1.0,0.002,True))
combos.append(("nodenoise",240,2.0,0.0,1.0,0.002,False))
combos.append(("nodenoise-base",0,0,0,0.0,0.0,False))
for (grp, scale, detail, dist, strength, distance, dn) in combos:
    sc.cycles.use_denoising = dn
    if scale == 0:
        if bs(p,"Normal").links: nt.links.remove(bs(p,"Normal").links[0])
        tag = grp
    else:
        if not bs(p,"Normal").links: nt.links.new(bump.outputs['Normal'], bs(p,"Normal"))
        noise.inputs['Scale'].default_value = scale
        noise.inputs['Detail'].default_value = detail
        noise.inputs['Roughness'].default_value = 0.5
        noise.inputs['Distortion'].default_value = dist
        bump.inputs['Strength'].default_value = strength
        bump.inputs['Distance'].default_value = distance
        tag = f"{grp}_s{scale}_d{detail}_di{dist}_h{distance}_dn{int(dn)}"
    fp = os.path.join(OUT, f"g_{tag}.png")
    sc.render.filepath = fp
    bpy.ops.render.render(write_still=True)
    a = read(fp)
    hp, mean = metric(a, pick=(grp=="base"))
    lam_px = (2.0/scale)*PXPM if scale else 0
    rows.append(dict(grp=grp, tag=tag, scale=scale, detail=detail, distortion=dist,
                     bump_height_m=distance, denoise=dn, lambda_px=round(lam_px,2),
                     highpass_255=round(hp,3), patch_mean_255=round(mean,1)))
    print("GRAIN", json.dumps(rows[-1]))
open(os.path.join(OUT,'grain.json'),'w').write(json.dumps(rows, indent=1))
